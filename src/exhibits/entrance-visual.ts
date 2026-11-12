import type { ExhibitRegistry } from "../gallery/exhibits";

export function mountEntrance(registry: ExhibitRegistry) {
  const record = registry.records.get("entrance");
  const rope = record?.parts.get("touch_rope");
  if (!rope) return;
  const wall = document.querySelector<HTMLElement>(".gallery-wall-title");
  const heading = document.getElementById("entrance-heading");
  const hours = document.querySelector<HTMLElement>("[data-opening-hours]");
  const clock = document.createElement("span");
  clock.className = "gallery-opening-hours mono";
  const syncHours = () => {
    clock.textContent = hours?.textContent ?? "";
  };
  if (wall && heading) {
    wall.replaceChildren(
      ...[...heading.childNodes].map((node) => node.cloneNode(true)),
      clock,
    );
    syncHours();
  }
  const clockChanges = new MutationObserver(syncHours);
  if (hours)
    clockChanges.observe(hours, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  const axis = rope.userData.axis;
  const base = rope.rotation[axis];
  const amplitude = Math.max(...rope.userData.range.map(Math.abs));
  let elapsed = 3;
  const releaseHandler = registry.setTouchHandler("entrance", () => {
    elapsed = 0;
    registry.app.requestRender();
  });
  const releaseDrag = registry.setDraggable("entrance", false);
  const releaseFrame = registry.app.onFrame((delta) => {
    if (elapsed >= 3) return false;
    elapsed = Math.min(3, elapsed + delta);
    rope.rotation[axis] =
      base +
      (elapsed < 3
        ? amplitude * Math.exp(-1.6 * elapsed) * Math.sin(elapsed * 11)
        : 0);
    return elapsed < 3;
  });
  return () => {
    clockChanges.disconnect();
    releaseFrame();
    releaseHandler();
    releaseDrag();
    rope.rotation[axis] = base;
  };
}
