import { readdirSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

export const dist = resolve("dist");

export function htmlFiles(directory = dist): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? htmlFiles(path)
      : entry.name.endsWith(".html")
        ? [path]
        : [];
  });
}

export function siteRoutes(): string[] {
  const routes = htmlFiles().map((file) => {
    const path = relative(dist, file).split(sep).join("/");
    return `/${path.replace(/(^|\/)index\.html$/, "$1")}`;
  });
  if (routes.length === 0)
    throw new Error("No built HTML routes; run the fallback build first.");
  return routes.sort();
}
