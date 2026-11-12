for (const section of document.querySelectorAll<HTMLElement>(
  "[data-exhibit]",
)) {
  const result = section.querySelector<HTMLElement>("[data-touch-result]");
  const touch = (open = true) => {
    if (result) {
      result.textContent = open
        ? (section.dataset.touchMessage ?? "")
        : "The list is closed.";
    }
    section.dispatchEvent(
      new CustomEvent("mr:touch", {
        bubbles: true,
        detail: { exhibit: section.dataset.exhibit },
      }),
    );
  };
  section
    .querySelector<HTMLButtonElement>("button[data-touch]")
    ?.addEventListener("click", () => touch());
  const reveal = section.querySelector<HTMLDetailsElement>("[data-reveal]");
  reveal?.addEventListener("toggle", () => touch(reveal.open));
}
