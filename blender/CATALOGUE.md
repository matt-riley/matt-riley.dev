# Catalogue photography

The committed photographs in `src/assets/catalogue/` are the no-WebGL catalogue
and gallery-loading fallback. Nine stops each have day/night wide and square
originals: 36 RGB PNGs. The original cat portrait remains the supplied photograph.

## Rebuild

```sh
pnpm assets
pnpm assets:stills
```

The first command builds raw scene exports in `blender/out/` before making the
Meshopt web derivatives. Photography imports those raw GLBs; Blender cannot import
the compressed derivatives in `public/models/`. `BLENDER_BIN` selects Blender.
The still-copy script validates all 36 PNG signatures and dimensions before
replacing any committed original.

For a constrained CPU render or an individual QA preview:

```sh
"$BLENDER_BIN" --background --threads 6 --python-exit-code 1 --python blender/render_catalogue.py -- --samples 8
pnpm assets:stills -- --copy-only
"$BLENDER_BIN" --background --threads 4 --python-exit-code 1 --python blender/render_catalogue.py -- --only tools --preview --output-dir blender/out/catalogue-preview
```

Preview images are one-third size and the copy script refuses to publish them.
`blender/out/stills/parameters.json` records model SHA256 hashes and render values.
The committed render uses eight denoised Cycles samples, seed 7 and AgX. Source
materials preserve the approved P2/G2 palette and orange glaze. Wide views use
the room's exact stop camera/target empties with a 35-degree vertical field of
view. Square close-ups centre on the object bounds; they do not move the runtime
camera. Every stop includes its canonical cat marker and named pose. Human Error
uses `cat_9` sitting on the empty plinth; the gift shop uses `cat_11` sleeping on
the counter. Other stops use their first numeric room marker, matching the live
tour's initial placement. Keep the authoritative room marker metadata current
before rendering; changing a marker does not require rebaking the static atlas.

The runtime room atlas already includes its illumination. For path-traced stills
the renderer restores original shared surface materials, preserving UV1 and the
source atlas. This gives the objects contact shadows and avoids double-lighting.
Day entrance/acquisitions views use the room's 2600W rectangular skylight,
world 0.35 and exposure -1; object views use the approved B-02 420W skylight,
45W bounce, world 0.16 and exposure -0.5. Night uses the approved 35W soft torch,
28-degree cone, world 0.001 and orange emission 0.12. Its initial pool aims at the
actual offset exhibit; the camera continues looking at the authored stop target.

## Browser delivery

`CataloguePhoto.astro` builds AVIF and WebP derivatives with `astro:assets`.
Wide sources offer 640/960/1440/2400px; square sources offer 640/960/1440px
without upscaling the 1600px original. The source art direction selects square
below 700px. Explicit image/source dimensions and a reserved aspect ratio keep
both crops stable. The invitation appears before the entrance photograph.

Two real `picture` elements per stop swap using `data-lights` CSS alone. Both
images are native lazy images so an inactive `display:none` photograph can stay
unfetched; the entrance additionally has `fetchpriority=high`. The no-JavaScript
catalogue defaults to day. The browser contract tests check actual image responses
at 390px, enforce the 90KB ceiling and switch Lights through the settings control.
The full performance harness retains the LCP-under-2s and CLS budgets.
