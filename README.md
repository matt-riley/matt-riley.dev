# matt-riley.dev

**Afterimage** — a single-page developer field note for matt-riley.dev, built
with Astro and vanilla TypeScript. No React, no Tailwind, no runtime-random
layout. The current visual contract lives in
[brand-spec.md](brand-spec.md).

Designed for [matt-riley.dev](https://matt-riley.dev).

![Afterimage homepage preview](assets/preview.png)

## Local development

```sh
pnpm install
pnpm dev        # dev server on http://localhost:4321
pnpm build      # static build into dist/
pnpm preview    # serve the production build
pnpm check      # astro check (types + diagnostics)
```

## GitHub data

The build fetches the public GitHub profile, repositories, and events for
`matt-riley` at build time and normalizes them into one typed dossier
(`src/data/github.ts`). Data selection is atomic: if any request fails, times
out, or looks malformed, the whole page falls back to the checked-in
last-known-good snapshot in `src/data/fallback.ts` and the dossier is stamped
`ARCHIVE PRINT` instead of `LIVE PRESS`.

- `GITHUB_TOKEN` (optional) raises the API rate limit; it never reaches the client.
- `GITHUB_DATA=fallback` skips the live fetch entirely for deterministic builds.

## Editions

The `DAY / NIGHT` control switches between the warm copier-paper day edition
and the after-hours print-room night edition. The choice persists in
`localStorage`, respects `prefers-color-scheme` on first visit, and resolves
before first paint.

## Architecture

- Astro static output with vanilla TypeScript; no React or Tailwind.
- GSAP + ScrollTrigger and Lenis provide the guarded scroll narrative.
- A deterministic canvas renders the GitHub signal field; the pointer trail is
  limited to fine pointers and has reduced-motion fallbacks.
- The browser has no data-fetching requirement. GitHub is read at build time;
  the checked-in snapshot takes over when the API is unavailable.

## Project layout

- `src/components/` — the page's semantic sections and shared chrome.
- `src/data/` — typed GitHub normalization and fallback data.
- `src/scripts/` — theme, navigation, tabs, canvas, and motion enhancements.
- `src/styles/` — the Afterimage visual system and responsive rules.
- `public/images/` — the local hero and Waffle editorial assets.

## Cloudflare Pages

This is configured for a static Cloudflare Pages deployment:

- Build command: `pnpm run build`
- Build output directory: `dist`
- Astro mode: `output: "static"`
- Cloudflare adapter: none required; `@astrojs/cloudflare` is for SSR/Workers
  runtime features and would be unnecessary here.

## Reuse

This repository currently has no license. Public visibility does not grant
permission to reuse the code, copy, or visual assets without the author's
permission.
