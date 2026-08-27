export type Edition = "day" | "night";

const STORAGE_KEY = "mr-edition";
const THEME_COLOR: Record<Edition, string> = {
  day: "#f1f0eb",
  night: "#0b0d0e",
};

export function resolveEdition(saved: string | null, prefersNight: boolean): Edition {
  if (saved === "day" || saved === "night") return saved;
  return prefersNight ? "night" : "day";
}

export function initEditionSwitch(): void {
  const root = document.documentElement;
  const buttons = [...document.querySelectorAll<HTMLButtonElement>("[data-theme-choice]")];

  let saved: string | null = null;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch {
    saved = null;
  }

  const apply = (edition: Edition, persist = true) => {
    root.dataset.theme = edition;
    if (persist) {
      try {
        localStorage.setItem(STORAGE_KEY, edition);
      } catch {
        // Private browsing can reject storage. The current edition still applies.
      }
    }
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", THEME_COLOR[edition]);
    for (const button of buttons) {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.themeChoice === edition),
      );
    }
  };

  apply(
    resolveEdition(
      saved,
      window.matchMedia("(prefers-color-scheme: dark)").matches,
    ),
    false,
  );

  for (const button of buttons) {
    button.addEventListener("click", () => {
      const choice = button.dataset.themeChoice;
      if (choice === "day" || choice === "night") apply(choice);
    });
  }
}
