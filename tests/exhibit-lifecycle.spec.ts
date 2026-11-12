import { expect, test } from "@playwright/test";
import { Group, PerspectiveCamera, Scene } from "three";

test("closing during an unfinished adapter releases listeners and cannot clear a newer session", async ({
  browserName,
}, info) => {
  test.skip(
    browserName !== "chromium" || info.project.name !== "desktop-chromium",
    "Shared asynchronous lifecycle policy.",
  );
  const globals = ["window", "matchMedia", "document"] as const;
  const original = globals.map((name) =>
    Object.getOwnPropertyDescriptor(globalThis, name),
  );
  const listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();
  const documentTarget = new EventTarget();
  const fakeDocument = Object.assign(documentTarget, {
    documentElement: { dataset: {} as Record<string, string> },
    body: { style: { cursor: "" } },
    getElementById: () => ({ querySelector: () => null }),
    addEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject,
    ) {
      const current = listeners.get(type) ?? new Set();
      current.add(listener);
      listeners.set(type, current);
      EventTarget.prototype.addEventListener.call(documentTarget, type, listener);
    },
    removeEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject,
    ) {
      listeners.get(type)?.delete(listener);
      EventTarget.prototype.removeEventListener.call(
        documentTarget,
        type,
        listener,
      );
    },
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { addEventListener() {} },
  });
  Object.defineProperty(globalThis, "matchMedia", {
    configurable: true,
    value: () => ({ matches: false }),
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: fakeDocument,
  });
  const { modelSpecs } = await import("../src/gallery/exhibits");
  const { onExhibitsReady } = await import("../src/gallery/exhibit-state");
  const { mountExhibits } = await import("../src/gallery/mount-exhibits");
  const makeApp = () => {
    const cleanups = new Set<() => void>();
    const room = new Group();
    for (const { id } of modelSpecs) {
      const anchor = new Group();
      anchor.name = `anchor_${id}`;
      room.add(anchor);
    }
    const app = {
      room,
      scene: new Scene(),
      camera: new PerspectiveCamera(),
      renderer: {},
      activeStop: 0,
      disposed: false,
      assets: {
        async get() {
          return { scene: new Group() };
        },
      },
      requestRender() {},
      onFrame() {
        return () => {};
      },
      onResize() {
        return () => {};
      },
      addCleanup(cleanup: () => void) {
        cleanups.add(cleanup);
        return () => {
          cleanups.delete(cleanup);
        };
      },
      close() {
        app.disposed = true;
        for (const cleanup of [...cleanups]) cleanup();
      },
    };
    return app;
  };
  let pendingRelease = () => {};
  const pending = new Promise<void>((resolve) => {
    pendingRelease = resolve;
  });
  let first: Parameters<Parameters<typeof onExhibitsReady>[0]>[0] | undefined;
  let cleanups = 0,
    lateCleanups = 0;
  const stopImmediate = onExhibitsReady((registry) => {
    first ??= registry;
    return () => {
      cleanups++;
    };
  });
  const stopPending = onExhibitsReady(async (registry) => {
    if (registry === first) await pending;
    return () => {
      lateCleanups++;
    };
  });
  const old = makeApp();
  const next = makeApp();
  try {
    const mounting = mountExhibits(
      old as unknown as Parameters<typeof mountExhibits>[0],
    );
    await expect.poll(() => Boolean(first)).toBe(true);
    old.close();
    expect(first?.disposed).toBe(true);
    expect(listeners.get("pointerdown")?.size).toBe(0);
    expect(cleanups).toBe(1);
    const cleanupNext = await mountExhibits(
      next as unknown as Parameters<typeof mountExhibits>[0],
    );
    expect(fakeDocument.documentElement.dataset.exhibits).toBe("ready");
    pendingRelease();
    const cleanupOld = await mounting;
    cleanupOld();
    expect(lateCleanups).toBe(1);
    expect(fakeDocument.documentElement.dataset.exhibits).toBe("ready");
    cleanupNext();
    expect(cleanups).toBe(2);
    expect(lateCleanups).toBe(2);
  } finally {
    pendingRelease();
    old.close();
    next.close();
    stopImmediate();
    stopPending();
    globals.forEach((name, index) => {
      const descriptor = original[index];
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    });
  }
});
