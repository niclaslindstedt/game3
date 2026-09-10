---
title: Read `make profile`'s tris column against a Node count of what the level plants — an InstancedMesh with `frustumCulled = false` submits the whole coast every frame
date: 2026-09-10
scope: pwa/src/game/flora.ts, scripts/profile-render.mjs
concepts: [profile, flora, instancing, frustum, triangles, performance]
---

A frame of the cruise scene metered 1.6 million triangles at 1280×720, and
the water is ten thousand of them. The rest was the shore's cover: one
`InstancedMesh` a species spanning the whole coast, with `frustumCulled`
off because "one mesh has no box worth testing" — so every plant on two
kilometres of shore was submitted whatever the lens looked at. Count it
before reading a scene: a scratch script through `aliasEngine` that runs
`planFlora` and `buildFlora` and multiplies instances by triangles per
geometry says in a second where the tris column comes from. And read the
DRAWS column with it: a mesh a species per square of shore culled the
triangles and cost 460 draw calls, which is the same bill moved to the
JavaScript that submits them — `flora.ts` lays the tiles inside ONE
instance buffer a species and copies the visible ones to its front, so it
is thirteen draws and a dozen tiles' triangles.

Two more things the lab cannot tell you. Its `cpu ms` and `fps` columns are
the software rasterizer's, so a CPU saving is measured by benching the
module in Node — `createWaterMesh(...).update` with and without a
`THREE.Frustum` from a real `createCameraRig` pose gave 54–67 % at a chase
camera, a number the page's `frameMs` never would. And a renderer change
is proved invisible by a PIXEL DIFF, not by looking: two screenshot runs of
the same build differ by under a hundred pixels (the rain streaks are the
one noise source), so a base-vs-after diff image with the changed pixels
painted magenta shows exactly what moved — which is how the "cull the cover
past the fog" idea was caught drawing the far tree line out of the sky.
