// Reuse Astro's existing sharp dependency; this is a local render-document tool.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const sharp = createRequire(import.meta.resolve('astro/package.json'))('sharp');
const root = fileURLToPath(new URL('./', import.meta.url));
const roughness = [0.75, 0.85, 0.95];
const colours = ['#DF6D17', '#E8741A', '#EF7B20'];
const overlays = [];
const label = (text, width, height, size=20) => Buffer.from(`<svg width="${width}" height="${height}"><rect width="100%" height="100%" fill="#f4f1ea"/><text x="20" y="28" fill="#17171a" font-size="${size}" font-family="sans-serif">${text}</text></svg>`);
overlays.push({input: label('B-02 / Material studies — baseline P2/G2 approved; other variants retained for comparison',2400,40,22),left:0,top:0});
for (let row=0;row<3;row++) for(let col=0;col<3;col++) {
  overlays.push({input:label(`P${row+1} / roughness ${roughness[row]} · G${col+1} / ${colours[col]}`,800,40),left:col*800,top:40+row*520});
  overlays.push({input:join(root,'out/keyframe-variants',`p${row+1}-g${col+1}.png`),left:col*800,top:80+row*520});
}
await sharp({create:{width:2400,height:1600,channels:3,background:'#f4f1ea'}}).composite(overlays).png().toFile(join(root,'renders/keyframe/contact-sheet.png'));
console.log('Wrote blender/renders/keyframe/contact-sheet.png (2400×1600)');
