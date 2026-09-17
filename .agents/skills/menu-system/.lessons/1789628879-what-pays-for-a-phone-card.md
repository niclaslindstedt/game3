---
title: On a phone, a settings card's height is spent on GROUP HEADINGS and on the length of one string, not on the rows — and the two-column rule's `align-items` follows a `display` override into a flex column
date: 2026-09-17
scope: pwa/src/styles.css, pwa/src/game/menu-options.tsx, pwa/src/game/menu-knobs.tsx
concepts: [options, pause, layout, viewports, glyphs]
---

Measuring OPTIONS at 390x844 before and after a regroup: the five headings
cost more than the eleven rows under them did to add. A phone stacks every
group in one column, so a heading is height the rows never get — and growing
`.knob-group-title` from 0.62rem of text to 0.68rem beside a 1.5em glyph paid
about 8 px five times over, on a card with 44 px of slack. The fix is a phone
override on the heading alone (0.6rem, a 1.45em mark, tighter padding); the
MARK is the last thing to give, because it is what the group is found by, and
`make glyphs`'s small tile is the size to hold it at.

The other surprise is that ONE STRING IS A ROW OF HEIGHT. `.knob-caption`'s
fallback wraps at about 45 characters on a phone, so rewriting a 62-character
line as a 116-character one silently added a third line to every settings
card. Keep a caption fallback under ~90 characters and check the wrap in the
phone shot.

Where the pixels came back from, in the order worth trying: the caption's
wording, then the CARD's own top/bottom padding (chrome, and the side gutters
keep theirs), then the group and column gaps. The `.knob` row's `min-height`
is the last resort — the arrows in it are the thumb targets.

And a cascade trap that reads as a layout bug: `@media (min-width: 48rem)`
sets `.knob-groups` to a two-column grid WITH `align-items: start`. An
override that changes only `display` to `flex; flex-direction: column`
inherits that word, where it now means "do not stretch ACROSS" — every group
shrink-wraps to its own longest label and the panel's rows stand at three
different widths. Restate `align-items: stretch` whenever you change a rule's
`display` out from under a media query.
