# Identity and contributor verification

## Contributor walkthrough

An author walkthrough followed the new-exhibit guide against the actual schema, loader, room/export sources, photograph renderer and gallery runtime. It exposed a concrete omission: adding only a registry modelSpec would miss AssetStore’s ID type and fetch ordering. The guide now explicitly lists modelStops/exhibits, nearest-stop bounds, CameraRail length/IDs/framing, room geometry, photo lists and corresponding tests.

A separate agent independently reviewed README.md and docs/adding-an-exhibit.md at source head `8486e8ea0e8c1cb88b84d9efcce5862e849c3bbc`. That read-only review traced content/schema/slots, MODEL_ID and pivot export, both asset/registry mappings, explicit camera/range lists, all four stills, onRecord resource ownership, validation and deployment commands to their owning source. It found no actionable remaining gaps. Its optional suggestion to name hinge/slide units has been incorporated: radians and metres respectively.

This is a documented contributor walkthrough and independent source review, not a claim that an unaffiliated person built and shipped a tenth exhibit. No model, room bake or runtime feature was added solely to test the instructions.

## Source preparation

Astro check: zero errors, warnings or hints. Biome lint passes; both Python renderer sources parse successfully. The new opaque Apple/manifest icons are generated from the native SVG at exactly 180/192/512px. All production and development dependencies have a corresponding source import, build command or test use; no unused package was removed speculatively. The former styleguide route was already removed in C-06. A case-insensitive legacy-name search across the isolated worktree returns no matches, excluding only node_modules and Git metadata (including ignored render intermediates and binary files).

All 36 final source photographs have been rendered, copied through the dimension/signature guard and visually inspected in refreshed wide/square contact sheets. The complete original set totals 74,313,419 bytes. Per-image hashes and per-stop raw-room source hashes are retained in blender/renders/catalogue/parameters.json; geometry and stable Human/Gift marker equivalence proofs document the metadata-only room revisions. No deployment has been performed.

## Share-image source and typography

The sitting-cat scene rendered in 16.6 seconds on four low-priority CPU threads at 16 denoised samples. The 1200×630 PNG is 166,048 bytes. Its text is built from the actual bundled Bricolage Grotesque glyph paths using Fontkit at weight 700, then rasterised/composited by Sharp. The bundled font’s internal family is `Bricolage Grotesque 96pt ExtraBold`, so a plain CSS-style Pango name is insufficient proof of the chosen font on macOS. Outline extraction removes OS discovery/fallback entirely. `blender/renders/identity/typography.json` records the real family, weight, exact text and font SHA256; the adjacent parameters record the Cycles scene settings.

The refreshed catalogue includes all 36 originals. Human Error uses the scripted sitting cat facing away; Gift Shop includes the sleeping counter cat in its square framing. The world-matrix turnaround was verified in a small preview before the full-size pass. Wide views preserve the authored 35-degree camera; the original portrait keeps its real proportions. Both mode contact sheets were inspected after the complete atomic copy.

Browser/theme and two-tool link-preview acceptance criteria remain open. Metadata text was entered in MetaTags.io, but its file chooser stalled and the upload was interrupted; no successful image preview or screenshot is claimed. The second tool and native browser-tab light/dark screenshots were not completed. These checks remain unchecked in Notion and the PR stays draft until they are resolved.
