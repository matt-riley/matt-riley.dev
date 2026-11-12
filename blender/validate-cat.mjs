import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const path = fileURLToPath(new URL("../public/models/cat.glb", import.meta.url));
const bytes = readFileSync(path);
assert.equal(bytes.toString("ascii", 0, 4), "glTF");
assert.equal(bytes.readUInt32LE(4), 2);
assert.ok(bytes.length < 100_000, `cat.glb is ${bytes.length} bytes; budget is under 100KB`);
const model = JSON.parse(bytes.toString("utf8", 20, 20 + bytes.readUInt32LE(12)));
assert.deepEqual(model.animations ?? [], []);
assert.deepEqual(model.materials.map(material => material.name).sort(), ["glaze", "glaze_dark"]);
const rows = [];
function triangles(node) {
  let total = 0;
  if (node.mesh !== undefined) {
    for (const primitive of model.meshes[node.mesh].primitives) {
      assert.equal(primitive.mode ?? 4, 4);
      total += model.accessors[primitive.indices ?? primitive.attributes.POSITION].count / 3;
    }
  }
  return total + (node.children ?? []).reduce((sum, index) => sum + triangles(model.nodes[index]), 0);
}
for (const pose of ["sit", "loaf", "stretch", "sleep"]) {
  const matches = model.nodes.filter(node => node.name === `cat_${pose}`);
  assert.equal(matches.length, 1, `exactly one cat_${pose} node`);
  const node = matches[0];
  assert.deepEqual(node.translation ?? [0, 0, 0], [0, 0, 0], `${node.name}: base pivot is authored at the origin`);
  assert.deepEqual(node.rotation ?? [0, 0, 0, 1], [0, 0, 0, 1], `${node.name}: directly cloneable Y-up pose`);
  assert.deepEqual(node.scale ?? [1, 1, 1], [1, 1, 1], `${node.name}: metre scale`);
  const count = triangles(node);
  assert.ok(count > 100 && count < 3000, `${node.name}: ${count} triangles`);
  rows.push({ pose: node.name, triangles: count });
}
console.table(rows);
console.log(`cat.glb: ${bytes.length} / 100,000 bytes; four static poses, two glazed materials, no animation.`);
