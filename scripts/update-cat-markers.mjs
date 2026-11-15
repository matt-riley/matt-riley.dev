import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const config = JSON.parse(
  readFileSync(new URL("../blender/cat-spots.json", import.meta.url), "utf8"),
);
assert.equal(
  config.spots.length,
  13,
  "Exactly thirteen authored cat markers are required",
);
assert.deepEqual(
  config.spots.map((spot) => spot.id).sort((a, b) => a - b),
  Array.from({ length: 13 }, (_, i) => i),
);
for (const spot of config.spots) {
  assert.ok(
    Array.isArray(spot.position) &&
      spot.position.length === 3 &&
      spot.position.every(Number.isFinite),
  );
  assert.ok(["sit", "loaf", "stretch", "sleep"].includes(spot.pose));
  assert.ok(Number.isInteger(spot.stop) && spot.stop >= 0 && spot.stop <= 8);
}
const files = process.argv.slice(2);
if (!files.length)
  files.push(
    fileURLToPath(new URL("../public/models/room.glb", import.meta.url)),
  );
const digest = (buffer) => createHash("sha256").update(buffer).digest("hex");
for (const path of files) {
  const original = readFileSync(path);
  assert.equal(original.readUInt32LE(0), 0x46546c67, "Expected a GLB file");
  assert.equal(original.readUInt32LE(4), 2, "Expected glTF version 2");
  assert.equal(original.readUInt32LE(8), original.length, "Invalid GLB length");
  const chunks = [];
  for (let offset = 12; offset < original.length; ) {
    const size = original.readUInt32LE(offset);
    const type = original.readUInt32LE(offset + 4);
    assert.ok(offset + 8 + size <= original.length, "Invalid GLB chunk length");
    chunks.push({
      type,
      data: original.subarray(offset + 8, offset + 8 + size),
    });
    offset += 8 + size;
  }
  assert.equal(chunks.filter((chunk) => chunk.type === 0x4e4f534a).length, 1);
  const jsonChunk = chunks.find((chunk) => chunk.type === 0x4e4f534a);
  const document = JSON.parse(jsonChunk.data.toString("utf8"));
  const expected = structuredClone(document);
  const names = document.nodes
    .filter((node) => /^cat_\d+$/.test(node.name))
    .map((node) => node.name)
    .sort();
  assert.deepEqual(names, config.spots.map((spot) => `cat_${spot.id}`).sort());
  for (const spot of config.spots) {
    const name = `cat_${spot.id}`;
    const node = document.nodes.find((node) => node.name === name);
    assert.equal(
      node.extras?.pose,
      spot.pose,
      `${name} pose must remain unchanged`,
    );
    assert.equal(
      node.extras?.stop,
      spot.stop,
      `${name} stop must remain unchanged`,
    );
    const [x, y, z] = spot.position;
    node.translation = [x, z, y === 0 ? 0 : -y].map(Math.fround);
    expected.nodes.find((node) => node.name === name).translation =
      node.translation;
  }
  assert.deepEqual(
    document,
    expected,
    "Only cat marker translations may change",
  );
  const json = Buffer.from(JSON.stringify(document));
  jsonChunk.data = Buffer.alloc(Math.ceil(json.length / 4) * 4, 0x20);
  json.copy(jsonChunk.data);
  const rebuilt = chunks.map((chunk) => {
    const header = Buffer.alloc(8);
    header.writeUInt32LE(chunk.data.length, 0);
    header.writeUInt32LE(chunk.type, 4);
    return Buffer.concat([header, chunk.data]);
  });
  const header = Buffer.from(original.subarray(0, 12));
  header.writeUInt32LE(
    12 + rebuilt.reduce((size, chunk) => size + chunk.length, 0),
    8,
  );
  const output = Buffer.concat([header, ...rebuilt]);
  let offset = 12;
  for (const chunk of chunks) {
    const size = output.readUInt32LE(offset);
    if (chunk.type !== 0x4e4f534a)
      assert.ok(
        output.subarray(offset + 8, offset + 8 + size).equals(chunk.data),
        "Binary chunks must remain byte-identical",
      );
    offset += 8 + size;
  }
  writeFileSync(path, output);
  console.log(
    `${path}: 13 marker translations; other JSON unchanged; BIN SHA256 ${chunks
      .filter((chunk) => chunk.type === 0x004e4942)
      .map((chunk) => digest(chunk.data))
      .join(", ")}`,
  );
}
