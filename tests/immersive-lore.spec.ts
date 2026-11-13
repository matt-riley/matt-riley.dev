import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, test } from "@playwright/test";

// Browser plugin unavailable: Playwright Chromium and phone emulation check
// this image-led prototype, without physical-device or full-3D claims.
const note =
  "We chose SQLite so this project can run without a separate database server.";
const provenance = "Source: supplied Session one note · Project: inventory";

async function originalEvidence(example: Locator) {
  await expect(example.locator("#lore-original-note")).toBeVisible();
  await expect(example.locator("#lore-original-note")).toHaveText(note);
  await expect(example.locator("#lore-original-source")).toBeVisible();
  await expect(example.locator("#lore-original-source")).toHaveText(provenance);
  await expect(
    example.getByRole("link", { name: "View source" }),
  ).toHaveAttribute("href", "https://github.com/matt-riley/lore");
}

test.beforeEach(async ({ page }) => {
  const response = await page.goto("/preview-a/");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle("Please touch. — Matt Riley");
  await expect(page.locator("#lore-heading")).toHaveText("Lore.");
  await expect(
    page.locator("astro-dev-overlay, vite-error-overlay"),
  ).toHaveCount(0);
});

test("keyboard recall and pointer absence preserve the original evidence", async ({
  page,
}, info) => {
  test.skip(
    info.project.use.javaScriptEnabled === false,
    "Interactive recall requires JavaScript.",
  );
  const example = page.locator("[data-lore-example]");
  const database = example.getByRole("button", {
    name: "Which database did we choose?",
  });
  const deployment = example.getByRole("button", {
    name: "How are we deploying it?",
  });
  const answer = example.locator("[data-lore-answer]");
  const source = example.locator("[data-lore-answer-source]");
  const requests: string[] = [];
  page.on("request", (request) => {
    if (["fetch", "xhr"].includes(request.resourceType()))
      requests.push(request.url());
  });
  const storage = () =>
    page.evaluate(() => ({
      local: { ...localStorage },
      session: { ...sessionStorage },
    }));
  const before = await storage();
  await expect(database).toBeEnabled();
  await expect(deployment).toBeEnabled();
  await expect(database).toHaveAttribute("aria-pressed", "false");
  await expect(deployment).toHaveAttribute("aria-pressed", "false");
  await expect(answer).toHaveText(
    "Choose a question to recall the earlier note.",
  );
  await expect(source).toBeHidden();
  await originalEvidence(example);

  await database.focus();
  await page.keyboard.press("Enter");
  await expect(database).toBeFocused();
  await expect(database).toHaveAttribute("aria-pressed", "true");
  await expect(deployment).toHaveAttribute("aria-pressed", "false");
  await expect(answer).toHaveText(`Earlier decision: “${note}”`);
  await expect(source).toBeVisible();
  await expect(source).toHaveText(provenance);
  await originalEvidence(example);

  await deployment.click();
  await expect(deployment).toHaveAttribute("aria-pressed", "true");
  await expect(database).toHaveAttribute("aria-pressed", "false");
  await expect(answer).toHaveText(
    "This example contains no deployment decision.",
  );
  await expect(source).toBeHidden();
  await originalEvidence(example);

  await database.focus();
  await page.keyboard.press("Space");
  await expect(answer).toHaveText(`Earlier decision: “${note}”`);
  await expect(source).toBeVisible();
  expect(await storage()).toEqual(before);
  expect(requests).toEqual([]);
});

test("no JavaScript keeps the supplied note and source usable with disabled questions", async ({
  page,
}, info) => {
  test.skip(
    info.project.use.javaScriptEnabled !== false,
    "Native no-JavaScript contract only.",
  );
  const example = page.locator("[data-lore-example]");
  await originalEvidence(example);
  const buttons = example.getByRole("button");
  await expect(buttons).toHaveCount(2);
  for (const button of await buttons.all()) {
    await expect(button).toBeDisabled();
    await expect(button).toHaveAttribute("aria-pressed", "false");
  }
  await expect(example.locator("[data-lore-answer-source]")).toBeHidden();
  await expect(example.locator(".lore-noscript")).toBeVisible();
  await expect(example.locator(".lore-noscript")).toContainText(
    "It contains no deployment decision.",
  );
  await expect(example.locator(".lore-limit")).toHaveText(
    "Illustration. Nothing is saved here, and no question is sent to a model.",
  );
});

test("the exhibit fits a 320px viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await originalEvidence(page.locator("[data-lore-example]"));
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("initial, recalled and absent states have no scoped axe violations", async ({
  page,
}, info) => {
  test.skip(
    info.project.use.javaScriptEnabled === false,
    "Axe requires script execution; native fallback checked separately.",
  );
  const example = page.locator("[data-lore-example]");
  const audit = async () => {
    const results = await new AxeBuilder({ page })
      .include("#lore-exhibit")
      .analyze();
    expect(results.violations).toEqual([]);
  };
  await audit();
  await example.locator('[data-lore-question="database"]').click();
  await audit();
  await example.locator('[data-lore-question="deployment"]').click();
  await audit();
});
