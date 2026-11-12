import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const root = fileURLToPath(new URL("../", import.meta.url));
const dist = join(root, "dist");
const label = (path) => relative(dist, path).split(sep).join("/");
const gzip = (path) => gzipSync(readFileSync(path)).length;
const files = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
const attribute = (attributes, name) =>
  new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, "i").exec(attributes)?.[1];

// Keep the static/dynamic ESM accounting identical to tests/budget.spec.ts.
function inventory(html, file, dynamic = false) {
  const assets = new Set();
  let inlineGzipBytes = 0;
  function visit(url, importer) {
    assert.ok(!/^(?:https?:)?\/\//.test(url), `External script: ${url}`);
    const path = url.split(/[?#]/)[0];
    const target = path.startsWith("/")
      ? resolve(dist, `.${path}`)
      : resolve(dirname(importer), path);
    assert.ok(
      !relative(dist, target).startsWith(".."),
      `Script outside dist: ${url}`,
    );
    if (assets.has(target)) return;
    assets.add(target);
    imports(readFileSync(target, "utf8"), target);
  }
  function imports(code, importer) {
    for (const match of code.matchAll(
      /\b(?:import\s*(?:[^('";]+?\s*from\s*)?|export\s+[^;]+?\s+from\s*)["']([^"']+)["']/g,
    ))
      visit(match[1], importer);
    if (dynamic)
      for (const match of code.matchAll(
        /\bimport\s*\(\s*["'`]([^"'`$]+)["'`]/g,
      ))
        visit(match[1], importer);
  }
  for (const [, attributes, code] of html.matchAll(
    /<script\b([^>]*)>([\s\S]*?)<\/script>/gi,
  )) {
    const type = attribute(attributes, "type");
    if (
      type &&
      !["module", "text/javascript", "application/javascript"].includes(type)
    )
      continue;
    const src = attribute(attributes, "src");
    if (src) visit(src, file);
    else {
      inlineGzipBytes += gzipSync(code).length;
      if (type === "module") imports(code, file);
    }
  }
  for (const [, attributes] of html.matchAll(/<link\b([^>]*)>/gi))
    if (attribute(attributes, "rel") === "modulepreload") {
      const href = attribute(attributes, "href");
      if (href) visit(href, file);
    }
  return { assets, inlineGzipBytes };
}

const html = files(dist)
  .filter((path) => path.endsWith(".html"))
  .sort();
assert.ok(html.length, "No HTML routes: build first");
const eager = new Set();
const complete = new Set();
const routes = html.map((file) => {
  const source = readFileSync(file, "utf8");
  const initial = inventory(source, file);
  const all = inventory(source, file, true);
  for (const asset of initial.assets) eager.add(asset);
  for (const asset of all.assets) complete.add(asset);
  const lazy = [...all.assets].filter((asset) => !initial.assets.has(asset));
  const externalGzipBytes = [...initial.assets].reduce(
    (sum, asset) => sum + gzip(asset),
    0,
  );
  return {
    route: `/${label(file).replace(/(^|\/)index\.html$/, "$1")}`,
    htmlGzipBytes: gzipSync(source).length,
    eagerGzipBytes: initial.inlineGzipBytes + externalGzipBytes,
    inlineGzipBytes: initial.inlineGzipBytes,
    eagerExternalGzipBytes: externalGzipBytes,
    lazyGzipBytes: lazy.reduce((sum, asset) => sum + gzip(asset), 0),
    eagerFiles: [...initial.assets].map(label).sort(),
  };
});
assert.ok(eager.size, "No eager JavaScript assets found");
const lazy = [...complete].filter((asset) => !eager.has(asset)).sort();
assert.ok(lazy.length, "No lazy JavaScript boundary found");
const lazyGzipBytes = lazy.reduce((sum, file) => sum + gzip(file), 0);

const manifest = JSON.parse(
  readFileSync(join(root, "src/gallery/manifest.json"), "utf8"),
);
const sourceModels = files(join(root, "public/models"))
  .filter((file) => file.endsWith(".glb"))
  .sort();
const shippedModels = files(join(dist, "models"))
  .filter((file) => file.endsWith(".glb"))
  .sort();
assert.ok(Object.keys(manifest).length, "Empty model manifest");
assert.equal(
  sourceModels.length,
  Object.keys(manifest).length,
  "Source/manifest model counts differ",
);
assert.deepEqual(
  shippedModels.map((file) => relative(join(dist, "models"), file)).sort(),
  Object.values(manifest).sort(),
  "Expected exactly one emitted hashed copy per model",
);
const modelRows = sourceModels.map((source) => {
  const id = relative(join(root, "public/models"), source).replace(
    /\.glb$/,
    "",
  );
  const bytes = readFileSync(source);
  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 12);
  assert.equal(manifest[id], `${id}.${hash}.glb`, `Stale model hash: ${id}`);
  const file = join(dist, "models", manifest[id]);
  assert.ok(
    readFileSync(file).equals(bytes),
    `Emitted model differs from source: ${id}`,
  );
  return { file: label(file), bytes: bytes.length };
});
const models = {
  count: modelRows.length,
  bytes: modelRows.reduce((sum, model) => sum + model.bytes, 0),
  largest: [...modelRows].sort((a, b) => b.bytes - a.bytes)[0],
  files: modelRows,
};
const report = {
  routes,
  distinctLazy: {
    count: lazy.length,
    gzipBytes: lazyGzipBytes,
    files: lazy.map(label),
  },
  models,
  note: "Gzip inventories mirror budget.spec.ts, not measured network transfer. Inline JS is already in HTML; responsive images, fonts, CSS, runtime requests and caching require browser network evidence. Route lazy sums exclude that route's eager files; distinctLazy excludes the union of all routes' eager files.",
};
assert.ok(
  process.argv.slice(2).every((argument) => argument === "--json"),
  "Usage: node scripts/report-budgets.mjs [--json]",
);
if (process.argv.includes("--json"))
  console.log(JSON.stringify(report, null, 2));
else {
  console.table(
    routes.map(({ route, htmlGzipBytes, eagerGzipBytes, lazyGzipBytes }) => ({
      route,
      htmlGzipBytes,
      eagerGzipBytes,
      lazyGzipBytes,
    })),
  );
  console.table([
    {
      group: "Distinct lazy JavaScript",
      count: lazy.length,
      bytes: lazyGzipBytes,
      encoding: "gzip",
    },
    {
      group: "Shipped models",
      count: models.count,
      bytes: models.bytes,
      encoding: "raw GLB",
    },
    {
      group: models.largest.file,
      count: 1,
      bytes: models.largest.bytes,
      encoding: "largest GLB",
    },
  ]);
  console.log(report.note);
}
for (const route of routes)
  assert.ok(
    route.eagerGzipBytes < 25_000,
    `${route.route} exceeds eager 25KB budget`,
  );
assert.ok(
  lazyGzipBytes < 260_000,
  "Distinct lazy JavaScript exceeds 260KB gzip",
);
assert.ok(models.bytes < 1_500_000, "Shipped models exceed 1.5MB");
