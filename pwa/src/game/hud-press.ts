// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// HOW A HUD BUTTON IS PRESSED WHILE A THUMB IS ALREADY DOWN.
//
// `click` is not an event the browser owes every touch. It is an ACTIVATION
// event, synthesised from the PRIMARY pointer alone — the first finger on the
// glass — and a phone riding this game always has that finger spoken for: it
// is on the handlebar or on the lever. Every other finger is non-primary, so
// a tap on CAMERA, RESET or the map while the craft is being ridden raises
// `pointerdown` and `pointerup` on the button and NO CLICK AT ALL. Nothing is
// covering the button and nothing swallows the touch; the button simply never
// hears the one event it was listening for.
//
// Measured, both ways, in Chromium at 390x844 with touch on:
//
//   button alone   pointerdown(primary=true)  pointerup  click
//   zone held      pointerdown(primary=false) pointerup  -
//
// So an in-run press is driven from the POINTER events, which every finger
// gets, and the click that may or may not follow is swallowed rather than
// allowed to fire the action a second time.
//
// DOM-free, like `thumb-guard.ts` beside it and for the same reason: the
// events are typed structurally so `tests/hud_press_test.ts` can ride the
// whole state machine on plain Node. The glue that measures the button and
// reads the clock is `pressHandlers`, at the foot of the file.

/** How long after a pointer-driven press a `click` is taken to be that same
 * press arriving late, ms. The compatibility cascade follows a touch within a
 * frame or two; the legacy double-tap wait is the worst case, and this clears
 * it with room. Long enough to catch the echo, short enough that a mouse
 * click a moment later is still a press of its own. */
const CLICK_ECHO_MS = 700;

/** What the state machine needs off a pointer event. */
export type PressPoint = {
  pointerId: number;
  pointerType?: string;
  clientX: number;
  clientY: number;
};

/** What it needs off the button: where its edges are. */
export type PressBox = { left: number; top: number; right: number; bottom: number };

export type HudPress = {
  /** A finger has landed on the button. */
  down: (p: PressPoint) => void;
  /** It has lifted. True when that is a press: the pointer this button was
   * holding, released inside its own edges. A box that could not be measured
   * counts as inside — the release reached the button, which is the whole
   * question, and a dead button is the worse failure. */
  up: (p: PressPoint, box: PressBox | null, now: number) => boolean;
  /** The grip is gone without a release — the browser took the touch for a
   * gesture of its own, or the pointer was captured away. */
  cancel: (p: PressPoint) => void;
  /** A `click` has arrived. True when it is a press in its own right — a
   * mouse, or a key on a focused button — rather than the echo of one this
   * button has just fired from the pointer events. */
  click: (now: number) => boolean;
};

/**
 * One button's press. A mouse is deliberately NOT armed on `pointerdown`:
 * it has a real activation path of its own — the drag-off cancel, the
 * secondary buttons, the keyboard's Enter and Space arriving as clicks — and
 * reimplementing that from pointer events would lose more than it fixed. So a
 * mouse presses through `click` exactly as it always did, and touch and pen
 * press through the pointer events because for them `click` is not on offer.
 */
export function createHudPress(): HudPress {
  let held: number | null = null;
  let firedAt: number | null = null;

  return {
    down: (p) => {
      if (p.pointerType === "mouse") return;
      held = p.pointerId;
    },
    up: (p, box, now) => {
      if (held !== p.pointerId) return false;
      held = null;
      // Whether or not this is a press, the click behind it belongs to this
      // touch and must not fire on its own: a finger slid off the button is a
      // press ABANDONED, and the echo would reinstate it.
      firedAt = now;
      if (!box) return true;
      return (
        p.clientX >= box.left &&
        p.clientX <= box.right &&
        p.clientY >= box.top &&
        p.clientY <= box.bottom
      );
    },
    cancel: (p) => {
      if (held !== p.pointerId) return;
      held = null;
      firedAt = null;
    },
    click: (now) => firedAt === null || now - firedAt > CLICK_ECHO_MS,
  };
}

/** A button the press machine can measure: any element, in practice. */
export type PressTarget = { getBoundingClientRect: () => PressBox };

/** A pointer event as this module reads it. */
export type PressEvent = PressPoint & { currentTarget: PressTarget | null };

/**
 * The four handlers a HUD button spreads onto itself. Stated once here rather
 * than per button, because the order the four have to agree in — arm, fire,
 * swallow — is the whole of the fix and is not a thing to retype.
 */
export function pressHandlers(press: HudPress, act: () => void) {
  return {
    onPointerDown: (e: PressEvent) => press.down(e),
    onPointerUp: (e: PressEvent) => {
      if (press.up(e, e.currentTarget?.getBoundingClientRect() ?? null, Date.now())) act();
    },
    onPointerCancel: (e: PressEvent) => press.cancel(e),
    onClick: () => {
      if (press.click(Date.now())) act();
    },
  };
}
