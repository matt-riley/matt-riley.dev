import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const hasFinePointer = window.matchMedia("(pointer: fine)").matches;

function splitWords(element: HTMLElement): HTMLElement[] {
  if (element.dataset.motionSplit === "true") {
    return [...element.querySelectorAll<HTMLElement>(".motion-word")];
  }

  const text = element.textContent?.trim() ?? "";
  element.setAttribute("aria-label", text);
  element.textContent = "";

  const words: HTMLElement[] = [];
  for (const part of text.split(/(\s+)/)) {
    if (!part.trim()) {
      element.appendChild(document.createTextNode(part));
      continue;
    }

    const mask = document.createElement("span");
    const word = document.createElement("span");
    mask.className = "motion-word-mask";
    mask.setAttribute("aria-hidden", "true");
    word.className = "motion-word";
    word.textContent = part;
    mask.appendChild(word);
    element.appendChild(mask);
    words.push(word);
  }

  element.dataset.motionSplit = "true";
  return words;
}

function initHero(): void {
  const hero = document.querySelector<HTMLElement>(".hero");
  if (!hero) return;

  const title = hero.querySelector<HTMLElement>("[data-masked-reveal]");
  const media = hero.querySelector<HTMLElement>("[data-image-reveal]");
  const words = title ? splitWords(title) : [];
  const supporting = [...hero.querySelectorAll<HTMLElement>("[data-hero-item]")].filter(
    (element) => element !== title && element !== media,
  );

  if (title) gsap.set(title, { autoAlpha: 1 });
  if (media) gsap.set(media, { autoAlpha: 1 });

  const timeline = gsap.timeline({ defaults: { ease: "power4.out" } });

  if (media) {
    timeline.fromTo(
      media,
      { clipPath: "inset(0 0 100% 0)", autoAlpha: 0.7 },
      { clipPath: "inset(0 0 0% 0)", autoAlpha: 1, duration: 1.1 },
      0,
    );
  }

  if (words.length > 0) {
    timeline.fromTo(
      words,
      { autoAlpha: 0 },
      { autoAlpha: 1, duration: 0.9, stagger: 0.045 },
      0.12,
    );
  }

  if (supporting.length > 0) {
    timeline.fromTo(
      supporting,
      { autoAlpha: 0 },
      { autoAlpha: 1, duration: 0.8, stagger: 0.08 },
      0.58,
    );
  }


}

function initScrollReveals(): void {
  for (const group of gsap.utils.toArray<HTMLElement>("[data-reveal-group]")) {
    const items = [...group.querySelectorAll<HTMLElement>("[data-reveal-item]")];
    if (items.length === 0) continue;

    gsap.set(items, { autoAlpha: 1 });
    gsap.fromTo(
      items,
      { autoAlpha: 0 },
      {
        autoAlpha: 1,
        duration: 0.85,
        ease: "power4.out",
        stagger: 0.07,
        scrollTrigger: { trigger: group, start: "top 82%", once: true },
      },
    );
  }

  const standalone = gsap
    .utils
    .toArray<HTMLElement>("[data-reveal]")
    .filter(
      (element) =>
        !element.matches("[data-reveal-item]") &&
        !element.matches("[data-image-reveal]") &&
        !element.closest(".hero"),
    );

  for (const element of standalone) {
    gsap.set(element, { autoAlpha: 1 });
    gsap.fromTo(
      element,
      { autoAlpha: 0 },
      {
        autoAlpha: 1,
        duration: 0.85,
        ease: "power4.out",
        scrollTrigger: { trigger: element, start: "top 84%", once: true },
      },
    );
  }
}

function initImageReveals(): void {
  const figures = gsap
    .utils
    .toArray<HTMLElement>("[data-image-reveal]")
    .filter((element) => !element.closest(".hero"));

  for (const figure of figures) {
    gsap.set(figure, { autoAlpha: 1 });
    gsap.fromTo(
      figure,
      { clipPath: "inset(0 0 100% 0)", autoAlpha: 0.6 },
      {
        clipPath: "inset(0 0 0% 0)",
        autoAlpha: 1,
        duration: 1,
        ease: "power4.out",
        scrollTrigger: { trigger: figure, start: "top 82%", once: true },
      },
    );
  }
}

function initStatementWords(): void {
  for (const element of gsap.utils.toArray<HTMLElement>("[data-scroll-word-reveal]")) {
    const words = splitWords(element);
    gsap.set(element, { autoAlpha: 1 });
    gsap.fromTo(
      words,
      { opacity: 0.2 },
      {
        opacity: 1,
        ease: "none",
        stagger: 0.08,
        scrollTrigger: {
          trigger: element,
          start: "top 78%",
          end: "top 30%",
          scrub: 0.4,
        },
      },
    );
  }
}

function initParallax(): void {
  for (const layer of gsap.utils.toArray<HTMLElement>("[data-parallax-image]")) {
    const section = layer.closest<HTMLElement>("[data-parallax-section]") ?? layer;
    gsap.to(layer, {
      y: () => window.innerHeight * -0.08,
      ease: "none",
      scrollTrigger: {
        trigger: section,
        start: "top bottom",
        end: "bottom top",
        scrub: 0.4,
        invalidateOnRefresh: true,
      },
    });
  }

  const footer = document.querySelector<HTMLElement>("[data-footer-parallax]");
  if (footer) {
    gsap.fromTo(
      footer,
      { autoAlpha: 0.84 },
      {
        autoAlpha: 1,
        ease: "none",
        scrollTrigger: { trigger: footer, start: "top bottom", end: "top 48%", scrub: 0.4 }
      },
    );
  }
}

function initMagnetic(): void {
  if (!hasFinePointer) return;

  for (const element of gsap.utils.toArray<HTMLElement>("[data-magnetic]")) {
    const strength = Number(element.dataset.magnetic ?? 0.12);
    const xTo = gsap.quickTo(element, "x", { duration: 0.4, ease: "power3.out" });
    const yTo = gsap.quickTo(element, "y", { duration: 0.4, ease: "power3.out" });

    element.addEventListener("pointermove", (event) => {
      const rect = element.getBoundingClientRect();
      xTo((event.clientX - rect.left - rect.width / 2) * strength);
      yTo((event.clientY - rect.top - rect.height / 2) * strength);
    });

    element.addEventListener("pointerleave", () => {
      xTo(0);
      yTo(0);
    });
  }
}

export function initAfterimageMotion(): void {
  if (prefersReducedMotion) return;

  document.documentElement.classList.add("has-motion");
  initHero();
  initStatementWords();
  initScrollReveals();
  initImageReveals();
  initParallax();
  initMagnetic();

  const refresh = () => ScrollTrigger.refresh();
  window.addEventListener("load", refresh, { once: true });
  if (document.fonts?.ready) document.fonts.ready.then(refresh);
  refresh();
}
