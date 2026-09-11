// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT THE PLAYER PRESSES: every action the game can be given from the
// keyboard, the keys bound to each by default, and the order the binding
// page prints them in. Data only — reading a keyboard is `input.ts`'s, and
// the maths a held key ramps through is `input-model.ts`'s.
//
// It is a module of its own rather than a corner of `settings.ts` because
// the list of ACTIONS is the input layer's vocabulary and the STORAGE is
// the settings layer's: `input.ts` needs the first without the second, and
// the root suite reads both without a browser.
//
// THE HELD SET IS NOT RESTATED. `HeldAction` is `keyof KeysHeld`, so a key
// the craft grows tomorrow is an action this table does not compile without
// — the one trap a hand-written list of actions would spring the day the
// hull learns something new.

import { STRINGS } from "./strings.ts";
import type { KeysHeld } from "./input-model.ts";

/** The actions a key is HELD for — the craft's own, and the only ones the
 * ramps in `input-model.ts` know about. */
export type HeldAction = keyof KeysHeld;

/** The presses the APP answers rather than the craft. `reset` is the fifth
 * edge and is not here: it reaches the engine as an input flag on the step
 * it arrives in rather than as an app-level press, which is the whole
 * difference between putting the craft back and changing the camera. */
export type InputAction = "restart" | "camera" | "pause" | "shot";

/** An action taken on the PRESS, not held: it happens once however long the
 * key is down. */
export type EdgeAction = "reset" | InputAction;

export type KeyAction = HeldAction | EdgeAction;

/** Bound `KeyboardEvent.code` values per action — a LIST, because the
 * defaults ship the handlebar's arrows beside the driving hand's WASD.
 * Rebinding an action replaces its whole list with the one key pressed. */
export type KeyBindings = Record<KeyAction, string[]>;

/** Is this one of the craft's held actions? The one place the question is
 * answered, and the table behind it is typed `Record<HeldAction, true>` —
 * so the day the hull grows a seventh held key this file stops compiling
 * rather than quietly treating it as a press. */
const HELD: Record<HeldAction, true> = {
  throttle: true,
  reverse: true,
  left: true,
  right: true,
  leanBack: true,
  leanForward: true,
  crouch: true,
};

export function isHeldAction(action: KeyAction): action is HeldAction {
  return action in HELD;
}

/** The rows of OPTIONS ▸ KEYBOARD, in the order they are printed: the hand
 * on the throttle first, then the one on the bars, then the presses that
 * are about the RUN rather than the craft. */
export const KEY_ACTIONS: { id: KeyAction; label: string }[] = [
  { id: "throttle", label: STRINGS.keyThrottle },
  { id: "reverse", label: STRINGS.keyReverse },
  { id: "left", label: STRINGS.keyLeft },
  { id: "right", label: STRINGS.keyRight },
  { id: "leanBack", label: STRINGS.keyLeanBack },
  { id: "leanForward", label: STRINGS.keyLeanForward },
  { id: "crouch", label: STRINGS.keyTuck },
  { id: "reset", label: STRINGS.keyReset },
  { id: "restart", label: STRINGS.keyRestart },
  { id: "camera", label: STRINGS.keyCamera },
  { id: "shot", label: STRINGS.keyShot },
  { id: "pause", label: STRINGS.keyPause },
];

/**
 * THE KEYBOARD AS IT SHIPS — two hands, two different machines under them.
 *
 * The LEFT hand gets the driving set every keyboard game has: W opens the
 * throttle, A and D steer, and S is the brake and reverse. The ARROW
 * CLUSTER is the HANDLEBAR: ← → steer it and ↑ ↓ lean on it, with the same
 * sign the thumb's bar carries — pulling toward you is leaning BACK, nose
 * up. Which is why ↑ is not a second throttle: the throttle is W's, and the
 * arrows are the rider's body.
 *
 * SPACE keeps the brake beside S because it is where a hand that has never
 * played this reaches first, and the bucket is the one control on the craft
 * a rider grabs rather than squeezes.
 *
 * THERE IS NO GEARBOX, and the brake is not a brake pedal: it drops the
 * reverse BUCKET over the jet, which is the only way a watercraft slows
 * itself down and the only way it goes backwards. A craft with no bucket
 * fitted — the stand-up — has neither, and the key does nothing on it.
 */
