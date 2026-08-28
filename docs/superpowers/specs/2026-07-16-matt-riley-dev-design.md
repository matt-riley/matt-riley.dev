# Matt Riley Developer Site — Unified Design Specification

## Status

Superseded exploratory spec. The approved direction is now **Afterimage**; see the current [brand spec](../../../brand-spec.md). The notes below are retained as the original 2026-07-16 design exploration.

Original exploratory direction: **Photocopier Riot**, a more forceful Dada zine evolution of Candidate A. Candidate A supplies the editorial structure, Candidate B supplies the turntable and MPC-style activity interaction, and Candidate C supplies the responsive, accessibility, and data-display discipline.

Hard visual constraints:

- No React and no Tailwind CSS.
- No Comic Sans, cursive fallback, or pseudo-handwriting font.
- No red stamps. Stamp and registration marks use cobalt or ultraviolet blue; acid yellow is the secondary signal colour.
- Apparent chaos must never obscure content, focus, or document order.

## Experience Goal

The site should feel like an independent Dada code zine made with a photocopier, scissors, toner, tape, found print, and a suspicious typesetter. It must not look like a clean portfolio decorated with torn edges. Each section is a distinct printed artefact, but one disciplined grid, limited palette, and semantic reading order hold the publication together.

The site is a single page because the zine works best as one continuous issue: manifesto, public record, project posters, activity galley, personal collage, classified adverts, and colophon. Anchor navigation makes every major section directly addressable.

## Visual System

### Material language

- Photocopy grain, rough toner edges, tape, ripped paper, crop marks, blue registration errors, censor bars, staple marks, arrows, and handwritten-looking marks drawn as SVG.
- Deterministic rotations and overlaps assigned at build time. Nothing moves or reflows randomly on load.
- Texture comes from lightweight CSS, SVG filters, and small compressed assets rather than large bitmap backgrounds.
- Every section uses a different zine format: cover manifesto, proof sheet, poster wall, typesetter galley, record insert, collage spread, and classified back page.

### Typography

- Self-hosted, subset WOFF2 display grotesque for monumental declarations.
- Self-hosted high-contrast editorial serif for disruptive cut-out fragments.
- Self-hosted monospace for GitHub evidence, dates, captions, and print metadata.
- Graffiti and hand marks are purpose-drawn SVG fragments, never novelty font fallbacks.
- Headline fragments may rotate, crop, reverse, or overprint, but the underlying accessible text remains complete and correctly ordered.

### Colour and themes

Day edition uses warm copier paper, toner black, cobalt or ultraviolet blue stamp ink, and acid yellow signal paper.

Night edition is an after-hours print room rather than a colour inversion: charcoal stock, cream pasted scraps, brighter blue ink, acid-yellow signals, and individually tuned text colours. Paper scraps remain visibly paper-coloured in both themes.

The `DAY EDITION / NIGHT EDITION` control resolves a saved choice before first paint, respects `prefers-color-scheme` on the first visit, persists the choice, updates its accessible state, and avoids layout shift.

## Page Composition

### 1. Masthead and colophon strip

`M/R`, issue metadata, Work/GitHub/About/Elsewhere anchors, live-or-fallback feed status, and the edition toggle. It behaves like the top strip of a photocopied publication rather than a conventional floating navigation bar.

### 2. Detonated manifesto

“MATT RILEY MAKES SOFTWARE” is assembled from incompatible printed fragments, toner shadows, blue overprint, tape, and absurd marginal notes. Yorkshire and developer context appear as issue metadata instead of a generic biography paragraph.

### 3. The Public Record

GitHub profile, account age, repositories, stars, followers, languages, activity, and releases appear as physical evidence: proof strips, stamps, labels, bar impressions, and annotated printouts. It must never become a grid of generic statistic cards.

### 4. Selected Machinery

Strong repositories become overlapping gig posters and machine labels. Hover and focus separate the stack without changing source order. Every poster remains a descriptive link and exposes its language, recency, stars, and concise purpose.

### 5. Recent Noise

Commits, releases, and other public events form a typesetter galley. Accessible tabs switch views, preserve keyboard focus, and provide an honest empty state. Dates and source repositories remain visible.

### 6. Side B / Off the Clock

Hip-hop, modern art, Dada, stand-up training, Yorkshire, and Waffle form the personal double-page spread. Waffle appears as a restrained lino-cut or halftone cameo rather than a cartoon or emoji face.

