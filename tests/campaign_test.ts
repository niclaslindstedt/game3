// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CAMPAIGN, RIDDEN FOR POINTS (`pwa/src/game/campaign.ts`): three for
// a level win, two for second, one for third; the next LEVEL behind a
// podium or a medal, the next SHORE behind the table those points build.
//
// Every lock here fails SILENTLY without a case — either it hands a player
// a shore they did not earn, or it takes one they did:
//
//   * AN EMPTY TABLE THE PLAYER LEADS. Nobody has scored, everybody is on
//     nought, and the tie-break puts the player on top — which would open
//     the second shore before a level had been ridden.
//   * A REPLAY THAT COSTS A TITLE. A level ridden again for fun must never
//     lower what it already paid.
//   * A MEDAL THAT IS NOT A DOOR. A tricks level clears on the medal and
//     places on the field; the two must not be confused.
//   * A LADDER THAT LEAKS. The level after this one is a podium away; the
//     shore after this one is the whole table away.
//   * A SAVE FROM ANOTHER BUILD. A blob naming a level the ladder no longer
//     has, or a hull the roster no longer carries, must not poison the
//     board — and a board played on a ladder of a different SHAPE has to be
//     moved onto this one rather than read rung for rung, because the ids
//     are the rung numbers and re-cutting a shore renames what was ridden.
//   * A BOARD WITH A HOLE IN IT. The developer page sets the ladder outright
//     (`unlockShores` / `lockShores`), and a prefix that is not a prefix is a
//     state the campaign itself would never deal — a shore standing open
//     behind one that has never been ridden.
//
// The levels themselves — that each pinned shore still builds to its
// digest — are `generator_version_test`'s; this file never generates one.

import { describe, expect, it } from "vitest";

import {
  CRAFT_IDS,
  GENERATOR_VERSION_IDS,
  RACE,
  SWELL_DIAL,
  WEATHER_IDS,
  LEVEL_RULES,
  biomeOf,
  daylightWindow,
} from "@engine";

import {
  CAMPAIGN_LEVELS,
  EMPTY_PROGRESS,
  LADDER_VERSION,
  MEDALS,
  PLAYER_ID,
  PODIUM,
  POINTS,
  SHORES,
  betterThan,
  campaignStanding,
  continueAt,
  findLevel,
  fitsMode,
  ladderAfter,
  levelCleared,
  levelForMode,
  levelsForMode,
  levelUnlocked,
  levelsRidden,
  medalFor,
  mergeProgress,
  playerStanding,
  pointsFor,
  recordRun,
  riderKey,
  shoreOf,
  shoreStandings,
  shoreUnlocked,
  shoreWon,
  lockShores,
  unlockRows,
  unlockShores,
  type CampaignProgress,
} from "../pwa/src/game/campaign.ts";
import { GAME_MODES } from "@engine";

const [MANGROVE, TAIGA, ARCTIC, KARST] = SHORES;

/** How many rungs a shore runs. Named rather than written out, because
 * every count below is the same fact and a ladder that grows again should
 * move one number. */
const RUNGS = 8;

/** The field as it stood at a finish: the player at `place`, the rivals in
 * slot order around him. */
function order(place: number, field = RACE.rivals + 1): (number | null)[] {
  const out: (number | null)[] = [];
  let slot = 0;
  for (let i = 1; i <= field; i++) out.push(i === place ? null : slot++);
  return out;
}

/** A shore ridden through at `place` on every level, tricks levels scored
 * `score`. */
function rideShore(
  progress: CampaignProgress,
  shore: (typeof SHORES)[number],
  place: number,
  score = 10_000,
): CampaignProgress {
  let out = progress;
  for (const level of shore.levels) {
    out = recordRun(out, level, {
      value: level.mode === "tricks" ? score : 120,
      craft: "skiff",
      order: order(place),
    });
  }
  return out;
}

