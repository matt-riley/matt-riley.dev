import { type Box3, type Camera, Vector3 } from "three";

/** Expand an explicitly opted-in touch part in CSS pixels, then clip to canvas. */
export function screenHitArea(
  box: Box3,
  camera: Camera,
  width: number,
  height: number,
  minimumPixels: number,
) {
  const centre = box.getCenter(new Vector3()).project(camera);
  if (centre.z < -1 || centre.z > 1) return;
  let left = Infinity,
    right = -Infinity,
    top = Infinity,
    bottom = -Infinity;
  const point = new Vector3();
  for (const x of [box.min.x, box.max.x])
    for (const y of [box.min.y, box.max.y])
      for (const z of [box.min.z, box.max.z]) {
        point.set(x, y, z).project(camera);
        const px = ((point.x + 1) * width) / 2,
          py = ((1 - point.y) * height) / 2;
        left = Math.min(left, px);
        right = Math.max(right, px);
        top = Math.min(top, py);
        bottom = Math.max(bottom, py);
      }
  const centreX = (left + right) / 2,
    centreY = (top + bottom) / 2;
  const halfWidth = Math.max(right - left, minimumPixels) / 2,
    halfHeight = Math.max(bottom - top, minimumPixels) / 2;
  return {
    left: Math.max(0, centreX - halfWidth),
    right: Math.min(width, centreX + halfWidth),
    top: Math.max(0, centreY - halfHeight),
    bottom: Math.min(height, centreY + halfHeight),
    centreX,
    centreY,
  };
}
