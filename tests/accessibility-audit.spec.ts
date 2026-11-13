import { expect, test } from "@playwright/test";
import { allowSoftwareWebGL } from "./gallery-capability";

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

test("standalone touch targets are at least 24px and primary controls are 44px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem("mr-view", "catalogue"));
  await page.goto("/");
  await page.locator("details").evaluateAll((elements) => {
    for (const element of elements) (element as HTMLDetailsElement).open = true;
  });
  const targets = await page
    .locator(
      "button,summary,select,input,.placard__links a,.item-list a,.gift-shelf a,.gift-shop-contact a,.museum-footer a,.stop-menu a,.monogram,.human-error__nav a,.drum-foot a",
    )
    .evaluateAll((elements) =>
      elements.flatMap((element) => {
        const rect = element.getBoundingClientRect();
        if (
          !rect.width ||
          !rect.height ||
          getComputedStyle(element).visibility === "hidden"
        )
          return [];
        const primary = element.matches("button,summary,select");
        return [
          {
            name:
              element.getAttribute("aria-label") ??
              element.textContent?.trim().slice(0, 80),
            width: rect.width,
            height: rect.height,
            minimum: primary ? 44 : 24,
          },
        ];
      }),
    );
  expect(targets.length).toBeGreaterThan(30);
  for (const target of targets) {
    expect(target.width, JSON.stringify(target)).toBeGreaterThanOrEqual(
      target.minimum,
    );
    expect(target.height, JSON.stringify(target)).toBeGreaterThanOrEqual(
      target.minimum,
    );
  }
  await test.info().attach("touch-targets", {
    body: JSON.stringify(targets, null, 2),
    contentType: "application/json",
  });
});

for (const view of ["catalogue", "gallery"] as const) {
  test(`${view}: a keyboard-only tour reaches and operates all nine stops`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    if (view === "gallery") await allowSoftwareWebGL(page);
    await page.addInitScript(
      (view) => localStorage.setItem("mr-view", view),
      view,
    );
    await page.goto("/");
    if (view === "gallery")
      await expect(page.locator("html")).toHaveAttribute(
        "data-gallery",
        "ready",
        { timeout: 30_000 },
      );
    const reached = new Set<string>();
    const journey: Array<{ stop: string; name: string; tag: string }> = [];
    let footer = false;
    for (let step = 0; step < 350; step++) {
      await page.keyboard.press("Tab");
      const focus = await page.evaluate(() => {
        const element = document.activeElement as HTMLElement | null;
        const section = element?.closest<HTMLElement>("section[data-exhibit]");
        const cue = document.querySelector<HTMLElement>("[data-scroll-cue]");
        return {
          stop: section?.dataset.exhibit ?? "",
          name:
            element?.getAttribute("aria-label") ??
            element?.textContent?.trim().slice(0, 100) ??
            "",
          tag: element?.tagName ?? "",
          visible: element?.matches(":focus-visible") ?? false,
          footer: Boolean(element?.closest(".museum-footer")),
          outline: element ? getComputedStyle(element).outlineStyle : "none",
          cueHidden:
            !cue ||
            cue.getClientRects().length === 0 ||
            getComputedStyle(cue).visibility === "hidden",
          gallery: document.documentElement.dataset.gallery,
        };
      });
      expect(focus.visible, `Tab ${step}: ${focus.name}`).toBe(true);
      expect(focus.outline, `Tab ${step}: ${focus.name}`).not.toBe("none");
      if (focus.stop) {
        reached.add(focus.stop);
        if (focus.stop !== "entrance" && !focus.cueHidden)
          // Native focus scrolling can finish on the following frame.
          await expect(page.locator("[data-scroll-cue]")).toBeHidden();
        journey.push({ stop: focus.stop, name: focus.name, tag: focus.tag });
        if (focus.tag === "SUMMARY" || focus.tag === "BUTTON")
          await page.keyboard.press("Enter");
      }
      // Read invariants together with focused-element geometry. Separate
      // protocol round trips per assertion exhausted the tour on SwiftShader.
      if (view === "gallery")
        expect(focus.gallery, `Tab ${step}: live gallery`).toBe("ready");
      if (focus.footer) {
        footer = true;
        break;
      }
    }
    expect(footer, "Keyboard focus must reach the footer without a trap").toBe(
      true,
    );
    if (view === "gallery")
      await expect(page.locator("html")).toHaveAttribute(
        "data-gallery",
        "ready",
      );
    expect([...reached]).toEqual([
      "entrance",
      "tools",
      "flagz",
      "waffle-agent",
      "agent-skills",
      "waystone",
      "acquisitions",
      "human-error",
      "gift-shop",
    ]);
    await test.info().attach(`${view}-keyboard-journey`, {
      body: JSON.stringify(journey, null, 2),
      contentType: "application/json",
    });
  });
}
