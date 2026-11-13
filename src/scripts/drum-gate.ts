import { mountDrumPads } from "../gallery/drum-pads";
import { onExhibitsReady } from "../gallery/exhibit-state";
import {
  type DrumPattern,
  decodePattern,
  drumRows,
  encodePattern,
  type PresetName,
  presetPattern,
} from "./drum-pattern";
import { get, set } from "./settings";
import { requestSound } from "./sound-gate";

type Sequencer = ReturnType<typeof import("./drums")["createSequencer"]>;
const root = document.querySelector<HTMLElement>("[data-drum-machine]");
if (root) mountControls(root);

function mountControls(root: HTMLElement) {
  let pattern: DrumPattern = presetPattern("Head nod"),
    selectedRow = 0,
    selectedStep = 0,
    playhead = -1;
  let near = false,
    wantsPlay = false,
    generation = 0,
    sequencer: Sequencer | undefined,
    loading: Promise<typeof import("./drums") | undefined> | undefined;
  const play = root.querySelector<HTMLButtonElement>("[data-drum-play]"),
    consent = root.querySelector<HTMLElement>("[data-drum-consent]"),
    status = root.querySelector<HTMLElement>("[data-drum-status]");
  const tempo = root.querySelector<HTMLInputElement>("[data-drum-tempo]"),
    swing = root.querySelector<HTMLInputElement>("[data-drum-swing]"),
    preset = root.querySelector<HTMLSelectElement>("[data-drum-preset]"),
    rowSelect = root.querySelector<HTMLSelectElement>("[data-drum-row-select]");
  const visualTimers = new Set<ReturnType<typeof setTimeout>>();
  const button = (row: number, step: number) =>
    root.querySelector<HTMLButtonElement>(
      `[data-drum-row="${row}"][data-drum-step="${step}"]`,
    ) ?? undefined;
  const announce = (text: string) => {
    if (status) status.textContent = text;
  };
  const emit = () => document.dispatchEvent(new Event("mr:drum-state"));
  function render() {
    for (let row = 0; row < 4; row++)
      for (let step = 0; step < 16; step++) {
        const pad = button(row, step);
        if (!pad) continue;
        const pressed = String(Boolean(pattern.rows[row] & (1 << step)));
        if (pad.getAttribute("aria-pressed") !== pressed)
          pad.setAttribute("aria-pressed", pressed);
        pad.tabIndex = row === selectedRow && step === selectedStep ? 0 : -1;
        pad.toggleAttribute("data-playhead", playhead === step);
      }
    if (tempo) {
      tempo.value = String(pattern.tempo);
      tempo.setAttribute("aria-valuetext", `${pattern.tempo} beats per minute`);
    }
    if (swing) {
      swing.value = String(pattern.swing);
      swing.setAttribute("aria-valuetext", `${pattern.swing} percent`);
    }
    const bpm = root.querySelector("[data-drum-tempo-value]"),
      feel = root.querySelector("[data-drum-swing-value]"),
      share = root.querySelector<HTMLAnchorElement>("[data-drum-share]");
    if (bpm) bpm.textContent = `${pattern.tempo} BPM`;
    if (feel) feel.textContent = `${pattern.swing}%`;
    if (share) share.href = `#boom=${encodePattern(pattern)}`;
    if (rowSelect) rowSelect.selectedIndex = selectedRow;
    emit();
  }
  function changed() {
    if (preset) preset.value = "custom";
    history.replaceState(null, "", `#boom=${encodePattern(pattern)}`);
    render();
  }
  function stopped() {
    wantsPlay = false;
    playhead = -1;
    visualTimers.forEach(clearTimeout);
    visualTimers.clear();
    if (play) {
      play.textContent = "Play";
      play.setAttribute("aria-pressed", "false");
    }
    render();
    announce("Stopped.");
  }
  function stop() {
    generation++;
    if (consent) consent.hidden = true;
    sequencer?.stop();
    stopped();
  }
  function load() {
    if (!near || (get("sound") !== "on" && !wantsPlay)) return;
    loading ??= import("./drums").catch(() => {
      loading = undefined;
      stop();
      announce("The drum machine could not start.");
      return undefined;
    });
    return loading;
  }
  async function start() {
    try {
      if (!near || !wantsPlay || get("sound") !== "on") return;
      const token = ++generation;
      if (play) {
        play.textContent = "Stop";
        play.setAttribute("aria-pressed", "true");
      }
      const [loaded, engine] = await Promise.all([load(), requestSound()]);
      if (
        token !== generation ||
        !wantsPlay ||
        !loaded ||
        !engine ||
        document.hidden ||
        get("sound") !== "on"
      )
        return;
      sequencer ??= loaded.createSequencer(engine, () => pattern, {
        step(note) {
          document.dispatchEvent(
            new CustomEvent("mr:drum-scheduled", { detail: note }),
          );
          const timer = setTimeout(
            () => {
              visualTimers.delete(timer);
              if (!sequencer?.playing) return;
              playhead = note.step;
              render();
              document.dispatchEvent(
                new CustomEvent("mr:drum-step", { detail: note }),
              );
            },
            Math.max(0, (note.when - engine.context.currentTime) * 1000),
          );
          visualTimers.add(timer);
        },
        stopped,
      });
      sequencer.start();
      announce("Playing.");
    } catch {
      stop();
      announce("The drum machine could not start.");
    }
  }
  function playPressed() {
    if (wantsPlay && (sequencer?.playing || consent?.hidden)) {
      stop();
      announce("Stopped.");
      return;
    }
    wantsPlay = true;
    void load();
    if (get("sound") === "off") {
      if (consent) consent.hidden = false;
      root.querySelector<HTMLButtonElement>("[data-drum-yes]")?.focus();
    } else void start();
  }
  play?.addEventListener("click", playPressed);
  root.querySelector("[data-drum-yes]")?.addEventListener("click", () => {
    if (consent) consent.hidden = true;
    set("sound", "on");
    void start();
    play?.focus();
  });
  root.querySelector("[data-drum-no]")?.addEventListener("click", () => {
    if (consent) consent.hidden = true;
    stop();
    announce("Sound stays off.");
    play?.focus();
  });
  root.querySelector("[data-drum-clear]")?.addEventListener("click", () => {
    pattern.rows = [0, 0, 0, 0];
    changed();
    announce("Pattern cleared.");
  });
  preset?.addEventListener("change", () => {
    const name = preset.value;
    if (["Head nod", "Late bus", "Sunday"].includes(name)) {
      pattern = presetPattern(name as PresetName);
      changed();
      preset.value = name;
      announce(`${name} loaded.`);
    }
  });
  rowSelect?.addEventListener("change", () => {
    selectedRow = rowSelect.selectedIndex;
    render();
  });
  tempo?.addEventListener("input", () => {
    pattern.tempo = Math.max(
      70,
      Math.min(110, Math.round(Number(tempo.value))),
    );
    changed();
  });
  swing?.addEventListener("input", () => {
    pattern.swing = Math.max(50, Math.min(66, Math.round(Number(swing.value))));
    changed();
  });
  root.querySelector(".drum-grid")?.addEventListener("click", (event) => {
    const pad = (event.target as Element).closest<HTMLButtonElement>(
      "[data-drum-step]",
    );
    if (!pad) return;
    selectedRow = Number(pad.dataset.drumRow);
    selectedStep = Number(pad.dataset.drumStep);
    const drawer = root.closest<HTMLDetailsElement>("details[data-reveal]");
    if (drawer && !drawer.open) {
      drawer.open = true;
      requestAnimationFrame(() =>
        root.scrollIntoView({ block: "nearest", inline: "nearest" }),
      );
    }
    pattern.rows[selectedRow] ^= 1 << selectedStep;
    changed();
    if (document.activeElement !== pad)
      announce(
        `${drumRows[selectedRow]}, step ${selectedStep + 1}: ${pattern.rows[selectedRow] & (1 << selectedStep) ? "on" : "off"}.`,
      );
    document.getElementById("human-error")?.dispatchEvent(
      new CustomEvent("mr:touch", {
        bubbles: true,
        detail: {
          exhibit: "human-error",
          model: "boom-bap",
          part: `touch_pad_${selectedStep}`,
        },
      }),
    );
  });
  root.querySelector(".drum-grid")?.addEventListener("keydown", (event) => {
    const key = event as KeyboardEvent,
      pad = (event.target as Element).closest<HTMLButtonElement>(
        "[data-drum-step]",
      );
    if (!pad) return;
    let row = Number(pad.dataset.drumRow),
      step = Number(pad.dataset.drumStep);
    if (key.key === "ArrowRight") step = (step + 1) % 16;
    else if (key.key === "ArrowLeft") step = (step + 15) % 16;
    else if (key.key === "ArrowDown") row = (row + 1) % 4;
    else if (key.key === "ArrowUp") row = (row + 3) % 4;
    else if (key.key === "Home") {
      step = 0;
      if (key.ctrlKey) row = 0;
    } else if (key.key === "End") {
      step = 15;
      if (key.ctrlKey) row = 3;
    } else return;
    key.preventDefault();
    selectedRow = row;
    selectedStep = step;
    render();
    const target = button(row, step);
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: "nearest", inline: "nearest" });
  });
  const section = document.getElementById("human-error");
  function shared() {
    if (!location.hash.startsWith("#boom=")) return;
    const decoded = decodePattern(location.hash.slice(6));
    stop();
    if (!decoded) {
      announce("That pattern link could not be read.");
      return;
    }
    pattern = decoded;
    if (preset) preset.value = "custom";
    const drawer = root.closest<HTMLDetailsElement>("details[data-reveal]");
    if (drawer) drawer.open = true;
    render();
    section?.scrollIntoView({ block: "center", behavior: "instant" });
    requestAnimationFrame(() =>
      root.scrollIntoView({
        block: "nearest",
        inline: "nearest",
        behavior: "instant",
      }),
    );
    announce("Shared pattern loaded. Not playing.");
  }
  window.addEventListener("hashchange", shared);
  new IntersectionObserver(
    (entries) => {
      near = entries.some((entry) => entry.isIntersecting);
      if (near) {
        void load();
        if (wantsPlay && consent?.hidden) void start();
      }
    },
    { rootMargin: "100% 0px" },
  ).observe(section ?? root);
  let scrollQueued = false;
  window.addEventListener(
    "scroll",
    () => {
      if (!wantsPlay || scrollQueued) return;
      scrollQueued = true;
      requestAnimationFrame(() => {
        scrollQueued = false;
        let closest = 0,
          distance = Infinity;
        document
          .querySelectorAll<HTMLElement>("section[data-exhibit]")
          .forEach((element, index) => {
            const rect = element.getBoundingClientRect(),
              current = Math.abs(rect.top + rect.height / 2 - innerHeight / 2);
            if (current < distance) {
              distance = current;
              closest = index;
            }
          });
        if (Math.abs(closest - 7) > 1) {
          stop();
          announce("Stopped as you left the exhibit.");
        }
      });
    },
    { passive: true },
  );
  document.addEventListener("mr:setting", (event) => {
    if ((event as CustomEvent).detail?.key !== "sound") return;
    if (get("sound") === "off") {
      stop();
      announce("Stopped.");
    } else {
      void load();
      if (wantsPlay && consent?.hidden) void start();
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stop();
      announce("Stopped.");
    }
  });
  window.addEventListener("pagehide", () => {
    stop();
    sequencer?.dispose();
    sequencer = undefined;
  });
  onExhibitsReady((registry) =>
    mountDrumPads(registry, () => ({ pattern, selectedRow, playhead }), button),
  );
  root
    .querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLSelectElement>(
      "[disabled]",
    )
    .forEach((element) => {
      element.disabled = false;
    });
  render();
  shared();
}
