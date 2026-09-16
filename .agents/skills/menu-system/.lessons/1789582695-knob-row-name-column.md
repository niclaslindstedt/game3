---
title: A knob row's NAME column is the width of WEATHER — a longer label truncates to an ellipsis, and the fader's READING has the same ceiling
date: 2026-09-16
scope: pwa/src/game/menu-knobs.tsx, pwa/src/game/menu-start.tsx, pwa/src/game/strings.ts, pwa/src/styles.css
concepts: [knobs, options, start-card, layout, viewports, strings]
---

Two hard widths in the one silhouette, and neither of them errors — both just
quietly cut text, which is exactly the class of regression the card budgets
lesson warns about.

**The label.** `WEATHER` (7 characters) is the budget. A new row called
`WIND FROM` came back as `WIND FRO…` on the desktop shot and `WIND FR…` on the
phone, on the very first `--surface start` capture. Renaming it `QUARTER` fixed
it with no CSS, and the shorter word was the better word anyway — reach for the
one-word name before you reach for the stylesheet.

**The reading.** `.knob-fade` is `width: clamp(8.5rem, 30vw, 11rem)` holding the
range AND the reading, and `.knob-word` is `white-space: nowrap` — so a long
`read()` does not wrap, it squeezes the fader to a stub. `+135° QUARTERING OUT`
would have left about 20 px of travel. The reading stayed `+135°` and the WORD
for what that means went into the row's HINT, which the caption bar at the foot
of the card renders full-width over two lines. A hint may be COMPUTED from the
row's current value (`hint={STRINGS.freeQuarterHint(value, dealt)}`), which is
what makes that trade work: the caption then names where the row stands right
now, and can carry the figure the shore was dealt as well.

The general shape: on any new row, budget seven characters for the name and
about six for the reading, and put everything else in the caption.
