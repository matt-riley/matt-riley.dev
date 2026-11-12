import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { animatePart, bindPart, releasePart } from "../src/gallery/parts";

test("a real toolbox drawer slides along its declared axis without cumulative drift", async ({
  browserName,
}, info) => {
  test.skip(
    browserName !== "chromium" || info.project.name !== "desktop-chromium",
    "The authored model and motion helper are shared.",
  );
  const bytes = readFileSync("public/models/tools.glb");
  const model = await new GLTFLoader()
    .setMeshoptDecoder(MeshoptDecoder)
    .parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      "",
    );
  const object = model.scene.getObjectByName("touch_drawer");
  expect(object).toBeDefined();
  if (!object) return;
  let renders = 0;
  const part = bindPart(object, () => {
    renders++;
  });
  for (let cycle = 0; cycle < 3; cycle++) {
    await new Promise<void>((resolve) =>
      animatePart(part, 1, { duration: 0, onComplete: resolve }),
    );
    expect(part.position.x).toBeCloseTo(0, 5);
    expect(part.position.y).toBeCloseTo(0.047, 5);
    expect(part.position.z).toBeCloseTo(0.17, 5);
    await new Promise<void>((resolve) =>
      animatePart(part, 0, { duration: 0, onComplete: resolve }),
    );
    expect(part.position.z).toBeCloseTo(0.095, 5);
  }
  expect(renders).toBeGreaterThan(0);
  expect(() => animatePart(part, Number.NaN)).toThrow(RangeError);
  releasePart(part);
});
