// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CAMPAIGN — pinned shores, in order, ridden for points.
//
// Everything a generated level needs is a seed and the dials it is built
// at, so a campaign level is just those with a day and a name pinned to
// them (`campaign-levels.ts`): the same generator builds it, on the version
// it was curated under, and it comes out identical for every player.
//
// A CAMPAIGN IS A CHAMPIONSHIP, the sibling rally game's shape retyped for
// water. Every level is ridden against the same eleven rivals — on the
// water to make it feel lived on, never leaned on (`RunRules.contact` is
// off) — and pays the podium the way a kart game does: three for the win,
// two for second, one for third, nothing at all below it. The points are
// kept for the WHOLE field, because the thing that has to be true at the
// end of a shore is "you beat these eleven", and that is only a sentence
// if their points are on the board beside yours.
//
// The points are also THE LOCK, at both scales:
//
//   * A LEVEL opens once the one before it paid the player something —
//     a podium on a race, and on a tricks level a MEDAL (bronze, silver,
//     gold: a score to beat, the way a mountain game sets one), which is
//     what clears it. A tricks level still places the player against the
//     field by score and pays the table for it; the medal is the door.
//   * A SHORE opens once the one before it has been ridden all the way
//     through and the player is TOP of its table.
//
// Nothing here is ever spent: a level can be ridden again as often as the
// player likes, and the board keeps the better afternoon. That is the whole
// shape of the thing — see the shore, then go back for the wins it costs to
// leave it — and it is why a level already cleared is still worth riding.
//
// THE PINNED SHORES ARE THE GAME'S ONLY SHORES, not the campaign's alone. RACE,
// TRICKS and TIME TRIAL pick one of these levels rather than a seed — the
// same water, the same pinned day, ridden for the record book instead of
// for points (`menu-levels.tsx`, `new-game.ts`'s `pinnedFor`) — and what
// they offer is gated on the campaign having OPENED that shore, which is
// the sibling rally game's rule for its own time trial. A seed of your own
// is FREE's, and FREE's alone.
//
// Two halves, the way `records.ts` is split: everything above the storage
// line is PURE — a level built, a run booked, a lock read — so
// `tests/campaign_test.ts` holds the policy without a browser, and the two
// functions under it are the skin over `localStorage`. A machine with no
// storage still keeps this session's board in memory.

import {
  RACE,
  createGame,
  generateLevel,
  type CraftId,
  type GameMode,
  type GameState,
  type Level,
  type RunConditions,
  type RunRules,
  isCraftId,
} from "@engine";

import {
  CAMPAIGN_LEVELS,
  MEDALS,
  SHORES,
  type CampaignLevel,
  type CampaignShore,
  type Medal,
} from "./campaign-levels.ts";

export { CAMPAIGN_LEVELS, MEDALS, SHORES } from "./campaign-levels.ts";
export type { CampaignLevel, CampaignMode, CampaignShore, Medal } from "./campaign-levels.ts";

/* ── THE LEVEL, BUILT ─────────────────────────────────────────────────── */

/** The shore a level belongs to. */
export function shoreOf(level: CampaignLevel): CampaignShore {
  return SHORES.find((s) => s.levels.includes(level)) ?? SHORES[0];
}

/** Where a level id sits, for the finish handler that has only the id. */
export function findLevel(
  id: string,
): { shore: CampaignShore; level: CampaignLevel; index: number } | null {
  for (const shore of SHORES) {
    const index = shore.levels.findIndex((l) => l.id === id);
    if (index >= 0) return { shore, level: shore.levels[index], index };
  }
  return null;
}

/** THE SHORE ITSELF, exactly as it was curated: the seed on its own
 * generator version, in its shore's coast, as a tricks field when the level
 * is one, under the swell it pins. Nothing about the day is in here — the
 * day is what the run is stood up in (`campaignGame`), and the same shore
 * under a different sky is the same shore. */
export function buildCampaignLevel(level: CampaignLevel): Level {
  return generateLevel(level.seed, {
    biome: shoreOf(level).id,
    track: level.track,
    tricks: level.mode === "tricks",
    swell: level.swell,
    version: level.version,
  });
}

