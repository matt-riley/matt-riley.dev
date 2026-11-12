import { expect, test } from "@playwright/test";

test.beforeEach(async ({ browserName }, info) => {
  test.skip(
    browserName !== "chromium" || info.project.name !== "desktop-chromium",
    "Detailed audit matrix.",
  );
});

for (const lights of ["day", "after-hours"] as const) {
  test(`${lights}: text and focus colours meet contrast targets`, async ({
    page,
  }) => {
    await page.addInitScript((value) => {
      localStorage.setItem("mr-view", "catalogue");
      localStorage.setItem("mr-lights", value);
    }, lights);
    await page.goto("/");
    const ratios = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      const luminance = (token: string) => {
        const hex = style.getPropertyValue(token).trim().replace("#", "");
        if (!/^[0-9a-f]{6}$/i.test(hex))
          throw new Error(`Invalid colour ${token}`);
        const channels = [0, 2, 4].map((index) => {
          const value = parseInt(hex.slice(index, index + 2), 16) / 255;
          return value <= 0.04045
            ? value / 12.92
            : ((value + 0.055) / 1.055) ** 2.4;
        });
        return (
          channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
        );
      };
      return ["--ink", "--ink-soft", "--glaze-ink"].flatMap((foreground) =>
        ["--wall", "--plinth"].map((background) => {
          const a = luminance(foreground),
            b = luminance(background);
          return {
            foreground,
            background,
            ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
          };
        }),
      );
    });
    expect(ratios).toHaveLength(6);
    for (const pair of ratios)
      expect(pair.ratio, JSON.stringify(pair)).toBeGreaterThanOrEqual(4.5);
    await test.info().attach(`${lights}-contrast`, {
      body: JSON.stringify(ratios, null, 2),
      contentType: "application/json",
    });
    await page.keyboard.press("Tab");
    const focus = page.locator(":focus-visible");
    await expect(focus).toHaveCount(1);
    expect(
      await focus.evaluate((element) => getComputedStyle(element).outlineStyle),
    ).not.toBe("none");
  });
}

test("320px and 200/400 percent equivalent viewports preserve every placard", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem("mr-view", "catalogue"));
  for (const width of [1280, 640, 320]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");
    await page.locator("details").evaluateAll((details) => {
      for (const element of details)
        (element as HTMLDetailsElement).open = true;
    });
    const dimensions = await page.evaluate(() => ({
      viewport: innerWidth,
      page: document.documentElement.scrollWidth,
    }));
    expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport + 1);
    const placards = await page
      .locator("section[data-exhibit] .placard")
      .evaluateAll((elements) =>
        elements.map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            top: rect.top,
            bottom: rect.bottom,
            left: rect.left,
            right: rect.right,
            width: rect.width,
          };
        }),
      );
    expect(placards).toHaveLength(9);
    for (const [index, rect] of placards.entries()) {
      expect(rect.left).toBeGreaterThanOrEqual(0);
      expect(rect.right).toBeLessThanOrEqual(width + 1);
      expect(rect.width).toBeGreaterThan(200);
      if (index)
        expect(rect.top).toBeGreaterThanOrEqual(placards[index - 1].bottom);
    }
  }
});

test("forced colours retain control borders and a visible keyboard focus ring", async ({
  page,
}) => {
  await page.emulateMedia({ forcedColors: "active" });
  await page.goto("/");
  await page.keyboard.press("Tab");
  const focused = page.locator(":focus-visible");
  await expect(focused).toHaveCount(1);
  const style = await focused.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      outline: style.outlineStyle,
      width: parseFloat(style.outlineWidth),
      color: style.outlineColor,
      background: style.backgroundColor,
    };
  });
  expect(style.outline).toBe("solid");
  expect(style.width).toBeGreaterThanOrEqual(2);
  expect(style.color).not.toBe(style.background);
  const borders = await page
    .locator("[data-setting]")
    .evaluateAll((buttons) =>
      buttons
        .filter((button) => !button.hasAttribute("hidden"))
        .map((button) => getComputedStyle(button).borderTopStyle),
    );
  expect(borders.length).toBeGreaterThanOrEqual(3);
  expect(borders.every((border) => border === "solid")).toBe(true);
});
