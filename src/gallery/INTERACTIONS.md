# DOM-first exhibit adapters

The DOM owns settings and every interaction's result. Picking an object calls its
real HTML control; only the resulting `mr:touch` event drives 3D movement. The
canvas stays pointer-transparent. Document pointer listeners ignore the placard,
text, links and controls, and vertical panning remains native.

`ExhibitRegistry` mounts the nine object files on their named room anchors. It
also exposes the room's entrance rope. Records contain the original section,
model root, authored base position, glazed materials and named `touch_*` parts.
The floor fragments have no touch parts and deliberately do not pick or hop.
Models load nearest-stop-first through the session's asset store. The store owns
GPU resources; the registry removes its roots and releases part tweens on cleanup.

The tiny `exhibit-state.ts` boundary is safe to import eagerly. It imports types
only. `onExhibitsReady` mounts once per complete registry and runs each returned
cleanup on View changes/context loss. Asynchronous mounts are allowed; a cleanup
that arrives after disposal runs immediately. Check `registry.disposed` after
any awaited import before adding listeners or starting motion.

Keep animation imports inside a lazy visual module. DOM-only feature logic can
run independently in catalogue view. A feature's visual adapter can use:

- `registry.records.get(id)` to find its root and `parts` map.
- `registry.setControl(id, "touch_part", realHTMLElement)` to map a particular
  picked part to a DOM control (for example a real flagz setting button).
- `registry.setTouchHandler(id, handler)` to replace the default small hop once
  that exhibit has its own behaviour. The handler receives the DOM event.
- `animatePart(part, fraction, options)` to tween a bound part along its authored
  axis/range. Ranges can be reversed or centred: drum-pad fraction **0** is down
  and **1** is neutral; a microphone with symmetric limits rests at **0.5**.
  Bases are captured once, so repeating an animation never accumulates drift.

`mr:touch` always includes `detail.exhibit`. A control inside a `data-model`
group can additionally identify `detail.model`; `data-part` identifies a part.
All `button[data-touch]` controls and native `details[data-reveal]` disclosures
are supported, including keyboard activation. A `data-touch-message` on a control
can override its section's announcement.

When every model is mounted, `html[data-exhibits="ready"]` describes that view
state. It is removed on session cleanup. The one-time touch hint uses only
`sessionStorage`; no visitor state leaves the browser.