describe("the ladder as committed", () => {
  it("is four shores of eight, the warm one first, one race one tricks run all the way up", () => {
    expect(SHORES.map((s) => s.id)).toEqual(["mangrove", "taiga", "arctic", "karst"]);
    for (const shore of SHORES) {
      expect(shore.levels.length).toBe(RUNGS);
      expect(shore.levels.filter((l) => l.mode === "race").length).toBe(RUNGS / 2);
      expect(shore.levels.filter((l) => l.mode === "tricks").length).toBe(RUNGS / 2);
      // THE ALTERNATION IS THE LADDER'S SHAPE and not a coincidence of
      // curation: a shore never asks the same game twice running, the race
      // leads, and the finale is a tricks run.
      expect(shore.levels.map((l) => l.mode)).toEqual(
        Array.from({ length: RUNGS }, (_l, i) => (i % 2 === 0 ? "race" : "tricks")),
      );
      // The ids ARE the rung numbers — a board is keyed by them, and
      // `mergeProgress` moves an older ladder's rows on that arithmetic.
      expect(shore.levels.map((l) => l.id)).toEqual(
        Array.from({ length: RUNGS }, (_l, i) => `${shore.id}-${i + 1}`),
      );
      // One lapped circuit a shore, and it is the third rung's race (R29).
      expect(shore.levels.filter((l) => l.track === "circuit").map((l) => l.id)).toEqual([
        `${shore.id}-3`,
      ]);
      // The tricks runs lengthen as they climb, and the finale is the only
      // six-minute rung in the game.
      expect(shore.levels.filter((l) => l.mode === "tricks").map((l) => l.minutes)).toEqual([
        2, 3, 4, 6,
      ]);
      // No shore rides the same water twice.
      const shores = shore.levels.map((l) => `${l.seed}/${l.mode}`);
      expect(new Set(shores).size).toBe(RUNGS);
    }
    expect(CAMPAIGN_LEVELS.length).toBe(SHORES.length * RUNGS);
    expect(new Set(CAMPAIGN_LEVELS.map((l) => l.id)).size).toBe(CAMPAIGN_LEVELS.length);
    expect(new Set(CAMPAIGN_LEVELS.map((l) => l.name)).size).toBe(CAMPAIGN_LEVELS.length);
  });

  it("pins a whole day on every level, inside what the generator would deal", () => {
    for (const level of CAMPAIGN_LEVELS) {
      const biome = biomeOf(shoreOf(level).id);
      expect(level.hour).toBeGreaterThanOrEqual(0);
      expect(level.hour).toBeLessThan(24);
      // R13 — A RUN NEVER STARTS IN THE DARK. The generator draws its hour
      // from inside the coast's own daylight window in the season it deals,
      // and a pinned hour is a DIFFERENT hour dealt by hand, so nothing in
      // the engine holds one to that. It is the same rule all the same: the
      // clock then runs on at an hour a minute, so a last-light start is a
      // run that rides INTO the night and a start past sunset is one the
      // rider never sees the coast on. A polar coast in the midnight sun has
      // no crossings at all and `daylightWindow` hands back nothing, which
      // is every hour of the clock.
      const window = daylightWindow(
        biome.latitude,
        LEVEL_RULES.day.minSun,
        biome.declination[level.season],
      );
      if (window) {
        expect(level.hour, `${level.id} starts in the dark`).toBeGreaterThanOrEqual(window.min);
        expect(level.hour, `${level.id} starts in the dark`).toBeLessThanOrEqual(window.max);
      }
      expect(biome.weathers, `${level.id} pins a sky its coast never offers`).toContain(
        level.weather,
      );
      expect(WEATHER_IDS).toContain(level.weather);
      expect(level.wind).toBeGreaterThanOrEqual(LEVEL_RULES.wind.speed.min);
      expect(level.wind).toBeLessThanOrEqual(LEVEL_RULES.wind.speed.max);
      expect(level.swell).toBeGreaterThanOrEqual(SWELL_DIAL.min);
      expect(level.swell).toBeLessThanOrEqual(SWELL_DIAL.max);
      expect(GENERATOR_VERSION_IDS).toContain(level.version);
      expect(level.digest).toMatch(/^[0-9a-f]{8}$/);
      expect(level.blurb.length).toBeGreaterThan(10);
      if (level.mode === "tricks") {
        expect(level.minutes).toBeGreaterThan(0);
        expect(level.medals).toBeDefined();
        const m = level.medals!;
        expect(m.bronze).toBeLessThan(m.silver);
        expect(m.silver).toBeLessThan(m.gold);
      } else {
        expect(level.minutes).toBeUndefined();
        expect(level.medals).toBeUndefined();
      }
    }
  });

  it("names no place — a level is named for what it is like", () => {
    // The biome test holds the whole tree to naming no country or sea;
    // this is the cheaper half for the names a player reads.
    for (const level of CAMPAIGN_LEVELS) {
      expect(level.name).not.toMatch(/\b(bay|island|point|cape|sound|strait|harbour|harbor)\b/i);
    }
  });

  it("finds a level by id, and its shore", () => {
    const found = findLevel("taiga-3");
    expect(found?.shore).toBe(TAIGA);
    expect(found?.index).toBe(2);
    expect(found && shoreOf(found.level)).toBe(TAIGA);
    expect(findLevel("nowhere-9")).toBeNull();
  });
});

