---
title: The pause card is the one surface that freezes, and every rule around it falls out of Escape being taken TWICE on the way through
date: 2026-09-10
scope: pwa/src/game/menu-pause.tsx, pwa/src/game/shell.ts, pwa/src/App.tsx, pwa/src/game/input.ts
concepts: [pause, shell, surfaces, escape, menu-nav, freeze]
---

Adding a card that stands over the PLAYER's run rather than the bot's turned
out to need almost no new machinery, because three things were already there.

**The freeze is a shell predicate, not a flag.** `simulates(shell)` is false for
`pause` and true for everything else; the frame loop stops asking the clock for
steps and renders with dt 0. Nothing is torn down and nothing is saved — the
state simply is not stepped. RESUME is a shell change back and it lands on the
frame it left, because `last` moved with every frame and `clock.frame` was never
called, so there is no accumulated debt to pay down. Measured: a 0.4 s hold and
a 3 s hold both cost the run the same +0.30 s, which is the playwright round
trip out of the card and not the hold.

**ESCAPE ALREADY TOGGLES, with no toggle written anywhere.** `onMenuKey` sits on
`window` in the CAPTURE phase, fires whenever `nav.active()` and the shell is
not `run`, presses the surface's `[data-nav-back]`, and `stopPropagation`s — so
the input manager (a bubble listener) never sees Escape while a card is up. Put
`data-nav-back` on RESUME and the second press resumes; put the options page
under the card and the same press goes back to the card instead of to the water.
The action the manager raises therefore only ever means "open", never "close".

**`data-nav-focus` on RESUME is not optional.** `landing()` prefers the marked
control, then the way ON, and otherwise the first row that is NOT the way back —
so without the mark a controller's cursor skips RESUME and starts on the row
that ends the run.

Two smaller things this cost:

- The card wears `.menu` / `.menu-card`, which is what makes `menu-nav.ts` walk
  it for free (`.menu-card` is already a ROOT) and what makes reusing
  `OptionsPage` under it look like one card rather than two. Only the head's
  back LABEL differs, so that became an optional prop rather than a second page.
- A `.menu-item-*` modifier written EARLIER in the stylesheet than `.menu-item`
  loses the cascade at equal specificity and silently does nothing. The row
  looked identical to the two above it until it was moved below the base rule.

The pause card also makes an old rule bite harder: it opens OPTIONS over a
FROZEN run, so every row there has to apply to the frame being looked at.
`settings.ride.camera` had been "the camera a run OPENS on" and became a dead
row exactly where it is most obviously being asked, until an effect pushed it to
`renderer.camera.setMode` on change. The C key writes no setting, so the two
never argue.
