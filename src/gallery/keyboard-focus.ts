import type { GalleryApp } from "./types";

/** Keep the rail on a keyboard-focused exhibit after native focus scrolling. */
export function mountKeyboardFocus(app: GalleryApp) {
  let keyboard = false;
  let frame = 0;
  const key = (event: KeyboardEvent) => {
    if (event.key === "Tab") keyboard = true;
  };
  const pointer = () => {
    keyboard = false;
    cancelAnimationFrame(frame);
    frame = 0;
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
        if (
          app.disposed ||
          !keyboard ||
          !section.contains(document.activeElement)
        )
          return;
        const bounds = section.getBoundingClientRect();
        const distance = bounds.top + bounds.height / 2 - innerHeight / 2;
        // This also cancels a queued smooth native focus-scroll when the
        // section is still centered at this instant but would move next frame.
        window.scrollTo({ top: scrollY + distance, behavior: "instant" });
        app.requestRender();
      });
    });
  }
  document.addEventListener("keydown", key);
  document.addEventListener("pointerdown", pointer, { passive: true });
  document.addEventListener("focusin", focus);
  document.addEventListener("wheel", pointer, { passive: true });
  return () => {
    cancelAnimationFrame(frame);
    document.removeEventListener("keydown", key);
    document.removeEventListener("pointerdown", pointer);
    document.removeEventListener("focusin", focus);
    document.removeEventListener("wheel", pointer);
  };
}
