import {
  Box3,
  type Mesh,
  type MeshStandardMaterial,
  type Object3D,
  type Vector3,
} from "three";
import { set } from "../scripts/settings";
import type { InteractionApp } from "./interaction-types";
import { bindPart, type Part, releasePart } from "./parts";

export const modelSpecs = [
  { id: "tools", stop: "tools", index: 1 },
  { id: "flagz", stop: "flagz", index: 2 },
  { id: "waffle-agent", stop: "waffle-agent", index: 3 },
  { id: "agent-skills", stop: "agent-skills", index: 4 },
  { id: "waystone", stop: "waystone", index: 5 },
  { id: "open-mic", stop: "human-error", index: 7 },
  { id: "boom-bap", stop: "human-error", index: 7 },
  { id: "absent", stop: "human-error", index: 7 },
  { id: "gift-shop", stop: "gift-shop", index: 8 },
] as const;

export interface ExhibitRecord {
  id: string;
  stop: string;
  index: number;
  root: Object3D;
  section: HTMLElement;
  parts: Map<string, Part>;
  glaze: Set<MeshStandardMaterial>;
  basePosition: Vector3;
  owned: boolean;
  draggable: boolean;
  pickPriority: number;
  pickBounds?: () => Box3;
}

export class ExhibitRegistry {
  readonly records = new Map<string, ExhibitRecord>();
  readonly ready: Promise<void>;
  readonly controls = new Map<string, HTMLElement>();
  private readonly hitAreas = new Map<string, { minimumPixels: number }>();
  readonly handlers = new Map<string, (event: CustomEvent) => void>();
  private ended = false;
  private windowStop = 0;
  private windowRadius = Infinity;
  private nearStop = 0;
  private readonly stopStreaming: () => void;
  private recordMounts = new Map<
    (record: ExhibitRecord) => (() => void) | undefined,
    Map<string, () => void>
  >();
  get disposed() {
    return this.ended;
  }

  constructor(readonly app: InteractionApp) {
    const rope = app.room.getObjectByName("touch_rope");
    if (rope) this.add("entrance", "entrance", 0, rope, false);
    this.windowStop = this.nearStop = app.activeStop;
    let previous = app.activeStop;
    this.stopStreaming = app.onFrame(() => {
      if (this.ended || previous === app.activeStop) return false;
      previous = app.activeStop;
      this.windowStop = previous;
      void this.loadNear(previous).catch(() => {
        if (!this.ended) set("view", "catalogue");
      });
      return false;
    });
    this.ready = this.loadNear(app.activeStop);
    void this.ready.catch(() => {
      if (!this.ended) set("view", "catalogue");
    });
  }

  private add(
    id: string,
    stop: string,
    index: number,
    root: Object3D,
    owned: boolean,
  ) {
    const section = document.getElementById(stop);
    if (!section) throw new Error(`Missing catalogue section: ${stop}`);
    const parts = new Map<string, Part>();
    const glaze = new Set<MeshStandardMaterial>();
    root.traverse((object) => {
      if (object.name.startsWith("touch_"))
        parts.set(object.name, bindPart(object, this.app.requestRender));
      const mesh = object as Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = mesh.receiveShadow = true;
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      for (const material of materials)
        if (material.name === "glaze")
          glaze.add(material as MeshStandardMaterial);
    });
    this.records.set(id, {
      id,
      stop,
      index,
      root,
      section,
      parts,
      glaze,
      basePosition: root.position.clone(),
      owned,
      draggable: true,
      pickPriority: 0,
    });
    const record = this.records.get(id);
    if (record)
      for (const [mount, releases] of this.recordMounts) {
        const cleanup = mount(record);
        if (cleanup) releases.set(id, cleanup);
      }
    this.app.requestRender();
  }

  private async loadNear(nearest: number) {
    this.nearStop = nearest;
    this.app.assets.setNearestStop?.(nearest);
    const order = [...modelSpecs].sort(
      (a, b) =>
        Math.abs(a.index - nearest) - Math.abs(b.index - nearest) ||
        a.index - b.index,
    );
    for (const { id, stop, index } of order) {
      if (this.ended) return;
      if (this.records.has(id) || Math.abs(index - this.nearStop) > 2) continue;
      const asset = await this.app.assets.get(id);
      if (this.ended) return;
      if (Math.abs(index - this.nearStop) > 2) {
        if (Math.abs(index - this.windowStop) > this.windowRadius)
          this.app.assets.release?.(id);
        continue;
      }
      if (this.records.has(id)) continue;
      const anchor = this.app.room.getObjectByName(`anchor_${id}`);
      if (!anchor) throw new Error(`Missing room anchor: anchor_${id}`);
      anchor.add(asset.scene);
      this.add(id, stop, index, asset.scene, true);
    }
  }

