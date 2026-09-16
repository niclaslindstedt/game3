---
title: Driving a card with playwright, wait on `waitForFunction(() => document.querySelector(...))` and press it with `evaluate` — a Preact card re-rendered every frame never settles, so neither `waitForSelector` nor `.click()` ever returns
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
returns immediately.

**And `.click()` breaks the same way, which this lesson used to deny.**
`getByRole("button", …).click()` and `page.click(sel)` both wait for the
element to be "visible, enabled and stable" before they press, and stable is
exactly what a card re-rendered every frame is not: the log reads `locator
resolved to <button …>`, then `attempting click action`, then a 30 s timeout
on a button that is plainly there and plainly clickable. Press it inside the
page instead — `page.evaluate(() => document.querySelector(sel).click())`, or
a small helper that finds a button by its text and calls `.click()` on the
element. `keyboard.press` genuinely is unaffected: it goes to the page, not to
an element.

Same script, the checks worth making in one pass: the button's right edge
against the head's (a corner is a measurement, not a look), `.nav-cursor`'s
className after one `ArrowDown` (the landing), Escape twice (card → card →
front door), and two `screenshot({ clip })` of the same patch of sea 600 ms
apart to prove the water is still running.
