import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

// Browser plugin not available: focused Playwright checks of an image-led
// prototype. These exercise DOM interactions, not a full 3D gallery.
const route = "/";
const projects = [
  {
    id: "pi-extensions",
    name: "pi-extensions",
    source: "https://github.com/matt-riley/pi-extensions",
  },
  {
    id: "mattriley-tools",
    name: "mattriley.tools",
    source: "https://github.com/matt-riley/mattriley.tools",
  },
  {
    id: "deadwood",
    name: "deadwood",
    source: "https://github.com/matt-riley/deadwood",
  },
  { id: "crap", name: "crap", source: "https://github.com/matt-riley/crap" },
  { id: "lore", name: "Lore", source: "https://github.com/matt-riley/lore" },
];
const errors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const captured: string[] = [];
  errors.set(page, captured);
  page.on("pageerror", (error) => captured.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error")
      captured.push(`${message.text()} (${message.location().url})`);
  });
});

test.afterEach(async ({ page, browser }, info) => {
  if (info.status === "skipped") return;
  expect(errors.get(page)).toEqual([]);
  await expect(
    page.locator("astro-dev-overlay, vite-error-overlay"),
  ).toHaveCount(0);
  await info.attach("environment", {
    body: JSON.stringify(
      {
        url: page.url(),
        browser: browser.browserType().name(),
        version: browser.version(),
        viewport: page.viewportSize(),
        javaScriptEnabled: info.project.use.javaScriptEnabled !== false,
        project: info.project.name,
        userAgent: await page.evaluate(() => navigator.userAgent),
        scope:
          "Playwright Chromium / phone emulation; Browser plugin unavailable. Image-led prototype, not full 3D or physical-device proof.",
      },
      null,
      2,
    ),
    contentType: "application/json",
  });
});

async function visit(page: Page) {
  const response = await page.goto(route);
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle("Please touch. — Matt Riley");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    /Please\s*touch\./,
  );
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await expect
    .poll(() =>
      page
        .locator(".arrival-scene")
        .evaluate(
          (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
        ),
    )
    .toBe(true);
}

async function picture(page: Page, name: string, selector?: string) {
  const path = test.info().outputPath(`${name}.png`);
  if (selector)
    await page.locator(selector).screenshot({ path, animations: "disabled" });
  else await page.screenshot({ path, fullPage: false, animations: "disabled" });
  await test.info().attach(name, { path, contentType: "image/png" });
}

async function inspectCollection(page: Page) {
  await expect(page.locator(".curated-project h3")).toHaveText(
    projects.map((project) => project.name),
  );
  for (const project of projects) {
    const disclosure = page.locator(`#project-${project.id}`);
    if (
      !(await disclosure.evaluate(
        (element: HTMLDetailsElement) => element.open,
      ))
    )
      await disclosure.locator(":scope > summary").click();
    await expect(disclosure).toHaveJSProperty("open", true);
    const source = disclosure.getByRole("link", {
      name: "View source",
      exact: true,
    });
    await expect(source).toBeVisible();
    await expect(source).toHaveAttribute("href", project.source);
    if (project.id === "mattriley-tools")
      await expect(
        disclosure.getByRole("link", { name: "Visit", exact: true }),
      ).toHaveAttribute("href", "https://mattriley.tools/");
    if (project.id === "crap")
      await expect(
        disclosure.getByRole("link", { name: "Try the exhibit", exact: true }),
      ).toHaveAttribute("href", "#crap-exhibit");
  }
}

test("desktop and phone can discover the five approved subjects and their public sources", async ({
  page,
  isMobile,
  javaScriptEnabled,
}) => {
  test.skip(
    !javaScriptEnabled,
    "The unenhanced native disclosure has a dedicated test.",
  );
  await visit(page);
  await picture(page, "arrival");
  if (isMobile)
    await page
      .getByRole("button", { name: "Open the ceramic toolbox", exact: true })
      .tap();
  else
    await page
      .getByRole("link", { name: "Open the toolbox", exact: true })
      .click();
  await expect(page).toHaveURL(/\/preview-a\/#collection$/);
  await expect(page.locator("[data-collection-disclosure]")).toHaveJSProperty(
    "open",
    true,
  );
  await inspectCollection(page);
  await picture(page, "open-collection");
});

test("the first keyboard skip opens the collection and focuses its native summary", async ({
  page,
  javaScriptEnabled,
}) => {
  test.skip(
    !javaScriptEnabled,
    "The native no-JavaScript path is covered separately.",
  );
  await visit(page);
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", {
    name: "Skip to the collection",
    exact: true,
  });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#collection-summary")).toBeFocused();
  await expect(page.locator("[data-collection-disclosure]")).toHaveJSProperty(
    "open",
    true,
  );
});

