// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GENERATOR'S VERSIONS, and the three things about them that are only
// true because something refuses to let them stop being true.
//
// The scheme (engine/mapgen/versions.ts): a campaign level names the
// version of the generator its shore was curated under, that version keeps
// building it, and everything else in the game takes the current rules.
// Three halves of it fail SILENTLY without a case here:
//
//   * A LEVEL POINTING AT NOTHING. A version pruned while a level still
//     named it does not throw — `generatorTraits` falls back to the
//     current rules — so the level quietly becomes a different shore.
//   * A MUSEUM. A legacy version nobody names any more costs nothing to
//     leave in, so it gets left in, and the branch it keeps alive is read
//     and worked around by every session after this one.
//   * THE RULES MOVING UNDER A PINNED SHORE. Nothing in the generator knows
//     that seed 5 used to put its third gate somewhere else, so every level
//     is REBUILT here and held to the digest it was curated with. When this
//     goes red, read `versions.ts`'s header before touching a digest: a
//     level deliberately moved writes its new digest down; the rules
//     moving under one that did not owes a version row instead.
//
// Thirty-six builds is the cost of that last case, which is why this is its
// own file: on a shard it is the whole file's floor.

import { describe, expect, it } from "vitest";

import {
  CURRENT_GENERATOR_VERSION,
  GENERATOR_VERSIONS,
  GENERATOR_VERSION_IDS,
  generateLevel,
  generatorTraits,
  isGeneratorVersion,
  levelDigest,
} from "@engine";

import { CAMPAIGN_LEVELS, buildCampaignLevel, shoreOf } from "../pwa/src/game/campaign.ts";
import { LEVEL_SEEDS, levelFor } from "./support/levels.ts";

/** Every version the committed campaign actually stands on. */
const pinned = new Set(CAMPAIGN_LEVELS.map((level) => level.version));

describe("the generator's version registry", () => {
  it("counts up, with no version stated twice", () => {
    expect(GENERATOR_VERSION_IDS.length).toBeGreaterThan(0);
    expect(new Set(GENERATOR_VERSION_IDS).size).toBe(GENERATOR_VERSION_IDS.length);
    for (const row of GENERATOR_VERSIONS) {
      expect(Number.isInteger(row.version), `v${row.version} is not a whole number`).toBe(true);
      expect(row.note.length, `v${row.version} has no note saying what it is`).toBeGreaterThan(0);
    }
    expect(GENERATOR_VERSION_IDS, "the rows are not oldest-first").toEqual(
      [...GENERATOR_VERSION_IDS].sort((a, b) => a - b),
    );
  });

  it("names the LAST row as the current one", () => {
    expect(CURRENT_GENERATOR_VERSION).toBe(GENERATOR_VERSION_IDS[GENERATOR_VERSION_IDS.length - 1]);
    expect(Math.max(...GENERATOR_VERSION_IDS)).toBe(CURRENT_GENERATOR_VERSION);
  });

  it("hands an unknown version the current rules rather than throwing", () => {
    expect(isGeneratorVersion(CURRENT_GENERATOR_VERSION)).toBe(true);
    for (const bogus of [0, -1, 1_000_000, 1.5, "1", null, undefined]) {
      expect(isGeneratorVersion(bogus), String(bogus)).toBe(false);
    }
    expect(generatorTraits(1_000_000).version).toBe(CURRENT_GENERATOR_VERSION);
    expect(generatorTraits(undefined).version).toBe(CURRENT_GENERATOR_VERSION);
  });

  it("stamps every level with the version that built it, the current one by default", () => {
    expect(levelFor(LEVEL_SEEDS[0]).version).toBe(CURRENT_GENERATOR_VERSION);
    expect(generateLevel(LEVEL_SEEDS[0], { version: 1_000_000 }).version).toBe(
      CURRENT_GENERATOR_VERSION,
    );
  });
});

describe("what the campaign pins", () => {
  it("gives every level a version this build can still build", () => {
    for (const level of CAMPAIGN_LEVELS) {
      expect(
        isGeneratorVersion(level.version),
        `${level.id} names generator v${level.version}, which this build no longer carries — ` +
          "either restore the row in engine/mapgen/versions.ts or move the level onto a " +
          "version that exists (a curation: re-rate, re-time, re-name, write the new digest)",
      ).toBe(true);
    }
  });

  it("keeps no legacy version the campaign has stopped naming", () => {
    const stale = GENERATOR_VERSION_IDS.filter(
      (version) => version !== CURRENT_GENERATOR_VERSION && !pinned.has(version),
    );
    expect(
      stale,
      `no campaign level names generator v${stale.join(", v")} any more — delete the row from ` +
        "engine/mapgen/versions.ts and every trait branch that only existed for it",
    ).toEqual([]);
  });

  for (const level of CAMPAIGN_LEVELS) {
    it(`${level.id} (seed ${level.seed}, v${level.version}) still builds the shore it was curated on`, () => {
      const built = buildCampaignLevel(level);
      expect(built.version).toBe(level.version);
      expect(built.biome).toBe(shoreOf(level).id);
      expect(built.track).toBe(level.track);
      expect(built.tricks).toBe(level.mode === "tricks");
      expect(built.swell).toBeCloseTo(level.swell, 6);
      if (level.laps !== undefined) expect(built.course.laps).toBe(level.laps);
      expect(
        levelDigest(built),
        `${level.id} builds to a different shore from the one it pins — read engine/mapgen/versions.ts's header: ` +
          "a level deliberately moved writes the new digest down in campaign-levels.ts; the rules " +
          "moving under one that did not owes a version row, not a new digest",
      ).toBe(level.digest);
    });
  }
});
