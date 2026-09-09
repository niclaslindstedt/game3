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
/** The throttle key's ramp, 1/s: a quarter of a second to wide open, so a
 * tap is a squirt and a hold is the whole pump, and a release that lets
 * go at once — there is no brake, and the only way to slow down is to stop
 * asking. */
export const KEY_THROTTLE_ATTACK = 4;
export const KEY_THROTTLE_RELEASE = 12;
/** The lean keys' ramp, 1/s: a rider shifting their weight takes a moment,
 * and coming back to centre is quicker than going out. */
export const KEY_LEAN_ATTACK = 5;
export const KEY_LEAN_RELEASE = 8;

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

/** THE THROTTLE LEVER. A touch anchors at nothing; dragging DOWN the glass
 * pulls the lever, and this many pixels of travel is wide open. Down rather
 * than up because a thumb resting at the bottom of a phone has room to
 * pull toward the palm and none to push away from it — and because a lever
 * is squeezed toward the rider, never pushed. */
export const LEVER_FULL_PX = 90;

/** How open the lever is for a thumb `dyPx` below its anchor (screen y
 * grows downward, so a drag down is positive). Analogue and clamped: half
 * the travel is half the pump. Above the anchor is nothing. */
export function leverThrottle(dyPx: number): number {
  return clamp(dyPx / LEVER_FULL_PX, 0, 1);
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
  return clamp((Math.sign(dyPx) * beyond) / LEAN_REACH_PX, -1, 1);
}

/** Which keys are down, as the actions they are bound to. */
export type KeysHeld = {
  left: boolean;
  right: boolean;
  throttle: boolean;
  leanBack: boolean;
  leanForward: boolean;
};

export const NO_KEYS: KeysHeld = {
  left: false,
  right: false,
  throttle: false,
  leanBack: false,
  leanForward: false,
};

/** What the thumb zones have written, screen-space, at pointer rate. A
 * zone that is not being touched writes zeros and `false`; the one that IS
 * being touched overrides the keyboard on the axes it owns. */
export type TouchChannel = {
  /** The handlebar: steer and lean, and whether a thumb is on it. */
  steer: number;
  lean: number;
  bar: boolean;
  /** The lever, 0..1, and whether a thumb is on it. */
  throttle: number;
  lever: boolean;
};

export function neutralTouch(): TouchChannel {
  return { steer: 0, lean: 0, bar: false, throttle: 0, lever: false };
}

/** The keyboard's three ramped axes, screen-space. Advanced once per STEP
 * (§37.1) so a ramp is the same ramp on every display. */
export type InputModel = {
  steer: number;
  throttle: number;
  lean: number;
};

export function createInputModel(): InputModel {
  return { steer: 0, throttle: 0, lean: 0 };
}

/** One step's input: advance the keyboard ramps by `dt`, merge the thumbs
 * in, apply the sign flip and hand the engine its structure. `reset` is the
 * edge the caller has banked since the last step (§37.1: a press is never
 * lost between steps).
 *
 * Merging: a thumb on the bar owns steer and lean outright — a key held
 * under it would fight the hand. The throttle takes the DEEPER of key and
 * lever: both are asking for pump, and the answer to both is the one that
 * asks for more. */
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
  const leanTarget = (keys.leanBack ? 1 : 0) - (keys.leanForward ? 1 : 0);
  model.lean = rampToward(model.lean, leanTarget, dt, KEY_LEAN_ATTACK, KEY_LEAN_RELEASE);

  const steer = touch.bar ? touch.steer : model.steer;
  const lean = touch.bar ? touch.lean : model.lean;
  const throttle = Math.max(model.throttle, touch.lever ? touch.throttle : 0);
  return {
    steer: clamp(steer, -1, 1) * SCREEN_TO_ENGINE,
    throttle: clamp(throttle, 0, 1),
    lean: clamp(lean, -1, 1),
    reset,
  };
}
