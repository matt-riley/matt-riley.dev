import { expect, test } from "@playwright/test";
import { allowSoftwareWebGL } from "./gallery-capability";

test("modest hardware starts at Medium and hidden/modal views draw no frames", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop-chromium",
    "Real WebGL frame instrumentation uses Chromium.",
  );
  await allowSoftwareWebGL(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "hardwareConcurrency", { value: 4 });
    const state = window as typeof window & { galleryDraws: number };
    state.galleryDraws = 0;
    for (const name of ["drawArrays", "drawElements"] as const) {
      const draw = WebGL2RenderingContext.prototype[name];
      Object.defineProperty(WebGL2RenderingContext.prototype, name, {
        value: function (this: WebGL2RenderingContext, ...args: unknown[]) {
          state.galleryDraws++;
          return Reflect.apply(draw, this, args);
        },
      });
    }
  });
  await page.goto("/?debug");
  await expect(page.locator("html")).toHaveAttribute("data-gallery", "ready", {
    timeout: 15_000,
  });
  await expect(page.locator("html")).toHaveAttribute(
    "data-gallery-quality",
    "medium",
  );
  const hidden = await page.evaluate(async () => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
    const state = window as typeof window & { galleryDraws: number };
    const before = state.galleryDraws;
    window.dispatchEvent(new Event("resize"));
    window.dispatchEvent(new Event("scroll"));
    await new Promise((resolve) => setTimeout(resolve, 150));
    const after = state.galleryDraws;
    Reflect.deleteProperty(document, "hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    return { before, after };
  });
  expect(hidden.after).toBe(hidden.before);
  await page.evaluate(() => {
    const dialog = document.createElement("dialog");
    dialog.id = "quality-test-modal";
    document.body.append(dialog);
    dialog.showModal();
  });
  await page.waitForTimeout(40);
  const paused = await page.evaluate(async () => {
    const state = window as typeof window & { galleryDraws: number };
    const before = state.galleryDraws;
    window.dispatchEvent(new Event("resize"));
    await new Promise((resolve) => setTimeout(resolve, 150));
    return { before, after: state.galleryDraws };
  });
  expect(paused.after).toBe(paused.before);
  await page.evaluate(() => {
    const dialog = document.querySelector<HTMLDialogElement>(
      "#quality-test-modal",
    );
    dialog?.close();
    dialog?.remove();
  });
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as typeof window & { galleryDraws: number }).galleryDraws,
      ),
    )
    .toBeGreaterThan(paused.after);
});