describe("what a place is worth", () => {
  it("pays the podium three, two and one, and nothing below it", () => {
    expect(POINTS).toEqual([3, 2, 1]);
    expect(PODIUM).toBe(3);
    expect([1, 2, 3, 4, 12].map(pointsFor)).toEqual([3, 2, 1, 0, 0]);
  });

  it("keys the player and every rival apart on the board", () => {
    expect(riderKey(null)).toBe(PLAYER_ID);
    expect(riderKey(0)).not.toBe(PLAYER_ID);
    expect(riderKey(0)).not.toBe(riderKey(1));
  });

  it("pays a medal on a tricks level from its own thresholds, and none on a race", () => {
    const tricks = MANGROVE.levels[1];
    const m = tricks.medals!;
    expect(medalFor(tricks, m.bronze - 1)).toBeNull();
    expect(medalFor(tricks, m.bronze)).toBe("bronze");
    expect(medalFor(tricks, m.silver)).toBe("silver");
    expect(medalFor(tricks, m.gold * 3)).toBe("gold");
    expect(medalFor(MANGROVE.levels[0], 1e9)).toBeNull();
    expect(MEDALS).toEqual(["bronze", "silver", "gold"]);
  });

  it("reads better as lower on a race and higher on a tricks run", () => {
    expect(betterThan(MANGROVE.levels[0], 100, 120)).toBe(true);
    expect(betterThan(MANGROVE.levels[0], 120, 100)).toBe(false);
    expect(betterThan(MANGROVE.levels[1], 900, 500)).toBe(true);
    expect(betterThan(MANGROVE.levels[1], 500, 900)).toBe(false);
  });
});

describe("a run, booked", () => {
  const race = MANGROVE.levels[0];
  const tricks = MANGROVE.levels[1];

  it("files the whole field's points and the player's result", () => {
    const after = recordRun(EMPTY_PROGRESS, race, { value: 130, craft: "dart", order: order(2) });
    expect(after.results[race.id]).toEqual({ best: 130, craft: "dart", place: 2, medal: null });
    const board = after.points[race.id];
    expect(board[PLAYER_ID]).toBe(2);
    expect(board[riderKey(0)]).toBe(3);
    expect(board[riderKey(1)]).toBe(1);
    expect(board[riderKey(2)]).toBe(0);
    expect(Object.keys(board).length).toBe(RACE.rivals + 1);
    // Nothing of the input was touched.
    expect(EMPTY_PROGRESS).toEqual({ results: {}, points: {} });
  });

  it("keeps the better afternoon on the board, and the best figure on its own", () => {
    const won = recordRun(EMPTY_PROGRESS, race, { value: 130, craft: "dart", order: order(1) });
    // A faster time but a worse place: the figure improves, the board and
    // the place do not move.
    const again = recordRun(won, race, { value: 110, craft: "skiff", order: order(5) });
    expect(again.results[race.id]).toEqual({ best: 110, craft: "skiff", place: 1, medal: null });
    expect(again.points[race.id]).toEqual(won.points[race.id]);
    // A slower time and the same win: nothing moves at all.
    const same = recordRun(again, race, { value: 140, craft: "otter", order: order(1) });
    expect(same.results[race.id].best).toBe(110);
    expect(same.results[race.id].craft).toBe("skiff");
  });

  it("clears a tricks level on the medal and places it on the field", () => {
    const m = tricks.medals!;
    // Last of the field, but a bronze: cleared.
    const bronze = recordRun(EMPTY_PROGRESS, tricks, {
      value: m.bronze,
      craft: "skiff",
      order: order(12),
    });
    expect(bronze.results[tricks.id].medal).toBe("bronze");
    expect(bronze.results[tricks.id].place).toBe(12);
    expect(levelCleared(bronze, tricks)).toBe(true);
    expect(bronze.points[tricks.id][PLAYER_ID]).toBe(0);
    // A win with no medal: points, and still shut.
    const won = recordRun(EMPTY_PROGRESS, tricks, {
      value: m.bronze - 1,
      craft: "skiff",
      order: order(1),
    });
    expect(won.results[tricks.id].medal).toBeNull();
    expect(won.points[tricks.id][PLAYER_ID]).toBe(3);
    expect(levelCleared(won, tricks)).toBe(false);
    // The best medal stands whatever the later run did.
    const gold = recordRun(bronze, tricks, { value: m.gold, craft: "skiff", order: order(12) });
    const later = recordRun(gold, tricks, { value: 1, craft: "skiff", order: order(12) });
    expect(later.results[tricks.id].medal).toBe("gold");
    expect(later.results[tricks.id].best).toBe(m.gold);
  });

  it("clears a race on the podium and not below it", () => {
    for (let place = 1; place <= RACE.rivals + 1; place++) {
      const after = recordRun(EMPTY_PROGRESS, race, {
        value: 100,
        craft: "skiff",
        order: order(place),
      });
      expect(levelCleared(after, race), `place ${place}`).toBe(place <= PODIUM);
    }
  });
});

