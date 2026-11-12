import type { ExhibitRegistry } from "../gallery/exhibits";
import { animatePart } from "../gallery/parts";
import { get } from "../scripts/settings";

const keys = ["lights", "cat", "sound"] as const;

export function mountFlagz(registry: ExhibitRegistry) {
  return registry.onRecord((record) => {
    if (record.id !== "flagz") return;
    const releases: (() => void)[] = [];
    const tweens = new Map<string, ReturnType<typeof animatePart>>();
    for (const key of keys) {
      const button = record.section.querySelector<HTMLButtonElement>(
        `[data-flagz-setting="${key}"]`,
      );
      if (!button) continue;
      for (const prefix of ["touch_switch", "touch_flag"]) {
        const name = `${prefix}_${key}`;
        releases.push(
          registry.setControl(record.id, name, button),
          registry.setPartHitArea(record.id, name, 44),
        );
      }
    }
    releases.push(
      registry.setDraggable(record.id, false),
      registry.setTouchHandler(record.id, () => {}),
    );
    function sync(animate: boolean, changedKey?: (typeof keys)[number]) {
      for (const key of keys) {
        if (changedKey && changedKey !== key) continue;
        const fraction = get(key) === (key === "lights" ? "day" : "on") ? 1 : 0;
        for (const prefix of ["touch_switch", "touch_flag"]) {
          const name = `${prefix}_${key}`,
            part = record.parts.get(name);
          if (!part) continue;
          tweens.get(name)?.kill();
          tweens.set(
            name,
            animatePart(part, fraction, {
              duration: animate ? 0.25 : 0,
              ease: "power2.out",
            }),
          );
        }
      }
    }
    const changed = (event: Event) => {
      const key = (event as CustomEvent).detail?.key;
      if (keys.some((candidate) => candidate === key)) sync(true, key);
    };
    document.addEventListener("mr:setting", changed);
    sync(false);
    return () => {
      document.removeEventListener("mr:setting", changed);
      tweens.forEach((tween) => {
        tween.kill();
      });
      releases.reverse().forEach((release) => {
        release();
      });
    };
  });
}
