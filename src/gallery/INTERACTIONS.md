# DOM-first exhibit adapters

The DOM owns settings and every interaction's result. Picking an object calls its
real HTML control; only the resulting `mr:touch` event drives 3D movement. The
canvas stays pointer-transparent. Document pointer listeners ignore the placard,
text, links and controls, and vertical panning remains native.

`ExhibitRegistry` mounts the nine object files on their named room anchors. It
also exposes the room's entrance rope. Records contain the original section,
model root, authored base position, glazed materials and named `touch_*` parts.
The floor fragments have no animated touch parts; their bounds still map to the
Human Error control until its exhibit adapter supplies a specific behaviour.
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
- `registry.setDraggable(id, false)` to keep an intentionally static exhibit
  from rotating. Its returned cleanup restores the previous setting.
- `registry.setPickBounds(id, resolver)` to include room-owned geometry in an
  exhibit's bounds without reparenting it, such as the empty Absent plinth.
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

## Low-quality model lifetime

Model-specific adapters use `registry.onRecord(record => cleanup | undefined)`.
It mounts immediately for existing records and again when a model is reloaded.
The returned cleanup runs before unloading that record and at session disposal;
unsubscribing also releases every record binding owned by that subscription.
Keep room-owned geometry, DOM handlers, and camera resolvers session-owned.
Look up current records rather than retaining old model roots in DOM callbacks.

On Low, `registry.setWindow(stop, 3)` removes more distant model records and
releases their AssetStore geometry/material/texture ownership. Moving back into
range reloads the GLB and remounts its record adapters. The room and its rope are
never unloaded; their stable anchors preserve placement.

Auxiliary models use `registerExhibit(id, stop, index, root, owned = false)`,
returning `{record, dispose}`. A cat can set `record.draggable = false` and
`record.pickPriority = 100`, then update its `stop`/`index` as it relocates.
`setControl(id, "", button)` connects its default hit to the same DOM control;
`setTouchHandler` continues to handle its documented touch event. Disposing the
registration removes record bindings; an unowned root remains its caller's job.
