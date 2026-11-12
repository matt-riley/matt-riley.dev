import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { Box3,Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
await MeshoptDecoder.ready;
const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const root=fileURLToPath(new URL('../',import.meta.url));
const rows=[];
for(const [name,touchNames]of [['open-mic',['touch_mic']],['boom-bap',Array.from({length:16},(_,n)=>`touch_pad_${n}`)],['absent',[]],['gift-shop',['touch_item_work','touch_item_tools','touch_item_github']]]){
 const bytes=readFileSync(`${root}/public/models/${name}.glb`);
 const json=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
 assert.equal(json.textures?.length??0,0);
 assert.deepEqual(json.materials.map(m=>m.name).sort(),['glaze','porcelain']);
 const model=await new Promise((resolve,reject)=>loader.parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'',resolve,reject));
 assert.ok(model.scene.getObjectByName(`exhibit_${name}`));
 const touches=[];let triangles=0;
 model.scene.traverse(node=>{
  if(node.name.startsWith('touch_')){
   touches.push(node.name);
   assert.ok(['x','y','z'].includes(node.userData.axis));
   assert.ok(['hinge','slide'].includes(node.userData.kind));
   assert.equal(node.userData.range.length,2);
   assert.ok(node.userData.range.every(Number.isFinite));
   if(name==='boom-bap'||name==='gift-shop'){
    assert.equal(node.userData.kind,'slide');assert.equal(node.userData.axis,'y');
    assert.deepEqual(node.userData.range,name==='boom-bap'?[-0.003,0]:[0,0.04]);
   }
  }
  if(node.isMesh)triangles+=(node.geometry.index?.count??node.geometry.getAttribute('position').count)/3;
 });
 assert.deepEqual(touches.sort(),touchNames.sort());
 const bounds=new Box3().setFromObject(model.scene);const size=bounds.getSize(new Vector3());
 assert.ok(Math.max(size.x,size.y,size.z)<=0.5001,`${name} size exceeds half metre: ${size.toArray()}`);
 assert.ok(bytes.length<120000);assert.ok(triangles<=15000);
 rows.push({name,bytes:bytes.length,triangles,touches:touches.length,bounds:size.toArray().map(n=>n.toFixed(4)).join(' × ')});
}
console.table(rows);
console.log('PASS: Three.js+Meshopt runtime load, roots, pivots/extras, dimensions, materials, no textures, byte and triangle budgets.');
