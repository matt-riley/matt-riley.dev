import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const root=fileURLToPath(new URL('./',import.meta.url));
const sharp=createRequire(import.meta.resolve('astro/package.json'))('sharp');
const tiles=[];
for(let stop=0;stop<9;stop++) tiles.push({input:await sharp(join(root,'renders/room',`stop-${stop}.png`)).resize(800,500).toBuffer(),left:(stop%3)*800,top:Math.floor(stop/3)*500});
await sharp({create:{width:2400,height:1500,channels:3,background:'#f4f1ea'}}).composite(tiles).png().toFile(join(root,'renders/room/contact-sheet.png'));
console.log('Wrote nine-stop room viewer contact sheet.');