export const DEFAULT_KEYS: KeyBindings = {
  throttle: ["KeyW"],
  reverse: ["KeyS", "Space"],
  left: ["KeyA", "ArrowLeft"],
  right: ["KeyD", "ArrowRight"],
  leanBack: ["ArrowDown"],
  // Q rather than Shift for the lean, because SHIFT IS THE TUCK: a rider
  // holding himself down behind the bars must not also be pushing the nose
  // down. Q is the WASD hand's ring finger, since W above S is the
  // throttle's, and ↑ is the handlebar's own.
  leanForward: ["KeyQ", "ArrowUp"],
  // Held, not tapped, and on both shifts — the one control with no touch
  // equivalent, because both thumbs are already on the bar and the lever.
  crouch: ["ShiftLeft", "ShiftRight"],
  // R FOR THE ONE OF THESE TWO A RIDER REACHES FOR MID-RUN: the craft is
  // upside down in the surf, or the buoy went past on the wrong side, and
  // the run wants putting back at the last gate. Standing the WHOLE run
  // back up is the rarer press and the far more expensive one to make by
  // accident, so it is B beside it rather than a hand shared with it — and
  // neither is on Enter, because ENTER IS THE SHUTTER (`screenshots.ts`):
  // a picture is the press a rider makes while everything is still going
  // well, and it wants the key the hand is already resting near.
  reset: ["KeyR"],
  restart: ["KeyB"],
  camera: ["KeyC"],
  shot: ["Enter"],
  // The way out of a run. It is a key the browser and the OS both have
  // opinions about (full screen, pointer lock), which is exactly why it is
  // the one everybody already tries first — and why the binding page reads
  // a press of it as "keep what is there" rather than as a key to bind.
  pause: ["Escape"],
};

/** How many keys one action may carry. The defaults' longest is three, and
 * the ceiling is only here so a hand-written blob cannot hand the manager a
 * thousand codes to walk on every keystroke. */
export const KEYS_PER_ACTION = 4;

/** A `KeyboardEvent.code` as the player reads it off the keyboard in front
 * of them. Only the families a keyboard actually has rows for — anything
 * else is its own code in capitals, which for the keys this game is likely
 * to be bound to is already what is printed on the cap. */
export function keyLabel(code: string): string {
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return `NUM ${code.slice(6)}`;
  if (code.startsWith("Arrow")) return `${code.slice(5).toUpperCase()} ARROW`;
  if (code === "Space") return "SPACE";
  if (code === "ShiftLeft") return "L SHIFT";
  if (code === "ShiftRight") return "R SHIFT";
  if (code === "ControlLeft") return "L CTRL";
  if (code === "ControlRight") return "R CTRL";
  if (code === "AltLeft") return "L ALT";
  if (code === "AltRight") return "R ALT";
  return code.toUpperCase();
}

/** What an action's row reads: its keys, or the word for an action with
 * none. A binding page that showed an empty box for an unbound action would
 * read as a row that failed to draw. */
export function boundLabel(codes: readonly string[]): string {
  return codes.length === 0 ? STRINGS.keysUnbound : codes.map(keyLabel).join(" / ");
}

/** The OTHER actions a code is on. One key may serve two — nothing stops a
 * rider putting the brake and the reset on the same finger — but a key
 * quietly doing two jobs is the one thing a binding page must not hide, so
 * the row says so and the caption explains it. */
export function clashesWith(keys: KeyBindings, action: KeyAction): KeyAction[] {
  const mine = new Set(keys[action]);
  if (mine.size === 0) return [];
  return (Object.keys(keys) as KeyAction[]).filter(
    (other) => other !== action && keys[other].some((code) => mine.has(code)),
  );
}

/** One action rebound to one key. The whole list is replaced rather than
 * added to: a row that grew a key every time it was pressed would be a row
 * nobody could take a key OFF, and the defaults' pairs are the shipped
 * layout rather than something the page has to be able to rebuild. */
export function bindKey(keys: KeyBindings, action: KeyAction, code: string): KeyBindings {
  return { ...keys, [action]: [code] };
}

/** The shipped bindings as lists nothing else shares a reference with —
 * what a first visit loads and what RESET KEYS puts back. Handing out
 * `DEFAULT_KEYS`' own arrays would be handing the rider the defaults to
 * rebind. */
export function freshKeys(): KeyBindings {
  const keys = {} as KeyBindings;
  for (const [action, codes] of Object.entries(DEFAULT_KEYS) as [KeyAction, string[]][]) {
    keys[action] = [...codes];
  }
  return keys;
}

/** A stored blob's bindings, checked against the actions THIS build has.
 * Same rule every other stored value is held to (`mergeSettings`): an
 * action this build dropped is dropped, a code that is not a string is
 * dropped, and anything left over is the default — a keyboard the rider
 * cannot ride out of is not a setting worth honouring. */
export function mergeKeys(keys: KeyBindings, parsed: unknown): void {
  if (!parsed || typeof parsed !== "object") return;
  const blob = parsed as Partial<Record<KeyAction, unknown>>;
  for (const action of Object.keys(keys) as KeyAction[]) {
    const codes = blob[action];
    if (!Array.isArray(codes)) continue;
    const clean = codes.filter(
      (code): code is string => typeof code === "string" && code.length > 0,
    );
    keys[action] = [...new Set(clean)].slice(0, KEYS_PER_ACTION);
  }
}
