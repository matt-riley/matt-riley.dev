import { expect, test } from "@playwright/test";
import { mountRiskControls, score } from "../src/scripts/immersive-score";

test.beforeEach(({ browserName }, info) => {
  test.skip(
    browserName !== "chromium" || info.project.name !== "desktop-chromium",
    "Pure calculation and event-adapter checks run once without a browser.",
  );
});

test("the published CRAP examples retain their numerical meaning", () => {
  expect(score(6, 0)).toBe(42);
  expect(score(6, 100)).toBe(6);
  expect(score(20, 50)).toBe(70);
  expect(score(5, 50)).toBe(8.125);
  expect(score(10, 50)).toBe(22.5);
  expect(score(20, 0)).toBe(420);
});

test("the score validates the supported domain instead of hiding bad inputs", () => {
  expect(score(1, 0)).toBe(2);
  expect(score(1, 100)).toBe(1);
  expect(score(30, 0)).toBe(930);
  expect(score(30, 100)).toBe(30);
  expect(score(6, 50.5)).toBeGreaterThan(6);
  for (const invalid of [0, 31, 1.5, NaN, Infinity, -Infinity])
    expect(() => score(invalid, 50)).toThrow(RangeError);
  for (const invalid of [-0.1, 100.1, NaN, Infinity, -Infinity])
    expect(() => score(6, invalid)).toThrow(RangeError);
});

test("more coverage lowers the score while more complexity raises it", () => {
  const covered = [0, 25, 50, 75, 100].map((coverage) => score(20, coverage));
  for (let index = 1; index < covered.length; index++)
    expect(covered[index]).toBeLessThan(covered[index - 1]);
  for (let complexity = 2; complexity <= 30; complexity++)
    expect(score(complexity, 50)).toBeGreaterThan(score(complexity - 1, 50));
});

class Control extends EventTarget {
  textContent = "";
  valueAsNumber = 0;
  disabled = false;
  dataset: Record<string, string> = {};
  private properties = new Map<string, string>();
  style = {
    setProperty: (name: string, value: string) => {
      this.properties.set(name, value);
    },
    getPropertyValue: (name: string) => this.properties.get(name) ?? "",
  };
}

function fixture(pointer = true) {
  const nodes = new Map<string, Control>(
    [
      "#risk-complexity",
      "#risk-coverage",
      "#complexity-value",
      "#coverage-value",
      "#risk-score",
      "[data-risk-status]",
    ].map((selector) => [selector, new Control()]),
  );
  if (pointer) nodes.set("[data-risk-pointer]", new Control());
  const form = Object.assign(new Control(), {
    querySelector: (selector: string) => nodes.get(selector) ?? null,
  });
  const complexity = nodes.get("#risk-complexity") as Control;
  const coverage = nodes.get("#risk-coverage") as Control;
  complexity.valueAsNumber = 6;
  complexity.disabled = coverage.disabled = true;
  const read = (selector: string) => nodes.get(selector) as Control;
  const set = (control: Control, value: number) => {
    control.valueAsNumber = value;
    control.dispatchEvent(new Event("input"));
  };
  return {
    form,
    nodes,
    complexity,
    coverage,
    read,
    set,
    mount: () => mountRiskControls(form as unknown as HTMLFormElement),
  };
}

test("mount paints the supplied defaults and keeps the meter decorative", () => {
  const f = fixture();
  const cleanup = f.mount();
  expect(f.complexity.disabled).toBe(false);
  expect(f.coverage.disabled).toBe(false);
  expect(f.read("#complexity-value").textContent).toBe("6");
  expect(f.read("#coverage-value").textContent).toBe("0%");
  expect(f.read("#risk-score").textContent).toBe("42");
  expect(f.read("[data-risk-status]").textContent).toBe("Worth a closer look");
  expect(f.form.dataset.riskState).toBe("warn");
  expect(f.read("[data-risk-status]").dataset.riskState).toBe("warn");
  expect(f.form.style.getPropertyValue("--risk-angle")).toBe("30deg");
  expect(
    f.read("[data-risk-pointer]").style.getPropertyValue("--risk-angle"),
  ).toBe("30deg");
  expect(
    parseFloat(f.complexity.style.getPropertyValue("--range-fill")),
  ).toBeCloseTo(17.241379);
  expect(f.coverage.style.getPropertyValue("--range-fill")).toBe("0%");
  cleanup();
});

test("native input events update exact values and show at most one score decimal", () => {
  const f = fixture();
  const cleanup = f.mount();
  f.set(f.coverage, 100);
  expect(f.read("#risk-score").textContent).toBe("6");
  expect(f.read("#coverage-value").textContent).toBe("100%");
  expect(f.read("[data-risk-status]").textContent).toBe("Below the threshold");
  expect(f.form.style.getPropertyValue("--risk-angle")).toBe("-60deg");
  f.set(f.complexity, 5);
  f.set(f.coverage, 50);
  expect(f.read("#risk-score").textContent).toBe("8.1");
  expect(f.read("#complexity-value").textContent).toBe("5");
  cleanup();
});

test("severity uses strict above-30 and above-60 bands", () => {
  const f = fixture();
  const cleanup = f.mount();
  f.set(f.complexity, 5);
  expect(f.read("#risk-score").textContent).toBe("30");
  expect(f.form.dataset.riskState).toBe("low");
  expect(f.read("[data-risk-status]").textContent).toBe("At the threshold");
  f.set(f.coverage, 6.687221079568795);
  f.set(f.complexity, 8);
  // This coverage solves score(8, coverage) = 60; 60 remains in the warn band.
  expect(score(8, f.coverage.valueAsNumber)).toBe(60);
  expect(f.read("#risk-score").textContent).toBe("60");
  expect(f.form.dataset.riskState).toBe("warn");
  expect(f.read("[data-risk-status]").textContent).toBe("Worth a closer look");
  f.set(f.coverage, 0);
  expect(f.form.dataset.riskState).toBe("crit");
  expect(f.read("[data-risk-status]").textContent).toBe("High CRAP score");
  cleanup();
});

test("range fills follow both endpoints and high scores cap the relative needle", () => {
  const f = fixture(false);
  const cleanup = f.mount();
  f.set(f.complexity, 1);
  expect(f.complexity.style.getPropertyValue("--range-fill")).toBe("0%");
  f.set(f.complexity, 30);
  expect(f.complexity.style.getPropertyValue("--range-fill")).toBe("100%");
  expect(f.form.style.getPropertyValue("--risk-angle")).toBe("75deg");
  expect(f.read("#risk-score").textContent).toBe("930");
  f.set(f.coverage, 100);
  expect(f.coverage.style.getPropertyValue("--range-fill")).toBe("100%");
  cleanup();
});

test("cleanup detaches both input listeners and missing required controls fail clearly", () => {
  const f = fixture();
  const cleanup = f.mount();
  cleanup();
  cleanup();
  f.set(f.coverage, 100);
  f.set(f.complexity, 1);
  expect(f.read("#risk-score").textContent).toBe("42");
  expect(f.read("#complexity-value").textContent).toBe("6");
  const incomplete = fixture();
  incomplete.nodes.delete("#risk-score");
  expect(() => incomplete.mount()).toThrow(/#risk-score/);
});

test("mount enables the static example and cleanup restores each original disabled flag", () => {
  const f = fixture();
  f.complexity.disabled = false;
  f.coverage.disabled = true;
  const cleanup = f.mount();
  expect(f.complexity.disabled).toBe(false);
  expect(f.coverage.disabled).toBe(false);
  cleanup();
  expect(f.complexity.disabled).toBe(false);
  expect(f.coverage.disabled).toBe(true);
});
