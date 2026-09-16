---
title: A head button's word is four or five letters — CONTINUE landed across the title on a phone — and a card that loses a column loses its width with it
date: 2026-09-16
scope: pwa/src/game/menu-campaign.tsx, pwa/src/game/menu-start.tsx, pwa/src/styles.css
concepts: [layout, viewports, head, start-card, campaign, screenshots]
---

Two things the campaign card taught about the shared chrome:

- THE HEAD'S WAY ON IS A CORNER, and a corner holds about five letters at
  the phone's head size. CONTINUE overlapped the title at 390 px; RIDE
  did not, and it says the same thing since the ringed box is what it
  takes. `--surface campaign` at the phone viewport is the check, and it
  is the one check `--surface` can make of a card whose interesting
  states (a box cleared, a shore won) are a run away.
- WHEN A CARD LOSES A COLUMN IT KEEPS ITS WIDTH unless told otherwise.
  The start card is 46 rem wide for its two columns; with the day's rows
  now the free ride's alone, a race's card had a chart on the left and
  an empty right half. A modifier class (`menu-card-start-shore`) that
  puts the width back to the one-column card's and the grid back to one
  column is the whole fix — and the caption under it had to change too,
  because the marked-dot sentence was explaining marks the card no longer
  carries.
