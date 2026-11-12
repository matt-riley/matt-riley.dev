# Human Error verification

The final runtime checkpoint `c9bf0082` was integrated into the Gift Shop stack at `066dd4d0ca9d6662b1ce575c36f572f1ffe451a8` for one shared, one-worker Playwright run. All 417 discovered tests completed with no failures (the five-project suite retains intentional capability skips). Astro check and Biome lint also pass.

The focused real-gallery tests verify the shader-uploaded two-second microphone light, native live result, sharp original 768px WebP and deferred texture loading: no portrait request at entrance or stop 4, first request at stop 5. The shipped-GLB motion test samples twelve bounded nods and neutral returns. DOM tests cover keyboard, mouse, touchscreen and JavaScript-disabled sub-placard navigation.

A read-only subscription to the existing built `onExhibitsReady` API captured `registry.app.camera` after the first enhancement frame, without production debug hooks. The Human Error pan was measured at these settled logical positions:

| Progress | Active stop | Camera x | Quaternion y |
| -------- | ----------- | -------- | ------------ |
| 6.65     | 7           | 9.4817   | -0.0304      |
| 7.00     | 7           | 10.0000  | 0.0817       |
| 7.35     | 7           | 10.5233  | 0.2068       |

Camera position and rotation change across all three anchors. Initial diagnostic captures taken before the first enhancement frame had been reset to the fragment's centre; waiting for that frame resolves the diagnostic ambiguity.

Day/night, microphone and empty-plinth gallery screenshots in this directory verify the unlit portrait's original proportions, the full absence placard and the deliberate non-result. The microphone implements Matt's approved acknowledgement only; no joke data or placeholder copy is present.
