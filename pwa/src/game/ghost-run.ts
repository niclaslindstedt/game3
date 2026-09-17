// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GHOST ON THE WATER — the rig the app drives, beside the tape it reads
// and writes (`ghost.ts`).
//
// WHICH RUNS HAVE ONE, and why only those. A ghost is somebody to ride
// against where there is nobody else out there, so it belongs to the two
// modes whose whole ask is a figure set alone:
//
//   TRICKS      the best score on this field, riding it again. On a
//               CAMPAIGN tricks level that is your best afternoon on that
//               pinned shore — the run the medal was won on.
//   TIME TRIAL  the quickest lap you have ridden down this shore.
//
// A RACE already has eleven riders on the water to be measured against, and
// a FREE ride measures nothing at all (`records.ts`'s `keepsRecords`: its
// wind and its sea are the rider's own, so two runs down it are not two runs
// down the same shore). Neither keeps a tape.
//
// WHAT THE GHOST IS is one more `GameState` over the SAME `Level` object,
// stepped from the tape a step at a time beside the player's own. Not a
// rival: nothing steers it, nothing may touch it, it takes no gate and it
// scores nothing — `rivals.ts` is for riders who are racing, and this is a
// picture of a run that already happened.
//
// IT IS BUILT THE WAY THE RUN WAS BUILT, field and all, and then has the
// field taken off it (`dropField`). That is not a detail: the grid deals a
// weight and a pace off the run's own stream for every rival, so a ghost
// built with `rivals: 0` would have its wind gusting off a stream twenty-two
// draws further along and would ride different water from its first step.
// Built the same way and emptied, it costs ONE hull of physics and rides the
// very sea the recording was cut on.
//
// WHAT THE TAPE IS WORTH KEEPING FOR is decided at the finish: the run that
// BEAT the figure on file, or any run at all where there is no readable tape
// for this water. The second half matters — a machine carrying a record from
// a build whose tapes this one no longer reads would otherwise sit there with
// a figure and nothing to race until the figure itself fell.
//
// Everything this module needs from the app is handed in: the app owns the
// renderer, the settings and the surface the rider is on, and this reaches
// for none of them on its own. The same shape `app-load.ts` is built in.

import {
  dropField,
  levelDigest,
  step,
  type CraftId,
  type CraftInput,
  type GameState,
} from "@engine";

import { campaignGame, type CampaignLevel } from "./campaign.ts";
import {
  createGhostRecorder,
  loadGhost,
  readGhost,
  saveGhost,
  type GhostRecorder,
  type GhostStage,
  type GhostTape,
} from "./ghost.ts";
import { gameFor, type LevelParams } from "./new-game.ts";
import { recordId, scoresHigher } from "./records.ts";
import type { GameRenderer } from "./renderer.ts";
import { recordKeyFor } from "./new-game.ts";
import type { Settings } from "./settings.ts";

export type GhostWorld = {
  renderer: GameRenderer;
  /** The URL's say over what a run is (`new-game.ts`) — read for the same
   * reason a run reads it, so the ghost is stood up on the day the run is. */
  params: LevelParams;
  /** The settings as they stand at the moment a run is stood up. */
  settings: () => Settings;
  /** Whether the player's hands are on the craft right now. A run carrying
   * on under the front door is the bot's, and a tape of the bot's afternoon
   * is not a ghost of anybody. */
  rides: () => boolean;
};

export type GhostRig = {
  /** Arm a run: a fresh recorder on any run that keeps a tape, and the best
   * one on this water put back out there. Takes the last one off first, so
   * this is also how a run without a ghost says so. `forPlayer` is whether
   * the run being stood up is one the player is about to ride — a load says
   * yes, and the attract sea behind a card says no. */
  arm: (state: GameState, campaign: CampaignLevel | null, forPlayer: boolean) => void;
  /** One step of the engine: the controls written down, and the ghost's own
   * run advanced by one step of its tape. Called with the input the engine
   * ACTUALLY received. */
  step: (driven: CraftInput) => void;
  /** The run is over on `value`, in the mode's own currency. */
  seal: (value: number) => void;
  /** Take the ghost off the water and drop the tape being written. */
  clear: () => void;
  /** The ghost's own run, for the HUD's gap — null where there is none. */
  state: () => GameState | null;
};

