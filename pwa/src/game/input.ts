// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// INPUT: one manager merges the keyboard and the HUD's thumb zones into the
// engine's `CraftInput`. The maths — the ramps, the lever, the handlebar,
// the sign flip — is next door in input-model.ts, DOM-free so the tests can
// read it; this file is the listeners. Sampled once per STEP (§37.1): the
// ramps advance by the step's own dt, and the reset edge is banked between
// steps and handed to the step it arrives in, so a tap inside one step is
// still seen by that step.
//
// KEYS (fixed; a rebinding page is future work — `settings.ts` carries
// everything else the player chooses):
//   W            throttle             S / ↓      lean back
//   A / ←  D / → steer                Shift / ↑  lean forward
//   Space        brake and reverse    R          reset to the last gate (edge)
//   Enter        restart the run      C          next camera
//   Escape       hold the run and put the pause card up (menu-pause.tsx);
//                pressing it again over the card resumes, because the card's
//                RESUME row is its `data-nav-back` and menu-nav.ts takes
//                Escape upstream of this manager
//
// THE ARROW CLUSTER IS THE HANDLEBAR, not a left-handed copy of WASD: ← →
// steer it and ↑ ↓ lean on it, with the same sign the thumb's bar carries
// (`barLean` in input-model.ts). Pulling toward you — ↓ — is leaning BACK,
// nose up; pushing away — ↑ — is leaning forward, nose down. Which is why
// ↑ is not also a throttle key: the throttle is W's, and the arrows are
// the rider's body.
//
// THERE IS NO GEARBOX, and the ONE brake is not a brake pedal: Space drops
// the reverse BUCKET over the jet, which is the only way a watercraft
// slows itself down and the only way it goes backwards. A craft with no
// bucket fitted — the stand-up — has neither, and the key does nothing on
// it. Letting go of the throttle is still most of how you slow down.

import type { CraftInput } from "@engine";

import {
  createInputModel,
  neutralTouch,
  sampleInput,
  type KeysHeld,
  type TouchChannel,
} from "./input-model.ts";

/** The presses the app reacts to rather than the craft. */
export type InputAction = "restart" | "camera" | "pause";

export type InputManager = {
  /** Produce this step's input; advances the ramps by `dt`. */
  sample: (dt: number) => CraftInput;
  /** The thumb zones write here at pointer rate (screen-space). */
  touch: TouchChannel;
  /** Queue a reset — the HUD button and the R key both land here. */
  requestReset: () => void;
  /** Hear the app-level presses. */
  onAction: (handler: (action: InputAction) => void) => void;
  dispose: () => void;
};

type KeyAction = keyof KeysHeld;

/** Which code does what. Steer and lean each answer to two codes so the
 * arrows and WASD both ride; the throttle answers to W alone, because ↑ is
 * the handlebar's lean forward. Shift on either side of the keyboard. */
const KEY_CODES: Record<string, KeyAction> = {
  KeyW: "throttle",
  Space: "reverse",
  KeyS: "leanBack",
  ArrowDown: "leanBack",
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right",
  ShiftLeft: "leanForward",
  ShiftRight: "leanForward",
  ArrowUp: "leanForward",
};

/** The edges. */
const EDGE_CODES: Record<string, "reset" | InputAction> = {
  KeyR: "reset",
  Enter: "restart",
  KeyC: "camera",
  // The way out of a run. It is a key the browser and the OS both have
  // opinions about (full screen, pointer lock), which is exactly why it is
  // the one everybody already tries first.
  Escape: "pause",
};

/**
 * `claiming` says whether a RUN is being ridden right now. The listeners
 * live for the app's whole life but the held keys are only the craft's
 * while it is being ridden, and the difference matters for exactly one
 * key: every control on every menu card is a real `<button>`, and SPACE on
 * a focused button is how the browser presses it. Claiming space on a menu
 * — `preventDefault` on the keydown — would swallow that. The menu's own
 * nav handler stops the arrows and Escape upstream of here (capture phase,
 * App.tsx), but it has no reason to know about the brake, so the gate is
 * here instead. `App.tsx` passes `playerRides` from `shell.ts`, which is the
 * module that owns the question of whose hands are on the craft — including
 * the pause card, where they are not. It defaults to always claiming, which
 * is what a host with no menus around the run wants.
 */
export function createInputManager(
  target: Window = window,
  claiming: () => boolean = () => true,
): InputManager {
  const model = createInputModel();
  const keys: KeysHeld = {
    left: false,
    right: false,
    throttle: false,
    reverse: false,
    leanBack: false,
    leanForward: false,
  };
  const touch = neutralTouch();
  let reset = false;
  let onAction: (action: InputAction) => void = () => {};

  const onKeyDown = (e: KeyboardEvent): void => {
    const held = KEY_CODES[e.code];
    if (held && !claiming()) return;
    if (held) {
      keys[held] = true;
      // The arrows and space scroll the page; on a keyboard-driven game
      // that means the whole shell jumps.
      e.preventDefault();
      return;
    }
    const edge = EDGE_CODES[e.code];
    if (!edge || e.repeat) return;
    if (edge === "reset") reset = true;
    else onAction(edge);
    e.preventDefault();
  };
  // A key let go is always let go, claimed or not: a run left mid-throttle
  // must not come back to a throttle that is still down.
  const onKeyUp = (e: KeyboardEvent): void => {
    const held = KEY_CODES[e.code];
    if (held) keys[held] = false;
  };
  // A key held while the window loses focus never sends its keyup: the
  // craft would ride off at full throttle behind a dialog. Everything held
  // is let go of when the focus goes.
  const onBlur = (): void => {
    for (const k of Object.keys(keys) as KeyAction[]) keys[k] = false;
  };

  target.addEventListener("keydown", onKeyDown);
  target.addEventListener("keyup", onKeyUp);
  target.addEventListener("blur", onBlur);
  target.document.addEventListener("visibilitychange", onBlur);

  return {
    sample: (dt) => {
      const input = sampleInput(model, keys, touch, dt, reset);
      reset = false;
      return input;
    },
    touch,
    requestReset: () => {
      reset = true;
    },
    onAction: (handler) => {
      onAction = handler;
    },
    dispose: () => {
      target.removeEventListener("keydown", onKeyDown);
      target.removeEventListener("keyup", onKeyUp);
      target.removeEventListener("blur", onBlur);
      target.document.removeEventListener("visibilitychange", onBlur);
    },
  };
}