/** THE DAY the level is ridden in, as the rating reads it. */
export function campaignConditions(level: CampaignLevel): RunConditions {
  return { hour: level.hour, season: level.season, weather: level.weather, wind: level.wind };
}

/** A RUN ON THE PINNED SHORE — the level's own water under the level's own
 * day, ridden as `mode` on `craft`. THROWS when the generator refuses the
 * seed, which a curated seed never does.
 *
 * THE DAY IS THE LEVEL'S WHATEVER THE RUN IS FOR. A campaign rung and a
 * time trial down the same shore are a time on the same water, which is the
 * whole reason these are pinned rather than dealt; the start card's
 * rows exist for the one mode that measures nothing (`new-game.ts`). */
export function pinnedGame(
  level: CampaignLevel,
  mode: GameMode,
  craft: CraftId,
  opts: { limit?: number; built?: Level; rules?: Partial<RunRules> } = {},
): GameState {
  return createGame({
    seed: level.seed,
    level: opts.built ?? buildCampaignLevel(level),
    craft,
    mode,
    limit: opts.limit ?? 0,
    windSpeed: level.wind,
    hour: level.hour,
    season: level.season,
    weather: level.weather,
    rules: opts.rules,
  });
}

/** A CAMPAIGN run of the level: the pinned shore in the level's own mode,
 * with the whole field on the water and nobody able to lean on anybody. */
export function campaignGame(level: CampaignLevel, craft: CraftId, built?: Level): GameState {
  return pinnedGame(level, level.mode, craft, {
    limit: (level.minutes ?? 0) * 60,
    built,
    // The field is there to be RACED AMONG, on every rung: a tricks run
    // has nobody on it by its own rules and gets the race's grid here, and
    // the hulls pass through each other, so a rider going for a flip is
    // never put in the water by somebody else's line.
    rules: { rivals: RACE.rivals, contact: false },
  });
}

/** WHETHER A PINNED LEVEL CAN BE RIDDEN AS `mode`, which is the whole rule
 * behind what the RACE, TRICKS and TIME TRIAL cards offer.
 *
 * It is a question about the SHORE and not about the run: R35's trick field
 * is laid at BUILD time, and a seed asked for one is not always the same
 * shore as the same seed asked for a race (the analyzer rejects a sub-seed
 * on a tricks level for reasons a race level never has). So a level rides
 * in the discipline it was curated and digested under, and in no other —
 * a race shore takes the course modes, a tricks shore takes the ramps. */
export function fitsMode(level: CampaignLevel, mode: GameMode): boolean {
  if (mode === "tricks") return level.mode === "tricks";
  // A FREE ride pins nothing: it is the one mode allowed a seed, a wind off
  // any quarter and a sea of its own, so there is no pinned shore for it to
  // be riding (`new-game.ts`'s `freeRides`).
  if (mode === "free") return false;
  return level.mode === "race";
}

/** The pinned level named by an id, where it exists and the mode can ride
 * it — null on anything else, so a stale stored id is simply not a shore. */
export function levelForMode(id: string | null, mode: GameMode): CampaignLevel | null {
  if (id === null) return null;
  const found = findLevel(id);
  return found && fitsMode(found.level, mode) ? found.level : null;
}

/** A SHORE'S levels this mode can ride, in ladder order. */
export function levelsForMode(shore: CampaignShore, mode: GameMode): CampaignLevel[] {
  return shore.levels.filter((level) => fitsMode(level, mode));
}

/* ── THE POINTS ───────────────────────────────────────────────────────── */

/** The player's own id on a board; a rival's is `riderKey(rival.id)`. */
export const PLAYER_ID = "you";

/** A rider's key on the board from the engine's own reading of the field
 * (`fieldOrder`: a rival's slot id, `null` for the player). */
export function riderKey(id: number | null): string {
  return id === null ? PLAYER_ID : `r${id}`;
}

/** What a place is worth, best first. Off the end of it a level is worth
 * nothing at all: a table where everybody scores is a starting-money table,
 * and the fourth place has to STING. */
export const POINTS = [3, 2, 1] as const;

/** How many places the podium is — the length of the points table, because
 * they are the same statement: finish where nothing is paid and the level
 * is not cleared. */
export const PODIUM = POINTS.length;

