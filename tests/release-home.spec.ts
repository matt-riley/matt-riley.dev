import { expect, test } from "@playwright/test";

test("the approved release homepage is indexable while comparison routes are noindex", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await expect(page.locator("#arrival-heading")).toHaveText("Pleasetouch.");
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://matt-riley.dev/",
  );
  await expect(page.locator(".curated-project h3")).toHaveText([
    "pi-extensions",
    "mattriley.tools",
    "deadwood",
    "crap",
    "Lore",
  ]);
  await expect(page.locator("section[data-exhibit]")).toHaveCount(0);
  const homepage = await (await request.get("/")).text();
  expect(homepage).not.toMatch(
    /agent-skills|waystone\.nvim|github\.com\/matt-riley\/flagz/,
  );
  for (const route of ["/preview-a/", "/archive-gallery/"]) {
    await page.goto(route);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/,
    );
  }
  await page.goto("/preview-a/");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://matt-riley.dev/",
  );
  await expect(page.locator(".curated-project h3")).toHaveText([
    "pi-extensions",
    "mattriley.tools",
    "deadwood",
    "crap",
    "Lore",
  ]);
});

test("the homepage links to accurate secondary pages without storing visit state", async ({
  page,
}) => {
  await page.goto("/");
  const before = await page.evaluate(() => JSON.stringify(localStorage));
  await page
    .getByRole("link", { name: "Open the toolbox", exact: true })
    .click();
  const footer = page.getByRole("navigation", {
    name: "Footer navigation",
    exact: true,
  });
  await footer.getByRole("link", { name: "Privacy", exact: true }).click();
  await expect(page).toHaveURL("/privacy/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Privacy, without the fog.",
  );
  await page
    .getByRole("navigation", { name: "Footer navigation", exact: true })
    .getByRole("link", { name: "Terms", exact: true })
    .click();
  await expect(page).toHaveURL("/terms/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Terms, in plain English.",
  );
  expect(await page.evaluate(() => JSON.stringify(localStorage))).toBe(before);
});
