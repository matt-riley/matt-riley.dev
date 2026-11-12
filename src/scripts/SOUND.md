# Opt-in sound

`sound-gate.ts` is the small eager bridge. It creates/resumes one AudioContext
synchronously in a trusted gesture, then dynamically imports `sound.ts`. This
preserves browser activation across the asynchronous code fetch; context resume
belongs in the gesture ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/resume),
[Chrome autoplay policy](https://developer.chrome.com/blog/autoplay/#web_audio)).
No context or synthesis import occurs merely because On was saved. That preference
remains visible, with an accessible description explaining the pending first touch.
A failed activation returns the controls to Off without an unhandled rejection.

The lazy module synthesizes every voice. There are no audio-file requests. A
master gain and compressor feed a final sample clamp at ±0.45 (-6.94dBFS).
Rate limits use the audio clock: 25ms globally, plus individual voice limits.
After-hours room tone fades in over two seconds; Day has none. Cat Off stops an
existing purr. Hidden pages and Sound Off immediately mute, stop active sources,
and suspend the context. Page exit disposes the graph; a cached-page return can
reuse the same context.

## Sequencer integration

`requestSound()` resolves to the current `SoundEngine`, or undefined if sound
is Off, the page is hidden, or the first activation still needs a user gesture.
A Play consent control can set Sound On and call it in the same trusted event.
The engine exposes `context` for scheduling and `input` for a drum bus. Connect
the bus to `input`, never directly to the destination: this retains global mute
and the final limiter. `output` permits read-only analyser connections in tests.

`createSoundEngine(context, enabled)` is a pure factory suitable for an explicit
OfflineAudioContext test. Importing the module allocates no context or nodes.
`mountSound(context)` adds the normal DOM-owned touch, setting and terminal-key
listeners; its returned cleanup releases listeners and all audio nodes.
