// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHERE THE SEA GOES WHITE (`pwa/src/game/water-break.ts`) — the rule the
// water mesh sows into the foam field, the surf lab draws, and this file
// holds. It touches no three.js and no DOM, which is exactly why it can be
// held to a rule here: what it decides is a share of the sea painted white,
// and no screenshot proves a share.
//
// The claim under every case below is the one the module's header makes:
// SURF is the bed tripping a wave and belongs to the shallows, CAPS are the
// wind and belong to a gale, and a crest spilling in deep water is a few
// crests rather than most of the water. Getting those the wrong way round is
// an ocean painted like a snowfield with a clean beach in front of it, which
// is what this file exists to fail on.
import { describe, expect, it } from "vitest";

import { TUNING } from "@engine";

import {
  breakBands,
  breakingParts,
  depthLoad,
  type BreakParts,
} from "../pwa/src/game/water-break.ts";

/** A sea a level is actually dealt: three metres at a six-second peak. */
const HS = 3;
const TP = 6;
const BANDS = breakBands(HS, TP, 0, 1);
/** Deep enough that the bed says nothing about a three-metre sea. */
const DEEP = 60;
/** The wind a level is dealt (R12 draws 6–13 m/s) and the wind out in the
 * storm past the rim (`TUNING.sea.open.wind`). */
const COAST_WIND = 12;
const STORM_WIND = TUNING.sea.open.wind;

const parts = (): BreakParts => ({ crest: 0, shoal: 0, cap: 0 });
/** The rule at a sample, with everything named. */
function at(o: {
  tilt: number;
  height: number;
  hs?: number;
  depth?: number;
  wind?: number;
}): BreakParts & { all: number } {
  const out = parts();
  const all = breakingParts(
    BANDS,
    o.tilt,
    o.height,
    o.hs ?? HS,
    o.depth ?? DEEP,
    o.wind ?? COAST_WIND,
    out,
  );
  return { ...out, all };
}

describe("the depth load", () => {
  it("is 1 exactly where the engine's own clip bites", () => {
    // `surfaceAt` holds the significant height to `breakingHs`·d. The surf
    // band is read against that and nothing else, so the two can never drift.
    const depth = 4;
    expect(depthLoad(TUNING.sea.breakingHs * depth, depth)).toBeCloseTo(1, 6);
  });

  it("scales itself with the sea, so no depth in metres is stated anywhere", () => {
    // A three-metre sea starts pressing on the bed far further out than a
    // half-metre one, and the same two numbers say so for both.
    const deepEnough = (hs: number): number => {
      for (let d = 0.5; d < 200; d += 0.1) if (depthLoad(hs, d) < 0.4) return d;
      return Infinity;
    };
    expect(deepEnough(3)).toBeGreaterThan(3 * deepEnough(0.5));
  });

  it("falls toward nothing in deep water and never goes negative", () => {
    expect(depthLoad(HS, 500)).toBeLessThan(0.02);
    expect(depthLoad(0, 10)).toBe(0);
  });
});

describe("the surf", () => {
  it("is the whole of the white water where the bed has the wave", () => {
    // Depth load 1 — the bed is holding the sea down — on an ordinary face.
    const shallow = HS / TUNING.sea.breakingHs;
    const s = at({ tilt: 0.06, height: 0.2 * HS, depth: shallow });
    expect(s.shoal).toBeGreaterThan(0.9);
    expect(s.all).toBe(1);
  });

  it("is absent from deep water however steep the face is", () => {
    // THE FAULT THIS WHOLE CHANGE WAS ABOUT, from the other side: a rule
    // whose shallow term reads a depth in metres rather than the sea over
    // the depth puts surf where there is no bed to trip anything.
    expect(at({ tilt: 0.3, height: HS, depth: DEEP }).shoal).toBe(0);
  });

  it("does not whiten the flat water between two breakers", () => {
    const shallow = HS / TUNING.sea.breakingHs;
    expect(at({ tilt: 0, height: 0, depth: shallow }).shoal).toBe(0);
  });

  it("opens as the bed comes up, rather than at one contour", () => {
    // A surf line is a BAND tens of metres wide. Walking in from deep water
    // the share has to rise through it, not step.
    const shares = [40, 20, 12, 8, 6, 5].map(
      (d) => at({ tilt: 0.06, height: 0.2 * HS, depth: d }).shoal,
    );
    for (let i = 1; i < shares.length; i++) expect(shares[i]).toBeGreaterThanOrEqual(shares[i - 1]);
    expect(shares[0]).toBe(0);
    expect(shares[shares.length - 1]).toBeGreaterThan(0.8);
  });
});

