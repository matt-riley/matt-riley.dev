# Direction A: standalone toolbox proof

Original procedural foreground asset for the accepted warm, tactile toolbox direction. This is one real 3D object, not the old museum room. No third-party models, textures, or generated object pixels are used. Project labels remain HTML; the asset contains no outdated project names.

## Reproduce

From the repository root, with the repository dependencies installed:

```sh
nice -n 15 /Applications/Blender.app/Contents/MacOS/Blender --background --threads 4 --python-exit-code 1 --python blender/hero-toolbox/build.py
node blender/hero-toolbox/pack.mjs
```

`GLTF_TRANSFORM_BIN` can select another installed glTF Transform executable. The build generates deterministic 512 px seamless colour, packed roughness/metalness, and normal textures, exports the closed object, then reimports that raw GLB into a standalone Cycles scene for the closed/open/mobile proofs. `blender/out/hero-toolbox` holds ignored intermediates. No `.blend` file is required.

The shipping GLB is `public/preview-a/toolbox.glb`. Meshopt and WebP decoders are required. The pack script retains empty hinge nodes and rejects >=150,000 bytes or >=10,000 triangles. All texture bytes are embedded and included in the GLB budget. Exact output is recorded in `stats.json`.

## Runtime contract

Metres, glTF +Y up, floor at Y=0. Front faces +Z. Root `hero_toolbox`. The file's saved transforms are the closed/rest pose: **clone each pivot's original quaternion before animating**. Apply a local X rotation of `delta * progress` relative to that quaternion; do not overwrite with an absolute angle of zero. `parameters.json` records authored base angles, deltas and native proof cameras in both coordinate systems.

| Nodes | Delta | Phase |
| --- | --- | --- |
| `touch_clasp` | +42 degrees | clasp |
| `touch_lid` | -110 degrees | lid |
| `touch_tray_front`, `touch_tray_front_link` | +1.70 rad | tray |
| `touch_tray_front_level` | -1.70 rad | tray |
| `touch_tray_upper`, `touch_tray_upper_link` | +1.35 rad | tray |
| `touch_tray_upper_level` | -1.35 rad | tray |

The primary/secondary tray links are a parallelogram mechanism. The counter-pivot must use exactly the same progress/easing as its two links to keep each tray level. Suggested opening phase windows: clasp 0–18%, lid 10–68%, trays 38–100%; reverse in closing order. All hinge axes and relative travel are also exported in node extras (`kind`, `axis`, `range`, `phase`). Avoid reparenting the mesh children.

Use the exported PBR materials directly: `hero_stoneware`, `hero_orange_glaze` (#E8741A source colour), `hero_charcoal`. Grain repeats every 10 cm. No legacy glaze brightness multiplier/shader is required. A warm side area/key, broad dim environment reflection, and ground contact shadow are part of the look. Native proof settings and exact cameras are in `parameters.json`; browser lighting needs its own visual calibration because Blender and Three.js lights do not share power units.

## Evidence and limits

`proofs/closed.png`, `proofs/open.png`, and `proofs/mobile-open.png` render the reimported raw GLB with native Cycles CPU, AgX, four threads. They verify actual exported geometry/materials and mechanical poses. They are not screenshots of browser lighting or of the optimized decoder. The packed GLB is separately inspected for triangle count, total bytes, texture dimensions and all eight pivots. Vertex tangents are baked before Meshopt compression. Khronos validation reports zero errors and zero warnings for both the shipping GLB and a glTF Transform decoded copy (the validator notes that it cannot itself validate the Meshopt extension). Final size: 146,016 bytes; 7,476 triangles; 7,704 bytes of embedded WebP textures. Browser mounting, interaction/picking, animation interruption, responsive layout and runtime lighting remain integration work.

Keep the foreground separate from any generated environment image: do not overlay this object on a backplate already showing a closed toolbox. These proofs establish the object asset; they do not claim an entire 3D site rewrite.
