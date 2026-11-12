// Assemble original Blender turntables using Astro's existing Sharp dependency.
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
const sharp = createRequire(import.meta.resolve("astro/package.json"))("sharp");
const root = fileURLToPath(new URL("./", import.meta.url));
const output = join(root, "renders/project-models");
mkdirSync(output, { recursive: true });
const label = (text, width=512, height=28) => Buffer.from(`<svg width="${width}" height="${height}"><rect width="100%" height="100%" fill="#f4f1ea"/><text x="12" y="20" fill="#17171a" font-size="14" font-family="sans-serif">${text}</text></svg>`);
for (const name of ["tools", "flagz", "waffle_agent", "agent_skills", "waystone"]) {
  const layers = [{ input: label(`${name} / approved P2-G2 / four original Blender views`,1024,40), left:0, top:0 }];
  for(let i=0;i<4;i++) {
    const left=(i%2)*512, top=40+Math.floor(i/2)*540;
    layers.push({input:label(`${i*90} degrees`),left,top});
    layers.push({input:join(root,"out/model-reviews",`${name}-${i}.png`),left,top:top+28});
  }
  await sharp({create:{width:1024,height:1120,channels:3,background:"#f4f1ea"}}).composite(layers).jpeg({quality:85}).toFile(join(output,`${name}-contact.jpg`));
  await sharp(join(root,"out/model-reviews",`${name}-silhouette.png`)).flatten({background:"white"}).png().toFile(join(output,`${name}-silhouette.png`));
}
console.log("Wrote five turntable contact sheets and five original silhouettes.");
