import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  existsSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const manifestPath = join(root, "src/gallery/manifest.json");
const digest = (bytes) =>
  createHash("sha256").update(bytes).digest("hex").slice(0, 12);

export function writeModelManifest() {
  const source = join(root, "public/models");
  const manifest = Object.fromEntries(
    readdirSync(source)
      .filter((file) => /^[\w-]+\.glb$/.test(file))
      .sort()
      .map((file) => {
        const id = file.slice(0, -4);
        return [id, `${id}.${digest(readFileSync(join(source, file)))}.glb`];
      }),
  );
  assert.ok(Object.keys(manifest).length, "No source models found");
  const content = `${JSON.stringify(manifest, null, 2)}\n`;
  if (
    !existsSync(manifestPath) ||
    readFileSync(manifestPath, "utf8") !== content
  )
    writeFileSync(manifestPath, content);
  return manifest;
}

export function packageModels() {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const directory = join(root, "dist/models");
  const plan = Object.entries(manifest).map(([id, file]) => {
    const source = join(directory, `${id}.glb`);
    const target = join(directory, file);
    const input = existsSync(source) ? source : target;
    const bytes = readFileSync(input);
    assert.equal(
      file,
      `${id}.${digest(bytes)}.glb`,
      `Model changed during build: ${id}`,
    );
    return { source, target, input };
  });
  for (const item of plan)
    if (item.input === item.source) renameSync(item.source, item.target);
  const actual = readdirSync(directory)
    .filter((file) => file.endsWith(".glb"))
    .sort();
  assert.deepEqual(
    actual,
    Object.values(manifest).sort(),
    "dist must contain only the hashed model set",
  );
  let count = 0;
  let largest = { file: "", bytes: 0 };
  function inspect(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) inspect(path);
      else if (entry.isFile()) {
        count++;
        const bytes = statSync(path).size;
        if (bytes > largest.bytes)
          largest = { file: relative(join(root, "dist"), path), bytes };
        assert.ok(
          bytes <= 25 * 1024 * 1024,
          `${path} exceeds Workers' 25 MiB file limit`,
        );
      } else throw new Error(`Unexpected non-file asset: ${path}`);
    }
  }
  inspect(join(root, "dist"));
  assert.ok(count <= 20_000, "Build exceeds Workers Free's 20,000 asset limit");
  console.log(
    `Static assets: ${count} / 20,000 files; largest ${largest.file}: ${largest.bytes} / 26,214,400 bytes`,
  );
  return { count, largest };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const command = process.argv[2];
  if (command === "manifest") writeModelManifest();
  else if (command === "package") packageModels();
  else
    throw new Error("Usage: node scripts/model-artifacts.mjs manifest|package");
}
