import type { GallerySession } from "../gallery/types";
import { get, set } from "./settings";

const root = document.documentElement;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const connection = (
  navigator as Navigator & { connection?: EventTarget & { saveData?: boolean } }
).connection;
let supported: boolean | undefined;
let failed = false;
let session: GallerySession | undefined;
let generation = 0;
let queued = false;
let frame = 0;
let idle = 0;
let timer = 0;

function webgl2() {
  if (supported !== undefined) return supported;
  try {
    const probe = document.createElement("canvas");
    const gl = probe.getContext("webgl2", {
      failIfMajorPerformanceCaveat: true,
    });
    supported = Boolean(gl);
    const information = gl?.getExtension("WEBGL_debug_renderer_info");
    if (information && typeof gl?.getParameter === "function") {
      const renderer = String(
        gl.getParameter(information.UNMASKED_RENDERER_WEBGL),
      );
      if (
        /swiftshader|llvmpipe|softpipe|software rasterizer|microsoft basic render/i.test(
          renderer,
        )
      )
        supported = false;
    }
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    probe.width = probe.height = 0;
  } catch {
    supported = false;
  }
  return supported;
}

function stop() {
  generation++;
  queued = false;
  cancelAnimationFrame(frame);
  if (idle && typeof window.cancelIdleCallback === "function")
    window.cancelIdleCallback(idle);
  clearTimeout(timer);
  frame = idle = timer = 0;
  session?.dispose();
  session = undefined;
  if (root.dataset.gallery !== "unavailable") delete root.dataset.gallery;
}

function fallback(token: number) {
  if (token !== generation) return;
  failed = true;
  root.dataset.gallery = "unavailable";
  stop();
  set("view", "catalogue");
}

function update() {
  if (
    failed ||
    reducedMotion.matches ||
    connection?.saveData === true ||
    !webgl2()
  ) {
    root.dataset.gallery = "unavailable";
    stop();
    return;
  }
  if (root.dataset.gallery === "unavailable") delete root.dataset.gallery;
  if (get("view") !== "gallery") {
    stop();
    return;
  }
  if (session || queued) return;
  const token = ++generation;
  queued = true;
  const start = async () => {
    if (token !== generation || get("view") !== "gallery") return;
    try {
      const { boot } = await import("../gallery/boot");
      if (token !== generation || get("view") !== "gallery") return;
      const next = boot({ onFailure: () => fallback(token) });
      session = next;
      queued = false;
      const app = await next.ready;
      if (token !== generation) {
        next.dispose();
        return;
      }
      root.dataset.gallery = "ready";
      app.requestRender();
    } catch {
      fallback(token);
    }
  };
  // Two frame boundaries guarantee the catalogue can paint before an idle import.
  frame = requestAnimationFrame(() => {
    frame = requestAnimationFrame(() => {
      if (token !== generation) return;
      if (typeof window.requestIdleCallback === "function")
        idle = window.requestIdleCallback(
          () => {
            void start();
          },
          { timeout: 1500 },
        );
      else
        timer = window.setTimeout(() => {
          void start();
        }, 150);
    });
  });
}

reducedMotion.addEventListener("change", update);
connection?.addEventListener("change", update);
document.addEventListener("mr:setting", (event) => {
  if ((event as CustomEvent<{ key: string }>).detail?.key === "view") update();
});
window.addEventListener("pagehide", stop);
window.addEventListener("pageshow", (event) => {
  if (event.persisted) update();
});
update();
