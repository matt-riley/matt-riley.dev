import type { ToolboxRuntime } from "./immersive-toolbox-runtime";

export function mountToolboxViewer(root: HTMLElement): () => void {
  const start = root.querySelector<HTMLButtonElement>("[data-toolbox-start]");
  const live = root.querySelector<HTMLElement>("[data-toolbox-live]");
  const host = root.querySelector<HTMLElement>("[data-toolbox-canvas]");
  const status = root.querySelector<HTMLElement>("[data-toolbox-status]");
  const openButton = root.querySelector<HTMLButtonElement>(
    '[data-toolbox-action="open"]',
  );
  const collection = root.closest("details");
  const stage = root.closest(".collection-stage");
  if (!start || !live || !host || !status || !openButton) return () => {};
  let runtime: ToolboxRuntime | undefined;
  let pending: AbortController | undefined;
  let generation = 0;
  let open = true;
  let disposed = false;
  const photograph = (message = "Photograph restored.", focus = false) => {
    generation++;
    pending?.abort();
    pending = undefined;
    runtime?.dispose();
    runtime = undefined;
    live.hidden = true;
    start.hidden = false;
    start.disabled = false;
    start.removeAttribute("aria-disabled");
    start.removeAttribute("aria-busy");
    start.textContent = "Pick up the toolbox ↗";
    root.dataset.state = "photo";
    stage?.classList.remove("is-handling-toolbox");
    status.textContent = message;
    if (focus) start.focus({ preventScroll: true });
  };
  const unavailable = () => {
    photograph(
      "The 3D view is unavailable here. The photograph and project links are still ready to explore.",
      root.contains(document.activeElement),
    );
    root.dataset.state = "unavailable";
    start.textContent = "Try 3D again ↗";
  };
  const activate = async () => {
    if (root.dataset.state === "loading" || disposed) return;
    const ticket = ++generation;
    start.setAttribute("aria-disabled", "true");
    start.setAttribute("aria-busy", "true");
    start.textContent = "Picking it up…";
    root.dataset.state = "loading";
    status.textContent = "Loading the ceramic toolbox.";
    try {
      const { createToolboxRuntime } = await import(
        "./immersive-toolbox-runtime"
      );
      if (disposed || ticket !== generation) return;
      // Keep the photograph visible until the real model has rendered.
      live.hidden = false;
      live.style.visibility = "hidden";
      pending = new AbortController();
      const instance = await createToolboxRuntime(
        host,
        unavailable,
        pending.signal,
      );
      if (disposed || ticket !== generation) {
        instance.dispose();
        return;
      }
      runtime = instance;
      open = true;
      openButton.textContent = "Close toolbox";
      live.style.visibility = "";
      const focusOwned = root.contains(document.activeElement);
      start.hidden = true;
      root.dataset.state = "ready";
      stage?.classList.add("is-handling-toolbox");
      status.textContent = "Toolbox open. Use the buttons or drag to turn it.";
      if (focusOwned) openButton.focus({ preventScroll: true });
    } catch (error) {
      if (!disposed && ticket === generation) {
        console.warn("Unable to open the toolbox.", error);
        live.style.visibility = "";
        unavailable();
      }
    }
  };

  const action = (event: Event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "[data-toolbox-action]",
    );
    if (!button || !runtime) return;
    switch (button.dataset.toolboxAction) {
      case "photo":
        photograph("Photograph restored.", true);
        break;
      case "left":
        runtime.turn(-1);
        status.textContent = "Toolbox turned left.";
        break;
      case "right":
        runtime.turn(1);
        status.textContent = "Toolbox turned right.";
        break;
      case "open":
        open = !open;
        runtime.setOpen(open);
        openButton.textContent = open ? "Close toolbox" : "Open toolbox";
        status.textContent = open ? "Toolbox open." : "Toolbox closed.";
        break;
    }
  };
  const onToggle = () => {
    if (collection && !collection.open) photograph("Photograph restored.");
  };
  start.hidden = false;
  start.addEventListener("click", activate);
  root.addEventListener("click", action);
  collection?.addEventListener("toggle", onToggle);
  return () => {
    if (disposed) return;
    disposed = true;
    generation++;
    pending?.abort();
    pending = undefined;
    runtime?.dispose();
    start.removeEventListener("click", activate);
    root.removeEventListener("click", action);
    collection?.removeEventListener("toggle", onToggle);
    start.hidden = true;
    live.hidden = true;
    stage?.classList.remove("is-handling-toolbox");
  };
}