describe("how far the campaign has got, as the front door bills it", () => {
  const race = MANGROVE.levels[0];
  const tricks = MANGROVE.levels[1];

  it("counts CLEARED levels over the whole ladder, not ridden ones and not one shore", () => {
    expect(campaignStanding(EMPTY_PROGRESS)).toEqual({
      cleared: 0,
      of: SHORES.flatMap((s) => s.levels).length,
    });

    // Ridden and lost is not cleared: the rung is still standing there.
    const lost = recordRun(EMPTY_PROGRESS, race, {
      value: 100,
      craft: "skiff",
      order: order(RACE.rivals + 1),
    });
    expect(lost.results[race.id]).toBeDefined();
    expect(campaignStanding(lost).cleared).toBe(0);

    // A podium clears it, and the figure is over EVERY shore's levels — a
    // door whose count reset when a new shore opened would read as progress
    // being taken away.
    const won = recordRun(EMPTY_PROGRESS, race, { value: 90, craft: "skiff", order: order(1) });
    expect(campaignStanding(won).cleared).toBe(1);
    expect(campaignStanding(won).of).toBe(SHORES.reduce((n, shore) => n + shore.levels.length, 0));

    const both = recordRun(won, tricks, {
      value: tricks.medals!.bronze,
      craft: "skiff",
      order: order(12),
    });
    expect(campaignStanding(both).cleared).toBe(2);
  });
});

