import { onExhibitsReady } from "../gallery/exhibit-state";

const bay = document.getElementById("human-error");
let announcement = 0;
bay?.addEventListener("mr:touch", (event) => {
  if (!(event instanceof CustomEvent)) return;
  const { model } = event.detail ?? {};
  if (model !== "open-mic" && model !== "absent") return;
  const result = document.querySelector<HTMLElement>(
    `#${model} [data-touch-result]`,
  );
  if (!result) return;
  const disclosure = result.closest<HTMLDetailsElement>("details[data-reveal]");
  if (disclosure) disclosure.open = true;
  cancelAnimationFrame(announcement);
  // Repeated activations must remain audible to an assistive live-region reader.
  result.textContent = "";
  announcement = requestAnimationFrame(() => {
    result.textContent =
      model === "open-mic"
        ? "The microphone nods."
        : "Nothing happens. That is the piece.";
  });
});

onExhibitsReady(async (registry) => {
  const { mountHumanError } = await import("../gallery/human-error");
  if (registry.disposed) return;
  return mountHumanError(registry);
});
