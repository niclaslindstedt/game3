// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WAKE'S SHAPE (pwa/src/game/wake-profile.ts): what the map behind the
// craft carries, by speed and by age. The claims the reference photograph
// makes — a road that outlives its boil, a fan that spreads at Kelvin's
// angle with the SPEED, a crawl that stirs the water and whitens none of
// it — held as arithmetic, since how it LOOKS is `make screenshots`'s.

import { describe, expect, it } from "vitest";

import {
  BOIL_LIFE,
  BRAKE_PACE_FULL,
  BRAKE_ROAD_WIDEN,
  CRATER_LIFE,
  CUSP_WAVE,
  FAN_HALF_MAX,
  FAN_LIFE,
  KELVIN_TAN,
  RING_LIFE,
  RING_SPEED,
  ROAD_LIFE,
  SPEED_MIN,
  SPLASH_LIFE,
  SPLASH_STATIONS,
  TURN_FULL,
  WAKE_HEIGHT,
  WAKE_MAP_BACK,
  WAKE_REACH,
  brakeMark,
  fanAt,
  fanCusp,
  fanHalf,
  hullMark,
  roadAt,
  roadHalf,
  roadStrength,
  splashAt,
  splashReach,
  splashStations,
  trailAction,
  turnBias,
  wakeSection,
  washOf,
} from "../pwa/src/game/wake-profile.ts";

const BEAM = 1.2;

describe("the road", () => {
  it("is white only once the pump is churning at pace, and whiter on the throttle", () => {
    expect(roadStrength(SPEED_MIN - 0.5, 1)).toBe(0);
    expect(roadStrength(20, 1)).toBeGreaterThan(roadStrength(20, 0));
    expect(roadStrength(20, 0)).toBeGreaterThan(0);
    expect(roadStrength(20, 1)).toBeLessThanOrEqual(1);
  });

  it("is widest at the transom — the boil — and necks in behind it", () => {
    // The narrowest the road ever is comes AFTER the transom, not at it:
    // the boil's bulb collapses in under a second, the road necks in behind
    // it, and only then does it start creeping wider again.
    const transom = roadHalf(BEAM, 15, 0);
    let neck = Infinity;
    let neckAge = 0;
    for (let age = 0; age < ROAD_LIFE; age += 0.05) {
      const half = roadHalf(BEAM, 15, age);
      if (half < neck) [neck, neckAge] = [half, age];
    }
    expect(neckAge).toBeGreaterThan(BOIL_LIFE);
    expect(transom).toBeGreaterThan(neck * 1.3);
    // …then spreads, slowly, with age — the road is the THIN bright line
    // down the middle of the photograph; what opens is the fan round it.
    expect(roadHalf(BEAM, 15, ROAD_LIFE)).toBeGreaterThan(neck);
  });

  it("outlives its boil and fades into nothing, never negative", () => {
    const s = wakeSection();
    roadAt(0, 0.3, 15, 1, s);
    const fresh = { ...s };
    roadAt(0, 2 * BOIL_LIFE, 15, 1, s);
    const settled = { ...s };
    expect(settled.foam).toBeGreaterThan(0.3);
    expect(settled.churn).toBeLessThan(fresh.churn);
    expect(settled.down).toBeLessThan(fresh.down);
    roadAt(0, ROAD_LIFE + 0.01, 15, 1, s);
    expect(s.cover).toBe(0);
    for (const age of [0, 1, 3, 5.9]) {
      roadAt(0, age, 15, 1, s);
      expect(s.foam).toBeGreaterThanOrEqual(0);
      expect(s.foam).toBeLessThanOrEqual(1);
    }
  });

  it("feathers to nothing at its edge and hollows the water at its middle", () => {
    const s = wakeSection();
    roadAt(1, 0.2, 15, 1, s);
    expect(s.cover).toBe(0);
    roadAt(0, 0.2, 15, 1, s);
    expect(s.cover).toBe(1);
    expect(s.down).toBeGreaterThan(0);
    expect(s.down).toBeLessThan(WAKE_HEIGHT);
    expect(s.up).toBe(0);
  });

  it("forms its hollow over a moment rather than at a step", () => {
    // The relief the surface is moved by rises in: nothing at the instant
    // the transom passes, most of the way in a quarter second, so no vertex
    // drops its whole depth between one frame and the next.
    const s = wakeSection();
    roadAt(0, 0, 15, 1, s);
    expect(s.down).toBe(0);
    roadAt(0, 0.05, 15, 1, s);
    const early = s.down;
    roadAt(0, 0.3, 15, 1, s);
    expect(early).toBeGreaterThan(0);
    expect(s.down).toBeGreaterThan(early * 3);
  });
});

