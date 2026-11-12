import { gsap } from "gsap";
import type { Object3D } from "three";

export interface PartMotion {
  axis: "x" | "y" | "z";
  kind: "hinge" | "slide";
  range: [number, number];
}
export type Part = Object3D & { userData: Object3D["userData"] & PartMotion };
interface PartState {
  base: number;
  requestRender: () => void;
}
const states = new WeakMap<Object3D, PartState>();

export function bindPart(object: Object3D, requestRender: () => void): Part {
  if (states.has(object)) return object as Part;
  const { axis, kind, range } = object.userData;
  if (
    !(
      ["x", "y", "z"].includes(axis) &&
      ["hinge", "slide"].includes(kind) &&
      Array.isArray(range) &&
      range.length === 2 &&
      range.every(Number.isFinite)
    )
  ) {
    throw new Error(`Invalid touch-part contract: ${object.name}`);
  }
  const part = object as Part;
  const target = part.userData.kind === "hinge" ? part.rotation : part.position;
  states.set(part, { base: target[part.userData.axis], requestRender });
  return part;
}

export function animatePart(
  part: Part,
  toFraction: number,
  options: { duration?: number; ease?: string; onComplete?: () => void } = {},
) {
  const state = states.get(part);
  if (!state) throw new Error(`Part has not been bound: ${part.name}`);
  if (!Number.isFinite(toFraction))
    throw new RangeError("Part fraction must be finite");
  const { axis, kind, range } = part.userData;
  const fraction = Math.max(0, Math.min(1, toFraction));
  const target = kind === "hinge" ? part.rotation : part.position;
  return gsap.to(target, {
    [axis]: state.base + range[0] + (range[1] - range[0]) * fraction,
    duration: options.duration ?? 0.45,
    ease: options.ease ?? "back.out(1.15)",
    overwrite: "auto",
    onUpdate: state.requestRender,
    onComplete: options.onComplete,
  });
}

export function releasePart(part: Part) {
  gsap.killTweensOf(part.position);
  gsap.killTweensOf(part.rotation);
  states.delete(part);
}
