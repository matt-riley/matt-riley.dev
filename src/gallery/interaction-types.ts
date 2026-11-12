import type { Object3D, PerspectiveCamera, Scene, WebGLRenderer } from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";

export interface InteractionApp {
  scene: Scene;
  room: Object3D;
  camera: PerspectiveCamera;
  renderer: WebGLRenderer;
  assets: { get(id: string): Promise<GLTF>; release?(id: string): void };
  activeStop: number;
  requestRender(): void;
  onFrame(callback: (delta: number) => boolean): () => void;
  onResize(callback: () => void): () => void;
}
