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
    .flatten({ background: "#efdfcc" })
    .png()
    .toFile(join(root, `public/${name}.png`));
if (args[0] === "--icons-only") process.exit(0);

// Reuse the approved A photograph; only native branding is composited over it.
// No Blender, model call, external font discovery or network is required.
const source = join(root, "src/assets/immersive/toolbox-closed.png");
const fontfile = join(
  root,
  "node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2",
);
const fontBytes = readFileSync(fontfile);
const face = create(fontBytes);
if (!face.familyName.includes("Bricolage Grotesque"))
  throw new Error(`Unexpected identity font: ${face.familyName}`);
const font = face.getVariation({ wght: 800 });
const lines = [
  { text: "Please", x: 180, baseline: 133, size: 104 },
  { text: "touch.", x: 180, baseline: 223, size: 104 },
  { text: "Matt Riley makes", x: 803, baseline: 194, size: 29 },
  { text: "small useful things.", x: 803, baseline: 227, size: 29 },
];
const paths = [];
for (const { text, x, baseline, size } of lines) {
  const scale = size / font.unitsPerEm;
  const run = font.layout(text);
  let advance = 0;
  for (const [index, glyph] of run.glyphs.entries()) {
    const position = run.positions[index];
    const left = x + (advance + position.xOffset) * scale;
    const top = baseline - position.yOffset * scale;
    const fill =
      text === "touch." && index === run.glyphs.length - 1
        ? "#dd4c00"
        : "#191611";
    paths.push(
      `<path fill="${fill}" transform="translate(${left} ${top}) scale(${scale} ${-scale})" d="${glyph.path.toSVG()}"/>`,
    );
    advance += position.xAdvance;
  }
  if (x + advance * scale > 1160)
    throw new Error("Share-image text exceeds its right margin.");
}
const text = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><g fill="#191611">${paths.join("")}</g></svg>`,
);
const image = await sharp(source)
  .resize(1200, 630, { fit: "cover", position: "centre" })
  .composite([{ input: text, left: 0, top: 0 }])
  .removeAlpha()
  .jpeg({ quality: 82, mozjpeg: true })
  .toBuffer();
if (image.length >= 200_000)
  throw new Error(`Share image exceeds 200KB: ${image.length} bytes.`);
writeFileSync(join(root, "public/og.jpg"), image);
writeFileSync(
  join(output, "typography.json"),
  `${JSON.stringify({ family: face.familyName, weight: 800, lines, source: "src/assets/immersive/toolbox-closed.png", source_sha256: createHash("sha256").update(readFileSync(source)).digest("hex"), font_sha256: createHash("sha256").update(fontBytes).digest("hex"), output_bytes: image.length }, null, 2)}\n`,
);
console.log(`A identity assets built; og.jpg ${image.length} / 200000 bytes.`);
