import { expect, test } from "@playwright/test";
import { QualityMonitor } from "../src/gallery/quality-monitor";

test("quality counts sustained moving frames and never steps back up", () => {
  const monitor = new QualityMonitor(8, 8);
  expect(monitor.tier).toBe("high");
  for (let time = 0; time <= 2100; time += 25) monitor.sample(time, 25, true);
  expect(monitor.tier).toBe("medium");
  for (let time = 2125; time <= 4300; time += 25)
    monitor.sample(time, 25, true);
  expect(monitor.tier).toBe("low");
  for (let time = 4350; time <= 9000; time += 40)
    monitor.sample(time, 40, true);
  expect(monitor.tier).toBe("retreat");
  for (let time = 9020; time < 11000; time += 10)
    monitor.sample(time, 10, true);
  expect(monitor.tier).toBe("retreat");
});

test("idle gaps and short slow bursts cannot lower quality", () => {
  const monitor = new QualityMonitor(8, 8);
  for (let time = 0; time < 1800; time += 30) monitor.sample(time, 30, true);
  monitor.sample(20_000, 18_000, false);
  for (let time = 20_016; time < 21_800; time += 30)
    monitor.sample(time, 30, true);
  expect(monitor.tier).toBe("high");
  expect(new QualityMonitor(4, 8).tier).toBe("medium");
  expect(new QualityMonitor(8, 4).tier).toBe("medium");
});

test("batching preserves quantized coordinates, named bounds and touch pivots", async () => {
  const {
    BufferGeometry,
    Float32BufferAttribute,
    Group,
    Int16BufferAttribute,
    Mesh,
    MeshBasicMaterial,
  } = await import("three");
  const { batchRoom, batchExhibit } = await import("../src/gallery/batch-room");
  const triangle = () => {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new Int16BufferAttribute(
        [-32767, 0, 0, 32767, 0, 0, 0, 32767, 0],
        3,
        true,
      ),
    );
    geometry.setAttribute(
      "uv1",
      new Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2),
    );
    return geometry;
  };
  const room = new Group();
  const material = new MeshBasicMaterial();
  for (const x of [12, 15]) {
    const mesh = new Mesh(triangle(), material);
    mesh.name = `plinth_${x}`;
    mesh.position.x = x;
    room.add(mesh);
  }
  batchRoom(room);
  const named = room.getObjectByName("plinth_12");
  expect(named?.visible).toBe(false);
  const merged = room.children.find((object) =>
    object.name.startsWith("runtime_batch"),
  ) as InstanceType<typeof Mesh>;
  merged.geometry.computeBoundingBox();
  expect(merged.geometry.boundingBox?.min.x).toBeCloseTo(11);
  expect(merged.geometry.boundingBox?.max.x).toBeCloseTo(16);
  expect(
    (named as InstanceType<typeof Mesh>).geometry
      .getAttribute("position")
      .getX(0),
  ).toBe(-1);

  const exhibit = new Group();
  const hinge = new Group();
  hinge.name = "touch_lid";
  hinge.position.set(2, 3, 4);
  exhibit.add(hinge);
  for (const x of [0, 1]) {
    const mesh = new Mesh(triangle(), material);
    mesh.position.x = x;
    hinge.add(mesh);
  }
  batchExhibit(exhibit);
  const moving = hinge.children.find((object) =>
    object.name.startsWith("runtime_batch"),
  );
  expect(moving).toBeDefined();
  expect(moving?.parent).toBe(hinge);
  expect(exhibit.getObjectByName("touch_lid")).toBe(hinge);
  hinge.rotation.z = Math.PI / 2;
  exhibit.updateMatrixWorld(true);
  expect(moving?.matrixWorld.elements[0]).toBeCloseTo(0);
});

test("Low window unloads record adapters and remounts fresh models on return", async () => {
  const { Group } = await import("three");
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const previousMedia = Object.getOwnPropertyDescriptor(
    globalThis,
    "matchMedia",
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
  const previous = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { getElementById: () => ({ querySelector: () => null }) },
  });
  try {
    const room = new Group();
    for (const spec of modelSpecs) {
      const anchor = new Group();
      anchor.name = `anchor_${spec.id}`;
      room.add(anchor);
    }
    const released: string[] = [];
    const loaded: string[] = [];
    const registry = new ExhibitRegistry({
      room,
      activeStop: 0,
      requestRender() {},
      assets: {
        async get(id: string) {
          loaded.push(id);
          return { scene: new Group() };
        },
        release(id: string) {
          released.push(id);
        },
      },
    } as unknown as ConstructorParameters<typeof ExhibitRegistry>[0]);
    await registry.ready;
    let mounts = 0,
      cleanups = 0;
    const unmount = registry.onRecord(() => {
      mounts++;
      return () => {
        cleanups++;
      };
    });
    expect(mounts).toBe(9);
    await registry.setWindow(0, 3);
    expect(registry.records.size).toBe(3);
    expect(released).toHaveLength(6);
    expect(cleanups).toBe(6);
    await registry.setWindow(8, 3);
    expect(registry.records.size).toBe(5);
    expect(loaded.length).toBe(14);
    expect(mounts).toBe(14);
    expect(cleanups).toBe(9);
    const cat = registry.registerExhibit("cat", "gift-shop", 8, new Group());
    cat.record.pickPriority = 100;
    cat.record.draggable = false;
    const button = {} as HTMLElement;
    const detachControl = registry.setControl("cat", "", button);
    expect(registry.controlFor(cat.record)).toBe(button);
    cat.dispose();
    detachControl();
    expect(registry.records.has("cat")).toBe(false);
    unmount();
    registry.dispose();
    expect(cleanups).toBe(mounts);
  } finally {
    if (previous) Object.defineProperty(globalThis, "document", previous);
    else Reflect.deleteProperty(globalThis, "document");
    if (previousWindow)
      Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
    if (previousMedia)
      Object.defineProperty(globalThis, "matchMedia", previousMedia);
    else Reflect.deleteProperty(globalThis, "matchMedia");
  }
});
