// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GHOST — your best run on a piece of water, kept as the CONTROLS that
// rode it.
//
// The engine is deterministic: a fixed step (`TUNING.physicsHz`), no
// `Math.random`, every draw off the state's own seeded stream. So the same
// shore, the same hull and the same sequence of inputs put the craft over
// the same metre of water every time, and a ghost is a tape of what the
// rider's hands did rather than a path of where the hull ended up. A couple
// of hundred kilobytes for a whole run, and a craft that plants, flips and
// bails EXACTLY the way it did — because it is the same physics doing it
// rather than an interpolation between recorded poses.
//
// THE BARGAIN THAT BUYS IT IS ONE NUMBER PER AXIS. Every control is snapped
// onto a fixed grid at the one place the player's input is produced
// (`snapInput`, applied by `input-model.ts`'s `sampleInput`), so the figure
// the engine is driven on is the figure the tape writes down. Record
// anything the engine did not receive and the replay walks off the line a
// gate later — and at 1/127 of full lock the grid is finer than a thumb or
// a key ramp can resolve, so nothing about the riding changes.
//
// The OTHER half of the bargain is that step 0 means the same moment in
// both runs. A tape starts at the first step of the game, the lights
// included, and this game has no way to cut them short — so the two runs
// advance in lockstep from the beginning with nothing to write down about
// the opening.
//
// WHAT NAMES THE WATER is a `GhostStage`: the id the run is booked under
// (a campaign level, or a row of the record book), the DIGEST of the shore
// that was ridden (`levelDigest` — a generator moving under a pinned seed
// is exactly the case a matching id would miss), and the length a tricks
// run was given. All of it has to agree before a tape goes back on the
// water: a ghost riding a shore that is no longer there is worse than no
// ghost at all.
//
// Two halves, the way `records.ts` is split: everything above the storage
// line is PURE, so `tests/ghost_test.ts` holds it without a browser, and
// the three functions under it are the skin over `localStorage`. A ghost
// that cannot be kept is simply not kept — the record it was set on still
// stands, and a ghost is never load-bearing.

import { NEUTRAL_INPUT, isCraftId, type CraftId, type CraftInput } from "@engine";

import { clamp } from "../lib/util.ts";

/** Steering and lean positions each side of centre. Both axes are snapped
 * onto this grid where they are produced, which is what makes a step of the
 * tape one byte and a replay exact rather than merely close. */
const STEER_STEPS = 127;

/** The lever positions: the throttle, the brake and the tuck. Keys ask for
 * 0 or 1 through a ramp and a thumb asks for anything in between, so the
 * finer grid is the one that costs nothing — a byte either way. */
const LEVER_STEPS = 255;

/** Bump when the tape's LAYOUT changes, or when what the engine DOES with
 * one changes: the same controls under a different hull, a different sea or
 * a different stroke gate put the craft over a different piece of water,
 * and a ghost replaying every jump at the wrong moment is worse than none.
 * A tape whose format this build does not know is dropped and rewritten by
 * the next run on that water. */
export const GHOST_FORMAT = 1;

/** THE BIGGEST TAPE WORTH KEEPING, characters of JSON. A six-minute tricks
 * run is 43 200 steps and a thumb that never settles costs two bytes a step
 * on every axis, so the worst case runs to most of a megabyte — and
 * `localStorage` is a few megabytes for the whole origin, shared with the
 * record book, the campaign's board and every setting. A tape over the cap
 * is dropped rather than risking the store: the run's figure is already
 * written down, and the next, tidier run on that water leaves a ghost. */
export const GHOST_CAP = 400_000;

/** Snap an axis onto a recorded grid. Centre comes back as a POSITIVE
 * zero: rounding a hair below it yields -0, which the tape cannot write
 * down and which the physics would then carry a sign through. */
function snap(v: number, steps: number): number {
  const index = Math.round(v * steps);
  return index === 0 ? 0 : index / steps;
}

/** ONE STEP'S CONTROLS, ON THE GRID THE TAPE WRITES. Applied where the
 * player's input is produced AND again at the one place the engine is handed
 * an input at all (`App.tsx`'s `stepOnce`), so the engine and the recording
 * can never come to disagree whoever was riding. The second is what covers
 * the BOT and a scenario's script: a recorded run's first steps are the bot's
 * while the loading card is still up, and `run.ts` throws those away only for
 * as long as the lights are on. Applying it twice is free — a value already
 * on the grid snaps to itself — and the grid is finer than any decision any
 * of the three makes, so nothing about the riding moves. */
export function snapInput(input: CraftInput): CraftInput {
  input.steer = snap(clamp(input.steer, -1, 1), STEER_STEPS);
  input.lean = snap(clamp(input.lean, -1, 1), STEER_STEPS);
  input.throttle = snap(clamp(input.throttle, 0, 1), LEVER_STEPS);
  input.reverse = snap(clamp(input.reverse, 0, 1), LEVER_STEPS);
  input.crouch = snap(clamp(input.crouch, 0, 1), LEVER_STEPS);
  return input;
}

