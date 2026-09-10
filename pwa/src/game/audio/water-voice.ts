// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WATER, AS LAYERS THAT NEVER STOP — the hull in it, the wind over it,
// and the sea that was making a noise before the craft arrived.
//
// Knowing nothing about `GameState`, for two reasons that turned out to be
// the same reason: it is the half worth auditioning on its own (`make
// audition` drives it from sliders, which is the only honest way to judge a
// continuous sound), and it is the half worth testing.
//
//   WASH    the hull pushing water aside at DISPLACEMENT speeds — the low
//           rush along the sides before the bottom lifts onto the plane
//   SPRAY   the sheets off both chines once it has: a pink hiss that is the
//           game's whole sense of speed, and gone the instant the hull is
//           in the air
//   CHOP    the texture of the bottom crossing a short sea — a mid-band
//           slapping that grows with the wave height and the pace (the
//           individual slaps are one-shots the bed raises off the slam)
//   WIND    the air going past the rider's ears, on the SQUARE of the
//           apparent wind, and the only layer here that keeps going in
//           the air — the silence where the water was is what a jump
//           sounds like
//   SEA     the swell itself, a low breathing rumble that is nothing in a
//           flat calm and most of the world in a storm
//   SURF    the break on the shore, a brown swell heard from the water by
//           how near the beach is and breathing on the sea's own period
//   FOAM    the same break's top end — the wash running up the sand a
//           moment after each set, banded and quiet
//
// WATER HAS NO TRANSIENT. Nothing in here clicks: every layer is a coloured
// noise through a filter whose cutoff moves, and the two shore layers move
// their LEVEL on a period rather than their pitch. A sea that ticks is a
// sea from a different game.

import type { LayerSpec, LayerTarget } from "../../lib/voice.ts";

/** The speed at which a hull stops pushing water and starts riding over it,
 * m/s — the hump. Below it the wash is the sound; above it the spray is. */
const HUMP_SPEED = 6;

/** The apparent wind at which the wind layer is as loud as it gets, m/s:
 * the fastest craft flat out into a strong breeze. */
export const WIND_FULL = 34;

/** The significant height at which the swell's own rumble is as loud as it
 * gets, m — R12's storm sea. */
const SEA_FULL = 3;

/** How far from the shore the break is heard at all, m, and the ocean Hs
 * at which it is as loud as it gets. Past the reach the surf is under the
 * craft's own noise for anyone riding; inside it the break is the loudest
 * thing on a still day. */
export const SURF_REACH = 260;
const SURF_FULL = 2.2;

/** How much of the surf's breath is a set arriving and how much is the
 * floor between sets. Never all the way down: a shore is never silent. */
const SURF_FLOOR = 0.25;

/** One moment on the water — everything the layers need. */
export type WaterVoice = {
  /** How fast the hull is going, m/s, and as a share of its top speed. */
  speed: number;
  pace: number;
  /** How far onto the plane it is, 0..1, and how much of the bottom is wet. */
  planing: number;
  wetted: number;
  /** Nothing on the hull is touching water. */
  airborne: boolean;
  /** The hull is on its back: no hull noise at all, only the sea. */
  capsized: boolean;
  /** The significant wave height under the hull, m — the local sea. */
  hs: number;
  /** The apparent wind at the rider's head, m/s: the craft's speed and the
   * true wind, as one vector. */
  wind: number;
  /** The OCEAN band's significant height, m — what breaks on the shore. */
  surf: number;
  /** Metres from the nearest shoreline, positive out to sea. */
  shore: number;
  /** Where that shore stands, -1..1, right positive — the surf's pan. */
  shorePan: number;
  /** The sea's peak period, s — the surf's breath — and the run clock the
   * breath is read on. */
  tp: number;
  t: number;
};

/** What the seat does to the water — three of the listener's numbers. */
export type WaterMix = {
  hull: number;
  wind: number;
  sea: number;
};

export type WaterLayer = "wash" | "spray" | "chop" | "wind" | "sea" | "surf" | "foam";

/** What each layer is BUILT from — decided once. */
export const WATER_LAYERS: Record<WaterLayer, LayerSpec> = {
  wash: { kind: "noise", color: "brown", filter: { type: "lowpass", q: 0.8 } },
  spray: { kind: "noise", color: "pink", filter: { type: "bandpass", q: 0.6 } },
  chop: { kind: "noise", color: "pink", filter: { type: "bandpass", q: 1 } },
  wind: { kind: "noise", color: "pink", filter: { type: "lowpass", q: 0.5 } },
  sea: { kind: "noise", color: "brown", filter: { type: "lowpass", q: 0.7 } },
  surf: { kind: "noise", color: "brown", filter: { type: "lowpass", q: 0.9 }, echo: 0.15 },
  foam: { kind: "noise", color: "pink", filter: { type: "bandpass", q: 0.8 } },
};

