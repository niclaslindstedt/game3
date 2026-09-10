// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SEA LIFE — R20, from three sides: the CATALOG (that the rows agree
// with themselves and that rarity means what the word says), the PLACER
// (that every pod a level carries is somewhere its species belongs), and
// the SWIM MODEL (that `faunaPose` is the pure function of the pod and the
// clock the whole design rests on).
//
// The rarity ladder gets a test of its own because it is the feature. A
// catalog that says a minke is legendary and then puts one on every coast
// has not made a whale rare, it has made the word meaningless — so the
// claim is checked the only way it can be, by generating a spread of
// levels and counting.

import { describe, expect, it } from "vitest";
import {
  FAUNA,
  FAUNA_IDS,
  type FaunaId,
  LEVEL_RULES as R,
  type Level,
  POD_LAYER,
  type Pod,
  biomeOf,
  faunaById,
  faunaCount,
  faunaPose,
  freshPose,
  fromEuler,
  generateLevel,
  isFaunaId,
  isMale,
  podClearance,
  rarityOf,
  sampleField,
  walkPod,
  withinBand,
} from "@engine";

import { LEVEL_SEEDS, analysisFor, levelFor } from "./support/levels.ts";

const TAU = Math.PI * 2;

/** Water depth at a plan point, m (positive down). */
function depthAt(level: Level, x: number, z: number): number {
  return -sampleField(level.ground, x, z);
}

describe("the catalog", () => {
  it("has one row per id and no id without a row", () => {
    expect(FAUNA.map((f) => f.id)).toEqual([...FAUNA_IDS]);
    expect(new Set(FAUNA_IDS).size).toBe(FAUNA.length);
    for (const id of FAUNA_IDS) expect(faunaById(id).id).toBe(id);
    expect(isFaunaId("herring")).toBe(true);
    expect(isFaunaId("kraken")).toBe(false);
  });

  it("states every band the right way round, and every number positive", () => {
    for (const spec of FAUNA) {
      for (const [name, band] of [
        ["school", spec.school],
        ["depth", spec.depth],
        ["offshore", spec.offshore],
        ["temperature", spec.temperature],
      ] as const) {
        expect(band.min, `${spec.id}.${name}`).toBeLessThanOrEqual(band.max);
      }
      expect(spec.length, spec.id).toBeGreaterThan(0);
      expect(spec.beam, spec.id).toBeGreaterThan(0);
      expect(spec.speed, spec.id).toBeGreaterThan(0);
      expect(spec.perKm, spec.id).toBeGreaterThan(0);
      expect(spec.school.min, spec.id).toBeGreaterThanOrEqual(1);
    }
  });

  it("keeps every animal in water it fits in — the depth it holds at is not the water it needs", () => {
    for (const spec of FAUNA) {
      // The deepest animal in the deepest pod of this species, plus its own
      // girth and the floor clearance, is what `podClearance` promises; the
      // species' own `water` may be more but must never be less than the
      // shallowest pod could need.
      const deepest = podClearance(spec, spec.depth.max);
      expect(deepest, spec.id).toBeGreaterThan(spec.depth.max);
      expect(podClearance(spec, spec.depth.min), spec.id).toBeGreaterThanOrEqual(spec.water);
      expect(spec.water, spec.id).toBeGreaterThan(spec.depth.min);
    }
  });

  it("only cetaceans breathe, and the one animal that basks does not", () => {
    for (const spec of FAUNA) {
      if (spec.kind === "cetacean") {
        expect(spec.breath, spec.id).toBeGreaterThan(0);
        expect(spec.bask, spec.id).toBe(0);
      } else {
        expect(spec.breath, spec.id).toBe(0);
      }
      if (spec.kind === "fish") expect(spec.bask, spec.id).toBe(0);
    }
    // The porbeagle is the whole reason `bask` exists: a fish that comes up
    // without needing air.
    expect(faunaById("shark").bask).toBeGreaterThan(0);
  });

  it("brings the fin of anything that comes up out, and nothing more", () => {
    for (const spec of FAUNA) {
      const comesUp = spec.breath > 0 || spec.bask > 0;
      // `awash` is the sighting, and the two go together or neither is set
      // at all. At most one radius down the back reaches the surface, so
      // the dorsal over it is clear; anything shallower would be an animal
      // riding on the sea rather than a fin cutting it.
      expect(spec.awash > 0, spec.id).toBe(comesUp);
      expect(spec.awash, spec.id).toBeLessThanOrEqual(1);
      expect(spec.breach, spec.id).toBeGreaterThanOrEqual(0);
      if (spec.breach > 0) expect(comesUp, spec.id).toBe(true);
    }
    // Only the dolphin leaves the water, and only its bulls.
    expect(FAUNA.filter((f) => f.breach > 0).map((f) => f.id)).toEqual(["dolphin"]);
  });

  it("gives a rarer animal a rarer word, in step with `perKm` and never against it", () => {
    const byRarity = [...FAUNA].sort((a, b) => b.perKm - a.perKm);
    const order = ["common", "uncommon", "scarce", "rare", "legendary"];
    let at = 0;
    for (const spec of byRarity) {
      const rank = order.indexOf(rarityOf(spec.perKm));
      expect(rank, `${spec.id} is ${rarityOf(spec.perKm)}`).toBeGreaterThanOrEqual(at);
      at = rank;
    }
    // The ladder is used: a catalog where everything is "common" would pass
    // the monotonicity above and mean nothing.
    expect(new Set(FAUNA.map((f) => rarityOf(f.perKm))).size).toBeGreaterThanOrEqual(4);
    expect(rarityOf(faunaById("herring").perKm)).toBe("common");
    expect(rarityOf(faunaById("minke").perKm)).toBe("legendary");
  });

  it("is offered by the coast, and the coast offers nothing that is not in it", () => {
    for (const id of biomeOf("taiga").fauna) expect(isFaunaId(id)).toBe(true);
  });
});

