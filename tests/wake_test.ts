// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WAKE'S SHAPE (pwa/src/game/wake-profile.ts): what the map behind the
// craft carries, by speed and by age. The claims the reference photograph
// makes — a road that outlives its boil, dense fan foam that opens gradually
// inside the Kelvin wave, a crawl that stirs the water and whitens none of
// it — held as arithmetic, since how it LOOKS is `make screenshots`'s.

import { describe, expect, it } from "vitest";

import { WASH_GROUP } from "@engine";

import {
  BOIL_RUN,
  BRAKE_PACE_FULL,
  BRAKE_ROAD_WIDEN,
  CRATER_LIFE,
  CUSP_WAVE,
  FAN_HALF_MAX,
  FAN_LIFE,
  JET_STALL,
  KELVIN_TAN,
  RING_LIFE,
  RING_SPEED,
  ROAD_LIFE,
  SPEED_FULL,
  SPEED_MIN,
  SPLASH_LIFE,
  SPLASH_STATIONS,
  TRANSOM_CLEAR,
  TURN_FULL,
  WAKE_HEIGHT,
  WAKE_MAP_BACK,
  WAKE_REACH,
  brakeMark,
  fanAt,
  fanCusp,
  fanHalf,
  armAt,
  hullMark,
  jetAt,
  jetHalf,
  moundAt,
  jetBlast,
  jetMark,
  roadAt,
  roadHalf,
  roadStrength,
  splashAt,
  splashReach,
  splashStations,
  sternAt,
  sternHalf,
  trailAction,
  turnBias,
  wakeBirthBack,
  wakeSection,
  washOf,
} from "../pwa/src/game/wake-profile.ts";

const BEAM = 1.2;
const LENGTH = 2.7;
/** What the fan carries at the same place, to hold the road against: far
 * astern the road may not out-white the wedge it is supposed to melt into. */
const FAN_FOAM_AT_PACE = (() => {
  const s = wakeSection();
  fanAt(0.8, 2, 15, 1, s);
  return s.foam;
})();

describe("the road", () => {
  it("is white only once the pump is churning at pace, and whiter on the throttle", () => {
    expect(roadStrength(SPEED_MIN - 0.5, 1)).toBe(0);
    expect(roadStrength(20, 1)).toBeGreaterThan(roadStrength(20, 0));
    expect(roadStrength(20, 0)).toBeGreaterThan(0);
    expect(roadStrength(20, 1)).toBeLessThanOrEqual(1);
  });

  it("is narrow under the hull, opens into the boil, then necks behind it", () => {
    // The hard head row is hidden inside the hull and narrower than its
    // chines. The boil opens after the stern has passed, then collapses
    // within a few metres before the old road starts spreading again.
    //
    // MEASURED DOWN THE TRAIL, NOT DOWN THE CLOCK. The bulb stands at a
    // fixed place in the craft's frame, so aged instead of placed it
    // stretched with the speed: at pace it was two thirds present ten
    // metres back, and the road was one flat band a beam and a half wide
    // for the whole near field.
    const speed = 25;
    const origin = roadHalf(BEAM, speed, 0, 0);
    let bulb = 0;
    let bulbAt = 0;
    for (let astern = 0; astern < 40; astern += 0.25) {
      const half = roadHalf(BEAM, speed, astern / speed, astern);
      if (half > bulb && astern < BOIL_RUN * 4) [bulb, bulbAt] = [half, astern];
    }
    expect(origin * 2).toBeLessThan(BEAM);
    expect(bulbAt).toBeGreaterThan(0.5);
    expect(bulb).toBeGreaterThan(origin * 1.3);
    // …and the bulb is a BULB: gone within a few metres whatever the pace,
    // where aged it was still most of the way there.
    const far = roadHalf(BEAM, speed, 10 / speed, 10);
    expect(far).toBeLessThan(bulb * 0.85);
    // …then spreads, slowly, with age — the road is the THIN bright line
    // down the middle of the photograph; what opens is the fan round it.
    expect(roadHalf(BEAM, speed, ROAD_LIFE, 40)).toBeGreaterThan(far);
  });

  it("outlives its boil, settles into the wedge behind it, never negative", () => {
    const s = wakeSection();
    roadAt(0, 0.3, 15, 1, s, 4);
    const fresh = { ...s };
    roadAt(0, 2, 15, 1, s, 30);
    const settled = { ...s };
    expect(fresh.foam).toBeGreaterThan(0.6);
    expect(settled.churn).toBeLessThan(fresh.churn);
    // Far back the road must be well under the fan's own white, and not
    // merely below it: the marks are rasterised ADDITIVELY, so a road
    // still carrying half its share lands on top of the fan already there
    // and draws a bright line down the middle of the whole wedge.
    expect(settled.foam).toBeLessThan(FAN_FOAM_AT_PACE * 0.4);
    expect(settled.foam).toBeGreaterThan(0);
    roadAt(0, ROAD_LIFE + 0.01, 15, 1, s, 60);
    expect(s.cover).toBe(0);
    for (const age of [0, 1, 3, 5.9]) {
      roadAt(0, age, 15, 1, s, age * 15);
      expect(s.foam).toBeGreaterThanOrEqual(0);
      expect(s.foam).toBeLessThanOrEqual(1);
    }
  });

  it("feathers to nothing at its edge, and carries no relief of its own", () => {
    const s = wakeSection();
    roadAt(1, 0.2, 15, 1, s);
    expect(s.cover).toBe(0);
    roadAt(0, 0.2, 15, 1, s);
    expect(s.cover).toBe(1);
    // The road is a beam wide and the water reads its relief blurred to
    // about two metres, so a hollow laid here was a third of its depth by
    // the time a vertex stood on it. The shape belongs to the stern wave,
    // which is laid wide enough for the grid to see.
    for (const age of [0, 0.05, 0.3, 2]) {
      roadAt(0, age, 15, 1, s);
      expect(s.up).toBe(0);
      expect(s.down).toBe(0);
    }
  });
});

