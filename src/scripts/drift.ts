/**
 * Restrained physical drift: registration layers slide a few pixels with the
 * pointer, and stay put entirely under prefers-reduced-motion.
 */
export function initRegistrationDrift(): void {
  for (const stack of document.querySelectorAll(
    '.censor-stack[aria-hidden="true"]',
  )) {
    stack.setAttribute("data-registration-layer", "");
  }

  const layers = document.querySelectorAll<HTMLElement>(
    "[data-registration-layer]",
  );
  if (layers.length === 0) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  addEventListener(
    "pointermove",
    (event) => {
      const driftX = (event.clientX / window.innerWidth - 0.5) * 4;
      const driftY = (event.clientY / window.innerHeight - 0.5) * 4;
      for (const layer of layers) {
        layer.style.setProperty("--drift-x", `${driftX.toFixed(2)}px`);
        layer.style.setProperty("--drift-y", `${driftY.toFixed(2)}px`);
      }
    },
    { passive: true },
  );
}
