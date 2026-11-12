# Identity and contributor verification

## Contributor walkthrough

An author walkthrough followed the new-exhibit guide against the actual schema, loader, room/export sources, photograph renderer and gallery runtime. It exposed a concrete omission: adding only a registry modelSpec would miss AssetStore’s ID type and fetch ordering. The guide now explicitly lists modelStops/exhibits, nearest-stop bounds, CameraRail length/IDs/framing, room geometry, photo lists and corresponding tests.

A separate agent independently reviewed README.md and docs/adding-an-exhibit.md at source head `8486e8ea0e8c1cb88b84d9efcce5862e849c3bbc`. That read-only review traced content/schema/slots, MODEL_ID and pivot export, both asset/registry mappings, explicit camera/range lists, all four stills, onRecord resource ownership, validation and deployment commands to their owning source. It found no actionable remaining gaps. Its optional suggestion to name hinge/slide units has been incorporated: radians and metres respectively.

This is a documented contributor walkthrough and independent source review, not a claim that an unaffiliated person built and shipped a tenth exhibit. No model, room bake or runtime feature was added solely to test the instructions.

## Source preparation

Astro check: zero errors, warnings or hints. Biome lint passes; both Python renderer sources parse successfully. The new opaque Apple/manifest icons are generated from the native SVG at exactly180/192/512px. All production and development dependencies have a corresponding source import, build command or test use; no unused package was removed speculatively. The former styleguide route was already removed in C-06. A case-insensitive legacy-name search across the isolated worktree returns no matches, excluding node_modules, Git metadata and ignored render intermediates.

Final share-image rendering, two actual preview-tool screenshots, browser-tab theme screenshots and refreshed canonical-cat photographs remain pending the coordinated render/browser slot. No deployment or production preview verification has been claimed.
