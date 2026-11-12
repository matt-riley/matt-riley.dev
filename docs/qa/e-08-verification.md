# Gift Shop verification

The implemented shelf has three native profile anchors, descriptive text, Free tags and rel=me, plus the approved contact link. Hover/focus state lifts and turns its own exported shelf object; actual physical picks click the corresponding native anchor. The plain mug keeps the generic in-page shelf control.

Combined Human Error/Gift Shop focused tests: 24 passed, 21 intentional capability skips across five projects. Each profile destination worked with pointer, keyboard and mobile touchscreen. The actual WebGL picker activated all three real shelf anchors. All three live destinations returned HTTP 200.

The integrated full suite discovered 417 tests and finished with no failures in one worker; capability-specific skips are intentional. The integrated source head was `066dd4d0ca9d6662b1ce575c36f572f1ffe451a8`. Astro check reports 0 errors/warnings/hints and Biome lint passes.

Footer tests verify native semantics, final tab order, legal links, provenance, UTC year and the exact final wall text. Manual real-gallery visibility and hit testing additionally passed all six width/mode combinations: 390/768/1440px, Day/After Hours. The Terms anchor remained inside the viewport and was the frontmost element at its centre. The seven adjacent PNGs record the shelf and all six footer cases. The canvas does not cover footer links.

The shared Human Error pan and deferred portrait evidence is recorded in `e-07/verification.md`; this stack adds no eager Three.js imports or automatic audio.
