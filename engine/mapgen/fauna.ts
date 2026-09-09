// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R20 — THE SEA LIFE, PLACED. R17's pattern applied to the animals: each
// species in the coast's chart gets a count drawn from its own `perKm`, and
// each pod is tried a bounded number of times for a spot that suits it —
// inside its offshore band, in water deep enough all the way round the loop
// it swims, clear of the rocks. A pod that finds nowhere is simply not
// placed; the water is a little emptier there, which is what water is
// allowed to be.
//
// THE COUNT IS FRACTIONAL, and that is the whole rarity model. A minke at
// 0.011 pods per kilometre over two kilometres of coast is an EXPECTED 0.022
// animals, which as an integer is always zero — so the count is drawn
// rather than rounded: the whole part is placed, and the fraction is the
// probability of one more. Over forty-odd seeds that is one minke, which is
// what the catalog asked for.
//
// A POD IS A LOOP, NOT A POSITION. What is stored is where the loop is, how
// big it is, which way round it goes and where on it the pod stands at
// t = 0; where any one animal actually is at a moment is `faunaPose` in
// `engine/game/fauna.ts`. Storing the loop is what keeps the sea life out of
// the step function entirely: nothing about it is simulated, so nothing
// about it can drift between a run and its replay.

import { TAU } from "../lib/math.ts";
import type { Rng } from "../lib/prng.ts";
import { faunaById, type FaunaSpec } from "../game/defs/fauna.ts";
import { POD_LAYER } from "../game/fauna.ts";
import type { Biome } from "./biomes.ts";
import { insideBounds } from "./compile.ts";
import type { Geology } from "./geology.ts";
import { LEVEL_RULES as R, inBand, withinBand } from "./rules.ts";
import type { Shore } from "./shore.ts";
import type { Bounds, Pod, Solid } from "./types.ts";

/** How many pods of one species a stretch of coast carries: the whole part
 * of the expectation, plus the fraction as a chance of one more. */
function podCount(rng: Rng, perKm: number, km: number): number {
  const expected = perKm * km;
  const whole = Math.floor(expected);
  return whole + (rng.chance(expected - whole) ? 1 : 0);
}

/** The water a pod needs under it, m: the least its species will enter at
 * all, and never less than the animal itself plus `fauna.floor` under its
 * belly. Stated here because the analysis re-derives the same number from
 * the same two rows. */
export function podClearance(spec: FaunaSpec, depth: number): number {
  // The DEEPEST animal in the pod, not its centreline: a school has
  // thickness (`POD_LAYER`), and the water has to hold the bottom of it.
  const deepest = depth * (1 + POD_LAYER);
  return Math.max(spec.water, deepest + spec.length * spec.beam + R.fauna.floor);
}

/** Every plan point of a pod's loop, `fauna.samples` of them, handed to
 * `visit` one at a time. The long axis points along `heading` (sin, cos in
 * plan, the engine's convention) and the short one lies across it. */
export function walkPod(pod: PodLoop, visit: (x: number, z: number) => void): void {
  const ch = Math.cos(pod.heading);
  const sh = Math.sin(pod.heading);
  for (let i = 0; i < R.fauna.samples; i++) {
    const a = (TAU * i) / R.fauna.samples;
    const along = pod.radius * Math.cos(a);
    const across = pod.radius * pod.ovality * Math.sin(a);
    visit(pod.x + along * sh + across * ch, pod.z + along * ch - across * sh);
  }
}

/** The part of a pod the loop walk needs — so the placer can walk a
 * candidate it has not built a `Pod` out of yet. */
export type PodLoop = Pick<Pod, "x" | "z" | "radius" | "ovality" | "heading">;

/** Is the whole loop inside the level, in water deep enough for the animal,
 * and clear of every rock? */
function loopFits(
  geology: Geology,
  solids: readonly Solid[],
  bounds: Bounds,
  loop: PodLoop,
  need: number,
): boolean {
  let ok = true;
  walkPod(loop, (px, pz) => {
    if (!ok) return;
    if (!insideBounds(bounds, px, pz)) ok = false;
    else if (-geology.groundAt(px, pz) < need) ok = false;
    else {
      for (const s of solids) {
        if (Math.hypot(s.x - px, s.z - pz) < s.r + R.fauna.clear) {
          ok = false;
          return;
        }
      }
    }
  });
  return ok;
}

/** R20 — lay the pods along the coast between two distances along its base
 * line. Deterministic in `rng`; the species are walked in catalog order so
 * the stream a seed draws never depends on a `Set`'s iteration. */
export function layFauna(
  rng: Rng,
  biome: Biome,
  shore: Shore,
  geology: Geology,
  solids: readonly Solid[],
  bounds: Bounds,
  temperature: number,
  sFrom: number,
  sTo: number,
): Pod[] {
  const pods: Pod[] = [];
  const km = (sTo - sFrom) / 1000;
  for (const id of biome.fauna) {
    const spec = faunaById(id);
    // R13, R20 — the day's water decides which of the coast's animals are
    // in it at all. Drawing the count anyway and rejecting it afterwards
    // would be the same seed spending different draws on a warm day and a
    // cold one, so the temperature is asked FIRST.
    if (!withinBand(temperature, spec.temperature)) continue;
    const count = podCount(rng, spec.perKm, km);
    for (let n = 0; n < count; n++) {
      for (let attempt = 0; attempt < R.fauna.tries; attempt++) {
        const s = rng.range(sFrom, sTo);
        const out = inBand(rng, spec.offshore);
        const radius = inBand(rng, R.fauna.loop);
        const ovality = inBand(rng, R.fauna.ovality);
        const heading = rng.range(0, TAU);
        const depth = inBand(rng, spec.depth);
        const school = rng.int(spec.school.min, spec.school.max);
        const sense: 1 | -1 = rng.chance(0.5) ? 1 : -1;
        const phase = rng.range(0, TAU);
        const scatter = rng.int(1, 0x7fffffff);
        // Pushed out along the base line's normal, then held to the TRUE
        // offshore distance the way R17's rocks are: on a sloping stretch
        // the two differ, and the band is a promise about the second.
        const { x, z } = shore.toWorld(s, shore.offsetAt(s) + out);
        const loop = { x, z, radius, ovality, heading };
        if (!withinBand(geology.sample(x, z).offshore, spec.offshore)) continue;
        if (!loopFits(geology, solids, bounds, loop, podClearance(spec, depth))) continue;
        // The loop's PERIOD comes from the animal's cruising speed and the
        // loop's own circumference — the pod swims, it is not carried round
        // on a clock. Ramanujan's ellipse perimeter, which is exact enough
        // at these eccentricities that the second term never shows.
        const b = radius * ovality;
        const h = ((radius - b) / (radius + b)) ** 2;
        const perimeter = Math.PI * (radius + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
        pods.push({
          id: `A${pods.length + 1}`,
          species: id,
          count: school,
          x,
          z,
          radius,
          ovality,
          heading,
          period: perimeter / spec.speed,
          sense,
          phase,
          depth,
          scatter,
        });
        break;
      }
    }
  }
  return pods;
}
