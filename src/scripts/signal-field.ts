interface SignalDatum {
  repo: string;
  kind: string;
  occurredAt: string;
}

interface SignalPoint {
  x: number;
  y: number;
  radius: number;
  label: string;
}

const hash = (value: string): number => {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0) / 4294967295;
};

export function initSignalField(): void {
  for (const field of document.querySelectorAll<HTMLElement>("[data-signal-field]")) {
    const canvas = field.querySelector<HTMLCanvasElement>("[data-signal-canvas]");
    if (!canvas) continue;
    const context = canvas.getContext("2d");
    if (!context) continue;

    let data: SignalDatum[] = [];
    try {
      data = JSON.parse(field.dataset.signalData ?? "[]") as SignalDatum[];
    } catch {
      data = [];
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const points: SignalPoint[] = [];
    const source = data.length > 0 ? data : [{ repo: "archive", kind: "quiet", occurredAt: "" }];
    let width = 0;
    let height = 0;
    let signal = "#65f4df";
    let inverseInk = "#f1f0eb";
    let inverse = "#0b0d0e";
    let phase = 0;
    let frame = 0;
    let active = true;
    let hidden = document.hidden;

    const buildPoints = () => {
      points.length = 0;
      const count = Math.max(source.length, 2);
      source.forEach((entry, index) => {
        const seed = hash(`${entry.repo}:${entry.kind}:${entry.occurredAt}`);
        const x = 44 + (index / (count - 1)) * Math.max(width - 84, 1);
        const y = height * (0.52 - (0.12 + seed * 0.24) * (index % 2 === 0 ? 1 : -1));
        points.push({
          x,
          y,
          radius: 2.5 + seed * 3.5,
          label: entry.repo,
        });
      });
    };

    const updateColors = () => {
      const styles = getComputedStyle(field);
      signal = styles.getPropertyValue("--signal").trim() || "#65f4df";
      inverseInk = styles.getPropertyValue("--inverse-ink").trim() || "#f1f0eb";
      inverse = styles.getPropertyValue("--inverse").trim() || "#0b0d0e";
    };

    const resize = () => {
      const rect = field.getBoundingClientRect();
      updateColors();
      width = rect.width;
      height = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildPoints();
      draw();
    };

    const draw = () => {
      if (width === 0 || height === 0) return;

      context.clearRect(0, 0, width, height);
      context.fillStyle = inverse;
      context.fillRect(0, 0, width, height);

      context.strokeStyle = inverseInk;
      context.lineWidth = 1;
      context.globalAlpha = 0.11;
      for (let index = 0; index < 6; index += 1) {
        const y = 44 + (index / 5) * Math.max(height - 84, 1);
        context.beginPath();
        context.moveTo(24, y);
        context.lineTo(width - 24, y);
        context.stroke();
      }
      for (let index = 0; index < 9; index += 1) {
        const x = 44 + (index / 8) * Math.max(width - 84, 1);
        context.beginPath();
        context.moveTo(x, 34);
        context.lineTo(x, height - 34);
        context.stroke();
      }

      const animatedOffset = reduced ? 0 : Math.sin(phase) * 3;
      context.globalAlpha = 0.92;
      context.strokeStyle = signal;
      context.lineWidth = 1.5;
      context.beginPath();
      points.forEach((point, index) => {
        const y = point.y + animatedOffset * (index % 2 === 0 ? 1 : -1);
        if (index === 0) context.moveTo(point.x, y);
        else context.lineTo(point.x, y);
      });
      context.stroke();

      context.font = "10px 'JetBrains Mono Variable', monospace";
      points.forEach((point, index) => {
        const y = point.y + animatedOffset * (index % 2 === 0 ? 1 : -1);
        context.globalAlpha = 0.2;
        context.fillStyle = signal;
        context.beginPath();
        context.arc(point.x, y, point.radius * 3.5, 0, Math.PI * 2);
        context.fill();
        context.globalAlpha = 1;
        context.fillStyle = signal;
        context.beginPath();
        context.arc(point.x, y, point.radius, 0, Math.PI * 2);
        context.fill();
        context.globalAlpha = 0.58;
        context.fillStyle = inverseInk;
        context.fillText(point.label.slice(0, 16), point.x + 9, y - 9);
      });
      context.globalAlpha = 1;
    };

    const loop = () => {
      if (!active || hidden) {
        frame = 0;
        return;
      }
      phase += 0.018;
      draw();
      frame = window.requestAnimationFrame(loop);
    };

    const start = () => {
      if (reduced || frame !== 0 || !active || hidden) return;
      frame = window.requestAnimationFrame(loop);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        active = entry?.isIntersecting ?? false;
        if (active) {
          draw();
          start();
        } else if (frame !== 0) {
          window.cancelAnimationFrame(frame);
          frame = 0;
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(field);

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(field);
    document.addEventListener("visibilitychange", () => {
      hidden = document.hidden;
      if (hidden && frame !== 0) {
        window.cancelAnimationFrame(frame);
        frame = 0;
      } else if (!hidden) start();
    });

    const themeObserver = new MutationObserver(() => {
      updateColors();
      draw();
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    resize();
    if (!reduced) start();
  }
}