export function pointsFor(place: number): number {
  return POINTS[place - 1] ?? 0;
}

/** WHICH MEDAL a tricks score earns, or none. A race level pays no medal. */
export function medalFor(level: CampaignLevel, score: number): Medal | null {
  if (!level.medals) return null;
  let won: Medal | null = null;
  for (const medal of MEDALS) if (score >= level.medals[medal]) won = medal;
  return won;
}

/** Points for one level, by rider id. */
export type LevelScores = Record<string, number>;

/** What the player got out of a level, best of every afternoon: the figure
 * in the level's own currency (seconds on a race, points on a tricks run),
 * the hull that set it, the best place against the field, and — on a
 * tricks level — the best medal.
 *
 * THE FIGURE AND THE HULL ARE ONE PAIR, and the pair is OPTIONAL: a row
 * with neither is a level the developer OPENED rather than rode
 * (`unlockShores`), which has a place and a medal because that is what a
 * lock reads, and no time of its own because nobody set one. The first
 * real run down it fills the pair in. Nothing else may write half of it. */
export type LevelResult = {
  best?: number;
  craft?: CraftId;
  place: number;
  medal: Medal | null;
};

export type CampaignProgress = {
  /** The player's best on each level ridden to the end, by level id. */
  results: Record<string, LevelResult>;
  /** What every level has paid the WHOLE FIELD, by level id — the board the
   * campaign is played on. A level never ridden is simply absent. */
  points: Record<string, LevelScores>;
};

export const EMPTY_PROGRESS: CampaignProgress = { results: {}, points: {} };

/** A finished run, as the app hands it in: the figure, the hull, and the
 * field in the order it stood at the end (`fieldOrder`). */
export type CampaignRun = {
  value: number;
  craft: CraftId;
  order: readonly (number | null)[];
};

/** Whether `value` beats `standing` in the level's currency: a lower time,
 * a higher score. */
export function betterThan(level: CampaignLevel, value: number, standing: number): boolean {
  return level.mode === "tricks" ? value > standing : value < standing;
}

/** THE RUN, BOOKED: the level's result and the field's points, keeping THE
 * BETTER AFTERNOON — the one that placed the player higher, and the whole
 * field's points from that same run with it. A worse run changes nothing
 * on the board (a lap ridden for fun must never cost a title), while the
 * best figure and the best medal improve on their own, whatever the field
 * did. Pure: returns the progress to render from. */
export function recordRun(
  progress: CampaignProgress,
  level: CampaignLevel,
  run: CampaignRun,
): CampaignProgress {
  const place = run.order.indexOf(null) + 1 || run.order.length + 1;
  const medal = level.mode === "tricks" ? medalFor(level, run.value) : null;
  const stood = progress.results[level.id];
  // The figure and the hull are kept or replaced TOGETHER — a best time
  // beside the wrong craft is a line the card would read out loud. A level
  // standing on a developer's unlock has no figure at all, so the first run
  // down it always sets one.
  const figure =
    stood?.best === undefined || betterThan(level, run.value, stood.best)
      ? { best: run.value, craft: run.craft }
      : { best: stood.best, craft: stood.craft };
  const result: LevelResult = {
    ...figure,
    place: stood === undefined ? place : Math.min(stood.place, place),
    medal: stood === undefined ? medal : bestMedal(stood.medal, medal),
  };
  const scored: LevelScores = {};
  run.order.forEach((id, i) => {
    scored[riderKey(id)] = pointsFor(i + 1);
  });
  const board = progress.points[level.id];
  const mine = scored[PLAYER_ID] ?? 0;
  const theirs = board?.[PLAYER_ID] ?? 0;
  const points =
    board === undefined || mine > theirs
      ? { ...progress.points, [level.id]: scored }
      : progress.points;
  return { results: { ...progress.results, [level.id]: result }, points };
}

function bestMedal(a: Medal | null, b: Medal | null): Medal | null {
  if (a === null) return b;
  if (b === null) return a;
  return MEDALS.indexOf(a) >= MEDALS.indexOf(b) ? a : b;
}

/* ── THE LOCKS ────────────────────────────────────────────────────────── */

/** CLEARED — the level paid the player something: a podium on a race, a
 * medal on a tricks level. */
