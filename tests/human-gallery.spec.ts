import { expect, test } from "@playwright/test";
import { allowSoftwareWebGL } from "./gallery-capability";

test("the real gallery uploads a two-second microphone light and exposes its native result", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop-chromium",
    "The real WebGL shader path is checked once",
  );
  test.setTimeout(60_000);
  await allowSoftwareWebGL(page);
  await page.addInitScript(() => {
    localStorage.setItem("mr-view", "gallery");
    localStorage.setItem("mr-lights", "day");
    const names = new WeakMap<WebGLUniformLocation, string>();
    const frame = window as typeof window & {
      __humanSpotFrames: Array<{ name: string; red: number }>;
    };
    frame.__humanSpotFrames = [];
    const prototype = WebGL2RenderingContext.prototype;
    const getLocation = prototype.getUniformLocation;
    prototype.getUniformLocation = function (program, name) {
      const location = getLocation.call(this, program, name);
      if (location) names.set(location, name);
      return location;
    };
    const uniform = prototype.uniform3f;
    prototype.uniform3f = function (location, red, green, blue) {
      const name = location && names.get(location);
      if (name && /^spotLights\[\d+\]\.color$/.test(name))
        frame.__humanSpotFrames.push({ name, red });
      uniform.call(this, location, red, green, blue);
    };
  });
  const images: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "image") images.push(request.url());
  });
  await page.goto("/#human-error");
  await expect(page.locator("html")).toHaveAttribute("data-gallery", "ready", {
    timeout: 30_000,
  });
  await expect(page.locator("html")).toHaveAttribute("data-exhibits", "ready");
  const url = await page
    .locator("[data-portrait-src]")
    .getAttribute("data-portrait-src");
  if (!url) throw new Error("Missing original portrait derivative");
  expect(images.some((image) => new URL(image).pathname === url)).toBe(true);
  const count = await page.evaluate(
    () =>
      (window as typeof window & { __humanSpotFrames: unknown[] })
        .__humanSpotFrames.length,
  );
  const details = page.locator("#human-error > .exhibit__label > details");
  await expect(details).not.toHaveAttribute("open");
  // G-03 picking calls this same real HTML control even while its drawer is shut.
  await page
    .locator("#open-mic [data-touch]")
    .evaluate((button: HTMLButtonElement) => button.click());
  await expect(details).toHaveAttribute("open", "");
  await expect(page.locator("#open-mic [data-touch-result]")).toHaveText(
    "The microphone nods.",
  );
  const peak = () =>
    page.evaluate(
      (start) =>
        (
          window as typeof window & {
            __humanSpotFrames: Array<{ name: string; red: number }>;
          }
        ).__humanSpotFrames
          .slice(start)
          .find((frame) => frame.red > 0.01)?.name ?? "",
      count,
    );
  await expect.poll(peak).not.toBe("");
  const name = await peak();
  await expect
    .poll(
      () =>
        page.evaluate(
          (name) =>
            (
              window as typeof window & {
                __humanSpotFrames: Array<{ name: string; red: number }>;
              }
            ).__humanSpotFrames
              .filter((frame) => frame.name === name)
              .at(-1)?.red ?? 100,
          name,
        ),
      { timeout: 5000 },
    )
    .toBeLessThan(0.01);
  await expect(page.locator("#open-mic [data-touch-result]")).toHaveText(
    "The microphone nods.",
  );
  await page
    .getByRole("button", { name: "Touch the empty plinth", exact: true })
    .click();
  await expect(page.locator("#absent [data-touch-result]")).toHaveText(
    "Nothing happens. That is the piece.",
  );
});

test("the portrait stays unfetched at the entrance and starts only within two stops", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop-chromium",
    "Actual gallery streaming is checked once",
  );
  test.setTimeout(60_000);
  await allowSoftwareWebGL(page);
  await page.addInitScript(() => {
    localStorage.setItem("mr-view", "gallery");
    localStorage.setItem("mr-lights", "day");
  });
  const images: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "image")
      images.push(new URL(request.url()).pathname);
  });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-gallery", "ready", {
    timeout: 30_000,
  });
  const portrait = await page
    .locator("[data-portrait-src]")
    .getAttribute("data-portrait-src");
  if (!portrait) throw new Error("Missing portrait URL");
  expect(images).not.toContain(portrait);
  await page.evaluate(() => {
    location.hash = "agent-skills";
  });
  await expect(page.locator("[data-current-stop]")).toContainText("4 of 8");
  expect(images).not.toContain(portrait);
  await page.evaluate(() => {
    location.hash = "waystone";
  });
  await expect
    .poll(() => images.includes(portrait), { timeout: 15_000 })
    .toBe(true);
});
