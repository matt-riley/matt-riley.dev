import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { Box3, Vector3 } from "three";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const models: Record<string, string[]> = {
  tools: ["tray_left", "tray_right", "drawer"],
  flagz: [
    "switch_lights",
    "switch_cat",
    "switch_sound",
    "flag_lights",
    "flag_cat",
    "flag_sound",
  ],
  "waffle-agent": ["cursor"],
  "agent-skills": [
    "drawer",
    ...Array.from({ length: 8 }, (_, i) => `card_${i}`),
  ],
  waystone: ["marker"],
};

for (const [id, touchParts] of Object.entries(models)) {
  test(`${id} ships a complete small model with its authored interaction pivots`, async ({
    browserName,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium" ||
        browserName !== "chromium",
      "The model files are shared by all browser projects.",
    );
    const bytes = readFileSync(`public/models/${id}.glb`);
    expect(bytes.length).toBeLessThanOrEqual(120_000);
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const gltf = await loader.parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      "",
    );
    const root = gltf.scene.getObjectByName(`exhibit_${id}`);
    expect(root).toBeDefined();
    if (!root) return;
    gltf.scene.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(root);
    const size = bounds.getSize(new Vector3());
    expect(Math.max(size.x, size.y, size.z)).toBeLessThanOrEqual(0.501);
    expect(bounds.min.y).toBeGreaterThanOrEqual(-0.001);
    expect(root.position.length()).toBeLessThan(0.001);
    let triangles = 0;
    root.traverse((object) => {
      if (!("isMesh" in object) || !object.isMesh || !("geometry" in object))
        return;
      const mesh = object as import("three").Mesh;
      triangles +=
        (mesh.geometry.index?.count ??
          mesh.geometry.attributes.position.count) / 3;
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      for (const material of materials) {
        expect(["porcelain", "glaze"]).toContain(material.name);
        expect(
          (material as import("three").MeshStandardMaterial).map,
        ).toBeNull();
      }
    });
    expect(triangles).toBeGreaterThan(0);
    expect(triangles).toBeLessThanOrEqual(15_000);
    for (const part of touchParts) {
      const pivot = root.getObjectByName(`touch_${part}`);
      expect(pivot, `Missing ${id}:touch_${part}`).toBeDefined();
      if (!pivot) continue;
      expect(["x", "y", "z"]).toContain(pivot.userData.axis);
      expect(["hinge", "slide"]).toContain(pivot.userData.kind);
      expect(pivot.userData.range).toHaveLength(2);
      expect(pivot.userData.range.every(Number.isFinite)).toBe(true);
    }
  });
}
