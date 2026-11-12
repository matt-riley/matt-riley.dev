import { onExhibitsReady } from "../gallery/exhibit-state";
import "../styles/drawers.css";

for (const id of ["tools", "agent-skills"]) {
  const details = document.querySelector<HTMLDetailsElement>(
    `#${id} [data-reveal]`,
  );
  const summary = details?.querySelector("summary");
  if (!details || !summary) continue;
  const original = summary.textContent?.trim() ?? "Open the drawers";
  const sync = () => {
    summary.textContent = details.open ? "Close the drawers −" : original;
  };
  details.addEventListener("toggle", sync);
  sync();
}

onExhibitsReady(async (registry) => {
  const { mountDrawers } = await import("../gallery/drawers");
  if (registry.disposed) return;
  return mountDrawers(registry);
});
