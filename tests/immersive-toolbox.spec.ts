import {
  expect,
  type Page,
  type Route,
  type TestInfo,
  test,
} from "@playwright/test";
import { allowSoftwareWebGL } from "./gallery-capability";

// Browser plugin unavailable. These are real WebGL functional checks in
// Playwright Chromium, with phone emulation separately labelled below.
const model = (url: URL) => /toolbox[^/]*\.glb$/.test(url.pathname);
const viewer = (page: Page) => page.locator("[data-toolbox-viewer]");
const canvas = (page: Page) => viewer(page).getByRole("img");
const host = (page: Page) => page.locator("[data-toolbox-canvas]");
const source = (page: Page) =>
  page
    .locator("#project-mattriley-tools")
    .getByRole("link", { name: "View source", exact: true });
const desktop = (info: TestInfo) =>
  test.skip(
    info.project.name !== "desktop-chromium",
    "Real-renderer lifecycle checks run once on desktop Chromium.",
  );

async function visit(page: Page) {
  expect((await page.goto("/"))?.status()).toBe(200);
  await expect(page).toHaveTitle("Please touch. — Matt Riley");
  await page.locator("#collection-summary").click();
  await expect(page.locator("[data-collection-disclosure]")).toHaveAttribute(
    "open",
    "",
  );
}

async function pickUp(page: Page) {
  await viewer(page)
    .getByRole("button", { name: "Pick up the toolbox" })
    .click();
  await expect(viewer(page)).toHaveAttribute("data-state", "ready", {
    timeout: 30_000,
  });
  await expect(canvas(page)).toHaveCount(1);
  await expect(canvas(page)).toBeVisible();
  await expect(host(page)).toHaveAttribute(
    "data-toolbox-draw-calls",
    /^[1-9]\d*$/,
  );
  await expect(host(page)).toHaveAttribute(
    "data-toolbox-triangles",
    /^[1-9]\d*$/,
  );
}

async function linksRemainUsable(page: Page) {
  const disclosures = page.locator(".curated-project");
  await expect(disclosures).toHaveCount(5);
  for (const disclosure of await disclosures.all()) {
    if (
      !(await disclosure.evaluate(
        (element) => (element as HTMLDetailsElement).open,
      ))
    )
      await disclosure.locator("summary").click();
    const link = disclosure.getByRole("link", {
      name: "View source",
      exact: true,
    });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute(
      "href",
      /^https:\/\/github\.com\/matt-riley\//,
    );
    await link.focus();
    await expect(link).toBeFocused();
  }
}

test("the photograph and source links need no eager 3D download or JavaScript", async ({
  page,
}, info) => {
  const requests: string[] = [];
  const scripts: Promise<string>[] = [];
  page.on("request", (request) => requests.push(request.url()));
  page.on("response", (response) => {
    if (response.request().resourceType() === "script")
      scripts.push(response.text());
  });
  await visit(page);
  await expect(viewer(page)).toHaveAttribute("data-state", "photo");
  await expect(canvas(page)).toHaveCount(0);
  const start = viewer(page).getByRole("button", {
    name: "Pick up the toolbox",
    includeHidden: true,
  });
  if (info.project.use.javaScriptEnabled === false)
    await expect(start).toBeHidden();
  else await expect(start).toBeVisible();
  await linksRemainUsable(page);
  expect(
    requests.filter((url) =>
      /immersive-toolbox-runtime|\/three[.-]|toolbox[^/]*\.glb/.test(url),
    ),
  ).toEqual([]);
  // Three retains these renderer diagnostics in its shipped production code.
  // Inspect fetched scripts as well as filenames so a renamed vendor chunk
  // cannot silently turn the optional runtime into an eager download.
  expect(
    (await Promise.all(scripts)).filter((body) =>
      body.includes("THREE.WebGLRenderer"),
    ),
  ).toEqual([]);
});

