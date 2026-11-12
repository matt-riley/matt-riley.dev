// Review only: all photographs are original Blender renders, never downloaded.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const sharp = createRequire(import.meta.resolve("astro/package.json"))("sharp");
const root = fileURLToPath(new URL("./", import.meta.url));
const stops = ["entrance", "tools", "flagz", "waffle-agent", "agent-skills", "waystone", "acquisitions", "human-error", "gift-shop"];
const output = join(root, "renders/catalogue");
mkdirSync(output, { recursive: true });
for (const crop of ["wide", "square"]) {
  const width = crop === "wide" ? 480 : 360;
  const height = 320 + 28;
  const overlays = [];
  for (const [row, stop] of stops.entries()) for (const [column, mode] of ["day", "night"].entries()) {
    const left = column * width;
    const top = row * height;
    overlays.push({ input: Buffer.from(`<svg width="${width}" height="28"><rect width="100%" height="100%" fill="#f4f1ea"/><text x="12" y="20" font-family="sans-serif" font-size="15" fill="#17171a">${stop} / ${mode} / ${crop}</text></svg>`), left, top });
    const photograph = await sharp(join(root, "out/stills", `${stop}-${mode}-${crop}.png`)).resize(width, 320, { fit: "contain", background: "#f4f1ea" }).png().toBuffer();
    overlays.push({ input: photograph, left, top: top + 28 });
  }
  await sharp({ create: { width: width * 2, height: height * 9, channels: 3, background: "#f4f1ea" } }).composite(overlays).png().toFile(join(output, `${crop}-contact-sheet.png`));
}
copyFileSync(join(root, "out/stills/parameters.json"), join(output, "parameters.json"));
