# Adding an exhibit

The complete catalogue is the product. A new exhibit must have readable content, an ordinary keyboard/touch control and useful results before adding a 3D adapter. Preserve the approved copy and materials; draft new facts for Matt’s review instead of inventing them.

## 1. Register the content and stop

Create `src/content/exhibits/<id>.md` using a nearby exhibit as a template. Frontmatter requires `id`, zero-based unique `order`, `title`, descriptive visual `alt`, `dates`, `medium`, accession `MR.<year>.<three digits>`, HTTPS `links`, `touchLabel`, `touchResult` and `draft`. Optional `items` have `label` and optional HTTPS `href`, `note` and `medium`. The Markdown body is the curator’s note. Set `draft: false` only after copy approval.

The schema currently defines exactly nine canonical IDs and orders 0–8 in `src/content.config.ts`. For an additional stop, extend `exhibitIds` and its order maximum; keep unique consecutive orders and accessions. The homepage and header read the sorted collection automatically. The gallery currently follows an intentionally authored nine-stop tour: update its explicit ranges/lists and their tests when changing that count, rather than silently replacing a stop.

`Exhibit.astro` supplies the section ID, `h2`, running accession, labelled figure, native disclosure/button and polite result. Its default slot holds body content; named `after`, `figure` and `items` slots allow specialised content. Sub-exhibits need `h3` headings and their own unambiguous native controls/results. Keep legal/footer links outside the canvas and preserve the final tab order.

## 2. Author the Blender model

Create `blender/scenes/<python_module>.py` with `create()` if useful and `build(output_path)` for export. Copy the structure of a small existing model, use `lib.scene.reset()`, factories from `lib.materials`, and `lib.export.export_glb`. Declare `MODEL_ID = "hyphenated-id"` when the Python module name differs from the desired GLB ID. The build manifest controls output names; do not rename files afterward.

Author in metres, Blender Z-up. The exporter converts to glTF Y-up. Every object has a single base-centred `exhibit_<id>` root and fits inside a 0.5m cube. Parent all geometry and pivots to that root. Use porcelain `#F1EEE6` roughness0.85 and the approved `#E8741A` clear-coated glaze only on the working part. The cat’s darker stripes are its documented exception. Keep normal objects below120KB and15k triangles, with textures at most1024px. The room alone has a2048px baked atlas.

Each movable part is a separate `touch_<name>` pivot at its actual hinge/slide origin. Export extras `kind: "hinge"|"slide"`, `axis: "x"|"y"|"z"` **in exported glTF axes**, and finite two-number `range`. The exporter wraps mesh parts in same-origin empty pivots so quantisation cannot move the hinge. Keep names through optimisation; do not flatten/join across touch pivots. `animatePart(part,fraction)` maps0..1 to the authored range relative to the captured base. Rest is not always0: symmetric mic hinges rest at.5, drum pads at1.

```sh
pnpm assets -- --only python_module
```

Inspect the actual optimised `public/models/<id>.glb` with Three.js GLTFLoader plus Meshopt. Verify bounds, base position, materials, extras and repeated animation neutral return. `pnpm assets` rejects the entire proposed set before replacing outputs if combined GLBs reach1.5MB.

## 3. Place it in the room and camera rail

Update `blender/scenes/room.py`: add the tour ID and author `anchor_<model-id>`, `stop_<index>_cam` and `stop_<index>_target`. Stop eyes are1.5m above the floor, vertical FOV35°, with alternating placard sides. Add an appropriate stable cat marker with `stop` and `pose` extras, following `blender/cat-spots.json` when present. Rebuild the room and check its actual exported camera framing at phone/desktop sizes. The portrait plane owns UV0; the baked room uses UV1. The room owns full-size plinths; miniature models must not duplicate them. The absent fragments intentionally anchor on the floor beside their empty plinth.