/** ONE RUN'S CONTROLS AND NOTHING ELSE: how many steps it runs for, and one
 * RLE'd, base64'd byte per step per axis. Stated apart from the ghost it was
 * cut for because a REPLAY is the same tape (`replay.ts`) — the controls the
 * engine was handed — with the world it was handed them in written beside it
 * rather than the record it beat. One codec, two readers; a second copy of
 * the encoding would be a ghost and a replay that drift apart on the day an
 * axis is added. */
export type ControlTape = {
  /** Steps on the tape: the whole run from the engine's first step, the
   * lights included, so two runs advance together. */
  steps: number;
  steer: string;
  lean: string;
  throttle: string;
  reverse: string;
  crouch: string;
  flags: string;
};

/** WHAT NAMES THE WATER a tape was cut on — see this file's header. */
export type GhostStage = {
  /** The row the run is booked under: a campaign level, or a record-book
   * key. Also the storage key the tape is kept at. */
  id: string;
  /** The shore's fingerprint (`levelDigest`). */
  digest: string;
  /** A timed run's length, s; 0 on a run that ends at a finish line. */
  limit: number;
};

export type GhostRun = GhostStage &
  ControlTape & {
    format: number;
    /** The hull the figure was set on — the ghost rides its own, not yours. */
    craft: CraftId;
    /** The figure the run set, in the mode's own currency: seconds down a
     * course, points off a tricks field. */
    value: number;
  };

const FLAG_RESET = 1;

/** `String.fromCharCode` takes its bytes as arguments, and a whole run's
 * worth at once overflows the call stack. */
const BASE64_CHUNK = 0x8000;

function toBase64(bytes: number[]): string {
  let raw = "";
  for (let i = 0; i < bytes.length; i += BASE64_CHUNK) {
    raw += String.fromCharCode(...bytes.slice(i, i + BASE64_CHUNK));
  }
  return btoa(raw);
}

