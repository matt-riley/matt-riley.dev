import { publishExhibits } from "./exhibit-state";
import { ExhibitRegistry } from "./exhibits";
import type { InteractionApp } from "./interaction-types";
import { mountTouch } from "./touch";

export function mountExhibits(app: InteractionApp) {
  const registry = new ExhibitRegistry(app);
  const stopTouch = mountTouch(registry);
  let active = true;
  let unpublish: (() => void) | undefined;
  void registry.ready
    .then(() => {
      if (active) {
        unpublish = publishExhibits(registry);
        document.documentElement.dataset.exhibits = "ready";
      }
    })
    .catch(() => {
      /* The registry already requests the catalogue fallback. */
    });
  return () => {
    active = false;
    delete document.documentElement.dataset.exhibits;
    unpublish?.();
    stopTouch();
    registry.dispose();
  };
}
