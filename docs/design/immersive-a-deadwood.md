# Direction A: deadwood exhibit

Matt approved the working A slice with “Much closer—continue this direction”.
This separate stacked change adds an illustrative deadwood file-reachability
interaction to `/preview-a/`, between the collection and CRAP exhibit.

The scene uses the approved warm plaster, speckled ceramic, glossy orange and
close framing. The pruning-shears photograph is generated art, not a product
photograph or a representation of the CLI interface. All headings, source,
checkbox, graph labels and status are selectable native HTML.

## Sources and limits

Deadwood's [README](https://github.com/matt-riley/deadwood/blob/main/README.md)
and [analysis fixtures](https://github.com/matt-riley/deadwood/blob/main/tests/analysis.rs)
describe unreachable-file findings and the need to configure runtime entry
points. The exhibit is deliberately narrower: a fixed three-file example and
pure import-graph traversal. It does not parse arbitrary TypeScript, run the
Rust CLI, scan a repository, delete files, or declare a finding safe to remove.

`main.ts` imports `greet.ts`. `legacy.ts` is initially unreachable. Checking
“Import legacy.ts” adds a side-effect import and makes it reachable. The visible
source, connection line, node label and live status update together. No scan
progress, confidence or timing numbers are fabricated. The checkbox is disabled
in the unenhanced HTML, whose initial graph and source remain readable.

Unlike the generated concept, the unreachable file has no connecting line;
otherwise the illustration would imply an import that does not exist. Adding
the real import draws the line. A source disclosure provides exact evidence and
an analysis-limit note. On mobile, art sits above the native interaction.

## Asset provenance

Built-in ImageGen concept: `exec-10a07ec6-aba0-45b4-a4c2-af21cc64cde1.png`.
Production photograph extracted by an image edit that preserved the art and
removed all interface text: `exec-a89c8252-d0df-4533-890d-a6883dd09c41.png`.
Source copied to `src/assets/immersive/deadwood-scene.png`; Astro emits responsive
AVIF/WebP variants. Generated outputs remain separate from native website UI.

## Validation

Astro check: 140 files, zero errors/warnings/hints. Biome: 190 files clean.
Seven graph behavior cases pass, including disconnected cycles and invalid
references. Focused local Workers/CSP browser run: eight pass, four intentional
project skips; desktop/phone keyboard toggles, source parity, no-JS content,
scoped axe and 320px overflow all pass.

Browser plugin is unavailable, so Playwright Chromium was used. Final native
viewport screenshots at 1440×1000 and 390×844 were inspected with the generated
concept: close material crop, warm palette, split proportions, typography,
control spacing and visible source/result state match the direction. Main
heading and instruction copy match; the graph connection differs intentionally
for semantic correctness as described above. The mobile layout stacks art
above the controls without clipping or horizontal overflow. No page errors.
Local screenshots/reports are under `/tmp/deadwood-captures/` and
`/tmp/immersive-deadwood-results*`; temporary artifacts are outside the repository. Physical-device testing remains separate. Main integration, deployment
and schedule activation remain held. The old gallery's inherited CI failures
are not hidden or weakened by this change.
