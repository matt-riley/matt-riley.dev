import { onExhibitsReady } from "../gallery/exhibit-state";
import { get, toggle } from "../scripts/settings";

export const flagKeys = ["lights", "cat", "sound"] as const;
export type FlagKey = (typeof flagKeys)[number];

const section = document.getElementById("flagz");
const json = section?.querySelector<HTMLElement>("[data-flagz-json]");
function announcement(key: FlagKey) {
  const value = get(key);
  if (key === "cat" && value === "off")
    return "Cat: off. He will remember this.";
  return `${key[0].toUpperCase()}${key.slice(1)}: ${value.replace("-", " ")}.`;
}
function sync() {
  const state = Object.fromEntries(flagKeys.map((key) => [key, get(key)]));
  if (json) json.textContent = JSON.stringify(state, null, 2);
  for (const key of flagKeys) {
    const button = section?.querySelector<HTMLButtonElement>(
      `[data-flagz-setting="${key}"]`,
    );
    if (!button) continue;
    button.disabled = false;
    button.setAttribute(
      "aria-checked",
      String(get(key) === (key === "lights" ? "day" : "on")),
    );
    const value = button.querySelector<HTMLElement>("[data-flagz-value]");
    if (value) value.textContent = get(key);
  }
}
for (const key of flagKeys) {
  section
    ?.querySelector<HTMLButtonElement>(`[data-flagz-setting="${key}"]`)
    ?.addEventListener("click", () => {
      toggle(key);
      const result = section.querySelector<HTMLElement>("[data-touch-result]");
      if (result) result.textContent = announcement(key);
      section.dispatchEvent(
        new CustomEvent("mr:touch", {
          bubbles: true,
          detail: {
            exhibit: "flagz",
            model: "flagz",
            part: `touch_switch_${key}`,
          },
        }),
      );
    });
}
document.addEventListener("mr:setting", sync);
sync();

onExhibitsReady(async (registry) => {
  const { mountFlagz } = await import("./flagz-visual");
  if (registry.disposed) return;
  return mountFlagz(registry);
});
