# A-03 drum machine

The museum's four-row, sixteen-step machine works with the DOM alone. Its small
bootstrap owns keyboard focus, pressed state, selected row and URL fragments.
The audio/transport chunk waits until Human Error is near and Sound is On or
Play is requested. Play with Sound Off asks inline; it never silently opts in.
Shared fragments decode and open the exhibit without starting playback.

All voices are synthesized. Kick uses a 120→45Hz sine drop; snare combines noise
and a 180Hz body. Closed hats choke open hats. A mild saturation stage and 9kHz
low-pass feed the A-02 input, retaining global mute and its final limiter.

A 25ms wake fills a 150ms lookahead queue. Oscillator/buffer starts use exact
AudioContext deadlines, following [the Web Audio lookahead scheduling model](https://web.dev/articles/audio-scheduling).
Late deadlines are skipped, rather than replayed as a backlog. Stop, Sound Off,
hidden state and travelling more than one stop away cancel future voices.

## Verified checks

- Focused browser matrix: 16 passed, 19 expected skips. Keyboard programming,
  exact fresh-browser URL restore without autoplay, lazy import/inline consent,
  and Off/hidden/distance stop pass in Chromium, WebKit and mobile.
- The real 30-second oscillator test passes the <2ms interval-error bound and
  verifies uninterrupted step order. Its raw audio-clock log is attached by the
  test as `audio-clock-30s.json` in the CI Playwright audio-clock report. The
  timing case runs separately with one worker so unrelated shader compilation
  cannot distort the measurement; the ordinary browser matrix remains parallel.
- Four CPU checks pass: strict 15-character sharing codec, thirty seconds of
  simulated wake jitter, late-wake recovery, and real Three.js pad objects.
  Pad checks verify row mapping, 3mm bounded dip/exact return, 44px target binding,
  independent material clones and full cleanup on record unload. The regression
  applies the shared Day/After-hours/Day glaze-lighting mutation and verifies
  selected/playhead colour and intensity are restored; unload removes the
  settings subscription. Pad clones retain their glaze names for calibration
  and declare `userData.touchEmissionOwned=true`; generic boot and A-01 glow
  lighting must skip that ownership flag, including per-frame updates. This check first failed with black emission, then
  passed after the adapter reasserted its owned colour on Lights updates.
- Native offline hat-choke/limiter tests and open-panel axe checks run in CI.

Patterns “Head nod”, “Late bus” and “Sunday” are original patterns for this site.
The versioned 11-byte fragment contains only tempo, swing and four 16-bit rows;
no pattern data is sent to a service. There are no samples or audio downloads.
