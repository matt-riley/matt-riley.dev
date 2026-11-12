import type { Group, PerspectiveCamera, Scene, WebGLRenderer } from "three";
import type { AssetStore } from "./assets";

export type Cleanup = () => void;
export type FrameListener = (
  deltaSeconds: number,
  timeSeconds: number,
  continuous: boolean,
) => boolean;

export interface GalleryApp {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  room: Group;
  assets: AssetStore;
  activeStop: number;
  readonly disposed: boolean;
  requestRender(): void;
  setPaused(paused: boolean): void;
  onFrame(listener: FrameListener): Cleanup;
  onResize(listener: (width: number, height: number) => void): Cleanup;
  addCleanup(cleanup: Cleanup): Cleanup;
}

export interface GallerySession {
  ready: Promise<GalleryApp>;
  dispose(): void;
}
