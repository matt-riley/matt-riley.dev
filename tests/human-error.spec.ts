import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("mr-view", "catalogue"));
  await page.goto("/#human-error");
  await page
    .locator("#human-error > .exhibit__label > details > summary")
    .click();
});

test("the complete Human Error placards have keyboard routes and an uncropped portrait", async ({
  page,
}) => {
  const bay = page.locator("#human-error");
  await expect(bay.getByRole("heading", { level: 3 })).toHaveText([
    "Open Mic",
    "Untitled (Boom Bap)",
    "Untitled (Absent Exhibit)",
    "Portrait of the Head of Security",
  ]);
  await expect(
    bay.getByText(
      "Yorkshire. Stand-up, in training. Modern art and Dada. Hip hop, 1986 to 1996.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.locator("#absent").getByText("Porcelain, formerly", { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator("#absent").getByText("Removed by the cat.", { exact: true }),
  ).toBeVisible();
  const links = bay
    .getByRole("navigation", { name: "Human Error exhibits" })
    .getByRole("link");
  await expect(links).toHaveCount(4);
  for (const link of await links.all()) {
    const href = await link.getAttribute("href");
    await link.focus();
    await page.keyboard.press("Enter");
    if (!href) throw new Error("Missing sub-exhibit target");
    await expect(page.locator(href)).toBeFocused();
  }
  const portrait = bay.getByRole("img", { name: /Waffle, Matt/ });
  await expect(portrait).toBeVisible();
  await expect
    .poll(() =>
      portrait.evaluate(
        (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
      ),
    )
    .toBe(true);
  expect(
    await portrait.evaluate((image) => getComputedStyle(image).objectFit),
  ).toBe("contain");
});

test("repeated mouse and keyboard touches announce only the microphone nod and deliberate absence", async ({
  page,
}, info) => {
  test.skip(
    info.project.use.javaScriptEnabled === false,
    "The catalogue remains readable without the optional touch enhancement",
  );
  const mic = page.getByRole("button", {
    name: "Touch the microphone",
    exact: true,
  });
  const result = page.locator("#open-mic [data-touch-result]");
  await expect(result).toHaveAttribute("aria-live", "polite");
  await expect(result).toBeEmpty();
  for (let count = 0; count < 12; count++) {
    await mic.click();
    await expect(result).toHaveText("The microphone nods.");
  }
  await mic.focus();
  await page.keyboard.press("Space");
  await expect(result).toHaveText("The microphone nods.");
  await page.keyboard.press("Enter");
  await expect(result).toHaveText("The microphone nods.");
  await page
    .getByRole("button", { name: "Touch the empty plinth", exact: true })
    .click();
  await expect(page.locator("#absent [data-touch-result]")).toHaveText(
    "Nothing happens. That is the piece.",
  );
  await expect(page.locator("#human-error")).not.toContainText("Matt to write");
});

test("touchscreen controls share the microphone and absence results", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "mobile-chromium",
    "Actual touchscreen activation uses the mobile project",
  );
  await page
    .getByRole("button", { name: "Touch the microphone", exact: true })
    .tap();
  await expect(page.locator("#open-mic [data-touch-result]")).toHaveText(
    "The microphone nods.",
  );
  await page
    .getByRole("button", { name: "Touch the empty plinth", exact: true })
    .tap();
  await expect(page.locator("#absent [data-touch-result]")).toHaveText(
    "Nothing happens. That is the piece.",
  );
});
