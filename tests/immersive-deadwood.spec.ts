import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Browser plugin unavailable: Chromium functional checks of the image-led
// prototype, including phone emulation. No physical-device or full-3D claim.
test.beforeEach(async ({ page }) => {
  const response = await page.goto("/preview-a/");
  expect(response?.status()).toBe(200);
  await expect(page.locator("#deadwood-heading")).toHaveText("deadwood.");
});

test("keyboard Space changes reachability and the visible source import together", async ({
  page,
}, info) => {
  test.skip(
    info.project.use.javaScriptEnabled === false,
    "Enhanced interaction requires JavaScript.",
  );
  const example = page.locator("[data-import-example]");
  const toggle = example.locator("[data-import-toggle]");
  const result = example.locator("[data-import-result]");
  const optional = example.locator("[data-import-optional]");
  const line = example.locator("[data-import-line]");
  await expect(toggle).toBeEnabled();
  await expect(result).toHaveText("1 unreachable file in this example.");
  await expect(optional).toHaveAttribute("data-reachable", "false");
  await example.locator("summary").click();
  await expect(line).toBeHidden();
  await toggle.focus();
  await page.keyboard.press("Space");
  await expect(toggle).toBeChecked();
  await expect(result).toHaveText("0 unreachable files in this example.");
  await expect(optional).toHaveAttribute("data-reachable", "true");
  await expect(optional.locator("[data-import-state]")).toHaveText("Imported");
  await expect(line).toBeVisible();
  await expect(line).toHaveText('import "./legacy";');
  await page.keyboard.press("Space");
  await expect(toggle).not.toBeChecked();
  await expect(result).toHaveText("1 unreachable file in this example.");
  await expect(optional).toHaveAttribute("data-reachable", "false");
  await expect(optional.locator("[data-import-state]")).toHaveText(
    "Unreachable",
  );
  await expect(line).toBeHidden();
});

test("without JavaScript the example stays honest and native disclosure exposes evidence", async ({
  page,
}, info) => {
  test.skip(
    info.project.use.javaScriptEnabled !== false,
    "No-JavaScript contract only.",
  );
  const example = page.locator("[data-import-example]");
  await expect(example.locator("[data-import-toggle]")).toBeDisabled();
  await expect(example.locator("[data-import-result]")).toHaveText(
    "1 unreachable file in this example.",
  );
  await expect(example.locator("[data-import-optional]")).toHaveAttribute(
    "data-reachable",
    "false",
  );
  await expect(example.locator(".import-noscript")).toBeVisible();
  await expect(example.locator(".import-noscript")).toContainText(
    "No import reaches legacy.ts.",
  );
  await example.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(example.locator("details")).toHaveAttribute("open", "");
  await expect(example.locator("pre").first()).toBeVisible();
  await expect(example.locator("pre").first()).toContainText('from "./greet"');
  await expect(example.locator("[data-import-line]")).toBeHidden();
  await expect(
    example.getByRole("link", { name: "View source" }),
  ).toHaveAttribute("href", "https://github.com/matt-riley/deadwood");
  await expect(example.locator(".import-limit")).toContainText(
    "runtime entry points",
  );
});

test("the open exhibit fits a 320px viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.locator("[data-import-example] summary").click();
  await expect(page.locator(".import-source")).toBeVisible();
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("the open exhibit has no axe violations", async ({ page }, info) => {
  test.skip(
    info.project.use.javaScriptEnabled === false,
    "Axe requires script execution; native no-JS behavior has separate checks.",
  );
  await page.locator("[data-import-example] summary").click();
  await expect(page.locator(".import-source")).toBeVisible();
  const audit = await new AxeBuilder({ page })
    .include("#deadwood-exhibit")
    .analyze();
  expect(audit.violations).toEqual([]);
});
