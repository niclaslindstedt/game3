---
title: An INSTRUMENT — anything whose position is the reading — goes in the bottom-left speed cluster, not in `.hud-top`; and a figure that floats with a moving part has to be given clearance from whatever sits under it
date: 2026-09-13
scope: pwa/src/game/hud.tsx, pwa/src/game/hud-dial.tsx, pwa/src/styles.css
concepts: [layout, placement, portrait, instruments, hud]
---

The placement lesson beside this one sorts a new element by its SUBJECT.
There is a second cut that matters more once the element has a MOVING PART:
a readout is a figure and belongs with the run's other facts in `.hud-top`;
an INSTRUMENT is a thing whose position IS the reading, and it belongs with
the rev bar in `.hud-speed`. The altimeter was first built as a chip under
the wind vane and it was legible and dead — a number that told you nothing
about how the sea was working until you had read two of them in a row. As a
vertical tape on top of the speed cluster it says the same thing at a
glance, and it costs `.hud-top` nothing: that column was already five deep
(clock, gates, vane, sun, score) and the bottom-left corner is the only edge
of this screen with VERTICAL room, which is the one thing a tape needs.

`hud-dial.tsx` is the file for it — the component is handed a share and
paints it, reading nothing of the game — and the scale that turns metres
into that share lives in `snapshot.ts` beside `airGrow`, which is the same
split the air clock already uses.

The trap in a floating figure: it is centred on the marker, so half its
height hangs below the track when the marker is at the foot. A caption
sitting under the tape at a normal gap is then straddled by the number at
exactly the moment the readout matters — deep in an ocean trough. Give the
column enough gap for half a line of the figure, and shoot `SCENE=ocean`
(which stands the craft in a trough) rather than `cruise` to see it.
