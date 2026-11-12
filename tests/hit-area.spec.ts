import { expect, test } from "@playwright/test";
import { Box3, PerspectiveCamera, Vector3 } from "three";
import { screenHitArea } from "../src/gallery/hit-area";

test("opted-in tiny parts receive a 44 CSS pixel target without escaping the canvas", () => {
  test.skip(
    test.info().project.name !== "desktop-chromium",
    "Projection mathematics is browser independent.",
  );
  const camera = new PerspectiveCamera(35, 1280 / 800, 0.1, 100);
  camera.position.set(0, 0, 3);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const area = screenHitArea(
    new Box3(new Vector3(-0.002, -0.002, 0), new Vector3(0.002, 0.002, 0.002)),
    camera,
    1280,
    800,
    44,
  );
  expect(area).toBeDefined();
  expect((area?.right ?? 0) - (area?.left ?? 0)).toBeCloseTo(44);
  expect((area?.bottom ?? 0) - (area?.top ?? 0)).toBeCloseTo(44);
  const clipped = screenHitArea(
    new Box3(new Vector3(-1.5, 0, 0), new Vector3(-1.49, 0.01, 0.01)),
    camera,
    1280,
    800,
    100,
  );
  expect(clipped?.left).toBeGreaterThanOrEqual(0);
  expect(clipped?.right).toBeLessThanOrEqual(1280);
  expect(
    screenHitArea(
      new Box3(new Vector3(0, 0, 4), new Vector3(0.1, 0.1, 4.1)),
      camera,
      1280,
      800,
      44,
    ),
  ).toBeUndefined();
});
