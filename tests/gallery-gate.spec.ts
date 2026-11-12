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
      if (gate === "no-webgl") {
        const original = HTMLCanvasElement.prototype.getContext;
        Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
          value: function (
            this: HTMLCanvasElement,
            kind: string,
            ...options: unknown[]
          ) {
            if (kind === "webgl2") return null;
            return Reflect.apply(original, this, [kind, ...options]);
          },
        });
      }
    }, gate);
    const requests: string[] = [];
    page.on("request", (request) => requests.push(request.url()));
    await page.goto("/");
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
  await page.goto("/");
  const view = page.locator("[data-setting=view]");
  await expect(view).toBeVisible();
  await expect(view).toHaveAttribute("aria-pressed", "false");
  await expect(view).toHaveAccessibleName("View: Catalogue");
  await expect(page.locator("canvas.gallery-canvas")).toHaveCount(0);
});
