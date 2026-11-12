import { expect, test } from "@playwright/test";

for (const route of ["/", "/privacy/", "/terms/", "/404.html"]) {
  test(`${route} has canonical and sharing metadata`, async ({ page }) => {
    await page.goto(route);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      `https://matt-riley.dev${route}`,
    );
    const title = await page.title();
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      "content",
      title,
    );
    await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute(
      "content",
      title,
    );
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      "https://matt-riley.dev/og.png",
    );
    await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute(
      "content",
      "https://matt-riley.dev/og.png",
    );
  });
}

test("the home page publishes only the requested WebSite and Person graph", async ({
  page,
}) => {
  await page.goto("/");
  const scripts = page.locator('script[type="application/ld+json"]');
  await expect(scripts).toHaveCount(1);
  const data = JSON.parse((await scripts.textContent()) ?? "null");
  expect(data["@context"]).toBe("https://schema.org");
  expect(data["@graph"]).toHaveLength(2);
  expect(data["@graph"]).toEqual([
    {
      "@type": "WebSite",
      "@id": "https://matt-riley.dev/#website",
      name: "Please Touch: The Museum of Small Useful Things",
      url: "https://matt-riley.dev/",
      description: "Matt Riley makes small useful things. Please touch.",
      inLanguage: "en-GB",
      publisher: { "@id": "https://matt-riley.dev/#person" },
    },
    {
      "@type": "Person",
      "@id": "https://matt-riley.dev/#person",
      name: "Matt Riley",
      url: "https://matt-riley.dev/",
      sameAs: [
        "https://github.com/matt-riley",
        "https://mattriley.work/",
        "https://mattriley.tools/",
      ],
      homeLocation: { "@type": "Place", name: "Yorkshire" },
    },
  ]);
});

test("the sitemap contains only public catalogue pages", async ({
  request,
}) => {
  const sitemap = await request.get("/sitemap-0.xml");
  expect(sitemap.status()).toBe(200);
  const locations = [
    ...(await sitemap.text()).matchAll(/<loc>(.*?)<\/loc>/g),
  ].map((match) => match[1]);
  expect(locations.sort()).toEqual([
    "https://matt-riley.dev/",
    "https://matt-riley.dev/privacy/",
    "https://matt-riley.dev/terms/",
  ]);
  expect((await request.get("/styleguide/")).status()).toBe(404);
});

test("the 404 stop menu reaches actual collection sections", async ({
  page,
}) => {
  await page.goto("/404.html");
  const menu = page.getByRole("navigation", {
    name: "Museum stops",
    exact: true,
  });
  await expect(menu.getByRole("link")).toHaveCount(9);
  await menu.getByRole("link", { name: /mattriley.tools/ }).click();
  await expect(page).toHaveURL("/#tools");
  await expect(page.locator("#tools-heading")).toBeVisible();
});

for (const lights of ["day", "after-hours"] as const) {
  test(`browser chrome follows saved ${lights} and later setting events`, async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.use.javaScriptEnabled === false,
      "Saved settings require JavaScript",
    );
    await page.addInitScript(
      (value) => localStorage.setItem("mr-lights", value),
      lights,
    );
    await page.goto("/");
    const colour = lights === "day" ? "#f4f1ea" : "#0e0e10";
    await expect(
      page.locator('meta[name="theme-color"]').first(),
    ).toHaveAttribute("content", colour);
    await expect(
      page.locator('meta[name="theme-color"]').last(),
    ).toHaveAttribute("content", colour);
    const other = lights === "day" ? "after-hours" : "day";
    await page.evaluate((value) => {
      document.documentElement.dataset.lights = value;
      document.dispatchEvent(
        new CustomEvent("mr:setting", { detail: { key: "lights", value } }),
      );
    }, other);
    const changed = other === "day" ? "#f4f1ea" : "#0e0e10";
    await expect(
      page.locator('meta[name="theme-color"]').first(),
    ).toHaveAttribute("content", changed);
  });
}
