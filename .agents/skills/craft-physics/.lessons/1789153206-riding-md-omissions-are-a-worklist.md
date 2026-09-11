---
title: `docs/riding.md`'s "What is NOT modelled" list is a live worklist — read it before adding a force, because the force may already be named there
date: 2026-09-11
scope: engine/game/, docs/riding.md
concepts: [docs, forces, modelling]
---

The section reads like a disclaimer and is actually a to-do list somebody
already reasoned about. Adding the intake's ram drag this session, the entry
"**The intake's drag with the throttle shut** — thrust floors at zero; the
hull's own drag stands in" was already sitting there, having named both the
omission and the shortcut (`Math.max(0, …)` in `propulsion.ts`'s `thrust`).

Two consequences. Before adding a force, read that list: it says whether the
gap is known, and often why it was left. After adding one, the list is part of
the change — an entry left standing for a force that now exists is a doc that
actively lies, and nothing tests it. Narrow the entry to what is STILL missing
rather than deleting it outright (the duct's friction and bend losses survived
the ram-drag entry).
