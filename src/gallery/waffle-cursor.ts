import type { ExhibitRegistry } from "./exhibits";
import { animatePart } from "./parts";

export function cursorCell(index: number) {
  const cell = Number.isFinite(index)
    ? Math.max(0, Math.min(35, Math.trunc(index)))
    : 0;
  return {
    x: -0.12 + (cell % 6) * 0.048,
    z: 0.12 - Math.floor(cell / 6) * 0.048,
  };
}

export function mountWaffleCursor(registry: ExhibitRegistry) {
  return registry.onRecord((record) => {
    if (record.id !== "waffle-agent") return;
    const part = record?.parts.get("touch_cursor");
    const terminal =
      record?.section.querySelector<HTMLElement>("[data-terminal]");
    if (!part || !terminal) return;
    let typing = false;
    const move = (index: number) => {
      const cell = cursorCell(index);
      part.position.x = cell.x;
      part.position.z = cell.z;
    };
    const update = () => {
      typing = terminal.dataset.typing === "true";
      move(Number(terminal.dataset.character ?? 0));
      part.scale.setScalar(1);
      if (typing)
        animatePart(part, 1, {
          duration: 0.015,
          onComplete: () => {
            if (!registry.disposed) animatePart(part, 0, { duration: 0.02 });
          },
        });
      else animatePart(part, 0);
      registry.app.requestRender();
    };
    terminal.addEventListener("mr:waffle-character", update);
    const stopHandler = registry.setTouchHandler(record.id, () => {});
    const stopFrame = registry.app.onFrame(
      (_delta, time = performance.now() / 1000) => {
        if (registry.app.activeStop !== 3 || typing) return false;
        part.scale.setScalar(1 + Math.sin(time * Math.PI * 2) * 0.04);
        return true;
      },
    );
    update();
    return () => {
      terminal.removeEventListener("mr:waffle-character", update);
      stopHandler();
      stopFrame();
      part.scale.setScalar(1);
    };
  });
}
