for (const section of document.querySelectorAll<HTMLElement>(
  "[data-exhibit]",
)) {
  const touch = (control: HTMLElement, open = true) => {
    const group = control.closest<HTMLElement>("[data-model]");
    const result =
      group?.querySelector<HTMLElement>("[data-touch-result]") ??
      section.querySelector<HTMLElement>("[data-touch-result]");
    if (result)
      result.textContent = open
        ? (control.dataset.touchMessage ?? section.dataset.touchMessage ?? "")
        : "The list is closed.";
    const model = control.dataset.model ?? group?.dataset.model;
    section.dispatchEvent(
      new CustomEvent("mr:touch", {
        bubbles: true,
        detail: {
          exhibit: section.dataset.exhibit,
          ...(model ? { model } : {}),
          ...(control.dataset.part ? { part: control.dataset.part } : {}),
        },
      }),
    );
  };
  section
    .querySelectorAll<HTMLButtonElement>("button[data-touch]")
    .forEach((button) => {
      button.addEventListener("click", () => touch(button));
    });
  section
    .querySelectorAll<HTMLDetailsElement>("[data-reveal]")
    .forEach((reveal) => {
      reveal.addEventListener("toggle", () => {
        const summary = reveal.querySelector<HTMLElement>("summary");
        if (summary) touch(summary, reveal.open);
      });
    });
}
