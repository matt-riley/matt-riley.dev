import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { Box3 } from "three";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { createFloorMarker } from "../src/gallery/marker";

test("the independent floor pebble matches the authored Waystone geometry", async ({
  browserName,
}, info) => {
  test.skip(
    browserName !== "chromium" || info.project.name !== "desktop-chromium",
    "Shared authored dimensions.",
  );
  const bytes = readFileSync("public/models/waystone.glb");
  const asset = await new GLTFLoader()
    .setMeshoptDecoder(MeshoptDecoder)
    .parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      "",
    );
  const source = asset.scene.getObjectByName("touch_marker");
  if (!source) throw new Error("Missing authored marker");
  const floor = createFloorMarker();
  const actual = new Box3().setFromObject(floor);
  const expected = new Box3().setFromObject(source);
  for (const axis of ["x", "y", "z"] as const)
    expect(actual.max[axis] - actual.min[axis]).toBeCloseTo(
      expected.max[axis] - expected.min[axis],
      4,
    );
  expect(actual.min.y).toBeCloseTo(0, 6);
});

test("a local marker survives into a new session, returns to its stop and clears", async ({
  page,
  browser,
  javaScriptEnabled,
}, info) => {
  test.skip(!javaScriptEnabled, "Saving a local marker requires JavaScript.");
  await page.addInitScript(() => localStorage.setItem("mr-view", "catalogue"));
  const requests: string[] = [];
  page.on("request", (request) => {
    if (["fetch", "xhr"].includes(request.resourceType()))
      requests.push(request.url());
  });
  await page.goto("/archive-gallery/#waystone");
  await page.locator("[data-marker-stop]").selectOption("flagz");
  await page.locator("#waystone button[data-touch]").click();
  await expect(page.locator("#waystone [data-touch-result]")).toHaveText(
    "Marker left at flagz.",
  );
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("mr-marker") ?? "null"),
  );
  expect(saved.stop).toBe("flagz");
  expect(Number.isFinite(Date.parse(saved.at))).toBe(true);
  expect(requests).toEqual([]);
  await page.reload();
  await expect(page.locator("[data-marker-notice]")).toBeHidden();
  const context = await browser.newContext({
    storageState: await page.context().storageState(),
    reducedMotion:
      info.project.name === "reduced-motion" ? "reduce" : "no-preference",
  });
  const returning = await context.newPage();
  await returning.goto(new URL("/archive-gallery/", page.url()).href);
  await expect(returning.locator("[data-marker-notice]")).toBeVisible();
  await expect(returning.locator("[data-marker-notice-copy]")).toContainText(
    "You left a marker at flagz",
  );
  expect(await returning.evaluate(() => document.activeElement?.tagName)).toBe(
    "BODY",
  );
  await returning
    .getByRole("button", { name: "Take me there", exact: true })
    .click();
  await expect(returning).toHaveURL(/#flagz$/);
  await expect(returning.locator("[data-marker-notice]")).toBeHidden();
  await expect
    .poll(async () =>
      returning
        .locator("#flagz")
        .evaluate((node) => Math.round(node.getBoundingClientRect().top)),
    )
    .toBeGreaterThanOrEqual(0);
  await returning.locator("#waystone [data-marker-clear]").click();
  expect(
    await returning.evaluate(() => localStorage.getItem("mr-marker")),
  ).toBeNull();
  await expect(returning.locator("[data-marker-current]")).toHaveText(
    "No marker left.",
  );
  await context.close();
});

test("blocked storage and malformed saved markers leave the controls usable", async ({
  page,
  javaScriptEnabled,
}) => {
  test.skip(!javaScriptEnabled, "Marker controls require JavaScript.");
  await page.addInitScript(() => {
    localStorage.setItem("mr-view", "catalogue");
    localStorage.setItem("mr-marker", '{"stop":"unknown","at":"bad"}');
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "mr-marker")
        throw new DOMException("Unavailable", "SecurityError");
      return original.call(this, key, value);
    };
  });
  await page.goto("/archive-gallery/#waystone");
  await expect(page.locator("[data-marker-notice]")).toBeHidden();
  await page.locator("[data-marker-stop]").selectOption("tools");
  await page.locator("#waystone button[data-touch]").click();
  await expect(page.locator("[data-marker-current]")).toContainText(
    "marker: tools,",
  );
  await expect(page.locator("#waystone [data-touch-result]")).toHaveText(
    "Marker left at mattriley.tools.",
  );
});
