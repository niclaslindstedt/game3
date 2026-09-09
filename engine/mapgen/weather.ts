// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WEATHER (R19) — which of the coast's skies a seed is ridden under,
// and HOW HEAVY that sky is. Two answers, and the second one is not drawn
// at all: it is read off the WIND the level already has.
//
// That is the whole design. The generator seeds a mean wind inside R12's
// band, and the wind is what builds the sea — the fetch law grows the waves
// out of it, the gusts breathe around it. So a level with 11 m/s in it is
// already a level with a big sea, and putting a black ceiling over exactly
// those levels costs nothing and means the sky and the water are telling
// the rider about the same weather. The alternative — a sky rolled
// independently of the wind — buys a flat calm under a squall, which is the
// one thing that makes weather read as a filter over the picture rather
// than as weather.
//
// Nothing here is a colour. What a sky LOOKS like is art direction and
// lives in the app (`pwa/src/game/sky-looks.ts`); the engine's half is the
// word and the number, so the sea, the sky and — when they are built — the
// rain on the water and the fauna that goes quiet under a squall all read
// one source.

import { LEVEL_RULES } from "./rules.ts";
import type { Weather } from "./types.ts";

/** Every sky there is, lightest first. The order IS the heaviness order:
 * `HEAVINESS` reads it, and so does anything that asks whether one sky is
 * worse than another. */
export const WEATHER_IDS: readonly Weather[] = ["clear", "high", "overcast", "rain", "squall"];

/**
 * WHERE EACH SKY SITS on the 0–1 scale of how heavy the weather is — the
 * same scale `skyCover` reads the wind's band on, which is what lets the
 * two be compared at all.
 *
 * They are not evenly spread, and the spacing is what settles HOW OFTEN
 * each sky comes up. R12 draws the wind uniformly across its band, so a
 * sky's share of the seeds is very nearly its share of this scale: the
 * gaps ARE the chart. Measured over the first three hundred seeds, the set
 * out below gives a summer that is 43% fair (clear or high cloud), 19%
 * under a dry lid and 37% wet, with the squall the rarest sky there is at
 * one seed in eight — which is the distribution a season should have, and
 * the rarity a squall needs in order to still be an event when it arrives.
 * An evenly spread five would put a downpour over a fifth of every
 * campaign and a squall over another fifth.
 *
 * Within that, clear and high cloud sit close together because they are
 * both fair weather; the step from an overcast lid to rain is small (a
 * rain deck IS an overcast one that has come down and started to fall) and
 * the step up to a squall is the biggest on the scale, because a squall is
 * a different kind of day rather than a wetter one.
 */
const HEAVINESS: Record<Weather, number> = {
  clear: 0,
  high: 0.36,
  overcast: 0.7,
  rain: 0.86,
  squall: 1,
};

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * HOW HEAVY THIS LEVEL'S WEATHER IS, 0..1 — where its mean wind sits inside
 * R12's band, which is the one number the whole sky is scaled by.
 *
 * Read against the RULE's band rather than against the sea it happens to
 * have made, so the answer is a property of the level rather than of where
 * the rider is standing in it: the ceiling over a bay is the ceiling over
 * the open coast, and it does not lift because the fetch ran out.
 */
export function skyCover(windSpeed: number): number {
  const { min, max } = LEVEL_RULES.wind.speed;
  return max > min ? clamp01((windSpeed - min) / (max - min)) : 0;
}

/**
 * R19 — THE SKY THIS SEED IS RIDDEN UNDER: one of the skies the coast
 * offers, drawn with the level's own wind weighting the draw.
 *
 * Every offered sky gets a weight from how far its heaviness stands from
 * the wind's (`LEVEL_RULES.sky.spread` sets the falloff), so the draw is a
 * choice among the skies that SUIT the day rather than a lookup: a middling
 * wind can come with a high sheet or an overcast lid, and which one it is,
 * is the seed's. Only the ENDS of R12's band are nearly settled — its
 * calmest wind is a clear morning and its strongest a squall — which is
 * exactly the certainty those two days should carry.
 *
 * A coast that offers nothing is a bug in its row rather than a clear day,
 * so it throws: a level under a sky nobody authored is not a level.
 */
export function pickWeather(
  rng: { next(): number },
  offered: readonly Weather[],
  cover: number,
): Weather {
  if (offered.length === 0) throw new Error("the biome offers no weather to draw from");
  const spread = LEVEL_RULES.sky.spread;
  const weights = offered.map((w) => {
    const off = (HEAVINESS[w] - cover) / spread;
    return Math.exp(-off * off);
  });
  const total = weights.reduce((a, b) => a + b, 0);
  // Every weight is a positive exponential, so the total cannot be zero and
  // the walk below always lands on a row.
  let roll = rng.next() * total;
  for (let i = 0; i < offered.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return offered[i];
  }
  return offered[offered.length - 1];
}

/** Whether this sky has a LID over it — a ceiling rather than a gradient
 * with cloud in it. The renderer draws the two completely differently, and
 * so does anything that asks how much sky there is to see. */
export function hasDeck(weather: Weather): boolean {
  return weather === "overcast" || weather === "rain" || weather === "squall";
}

/** Whether water is coming out of this sky. Nothing draws rain yet; the
 * sea, the spray and the sound will all ask this when they do, and the
 * answer belongs beside the vocabulary rather than in each of them. */
export function isWet(weather: Weather): boolean {
  return weather === "rain" || weather === "squall";
}
