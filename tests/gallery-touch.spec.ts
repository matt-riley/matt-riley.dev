import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { Box3, PerspectiveCamera, Vector3 } from "three";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// Derive the click from the shipped assets, rather than a test-only runtime hook.
async function toolboxPoint(page: Page) {
  const bytes = readFileSync("public/models/tools.glb");
  const model = await new GLTFLoader()
    .setMeshoptDecoder(MeshoptDecoder)
    .parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      "",
    );
  const room = readFileSync("public/models/room.glb");
  const json = JSON.parse(
    room.subarray(20, 20 + room.readUInt32LE(12)).toString(),
  );
  const position = (name: string) =>
    new Vector3().fromArray(
      json.nodes.find((node: { name: string }) => node.name === name)
        .translation,
    );
  const size = page.viewportSize();
  if (!size) throw new Error("Viewport required");
  const camera = new PerspectiveCamera(35, size.width / size.height, 0.03, 80);
  camera.position.copy(position("stop_1_cam"));
  camera.lookAt(position("stop_1_target"));
  camera.updateMatrixWorld();
  const point = new Box3().setFromObject(model.scene).getCenter(new Vector3());
  point.add(position("anchor_tools")).project(camera);
  return {
    x: ((point.x + 1) * size.width) / 2,
    y: ((1 - point.y) * size.height) / 2,
  };
}

test.beforeEach(async ({ page }, info) => {
  test.skip(
    !["desktop-chromium", "mobile-chromium"].includes(info.project.name),
    "Real WebGL picking is checked in desktop and mobile Chromium.",
  );
  await page.addInitScript(() => {
    localStorage.setItem("mr-view", "gallery");
    localStorage.setItem("mr-lights", "day");
  });
  await page.goto("/#tools");
  await expect(page.locator("html")).toHaveAttribute("data-gallery", "ready");
  await expect(page.locator("html")).toHaveAttribute("data-exhibits", "ready");
});

test("picking the toolbox activates its native disclosure like keyboard Enter", async ({
  page,
}, info) => {
  const details = page.locator("#tools details");
  const summary = details.locator("summary");
  const point = await toolboxPoint(page);
  if (info.project.name === "mobile-chromium")
    await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
  await expect(details).toHaveAttribute("open", "");
  await expect(page.locator("#tools [data-touch-result]")).not.toBeEmpty();
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(details).not.toHaveAttribute("open");
  await page.keyboard.press("Enter");
  await expect(details).toHaveAttribute("open", "");
  await expect(details.locator("a").first()).toHaveAttribute("href", /^https:/);
});

test("horizontal object dragging does not activate its disclosure", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop-chromium", "Mouse drag path");
  const point = await toolboxPoint(page);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + 70, point.y + 2, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator("#tools details")).not.toHaveAttribute("open");
});
