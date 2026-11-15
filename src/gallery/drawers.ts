import type { ExhibitRegistry } from "./exhibits";
import { animatePart } from "./parts";

export function mountDrawers(registry: ExhibitRegistry) {
  return registry.onRecord((record) => {
    const id = record.id;
    if (id !== "tools" && id !== "agent-skills") return;
    const cleanups: (() => void)[] = [];
    const details =
      record?.section.querySelector<HTMLDetailsElement>("[data-reveal]");
    if (!details) return;
    const pending = new Set<ReturnType<typeof setTimeout>>();
    const sync = () => {
      for (const timer of pending) {
        clearTimeout(timer);
      }
      pending.clear();
      const names =
        id === "tools"
          ? ["touch_tray_left", "touch_tray_right", "touch_drawer"]
          : ["touch_drawer"];
      names.forEach((name, index) => {
        const part = record.parts.get(name);
        if (!part) return;
        const timer = setTimeout(() => {
          pending.delete(timer);
          if (!registry.disposed) animatePart(part, details.open ? 1 : 0);
        }, index * 80);
        pending.add(timer);
      });
    };
    details.addEventListener("toggle", sync);
    cleanups.push(() => details.removeEventListener("toggle", sync));
    cleanups.push(registry.setTouchHandler(id, () => {}));
    sync();
    if (id === "agent-skills")
      record.section
        .querySelectorAll<HTMLAnchorElement>(".item-list a")
        .forEach((link, index) => {
          const part = record.parts.get(`touch_card_${index}`);
          if (!part) return;
          const active = () => animatePart(part, 1);
          const idle = () =>
            animatePart(part, link.matches(":hover, :focus") ? 1 : 0);
          link.addEventListener("pointerenter", active);
          link.addEventListener("pointerleave", idle);
          link.addEventListener("focus", active);
          link.addEventListener("blur", idle);
          if (link.matches(":hover, :focus")) active();
          cleanups.push(() => {
            link.removeEventListener("pointerenter", active);
            link.removeEventListener("pointerleave", idle);
            link.removeEventListener("focus", active);
            link.removeEventListener("blur", idle);
          });
        });
    return () => {
      pending.forEach(clearTimeout);
      cleanups.forEach((cleanup) => {
        cleanup();
      });
    };
  });
}
