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

## Validation boundary

Source checkpoint only. Coordinator owns page integration, browser checks, concept-to-render comparison and responsive fidelity verification. No browser or production action was performed in this worktree. Do not treat source readiness as visual sign-off.
