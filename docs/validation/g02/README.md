# G-02 camera rail evidence

Captured in real Chromium against integrated G-03 checkpoint `a7f4df0b`, which
contains G-02 `b6fc55fb` and actual exported room/object assets. The later G-02
first-frame measurement correction changes initial native-fragment timing only;
these centered-stop framing screenshots remain representative.

- `all-stops-contact.webp`: all nine stops, 360×800 left and 1280×800 right.
- Individual `360-*.webp` and `1280-*.webp`: original viewport captures.
- `768-resize-waystone.webp` and `1920-resize-waystone.webp`: the same live session
  resized to 768×1024 and 1920×1080, with framing recomputed.
- `geometry.json`: measured card/projection rectangles and native stop counter.
- `idle-trace.json.gz`: Chrome DevTools trace, 5 seconds after native scrolling and
  camera damping settle, categories `devtools.timeline,v8.execute,blink.user_timing`.
  Gunzip and load in Chrome DevTools Performance. Test-only instrumentation counted
  **zero requestAnimationFrame callbacks and zero WebGL draw calls** in that window.

The canvas is pointer-transparent; wheel, touch, keys and scrollbar remain native.
No wheel/key/touch cancellation, scroll spacers, or scroll snapping is installed.
Mobile cards cap their height at 45% of the viewport and scroll their own text
natively when it overflows. At the centered stop, no card covers its exhibit.
