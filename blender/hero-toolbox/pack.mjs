import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  readFileSync,
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
const here = fileURLToPath(new URL(".", import.meta.url));
const root = fileURLToPath(new URL("../../", import.meta.url));
const cli =
  process.env.GLTF_TRANSFORM_BIN ||
  join(root, "node_modules/.bin/gltf-transform");
const temp = mkdtempSync(join(root, "blender/out/hero-toolbox/pack-"));
let input = join(root, "blender/out/hero-toolbox/toolbox.raw.glb");
try {
  const steps = [
    ["dedup"],
    ["prune", "--keep-leaves", "true"],
    ["weld"],
    ["tangents"],
    ["resize", "--width", "512", "--height", "512"],
    ["webp", "--quality", "76"],
    ["meshopt"],
  ];
  for (const [i, [command, ...flags]] of steps.entries()) {
    const output = join(temp, `${i}.glb`);
    const result = spawnSync(cli, [command, input, output, ...flags], {
      stdio: "inherit",
    });
    if (result.error || result.status !== 0)
      throw result.error || new Error(`${command}: ${result.status}`);
    input = output;
  }
  const bytes = readFileSync(input);
  const model = JSON.parse(
    bytes.toString("utf8", 20, 20 + bytes.readUInt32LE(12)),
  );
  const triangles = model.nodes.reduce(
    (total, node) =>
      total +
      (node.mesh === undefined
        ? 0
        : model.meshes[node.mesh].primitives.reduce(
            (sum, p) =>
              sum +
              model.accessors[p.indices ?? p.attributes.POSITION].count / 3,
            0,
          )),
    0,
  );
  const parts = model.nodes
    .filter((n) => n.name?.startsWith("touch_") && n.extras?.kind === "hinge")
    .map((n) => ({ name: n.name, ...n.extras }));
  const imageBytes = model.images.reduce(
    (sum, image) => sum + model.bufferViews[image.bufferView].byteLength,
    0,
  );
  function webpSize(data) {
    for (let offset = 12; offset + 8 <= data.length; ) {
      const tag = data.toString("ascii", offset, offset + 4);
      const length = data.readUInt32LE(offset + 4);
      const start = offset + 8;
      if (tag === "VP8 ")
        return [
          data.readUInt16LE(start + 6) & 0x3fff,
          data.readUInt16LE(start + 8) & 0x3fff,
        ];
      if (tag === "VP8L") {
        const value = data.readUInt32LE(start + 1);
        return [(value & 0x3fff) + 1, ((value >>> 14) & 0x3fff) + 1];
      }
      if (tag === "VP8X")
        return [
          data.readUIntLE(start + 4, 3) + 1,
          data.readUIntLE(start + 7, 3) + 1,
        ];
      offset = start + length + (length % 2);
    }
    throw new Error("Cannot inspect embedded WebP dimensions");
  }
  const binStart = 20 + bytes.readUInt32LE(12) + 8;
  const textures = model.images.map((image) => {
    const view = model.bufferViews[image.bufferView];
    const data = bytes.subarray(
      binStart + (view.byteOffset || 0),
      binStart + (view.byteOffset || 0) + view.byteLength,
    );
    const dimensions = webpSize(data);
    if (dimensions.some((value) => value > 512))
      throw new Error("Texture dimension exceeds 512px");
    return { name: image.name, bytes: view.byteLength, dimensions };
  });
  const stats = {
    packedSha256: createHash("sha256").update(bytes).digest("hex"),
    rawSourceSha256: createHash("sha256")
      .update(
        readFileSync(join(root, "blender/out/hero-toolbox/toolbox.raw.glb")),
      )
      .digest("hex"),
    bytes: bytes.length,
    triangles,
    embeddedTextureBytes: imageBytes,
    textures,
    materials: model.materials.map((m) => m.name),
    parts,
  };
  if (bytes.length >= 150000 || triangles >= 10000)
    throw new Error(`Budget exceeded: ${JSON.stringify(stats)}`);
  if (parts.length !== 9)
    throw new Error(
      `Expected nine preserved hinge pivots, got ${parts.length}`,
    );
  const expected = [
    "touch_clasp",
    "touch_lid",
    "touch_handle",
    "touch_tray_front",
    "touch_tray_front_link",
    "touch_tray_front_level",
    "touch_tray_upper",
    "touch_tray_upper_link",
    "touch_tray_upper_level",
  ];
  if (expected.some((name) => !parts.some((part) => part.name === name)))
    throw new Error("A named hinge pivot was lost");
  const destination = join(root, "public/preview-a");
  mkdirSync(destination, { recursive: true });
  renameSync(input, join(destination, "toolbox.glb"));
  writeFileSync(
    join(here, "stats.json"),
    JSON.stringify(stats, null, 2) + "\n",
  );
  console.log(JSON.stringify(stats, null, 2));
} finally {
  rmSync(temp, { recursive: true, force: true });
}
