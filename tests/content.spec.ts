import { expect, test } from "@playwright/test";

const stops = [
  "entrance",
  "tools",
  "flagz",
  "waffle-agent",
  "agent-skills",
  "waystone",
  "acquisitions",
  "human-error",
  "gift-shop",
];

const linkedStops = [
  "tools",
  "flagz",
  "waffle-agent",
  "agent-skills",
  "waystone",
  "acquisitions",
  "gift-shop",
];

test("the complete catalogue preserves the museum's stop order and heading outline", async ({
  page,
}) => {
  await page.goto("/");
  const sections = page.locator("section[data-exhibit]");
  await expect(sections).toHaveCount(9);
  expect(
    await sections.evaluateAll((nodes) => nodes.map((node) => node.id)),
  ).toEqual(stops);
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 2 })).toHaveCount(8);

  for (const [order, id] of stops.entries()) {
    const section = page.locator(`#${id}`);
    await expect(
      section.getByRole("heading", { level: order === 0 ? 1 : 2 }),
    ).toHaveCount(1);
    if ((await section.getAttribute("id")) === "flagz") {
      await expect(section.getByRole("switch")).toHaveCount(3);
    } else {
      await expect(section.locator("[data-touch]")).toHaveCount(1);
      await expect(section.locator("[data-touch]")).toBeVisible();
    }
    if (linkedStops.includes(id)) {
      expect(await section.getByRole("link").count()).toBeGreaterThan(0);
    }
  }

  if (process.env.REQUIRE_FINAL_COPY === "true") {
    await expect(page.locator('[data-exhibit][data-draft="true"]')).toHaveCount(
      0,
    );
  }
});

test("native drawers reveal every tool, skill and Human Error exhibit", async ({
  page,
}) => {
  await page.goto("/");
  const tools = page.locator("#tools");
  await tools.locator("summary").click();
  await expect(
    tools.getByRole("link", { name: "agit", exact: false }),
  ).toBeVisible();
  await expect(
    tools.getByRole("link", { name: "skill-eval", exact: false }),
  ).toBeVisible();
  await expect(tools.locator(".item-list > li")).toHaveCount(7);

  const skills = page.locator("#agent-skills");
  await skills.locator("summary").click();
  await expect(skills.locator(".item-list > li")).toHaveCount(8);
  await expect(
    skills.getByRole("link", {
      name: "verification-before-completion",
      exact: false,
    }),
  ).toBeVisible();

  const humanError = page.locator("#human-error");
  await humanError.locator("summary").click();
  await expect(humanError.getByRole("heading", { level: 3 })).toHaveText([
    "Open Mic",
    "Untitled (Boom Bap)",
    "Absent Exhibit",
    "Portrait of the Head of Security",
  ]);
  await expect(humanError.getByRole("img", { name: /Waffle/ })).toBeVisible();
  await expect(
    humanError.getByText("Removed by the cat.", { exact: true }),
  ).toBeVisible();
});

test("touches bubble to the document and announce the current result", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.use.javaScriptEnabled === false,
    "Native drawers are tested separately without JavaScript",
  );
  await page.goto("/");
  await page.evaluate(() => {
    document.addEventListener("mr:touch", (event) => {
      document.documentElement.dataset.lastTouched = (
        event as CustomEvent<{ exhibit: string }>
      ).detail.exhibit;
    });
  });
  const tools = page.locator("#tools");
  await tools.locator("summary").click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-last-touched",
    "tools",
  );
  await expect(tools.locator("[data-touch-result]")).toHaveText(
    "The toolbox is open; its tools are listed below.",
  );
  await tools.locator("summary").click();
  await expect(tools.locator("[data-touch-result]")).toHaveText(
    "The list is closed.",
  );

  await page.locator("#entrance button[data-touch]").click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-last-touched",
    "entrance",
  );
  await expect(page.locator("#entrance [data-touch-result]")).toHaveText(
    "The rope was never hooked.",
  );
});
