// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BED'S SCHEDULER — the half that reads the live `GameState` once a frame
// and steers every continuous voice the run has. What a voice IS lives in
// `engine-voice.ts` (the machinery) and `water-voice.ts` (the hull, the wind,
// the sea); this is the one place that turns a state into their targets, and
// the one place the CUES the simulation never reports are raised from: the
// slap of the bottom meeting a wave, read off the hull's own slam.
//
// NOTHING HERE IS BOOKED AHEAD. The layers run on the audio thread and
// every frame merely tells them where to go next, over a glide; a frame
// that arrives late — a garbage-collection pause, a phone throttling itself,
// a stall while the level is built — leaves every layer holding its last
// value. A bed that had to be fed on a cadence breathed with the frame rate
// and stuttered when it was starved, and a stutter is what a player reports
// as crackle.

import {
  TUNING,
  fieldGradient,
  jetVelocity,
  maxRpm,
  sampleField,
  seaShares,
  topSpeedOf,
  totalMass,
  windAt,
  type GameState,
} from "@engine";

import type { Synth } from "../../lib/voice.ts";
import { SCREEN_TO_ENGINE } from "../input-model.ts";

import { RUN_BANK } from "./bank.ts";
import {
  ENGINE_GLIDE,
  ENGINE_LAYERS,
  engineTargets,
  revOf,
  type EngineLayer,
} from "./engine-voice.ts";
import { listenerFor, type Listener } from "./listener.ts";
import { playSound } from "./play.ts";
import { createRack, type Rack } from "./rack.ts";
import { WATER_GLIDE, WATER_LAYERS, waterTargets, type WaterLayer } from "./water-voice.ts";

/** How quickly the smoothed signals follow, as time constants in seconds.
 * Written as taus rather than as per-frame fractions because a fraction is
 * only true at the frame rate it was tuned at — the same sea would swell
 * twice as fast on a 120 Hz display as on a phone at 40. */
const SEA_TAU = 0.6;
const WIND_TAU = 0.25;

/**
 * THE SLAP. The hull's slam, in g of the craft's own weight, past which the
 * bottom meeting a wave is a one-shot over the chop bed rather than part of
 * it, and the slam at which the slap is as loud as it gets (the physics caps
 * the slam at `TUNING.hull.slamCapG`, so that is the top of the scale). One
 * slap per `gap` seconds: a hull hammering through a short chop takes a hit
 * every few tenths, and past a handful a second the ear stops hearing slaps
 * and starts hearing a buzz.
 */
const SLAP = { from: 0.35, gap: 0.14 };

/** A landing is reported by the engine and sized by the router; the slam it
 * carries must not ALSO be read as a slap. This long after a landing the
 * slam is the landing's own. */
const LANDING_OWNS_S = 0.3;

/** A quarter of the bottom wet is a pump with water to draw on. */
const INTAKE_WETTED = 0.25;

/** One step of a one-pole filter on a time constant. */
function follow(previous: number, target: number, dt: number, tau: number): number {
  return previous + (target - previous) * (1 - Math.exp(-dt / tau));
}

/** The bed's own memory between frames. */
type BedState = {
  /** The sea under the hull, smoothed — a wave field read at one point
   * changes every step, and a bed whose level twitches with it flutters. */
  hs: number;
  /** The apparent wind, smoothed. */
  wind: number;
  /** Audio time of the last slap. */
  lastSlap: number;
};

/** The ride bed, for the whole life of one app. */
export type RideBed = {
  /**
   * Steer every layer and raise every due cue. Call once per rendered frame
   * with the live state and the frame's own elapsed time; it is cheap when
   * nothing changed and silent when the context is locked.
   *
   * `duck` scales the whole bed, 0..1: 1 with the player's hands on the
   * craft, less under a card the sea is only scenery behind.
   */
  update: (state: GameState, dt: number, duck?: number) => void;
  /** Which camera the run is being watched from — the mix follows it. */
  setView: (view: string) => void;
  /**
   * THE RUN IS STILL THERE BUT NOBODY IS HEARING IT — the pause card, a
   * hidden tab. Tear the layers down; the next `update` builds them again.
   *
   * Silencing has to be SAID. Nothing here is booked ahead, so a bed that is
   * merely stopped being fed holds its last target forever — which is an
   * engine note and a spray that carry on behind a card that froze the run.
   */
  silence: () => void;
  /** The run is over or the player left it: silence the beds and forget
   * everything the next run should not inherit. */
  reset: () => void;
  /** How many layers are standing — for the tests. */
  live: () => number;
};

