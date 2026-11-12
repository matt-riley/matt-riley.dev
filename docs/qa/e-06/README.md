# E-06 native renderer verification

Three focused tests pass on full Chromium with the actual Apple M5 Metal renderer
at 960×600 / DPR1. The recorded native forward-and-return tour captures all nine
stops and both scripted poses. All nine cats are visibly clear of their plinths
and cards in `tour-contact.png`; all 17 settled captures and the source report
were retained by the test. `scroll-tour.webm` is the final native recording.

The figurine has no hop/rotation animation or drag path. Relocation and pose
changes require its old bounds to leave the camera frustum expanded by 0.08m.
`marker-projection.json` checks the actual camera matrices, plinth clearance
and adjacent expanded frusta. A 300ms fade covers native hash-jump arrivals and
on-screen setting changes. Header toggles and quiet keyboard responses pass.
The Flagz control uses the same settings event; a final integrated native toggle
check follows main integration.

Geometry, textures and the complete room BIN chunk are unchanged by marker
corrections. Blender JSON, raw room and shipped room use the same positions.
The first software-only capture omitted the Acquisitions cat despite valid
state; native compositor capture verifies the real supported-renderer result.

This is local validation. It does not claim production deployment or phone QA.
