// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE INPUT MATHS, with no DOM in it: what a held key ramps to, what a thumb
// on the glass is asking for, and the one sign flip between the screen and
// the engine. `input.ts` owns the listeners and hands this module pixels
// and key states; `hud-touch.tsx` hands it drags. Everything here is a pure
// function of its arguments so the root suite can hold the feel numbers to
// their shape without a browser (tests/input_model_test.ts).
//
// SIGN BOUNDARY, stated ONCE. Everything on the screen side is SCREEN-space:
// positive steer means "the nose goes right as seen through the chase
// camera". The engine's positive steer is CLOCKWISE IN MAP VIEW (heading
// grows from +z toward +x), and the renderer maps engine axes straight onto
// three.js's right-handed y-up frame, whose top-down view MIRRORS the map —
// so from behind the craft the engine's positive steer is a LEFT turn.
// `SCREEN_TO_ENGINE` is that flip; `sampleInput` applies it to the steer,
// the HUD's wind vane applies it to a bearing, and nothing else may.

import type { CraftInput } from "@engine";

import { clamp } from "../lib/util.ts";

export const SCREEN_TO_ENGINE = -1;

/** Keyboard steering ramp, 1/s: a held key eases toward full lock at this
 * rate (about a sixth of a second to full)... */
export const KEY_STEER_ATTACK = 6;
/** ...and a released one snaps back to centre at this one — faster, so
 * letting go is letting go, not a slow unwind. */
export const KEY_STEER_RELEASE = 9;
/** Below this the centred keyboard axis snaps to exactly zero. */
export const KEY_AXIS_SNAP = 0.02;
/** The throttle key's ramp, 1/s: a quarter-second time constant — nine
 * tenths open six tenths of a second into a hold — so a tap is a squirt
 * and a hold is the whole pump; and a release that lets go at once,
 * because letting go of a throttle is letting go. */
export const KEY_THROTTLE_ATTACK = 4;
export const KEY_THROTTLE_RELEASE = 12;
/** The brake-and-reverse key's ramp, 1/s. Quicker to ask for than the
 * throttle — a brake is grabbed, not squeezed — and quicker still to let
 * go of. The BUCKET's own travel is what actually delays it (the engine's
 * `spec.bucket.deploy`), so a soft ramp here would only be a second, made
 * up lag on top of the real one. */
export const KEY_REVERSE_ATTACK = 10;
export const KEY_REVERSE_RELEASE = 14;
/** The lean keys' ramp, 1/s: a rider shifting their weight takes a moment,
 * and coming back to centre is quicker than going out. */
export const KEY_LEAN_ATTACK = 5;
export const KEY_LEAN_RELEASE = 8;
/** THE TUCK's ramp, 1/s. The same shape as the lean's and a touch slower
 * to ask for, because it is a bigger move of the same body: the rider is
 * getting right down behind the bars, not shifting on the seat. The
 * engine lags it AGAIN on its own (`TUNING.tuck.lag`) — this ramp is the
 * hand's, that one is the body's, and a key tapped mid-corner must not
 * read as a posture the rider never got into. */
export const KEY_CROUCH_ATTACK = 4;
export const KEY_CROUCH_RELEASE = 9;

/** Walk `value` toward `target` at `attack` per second when the target is
 * away from centre and `release` when it is centre, over `dt` seconds. A
 * first-order ease rather than a linear ramp: the first bit of lock arrives
 * quickly and the last bit settles, which is what a hand does. */
export function rampToward(
  value: number,
  target: number,
  dt: number,
  attack: number,
  release: number,
): number {
  const rate = target === 0 ? release : attack;
  const next = value + (target - value) * Math.min(1, rate * dt);
  return target === 0 && Math.abs(next) < KEY_AXIS_SNAP ? 0 : next;
}

