/** Swap the optional remote GitHub portrait for its local printed fallback. */
export function initAvatarFallback(): void {
  const hide = (img: HTMLImageElement) => {
    img.hidden = true;
    img.setAttribute("aria-hidden", "true");
  };

  for (const img of document.querySelectorAll<HTMLImageElement>("[data-dossier-avatar]")) {
    img.addEventListener("error", () => hide(img), { once: true });
    if (img.complete && img.naturalWidth === 0) hide(img);
  }
}
