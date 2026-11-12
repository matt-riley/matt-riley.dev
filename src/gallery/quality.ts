import {
  CanvasTexture,
  CircleGeometry,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  Vector3,
} from "three";
import { onExhibitsReady } from "./exhibit-state";
import type { ExhibitRegistry } from "./exhibits";
import { QualityMonitor, type QualityTier } from "./quality-monitor";
import type { GalleryApp } from "./types";

let visitTier: QualityTier | undefined;

export function mountQuality(app: GalleryApp) {
  const memory = (navigator as Navigator & { deviceMemory?: number })
    .deviceMemory;
  const monitor = new QualityMonitor(navigator.hardwareConcurrency, memory);
  if (visitTier) monitor.tier = visitTier;
  visitTier = monitor.tier;
  const blobCanvas = document.createElement("canvas");
  blobCanvas.width = blobCanvas.height = 32;
  const context = blobCanvas.getContext("2d");
  if (context) {
    const gradient = context.createRadialGradient(16, 16, 1, 16, 16, 16);
    gradient.addColorStop(0, "rgba(20,18,15,.32)");
    gradient.addColorStop(1, "rgba(20,18,15,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 32, 32);
  }
  const texture = new CanvasTexture(blobCanvas);
  const geometry = new CircleGeometry(0.28, 24);
  const material = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  const blobs = new Map<string, Mesh>();
  let registry: ExhibitRegistry | undefined;
  let windowStop = -1;
  let ended = false;
  let previous = 0;
  let wasMoving = false;
  const position = new Vector3();
  const orientation = new Quaternion();
  let debug: HTMLPreElement | undefined;
  if (new URL(location.href).searchParams.has("debug")) {
    debug = document.createElement("pre");
    debug.dataset.galleryDebug = "";
    debug.setAttribute("aria-hidden", "true");
    Object.assign(debug.style, {
      position: "fixed",
      right: ".5rem",
      bottom: ".5rem",
      zIndex: "60",
      padding: ".65rem",
      margin: "0",
      font: "12px monospace",
      color: "#fff",
      background: "#171719",
      pointerEvents: "none",
    });
    document.body.append(debug);
  }
  function updateWindow() {
    if (!registry || monitor.tier !== "low" || windowStop === app.activeStop)
      return;
    windowStop = app.activeStop;
    void registry.setWindow(windowStop, 3).catch(() => retreat());
  }
  function syncBlobs() {
    for (const record of registry?.records.values() ?? []) {
      if (!record.owned || blobs.has(record.id)) continue;
      const blob = new Mesh(geometry, material);
      blob.name = `blob_${record.id}`;
      blob.rotation.x = -Math.PI / 2;
      blob.position.y = 0.002;
      record.root.parent?.add(blob);
      blobs.set(record.id, blob);
    }
  }
  function applyTier() {
    visitTier = monitor.tier;
    document.documentElement.dataset.galleryQuality = monitor.tier;
    if (monitor.tier === "retreat") {
      retreat();
      return;
    }
    const ratio =
      monitor.tier === "high" ? 2 : monitor.tier === "medium" ? 1.5 : 1;
    app.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, ratio));
    app.renderer.setSize(innerWidth, innerHeight, false);
    app.renderer.shadowMap.enabled = monitor.tier !== "low";
    app.scene.traverse((object) => {
      const light = object as typeof object & {
        isDirectionalLight?: boolean;
        shadow?: {
          mapSize: { set(x: number, y: number): void };
          map?: { dispose(): void } | null;
        };
      };
      if (!light.isDirectionalLight || !light.shadow) return;
      const size = monitor.tier === "high" ? 1024 : 512;
      light.shadow.map?.dispose();
      light.shadow.map = null;
      light.shadow.mapSize.set(size, size);
    });
    if (monitor.tier === "low") {
      syncBlobs();
      updateWindow();
    }
    app.requestRender();
  }
  function retreat() {
    if (app.disposed || ended) return;
    visitTier = "retreat";
    const header = document.querySelector(".site-header");
    if (!document.querySelector("[data-gallery-retreat]")) {
      const note = document.createElement("p");
      note.dataset.galleryRetreat = "";
      note.setAttribute("role", "status");
      note.textContent = "Switched to the catalogue to keep things smooth.";
      Object.assign(note.style, {
        position: "fixed",
        top: "var(--header-height, 4.5rem)",
        left: "0",
        right: "0",
        margin: "0",
        padding: ".5rem 1rem",
        background: "var(--plinth)",
        color: "var(--ink)",
        font: ".75rem var(--font-mono)",
        borderBottom: "1px solid var(--rule)",
      });
      header?.append(note);
    }
    // Session-only retreat: keep the visitor's stored mr-view preference intact.
    document.documentElement.dataset.view = "catalogue";
    document.dispatchEvent(
      new CustomEvent("mr:setting", {
        detail: { key: "view", value: "catalogue" },
      }),
    );
  }
  const unregister = onExhibitsReady((current) => {
    registry = current;
    const release = current.onRecord((record) => {
      if (monitor.tier === "low") syncBlobs();
      return () => {
        blobs.get(record.id)?.removeFromParent();
        blobs.delete(record.id);
      };
    });
    updateWindow();
    return () => {
      release();
      registry = undefined;
    };
  });
  const releaseFrame = app.onFrame(() => {
    const now = performance.now();
    const moving =
      position.distanceToSquared(app.camera.position) > 1e-9 ||
      orientation.angleTo(app.camera.quaternion) > 1e-5;
    if (previous && monitor.sample(now, now - previous, moving && wasMoving))
      applyTier();
    previous = now;
    wasMoving = moving;
    position.copy(app.camera.position);
    orientation.copy(app.camera.quaternion);
    updateWindow();
    if (debug)
      debug.textContent = `${monitor.tier}\n${monitor.average.toFixed(1)} ms\n${app.renderer.info.render.calls} calls\n${app.renderer.info.render.triangles} triangles`;
    return false;
  });
  const pause = () =>
    app.setPaused(
      Boolean(
        document.querySelector(
          "dialog[open], [aria-modal='true']:not([hidden])",
        ),
      ),
    );
  document.addEventListener("toggle", pause, true);
  const modalObserver = new MutationObserver(pause);
  modalObserver.observe(document.body, {
    subtree: true,
    attributes: true,
    attributeFilter: ["open", "aria-modal", "hidden"],
  });
  applyTier();
  pause();
  return () => {
    ended = true;
    unregister();
    releaseFrame();
    modalObserver.disconnect();
    document.removeEventListener("toggle", pause, true);
    for (const blob of blobs.values()) blob.removeFromParent();
    blobs.clear();
    geometry.dispose();
    material.dispose();
    texture.dispose();
    debug?.remove();
  };
}
