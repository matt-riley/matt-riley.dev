# Gallery lifecycle

The DOM remains authoritative. `gallery-gate.ts` alone decides whether to import
this runtime. Closed gates request no Three.js code or model data.

`boot({ onFailure })` returns `{ ready, dispose }` immediately, before any model
has loaded. Disposing cancels queued/fetching models, releases decoded geometry,
materials/textures and image bitmaps, removes listeners and canvas, disposes the
renderer and explicitly loses its WebGL context. A parse finishing after disposal
releases its result instead of attaching it.

`ready` resolves to `GalleryApp` after the room, nearest exhibit and async plugin
mounts are ready and one hidden frame has rendered. The gate then publishes
`data-gallery="ready"` and requests a frame. That frame runs plugins against the
active gallery CSS before making the canvas visible, so direct hash visits do
not flash camera stop 0.

## Plugins

Import `onGalleryReady` from `state.ts` in a small eager registration module.
Import heavy feature code dynamically inside the callback. All Three.js imports
in the subscription boundary are types and disappear from the eager bundle.

The mount may return a cleanup, or a promise of one. A late async cleanup runs
immediately if its app has already been disposed. `addCleanup` has the same
immediate-disposal guarantee; its return value only unregisters that cleanup.

The app exposes scene, camera, room, renderer, assets, activeStop and these hooks:

- `requestRender()` queues one frame, coalescing requests.
- `onFrame((deltaSeconds, timeSeconds) => boolean)` returns an unsubscribe.
  Return true only while animation/damping needs another frame.
- `onResize((width, height) => void)` returns an unsubscribe.
- `addCleanup(() => void)` registers session-owned work.

`activeStop` is derived view state for the rail and picker, not a replacement for
the HTML sections. Optional plugins must keep their DOM equivalents usable.

## Asset ownership

`assets.get(id)` returns a cached `Promise<GLTF>`. The room always loads first;
remaining requests are serialized and prioritized around the nearest stop.
`setNearestStop` reprioritizes queued work. The store captures resource ownership
at load time, so a registry may reparent model roots without losing disposal.
The store owns GPU-resource disposal; registries own attachment/event cleanup.

The baked room map uses UV1 in an unlit, untone-mapped material. Exhibit materials
retain approved porcelain/glaze values and use the shared hemisphere/key light.
The gallery renders on demand, including after a resize or setting change, and
pauses while the document is hidden.

## Photograph colour calibration

The renderer uses ACES, while the approved Blender photographs use AgX. The
orange glaze alone uses Three's AgX shader with a display-light scale of 3;
its GLB base colour remains #E8741A. Dark cat stripe glaze is excluded. This
approximates Blender's soft glaze highlights without a white environment map,
extra textures, or a palette change. The baked room remains unlit and is not
re-exposed: it already contains Blender's display transform.

Measured entrance medians (sRGB bytes): baked wall 216/214/210 versus photograph
216/212/206; glaze before 216/117/30, calibrated 233/172/125, photograph
222/160/130. These are representative patches rather than a claim of pixel
identity: the live rail also offsets framing to clear the HTML placard.

## Slow graphics fallback

The standard WebGL `failIfMajorPerformanceCaveat` flag declines contexts the
browser considers dramatically slower than native GPU rendering. Those visitors
keep the complete photographic catalogue and request no Three.js or models.
This is a production capability rule, including software fallback drivers,
not a user-agent or test-runner check. The WebGL specification defines it at
https://registry.khronos.org/webgl/specs/latest/1.0/#5.2 .

Hosted Linux evidence before this guard: three home audits scored .74 with
1.53–1.54s total blocking time; shader/first-frame tasks took ~1.2s and ~.4s.
Local audits also used SwiftShader and scored .96–.98 on this faster CPU. Integration tests explicitly
remove that context attribute and override only the reported unmasked renderer name in their fixture, retaining real Three.js,
real software contexts, rendering, model loads and disposal coverage; network
gate tests separately verify the unmodified performance-caveat fallback.

Some Chromium software contexts still succeed with the standard caveat flag.
The same production probe therefore also declines explicitly reported SwiftShader,
llvmpipe, softpipe, software rasterizer and Microsoft Basic Render drivers. If
renderer information is unavailable, it allows the context and lets the runtime
frame-rate guard decide. This conservatively keeps CPU-only visitors in the
complete catalogue even when a fast CPU could have run the gallery adequately.
Native capability details are attached to browser validation reports.
