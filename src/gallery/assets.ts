import type { Material, Object3D, Texture } from "three";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { type GLTF, GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { modelURL } from "./model-files";

export const modelStops = {
  room: 0,
  tools: 1,
  flagz: 2,
  "waffle-agent": 3,
  "agent-skills": 4,
  waystone: 5,
  "open-mic": 7,
  "boom-bap": 7,
  absent: 7,
  "gift-shop": 8,
  cat: 0,
} as const;
export type AssetId = keyof typeof modelStops;
const exhibits: AssetId[] = [
  "tools",
  "flagz",
  "waffle-agent",
  "agent-skills",
  "waystone",
  "open-mic",
  "boom-bap",
  "absent",
  "gift-shop",
];

interface Pending {
  id: AssetId;
  resolve: (asset: GLTF) => void;
  reject: (reason: unknown) => void;
}

function aborted() {
  return new DOMException("Gallery was disposed", "AbortError");
}

function captureGraph(root: Object3D): () => void {
  const geometries = new Set<{ dispose(): void }>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  root.traverse((object) => {
    const mesh = object as Object3D & {
      geometry?: { dispose(): void };
      material?: Material | Material[];
    };
    if (mesh.geometry) geometries.add(mesh.geometry);
    if (mesh.material) {
      for (const material of Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material]) {
        materials.add(material);
        for (const value of Object.values(material)) {
          if (value && typeof value === "object" && "isTexture" in value)
            textures.add(value as Texture);
        }
      }
    }
  });
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const images = new Set<{ close?(): void }>();
    for (const texture of textures) {
      if (texture.image && typeof texture.image === "object")
        images.add(texture.image);
      texture.dispose();
    }
    for (const image of images) image.close?.();
    for (const material of materials) material.dispose();
    for (const geometry of geometries) geometry.dispose();
    textures.clear();
    materials.clear();
    geometries.clear();
  };
}

export function disposeGraph(root: Object3D) {
  captureGraph(root)();
}

export class AssetStore {
  private loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  private controller = new AbortController();
  private promises = new Map<AssetId, Promise<GLTF>>();
  private loaded = new Map<AssetId, () => void>();
  private queue: Pending[] = [];
  private working = false;
  private disposed = false;
  private nearestStop = 0;

  constructor(private prepare?: (asset: GLTF, id: AssetId) => void) {}

  setNearestStop(stop: number) {
    this.nearestStop = Math.max(0, Math.min(8, stop));
  }

  get(id: AssetId): Promise<GLTF> {
    if (this.disposed) return Promise.reject(aborted());
    const cached = this.promises.get(id);
    if (cached) return cached;
    // Every requested model waits behind the room, even when requested by plugins.
    if (id !== "room" && !this.promises.has("room"))
      void this.get("room").catch(() => {});
    const promise = new Promise<GLTF>((resolve, reject) =>
      this.queue.push({ id, resolve, reject }),
    );
    this.promises.set(id, promise);
    void this.drain();
    return promise;
  }

  nearestExhibit(stop: number): AssetId {
    return [...exhibits].sort(
      (a, b) => Math.abs(modelStops[a] - stop) - Math.abs(modelStops[b] - stop),
    )[0];
  }

  prefetch(stop: number) {
    this.setNearestStop(stop);
    for (const id of [...exhibits].sort(
      (a, b) => Math.abs(modelStops[a] - stop) - Math.abs(modelStops[b] - stop),
    )) {
      void this.get(id).catch(() => {});
    }
  }

  private async drain() {
    if (this.working) return;
    this.working = true;
    try {
      while (this.queue.length && !this.disposed) {
        this.queue.sort((a, b) => {
          const priority = (id: AssetId) =>
            id === "room"
              ? -100
              : id === "cat"
                ? 0
                : Math.abs(modelStops[id] - this.nearestStop);
          return priority(a.id) - priority(b.id);
        });
        const request = this.queue.shift();
        if (!request) break;
        try {
          const response = await fetch(
            import.meta.env.DEV
              ? `/models/${request.id}.glb`
              : modelURL(request.id),
            {
              signal: this.controller.signal,
            },
          );
          if (!response.ok)
            throw new Error(`Gallery model ${request.id}: ${response.status}`);
          const asset = await this.loader.parseAsync(
            await response.arrayBuffer(),
            "/models/",
          );
          if (this.disposed) {
            disposeGraph(asset.scene);
            throw aborted();
          }
          try {
            this.prepare?.(asset, request.id);
          } catch (error) {
            disposeGraph(asset.scene);
            throw error;
          }
          this.loaded.set(request.id, captureGraph(asset.scene));
          request.resolve(asset);
        } catch (error) {
          request.reject(error);
        }
      }
    } finally {
      this.working = false;
    }
  }

  release(id: AssetId) {
    const cleanup = this.loaded.get(id);
    if (!cleanup) return;
    cleanup();
    this.loaded.delete(id);
    this.promises.delete(id);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.controller.abort();
    for (const pending of this.queue.splice(0)) pending.reject(aborted());
    for (const release of this.loaded.values()) release();
    this.loaded.clear();
    this.promises.clear();
  }
}
