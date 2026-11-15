import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { expect, test } from "@playwright/test";
import { dist, htmlFiles } from "./routes";

function attribute(attributes: string, name: string): string | undefined {
  return new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, "i").exec(
    attributes,
  )?.[1];
}

function assetPath(url: string, importer: string): string {
  if (/^(?:https?:)?\/\//.test(url))
    throw new Error(`Cannot account for external script: ${url}`);
  const path = url.split(/[?#]/)[0];
  return path.startsWith("/")
    ? resolve(dist, `.${path}`)
    : resolve(dirname(importer), path);
}

function scriptInventory(html: string, file: string, dynamic = false) {
  const assets = new Set<string>();
  let bytes = 0;
  function visit(url: string, importer: string) {
    const path = assetPath(url, importer);
    if (assets.has(path)) return;
    assets.add(path);
    const code = readFileSync(path, "utf8");
    bytes += gzipSync(code).length;
    imports(code, path);
  }
  function imports(code: string, importer: string) {
    // Static ESM imports/exports are eager. import(...) is deliberately excluded.
    const pattern =
      /\b(?:import\s*(?:[^('";]+?\s*from\s*)?|export\s+[^;]+?\s+from\s*)["']([^"']+)["']/g;
    for (const match of code.matchAll(pattern)) visit(match[1], importer);
    if (dynamic) {
      for (const match of code.matchAll(
        /\bimport\s*\(\s*["'`]([^"'`$]+)["'`]/g,
      ))
        visit(match[1], importer);
    }
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
      bytes += gzipSync(code).length;
      if (type === "module") imports(code, file);
    }
  }
  for (const [, attributes] of html.matchAll(/<link\b([^>]*)>/gi)) {
    if (attribute(attributes, "rel") !== "modulepreload") continue;
    const href = attribute(attributes, "href");
    if (href) visit(href, file);
  }
  return { bytes, assets };
}

function eagerBytes(html: string, file: string): number {
  return scriptInventory(html, file).bytes;
}

function modelFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? modelFiles(path)
      : entry.name.endsWith(".glb")
        ? [path]
        : [];
  });
}

test("each route stays below 25KB gzip of eagerly loaded JavaScript", () => {
  test.skip(
    test.info().project.name !== "desktop-chromium",
    "The build is shared by every browser project.",
  );
  const files = htmlFiles();
  expect(files.length).toBeGreaterThan(0);
  for (const file of files) {
    const bytes = eagerBytes(readFileSync(file, "utf8"), file);
    expect(
      bytes,
      `${file}: ${bytes} bytes of eager JavaScript gzip`,
    ).toBeLessThan(25_000);
  }
});

test("all emitted models stay below 1.5MB combined", () => {
  test.skip(
    test.info().project.name !== "desktop-chromium",
    "The models are shared by every browser project.",
  );
  const files = modelFiles(resolve("dist"));
  expect(
    files.length,
    "The built model inventory must be nonempty",
  ).toBeGreaterThan(0);
  const bytes = files.reduce((sum, file) => sum + statSync(file).size, 0);
  expect(bytes).toBeLessThan(1_500_000);
});

test("lazy gallery JavaScript stays below 260KB gzip", () => {
  test.skip(
    test.info().project.name !== "desktop-chromium",
    "The build is shared by every browser project.",
  );
  const eager = new Set<string>();
  const complete = new Set<string>();
  for (const file of htmlFiles()) {
    const html = readFileSync(file, "utf8");
    for (const asset of scriptInventory(html, file).assets) eager.add(asset);
    for (const asset of scriptInventory(html, file, true).assets)
      complete.add(asset);
  }
  const lazy = [...complete].filter((asset) => !eager.has(asset));
  expect(
    lazy.length,
    "the gallery must have a lazy import boundary",
  ).toBeGreaterThan(0);
  const bytes = lazy.reduce(
    (sum, file) => sum + gzipSync(readFileSync(file, "utf8")).length,
    0,
  );
  expect(bytes, `${bytes} bytes of lazy gallery JavaScript gzip`).toBeLessThan(
    260_000,
  );
});
