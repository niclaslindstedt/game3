// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// BUBBLES — the one liquid sound that has a physics, and the tail every
// splash in the game is given.
//
// What a drop, a pour or a hull going under actually SOUND like is not the
// water: it is the air the water trapped. A bubble pinched off under the
// surface rings at its Minnaert frequency — `f ≈ 3.26 / r` Hz for a radius
// in metres, so a 3 mm bubble is a kilohertz and a 1 mm one three — decays
// in a few tens of milliseconds, and CHIRPS UPWARD as it rises and the
// pressure on it drops (Farnell, *Designing Sound*; van den Doel 2005). A
// splash is thousands of them at once, which the noise voices carry; what
// this adds is the handful the ear can pick out afterwards, as the water
// closes and the last of the air comes up.
//
// Each bubble is one `tone`: a sine whose `to` sits above its `from`, an
// exponential decay, no attack to speak of. Nothing here is a layer — a
// bubble has a beginning and an end — and nothing is booked more than a
// second ahead.

import type { Synth, ToneOptions } from "../../lib/voice.ts";

/** Minnaert's constant: the resonance of an air bubble in water is this
 * many hertz-metres over its radius. */
const MINNAERT_HZ_M = 3.26;

/** The radii a burst draws from, m: a couple of millimetres (a bright tick)
 * to a centimetre (a deep blup). `big` moves the whole draw toward the
 * large end. */
const RADIUS_SMALL = 0.0018;
const RADIUS_LARGE = 0.011;

/** How far a bubble's pitch climbs before it is gone, as a ratio — a rising
 * bubble decompresses and rings sharper. */
const CHIRP_LOW = 1.15;
const CHIRP_HIGH = 1.7;

/** How long a bubble rings, ms: the big ones longer. */
const RING_SHORT_MS = 28;
const RING_LONG_MS = 110;

/** How a burst is spread in time, s: the first bubbles arrive as the water
 * closes, the last a second or so after. */
const SPREAD_S = 1.1;

/** One bubble's voice for a radius `r` (m), sized by `gain`. */
export function bubbleVoice(r: number, gain: number, random: () => number): ToneOptions {
  const hz = MINNAERT_HZ_M / r;
  const big = 1 - (r - RADIUS_SMALL) / (RADIUS_LARGE - RADIUS_SMALL);
  return {
    type: "sine",
    from: hz,
    to: hz * (CHIRP_LOW + (CHIRP_HIGH - CHIRP_LOW) * random()),
    durationMs: RING_SHORT_MS + (RING_LONG_MS - RING_SHORT_MS) * (1 - big),
    // A big bubble is a quiet one: the ear reads the small ticks as brighter
    // and the volume levels them. 0.012 is a gloss layer's level, and a
    // burst never stacks two on one sample.
    volume: 0.012 * gain * (0.55 + 0.45 * big),
    attackMs: 2,
    pan: (random() - 0.5) * 0.6,
  };
}

/**
 * A BURST of `count` bubbles — the tail of a splash. `big` (0..1) moves the
 * draw toward the large, deep end: a landing's are small and quick, a dive's
 * or a capsize's are the air out of a hull going under.
 */
export function bubbleBurst(
  synth: Synth,
  count: number,
  big: number,
  gain: number,
  random: () => number = Math.random,
): void {
  const n = Math.max(0, Math.round(count));
  for (let i = 0; i < n; i++) {
    // Skewed toward the small end, then pushed up by `big`.
    const u = Math.pow(random(), 1.6 - 1.1 * Math.min(1, Math.max(0, big)));
    const r = RADIUS_SMALL + (RADIUS_LARGE - RADIUS_SMALL) * u;
    const voice = bubbleVoice(r, gain, random);
    // Clustered early and thinning: the square keeps most of them in the
    // first half second.
    const at = Math.pow(random(), 1.8) * SPREAD_S;
    synth.tone({ ...voice, delayMs: at * 1000 });
  }
}
