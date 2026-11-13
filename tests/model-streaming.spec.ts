import { expect, test } from "@playwright/test";
import { modelFile } from "../src/gallery/model-files";
import { allowSoftwareWebGL } from "./gallery-capability";

test("models and the portrait wait until the visitor is within two stops", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop-chromium",
    "Actual lazy request ordering uses a real WebGL context.",
  );
  test.setTimeout(90_000);
  await allowSoftwareWebGL(page);
  await page.addInitScript(() => {
    localStorage.setItem("mr-view", "gallery");
    localStorage.setItem("mr-cat", "on");
  });
  const requests: { path: string; at: number }[] = [];
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith("/models/") || path.includes("waffle-portrait"))
      requests.push({ path, at: Date.now() });
  });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-gallery", "ready", {
    timeout: 15_000,
  });
  const names = () =>
    requests
      .filter(({ path }) => path.startsWith("/models/"))
      .map(({ path }) => path.split("/").at(-1));
  expect(names()).toEqual(
    expect.arrayContaining([
      modelFile("room"),
      modelFile("tools"),
      modelFile("flagz"),
      modelFile("cat"),
    ]),
  );
  expect(names()).not.toEqual(expect.arrayContaining([modelFile("waystone")]));
  expect(names()).not.toEqual(expect.arrayContaining([modelFile("open-mic")]));
  expect(names()).not.toEqual(expect.arrayContaining([modelFile("gift-shop")]));
  expect(requests.some(({ path }) => path.includes("waffle-portrait"))).toBe(
    false,
  );
  await page.evaluate(() =>
    document
      .getElementById("waffle-agent")
      ?.scrollIntoView({ behavior: "instant", block: "center" }),
  );
  await expect.poll(names).toContain(modelFile("waystone"));
  expect(names()).not.toEqual(expect.arrayContaining([modelFile("open-mic")]));
  expect(names()).not.toEqual(expect.arrayContaining([modelFile("gift-shop")]));
  await page.evaluate(() =>
    document
      .getElementById("waystone")
      ?.scrollIntoView({ behavior: "instant", block: "center" }),
  );
  await expect.poll(names).toContain(modelFile("open-mic"));
  await expect
    .poll(() => requests.some(({ path }) => path.includes("waffle-portrait")))
    .toBe(true);
  expect(names()).not.toEqual(expect.arrayContaining([modelFile("gift-shop")]));
  await page.evaluate(() =>
    document
      .getElementById("human-error")
      ?.scrollIntoView({ behavior: "instant", block: "center" }),
  );
  await expect.poll(names).toContain(modelFile("gift-shop"));
  await info.attach("model-request-order", {
    body: JSON.stringify(requests, null, 2),
    contentType: "application/json",
  });
});
