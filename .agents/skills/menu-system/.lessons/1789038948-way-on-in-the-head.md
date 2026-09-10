---
title: A card's way ON belongs in its HEAD unless the press needs the thing above it — a full-width row at the foot is the height that scrolls the card on a phone
date: 2026-09-10
scope: pwa/src/game/menu.tsx, pwa/src/game/menu-start.tsx, pwa/src/styles.css
concepts: [start-card, layout, viewports, menu-nav, screenshots]
---

`MenuHead` takes an optional `action` and renders it in a third `auto` column,
so back-on-the-left / on-to-the-right is one shape every page can wear; a head
with no action collapses the column and looks exactly as it did.

WHY IT IS WORTH MOVING. The start card's `CHOOSE YOUR CRAFT` was a
`.menu-item` at the foot — a front-door ROW, the card's whole measure. That is
~60 CSS px of height on desktop and ~100 on a phone, spent under the one
SQUARE element on the card. `.menu-card` scrolls rather than clips, so the
press the card exists for was the part hanging off the bottom. In the head it
costs nothing: measured 625 → 555 (1280×720) and 660 → 595 of 844 (390×844),
`scrollHeight - clientHeight` now 0.

WHAT THE MOVE NEEDS. `.menu-item` is written for a full-width row, so the head
copy gives back `width` and most of its padding and keeps only the colour and
the weight (`.menu-head-go`, written AFTER `.menu-item` — the cascade trap).
Pin it `align-self: start`: the head's own rule is that the way out stands
level with the TITLE, and `center` drifts the button down by however many
lines the subtitle wraps to (it wraps to two at 390 px once the button takes
its width). Keep `data-nav-next` **and** `data-nav-focus` on it — `landing()`
prefers the marked control, and a way on in the head is no longer the first
non-back item in the DOM.

The word shrinks with the button: a head corner is not a banner, so `NEXT`,
and the card it opens says what it is (`CRAFT`).
