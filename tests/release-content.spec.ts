import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { dist, htmlFiles } from "./routes";

const walk = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? walk(join(directory, entry.name))
      : [join(directory, entry.name)],
  );
const decode = (value: string) => value.replace(/&amp;/g, "&");
test.beforeEach(({ browserName }, info) => {
  void browserName;
  test.skip(
    info.project.name !== "desktop-chromium",
    "Build artifact checks run once without a browser.",
  );
});

test("release content has no drafts or placeholders and every local anchor resolves", async ({
  browserName,
}, info) => {
  void browserName;
  const content = walk(resolve("src/content/exhibits")).filter((path) =>
    path.endsWith(".md"),
  );
  expect(content).toHaveLength(9);
  for (const file of content) {
    const source = readFileSync(file, "utf8");
    expect(source, file).not.toMatch(/^draft:\s*true\s*$/m);
    expect(source, file).not.toMatch(/\[Matt to write\b/i);
  }
  const external = new Set<string>();
  const broken: string[] = [];
  const pages = htmlFiles();
  expect(pages.length).toBeGreaterThan(0);
  let checked = 0;
  for (const file of pages) {
    const html = readFileSync(file, "utf8");
    expect(html, file).not.toMatch(/\[Matt to write\b/i);
    const base = new URL(
      `https://matt-riley.dev/${file.slice(dist.length + 1).replace(/index\.html$/, "")}`,
    );
    for (const match of html.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["']/gi)) {
      const url = new URL(decode(match[1]), base);
      if (!["https:", "http:"].includes(url.protocol)) continue;
      if (url.hostname !== "matt-riley.dev") {
        external.add(url.href);
        continue;
      }
      checked++;
      const path = resolve(dist, `.${decodeURIComponent(url.pathname)}`);
      const target = [path, join(path, "index.html"), `${path}.html`].find(
        (candidate) => existsSync(candidate) && statSync(candidate).isFile(),
      );
      if (!target) {
        broken.push(`${file} → ${url.href}`);
        continue;
      }
      if (
        url.hash &&
        !url.hash.startsWith("#boom=") &&
        target.endsWith(".html")
      ) {
        const ids = new Set(
          [
            ...readFileSync(target, "utf8").matchAll(/\bid=["']([^"']+)["']/g),
          ].map((item) => item[1]),
        );
        if (!ids.has(decodeURIComponent(url.hash.slice(1))))
          broken.push(`${file} → ${url.href}`);
      }
    }
  }
  expect(checked).toBeGreaterThan(0);
  expect(broken).toEqual([]);
  await info.attach("external-links-awaiting-network-audit", {
    body: JSON.stringify([...external].sort(), null, 2),
    contentType: "application/json",
  });
});

test("robots and sitemap list only the canonical public routes", () => {
  const robots = readFileSync(join(dist, "robots.txt"), "utf8");
  expect(robots).toContain("User-agent: *");
  expect(robots).toContain("Sitemap: https://matt-riley.dev/sitemap-index.xml");
  const xml = walk(dist).filter((file) => /sitemap.*\.xml$/.test(file));
  expect(xml.length).toBeGreaterThan(0);
  const routes = xml
    .flatMap((file) =>
      [...readFileSync(file, "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)].map(
        (match) => new URL(decode(match[1])),
      ),
    )
    .filter((url) => !url.pathname.endsWith(".xml"));
  expect(routes.length).toBeGreaterThan(0);
  expect(
    [
      ...new Set(
        routes.map((url) => {
          expect(url.origin).toBe("https://matt-riley.dev");
          return url.pathname.replace(/\/$/, "") || "/";
        }),
      ),
    ].sort(),
  ).toEqual(["/", "/privacy", "/terms"]);
});
