import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const manifest: Record<string, string> = JSON.parse(
  readFileSync("src/gallery/manifest.json", "utf8"),
);

import { modelURL } from "../src/gallery/model-files";

test.beforeEach(({ browserName }, info) => {
  test.skip(
    info.project.name !== "desktop-chromium" || browserName !== "chromium",
    "Artifact checks run once and do not open a browser.",
  );
});

test("deployment contains one immutable, content-verified copy of every model", () => {
  expect(
    readdirSync("dist/models")
      .filter((file) => file.endsWith(".glb"))
      .sort(),
  ).toEqual(Object.values(manifest).sort());
  for (const [id, file] of Object.entries(manifest)) {
    const source = readFileSync(`public/models/${id}.glb`, "hex");
    const hash = createHash("sha256")
      .update(source, "hex")
      .digest("hex")
      .slice(0, 12);
    expect(file).toBe(`${id}.${hash}.glb`);
    expect(readFileSync(`dist/models/${file}`, "hex")).toBe(source);
    expect(modelURL(id)).toBe(`/models/${file}`);
  }
  expect(() => modelURL("unknown-model")).toThrow("Unknown gallery model");
});

test("emitted CSP authorizes exact inline scripts and external same-origin styles", () => {
  const headers = readFileSync("dist/_headers", "utf8");
  expect(headers).not.toContain("__INLINE_SCRIPT_HASHES__");
  expect(headers).not.toContain("'unsafe-inline'");
  expect(headers).not.toContain("'unsafe-eval'");
  expect(headers).toContain("'wasm-unsafe-eval'");
  expect(headers).toContain("style-src 'self'");
  expect(headers).toContain(
    "/_astro/*\n  Cache-Control: public, max-age=31536000, immutable",
  );
  expect(headers).toContain(
    "/models/*\n  Cache-Control: public, max-age=31536000, immutable",
  );
  let scripts = 0;
  function inspect(directory: string) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) inspect(path);
      else if (entry.name.endsWith(".html")) {
        const html = readFileSync(path, "utf8");
        expect(html).not.toMatch(/<style\b|\sstyle\s*=/i);
        for (const match of html.matchAll(
          /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi,
        )) {
          if (/\bsrc\s*=/i.test(match[1]) || !match[2].trim()) continue;
          const hash = createHash("sha256").update(match[2]).digest("base64");
          expect(headers).toContain(`'sha256-${hash}'`);
          scripts++;
        }
      }
    }
  }
  inspect("dist");
  expect(scripts).toBeGreaterThan(0);
});
