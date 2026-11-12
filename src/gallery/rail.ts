import {
  Box3,
  CatmullRomCurve3,
  MathUtils,
  type Object3D,
  type PerspectiveCamera,
  Vector3,
} from "three";
import { resolveStopTarget } from "./rail-state";

interface Stop {
  camera: Vector3;
  target: Vector3;
  framing: number;
}

/** Logical positions 0…8 follow the authored stops, not distance along the curve. */
export class CameraRail {
  readonly length = 9;
  private readonly stops: Stop[];
  private readonly cameraCurve: CatmullRomCurve3;
  private readonly targetCurve: CatmullRomCurve3;

  constructor(room: Object3D) {
    room.updateWorldMatrix(true, true);
    this.stops = Array.from({ length: this.length }, (_, index) => {
      const camera = room.getObjectByName(`stop_${index}_cam`);
      const target = room.getObjectByName(`stop_${index}_target`);
      if (!camera) throw new Error(`Gallery rail is missing stop_${index}_cam`);
      if (!target)
        throw new Error(`Gallery rail is missing stop_${index}_target`);
      const side = camera.userData.placard_side;
      if (side !== "left" && side !== "right") {
        throw new Error(`stop_${index}_cam needs placard_side left or right`);
      }
      return {
        camera: camera.getWorldPosition(new Vector3()),
        target: target.getWorldPosition(new Vector3()),
        framing: side === "left" ? -1 : 1,
      };
    });
    this.cameraCurve = new CatmullRomCurve3(
      this.stops.map((stop) => stop.camera),
    );
    this.targetCurve = new CatmullRomCurve3(
      this.stops.map((stop) => stop.target),
    );
  }

  sample(position: number) {
    const bounded = MathUtils.clamp(position, 0, this.length - 1);
    const first = Math.min(Math.floor(bounded), this.length - 2);
    const fraction = bounded - first;
    // Each stop holds for 20% on either side: 40% of a section's scroll.
    const moving = MathUtils.clamp((fraction - 0.2) / 0.6, 0, 1);
    const eased = moving * moving * (3 - 2 * moving);
    const progress = (first + eased) / (this.length - 1);
    return {
      position: first + eased,
      camera: this.cameraCurve.getPoint(progress),
      target: this.targetCurve.getPoint(progress),
      stop: Math.round(bounded),
      framing: MathUtils.lerp(
        this.stops[first].framing,
        this.stops[first + 1].framing,
        eased,
      ),
    };
  }
}

export interface RailHost {
  camera: import("three").PerspectiveCamera;
  room: Object3D;
  renderer: { domElement: HTMLCanvasElement };
  activeStop: number;
  requestRender(): void;
  onFrame(callback: (deltaSeconds: number) => boolean): () => void;
  onResize(callback: () => void): () => void;
}

const stopIds = [
  "entrance",
  "tools",
  "flagz",
  "waffle-agent",
  "agent-skills",
  "waystone",
  "acquisitions",
  "human-error",
  "gift-shop",
];

function nativeProgress(centre: number, centres: readonly number[]) {
  if (centre <= centres[0]) return 0;
  for (let index = 1; index < centres.length; index++) {
    if (centre <= centres[index]) {
      return (
        index -
        1 +
        (centre - centres[index - 1]) /
          Math.max(1, centres[index] - centres[index - 1])
      );
    }
  }
  return centres.length - 1;
}

function framingBounds(room: Object3D) {
  const from = (name: string) => {
    const object = room.getObjectByName(name);
    return object ? new Box3().setFromObject(object) : new Box3();
  };
  const model = (name: string) => {
    const anchor = room.getObjectByName(`anchor_${name}`);
    if (!anchor) throw new Error(`Gallery framing needs anchor_${name}`);
    const point = anchor.getWorldPosition(new Vector3());
    // Every authored exhibit fits inside the brief's 0.5m cube, base at Y=0.
    return new Box3(
      point.clone().add(new Vector3(-0.25, 0, -0.25)),
      point.clone().add(new Vector3(0.25, 0.5, 0.25)),
    );
  };
  const entrance = from("title_wall");
  for (const name of [
    "touch_rope",
    "rope_post_0",
    "rope_post_1",
    "rope_foot_0",
    "rope_foot_1",
  ])
    entrance.union(from(name));
  const bounds = [entrance];
  for (const id of stopIds.slice(1, 6))
    bounds.push(model(id).union(from(`plinth_${id}`)));
  bounds.push(from("acquisitions_frame_back"));
  const human = from("portrait_plane");
  for (const name of ["open-mic", "boom-bap", "absent"])
    human.union(model(name)).union(from(`plinth_${name}`));
  bounds.push(human);
  bounds.push(
    model("gift-shop")
      .union(from("gift_shop_shelf"))
      .union(from("gift_shop_counter")),
  );
  if (bounds.some((box) => box.isEmpty()))
    throw new Error(
      "Gallery framing needs the title wall and acquisitions frame",
    );
  return bounds;
}