export function levelCleared(progress: CampaignProgress, level: CampaignLevel): boolean {
  const result = progress.results[level.id];
  if (result === undefined) return false;
  return level.mode === "tricks" ? result.medal !== null : result.place <= PODIUM;
}

/** A level opens once the one before it on its shore has been cleared; the
 * first is always open — on a shore that is. */
export function levelUnlocked(
  shore: CampaignShore,
  index: number,
  progress: CampaignProgress,
): boolean {
  if (!shoreUnlocked(shore, progress)) return false;
  if (index <= 0) return true;
  return levelCleared(progress, shore.levels[index - 1]);
}

/** One rider's line of a shore's table. */
export type StandingsRow = {
  id: string;
  points: number;
  /** Level wins — the first tie-break, and the line a shore is remembered
   * by. */
  wins: number;
  /** 1 is the lead. */
  place: number;
  you: boolean;
};

/** THE TABLE — every rider entered on the shore, the player included, best
 * first. Ties go to level wins, then to the player: a shore that ends level
 * and hands the next one to the machine is a lock with no visible way in.
 * The rivals are the race's grid, by slot, so a rider who has never scored
 * still has a row. */
export function shoreStandings(shore: CampaignShore, progress: CampaignProgress): StandingsRow[] {
  const ids = [PLAYER_ID, ...Array.from({ length: RACE.rivals }, (_, i) => riderKey(i))];
  const rows = ids.map((id) => {
    let points = 0;
    let wins = 0;
    for (const level of shore.levels) {
      const got = progress.points[level.id]?.[id] ?? 0;
      points += got;
      if (got === POINTS[0]) wins += 1;
    }
    return { id, points, wins, you: id === PLAYER_ID };
  });
  rows.sort(
    (a, b) => b.points - a.points || b.wins - a.wins || (a.you ? -1 : 0) - (b.you ? -1 : 0),
  );
  return rows.map((row, index) => ({ ...row, place: index + 1 }));
}

/** The player's own line of the table. */
export function playerStanding(shore: CampaignShore, progress: CampaignProgress): StandingsRow {
  const table = shoreStandings(shore, progress);
  return table.find((row) => row.you) ?? table[table.length - 1];
}

/** How many of the shore's levels have been ridden to the end at all. */
export function levelsRidden(shore: CampaignShore, progress: CampaignProgress): number {
  return shore.levels.filter((level) => progress.results[level.id] !== undefined).length;
}

/** WON — every level ridden and the player top of the shore's table. Both
 * halves matter: a table nobody has scored on is one the player leads on
 * the tie-break, and an empty board must not open a shore. */
export function shoreWon(shore: CampaignShore, progress: CampaignProgress): boolean {
  return (
    levelsRidden(shore, progress) === shore.levels.length &&
    playerStanding(shore, progress).place === 1
  );
}

/** A shore opens once the one before it has been WON. The first is always
 * open. */
export function shoreUnlocked(shore: CampaignShore, progress: CampaignProgress): boolean {
  const index = SHORES.indexOf(shore);
  if (index <= 0) return true;
  return shoreWon(SHORES[index - 1], progress);
}

/** WHERE THE CAMPAIGN PICKS BACK UP on a shore. Forward first: the next
 * open level never ridden. Then back to the first open level not WON —
 * which is the whole shape of a points campaign. Null when every open
 * level is a win. */
export function continueAt(shore: CampaignShore, progress: CampaignProgress): CampaignLevel | null {
  const open = shore.levels.filter((_l, index) => levelUnlocked(shore, index, progress));
  return (
    open.find((level) => progress.results[level.id] === undefined) ??
    open.find((level) => (progress.points[level.id]?.[PLAYER_ID] ?? 0) < POINTS[0]) ??
    null
  );
}

/** HOW FAR THE CAMPAIGN HAS GOT, in one figure — what the front door's
 * hero tile bills itself with. CLEARED rather than ridden, because cleared
 * is what opens the next rung: a level ridden and lost is a level still
 * standing there. Counted over the whole ladder rather than the open shore,
 * so the figure a door shows never goes backwards or resets between
 * shores. */