test("native controls open, close and turn actual rendered pixels", async ({
  page,
}, info) => {
  desktop(info);
  await allowSoftwareWebGL(page);
  await visit(page);
  await pickUp(page);
  await expect(host(page)).toHaveAttribute("data-toolbox-open", "1.000");
  const opened = await canvas(page).screenshot();
  const close = viewer(page).getByRole("button", {
    name: "Close toolbox",
    exact: true,
  });
  await expect(close).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(host(page)).toHaveAttribute("data-toolbox-open", "0.000");
  const closed = await canvas(page).screenshot();
  expect(closed).not.toEqual(opened);
  await page.keyboard.press("Space");
  await expect(host(page)).toHaveAttribute("data-toolbox-open", "1.000");
  await viewer(page)
    .getByRole("button", { name: "Turn toolbox left", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect
    .poll(async () => Number(await host(page).getAttribute("data-toolbox-yaw")))
    .toBeLessThan(0);
  expect(await canvas(page).screenshot()).not.toEqual(opened);
  await viewer(page)
    .getByRole("button", { name: "Turn toolbox right", exact: true })
    .click();
  await expect(host(page)).toHaveAttribute("data-toolbox-yaw", "0.000");
  await linksRemainUsable(page);
  await viewer(page)
    .getByRole("button", { name: "Back to the photograph", exact: true })
    .click();
  await expect(viewer(page)).toHaveAttribute("data-state", "photo");
  await expect(canvas(page)).toHaveCount(0);
  await expect(
    viewer(page).getByRole("button", { name: "Pick up the toolbox" }),
  ).toBeFocused();
});

test("reduced motion commits the requested pose on its next rendered frame", async ({
  page,
}, info) => {
  desktop(info);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await allowSoftwareWebGL(page);
  await visit(page);
  await pickUp(page);
  await viewer(page)
    .getByRole("button", { name: "Close toolbox", exact: true })
    .click();
  const nextPose = await host(page).evaluate(
    (element) =>
      new Promise<string | undefined>((resolve) =>
        requestAnimationFrame(() =>
          resolve((element as HTMLElement).dataset.toolboxOpen),
        ),
      ),
  );
  expect(nextPose).toBe("0.000");
  await viewer(page)
    .getByRole("button", { name: "Open toolbox", exact: true })
    .click();
  await expect(host(page)).toHaveAttribute("data-toolbox-open", "1.000");
});

test("a failed model load preserves the photograph and permits a real retry", async ({
  page,
}, info) => {
  desktop(info);
  await allowSoftwareWebGL(page);
  let attempts = 0;
  await page.route(model, async (route) => {
    if (++attempts === 1)
      await route.fulfill({ status: 503, body: "Unavailable" });
    else await route.continue();
  });
  await visit(page);
  await viewer(page)
    .getByRole("button", { name: "Pick up the toolbox" })
    .click();
  await expect(viewer(page).locator("[data-toolbox-status]")).toContainText(
    "3D view is unavailable",
  );
  await expect(viewer(page)).toHaveAttribute("data-state", "photo");
  await expect(canvas(page)).toHaveCount(0);
  await linksRemainUsable(page);
  await pickUp(page);
  expect(attempts).toBe(2);
});

test("real WebGL context loss restores the photograph and releases its canvas", async ({
  page,
}, info) => {
  desktop(info);
  await allowSoftwareWebGL(page);
  await visit(page);
  await pickUp(page);
  await canvas(page).evaluate((element) => {
    const gl = (element as HTMLCanvasElement).getContext("webgl2");
    const extension = gl?.getExtension("WEBGL_lose_context");
    if (!extension) throw new Error("Context-loss extension unavailable");
    extension.loseContext();
  });
  await expect(viewer(page)).toHaveAttribute("data-state", "photo");
  await expect(canvas(page)).toHaveCount(0);
  await expect(viewer(page).locator("[data-toolbox-status]")).toContainText(
    "3D view is unavailable",
  );
  await linksRemainUsable(page);
});

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test("closing during model loading cancels that session and reopening leaves one canvas", async ({
  page,
}, info) => {
  desktop(info);
  await allowSoftwareWebGL(page);
  const arrived = deferred();
  const release = deferred();
  let first = true;
  await page.route(model, async (route) => {
    if (first) {
      first = false;
      arrived.resolve();
      await release.promise;
      // The aborted first request may already be closed by the browser.
      await route.continue().catch(() => {});
    } else await route.continue();
  });
  await visit(page);
  await viewer(page)
    .getByRole("button", { name: "Pick up the toolbox" })
    .click();
  await arrived.promise;
  await expect(viewer(page)).toHaveAttribute("data-state", "loading");
  await page.locator("#collection-summary").click();
  await expect(viewer(page)).toHaveAttribute("data-state", "photo");
  await expect(canvas(page)).toHaveCount(0);
  release.resolve();
  await page.locator("#collection-summary").click();
  await pickUp(page);
  await expect(page.locator("[data-toolbox-canvas] canvas")).toHaveCount(1);
  await page.locator("#collection-summary").click();
  await expect(page.locator("[data-toolbox-canvas] canvas")).toHaveCount(0);
});

for (const outcome of ["success", "failure"] as const) {
  test(`a delayed ${outcome} does not steal focus from a project source`, async ({
    page,
  }, info) => {
    desktop(info);
    await allowSoftwareWebGL(page);
    const arrived = deferred();
    const release = deferred();
    await page.route(model, async (route: Route) => {
      arrived.resolve();
      await release.promise;
      if (outcome === "failure")
        await route.fulfill({ status: 503, body: "Unavailable" });
      else await route.continue();
    });
    await visit(page);
    await viewer(page)
      .getByRole("button", { name: "Pick up the toolbox" })
      .click();
    await arrived.promise;
    await expect(viewer(page).locator("[data-toolbox-start]")).toHaveAttribute(
      "aria-busy",
      "true",
    );
    await source(page).focus();
    await expect(source(page)).toBeFocused();
    release.resolve();
    if (outcome === "success")
      await expect(viewer(page)).toHaveAttribute("data-state", "ready", {
        timeout: 30_000,
      });
    else
      await expect(viewer(page).locator("[data-toolbox-status]")).toContainText(
        "3D view is unavailable",
      );
    await expect(source(page)).toBeFocused();
    await expect(source(page)).toBeVisible();
  });
}

test("phone canvas preserves native vertical scrolling", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "mobile-chromium",
    "Actual Chromium touch input in phone emulation.",
  );
  await allowSoftwareWebGL(page);
  await visit(page);
  await pickUp(page);
  await canvas(page).scrollIntoViewIfNeeded();
  await expect(canvas(page)).toHaveCSS("touch-action", "pan-y");
  const box = await canvas(page).boundingBox();
  expect(box).not.toBeNull();
  if (!box) throw new Error("Canvas has no painted rectangle");
  const x = box.x + box.width / 2;
  const y = Math.max(120, box.y + box.height / 2);
  const before = await page.evaluate(() => scrollY);
  const session = await page.context().newCDPSession(page);
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y }],
  });
  for (let step = 1; step <= 8; step++)
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y: y - step * 16 }],
    });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await session.detach();
  await expect
    .poll(() => page.evaluate(() => scrollY))
    .toBeGreaterThan(before + 30);
  await expect(viewer(page)).toHaveAttribute("data-state", "ready");
});