describe("the fan", () => {
  it("spreads at Kelvin's angle with the speed, up to a cap", () => {
    // The V opens at Kelvin's angle with the speed the hull was making. The
    // cusps ride on top of that, so the claim is the RATE: twice the age,
    // twice the spread, whatever the wobble at this point along the trail.
    const at = (speed: number, age: number) => fanHalf(BEAM, speed, age);
    expect((at(15, 2) - at(5, 2)) / (at(15, 4) - at(5, 4))).toBeCloseTo(0.5, 5);
    expect(at(15, 4) - at(5, 4)).toBeGreaterThan(10 * 4 * KELVIN_TAN * 0.9);
    // …and the cap holds it: a faster hull does not open a wider V once it
    // is there, and the cap is a width, not a wobble.
    expect(at(30, FAN_LIFE)).toBe(at(60, FAN_LIFE));
    expect(at(30, FAN_LIFE)).toBeGreaterThan(FAN_HALF_MAX * 0.9);
    expect(at(30, FAN_LIFE)).toBeLessThan(FAN_HALF_MAX * 1.1);
  });

  it("keeps opening the length of the trail, and is still white where it ends", () => {
    // The aerial photographs' claim: the V is wider every metre further
    // back, and the trail leaves the frame white rather than fading out
    // inside it. The map reaches WAKE_MAP_BACK + WAKE_REACH behind the
    // craft, so the whole of it must still be opening and still lit.
    const reach = WAKE_MAP_BACK + WAKE_REACH;
    const speed = 20;
    const edge = reach / speed;
    expect(edge).toBeLessThan(FAN_LIFE);
    expect(fanHalf(BEAM, speed, edge)).toBeGreaterThan(fanHalf(BEAM, speed, edge / 2) * 1.5);
    const s = wakeSection();
    fanAt(0.8, edge, speed, 1, s);
    expect(s.foam).toBeGreaterThan(0.2);
    // …and the road under it outlives the map too.
    expect(ROAD_LIFE).toBeGreaterThan(edge);
  });

  it("is two rails at the transom and a filled wedge once it has aged", () => {
    // The reference photograph twice over: right behind the hull the fan is
    // a pair of diverging crests with merely aerated water between them;
    // several seconds back the rails have broken inward and the whole
    // wedge is broken white.
    const s = wakeSection();
    fanAt(0.8, 0.2, 15, 1, s);
    const railYoung = s.foam;
    fanAt(0.2, 0.2, 15, 1, s);
    const middleYoung = s.foam;
    expect(railYoung).toBeGreaterThan(middleYoung * 4);
    fanAt(0.2, 3, 15, 1, s);
    const middleOld = s.foam;
    expect(middleOld).toBeGreaterThan(middleYoung);
    fanAt(0.8, 3, 15, 1, s);
    expect(middleOld).toBeGreaterThan(s.foam * 0.6);
  });

  it("carries most of the white in the picture, and settles before it pales", () => {
    const s = wakeSection();
    // The fan, not the road, is what an aerial photograph is mostly made
    // of: past the boil it covers many times the water the road does, at a
    // share the lace still draws as white rather than as a chain of
    // speckles. The first pass had the fan at half this and it read as a
    // grey smear beside the road.
    expect(fanHalf(BEAM, 15, 2)).toBeGreaterThan(roadHalf(BEAM, 15, 2) * 4);
    fanAt(0.8, 2, 15, 1, s);
    expect(s.foam).toBeGreaterThan(0.45);
    const rail = { ...s };
    // …but the rails have not separated from the boil AT the transom, where
    // laying them on top of the road only saturates the lace into a blanket.
    fanAt(0.8, 0.02, 15, 1, s);
    expect(s.foam).toBeLessThan(rail.foam * 0.25);
    // The surface settles long before the bubbles pop: a section still
    // white at four seconds is no longer stirring the water it lies in.
    fanAt(0.8, 4, 15, 1, s);
    expect(s.foam).toBeGreaterThan(0.2);
    expect(s.churn).toBeLessThan(rail.churn * 0.5);
  });

  it("has a bow wave along its edge, with flat water toward the road", () => {
    const s = wakeSection();
    fanAt(0.8, 0.5, 15, 1, s);
    const edge = { ...s };
    fanAt(0.5, 0.5, 15, 1, s);
    const behind = { ...s };
    fanAt(0.1, 0.5, 15, 1, s);
    const inside = { ...s };
    // The crest on the edge, the trough drawn in just inside it, flat water
    // toward the road: a wave, which is what the surface is pushed by.
    expect(edge.up).toBeGreaterThan(inside.up);
    expect(edge.down).toBe(0);
    expect(behind.down).toBeGreaterThan(0);
    expect(behind.up).toBe(0);
    expect(inside.down).toBe(0);
    expect(edge.foam).toBeGreaterThan(inside.foam);
    fanAt(1, 0.5, 15, 1, s);
    expect(s.cover).toBe(0);
    fanAt(0, FAN_LIFE + 0.01, 15, 1, s);
    expect(s.cover).toBe(0);
  });

  it("breaks its edge into crescents anchored to the water, not to the craft", () => {
    // The cusps must stand still while the craft runs away from them: the
    // wobble is a function of the sample's distance along the trail alone.
    const at = (run: number) => fanHalf(BEAM, 15, 2, run);
    const runs = Array.from({ length: 64 }, (_, i) => at(i * 0.25));
    const spread = Math.max(...runs) - Math.min(...runs);
    expect(spread).toBeGreaterThan(0.1);
    expect(at(3)).toBe(at(3));
    // …and it is a wobble, not a ripple: two wavelengths that do not divide
    // one another, so no short window repeats.
    expect(fanCusp(0)).not.toBeCloseTo(fanCusp(CUSP_WAVE), 3);
    // A cusp that bulges is brighter than the notch beside it.
    const s = wakeSection();
    let brightest = 0;
    let dimmest = 1;
    for (let i = 0; i < 64; i++) {
      fanAt(0.8, 1, 15, 1, s, i * 0.25);
      brightest = Math.max(brightest, s.foam);
      dimmest = Math.min(dimmest, s.foam);
    }
    expect(brightest).toBeGreaterThan(dimmest * 1.2);
  });

  it("throws its wash to the OUTSIDE of a carve and lays little on the inside", () => {
    // Turning toward +s (the craft's right) makes the LEFT the outside.
    const right = TURN_FULL;
    expect(turnBias(-1, right)).toBeCloseTo(1, 5);
    expect(turnBias(1, right)).toBeCloseTo(-1, 5);
    expect(turnBias(1, 0)).toBe(0);
    expect(turnBias(0, right)).toBe(0);
    // Symmetric running straight; thrown wide and whiter outboard carving.
    expect(fanHalf(BEAM, 15, 2, 0, turnBias(-1, 0))).toBeCloseTo(
      fanHalf(BEAM, 15, 2, 0, turnBias(1, 0)),
      5,
    );
    const outside = fanHalf(BEAM, 15, 2, 0, turnBias(-1, right));
    const inside = fanHalf(BEAM, 15, 2, 0, turnBias(1, right));
    expect(outside).toBeGreaterThan(inside * 1.8);
    const s = wakeSection();
    fanAt(-0.8, 1, 15, 1, s, 0, turnBias(-1, right));
    const outFoam = s.foam;
    fanAt(0.8, 1, 15, 1, s, 0, turnBias(1, right));
    expect(outFoam).toBeGreaterThan(s.foam * 1.8);
  });

  it("is stirred, not whitened, by a crawl", () => {
    const s = wakeSection();
    const crawl = SPEED_MIN - 0.5;
    expect(washOf(crawl)).toBeGreaterThan(0);
    fanAt(0.8, 0.3, crawl, roadStrength(crawl, 1), s);
    expect(s.foam).toBe(0);
    expect(s.churn).toBeGreaterThan(0);
    expect(s.up).toBeGreaterThan(0);
    // …and a craft on the plane stirs it harder and throws a far taller
    // bow wave — the wave grows with the square of the wash.
    const stirred = s.churn;
    const lifted = s.up;
    fanAt(0.8, 0.3, 15, roadStrength(15, 1), s);
    expect(s.churn).toBeGreaterThan(stirred);
    expect(s.up).toBeGreaterThan(lifted * 4);
    expect(s.foam).toBeGreaterThan(0);
  });
});

