import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { Box3, PerspectiveCamera, Vector3 } from "three";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// Derive the click from the shipped assets, rather than a test-only runtime hook.
async function toolboxPoint(page: Page) {
  if ((page.viewportSize()?.width ?? 0) < 900) {
    // The mobile rail reframes around the placard. Discover its visible hand
    // cursor in the clear display area, then tap that same real screen point.
    const area = await page.evaluate(() => {
      const header = document.querySelector(".site-header");
      const label = document.querySelector("#tools .exhibit__label");
      if (!header || !label)
        throw new Error("Missing gallery framing elements");
      return {
        top: header.getBoundingClientRect().bottom + 16,
        bottom: label.getBoundingClientRect().top - 16,
        width: innerWidth,
      };
    });
    for (let y = area.top; y < area.bottom; y += 20) {
      for (let x = 24; x < area.width - 24; x += 20) {
        await page.mouse.move(x, y);
        if (await page.evaluate(() => document.body.style.cursor === "pointer"))
          return { x, y };
      }
    }
    throw new Error(
      "The mobile toolbox has no pickable area above its placard",
    );
  }
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

test("a vertical touchscreen gesture over the exhibit keeps native scrolling", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "mobile-chromium",
    "Real Chromium touchscreen gesture",
  );
  const point = await toolboxPoint(page);
  const start = await page.evaluate(() => scrollY);
  const session = await page.context().newCDPSession(page);
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: point.x, y: point.y }],
  });
  for (let step = 1; step <= 8; step++) {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: point.x, y: point.y - step * 16 }],
    });
  }
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect
    .poll(() => page.evaluate(() => scrollY))
    .toBeGreaterThan(start + 50);
  await expect(page.locator("#tools details")).not.toHaveAttribute("open");
});

test("gallery placard text remains selectable and links receive clicks", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop-chromium",
    "Desktop text selection and link activation",
  );
  const text = page.locator("#tools .placard__note");
  await expect(text).toBeVisible();
  expect(
    await text.evaluate((node) => getComputedStyle(node).userSelect),
  ).not.toBe("none");
  const selected = await text.evaluate((node) => {
    const range = document.createRange();
    range.selectNodeContents(node);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    return selection?.toString();
  });
  expect(selected).toContain("A place for the tools");
  const link = page.locator("#tools .placard a").first();
  const href = await link.getAttribute("href");
  if (!href) throw new Error("Missing placard destination");
  await page.route(href, (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<title>Destination</title>",
    }),
  );
  await link.click();
  await expect(page).toHaveURL(href);
});
