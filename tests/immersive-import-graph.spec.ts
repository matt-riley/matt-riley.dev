import { expect, test } from "@playwright/test";
import { traceImports } from "../src/scripts/immersive-import-graph";

test.beforeEach(({ browserName }, info) => {
  test.skip(
    browserName !== "chromium" || info.project.name !== "desktop-chromium",
    "Pure graph checks run once without a browser.",
  );
});

test("reachable cycles and repeated imports terminate without duplicate results", () => {
  expect(
    traceImports({ entry: ["a", "a", "entry"], a: ["b"], b: ["a"] }, "entry"),
  ).toEqual({
    reachable: ["entry", "a", "b"],
    unreachable: [],
  });
});

test("a disconnected cycle stays unreachable", () => {
  expect(
    traceImports(
      { main: [], orphan: ["partner"], partner: ["orphan"] },
      "main",
    ),
  ).toEqual({
    reachable: ["main"],
    unreachable: ["orphan", "partner"],
  });
});

test("both result arrays retain graph key order rather than traversal or alphabetical order", () => {
  const graph = {
    greet: ["helper"],
    zUnused: [],
    main: ["greet"],
    helper: [],
    aUnused: [],
  };
  expect(traceImports(graph, "main")).toEqual({
    reachable: ["greet", "main", "helper"],
    unreachable: ["zUnused", "aUnused"],
  });
});

test("missing entries including inherited properties throw RangeError", () => {
  expect(() => traceImports({}, "main")).toThrow(RangeError);
  expect(() => traceImports({ main: [] }, "missing")).toThrow(RangeError);
  expect(() => traceImports({ main: [] }, "toString")).toThrow(RangeError);
});

test("missing references throw even in disconnected components", () => {
  expect(() => traceImports({ main: ["missing"] }, "main")).toThrow(RangeError);
  expect(() => traceImports({ main: [], orphan: ["missing"] }, "main")).toThrow(
    RangeError,
  );
  expect(() => traceImports({ main: ["toString"] }, "main")).toThrow(
    RangeError,
  );
});

test("the graph and dependency arrays are not mutated", () => {
  const graph = Object.freeze({
    main: Object.freeze(["child"]),
    child: Object.freeze([]),
    orphan: Object.freeze([]),
  });
  const first = traceImports(graph, "main");
  first.reachable.reverse();
  first.unreachable.push("invented");
  expect(traceImports(graph, "main")).toEqual({
    reachable: ["main", "child"],
    unreachable: ["orphan"],
  });
  expect(graph.main).toEqual(["child"]);
});

test("adding an import makes the disconnected example module reachable", () => {
  const graph = { "main.ts": ["greet.ts"], "greet.ts": [], "legacy.ts": [] };
  expect(traceImports(graph, "main.ts")).toEqual({
    reachable: ["main.ts", "greet.ts"],
    unreachable: ["legacy.ts"],
  });
  expect(
    traceImports({ ...graph, "main.ts": ["greet.ts", "legacy.ts"] }, "main.ts"),
  ).toEqual({
    reachable: ["main.ts", "greet.ts", "legacy.ts"],
    unreachable: [],
  });
});
