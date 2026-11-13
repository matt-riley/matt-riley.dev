# Direction A: working slice

Matt chose A / Immersive gallery after rejecting the first working museum. He
then selected pi-extensions, mattriley.tools, deadwood, crap and Lore as the work
he is proud to feature. The collection follows that explicit selection. GitHub
stars and push dates do not choose the exhibits.

## Review surface

`/preview-a/` is a separate, noindex route. It preserves the previous site for
comparison. It is an image-led interactive composition: generated scene assets,
native HTML text/navigation/disclosures, and a real browser CRAP calculation.
Opening the toolbox reveals the collection in its open scene. It does not run
the Rust CLI, provide a complete replacement 3D gallery, or expose private code.
The separately authored hinge-driven toolbox mesh is not integrated here.

## Visual system

- Warm speckled ivory ceramic, raking window light, stone ledge, vivid orange
  working details and dark ink. Avoid the previous flat grey distant room.
- Bricolage Grotesque Variable at 800 for the main display titles, Newsreader
  for narrative copy, Commit Mono for small collection numbers.
- Large close object framing; restrained native navigation: Matt Riley, Work,
  Human, GitHub. Mobile navigation is a native disclosure.
- An open ruled project index, not large floating museum placards. Real links
  and a short purpose for each project; new copy remains a review draft.
- Native range inputs, clear live score, a capped decorative needle. The metric
  is attributed to Alberto Savoia and Bob Evans; it is not a failure probability.
- A dedicated portrait arrival asset keeps the phone view sharp and composed.
  Mobile presents the score before the sliders so the result stays in view.

## Content and interaction inventory

| Surface         | Visible content / behavior                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------- |
| Arrival         | Please touch. / Matt Riley makes small useful things. / Open the toolbox                          |
| Navigation      | Matt Riley / Work / Human / GitHub; compact native menu on phones                                 |
| Collection      | The collection. / Five things I'm glad I made. / five approved project names                      |
| Project details | Accurate descriptions, View source links; Visit for mattriley.tools; Try the exhibit for crap     |
| CRAP            | Complexity and Test coverage controls; default 42; View source and About the metric               |
| Human           | Existing approved Yorkshire/stand-up/art/hip-hop interests; original Waffle photo; GitHub contact |

The first slice deliberately adds the functional CRAP exhibit to A's accepted
arrival/collection system. It does not add invented clients, adoption metrics,
performance claims, testimonials or fake repository activity. The copy and asset
provenance below are review material; approving the direction did not approve
old project names or the previous generated copy.

## Reference and asset provenance

Built-in Image Gen was used; no external stock models or brand assets. The
accepted A reference is the generated board named
`exec-b86bbe4f-8317-410e-b041-1acdf1a27767.png` in the conversation. The working
CRAP detail study is `exec-1f0394d4-8f0e-43c0-b9da-60cfed2e9e51.png`.

The actual source assets are committed under `src/assets/immersive/`; Astro
emits optimized AVIF/WebP variants. No screenshot of the website is shipped as UI.

| Source file        | Production asset brief                                                                                                                                         |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| toolbox-closed.png | Extract A's warm close ceramic toolbox scene; remove all UI, text and logos; preserve blank upper wall, orange handle, figurine, records and directional light |
| toolbox-open.png   | Same world and open cantilever trays on the right; remove all old drawer/project labels and website UI; leave quiet plaster on the left                        |
| toolbox-mobile.png | Fresh portrait composition of the same closed toolbox; crisp texture and close handle in lower half, calm upper plaster for native type                        |
| risk-scene.png     | Extract the ceramic CRAP instrument into a wide warm scene; retain physical CRAP plaque/ticks; remove all website UI, pointer and hub; leave right side empty  |
| risk-pointer.png   | Separate transparent front-facing orange pointer/ivory hub matching the instrument; rotate this layer around its hub, not the background scene                 |

Discarded pointer-cleanup variants and the concept boards are not runtime assets.
The Waffle portrait is the original existing photograph, not a generated likeness.

## Fidelity and responsive ledger

| Point            | Implementation evidence / intentional adaptation                                                                                              |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Composition      | Large native two-line title over clear wall; close toolbox fills the lower view and remains a distinct pointer/keyboard target                |
| Typography       | Same three self-hosted font families; explicit title/control weights and sizes; no browser-default buttons                                    |
| Palette/material | Production imagery preserves A's warm ceramic/plaster/stone character; text orange is darkened for legibility independently of physical glaze |
| Container model  | Essential links and controls in open editorial layouts; ruled disclosures replace the former large placards                                   |
| Navigation       | The same compact navigation persists while scrolling; opaque paper background below arrival keeps it legible                                  |
| Collection       | Native five-project index substitutes Matt's confirmed selection for the old baked labels                                                     |
| Mobile           | Dedicated portrait photo, menu, vertical index and score-first control order; no miniature desktop gallery                                    |
| CRAP             | Correct live formula and strict 30/60 warning bands; needle is a relative indicator capped at 60, explained in About the metric               |

The reference is a multi-view design board, not one browser-sized screenshot.
Direct visual comparisons use 1440×900 desktop and 390×844 phone captures. The full
original gallery, Night/torch behavior and other four bespoke project interactions
remain outside this first slice. Final visual acceptance remains Matt's.

## Verification

The score module has 9 CPU tests, including 42/6/70 reference values, strict
threshold boundaries, control enabling and cleanup. Focused browser checks cover
native pointer/keyboard navigation, all five source destinations, slider/needle
changes, phone navigation, 320px reflow, accessibility and no-JavaScript content.
The final device preview is served by local Workers Assets with CSP enforced;
this is not a hosted Cloudflare preview or production deployment.

Main merges and launch remain held. This PR stacks on the reviewed technical
integration, preserving those fixes without approving the rejected visual result.

## Current validation result

- Astro check: no errors, warnings or hints. Biome: clean.
- Score module: 9 CPU tests pass.
- Final local Workers/CSP browser matrix: 12 pass, 9 intentional skips.
- Follow-up keyboard/focus check: 2 pass, 1 intentional skip; mobile range rows
  reserve space for the visible focus outline.
- Header artwork-layer regression and scoped axe: 4 pass, 2 intentional skips;
  actual pointer hit tests confirm navigation remains above the scene.
- Three mobile Lighthouse samples on this route: Performance 100,
  Accessibility 100, Best Practices 100; worst LCP 0.904 s and CLS 0. The deliberate
  noindex preview is outside the production SEO assertion.

These focused runs overlap; their counts should not be added as unique tests.
They are browser-engine/phone-emulation evidence, not physical-device or
VoiceOver listening results. Temporary screenshot/report outputs remain outside
the repository under `/tmp/immersive-*`.

The inherited S01 parent at 550b90fd has three unresolved legacy-gallery CI
failures: two software-rendered tests quietly retreat to Catalogue under load,
and its uninterrupted gallery keyboard tour times out in the hosted runner.
The tests have not been weakened or rewritten to call fallback a Gallery pass.
The new image-led route has its own passing focused checks; this draft does not
claim the whole inherited suite is green. Main integration remains held.
