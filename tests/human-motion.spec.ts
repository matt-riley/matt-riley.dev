import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { SpotLight } from "three";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { nodMicrophone } from "../src/gallery/human-error";
import { bindPart, releasePart } from "../src/gallery/parts";

test("the real microphone stays within its hinge range and its spotlight lasts two seconds", async () => {
  test.skip(
    test.info().project.name !== "desktop-chromium",
    "The authored model and shared motion are checked once",
  );
  const bytes = readFileSync("public/models/open-mic.glb");
  const model = await new GLTFLoader()
    .setMeshoptDecoder(MeshoptDecoder)
    .parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      "",
    );
  const object = model.scene.getObjectByName("touch_mic");
  if (!object) throw new Error("Missing actual microphone hinge");
  let renders = 0;
  const part = bindPart(object, () => {
    renders++;
  });
  const light = new SpotLight();
  light.intensity = 0;
  for (let repeat = 0; repeat < 12; repeat++) {
    const nod = nodMicrophone(part, light, () => {
      renders++;
    });
    nod.pause(0);
    expect(nod.duration()).toBeCloseTo(2);
    let peakAngle = 0;
    let peakLight = 0;
    for (let step = 1; step <= 40; step++) {
      nod.time(step / 20, false);
      const angle = part.rotation[part.userData.axis];
      expect(angle).toBeGreaterThanOrEqual(Math.min(...part.userData.range));
      expect(angle).toBeLessThanOrEqual(Math.max(...part.userData.range));
      peakAngle = Math.max(peakAngle, Math.abs(angle));
      peakLight = Math.max(peakLight, light.intensity);
      if (step === 39) expect(light.intensity).toBeGreaterThan(0);
    }
    expect(peakAngle).toBeGreaterThan(0);
    expect(peakLight).toBeGreaterThan(0);
    expect(light.intensity).toBeCloseTo(0);
    expect(part.rotation[part.userData.axis]).toBeCloseTo(0, 5);
    nod.kill();
  }
  expect(renders).toBeGreaterThan(0);
  releasePart(part);
});