function fromBase64(text: string): Uint8Array {
  const raw = atob(text);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** Run-length encode a byte per step, then base64 it. A control held still
 * is what makes a tape small — a throttle buried down a straight is two
 * bytes for 255 steps, and the reset flag is two bytes for a whole run. A
 * run of one value caps at 255 steps and simply continues in the next pair,
 * so the worst case is two bytes a step rather than a failure. */
export function encodeStream(values: readonly number[]): string {
  const out: number[] = [];
  let i = 0;
  while (i < values.length) {
    const value = values[i];
    let run = 1;
    while (run < 255 && i + run < values.length && values[i + run] === value) run++;
    out.push(run, value);
    i += run;
  }
  return toBase64(out);
}

/** Decode `steps` bytes back out. A short or damaged tape leaves its tail
 * at zero rather than throwing — including one `atob` refuses outright: a
 * ghost is a picture, and half a picture beats a crash on the first frame of
 * a run somebody is about to ride. */
export function decodeStream(text: string, steps: number): Uint8Array {
  const out = new Uint8Array(steps);
  let bytes: Uint8Array;
  try {
    bytes = fromBase64(text);
  } catch {
    return out;
  }
  let at = 0;
  for (let i = 0; i + 1 < bytes.length && at < steps; i += 2) {
    const run = Math.min(bytes[i], steps - at);
    out.fill(bytes[i + 1], at, at + run);
    at += run;
  }
  return out;
}

export type ControlRecorder = {
  /** Write down the controls a step was ridden on. Called with the input
   * the engine ACTUALLY received, never the one that produced it. */
  record: (input: CraftInput) => void;
  steps: () => number;
  /** The tape as it stands. Callable mid-run and callable twice: a replay
   * of a run somebody stopped half way down is sealed where they stopped
   * (`replay.ts`), and the run behind it carries on being recorded. */
  seal: () => ControlTape;
};

export function createControlRecorder(): ControlRecorder {
  const steer: number[] = [];
  const lean: number[] = [];
  const throttle: number[] = [];
  const reverse: number[] = [];
  const crouch: number[] = [];
  const flags: number[] = [];
  return {
    record: (input) => {
      steer.push(Math.round(clamp(input.steer, -1, 1) * STEER_STEPS) + STEER_STEPS);
      lean.push(Math.round(clamp(input.lean, -1, 1) * STEER_STEPS) + STEER_STEPS);
      throttle.push(Math.round(clamp(input.throttle, 0, 1) * LEVER_STEPS));
      reverse.push(Math.round(clamp(input.reverse, 0, 1) * LEVER_STEPS));
      crouch.push(Math.round(clamp(input.crouch, 0, 1) * LEVER_STEPS));
      flags.push(input.reset ? FLAG_RESET : 0);
    },
    steps: () => steer.length,
    seal: () => ({
      steps: steer.length,
      steer: encodeStream(steer),
      lean: encodeStream(lean),
      throttle: encodeStream(throttle),
      reverse: encodeStream(reverse),
      crouch: encodeStream(crouch),
      flags: encodeStream(flags),
    }),
  };
}

export type GhostRecorder = ControlRecorder & {
  /** Seal the tape into a run worth keeping. */
  sealGhost: (stage: GhostStage, craft: CraftId, value: number) => GhostRun;
};

export function createGhostRecorder(): GhostRecorder {
  const tape = createControlRecorder();
  return {
    ...tape,
    sealGhost: (stage, craft, value) => ({
      ...stage,
      format: GHOST_FORMAT,
      craft,
      value,
      ...tape.seal(),
    }),
  };
}

export type GhostTape = {
  steps: number;
  /** The controls step `i` was ridden on — neutral once the tape runs out,
   * which is the ghost sitting where its run ended. The object is REUSED:
   * the engine spends an input inside the step it arrives in and never
   * keeps it. */
  at: (step: number) => CraftInput;
};

/** Put a tape back on the water. Reads a `ControlTape`, so a ghost and a
 * replay are driven by the very same reader. */
export function readControls(tape: ControlTape): GhostTape {
  const steps = tape.steps;
  const steer = decodeStream(tape.steer, steps);
  const lean = decodeStream(tape.lean, steps);
  const throttle = decodeStream(tape.throttle, steps);
  const reverse = decodeStream(tape.reverse, steps);
  const crouch = decodeStream(tape.crouch, steps);
  const flags = decodeStream(tape.flags, steps);
  const input: CraftInput = { ...NEUTRAL_INPUT };
  return {
    steps,
    at: (step) => {
      if (step < 0 || step >= steps) return Object.assign(input, NEUTRAL_INPUT);
      input.steer = (steer[step] - STEER_STEPS) / STEER_STEPS;
      input.lean = (lean[step] - STEER_STEPS) / STEER_STEPS;
      input.throttle = throttle[step] / LEVER_STEPS;
      input.reverse = reverse[step] / LEVER_STEPS;
      input.crouch = crouch[step] / LEVER_STEPS;
      input.reset = (flags[step] & FLAG_RESET) !== 0;
      return input;
    },
  };
}

/** Whether a stored run still describes the water about to be ridden. */
export function ghostMatches(run: GhostRun, stage: GhostStage): boolean {
  return (
    run.format === GHOST_FORMAT &&
    run.id === stage.id &&
    run.digest === stage.digest &&
    run.limit === stage.limit
  );
}

/** Whether a stored blob is a tape this build can put back on the water.
 * The same rule `mergeRecords` applies, for the same reason: anything that
 * is not a run somebody could have ridden is dropped rather than trusted. */
export function readsAsGhost(parsed: unknown): parsed is GhostRun {
  if (typeof parsed !== "object" || parsed === null) return false;
  const run = parsed as Partial<GhostRun>;
  if (run.format !== GHOST_FORMAT) return false;
  if (typeof run.id !== "string" || typeof run.digest !== "string") return false;
  if (typeof run.craft !== "string" || !isCraftId(run.craft)) return false;
  if (typeof run.limit !== "number" || !Number.isFinite(run.limit)) return false;
  if (typeof run.value !== "number" || !Number.isFinite(run.value)) return false;
  if (!Number.isInteger(run.steps) || (run.steps as number) <= 0) return false;
  return (["steer", "lean", "throttle", "reverse", "crouch", "flags"] as const).every(
    (key) => typeof run[key] === "string",
  );
}

/* ── STORAGE ──────────────────────────────────────────────────────────── */

/** ONE KEY PER STAGE. Reading the ghost for the water about to be ridden
 * must not mean parsing every tape this machine has ever kept. */
const GHOST_PREFIX = "sea-haven-ghost:";

export function loadGhost(stage: GhostStage): GhostRun | null {
  try {
    const stored = localStorage.getItem(GHOST_PREFIX + stage.id);
    if (stored === null) return null;
    const parsed: unknown = JSON.parse(stored);
    if (!readsAsGhost(parsed) || !ghostMatches(parsed, stage)) return null;
    return parsed;
  } catch {
    /* storage unavailable, or not JSON — there is simply no ghost */
    return null;
  }
}

export function saveGhost(run: GhostRun): void {
  try {
    const text = JSON.stringify(run);
    if (text.length > GHOST_CAP) return;
    localStorage.setItem(GHOST_PREFIX + run.id, text);
  } catch {
    /* storage unavailable or full — the figure is still in the book */
  }
}
