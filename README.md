# Please Touch

Matt Riley makes small useful things. This site presents them as a nine-stop museum of porcelain objects, orange working parts and a cat who has ignored the rules. The complete photographic catalogue works without JavaScript; capable browsers can explore the same exhibits in an optional Three.js gallery.

![The museum’s free link shelf](docs/qa/e-08-gift-shelf.png)

The approved design and task tracker live in [Notion](https://app.notion.com/p/416d4557a772812a906cd4d199f361a1).

## Local development

Use Node 26 and pnpm 10. The lockfile pins the toolchain; CI installs with `--frozen-lockfile`.

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm check
pnpm lint
GITHUB_DATA=fallback pnpm build
pnpm preview
```

Astro produces static HTML and locally hosted assets. Content belongs in `src/content/exhibits/`; shared copy is in `src/content/site.ts`. The original supplied portrait is `src/assets/waffle-portrait.jpg`. The app sends no visitor state to a server.

## Asset builds

Use Blender **5.2 LTS**. `BLENDER_BIN` overrides `/Applications/Blender.app/Contents/MacOS/Blender`.

```sh
pnpm assets
pnpm assets:stills
pnpm assets:identity
```

`pnpm assets` runs scripted sources in `blender/scenes/`, then glTF Transform dedup/prune/weld/resize/WebP/Meshopt. Raw GLBs and manifests live in ignored `blender/out/`; optimised GLBs in `public/models/` are committed. Room generation includes a Cycles CPU bake and takes substantially longer than the small models. To rebuild one Python module, use `pnpm assets -- --only agent_skills` (the module declares `MODEL_ID="agent-skills"`). The complete shipped GLB set must remain below 1.5MB.

`pnpm assets:stills` renders 36 day/night, wide/square photographs from the raw GLBs, validates the complete set and copies them to `src/assets/catalogue/`. Blender cannot import the Meshopt web derivatives. Astro generates responsive AVIF/WebP derivatives at build time; mobile photographs must remain below 90KB. See [catalogue photography](blender/CATALOGUE.md) for constrained render/resume commands. Existing complete renders can be copied with `pnpm assets:stills -- --copy-only`.

`pnpm assets:identity` renders the sitting cat share image with `blender/render_og.py`, extracts the bundled Bricolage Grotesque glyph outlines with Fontkit and composites them using Sharp, and creates the Apple/manifest icons from `public/favicon.svg`. `-- --copy-only` reuses the existing share render; `-- --icons-only` rebuilds only icons. The final 1200×630 PNG must be below 200KB. Render intermediates and font provenance stay in ignored output.

Material factories, export axes, pivot metadata, room anchors and budgets are documented in [the asset pipeline](blender/README.md). The approved P2/G2 porcelain/glaze palette is shared by every source. Generated source PNGs and optimised GLBs are checked in; local builds and CI do not need Blender unless changing assets.

## Settings and interaction contracts

`src/scripts/settings.ts` owns these browser-local values. The initial head script applies them before paint; unavailable storage falls back to the same DOM state.

| Storage key | Values                 | Default                |
| ----------- | ---------------------- | ---------------------- |
| `mr-lights` | `day`, `after-hours`   | system colour scheme   |
| `mr-cat`    | `on`, `off`            | `on`                   |
| `mr-sound`  | `on`, `off`            | `off`                  |
| `mr-view`   | `gallery`, `catalogue` | `gallery` when capable |

Each value also appears as the corresponding `data-*` attribute on `<html>`. Change settings through the exported `set`, `get` and `toggle` helpers; `document` receives `mr:setting` with `detail: { key, value }`. Settings synchronize across tabs. Sound remains opt-in; a stored setting does not authorize automatic playback. Feature-specific state includes the browser-local `mr-marker` and session-only interaction hints.

The DOM owns results and accessibility. `button[data-touch]` and native `details[data-reveal]` dispatch bubbling `mr:touch` from their exhibit with `detail: { exhibit, model?, part? }`. Physical picks click the same real control. Keep heavy imports inside lazy visual modules registered through the type-only `onExhibitsReady` boundary. Use `registry.onRecord` for bindings that must survive model unloading/reloading; return cleanup and leave GPU disposal to the asset owner. Session-owned resources need immediate `app.addCleanup` registration before any await. See [adapter contracts](src/gallery/INTERACTIONS.md) and [gallery lifecycle](src/gallery/README.md).

## Adding an exhibit

Follow [the end-to-end contributor guide](docs/adding-an-exhibit.md): content, semantic DOM, Blender geometry/pivots, room anchor/camera, photographs, lazy adapter, ownership and validation. The current tour has nine canonical IDs; adding a stop intentionally changes those explicit lists and budgets. Do not introduce a model-only interaction or invented copy.

## GitHub data

The build reads the public profile, repositories, events and releases for `matt-riley`. `GITHUB_TOKEN` optionally raises the build-time API allowance and never reaches the browser. `GITHUB_DATA=fallback` skips network requests for deterministic builds. A failed request or invalid response switches the entire dossier to the checked-in snapshot, never a mixture of dates; the footer and acquisitions board display its provenance.

## Validation

```sh
pnpm exec playwright install chromium webkit
REQUIRE_FINAL_COPY=true pnpm test --workers=1
GITHUB_DATA=fallback pnpm build
pnpm perf
pnpm exec wrangler deploy --dry-run
```

Playwright checks Chromium, WebKit, mobile, reduced motion and JavaScript-disabled HTML. Axe checks every route in both light modes where JavaScript is available. Actual GLB tests verify dimensions/materials/pivots; renderer tests exercise real contexts through an explicit software-WebGL fixture, while separate gate tests preserve production fallback. Run graphics suites, Blender batches and Lighthouse serially to avoid CPU/software-GPU contention.

Lighthouse enforces the brief’s performance, accessibility, LCP and CLS thresholds; initial JS/model/texture budgets are checked separately. Performance runs use installed Playwright Chromium, or `CHROME_PATH`. Reports remain ignored under `test-results/`, `playwright-report/` and `.lighthouseci/`. Live external link checks are opt-in with `VERIFY_EXTERNAL_LINKS=1` so CI does not depend on other sites. CI runs install, checks, build, browser tests and Lighthouse, without rebuilding Blender assets.

## Deployment

Production is configured through Cloudflare **Workers Builds** for `main`, with
`pnpm run build` and `npx wrangler deploy`; non-production builds use
`npx wrangler versions upload`. An authenticated dashboard inspection found the
GitHub connection disconnected, so Matt must repair it before relying on builds.
`wrangler.jsonc` remains assets-only with no server entry point or adapter.

See the [deployment evidence and approval plan](docs/deployment/README.md) for
immutable assets, CSP, hosted preview checks, and the **inactive** daily deploy-hook
proposal. No deployment method, hook, secret, or schedule is activated by this PR.
`pnpm deploy` is a manual fallback requiring a specific deployment approval.

## Reuse

This repository has no license. Public visibility does not grant permission to reuse the code, copy or visual assets without the author’s permission.
