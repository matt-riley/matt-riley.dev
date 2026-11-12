import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const raw = join(root, "blender/out");
const destination = join(root, "public/models");
const cli = join(root, "node_modules/.bin/gltf-transform");
const budget = 1_500_000;

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit" });
  if (result.error) {
    throw new Error(
      `Cannot run ${command}: ${result.error.message}. For Blender, set BLENDER_BIN to the installed executable.`,
    );
  }
  if (result.status !== 0) {
    throw new Error(`${command} failed (${result.signal ?? result.status}).`);
  }
}

function modelStats(path) {
  const bytes = readFileSync(path);
  if (bytes.toString("ascii", 0, 4) !== "glTF" || bytes.readUInt32LE(4) !== 2) {
    throw new Error(`Not a glTF 2.0 binary: ${path}`);
  }
  const jsonLength = bytes.readUInt32LE(12);
  const model = JSON.parse(bytes.toString("utf8", 20, 20 + jsonLength));
  const triangles = (model.nodes ?? []).reduce((sum, node) => {
    if (node.mesh === undefined) return sum;
    return (
      sum +
      model.meshes[node.mesh].primitives.reduce((count, primitive) => {
        const accessor = primitive.indices ?? primitive.attributes.POSITION;
        const vertices = model.accessors[accessor].count;
        const mode = primitive.mode ?? 4;
        return (
          count +
          (mode === 4
            ? vertices / 3
            : mode === 5 || mode === 6
              ? Math.max(0, vertices - 2)
              : 0)
        );
      }, 0)
    );
  }, 0);
  return { bytes: bytes.length, triangles };
}

function main() {
  const args = process.argv.slice(2).filter((arg) => arg !== "--");
  if (
    args.length !== 0 &&
    (args.length !== 2 || args[0] !== "--only" || !/^[\w-]+$/.test(args[1]))
  ) {
    throw new Error("Usage: pnpm assets [-- --only SCENE]");
  }
  let names = readdirSync(join(root, "blender/scenes"))
    .filter((name) => name.endsWith(".py") && name !== "__init__.py")
    .map((name) => name.slice(0, -3))
    .filter((name) => !args.length || name === args[1])
    .sort();
  if (!names.length)
    throw new Error(`No scene scripts found for ${args[1] ?? "all scenes"}.`);
  mkdirSync(raw, { recursive: true });
  mkdirSync(destination, { recursive: true });
  run(
    process.env.BLENDER_BIN ||
      "/Applications/Blender.app/Contents/MacOS/Blender",
    [
      "--background",
      "--python-exit-code",
      "1",
      "--python",
      join(root, "blender/build.py"),
      "--",
      ...args,
    ],
  );

  names = JSON.parse(readFileSync(join(raw, "manifest.json"), "utf8")).scenes;

  const temporary = mkdtempSync(join(raw, ".optimise-"));
  try {
    for (const name of names) {
      let input = join(raw, `${name}.glb`);
      const steps = [
        ["dedup"],
        // Keep camera stops, anchors and touch pivots even when they have no mesh.
        [
          "prune",
          "--keep-leaves",
          "true",
          ...(name === "room" ? ["--keep-attributes", "true"] : []),
        ],
        ["weld"],
        // B-03's single room lightmap is explicitly 2048px; object textures stay 1024px.
        [
          "resize",
          "--width",
          name === "room" ? "2048" : "1024",
          "--height",
          name === "room" ? "2048" : "1024",
        ],
        ["webp"],
        ["meshopt"],
      ];
      for (const [index, [command, ...flags]] of steps.entries()) {
        const output = join(temporary, `${name}-${index}.glb`);
        run(cli, [command, input, output, ...flags]);
        input = output;
      }
      renameSync(input, join(temporary, `${name}.glb`));
    }
    // Check the proposed complete model set before replacing any committed file.
    const unchanged = readdirSync(destination)
      .filter(
        (file) => file.endsWith(".glb") && !names.includes(file.slice(0, -4)),
      )
      .map((file) => ({ file, ...modelStats(join(destination, file)) }));
    const updated = names.map((name) => ({
      file: `${name}.glb`,
      ...modelStats(join(temporary, `${name}.glb`)),
    }));
    const rows = [...unchanged, ...updated].sort((a, b) =>
      a.file.localeCompare(b.file),
    );
    console.table(rows);
    const total = rows.reduce((sum, model) => sum + model.bytes, 0);
    console.log(
      `Models: ${total.toLocaleString("en-GB")} / ${budget.toLocaleString("en-GB")} bytes`,
    );
    if (total >= budget)
      throw new Error(
        "Model budget exceeded (must be under 1.5 MB). No optimised outputs were replaced.",
      );
    for (const name of names) {
      renameSync(
        join(temporary, `${name}.glb`),
        join(destination, `${name}.glb`),
      );
    }
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

try {
  main();
} catch (error) {
  console.error(
    `Asset build failed: ${error instanceof Error ? error.message : error}`,
  );
  process.exitCode = 1;
}
