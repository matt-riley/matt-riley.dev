// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://matt-riley.dev",
  output: "static",
  integrations: [sitemap({
    filter: (page) => !["/404", "/404.html", "/styleguide"].includes(new URL(page).pathname.replace(/\/$/, "")),
  })],
});
