# Lore: keep the decision

An illustrative two-session memory example for the approved A gallery. The original supplied decision and source remain visible. Native buttons select a fixed question; the database question repeats the original note and source, while the deployment question honestly reports that this example has no deployment decision. No Lore runtime, model, network request or storage is involved.

## Factual basis

- [Lore README](https://github.com/matt-riley/lore/blob/main/README.md): derived local memory and recall across sessions.
- [Support matrix](https://github.com/matt-riley/lore/blob/main/docs/support-matrix.md): retain, recall and provenance; adapter support varies.
- [Memory lifecycle](https://github.com/matt-riley/lore/blob/main/website/src/content/docs/how-memory-works.md): bounded contextual recall and source evidence.

The SQLite decision is an explicitly supplied fictional example for the inventory project, not a claim about Matt's history or a captured Lore result. A real installation's recalled context may reach its host's configured model. The exhibit makes no universal privacy, perfect recall, adoption or model-quality claim.

## Visual specification

Image Gen built-in generated a complete section concept first, followed by a separate production photograph. The concept uses a close-framed open speckled ivory ceramic note box, blank paper cards, glossy orange rim/tab, warm angled window light, plaster and travertine. The production photograph contains no UI or text. All headings, evidence, questions and responses are HTML.

The first concept placed photography left. The coordinator requested text-left/photo-right to vary the page rhythm against CRAP and deadwood; a second complete concept was requested in that direction. Desktop layout follows that instruction. Mobile uses a bounded photo above readable native content.

Design tokens: warm peach content `#f6e3d0`, inherited A ink `#191611`, orange `#dd4c00`, thin rules `#b8a38a`; Bricolage Grotesque headings/controls, Newsreader prose, Commit Mono source-session label. Open editorial sections, no nested card grid, no photo tint or overlay, and no motion.

Production asset prompt: regenerate only the reference concept's photographic panel as an isolated close-framed product photograph, preserving the open speckled ivory ceramic box, orange rim/tab, blank cards, warm plaster, travertine and window light; fully visible lid/base, no website UI, text, logos, watermark or extra objects. The final concept prompt changes only panel direction, preserving copy/materials/typography.

## Integration and accessibility

- Import `LoreExhibit.astro` into the preview page.
- Import `mountLoreExample` and call it once on `[data-lore-example]`; retain its cleanup.
- Buttons start disabled. Mount attaches listeners then enables them; cleanup is idempotent and restores disabled/pressed flags, initial answer and hidden source.
- Original note/source are readable without JavaScript. A noscript explanation covers both outcomes.
- Fieldset/legend groups native buttons; `aria-pressed` exposes the selected question, and an atomic status region announces the result.
- No fake terminal execution, AI answer, fabricated confidence or metrics. The explicit caption says nothing is saved and no question is sent to a model.

## Integrated validation

The coordinator integrated this section before deadwood, mounted its adapter
with the existing persisted-page lifecycle, and linked it from the collection.
Astro check reports zero errors/warnings/hints; Biome is clean.

The final text-left/photo-right section concept is
`exec-c17ef4aa-ebf0-442b-8a52-5da547f868cd.png` under the generated-image session
`01a1cfdd-cfe8-7a93-83b5-9ee176e4f6e4`. Native text and controls are independently
implemented; the photo is a separate generated asset. The initial browser
comparison found undersized desktop typography. Heading, quote, source and
button scales were corrected, and the latest screenshots were viewed alongside
the concept at 1440×1000 and 390×844.

Comparison covered split layout, close object crop, ceramic/glaze materials,
warm palette, type hierarchy, rules and question-control spacing. The visible
heading, intro, supplied note and initial answer match the concept copy.
The phone view stacks the photo above readable controls; additional source
text wraps naturally. No horizontal overflow or page errors were observed.
Matched and missing states were exercised during capture. Core interactions
are native buttons with source/provenance and no fabricated model response.

Browser plugin is unavailable; Playwright Chromium was used against the local
Workers/CSP preview. Temporary captures and reports are outside the repository
under `/tmp/lore-captures/` and `/tmp/immersive-lore-results*`. They are phone
emulation evidence, not physical-phone or VoiceOver listening results. Main
integration, production deployment and daily-hook activation remain held.

Final focused Lore run after the typography correction: eight pass, four
intentional project skips in 5.1 seconds. Keyboard recall/absence, persistent
source, no network/storage changes, no-JavaScript evidence, scoped axe in
three states, and 320px layout all pass. Existing A plus deadwood regression:
22 pass, 14 intentional skips (A 14/10; deadwood 8/4) against the combined
Workers page. Independent source/integration review found no actionable bugs.
