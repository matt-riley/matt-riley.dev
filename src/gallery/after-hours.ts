import {
  DirectionalLight,
  HemisphereLight,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type Object3D,
  SpotLight,
  Vector2,
  Vector3,
} from "three";
import { onExhibitsReady } from "./exhibit-state";
import type { ExhibitRegistry } from "./exhibits";
import {
  applyNightGlow,
  bindNightShader,
  type NightUniforms,
} from "./night-shader";
import { NightSweep } from "./night-sweep";
import type { GalleryApp } from "./types";

export function mountAfterHours(app: GalleryApp) {
  const root = document.documentElement;
  const night = () => root.dataset.lights === "after-hours";
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const sweep = new NightSweep(night());
  const torch = new SpotLight(0xffefd8, 0, 14, MathUtils.degToRad(22), 0.7, 2);
  torch.name = "visitor-torch";
  // The room retains its baked contact shadows; avoid a second shadow map.
  torch.castShadow = false;
  app.scene.add(torch, torch.target);
  const direction = app.camera.getWorldDirection(new Vector3());
  const desired = direction.clone();
  const position = new Vector3();
  const aim = new Vector3();
  const screen = new Vector3();
  const pointer = new Vector2();
  let hasPointer = false;
  let focused: HTMLElement | undefined;
  let registry: ExhibitRegistry | undefined;
  let low = false;
  const uniforms: NightUniforms = {
    museumFrom: { value: Number(night()) },
    museumTo: { value: Number(night()) },
    museumFront: { value: 1.08 },
    museumLow: { value: 0 },
    museumTorchPosition: { value: torch.position },
    museumTorchDirection: { value: direction },
  };
  const roomMaterials = new Map<MeshBasicMaterial, () => void>();
  function bindRoomMaterial(material: MeshBasicMaterial) {
    if (roomMaterials.has(material)) return;
    const colour = material.color.clone();
    material.color.set(0xffffff);
    const restore = bindNightShader(material, uniforms);
    roomMaterials.set(material, () => {
      restore();
      material.color.copy(colour);
    });
  }
  app.room.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    for (const material of Array.isArray(object.material)
      ? object.material
      : [object.material])
      if (
        material instanceof MeshBasicMaterial &&
        (material.userData.baked_lightmap || object.name === "portrait_plane")
      )
        bindRoomMaterial(material);
  });
  const portrait = app.room.getObjectByName("portrait_plane");
  let portraitMaterial =
    portrait instanceof Mesh ? portrait.material : undefined;
  function refreshPortraitMaterial() {
    if (!(portrait instanceof Mesh) || portrait.material === portraitMaterial)
      return;
    portraitMaterial = portrait.material;
    // E-07 streams its photograph later and replaces this material. Bind that
    // new identity before the frame can reveal an un-dimmed portrait at night.
    for (const material of Array.isArray(portrait.material)
      ? portrait.material
      : [portrait.material])
      if (material instanceof MeshBasicMaterial) bindRoomMaterial(material);
  }
  function collectGlazes(object: Object3D | undefined) {
    const materials = new Set<MeshStandardMaterial>();
    object?.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      for (const material of Array.isArray(child.material)
        ? child.material
        : [child.material])
        if (
          material instanceof MeshStandardMaterial &&
          material.name === "glaze" &&
          !material.userData.touchEmissionOwned
        )
          materials.add(material);
    });
    return materials;
  }
  // Room rope is session-owned; record glazes are released with each model.
  const ropeGlazes = collectGlazes(app.room.getObjectByName("touch_rope"));
  const recordGlazes = new Map<string, Set<MeshStandardMaterial>>();
  const unpublish = onExhibitsReady((current) => {
    registry = current;
    const release = current.onRecord((record) => {
      recordGlazes.set(record.id, collectGlazes(record.root));
      return () => {
        recordGlazes.delete(record.id);
      };
    });
    return () => {
      release();
      registry = undefined;
    };
  });
  const mask = document.createElement("div");
  mask.className = "gallery-torch-mask";
  mask.setAttribute("aria-hidden", "true");
  app.renderer.domElement.parentElement?.append(mask);
  const key = app.scene.getObjectByName("gallery-key");
  const fill = app.scene.getObjectByName("gallery-fill");
  let last = performance.now();
  let previousStep = night() ? 1 : 0;
  function apply(now: number, delta: number) {
    refreshPortraitMaterial();
    const state = sweep.sample(now);
    uniforms.museumFrom.value = state.from;
    uniforms.museumTo.value = state.to;
    uniforms.museumFront.value = state.front;
    low = root.dataset.galleryQuality === "low";
    uniforms.museumLow.value = Number(low);
    torch.visible = !low;
    torch.intensity = state.amount * 22;
    if (key instanceof DirectionalLight) {
      key.intensity = low ? 3 : 3 * (1 - state.amount);
      key.shadow.autoUpdate = state.amount < 0.999 || low;
      if (previousStep >= 0.999 && state.amount < 0.999)
        key.shadow.needsUpdate = true;
    }
    if (fill instanceof HemisphereLight)
      fill.intensity = low
        ? 1.5
        : 1.5 * (1 - state.amount) + 0.025 * state.amount;
    previousStep = state.amount;
    app.camera.getWorldPosition(position);
    torch.position.copy(position);
    if (hasPointer) {
      desired
        .set(pointer.x, pointer.y, 0.5)
        .unproject(app.camera)
        .sub(position)
        .normalize();
    } else {
      const model =
        focused?.closest<HTMLElement>("[data-model]")?.dataset.model;
      const section = focused?.closest<HTMLElement>("section[data-exhibit]");
      const record = model
        ? registry?.records.get(model)
        : [...(registry?.records.values() ?? [])].find(
            (record) =>
              record.id !== "cat" &&
              (section
                ? record.stop === section.id
                : record.index === app.activeStop),
          );
      if (record) registry?.bounds(record).getCenter(aim);
      else
        app.room
          .getObjectByName(`stop_${app.activeStop}_target`)
          ?.getWorldPosition(aim);
      if (!reduced.matches) {
        aim.x += Math.sin(now / 1800) * 0.09;
        aim.y += Math.sin(now / 900) * 0.045;
      }
      desired.copy(aim).sub(position).normalize();
    }
    direction
      .lerp(desired, 1 - Math.exp(-Math.min(delta, 0.1) * 10))
      .normalize();
    torch.target.position.copy(position).addScaledVector(direction, 10);
    screen.copy(position).addScaledVector(direction, 5).project(app.camera);
    mask.style.setProperty(
      "--torch-x",
      `${((screen.x + 1) * innerWidth) / 2}px`,
    );
    mask.style.setProperty(
      "--torch-y",
      `${((1 - screen.y) * innerHeight) / 2}px`,
    );
    mask.style.opacity = String(low ? state.amount : 0);
    const glow =
      state.amount *
      (reduced.matches
        ? 0.024
        : 0.024 * (0.86 + Math.sin((now * Math.PI) / 3000) * 0.14));
    for (const material of ropeGlazes) applyNightGlow(material, glow);
    for (const materials of recordGlazes.values())
      for (const material of materials) applyNightGlow(material, glow);
    return state.moving || (state.amount > 0 && !reduced.matches);
  }
  function setting(event: Event) {
    if ((event as CustomEvent<{ key: string }>).detail?.key !== "lights")
      return;
    const now = performance.now();
    sweep.setNight(night(), now);
    for (const material of roomMaterials.keys()) material.color.set(0xffffff);
    apply(now, 0);
    app.requestRender();
  }
  function pointerMove(event: PointerEvent) {
    hasPointer = event.pointerType !== "touch";
    pointer.set(
      (event.clientX / innerWidth) * 2 - 1,
      1 - (event.clientY / innerHeight) * 2,
    );
    if (night()) app.requestRender();
  }
  function pointerLeave() {
    hasPointer = false;
    if (night()) app.requestRender();
  }
  function focus(event: FocusEvent) {
    focused =
      event.target instanceof HTMLElement &&
      event.target.closest("[data-touch]")
        ? event.target
        : undefined;
    if (focused) hasPointer = false;
    if (night()) app.requestRender();
  }
  function keyboard(event: KeyboardEvent) {
    if (event.key === "Tab") hasPointer = false;
  }
  document.addEventListener("mr:setting", setting);
  document.addEventListener("pointermove", pointerMove, { passive: true });
  document.documentElement.addEventListener("pointerleave", pointerLeave);
  document.addEventListener("focusin", focus);
  document.addEventListener("keydown", keyboard);
  const offFrame = app.onFrame(() => {
    const now = performance.now();
    const again = apply(now, (now - last) / 1000);
    last = now;
    return again;
  });
  apply(last, 1);
  return () => {
    offFrame();
    unpublish();
    document.removeEventListener("mr:setting", setting);
    document.removeEventListener("pointermove", pointerMove);
    document.documentElement.removeEventListener("pointerleave", pointerLeave);
    document.removeEventListener("focusin", focus);
    document.removeEventListener("keydown", keyboard);
    roomMaterials.forEach((restore) => {
      restore();
    });
    roomMaterials.clear();
    recordGlazes.clear();
    ropeGlazes.clear();
    torch.removeFromParent();
    torch.target.removeFromParent();
    mask.remove();
  };
}
