// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// INPUT: one manager merges the keyboard and the HUD's thumb zones into the
// engine's `CraftInput`. The maths — the ramps, the lever, the handlebar,
// the sign flip — is next door in input-model.ts, DOM-free so the tests can
// read it; this file is the listeners. Sampled once per STEP (§37.1): the
// ramps advance by the step's own dt, and the reset edge is banked between
// steps and handed to the step it arrives in, so a tap inside one step is
// still seen by that step.
//
// WHICH KEY DOES WHAT IS THE PLAYER'S TO CHANGE. The manager holds a
// code → actions index built from the bindings in `settings-input.ts`, so a
// rebind is one call to `setKeys` and nothing in this file knows about any
// particular key. The shipped layout, and the reasoning behind every key in
// it, is stated there — once — beside the page that changes it
// (menu-keys.tsx):
//   W            throttle             S / Space  brake and reverse
//   A / ←  D / → steer                ↓          lean back
//   Q / ↑        lean forward         Shift      TUCK (hold)
//   R            back to the last gate (edge)    B  restart the run
//   Enter        take a screenshot    C          next camera
//   H            the readouts off, and back
//
// AN ACTION MAY BE HELD OR TAKEN ON THE PRESS, and `settings-input.ts` is
// what says which: the craft's seven are held and ramped, the six around a
// run happen once however long the key is down. One key may be bound to
// both kinds — nothing stops a rider putting the brake and the reset under
// one finger — so a press applies every action its code carries.
//   Escape       hold the run and put the pause card up (menu-pause.tsx);
//                pressing it again over the card resumes, because the card's
//                RESUME row is its `data-nav-back` and menu-nav.ts takes
//                Escape upstream of this manager
//
// H TAKES THE READOUTS OFF THE WATER, and it writes the very switch
// OPTIONS ▸ HUD and the pause card's own row write (`settings.hud.on`) —
// one answer, reachable from the key, the card and the options page, so a
// rider who cleared the screen to watch a wave finds it cleared next run
// too. Which is why it is a press the APP answers rather than anything the
// craft hears: the run carries on exactly as it was.
//
// ENTER IS THE SHUTTER, and the two restarts moved off it rather than
// sharing it. A picture is the press a rider makes while everything is
// still going well, and the key it is on has to be the one the hand is
// already resting near and the one every other game has put it on — so
// Enter takes the picture (screenshots.ts files it and the gallery keeps
// it), R still puts the craft back at the last gate it passed, and B stands
// the whole run back up from the beginning. The two of them are the same
// verb at two distances, which is why they are neighbours on the row rather
// than on opposite ends of the keyboard. All three are defaults now: a
// rider who wants the shutter somewhere else moves it.
//
// THE ARROW CLUSTER IS THE HANDLEBAR, not a left-handed copy of WASD: ← →
// steer it and ↑ ↓ lean on it, with the same sign the thumb's bar carries
// (`barLean` in input-model.ts). Pulling toward you — ↓ — is leaning BACK,
// nose up; pushing away — ↑ — is leaning forward, nose down. Which is why
// ↑ is not also a throttle key: the throttle is W's, and the arrows are
// the rider's body.
//
// SHIFT IS THE TUCK, and it is held rather than tapped: the rider gets
// down behind the bars for a smaller hole in the air, and pays for it in
// everything they steer with their own body (`TUNING.tuck`). It is a
// KEYBOARD control and has no touch equivalent on purpose — both thumbs
// are already on the bar and the lever — which is why the lean forward it
// displaced went to Q rather than being doubled up on it: a rider holding
// a tuck must not also be pushing the nose down.
//
// THERE IS NO GEARBOX, and the ONE brake is not a brake pedal: Space drops
// the reverse BUCKET over the jet, which is the only way a watercraft
// slows itself down and the only way it goes backwards. A craft with no
// bucket fitted — the stand-up — has neither, and the key does nothing on
// it. Letting go of the throttle is still most of how you slow down.

import type { CraftInput } from "@engine";

