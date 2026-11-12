import { onExhibitsReady } from "../gallery/exhibit-state";
import "../styles/drawers.css";

for (const id of ["tools", "agent-skills"]) {
  const details = document.querySelector<HTMLDetailsElement>(
    `#${id} [data-reveal]`,
  );
  const summary = details?.querySelector("summary");
  if (!details || !summary) continue;
  const label = summary.firstChild;
  const icon = summary.querySelector("[aria-hidden]");
  if (!label) continue;
  const original = label.textContent?.trim() ?? "Open the drawers";
  const sync = () => {
    label.textContent = details.open ? "Close the drawers" : original;
    if (icon) icon.textContent = details.open ? " −" : " +";
  };
  details.addEventListener("toggle", sync);
  sync();
}

onExhibitsReady(async (registry) => {
  const { mountDrawers } = await import("../gallery/drawers");
  if (registry.disposed) return;
  return mountDrawers(registry);
});
