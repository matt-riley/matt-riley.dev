import { expect, test } from "@playwright/test";
import { siteRoutes } from "./routes";

for (const route of siteRoutes()) {
  test(`${route} renders a complete page without browser errors`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("h1")).toBeVisible();
    await expect(page).toHaveTitle(/\S/);
    await page.waitForLoadState("networkidle");
    expect(errors).toEqual([]);
  });
}

test("an unknown route renders the museum's 404 page", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    // Browsers report the deliberately requested HTTP 404 as a console error.
    if (
      message.type() === "error" &&
      !/^Failed to load resource:.*(?:status of 404|404 \(Not Found\))/.test(
        message.text(),
      )
    )
      errors.push(message.text());
  });
  const response = await page.goto("/nope");
  expect(response?.status()).toBe(404);
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator("h1")).toHaveText("This exhibit is on loan.");
  await page.getByRole("link", { name: "Return to the museum" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator("h1")).toBeVisible();
  expect(errors).toEqual([]);
});
