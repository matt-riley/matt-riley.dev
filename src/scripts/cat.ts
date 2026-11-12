import copy from "../content/cat.json";
import { onExhibitsReady } from "../gallery/exhibit-state";
import { get } from "./settings";

const button = document.querySelector<HTMLButtonElement>("[data-cat-touch]");
const result = document.querySelector("[data-cat-result]");
let line = 0;
button?.addEventListener("click", () => {
  const message = copy.lines[line++ % copy.lines.length];
  if (result) result.replaceChildren(document.createTextNode(message));
  button.dispatchEvent(
    new CustomEvent("mr:touch", {
      bubbles: true,
      detail: { exhibit: "cat", model: "cat" },
    }),
  );
  document.dispatchEvent(new CustomEvent("mr:cat-line", { detail: message }));
});
const sync = () => {
  document.querySelectorAll("[data-absence-note]").forEach((note) => {
    note.textContent = get("cat") === "on" ? copy.absentOn : copy.absentOff;
  });
};
document.addEventListener("mr:setting", sync);
sync();
onExhibitsReady(async (registry) => {
  const { mountCat } = await import("../gallery/cat");
  if (registry.disposed || !button) return;
  return mountCat(registry, button);
});