test("native keyboard ranges update score, status, track fill and the rendered needle", async ({
  page,
  javaScriptEnabled,
}) => {
  test.skip(
    !javaScriptEnabled,
    "The unenhanced controls intentionally stay disabled.",
  );
  await visit(page);
  const complexity = page.getByRole("slider", {
    name: "Complexity",
    exact: true,
  });
  const coverage = page.getByRole("slider", {
    name: "Test coverage",
    exact: true,
  });
  const score = page.locator("#risk-score");
  const needle = page.locator("[data-risk-pointer]");
  await expect(complexity).toBeEnabled();
  await expect(coverage).toBeEnabled();
  await expect(score).toHaveText("42");
  await expect(score).toHaveAttribute("aria-live", "polite");
  await expect(score).toHaveAttribute("aria-label", "CRAP score");
  await expect(needle).toHaveCSS("rotate", "30deg");
  await complexity.focus();
  await page.keyboard.press("Tab");
  await expect(coverage).toBeFocused();
  await page.keyboard.press("End");
  await expect(coverage).toHaveValue("100");
  await expect(score).toHaveText("6");
  await expect(page.locator("#coverage-value")).toHaveText("100%");
  await expect(needle).toHaveCSS("rotate", "-60deg");
  await expect(page.locator("[data-risk-status]")).toHaveText(
    "Below the threshold",
  );
  await page.keyboard.press("Shift+Tab");
  await expect(complexity).toBeFocused();
  await page.keyboard.press("End");
  await expect(score).toHaveText("30");
  await expect(page.locator("[data-risk-status]")).toHaveText(
    "At the threshold",
  );
  await coverage.focus();
  await page.keyboard.press("Home");
  await expect(score).toHaveText("930");
  await expect(needle).toHaveCSS("rotate", "75deg");
  await expect(page.locator("[data-risk-status]")).toHaveText(
    "High CRAP score",
  );
  expect(
    await complexity.evaluate((element) =>
      (element as HTMLInputElement).style.getPropertyValue("--range-fill"),
    ),
  ).toBe("100%");
  expect(
    await coverage.evaluate((element) =>
      (element as HTMLInputElement).style.getPropertyValue("--range-fill"),
    ),
  ).toBe("0%");
  await picture(page, "calculator", "#crap-exhibit");
});

