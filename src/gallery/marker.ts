import { Vector3 } from "three";
import type { Marker } from "../scripts/marker";
import type { ExhibitRegistry } from "./exhibits";
import { animatePart, bindPart, type Part, releasePart } from "./parts";

export function mountMarker(
  registry: ExhibitRegistry,
  current: () => Marker | undefined,
) {
  const record = registry.records.get("waystone");
  const pebble = record?.parts.get("touch_marker");
  if (!record || !pebble) return;
  let copy: Part | undefined;
  const removeCopy = () => {
    if (copy) {
      releasePart(copy);
      copy.removeFromParent();
      copy = undefined;
    }
  };
  const update = () => {
    const marker = current();
    if (!marker) {
      animatePart(pebble, 1, {
        onComplete: () => {
          pebble.visible = false;
        },
      });
      const old = copy;
      if (old) animatePart(old, 1, { onComplete: removeCopy });
      return;
    }
    removeCopy();
    pebble.visible = true;
    animatePart(pebble, 1, { duration: 0 });
    animatePart(pebble, 0, { duration: 0.6, ease: "bounce.out" });
    const section = document.getElementById(marker.stop);
    const index = [
      ...document.querySelectorAll("section[data-exhibit]"),
    ].indexOf(section as HTMLElement);
    const node =
      registry.app.room.getObjectByName(
        `anchor_${marker.stop === "human-error" ? "absent" : marker.stop}`,
      ) ?? registry.app.room.getObjectByName(`stop_${index}_target`);
    if (node) {
      const point = node.getWorldPosition(new Vector3());
      const clone = pebble.clone(true);
      clone.position.set(point.x + 0.3, 0.025, point.z + 0.3);
      copy = bindPart(clone, registry.app.requestRender);
      copy.visible = true;
      registry.app.scene.add(copy);
      animatePart(copy, 1, { duration: 0 });
      animatePart(copy, 0, { duration: 0.6, ease: "bounce.out" });
    }
  };
  pebble.visible = Boolean(current());
  if (current()) update();
  const stopHandler = registry.setTouchHandler("waystone", () => {});
  document.addEventListener("mr:marker", update);
  return () => {
    document.removeEventListener("mr:marker", update);
    stopHandler();
    removeCopy();
  };
}
