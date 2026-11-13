# Direction A: standalone toolbox art-review draft

Original procedural foreground asset for the accepted warm, tactile toolbox direction. This is one real 3D object, not the old museum room. No third-party models, textures, or generated object pixels are used. Project labels remain HTML; the asset contains no outdated project names.

The initial draft was reviewed and rejected as a visual match for A. The current single closed proof improves the low handle, close camera and directional lighting; it remains separate from the accepted image-led preview and has not been approved as parity.

## Reproduce

From the repository root, with the repository dependencies installed:

```sh
nice -n 15 /Applications/Blender.app/Contents/MacOS/Blender --background --threads 4 --python-exit-code 1 --python blender/hero-toolbox/build.py -- --closed-only
node blender/hero-toolbox/pack.mjs
```

`GLTF_TRANSFORM_BIN` can select another installed glTF Transform executable. The build generates deterministic 512 px seamless colour, packed roughness/metalness, and normal textures, exports the closed object, then reimports that raw GLB into a standalone Cycles scene for the single closed art-review proof. Omit `-- --closed-only` to render a full pose set in a future review. `blender/out/hero-toolbox` holds ignored intermediates. No `.blend` file is required.

The shipping GLB is `public/preview-a/toolbox.glb`. Meshopt and WebP decoders are required. The pack script retains empty hinge nodes and rejects >=150,000 bytes or >=10,000 triangles. All texture bytes are embedded and included in the GLB budget. Exact output is recorded in `stats.json`.

## Runtime contract

Metres, glTF +Y up, floor at Y=0. Front faces +Z. Root `hero_toolbox`. The file's saved transforms are the closed/rest pose: **clone each pivot's original quaternion before animating**. Apply a local X rotation of `delta * progress` relative to that quaternion; do not overwrite with an absolute angle of zero. `parameters-v2.json` records the current native proof camera, lighting and part angles. `parameters-v1.json` and `proofs/v1/` preserve the rejected initial draft for comparison.

| Nodes | Delta | Phase |
| --- | --- | --- |
| `touch_clasp` | +42 degrees | clasp |
| `touch_lid` | -110 degrees | lid |
| `touch_tray_front`, `touch_tray_front_link` | +1.70 rad | tray |
| `touch_tray_front_level` | -1.70 rad | tray |
| `touch_tray_upper`, `touch_tray_upper_link` | +1.35 rad | tray |
| `touch_tray_upper_level` | -1.35 rad | tray |

The primary/secondary tray links are a parallelogram mechanism. The counter-pivot must use exactly the same progress/easing as its two links to keep each tray level. Suggested opening phase windows: clasp 0–18%, lid 10–68%, trays 38–100%; reverse in closing order. All hinge axes and relative travel are also exported in node extras (`kind`, `axis`, `range`, `phase`). Avoid reparenting the mesh children.

Use the exported PBR materials directly: `hero_stoneware`, `hero_orange_glaze` (#CC4A05 source colour in this new art-review draft), `hero_charcoal`. Grain repeats every 10 cm. No legacy glaze brightness multiplier/shader is required. A warm side area/key, broad dim environment reflection, and ground contact shadow are part of the look. Native proof settings and exact cameras are in `parameters-v2.json`; browser lighting needs its own visual calibration because Blender and Three.js lights do not share power units.

## Evidence and limits

The current `proofs/closed.png` renders the reimported raw GLB with native Cycles CPU, AgX, four threads. It verifies actual exported geometry/materials in the closed pose; the archived v1 open/mobile proofs show the prior mechanism, not the revised material/handle. These are not screenshots of browser lighting or of the optimized decoder. The packed GLB is separately inspected for triangle count, total bytes, texture dimensions and all eight pivots. Vertex tangents are baked before Meshopt compression. Khronos validation reports zero errors and zero warnings for both the shipping GLB and a glTF Transform decoded copy (the validator notes that it cannot itself validate the Meshopt extension). Final size: 145,636 bytes; 7,412 triangles; 7,704 bytes of embedded WebP textures. Browser mounting, interaction/picking, animation interruption, responsive layout and runtime lighting remain integration work.

Keep the foreground separate from any generated environment image: do not overlay this object on a backplate already showing a closed toolbox. These proofs establish the object asset; they do not claim an entire 3D site rewrite.

## Current comparison with A

The revised closed proof has a substantially lower, thicker orange arch, larger object framing and darker directional shadows under the clasp, lid and base. It is still an art-review draft: the handle retains visibly angular sections rather than A’s organic rounded curve, the orange glaze is lighter and more uniform than the reference, and the standalone wall/ledge lacks the reference environment’s richness. This is not an approved visual match and is not integrated into the image-led preview. Only one revised closed proof was rendered; the archived open/mobile views belong to v1.
