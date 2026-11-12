import { expect, test } from "@playwright/test";

test("both native drawer lists remain independent and keyboard reachable", async ({
  page,
}, info) => {
  await page.goto("/");
  const tools = page.locator("#tools details");
  const skills = page.locator("#agent-skills details");
  await tools.locator("summary").click();
  await expect(tools).toHaveAttribute("open", "");
  await skills.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(skills).toHaveAttribute("open", "");
  await expect(tools).toHaveAttribute("open", "");
  await expect(tools.locator(".item-list a")).toHaveCount(7);
  await expect(skills.locator(".item-list a")).toHaveCount(8);
  if (info.project.name !== "no-javascript") {
    await expect(tools.locator("summary")).toContainText("Close the drawers");
    await expect(skills.locator("summary")).toContainText("Close the drawers");
  }
  await tools.locator("summary").click();
  await expect(tools).not.toHaveAttribute("open");
  await expect(skills).toHaveAttribute("open", "");
});

test("every fallback drawer destination responds with HTTP 200", async ({
  page,
  request,
}, info) => {
  test.skip(
    process.env.VERIFY_EXTERNAL_LINKS !== "1" ||
      info.project.name !== "desktop-chromium",
    "Run explicitly to verify live external destinations without making CI depend on other sites.",
  );
  test.setTimeout(120_000);
  await page.goto("/");
  const destinations = await page
    .locator("#tools .item-list a, #agent-skills .item-list a")
    .evaluateAll((links) =>
      links.map((link) => (link as HTMLAnchorElement).href),
    );
  expect(destinations).toHaveLength(15);
  for (const url of destinations) {
    const response = await request.get(url);
    expect(response.status(), url).toBe(200);
  }
});
