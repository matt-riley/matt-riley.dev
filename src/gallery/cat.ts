import {
  Box3,
  Frustum,
  Matrix4,
  type Mesh,
  type MeshStandardMaterial,
  type Object3D,
  Vector3,
} from "three";
import { get } from "../scripts/settings";
import { type CatVisit, chooseCatSpot } from "./cat-state";
import type { ExhibitRegistry } from "./exhibits";

interface Spot {
  name: string;
  stop: number;
  pose: string;
  node: Object3D;
}

export async function mountCat(
  registry: ExhibitRegistry,
  button: HTMLButtonElement,
) {
  const { app } = registry;
  const asset = await app.assets.get("cat");
  if (registry.disposed) return;
  const root = asset.scene;
  const poses = new Map<string, Object3D>();
  for (const pose of ["sit", "loaf", "stretch", "sleep"]) {
    const object = root.getObjectByName(`cat_${pose}`);
    if (!object) throw new Error(`Cat is missing ${pose}`);
    object.visible = false;
    poses.set(pose, object);
  }
  const spots: Spot[] = [];
  app.room.traverse((node) => {
    if (
      /^cat_\d+$/.test(node.name) &&
      Number.isInteger(node.userData.stop) &&
      poses.has(node.userData.pose)
    ) {
      spots.push({
        name: node.name,
        stop: node.userData.stop,
        pose: node.userData.pose,
        node,
      });
    }
  });
  spots.sort((a, b) => Number(a.name.slice(4)) - Number(b.name.slice(4)));
  let visit: CatVisit = {
    random: crypto.getRandomValues(new Uint32Array(1))[0] || 1,
    last: {},
  };
  try {
    const saved = JSON.parse(sessionStorage.getItem("mr-cat-visit") ?? "null");
    if (
      saved &&
      Number.isInteger(saved.random) &&
      saved.last &&
      typeof saved.last === "object" &&
      !Array.isArray(saved.last)
    )
      visit = saved;
  } catch {
    /* A figurine still works without storage. */
  }
  const save = () => {
    try {
      sessionStorage.setItem("mr-cat-visit", JSON.stringify(visit));
    } catch {
      /* Optional. */
    }
  };
  const candidates = (stop: number) => {
    // These two positions belong to the room's full-size plinth/counter.
    const scripted = stop === 7 ? "cat_9" : stop === 8 ? "cat_11" : undefined;
    return spots.filter(
      (spot) => spot.stop === stop && (!scripted || spot.name === scripted),
    );
  };
  const choose = (stop: number) => {
    const options = candidates(stop);
    const name = chooseCatSpot(
      visit,
      stop,
      options.map((spot) => spot.name),
    );
    save();
    return options.find((spot) => spot.name === name) as Spot;
  };
  let spot =
    candidates(app.activeStop).find(
      (candidate) => candidate.name === visit.current,
    ) ?? choose(app.activeStop);
  const materials = new Set<MeshStandardMaterial>();
  root.traverse((object) => {
    const mesh = object as Mesh;
    if (mesh.isMesh)
      for (const material of Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material])
        materials.add(material as MeshStandardMaterial);
  });
  const frustum = new Frustum();
  const matrix = new Matrix4();
  const visible = () => {
    app.camera.updateMatrixWorld();
    frustum.setFromProjectionMatrix(
      matrix.multiplyMatrices(
        app.camera.projectionMatrix,
        app.camera.matrixWorldInverse,
      ),
    );
    return (
      root.visible &&
      frustum.intersectsBox(new Box3().setFromObject(root).expandByScalar(0.08))
    );
  };
  const place = (next: Spot) => {
    spot = next;
    root.position.copy(next.node.getWorldPosition(new Vector3()));
    root.rotation.set(0, next.stop === 7 ? Math.PI : 0, 0);
    const pose =
      next.stop === 7 ? "sit" : next.stop === 8 ? "sleep" : next.pose;
    for (const [name, object] of poses) object.visible = name === pose;
    root.updateMatrixWorld(true);
    document.documentElement.dataset.catSpot = next.name;
    document.documentElement.dataset.catPose = pose;
  };
  place(spot);
  root.visible = get("cat") === "on";
  app.scene.add(root);
  const registration = registry.registerExhibit(
    "cat",
    "cat",
    app.activeStop,
    root,
  );
  registration.record.pickPriority = 100;
  registration.record.draggable = false;
  const stopControl = registry.setControl("cat", "", button);
  const stopHandler = registry.setTouchHandler("cat", () => {});
  let alpha = 1,
    target = 1;
  const opacity = (value: number) => {
    for (const material of materials) {
      const transparent = value < 1;
      if (material.transparent !== transparent) {
        material.transparent = transparent;
        material.needsUpdate = true;
      }
      material.opacity = value;
      material.depthWrite = !transparent;
    }
  };
  const setting = () => {
    if (get("cat") === "off") {
      if (visible()) target = 0;
      else root.visible = false;
    } else {
      if (!root.visible) {
        place(choose(app.activeStop));
        root.visible = true;
        alpha = 0;
        opacity(0);
      }
      target = 1;
    }
    app.requestRender();
  };
  let tip: HTMLElement | undefined;
  let tipTimer: ReturnType<typeof setTimeout> | undefined;
  const hideTip = () => {
    clearTimeout(tipTimer);
    tip?.remove();
    tip = undefined;
  };
  const line = (event: Event) => {
    if (!(event instanceof CustomEvent)) return;
    hideTip();
    tip = document.createElement("span");
    tip.className = "gallery-touch-hint";
    tip.setAttribute("aria-hidden", "true");
    tip.textContent = String(event.detail);
    document.body.append(tip);
    tipTimer = setTimeout(hideTip, 2200);
    app.requestRender();
  };
  let previousStop = app.activeStop;
  let direction = 1;
  const stopFrame = app.onFrame((delta) => {
    registration.record.index = app.activeStop;
    if (app.activeStop !== previousStop) {
      direction = Math.sign(app.activeStop - previousStop);
      previousStop = app.activeStop;
    }
    // Wait ahead of the visitor when possible. In particular, the Human Error
    // plinth must already be occupied before its neighbour enters the view:
    // moving a visible cat between those adjacent exhibits would break the gag.
    const destination =
      app.activeStop >= 7
        ? app.activeStop
        : Math.max(0, Math.min(8, app.activeStop + direction));
    if (
      get("cat") === "on" &&
      root.visible &&
      spot.stop !== app.activeStop &&
      spot.stop !== destination &&
      !visible()
    ) {
      // The previous figurine is outside an expanded frustum before either
      // position or pose changes. A gentle arrival avoids a visible pop if a
      // native hash jump put the destination directly in the new view.
      place(choose(destination));
      if (visible()) {
        alpha = 0;
        opacity(0);
        target = 1;
      }
    }
    if (alpha !== target) {
      alpha +=
        Math.sign(target - alpha) *
        Math.min(Math.abs(target - alpha), delta / 0.3);
      opacity(alpha);
      if (alpha === 0 && target === 0) root.visible = false;
    }
    if (tip) {
      const point = new Box3()
        .setFromObject(root)
        .getCenter(new Vector3())
        .project(app.camera);
      tip.style.left = `${Math.max(12, Math.min(innerWidth - 250, ((point.x + 1) * innerWidth) / 2))}px`;
      tip.style.top = `${Math.max(100, Math.min(innerHeight - 100, ((1 - point.y) * innerHeight) / 2))}px`;
    }
    return alpha !== target;
  });
  document.addEventListener("mr:setting", setting);
  document.addEventListener("mr:cat-line", line);
  app.requestRender();
  return () => {
    stopFrame();
    stopControl();
    stopHandler();
    registration.dispose();
    hideTip();
    document.removeEventListener("mr:setting", setting);
    document.removeEventListener("mr:cat-line", line);
    root.removeFromParent();
    opacity(1);
    delete document.documentElement.dataset.catSpot;
    delete document.documentElement.dataset.catPose;
  };
}
