# A-02 sound verification

One-worker isolated run: **11 passed, 14 expected skips, no failures or flakes**.
Chromium, WebKit, mobile Chromium and reduced-motion projects verify deferred
network loading, real trusted first activation, saved-On silence before input,
rapid setting changes, one-context reuse, Off silence and hidden-tab suspension.
No-JavaScript leaves sound disabled. Two CPU tests verify side-effect-free import
and the 4KB budget; transpiled unminified synthesis is **2,507 bytes gzip**.

A real `AnalyserNode` connected to the final output measured **0.19297 peak,
-14.29dBFS** during rapid mixed exhibit touches. The final sample clamp is ±0.45
(-6.94dBFS), after the compressor. Its output connects once to the destination.
No audio files are fetched or sampled.

The saved-On regression dispatches a synthetic touch before any trusted input.
Only trusted input actually captured by the gesture bridge can unlock the first
context; a browser/automation activation flag alone is insufficient. The next
real click starts the audio without an autoplay error. Context creation/resume
precedes the dynamic import so the browser gesture is preserved.