export function campaignStanding(progress: CampaignProgress): {
  cleared: number;
  of: number;
} {
  const levels = SHORES.flatMap((shore) => shore.levels);
  return {
    cleared: levels.filter((level) => levelCleared(progress, level)).length,
    of: levels.length,
  };
}

/** Where the ladder goes after a level: the next rung, the next SHORE
 * behind the table it is locked to, or the end of the road. */
export type LadderStep =
  | { kind: "next"; level: CampaignLevel }
  | { kind: "locked"; shore: CampaignShore }
  | { kind: "end" };

export function ladderAfter(levelId: string, progress: CampaignProgress): LadderStep {
  const here = findLevel(levelId);
  if (!here) return { kind: "end" };
  const after = here.shore.levels[here.index + 1];
  if (after) {
    return levelUnlocked(here.shore, here.index + 1, progress)
      ? { kind: "next", level: after }
      : { kind: "locked", shore: here.shore };
  }
  const nextShore = SHORES[SHORES.indexOf(here.shore) + 1];
  if (!nextShore) return { kind: "end" };
  return shoreUnlocked(nextShore, progress)
    ? { kind: "next", level: nextShore.levels[0] }
    : { kind: "locked", shore: here.shore };
}

/* ── THE DEVELOPER'S LOCKS ────────────────────────────────────────────── */

/** THE LADDER IS A PREFIX, and both presses on the UNLOCKS page are built on
 * that one fact: a shore opens once the one before it has been WON
 * (`shoreUnlocked`), so opening a shore means winning the run UP TO it, and
 * shutting one means undoing everything FROM it on. A board with a hole in
 * the middle is a state the campaign itself would never deal, and a page
 * that could produce one would be a page that tests a game nobody plays.
 *
 * What a grant writes is a WIN, because a win is the only thing that opens
 * anything: the player top of the level's board, the podium filled in behind
 * him, and — on a tricks rung — the gold that clears it. What it does not
 * write is a FIGURE. Nobody rode the level, so the box shows no time and no
 * score until somebody does (`LevelResult`).
 *
 * NEITHER PRESS TOUCHES THE RECORD BOOK. A campaign result is one afternoon
 * on a rung; the player's best down a shore in a mode lives in `records.ts`,
 * which is a different store and is left alone — so a lock puts the ladder
 * back where it was without costing a single line of what was ridden for it.
 */
function grantLevel(level: CampaignLevel): { result: LevelResult; scores: LevelScores } {
  const scores: LevelScores = { [PLAYER_ID]: POINTS[0] };
  for (let i = 1; i < POINTS.length; i += 1) scores[riderKey(i - 1)] = POINTS[i];
  return {
    result: { place: 1, medal: level.mode === "tricks" ? MEDALS[MEDALS.length - 1] : null },
    scores,
  };
}

/** Every level of these shores won outright, keeping any figure that was
 * actually ridden: a grant moves the place, the medal and the board, and
 * never a time somebody set. */
function openShores(
  progress: CampaignProgress,
  shores: readonly CampaignShore[],
): CampaignProgress {
  const results = { ...progress.results };
  const points = { ...progress.points };
  for (const shore of shores) {
    for (const level of shore.levels) {
      const { result, scores } = grantLevel(level);
      const stood = results[level.id];
      results[level.id] =
        stood?.best === undefined ? result : { ...result, best: stood.best, craft: stood.craft };
      points[level.id] = scores;
    }
  }
  return { results, points };
}

/** Every level of these shores back to never having been ridden — the result
 * and the board both go, which is what `levelsRidden` and the table read. */
function shutShores(
  progress: CampaignProgress,
  shores: readonly CampaignShore[],
): CampaignProgress {
  const gone = new Set(shores.flatMap((shore) => shore.levels.map((level) => level.id)));
  const results = { ...progress.results };
  const points = { ...progress.points };
  for (const id of gone) {
    delete results[id];
    delete points[id];
  }
  return { results, points };
}

/** Open the campaign AS FAR AS one shore: it and every shore before it won.
 * Null — or an id this ladder does not know — opens the lot. */
export function unlockShores(progress: CampaignProgress, shoreId: string | null): CampaignProgress {
  const index = SHORES.findIndex((shore) => shore.id === shoreId);
  return openShores(progress, index < 0 ? SHORES : SHORES.slice(0, index + 1));
}