describe("the locks", () => {
  it("opens the first level of the first shore and holds every other shut", () => {
    expect(levelUnlocked(MANGROVE, 0, EMPTY_PROGRESS)).toBe(true);
    for (let i = 1; i < RUNGS; i++) expect(levelUnlocked(MANGROVE, i, EMPTY_PROGRESS)).toBe(false);
    expect(shoreUnlocked(MANGROVE, EMPTY_PROGRESS)).toBe(true);
    for (const shut of SHORES.slice(1)) {
      expect(shoreUnlocked(shut, EMPTY_PROGRESS), shut.id).toBe(false);
      expect(levelUnlocked(shut, 0, EMPTY_PROGRESS), shut.id).toBe(false);
    }
  });

  it("opens the next level behind a podium, and not behind a fourth", () => {
    const fourth = recordRun(EMPTY_PROGRESS, MANGROVE.levels[0], {
      value: 100,
      craft: "skiff",
      order: order(4),
    });
    expect(levelUnlocked(MANGROVE, 1, fourth)).toBe(false);
    const third = recordRun(fourth, MANGROVE.levels[0], {
      value: 100,
      craft: "skiff",
      order: order(3),
    });
    expect(levelUnlocked(MANGROVE, 1, third)).toBe(true);
    expect(levelUnlocked(MANGROVE, 2, third)).toBe(false);
  });

  it("does not open the second shore on an empty table the player leads", () => {
    expect(playerStanding(MANGROVE, EMPTY_PROGRESS).place).toBe(1);
    expect(shoreWon(MANGROVE, EMPTY_PROGRESS)).toBe(false);
    expect(shoreUnlocked(TAIGA, EMPTY_PROGRESS)).toBe(false);
  });

  it("is won by every level ridden and the table topped, and lost by a run of thirds", () => {
    const thirds = rideShore(EMPTY_PROGRESS, MANGROVE, 3);
    expect(levelsRidden(MANGROVE, thirds)).toBe(RUNGS);
    // Every level cleared, so the ladder inside the shore is open to the end.
    for (let i = 0; i < RUNGS; i++) expect(levelUnlocked(MANGROVE, i, thirds)).toBe(true);
    // ...but a rival has won every level, and the shore is his.
    expect(playerStanding(MANGROVE, thirds).place).toBeGreaterThan(1);
    expect(shoreWon(MANGROVE, thirds)).toBe(false);
    expect(shoreUnlocked(TAIGA, thirds)).toBe(false);
    const wins = rideShore(thirds, MANGROVE, 1);
    expect(shoreWon(MANGROVE, wins)).toBe(true);
    expect(shoreUnlocked(TAIGA, wins)).toBe(true);
    expect(levelUnlocked(TAIGA, 0, wins)).toBe(true);
    expect(levelUnlocked(TAIGA, 1, wins)).toBe(false);
  });

  it("holds the polar shore behind the COLD one's table, not the warm one's", () => {
    // The shores are a PREFIX (`shoreUnlocked`), so a shore two along is
    // two whole tables away and neither of them can be skipped. Worth its
    // own case because the arithmetic that opens a second shore opens every
    // shore after it too, and the bug it would hide is the far end of the
    // campaign standing open on a fresh board.
    const warm = rideShore(EMPTY_PROGRESS, MANGROVE, 1);
    expect(shoreUnlocked(TAIGA, warm)).toBe(true);
    expect(shoreUnlocked(ARCTIC, warm)).toBe(false);
    expect(levelUnlocked(ARCTIC, 0, warm)).toBe(false);
    // The cold shore ridden and lost leaves it shut; won, it opens — and
    // only its first rung.
    const thirds = rideShore(warm, TAIGA, 3);
    expect(levelsRidden(TAIGA, thirds)).toBe(RUNGS);
    expect(shoreUnlocked(ARCTIC, thirds)).toBe(false);
    const cold = rideShore(thirds, TAIGA, 1);
    expect(shoreWon(TAIGA, cold)).toBe(true);
    expect(shoreUnlocked(ARCTIC, cold)).toBe(true);
    expect(levelUnlocked(ARCTIC, 0, cold)).toBe(true);
    expect(levelUnlocked(ARCTIC, 1, cold)).toBe(false);
    expect(continueAt(ARCTIC, cold)).toBe(ARCTIC.levels[0]);
  });

  it("is not won while a level has never been ridden, however the rest went", () => {
    let progress = EMPTY_PROGRESS;
    for (const level of MANGROVE.levels.slice(0, -1)) {
      progress = recordRun(progress, level, { value: 10_000, craft: "skiff", order: order(1) });
    }
    expect(playerStanding(MANGROVE, progress).place).toBe(1);
    expect(shoreWon(MANGROVE, progress)).toBe(false);
  });

  it("adds a shore up for the whole field, and breaks a tie on wins then to the player", () => {
    const progress = rideShore(EMPTY_PROGRESS, MANGROVE, 2);
    const table = shoreStandings(MANGROVE, progress);
    expect(table.length).toBe(RACE.rivals + 1);
    expect(table[0].id).toBe(riderKey(0));
    expect(table[0].points).toBe(POINTS[0] * RUNGS);
    expect(table[0].wins).toBe(RUNGS);
    expect(table[1].you).toBe(true);
    expect(table[1].points).toBe(POINTS[1] * RUNGS);
    expect(table[1].place).toBe(2);
    // Everybody else on nought, in slot order behind the two who scored.
    expect(table.slice(3).every((row) => row.points === 0)).toBe(true);
    // An empty board: all level, and the player first on the tie-break.
    expect(shoreStandings(MANGROVE, EMPTY_PROGRESS)[0].you).toBe(true);
  });

  it("picks the campaign back up: forward first, then back for the wins", () => {
    expect(continueAt(MANGROVE, EMPTY_PROGRESS)).toBe(MANGROVE.levels[0]);
    const second = recordRun(EMPTY_PROGRESS, MANGROVE.levels[0], {
      value: 100,
      craft: "skiff",
      order: order(2),
    });
    expect(continueAt(MANGROVE, second)).toBe(MANGROVE.levels[1]);
    const thirds = rideShore(EMPTY_PROGRESS, MANGROVE, 3);
    expect(continueAt(MANGROVE, thirds)).toBe(MANGROVE.levels[0]);
    const wins = rideShore(EMPTY_PROGRESS, MANGROVE, 1);
    expect(continueAt(MANGROVE, wins)).toBeNull();
    expect(continueAt(TAIGA, EMPTY_PROGRESS)).toBeNull();
  });

  it("offers the next rung, the lock, or the end of the road", () => {
    expect(ladderAfter("mangrove-1", EMPTY_PROGRESS)).toEqual({ kind: "locked", shore: MANGROVE });
    const podium = recordRun(EMPTY_PROGRESS, MANGROVE.levels[0], {
      value: 100,
      craft: "skiff",
      order: order(1),
    });
    expect(ladderAfter("mangrove-1", podium)).toEqual({ kind: "next", level: MANGROVE.levels[1] });
    const thirds = rideShore(EMPTY_PROGRESS, MANGROVE, 3);
    expect(ladderAfter("mangrove-8", thirds)).toEqual({ kind: "locked", shore: MANGROVE });
    const wins = rideShore(EMPTY_PROGRESS, MANGROVE, 1);
    expect(ladderAfter("mangrove-8", wins)).toEqual({ kind: "next", level: TAIGA.levels[0] });
    // …and the cold shore's table opens the POLAR one rather than ending the
    // road, which is the whole of what adding a shore does to the ladder.
    const cold = rideShore(wins, TAIGA, 1);
    expect(ladderAfter("taiga-8", cold)).toEqual({ kind: "next", level: ARCTIC.levels[0] });
    // …and the polar shore's table opens the LIMESTONE one, whose finale is
    // the end of the road.
    const polar = rideShore(cold, ARCTIC, 1);
    expect(ladderAfter("arctic-8", polar)).toEqual({ kind: "next", level: KARST.levels[0] });
    expect(ladderAfter("karst-8", rideShore(polar, KARST, 1))).toEqual({ kind: "end" });
    expect(ladderAfter("nowhere-1", wins)).toEqual({ kind: "end" });
  });
});

