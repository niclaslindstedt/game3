// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RECORDING ON THE WATER — the rig the app drives, beside the tape it
// cuts and reads (`replay.ts`).
//
// The split is `ghost.ts` / `ghost-run.ts`'s, for the same reason: one module
// says what a recording IS and the other says when the app arms one, stands
// one up and takes it down. Everything this one needs from the app is handed
// in — the renderer, the settings, the surface and the one call that makes a
// rebuilt run the app's own — and it reaches for none of it on its own.
//
// WHAT HAPPENS WHEN A RECORDING IS STOOD UP, in order, because the order is
// the whole of it:
//
//   The tape is CUT where the run stands — never sealed, so a race nobody
//   finished is as watchable as one that was. The run is rebuilt from what
//   was written down beside the tape. The app ADOPTS it: from that step on
//   the engine state the loop holds is the recording's, the input it is
//   stepped on comes off the tape rather than off a thumb, and the run that
//   was being ridden is over — which is exactly what it would have been had
//   the player gone to the front door instead.
//
//   Then the camera is handed the WATCHING ladder and opened on the
//   broadcast. That is the one place `camera-tv.ts` can be reached, and
//   giving it back is the one thing this rig must not forget: a play ladder
//   left with a rung nobody may ride on it is a camera key that walks a rider
//   into a shot of himself arriving.
//
// AND ON EVERY FRAME AFTER, one question is asked of the director and two
// answers come back (`replay-shots.ts`): which moment has the frame, which
// the camera is told, and how fast the picture is running, which the app's
// own accumulator is told. SLOW MOTION IS FEWER STEPS PER FRAME and nothing
// else — the engine's step never changes size, so a third-speed backflip is
// the same physics at a third the rate rather than a different physics, every
// wave and every sound included.

import type { CraftInput, GameState } from "@engine";

import { CAMERA_MODES, WATCHING_MODES } from "./camera.ts";
import type { CampaignLevel } from "./campaign.ts";
import type { ReplayBarProps } from "./hud-replay.tsx";
import type { LevelParams } from "./new-game.ts";
import { createReplayRig, type Replay } from "./replay.ts";
import type { GameRenderer } from "./renderer.ts";
import type { Settings } from "./settings.ts";
import { hudOver, watching, type Shell } from "./shell.ts";

export type ReplayRunWorld = {
  renderer: GameRenderer;
  /** The URL's say over what a run is (`new-game.ts`), read for the same
   * reason a run reads it: a recording is stood up on the day the run was. */
  params: LevelParams;
  settings: () => Settings;
  /** Make a rebuilt run the app's own engine state. The app owns the loop
   * and everything hung off it, so this is its call and not this rig's. */
  adopt: (state: GameState) => void;
  shell: () => Shell;
};

export type ReplayRun = {
  /** Arm a run: a recorder on any run that keeps one, the last one dropped.
   * `forPlayer` is whether the run being stood up is one the player is about
   * to ride — a load says yes, the attract sea behind a card says no. */
  arm: (state: GameState, campaign: CampaignLevel | null, forPlayer: boolean) => void;
  /** One step of the engine, AFTER it was taken. The state is handed over
   * with the controls so the tape can start at the run's OWN first step —
   * `replay.ts` says why that matters. */
  step: (driven: CraftInput, state: GameState) => void;
  /** The run reached the line or the buzzer on `value`, which is what the
   * bar over a recording of it bills. Ignored once one is being watched: a
   * recording finishing again is the same finish, an hour later. */
  finished: (value: number) => void;
  /** The controls this step is ridden on, or null where nobody is watching
   * and the run belongs to whoever the app says it does. */
  input: () => CraftInput | null;
  /** Once a frame, BEFORE anything is stepped: the camera is told which
   * moment holds the frame, and the app is told how fast the picture runs
   * (1 everywhere but inside a shot's slow motion). */
  frame: () => number;
  /** Whether the recording has run out — the app's cue to leave. */
  over: () => boolean;
  /** Whether there is a recording worth OFFERING, on a surface that may
   * offer one: over a run, and over the card that holds one. */
  offers: () => boolean;
  /** Stand the recording up. False where there is nothing to watch or the
   * rebuild does not describe the same water, which is a press that does
   * nothing rather than a surface with no run under it. */
  watch: () => boolean;
  /** Take it off the water and hand the camera back. Safe to call when
   * nothing is being watched, which is every ordinary way out of a run. */
  clear: () => void;
  /** What the bar over it draws, bar the way out — which is the app's,
   * because leaving a recording is leaving a run and only the app knows
   * where that goes. Null where nothing is being watched. */
  bar: () => Omit<ReplayBarProps, "onLeave"> | null;
};

export function createReplayRun(world: ReplayRunWorld): ReplayRun {
  const rig = createReplayRig({ params: world.params, settings: world.settings });
  /** The recording being watched, or null over a run somebody is riding. */
  let watched: Replay | null = null;
  /** The figure the run finished on, for the bar. Null until the line or the
   * buzzer — which is what every recording cut off the pause card is. */
  let finishedOn: number | null = null;
  /** How fast the last frame ran, so the bar can say when it is running slow
   * without asking the director a second time. */
  let rate = 1;

  return {
    arm: (state, campaign, forPlayer) => {
      rig.arm(state, campaign, forPlayer);
      finishedOn = null;
    },
    step: (driven, state) => rig.step(driven, state),
    finished: (value) => {
      if (!watched) finishedOn = value;
    },
    input: () => watched?.input() ?? null,
    over: () => watched?.over() ?? false,
    offers: () => rig.offers() && hudOver(world.shell()) && !watching(world.shell()),
    frame: () => {
      const call = watched?.call() ?? null;
      world.renderer.camera.setShot(call?.shot ?? null);
      rate = call?.rate ?? 1;
      return rate;
    },
    bar: () => watched && { bill: watched.bill, through: watched.through(), slow: rate < 1 },
    watch: () => {
      const cut = rig.open(finishedOn);
      if (!cut) return false;
      watched = cut;
      world.adopt(cut.state);
      world.renderer.load(cut.state);
      world.renderer.camera.setLadder(WATCHING_MODES);
      world.renderer.camera.setMode("tv");
      world.renderer.camera.restand();
      return true;
    },
    clear: () => {
      const was = watched !== null;
      watched = null;
      rate = 1;
      rig.clear();
      // THE LADDER GOES BACK whether or not one was being watched. It is
      // cheap and it is the one thing that must never be missed: a play
      // ladder still carrying the broadcast is a camera key that walks a
      // rider into a camera nobody may ride from.
      world.renderer.camera.setLadder(CAMERA_MODES);
      world.renderer.camera.setShot(null);
      // The RUNG only goes back when one was actually being watched, because
      // the camera key walks the ladder without writing the setting: a rider
      // who left a run on `heli` must find the sea behind the front door on
      // `heli` and not on whatever OPTIONS last said.
      if (was) world.renderer.camera.setMode(world.settings().ride.camera);
    },
  };
}