Register the new GLB in `modelSpecs` in `src/gallery/exhibits.ts` with its content stop ID and numeric index. The registry positions its root on the exact room anchor. Review fixed stop bounds in `src/gallery/rail-state.ts` and `rail.ts` as well as catalogue/metadata tests. A sub-exhibit can share a stop index. `setStopTarget` allows a lazy adapter to supply both a target and bounds without taking over the render loop.

## 4. Make the photographs

Add the stop/model to `STOPS`/`MODELS` and any specialised subject bounds in `blender/render_catalogue.py`, and the stop list in `scripts/build-stills.mjs`. `CataloguePhoto.astro` discovers source files by ID. Keep the source-camera wide render and deliberately composed square close-up; include the canonical cat marker/pose and original portrait where appropriate.

```sh
pnpm assets
pnpm assets:stills
```

This generates four RGB PNGs per stop: `<id>-day-wide.png`, `-night-wide.png` at2400×1600, and `-day-square.png`, `-night-square.png` at1600×1600. All must exist before the copy step replaces anything. Raw non-Meshopt GLBs are mandatory for Blender imports. Record source hashes/lighting in render parameters and inspect full/contact-sheet crops. Responsive AVIF/WebP derivatives are generated by Astro; keep both mode pictures native-lazy, CSS-switched, fixed-aspect and below the mobile90KB limit. The `alt` frontmatter describes the actual object, not a joke or duplicate title.

## 5. Add behaviour through the real control

Use a small eager module in `src/scripts/` for DOM-only behaviour, imported by `src/pages/index.astro`. Its gallery registration imports only `onExhibitsReady` from the type-only boundary and dynamically imports the visual module after the registry is ready. Check `registry.disposed` after awaiting that import.

The control dispatches bubbling `mr:touch` with `{ exhibit, model?, part? }`. A result belongs in the relevant polite live region; use native anchors for navigation and never require the canvas. A physical part maps to that same control with `registry.setControl(id, "touch_name", element)`. Install custom motion via `setTouchHandler`, `setDraggable` or `setPickBounds` only when required; each returns a restore cleanup. Use `animatePart` for exported ranges, not accumulating transforms.

Bind each model through `registry.onRecord(record => cleanup)`. Near-stop streaming unloads distant records and later reloads them; never keep a model root only from initial mount. The record cleanup removes listeners, pending timers, frame callbacks and feature-owned lights. The asset store owns model GPU disposal and the registry releases part tweens. Dispose resources created by the feature itself. Keep stable room bindings/camera resolvers session-owned. Register immediate `app.addCleanup` before awaiting textures; guard late results and dispose any texture arriving after disposal. Far-away features must not fetch textures/models or delay the entrance frame.

Request a frame after state changes. Return true from `app.onFrame` only while actual motion is active; there is no idle render loop. Stop work when hidden, keep reduced-motion/catalogue fallbacks usable, and preserve vertical touch scrolling. For more detail, read [the adapter contract](../src/gallery/INTERACTIONS.md) and [lifecycle/ownership](../src/gallery/README.md).

## 6. Verify the complete visitor path

Run `pnpm check`, `pnpm lint` and a deterministic fallback build. Add meaningful tests for the new content/GLB contract, real native control and lifecycle risk. Extend fixed-count tour expectations intentionally. Verify keyboard, pointer, touchscreen, JavaScript-off and reduced motion; check both light modes and descriptive accessible names. Renderer integration tests use `allowSoftwareWebGL(page)` before navigation and still render real contexts. Gate tests must continue to cover unmodified production capability fallback.

Run the full suite and Lighthouse serially (`REQUIRE_FINAL_COPY=true pnpm test --workers=1`, then `pnpm perf` on a fallback build). Preserve eager-JS/model/texture, draw-call, LCP/CLS and mobile-photo budgets. Tour away/back with streaming, switch View repeatedly and check cleanup/context loss. Inspect the actual composed gallery and the photographic catalogue at390/768/1440px, not just the Blender source. Verify every new external destination returns200 with the opt-in live-link check. Record screenshots/measurements in `docs/qa/`, update completed Notion acceptance criteria, and open a task-scoped PR with exact validation evidence.
