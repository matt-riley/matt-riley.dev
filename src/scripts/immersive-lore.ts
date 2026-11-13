/** A fixed, supplied example of recall. No Lore runtime, inference or storage. */
export function mountLoreExample(root: HTMLElement): () => void {
  const buttons = Array.from(
    root.querySelectorAll<HTMLButtonElement>("[data-lore-question]"),
  );
  const answer = root.querySelector<HTMLElement>("[data-lore-answer]");
  const source = root.querySelector<HTMLElement>("[data-lore-answer-source]");
  const original = root.querySelector<HTMLElement>("#lore-original-note");
  if (!answer || !source || !original || buttons.length !== 2)
    return () => {};

  const initialAnswer = answer.textContent;
  const initiallyHidden = source.hidden;
  const initialButtons = buttons.map((button) => ({
    disabled: button.disabled,
    pressed: button.getAttribute("aria-pressed"),
  }));
  const select = (event: Event) => {
    const button = event.currentTarget as HTMLButtonElement;
    const question = button.dataset.loreQuestion;
    if (question !== "database" && question !== "deployment") return;
    for (const candidate of buttons)
      candidate.setAttribute("aria-pressed", String(candidate === button));
    const found = question === "database";
    answer.textContent = found
      ? `Earlier decision: “${original.textContent?.trim()}”`
      : "This example contains no deployment decision.";
    source.hidden = !found;
  };
  for (const button of buttons) {
    button.addEventListener("click", select);
    button.disabled = false;
  }
  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    buttons.forEach((button, index) => {
      button.removeEventListener("click", select);
      button.disabled = initialButtons[index].disabled;
      const pressed = initialButtons[index].pressed;
      if (pressed === null) button.removeAttribute("aria-pressed");
      else button.setAttribute("aria-pressed", pressed);
    });
    answer.textContent = initialAnswer;
    source.hidden = initiallyHidden;
  };
}