describe("the whitecaps", () => {
  it("are a sprinkle at the winds a level is dealt and a field in the storm", () => {
    const crest = { tilt: 0.05, height: 0.6 * HS };
    const coast = at({ ...crest, wind: COAST_WIND }).cap;
    const storm = at({ ...crest, wind: STORM_WIND }).cap;
    expect(coast).toBeGreaterThan(0);
    expect(storm).toBeGreaterThan(3 * coast);
  });

  it("are gone in a calm, whatever the sea is doing", () => {
    expect(at({ tilt: 0.2, height: HS, wind: 0 }).cap).toBe(0);
    expect(at({ tilt: 0.2, height: HS, wind: 6 }).cap).toBe(0);
  });

  it("are on the crest and not in the trough", () => {
    expect(at({ tilt: 0.05, height: -0.6 * HS, wind: STORM_WIND }).cap).toBe(0);
  });
});

describe("the crest spilling in deep water", () => {
  it("wants the TOP of a wave, not the upper third of every one", () => {
    // A sea's surface is near enough Gaussian with σ = Hs/4, so a gate at a
    // tenth of Hs is 0.4σ — a third of the whole sea — and a breaking rule
    // that passes a third of the water is not a gate.
    expect(at({ tilt: 0.3, height: 0.1 * HS }).crest).toBe(0);
    expect(at({ tilt: 0.3, height: 0.9 * HS }).crest).toBeGreaterThan(0.9);
  });

  it("leaves a steep face green until the top goes over", () => {
    // A swell is steep over its whole face and rolls in green.
    expect(at({ tilt: 0.3, height: 0 }).crest).toBe(0);
  });
});

describe("the rule as a whole", () => {
  it("stays inside 0..1 over every sea, face, depth and wind the game reaches", () => {
    const out = parts();
    for (const hs of [0, 0.2, 1, 3, 12, 30]) {
      const bands = breakBands(hs, 4, hs > 10 ? hs : 0, 12);
      for (const depth of [0.05, 0.5, 3, 25, 150]) {
        for (const tilt of [0, 0.01, 0.09, 0.4, 0.9]) {
          for (const height of [-2 * hs, 0, hs, 3 * hs]) {
            for (const wind of [0, 8, 12, 25, 60]) {
              const all = breakingParts(bands, tilt, height, hs, depth, wind, out);
              expect(all).toBeGreaterThanOrEqual(0);
              expect(all).toBeLessThanOrEqual(1);
              for (const v of [out.crest, out.shoal, out.cap]) {
                expect(Number.isFinite(v)).toBe(true);
                expect(v).toBeGreaterThanOrEqual(0);
              }
            }
          }
        }
      }
    }
  });

  it("holds a big quoted sea's own faces green and only whitens its tops", () => {
    // A twenty-metre sea is steep over its whole face by construction
    // (`TUNING.sea.steepness`). An absolute tilt band paints every vertex of
    // it white, which is a snowfield with a jet ski on it — so the bands are
    // held against the sea's OWN characteristic tilt as well.
    const big = 20;
    const bands = breakBands(big, 15, 0, 1);
    const out = parts();
    const face = breakingParts(bands, 0.09, 0, big, 300, COAST_WIND, out);
    expect(face).toBeLessThan(0.1);
  });

  it("gives a calm level's flat water no white at all", () => {
    const bands = breakBands(0.3, 3, 0, 1);
    const out = parts();
    expect(breakingParts(bands, 0.005, 0.05, 0.3, 30, 4, out)).toBe(0);
  });
});
