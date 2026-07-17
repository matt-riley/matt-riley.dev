export type Edition = "day" | "night";

const STORAGE_KEY = "mr-edition";
const THEME_COLOR: Record<Edition, string> = {
  day: "#eee9dc",
  night: "#10100f",
};

export function resolveEdition(
  saved: string | null,
  prefersNight: boolean,
): Edition {
  if (saved === "day" || saved === "night") return saved;
  return prefersNight ? "night" : "day";
}

export function initEditionSwitch(): void {
  const root = document.documentElement;
  const buttons = [
    ...document.querySelectorAll<HTMLButtonElement>("[data-theme-choice]"),
  ];

  const apply = (edition: Edition) => {
    root.dataset.theme = edition;
    localStorage.setItem(STORAGE_KEY, edition);
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
      localStorage.getItem(STORAGE_KEY),
      matchMedia("(prefers-color-scheme: dark)").matches,
    ),
  );

  for (const button of buttons) {
    button.addEventListener("click", () =>
      apply(button.dataset.themeChoice as Edition),
    );
  }
}
