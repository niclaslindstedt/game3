// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE REPLAY — the run again, from the outside.
//
// A REPLAY IS A TAPE OF THE CONTROLS AND NOTHING ELSE (`ghost.ts`'s
// `ControlTape`). Not a recording of pixels, not a path the hull took: the
// controls the engine was handed, one step at a time, and the world it was
// handed them in. The engine is deterministic — a fixed step, no
// `Math.random`, every draw off the state's own seeded stream — so riding
// those controls through the same shore on the same hull gives the run back
// exactly: the same crest caught, the same flip, the same rival shouldered
// off the line, the same figure on the clock. That is why it costs a couple
// of hundred kilobytes rather than a couple of hundred megabytes, and why it
// can be watched from ANY camera — the broadcast included (`camera-tv.ts`) —
// instead of only from the one it was ridden in.
//
// IT IS THE GHOST'S TAPE WITH THE WORLD WRITTEN BESIDE IT, and the two are
// deliberately one codec: a ghost is your best run put back on the water
// beside you, a replay is any run put back on the water INSTEAD of you. What
// differs is what is kept next to the streams — a ghost keeps the figure it
// beat, a replay keeps how to rebuild the afternoon — and who watches.
//
// WHICH RUNS KEEP ONE: the three that are MEASURED (`keepsRecords` — a race,
// a tricks run, a time trial). A FREE ride keeps none for the same reason it
// keeps no record: its wind and its sea are the rider's own, so there is
// nothing about it anybody would want to see twice that they did not already
// see. The offer is made in the two places a run can be left — the pause
// card mid-ride, and the plate at the finish — and taking it mid-ride ENDS
// the run, which is said on the row rather than discovered afterwards.
//
// THE FIELD COMES WITH IT, which is the difference between this and the
// ghost. A ghost is stood up and then EMPTIED (`dropField`) because the two
// modes that keep one ride alone; a replay of a RACE is worth nothing without
// the eleven riders that made it one, and it costs nothing to keep them —
// they are ridden by the very bot that rode them, off the very stream, so
// they arrive at every buoy on the step they arrived on.
//
// WHAT NAMES THE AFTERNOON is held rather than serialised: the settings as
// they stood, the URL's say, the campaign rung, the hull, and the LEVEL
// OBJECT itself. Nothing here is written to disk — a replay lives as long as
// the tab does. The level is handed across rather than rebuilt for the reason
// `ghost-run.ts` hands it across: building one is the most expensive thing
// this engine does and that shore has been paid for already, so a replay
// stands up in the time it takes to deal a field.
//
// WHAT IS DELIBERATELY NOT HERE, because the file this replaced said it
// would be: A ROLL AND A PAGE TO CHOOSE FROM. A recording lives as long as
// the tab does and is offered in the two places a run can be left — the
// plate at the finish, and the pause card. Keeping them would mean a store
// (a tape is hundreds of kilobytes, so IndexedDB beside the pictures rather
// than `localStorage`), a cap, an eviction rule and a gallery, and it would
// make a replay the largest thing this game writes to a browser profile. The
// run's worth to the player is already written down in the record book and
// the campaign's board; what a replay is for is watching the run you have
// just ridden. The day that stops being true, `shot-roll.ts` / `shot-store.ts`
// is the shape to copy — a storage-free policy with the store under it.
//
// And the ENGINE-SIDE tape (`engine/sim/tape.ts`, still a placeholder), which
// is a different artifact for a different reader: a FILE a person or a script
// can open, to put the same driving in front of a different field twice. It
// would share this one's premise and none of its code.
//
// Everything this module needs from the app is handed in. The app owns the
// renderer, the settings and the surface; this reaches for none of them —
// the same shape `ghost-run.ts` and `app-load.ts` are built in.

import {
  levelDigest,
  warn,
  type CraftId,
  type CraftInput,
  type GameMode,
  type GameState,
  type Level,
} from "@engine";

import { campaignGame, type CampaignLevel } from "./campaign.ts";
import {
  createControlRecorder,
  readControls,
  type ControlRecorder,
  type GhostTape,
} from "./ghost.ts";
import { gameFor, pinnedFor, type LevelParams } from "./new-game.ts";
import { keepsRecords } from "./records.ts";
import {
  createShotCollector,
  directAt,
  type ShotCall,
  type ShotCollector,
  type ReplayShot,
} from "./replay-shots.ts";
import type { Settings } from "./settings.ts";

