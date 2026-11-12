interface BoardRow {
  text: string;
  href: string;
}

export function initSplitFlap(board: HTMLElement) {
  if (board.dataset.flapReady) return;
  const rows: BoardRow[] = JSON.parse(board.dataset.rows ?? "[]");
  const links = [...board.querySelectorAll<HTMLAnchorElement>(".flap-row")];
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let offset = 0;

  function render() {
    links.forEach((link, index) => {
      const row = rows[(offset + index) % rows.length];
      if (!row) return;
      const plain = link.querySelector<HTMLElement>(".flap-copy");
      if (!plain) return;
      link.href = row.href;
      plain.textContent = row.text;
      link.querySelector(".flap-cells")?.remove();
      delete link.dataset.enhanced;
      if (reducedMotion.matches) return;
      const cells = document.createElement("span");
      cells.className = "flap-cells";
      cells.setAttribute("aria-hidden", "true");
      let count = 0;
      for (const token of row.text.split(/(\s+)/)) {
        if (/^\s+$/.test(token)) {
          cells.append(document.createTextNode(token));
          continue;
        }
        const word = document.createElement("span");
        word.className = "flap-word";
        for (const character of token) {
          const cell = document.createElement("span");
          cell.className = "flap-cell";
          cell.textContent = character;
          cell.style.setProperty(
            "--flap-delay",
            `${Math.min(count++, 24) * 8}ms`,
          );
          word.append(cell);
        }
        cells.append(word);
      }
      link.append(cells);
      link.dataset.enhanced = "true";
    });
  }

  board.dataset.flapReady = "true";
  render();
  reducedMotion.addEventListener("change", render);
  board.closest("[data-exhibit]")?.addEventListener("mr:touch", () => {
    offset = (offset + 1) % Math.max(rows.length, 1);
    render();
  });
}
