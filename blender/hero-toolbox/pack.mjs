import { spawnSync } from 'node:child_process';
import { readFileSync, mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = fileURLToPath(new URL('.', import.meta.url));
const root = fileURLToPath(new URL('../../', import.meta.url));
const cli = process.env.GLTF_TRANSFORM_BIN || join(root, 'node_modules/.bin/gltf-transform');
const temp = mkdtempSync(join(root, 'blender/out/hero-toolbox/pack-'));
let input = join(root, 'blender/out/hero-toolbox/toolbox.raw.glb');
try {
  const steps = [['dedup'], ['prune', '--keep-leaves', 'true'], ['weld'], ['tangents'], ['resize', '--width', '512', '--height', '512'], ['webp', '--quality', '76'], ['meshopt']];
  for (const [i, [command, ...flags]] of steps.entries()) {
    const output = join(temp, `${i}.glb`);
    const result = spawnSync(cli, [command, input, output, ...flags], { stdio: 'inherit' });
    if (result.error || result.status !== 0) throw result.error || new Error(`${command}: ${result.status}`);
    input = output;
  }
  const bytes = readFileSync(input);
  const model = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
  const triangles = model.nodes.reduce((total, node) => total + (node.mesh === undefined ? 0 : model.meshes[node.mesh].primitives.reduce((sum, p) => sum + model.accessors[p.indices ?? p.attributes.POSITION].count / 3, 0)), 0);
  const parts = model.nodes.filter(n => n.name?.startsWith('touch_') && n.extras?.kind === 'hinge').map(n => ({ name: n.name, ...n.extras }));
  const imageBytes = model.images.reduce((sum, image) => sum + model.bufferViews[image.bufferView].byteLength, 0);
  const stats = { bytes: bytes.length, triangles, embeddedTextureBytes: imageBytes, textureDimensions: [512,512], materials: model.materials.map(m => m.name), parts };
  if (bytes.length >= 150000 || triangles >= 10000) throw new Error(`Budget exceeded: ${JSON.stringify(stats)}`);
  if (parts.length !== 8) throw new Error(`Expected eight preserved hinge pivots, got ${parts.length}`);
  const destination = join(root, 'public/preview-a');
  mkdirSync(destination, { recursive: true });
  renameSync(input, join(destination, 'toolbox.glb'));
  writeFileSync(join(here, 'stats.json'), JSON.stringify(stats, null, 2) + '\n');
  console.log(JSON.stringify(stats, null, 2));
} finally { rmSync(temp, { recursive: true, force: true }); }
