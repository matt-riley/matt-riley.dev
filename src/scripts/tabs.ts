/**
 * Accessible tabs for the dispatch board. The tablist ships hidden and is
 * revealed only once JavaScript wires it up, so the no-JS page simply shows
 * both panels stacked.
 */
export function initRecentTabs(): void {
  for (const board of document.querySelectorAll("[data-recent-tabs]")) {
    const tablist = board.querySelector<HTMLElement>('[role="tablist"]');
    const tabs = [
      ...board.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
    ];
    const panels = [
      ...board.querySelectorAll<HTMLElement>('[role="tabpanel"]'),
    ];

    const select = (tab: HTMLButtonElement, focus: boolean) => {
      for (const candidate of tabs) {
        const active = candidate === tab;
        candidate.setAttribute("aria-selected", String(active));
        candidate.tabIndex = active ? 0 : -1;
        const controls = candidate.getAttribute("aria-controls") ?? "";
        const panel = panels.find((candidatePanel) => candidatePanel.id === controls);
        if (panel) panel.hidden = !active;
      }
      if (focus) tab.focus();
    };

    const initial =
      tabs.find((tab) => tab.getAttribute("aria-selected") === "true") ?? tabs[0];
    if (initial) select(initial, false);
    if (tablist) tablist.hidden = false;

    for (const tab of tabs) {
      tab.addEventListener("click", () => select(tab, true));
      tab.addEventListener("keydown", (event) => {
        if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
        event.preventDefault();
        const index = tabs.indexOf(tab);
        const step = event.key === "ArrowRight" ? 1 : -1;
        select(tabs[(index + step + tabs.length) % tabs.length]!, true);
      });
    }
  }
}