### 7. Classified back page

`mattriley.work`, `mattriley.tools`, and GitHub become oversized torn adverts. The footer acts as the zine colophon with build date, technology, copyright, and secondary edition control.

## Signature Moments

### Headline Detonation

The manifesto begins visibly misregistered. Pointer movement introduces restrained physical drift; hover or keyboard focus temporarily aligns related fragments. Reduced-motion mode presents the finished static collage with no loss of content.

### Found Object No. 33⅓

Candidate B's turntable returns as a record physically pasted into the cover composition. Pointer movement rotates it, and Left/Right Arrow provide the same interaction. It never plays surprise audio and becomes a stable found object under reduced motion.

### GitHub Noise Machine

The MPC/Maschine activity pulse merges with Candidate A's contribution press. A tactile pad matrix represents real public activity intensity. Hover, focus, or selection reveals the corresponding event and repository. A semantic event list carries the actual content, so the visual is never the only source of information.

## Responsive Composition

Mobile is a recomposed pocket zine, not a scaled desktop page:

- One dominant fragment per viewport.
- Turntable moves below the manifesto.
- Poster stacks become vertical layers without horizontal scrolling.
- Activity pads remain at least 44 by 44 CSS pixels when interactive.
- Decorative collisions cannot cover text or controls.
- All display copy wraps intentionally; no compressed or accidental word joins.
- The experience is verified at 320, 390, 768, and 1440 CSS-pixel widths.

## Technical Architecture

- Astro static output with TypeScript throughout.
- Vanilla TypeScript controllers for theme, turntable, activity pads, tabs, and progressive enhancement.
- Focused Astro components for `Masthead`, `Manifesto`, `FoundRecord`, `GitHubPress`, `RepoPosters`, `ActivityGalley`, `PersonalCollage`, `Classifieds`, and `Colophon`.
- Separate typed GitHub fetch, normalize, and fallback modules.
- CSS tokens separate theme colour from physical-material components.
- No runtime-random layout and no client-side data request, preventing content layout shift.

## GitHub Data and Failure Handling

The production build requests the public profile, repositories, public events, and selected repository releases. An optional build-time GitHub token enhances pinned and contribution data; no token reaches the deployed client.

Responses normalize into one typed `GitHubDossier`. Core data selection is atomic: malformed, rate-limited, timed-out, or non-OK core responses use the complete checked-in last-known-good snapshot. The visible status distinguishes live data from the dated fallback.

A scheduled GitHub Actions build refreshes the static dossier daily. Pushes to the default branch also rebuild and deploy.

## Accessibility and Performance Guardrails

- Semantic landmarks and linear DOM order remain understandable without CSS.
- One `h1`, ordered section headings, a skip link, descriptive link labels, and visible focus treatment.
- All interaction works with keyboard and touch; no essential hover-only content.
- WCAG 2.1 AA contrast is measured in both themes, including text placed on scraps and stamp surfaces.
- `prefers-reduced-motion` removes drift, snapping, reveal, spin, and parallax motion while keeping every control usable.
- Self-hosted subset fonts, minimal JavaScript, reserved layout space, optimized images, and lightweight SVG/CSS texture support Lighthouse mobile scores of at least 90 for Performance, Accessibility, Best Practices, and SEO.

## SEO, Testing, CI, and Deployment

The final root site includes canonical metadata, title and description, Open Graph and Twitter cards, a custom Photocopier Riot OG image, favicon, sitemap, and `robots.txt`.

Verification includes:

- Vitest tests for theme resolution, data normalization, fallback selection, and activity intensity.
- Browser tests for both themes, persistence, keyboard interactions, responsive composition, and fallback rendering.
- Axe checks for both themes and major interactive states.
- Lighthouse mobile measurement against all four 90-point targets.
- Astro check, production build, formatting, linting, and whitespace validation.

GitHub Actions validates pull requests, creates a Cloudflare preview when configured, and deploys the production build from the default branch. The repository includes working Wrangler configuration and a README describing local development, optional GitHub data credentials, required Cloudflare secrets, scheduled refreshes, previews, and production deployment.

## Completion Gate

The design is complete only when the root site implements this specification, all automated checks and measured quality targets pass, both themes have been visually reviewed at desktop and mobile widths, the graceful fallback has been deliberately exercised, the deployed Cloudflare workflow is verified with available credentials, and the three candidate directories have been removed after final approval.
