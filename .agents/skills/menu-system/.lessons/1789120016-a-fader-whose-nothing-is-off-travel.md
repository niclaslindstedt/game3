---
title: A FadeRow whose "nothing" sits OFF the travel puts a real setting out of the slider's reach — and every screenshot of it looks right
date: 2026-09-11
scope: pwa/src/game/menu-knobs.tsx, pwa/src/game/menu-options.tsx
concepts: [options, settings, pause, screenshots]
---

`FadeRow`'s `autoLabel`/null pair exists for an answer that is genuinely NOT a
point on the travel — the developer page's WIND and SEA deferring to the shore.
SOUND borrowed it for OFF, with `min={SFX_STEP}`, and the readout carrying the
mute as a press. The result: the thumb dragged to the far left stopped at 5%,
audible, and the only way to silence was a word beside the track that does not
look like a button. The row's own hint already claimed "OFF at the bottom of
the travel" — the prose was right and the travel was wrong.

**The test is whether the bottom stop IS an answer.** Silence is a level a
rider chooses, so it belongs on the travel (`min={0}`, and the reading says OFF
at zero — the sibling repo's `levelLabel`). "Whatever the shore was generated
with" is not a level, so it stays off the travel and keeps the press. A row
that takes no `autoLabel` gets a plain `<span>` readout: a button sitting
against the end of the track is a press a thumb aiming for the top of the
travel lands on by accident.

**No picture catches this.** `--surface options` photographs the fader at 80%
and it is pixel-identical whether the bottom stop is 0 or 0.05 — the diff is
one prop. It only shows up by DRIVING the built page: press the far left of
`.knob-range` and read `inputValue()` and `.knob-read`'s text back. Worth
scripting the whole travel (far left, drag past the left end, four left-arrow
presses, far right, then the readout) in one playwright pass — the arrows and
the track clamp separately, and the readout is the one that used to mute.

`playwright-core` is not a dependency here: `npm install --no-save
playwright-core@1`, and a probe under the scratchpad must import it by
absolute path or Node will not resolve it.
