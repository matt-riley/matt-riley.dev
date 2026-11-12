// Assemble B-05's original Blender renders; no third-party media is shipped.
import { createRequire } from "node:module";
import { mkdirSync, copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
const sharp = createRequire(import.meta.resolve("astro/package.json"))("sharp");
const root = fileURLToPath(new URL("./", import.meta.url));
const output = join(root, "renders/human-objects");
mkdirSync(output, { recursive: true });
for (const name of ["open-mic", "boom-bap", "absent", "gift-shop"]) {
  const overlays = [];
  for (const [index, angle] of [0, 90, 180, 270].entries()) {
    const left = (index % 2) * 640;
    const top = Math.floor(index / 2) * 680;
    overlays.push({ input: Buffer.from(`<svg width="640" height="40"><rect width="100%" height="100%" fill="#f4f1ea"/><text x="20" y="27" font-family="sans-serif" font-size="18" fill="#17171a">${name} / ${angle}° · approved P2/G2</text></svg>`), left, top });
    overlays.push({ input: join(root, "out/human-turntable-frames", `${name}-${angle}.png`), left, top: top + 40 });
  }
  await sharp({ create: { width: 1280, height: 1360, channels: 3, background: "#f4f1ea" } }).composite(overlays).png().toFile(join(output, `${name}-contact-sheet.png`));
  console.log(`Wrote ${name}-contact-sheet.png`);
}
copyFileSync(join(root, "out/human-turntable-frames/parameters.json"), join(output, "parameters.json"));
