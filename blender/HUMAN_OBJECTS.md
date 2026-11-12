# Human Error and gift-shop models (B-05)

All four objects are original scripted geometry using the approved P2/G2 materials:
porcelain roughness 0.85 and glaze `#E8741A`. There are no texture images, letters,
logos, manufacturer badges or imported meshes.

## Build and validate

```sh
pnpm assets -- --only open_mic
pnpm assets -- --only boom_bap
pnpm assets -- --only absent
pnpm assets -- --only gift_shop
node blender/validate-human-models.mjs
```

`MODEL_ID` keeps Python module names conventional while writing the shared hyphenated
GLB filenames. The validator loads the optimised GLBs through the actual Three.js
GLTFLoader and Meshopt decoder, checks root names and interaction metadata, and
asserts the 0.5m bounds, 15k triangles and 120,000-byte per-model limits.

| Model | Bytes | Triangles | Touch nodes |
| --- | ---: | ---: | ---: |
| `open-mic.glb` | 27,444 | 4,004 | 1 |
| `boom-bap.glb` | 24,396 | 5,024 | 16 |
| `absent.glb` | 32,960 | 3,144 | 0 |
| `gift-shop.glb` | 64,212 | 6,388 | 3 |

The microphone's nod pivot is at its swivel. Drum pads move down 3mm on exported
Y; the three gift-shop link groups move up 4cm on exported Y. The orange drum-pad
field is connected beneath its independent pad tops. The gift-shop glazing follows
the task's explicit exception: a narrow band on each shelf object plus the tea.

## Absent Exhibit placement

`absent.glb` is six floor fragments only. B-03 supplies the existing full-size empty
plinth and the dusting with pressed pawprint on its top; `anchor_absent` is on the
floor beside it. This agreed ownership split avoids spanning a 1m plinth with a
0.5m-bounded exhibit GLB or duplicating a smaller plinth.

## Review renders

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 --python blender/render-human-turntables.py
node blender/human-contact-sheets.mjs
```

The four-angle contact sheets are under `blender/renders/human-objects/`. Lighting
uses B-02's approved day setup: exposure -0.5, world strength 0.16, a 420W / 2.5m
skylight and 45W warm bounce, room roughness 0.5. Review frames use 640px, 16 Cycles
samples and seed 7. Their closer camera framing makes each object readable; lights
and material values remain the approved key-frame setup. No `.blend` output is
committed.

## Drum-machine originality check

Compared against the manufacturers' photographs of the
[Roland TR-808](https://www.roland.com/global/products/rc_tr-808/) and
[Rossum SP-1200](https://www.rossum-electro.com/products/sp-1200/).
The TR-808 photograph shows a long row of sequencer buttons beneath instrument
controls. The SP-1200 photograph shows an eight-pad row beneath faders, a display
and a numeric-control area.

This model uses a portrait-format slab with unequal corner chamfers, a centred
4×4 orange pad field, and only two unequal, diagonally offset porcelain dials. It
has no display, faders, transport strip, numeric keys, printed legends or brand
colour blocks. The required 4×4 grid is a generic input arrangement; the silhouette,
proportions and surrounding control layout were authored for this museum.
