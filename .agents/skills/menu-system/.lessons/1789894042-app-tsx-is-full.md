---
title: `App.tsx` sits two lines under the §20.5 cap — a new concern there needs its own module, and the cap is the design review
date: 2026-09-20
scope: pwa/src/App.tsx, pwa/src/game/live-camera.ts
concepts: [file-size, app, effects, refactor, menu]
---

`App.tsx` was 998 lines of a 1000-line cap before this session and 1067 after
two `useEffect`s were added to it. There is no comment budget to trim your way
out of that: the arithmetic says a new concern in this file may be about two
lines long.

That is the cap doing its job rather than getting in the way. The two effects
were "which camera does the surface that is up get" and "where is the card it
is composed around standing" — one subject, and one that INTERACTS with an
effect already thirty lines away (the stored CAMERA row, which has to keep
winning while it is being moved). Pulled into `live-camera.ts` as a custom
hook plus a DOM seam, the pair are stated side by side with the reasoning that
connects them, the pure arithmetic (`cardBox`) became something the root suite
reads, and `App.tsx` came back to 999.

The pattern is the one `run-surfaces.ts`, `run-actions.ts`, `run-settle.ts`
and `app-load.ts` already are: a factory or a hook over `App.tsx`'s own
closures. Custom hooks are allowed here — `useSeedPreview` and `usePwaUpdate`
are the precedent — so reach for one rather than for an `allow-large-file`
marker. Check `wc -l pwa/src/App.tsx` BEFORE adding to it; the file-size suite
is the last thing that runs and the most annoying to discover at the gate.
