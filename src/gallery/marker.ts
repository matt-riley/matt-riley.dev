import {
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  Vector3,
} from "three";
import type { Marker } from "../scripts/marker";
import type { ExhibitRegistry } from "./exhibits";
import { animatePart, bindPart, type Part, releasePart } from "./parts";

/** Matches blender/scenes/waystone.py's 16×8 porcelain ball exactly. */
export function createFloorMarker(material?: MeshStandardMaterial) {
  const floor = new Group();
  floor.name = "floor_waystone_marker";
  floor.userData = { axis: "y", kind: "slide", range: [0, 0.04] };
  const geometry = new SphereGeometry(0.022, 16, 8).scale(1, 0.65, 0.8);
  const porcelain =
    material?.clone() ??
    new MeshStandardMaterial({
      color: "#F1EEE6",
      roughness: 0.85,
      metalness: 0,
    });
  floor.add(new Mesh(geometry, porcelain));
  floor.position.y = 0.022 * 0.65;
  return floor;
}

export function mountMarker(
  registry: ExhibitRegistry,
  current: () => Marker | undefined,
) {
  // A procedural copy avoids fetching the far-away Waystone at the entrance.
  // It has the source pebble's dimensions and owns all of its GPU resources.
  let reference: MeshStandardMaterial | undefined;
  for (const record of registry.records.values())
    record.root.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      for (const material of Array.isArray(object.material)
        ? object.material
        : [object.material])
        if (
          material instanceof MeshStandardMaterial &&
          material.name === "porcelain"
        )
          reference ??= material;
    });
  const floor = createFloorMarker(reference);
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
