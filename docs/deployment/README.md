# Deployment proposal — preserve Workers Builds

## Verified current configuration

An authenticated, read-only Cloudflare dashboard inspection by the coordinating
agent on 12 November 2026 found the existing `matt-riley-dev` Worker configured
with **Workers Builds**, repository `matt-riley/matt-riley.dev`, production branch
`main`, root `/`, non-production branch builds enabled, and builds not disabled.
Commands are:

- Build: `pnpm run build`
- Production deploy: `npx wrangler deploy`
- Non-production version: `npx wrangler versions upload`

The dashboard warns: **“This project is disconnected from your Git account.
This may cause deployments to fail.”** Its active version was `bc90bcdc`, labelled
as a Build from about two months earlier. There were no build variables/secrets
or deploy hooks. A build-token label existed; its value was not opened. These
findings supersede the earlier unauthenticated repository-only investigation,
which could establish manual commands but could not confirm dashboard builds.
No dashboard setting, connection, hook, secret or production deployment changed.

## Proposed method — awaiting Matt

**Preserve the existing Workers Builds deployer.** Matt should repair its GitHub
connection using the dashboard OAuth flow and confirm repository access. Keep
the current build/deploy/version commands and branch settings. Do not introduce
a second Wrangler deployer in GitHub Actions.

For a daily rebuild at **06:00 UTC**, Matt can create a Workers Builds deploy hook
for production branch `main`, put its full URL in the GitHub production environment
secret `CLOUDFLARE_DEPLOY_HOOK_URL`, and approve activating the inactive
`daily-rebuild.yml.example` template. The template only POSTs to that secret URL;
Workers Builds performs the build and deployment with its existing token.
No extra Cloudflare API-token value needs to enter GitHub Actions. The hook URL
is itself a bearer credential: agents must not view, paste, log, or commit it.
GitHub schedules can run late; `workflow_dispatch` requests an immediate rebuild.

Matt should separately add a build-time secret `GITHUB_TOKEN` in Workers Builds
if authenticated GitHub API capacity is wanted. That is where the actual build
runs; the hook workflow's GitHub token does not reach Cloudflare automatically.
Use a minimally scoped token for the public read requests. No credential values
are supplied or handled by this change. Environment protection may require Matt
to approve each scheduled request; choose that policy explicitly when enabling.

Before the first repaired build, Matt should set the non-secret Workers Builds
variable `NODE_VERSION=26` to match this repository and CI. The exact pnpm version
is already selected by `packageManager: pnpm@10.34.9` in `package.json`, as the
current Workers build image supports. No package-manager version override is
needed in the hook workflow.

A successful hook request is **not** proof that its build or deployment finished.
Record the matching Workers Builds result, deployed version/commit and visible
GitHub provenance. API failures keep the existing all-or-nothing archived dossier,
honestly labelled with the archive's original date. A new deployment does not make
an old snapshot fresh.

## Concrete approval and verification sequence

**Method approval is not launch approval.** Builds are currently enabled and
production follows `main`; after Git repair, the next main write can deploy
without another prompt. The coordinating agent must halt main merges/writes
before repair and throughout hosted-preview review, and resume production main
writes only after Matt explicitly approves launch. Alternatively, Matt can keep
builds disabled until final review and approve their re-enablement separately.
Agents must not toggle that dashboard setting. Complete local/device previews
before OAuth repair where possible; do not depend on a broken connection as a
production safety boundary. If repair itself proposes a build, Matt should hold
it until the agreed launch decision.

1. Review this PR's exact green commit: check, lint, build, browser tests,
   `pnpm test:edge` and performance audits. The source remains assets-only.
2. Matt approves preserving Workers Builds plus the 06:00 UTC deploy-hook plan.
   With main writes halted and the production-build policy confirmed, Matt
   configures the Node build version and repairs the disconnected GitHub
   integration; agents do not reconnect it.
3. After repair, push the reviewed branch and inspect its non-production Workers
   Builds result. The configured version command uploads a version rather than
   promoting production. Open the preview URL returned by that build. Confirm
   version URLs are enabled on the actual worker; omission of `preview_urls` in
   this repo preserves the existing account setting. Never guess the hostname.
   Manual `wrangler versions upload --preview-alias s04-review` remains a
   separately authorized fallback, not a new production deploy method.
4. On that **hosted** preview, `curl -I` HTML, a `/_astro/` script, and the room URL
   from `src/gallery/manifest.json`. Verify CSP/immutable headers, 404 routing and
   clean Gallery/Catalogue consoles. Local Workers tests do not prove account or
   hosted behavior. The local version-upload dry-run did not upload anything.
5. Matt creates the main-branch deploy hook and stores its URL directly as the
   protected GitHub secret above; Matt configures build-time `GITHUB_TOKEN` in
   Workers Builds. No agent needs to receive either value.
6. Only after approval, copy the template into `.github/workflows/daily-rebuild.yml`.
   Use `workflow_dispatch` once and verify both request acceptance and the actual
   Workers Builds build/deployment/provenance. Then verify the next scheduled run.
7. Rehearse an API-failure/fallback build on a non-production branch using its
   build environment (for example `GITHUB_DATA=fallback`), then remove that test
   override. A fallback **production scheduled** run needs separate explicit
   approval and verified restoration afterwards; do not intentionally break a
   production token or connection to test it.

For local preparation, `GITHUB_DATA=fallback pnpm build` is deterministic and
`pnpm exec wrangler deploy --dry-run` checks asset-only upload configuration.
`pnpm deploy` remains an available manual command, but using it would bypass the
established Builds pipeline and requires a concrete deployment approval.

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
[version URLs](https://developers.cloudflare.com/workers/versions-and-deployments/version-urls/),
[Workers Builds deploy hooks](https://developers.cloudflare.com/workers/ci-cd/builds/deploy-hooks/),
[build image versions](https://developers.cloudflare.com/workers/ci-cd/builds/build-image/).
