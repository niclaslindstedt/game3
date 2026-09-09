// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A BUTTON THAT MEANS SOMETHING ELSE WHEN IT IS HELD DOWN — the main menu's
// START row, which starts a run on a press and lets the developer menu out
// on a seven-second hold (`DEV_HOLD_MS` in settings.ts).
//
// The whole thing is a fraction and two rules, and both rules are about
// honesty rather than about timing:
//
//   IT SAYS SO WHILE IT IS HAPPENING. A hold that fired silently would be a
//   button that sometimes does something else, which is a bug as far as
//   anybody holding it is concerned. So the fraction is drawn — the row
//   fills as the hold runs — and a finger that is a second from unlocking
//   something can see that it is.
//
//   A COMPLETED HOLD IS NOT ALSO A PRESS. The pointer that unlocks the
//   developer menu lifts off a button whose ordinary job is to start a run,
//   and starting one on the way out would throw away the thing the player
//   just spent seven seconds asking for.
//
// THAT SECOND RULE IS WHY `armed` OUTLIVES THE RELEASE, and it is the whole
// subtlety here. A lifted finger is three events — `pointerup`, then a
// `click` — and it is the CLICK that would start the run, so a hold cleared
// on the release has already stopped suppressing anything by the time the
// press it exists to suppress arrives. So the release keeps `armed` and
// `takePress` spends it: exactly one press is swallowed, and the one after
// that is ordinary again.
//
// A release is therefore a state of its own — `from` empty, `armed` still
// set — and that is a shape a caller has to be able to recognise, because
// the click it is waiting for MAY NEVER COME. A browser only raises `click`
// where the press and the release landed on the same element, and the
// release that arms this hold is the one release certain to change the card
// under the finger. `menu-main.tsx` carries the clock that spends a hold
// nothing ever came for, and the reasoning for it.
//
// DOM-free, so the root suite reads the ramp without a browser
// (`tests/menu_hold_test.ts`); the component next door owns the pointer
// events and the frame that redraws the fill.

/** A hold in progress, or the absence of one. */
export type HoldState = {
  /** When the finger went down, on the caller's clock (ms). Null when
   * nothing is being held. */
  from: number | null;
  /** True once the hold has run its length and fired, and still true across
   * the release, until `takePress` spends it on the one click that release
   * produces — see the header's second rule. */
  armed: boolean;
};

export const NO_HOLD: HoldState = { from: null, armed: false };

/** How far through the hold is, 0–1. Zero when nothing is held, which is
 * also what the row draws when a finger has only just landed — so a press
 * never flashes a sliver of fill on its way past. */
export function holdProgress(hold: HoldState, now: number, lengthMs: number): number {
  if (hold.from === null) return 0;
  if (hold.armed) return 1;
  const at = (now - hold.from) / lengthMs;
  return at < 0 ? 0 : at > 1 ? 1 : at;
}

/** The hold one moment on, given the clock. Returns the same object when
 * nothing changed, so a component can bail out of a re-render on the frames
 * where the fraction has not moved enough to matter. */
export function tickHold(hold: HoldState, now: number, lengthMs: number): HoldState {
  if (hold.from === null || hold.armed) return hold;
  if (now - hold.from < lengthMs) return hold;
  return { from: hold.from, armed: true };
}

/**
 * Letting go — the finger lifted, or dragged off the row.
 *
 * The fraction stops, and `armed` SURVIVES: the click this release is about
 * to produce is the one it has to swallow. See the header.
 */
export function releaseHold(hold: HoldState): HoldState {
  return hold.armed ? { from: null, armed: true } : NO_HOLD;
}

/**
 * What the click means, and the hold once it has been read: an ordinary
 * press, unless a completed hold is standing there to be spent on it.
 *
 * Spending it HERE is what stops the row from being a button that unlocked
 * something once and then never started a run again.
 */
export function takePress(hold: HoldState): { press: boolean; hold: HoldState } {
  return { press: !hold.armed, hold: NO_HOLD };
}
