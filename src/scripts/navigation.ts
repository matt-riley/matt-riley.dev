export function initSiteNavigation(): void {
  const header = document.querySelector<HTMLElement>("[data-site-header]");
  const toggle = header?.querySelector<HTMLButtonElement>("[data-nav-toggle]");
  const label = toggle?.querySelector<HTMLElement>(".nav-toggle__label");
  const links = [...document.querySelectorAll<HTMLAnchorElement>("[data-nav-link]")];

  if (!header || !toggle) return;

  const close = () => {
    header.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    if (label) label.textContent = "Menu";
  };

  toggle.addEventListener("click", () => {
    const open = !header.classList.contains("is-open");
    header.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    if (label) label.textContent = open ? "Close" : "Menu";
  });

  for (const link of links) link.addEventListener("click", close);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });

  const desktop = window.matchMedia("(min-width: 961px)");
  desktop.addEventListener("change", (event) => {
    if (event.matches) close();
  });
}