describe("the developer's locks (unlockShores, lockShores)", () => {
  // The whole point of the page: the last rung is four evenings away, and
  // every review pass of this game has to LOOK at it.
  it("opens a shore, and every shore before it with it", () => {
    const opened = unlockShores(EMPTY_PROGRESS, TAIGA.id);
    expect(shoreWon(MANGROVE, opened)).toBe(true);
    expect(shoreWon(TAIGA, opened)).toBe(true);
    expect(shoreUnlocked(TAIGA, opened)).toBe(true);
    for (const level of TAIGA.levels) expect(levelCleared(opened, level)).toBe(true);
    // …and nothing in FRONT of it: the polar shore is a press of its own.
    expect(shoreWon(ARCTIC, opened)).toBe(false);
    expect(campaignStanding(opened)).toEqual({
      cleared: MANGROVE.levels.length + TAIGA.levels.length,
      of: CAMPAIGN_LEVELS.length,
    });
  });

  it("opens the FIRST shore without touching the one behind it", () => {
    const opened = unlockShores(EMPTY_PROGRESS, MANGROVE.id);
    expect(shoreWon(MANGROVE, opened)).toBe(true);
    // The second shore opens because the FIRST was won, and is untouched
    // itself: its levels are all still there to ride.
    expect(shoreUnlocked(TAIGA, opened)).toBe(true);
    expect(levelsRidden(TAIGA, opened)).toBe(0);
    expect(levelUnlocked(TAIGA, 1, opened)).toBe(false);
  });

  it("puts the player top of every board it grants", () => {
    const opened = unlockShores(EMPTY_PROGRESS, null);
    for (const shore of SHORES) {
      const table = shoreStandings(shore, opened);
      expect(table[0].you).toBe(true);
      expect(table[0].wins).toBe(shore.levels.length);
      expect(playerStanding(shore, opened).points).toBe(POINTS[0] * shore.levels.length);
    }
    // ...and the podium behind him, so the table reads like a season and not
    // like a row of walkovers on an empty board.
    const board = opened.points[MANGROVE.levels[0].id];
    expect(board[PLAYER_ID]).toBe(POINTS[0]);
    expect(board[riderKey(0)]).toBe(POINTS[1]);
  });

  it("clears a tricks rung with the gold it takes, and quotes no figure", () => {
    const opened = unlockShores(EMPTY_PROGRESS, null);
    const tricks = CAMPAIGN_LEVELS.filter((level) => level.mode === "tricks");
    expect(tricks.length).toBeGreaterThan(0);
    for (const level of tricks) {
      expect(opened.results[level.id].medal).toBe(MEDALS[MEDALS.length - 1]);
    }
    // NOBODY RODE IT, so the box has nothing to quote: a grant that invented
    // a time would put a lap on the card that was never ridden.
    for (const level of CAMPAIGN_LEVELS) {
      expect(opened.results[level.id].best).toBeUndefined();
      expect(opened.results[level.id].craft).toBeUndefined();
    }
  });

  it("keeps a figure that was actually ridden", () => {
    const ridden = recordRun(EMPTY_PROGRESS, MANGROVE.levels[0], {
      value: 111,
      craft: "dart",
      order: order(5),
    });
    const opened = unlockShores(ridden, null);
    const result = opened.results[MANGROVE.levels[0].id];
    expect(result.best).toBe(111);
    expect(result.craft).toBe("dart");
    expect(result.place).toBe(1);
  });

  it("lets the first run down an opened level set the figure", () => {
    const opened = unlockShores(EMPTY_PROGRESS, null);
    const level = MANGROVE.levels[0];
    const after = recordRun(opened, level, { value: 130, craft: "otter", order: order(4) });
    expect(after.results[level.id].best).toBe(130);
    expect(after.results[level.id].craft).toBe("otter");
    // ...and it cannot cost the grant: the place kept is the better of the
    // two, exactly as a second afternoon's is.
    expect(after.results[level.id].place).toBe(1);
  });

  it("shuts a shore and every shore after it", () => {
    const opened = unlockShores(EMPTY_PROGRESS, null);
    const shut = lockShores(opened, TAIGA.id);
    expect(shoreWon(MANGROVE, shut)).toBe(true);
    expect(levelsRidden(TAIGA, shut)).toBe(0);
    expect(shut.points[TAIGA.levels[0].id]).toBeUndefined();
    // The shore is still OPEN — the one before it was won — and it is the
    // levels inside it that are back to being ridden for.
    expect(shoreUnlocked(TAIGA, shut)).toBe(true);
    expect(levelUnlocked(TAIGA, 1, shut)).toBe(false);
  });

  it("goes all the way back, and all the way forward, on null", () => {
    const shut = lockShores(unlockShores(EMPTY_PROGRESS, null), null);
    expect(shut).toEqual(EMPTY_PROGRESS);
    expect(campaignStanding(shut)).toEqual({ cleared: 0, of: CAMPAIGN_LEVELS.length });
    expect(shoreUnlocked(TAIGA, shut)).toBe(false);
  });

  it("never leaves the ladder with a hole in it", () => {
    // A shore standing OPEN behind one that has never been ridden is the one
    // state the campaign itself cannot deal, and both presses work on a
    // prefix precisely so that neither can produce it.
    const boards = [
      EMPTY_PROGRESS,
      ...SHORES.map((shore) => unlockShores(EMPTY_PROGRESS, shore.id)),
      ...SHORES.map((shore) => lockShores(unlockShores(EMPTY_PROGRESS, null), shore.id)),
    ];
    for (const board of boards) {
      let behind = true;
      for (const shore of SHORES) {
        if (!shoreUnlocked(shore, board)) behind = false;
        else expect(behind).toBe(true);
      }
    }
  });

  it("leaves a stored board it can read back", () => {
    const opened = unlockShores(EMPTY_PROGRESS, null);
    expect(mergeProgress(JSON.parse(JSON.stringify({ v: LADDER_VERSION, ...opened })))).toEqual(
      opened,
    );
  });

  it("says which press still has something to do", () => {
    const fresh = unlockRows(EMPTY_PROGRESS);
    expect(fresh.map((row) => row.won)).toEqual(SHORES.map(() => false));
    expect(fresh.map((row) => row.shut)).toEqual(SHORES.map(() => true));
    expect(fresh.map((row) => row.open)).toEqual(SHORES.map((_s, i) => i === 0));
    expect(fresh[0]).toMatchObject({ cleared: 0, of: MANGROVE.levels.length });

    const all = unlockRows(unlockShores(EMPTY_PROGRESS, null));
    expect(all.map((row) => row.won)).toEqual(SHORES.map(() => true));
    expect(all.map((row) => row.shut)).toEqual(SHORES.map(() => false));
    expect(all[1].cleared).toBe(TAIGA.levels.length);

    // The FIRST shore won and everything in front of it untouched: its own
    // unlock is spent, the rest are not, and their locks have nothing left
    // either.
    const first = unlockRows(unlockShores(EMPTY_PROGRESS, MANGROVE.id));
    expect(first.map((row) => row.won)).toEqual(SHORES.map((_s, i) => i === 0));
    expect(first.map((row) => row.shut)).toEqual(SHORES.map((_s, i) => i > 0));
  });
});