/** THE THROTTLE LEVER, AND WHICH WAY IT RESTS. A touch anchors at WIDE
 * OPEN, and the throw runs UPWARD from there: the first `LEVER_FULL_PX` of
 * travel up the glass closes the throttle, and everything below the anchor
 * is still wide open.
 *
 * That is the real lever's sense as well as the useful one. A watercraft's
 * throttle is a sprung finger lever squeezed against the bar: the rider
 * HOLDS it open and eases it to slow, so touching the glass is squeezing
 * the lever and lifting toward the top of the screen is letting it back
 * out. It also puts the travel where a thumb actually has room — the
 * player is almost always asking for all of it, and a thumb that landed
 * low on the glass used to have its remaining throw off the bottom of the
 * phone, which took full throttle away from exactly the grip a hurried
 * hand makes. */
export const LEVER_FULL_PX = 90;

/** ...and PAST the shut mark the same throw becomes the BRAKE AND REVERSE
 * lever, the craft's other one: this much further up the glass is the
 * bucket all the way down. Shorter travel than the throttle's, because it
 * is reached for in a hurry; the bucket's own swing is what makes it
 * gradual, not the glass. */
export const LEVER_REVERSE_PX = 60;

/** How open the throttle is for a thumb `dyPx` from its anchor (screen y
 * grows downward, so a drag UP is negative). Wide open at the anchor and
 * anywhere below it, closing analogue over `LEVER_FULL_PX` of travel up,
 * shut past that — where the throw becomes `leverReverse`'s. */
export function leverThrottle(dyPx: number): number {
  return clamp(1 + dyPx / LEVER_FULL_PX, 0, 1);
}

/** ...and how far the brake is pulled for the same thumb: the travel
 * beyond the shut mark, 0..1. Nothing until the throttle has closed, so
 * one throw carries both and a rider can never be asking for the pump and
 * the bucket at once. */
export function leverReverse(dyPx: number): number {
  // Stated as an early return so the answer is +0 rather than the -0 a
  // negated zero gives — the same wart `sampleInput` guards the steer
  // against.
  const past = -dyPx - LEVER_FULL_PX;
  if (past <= 0) return 0;
  return clamp(past / LEVER_REVERSE_PX, 0, 1);
}

/** THE HANDLEBAR. Thumb travel sideways from the anchor for full lock —
 * the bar's whole throw. Long enough that holding a line is a push, not a
 * switch. */
export const BAR_REACH_PX = 70;
/** The throw is shaped `travel ** this`, so the first centimetre of thumb
 * buys less lock than the last: a slight steer is a target a thumb can hit
 * instead of the twitch either side of centre — but only just past linear,
 * because the hull's own response carries the rest. */
export const BAR_THROW_CURVE = 1.15;
/** Vertical thumb travel for full lean, px, and the dead band around the
 * anchor a sideways drag may wander in without shifting the rider's
 * weight: steering alone must never lean the nose. */
export const LEAN_REACH_PX = 60;
export const LEAN_DEAD_PX = 14;

/** Screen-space steer, -1..1, for a thumb `dxPx` right of its anchor. */
export function barSteer(dxPx: number): number {
  const travel = clamp(dxPx / BAR_REACH_PX, -1, 1);
  return Math.sign(travel) * Math.abs(travel) ** BAR_THROW_CURVE;
}

/** Lean, -1..1, for a thumb `dyPx` below its anchor: pulling the bar TOWARD
 * the rider (down the glass) is leaning BACK (+1, nose up), pushing it away
 * is leaning forward. The dead band is spent before the travel counts. */
export function barLean(dyPx: number): number {
  const beyond = Math.max(0, Math.abs(dyPx) - LEAN_DEAD_PX);
  if (beyond === 0) return 0;
  return clamp((Math.sign(dyPx) * beyond) / LEAN_REACH_PX, -1, 1);
}

/** Which keys are down, as the actions they are bound to. */
export type KeysHeld = {
  left: boolean;
  right: boolean;
  throttle: boolean;
  reverse: boolean;
  leanBack: boolean;
  leanForward: boolean;
  crouch: boolean;
};

export const NO_KEYS: KeysHeld = {
  left: false,
  right: false,
  throttle: false,
  reverse: false,
  leanBack: false,
  leanForward: false,
  crouch: false,
};

