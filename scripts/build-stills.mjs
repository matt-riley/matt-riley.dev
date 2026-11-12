import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const stops = [
  "entrance",
  "tools",
  "flagz",
  "waffle-agent",
  "agent-skills",
  "waystone",
  "acquisitions",
  "human-error",
  "gift-shop",
];
const args = process.argv.slice(2).filter((arg) => arg !== "--");
if (args.length && !(args.length === 1 && args[0] === "--copy-only"))
  throw new Error("Usage: pnpm assets:stills [-- --copy-only]");
if (!args.length) {
  const result = spawnSync(
    process.env.BLENDER_BIN ||
      "/Applications/Blender.app/Contents/MacOS/Blender",
    [
      "--background",
      "--python-exit-code",
      "1",
      "--python",
      join(root, "blender/render_catalogue.py"),
    ],
    { cwd: root, stdio: "inherit" },
  );
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(
      `Catalogue render failed (${result.signal ?? result.status}). No photographs copied.`,
    );
}
const files = [];
for (const stop of stops)
  for (const mode of ["day", "night"])
    for (const crop of ["wide", "square"]) {
      const name = `${stop}-${mode}-${crop}.png`;
      const path = join(root, "blender/out/stills", name);
      const png = readFileSync(path);
      const width = crop === "wide" ? 2400 : 1600;
      if (
        png.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" ||
        png.readUInt32BE(16) !== width ||
        png.readUInt32BE(20) !== 1600
      )
        throw new Error(`Invalid dimensions or PNG signature: ${name}`);
      files.push({ path, name });
    }
// Validate the complete set before changing any committed photograph.
const destination = join(root, "src/assets/catalogue");
mkdirSync(destination, { recursive: true });
for (const { path, name } of files) copyFileSync(path, join(destination, name));
console.log(
  `Copied ${files.length} verified catalogue PNGs to src/assets/catalogue.`,
);
