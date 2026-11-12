import { onExhibitsReady } from "../gallery/exhibit-state";
import { openingHoursAt } from "./opening-hours";

const hours = document.querySelector<HTMLElement>("[data-opening-hours]");
let minute = 0;
function updateHours() {
  clearTimeout(minute);
  if (document.hidden) return;
  if (hours) hours.textContent = openingHoursAt(new Date()).text;
  minute = window.setTimeout(updateHours, 60_000 - (Date.now() % 60_000));
}
document.addEventListener("visibilitychange", updateHours);
window.addEventListener("pageshow", updateHours);
window.addEventListener("pagehide", () => clearTimeout(minute));
updateHours();

const cue = document.querySelector<HTMLElement>("[data-scroll-cue]");
function hideCue() {
  if (scrollY <= 0) return;
  if (cue) cue.hidden = true;
  window.removeEventListener("scroll", hideCue);
}
window.addEventListener("scroll", hideCue, { passive: true });
hideCue();
if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
  try {
    if (!sessionStorage.getItem("mr-entrance-seen")) {
      document.documentElement.dataset.entranceArrival = "";
      sessionStorage.setItem("mr-entrance-seen", "true");
    }
  } catch {
    document.documentElement.dataset.entranceArrival = "";
  }
}

window.setTimeout(() => {
  delete document.documentElement.dataset.entranceArrival;
}, 1800);

onExhibitsReady(async (registry) => {
  const { mountEntrance } = await import("./entrance-visual");
  if (registry.disposed) return;
  return mountEntrance(registry);
});
