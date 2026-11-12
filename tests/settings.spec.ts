import { expect, test } from "@playwright/test";

test("settings switches work by keyboard and announce their pressed state", async ({
  page,
}, info) => {
  test.skip(
    info.project.name === "no-javascript",
    "Settings are a browser enhancement.",
  );
  await page.goto("/");
  const lights = page.getByRole("button", { name: "Lights: Day", exact: true });
  await expect(lights).toHaveAttribute("aria-pressed", "true");
  await lights.focus();
  await expect(lights).toBeFocused();
  expect(
    await lights.evaluate((element) => getComputedStyle(element).outlineWidth),
  ).toBe("2px");
  await page.keyboard.press("Space");
  await expect(page.locator("html")).toHaveAttribute(
    "data-lights",
    "after-hours",
  );
  await expect(
    page.getByRole("button", { name: "Lights: After hours", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(
    page.getByRole("button", { name: "Sound: Off", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator('[data-setting="view"]')).toBeHidden();
  for (const [name, key] of [
    ["Cat", "cat"],
    ["Sound", "sound"],
  ]) {
    const button = page.getByRole("button", { name: new RegExp(`^${name}:`) });
    await button.focus();
    expect(
      await button.evaluate(
        (element) => getComputedStyle(element).outlineWidth,
      ),
    ).toBe("2px");
    await page.keyboard.press("Space");
    await expect(page.locator("html")).toHaveAttribute(
      `data-${key}`,
      key === "cat" ? "off" : "on",
    );
    await expect(button).toHaveAttribute(
      "aria-pressed",
      key === "cat" ? "false" : "true",
    );
  }
  // G-01 will set this contract when the gallery has actually started.
  await page.evaluate(() => {
    document.documentElement.dataset.gallery = "ready";
  });
  const view = page.getByRole("button", { name: "View: Gallery", exact: true });
  await expect(view).toBeVisible();
  await view.focus();
  expect(
    await view.evaluate((element) => getComputedStyle(element).outlineWidth),
  ).toBe("2px");
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).toHaveAttribute("data-view", "catalogue");
  await expect(
    page.getByRole("button", { name: "View: Catalogue", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
});

test("get, set and toggle persist values and dispatch the documented event", async ({
  page,
}, info) => {
  test.skip(
    info.project.name === "no-javascript",
    "The settings API requires JavaScript.",
  );
  const { readFileSync } = await import("node:fs");
  const { gzipSync } = await import("node:zlib");
  const ts = await import("typescript");
  const source = readFileSync("src/scripts/settings.ts", "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  expect(gzipSync(code).length).toBeLessThan(1500);
  await page.goto("/");
  const result = await page.evaluate(async (moduleCode) => {
    // Import the public module in the browser without adding a test global to the product.
    const api = await import(
      `data:text/javascript,${encodeURIComponent(moduleCode)}`
    );
    const events: { key: string; value: string }[] = [];
    document.addEventListener("mr:setting", (event) =>
      events.push((event as CustomEvent).detail),
    );
    api.set("cat", "off");
    const catBefore = api.get("cat");
    api.toggle("cat");
    api.set("sound", "on");
    api.toggle("sound");
    api.set("view", "catalogue");
    let rejectedInvalid = false;
    try {
      api.set("lights", "neon");
    } catch {
      rejectedInvalid = true;
    }
    return {
      catBefore,
      cat: api.get("cat"),
      sound: api.get("sound"),
      view: api.get("view"),
      attribute: document.documentElement.dataset.view,
      stored: localStorage.getItem("mr-view"),
      events,
      rejectedInvalid,
    };
  }, code);
  expect(result).toEqual({
    catBefore: "off",
    cat: "on",
    sound: "off",
    view: "catalogue",
    attribute: "catalogue",
    stored: "catalogue",
    rejectedInvalid: true,
    events: [
      { key: "cat", value: "off" },
      { key: "cat", value: "on" },
      { key: "sound", value: "on" },
      { key: "sound", value: "off" },
      { key: "view", value: "catalogue" },
    ],
  });
});

test("settings survive reload and native storage events synchronise two tabs", async ({
  page,
}, info) => {
  test.skip(
    info.project.name === "no-javascript",
    "Settings require JavaScript.",
  );
  await page.goto("/");
  const second = await page.context().newPage();
  await second.goto("/");
  await page.getByRole("button", { name: "Lights: Day", exact: true }).click();
  await expect(second.locator("html")).toHaveAttribute(
    "data-lights",
    "after-hours",
  );
  await expect(
    second.getByRole("button", { name: "Lights: After hours", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await second.getByRole("button", { name: "Cat: On", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-cat", "off");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Cat: Off", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("html")).toHaveAttribute(
    "data-lights",
    "after-hours",
  );
  await second.evaluate(() => localStorage.clear());
  await expect(page.locator("html")).toHaveAttribute("data-cat", "on");
  await expect(page.locator("html")).toHaveAttribute("data-lights", "day");
  await second.close();
});

test("blocked storage leaves the controls usable", async ({ page }, info) => {
  test.skip(
    info.project.name === "no-javascript",
    "Settings require JavaScript.",
  );
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("Blocked", "SecurityError");
      },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Cat: On", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-cat", "off");
  await expect(
    page.getByRole("button", { name: "Cat: Off", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
});

test("switching lights causes no layout shift", async ({ page }, info) => {
  test.skip(
    info.project.name === "no-javascript",
    "Settings require JavaScript.",
  );
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  const before = await page.locator("#entrance").boundingBox();
  const cls = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let shifts = 0;
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries())
            shifts += (entry as PerformanceEntry & { value: number }).value;
        });
        observer.observe({ type: "layout-shift" });
        document
          .querySelector<HTMLButtonElement>('[data-setting="lights"]')
          ?.click();
        setTimeout(() => {
          observer.disconnect();
          resolve(shifts);
        }, 150);
      }),
  );
  await expect(page.locator("html")).toHaveAttribute(
    "data-lights",
    "after-hours",
  );
  expect(await page.locator("#entrance").boundingBox()).toEqual(before);
  expect(cls).toBe(0);
});

test("the stop menu reaches all exhibits by keyboard", async ({
  page,
}, info) => {
  await page.goto("/");
  const summary = page.locator("[data-stop-menu] summary");
  await summary.focus();
  await page.keyboard.press("Enter");
  const navigation = page.getByRole("navigation", {
    name: "Exhibits",
    exact: true,
  });
  await expect(navigation).toBeVisible();
  await expect(navigation.getByRole("link")).toHaveCount(9);
  const marker = navigation.locator('a[href="#waystone"]');
  await marker.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#waystone$/);
  if (info.project.name !== "no-javascript") {
    await expect(page.locator("[data-current-stop]")).toHaveText(
      "5 of 8, waystone.nvim",
    );
    await expect(page.locator("[data-stop-menu]")).not.toHaveAttribute(
      "open",
      "",
    );
  }
  const top = await page
    .locator("#waystone")
    .evaluate((element) => element.getBoundingClientRect().top);
  const headerBottom = await page
    .locator(".site-header")
    .evaluate((element) => element.getBoundingClientRect().bottom);
  expect(top).toBeGreaterThanOrEqual(headerBottom);
});

test("the fixed header controls fit a 320px viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  const boxes = await page
    .locator(
      ".site-header .monogram, .site-header button:not([hidden]), .site-header summary",
    )
    .evaluateAll((elements) =>
      elements
        .filter((element) => element.getClientRects().length > 0)
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            text: element.textContent,
            left: rect.left,
            right: rect.right,
          };
        }),
    );
  expect(boxes.length).toBeGreaterThanOrEqual(2);
  for (const box of boxes) {
    expect(box.left, box.text ?? "header control").toBeGreaterThanOrEqual(0);
    expect(box.right, box.text ?? "header control").toBeLessThanOrEqual(320);
  }
});
