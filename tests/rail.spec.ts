import { expect, test } from "@playwright/test";
import { Group, Object3D } from "three";
import { CameraRail } from "../src/gallery/rail";

function room() {
  const root = new Group();
  root.position.set(2, 0.1, -3);
  for (let index = 0; index < 9; index++) {
    const camera = new Object3D();
    camera.name = `stop_${index}_cam`;
    camera.position.set(index * 4, 1.65, -index * 3);
    camera.userData.placard_side = index % 2 === 0 ? "left" : "right";
    const target = new Object3D();
    target.name = `stop_${index}_target`;
    target.position.set(index * 4, 1, -index * 3 - 1);
    root.add(camera, target);
  }
  return root;
}

test("camera rail hits each authored camera and target in world space", () => {
  test.skip(
    test.info().project.name !== "desktop-chromium",
    "The rail mathematics is browser-independent.",
  );
  const rail = new CameraRail(room());
  const expectedCameras = [
    [2, 1.75, -3],
    [6, 1.75, -6],
    [10, 1.75, -9],
    [14, 1.75, -12],
    [18, 1.75, -15],
    [22, 1.75, -18],
    [26, 1.75, -21],
    [30, 1.75, -24],
    [34, 1.75, -27],
  ];
  const expectedTargets = [
    [2, 1.1, -4],
    [6, 1.1, -7],
    [10, 1.1, -10],
    [14, 1.1, -13],
    [18, 1.1, -16],
    [22, 1.1, -19],
    [26, 1.1, -22],
    [30, 1.1, -25],
    [34, 1.1, -28],
  ];
  for (let index = 0; index < 9; index++) {
    const sample = rail.sample(index);
    expect(sample.camera.toArray()).toEqual(expectedCameras[index]);
    expect(sample.target.toArray()).toEqual(expectedTargets[index]);
    expect(sample.stop).toBe(index);
  }
});

test("the rail lingers around each stop and moves continuously between them", () => {
  test.skip(
    test.info().project.name !== "desktop-chromium",
    "The rail mathematics is browser-independent.",
  );
  const rail = new CameraRail(room());
  const stop = rail.sample(3);
  expect(rail.sample(2.81).camera.toArray()).toEqual(stop.camera.toArray());
  expect(rail.sample(3.19).camera.toArray()).toEqual(stop.camera.toArray());
  const early = rail.sample(3.3);
  expect(early.camera.x).toBeGreaterThan(14);
  expect(early.camera.x).toBeLessThan(15.2);
  expect(rail.sample(3.5).camera.x).toBeCloseTo(16, 8);
  expect(rail.sample(3.5).framing).toBeCloseTo(0, 8);
  expect(rail.sample(-10).camera.toArray()).toEqual([2, 1.75, -3]);
  expect(rail.sample(100).camera.toArray()).toEqual([34, 1.75, -27]);
});

test("the rail rejects a missing authored stop instead of inventing a camera", () => {
  test.skip(
    test.info().project.name !== "desktop-chromium",
    "The rail mathematics is browser-independent.",
  );
  const root = room();
  root.getObjectByName("stop_5_target")?.removeFromParent();
  expect(() => new CameraRail(root)).toThrow("missing stop_5_target");
});