describe("the splash", () => {
  const RADIUS = 1.5;
  const DEPTH = 0.3;

  it("knocks a crater that forms over a moment and fills back in", () => {
    const s = wakeSection();
    splashAt(0, RADIUS, 0, 1, DEPTH, 1, s);
    expect(s.down).toBe(0);
    splashAt(0, RADIUS, 0.3, 1, DEPTH, 1, s);
    const formed = s.down;
    expect(formed).toBeGreaterThan(DEPTH * 0.2);
    expect(formed).toBeLessThanOrEqual(DEPTH);
    splashAt(0, RADIUS, 4 * CRATER_LIFE, 1, DEPTH, 1, s);
    expect(s.down).toBeLessThan(formed * 0.1);
    // A bowl: deepest at the centre, nothing of it at the rim.
    splashAt(RADIUS * 0.5, RADIUS, 0.3, 1, DEPTH, 1, s);
    expect(s.down).toBeLessThan(formed);
    expect(s.down).toBeGreaterThan(0);
  });

  it("rolls a ring wave out at its speed, thinning as it goes, laced white", () => {
    const s = wakeSection();
    const crestAt = (age: number) => {
      let best = -1;
      let at = 0;
      for (let r = 0; r < splashReach(RADIUS, age, 1); r += 0.02) {
        splashAt(r, RADIUS, age, 1, DEPTH, 1, s);
        if (s.up > best) {
          best = s.up;
          at = r;
        }
      }
      return { r: at, up: best };
    };
    const early = crestAt(0.5);
    const late = crestAt(1.5);
    expect(late.r - early.r).toBeCloseTo(RING_SPEED, 1);
    expect(late.up).toBeLessThan(early.up);
    expect(early.up).toBeGreaterThan(0);
    expect(early.up).toBeLessThan(WAKE_HEIGHT);
    // A trough drawn in just inside the crest, and foam on the crest itself.
    splashAt(early.r, RADIUS, 0.5, 1, DEPTH, 1, s);
    const crest = { ...s };
    splashAt(early.r - 0.9, RADIUS, 0.5, 1, DEPTH, 1, s);
    expect(s.down).toBeGreaterThan(crest.down);
    expect(crest.foam).toBeGreaterThan(0);
    // …and gone once it has lived its life.
    splashAt(RADIUS + RING_SPEED * (RING_LIFE + 0.1), RADIUS, RING_LIFE + 0.1, 1, DEPTH, 1, s);
    expect(s.up).toBe(0);
  });

  it("is the DETAIL row's: no ring at a ring share of nought, no crater at no depth", () => {
    const s = wakeSection();
    for (let r = 0; r < 8; r += 0.1) {
      splashAt(r, RADIUS, 0.6, 1, DEPTH, 0, s);
      expect(s.up).toBe(0);
      splashAt(r, RADIUS, 0.6, 1, 0, 1, s);
      expect(s.up).toBe(0);
      expect(s.down).toBe(0);
    }
    // The foam patch is there whatever the row says.
    splashAt(0, RADIUS, 0.6, 1, 0, 0, s);
    expect(s.foam).toBeGreaterThan(0);
    expect(splashReach(RADIUS, 0.6, 0)).toBeLessThan(splashReach(RADIUS, 0.6, 1));
  });

  it("feathers to nothing at its reach and is over after its life", () => {
    const s = wakeSection();
    for (const age of [0.1, 1, 2, SPLASH_LIFE - 0.1]) {
      const reach = splashReach(RADIUS, age, 1);
      splashAt(reach, RADIUS, age, 1, DEPTH, 1, s);
      expect(s.cover).toBe(0);
      splashAt(0, RADIUS, age, 1, DEPTH, 1, s);
      expect(s.cover).toBe(1);
      expect(s.foam).toBeGreaterThanOrEqual(0);
      expect(s.foam).toBeLessThanOrEqual(1);
    }
    splashAt(0, RADIUS, SPLASH_LIFE, 1, DEPTH, 1, s);
    expect(s.cover).toBe(0);
    expect(s.foam).toBe(0);
  });

  it("lays its stations ascending from the centre to the reach, on the ring", () => {
    const out = new Float32Array(SPLASH_STATIONS);
    for (const age of [0, 0.4, 1.2, 2.5]) {
      splashStations(RADIUS, age, 1, out);
      expect(out[0]).toBe(0);
      for (let i = 1; i < SPLASH_STATIONS; i++) expect(out[i]).toBeGreaterThanOrEqual(out[i - 1]);
      expect(out[SPLASH_STATIONS - 1]).toBeCloseTo(splashReach(RADIUS, age, 1), 5);
      if (age < RING_LIFE) {
        const crest = RADIUS + RING_SPEED * age;
        expect(Math.min(...Array.from(out, (r) => Math.abs(r - crest)))).toBeLessThan(1e-5);
      }
    }
  });
});

