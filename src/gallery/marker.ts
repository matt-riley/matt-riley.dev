import { type Mesh, Vector3 } from "three";
import type { Marker } from "../scripts/marker";
import type { ExhibitRegistry } from "./exhibits";
import { animatePart, bindPart, type Part, releasePart } from "./parts";

export async function mountMarker(
  registry: ExhibitRegistry,
  current: () => Marker | undefined,
) {
  const asset = await registry.app.assets.get("waystone");
  if (registry.disposed) return;
  const source = asset.scene.getObjectByName("touch_marker");
  if (!source) throw new Error("The waystone has no marker pebble");
  // The floor copy outlives an unloaded Waystone and owns its GPU resources.
  const floor = source.clone(true);
  floor.position.y = 0.025;
  floor.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry = mesh.geometry.clone();
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map((material) => material.clone())
      : mesh.material.clone();
  });
  const copy = bindPart(floor, registry.app.requestRender);
  copy.visible = false;
  registry.app.scene.add(copy);
  let original: Part | undefined;
  const drop = (part: Part) => {
    part.visible = true;
    animatePart(part, 1, { duration: 0 });
    animatePart(part, 0, { duration: 0.6, ease: "bounce.out" });
  };
  const lift = (part: Part) =>
    animatePart(part, 1, {
      onComplete: () => {
        part.visible = false;
      },
    });
  const update = () => {
    const marker = current();
    if (!marker) {
      if (original) lift(original);
      lift(copy);
      return;
    }
    if (original) drop(original);
    const section = document.getElementById(marker.stop);
    const index = [
      ...document.querySelectorAll("section[data-exhibit]"),
    ].indexOf(section as HTMLElement);
    const anchor =
      registry.app.room.getObjectByName(
        `anchor_${marker.stop === "human-error" ? "absent" : marker.stop}`,
      ) ?? registry.app.room.getObjectByName(`stop_${index}_target`);
    if (anchor) {
      const point = anchor.getWorldPosition(new Vector3());
      copy.position.x = point.x + 0.3;
      copy.position.z = point.z + 0.3;
      drop(copy);
    }
  };
  const stopRecords = registry.onRecord((record) => {
    if (record.id !== "waystone") return;
    original = record.parts.get("touch_marker");
    if (!original) return;
    original.visible = Boolean(current());
    if (current()) drop(original);
    const stopHandler = registry.setTouchHandler("waystone", () => {});
    return () => {
      original = undefined;
      stopHandler();
    };
  });
  if (current()) update();
  document.addEventListener("mr:marker", update);
  return () => {
    document.removeEventListener("mr:marker", update);
    stopRecords();
    releasePart(copy);
    copy.removeFromParent();
    copy.traverse((object) => {
      const mesh = object as Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry.dispose();
      for (const material of Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material])
        material.dispose();
    });
  };
}
