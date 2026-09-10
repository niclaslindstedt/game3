// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SHORE'S COVER, DOM-FREE — the roster (`pwa/src/game/flora-defs.ts`)
// and the placer that lays it over a level (`flora-plan.ts`).
//
// A habitat row is a CLAIM about the coast — reed stands in shallow water
// off a sheltered bank, pine stands on dry bedrock, nothing with a trunk
// stands above the tree line — and a claim is worth holding. None of it is
// visible in a screenshot either: what the chase camera shows is the fifty
// metres of shore in front of the craft, so a species that has quietly
// stopped growing anywhere on the level, or one that has started growing
// out in the open sea, comes back looking exactly like a shore.
//
// The placer is deliberately three-free so this file can run it. What it
// cannot judge is whether any of it LOOKS right; that is `make flora` and
// `make screenshots`.
import { describe, expect, it } from "vitest";

import { FLORA_TILE, tileSpots } from "../pwa/src/game/flora.ts";
import { FLORA, TREE_LINE } from "../pwa/src/game/flora-defs.ts";
import { planFlora } from "../pwa/src/game/flora-plan.ts";
import { FLORA_SCALE } from "../pwa/src/game/settings-video.ts";
import { LEVEL_SEEDS, levelFor } from "./support/levels.ts";

/** The seeds this file plants. Fewer than the corpus, because planting a
 * shore is tens of thousands of field samples and the rules here are about
 * the roster rather than about the spread of coasts. */
const SEEDS = LEVEL_SEEDS.slice(0, 4);

const byId = (id: string) => {
  const spec = FLORA.find((s) => s.id === id);
  if (!spec) throw new Error(`no flora row "${id}"`);
  return spec;
};

/** Everything with a trunk — the rows the tree line is a claim about. */
const TREES = ["pine", "spruce", "birch", "aspen", "rowan", "alder"];

const planted = new Map<number, ReturnType<typeof planFlora>>();
function plantFor(seed: number): ReturnType<typeof planFlora> {
  let hit = planted.get(seed);
  if (hit === undefined) {
    hit = planFlora(levelFor(seed), FLORA_SCALE.lush);
    planted.set(seed, hit);
  }
  return hit;
}

describe("the flora roster", () => {
  it("has a unique id and an ordered height band for every row", () => {
    const ids = new Set<string>();
    for (const spec of FLORA) {
      expect(ids.has(spec.id), `duplicate id ${spec.id}`).toBe(false);
      ids.add(spec.id);
      expect(spec.look.height.min, spec.id).toBeGreaterThan(0);
      expect(spec.look.height.max, spec.id).toBeGreaterThan(spec.look.height.min);
      expect(spec.habitat.ground.max, spec.id).toBeGreaterThan(spec.habitat.ground.min);
      expect(spec.habitat.inland.max, spec.id).toBeGreaterThan(spec.habitat.inland.min);
      expect(spec.habitat.share, spec.id).toBeGreaterThan(0);
      expect(spec.look.spread, spec.id).toBeGreaterThan(0);
      expect(spec.look.stems, spec.id).toBeGreaterThanOrEqual(1);
      expect(spec.look.bare, spec.id).toBeLessThan(1);
    }
  });

  it("carries the leaf trees a Baltic shore is actually made of", () => {
    // The point of the roster: a taiga COAST is not a wall of conifer, and
    // a row quietly dropped from it takes a whole band of the shore with
    // it. Named rather than counted, because "at least six species" would
    // pass on six conifers.
    for (const id of ["birch", "alder", "willow", "aspen", "rowan"]) {
      expect(byId(id).habitat.share).toBeGreaterThan(0);
    }
  });

  it("keeps a riparian row rarer on the open coast than on the bank", () => {
    // The delta, stated: the whole difference between a river mouth and a
    // stretch of beach is that these rows take the bank over.
    for (const spec of FLORA) {
      if (!spec.habitat.riverside) continue;
      expect(spec.habitat.riverside.share, spec.id).toBeGreaterThan(spec.habitat.share);
      expect(spec.habitat.riverside.within, spec.id).toBeGreaterThan(0);
    }
    expect(byId("reed").habitat.riverside).toBeDefined();
  });

  it("stops every trunk at the tree line", () => {
    // `terrain.ts` paints the forest floor under exactly this number, so a
    // row allowed over it is a wood standing on bare rock the paint says
    // is bare.
    for (const id of TREES) {
      expect(byId(id).habitat.ground.max, id).toBeLessThanOrEqual(TREE_LINE);
    }
  });

  it("puts the reed in the water and the pine out of it", () => {
    expect(byId("reed").habitat.ground.min).toBeLessThan(0);
    expect(byId("reed").habitat.shelter).toBeGreaterThan(0);
    expect(byId("pine").habitat.ground.min).toBeGreaterThan(0);
    expect(byId("pine").habitat.surfaces).toContain("bedrock");
  });
});

