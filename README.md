# matt-riley.dev

Please Touch: The Museum of Small Useful Things. Built with Astro, strict
TypeScript and static output for Cloudflare Workers Assets.

The redesign is in progress. This foundation is intentionally unstyled; catalogue
content, gallery enhancement and interactions arrive in subsequent tasks.
The source brief and task order live in
[Notion](https://app.notion.com/p/416d4557a772812a906cd4d199f361a1).

## Development

Use Node 26 and pnpm 10.

```sh
pnpm install
pnpm dev
pnpm check
pnpm lint
GITHUB_DATA=fallback pnpm build
pnpm preview
pnpm exec wrangler deploy --dry-run
```

`pnpm format` formats and lints supported files. Astro templates are checked by
`pnpm check`. The preserved `src/data/` layer is excluded from Biome to keep it
untouched during the scaffold task.

`pnpm test` is reserved for the Playwright harness in F-03; no tests exist yet.
`pnpm assets` is a placeholder until the Blender pipeline task B-01.

## Structure

- `blender/` — scripted scene sources and material/export helpers.
- `scripts/` — asset build orchestration.
- `public/models/` — optimised gallery models.
- `src/assets/catalogue/` — catalogue still renders.
- `src/assets/waffle-portrait.jpg` — original photograph of Waffle.
- `src/content/exhibits/` — exhibit content collection.
- `src/data/` — build-time GitHub dossier and atomic fallback.
- `src/components/`, `src/layouts/`, `src/pages/` — semantic catalogue HTML.
- `src/gallery/` — optional gallery runtime.
- `src/scripts/` — small browser enhancements.
- `src/styles/` — design tokens and catalogue/gallery styles.
- `tests/` — Playwright checks.

## GitHub data

The build reads the public GitHub profile, repositories, events and releases for
`matt-riley`. If any request fails or cannot be normalised, the whole dossier falls
back to the checked-in snapshot. `GITHUB_TOKEN` optionally raises the build-time
API limit and never reaches the browser. `GITHUB_DATA=fallback` skips fetching for
deterministic builds.

## Deployment

`wrangler.jsonc` uploads the generated `dist/` as static Workers Assets.
`pnpm deploy` builds and deploys; it publishes the current scaffold, so review the
build before using it. No server entry point or Cloudflare adapter is needed.

## Reuse

This repository has no license. Public visibility does not grant permission to
reuse the code, copy, or visual assets without the author's permission.
