import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { create } from "fontkit";
import sharp from "sharp";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = join(root, "blender/out/identity");
const args = process.argv.slice(2).filter((arg) => arg !== "--");
if (
  args.length > 1 ||
  (args.length && !["--copy-only", "--icons-only"].includes(args[0]))
)
  throw new Error("Usage: pnpm assets:identity [-- --copy-only|--icons-only]");
mkdirSync(output, { recursive: true });
const favicon = readFileSync(join(root, "public/favicon.svg"));
for (const [name, size] of [
  ["apple-touch-icon", 180],
  ["icon-192", 192],
  ["icon-512", 512],
])
  await sharp(favicon, { density: 600 })
    .resize(size, size)
    .flatten({ background: "#f4f1ea" })
    .png()
    .toFile(join(root, `public/${name}.png`));
if (args[0] === "--icons-only") process.exit(0);
if (!args.length) {
  const render = spawnSync(
    process.env.BLENDER_BIN ||
      "/Applications/Blender.app/Contents/MacOS/Blender",
    [
      "--background",
      "--threads",
      "4",
      "--python-exit-code",
      "1",
      "--python",
      join(root, "blender/render_og.py"),
    ],
    { cwd: root, stdio: "inherit" },
  );
  if (render.error) throw render.error;
  if (render.status !== 0)
    throw new Error(`Share-image render failed (${render.status}).`);
}
const source = join(output, "og-scene.png");
const metadata = await sharp(source).metadata();
if (metadata.width !== 1200 || metadata.height !== 630)
  throw new Error("The share-image source must be exactly 1200×630.");
const fontfile = join(
  root,
  "node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2",
);
const fontBytes = readFileSync(fontfile);
const face = create(fontBytes);
if (!face.familyName.includes("Bricolage Grotesque"))
  throw new Error(`Unexpected identity font: ${face.familyName}`);
const font = face.getVariation({ wght: 700 });
const scale = 56 / font.unitsPerEm;
const lines = ["Matt Riley makes", "small useful things.", "Please touch."];
const paths = [];
for (const [row, line] of lines.entries()) {
  const run = font.layout(line);
  let advance = 0;
  for (const [index, glyph] of run.glyphs.entries()) {
    const position = run.positions[index];
    const x = 64 + (advance + position.xOffset) * scale;
    const y =
      164 + font.capHeight * scale + row * 64 - position.yOffset * scale;
    paths.push(
      `<path transform="translate(${x} ${y}) scale(${scale} ${-scale})" d="${glyph.path.toSVG()}"/>`,
    );
    advance += position.xAdvance;
  }
  if (advance * scale > 600)
    throw new Error("Share-image text overlaps the cat.");
}
// Outlines come directly from the bundled font. No OS font discovery/fallback
// or SVG embedded-font support is involved in Sharp's rasterisation.
const text = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><g fill="#17171a">${paths.join("")}</g></svg>`,
);
writeFileSync(
  join(output, "typography.json"),
  `${JSON.stringify({ family: face.familyName, weight: 700, pixelSize: 56, lines, font_sha256: createHash("sha256").update(fontBytes).digest("hex") }, null, 2)}\n`,
);
const image = await sharp(source)
  .composite([{ input: text, left: 0, top: 0 }])
  .removeAlpha()
  .png({
    palette: true,
    quality: 95,
    colours: 256,
    dither: 0.1,
    compressionLevel: 9,
    adaptiveFiltering: true,
    effort: 10,
  })
  .toBuffer();
if (image.length >= 200_000)
  throw new Error(`Share image exceeds 200KB: ${image.length} bytes.`);
writeFileSync(join(root, "public/og.png"), image);
console.log(`Identity assets built; og.png ${image.length} / 200000 bytes.`);
