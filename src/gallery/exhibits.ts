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
}

export class ExhibitRegistry {
  readonly records = new Map<string, ExhibitRecord>();
  readonly ready: Promise<void>;
  readonly controls = new Map<string, HTMLElement>();
  readonly handlers = new Map<string, (event: CustomEvent) => void>();
  private ended = false;
  private windowStop = 0;
  private windowRadius = Infinity;
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
    this.ready = this.load();
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
    });
    const record = this.records.get(id);
    if (record)
      for (const [mount, releases] of this.recordMounts) {
        const cleanup = mount(record);
        if (cleanup) releases.set(id, cleanup);
      }
    this.app.requestRender();
  }

  private async load() {
    const nearest = this.app.activeStop;
    const order = [...modelSpecs].sort(
      (a, b) =>
        Math.abs(a.index - nearest) - Math.abs(b.index - nearest) ||
        a.index - b.index,
    );
    for (const { id, stop, index } of order) {
      if (this.ended) return;
      const asset = await this.app.assets.get(id);
      if (this.ended) return;
      const anchor = this.app.room.getObjectByName(`anchor_${id}`);
      if (!anchor) throw new Error(`Missing room anchor: anchor_${id}`);
      anchor.add(asset.scene);
      this.add(id, stop, index, asset.scene, true);
    }
  }

  /** Model adapters mount again when Low quality reloads an exhibit. */
  onRecord(mount: (record: ExhibitRecord) => (() => void) | undefined) {
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
    for (const releases of this.recordMounts.values()) {
      releases.get(id)?.();
      releases.delete(id);
    }
    record.parts.forEach(releasePart);
    record.root.removeFromParent();
    this.records.delete(id);
    this.app.assets.release?.(id);
  }

  async setWindow(stop: number, radius: number) {
    this.windowStop = stop;
    this.windowRadius = radius;
    for (const record of this.records.values())
      if (Math.abs(record.index - stop) > radius) this.removeRecord(record.id);
    const order = [...modelSpecs].sort(
      (a, b) => Math.abs(a.index - stop) - Math.abs(b.index - stop),
    );
    for (const spec of order) {
      if (this.ended) return;
      if (
        this.records.has(spec.id) ||
        Math.abs(spec.index - this.windowStop) > this.windowRadius
      )
        continue;
      const asset = await this.app.assets.get(spec.id);
      if (this.ended) return;
      if (Math.abs(spec.index - this.windowStop) > this.windowRadius) {
        this.app.assets.release?.(spec.id);
        continue;
      }
      if (this.records.has(spec.id)) continue;
      const anchor = this.app.room.getObjectByName(`anchor_${spec.id}`);
      if (!anchor) throw new Error(`Missing room anchor: anchor_${spec.id}`);
      anchor.add(asset.scene);
      this.add(spec.id, spec.stop, spec.index, asset.scene, true);
    }
    this.app.requestRender();
  }

  atStop(index: number) {
    return [...this.records.values()].filter(
      (record) => record.index === index,
    );
  }

  controlFor(record: ExhibitRecord, part?: string) {
    return (
      (part && this.controls.get(`${record.id}:${part}`)) ||
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
    record.root.updateWorldMatrix(true, true);
    return new Box3().setFromObject(record.root);
  }

  dispose() {
    if (this.ended) return;
    this.ended = true;
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
    this.handlers.clear();
  }
}
