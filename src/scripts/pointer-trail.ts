interface Mote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  alpha: number;
  phase: number;
  alive: boolean;
}

const COUNT = 160;
const STEP = 12;
const IDLE_INTERVAL = 420;

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

export function initPointerTrail(): void {
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (!finePointer) return;

  const canvas = document.createElement("canvas");
  canvas.className = "pointer-trail";
  canvas.setAttribute("aria-hidden", "true");
  document.body.appendChild(canvas);
  const context = canvas.getContext("2d");
  if (!context) return;

  const motes: Mote[] = Array.from({ length: COUNT }, () => ({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    age: 1,
    life: 1,
    size: 1,
    alpha: 0,
    phase: 0,
    alive: false,
  }));

  let width = window.innerWidth;
  let height = window.innerHeight;
  let dpr = 1;
  let emitterX = width * 0.5;
  let emitterY = height * 0.5;
  let targetX = emitterX;
  let targetY = emitterY;
  let previousX = emitterX;
  let previousY = emitterY;
  let accumulated = 0;
  let cursorIndex = 0;
  let idleClock = 0;
  let pointerActive = false;
  let hidden = document.hidden;
  let frame = 0;
  let lastTime = performance.now();

  const resize = () => {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawStillIfReduced();
  };

  const signalColor = () =>
    getComputedStyle(document.documentElement).getPropertyValue("--signal").trim() || "#65f4df";

  const spawn = (x: number, y: number, idle = false) => {
    const mote = motes[cursorIndex]!;
    cursorIndex = (cursorIndex + 1) % motes.length;
    const spread = idle ? 0.9 : 1.4;
    mote.x = x + (Math.random() - 0.5) * spread;
    mote.y = y + (Math.random() - 0.5) * spread;
    mote.vx = (Math.random() - 0.5) * (idle ? 5 : 16);
    mote.vy = -4 - Math.random() * (idle ? 7 : 13);
    mote.age = 0;
    mote.life = idle ? 2200 + Math.random() * 700 : 1150 + Math.random() * 1200;
    mote.size = 0.8 + Math.random() * 2.4;
    mote.alpha = 0.3 + Math.random() * 0.45;
    mote.phase = Math.random() * Math.PI * 2;
    mote.alive = true;
  };

  const drawStillIfReduced = () => {
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    context.clearRect(0, 0, width, height);
    context.fillStyle = signalColor();
    for (let index = 0; index < 26; index += 1) {
      const progress = index / 25;
      const x = width * (0.12 + progress * 0.48);
      const y = height * (0.72 - progress * 0.34);
      const radius = 0.7 + (index % 4) * 0.45;
      context.globalAlpha = 0.18 + (1 - progress) * 0.35;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  };

  const draw = (timestamp: number) => {
    const dt = clamp(timestamp - lastTime, 0, 34);
    lastTime = timestamp;
    if (hidden) {
      frame = 0;
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      drawStillIfReduced();
      frame = 0;
      return;
    }

    const seconds = dt / 1000;
    const ease = 1 - Math.exp(-16 * seconds);
    emitterX += (targetX - emitterX) * ease;
    emitterY += (targetY - emitterY) * ease;

    const dx = emitterX - previousX;
    const dy = emitterY - previousY;
    const moved = Math.hypot(dx, dy);
    if (moved > 0.01) {
      accumulated += moved;
      idleClock = 0;
      let guard = 0;
      while (accumulated >= STEP && guard < 14) {
        const distanceFromEnd = accumulated - STEP;
        const t = moved > 0 ? clamp((moved - distanceFromEnd) / moved, 0, 1) : 1;
        spawn(previousX + dx * t, previousY + dy * t);
        accumulated -= STEP;
        guard += 1;
      }
    } else if (pointerActive) {
      idleClock += dt;
      if (idleClock >= IDLE_INTERVAL) {
        idleClock -= IDLE_INTERVAL;
        spawn(emitterX, emitterY, true);
      }
    }
    previousX = emitterX;
    previousY = emitterY;

    context.clearRect(0, 0, width, height);
    context.fillStyle = signalColor();
    context.globalCompositeOperation = "lighter";

    for (const mote of motes) {
      if (!mote.alive) continue;
      mote.age += dt;
      if (mote.age >= mote.life) {
        mote.alive = false;
        continue;
      }
      const life = mote.age / mote.life;
      mote.vx *= Math.pow(0.5, seconds);
      mote.vy *= Math.pow(0.5, seconds);
      mote.vy -= 3.2 * seconds;
      mote.x += mote.vx * seconds;
      mote.y += mote.vy * seconds;
      const fadeIn = clamp(life / 0.12, 0, 1);
      const fadeOut = clamp((1 - life) / 0.22, 0, 1);
      const curl = Math.sin(timestamp * 0.0011 + mote.phase) * 0.15;
      const alpha = mote.alpha * fadeIn * fadeOut;
      context.globalAlpha = alpha * 0.18;
      context.beginPath();
      context.arc(mote.x, mote.y, mote.size * 3.2, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = alpha * (0.65 + curl);
      context.beginPath();
      context.arc(mote.x, mote.y, mote.size, 0, Math.PI * 2);
      context.fill();
    }

    context.globalAlpha = 1;
    context.globalCompositeOperation = "source-over";
    frame = window.requestAnimationFrame(draw);
  };

  const reset = () => {
    accumulated = 0;
    idleClock = 0;
    pointerActive = false;
    for (const mote of motes) mote.alive = false;
  };

  window.addEventListener("pointermove", (event) => {
    targetX = event.clientX;
    targetY = event.clientY;
    if (!pointerActive) {
      emitterX = targetX;
      emitterY = targetY;
      previousX = targetX;
      previousY = targetY;
      pointerActive = true;
    }
  }, { passive: true });
  window.addEventListener("resize", resize, { passive: true });
  window.addEventListener("blur", reset);
  document.addEventListener("visibilitychange", () => {
    hidden = document.hidden;
    if (hidden && frame !== 0) {
      window.cancelAnimationFrame(frame);
      frame = 0;
    } else if (!hidden && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      lastTime = performance.now();
      frame = window.requestAnimationFrame(draw);
    }
  });

  const themeObserver = new MutationObserver(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) drawStillIfReduced();
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  resize();
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) drawStillIfReduced();
  else frame = window.requestAnimationFrame(draw);
}
