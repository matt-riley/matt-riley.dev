# Deployment proposal — awaiting Matt

The repository currently defines manual Wrangler deployment (`pnpm deploy`) to
Workers Assets worker `matt-riley-dev`. No repository deployment workflow was
present when this task began. Cloudflare dashboard build integration and the
active account/domain bindings could not be confirmed without authenticated
account access. Do not enable a second deployer until Matt confirms that state.
This change does not deploy, upload a remote version, create secrets, or enable
a schedule.

## Proposed method

Use the checked-in Wrangler configuration and a single GitHub Actions production
workflow. After approval, copy `daily-rebuild.yml.example` into
`.github/workflows/daily-rebuild.yml`, configure the production environment, and
set `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` there. Scope the token to the
confirmed account's Workers deployment permissions. The workflow's built-in
GitHub token is read-only and is used only during build-time GitHub fetching;
none of these credentials enters browser output. Keep environment protection if
manual approval of each run is wanted; otherwise approve scheduled deployment
explicitly. Disable any conflicting dashboard auto-build first.

The proposed daily schedule is **06:00 UTC**; GitHub schedules may run late.
`workflow_dispatch` provides an immediate rebuild. This reuses the existing
all-or-nothing GitHub fallback: API failure still emits the complete archived
dossier, honestly labelled with its original snapshot date. A new deployment
does not make an old archived snapshot fresh. A deterministic fallback rehearsal
uses `GITHUB_DATA=fallback pnpm build`; never enable that override in the ordinary
production workflow.

## Review before production

1. `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm lint`, `pnpm build`,
   `pnpm test`, and `pnpm perf` must pass on the exact reviewed commit.
2. `pnpm exec wrangler deploy --dry-run` validates the asset-only upload. The
   configuration intentionally has no `main`; unknown routes use `404-page`.
3. After Matt authorizes a remote preview and account selection:
   `pnpm exec wrangler versions upload --preview-alias s04-review` creates a
   version without promoting production. Version URLs must be enabled on the
   confirmed worker (`preview_urls`); existing dashboard settings are preserved
   by omitting that property here. Use the URL returned by Wrangler; never guess
   its hostname. Restrict preview access through the account if needed.
4. On that hosted preview, inspect `/`, an emitted `/_astro/` script and the room
   URL from `src/gallery/manifest.json`. Check CSP, immutable cache headers, 404
   routing, and the browser console in Gallery and Catalogue. Local Workers
   checks alone do not prove hosted headers or account settings.
5. Review the exact assets and approve production deployment. Run the approved
   workflow manually once, verify the returned deployment version and production
   page, then allow the schedule. Confirm the next scheduled run and rendered
   GitHub provenance date. Rehearse fallback as a preview before scheduling an
   actual fallback production run; that last run needs explicit authorization.

## Artifact contracts

`public/models/<logical-id>.glb` remains the authoring contract. Prebuild writes
`src/gallery/manifest.json` from SHA-256 (12 hex characters), and postbuild renames
only the emitted copies to `<logical-id>.<hash>.glb`. The deployment contains
one copy of each model. Runtime and tests resolve logical IDs through
`modelURL()`; any room metadata change refreshes its hash on the next build.
Development continues to use stable source filenames.

Astro emits styles externally. `scripts/build-headers.mjs` hashes the exact
settings initializer and structured data scripts in the emitted HTML and fills
`dist/_headers`. `wasm-unsafe-eval` permits the bundled Meshopt decoder; general
`unsafe-eval` and inline-script wildcards are absent. Browser-written style
properties remain necessary for camera projections and animation. No external
font, analytics, or model origin is permitted. Fonts are same-origin WOFF2.

`/_astro/*` and `/models/*` receive a one-year immutable cache policy. HTML keeps
Workers Assets' revalidation default rather than an immutable policy. Do not
edit a hashed URL's contents in place. Rebuild and deploy all HTML/scripts/models
together. Rollback uses a previously reviewed Workers version/deployment; retain
an earlier deployment while monitoring the new one.

Packaging rejects duplicates, stale model hashes, files larger than 25 MiB,
and more than 20,000 files (the conservative Free-plan limit; Paid allows
100,000). Header lines are capped at 2,000 characters. These checks cover the
actual emitted output rather than source-size estimates.

Sources: [Workers limits](https://developers.cloudflare.com/workers/platform/limits/),
[asset headers](https://developers.cloudflare.com/workers/static-assets/headers/),
[version URLs](https://developers.cloudflare.com/workers/versions-and-deployments/version-urls/).
