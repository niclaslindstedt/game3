---
title: Driving a card with playwright, wait on `waitForFunction(() => document.querySelector(...))`, never `waitForSelector` — a Preact card re-rendered every frame never settles
date: 2026-09-10
scope: pwa/src/game
concepts: [screenshots, surfaces, menu-nav]
---

The skill's "drive the real flow before calling a change done" step hits this
on the first surface change. `page.waitForSelector(".menu-card-craft")` times
out on a card that is plainly up, and the failure log says so in as many
words: `locator resolved to visible <div class="menu-card menu-card-craft">`,
then a timeout. Playwright's visibility check wants the node to hold still,
and these cards are re-rendered on every frame of the sea behind them, so the
handle it resolved is stale before the check finishes.

`await page.waitForFunction(() => document.querySelector(".menu-card-craft")
!== null)` asks the only question that matters — is the surface up — and
returns immediately. Clicks and `keyboard.press` are unaffected; it is the
wait that breaks.

Same script, the checks worth making in one pass: the button's right edge
against the head's (a corner is a measurement, not a look), `.nav-cursor`'s
className after one `ArrowDown` (the landing), Escape twice (card → card →
front door), and two `screenshot({ clip })` of the same patch of sea 600 ms
apart to prove the water is still running.