/** WHICH PIECE OF WATER a run is booked under, which is also the key its
 * tape is kept at. A campaign level is its own id — the seed, the day and
 * the mode are all pinned to it. Anything else is the row of the record book
 * the figure will go in (`records.ts` — the coast, the seed, the track, the
 * class, the mode and a tricks run's length), plus whatever day a LINK
 * named, since outside a free ride that is the only thing that can move the
 * sky off the shore's own (`new-game.ts`'s `dayFor`). */
function stageId(s: Settings, params: LevelParams, campaign: CampaignLevel | null): string {
  if (campaign) return `c/${campaign.id}`;
  const id = `b/${recordId(recordKeyFor(s, params.track))}`;
  const day = [params.time, params.season, params.weather, params.day, params.waves]
    .map((v) => v ?? "")
    .join(",");
  return /^,*$/.test(day) ? id : `${id}/${day}`;
}

export function createGhostRig(world: GhostWorld): GhostRig {
  /** The tape being written this run, and what names the water it is being
   * written on. Both null on a run that keeps none. */
  let recorder: GhostRecorder | null = null;
  let stage: GhostStage | null = null;
  /** The hull this run is being ridden on, for the tape's header. */
  let mine: CraftId | null = null;
  /** Whether this mode's figure is better HIGHER, and the figure on file to
   * beat — null where there is no readable tape for this water, which is
   * what makes the next run worth keeping whatever it scores. */
  let higher = false;
  let best: number | null = null;
  /** The ghost itself: its run, its tape, and how far along it is. */
  let ghost: GameState | null = null;
  let tape: GhostTape | null = null;
  let at = 0;

  const clear = (): void => {
    recorder = null;
    stage = null;
    mine = null;
    best = null;
    ghost = null;
    tape = null;
    at = 0;
    world.renderer.setGhost(null);
  };

  const arm = (state: GameState, campaign: CampaignLevel | null, forPlayer: boolean): void => {
    clear();
    if (!forPlayer) return;
    const s = world.settings();
    // A DEVELOPER'S RUN IS NOT A RUN ON THIS SHORE — the same three rows
    // `App.tsx` refuses to write a record off. A staged scene is not ridden
    // from the line at all, and a wind or a sea set by hand is water the
    // generator would never have dealt.
    if (s.dev.scene !== null || s.dev.wind !== null || s.dev.hs !== null) return;
    const mode = campaign ? campaign.mode : s.ride.mode;
    if (mode !== "tricks" && mode !== "timeTrial") return;
    stage = {
      id: stageId(s, world.params, campaign),
      // The shore's own fingerprint. A generator that moved under a pinned
      // seed is exactly the case a matching id would sail straight past, and
      // a ghost riding a shore that is no longer there is worse than none.
      digest: levelDigest(state.level),
      limit: state.rules.limit,
    };
    mine = state.craft.spec.id;
    higher = scoresHigher(mode);
    recorder = createGhostRecorder();
    const saved = loadGhost(stage);
    if (!saved) return;
    best = saved.value;
    // The recording's OWN hull, over the run's own shore — the level object
    // is handed across rather than rebuilt, because the run beside it has
    // paid for that already. Then the field comes off: see the header.
    const run = campaign
      ? campaignGame(campaign, saved.craft, state.level)
      : gameFor(s, world.params, { level: state.level, craft: saved.craft });
    dropField(run);
    ghost = run;
    tape = readGhost(saved);
    at = 0;
    world.renderer.setGhost(run);
  };

  return {
    arm,
    clear,
    state: () => ghost,
    step: (driven) => {
      if (!world.rides()) return;
      recorder?.record(driven);
      // …and the ghost walks forward with the engine it is riding beside:
      // one step of the tape per step of the physics, which is the whole of
      // why it ends up in the same places.
      if (ghost && tape) step(ghost, tape.at(at++));
    },
    seal: (value) => {
      const written = recorder;
      recorder = null;
      if (!written || !stage || mine === null) return;
      if (!Number.isFinite(value) || value <= 0) return;
      if (best !== null && !(higher ? value > best : value < best)) return;
      saveGhost(written.seal(stage, mine, value));
      best = value;
    },
  };
}
