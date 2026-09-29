---
title: A web session has no Blender — the Linux tarball from download.blender.org unpacks into the scratchpad in a minute, `BLENDER=` points the driver at it
date: 2026-09-29
scope: scripts/blender.mjs, scripts/blender/lib.py
concepts: [blender, remote-session, install]
---

`which blender` is empty in a fresh container and `make blender` says so.
`curl -O https://download.blender.org/release/Blender5.2/blender-5.2.2-linux-x64.tar.xz`
(the version `pwa/models/sources.json` names — its `.sha256` sits beside
it), `tar xJf` into the scratchpad, then
`export BLENDER=<scratchpad>/blender-5.2.2-linux-x64/blender` for every
`make blender` / `make models` of the session. Cycles runs on the four
cores: a plant's `--views=row --samples=10` is ten to thirty seconds, a
whole set at game quality (`--views=none`) a second or three a kind, and
`make models` over every set about ten minutes — so start a batch in the
background and wire the game side while it runs.
