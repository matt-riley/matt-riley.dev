import { expect, test } from "@playwright/test";

const destinations = [
  {
    kind: "work",
    href: "https://mattriley.work/",
    description: "Longer notes.",
  },
  {
    kind: "tools",
    href: "https://mattriley.tools/",
    description: "Small web tools.",
  },
  {
    kind: "github",
    href: "https://github.com/matt-riley",
    description: "The source.",
  },
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("mr-view", "catalogue"));
  await page.goto("/archive-gallery/#gift-shop");
});

test("the shelf offers three clearly named free links and a plain final footer", async ({
  page,
}) => {
  const shelf = page.getByRole("list", { name: "Gift shop shelf" });
  await expect(shelf.getByRole("link")).toHaveCount(3);
  await expect(shelf.getByText("Free", { exact: true })).toHaveCount(3);
  for (const destination of destinations) {
    const link = shelf.getByRole("link", {
      name: new RegExp(destination.description.replace(".", "\\.")),
    });
    await expect(link).toHaveAttribute("href", destination.href);
    await expect(link).toHaveAttribute("rel", "me");
    await expect(link).not.toHaveAttribute("target", "_blank");
  }
  const footer = page.getByRole("contentinfo");
  await expect(footer).toContainText(
    "Made in Yorkshire. Modelled in Blender, drawn with three.js, served from Cloudflare. No cookies, no tracking.",
  );
  await expect(footer).toContainText("GitHub data: From the archive");
  await expect(footer).toContainText(String(new Date().getUTCFullYear()));
  await expect(footer).toContainText("Thank you for touching.");
  const last = await page
    .locator('a[href],button,input,select,textarea,[tabindex="0"]')
    .evaluateAll((elements) =>
      elements
        .filter((element) => {
          const node = element as HTMLElement;
          return (
            node.tabIndex >= 0 &&
            node.getClientRects().length &&
            !node.closest("[inert]")
          );
        })
        .at(-1)
        ?.getAttribute("href"),
    );
  expect(last).toBe("/terms");
  await footer.getByRole("link", { name: "Terms", exact: true }).focus();
  await expect(
    footer.getByRole("link", { name: "Terms", exact: true }),
  ).toBeInViewport();
});

test("every profile destination is reachable with both pointer and keyboard", async ({
  page,
}) => {
  for (const mode of ["pointer", "keyboard"] as const)
    for (const destination of destinations) {
      await page.goto("/archive-gallery/#gift-shop");
      await page.route(destination.href, (route) =>
        route.fulfill({
          status: 200,
          contentType: "text/html",
          body: `<title>${destination.kind} destination</title>`,
        }),
      );
      const link = page.locator(`[data-gift-link="${destination.kind}"]`);
      if (mode === "keyboard") {
        await link.focus();
        await page.keyboard.press("Enter");
      } else await link.click();
      await expect(page).toHaveURL(destination.href);
    }
});

test("phone shelf links work through real touchscreen taps", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "mobile-chromium",
    "Actual touchscreen uses the mobile project",
  );
  for (const destination of destinations) {
    await page.goto("/archive-gallery/#gift-shop");
    await page.route(destination.href, (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<title>Destination</title>",
      }),
    );
    await page.locator(`[data-gift-link="${destination.kind}"]`).tap();
    await expect(page).toHaveURL(destination.href);
  }
});