describe("planting a shore", () => {
  it("grows every row of the roster somewhere across a spread of seeds", () => {
    // Per seed would be wrong — a coast with no river grows little reed and
    // one with no beach grows no lyme grass — but a row that appears on NO
    // seed is a row whose habitat can never be met, which is a silent
    // deletion.
    const total = FLORA.map(() => 0);
    for (const seed of SEEDS) {
      plantFor(seed).forEach((list, s) => (total[s] += list.length));
    }
    FLORA.forEach((spec, s) => {
      expect(total[s], `nothing planted anywhere for ${spec.id}`).toBeGreaterThan(0);
    });
  });

  it("plants nothing outside its own habitat's ground band", () => {
    for (const seed of SEEDS) {
      plantFor(seed).forEach((list, s) => {
        const { habitat, id } = FLORA[s];
        for (const p of list) {
          expect(p.y, `${id} on seed ${seed}`).toBeGreaterThanOrEqual(habitat.ground.min);
          expect(p.y, `${id} on seed ${seed}`).toBeLessThanOrEqual(habitat.ground.max);
          expect(p.h).toBeGreaterThanOrEqual(FLORA[s].look.height.min);
          expect(p.h).toBeLessThanOrEqual(FLORA[s].look.height.max);
        }
      });
    }
  });

  it("keeps the reed near a bank rather than out in the sea", () => {
    // Every reed the placer sets is either inside its riverside reach or on
    // a shore sheltered enough to have passed the ring, so the test that
    // actually bites is the SIMPLE one: a bed in three metres of water is
    // a bed nothing would find.
    const reed = FLORA.findIndex((s) => s.id === "reed");
    let stems = 0;
    for (const seed of SEEDS) {
      for (const p of plantFor(seed)[reed]) {
        expect(p.y).toBeGreaterThan(-1.5);
        stems++;
      }
    }
    expect(stems, "no reed on any seed").toBeGreaterThan(0);
  });

  it("plants the same shore twice for the same seed", () => {
    // §25.2 the other way round: the renderer draws on its OWN generator,
    // and a shore that moved between two loads of one seed would mean it
    // had found a clock or a `Math.random` somewhere.
    const seed = SEEDS[0];
    const a = planFlora(levelFor(seed), FLORA_SCALE.lush);
    const b = planFlora(levelFor(seed), FLORA_SCALE.lush);
    expect(b.map((l) => l.length)).toEqual(a.map((l) => l.length));
    expect(b[0][0]).toEqual(a[0][0]);
  });

  it("thins a stand by leaving its last plants out, never by redrawing it", () => {
    // What the DETAIL row promises: the sparse shore is the lush one with
    // its tail cut off, so moving the row never re-lays the wood.
    const seed = SEEDS[0];
    const lush = planFlora(levelFor(seed), FLORA_SCALE.lush);
    const sparse = planFlora(levelFor(seed), FLORA_SCALE.sparse);
    sparse.forEach((list, s) => {
      expect(list.length).toBeLessThanOrEqual(lush[s].length);
      for (let i = 0; i < list.length; i++) expect(list[i]).toEqual(lush[s][i]);
    });
  });
});

describe("the cover in tiles (flora.ts)", () => {
  // The renderer stands the cover up one instanced mesh a species per square
  // of shore, so three's frustum test can refuse the squares behind the lens
  // and the reach cull the ones past the fog. What that must not do is lose
  // or double a plant, or hand a tile a plant that stands outside it — a
  // tile's bounding sphere is built from the plants in it, and a plant a
  // tile does not know about is a plant that pops.
  const level = levelFor(LEVEL_SEEDS[0]);
  const spots = planFlora(level, FLORA_SCALE.lush);

  it("puts every plant in exactly one tile, in roster order, and every tile in one square", () => {
    spots.forEach((list, s) => {
      const tiles = tileSpots(list, FLORA_TILE);
      expect(
        tiles.reduce((n, t) => n + t.length, 0),
        FLORA[s].id,
      ).toBe(list.length);
      for (const tile of tiles) {
        expect(tile.length).toBeGreaterThan(0);
        // The DETAIL row thins by a plant's place on the species' whole
        // roster, and a tile can only draw its first n — so the order inside
        // a tile has to be the roster's.
        for (let i = 1; i < tile.length; i++) {
          expect(list.indexOf(tile[i])).toBeGreaterThan(list.indexOf(tile[i - 1]));
        }
        const ix = Math.floor(tile[0].x / FLORA_TILE);
        const iz = Math.floor(tile[0].z / FLORA_TILE);
        for (const p of tile) {
          expect(Math.floor(p.x / FLORA_TILE)).toBe(ix);
          expect(Math.floor(p.z / FLORA_TILE)).toBe(iz);
        }
      }
    });
  });

  it("cuts a coast into enough squares for a frustum test to be worth having", () => {
    // A tile is the unit the cull works in: one tile a species is the old
    // picture — every triangle of the coast submitted every frame — and the
    // whole point is that a chase camera sees a dozen of them out of many.
    const wood = spots[FLORA.findIndex((spec) => spec.id === "birch")];
    expect(tileSpots(wood, FLORA_TILE).length).toBeGreaterThan(12);
  });
});
