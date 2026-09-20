---
title: three's screen-right is `forward × up`, NOT `up × forward` — the wrong sign mirrors the frame, and a test that borrows the same basis agrees with it
date: 2026-09-20
scope: pwa/src/game/camera-menu.ts, tests/camera_menu_test.ts
concepts: [camera, framing, axes, three, testing]
---

A camera that must put the craft at a chosen point ON SCREEN has to construct
the lens's basis, and the obvious physical derivation gives the wrong one.
Facing north with `y` up your right hand points east, so `right = up ×
forward` looks right — but three's `Matrix4.lookAt` builds `x = up × z` with
`z = −forward`, i.e. **`right = forward × up`**, the opposite sign.
`renderer.ts` already had it right in its roll code; the new module did not.

Nothing throws and nothing looks broken: the pose is self-consistent, the aim
is a sensible direction, and the picture is simply MIRRORED. A rider aimed
into the left band lands in the right one — which, on a card, is the band the
menu is over. So the symptom was "the rider is invisible", and haze, fog,
occlusion and "is the player craft even drawn behind a card" all got chased
first.

**A verification script that reimplements the projection from the same
derivation confirms the bug** — mine did, twice, to four decimal places. What
caught it was reading the live pose and the craft's world position out of the
running page and projecting by hand. `tests/camera_menu_test.ts` now derives
its projection from three's convention explicitly and carries one case that
asserts only the SIGN ("asked left, lands left"), which is the single
assertion a mirrored basis cannot pass.

Cheap instrument worth reaching for first: a temporary
`window.__SH_CAM__ = { mode, eye, aim, fov, craft, aspect }` at the end of
`renderer.ts`'s draw, read with `page.evaluate`. It answered in one run what
screenshots could not answer at all, and it caught a second fault on the way
past — a 0.6 s camera hand-over still flying after 1.4 s of wall clock,
because under swiftshader the app draws a handful of frames a second.
