// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// INPUT: one manager merges the keyboard and the HUD's thumb zones into the
// engine's `CraftInput`. The maths — the ramps, the lever, the handlebar,
// the sign flip — is next door in input-model.ts, DOM-free so the tests can
// read it; this file is the listeners. Sampled once per STEP (§37.1): the
// ramps advance by the step's own dt, and the reset edge is banked between
// steps and handed to the step it arrives in, so a tap inside one step is
// still seen by that step.
//
// KEYS (fixed; a rebinding page is future work in settings.ts):
//   W / ↑        throttle           S / ↓    lean back
//   A / ←  D / → steer              Shift    lean forward
//   R            reset to the last gate (edge)
//   Enter        restart the run     C       next camera
//
// THERE IS NO BRAKE, NO HANDBRAKE AND NO GEARBOX. The throttle is the
// control, and letting go of it is the only way to slow down — which is
// the real thing.

import type { CraftInput } from "@engine";

import {
  createInputModel,
  neutralTouch,
  sampleInput,
  type KeysHeld,
  type TouchChannel,
} from "./input-model.ts";

/** The presses the app reacts to rather than the craft. */
export type InputAction = "restart" | "camera";

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

/** Which code does what. Two codes per axis so the arrows and WASD both
 * ride; Shift on either side of the keyboard. */
const KEY_CODES: Record<string, KeyAction> = {
  KeyW: "throttle",
  ArrowUp: "throttle",
  KeyS: "leanBack",
  ArrowDown: "leanBack",
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right",
  ShiftLeft: "leanForward",
  ShiftRight: "leanForward",
};

/** The edges. */
const EDGE_CODES: Record<string, "reset" | InputAction> = {
  KeyR: "reset",
  Enter: "restart",
  KeyC: "camera",
};

export function createInputManager(target: Window = window): InputManager {
  const model = createInputModel();
  const keys: KeysHeld = { left: false, right: false, throttle: false, leanBack: false, leanForward: false };
  const touch = neutralTouch();
  let reset = false;
  let onAction: (action: InputAction) => void = () => {};

  const onKeyDown = (e: KeyboardEvent): void => {
    const held = KEY_CODES[e.code];
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
