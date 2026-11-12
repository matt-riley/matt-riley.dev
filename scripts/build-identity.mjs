import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = join(root, "blender/out/identity");
const args = process.argv.slice(2).filter((arg) => arg !== "--");
if (
  args.length > 1 ||
  (args.length && !["--copy-only", "--icons-only"].includes(args[0]))
)
  throw new Error("Usage: pnpm assets:identity [-- --copy-only|--icons-only]");
mkdirSync(join(output, "font-cache"), { recursive: true });
// Keep font registration reproducible and its cache inside ignored build output.
const xml = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
const config = join(output, "fonts.conf");
writeFileSync(
  config,
  `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><cachedir>${xml(join(output, "font-cache"))}</cachedir></fontconfig>`,
);
process.env.FONTCONFIG_FILE = config;
const { default: sharp } = await import("sharp");
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
const text = await sharp({
  text: {
    text: '<span foreground="#17171a">Matt Riley makes\nsmall useful things.\nPlease touch.</span>',
    font: "Bricolage Grotesque Bold 56",
    fontfile,
    rgba: true,
    spacing: 7,
  },
})
  .png()
  .toBuffer();
const image = await sharp(source)
  .composite([{ input: text, left: 64, top: 164 }])
  .png({ palette: true, colours: 256, effort: 10 })
  .toBuffer();
if (image.length >= 200_000)
  throw new Error(`Share image exceeds 200KB: ${image.length} bytes.`);
writeFileSync(join(root, "public/og.png"), image);
console.log(`Identity assets built; og.png ${image.length} / 200000 bytes.`);
