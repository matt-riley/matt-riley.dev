/** The MPC-style activity pads: pressing a block reads out its event. */
export function initActivityPads(): void {
  const readout = document.querySelector("#activity-readout");
  const pads = [
    ...document.querySelectorAll<HTMLButtonElement>("[data-activity-pad]"),
  ];

  for (const pad of pads) {
    pad.addEventListener("click", () => {
      for (const other of pads) {
        other.setAttribute("aria-pressed", String(other === pad));
      }
      if (readout) readout.textContent = pad.dataset.message ?? "NO PUBLIC SIGNAL";
    });
  }
}

/** Swap the halftone portrait for its printed fallback if the avatar 404s. */
export function initAvatarFallback(): void {
  const hide = (img: HTMLImageElement) => {
    img.hidden = true;
    img.setAttribute("aria-hidden", "true");
  };

  for (const img of document.querySelectorAll<HTMLImageElement>(
    "[data-dossier-avatar]",
  )) {
    img.addEventListener("error", () => hide(img), { once: true });
    if (img.complete && img.naturalWidth === 0) hide(img);
  }
}
