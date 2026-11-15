import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { Box3, PerspectiveCamera, Vector3 } from "three";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { screenHitArea } from "../src/gallery/hit-area";
import { allowSoftwareWebGL } from "./gallery-capability";

const keys = ["lights", "cat", "sound"] as const;

test("every Flagz switch is individually pickable through its real DOM control", async ({
  page,
}, info) => {
  test.skip(
    !["desktop-chromium", "mobile-chromium"].includes(info.project.name),
    "Real picking is covered on mouse and touch Chromium.",
  );
  test.setTimeout(120_000);
  await allowSoftwareWebGL(page);
  await page.addInitScript(() => {
    localStorage.setItem("mr-view", "gallery");
    localStorage.setItem("mr-lights", "day");
    const match = window.matchMedia;
    window.matchMedia = (query) => {
      const result = match.call(window, query);
      if (query === "(hover: hover) and (pointer: fine)")
        Object.defineProperty(result, "matches", { value: false });
      return result;
    };
    document.addEventListener("mr:touch", (event) =>
      Object.assign(window, {
        lastFlagPart: (event as CustomEvent).detail.part,
      }),
    );
  });
  await page.goto("/archive-gallery/#flagz");
  await expect(page.locator("html")).toHaveAttribute("data-gallery", "ready", {
    timeout: 30_000,
  });
  await expect(page.locator("html")).toHaveAttribute("data-exhibits", "ready", {
    timeout: 30_000,
  });
  await page
    .locator("#flagz")
    .evaluate((section) =>
      section.scrollIntoView({ block: "center", behavior: "instant" }),
    );
  await page.waitForTimeout(700);
  const width = page.viewportSize()?.width ?? 0;
  if (width >= 900) {
    const bytes = readFileSync("public/models/flagz.glb");
    const model = await new GLTFLoader()
      .setMeshoptDecoder(MeshoptDecoder)
      .parseAsync(
        bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ),
        "",
      );
    const room = readFileSync("public/models/room.glb");
    const json = JSON.parse(
      room.subarray(20, 20 + room.readUInt32LE(12)).toString(),
    );
    const position = (name: string) =>
      new Vector3().fromArray(
        json.nodes.find((node: { name: string }) => node.name === name)
          .translation,
      );
    const height = page.viewportSize()?.height ?? 0;
    const camera = new PerspectiveCamera(35, width / height, 0.03, 80);
    camera.position.copy(position("stop_2_cam"));
    camera.lookAt(position("stop_2_target"));
    camera.updateMatrixWorld();
    model.scene.position.add(position("anchor_flagz"));
    for (const key of keys) {
      for (const prefix of ["touch_switch", "touch_flag"]) {
        const part = model.scene.getObjectByName(`${prefix}_${key}`);
        if (!part) throw new Error(`Missing ${prefix}_${key}`);
        const target =
          part.userData.kind === "hinge" ? part.rotation : part.position;
        target[part.userData.axis as "x" | "y" | "z"] +=
          part.userData.range[key === "sound" ? 0 : 1];
      }
    }
    model.scene.updateMatrixWorld(true);
    for (const key of keys) {
      const part = model.scene.getObjectByName(`touch_switch_${key}`);
      if (!part) throw new Error(`Missing switch ${key}`);
      const area = screenHitArea(
        new Box3().setFromObject(part),
        camera,
        width,
        height,
        44,
      );
      if (!area) throw new Error(`Switch ${key} is outside its camera`);
      expect(area.right - area.left).toBeGreaterThanOrEqual(44);
      expect(area.bottom - area.top).toBeGreaterThanOrEqual(44);
      const before = await page
        .getByRole("switch", { name: key, exact: true })
        .getAttribute("aria-checked");
      await page.mouse.click(area.centreX, area.centreY);
      await expect(
        page.getByRole("switch", { name: key, exact: true }),
      ).toHaveAttribute("aria-checked", before === "true" ? "false" : "true");
      expect(
        await page.evaluate(
          () => (window as unknown as { lastFlagPart: string }).lastFlagPart,
        ),
      ).toBe(`touch_switch_${key}`);
    }
  } else {
    const area = await page.evaluate(() => ({
      top:
        (document.querySelector(".site-header")?.getBoundingClientRect()
          .bottom ?? 0) + 16,
      bottom:
        (document
          .querySelector("#flagz .exhibit__label")
          ?.getBoundingClientRect().top ?? innerHeight) - 16,
      width: innerWidth,
    }));
    const found = new Set<string>();
    const points: { key: string; x: number; y: number }[] = [];
    async function tapPart(x: number, y: number) {
      await page.mouse.move(x, y);
      if (
        !(await page.evaluate(() => document.body.style.cursor === "pointer"))
      )
        return false;
      await page.evaluate(() => Object.assign(window, { lastFlagPart: "" }));
      const before = JSON.parse(
        (await page.locator("[data-flagz-json]").textContent()) ?? "{}",
      );
      await page.touchscreen.tap(x, y);
      const part = await page.evaluate(
        () => (window as unknown as { lastFlagPart: string }).lastFlagPart,
      );
      if (!part?.startsWith("touch_switch_")) return false;
      const key = part.replace("touch_switch_", "");
      const after = JSON.parse(
        (await page.locator("[data-flagz-json]").textContent()) ?? "{}",
      );
      expect(
        keys.filter((candidate) => before[candidate] !== after[candidate]),
      ).toEqual([key]);
      if (!found.has(key)) points.push({ key, x, y });
      found.add(key);
      return true;
    }
    // Find one actual switch with a coarse native-pointer scan, then inspect
    // only its compact panel neighbourhood instead of rendering hundreds of frames.
    let seed: { x: number; y: number } | undefined;
    for (let y = area.top; y < area.bottom && !seed; y += 24) {
      for (let x = 24; x < area.width - 24 && !seed; x += 24)
        if (await tapPart(x, y)) seed = { x, y };
    }
    if (seed) {
      for (
        let y = Math.max(area.top, seed.y - 12);
        y < Math.min(area.bottom, seed.y + 48) && found.size < 3;
        y += 12
      ) {
        for (
          let x = Math.max(24, seed.x - 96);
          x < Math.min(area.width - 24, seed.x + 96) && found.size < 3;
          x += 8
        )
          await tapPart(x, y);
      }
    }
    await info.attach("touch-switch-points", {
      body: JSON.stringify(points),
      contentType: "application/json",
    });
    expect([...found].sort()).toEqual(["cat", "lights", "sound"]);
  }
});
