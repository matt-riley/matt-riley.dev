import { publishExhibits } from "./exhibit-state";
import { ExhibitRegistry } from "./exhibits";
import type { InteractionApp } from "./interaction-types";
import { mountTouch } from "./touch";

export async function mountExhibits(app: InteractionApp) {
  const registry = new ExhibitRegistry(app);
  const stopTouch = mountTouch(registry);
  let active = true;
  let unpublish: (() => void) | undefined;
  const cleanup = () => {
    active = false;
    delete document.documentElement.dataset.exhibits;
    unpublish?.();
    stopTouch();
    registry.dispose();
  };
  try {
    await registry.ready;
    if (active) {
      unpublish = await publishExhibits(registry);
      document.documentElement.dataset.exhibits = "ready";
    }
    return cleanup;
  } catch (error) {
    cleanup();
    throw error;
  }
}
