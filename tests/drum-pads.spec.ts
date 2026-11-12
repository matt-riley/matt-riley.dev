import { expect, test } from "@playwright/test";
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from "three";
import { mountDrumPads } from "../src/gallery/drum-pads";
import type { ExhibitRecord, ExhibitRegistry } from "../src/gallery/exhibits";
import type { Part } from "../src/gallery/parts";

test("drum pads follow the selected row, dip within their range and release cloned materials", () => {
  test.skip(
    test.info().project.name !== "desktop-chromium",
    "The adapter uses real scene objects without a renderer.",
  );
  const previous = Object.getOwnPropertyDescriptor(globalThis, "document"),
    events = new EventTarget();
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: events,
  });
  const root = new Group(),
    glaze = new MeshStandardMaterial({ color: 0xe8741a });
  glaze.name = "glaze";
  const parts = new Map<string, Part>();
  for (let step = 0; step < 16; step++) {
    const part = Object.assign(new Group(), {
      userData: {
        axis: "y" as const,
        kind: "slide" as const,
        range: [-0.003, 0] as [number, number],
      },
    });
    part.name = `touch_pad_${step}`;
    part.userData = { axis: "y", kind: "slide", range: [-0.003, 0] };
    part.position.y = 0.012;
    part.add(new Mesh(new BoxGeometry(0.01, 0.003, 0.01), glaze));
    root.add(part);
    parts.set(part.name, part);
  }
  const record: ExhibitRecord = {
    id: "boom-bap",
    stop: "human-error",
    index: 7,
    root,
    section: {} as HTMLElement,
    parts,
    glaze: new Set([glaze]),
    basePosition: root.position.clone(),
    owned: true,
    draggable: true,
    pickPriority: 0,
  };
  const frames = new Set<(delta: number) => boolean>(),
    controls = new Map<string, HTMLElement>(),
    hitAreas = new Map<string, number>();
  const app = {
    activeStop: 7,
    requestRender() {},
    onFrame(frame: (delta: number) => boolean) {
      frames.add(frame);
      return () => {
        frames.delete(frame);
      };
    },
  };
  const registry = {
    app,
    onRecord(mount: (value: ExhibitRecord) => (() => void) | undefined) {
      const release = mount(record);
      return () => {
        release?.();
      };
    },
    setControl(id: string, part: string, button: HTMLElement) {
      const key = `${id}:${part}`;
      controls.set(key, button);
      return () => {
        controls.delete(key);
      };
    },
    setPartHitArea(id: string, part: string, pixels: number) {
      const key = `${id}:${part}`;
      hitAreas.set(key, pixels);
      return () => {
        hitAreas.delete(key);
      };
    },
    setDraggable(_id: string, value: boolean) {
      const old = record.draggable;
      record.draggable = value;
      return () => {
        record.draggable = old;
      };
    },
    setTouchHandler() {
      return () => {};
    },
  };
  let state = {
    pattern: {
      rows: [1, 2, 4, 8] as [number, number, number, number],
      tempo: 88,
      swing: 58,
    },
    selectedRow: 0,
    playhead: -1,
  };
  const tick = (delta: number) =>
    frames.forEach((frame) => {
      frame(delta);
    });
  try {
    // Gallery boot synchronizes glaze emission before feature listeners run.
    const syncLights = (event: Event) => {
      if ((event as CustomEvent).detail?.key !== "lights") return;
      root.traverse((object) => {
        const mesh = object as Mesh;
        if (!mesh.isMesh) return;
        for (const material of Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material])
          if (
            material instanceof MeshStandardMaterial &&
            material.name.startsWith("glaze")
          )
            material.emissive
              .copy(material.color)
              .multiplyScalar(
                (event as CustomEvent).detail.value === "after-hours"
                  ? 0.035
                  : 0,
              );
      });
    };
    events.addEventListener("mr:setting", syncLights);
    const release = mountDrumPads(
      registry as unknown as ExhibitRegistry,
      () => state,
      (row, step) => ({ row, step }) as unknown as HTMLElement,
    );
    const pads = [...parts.values()],
      materials = pads.map(
        (part) => (part.children[0] as Mesh).material as MeshStandardMaterial,
      );
    expect(materials[0]).not.toBe(glaze);
    expect(materials[0].emissiveIntensity).toBe(0.025);
    expect(materials[1].emissiveIntensity).toBe(0);
    expect(hitAreas.size).toBe(16);
    expect([...hitAreas.values()].every((value) => value === 44)).toBe(true);
    expect(record.draggable).toBe(false);
    state = { ...state, selectedRow: 1, playhead: 5 };
    events.dispatchEvent(new Event("mr:drum-state"));
    expect(
      (controls.get("boom-bap:touch_pad_0") as unknown as { row: number }).row,
    ).toBe(1);
    expect(materials[0].emissiveIntensity).toBe(0);
    expect(materials[1].emissiveIntensity).toBe(0.025);
    expect(materials[5].emissiveIntensity).toBe(0.22);
    for (const value of ["day", "after-hours", "day"]) {
      events.dispatchEvent(
        new CustomEvent("mr:setting", { detail: { key: "lights", value } }),
      );
      expect(materials[1].emissive.getHex()).toBe(0xe8741a);
      expect(materials[1].emissiveIntensity).toBe(0.025);
      expect(materials[5].emissive.getHex()).toBe(0xe8741a);
      expect(materials[5].emissiveIntensity).toBe(0.22);
    }
    events.dispatchEvent(
      new CustomEvent("mr:touch", {
        detail: { model: "boom-bap", part: "touch_pad_2" },
      }),
    );
    tick(0.02);
    expect(pads[2].position.y).toBeLessThan(0.012);
    expect(pads[2].position.y).toBeGreaterThanOrEqual(0.009);
    tick(0.2);
    expect(pads[2].position.y).toBe(0.012);
    let disposed = 0;
    materials.forEach((material) => {
      material.addEventListener("dispose", () => {
        disposed++;
      });
    });
    release();
    expect(disposed).toBe(16);
    materials[1].emissive.setHex(0);
    events.dispatchEvent(
      new CustomEvent("mr:setting", {
        detail: { key: "lights", value: "day" },
      }),
    );
    expect(materials[1].emissive.getHex()).toBe(0);
    events.removeEventListener("mr:setting", syncLights);
    expect(frames.size).toBe(0);
    expect(controls.size).toBe(0);
    expect(hitAreas.size).toBe(0);
    expect(record.draggable).toBe(true);
    expect(record.glaze.size).toBe(1);
    expect((pads[0].children[0] as Mesh).material).toBe(glaze);
  } finally {
    root.traverse((object) => {
      if ((object as Mesh).isMesh) (object as Mesh).geometry.dispose();
    });
    glaze.dispose();
    if (previous) Object.defineProperty(globalThis, "document", previous);
    else Reflect.deleteProperty(globalThis, "document");
  }
});
