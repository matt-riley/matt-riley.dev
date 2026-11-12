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
let scrollIntent = Boolean(location.hash && location.hash !== "#entrance");
const intendScroll = () => {
  scrollIntent = true;
};
function scrollKey(event: KeyboardEvent) {
  if (
    [
      "Space",
      " ",
      "PageDown",
      "PageUp",
      "ArrowDown",
      "ArrowUp",
      "Home",
      "End",
    ].includes(event.key) &&
    !(
      event.target instanceof Element &&
      event.target.closest("button,input,textarea,select,[contenteditable]")
    )
  )
    intendScroll();
}
function scrollPointer(event: PointerEvent) {
  if (event.clientX >= innerWidth - 20) intendScroll();
}
function hideCue() {
  const entrance = document.getElementById("entrance");
  if (
    !scrollIntent &&
    (!entrance || entrance.getBoundingClientRect().bottom > innerHeight / 2)
  )
    return;
  if (cue) cue.hidden = true;
  window.removeEventListener("scroll", hideCue, true);
  window.removeEventListener("wheel", intendScroll);
  window.removeEventListener("touchmove", intendScroll);
  window.removeEventListener("keydown", scrollKey);
  window.removeEventListener("pointerdown", scrollPointer);
  window.removeEventListener("hashchange", hashCue);
}
function hashCue() {
  if (location.hash && location.hash !== "#entrance") {
    intendScroll();
    hideCue();
  }
}
window.addEventListener("hashchange", hashCue);
window.addEventListener("wheel", intendScroll, { passive: true });
window.addEventListener("touchmove", intendScroll, { passive: true });
window.addEventListener("keydown", scrollKey);
window.addEventListener("pointerdown", scrollPointer, { passive: true });
window.addEventListener("scroll", hideCue, { passive: true, capture: true });
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
