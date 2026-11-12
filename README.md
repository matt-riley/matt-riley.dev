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

`pnpm test` builds with `GITHUB_DATA=fallback` and tests the production preview in
Chromium, WebKit, a mobile viewport, reduced motion and JavaScript-disabled mode.
Install the browser binaries first with `pnpm exec playwright install chromium webkit`.
Every generated HTML route is smoke-tested; axe audits every route in both light
modes in the four JavaScript-enabled projects (axe itself requires JavaScript).
The JavaScript-disabled project checks the unenhanced HTML and navigation.

`pnpm perf` audits the homepage, privacy and terms with Lighthouse's mobile settings
and enforces the brief's score, LCP and CLS thresholds. Run a fallback build first.
It uses Playwright Chromium or the standard macOS Chrome installation; `CHROME_PATH`
can select another executable.
Reports stay in ignored `playwright-report/`, `test-results/` and `.lighthouseci/`.

The build-budget tests follow initial module imports and module preloads, including
inline JavaScript, and exclude dynamic imports until requested. No-model builds
explicitly skip the model-size check; once models exist their combined size must
be below 1.5MB. GitHub CI runs install, checks, build, tests and performance audits;
it never runs Blender.
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
`pnpm deploy` builds and deploys the reviewed output. No server entry point or
Cloudflare adapter is needed. See [deployment proposal and verification](docs/deployment/README.md)
for hashed assets, CSP, preview review, and the inactive daily rebuild template.

## Reuse

This repository has no license. Public visibility does not grant permission to
reuse the code, copy, or visual assets without the author's permission.