describe("the stern wave", () => {
  it("is wider than the relief blur, which is why it exists", () => {
    // Two metres is what `WAKE_RELIEF_LOD` blurs the relief to, and the
    // near grid's cell is a metre and a half: a mark narrower than that is
    // held by the map and never seen by the water.
    expect(sternHalf(BEAM, 0) * 2).toBeGreaterThan(4);
    expect(sternHalf(BEAM, 20)).toBeGreaterThan(sternHalf(BEAM, 0));
  });

  it("lays nothing until the transom has cleared", () => {
    // Past a Froude number of about two on the transom's own immersion the
    // flow stops closing behind the corner and the hollow appears. Below
    // it there is no hollow to have.
    const s = wakeSection();
    expect(TRANSOM_CLEAR).toBeGreaterThan(2);
    expect(TRANSOM_CLEAR).toBeLessThan(4);
    sternAt(0, 1, 2, TRANSOM_CLEAR * 0.9, 1, BEAM, s);
    expect(s.down).toBe(0);
    expect(s.up).toBe(0);
    sternAt(0, 1, 2, TRANSOM_CLEAR * 3, 1, BEAM, s);
    expect(s.down).toBeGreaterThan(0);
  });

  it("bends the water DOWN at the transom and UP again at the crossing", () => {
    // The claim the mark is for, and the one a plan view cannot make:
    // along the axis the surface drops behind the transom, comes back
    // through the still line and stands PROUD of it where the fan's two
    // rails meet. Everything further out — the arms of the V — is the
    // engine's wash, and this map does not restate it.
    const s = wakeSection();
    const mound = moundAt(BEAM, 1);
    sternAt(0, 0.2, 2, 20, 1, BEAM, s);
    const behind = { ...s };
    sternAt(0, mound, 2, 20, 1, BEAM, s);
    const crest = { ...s };
    expect(behind.down).toBeGreaterThan(0.05);
    expect(behind.up).toBeLessThan(behind.down);
    expect(crest.up).toBeGreaterThan(crest.down);
    expect(crest.up).toBeGreaterThan(behind.down);
    expect(crest.up).toBeLessThan(WAKE_HEIGHT);
  });

  it("puts the crossing where the fan's rails meet, and a pump throws it further back", () => {
    // Not a free number: half a beam over the tangent of Kelvin's angle,
    // stretched by the one factor the grid forces.
    const bare = moundAt(BEAM, 0);
    expect(bare).toBeGreaterThan(BEAM / (2 * KELVIN_TAN));
    expect(moundAt(BEAM, 1)).toBeGreaterThan(bare);
    expect(moundAt(2 * BEAM, 0)).toBeCloseTo(2 * bare, 5);
  });

  it("carries no arms of its own: the V's crests are the engine's wash", () => {
    // The map's relief stops at the hull's own footprint. Off the axis,
    // past the mound, the section lifts nothing — the diverging crests a
    // rider looks back at are real water (`engine/game/wash.ts`), which
    // the hull feels and the grid is displaced by, and a second copy here
    // would be the same wave drawn twice. The geometry of the arms stays,
    // for the fan's white and the cover to follow.
    const s = wakeSection();
    for (const run of [8, 20, 40]) {
      for (let a = 0.5; a <= 1; a += 0.05) {
        sternAt(a, run, 4, 20, 1, BEAM, s);
        expect(s.up).toBe(0);
      }
    }
    expect(armAt(BEAM, 0)).toBeCloseTo(BEAM / 2, 5);
    expect(armAt(BEAM, 20) - armAt(BEAM, 0)).toBeCloseTo(20 * KELVIN_TAN, 5);
  });

  it("closes its hollow astern by degrees, and is flat well back", () => {
    // The map's relief is the hull's own footprint: the hollow fills over
    // the first tens of metres, step by step rather than at a line, and
    // far astern the surface is the engine's — the sea and the wash.
    const s = wakeSection();
    const hollow = (run: number) => {
      let best = 0;
      for (let a = 0; a <= 1; a += 0.01) {
        sternAt(a, run, 4, 20, 1, BEAM, s);
        if (s.down > best) best = s.down;
      }
      return best;
    };
    const steps = [8, 16, 24, 32, 40].map(hollow);
    expect(hollow(0.5)).toBeGreaterThan(steps[0]);
    for (let i = 1; i < steps.length; i++) expect(steps[i]).toBeLessThan(steps[i - 1]);
    expect(steps[steps.length - 1]).toBeLessThan(0.01);
  });

  it("forms over a moment rather than at a step, and carries no white", () => {
    const s = wakeSection();
    sternAt(0, 1, 0, 20, 1, BEAM, s);
    expect(s.down).toBe(0);
    sternAt(0, 1, 0.03, 20, 1, BEAM, s);
    const early = s.down;
    sternAt(0, 1, 0.4, 20, 1, BEAM, s);
    expect(early).toBeGreaterThan(0);
    expect(s.down).toBeGreaterThan(early * 2);
    // The road and the fan own the white; a third contributor to that
    // channel over the same water only drives the lace past saturation.
    expect(s.foam).toBe(0);
    expect(s.churn).toBe(0);
  });
});