describe("the brake", () => {
  const LENGTH = 3;

  it("boils nothing with the gate stowed or the pump idle, and more with both", () => {
    const m = hullMark();
    brakeMark(0, 0.65, 10, LENGTH, BEAM, m);
    expect(m.stir).toBe(0);
    expect(m.foam).toBe(0);
    brakeMark(1, 0, 10, LENGTH, BEAM, m);
    expect(m.stir).toBe(0);
    brakeMark(0.5, 0.65, 10, LENGTH, BEAM, m);
    const half = m.stir;
    brakeMark(1, 0.65, 10, LENGTH, BEAM, m);
    expect(m.stir).toBeGreaterThan(half);
    expect(m.foam).toBeGreaterThan(0.5);
    expect(m.foam).toBeLessThanOrEqual(1);
  });

  it("is a pool wider than the hull that reaches past the bow, thrown further ahead at pace", () => {
    const stopped = hullMark();
    const fast = hullMark();
    brakeMark(1, 0.65, 0, LENGTH, BEAM, stopped);
    brakeMark(1, 0.65, BRAKE_PACE_FULL, LENGTH, BEAM, fast);
    expect(stopped.across).toBeGreaterThan(BEAM);
    expect(stopped.ahead + stopped.along).toBeGreaterThan(LENGTH / 2);
    expect(fast.ahead).toBeGreaterThan(stopped.ahead);
    expect(fast.along).toBeGreaterThan(stopped.along);
    expect(fast.across).toBeGreaterThan(stopped.across);
    // Backing up, the pool stands astern of where it stands going ahead.
    const astern = hullMark();
    brakeMark(1, 0.65, -3, LENGTH, BEAM, astern);
    expect(astern.ahead).toBeLessThan(stopped.ahead);
  });

  it("lays a wider road behind a braking hull than a driven one", () => {
    expect(BRAKE_ROAD_WIDEN).toBeGreaterThan(0);
    expect(roadHalf(BEAM * (1 + BRAKE_ROAD_WIDEN), 10, 1)).toBeGreaterThan(roadHalf(BEAM, 10, 1));
  });
});

describe("the trail's breaks", () => {
  it("closes where the hull leaves the water and OPENS where it comes back", () => {
    // The landing bug, as arithmetic. A trail is one ribbon, so a dead row
    // stitched straight to the next live one spans the whole flight with a
    // single quad — a wedge of road pointing back at the take-off, which is
    // the one stretch of water there is no wake on. A trail that resumes
    // must open with a dead row of its own so the void is spanned by two.
    expect(trailAction(false, "sample", false)).toBe("close");
    expect(trailAction(true, "gap", true)).toBe("open");
    expect(trailAction(true, "gap", false)).toBe("open");
    // The first sample of a run opens too: its neighbour is an unused slot
    // sitting at the world's origin.
    expect(trailAction(true, "none", true)).toBe("open");
  });

  it("lays a sample only once the transom has travelled, and closes once", () => {
    expect(trailAction(true, "sample", true)).toBe("lay");
    expect(trailAction(true, "sample", false)).toBe("none");
    // Already closed, and still out of the water: nothing, however long the
    // flight — one dead row, not one a step.
    expect(trailAction(false, "gap", false)).toBe("none");
    expect(trailAction(false, "none", true)).toBe("none");
  });
});
