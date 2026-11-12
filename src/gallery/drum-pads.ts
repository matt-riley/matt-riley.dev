import type { Material, Mesh, MeshStandardMaterial } from "three";
import type { DrumPattern } from "../scripts/drum-pattern";
import type { ExhibitRegistry } from "./exhibits";
import type { Part } from "./parts";

interface PadState {
  pattern: DrumPattern;
  selectedRow: number;
  playhead: number;
}

/** This adapter imports types only; the gallery already owns the actual objects. */
export function mountDrumPads(
  registry: ExhibitRegistry,
  read: () => PadState,
  control: (row: number, step: number) => HTMLElement | undefined,
) {
  return registry.onRecord((record) => {
    if (record.id !== "boom-bap") return;
    const app = registry.app,
      bases = new Map<Part, number>(),
      pulses = new Map<Part, number>();
    const materials = new Map<number, MeshStandardMaterial[]>(),
      originals: { mesh: Mesh; material: Material | Material[] }[] = [],
      clones: Material[] = [];
    let controls: (() => void)[] = [],
      selected = -1;
    for (let step = 0; step < 16; step++) {
      const part = record.parts.get(`touch_pad_${step}`);
      if (!part) continue;
      const target =
        part.userData.kind === "hinge" ? part.rotation : part.position;
      bases.set(part, target[part.userData.axis]);
      const padMaterials: MeshStandardMaterial[] = [];
      part.traverse((object) => {
        const mesh = object as Mesh;
        if (!mesh.isMesh) return;
        const original = mesh.material,
          list = Array.isArray(original) ? original : [original];
        const copies = list.map((material) => material.clone());
        originals.push({ mesh, material: original });
        clones.push(...copies);
        mesh.material = Array.isArray(original) ? copies : copies[0];
        for (const material of copies)
          if ((material as MeshStandardMaterial).isMeshStandardMaterial) {
            const standard = material as MeshStandardMaterial;
            standard.emissive.setHex(0xe8741a);
            padMaterials.push(standard);
            if (standard.name === "glaze") record.glaze.add(standard);
          }
      });
      materials.set(step, padMaterials);
    }
    function update() {
      const state = read();
      if (selected !== state.selectedRow) {
        controls.forEach((release) => {
          release();
        });
        controls = [];
        selected = state.selectedRow;
        for (let step = 0; step < 16; step++) {
          const button = control(selected, step);
          if (button)
            controls.push(
              registry.setControl(record.id, `touch_pad_${step}`, button),
              registry.setPartHitArea(record.id, `touch_pad_${step}`, 44),
            );
        }
      }
      for (const [step, list] of materials)
        for (const material of list) {
          // The gallery lighting pass also visits glaze clones. Restore the
          // instrument colour along with its pattern/playhead state.
          material.emissive.setHex(0xe8741a);
          material.emissiveIntensity =
            state.playhead === step
              ? 0.22
              : state.pattern.rows[state.selectedRow] & (1 << step)
                ? 0.025
                : 0;
        }
      if (app.activeStop === 7) app.requestRender();
    }
    function pulse(step: number) {
      if (app.activeStop !== 7) return;
      const part = record.parts.get(`touch_pad_${step}`);
      if (part) {
        pulses.set(part, 0);
        app.requestRender();
      }
    }
    const touched = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.model !== "boom-bap") return;
      const match = /^touch_pad_(\d+)$/.exec(detail.part ?? "");
      if (match) pulse(Number(match[1]));
    };
    const stepped = (event: Event) => {
      const step = (event as CustomEvent).detail?.step;
      const state = read();
      if (
        Number.isInteger(step) &&
        state.pattern.rows[state.selectedRow] & (1 << step)
      )
        pulse(step);
    };
    const setting = (event: Event) => {
      if ((event as CustomEvent).detail?.key === "lights") update();
    };
    // Boot installs its lighting listener before publishing gallery readiness,
    // so this listener restores feature-owned emission after the shared pass.
    document.addEventListener("mr:setting", setting);
    document.addEventListener("mr:drum-state", update);
    document.addEventListener("mr:touch", touched);
    document.addEventListener("mr:drum-step", stepped);
    const releaseFrame = app.onFrame((delta) => {
      for (const [part, previous] of pulses) {
        const age = Math.min(0.18, previous + delta),
          fraction = age < 0.036 ? 1 - age / 0.036 : (age - 0.036) / 0.144;
        const { axis, kind, range } = part.userData,
          target = kind === "hinge" ? part.rotation : part.position;
        target[axis] =
          (bases.get(part) ?? 0) + range[0] + (range[1] - range[0]) * fraction;
        if (age >= 0.18) pulses.delete(part);
        else pulses.set(part, age);
      }
      return pulses.size > 0;
    });
    const releaseDrag = registry.setDraggable(record.id, false),
      releaseTouch = registry.setTouchHandler(record.id, () => {});
    update();
    return () => {
      document.removeEventListener("mr:setting", setting);
      document.removeEventListener("mr:drum-state", update);
      document.removeEventListener("mr:touch", touched);
      document.removeEventListener("mr:drum-step", stepped);
      releaseFrame();
      releaseDrag();
      releaseTouch();
      controls.forEach((release) => {
        release();
      });
      for (const [part, base] of bases)
        (part.userData.kind === "hinge" ? part.rotation : part.position)[
          part.userData.axis
        ] = base;
      originals.forEach(({ mesh, material }) => {
        mesh.material = material;
      });
      clones.forEach((material) => {
        record.glaze.delete(material as MeshStandardMaterial);
        material.dispose();
      });
    };
  });
}