describe("R20 — the pods a level carries", () => {
  it("puts every pod where its species belongs", () => {
    for (const seed of LEVEL_SEEDS) {
      const level = levelFor(seed);
      const biome = biomeOf(level.biome);
      for (const pod of level.fauna) {
        const spec = faunaById(pod.species);
        expect(biome.fauna, `seed ${seed} ${pod.id}`).toContain(pod.species);
        expect(withinBand(level.water.temperature, spec.temperature)).toBe(true);
        expect(withinBand(pod.count, spec.school)).toBe(true);
        expect(withinBand(pod.depth, spec.depth)).toBe(true);
        const off = sampleField(level.offshore, pod.x, pod.z);
        expect(withinBand(off, spec.offshore, R.grid.cell)).toBe(true);
      }
    }
  });

  it("swims every loop over water the animal fits in, and clear of the rocks", () => {
    for (const seed of LEVEL_SEEDS) {
      const level = levelFor(seed);
      for (const pod of level.fauna) {
        const need = podClearance(faunaById(pod.species), pod.depth);
        walkPod(pod, (x, z) => {
          expect(depthAt(level, x, z), `seed ${seed} ${pod.id}`).toBeGreaterThan(need - 0.5);
          expect(x).toBeGreaterThanOrEqual(level.bounds.minX);
          expect(x).toBeLessThanOrEqual(level.bounds.maxX);
          for (const solid of level.solids) {
            expect(Math.hypot(solid.x - x, solid.z - z)).toBeGreaterThan(
              solid.r + R.fauna.clear - 0.5,
            );
          }
        });
      }
    }
  });

  it("is re-checked by the analyzer, which finds nothing to say about it", () => {
    for (const seed of LEVEL_SEEDS) {
      const findings = analysisFor(seed).findings.filter((f) => f.rule === "R20");
      expect(findings, `seed ${seed}`).toEqual([]);
    }
  });

  it("counts its animals for the roster", () => {
    const level = levelFor(LEVEL_SEEDS[0]);
    const byHand = level.fauna.reduce((n, p) => n + p.count, 0);
    expect(faunaCount(level.fauna)).toBe(byHand);
    expect(analysisFor(LEVEL_SEEDS[0]).stats.animals).toBe(byHand);
    expect(analysisFor(LEVEL_SEEDS[0]).stats.pods).toBe(level.fauna.length);
  });

  it("comes out the same on a second build of the same seed", () => {
    const again = generateLevel(LEVEL_SEEDS[1]);
    expect(again.fauna).toEqual(levelFor(LEVEL_SEEDS[1]).fauna);
  });

  it("names every pod once", () => {
    for (const seed of LEVEL_SEEDS) {
      const ids = levelFor(seed).fauna.map((p) => p.id);
      expect(new Set(ids).size, `seed ${seed}`).toBe(ids.length);
    }
  });
});

