# Direction A: live toolbox asset

Original procedural foreground object for the accepted warm ceramic toolbox direction. It remains separate from the accepted image-led hero. No third-party models, textures, or generated object pixels are used. Project labels remain HTML.

The current mechanism proof has a 460 mm wide, 100 mm high body and 43 mm hollow rounded lid, with a 2 mm seam. The case is 145 mm high excluding its handle (width:height 3.17:1); the lid contributes 30%. A smooth round orange arch swivels as the lid opens. Two paired cantilever linkages lift the trays while counter-pivots keep them level. Small side guide notches/pockets clear their mounting blocks; a rear-offset hinge prevents the open lid from entering the case rim.

## Reproduce

From the repository root, with dependencies installed:

```sh
nice -n 15 /Applications/Blender.app/Contents/MacOS/Blender --background --threads 4 --python-exit-code 1 --python blender/hero-toolbox/build.py -- --export-only
node blender/hero-toolbox/pack.mjs
nice -n 15 /Applications/Blender.app/Contents/MacOS/Blender --background --threads 4 --python-exit-code 1 --python blender/hero-toolbox/build.py -- --render-only
```

`GLTF_TRANSFORM_BIN` can select another installed glTF Transform executable. The build deterministically generates seamless stoneware colour/ORM/normal maps (512 px) and low-frequency glaze colour/ORM maps (256 px), exports the closed object, then reimports that actual raw GLB into a standalone Cycles scene for closed/open/mobile proofs. Intermediate exports go in ignored `blender/out/hero-toolbox`; no `.blend` file is needed.

The shipping file is `public/preview-a/toolbox.glb`. Meshopt and WebP support are required. Packing joins no animated hierarchy: rigid siblings are batched during authoring, then glTF Transform deduplicates, prunes while retaining pivots, welds, bakes MikkTSpace tangents, compresses textures and applies Meshopt. It rejects >=150,000 bytes, >=10,000 triangles, images above 512 px, or missing hinge nodes. Exact texture dimensions/bytes are inspected from embedded WebP headers, rather than assumed.

## Runtime contract

Metres, glTF +Y up, front +Z, floor Y≈0 (14 µm quantization offset). Root `hero_toolbox` has identity orientation/scale; no compensating root rotation is needed. **Clone each pivot’s saved rest quaternion before animating**. Set `restQuaternion * quaternion(localX, delta * progress)`; never replace saved base angles with zero. `parameters.json` records actual proof cameras in Blender and glTF coordinates. `bounds.json` records decoded, world-space bounds at five opening fractions.

| Nodes | Relative X travel | Phase |
| --- | --- | --- |
| `touch_clasp` | −42° | clasp |
| `touch_lid` | −110° | lid |
| `touch_handle` | +110° | lid |
| `touch_tray_front`, `touch_tray_front_link` | +1.75 rad | tray |
| `touch_tray_front_level` | −1.75 rad | tray |
| `touch_tray_upper`, `touch_tray_upper_link` | +1.40 rad | tray |
| `touch_tray_upper_level` | −1.40 rad | tray |

All eight original pivots are preserved; `touch_handle` is the ninth. Its counter-rotation keeps the handle upright while its base travels with the lid. Use identical progress/easing for lid/handle and each tray’s paired links/counter-pivot. **Required opening windows for the proven sequence:** clasp 0–18%, lid+handle 10–68%, trays 38–100%; reverse when closing. Uniform progress applied to every part is not the validated mechanism. Saved tray rest angles are −1.15 rad (links) and +1.15 rad (counter-pivots). Node extras export `kind`, `axis`, `range` and `phase`. Avoid reparenting rigid children.

Decoded closed bounds: `[-.24900,.000014,-.12699]` → `[.24900,.21900,.14000]`. Open: `[-.24900,.000014,-.27677]` → `[.24900,.35831,.19635]`. Include the intermediate sweep in framing: the sequenced sweep reaches .37625 m high. All 101 decoded opening fractions have finite world positions. Side links explain the extra width beyond the 460 mm shell.