/** What the thumb zones have written, screen-space, at pointer rate. A
 * zone that is not being touched writes zeros and `false`; the one that IS
 * being touched overrides the keyboard on the axes it owns.
 *
 * THERE IS NO TUCK HERE, AND THERE IS NOT MEANT TO BE. A touch rider has
 * two thumbs and both are already committed — one to the handlebar, one
 * to the throttle lever — so the tuck is a KEYBOARD control and only a
 * keyboard control. A third zone would have to be reached for by letting
 * go of one of the two the craft is actually ridden with, which is a
 * worse trade than the one the tuck is offering. */
export type TouchChannel = {
  /** The handlebar: steer and lean, and whether a thumb is on it. */
  steer: number;
  lean: number;
  bar: boolean;
  /** The lever, 0..1 each way from its anchor, and whether a thumb is on
   * it. Only one of the two can be open at a time: the thumb is either
   * above the anchor or below it. */
  throttle: number;
  reverse: number;
  lever: boolean;
};

export function neutralTouch(): TouchChannel {
  return { steer: 0, lean: 0, bar: false, throttle: 0, reverse: 0, lever: false };
}

/** The keyboard's three ramped axes, screen-space. Advanced once per STEP
 * (§37.1) so a ramp is the same ramp on every display. */
export type InputModel = {
  steer: number;
  throttle: number;
  reverse: number;
  lean: number;
  crouch: number;
};

export function createInputModel(): InputModel {
  return { steer: 0, throttle: 0, reverse: 0, lean: 0, crouch: 0 };
}

/** One step's input: advance the keyboard ramps by `dt`, merge the thumbs
 * in, apply the sign flip and hand the engine its structure. `reset` is the
 * edge the caller has banked since the last step (§37.1: a press is never
 * lost between steps).
 *
 * Merging: a thumb on the bar owns steer and lean outright — a key held
 * under it would fight the hand. The throttle takes the DEEPER of key and
 * lever: both are asking for pump, and the answer to both is the one that
 * asks for more. The brake is merged the same way, and then WINS over the
 * throttle: a rider reaching for the only brake the craft has is not also
 * asking to go faster, whichever hand the other input came from. */
export function sampleInput(
  model: InputModel,
  keys: KeysHeld,
  touch: TouchChannel,
  dt: number,
  reset: boolean,
): CraftInput {
  const steerTarget = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  model.steer = rampToward(model.steer, steerTarget, dt, KEY_STEER_ATTACK, KEY_STEER_RELEASE);
  model.throttle = rampToward(
    model.throttle,
    keys.throttle ? 1 : 0,
    dt,
    KEY_THROTTLE_ATTACK,
    KEY_THROTTLE_RELEASE,
  );
  model.reverse = rampToward(
    model.reverse,
    keys.reverse ? 1 : 0,
    dt,
    KEY_REVERSE_ATTACK,
    KEY_REVERSE_RELEASE,
  );
  const leanTarget = (keys.leanBack ? 1 : 0) - (keys.leanForward ? 1 : 0);
  model.lean = rampToward(model.lean, leanTarget, dt, KEY_LEAN_ATTACK, KEY_LEAN_RELEASE);
  model.crouch = rampToward(
    model.crouch,
    keys.crouch ? 1 : 0,
    dt,
    KEY_CROUCH_ATTACK,
    KEY_CROUCH_RELEASE,
  );

  const steer = touch.bar ? touch.steer : model.steer;
  const lean = touch.bar ? touch.lean : model.lean;
  const reverse = clamp(Math.max(model.reverse, touch.lever ? touch.reverse : 0), 0, 1);
  const throttle = Math.max(model.throttle, touch.lever ? touch.throttle : 0);
  return {
    // `0 * -1` is -0, and a -0 is a wart every equality downstream trips on.
    steer: steer === 0 ? 0 : clamp(steer, -1, 1) * SCREEN_TO_ENGINE,
    throttle: reverse > 0 ? 0 : clamp(throttle, 0, 1),
    reverse,
    lean: clamp(lean, -1, 1),
    // The keyboard's alone: no thumb writes it, so there is nothing to
    // merge and a touch rider is always sat up.
    crouch: clamp(model.crouch, 0, 1),
    reset,
  };
}
