---
title: A focused input unmounted with the card it sits on can leave the page displaced with no focusout to notice it
date: 2026-09-21
scope: pwa/src/game/menu-knobs.tsx
concepts: [start-card, ios, layout, viewports, shell]
---

`NumberRow`'s seed field is the only typed field in the game, and it lives on
a card that goes away the instant the rider presses on. Taking a focused input
off the page is not the same exit as blurring it: the browser puts the keys
away but can leave the visible window still slid up under where they were, and
because the element is gone no `focusout` fires for anything to react to.

The row therefore blurs its own field in a `useEffect` cleanup when it still
holds focus, which turns the exit into an ordinary blur. Any future typed field
on a card owes the same — it is not the field's own business that is at stake,
it is the whole shell's box.
