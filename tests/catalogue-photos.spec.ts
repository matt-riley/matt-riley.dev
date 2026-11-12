import { expect, test } from "@playwright/test";

// Exercise a 390 CSS-pixel phone at 3x density, including Safari.
test.use({ deviceScaleFactor: 3 });

test("each stop has art-directed photographs, descriptive alt text and reserved space", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem("mr-view", "catalogue"));
  await page.goto("/");
  const sections = page.locator("section[data-exhibit]");
  for (const section of await sections.all()) {
    const photos = section.locator(".catalogue-photo");
    await expect(photos).toHaveCount(1);
    await expect(photos.locator("picture")).toHaveCount(2);
    await expect(photos.locator("picture:visible")).toHaveCount(1);
    for (const picture of await photos.locator("picture").all()) {
      await expect(picture.locator('source[type="image/avif"]')).toHaveCount(2);
      await expect(
        picture.locator('source[media="(max-width: 699px)"]'),
      ).toHaveCount(2);
      const image = picture.locator("img");
      expect((await image.getAttribute("alt"))?.length).toBeGreaterThan(30);
      await expect(image).toHaveAttribute("width", "2400");
      await expect(image).toHaveAttribute("height", "1600");
      await expect(image).toHaveAttribute("loading", "lazy");
    }
    const box = await photos.boundingBox();
    expect(box?.height).toBeGreaterThan(0);
  }
  await expect(
    page.locator('#entrance [data-photo-mode="day"] img'),
  ).toHaveAttribute("fetchpriority", "high");
});

test("390px photos fetch only the active mode, stay below 90KB and switch with Lights", async ({
  page,
}, info) => {
  test.skip(
    info.project.use.javaScriptEnabled === false,
    "The no-JavaScript project verifies the default day pictures above",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem("mr-lights", "day");
    localStorage.setItem("mr-view", "catalogue");
  });
  const responses: Array<{ url: string; bytes: number }> = [];
  const pending: Promise<void>[] = [];
  page.on("response", (response) => {
    if (/\/_astro\/.*-(day|night)-(square|wide)/.test(response.url())) {
      pending.push(
        response.body().then((body) => {
          responses.push({ url: response.url(), bytes: body.length });
        }),
      );
    }
  });
  await page.goto("/");
  for (const photo of await page.locator('[data-photo-mode="day"] img').all()) {
    await photo.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        photo.evaluate(
          (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
        ),
      )
      .toBe(true);
  }
  await Promise.all(pending);
  expect(responses.length).toBeGreaterThanOrEqual(9);
  expect(responses.every(({ url }) => url.includes("-day-square"))).toBe(true);
  expect(Math.max(...responses.map(({ bytes }) => bytes))).toBeLessThan(90_000);
  const sizes = await page.locator(".catalogue-photo").evaluateAll((photos) =>
    photos.map((photo) => ({
      width: photo.clientWidth,
      height: photo.clientHeight,
    })),
  );
  await page.locator('[data-setting="lights"]').click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-lights",
    "after-hours",
  );
  for (const photo of await page
    .locator('[data-photo-mode="night"] img')
    .all()) {
    await photo.scrollIntoViewIfNeeded();
    await expect(photo).toBeVisible();
    await expect
      .poll(() =>
        photo.evaluate(
          (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
        ),
      )
      .toBe(true);
  }
  await Promise.all(pending);
  expect(
    responses.filter(({ url }) => url.includes("-night-square")).length,
  ).toBeGreaterThanOrEqual(9);
  expect(Math.max(...responses.map(({ bytes }) => bytes))).toBeLessThan(90_000);
  console.info(
    `${info.project.name}: largest 390px @3x photograph ${Math.max(...responses.map(({ bytes }) => bytes))} bytes; only active square sources fetched.`,
  );
  expect(
    await page.locator(".catalogue-photo").evaluateAll((photos) =>
      photos.map((photo) => ({
        width: photo.clientWidth,
        height: photo.clientHeight,
      })),
    ),
  ).toEqual(sizes);
  await expect(page.locator('[data-photo-mode="day"]:visible')).toHaveCount(0);
  await expect(page.locator('[data-photo-mode="night"]:visible')).toHaveCount(
    9,
  );
});

test("a cold after-hours visit never requests the hidden day photographs", async ({
  page,
}, info) => {
  test.skip(
    info.project.use.javaScriptEnabled === false,
    "Saved settings require the before-paint script",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem("mr-lights", "after-hours");
    localStorage.setItem("mr-view", "catalogue");
  });
  const requests: string[] = [];
  page.on("request", (request) => {
    if (/\/_astro\/.*-(day|night)-(square|wide)/.test(request.url()))
      requests.push(request.url());
  });
  await page.goto("/");
  for (const photo of await page
    .locator('[data-photo-mode="night"] img')
    .all()) {
    await photo.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        photo.evaluate(
          (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
        ),
      )
      .toBe(true);
  }
  expect(requests.length).toBeGreaterThanOrEqual(9);
  expect(requests.every((url) => url.includes("-night-square"))).toBe(true);
});
