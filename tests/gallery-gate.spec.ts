import { readdirSync, readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

function rendererChunks() {
  const files = readdirSync("dist/_astro").filter((name) =>
    name.endsWith(".js"),
  );
  const heavy = files.filter((name) =>
    /WebGLRenderer/.test(readFileSync(`dist/_astro/${name}`, "utf8")),
  );
  expect(
    heavy.length,
    "The built gallery really contains a WebGL renderer chunk",
  ).toBeGreaterThan(0);
  return heavy;
}

for (const gate of [
  "reduced-motion",
  "save-data",
  "catalogue",
  "no-webgl",
  "major-performance-caveat",
  "software-renderer",
] as const) {
  test(`${gate} requests neither the WebGL renderer nor gallery models`, async ({
    page,
    javaScriptEnabled,
  }) => {
    test.skip(
      !javaScriptEnabled,
      "Static HTML is covered by the no-JavaScript smoke project.",
    );
    const heavy = rendererChunks();
    if (gate === "reduced-motion")
      await page.emulateMedia({ reducedMotion: "reduce" });
    else await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.addInitScript((gate) => {
      localStorage.setItem(
        "mr-view",
        gate === "catalogue" ? "catalogue" : "gallery",
      );
      if (gate === "save-data")
        Object.defineProperty(navigator, "connection", {
          value: { saveData: true, addEventListener() {} },
          configurable: true,
        });
      if (gate === "software-renderer") {
        Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
          value(kind: string) {
            if (kind !== "webgl2") return null;
            return {
              getExtension: (name: string) =>
                name === "WEBGL_debug_renderer_info"
                  ? { UNMASKED_RENDERER_WEBGL: 0x9246 }
                  : { loseContext() {} },
              getParameter: () =>
                "ANGLE (Google, SwiftShader Device, SwiftShader driver)",
            };
          },
        });
      }
      if (gate === "no-webgl" || gate === "major-performance-caveat") {
        const original = HTMLCanvasElement.prototype.getContext;
        Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
          value: function (
            this: HTMLCanvasElement,
            kind: string,
            ...options: unknown[]
          ) {
            if (
              kind === "webgl2" &&
              (gate === "no-webgl" ||
                (options[0] as WebGLContextAttributes | undefined)
                  ?.failIfMajorPerformanceCaveat)
            )
              return null;
            return Reflect.apply(original, this, [kind, ...options]);
          },
        });
      }
    }, gate);
    const requests: string[] = [];
    page.on("request", (request) => requests.push(request.url()));
    await page.goto("/archive-gallery/");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1700);
    expect(
      requests.filter(
        (url) =>
          heavy.some((file) => url.endsWith(`/${file}`)) ||
          url.includes("/models/"),
      ),
    ).toEqual([]);
    await expect(page.locator("canvas.gallery-canvas")).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    if (gate !== "catalogue")
      await expect(page.locator("html")).toHaveAttribute(
        "data-gallery",
        "unavailable",
      );
  });
}

test("a capable visitor who saved Catalogue can still choose Gallery", async ({
  page,
  javaScriptEnabled,
}) => {
  test.skip(
    !javaScriptEnabled,
    "The menu and catalogue work without script separately.",
  );
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    localStorage.setItem("mr-view", "catalogue");
    const original = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      value: function (
        this: HTMLCanvasElement,
        kind: string,
        ...options: unknown[]
      ) {
        if (kind === "webgl2")
          return { getExtension: () => ({ loseContext() {} }) };
        return Reflect.apply(original, this, [kind, ...options]);
      },
    });
  });
  await page.goto("/archive-gallery/");
  const view = page.locator("[data-setting=view]");
  await expect(view).toBeVisible();
  await expect(view).toHaveAttribute("aria-pressed", "false");
  await expect(view).toHaveAccessibleName("View: Catalogue");
  await expect(page.locator("canvas.gallery-canvas")).toHaveCount(0);
});

test("native graphics capability is preserved in validation evidence", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop-chromium",
    "One native Chromium report is sufficient.",
  );
  const capability = await page.evaluate(() => {
    const context = document
      .createElement("canvas")
      .getContext("webgl2", { failIfMajorPerformanceCaveat: true });
    if (!context) return { available: false };
    const extension = context.getExtension("WEBGL_debug_renderer_info");
    const report = {
      available: true,
      renderer: context.getParameter(
        extension?.UNMASKED_RENDERER_WEBGL ?? context.RENDERER,
      ),
      attributes: context.getContextAttributes(),
    };
    context.getExtension("WEBGL_lose_context")?.loseContext();
    return report;
  });
  await info.attach("native-graphics-capability.json", {
    body: JSON.stringify(capability, null, 2),
    contentType: "application/json",
  });
});
