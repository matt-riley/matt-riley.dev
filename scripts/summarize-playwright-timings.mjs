#!/usr/bin/env node
import { readFileSync } from "node:fs";

const path = process.argv[2] ?? "test-results/playwright-timings.json";
const report = JSON.parse(readFileSync(path, "utf8"));

const rows = [];
for (const suite of report.suites ?? []) collect(suite, []);
rows.sort((a, b) => b.duration - a.duration);

console.log(`Playwright timings (${rows.length} tests)\n`);
for (const row of rows.slice(0, 25)) {
  console.log(
    `${(row.duration / 1000).toFixed(1)}s\t${row.project}\t${row.title}`,
  );
}

function collect(suite, titlePrefix) {
  const titles = suite.title ? [...titlePrefix, suite.title] : titlePrefix;
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests ?? []) {
      for (const result of test.results ?? []) {
        if (result.status === "skipped") continue;
        rows.push({
          duration: result.duration,
          project: test.projectName ?? "unknown",
          title: [...titles, spec.title].filter(Boolean).join(" › "),
        });
      }
    }
  }
  for (const child of suite.suites ?? []) collect(child, titles);
}