describe("the rarity a level actually delivers", () => {
  // One sweep, counted once: generating levels is the expensive thing here,
  // so the roster is built in a single pass and every claim reads it.
  const seen = new Map<FaunaId, number>();
  for (const seed of LEVEL_SEEDS) {
    for (const pod of levelFor(seed).fauna) {
      seen.set(pod.species, (seen.get(pod.species) ?? 0) + 1);
    }
  }
  const pods = (id: FaunaId): number => seen.get(id) ?? 0;

  it("crosses a school of herring on every coast and a whale on almost none", () => {
    expect(pods("herring")).toBeGreaterThan(LEVEL_SEEDS.length);
    expect(pods("minke")).toBeLessThan(LEVEL_SEEDS.length);
    expect(pods("orca")).toBeLessThan(LEVEL_SEEDS.length);
  });

  it("puts the common fish ahead of the rare visitors, every rung of the ladder", () => {
    // Counted PER LEVEL THE SPECIES IS IN SEASON FOR: R13 deals the corpus
    // its seasons, and a pike needs eight-degree water it only meets in
    // summer where a dolphin is in the sea from May to November — so the
    // ladder is a rule about `perKm` in the water the animal is in, and
    // that is what is compared.
    const inSeason = (id: FaunaId): number =>
      LEVEL_SEEDS.filter((seed) =>
        withinBand(levelFor(seed).water.temperature, faunaById(id).temperature),
      ).length;
    const rate = (id: FaunaId): number => pods(id) / Math.max(1, inSeason(id));
    // The ladder itself is the catalog's, and it is monotone rung by rung.
    const ladder: FaunaId[] = ["herring", "pike", "dolphin", "porpoise", "minke"];
    for (let i = 1; i < ladder.length; i++) {
      expect(faunaById(ladder[i - 1]).perKm).toBeGreaterThan(faunaById(ladder[i]).perKm);
    }
    // What the corpus delivers is a Poisson sample of it, and a dozen levels
    // is a sample, not a census: adjacent rungs may swap. What it may never
    // do is put the ends the wrong way round — a school of herring on every
    // in-season level, a whale on hardly any.
    expect(rate("herring")).toBeGreaterThan(1);
    expect(rate("herring")).toBeGreaterThan(rate("pike"));
    expect(rate("pike")).toBeGreaterThan(rate("minke"));
    expect(rate("dolphin")).toBeGreaterThan(rate("minke"));
    expect(rate("minke")).toBeLessThan(0.5);
  });
});

