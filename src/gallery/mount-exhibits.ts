import { clearExhibits, publishExhibits } from "./exhibit-state";
import { ExhibitRegistry } from "./exhibits";
import type { InteractionApp } from "./interaction-types";
import { mountTouch } from "./touch";

let current: ExhibitRegistry | undefined;

export async function mountExhibits(app: InteractionApp) {
  const registry = new ExhibitRegistry(app);
  const stopTouch = mountTouch(registry);
  current = registry;
  let active = true;
  let unregister = () => {};
  const cleanup = () => {
    if (!active) return;
    active = false;
    unregister();
    if (current === registry) {
      current = undefined;
      delete document.documentElement.dataset.exhibits;
    }
    clearExhibits(registry);
    stopTouch();
    registry.dispose();
  };
  // Register before any asset/adapter await so a closed session tears down now.
  unregister = app.addCleanup(cleanup);
  try {
    await registry.ready;
    if (active && !app.disposed) {
      await publishExhibits(registry);
      if (active && !app.disposed && current === registry)
        document.documentElement.dataset.exhibits = "ready";
    }
    return cleanup;
  } catch (error) {
    cleanup();
    throw error;
  }
}
