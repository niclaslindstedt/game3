// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GHOST ON THE WATER — the rig the app drives, beside the tape it reads
// and writes (`ghost.ts`).
//
// WHICH RUNS HAVE ONE, and why only those. A ghost is somebody to ride
// against where there is nobody else out there, so it belongs to the two
// modes whose whole ask is a figure set alone:
//
//   TRICKS      the best score you have put together on this field.
//   TIME TRIAL  the quickest lap you have ridden down this shore.
//
// A RACE already has eleven riders on the water to be measured against, and
// a FREE ride measures nothing at all (`records.ts`'s `keepsRecords`: its
// seed, its wind and its sea are the rider's own, so two runs down it are
// not two runs down the same shore). Neither keeps a tape.
//
// EVERY RUN WITH A GHOST IS ON A PINNED SHORE. The three measured modes ride
// the campaign's pinned levels rather than a seed anybody dials
// (`new-game.ts`'s `pinnedFor`, `menu-levels.tsx`), so a ghost never has to
// ask what water a run is on: it is one of the pinned levels, under that level's
// own day, and a tape is keyed by the LEVEL. Which is the whole reason the
// feature is worth having — two runs down one rung are two runs down the
// same water by construction.
//
// A GHOST RIDES WATER NOBODY ELSE IS ON, and that is now one rule rather
// than three. A RACE has a field; so does a CAMPAIGN rung, which puts the
// race's grid on every shore it rides (`campaignGame`). Neither keeps a
// tape, and the reason is the same either way: a rival's WASH is real water
// (`engine/game/wash.ts` — every trail is on the sea and the hull's probes
// read all of them), so a run with eleven hulls laying wake around it cannot
// be ridden again without eleven hulls laying the same wake, and a ghost
// that had to step a whole field beside the player's would cost twice the
// physics to draw one see-through hull among twelve. So the rig asks the
// state: a run with rivals on it keeps nothing.
//
// The size of it, measured on a campaign tricks rung rather than argued:
// take the field off a recorded run and ride its tape again, and the hull is
// 4 m off the line it rode after ten seconds, 140 m after twenty, and most
// of a kilometre by the buzzer. Lifting the field's trails off the sea with
// the field (`dropField`) keeps the ghost from feeling wakes nobody is
// laying any more; it cannot hand back the eleven wakes the RECORDING was
// ridden through, and that is the half that matters here.
//
// WHAT A FIELDED RUN GETS INSTEAD is the REPLAY (`replay.ts`), which keeps
// its field and rebuilds it — the rivals are the bot off the same seeded
// stream, so they arrive at every buoy on the step they arrived on. It can
// afford that because it is watched INSTEAD of a run rather than beside
// one: nobody is riding, so the physics a ghost would have to double is the
// only physics there is.
//
// WHAT THE GHOST IS is one more `GameState` over the SAME `Level` object,
// stepped from the tape a step at a time beside the player's own. Not a
// rival: nothing steers it, nothing may touch it, it takes no gate and it
// scores nothing — `rivals.ts` is for riders who are racing, and this is a
// picture of a run that already happened. It carries its OWN sea, so the
// wash it lays is in its own water and never lifts the player's hull: a
// picture may not move the thing it is a picture of.
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

import { step, type CraftId, type CraftInput, type GameState } from "@engine";

import { CAMPAIGN_LEVELS, fitsMode, pinnedGame } from "./campaign.ts";
import {
  GHOST_MODES,
  createGhostRecorder,
  forgetStrayGhosts,
  ghostStage,
  loadGhost,
  readControls,
  saveGhost,
  type GhostRecorder,
  type GhostStage,
  type GhostTape,
} from "./ghost.ts";
import { pinnedFor } from "./new-game.ts";
import { scoresHigher } from "./records.ts";
import type { GameRenderer } from "./renderer.ts";
import type { Settings } from "./settings.ts";

export type GhostWorld = {
  renderer: GameRenderer;
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
  arm: (state: GameState, forPlayer: boolean) => void;
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

/** EVERY STAGE A RUN ON THIS BUILD COULD BE KEYED TO: every pinned
 * levels, each in the modes its own discipline lets it ride (`fitsMode`).
 * What the store holds outside this set is a tape for water the game no
 * longer has, and the rig sweeps it on the way up. */
function liveStages(): Set<string> {
  const live = new Set<string>();
  for (const level of CAMPAIGN_LEVELS) {
    for (const mode of GHOST_MODES) {
      const stage = fitsMode(level, mode) ? ghostStage(level, mode, 0) : null;
      if (stage) live.add(stage.id);
    }
  }
  return live;
}

export function createGhostRig(world: GhostWorld): GhostRig {
  // Once, on the way up: the store is made to say what this build says.
  forgetStrayGhosts(liveStages());

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

  const arm = (state: GameState, forPlayer: boolean): void => {
    clear();
    if (!forPlayer) return;
    const s = world.settings();
    // A DEVELOPER'S RUN IS NOT A RUN ON THIS SHORE — the same three rows
    // `App.tsx` refuses to write a record off. A staged scene is not ridden
    // from the line at all, and a wind or a sea set by hand is water the
    // generator would never have dealt.
    if (s.dev.scene !== null || s.dev.wind !== null || s.dev.hs !== null) return;
    // …and NOBODY ELSE ON THE WATER, asked of the state rather than of the
    // mode, so a race and a campaign rung are refused by the one rule that
    // explains both (see the header).
    if (state.rivals.length > 0) return;
    const level = pinnedFor(s);
    stage = ghostStage(level, s.ride.mode, state.rules.limit);
    if (!level || !stage) return;
    mine = state.craft.spec.id;
    higher = scoresHigher(s.ride.mode);
    recorder = createGhostRecorder();
    const saved = loadGhost(stage);
    if (!saved) return;
    best = saved.value;
    // The recording's OWN hull, stood up the way the run beside it was — and
    // handed that run's LEVEL rather than rebuilding it, because building one
    // is the most expensive thing this engine does and the shore is paid for.
    ghost = pinnedGame(level, s.ride.mode, saved.craft, {
      limit: state.rules.limit,
      built: state.level,
    });
    tape = readControls(saved);
    at = 0;
    world.renderer.setGhost(ghost);
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
      saveGhost(written.sealGhost(stage, mine, value));
      best = value;
    },
  };
}
