import { get, set } from "./settings";
import type { SoundEngine } from "./sound";

type SoundMount = ReturnType<typeof import("./sound")["mountSound"]>;
let context: AudioContext | undefined;
let mounted: SoundMount | undefined;
let implementation: typeof import("./sound") | undefined;
let starting: Promise<SoundEngine | undefined> | undefined;
let suspending: Promise<void> | undefined;
let active = false,
  away = false,
  confirmation = false,
  lastGesture = -Infinity;

function status() {
  const on = get("sound") === "on";
  document.documentElement.dataset.audio = on
    ? active
      ? "ready"
      : "pending"
    : "off";
  for (const control of document.querySelectorAll(
    '[data-setting="sound"], [data-flagz-setting="sound"]',
  )) {
    if (on && !active)
      control.setAttribute(
        "aria-description",
        "Sound is enabled. It starts on your next touch.",
      );
    else control.removeAttribute("aria-description");
  }
}
function suspend() {
  active = false;
  confirmation = false;
  mounted?.engine.setMuted(true);
  if (context && context.state !== "closed") {
    const task = context.suspend().catch(() => {});
    suspending = task;
    void task.finally(() => {
      if (suspending === task) suspending = undefined;
    });
  }
  status();
}

/** The tiny gesture bridge unlocks audio synchronously; synthesis remains lazy. */
export function requestSound(
  confirm = false,
): Promise<SoundEngine | undefined> {
  if (away || document.hidden || get("sound") !== "on")
    return Promise.resolve(undefined);
  confirmation ||= confirm;
  if (active && mounted && context?.state === "running") {
    if (confirmation) {
      confirmation = false;
      mounted.engine.clink();
    }
    return Promise.resolve(mounted.engine);
  }
  if (starting) return starting;
  const gesture =
    navigator.userActivation?.isActive || performance.now() - lastGesture < 100;
  if (!context && !gesture) {
    status();
    return Promise.resolve(undefined);
  }
  try {
    // Creating/resuming before import() preserves the gesture on strict autoplay engines.
    if (!context) {
      const created = new AudioContext();
      context = created;
      created.addEventListener("statechange", () => {
        if (context !== created) return;
        if (created.state !== "running") active = false;
        status();
      });
    }
    const audio = context;
    const resumed = suspending
      ? suspending.then(() => audio.resume())
      : audio.resume();
    starting = Promise.all([
      implementation ? Promise.resolve(implementation) : import("./sound"),
      resumed,
    ])
      .then(async ([module]) => {
        implementation = module;
        if (away || document.hidden || get("sound") !== "on") {
          suspend();
          return;
        }
        if (suspending) await suspending;
        if (audio.state !== "running") await audio.resume();
        if (away || document.hidden || get("sound") !== "on") {
          suspend();
          return;
        }
        mounted ??= module.mountSound(audio);
        mounted.engine.setMuted(false);
        active = true;
        mounted.refresh();
        status();
        if (confirmation) {
          confirmation = false;
          mounted.engine.clink();
        }
        return mounted.engine;
      })
      .catch(() => {
        suspend();
        set("sound", "off");
        return undefined;
      })
      .finally(() => {
        starting = undefined;
      });
    status();
    return starting;
  } catch {
    suspend();
    set("sound", "off");
    return Promise.resolve(undefined);
  }
}
function activity(event: Event) {
  if (!event.isTrusted) return;
  lastGesture = performance.now();
  if (get("sound") === "on" && (!active || context?.state !== "running"))
    void requestSound();
}
for (const event of ["click", "keydown", "pointerup"])
  document.addEventListener(event, activity, { capture: true, passive: true });
document.addEventListener("mr:setting", (event) => {
  if ((event as CustomEvent).detail?.key !== "sound") return;
  if (get("sound") === "off") suspend();
  else void requestSound(true);
});
document.addEventListener("mr:touch", (event) => {
  if (active || get("sound") !== "on") return;
  void requestSound().then((engine) => {
    if (engine) mounted?.touch(event);
  });
});
document.addEventListener("mr:waffle-character", (event) => {
  if (active || !(event as CustomEvent).detail?.typing || get("sound") !== "on")
    return;
  void requestSound().then((engine) => {
    engine?.key();
  });
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) suspend();
  else if (context && get("sound") === "on") void requestSound();
});
window.addEventListener("pagehide", () => {
  away = true;
  suspend();
  mounted?.dispose();
  mounted = undefined;
});
window.addEventListener("pageshow", () => {
  away = false;
  if (context && get("sound") === "on") void requestSound();
});
status();
