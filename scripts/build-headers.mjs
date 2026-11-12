import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const hashes = new Set();
function inspect(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) inspect(path);
    else if (entry.name.endsWith(".html")) {
      const html = readFileSync(path, "utf8");
      assert.ok(
        !/<style\b/i.test(html),
        `${path} contains inline CSS; keep styles same-origin and external`,
      );
      for (const match of html.matchAll(
        /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi,
      )) {
        if (/\bsrc\s*=/i.test(match[1]) || !match[2].trim()) continue;
        hashes.add(
          `'sha256-${createHash("sha256").update(match[2]).digest("base64")}'`,
        );
      }
    }
  }
}
inspect(join(root, "dist"));
assert.ok(hashes.size, "The settings initializer must be hash-authorized");
const template = readFileSync(join(root, "public/_headers"), "utf8");
assert.equal(
  template.split("__INLINE_SCRIPT_HASHES__").length,
  2,
  "Expected one script hash placeholder",
);
const headers = template.replace(
  "__INLINE_SCRIPT_HASHES__",
  [...hashes].sort().join(" "),
);
for (const line of headers.split("\n"))
  assert.ok(
    line.length <= 2000,
    "A Workers _headers line exceeds 2,000 characters",
  );
writeFileSync(join(root, "dist/_headers"), headers);
console.log(
  `CSP: ${hashes.size} exact inline-script hashes; styles external; Meshopt WASM permitted`,
);
