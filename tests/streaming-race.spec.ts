import { expect, test } from "@playwright/test";
import { Group } from "three";

test("an unfinished distant model cannot escape later Low-mode cleanup", async ({
  browserName,
}, info) => {
  test.skip(
    browserName !== "chromium" || info.project.name !== "desktop-chromium",
    "Shared asset lifecycle.",
  );
  const names = ["window", "matchMedia", "document"] as const;
  const originals = names.map((name) =>
    Object.getOwnPropertyDescriptor(globalThis, name),
  );
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { addEventListener() {} },
  });
  Object.defineProperty(globalThis, "matchMedia", {
    configurable: true,
    value: () => ({ matches: false }),
  });
  const { ExhibitRegistry, modelSpecs } = await import(
    "../src/gallery/exhibits"
  );
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { getElementById: () => ({ querySelector: () => null }) },
  });
  let registry: InstanceType<typeof ExhibitRegistry> | undefined;
  try {
    const room = new Group();
    for (const spec of modelSpecs) {
      const anchor = new Group();
      anchor.name = `anchor_${spec.id}`;
      room.add(anchor);
    }
    const retained = new Map<string, { scene: Group }>();
    const released: string[] = [];
    let finishWaystone = () => {};
    const gate = new Promise<void>((resolve) => {
      finishWaystone = resolve;
    });
    let waystoneRequests = 0;
    registry = new ExhibitRegistry({
      room,
      activeStop: 0,
      requestRender() {},
      onFrame() {
        return () => {};
      },
      assets: {
        async get(id: string) {
          if (retained.has(id)) return retained.get(id);
          if (id === "waystone" && ++waystoneRequests === 1) await gate;
          const asset = { scene: new Group() };
          retained.set(id, asset);
          return asset;
        },
        release(id: string) {
          released.push(id);
          retained.delete(id);
        },
      },
    } as unknown as ConstructorParameters<typeof ExhibitRegistry>[0]);
    await registry.ready;
    // High retains visited models, but a request overtaken before attachment
    // must not become an invisible cache entry that Low cannot find.
    const interrupted = registry.setWindow(3, Infinity);
    await expect.poll(() => waystoneRequests).toBe(1);
    await registry.setWindow(0, Infinity);
    finishWaystone();
    await interrupted;
    expect(registry.records.has("waystone")).toBe(false);
    expect(retained.has("waystone")).toBe(false);
    expect(released.filter((id) => id === "waystone")).toHaveLength(1);
    await registry.setWindow(0, 3);
    expect(retained.has("waystone")).toBe(false);
    await registry.setWindow(5, 3);
    expect(waystoneRequests).toBe(2);
    expect(registry.records.has("waystone")).toBe(true);
  } finally {
    registry?.dispose();
    names.forEach((name, index) => {
      const descriptor = originals[index];
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    });
  }
});
