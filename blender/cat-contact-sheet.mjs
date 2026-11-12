// Reuse Astro's existing sharp dependency for this render evidence document.
import { createRequire } from "node:module";
import { mkdirSync, copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
const sharp = createRequire(import.meta.resolve("astro/package.json"))("sharp");
const root = fileURLToPath(new URL("./", import.meta.url));
const source = join(root, "out/cat-views");
const output = join(root, "renders/cat");
mkdirSync(output, { recursive: true });
const poses = ["sit", "loaf", "stretch", "sleep"];
const views = ["front", "side", "three-quarter"];
const label = (text, width, height, size = 20) => Buffer.from(`<svg width="${width}" height="${height}"><rect width="100%" height="100%" fill="#f4f1ea"/><text x="16" y="28" fill="#17171a" font-size="${size}" font-family="sans-serif">${text}</text></svg>`);
const panels = [{ input: label("B-06 / Waffle, Head of Security — four ceramic poses in approved P2/G2 day lighting", 1440, 48, 23), left: 0, top: 0 }];
for (let row = 0; row < poses.length; row++) {
  for (let column = 0; column < views.length; column++) {
    panels.push({ input: label(`cat_${poses[row]} / ${views[column]}`, 480, 40), left: column * 480, top: 48 + row * 400 });
    panels.push({ input: join(source, `${poses[row]}-${views[column]}.png`), left: column * 480, top: 88 + row * 400 });
  }
}
await sharp({ create: { width: 1440, height: 1648, channels: 3, background: "#f4f1ea" } }).composite(panels).png().toFile(join(output, "contact-sheet.png"));
const thumbs = [{ input: label("The same four poses, each exactly 80 pixels high", 960, 48, 23), left: 0, top: 0 }];
for (let index = 0; index < poses.length; index++) {
  const image = await sharp(join(source, `${poses[index]}-cutout.png`)).trim({ threshold: 5, background: "#00000000" }).resize({ height: 80 }).png().toBuffer();
  const { width } = await sharp(image).metadata();
  thumbs.push({ input: image, left: index * 240 + Math.floor((240 - width) / 2), top: 56 });
  thumbs.push({ input: label(`cat_${poses[index]}`, 240, 40, 18), left: index * 240, top: 152 });
}
await sharp({ create: { width: 960, height: 192, channels: 3, background: "#f4f1ea" } }).composite(thumbs).png().toFile(join(output, "80px-poses.png"));
copyFileSync(join(source, "parameters.json"), join(output, "parameters.json"));
console.log("Wrote blender/renders/cat/contact-sheet.png and 80px-poses.png");
