import type { Page } from "@playwright/test";

/** Integration tests exercise real rendering even on a software-only CI worker. */
export async function allowSoftwareWebGL(page: Page) {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      value(
        this: HTMLCanvasElement,
        kind: string,
        options?: WebGLContextAttributes,
      ) {
        const attributes =
          kind === "webgl2" && options?.failIfMajorPerformanceCaveat
            ? { ...options, failIfMajorPerformanceCaveat: false }
            : options;
        return Reflect.apply(original, this, [kind, attributes]);
      },
    });
  });
}
