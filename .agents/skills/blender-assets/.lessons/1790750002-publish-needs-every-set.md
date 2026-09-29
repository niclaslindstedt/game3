---
title: `make models` publishes nothing until every kind of every set in MODEL_SETS is built — a new set added to the table fails the whole publish until its kinds exist
date: 2026-09-29
scope: scripts/models.mjs, pwa/models-plugin.ts
concepts: [publish, sets, stamps]
---

`scripts/models.mjs` reads `MODEL_SETS` and refuses to copy anything if a
single kind's glTF is missing from `previews/blender/` — so adding a row to
the table while its builder is still being written makes the next
`make models` exit with the whole list of `not made` files, after Blender
has spent ten minutes remaking the crafts. Build the new set's kinds first
(`make blender KIND=<kind> ID=all ARGS="--quality=game --views=none"`),
or publish one set at a time (`node scripts/models.mjs --set=<key>`): a
set not published keeps its stamp, so the rest stay fresh.
