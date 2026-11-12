import { gsap } from "gsap";
import { MathUtils, Vector3 } from "three";
import type { ExhibitRegistry } from "./exhibits";
import { animatePart } from "./parts";

export function mountGiftShop(registry: ExhibitRegistry) {
  return registry.onRecord((record) => {
    if (record.id !== "gift-shop") return;
    const cleanups: Array<() => void> = [
      registry.setTouchHandler("gift-shop", () => {}),
    ];
    for (const link of record.section.querySelectorAll<HTMLAnchorElement>(
      "[data-gift-link]",
    )) {
      const name = `touch_item_${link.dataset.giftLink}`;
      const part = record.parts.get(name);
      if (!part) continue;
      const position = part.position.clone();
      const rotation = part.rotation.clone();
      let hovered = link.matches(":hover");
      let focused = document.activeElement === link;
      const update = () => {
        const active = hovered || focused;
        animatePart(part, active ? 1 : 0, {
          duration: 0.25,
          ease: "power2.out",
        });
        const camera = registry.app.camera.getWorldPosition(new Vector3());
        part.parent?.worldToLocal(camera);
        const direction = Math.atan2(
          camera.x - part.position.x,
          camera.z - part.position.z,
        );
        const difference = Math.atan2(
          Math.sin(direction - rotation.y),
          Math.cos(direction - rotation.y),
        );
        gsap.to(part.rotation, {
          y:
            rotation.y +
            (active ? MathUtils.clamp(difference, -0.12, 0.12) : 0),
          duration: 0.25,
          ease: "power2.out",
          overwrite: "auto",
          onUpdate: registry.app.requestRender,
        });
      };
      const enter = () => {
        hovered = true;
        update();
      };
      const leave = () => {
        hovered = false;
        update();
      };
      const focus = () => {
        focused = true;
        update();
      };
      const blur = () => {
        focused = false;
        update();
      };
      link.addEventListener("pointerenter", enter);
      link.addEventListener("pointerleave", leave);
      link.addEventListener("focus", focus);
      link.addEventListener("blur", blur);
      const restoreControl = registry.setControl("gift-shop", name, link);
      if (hovered || focused) update();
      cleanups.push(() => {
        restoreControl();
        link.removeEventListener("pointerenter", enter);
        link.removeEventListener("pointerleave", leave);
        link.removeEventListener("focus", focus);
        link.removeEventListener("blur", blur);
        gsap.killTweensOf(part.position);
        gsap.killTweensOf(part.rotation);
        part.position.copy(position);
        part.rotation.copy(rotation);
      });
    }
    return () => {
      cleanups.forEach((cleanup) => {
        cleanup();
      });
    };
  });
}
