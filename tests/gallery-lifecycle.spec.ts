import { expect, type Page, test } from "@playwright/test";
import { allowSoftwareWebGL } from "./gallery-capability";

async function liveContexts(page: Page) {
  return page.evaluate(() => {
    const contexts = (
      window as typeof window & { __galleryContexts: WebGL2RenderingContext[] }
    ).__galleryContexts;
    return contexts.filter((context) => !context.isContextLost()).length;
  });
}

async function instrumentContexts(page: Page) {
  await page.addInitScript(`
    localStorage.setItem('mr-view', 'gallery');
    localStorage.setItem('mr-lights', 'day');
    window.__galleryContexts = [];
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      const context = original.call(this, type, ...args);
      if (type === 'webgl2' && context && !window.__galleryContexts.includes(context)) window.__galleryContexts.push(context);
      return context;
    };
  `);
}

test.beforeEach(async ({ page }, info) => {
  test.skip(
    info.project.name !== "desktop-chromium",
    "Lifecycle accounting uses Chromium's real WebGL2 contexts.",
  );
  await allowSoftwareWebGL(page);
  await instrumentContexts(page);
});

test("ten gallery/catalogue cycles release every WebGL context", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-gallery", "ready");
  await expect(
    page.locator("[data-gallery-layer][data-rendered='true']"),
  ).toHaveCount(1);
  for (let cycle = 0; cycle < 10; cycle++) {
    await expect.poll(() => liveContexts(page)).toBe(1);
    await page
      .getByRole("button", { name: "View: Gallery", exact: true })
      .click();
    await expect(page.locator("[data-gallery-layer]")).toHaveCount(0);
    await expect.poll(() => liveContexts(page)).toBe(0);
    await expect(page.locator("section[data-exhibit]")).toHaveCount(9);
    await page
      .getByRole("button", { name: "View: Catalogue", exact: true })
      .click();
    await expect(page.locator("html")).toHaveAttribute("data-gallery", "ready");
    await expect(
      page.locator("[data-gallery-layer][data-rendered='true']"),
    ).toHaveCount(1);
  }
  await page
    .getByRole("button", { name: "View: Gallery", exact: true })
    .click();
  await expect.poll(() => liveContexts(page)).toBe(0);
  expect(errors).toEqual([]);
});

test("switching off during an unfinished room fetch disposes immediately", async ({
  page,
}) => {
  let release = () => {};
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/models/room.glb", async (route) => {
    await blocked;
    await route.continue().catch(() => {});
  });
  const loading = page.waitForRequest("**/models/room.glb");
  await page.goto("/");
  await loading;
  await expect.poll(() => liveContexts(page)).toBe(1);
  await page
    .getByRole("button", { name: "View: Gallery", exact: true })
    .click();
  await expect(page.locator("[data-gallery-layer]")).toHaveCount(0);
  await expect.poll(() => liveContexts(page)).toBe(0);
  release();
  await expect(page.locator("html")).toHaveAttribute("data-view", "catalogue");
  await expect(page.locator("section[data-exhibit]")).toHaveCount(9);
});

test("real context loss quietly returns to the complete catalogue", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-gallery", "ready");
  await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>(
      "[data-gallery-layer] canvas",
    );
    canvas
      ?.getContext("webgl2")
      ?.getExtension("WEBGL_lose_context")
      ?.loseContext();
  });
  await expect(page.locator("html")).toHaveAttribute("data-view", "catalogue");
  await expect(page.locator("[data-gallery-layer]")).toHaveCount(0);
  await expect.poll(() => liveContexts(page)).toBe(0);
  await expect(page.locator("section[data-exhibit]")).toHaveCount(9);
  expect(errors).toEqual([]);
});