/** A board as it is STORED: the shape it was played on, then the rows. */
function stored(progress: CampaignProgress): unknown {
  return JSON.parse(JSON.stringify({ v: LADDER_VERSION, ...progress }));
}

describe("a stored board", () => {
  it("survives a round trip", () => {
    const progress = rideShore(EMPTY_PROGRESS, MANGROVE, 2, 3000);
    expect(mergeProgress(stored(progress))).toEqual(progress);
  });

  it("drops what this build cannot stand on, and keeps the rest", () => {
    const blob = {
      v: LADDER_VERSION,
      results: {
        "mangrove-1": { best: 100, craft: "skiff", place: 1, medal: null },
        "mangrove-2": { best: 800, craft: "skiff", place: 4, medal: "platinum" },
        "atoll-1": { best: 100, craft: "skiff", place: 1, medal: null },
        "mangrove-3": { best: "fast", craft: "skiff", place: 1, medal: null },
        "mangrove-4": { best: 100, craft: "hovercraft", place: 1, medal: null },
        "mangrove-5": { best: 100, craft: "skiff", place: 0, medal: null },
      },
      points: {
        "mangrove-1": { [PLAYER_ID]: 3, r0: 2, r1: "one" },
        "atoll-1": { [PLAYER_ID]: 3 },
      },
    };
    const merged = mergeProgress(blob);
    expect(Object.keys(merged.results)).toEqual(["mangrove-1", "mangrove-2"]);
    expect(merged.results["mangrove-2"].medal).toBeNull();
    expect(merged.points).toEqual({ "mangrove-1": { [PLAYER_ID]: 3, r0: 2 } });
    expect(CRAFT_IDS).not.toContain("hovercraft");
  });

  it("moves a board played on the six-rung ladder onto this one", () => {
    // THE BOARD IS A PLAYER'S SAVE. The shores grew from six rungs to eight
    // and the ids are the rung numbers, so a row written on the old ladder
    // names a rung that is now somebody else's: its 4, 5 and 6 are this
    // ladder's 5, 6 and 7 — the same seeds in the same modes — while 1, 2
    // and 3 did not move. Read without that, "LONG SWELL" would come back
    // as a time against a tricks rung nobody rode.
    const before = {
      results: {
        "mangrove-1": { best: 100, craft: "skiff", place: 1, medal: null },
        "mangrove-4": { best: 140, craft: "dart", place: 2, medal: null },
        "mangrove-5": { best: 900, craft: "otter", place: 3, medal: "bronze" },
        "mangrove-6": { best: 150, craft: "skiff", place: 1, medal: null },
      },
      points: { "mangrove-6": { [PLAYER_ID]: 3, r0: 2 } },
    };
    const merged = mergeProgress(before);
    expect(Object.keys(merged.results).sort()).toEqual([
      "mangrove-1",
      "mangrove-5",
      "mangrove-6",
      "mangrove-7",
    ]);
    // Each row landed on the level it was actually ridden on: the old 4 is
    // this ladder's LONG SWELL, still a race, still seed 41.
    expect(MANGROVE.levels[4].id).toBe("mangrove-5");
    expect(MANGROVE.levels[4].mode).toBe("race");
    expect(merged.results["mangrove-5"]).toEqual({
      best: 140,
      craft: "dart",
      place: 2,
      medal: null,
    });
    expect(merged.results["mangrove-6"].medal).toBe("bronze");
    expect(merged.points).toEqual({ "mangrove-7": { [PLAYER_ID]: 3, r0: 2 } });
    // The two rungs the re-cut ADDED are open ground: nothing claims them.
    expect(merged.results["mangrove-4"]).toBeUndefined();
    expect(merged.results["mangrove-8"]).toBeUndefined();
    // ...and a board already on this ladder is left exactly where it is.
    expect(mergeProgress({ v: LADDER_VERSION, ...before })).toEqual({
      results: {
        "mangrove-1": { best: 100, craft: "skiff", place: 1, medal: null },
        "mangrove-4": { best: 140, craft: "dart", place: 2, medal: null },
        "mangrove-5": { best: 900, craft: "otter", place: 3, medal: "bronze" },
        "mangrove-6": { best: 150, craft: "skiff", place: 1, medal: null },
      },
      points: { "mangrove-6": { [PLAYER_ID]: 3, r0: 2 } },
    });
  });

  it("is empty from nothing at all", () => {
    for (const junk of [null, undefined, 4, "board", [], { results: 3, points: "x" }]) {
      expect(mergeProgress(junk)).toEqual({ results: {}, points: {} });
    }
  });
});

