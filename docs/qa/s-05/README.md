# S05 release preflight

This branch prepares a reviewable release. It does not deploy, change Cloudflare
configuration, enable a schedule, or replace Matt's personal preview walk.

## Automated scope

- `pnpm test:visual`: 36 catalogue section snapshots (nine sections × 390/1440px
  × Day/After hours). The clock is fixed to 12 November 2026 at noon UTC, the
  build uses the archived dossier, motion is reduced, native drawers are open,
  fonts are ready and visible photographs are loaded/decoded. No canvas is
  snapshotted. Canonical CI baselines live under `tests/catalogue-snapshots/linux`.
  CI never creates or updates expected snapshots. Missing baselines fail and
  preserve actual images for review before they are committed.
- `pnpm test:release`: focused Firefox-engine coverage supplements the existing
  Chromium/WebKit/mobile/no-JavaScript/reduced-motion suite. Four view/light
  combinations walk all nine stops and exercise native controls. Wide (2560px),
  short (600px), landscape and mid-visit resize cases verify placard bounds.
  Native history, stop links and shared beats are checked without autoplay.
- Every focused browser test attaches the real engine version, runner OS,
  viewport and user agent. A software WebGL fixture exercises rendering where
  available. A runner that declines WebGL is explicitly labelled fallback;
  that result does not establish Firefox gallery compatibility.
- Offline reload is diagnostic: its actual readability/error is attached, then
  online recovery is asserted. An unavailable offline reload remains a release
  limitation. Asset caching alone does not establish offline support.
- The ordinary suite checks source drafts/placeholders, emitted local links and
  anchors, canonical sitemap routes and robots. External URLs are inventoried
  separately; an inventory is not proof that those remote links resolve.
- The local Workers edge suite checks a genuine unknown-route 404 and confirms
  HTML remains revalidating while CSP is present. Existing S04 tests cover
  immutable model/script headers and enforced CSP in both views.

## Browser evidence — pending execution/review

| Required browser/device | Automated evidence | Native/physical walkthrough |
| --- | --- | --- |
| Chrome on macOS | Existing Chromium engine coverage; final exact-head results pending | Pending |
| Firefox on macOS | New Firefox engine preflight; exact version/OS attached by tests | Pending |
| Safari on macOS | Existing WebKit engine coverage; not shipping Safari proof | Pending |
| Safari on iOS | Existing engine/mobile evidence does not establish a physical iPhone result | Pending |
| Chrome on Android | Existing Pixel emulation does not establish a physical Android result | Pending |

Each final row must cover Gallery/Catalogue × Day/After hours, all nine stops
and every exhibit touch. Record actual versions/devices and failures; do not
turn emulated engine results into physical-device claims.

## Before launch

1. Inspect the 36 canonical snapshot baselines and obtain green comparison CI.
2. Record the focused edge cases and remote link audit, keeping unavailable or
   rate-limited remote checks separate from confirmed broken links.
3. Attach the final S02 artifact budget table and S01 accessibility checklist.
4. Record a short full visit on the reviewed preview, with the actual browser
   and capability tier stated. Capture Gallery and Catalogue deliberately.
5. Present the exact release PR/preview to Matt for his own phone/laptop walk.

The S05 acceptance checkboxes remain open until their own evidence exists:
complete real browser table, green release CI including snapshots, Matt's merge
and production serving the new site, and cached-URL checks after deployment.
A draft preflight PR and local edge evidence do not satisfy production gates.