test("phone navigation opens and closes through native menu links", async ({
  page,
  isMobile,
  javaScriptEnabled,
}) => {
  test.skip(!isMobile || !javaScriptEnabled, "Mobile enhanced navigation.");
  await visit(page);
  const menu = page.locator(".mobile-nav");
  const toggle = menu.locator(":scope > summary");
  await toggle.click();
  await expect(menu).toHaveJSProperty("open", true);
  const nav = page.getByRole("navigation", {
    name: "Mobile navigation",
    exact: true,
  });
  await expect(
    nav.getByRole("link", { name: "GitHub", exact: true }),
  ).toHaveAttribute("href", "https://github.com/matt-riley");
  await nav.getByRole("link", { name: "Work", exact: true }).click();
  await expect(menu).toHaveJSProperty("open", false);
  await expect(page.locator("[data-collection-disclosure]")).toHaveJSProperty(
    "open",
    true,
  );
  await expect(page).toHaveURL(/#collection$/);
  await page.goto(route);
  await toggle.click();
  await nav.getByRole("link", { name: "Human", exact: true }).click();
  await expect(menu).toHaveJSProperty("open", false);
  await expect(page).toHaveURL(/#human$/);
  await expect(page.locator("#human-heading")).toBeVisible();
});

test("no JavaScript preserves native collection/source details and an honest static score", async ({
  page,
  javaScriptEnabled,
}) => {
  test.skip(javaScriptEnabled, "Dedicated no-JavaScript project.");
  await visit(page);
  await expect(page.locator(".toolbox-touch")).toBeHidden();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to the collection", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  const collection = page.locator("[data-collection-disclosure]");
  await expect(page.locator("#collection-summary")).toBeFocused();
  await expect(collection).toHaveJSProperty("open", false);
  await page.keyboard.press("Enter");
  await expect(collection).toHaveJSProperty("open", true);
  await inspectCollection(page);
  await expect(
    page.getByRole("slider", { name: "Complexity", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("slider", { name: "Test coverage", exact: true }),
  ).toBeDisabled();
  await expect(page.locator("#risk-score")).toHaveText("42");
  await expect(page.locator(".risk-noscript")).toBeVisible();
  await expect(page.locator(".risk-noscript")).toContainText(
    "This example scores 42.",
  );
  await page.locator("#about-metric > summary").click();
  await expect(page.locator("#about-metric")).toHaveJSProperty("open", true);
  await expect(
    page.getByRole("link", { name: "Read about the metric", exact: true }),
  ).toHaveAttribute("href", "https://github.com/matt-riley/crap#the-metric");
  await picture(page, "no-javascript-calculator", "#crap-exhibit");
});

test("open collection and calculator have no axe violations", async ({
  page,
  javaScriptEnabled,
}) => {
  test.skip(
    !javaScriptEnabled,
    "Axe requires JavaScript; the native fallback is separately exercised.",
  );
  await visit(page);
  await page
    .getByRole("link", { name: "Open the toolbox", exact: true })
    .click();
  await page
    .getByRole("link", { name: "About the metric", exact: true })
    .click();
  await expect(page.locator("#about-metric")).toHaveJSProperty("open", true);
  const results = await new AxeBuilder({ page })
    .include("#collection")
    .include("#crap-exhibit")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});

test("fixed navigation remains above calculator artwork and operates its links", async ({
  page,
  isMobile,
  javaScriptEnabled,
}) => {
  test.skip(
    !javaScriptEnabled,
    "Enhanced header navigation; native disclosures are separately covered.",
  );
  await visit(page);
  await page.locator("#crap-exhibit").scrollIntoViewIfNeeded();
  if (isMobile) await page.locator(".mobile-nav > summary").click();
  const navigation = page.getByRole("navigation", {
    name: isMobile ? "Mobile navigation" : "Main navigation",
    exact: true,
  });
  for (const name of ["Work", "Human"]) {
    const link = navigation.getByRole("link", { name, exact: true });
    await expect(link).toBeVisible();
    expect(
      await link.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return (
          document
            .elementFromPoint(
              bounds.x + bounds.width / 2,
              bounds.y + bounds.height / 2,
            )
            ?.closest("a") === element
        );
      }),
      `${name} must receive pointer input above the artwork`,
    ).toBe(true);
  }
  await navigation.getByRole("link", { name: "Human", exact: true }).click();
  await expect(page).toHaveURL(/#human$/);
  if (isMobile) await page.locator(".mobile-nav > summary").click();
  await navigation.getByRole("link", { name: "Work", exact: true }).click();
  await expect(page).toHaveURL(/#collection$/);
  await expect(page.locator("[data-collection-disclosure]")).toHaveJSProperty(
    "open",
    true,
  );
});

test("the open prototype has no horizontal document overflow at 320px", async ({
  page,
  javaScriptEnabled,
}) => {
  test.skip(
    !javaScriptEnabled,
    "The open native fallback is separately exercised.",
  );
  await page.setViewportSize({ width: 320, height: 800 });
  await visit(page);
  await page
    .getByRole("link", { name: "Open the toolbox", exact: true })
    .click();
  await page
    .getByRole("link", { name: "About the metric", exact: true })
    .click();
  const widths = await page.evaluate(() => ({
    viewport: innerWidth,
    html: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(widths.html).toBeLessThanOrEqual(widths.viewport);
  expect(widths.body).toBeLessThanOrEqual(widths.viewport);
  await expect(
    page.getByRole("slider", { name: "Complexity", exact: true }),
  ).toBeEnabled();
});