export type ReplayWorld = {
  /** The URL's say over what a run is, read for the same reason a run reads
   * it: a replay is stood up on the day the run was. */
  params: LevelParams;
  /** The settings as they stand at the moment a run is armed. Read ONCE, at
   * the arm, and held: every surface in this app replaces the whole settings
   * object rather than mutating one, so the reference taken here is the
   * afternoon's own row and cannot be moved under the recording by a card
   * opened while it plays. */
  settings: () => Settings;
};

/** WHAT A RECORDING IS WHILE IT IS BEING WATCHED. The app adopts `state` as
 * its own engine state and steps it off `input`; everything else is what the
 * bar over it prints and what the camera is told. */
export type Replay = {
  state: GameState;
  /** What the bar over it is billed as — the facts, worded by `strings.ts`. */
  bill: ReplayBill;
  /** The controls the step about to be taken was ridden on, and the
   * recording walked forward by one. The object is REUSED — the engine
   * spends an input inside the step it arrives in and never keeps it. */
  input: () => CraftInput;
  /** What the director has decided for the step now showing: which moment
   * holds the frame, and how fast the picture is running. */
  call: () => ShotCall;
  /** Whether the tape has run out. */
  over: () => boolean;
  /** How far through it is, 0..1 — the bar's own gauge. */
  through: () => number;
};

export type ReplayRig = {
  /** Arm a run: a fresh recorder and a fresh collector on any run that keeps
   * a recording, and the last one dropped. `forPlayer` is whether the run
   * being stood up is one the player is about to ride — a load says yes, the
   * attract sea behind a card says no. */
  arm: (state: GameState, campaign: CampaignLevel | null, forPlayer: boolean) => void;
  /** One step of the engine, AFTER it was taken: the controls it was handed
   * and the state it left behind. `state` is checked against the run this
   * rig was armed for, which is what makes a tape start at that run's very
   * FIRST step — the lights, and the handful of steps the loading card's own
   * frames take before anybody's hands are on it, included. Record from
   * where the player takes over instead and the recording is a few steps out
   * of phase with the rebuild, which a replay shows as a craft that flies a
   * different line off the first ramp. */
  step: (driven: CraftInput, state: GameState) => void;
  /** Whether there is anything worth offering to watch. */
  offers: () => boolean;
  /** Cut the recording where it stands and stand it up — null where there is
   * nothing to watch or the rebuild does not describe the same water. Safe
   * mid-run: the run behind it carries on being recorded, which is what lets
   * the pause card offer a replay of a race nobody has finished. */
  open: (value: number | null) => Replay | null;
  /** Drop the recording. */
  clear: () => void;
};

/** What the recording was cut on, held for as long as the tab is open. */
type Cut = {
  settings: Settings;
  campaign: CampaignLevel | null;
  level: Level;
  digest: string;
  craft: CraftId;
  /** The run this rig is recording, by identity — see `step`. */
  run: GameState;
};