## Materials and lighting

Use imported PBR materials directly: `hero_stoneware`, `hero_orange_glaze`, `hero_charcoal`. Colour textures are authored sRGB; roughness/metalness and normal textures are non-colour/linear. glTF base-colour factors are linear. GLTFLoader handles these colour spaces; do not multiply the orange colour by the legacy museum calibration. Grain repeats every 10 cm. Glaze colour centres near sRGB `#AF3404`, with subtle low-frequency kiln variation; roughness is .22±.008, clearcoat .8 and coat roughness .075.

Native lighting uses AgX exposure −1, a warm narrow area key at Blender `[-.65,-.35,.72]` (glTF `[-.65,.72,.35]`), 38 W, .14×.60 m, RGB `[1,.86,.65]`; 0.6 W broad fill; dim warm world .075 and a .65-strength sun. The room’s stone/plaster/record/frame are proof-only context, not part of the object GLB. Three.js area lights do not cast shadows and its power units differ: use a matching warm directional shadow key plus environment reflection/area illumination, a subdued bounce, and a receiving ground plane. Calibrate browser lighting against these proofs; do not assume identical numerical light intensities reproduce Cycles.

## Evidence and limits

Current `proofs/closed.png`, `open.png`, and `mobile-open.png` render the exported-and-reimported final GLB using Cycles CPU, 48 samples, four threads. `parameters.json`, `clearance.json` and `stats.json` link the proof export and packed asset with the same raw SHA-256. The packed asset SHA-256 is also recorded in `stats.json`. Packed and decoded-copy Khronos validation both report zero errors/warnings (Meshopt itself is unsupported informationally by the validator). Decoded geometry at all 101 sequenced fractions has finite world positions; all nine pivot ranges survive packing.

Final budget: 149,396 bytes, 9,916 triangles, 9,024 embedded texture bytes. Browser mounting, animation interruption, picking and runtime-lighting comparison remain integration checks. These are native proof renders, not browser screenshots and not a claim that an entire site has been replaced in 3D.

Earlier art passes remain in `proofs/v1`, `proofs/v2`, `proofs/v3`, `proofs/v4` and their numbered parameter files. The current asset corrects their angular handle, tall case/thin lid, noisy glaze, hidden open-state handle and moving collar attachment. A’s generated room has richer environmental detail; the live viewer should keep its own reviewable presentation rather than replace the approved image-led hero or paint this mesh over generated closed-toolbox pixels.

## Mechanical preflight

Every export runs `clearance.py` before batching. It samples 101 positions in the required staged opening sequence and tests 343 structural mesh pairs at each position using BVH candidates plus exact segment/triangle crossings. The final report has zero triangle crossings and a minimum tray shell gap of 3.459 mm. It checks the case against moving trays, rods, brackets, lid and latch, the lid against payloads/handle, and the two tray assemblies against each other. Intentional bolted joints and within-assembly contacts are excluded; coplanar tangencies are not reported. This is a geometry preflight, not a general physics simulation.

The outward clasp travels −42°; positive travel would fold it into the case. Longer 137 mm arms lift the trays before they pass the front wall. The lower bracket passes through an open-top case guide, and the upper bracket through a pocket at the lid’s lower edge. Fixed handle collars follow the lid; the orange arch counter-rotates above its outer roof. `--render-only` verifies the raw export SHA against the preflight report before importing it, so proof rendering cannot silently regenerate a different mechanism.

Frozen raw export SHA-256: `97fe4ca45e1a3faa77804a84526167c09b0966d7c16aa0f92bdebd1d163d1d4f`. Packed GLB SHA-256: `ef8e3e31d1f45f915f095a2f25deb067962b9dfc713e8c34d4f478b5dbece180`. The final open views retain partial rim occlusion of the orange handle; the fixed collars no longer float inside the cup.