function projectBox(
  box: Box3,
  camera: PerspectiveCamera,
  width: number,
  height: number,
) {
  let left = Infinity,
    right = -Infinity,
    top = Infinity,
    bottom = -Infinity;
  const point = new Vector3();
  for (const x of [box.min.x, box.max.x])
    for (const y of [box.min.y, box.max.y])
      for (const z of [box.min.z, box.max.z]) {
        point.set(x, y, z).project(camera);
        const screenX = ((point.x + 1) * width) / 2;
        const screenY = ((1 - point.y) * height) / 2;
        left = Math.min(left, screenX);
        right = Math.max(right, screenX);
        top = Math.min(top, screenY);
        bottom = Math.max(bottom, screenY);
      }
  return {
    left,
    right,
    top,
    bottom,
    width: right - left,
    height: bottom - top,
  };
}

/** Passive listeners wake the host; the host owns the only render loop. */
export function mountRail(app: RailHost) {
  const rail = new CameraRail(app.room);
  const bounds = framingBounds(app.room);
  const frameBox = new Box3();
  const baseFov = app.camera.fov;
  const sections = stopIds.map((id) => {
    const section = document.getElementById(id);
    if (!section)
      throw new Error(`Gallery rail needs the #${id} catalogue section`);
    return section;
  });
  const titleSource = sections[0].querySelector<HTMLElement>("h1");
  const boardSource = sections[6].querySelector<HTMLElement>(".flap-list");
  const titleWall = app.room.getObjectByName("title_wall");
  const boardFrame = app.room.getObjectByName("acquisitions_frame_back");
  if (!titleSource || !boardSource || !titleWall || !boardFrame) {
    throw new Error(
      "Gallery rail needs the semantic wall title, acquisitions board and matching room planes",
    );
  }
  // Keep the last printed photograph at its painted rectangle while the live
  // camera fades in. Taking the real figure out of flow must not make it jump.
  const handover = document.createElement("div");
  handover.className = "gallery-photo-handover";
  handover.setAttribute("aria-hidden", "true");
  handover.inert = true;
  for (const source of document.querySelectorAll<HTMLImageElement>(
    ".exhibit__figure img",
  )) {
    const rect = source.getBoundingClientRect();
    if (
      !source.complete ||
      !source.naturalWidth ||
      rect.width <= 0 ||
      rect.height <= 0 ||
      rect.bottom <= 0 ||
      rect.top >= innerHeight
    )
      continue;
    const image = document.createElement("img");
    image.src = source.currentSrc || source.src;
    image.alt = "";
    image.style.cssText = `left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px`;
    handover.append(image);
  }
  handover.addEventListener("animationend", () => handover.remove(), {
    once: true,
  });
  if (handover.childElementCount) document.body.append(handover);
  const overlay = document.createElement("div");
  overlay.className = "gallery-projections";
  overlay.setAttribute("aria-hidden", "true");
  overlay.inert = true;
  const title = document.createElement("div");
  title.className = "gallery-projection gallery-wall-title";
  title.textContent = titleSource.textContent;
  title.hidden = true;
  const board = document.createElement("div");
  board.className = "gallery-projection gallery-wall-board";
  board.hidden = true;
  overlay.append(title, board);
  document.body.append(overlay);
  titleSource.classList.add("gallery-wall-source");
  const titleBox = new Box3().setFromObject(titleWall);
  const boardBox = new Box3().setFromObject(boardFrame);
  let boardDirty = true;
  const labels = sections.map((section) =>
    section.querySelector<HTMLElement>(".exhibit__label"),
  );
  const originals = labels.map((label) => ({
    side: label?.dataset.placardSide,
    height: label?.style.getPropertyValue("--placard-height"),
  }));
  labels.forEach((label, index) => {
    if (label)
      label.dataset.placardSide =
        rail.sample(index).framing < 0 ? "left" : "right";
  });
  let centres: number[] = [];
  let measureNeeded = true;
  let firstFrame = true;
  let disposed = false;
  let age = 1;
  let progress = 0;
  let goal = 0;
  let pointerX = 0,
    pointerY = 0,
    goalX = 0,
    goalY = 0;
  const fine = matchMedia("(hover: hover) and (pointer: fine)");
  const fragment = () =>
    location.hash.startsWith("#boom=") ? "#human-error" : location.hash;
  const hashIndex = sections.findIndex(
    (section) => `#${section.id}` === fragment(),
  );
  const originalCentres = sections.map(
    (section) =>
      section.getBoundingClientRect().top +
      scrollY +
      section.getBoundingClientRect().height / 2,
  );
  let initialProgress =
    hashIndex >= 0
      ? hashIndex
      : nativeProgress(scrollY + innerHeight / 2, originalCentres);
  progress = goal = initialProgress;
  const initial = rail.sample(initialProgress);
  app.camera.position.copy(initial.camera);
  app.camera.lookAt(initial.target);
  app.activeStop = initial.stop;

  function wake() {
    if (disposed) return;
    age = 0;
    app.requestRender();
  }
  function measure() {
    labels.forEach((label) => {
      if (label)
        label.style.setProperty(
          "--placard-height",
          `${label.getBoundingClientRect().height}px`,
        );
    });
    centres = sections.map((section) => {
      const rect = section.getBoundingClientRect();
      return rect.top + scrollY + rect.height / 2;
    });
    measureNeeded = false;
  }

  function scroll() {
    if (measureNeeded) measure();
    goal = nativeProgress(scrollY + innerHeight / 2, centres);
    wake();
  }
  function resize() {
    measureNeeded = true;
    wake();
  }
  function pointer(event: PointerEvent) {
    if (!fine.matches || event.pointerType === "touch") return;
    const x = (event.clientX / innerWidth) * 2 - 1;
    const y = (event.clientY / innerHeight) * 2 - 1;
    const length = Math.max(1, Math.hypot(x, y));
    goalX = x / length;
    goalY = y / length;
    wake();
  }
  function leave() {
    goalX = goalY = 0;
    wake();
  }
  function hash() {
    const section = sections.find((section) => `#${section.id}` === fragment());
    if (firstFrame && section) initialProgress = sections.indexOf(section);
    section?.scrollIntoView({ block: "center", behavior: "smooth" });
  }
  const boardChanges = new MutationObserver(() => {
    boardDirty = true;
    if (app.activeStop === 6) wake();
  });
  boardChanges.observe(boardSource, {
    subtree: true,
    childList: true,
    characterData: true,
  });
  function paintProjection(
    element: HTMLElement,
    box: Box3,
    stop: number,
    inset = 0,
  ) {
    element.hidden = app.activeStop !== stop;
    if (element.hidden) return;
    const rect = projectBox(box, app.camera, innerWidth, innerHeight);
    const trimX = rect.width * inset,
      trimY = rect.height * inset;
    const width = rect.width - trimX * 2,
      height = rect.height - trimY * 2;
    if (
      width <= 0 ||
      height <= 0 ||
      rect.right < 0 ||
      rect.left > innerWidth ||
      rect.bottom < 0 ||
      rect.top > innerHeight
    ) {
      element.hidden = true;
      return;
    }
    element.style.left = `${rect.left + trimX}px`;
    element.style.top = `${rect.top + trimY}px`;
    element.style.width = `${width}px`;
    element.style.height = `${height}px`;
    element.style.fontSize = `${stop === 0 ? Math.min(width / 12, height / 3.6) : Math.max(9, Math.min(18, width / 38, height / 10))}px`;
  }
  const sizes = new ResizeObserver(resize);
  labels.forEach((label) => {
    if (label) sizes.observe(label);
  });
  window.addEventListener("scroll", scroll, { passive: true });
  window.addEventListener("hashchange", hash);
  window.addEventListener("pointermove", pointer, { passive: true });
  document.documentElement.addEventListener("pointerleave", leave);
  fine.addEventListener("change", leave);
  const offResize = app.onResize(resize);
  const offFrame = app.onFrame((delta) => {
    if (disposed || document.documentElement.dataset.gallery !== "ready")
      return false;
    if (measureNeeded) measure();
    if (firstFrame) {
      // Native fragment scrolling may have measured the catalogue while assets loaded.
      // Always measure again after gallery CSS has activated.
      measure();
      // Enhancement changes section heights. Preserve the visitor's logical stop.
      const first = Math.min(Math.floor(initialProgress), centres.length - 2);
      const position = MathUtils.lerp(
        centres[first],
        centres[first + 1],
        initialProgress - first,
      );
      window.scrollTo({ top: position - innerHeight / 2, behavior: "instant" });
      firstFrame = false;
      goal = progress = initialProgress;
    }
    const elapsed = Math.min(Math.max(delta, 0), 0.1);
    age += elapsed;
    const follow = 1 - Math.exp(-elapsed / 0.08);
    progress = MathUtils.lerp(progress, goal, follow);
    pointerX = MathUtils.lerp(pointerX, goalX, follow);
    pointerY = MathUtils.lerp(pointerY, goalY, follow);
    const moving =
      Math.abs(progress - goal) +
        Math.abs(pointerX - goalX) +
        Math.abs(pointerY - goalY) >
        0.0001 && age < 0.6;
    if (!moving) {
      progress = goal;
      pointerX = goalX;
      pointerY = goalY;
    }
    const sample = rail.sample(progress);
    const first = Math.min(Math.floor(sample.position), bounds.length - 2);
    const fraction = sample.position - first;
    frameBox.min.copy(bounds[first].min).lerp(bounds[first + 1].min, fraction);
    frameBox.max.copy(bounds[first].max).lerp(bounds[first + 1].max, fraction);
    const adaptation = resolveStopTarget(Math.round(progress), {
      sectionProgress: MathUtils.clamp(
        progress - Math.round(progress) + 0.5,
        0,
        1,
      ),
      defaultTarget: sample.target.clone(),
      defaultBounds: frameBox.clone(),
      room: app.room,
    });
    if (adaptation?.bounds) frameBox.copy(adaptation.bounds);

    app.camera.position.copy(sample.camera);
    app.camera.lookAt(adaptation?.target ?? sample.target);
    app.camera.rotateY(-pointerX * MathUtils.degToRad(1.5));
    app.camera.rotateX(-pointerY * MathUtils.degToRad(1.5));
    app.activeStop = Math.round(goal);
    const width = innerWidth,
      height = innerHeight;
    const card = labels[app.activeStop]?.getBoundingClientRect();
    const header =
      document.querySelector(".site-header")?.getBoundingClientRect().bottom ??
      0;
    const clear =
      width < 900
        ? {
            left: 12,
            right: width - 12,
            top: header + 12,
            bottom: height - (card?.height ?? height * 0.45) - 12,
          }
        : {
            left: 24 + ((1 - sample.framing) * ((card?.width ?? 416) + 24)) / 2,
            right:
              width -
              24 -
              ((1 + sample.framing) * ((card?.width ?? 416) + 24)) / 2,
            top: header + 16,
            bottom: height - 16,
          };
    app.camera.fov = baseFov;
    app.camera.clearViewOffset();
    app.camera.updateMatrixWorld(true);
    let projected = projectBox(frameBox, app.camera, width, height);
    const zoom = Math.max(
      1,
      projected.width / Math.max(1, clear.right - clear.left),
      projected.height / Math.max(1, clear.bottom - clear.top),
    );
    if (zoom > 1) {
      app.camera.fov = Math.min(
        110,
        MathUtils.radToDeg(
          2 *
            Math.atan(Math.tan(MathUtils.degToRad(baseFov) / 2) * zoom * 1.06),
        ),
      );
      app.camera.updateProjectionMatrix();
      projected = projectBox(frameBox, app.camera, width, height);
    }
    const centreX = (projected.left + projected.right) / 2;
    const centreY = (projected.top + projected.bottom) / 2;
    const targetX =
      width < 900
        ? (clear.left + clear.right) / 2
        : MathUtils.clamp(
            centreX,
            clear.left + projected.width / 2,
            clear.right - projected.width / 2,
          );
    const targetY =
      width < 900
        ? (clear.top + clear.bottom) / 2
        : MathUtils.clamp(
            centreY,
            clear.top + projected.height / 2,
            clear.bottom - projected.height / 2,
          );
    app.camera.setViewOffset(
      width,
      height,
      centreX - targetX,
      centreY - targetY,
      width,
      height,
    );
    if (boardDirty && app.activeStop === 6) {
      board.replaceChildren(
        ...[...boardSource.querySelectorAll(".flap-copy")].map((source) => {
          const row = document.createElement("div");
          row.className = "gallery-board-row";
          row.textContent = source.textContent;
          return row;
        }),
      );
      boardDirty = false;
    }
    paintProjection(title, titleBox, 0, 0.04);
    paintProjection(board, boardBox, 6, 0.025);
    return moving;
  });
  app.requestRender();

  return () => {
    if (disposed) return;
    disposed = true;
    offFrame();
    offResize();
    sizes.disconnect();
    window.removeEventListener("scroll", scroll);
    window.removeEventListener("hashchange", hash);
    boardChanges.disconnect();
    overlay.remove();
    handover.remove();
    titleSource.classList.remove("gallery-wall-source");
    window.removeEventListener("pointermove", pointer);
    document.documentElement.removeEventListener("pointerleave", leave);
    fine.removeEventListener("change", leave);
    labels.forEach((label, index) => {
      if (!label) return;
      if (originals[index].side === undefined) delete label.dataset.placardSide;
      else label.dataset.placardSide = originals[index].side;
      if (originals[index].height)
        label.style.setProperty("--placard-height", originals[index].height);
      else label.style.removeProperty("--placard-height");
    });
    app.camera.fov = baseFov;
    app.camera.clearViewOffset();
  };
}