export function createReplayRig(world: ReplayWorld): ReplayRig {
  let tape: ControlRecorder | null = null;
  let shots: ShotCollector | null = null;
  let cut: Cut | null = null;

  const clear = (): void => {
    tape = null;
    shots = null;
    cut = null;
  };

  return {
    clear,
    offers: () => tape !== null && tape.steps() > 0,
    arm: (state, campaign, forPlayer) => {
      clear();
      if (!forPlayer) return;
      const s = world.settings();
      // A DEVELOPER'S RUN IS NOT A RUN ON THIS SHORE — the same three rows
      // the record book and the ghost tape both refuse. A staged scene is
      // not ridden from the line at all, and a wind or a sea set by hand is
      // water the generator would never have dealt.
      if (s.dev.scene !== null || s.dev.wind !== null || s.dev.hs !== null) return;
      if (!keepsRecords(campaign ? campaign.mode : s.ride.mode)) return;
      // A RECORDING HAS TO START AT THE RUN'S FIRST STEP. The rebuild below
      // starts at t = 0 and the tape is played into it from ITS first step,
      // so a run already under way when it was armed would be replayed from
      // a moment it never had — the craft would be somewhere else by the
      // first buoy and the replay would look like a physics bug. The case
      // that reaches here is a link that pre-rolls a run before handing it
      // over (`?t=`, `App.tsx`'s `stand`), which is a lab's shot rather than
      // somebody's afternoon; it is refused rather than half-recorded.
      if (state.t > 0) return;
      tape = createControlRecorder();
      shots = createShotCollector();
      cut = {
        settings: s,
        campaign,
        level: state.level,
        digest: levelDigest(state.level),
        craft: state.craft.spec.id,
        run: state,
      };
    },
    step: (driven, state) => {
      if (!cut || state !== cut.run) return;
      tape?.record(driven);
      shots?.step(state, (tape?.steps() ?? 1) - 1);
    },
    open: (value) => {
      if (!tape || !shots || !cut || tape.steps() === 0) return null;
      const sealed = tape.seal();
      const plan = shots.plan();
      // THE SAME TWO BUILDERS THE RUN WAS STOOD UP BY, handed the same
      // arguments — never a third way of turning settings into a game, which
      // would be a replay free to drift from the run it is of. The hull is
      // the run's own rather than whatever the craft card is showing now.
      let rebuilt: GameState;
      try {
        rebuilt = cut.campaign
          ? campaignGame(cut.campaign, cut.craft, cut.level)
          : gameFor(cut.settings, world.params, { level: cut.level, craft: cut.craft });
      } catch (e) {
        // A REPLAY IS NEVER LOAD-BEARING. The run it is of has already been
        // ridden and already been booked, so a rebuild that will not build is
        // a press that does nothing rather than a page that goes white.
        warn(`the replay could not be stood up: ${e instanceof Error ? e.message : String(e)}`);
        return null;
      }
      // ...and the shore it came back with has to be the shore that was
      // ridden. It is the same `Level` object, so this can only fail if a
      // builder stopped honouring one — which is exactly the day a replay
      // would otherwise quietly play a different afternoon.
      if (levelDigest(rebuilt.level) !== cut.digest) return null;
      const controls = readControls(sealed);
      return createReplay(rebuilt, controls, plan, billing(cut, value));
    },
  };
}

/** WHAT THE BAR IS GIVEN: the facts, never the words. `strings.ts` turns
 * them into the two lines a watcher reads (§39.1 — nothing below the string
 * table names anything the player sees), which is the same DOM-free-payload
 * split every readout in this app is built on. */
export type ReplayBill = {
  mode: GameMode;
  craft: CraftId;
  /** The pinned shore's own name, or null on a shore that has none — which
   * is every shore a link named rather than the ladder. */
  name: string | null;
  seed: number;
  /** The run's figure in the mode's own currency, or null on a recording cut
   * out of a run nobody finished — which is what the pause card's offer
   * always is. */
  value: number | null;
};

function billing(cut: Cut, value: number | null): ReplayBill {
  const s = cut.settings;
  const pinned = cut.campaign ?? pinnedFor(s);
  return {
    mode: cut.campaign ? cut.campaign.mode : s.ride.mode,
    craft: cut.craft,
    name: pinned?.name ?? null,
    // THE SHORE'S OWN SEED, off the level that was ridden rather than off the
    // row that asked for it: the row is null on a fresh app and on every link
    // that named no seed, and the level still knows perfectly well which one
    // it was built from.
    seed: cut.level.seed,
    value,
  };
}

function createReplay(
  state: GameState,
  controls: GhostTape,
  plan: readonly ReplayShot[],
  bill: ReplayBill,
): Replay {
  let at = 0;
  return {
    state,
    bill,
    input: () => controls.at(at++),
    // The step SHOWING is the one just taken, which is the one before the
    // cursor: a director asked about the step that has not happened yet
    // would cut a frame early on every shot in the plan.
    call: () => directAt(plan, Math.max(0, at - 1)),
    over: () => at >= controls.steps,
    through: () => (controls.steps === 0 ? 1 : Math.min(1, at / controls.steps)),
  };
}