describe("the swim model", () => {
  /** A pod of the species: the corpus's own where it dealt one, and where
   * the corpus's seasons put every level's water outside the species' band
   * (a shark wants a summer sea), the corpus's first pod re-cast as that
   * species at its own catalog depth and school — the swim model reads the
   * loop and the spec, and nothing about a loop is a species'. */
  const podOf = (id: FaunaId): Pod => {
    for (const seed of LEVEL_SEEDS) {
      const hit = levelFor(seed).fauna.find((p) => p.species === id);
      if (hit) return hit;
    }
    const spec = faunaById(id);
    const template = levelFor(LEVEL_SEEDS[0]).fauna[0];
    if (!template) throw new Error("no pod in the corpus at all");
    return {
      ...template,
      id: `${template.id}-${id}`,
      species: id,
      count: spec.school.min,
      depth: (spec.depth.min + spec.depth.max) / 2,
    };
  };

  it("is a pure function of the pod and the clock", () => {
    const pod = podOf("herring");
    const a = faunaPose(pod, 2, 7.5, freshPose());
    const b = faunaPose(pod, 2, 7.5, freshPose());
    expect(b).toEqual(a);
  });

  it("closes its loop: a pod is back where it started after one period", () => {
    const pod = podOf("herring");
    const spec = faunaById(pod.species);
    const a = faunaPose(pod, 0, 0, freshPose());
    const b = faunaPose(pod, 0, pod.period, freshPose());
    // Within a body length, not exactly: the LOOP closes on the period, and
    // the weave riding on top of it runs on its own clock — which is the
    // whole reason a school does not read as a carousel.
    expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeLessThan(spec.length);
    // And the loop itself is bigger than that wobble, or there is no loop.
    // Half a period is the far side of it, so what that distance has to
    // beat is the loop's SHORT diameter — a pod's loop is an ellipse
    // (`ovality`), and where its phase starts on the short axis, the far
    // side is `2 · radius · ovality` away and no more.
    const half = faunaPose(pod, 0, pod.period / 2, freshPose());
    expect(Math.hypot(half.x - a.x, half.z - a.z)).toBeGreaterThan(
      2 * pod.radius * pod.ovality - spec.length,
    );
  });

  it("swims where it is pointing", () => {
    const pod = podOf("herring");
    const dt = 0.05;
    const a = faunaPose(pod, 0, 3, freshPose());
    const b = faunaPose(pod, 0, 3 + dt, freshPose());
    const moved = Math.atan2(b.x - a.x, b.z - a.z);
    const diff = Math.abs(((moved - a.heading + Math.PI * 3) % TAU) - Math.PI);
    expect(diff).toBeLessThan(0.25);
  });

  it("hands the host the same orientation the three angles mean", () => {
    const pod = podOf("porpoise");
    const pose = faunaPose(pod, 0, 4.25, freshPose());
    const q = fromEuler(pose.heading, pose.pitch, pose.roll);
    expect(pose.q.x).toBeCloseTo(q.x, 12);
    expect(pose.q.y).toBeCloseTo(q.y, 12);
    expect(pose.q.z).toBeCloseTo(q.z, 12);
    expect(pose.q.w).toBeCloseTo(q.w, 12);
  });

  it("keeps every animal off the bed, and out of the air unless it earned it", () => {
    for (const seed of LEVEL_SEEDS) {
      const level = levelFor(seed);
      const pose = freshPose();
      for (const pod of level.fauna) {
        const spec = faunaById(pod.species);
        // A rise never takes the centreline out of the water at all — only
        // the fin over it — so the one thing allowed above the waterline is
        // a breaching bull, and he is allowed a body length of air.
        const roof = spec.breach > 0 ? spec.length : 0;
        for (let i = 0; i < pod.count; i++) {
          for (let t = 0; t < pod.period; t += pod.period / 16) {
            faunaPose(pod, i, t, pose);
            expect(pose.y, `seed ${seed} ${pod.id}[${i}] at ${t.toFixed(1)}s`).toBeLessThanOrEqual(
              roof,
            );
            expect(pose.y).toBeGreaterThan(-depthAt(level, pose.x, pose.z));
          }
        }
      }
    }
  });

  it("holds an animal within its pod's own depth band", () => {
    const pod = podOf("perch");
    const pose = freshPose();
    for (let i = 0; i < pod.count; i++) {
      faunaPose(pod, i, 1.5, pose);
      expect(-pose.y).toBeLessThanOrEqual(pod.depth * (1 + POD_LAYER) + 1e-9);
      expect(-pose.y).toBeGreaterThanOrEqual(pod.depth * (1 - POD_LAYER) - 1e-9);
    }
  });

  it("never brings a fish up, and always brings a cetacean up", () => {
    const fish = podOf("perch");
    const pose = freshPose();
    for (let t = 0; t < 60; t += 0.5) {
      faunaPose(fish, 0, t, pose);
      expect(pose.surfacing).toBe(0);
    }
    const whale = podOf("porpoise");
    const breath = faunaById(whale.species).breath;
    let highest = 0;
    for (let t = 0; t < breath; t += breath / 400) {
      faunaPose(whale, 0, t, pose);
      highest = Math.max(highest, pose.surfacing);
    }
    // A breath brings the back through the surface: at the top of the roll
    // the animal's centreline is a fraction of its girth down, not metres.
    expect(highest).toBeGreaterThan(0.99);
    faunaPose(whale, 0, 0, pose);
    expect(pose.surfacing).toBeLessThan(1);
  });

  it("brings every finned animal's back awash and keeps its body in the water", () => {
    const pose = freshPose();
    for (const id of ["porpoise", "dolphin", "shark", "orca"] as const) {
      // A COW's breath: a bull's may be the one he throws a breach on, and
      // a breach leaves the water by design.
      const pod: Pod = { ...podOf(id), count: 40 };
      const cow = [...Array(pod.count).keys()].find((i) => !isMale(pod, i)) as number;
      const spec = faunaById(id);
      const every = spec.breath > 0 ? spec.breath : spec.bask;
      let highest = -Infinity;
      for (let t = 0; t < every; t += every / 600) {
        faunaPose(pod, cow, t, pose);
        highest = Math.max(highest, pose.y);
      }
      // Against y = 0 here because the datum is 0: on a real sea it is the
      // same depth under the swell. The back comes up to the surface —
      // which is what stands the fin over it — and the centreline stays
      // under it, so what shows is the fin and not the animal.
      const radius = 0.5 * spec.beam * spec.length;
      expect(highest, id).toBeLessThan(0);
      expect(highest + radius, id).toBeGreaterThanOrEqual(-1e-9);
      // The sweep can only undershoot the true peak, never pass it.
      const peak = -spec.awash * radius;
      expect(highest, id).toBeLessThanOrEqual(peak + 1e-9);
      expect(highest, id).toBeGreaterThan(peak * 1.01);
    }
  });

  it("measures every depth down from the water over the pod, not from y = 0", () => {
    const pod = podOf("dolphin");
    const flat = faunaPose(pod, 1, 6.25, freshPose());
    const crest = faunaPose(pod, 1, 6.25, freshPose(), 1.7);
    expect(crest.y - flat.y).toBeCloseTo(1.7, 9);
    // The datum lifts the animal and changes nothing else about it.
    expect(crest.x).toBe(flat.x);
    expect(crest.z).toBe(flat.z);
    expect(crest.pitch).toBe(flat.pitch);
    expect(crest.surfacing).toBe(flat.surfacing);
  });

  it("throws the bulls of a breaching species clear of the water and nobody else", () => {
    const spec = faunaById("dolphin");
    // A pod wide enough that both sexes are certainly in it — the corpus
    // deals a school of a handful and the sex of each is a hash.
    const pod: Pod = { ...podOf("dolphin"), count: 40 };
    const bulls: number[] = [];
    const cows: number[] = [];
    for (let i = 0; i < pod.count; i++) (isMale(pod, i) ? bulls : cows).push(i);
    expect(bulls.length).toBeGreaterThan(0);
    expect(cows.length).toBeGreaterThan(0);

    const pose = freshPose();
    const highestOf = (i: number): number => {
      let highest = -Infinity;
      for (let t = 0; t < spec.breach; t += spec.breach / 4000) {
        faunaPose(pod, i, t, pose);
        highest = Math.max(highest, pose.y);
      }
      return highest;
    };
    // A cow never gets her centreline out of the water at all; a bull
    // leaves it by most of his own length.
    const roof = -spec.awash * 0.5 * spec.beam * spec.length;
    for (const i of cows) expect(highestOf(i), `cow ${i}`).toBeLessThanOrEqual(roof + 1e-9);
    for (const i of bulls) expect(highestOf(i), `bull ${i}`).toBeGreaterThan(0.6 * spec.length);
  });

  it("flies the breach as one arc, with no kink where the water is", () => {
    const spec = faunaById("dolphin");
    const pod: Pod = { ...podOf("dolphin"), count: 40 };
    const bull = [...Array(pod.count).keys()].find((i) => isMale(pod, i));
    expect(bull).toBeDefined();
    const pose = freshPose();
    const dt = spec.breach / 8000;
    let previous = faunaPose(pod, bull as number, 0, pose).y;
    let jump = 0;
    let airborne = 0;
    let apex = 0;
    let top = 0;
    for (let t = dt; t < spec.breach; t += dt) {
      const y = faunaPose(pod, bull as number, t, pose).y;
      jump = Math.max(jump, Math.abs(y - previous));
      if (y > 0) airborne++;
      if (y > apex) {
        apex = y;
        top = pose.surfacing;
      }
      previous = y;
    }
    // The underwater drive is solved from the airborne parabola, so the
    // whole manoeuvre is one continuous curve: nothing ever moves more in a
    // step than the launch speed the apex implies, and a kink where the
    // water is would be a step of metres.
    expect(jump).toBeLessThan(1.05 * Math.sqrt(2 * 9.81 * apex) * dt);
    // And it is an EVENT, not a rhythm: a couple of seconds out of a
    // minute-long cycle.
    const air = (airborne * dt) / spec.breach;
    expect(air).toBeGreaterThan(0.01);
    expect(air).toBeLessThan(0.1);
    // Past 1 is what says "this is a leap, not a roll".
    expect(top).toBeGreaterThan(1);
  });

  it("beats a small tail faster than a big one", () => {
    const herring = podOf("herring");
    const porpoise = podOf("porpoise");
    const rate = (pod: Pod): number => {
      const a = faunaPose(pod, 0, 0, freshPose()).beat;
      const b = faunaPose(pod, 0, 1, freshPose()).beat;
      return b - a;
    };
    expect(rate(herring)).toBeGreaterThan(rate(porpoise));
  });
});
