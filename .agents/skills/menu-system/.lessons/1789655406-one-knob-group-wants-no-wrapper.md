---
title: A card left with ONE `KnobGroup` must drop the `knob-groups` wrapper — it deals two columns at 48rem and strands the group in half a card
date: 2026-09-17
scope: pwa/src/game/menu-dev.tsx, pwa/src/game/menu-options.tsx, pwa/src/styles.css
concepts: [menus, layout, knobs, developer-menu]
---

`.knob-groups` is a flex column at phone width and a two-column grid from
48rem up (`styles.css`, the `@media (min-width: 48rem)` block). That is the
options card's answer to twenty rows. Take rows OFF a card until one group is
left inside the wrapper and the group sits in the left half of the card while
every full-width press under it — the caption bar, the page rows, RESTORE
DEFAULTS — runs the whole width, which reads as a broken card rather than a
short one.

The fix is to render the `KnobGroup` directly with no `knob-groups` / `knob-col`
wrapper around it; `.menu-card-options` does not constrain a bare group, so it
takes the full width and the card reads as one column. Nothing in the suite
catches this — `menu_system_test.ts` is DOM-free — so it is only visible in
`make screenshots ARGS="--surface <page>"`, which is why that lab is owed
before and after any change that adds or removes a card's rows.
