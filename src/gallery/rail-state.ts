// This optional-adapter boundary has no eager Three.js runtime dependency.
import type { Box3, Object3D, Vector3 } from "three";

export interface StopTargetFrame {
  /** 0 at the section's start, 0.5 at its centre and 1 at its end. */
  sectionProgress: number;
  defaultTarget: Vector3;
  defaultBounds: Box3;
  room: Object3D;
}
export interface StopTarget {
  target?: Vector3;
  bounds?: Box3;
}
export type StopTargetResolver = (
  frame: StopTargetFrame,
) => StopTarget | undefined;
const resolvers = new Map<number, StopTargetResolver>();

/** A lazy exhibit adapter can pan its own stop without owning the render loop. */
export function setStopTarget(stop: number, resolver: StopTargetResolver) {
  if (!Number.isInteger(stop) || stop < 0 || stop > 8)
    throw new RangeError("A rail stop must be 0 to 8");
  resolvers.set(stop, resolver);
  return () => {
    if (resolvers.get(stop) === resolver) resolvers.delete(stop);
  };
}

export function resolveStopTarget(stop: number, frame: StopTargetFrame) {
  return resolvers.get(stop)?.(frame);
}
