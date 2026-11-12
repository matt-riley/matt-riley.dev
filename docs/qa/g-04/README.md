# G-04 validation

The nine real-software WebGL stop captures include the debug overlay. High-tier
draws are 9–57 calls and 13,338–38,240 triangles, below the 60-call / 150k-triangle
limits. Static geometry is batched per material and touch pivot; named anchors,
source bounds, portrait surface and animated pivots remain available.

The isolated benchmark uses one 960×600/DPR1 context. The shared test fixture
explicitly opts into real software rendering; production's known-software-driver
guard otherwise preserves the complete catalogue.

## Throttled retreat

`cpu-6x-trace.json.gz` is a Chrome DevTools trace with 6x CPU throttling.
`cpu-6x.json` records High → Medium → Low → Retreat. The catalogue remains usable,
its one-line note appears, no canvas remains, and saved `mr-view` stays `gallery`.
The page reports no errors. `cpu-6x.png` captures the result.

## Live model lifetime

`memory.json` records five complete live Low-tier round trips after one warmup,
with forced GC after each. Every return has exactly 10 GPU geometries, 4 textures
and 4 registry records. The retained JS heap stays between 6.09 and 6.46MB; the
last increment is 0.37%. These exact values document the small VM/cache warmup
variation rather than claiming byte-identical JS heap samples. `low-memory.png`
shows the final live view. A longer stress tour can correctly retreat on forced
software graphics; the five-trip measurement does not disable the guard.

## Regression checks

Five CPU-only tests cover sustained one-way degradation, true idle exclusion,
short authored camera dwells, modest-hardware starting tier, normalized glTF
positions, preserved touch pivots, record cleanup before unloading, fresh adapter
remounting, and auxiliary model registration. The focused real-WebGL browser test
passes for Medium startup, hidden/modal no-frame behavior and resumption. Actual
hidden draw instrumentation stays at 40 before/after resize and scroll events.
