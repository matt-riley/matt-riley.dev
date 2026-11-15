/** CRAP metric, not a probability: c² × (1 − coverage/100)³ + c. */
export function score(complexity: number, coverage: number): number {
  if (!Number.isInteger(complexity) || complexity < 1 || complexity > 30)
    throw new RangeError("Complexity must be an integer from 1 to 30");
  if (!Number.isFinite(coverage) || coverage < 0 || coverage > 100)
    throw new RangeError("Coverage must be a percentage from 0 to 100");
  return complexity ** 2 * (1 - coverage / 100) ** 3 + complexity;
}

/** Explicit form binding; importing the score module requires no browser globals. */
export function mountRiskControls(form: HTMLFormElement): () => void {
  const required = <T extends HTMLElement>(selector: string): T => {
    const element = form.querySelector<T>(selector);
    if (!element) throw new Error(`Risk controls need ${selector}`);
    return element;
  };
  const complexity = required<HTMLInputElement>("#risk-complexity"),
    coverage = required<HTMLInputElement>("#risk-coverage"),
    complexityValue = required<HTMLOutputElement>("#complexity-value"),
    coverageValue = required<HTMLOutputElement>("#coverage-value"),
    result = required<HTMLOutputElement>("#risk-score"),
    status = required<HTMLElement>("[data-risk-status]"),
    pointer = form.querySelector<HTMLElement>("[data-risk-pointer]");
  const disabled = [complexity.disabled, coverage.disabled];
  const text = (value: number) => value.toFixed(1).replace(/\.0$/, "");
  function update() {
    const c = complexity.valueAsNumber,
      coveragePercent = coverage.valueAsNumber,
      value = score(c, coveragePercent),
      state = value > 60 ? "crit" : value > 30 ? "warn" : "low";
    complexityValue.textContent = String(c);
    coverageValue.textContent = `${text(coveragePercent)}%`;
    result.textContent = text(value);
    status.textContent =
      value > 60
        ? "High CRAP score"
        : value > 30
          ? "Worth a closer look"
          : value === 30
            ? "At the threshold"
            : "Below the threshold";
    form.dataset.riskState = status.dataset.riskState = state;
    // A capped relative indicator, deliberately not a probability scale.
    const angle = `${Math.max(-75, Math.min(75, (value / 60) * 150 - 75))}deg`;
    form.style.setProperty("--risk-angle", angle);
    pointer?.style.setProperty("--risk-angle", angle);
    complexity.style.setProperty("--range-fill", `${((c - 1) / 29) * 100}%`);
    coverage.style.setProperty("--range-fill", `${coveragePercent}%`);
  }
  update();
  complexity.disabled = coverage.disabled = false;
  complexity.addEventListener("input", update);
  coverage.addEventListener("input", update);
  return () => {
    complexity.removeEventListener("input", update);
    coverage.removeEventListener("input", update);
    complexity.disabled = disabled[0];
    coverage.disabled = disabled[1];
  };
}