import {
  DEFAULT_KEYS,
  isHeldAction,
  type InputAction,
  type KeyAction,
  type KeyBindings,
} from "./settings-input.ts";
import {
  createInputModel,
  neutralTouch,
  sampleInput,
  type KeysHeld,
  type TouchChannel,
} from "./input-model.ts";

/** The presses the app reacts to rather than the craft. Re-exported from
 * the vocabulary module so a host can name one without learning where the
 * bindings live. */
export type { InputAction };

export type InputManager = {
  /** Produce this step's input; advances the ramps by `dt`. */
  sample: (dt: number) => CraftInput;
  /** The thumb zones write here at pointer rate (screen-space). */
  touch: TouchChannel;
  /** Queue a reset — the HUD button and the R key both land here. */
  requestReset: () => void;
  /** Re-point every key at its action. Unbound actions simply go
   * unpressed — a keyboard with nothing on the throttle is a rider who
   * asked for that. */
  setKeys: (bindings: KeyBindings) => void;
  /** Hear the app-level presses. */
  onAction: (handler: (action: InputAction) => void) => void;
  dispose: () => void;
};

/** Whether this machine has KEYS to rebind. A phone has none, and an
 * OPTIONS page offering it a page of them is a door onto a room it cannot
 * walk into — while a laptop with a touchscreen reports both and keeps its
 * keyboard. It lives here, with the rest of what asks the browser about
 * input, rather than beside the bindings whose fate it decides:
 * `settings-input.ts` is read by the root suite, which has no DOM to ask. */
export function hasKeyboard(): boolean {
  if (typeof window === "undefined") return true;
  const touch = navigator.maxTouchPoints > 0 || "ontouchstart" in window;
  return !touch || matchMedia("(pointer: fine)").matches;
}

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
  bindings: KeyBindings = DEFAULT_KEYS,
): InputManager {
  const model = createInputModel();
  const keys: KeysHeld = {
    left: false,
    right: false,
    throttle: false,
    reverse: false,
    leanBack: false,
    leanForward: false,
    crouch: false,
  };
  const touch = neutralTouch();
  let reset = false;
  let onAction: (action: InputAction) => void = () => {};

  /** The index every keystroke is answered from: one code, the actions on
   * it. A list rather than one action because two rows of the binding page
   * may name the same key. */
  let byCode = new Map<string, KeyAction[]>();

  const setKeys = (next: KeyBindings): void => {
    const index = new Map<string, KeyAction[]>();
    for (const [action, codes] of Object.entries(next) as [KeyAction, string[]][]) {
      for (const code of codes) {
        const on = index.get(code);
        if (on) on.push(action);
        else index.set(code, [action]);
      }
    }
    byCode = index;
    // A rebind while a key is DOWN would otherwise leave its old action
    // stuck on: the keyup that would have let it go arrives for a code the
    // index no longer knows.
    for (const k of Object.keys(keys) as (keyof KeysHeld)[]) keys[k] = false;
  };
  setKeys(bindings);

  const onKeyDown = (e: KeyboardEvent): void => {
    const actions = byCode.get(e.code);
    if (!actions) return;
    let took = false;
    for (const action of actions) {
      if (isHeldAction(action)) {
        if (!claiming()) continue;
        keys[action] = true;
        took = true;
      } else if (!e.repeat) {
        if (action === "reset") reset = true;
        else onAction(action);
        took = true;
      }
    }
    // The arrows and space scroll the page; on a keyboard-driven game that
    // means the whole shell jumps. Only for a press this manager actually
    // took — a key the run did not claim is the browser's.
    if (took) e.preventDefault();
  };
  // A key let go is always let go, claimed or not: a run left mid-throttle
  // must not come back to a throttle that is still down.
  const onKeyUp = (e: KeyboardEvent): void => {
    for (const action of byCode.get(e.code) ?? []) {
      if (isHeldAction(action)) keys[action] = false;
    }
  };
  // A key held while the window loses focus never sends its keyup: the
  // craft would ride off at full throttle behind a dialog. Everything held
  // is let go of when the focus goes.
  const onBlur = (): void => {
    for (const k of Object.keys(keys) as (keyof KeysHeld)[]) keys[k] = false;
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
    setKeys,
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