  registerExhibit(
    id: string,
    stop: string,
    index: number,
    root: Object3D,
    owned = false,
  ) {
    if (this.ended || this.records.has(id))
      throw new Error(`Cannot register exhibit ${id}`);
    this.add(id, stop, index, root, owned);
    const record = this.records.get(id);
    if (!record) throw new Error(`Exhibit registration failed: ${id}`);
    return { record, dispose: () => this.unregisterRecord(record) };
  }

  private unregisterRecord(record: ExhibitRecord) {
    if (this.records.get(record.id) !== record) return;
    for (const releases of this.recordMounts.values()) {
      releases.get(record.id)?.();
      releases.delete(record.id);
    }
    record.parts.forEach(releasePart);
    if (record.owned) {
      record.root.removeFromParent();
      this.app.assets.release?.(record.id);
    }
    this.records.delete(record.id);
    this.app.requestRender();
  }

  /** Model adapters mount again when Low quality reloads an exhibit. */
  onRecord(mount: (record: ExhibitRecord) => (() => void) | undefined) {
    if (this.ended) return () => {};
    const releases = new Map<string, () => void>();
    this.recordMounts.set(mount, releases);
    for (const record of this.records.values()) {
      const cleanup = mount(record);
      if (cleanup) releases.set(record.id, cleanup);
    }
    return () => {
      releases.forEach((cleanup) => {
        cleanup();
      });
      releases.clear();
      this.recordMounts.delete(mount);
    };
  }

  private removeRecord(id: string) {
    const record = this.records.get(id);
    if (!record?.owned) return;
    this.unregisterRecord(record);
  }

  async setWindow(stop: number, radius: number) {
    this.windowStop = stop;
    this.windowRadius = radius;
    for (const record of this.records.values())
      if (Math.abs(record.index - stop) > radius) this.removeRecord(record.id);
    await this.loadNear(stop);
    this.app.requestRender();
  }

  atStop(index: number) {
    return [...this.records.values()].filter(
      (record) => record.index === index,
    );
  }

  controlFor(record: ExhibitRecord, part?: string) {
    return (
      this.controls.get(`${record.id}:${part ?? ""}`) ||
      record.section.querySelector<HTMLElement>(
        `[data-model="${record.id}"] [data-touch], [data-model="${record.id}"][data-touch]`,
      ) ||
      record.section.querySelector<HTMLElement>("[data-touch]")
    );
  }

  setControl(id: string, part: string, control: HTMLElement) {
    const key = `${id}:${part}`;
    this.controls.set(key, control);
    return () => {
      if (this.controls.get(key) === control) this.controls.delete(key);
    };
  }

  setPartHitArea(id: string, part: string, minimumPixels = 44) {
    if (!Number.isFinite(minimumPixels) || minimumPixels <= 0)
      throw new RangeError("Touch hit area must be positive CSS pixels");
    const key = `${id}:${part}`;
    const entry = { minimumPixels };
    this.hitAreas.set(key, entry);
    return () => {
      if (this.hitAreas.get(key) === entry) this.hitAreas.delete(key);
    };
  }

  partHitArea(id: string, part: string) {
    return this.hitAreas.get(`${id}:${part}`)?.minimumPixels;
  }

  setTouchHandler(id: string, handler: (event: CustomEvent) => void) {
    this.handlers.set(id, handler);
    return () => {
      if (this.handlers.get(id) === handler) this.handlers.delete(id);
    };
  }

  setDraggable(id: string, enabled: boolean) {
    const record = this.records.get(id);
    if (!record) return () => {};
    const previous = record.draggable;
    record.draggable = enabled;
    return () => {
      record.draggable = previous;
    };
  }

  bounds(record: ExhibitRecord) {
    if (record.pickBounds) return record.pickBounds();
    record.root.updateWorldMatrix(true, true);
    return new Box3().setFromObject(record.root);
  }

  setPickBounds(id: string, resolver: () => Box3) {
    const record = this.records.get(id);
    if (!record) return () => {};
    const previous = record.pickBounds;
    record.pickBounds = resolver;
    return () => {
      record.pickBounds = previous;
    };
  }

  dispose() {
    if (this.ended) return;
    this.ended = true;
    this.stopStreaming();
    for (const releases of this.recordMounts.values())
      releases.forEach((cleanup) => {
        cleanup();
      });
    this.recordMounts.clear();
    for (const record of this.records.values()) {
      record.parts.forEach(releasePart);
      if (record.owned) record.root.removeFromParent();
    }
    this.records.clear();
    this.controls.clear();
    this.hitAreas.clear();
    this.handlers.clear();
  }
}