export function createRideBed(synth: Synth): RideBed {
  const bed: BedState = { hs: 0, wind: 0, lastSlap: -Infinity };
  let listener: Listener = listenerFor("chase");
  const engine: Rack<EngineLayer> = createRack(synth, ENGINE_LAYERS, ENGINE_GLIDE);
  const water: Rack<WaterLayer> = createRack(synth, WATER_LAYERS, WATER_GLIDE);

  const hush = (): void => {
    engine.stop();
    water.stop();
  };

  return {
    update(state, dt, duck = 1) {
      const now = synth.now();
      if (now === null) {
        // Locked, suspended or muted to nothing. Nudge the context; the
        // racks rebuild whatever they need the moment it is back.
        synth.resume();
        return;
      }
      const c = state.craft;
      const spec = c.spec;
      const frame = Math.max(1 / 240, Math.min(0.1, dt));
      const capsized = c.capsizedFor > 0;
      const afloat = !c.airborne && !capsized;

      // ── The engine ─────────────────────────────────────────────────────
      // The revs exactly as the dial reads them, so the needle and the note
      // can never disagree. The LOAD is the throttle with water under the
      // pump: in the air the crank runs free and the engine hears it.
      const rev = revOf(c.rpm, spec.idleRpm, maxRpm(spec));
      const wet = afloat ? Math.min(1, c.wetted / INTAKE_WETTED) : 0;
      const jet = jetVelocity(spec, c.rpm);
      const slip = jet > 0.5 ? Math.min(1, Math.max(0, (jet - c.speed) / jet)) : 0;
      engine.apply(
        engineTargets(
          { rpm: c.rpm, rev, throttle: c.throttleEff, load: c.throttleEff * wet, wet, slip },
          {
            engine: listener.engine * duck,
            exhaust: listener.exhaust * duck,
            pump: listener.pump * duck,
            tone: listener.tone,
          },
        ),
      );

      // ── The water ──────────────────────────────────────────────────────
      // The sea under the hull is the two bands' heights by their shares at
      // this point — the same partition `surfaceAt` reads — smoothed, because
      // the point moves with the hull and the shares with it.
      const sea = state.sea;
      const shares = seaShares(sea, c.x, c.z);
      bed.hs = follow(
        bed.hs,
        shares.ocean * sea.hsRef + shares.local * sea.localHs,
        frame,
        SEA_TAU,
      );
      // The apparent wind: what the rider's head is actually moving through.
      const blow = windAt(state.wind, c.y, c.x, c.z);
      bed.wind = follow(bed.wind, Math.hypot(c.vx - blow.vx, c.vz - blow.vz), frame, WIND_TAU);
      // Where the shore is: the offshore field's gradient points out to sea,
      // so the shore is behind it, and its bearing off the heading is panned
      // through the one screen flip the input model owns.
      const shore = sampleField(state.level.offshore, c.x, c.z);
      const slope = fieldGradient(state.level.offshore, c.x, c.z);
      const toShore = Math.atan2(-slope.gx, -slope.gz);
      const shorePan = Math.sin(toShore - c.heading) * SCREEN_TO_ENGINE;
      water.apply(
        waterTargets(
          {
            speed: c.speed,
            pace: c.speed / topSpeedOf(spec),
            planing: c.planing,
            wetted: c.wetted,
            airborne: c.airborne,
            capsized,
            hs: bed.hs,
            wind: bed.wind,
            surf: sea.hsRef,
            shore,
            shorePan,
            tp: sea.tp,
            t: state.t,
          },
          {
            hull: listener.hull * duck,
            wind: listener.wind * duck,
            sea: listener.sea * duck,
          },
        ),
      );

      // ── The slap ───────────────────────────────────────────────────────
      // The bottom meeting a wave, off the hull's own slam — the wedge
      // impact the physics computed — as g of the craft's weight. A
      // landing's slam belongs to the landing the router already sized.
      const slamG = c.slam / (totalMass(spec) * TUNING.g);
      if (
        afloat &&
        slamG > SLAP.from &&
        c.landing > LANDING_OWNS_S &&
        now - bed.lastSlap > SLAP.gap
      ) {
        bed.lastSlap = now;
        const hard = Math.min(1, (slamG - SLAP.from) / (TUNING.hull.slamCapG - SLAP.from));
        playSound(synth, RUN_BANK, "slap", {
          gain: (0.45 + 0.9 * hard) * listener.events * duck,
          pitch: (1.12 - 0.3 * hard) * listener.muffle,
          stretch: 0.9 + 0.5 * hard,
        });
      }
    },

    setView(view) {
      listener = listenerFor(view);
    },

    silence: hush,

    reset() {
      hush();
      bed.hs = 0;
      bed.wind = 0;
      bed.lastSlap = -Infinity;
    },

    live: () => engine.live() + water.live(),
  };
}
