import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { allowSoftwareWebGL } from "./gallery-capability";

interface TorchProbe {
  directions: number[][];
  shaders: string[];
}

test("after-hours torch follows pointer and keyboard without darkening labels", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop-chromium",
    "Real shader and uniform checks run once.",
  );
  test.setTimeout(90_000);
  await allowSoftwareWebGL(page);
  await page.addInitScript(() => {
    localStorage.setItem("mr-view", "gallery");
    localStorage.setItem("mr-lights", "after-hours");
    Object.defineProperty(navigator, "hardwareConcurrency", { get: () => 4 });
    Object.defineProperty(navigator, "deviceMemory", { get: () => 4 });
    const probe: TorchProbe = { directions: [], shaders: [] };
    (window as typeof window & { __torch: TorchProbe }).__torch = probe;
    const names = new WeakMap<WebGLUniformLocation, string>();
    const gl = WebGL2RenderingContext.prototype;
    const location = gl.getUniformLocation;
    gl.getUniformLocation = function (program, name) {
      const result = location.call(this, program, name);
      if (result) names.set(result, name);
      return result;
    };
    const uniform = gl.uniform3f;
    gl.uniform3f = function (at, x, y, z) {
      if (at && names.get(at) === "museumTorchDirection") {
        probe.directions.push([x, y, z]);
        if (probe.directions.length > 300) probe.directions.shift();
      }
      uniform.call(this, at, x, y, z);
    };
    const source = gl.shaderSource;
    gl.shaderSource = function (shader, text) {
      if (text.includes("museumNight")) probe.shaders.push(text);
      source.call(this, shader, text);
    };
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/archive-gallery/?debug");
  await expect(page.locator("html")).toHaveAttribute("data-gallery", "ready", {
    timeout: 30_000,
  });
  await expect(page.locator("html")).toHaveAttribute(
    "data-gallery-quality",
    "medium",
  );
  await expect(page.locator(".gallery-torch-mask")).toHaveCSS("opacity", "0");
  const direction = () =>
    page.evaluate(() =>
      (window as typeof window & { __torch: TorchProbe }).__torch.directions.at(
        -1,
      ),
    );
  await page.mouse.move(30, 300);
  await page.waitForTimeout(450);
  const left = await direction();
  await page.mouse.move(900, 300);
  await page.waitForTimeout(450);
  const right = await direction();
  expect(left).toBeDefined();
  expect(right).toBeDefined();
  expect(Math.abs((left?.[0] ?? 0) - (right?.[0] ?? 0))).toBeGreaterThan(0.2);
  const first = page.locator("#entrance [data-touch]").first();
  await first.focus();
  await page.keyboard.press("Tab");
  await first.focus();
  await page.waitForTimeout(450);
  const keyboard = await direction();
  expect(Math.abs((keyboard?.[0] ?? 0) - (right?.[0] ?? 0))).toBeGreaterThan(
    0.1,
  );
  for (const [x, y] of [
    [0, 0],
    [950, 590],
  ]) {
    await page.mouse.move(x, y);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  }
  await page.screenshot({ path: "test-results/after-hours-entrance.png" });
  // E07 streams a new portrait material on reaching the Human Error view.
  await page
    .locator("#human-error")
    .evaluate((element) => element.scrollIntoView());
  await expect(page.locator(".current-stop")).toContainText("Human Error");
  await page.waitForTimeout(1200);
  const portrait = await page
    .locator("[data-portrait-src]")
    .getAttribute("data-portrait-src");
  expect(portrait).toBeTruthy();
  const human = page.locator(
    "#human-error > .exhibit__label > details > summary",
  );
  async function keyboardHuman() {
    await human.focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    await expect(page.locator("[data-current-stop]")).toContainText("7 of 8", {
      timeout: 10_000,
    });
    await expect(human).toBeFocused();
  }
  await keyboardHuman();
  await page.screenshot({ path: "test-results/after-hours-late-portrait.png" });
  expect(
    await page.evaluate(
      () =>
        (window as typeof window & { __torch: TorchProbe }).__torch.shaders
          .length,
    ),
  ).toBeGreaterThan(0);
  await page
    .getByRole("button", { name: "Lights: After hours", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-lights", "day");
  await page.waitForTimeout(1000);
  await keyboardHuman();
  if ((await page.locator("html").getAttribute("data-view")) === "gallery") {
    await page
      .getByRole("button", { name: "View: Gallery", exact: true })
      .click();
  } else {
    // The explicitly enabled software integration renderer may legitimately
    // reach G04's session retreat after the functional checks above.
    await expect(page.locator("html")).toHaveAttribute(
      "data-view",
      "catalogue",
    );
    await expect(page.locator("[data-gallery-retreat]")).toHaveCount(1);
    expect(await page.evaluate(() => localStorage.getItem("mr-view"))).toBe(
      "gallery",
    );
  }
  await expect(page.locator(".gallery-torch-mask")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("catalogue photographs switch to the night stills without WebGL", async ({
  page,
}, info) => {
  test.skip(
    info.project.name === "no-javascript",
    "The settings toggle requires JavaScript.",
  );
  await page.addInitScript(() => {
    localStorage.setItem("mr-view", "catalogue");
    localStorage.setItem("mr-lights", "day");
  });
  await page.goto("/archive-gallery/");
  await expect(page.locator("#tools [data-photo-mode='day']")).toBeVisible();
  await expect(page.locator("#tools [data-photo-mode='night']")).toBeHidden();
  await page.getByRole("button", { name: "Lights: Day", exact: true }).click();
  await expect(page.locator("#tools [data-photo-mode='night']")).toBeVisible();
  await expect(page.locator("#tools [data-photo-mode='day']")).toBeHidden();
  await expect(page.locator("[data-gallery-layer]")).toHaveCount(0);
});

test("native drum controls, microphone and absence each receive the keyboard torch", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop-chromium",
    "Real focus/uniform integration runs once.",
  );
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 960, height: 600 });
  await allowSoftwareWebGL(page);
  await page.addInitScript(() => {
    localStorage.setItem("mr-view", "gallery");
    localStorage.setItem("mr-lights", "after-hours");
    localStorage.setItem("mr-sound", "off");
    const state = { position: [] as number[], direction: [] as number[] };
    (window as typeof window & { __torchTarget: typeof state }).__torchTarget =
      state;
    const names = new WeakMap<WebGLUniformLocation, string>();
    const gl = WebGL2RenderingContext.prototype;
    const location = gl.getUniformLocation;
    gl.getUniformLocation = function (program, name) {
      const result = location.call(this, program, name);
      if (result) names.set(result, name);
      return result;
    };
    const uniform = gl.uniform3f;
    gl.uniform3f = function (at, x, y, z) {
      const name = at && names.get(at);
      if (name === "museumTorchPosition") state.position = [x, y, z];
      if (name === "museumTorchDirection") state.direction = [x, y, z];
      uniform.call(this, at, x, y, z);
    };
  });
  await page.goto("/archive-gallery/#human-error");
  await expect(page.locator("html")).toHaveAttribute("data-gallery", "ready", {
    timeout: 30_000,
  });
  await page
    .locator("#human-error > .exhibit__label > details")
    .evaluate((details: HTMLDetailsElement) => {
      details.open = true;
    });
  const play = page.locator("[data-drum-play]");
  await play.scrollIntoViewIfNeeded();
  await expect(play).toBeEnabled();
  await page.keyboard.press("Tab");
  const samples: Array<{ control: string; hitX: number }> = [];
  for (const [selector, expectedX] of [
    ["[data-drum-play]", 9.3],
    ["[data-drum-row='0'][data-drum-step='0']", 9.3],
    ["#open-mic [data-touch]", 9.9],
    ["#absent [data-touch]", 8.7],
  ] as const) {
    await page.locator(selector).focus();
    await page.waitForTimeout(650);
    await expect(page.locator("[data-current-stop]")).toContainText("7 of 8");
    const hitX = await page.evaluate(() => {
      const { position: p, direction: d } = (
        window as typeof window & {
          __torchTarget: { position: number[]; direction: number[] };
        }
      ).__torchTarget;
      return p[0] + d[0] * ((-1.65 - p[2]) / d[2]);
    });
    expect(Math.abs(hitX - expectedX)).toBeLessThan(0.24);
    samples.push({ control: selector, hitX });
  }
  await info.attach("keyboard-torch-model-targets", {
    body: JSON.stringify(samples),
    contentType: "application/json",
  });
});
