// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A BUTTON THAT MEANS SOMETHING ELSE WHEN IT IS HELD DOWN — the main menu's
// START row, which starts a run on a press and lets the developer menu out
// on a seven-second hold (`DEV_HOLD_MS` in settings.ts).
//
// IT FIRES SILENTLY, ON PURPOSE. The tile does not fill and does not change
// its word while it is held: the developer menu is meant to be found by
// somebody who knows where to press, and a row that advertises itself to
// everybody who rests a thumb on START is not hidden. The DEVELOPER chip
// appearing is the whole of what the player is told.
//
// What is left is one rule, and it is about honesty rather than about timing:
//
//   A COMPLETED HOLD IS NOT ALSO A PRESS. The pointer that unlocks the
//   developer menu lifts off a button whose ordinary job is to start a run,
//   and starting one on the way out would throw away the thing the player
//   just spent seven seconds asking for.
//
// THAT RULE IS WHY `armed` OUTLIVES THE RELEASE, and it is the whole
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
// DOM-free, so the root suite reads the whole state machine without a browser
// (`tests/menu_system_test.ts`); the component next door owns the pointer
// events and the one timer that asks whether the hold has run its length.

/** A hold in progress, or the absence of one. */
export type HoldState = {
  /** When the finger went down, on the caller's clock (ms). Null when
   * nothing is being held. */
  from: number | null;
  /** True once the hold has run its length and fired, and still true across
   * the release, until `takePress` spends it on the one click that release
   * produces — see the header's rule. */
  armed: boolean;
};

export const NO_HOLD: HoldState = { from: null, armed: false };

/** The hold one moment on, given the clock. Returns the same object when
 * nothing has changed, so a caller that asks early — a timer fired a
 * millisecond short, a clock the browser throttled — can tell 'not yet' from
 * 'fired' by identity and re-render nothing. */
export function tickHold(hold: HoldState, now: number, lengthMs: number): HoldState {
  if (hold.from === null || hold.armed) return hold;
  if (now - hold.from < lengthMs) return hold;
  return { from: hold.from, armed: true };
}

/**
 * Letting go — the finger lifted, or dragged off the row.
 *
 * The clock stops, and `armed` SURVIVES: the click this release is about to
 * produce is the one it has to swallow. See the header.
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
