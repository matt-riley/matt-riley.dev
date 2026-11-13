import { onExhibitsReady } from "../gallery/exhibit-state";

const select = document.querySelector<HTMLSelectElement>("[data-marker-stop]");
const notice = document.querySelector<HTMLElement>("[data-marker-notice]");
const section = document.getElementById("waystone");
const current = document.querySelector("[data-marker-current]");
const clear = section?.querySelector<HTMLButtonElement>("[data-marker-clear]");
const result = section?.querySelector("[data-touch-result]");
const key = "mr-marker";
export interface Marker {
  stop: string;
  at: string;
}
export let marker: Marker | undefined;
if (select && notice && section && current && clear && result) {
  const options = [...select.options];
  const title = (stop: string) =>
    options.find((option) => option.value === stop)?.textContent ?? stop;
  const date = (at: string) =>
    new Date(at).toLocaleDateString("en-GB", {
      dateStyle: "medium",
    });
  let returning = false;
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? "null");
    if (
      saved &&
      options.some((option) => option.value === saved.stop) &&
      typeof saved.at === "string" &&
      Number.isFinite(Date.parse(saved.at))
    )
      marker = saved;
    returning = sessionStorage.getItem("mr-marker-visit") !== "yes";
    sessionStorage.setItem("mr-marker-visit", "yes");
  } catch {
    /* Storage is optional. */
  }
  section.dataset.manualTouch = "";
  const sync = () => {
    current.textContent = marker
      ? `marker: ${marker.stop}, ${date(marker.at)}`
      : "No marker left.";
    clear.hidden = !marker;
    if (!marker) notice.hidden = true;
  };
  const update = (next?: Marker) => {
    marker = next;
    try {
      if (next) localStorage.setItem(key, JSON.stringify(next));
      else localStorage.removeItem(key);
    } catch {
      /* Keep this visit usable. */
    }
    sync();
    result.textContent = next
      ? `Marker left at ${title(next.stop)}.`
      : "Marker cleared.";
    document.dispatchEvent(new Event("mr:marker"));
  };
  const times = options.map(() => 0);
  let active = 0,
    since = performance.now(),
    chosen = false;
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries)
        if (entry.isIntersecting && entry.target.id !== options[active].value) {
          times[active] += performance.now() - since;
          active = options.findIndex(
            (option) => option.value === entry.target.id,
          );
          since = performance.now();
        }
    },
    { rootMargin: "-45% 0px -45% 0px" },
  );
  document.querySelectorAll("section[data-exhibit]").forEach((stop) => {
    observer.observe(stop);
  });
  select.addEventListener("change", () => {
    chosen = true;
  });
  const chooseDefault = () => {
    if (chosen) return;
    const total = [...times];
    total[active] += performance.now() - since;
    select.selectedIndex = total.indexOf(Math.max(...total));
  };
  select.addEventListener("focus", chooseDefault);
  section.addEventListener("mr:touch", () => {
    chooseDefault();
    update({ stop: select.value, at: new Date().toISOString() });
  });
  document.querySelectorAll("[data-marker-clear]").forEach((button) => {
    button.addEventListener("click", () => update());
  });
  document
    .querySelector("[data-marker-dismiss]")
    ?.addEventListener("click", () => {
      notice.hidden = true;
    });
  document
    .querySelector("[data-marker-return]")
    ?.addEventListener("click", () => {
      if (marker) location.hash = marker.stop;
      notice.hidden = true;
    });
  sync();
  if (marker && returning) {
    const copy = notice.querySelector("[data-marker-notice-copy]");
    if (copy)
      copy.textContent = `You left a marker at ${title(marker.stop)} on ${date(marker.at)}. Go back to it?`;
    notice.hidden = false;
  }
}

onExhibitsReady(async (registry) => {
  const { mountMarker } = await import("../gallery/marker");
  if (registry.disposed) return;
  return mountMarker(registry, () => marker);
});
