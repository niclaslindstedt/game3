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

import {
  createTapeRecorder,
  isControlTape,
  readTape,
  snapAxis,
  type ControlTape as Tape,
  type TapeSchema,
} from "@niclaslindstedt/oss-game-framework/racing/tape";
import { NEUTRAL_INPUT, isCraftId, type CraftId, type CraftInput, type GameMode } from "@engine";

/** THE TAPE'S LAYOUT: one stream per axis of a `CraftInput`, in the order
 * they are written into a stored tape — the keys ARE the stored field
 * names, so renaming or reordering one is a format change (`GHOST_FORMAT`).
 * Steering and lean are SIGNED (127 positions each side of centre); the
 * throttle, the brake and the tuck are LEVERS (255 positions: keys ask for 0
 * or 1 through a ramp and a thumb asks for anything in between, so the finer
 * grid is the one that costs nothing — a byte either way); the reset's edge
 * is a FLAG. The framework's tape (`racing/tape`) owns the grid, the byte
 * and the run-length codec; which axes this game has is this table. */
const SCHEMA = {
  steer: "signed",
  lean: "signed",
  throttle: "lever",
  reverse: "lever",
  crouch: "lever",
  flags: "flags",
} as const satisfies TapeSchema<string>;

type Stream = keyof typeof SCHEMA;

/** Bump when the tape's LAYOUT changes, or when what the engine DOES with
 * one changes: the same controls under a different hull, a different sea or
 * a different stroke gate put the craft over a different piece of water,
 * and a ghost replaying every jump at the wrong moment is worse than none.
 * A tape whose format this build does not know is dropped and rewritten by
 * the next run on that water. */
export const GHOST_FORMAT = 2;

/** THE BIGGEST TAPE WORTH KEEPING, characters of JSON. A six-minute tricks
 * run is 43 200 steps and a thumb that never settles costs two bytes a step
 * on every axis, so the worst case runs to most of a megabyte — and
 * `localStorage` is a few megabytes for the whole origin, shared with the
 * record book, the campaign's board and every setting. A tape over the cap
 * is dropped rather than risking the store: the run's figure is already
 * written down, and the next, tidier run on that water leaves a ghost. */
export const GHOST_CAP = 400_000;

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
  input.steer = snapAxis(input.steer, SCHEMA.steer);
  input.lean = snapAxis(input.lean, SCHEMA.lean);
  input.throttle = snapAxis(input.throttle, SCHEMA.throttle);
  input.reverse = snapAxis(input.reverse, SCHEMA.reverse);
  input.crouch = snapAxis(input.crouch, SCHEMA.crouch);
  return input;
}

/** ONE RUN'S CONTROLS AND NOTHING ELSE: how many steps it runs for, and one
 * RLE'd, base64'd byte per step per axis. Stated apart from the ghost it was
 * cut for because a REPLAY is the same tape (`replay.ts`) — the controls the
 * engine was handed — with the world it was handed them in written beside it
 * rather than the record it beat. One codec, two readers; a second copy of
 * the encoding would be a ghost and a replay that drift apart on the day an
 * axis is added. */
export type ControlTape = Tape<Stream>;

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

/** THE MODES A TAPE IS EVER KEPT FOR: the two ridden ALONE. A RACE has a
 * field to be measured against instead, and a FREE ride measures nothing at
 * all (`records.ts`'s `keepsRecords`) — and the rig refuses any run with
 * rivals on it besides, which is the same rule read off the state
 * (`ghost-run.ts`). Stated once, and read from both sides. */
export const GHOST_MODES = ["tricks", "timeTrial"] as const;

/** WHICH PIECE OF WATER A RUN IS ON — null on a run that keeps no tape.
 *
 * `level` is the PINNED shore the run is on (`new-game.ts`'s `pinnedFor`),
 * taken as the two fields a tape needs off it rather than as the whole
 * campaign row: a name for the water and a fingerprint for the shore under
 * it. Everything a tape has to agree on is in what comes back — the level
 * names the water and the day it is ridden under, the mode names what the
 * run is for, and `limit` is the LENGTH a tricks run was given, so two
 * lengths down one field are two scores and two tapes.
 *
 * The digest is READ off the level rather than hashed off the built shore:
 * a campaign row's is rewritten exactly when the shore under it is
 * deliberately moved, and `tests/generator_version_test.ts` rebuilds every
 * level and holds the two together — so the row IS the fingerprint, and a
 * rung that moves under a stored tape takes the tape's stage with it.
 *
 * WHICH MODES KEEP ONE is `GHOST_MODES` above, and this is the only place
 * it is asked. */
export function ghostStage(
  level: { id: string; digest: string } | null,
  mode: GameMode,
  limit: number,
): GhostStage | null {
  if (!level || !GHOST_MODES.some((kept) => kept === mode)) return null;
  return { id: `${mode}/${level.id}`, digest: level.digest, limit };
}

export type GhostRun = GhostStage &
  ControlTape & {
    format: number;
    /** The hull the figure was set on — the ghost rides its own, not yours. */
    craft: CraftId;
    /** The figure the run set, in the mode's own currency: seconds down a
     * course, points off a tricks field. */
    value: number;
  };

/** The reset's edge, bit 0 of the `flags` stream. */
const FLAG_RESET = 1;

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
  const tape = createTapeRecorder(SCHEMA);
  return {
    record: (input) =>
      tape.record({
        steer: input.steer,
        lean: input.lean,
        throttle: input.throttle,
        reverse: input.reverse,
        crouch: input.crouch,
        flags: input.reset ? FLAG_RESET : 0,
      }),
    steps: tape.steps,
    seal: tape.seal,
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
  const reader = readTape(tape, SCHEMA);
  const axes: Record<Stream, number> = {
    steer: 0,
    lean: 0,
    throttle: 0,
    reverse: 0,
    crouch: 0,
    flags: 0,
  };
  const input: CraftInput = { ...NEUTRAL_INPUT };
  return {
    steps: reader.steps,
    at: (step) => {
      if (!reader.at(step, axes)) return Object.assign(input, NEUTRAL_INPUT);
      input.steer = axes.steer;
      input.lean = axes.lean;
      input.throttle = axes.throttle;
      input.reverse = axes.reverse;
      input.crouch = axes.crouch;
      input.reset = (axes.flags & FLAG_RESET) !== 0;
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
  return isControlTape(parsed, SCHEMA);
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

/** DROP EVERY TAPE THIS BUILD CANNOT NAME. `live` is every stage a run
 * could still be keyed to; any other `sea-haven-ghost:` key is a tape for
 * water the game no longer has — a level off the ladder, or a key an older
 * build wrote under a scheme this one does not read. Left alone it is never
 * read and never overwritten, so it would sit for good in a store the
 * record book and the campaign's board share.
 *
 * Swept once, where the rig is built. A store that will not open is nothing
 * to handle: a stray tape is kilobytes, not a bug. */
export function forgetStrayGhosts(live: ReadonlySet<string>): void {
  try {
    const stray: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(GHOST_PREFIX) && !live.has(key.slice(GHOST_PREFIX.length))) {
        stray.push(key);
      }
    }
    // Collected before anything is removed: removing inside the walk moves
    // every key after it down an index, and the walk would skip one.
    for (const key of stray) localStorage.removeItem(key);
  } catch {
    /* storage unavailable — there is nothing to sweep */
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