describe("the fan", () => {
  it("opens continuously inside the Kelvin V, up to a distant cap", () => {
    // Dense broken water opens at a steady share of the physical wave's
    // Kelvin angle. The cusps ride on top, so the claim is the RATE: twice
    // the age, twice the spread, whatever the wobble at this station.
    const at = (speed: number, age: number) => fanHalf(BEAM, speed, age);
    expect((at(15, 0.5) - at(5, 0.5)) / (at(15, 1) - at(5, 1))).toBeCloseTo(0.5, 5);
    expect(at(15, 1) - at(5, 1)).toBeGreaterThan(10 * 1 * KELVIN_TAN * 0.15);
    expect(at(15, 1) - at(5, 1)).toBeLessThan(10 * 1 * KELVIN_TAN * 0.3);
    // …and the cap holds it: a faster hull does not open a wider V once it
    // is there, and the cap is a width, not a wobble.
    expect(at(30, FAN_LIFE)).toBe(at(60, FAN_LIFE));
    expect(at(30, FAN_LIFE)).toBeGreaterThan(FAN_HALF_MAX * 0.9);
    expect(at(30, FAN_LIFE)).toBeLessThan(FAN_HALF_MAX * 1.1);
  });

  it("keeps opening gradually across the whole near-water map", () => {
    // The reference wake is a long narrow taper, not a broad wedge that
    // arrives between two speed samples. It is still opening at the map's
    // far edge and remains well inside the faint physical stern-wave arms.
    const speed = 20;
    const reach = (WAKE_MAP_BACK + WAKE_REACH) / speed;
    expect(reach).toBeLessThan(FAN_LIFE);
    expect(fanHalf(BEAM, speed, 1)).toBeGreaterThan(fanHalf(BEAM, speed, 0.5) * 1.4);
    expect(fanHalf(BEAM, speed, reach)).toBeGreaterThan(fanHalf(BEAM, speed, reach / 2) * 1.5);
    expect(fanHalf(BEAM, speed, reach)).toBeLessThan(FAN_HALF_MAX * 0.75);
    expect(fanHalf(BEAM, speed, reach)).toBeLessThan(armAt(BEAM, reach * speed));
    const s = wakeSection();
    fanAt(0.8, reach, speed, 1, s);
    expect(s.foam).toBeGreaterThan(0.2);
    // …and the road under it outlives the map too.
    expect(ROAD_LIFE).toBeGreaterThan(reach);
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
    expect(fanHalf(BEAM, 15, 2)).toBeGreaterThan(roadHalf(BEAM, 15, 2) * 3.5);
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

  it("carries no relief: the shape of the wedge is the stern wave's", () => {
    const s = wakeSection();
    for (const at of [0.1, 0.5, 0.8, 1]) {
      fanAt(at, 0.5, 15, 1, s);
      expect(s.up).toBe(0);
      expect(s.down).toBe(0);
    }
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
    // …and a craft on the plane stirs it harder, and whitens it at all.
    const stirred = s.churn;
    fanAt(0.8, 0.3, 15, roadStrength(15, 1), s);
    expect(s.churn).toBeGreaterThan(stirred);
    expect(s.foam).toBeGreaterThan(0);
    // The SHAPE that pace throws is the stern wave's, and it is not there
    // at a crawl at all: below the transom's clearing speed nothing has
    // ventilated and there is no hollow to overshoot out of.
    const mound = moundAt(BEAM, 1);
    sternAt(0, mound, 2, crawl, roadStrength(crawl, 1), BEAM, s);
    expect(s.up).toBe(0);
    sternAt(0, mound, 2, 15, roadStrength(15, 1), BEAM, s);
    expect(s.up).toBeGreaterThan(0);
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

  it("laces the ring white at the wash's group speed, thinning as it goes, and lifts nothing", () => {
    // The ring wave itself is the engine's (`engine/game/wash.ts`); what
    // the map carries is the white on its crest, which has to ride where
    // the water is actually moving — the wash's packet, at its group speed.
    const s = wakeSection();
    const laceAt = (age: number) => {
      let best = -1;
      let at = 0;
      for (let r = RADIUS + 0.5; r < splashReach(RADIUS, age, 1); r += 0.02) {
        splashAt(r, RADIUS, age, 1, DEPTH, 1, s);
        expect(s.up).toBe(0);
        if (s.foam > best) {
          best = s.foam;
          at = r;
        }
      }
      return { r: at, foam: best };
    };
    const early = laceAt(0.5);
    const late = laceAt(1.5);
    expect(RING_SPEED).toBe(WASH_GROUP);
    expect(late.r - early.r).toBeCloseTo(RING_SPEED, 1);
    expect(late.foam).toBeLessThan(early.foam);
    expect(early.foam).toBeGreaterThan(0);
    // …and gone once it has lived its life.
    splashAt(RADIUS + RING_SPEED * (RING_LIFE + 0.1), RADIUS, RING_LIFE + 0.1, 1, DEPTH, 1, s);
    expect(s.foam).toBe(0);
  });

  it("is the DETAIL row's: no lace at a ring share of nought, no crater at no depth", () => {
    const s = wakeSection();
    for (let r = RADIUS + 1; r < 8; r += 0.1) {
      splashAt(r, RADIUS, 0.6, 1, DEPTH, 0, s);
      expect(s.foam).toBe(0);
      splashAt(r, RADIUS, 0.6, 1, 0, 1, s);
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

describe("the jet", () => {
  it("begins under the hull as a thin nozzle before opening astern", () => {
    const physicalTransom = LENGTH / 2 - 0.35;
    expect(physicalTransom - wakeBirthBack(LENGTH, -0.35)).toBeCloseTo(0.45, 5);
    const j = jetMark();
    jetBlast(1, 0, true, LENGTH, BEAM, j);
    expect(jetHalf(0, j.halfNozzle, j.halfReach) * 2).toBeLessThan(BEAM * 0.3);
    expect(jetHalf(0.2, j.halfNozzle, j.halfReach)).toBeLessThan(
      jetHalf(1, j.halfNozzle, j.halfReach) * 0.6,
    );
    const stopped = { ...j };
    jetBlast(1, SPEED_FULL * 0.75, true, LENGTH, BEAM, j);
    expect(j.reach).toBeGreaterThan(stopped.reach * 3);
    expect(j.halfReach).toBeGreaterThan(stopped.halfReach * 2.5);
  });

  it("blasts astern from a standstill, before the hull has laid anything", () => {
    // The thing the trail was missing: every other mark is something the
    // hull's PASSAGE left, so with the throttle open and the craft not yet
    // moving the whole sea was blank. A waterjet at rest is not doing
    // nothing.
    const j = jetMark();
    jetBlast(1, 0, true, LENGTH, BEAM, j);
    expect(j.blast).toBeCloseTo(1, 5);
    expect(j.reach).toBeGreaterThan(LENGTH * 0.5);
    expect(j.reach).toBeLessThan(LENGTH);
    // …and the road at that moment is laying nothing at all, which is what
    // makes the jet the only thing on the water.
    expect(roadStrength(0, 1)).toBe(0);
  });

  it("hands its PILE-UP over to the road, and keeps the stream itself", () => {
    // One hand-over, not two numbers: a jet that let go first leaves a
    // stretch of open throttle with nothing on the water.
    expect(JET_STALL).toBe(SPEED_FULL);
    const j = jetMark();
    jetBlast(1, 0, true, LENGTH, BEAM, j);
    const stopped = { ...j };
    jetBlast(1, SPEED_FULL / 2, true, LENGTH, BEAM, j);
    const half = j.blast;
    expect(j.reach).toBeGreaterThan(stopped.reach);
    expect(j.halfReach).toBeGreaterThan(stopped.halfReach);
    expect(half).toBeGreaterThan(0.3);
    expect(roadStrength(SPEED_FULL / 2, 1)).toBeGreaterThan(0.3);
    // …but the pump does not stop firing because the hull is moving. What
    // the hand-over settles is where the churned water ends up — piled in
    // one place standing still, strung into the road at pace — and the
    // stream out of the nozzle is still there at the far end of it, which
    // is when an aerial photograph shows it most clearly of all.
    jetBlast(1, SPEED_FULL, true, LENGTH, BEAM, j);
    const paced = { ...j };
    jetBlast(1, SPEED_FULL * 3, true, LENGTH, BEAM, j);
    expect(paced.blast).toBeGreaterThan(0.3);
    expect(paced.blast).toBeLessThan(half);
    expect(j.blast).toBeCloseTo(paced.blast, 5);
    expect(roadStrength(SPEED_FULL, 1)).toBeCloseTo(1, 5);
    // …and it stays JUST BEHIND THE CRAFT however fast it is going: a
    // couple of hull lengths at pace, never drawn out down the trail. The
    // long bright line down the middle of the wedge is the ROAD's, and a
    // stream stretched to match it stops reading as a stream at all.
    expect(j.reach).toBeCloseTo(paced.reach, 5);
    expect(paced.reach).toBeGreaterThan(LENGTH);
    expect(paced.reach).toBeLessThan(LENGTH * 3.5);
  });

  it("is nothing at all when the hull is not in the water", () => {
    // The jet is laid off the craft's STATE, not off the trail, so nothing
    // stopped it when the hull left the water: a rider who drives up the
    // beach with the throttle open parks above the sea still churning
    // white into the map and lifting a surface that is not under them.
    const j = jetMark();
    jetBlast(1, 0, false, LENGTH, BEAM, j);
    expect(j.blast).toBe(0);
    expect(j.reach).toBe(0);
    jetBlast(1, 0, true, LENGTH, BEAM, j);
    expect(j.blast).toBeGreaterThan(0);
  });

  it("is the pump's, not the hull's: nothing on a shut throttle", () => {
    const j = jetMark();
    jetBlast(0, 0, true, LENGTH, BEAM, j);
    expect(j.blast).toBe(0);
    expect(j.reach).toBe(0);
    jetBlast(0.5, 0, true, LENGTH, BEAM, j);
    expect(j.blast).toBeCloseTo(0.5, 5);
  });

  it("is a tongue: whitest at the nozzle, gone by its reach, and digging only where it leaves", () => {
    const s = wakeSection();
    jetAt(0, 0, 1, s);
    const nozzle = { ...s };
    jetAt(1, 0, 1, s);
    const end = { ...s };
    expect(nozzle.foam).toBeGreaterThan(0.6);
    expect(end.foam).toBeLessThan(nozzle.foam * 0.1);
    // The stream drives down and back, so the surface it leaves at the
    // nozzle is a trench — and by the far end it is foam lying on water.
    expect(nozzle.down).toBeGreaterThan(0);
    expect(end.down).toBe(0);
    // …and it piles what it scoured out into a mound further along, which
    // is the water sprouting up behind a craft that has not moved yet —
    // the stern wave's own mound before there is a stern wave.
    expect(nozzle.up).toBeLessThan(0.01);
    jetAt(0.42, 0, 1, s);
    expect(s.up).toBeGreaterThan(0.05);
    expect(s.up).toBeLessThan(WAKE_HEIGHT);
    jetAt(1, 0, 1, s);
    expect(s.up).toBeLessThan(0.01);
    // Across: a flat core with an edge, not a cone of speckles.
    jetAt(0, 0.4, 1, s);
    expect(s.foam).toBeCloseTo(nozzle.foam, 5);
    jetAt(0, 1, 1, s);
    expect(s.foam).toBe(0);
  });
});