/** How fast each layer follows, s. The hull's layers move on a tenth — a
 * hull leaving the water is a cross-fade, not a switch — and the sea's on a
 * quarter or more, because a swell does not change its mind. */
export const WATER_GLIDE: Record<WaterLayer, number> = {
  wash: 0.12,
  spray: 0.08,
  chop: 0.1,
  wind: 0.15,
  sea: 0.3,
  surf: 0.25,
  foam: 0.2,
};

/** Take a value from `lo`..`hi` to 0..1. */
function ramp(value: number, lo: number, hi: number): number {
  return Math.min(1, Math.max(0, (value - lo) / (hi - lo)));
}

/**
 * THE SURF'S BREATH at run clock `t`, 0..1 — how much of a set is arriving.
 *
 * Two waves rather than one, at the peak period and at a longer, offset
 * period, so the sets group the way real ones do: a big one, a pause, two
 * middling ones. Squared so a set ARRIVES rather than fades in, and floored
 * because a shore between sets is quieter, never silent.
 */
export function surfBreath(t: number, tp: number): number {
  const period = Math.max(2, tp);
  const a = 0.5 + 0.5 * Math.sin((2 * Math.PI * t) / period);
  const b = 0.5 + 0.5 * Math.sin((2 * Math.PI * t) / (1.71 * period) + 1.3);
  return SURF_FLOOR + (1 - SURF_FLOOR) * (0.6 * a * a + 0.4 * b * b);
}

/** How near the shore is, 0..1: 1 on the beach (and anywhere inland), 0
 * beyond `SURF_REACH`. */
export function shoreReach(shore: number): number {
  return 1 - ramp(shore, 0, SURF_REACH);
}

/**
 * Where every layer of the water should be for `voice`, heard from `mix`.
 *
 * The wind and the sea play whatever the hull is doing — over a hull at
 * rest, over one in the air, over one on its back. Everything else needs
 * the bottom in the water.
 */
export function waterTargets(voice: WaterVoice, mix: WaterMix): Record<WaterLayer, LayerTarget> {
  const pace = Math.min(1, Math.max(0, voice.pace));
  const planing = Math.min(1, Math.max(0, voice.planing));
  const wetted = Math.min(1, Math.max(0, voice.wetted));
  const afloat = voice.airborne || voice.capsized ? 0 : 1;
  const hump = ramp(voice.speed, 0, HUMP_SPEED);
  const hs = ramp(voice.hs, 0, SEA_FULL);
  const gust = ramp(voice.wind, 0, WIND_FULL);
  const reach = shoreReach(voice.shore);
  const surf = reach * ramp(voice.surf, 0, SURF_FULL);
  const breath = surfBreath(voice.t, voice.tp);
  // The foam runs up the sand a moment after the set breaks.
  const foamBreath = surfBreath(voice.t - 0.35 * Math.max(2, voice.tp), voice.tp);
  const pan = Math.max(-0.6, Math.min(0.6, voice.shorePan * 0.6));
  return {
    // The push at displacement speed: rising to the hump, and handing over
    // to the spray as the bottom lifts out.
    wash: {
      level: afloat * wetted * hump * (1 - 0.7 * planing) * 0.012 * mix.hull,
      cutoff: 300 + 500 * hump,
    },
    // The sheets off the chines: only once it is planing, and steeply with
    // the pace, because that is what the sense of speed is made of.
    spray: {
      level: afloat * planing * Math.pow(pace, 1.4) * 0.03 * mix.hull,
      cutoff: 1600 + 3500 * pace,
    },
    // The bottom crossing a short sea — nothing on flat water, a rattle of
    // slaps in a chop, and the individual big ones are one-shots.
    chop: {
      level:
        afloat *
        Math.sqrt(wetted) *
        ramp(voice.hs, 0, 1.5) *
        (0.3 + 0.7 * ramp(voice.speed, 0, 12)) *
        0.014 *
        mix.hull,
      cutoff: 250 + 400 * ramp(voice.speed, 0, 15),
    },
    // On the SQUARE of the apparent wind: a breeze at rest is a whisper, the
    // top of the band into a headwind is most of the mix.
    wind: {
      level: gust * gust * 0.03 * mix.wind,
      cutoff: 250 + 2800 * gust,
    },
    sea: {
      level: hs * (0.006 + 0.004 * breath) * mix.sea,
      cutoff: 150 + 250 * hs,
    },
    surf: {
      level: surf * breath * 0.02 * mix.sea,
      cutoff: 160 + 260 * breath,
      pan,
    },
    foam: {
      level: surf * foamBreath * 0.006 * mix.sea,
      cutoff: 1200 + 1200 * foamBreath,
      pan,
    },
  };
}
