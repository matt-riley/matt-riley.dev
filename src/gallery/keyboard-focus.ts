import type { GalleryApp } from "./types";

/** Keep the rail on a keyboard-focused exhibit after native focus scrolling. */
export function mountKeyboardFocus(app: GalleryApp) {
  const sections = [
    ...document.querySelectorAll<HTMLElement>("section[data-exhibit]"),
  ];
  let keyboard = false;
  let frame = 0;
  const key = (event: KeyboardEvent) => {
    if (event.key === "Tab") keyboard = true;
  };
  const pointer = () => {
    keyboard = false;
  };
  function focus(event: FocusEvent) {
    cancelAnimationFrame(frame);
    const section =
      event.target instanceof HTMLElement
        ? event.target.closest<HTMLElement>("section[data-exhibit]")
        : null;
    if (
      !keyboard ||
      !section ||
      document.documentElement.dataset.gallery !== "ready"
    )
      return;
    // Browser focus scrolling and the rail's layout read happen first. This
    // corrects one focus action; it never constrains wheel or touch scrolling.
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (app.disposed || !section.contains(document.activeElement)) return;
        if (sections.indexOf(section) !== app.activeStop) {
          section.scrollIntoView({ block: "center", behavior: "instant" });
          app.requestRender();
        }
      });
    });
  }
  document.addEventListener("keydown", key);
  document.addEventListener("pointerdown", pointer, { passive: true });
  document.addEventListener("focusin", focus);
  return () => {
    cancelAnimationFrame(frame);
    document.removeEventListener("keydown", key);
    document.removeEventListener("pointerdown", pointer);
    document.removeEventListener("focusin", focus);
  };
}
