import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { animatePart, bindPart, releasePart } from "../src/gallery/parts";

test("rapid reversal of every authored drawer part settles fully closed", async ({
  browserName,
}, info) => {
  test.skip(
    browserName !== "chromium" || info.project.name !== "desktop-chromium",
    "The authored range helper is shared across browsers.",
  );
  for (const id of ["tools", "agent-skills"]) {
    const bytes = readFileSync(`public/models/${id}.glb`);
    const model = await new GLTFLoader()
      .setMeshoptDecoder(MeshoptDecoder)
      .parseAsync(
        bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ),
        "",
      );
    const names =
      id === "tools"
        ? ["touch_tray_left", "touch_tray_right", "touch_drawer"]
        : ["touch_drawer"];
    for (const name of names) {
      const object = model.scene.getObjectByName(name);
      if (!object) throw new Error(`Missing ${id}:${name}`);
      const part = bindPart(object, () => {});
      const transform =
        part.userData.kind === "hinge" ? part.rotation : part.position;
      const base = transform[part.userData.axis];
      for (let cycle = 0; cycle < 6; cycle++) {
        animatePart(part, cycle % 2, { duration: 0.1 });
        await new Promise((resolve) => setTimeout(resolve, 12));
      }
      await new Promise<void>((resolve) =>
        animatePart(part, 0, { duration: 0.05, onComplete: resolve }),
      );
      expect(transform[part.userData.axis]).toBeCloseTo(
        base + part.userData.range[0],
        6,
      );
      releasePart(part);
    }
  }
});

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
