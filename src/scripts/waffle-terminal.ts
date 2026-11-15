import { onExhibitsReady } from "../gallery/exhibit-state";

const section = document.getElementById("waffle-agent");
const terminal = section?.querySelector<HTMLElement>("[data-terminal]");
const output = terminal?.querySelector<HTMLElement>("[data-terminal-output]");
const result = section?.querySelector<HTMLElement>("[data-touch-result]");
if (section && terminal && output && result) {
  result.classList.add("sr-only");
  const lines: string[] = JSON.parse(terminal.dataset.lines ?? "[]");
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  let line = 0,
    character = 0,
    typing = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  section.dataset.manualTouch = "";
  const notify = () => {
    terminal.dataset.typing = String(typing);
    terminal.dataset.character = String(Math.max(0, character - 1) % 36);
    terminal.dispatchEvent(
      new CustomEvent("mr:waffle-character", {
        bubbles: true,
        detail: { index: Math.max(0, character - 1) % 36, typing },
      }),
    );
  };
  const finish = () => {
    clearTimeout(timer);
    typing = false;
    const text = lines[line];
    output.textContent = text;
    character = text.length;
    result.textContent = text;
    line = (line + 1) % lines.length;
    notify();
  };
  const step = () => {
    if (!typing) return;
    character++;
    output.textContent = lines[line].slice(0, character);
    notify();
    if (character >= lines[line].length) finish();
    else timer = setTimeout(step, 1000 / 28);
  };
  section.addEventListener("mr:touch", () => {
    if (!lines.length) return;
    if (typing) {
      finish();
      return;
    }
    typing = true;
    character = 0;
    result.textContent = "";
    output.textContent = "";
    if (motion.matches) finish();
    else step();
  });
  motion.addEventListener("change", () => {
    if (motion.matches && typing) finish();
  });
}

onExhibitsReady(async (registry) => {
  const { mountWaffleCursor } = await import("../gallery/waffle-cursor");
  if (registry.disposed) return;
  return mountWaffleCursor(registry);
});
