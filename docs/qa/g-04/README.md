# G-04 validation

Nine preliminary real-software WebGL screenshots include the debug overlay.
Measured High-tier draws are 9–57 calls and 13,338–38,240 triangles, below the
60-call / 150k-triangle limits. Static geometry is batched per material and touch
pivot; named anchors, source bounds, portrait surface and animated pivots remain.

The shared software-GPU integration fixture explicitly opts into actual rendering;
production's known-software-driver guard otherwise keeps the full catalogue.

Pure tests cover sustained degradation thresholds, no upward transitions, idle
gap exclusion, modest-hardware starting tier, normalized glTF position conversion,
retained touch pivots, record cleanup before unloading, fresh adapter remounting,
and auxiliary model registration.

Final isolated 960×600/DPR1 throttling, memory and nine-stop captures are pending.
An earlier contended diagnostic run showed High → Medium → Low → Retreat at 6x
CPU throttle, no persisted View change, no remaining canvas, no page errors and
no hidden/modal rendering. Its trace is kept outside the PR until isolated QA
can distinguish the implementation from concurrent software-GPU workloads.