/** Shut one shore and every shore in FRONT of it: the campaign reads as
 * having stopped at the shore before this one. Null shuts the lot. */
export function lockShores(progress: CampaignProgress, shoreId: string | null): CampaignProgress {
  const index = SHORES.findIndex((shore) => shore.id === shoreId);
  return shutShores(progress, index < 0 ? SHORES : SHORES.slice(index));
}

/** One shore's row on the UNLOCKS page: what it reads, and whether either
 * press has anything left to do. Both spent states are read over a RUN of
 * shores rather than over the one on the row, because both presses work on a
 * prefix — UNLOCK is spent once everything up to here is won, LOCK once
 * everything from here on has never been ridden. */
export type UnlockRow = {
  shore: CampaignShore;
  /** Levels of it the player is on points for. */
  cleared: number;
  of: number;
  /** Whether the campaign will let the player onto the shore at all. */
  open: boolean;
  /** Nothing left for UNLOCK to do. */
  won: boolean;
  /** Nothing left for LOCK to do. */
  shut: boolean;
};

export function unlockRows(progress: CampaignProgress): UnlockRow[] {
  const won = SHORES.map((shore) => shoreWon(shore, progress));
  const ridden = SHORES.map((shore) => levelsRidden(shore, progress) > 0);
  return SHORES.map((shore, index) => ({
    shore,
    cleared: shore.levels.filter((level) => levelCleared(progress, level)).length,
    of: shore.levels.length,
    open: shoreUnlocked(shore, progress),
    won: won.slice(0, index + 1).every(Boolean),
    shut: !ridden.slice(index).some(Boolean),
  }));
}

/* ── STORAGE ──────────────────────────────────────────────────────────── */

const PROGRESS_KEY = "sea-haven-campaign";

/** A stored blob turned into progress this build can stand on: every id
 * checked against the ladder, every figure checked for being a number, and
 * anything else dropped — a level that no longer exists takes its row with
 * it rather than leaving a ghost on the board. */
export function mergeProgress(parsed: unknown): CampaignProgress {
  const out: CampaignProgress = { results: {}, points: {} };
  if (typeof parsed !== "object" || parsed === null) return out;
  const known = new Set(CAMPAIGN_LEVELS.map((l) => l.id));
  const blob = parsed as { results?: unknown; points?: unknown };
  if (typeof blob.results === "object" && blob.results !== null) {
    for (const [id, row] of Object.entries(blob.results as Record<string, unknown>)) {
      if (!known.has(id) || typeof row !== "object" || row === null) continue;
      const r = row as Partial<LevelResult>;
      if (!Number.isInteger(r.place) || (r.place as number) < 1) continue;
      const medal = MEDALS.find((m) => m === r.medal) ?? null;
      const place = r.place as number;
      // A row CLAIMING a figure has to make both halves of the pair good or
      // it is junk and goes; a row claiming neither is a level opened from
      // the developer page and stands on its place alone.
      if (r.best === undefined && r.craft === undefined) {
        out.results[id] = { place, medal };
        continue;
      }
      if (typeof r.best !== "number" || !Number.isFinite(r.best) || r.best < 0) continue;
      const craft = r.craft;
      if (typeof craft !== "string" || !isCraftId(craft)) continue;
      out.results[id] = { best: r.best, craft, place, medal };
    }
  }
  if (typeof blob.points === "object" && blob.points !== null) {
    for (const [id, row] of Object.entries(blob.points as Record<string, unknown>)) {
      if (!known.has(id) || typeof row !== "object" || row === null) continue;
      const scores: LevelScores = {};
      for (const [rider, got] of Object.entries(row as Record<string, unknown>)) {
        if (typeof got === "number" && Number.isFinite(got)) scores[rider] = got;
      }
      out.points[id] = scores;
    }
  }
  return out;
}

export function loadProgress(): CampaignProgress {
  try {
    const stored = localStorage.getItem(PROGRESS_KEY);
    return stored ? mergeProgress(JSON.parse(stored)) : EMPTY_PROGRESS;
  } catch {
    return EMPTY_PROGRESS;
  }
}

export function saveProgress(progress: CampaignProgress): void {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    /* storage unavailable — the board still holds for this session */
  }
}
