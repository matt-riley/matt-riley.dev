import { gsap } from "gsap";
import { Box3, Color, Raycaster, Vector2, Vector3 } from "three";
import type { ExhibitRecord, ExhibitRegistry } from "./exhibits";

interface Pick {
  record: ExhibitRecord;
  part?: string;
}
interface Drag {
  pick: Pick;
  x: number;
  y: number;
  lastX: number;
  time: number;
  velocity: number;
  moved: boolean;
  cancelled: boolean;
}

export function mountTouch(registry: ExhibitRegistry) {
  const app = registry.app;
  const ray = new Raycaster();
  const pointer = new Vector2();
  const hit = new Vector3();
  const colours = new Map<object, Color>();
  const restoreTimers = new Map<ExhibitRecord, gsap.core.Tween>();
  let hovered: ExhibitRecord | undefined;
  let focused: string | undefined;
  let drag: Drag | undefined;
  let disposed = false;
  const oldCursor = document.body.style.cursor;
  let hintTimer: ReturnType<typeof setTimeout> | undefined;
  let hint: HTMLElement | undefined;
  let hintShown = false;
  let lastStop = -1;
  try {
    hintShown = sessionStorage.getItem("mr-touch-hint") === "shown";
  } catch {
    /* Session storage is optional. */
  }

  function isPlacard(target: EventTarget | null) {
    return (
      target instanceof Element &&
      Boolean(
        target.closest(
          "a,button,summary,input,select,textarea,[contenteditable],.placard,.exhibit__label,.site-header,.museum-footer",
        ),
      )
    );
  }

  function pick(event: PointerEvent): Pick | undefined {
    if (isPlacard(event.target)) return;
    const canvas = app.renderer.domElement;
    const bounds = canvas.getBoundingClientRect();
    if (
      !bounds.width ||
      !bounds.height ||
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    )
      return;
    pointer.set(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      (-(event.clientY - bounds.top) / bounds.height) * 2 + 1,
    );
    ray.setFromCamera(pointer, app.camera);
    let nearest: Pick | undefined;
    let distance = Infinity;
    for (const record of registry.atStop(app.activeStop)) {
      if (
        !record.root.visible ||
        !ray.ray.intersectBox(registry.bounds(record), hit)
      )
        continue;
      const depth = hit.distanceTo(ray.ray.origin);
      if (depth >= distance) continue;
      distance = depth;
      nearest = { record };
      let partDistance = Infinity;
      for (const [name, part] of record.parts) {
        const box = new Box3().setFromObject(part);
        if (!ray.ray.intersectBox(box, hit)) continue;
        const partDepth = hit.distanceTo(ray.ray.origin);
        if (partDepth < partDistance) {
          partDistance = partDepth;
          nearest.part = name;
        }
      }
    }
    return nearest;
  }

  function highlight(record: ExhibitRecord, active: boolean) {
    if (!record.parts.size) return;
    gsap.to(record.root.position, {
      y: record.basePosition.y + (active ? 0.01 : 0),
      duration: 0.22,
      overwrite: "auto",
      onUpdate: app.requestRender,
    });
    for (const material of record.glaze) {
      if (!colours.has(material)) colours.set(material, material.color.clone());
      const base = colours.get(material);
      if (!base) continue;
      const target = active ? base.clone().lerp(new Color("white"), 0.1) : base;
      gsap.to(material.color, {
        r: target.r,
        g: target.g,
        b: target.b,
        duration: 0.2,
        overwrite: "auto",
        onUpdate: app.requestRender,
      });
    }
  }

  function hover(record?: ExhibitRecord) {
    if (hovered === record) return;
    const previous = hovered;
    hovered = record;
    if (previous) highlight(previous, previous.stop === focused);
    if (record) highlight(record, true);
    document.body.style.cursor = record ? "pointer" : oldCursor;
  }

  function hideHint() {
    if (hintTimer !== undefined) clearTimeout(hintTimer);
    hintTimer = undefined;
    hint?.remove();
    hint = undefined;
  }

  function interacted() {
    hideHint();
    hintShown = true;
    try {
      sessionStorage.setItem("mr-touch-hint", "shown");
    } catch {
      /* Still usable without storage. */
    }
  }

  function pointerDown(event: PointerEvent) {
    if (!event.isPrimary || event.button !== 0) return;
    const target = pick(event);
    if (!target) return;
    hover(target.record);
    restoreTimers.get(target.record)?.kill();
    drag = {
      pick: target,
      x: event.clientX,
      y: event.clientY,
      lastX: event.clientX,
      time: event.timeStamp,
      velocity: 0,
      moved: false,
      cancelled: false,
    };
    // No capture or preventDefault: vertical scrolling and pinch zoom remain native.
  }

  function pointerMove(event: PointerEvent) {
    if (!event.isPrimary) return;
    if (!drag) {
      hover(pick(event)?.record);
      return;
    }
    const dx = event.clientX - drag.x,
      dy = event.clientY - drag.y;
    if (!drag.moved && Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx))
      drag.cancelled = true;
    if (drag.cancelled) return;
    if (!drag.moved && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      drag.moved = true;
      interacted();
    }
    if (!drag.moved) return;
    if (event.cancelable) event.preventDefault();
    const elapsed = Math.max(1, event.timeStamp - drag.time);
    drag.velocity = Math.max(
      -4,
      Math.min(4, (((event.clientX - drag.lastX) * 0.008) / elapsed) * 1000),
    );
    drag.pick.record.root.rotation.y += (event.clientX - drag.lastX) * 0.008;
    drag.lastX = event.clientX;
    drag.time = event.timeStamp;
    app.requestRender();
  }

  function faceCamera(record: ExhibitRecord) {
    const parent = record.root.parent;
    if (!parent) return;
    const localCamera = parent.worldToLocal(
      app.camera.getWorldPosition(new Vector3()),
    );
    const target = Math.atan2(
      localCamera.x - record.root.position.x,
      localCamera.z - record.root.position.z,
    );
    const difference = Math.atan2(
      Math.sin(target - record.root.rotation.y),
      Math.cos(target - record.root.rotation.y),
    );
    gsap.to(record.root.rotation, {
      y: record.root.rotation.y + difference,
      duration: 0.8,
      ease: "power2.out",
      overwrite: "auto",
      onUpdate: app.requestRender,
    });
  }

  function pointerUp(event: PointerEvent) {
    if (!event.isPrimary) return;
    const finished = drag;
    drag = undefined;
    if (!finished || finished.cancelled) return;
    interacted();
    if (finished.moved) {
      const record = finished.pick.record;
      gsap.to(record.root.rotation, {
        y: record.root.rotation.y + finished.velocity * 0.12,
        duration: 0.45,
        ease: "power2.out",
        overwrite: "auto",
        onUpdate: app.requestRender,
      });
      restoreTimers.set(
        record,
        gsap.delayedCall(2, () => {
          restoreTimers.delete(record);
          faceCamera(record);
        }),
      );
    } else
      registry.controlFor(finished.pick.record, finished.pick.part)?.click();
  }

  function cancel() {
    drag = undefined;
    hover();
  }

  function focusIn(event: FocusEvent) {
    const target =
      event.target instanceof Element
        ? event.target.closest("[data-touch]")
        : null;
    const section = target?.closest<HTMLElement>("[data-exhibit]");
    focused = section?.dataset.exhibit;
    for (const record of registry.records.values())
      highlight(record, record === hovered || record.stop === focused);
  }

  function focusOut(event: FocusEvent) {
    if (
      event.relatedTarget instanceof Element &&
      event.relatedTarget
        .closest("[data-touch]")
        ?.closest<HTMLElement>("[data-exhibit]")?.dataset.exhibit === focused
    )
      return;
    focused = undefined;
    for (const record of registry.records.values())
      highlight(record, record === hovered);
  }

  function touch(event: Event) {
    if (!(event instanceof CustomEvent)) return;
    interacted();
    for (const record of registry.records.values()) {
      if (
        record.stop !== event.detail?.exhibit ||
        (event.detail.model && event.detail.model !== record.id)
      )
        continue;
      const handler = registry.handlers.get(record.id);
      if (handler) {
        handler(event);
        continue;
      }
      gsap.to(record.root.position, {
        y: record.basePosition.y + 0.035,
        duration: 0.16,
        ease: "power2.out",
        yoyo: true,
        repeat: 1,
        overwrite: "auto",
        onUpdate: app.requestRender,
        onComplete: () => {
          if (!disposed)
            highlight(record, record === hovered || record.stop === focused);
        },
      });
    }
  }

  const stopFrame = app.onFrame(() => {
    if (app.activeStop !== lastStop) {
      lastStop = app.activeStop;
      hideHint();
      hover();
      if (lastStop === 1 && !hintShown)
        hintTimer = setTimeout(() => {
          hintTimer = undefined;
          if (disposed || app.activeStop !== 1 || hintShown) return;
          hintShown = true;
          try {
            sessionStorage.setItem("mr-touch-hint", "shown");
          } catch {
            /* Optional storage. */
          }
          hint = document.createElement("span");
          hint.className = "gallery-touch-hint";
          hint.textContent = "Go on, touch it";
          hint.setAttribute("aria-hidden", "true");
          document.getElementById("tools")?.append(hint);
          app.requestRender();
        }, 4000);
    }
    if (hint) {
      const record = registry.records.get("tools");
      if (record) {
        const point = registry.bounds(record).getCenter(new Vector3());
        point.y += 0.24;
        point.project(app.camera);
        hint.style.left = `${Math.max(40, Math.min(innerWidth - 140, ((point.x + 1) * innerWidth) / 2))}px`;
        hint.style.top = `${Math.max(100, Math.min(innerHeight - 70, ((1 - point.y) * innerHeight) / 2))}px`;
      }
    }
    return false;
  });

  document.addEventListener("pointerdown", pointerDown);
  document.addEventListener("pointermove", pointerMove, { passive: false });
  document.addEventListener("pointerup", pointerUp);
  document.addEventListener("pointercancel", cancel);
  document.addEventListener("focusin", focusIn);
  document.addEventListener("focusout", focusOut);
  document.addEventListener("mr:touch", touch);

  return () => {
    disposed = true;
    hideHint();
    stopFrame();
    restoreTimers.forEach((timer) => {
      timer.kill();
    });
    restoreTimers.clear();
    for (const record of registry.records.values()) {
      gsap.killTweensOf(record.root.position);
      gsap.killTweensOf(record.root.rotation);
      for (const material of record.glaze) {
        gsap.killTweensOf(material.color);
        const base = colours.get(material);
        if (base) material.color.copy(base);
      }
    }
    colours.clear();
    document.body.style.cursor = oldCursor;
    document.removeEventListener("pointerdown", pointerDown);
    document.removeEventListener("pointermove", pointerMove);
    document.removeEventListener("pointerup", pointerUp);
    document.removeEventListener("pointercancel", cancel);
    document.removeEventListener("focusin", focusIn);
    document.removeEventListener("focusout", focusOut);
    document.removeEventListener("mr:touch", touch);
  };
}
