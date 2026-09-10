// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A cache of generated levels, for the test files that assert a dozen
// separate rules over ONE corpus of them.
//
// Generating a level is the most expensive thing the engine does — a coast,
// a course, the rocks, two baked grids and an analysis, and again for every
// sub-seed the search rejects — and the R-rule suites are written the way
// rules read: one `it` per rule, each walking the same spread of seeds.
// Written literally that is the same dozen levels built seventeen times
// over. The generator is deterministic per seed (`mapgen_test` asserts it
// first thing), so the second build of a seed can only return what the
// first one did. This hands out the first one.
//
// The bargain: what comes back is SHARED, so a test must treat it as
// read-only. A test that needs a level of its own — a determinism check
// that has to see two independent builds, or one that breaks a level on
// purpose — copies it or calls the engine directly.
import { analyzeLevel, generateLevel, type Level, type LevelAnalysis } from "@engine";

/** The corpus: a spread of seeds wide enough to roll every branch the
 * search has — two and three air gates, short and long courses, bays
 * deep enough to push the path out. */
export const LEVEL_SEEDS: readonly number[] = Array.from({ length: 12 }, (_, i) => i * 37 + 1);

const levels = new Map<number, Level>();
const analyses = new Map<number, LevelAnalysis>();

/** The level for a seed, built once. Read-only: several tests hold it. */
export function levelFor(seed: number): Level {
  let hit = levels.get(seed);
  if (hit === undefined) {
    hit = generateLevel(seed);
    levels.set(seed, hit);
  }
  return hit;
}

/** The analysis of a seed's level, run once. */
export function analysisFor(seed: number): LevelAnalysis {
  let hit = analyses.get(seed);
  if (hit === undefined) {
    hit = analyzeLevel(levelFor(seed));
    analyses.set(seed, hit);
  }
  return hit;
}

/** R29 — the CIRCUIT corpus, kept apart from the coast one because the two
 * kinds of level answer to different halves of the rule book and a suite
 * asserting R1's coastal band over a lap out at sea is asserting nothing.
 * A different spread of seeds, so the two corpora roll different shapes. */
export const CIRCUIT_SEEDS: readonly number[] = Array.from({ length: 8 }, (_, i) => i * 23 + 3);

const circuits = new Map<number, Level>();
const circuitAnalyses = new Map<number, LevelAnalysis>();

/** The circuit for a seed, built once. Read-only, as `levelFor`'s is. */
export function circuitFor(seed: number): Level {
  let hit = circuits.get(seed);
  if (hit === undefined) {
    hit = generateLevel(seed, { track: "circuit" });
    circuits.set(seed, hit);
  }
  return hit;
}

/** The analysis of a seed's circuit, run once. */
export function circuitAnalysisFor(seed: number): LevelAnalysis {
  let hit = circuitAnalyses.get(seed);
  if (hit === undefined) {
    hit = analyzeLevel(circuitFor(seed));
    circuitAnalyses.set(seed, hit);
  }
  return hit;
}
