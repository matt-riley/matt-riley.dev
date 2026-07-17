# matt-riley.dev

**Photocopier Riot** — a single-page Dada code zine for matt-riley.dev, built
with Astro and vanilla TypeScript. No React, no Tailwind, no runtime-random
layout. The full visual specification lives in
[docs/superpowers/specs/2026-07-16-matt-riley-dev-design.md](docs/superpowers/specs/2026-07-16-matt-riley-dev-design.md).

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
