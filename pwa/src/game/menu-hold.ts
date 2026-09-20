// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A PICTURE THAT MEANS SOMETHING ELSE WHEN IT IS HELD DOWN — the craft
// card's turntable, the hull turning on its own little sea, which lets the
// developer menu out on a seven-second hold (`DEV_HOLD_MS` in settings.ts).
//
// IT IS HELD ON THE PICTURE AND NOT ON A BUTTON, and that is the whole shape
// of this module. The stage the hull turns on is the one large thing on any
// card that a press does nothing to — the arrows either side of it change
// the craft, RIDE below it goes — so a finger resting there for seven
// seconds is asking for one thing and one thing only. Nothing has to be
// swallowed on the way out: the hold cannot also be a press, because there
// was no press to be.
//
// THE HOLD ITSELF IS SILENT, ON PURPOSE. Nothing fills, no word changes, and
// the stage looks exactly as it did — a door meant to stay hidden cannot
// advertise itself to everybody who rests a thumb on the craft they are
// about to take out. What the player gets is the moment it LANDS, and that
// is the flourish below.
//
// THE FLOURISH IS THE WHOLE RECEIPT. The hull is already turning, slowly, so
// the one thing the card can say without drawing anything new is to turn it
// DIFFERENTLY for a moment: the stand takes the craft round twice, fast,
// on a raised cosine — quick, quicker, slowing, slower, and back into its
// own steady spin exactly as it left it. A hump rather than a swing, so the
// hull never runs backwards (which reads as a stuck animation rather than as
// an answer), and zero at both ends, so nothing snaps into it or out of it.
// It is unmistakable and it is over in under three seconds, which is what a
// receipt has to be: the DEVELOPER chip waiting on the front door is the
// lasting half.
//
// DOM-free, so the root suite reads the whole state machine and the whole
// flourish without a browser (`tests/menu_system_test.ts`); `craft-picker.tsx`
// owns the pointer events and the timer that asks whether the hold has run
// its length, and `craft-turntable.ts` turns the hull by it.

/** A hold in progress, or the absence of one. */
export type HoldState = {
  /** When the finger went down, on the caller's clock (ms). Null when
   * nothing is being held. */
  from: number | null;
  /** True once the hold has run its length and let the menu out. It stops
   * the clock being asked a second time; the finger is usually still down
   * when it is set. */
  fired: boolean;
};

export const NO_HOLD: HoldState = { from: null, fired: false };

/** The hold one moment on, given the clock. Returns the same object when
 * nothing has changed, so a caller that asks early — a timer fired a
 * millisecond short, a clock the browser throttled — can tell 'not yet' from
 * 'fired' by identity and re-render nothing. */
export function tickHold(hold: HoldState, now: number, lengthMs: number): HoldState {
  if (hold.from === null || hold.fired) return hold;
  if (now - hold.from < lengthMs) return hold;
  return { from: hold.from, fired: true };
}

/**
 * How long to wait before asking {@link tickHold} again, in ms, given where
 * the clock stands now. Zero once the hold is due.
 *
 * THE CALLER LOOPS ON THIS RATHER THAN SETTING ONE TIMEOUT AND TRUSTING IT,
 * and that is the one thing about the timing that is not obvious. A timer is
 * set against one clock and `tickHold` reads another, and a browser is free
 * to deliver a timeout a fraction early or to have coarsened its clock under
 * it — so a wake that finds the hold a millisecond short is an ordinary
 * event, not an impossible one. Asking again for what is left is the whole
 * answer; simply returning leaves nothing scheduled and nothing to schedule
 * it, which is a finger held all afternoon and a hold that never fires.
 *
 * It cannot spin: a wake `tickHold` refuses is by definition one where time
 * is still owed, so what comes back is at least a millisecond.
 */
export function holdWait(hold: HoldState, now: number, lengthMs: number): number {
  if (hold.from === null || hold.fired) return 0;
  const left = lengthMs - (now - hold.from);
  return left <= 0 ? 0 : Math.max(1, left);
}

/** How long the flourish runs, in seconds. Long enough to read as a
 * deliberate figure and short enough that the card is back to being a
 * turntable before anybody wonders whether it has broken. */
export const FLOURISH_SECONDS = 2.6;

/** How many extra revolutions the flourish sweeps in that time — on top of
 * whatever the steady spin was going to do. Two: one alone reads as the
 * stand having hurried, and the second is what makes it a figure. */
export const FLOURISH_TURNS = 2;

/**
 * The EXTRA angular rate the flourish is turning the hull at, in rad/s,
 * `at` seconds into it — added to the stand's own steady spin rather than
 * replacing it.
 *
 * A raised cosine over the whole length, scaled so the area under it is
 * exactly {@link FLOURISH_TURNS} turns. Zero at both ends and never
 * negative: the hull eases out of its steady spin, whips round twice, and
 * eases back into it, and at no point does it stop or reverse.
 */
export function flourishRate(at: number): number {
  if (at <= 0 || at >= FLOURISH_SECONDS) return 0;
  // The MEAN rate a raised cosine has to hold to sweep that many turns; the
  // curve peaks at twice it, halfway through.
  const mean = (2 * Math.PI * FLOURISH_TURNS) / FLOURISH_SECONDS;
  return mean * (1 - Math.cos((2 * Math.PI * at) / FLOURISH_SECONDS));
}
