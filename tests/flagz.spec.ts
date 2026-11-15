import { expect, test } from "@playwright/test";

test("Flagz exposes three named switches, live JSON and specific announcements", async ({
  page,
  javaScriptEnabled,
}) => {
  test.skip(
    !javaScriptEnabled,
    "Live controls require JavaScript; static values remain readable.",
  );
  await page.addInitScript(() => localStorage.setItem("mr-view", "catalogue"));
  await page.goto("/archive-gallery/#flagz");
  const group = page.getByRole("group", { name: "Site feature flags" });
  await expect(group.getByRole("switch")).toHaveCount(3);
  for (const key of ["lights", "cat", "sound"])
    await expect(
      group.getByRole("switch", { name: key, exact: true }),
    ).toBeEnabled();
  const cat = group.getByRole("switch", { name: "cat", exact: true });
  await expect(cat).toBeChecked();
  await cat.focus();
  await page.keyboard.press("Space");
  await expect(cat).not.toBeChecked();
  await expect(
    page.getByRole("button", { name: "Cat: Off", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("#flagz [data-touch-result]")).toHaveText(
    "Cat: off. He will remember this.",
  );
  await expect(page.locator("[data-flagz-json]")).toContainText('"cat": "off"');
  await page.getByRole("button", { name: "Cat: Off", exact: true }).click();
  await expect(cat).toBeChecked();
  const lights = group.getByRole("switch", { name: "lights", exact: true });
  await lights.click();
  await expect(lights).not.toBeChecked();
  await expect(page.locator("#flagz [data-touch-result]")).toHaveText(
    "Lights: after hours.",
  );
  await group.getByRole("switch", { name: "sound", exact: true }).click();
  await expect(page.locator("#flagz [data-touch-result]")).toHaveText(
    "Sound: on.",
  );
});

test("Flagz persists across reload and synchronizes two tabs without event loops", async ({
  page,
  javaScriptEnabled,
}) => {
  test.skip(!javaScriptEnabled, "Storage synchronization requires JavaScript.");
  await page.addInitScript(() => localStorage.setItem("mr-view", "catalogue"));
  await page.goto("/archive-gallery/#flagz");
  const second = await page.context().newPage();
  await second.goto("/archive-gallery/#flagz");
  const counts = await page.evaluate(() => {
    let settings = 0,
      touches = 0;
    const setting = () => {
        settings++;
      },
      touch = () => {
        touches++;
      };
    document.addEventListener("mr:setting", setting);
    document.addEventListener("mr:touch", touch);
    document
      .querySelector<HTMLButtonElement>('[data-flagz-setting="sound"]')
      ?.click();
    document.removeEventListener("mr:setting", setting);
    document.removeEventListener("mr:touch", touch);
    return { settings, touches };
  });
  expect(counts).toEqual({ settings: 1, touches: 1 });
  await expect(
    second.getByRole("switch", { name: "sound", exact: true }),
  ).toBeChecked();
  await page.reload();
  await expect(
    page.getByRole("switch", { name: "sound", exact: true }),
  ).toBeChecked();
  await second
    .getByRole("button", { name: "Lights: Day", exact: true })
    .click();
  await expect(
    page.getByRole("switch", { name: "lights", exact: true }),
  ).not.toBeChecked();
  const json = await page.locator("[data-flagz-json]").textContent();
  expect(JSON.parse(json ?? "{}")).toEqual({
    lights: "after-hours",
    cat: "on",
    sound: "on",
  });
  await second.close();
});

test("Flagz leaves readable values and native disabled switches without JavaScript", async ({
  page,
  javaScriptEnabled,
}) => {
  test.skip(javaScriptEnabled, "This case verifies the printed catalogue.");
  await page.goto("/archive-gallery/#flagz");
  const group = page.getByRole("group", { name: "Site feature flags" });
  for (const key of ["lights", "cat", "sound"])
    await expect(
      group.getByRole("switch", { name: key, exact: true }),
    ).toBeDisabled();
  expect(
    JSON.parse((await page.locator("[data-flagz-json]").textContent()) ?? "{}"),
  ).toEqual({ lights: "day", cat: "on", sound: "off" });
});