describe("the pinned shores, offered outside the campaign (fitsMode)", () => {
  // RACE, TRICKS and TIME TRIAL pick one of these rather than a seed
  // (`menu-levels.tsx`), so a level has to say which of them may ride it.
  // It fails silently both ways: a discipline offered a shore that was not
  // built for it rides a level the campaign's own box never shows, and one
  // offered nothing at all is a front-door tile that opens onto a hole.
  it("gives a race shore to the two modes ridden down a course", () => {
    const race = CAMPAIGN_LEVELS.filter((level) => level.mode === "race");
    expect(race.length).toBeGreaterThan(0);
    for (const level of race) {
      expect(fitsMode(level, "race")).toBe(true);
      expect(fitsMode(level, "timeTrial")).toBe(true);
      expect(fitsMode(level, "tricks")).toBe(false);
    }
  });

  it("gives a tricks shore to TRICKS alone", () => {
    // R35's field is laid at BUILD time, so the same seed asked for ramps is
    // not always the same shore: a tricks rung ridden as a race would be a
    // different coast under the same name and digest.
    const tricks = CAMPAIGN_LEVELS.filter((level) => level.mode === "tricks");
    expect(tricks.length).toBeGreaterThan(0);
    for (const level of tricks) {
      expect(fitsMode(level, "tricks")).toBe(true);
      expect(fitsMode(level, "race")).toBe(false);
      expect(fitsMode(level, "timeTrial")).toBe(false);
    }
  });

  it("pins nothing at all on a FREE ride", () => {
    // The one mode that asks for a seed, a wind off any quarter and a sea of
    // its own — there is no pinned shore for it to be riding.
    for (const level of CAMPAIGN_LEVELS) expect(fitsMode(level, "free")).toBe(false);
  });

  it("leaves every measured mode something to ride on the first shore", () => {
    // The warm shore is open on a fresh app, so none of the three tiles can
    // open onto an empty card.
    for (const mode of GAME_MODES) {
      if (mode === "free") continue;
      expect(levelsForMode(MANGROVE, mode).length).toBeGreaterThan(0);
      expect(levelsForMode(TAIGA, mode).length).toBeGreaterThan(0);
    }
  });

  it("resolves an id only where the mode can ride it", () => {
    const race = CAMPAIGN_LEVELS.find((level) => level.mode === "race")!;
    const tricks = CAMPAIGN_LEVELS.find((level) => level.mode === "tricks")!;
    expect(levelForMode(race.id, "timeTrial")).toBe(race);
    expect(levelForMode(tricks.id, "tricks")).toBe(tricks);
    // The three answers that are null: the wrong discipline, an id the
    // ladder no longer has, and no id at all.
    expect(levelForMode(race.id, "tricks")).toBeNull();
    expect(levelForMode("atoll-1", "race")).toBeNull();
    expect(levelForMode(null, "race")).toBeNull();
  });
});
