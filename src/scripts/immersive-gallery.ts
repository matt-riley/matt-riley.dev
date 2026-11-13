import { mountImportExample } from "./immersive-deadwood";
import { mountLoreExample } from "./immersive-lore";
import { mountRiskControls } from "./immersive-score";

document.body.dataset.enhanced = "";
const header = document.querySelector<HTMLElement>(".immersive-header");
let scrolled = false;
const syncHeader = () => {
  const next = window.scrollY > 60;
  if (next !== scrolled) {
    header?.toggleAttribute("data-scrolled", next);
    scrolled = next;
  }
};
syncHeader();
window.addEventListener("scroll", syncHeader, { passive: true });
window.addEventListener("pageshow", syncHeader);

const collection = document.querySelector<HTMLDetailsElement>(
  "[data-collection-disclosure]",
);
for (const trigger of document.querySelectorAll<HTMLElement>(
  "[data-open-toolbox]",
)) {
  if (trigger instanceof HTMLButtonElement) trigger.hidden = false;
  trigger.addEventListener("click", () => {
    if (collection) collection.open = true;
    const menu = document.querySelector<HTMLDetailsElement>(".mobile-nav");
    if (menu) menu.open = false;
    if (trigger instanceof HTMLButtonElement) location.hash = "collection";
  });
}
for (const link of document.querySelectorAll(".mobile-nav a"))
  link.addEventListener("click", () => {
    const menu = link.closest("details");
    if (menu) menu.open = false;
  });

document
  .querySelector('[href="#about-metric"]')
  ?.addEventListener("click", () => {
    const metric = document.querySelector<HTMLDetailsElement>("#about-metric");
    if (metric) metric.open = true;
  });

const controls = document.querySelector<HTMLFormElement>(
  "[data-risk-controls]",
);
if (controls) {
  const cleanup = mountRiskControls(controls);
  const needle = document.querySelector<HTMLElement>("[data-risk-pointer]");
  const syncNeedle = () => {
    needle?.style.setProperty(
      "--risk-angle",
      controls.style.getPropertyValue("--risk-angle"),
    );
  };
  controls.addEventListener("input", syncNeedle);
  syncNeedle();
  window.addEventListener("pagehide", (event) => {
    if (!event.persisted) {
      controls.removeEventListener("input", syncNeedle);
      cleanup();
    }
  });
}

const importExample = document.querySelector<HTMLElement>(
  "[data-import-example]",
);
if (importExample) {
  const cleanup = mountImportExample(importExample);
  window.addEventListener("pagehide", (event) => {
    if (!event.persisted) cleanup();
  });
}

const loreExample = document.querySelector<HTMLElement>("[data-lore-example]");
if (loreExample) {
  const cleanup = mountLoreExample(loreExample);
  window.addEventListener("pagehide", (event) => {
    if (!event.persisted) cleanup();
  });
}

const revealProjectFragment = () => {
  let id: string;
  try {
    id = decodeURIComponent(location.hash.slice(1));
  } catch {
    return;
  }
  if (!id.startsWith("project-")) return;
  const project = document.getElementById(id);
  if (
    !(project instanceof HTMLDetailsElement) ||
    !project.classList.contains("curated-project")
  )
    return;
  if (collection) collection.open = true;
  project.open = true;
  project.scrollIntoView({ block: "start", behavior: "instant" });
};
revealProjectFragment();
window.addEventListener("hashchange", revealProjectFragment);
