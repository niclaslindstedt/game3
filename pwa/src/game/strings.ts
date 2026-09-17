// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// EVERY WORD THE PLAYER READS, in one table (OSS_GAME_SPEC §39.1). The HUD
// and the touch overlay reference a key here and never carry a literal of
// their own, so a line can be fixed without a code review and a second
// language is a second table rather than a rewrite. Composed lines are
// templates — functions of their parameters — never concatenations at the
// call site (§39.2). Developer diagnostics are deliberately not here.

import { craftById, type CraftId, type GameMode, type TrickKind, type TrickPart } from "@engine";

import { formatScore, formatTime, ordinal } from "../lib/util.ts";
import type { SeaStateId } from "./settings.ts";

/** The class ladder's words, by the multiple each rung is. Novice is the
 * detuned ski a rider is handed first; stock is the roster as the catalog
 * tunes it; limited and open are the paddock's own two steps above it. */
/** The coasts' words on the card, by biome id. The engine's row carries a
 * longer name ("Taiga coast"); the card wants the one word that names it. */
const COAST_NAMES: Record<string, string> = {
  taiga: "TAIGA",
  mangrove: "MANGROVE",
  arctic: "ARCTIC",
};

/** THE FOUR MODES' words, by the engine's id. */
const MODE_NAMES: Record<GameMode, string> = {
  race: "RACE",
  tricks: "TRICKS",
  timeTrial: "TIME TRIAL",
  free: "FREE RIDE",
};

/** The three medals' words, by id (`campaign-levels.ts`). */
const MEDAL_NAMES: Record<string, string> = {
  bronze: "BRONZE",
  silver: "SILVER",
  gold: "GOLD",
};

/** An hour on the clock as a card writes one: `07:00`, `18:30`. */
function formatHour(hour: number): string {
  const h = Math.floor(hour) % 24;
  const m = Math.round((hour - Math.floor(hour)) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const CLASS_NAMES: Record<string, string> = {
  "0.75": "NOVICE",
  "1": "STOCK",
  "1.25": "LIMITED",
  "1.5": "OPEN",
};

/** WHERE A QUARTER STANDS against the coast, in words — the compass rose's
 * own eighths measured off dead onshore: inside 22.5° of it the wind is
 * straight in, past 157.5° it is straight off the land, a right angle either
 * way is along the shore, and the two quadrants between are quartering onto
 * it or off it. */
function quarterWord(deg: number): string {
  const away = Math.abs(deg);
  if (away <= 22.5) return "Straight in off the sea";
  if (away < 67.5) return "Quartering onto the shore";
  if (away <= 112.5) return "Straight along the shore";
  if (away < 157.5) return "Quartering off the shore";
  return "Straight off the land";
}

/** The tail every free row's caption ends with: what this shore was dealt,
 * or nothing at all while the chart is still being built. */
function dealtIs(dealt: number | null, read: (value: number) => string): string {
  return dealt === null ? "" : ` This shore was dealt ${read(dealt)}.`;
}

/** R36 — the Douglas sea scale's words for its own states, which is where
 * the WAVES row's ladder comes from. Typed off the scale rather than as a
 * loose map, so a rung added there does not compile until it has a word —
 * the `Record<HeldAction, true>` trick, for the same reason. */
const SEA_STATE_NAMES: Record<SeaStateId, string> = {
  slight: "SLIGHT",
  moderate: "MODERATE",
  rough: "ROUGH",
  veryRough: "VERY ROUGH",
  high: "HIGH",
  veryHigh: "VERY HIGH",
  phenomenal: "PHENOMENAL",
};

/** What a flight's Nth revolution is called. Past a triple the count is
 * spelled with a figure — nobody has a word for a fifth one, and a rider who
 * gets there has earned a number rather than an adjective. */
const SPINS: Record<number, string> = { 1: "", 2: "DOUBLE ", 3: "TRIPLE ", 4: "QUAD " };

/** THE TRICK VOCABULARY — the word for each thing the engine can say the
 * rider did (`TrickKind`). The engine names the THING and counts the
 * revolutions; this is the only place any of them is a word.
 *
 * They are the water's own words rather than the skate park's, because that
 * is what the rider is on: a hull going over nose-over-tail is a FLIP, a
 * hull turning about its own length is a BARREL ROLL, and the flight they
 * were turned in is AIR. The side a roll went is deliberately not in the
 * name — a rider rolling left and one rolling right have done the same
 * trick — where the direction of a flip is the whole difference between the
 * one he asked for and the one the lip gave him.
 *
 * The three that are not turned in the air are named for what the water did
 * or did not do: the flight with a revolution on both axes in it is a
 * CORKSCREW, the top of a wave held and run along is a WAVE RIDE, and the
 * hull heeled over on its side and brought back up is a LAYDOWN. */
const TRICK_WORDS: Record<TrickKind, string> = {
  backflip: "BACKFLIP",
  frontflip: "FRONTFLIP",
  roll: "BARREL ROLL",
  air: "AIR",
  submarine: "SUBMARINE",
  corkscrew: "CORKSCREW",
  wave: "WAVE RIDE",
  laydown: "LAYDOWN",
};

/** How many revolutions of it, spelled: nothing for a single, the word for
 * a double or a triple, a figure past that. */
function turns(spins: number): string {
  return SPINS[spins] ?? `${spins}\u00d7 `;
}

/** THE COMBO AS WORDS — one name per element, in the order they were won,
 * and the one place the vocabulary is applied rather than merely listed.
 *
 * One element is a compound rather than a name: the CORKSCREW stands in
 * place of the flip and the roll it was made of, because calling it that is
 * worth more than calling it two things — it is the trick a rider goes
 * looking for once he has both of the others, and a line reading "BACKFLIP
 * + BARREL ROLL + CORKSCREW" would say the same thing three times. The
 * engine scored all three (`tricks.ts`: the two revolutions at their own
 * index, then the combination); the line names one, carrying the deeper of
 * the two axes' revolution counts so a double flip with a roll through it
 * still reads as a DOUBLE CORKSCREW. Everything else falls through to its
 * own word. */
function namesOf(parts: readonly TrickPart[]): string[] {
  const corked = new Set<number>();
  for (const p of parts) if (p.kind === "corkscrew") corked.add(p.flight);
  const out: string[] = [];
  for (const p of parts) {
    if (p.kind === "corkscrew") {
      let deepest = 1;
      for (const q of parts) {
        if (q.flight === p.flight && (q.kind === "roll" || q.kind.endsWith("flip"))) {
          deepest = Math.max(deepest, q.spins);
        }
      }
      out.push(`${turns(deepest)}${TRICK_WORDS.corkscrew}`);
      continue;
    }
    if (corked.has(p.flight) && (p.kind === "roll" || p.kind.endsWith("flip"))) continue;
    out.push(`${turns(p.spins)}${TRICK_WORDS[p.kind]}`);
  }
  return out;
}

export const STRINGS = {
  /** The speedometer's unit. */
  speedUnit: "km/h",
  /** The rev bar's caption — and what it reads instead while the reverse
   * bucket is down: BRAKE while the craft is still going ahead, REVERSE
   * once it is backing up. */
  revs: "RPM",
  brake: "BRAKE",
  reverse: "REVERSE",
  /** The gate counter, `passed / total`. */
  gates: (passed: number, total: number): string => `${passed} / ${total}`,
  gatesLabel: "GATES",
  /** THE PLACE, in a race: where the rider stands against the field, and
   * how many are in it. */
  place: (place: number, of: number): string => `${ordinal(place)} / ${of}`,
  placeLabel: "PLACE",
  /** THE GAP TO THE GHOST (`ghost-run.ts`): how the rider stands against
   * their own best run on this water, in that run's own currency — points
   * on a tricks run, seconds down a course. The SIGN is the reading and it
   * is the same one either way: + is up on the ghost, − is down on it.
   * That is deliberately not the pit-wall convention, where a quicker lap
   * reads negative — one screen cannot carry two opposite meanings for one
   * symbol, and the points gap has only one sensible sign. */
  ghostGap: (gap: number, seconds: boolean): string => {
    const size = seconds ? Math.abs(gap).toFixed(2) : formatScore(Math.round(Math.abs(gap)));
    return `${gap < 0 ? "\u2212" : "+"}${size}`;
  },
  ghostLabel: "GHOST",
  /** ...and the sentence behind it, for a pointer resting on the chip. */
  ghostTitle: "Your best run on this water, riding it again",
  /** THE CLOCK's caption on a timed run, where it counts DOWN. */
  clockLeftLabel: "LEFT",
  /** THE LIGHTS: each whole second as it begins, then the word. */
  count: (left: number): string => String(left),
  go: "GO!",
  /** A rival leaned on. One word: the picture says the rest. */
  bump: "BUMP",
  /** THE BUZZER on a timed run, in the news column. */
  timeUp: "TIME UP",
  /** THE RESULT PLATE, over a finished run: what the run was worth in the
   * mode's own currency, where it stood, and whether it is the best this
   * shore has seen. */
  resultRace: (place: number, of: number): string => `${ordinal(place)} OF ${of}`,
  resultTime: (seconds: number): string => formatTime(seconds),
  resultScore: (points: number): string => `${formatScore(points)} PTS`,
  resultNewBest: "NEW BEST",
  resultBest: (best: string): string => `BEST ${best}`,
  resultFirst: "FIRST RUN ON THIS SHORE",
  /** ...and what stands there on a mode that keeps no book at all: the free
   * ride, whose weather is the rider's own, so no two runs down the same
   * shore are the same run (`records.ts`). */
  resultFree: "FREE RIDE · NOT KEPT",
  /** ...and the way on, for a keyboard. */
  resultNote: "B rides again · ESC for the menu",
  /** R30 — which lap of how many, on a circuit. Nothing to read on a coast
   * sprint, which is one pass of one course, so the HUD leaves it out. */
  laps: (lap: number, total: number): string => `${lap} / ${total}`,
  lapsLabel: "LAP",
  clockLabel: "TIME",
  /** The wind chip: metres per second, one decimal. */
  wind: (ms: number): string => `${ms.toFixed(1)} m/s`,
  windLabel: "WIND",
  /** HOW FAR OUT: whole metres from the water's edge, beside the clock. No
   * decimal — the figure runs through tens of metres a second on the plane,
   * and a tenth on the end of it would be a digit nobody can read spinning
   * under one they can. */
  shore: (metres: number): string => `${Math.round(metres)} m`,
  shoreLabel: "FROM SHORE",
  /** THE ALTIMETER's figure, riding beside the tape's marker (hud-dial.tsx):
   * metres above still water, to one decimal — the tape's travel is
   * compressed and this is not, so the shape says how big and the figure
   * says exactly how big. Signed, because a trough is a real place to be and
   * on a big sea the swing between the two is the reading. */
  altitude: (m: number): string => `${m.toFixed(1)} m`,
  altitudeLabel: "ALTITUDE",
  /** The air-time readout, tenths. */
  air: (seconds: number): string => `${seconds.toFixed(1)}s`,
  airLabel: "AIR",
  /** ...and the same clock's caption while the hull is UNDER the water
   * rather than over it (`CraftState.under`): one tile, two words, because
   * they are one reading — how long the hull has been off the surface. */
  underLabel: "UNDER",
  /** THE JUMP COUNTER beside the clock, whole metres — the flight's other
   * half, and the one the score pays by the metre for. Whole metres because
   * a tenth of one is under the width of the hull and nothing a rider can
   * ride towards; the seconds carry the tenths because a tenth of a second
   * is a real difference in the air. */
  length: (metres: number): string => `${Math.round(metres)}m`,
  lengthLabel: "LENGTH",
  /** The word under whichever of the two is the run's longest. Under rather
   * than beside: each figure keeps its own column and the news is read as a
   * second line of the same readout. */
  airRecordLabel: "RECORD",
  /** THE SCORE (`engine/game/tricks.ts`): what the rider has banked this
   * run, and the combo he is still riding on. The combo carries its
   * MULTIPLIER as a separate word, because the two are read differently —
   * the points are a number that climbs and the multiplier is a rung he
   * either has or has not reached. */
  score: (points: number): string => formatScore(points),
  scoreLabel: "SCORE",
  comboPoints: (points: number): string => `+${formatScore(points)}`,
  comboMult: (mult: number): string => `\u00d7${mult}`,
  comboLabel: "COMBO",
  /** ...and the two words the combo's last moment ends on: paid, because
   * the rider was still on the craft when the window ran out, or lost
   * because he was not. */
  comboBanked: "BANKED",
  comboBailed: "BAILED",
  /** An element as it completes, for the news column: its own name and the
   * multiplier it just bought. A double is named as a double rather than
   * reported twice — it is one harder trick, which is exactly what the
   * multiplier says. */
  trick: (kind: TrickKind, spins: number, mult: number): string =>
    `${turns(spins)}${TRICK_WORDS[kind]}  \u00d7${mult}`,
  /** THE COMBO'S LINE, flashed over the nose as it is built: every element
   * the rider has strung together, in the order he won them, joined the way
   * an arcade skating game joins them. The multiplier is NOT in it — it is
   * its own word beside the points, a rung rather than part of the name,
   * and a line that carried it would be read as one of the tricks. */
  comboLine: (parts: readonly TrickPart[]): string => namesOf(parts).join(" + "),
  /** ...and the combo lost, which is the one half of the score the picture
   * does not already say: the tile is gone by the time the rider looks. */
  bailed: (points: number): string => `BAILED  \u2212${formatScore(points)}`,
  /** The minimap's readout: how far the next gate is, whole metres — and
   * what stands there once the last one is behind the craft. */
  mapToNext: (metres: number): string => `${Math.round(metres)} M`,
  mapAtFinish: "FINISH",
  /** ...and on a run with no course, how far the nearest ramp is. */
  mapToRamp: (metres: number): string => `RAMP ${Math.round(metres)} M`,
  /** What the minimap's scale bar is worth. Always a round figure, so it is
   * read rather than parsed. */
  mapScale: (metres: number): string => `${metres} M`,
  /** The two presses on the HUD's action row (hud-actions.tsx). Both are a
   * MARK rather than a word — the top bar is the one strip that has to stay
   * out of the way of the water — so these are what a hover, a screen reader
   * and the keyboard hint get. The shutter is not among them: it is ENTER, a
   * menu row, and on a phone the hardware's own. */
  resetTitle: "Back to the last gate (R)",
  cameraTitle: "Next camera (C)",
  /** The build corner: which stage and which craft this frame is of. */
  stage: (seed: number): string => `SEED ${seed}`,
  /** ...and the two diagnostics that share it. The frame rate is rounded to
   * a whole frame, because a tenth of one is a figure nobody can act on; the
   * cost is the water's CPU slice, the draw calls and the triangles, in the
   * order `make profile` prints them. */
  fps: (rate: number): string => `${Math.round(rate)} FPS`,
  frameCost: (waterMs: number, calls: number, triangles: number): string =>
    `${waterMs.toFixed(1)} ms · ${calls} draws · ${(triangles / 1000).toFixed(0)}k tris`,
  /** The split flash after a gate, and the standing warning after a missed
   * one: its second line is the plan distance back to that checkpoint. */
  split: (gate: number, seconds: number): string => `GATE ${gate}  ${formatTime(seconds)}`,
  airGate: (gate: number, seconds: number): string => `RING ${gate}  ${formatTime(seconds)}`,
  missed: "MISSED CHECKPOINT",
  missedBack: (metres: number): string => `${Math.round(metres)} M BACK`,
  finish: (seconds: number): string => `FINISH  ${formatTime(seconds)}`,
  finishPlace: (place: number, of: number, seconds: number): string =>
    `${ordinal(place)} OF ${of}  ${formatTime(seconds)}`,
  dive: "DIVE",
  /** THE HULL BACK OUT under its rider, after that long under — the
   * column's reading of a spell the way `landed` is of a flight. */
  surfaced: (seconds: number): string => `UNDER ${seconds.toFixed(1)}s`,
  /** ...and the hull brought up FOR him: his time under ran out, or it
   * came out on its back, and the water turned it over (`floatUp`). */
  floatUp: "FLOATED UP",
  hit: "HIT",
  grounded: "AGROUND",
  /** THE FLIGHT, as the column bills it: both halves of it, because both
   * are what it was paid for (`engine/game/tricks.ts`). */
  landed: (airSeconds: number, metres: number): string =>
    `AIR ${airSeconds.toFixed(1)}s · ${Math.round(metres)}m`,
  /** ...and the same flight when it is the longest of the run so far, on
   * whichever axis took the record. The number is the point, so each reads
   * the way its own half does and the word is what is added to it. Two
   * lines rather than one because the two bests are two different jumps as
   * often as they are one, and a run that takes both at once is a run worth
   * saying so about twice. */
  airRecord: (airSeconds: number): string => `BEST AIR ${airSeconds.toFixed(1)}s`,
  lengthRecord: (metres: number): string => `BEST JUMP ${Math.round(metres)}m`,
  /** The new-build button: the word the armed mark shows, and the two
   * labels a pointer and a screen reader get — one for the mark, one for
   * the armed button, whose press throws the run away. */
  updateWord: "RELOAD",
  updateReady: (version: string | null): string =>
    version
      ? `New build v${version} ready — reload to install`
      : "New build ready — reload to install",
  updateArmed: "Press again to reload onto the new build",
  /** The card the HUD puts up while the TAB is away (§37.3) — not the pause
   * menu, which is next door in menu-pause.tsx and shares only the word. */
  paused: "PAUSED",
  pausedNote: "The run waits until you come back",
  /** The boot card and the loading card's own word, and what the attract
   * card's turning ring is announced as to a reader that cannot see it. */
  loading: "loading",

  /* ── THE ATTRACT CARD (splash-screen.tsx) ──────────────────────────── */
  /** The publisher's billing, under the house's name. */
  splashPresents: "PRESENTS",
  /** What the card asks for, in the words of the device it is read on — a
   * phone has no key to press, and telling it to press one is the kind of
   * detail that makes a game feel ported rather than made. */
  splashTap: "TAP TO START",
  splashPress: "PRESS ANY KEY TO START",

  /* ── THE MAIN MENU (menu-main.tsx) ─────────────────────────────────── */
  /** The four ways onto the water are the front door's mode tiles, and their
   * words are `modeName`'s — a tile and the card it opens must not be able
   * to disagree about which game was pressed. These three are the foot
   * strip: present, findable, and not a way onto water. */
  menuGallery: "GALLERY",
  menuOptions: "OPTIONS",
  menuDeveloper: "DEVELOPER",
  /** What the hero tile bills the campaign with — how far up the ladder the
   * player is, read off `campaignStanding`. A door that says the same thing
   * on every visit is a door nobody looks at twice. */
  menuCampaignLine: (cleared: number, of: number): string =>
    cleared === 0 ? `${of} SHORES · START HERE` : `${cleared} OF ${of} SHORES CLEARED`,
  /** The way out of every page under the front door. */
  menuBack: "MENU",
  menuUnlocked: "DEVELOPER MENU UNLOCKED",

  /* ── THE CAMPAIGN (menu-campaign.tsx, app-campaign.ts) ─────────────── */
  /** The tile, and the card's own title. */
  campaign: "CAMPAIGN",
  /** The second line of a shore's banner: how far the table has got. */
  campaignShoreLine: (ridden: number, of: number, place: number): string =>
    `${ridden} OF ${of} RIDDEN · ${ordinal(place)} ON THE TABLE`,
  campaignShoreWon: "WON",
  /** What a shut shore or level asks for — a padlock with no reason on it
   * is just a wall. */
  campaignShoreLocked: "Win the shore before it: ride all six and finish top of its table",
  /** ...and the short form on the banner itself; the sentence is its title. */
  campaignShoreShut: "WIN THE SHORE BEFORE IT",
  campaignLevelLocked: (mode: string): string =>
    mode === "tricks"
      ? "Earn a medal on the level before it"
      : "Finish on the podium on the level before it",
  /** The box's billing: how long the level is, in its own currency. */
  campaignLaps: (laps: number): string => `${laps} LAPS`,
  campaignKm: (km: number): string => `${km.toFixed(1)} KM`,
  /** THE DAY a level pins, on one line under its name — the hour, the
   * season, the sky, and then the two seas in the scales' own words
   * (`conditionsFor`, `seaRungFor`), because BRISK 9 M/S says what the
   * figure alone does not. */
  campaignDay: (hour: number, season: string, sky: string, wind: string, sea: string): string =>
    `${formatHour(hour)} · ${season} · ${sky} · ${wind} · ${sea}`,
  /** What a medal costs, on a tricks box. */
  medalName: (medal: string): string => MEDAL_NAMES[medal] ?? medal.toUpperCase(),
  campaignMedalCost: (medal: string, points: number): string =>
    `${MEDAL_NAMES[medal] ?? medal} ${formatScore(points)}`,
  /** The marks on a ridden box: the best place, the best figure. */
  campaignPlace: (place: number, of: number): string => `${ordinal(place)} OF ${of}`,
  campaignPoints: (points: number): string => `${points} ${points === 1 ? "PT" : "PTS"}`,
  /** The table's rows. */
  campaignTable: "TABLE",
  campaignYou: "YOU",
  campaignRider: (slot: number): string => `RIDER ${slot + 1}`,
  campaignWins: (wins: number): string => `${wins} ${wins === 1 ? "WIN" : "WINS"}`,
  /** The way on, in the head: rides the level the campaign would pick
   * next — the ringed box. One short word, because a head button is a
   * corner and CONTINUE lands across the title on a phone. */
  campaignRide: "RIDE",
  /** THE RESULT PLATE's second line on a campaign run: what the finish
   * did to the ladder. */
  resultMedal: (medal: string): string => `${MEDAL_NAMES[medal] ?? medal} MEDAL`,
  resultNoMedal: "NO MEDAL · BRONZE OPENS THE NEXT LEVEL",
  resultNotCleared: "NOT CLEARED · A PODIUM OPENS THE NEXT LEVEL",
  resultNextOpen: (name: string): string => `NEXT · ${name.toUpperCase()}`,
  resultShoreLocked: "TOP THE SHORE'S TABLE TO OPEN THE NEXT",
  resultShoreWon: (shore: string): string => `${shore.toUpperCase()} WON`,
  resultCampaignEnd: "THE CAMPAIGN IS YOURS",

  /* ── THE LEVEL CARD (menu-levels.tsx) ─────────────────────────────── */
  /** A shore's banner on the level card: how many of its levels this game
   * can be ridden on (`fitsMode`). */
  levelsShoreCount: (n: number): string => `${n} ${n === 1 ? "LEVEL" : "LEVELS"}`,
  /** Why a shore is shut HERE — the campaign is the only thing that opens
   * one, and a padlock with no reason on it is just a wall. */
  levelsShoreLocked: "Open this shore in the campaign: win the one before it",
  /** An open shore with nothing this game can ride — every shore ships both
   * disciplines, so this is the sentence a shore curated one-sided would
   * print rather than an empty grid. */
  levelsShoreNone: "Nothing on this shore rides in this game yet",
  /** A box nobody has ridden yet. Short: it stands in a box three to a row. */
  levelsNoBest: "NO BEST YET",

  /* ── THE START CARD (menu-start.tsx, seed-preview.tsx) ─────────────── */
  /** Which coast the shore is built on — the biome. One word a rung, off
   * the engine's own id, because the row is a ladder like the others. */
  startCoast: "COAST",
  startCoastHint:
    "The kind of coast the seed builds — a cold skerry shore of granite and pine, a warm flat one of white sand and mangrove, or a polar one of ice walls and bergs on black water",
  coastName: (id: string): string => COAST_NAMES[id] ?? id.toUpperCase(),
  /** THE GAME, as the front door's tiles name it and as the start card's
   * head is titled with it. */
  modeName: (id: GameMode): string => MODE_NAMES[id],
  /** How long a tricks run is. */
  startMinutes: "LENGTH",
  startMinutesHint: "How long the clock gives you before the buzzer",
  minutes: (n: number): string => `${n} MIN`,
  /** THE BEST A SHORE HAS SEEN, on its box on the level card: the record in
   * the mode's own currency and the hull that set it. */
  startBestTime: (seconds: number, craft: string): string =>
    `BEST ${formatTime(seconds)} · ${craft.toUpperCase()}`,
  startBestScore: (points: number, craft: string): string =>
    `BEST ${formatScore(points)} PTS · ${craft.toUpperCase()}`,
  /** ...and the line that stands there on a FREE ride, which keeps no book
   * at all (`records.ts`). It says WHY rather than saying nothing: a blank
   * where every other card has a figure reads as a card that has not
   * loaded. */
  startBestFree: "NOTHING IS TIMED ON A FREE RIDE",
  startShore: "SHORE",
  startShoreHint: "The seed the whole coast is built from — type one in to ride somebody else's",
  startTime: "TIME",
  startTimeHint:
    "The hour to start at, set against this coast's own daylight in the season — NIGHT is midnight, and the clock runs on from wherever you start, an hour a minute",
  startSeason: "SEASON",
  startSeasonHint:
    "The sun's arc: how long the day is, and how dark the night gets — a summer night here never gets past twilight; on the arctic the winter sea is ice, and an icebreaker has cut the course through it",
  /** The wind, which is the sea; then the sky over it. They are separate
   * questions; `menu-start.tsx` owns the two rows. */
  startWind: "WIND",
  /** R36 — the sea that came in off the ocean, which the wind row does not
   * build and cannot ask for. */
  startWaves: "WAVES",
  /* ── FREE'S OWN ROWS (menu-start.tsx, in the free ride alone) ──────── */
  /** The same three questions the rows above ask in words, asked as
   * FIGURES — and one the other cards never ask at all. */
  freeWindHint: (dealt: number | null): string =>
    `The wind itself, m/s — the worded card's rungs are 4, 12 and 20, and this runs to twice that. Past about 25 you are riding weather nothing was built for.${dealtIs(dealt, (ms) => `${Math.round(ms)} m/s`)}`,
  freeWindValue: (ms: number): string => `${Math.round(ms)} M/S`,
  freeWavesHint: (dealt: number | null): string =>
    `How big the swell out past the coast is, in metres — anywhere on the scale rather than the nearest rung of it.${dealtIs(dealt, (m) => `${m.toFixed(1)} m`)}`,
  freeWavesValue: (metres: number): string => `${metres.toFixed(1)} M`,
  /** QUARTER rather than "WIND FROM": the knob's name column is the width
   * of WEATHER and a longer word is truncated with an ellipsis on the card
   * and harder on a phone. It is also the right word — a wind's quarter is
   * where it blows out of — and the caption under the rows says what it is
   * being measured against. */
  freeQuarter: "QUARTER",
  /** WHERE THE WIND IS COMING FROM, said in full — the row itself has only
   * room for the degrees (`.knob-fade` is a fixed width shared by every
   * fader in the game), so the word for what those degrees MEAN is the
   * caption's job, and it names where the row stands right now. */
  freeQuarterHint: (deg: number | null, dealt: number | null): string =>
    `Which quarter the wind blows out of, measured off the open water — straight in builds the sea, along the shore rakes it, off the land flattens it however hard you set it.${
      deg === null ? "" : ` ${quarterWord(deg)}.`
    }${dealtIs(dealt, (d) => `${Math.round(d)}°, ${quarterWord(d).toLowerCase()}`)}`,
  /** The quarter as the row reads it: signed degrees off dead onshore, so a
   * rider can tell one side of the shore from the other. The WORD for what
   * they mean is the caption's, for the reason above it. */
  freeQuarterValue: (deg: number): string => `${deg > 0 ? "+" : ""}${Math.round(deg)}°`,
  /** The card's caption on a free ride: the mark's sentence would be a lie
   * here, because three of the rows are faders with no rung to land back on
   * — each opens on the shore's own answer and is dragged off it. */
  freeCaption:
    "Set what you like — nothing here is timed, and the faders open on whatever this shore was dealt",

  startWeather: "WEATHER",
  startWeatherHint:
    "The sky over it. Left alone it is the one the wind implies, which is R19's own agreement",
  /** What the mark on a value means: this is the answer the shore came with,
   * and the one that rides while the row is left alone. It is explained once
   * at the foot of the card (`freeCaption`) rather than on every row. */
  startDealt: "Dealt by this seed",
  /** The way on from the start card — the craft, and RIDE with it. One word,
   * because it stands in the head's corner rather than across the card's
   * foot, and the card it opens is titled CRAFT. */
  startNext: "NEXT",
  /** The press that actually rides, on the craft card at the end of it. */
  startGo: "RIDE",

  /* ── THE CRAFT CARD (menu-craft.tsx, craft-picker.tsx) ─────────────── */
  /** The second card's own title. */
  craftTitle: "CRAFT",
  /** THE CLASS the craft is ridden in — FREE'S ROW ALONE. A kart game counts
   * its classes in engine size; the sport this one is about counts them the
   * way its own race paddock does — a stock ski, a limited one, an open one —
   * so the rungs are the classes a rider would actually enter, with a novice
   * class under them for a first ride. The row moves the whole roster at once
   * and PACES THE COURSE with it, so a class is a different race rather than
   * only a faster hull; every mode that MEASURES a rider is stock, and the
   * craft card does not draw the row at all there (`classFor`). */
  classRow: "CLASS",
  className: (id: string): string => CLASS_NAMES[id] ?? id,
  /** The arrows either side of the hull, for a reader who cannot see it. */
  craftPrev: "Previous craft",
  craftNext: "Next craft",
  /** Where this hull stands in the roster — `2 / 4`, so four craft turning
   * one at a time read as a set with edges rather than as a carousel. */
  craftOf: (at: number, of: number): string => `${at} / ${of}`,
  /** The hours, in the order a day passes through them. */
  timeSunrise: "SUNRISE",
  timeDay: "DAY",
  timeSunset: "SUNSET",
  timeNight: "NIGHT",
  /** The seasons, in the year's order. */
  seasonSpring: "SPRING",
  seasonSummer: "SUMMER",
  seasonAutumn: "AUTUMN",
  seasonWinter: "WINTER",
  /** The HUD's sun clock: the hour the run has reached, and the word for
   * its light under it. */
  sunClockLabel: (daylight: "dawn" | "day" | "dusk" | "night"): string =>
    ({ dawn: "DAWN", day: "DAY", dusk: "DUSK", night: "NIGHT" })[daylight],
  /** The winds, calmest first. Named for the SEA they build rather than for
   * a number, because a rung of this ladder is something a rider feels
   * through the hull long before they read it off the vane. */
  windCalm: "CALM",
  windBrisk: "BRISK",
  windStorm: "STORM",
  /** A wind as a box reads it: the rung's word and the figure it stands
   * on, since a rider knows one of the two and learns the other. */
  windAt: (word: string, ms: number): string => `${word} ${ms.toFixed(0)} M/S`,
  /** The seas, smallest first — the Douglas scale's own words for its own
   * bands, which is why they are these words and not prettier ones. Each is
   * shown with the metres it stands for, because a rider who has never met
   * the scale still knows what nine metres is. */
  seaState: (id: SeaStateId, metres: number): string => `${SEA_STATE_NAMES[id]} ${metres} M`,
  /** The skies, lightest first — R19's own six, in the engine's order.
   * Plain-weather words for ids that are art direction's: `haze` is a warm
   * coast's white morning, `high` is a thin sheet up there, `overcast` is
   * the dry lid, `rain` is that lid falling. */
  skyClear: "CLEAR",
  skyHaze: "HAZE",
  skyHigh: "HIGH CLOUD",
  skyOvercast: "CLOUDY",
  skyRain: "RAINY",
  skySquall: "SQUALL",
  /** The seed's picture while it is being built, and when the generator
   * refuses the seed outright. */
  seedReading: "READING THE CHART…",
  seedRefused: "NO COAST AT THIS SEED",
  /** What the chart says, under it — and the same line as the picture's own
   * label for a reader who cannot see it. */
  seedRead: (gates: number, metres: number): string =>
    `${gates} GATES · ${(metres / 1000).toFixed(1)} KM`,
  seedChart: (seed: number, gates: number, metres: number): string =>
    `Seed ${seed}: ${gates} gates over ${Math.round(metres)} metres of coast`,

  /* ── THE KNOB ROWS (menu-knobs.tsx) ────────────────────────────────── */
  /** The two stops of every switch in the game. A switch is a two-stop ladder
   * here, so ON and OFF are read off the same table as every other value. */
  optOn: "ON",
  optOff: "OFF",
  /** What a row reads while it has no answer yet — the moment on the start
   * card before the seed's own day has come back from the worker. */
  optUnset: "—",
  /** What the two arrows either side of a value DO, for a screen reader: a
   * ladder steps, a fader goes up and down. Never drawn. */
  optPrev: "previous",
  optNext: "next",
  optLess: "less",
  optMore: "more",

  /* ── OPTIONS (menu-options.tsx) ────────────────────────────────────── */
  /** The five groups the page's rows stand under, in the order they are
   * walked: what the hands do, where the eye rides, what is drawn over the
   * water, what it sounds like, and what the picture costs. Each is a word
   * AND a mark (`menu-glyphs.tsx`) — the mark is what the eye finds the group
   * by on a card of identical rows. */
  optControlsGroup: "CONTROLS",
  optRiding: "RIDING",
  optHudGroup: "HUD",
  optSoundGroup: "SOUND",
  optPicture: "PICTURE",
  /** The page's own line, under the rows, while no row is being looked at —
   * so it says the one thing a rider has to know to read the rest of the
   * card: point at a row and this bar tells you what it does. */
  optCaption: "Point at a row to read what it does — every one is live on the sea behind this card",
  optCamera: "CAMERA",
  optCameraHint:
    "Where the eye rides — the ladder the C key walks, from the bow out to the helicopter",
  optHud: "HUD",
  optHudHint: "The readouts over the water — off leaves the sea and nothing else",
  /** The three stops every picture ladder is walked in, cheapest first. One
   * set of words for all three rows: LOW on one row and MINIMAL on the next
   * would read as two different kinds of ladder. */
  optLow: "LOW",
  optMedium: "MEDIUM",
  optHigh: "HIGH",
  /** The picture rows. Each names WHAT it moves, never how much — "how far
   * out the sea is drawn properly" is the row, and its three stops are the
   * answer; a row that had to be read is a row that has failed. */
  optWater: "WATER",
  optWaterHint:
    "The whole sea — how fine the grid is and how far out it reaches, plus the spray, the wake, the splash and what the water mirrors",
  optDistance: "DISTANCE",
  optDistanceHint:
    "How much of the coast is drawn — the shorter the view, the closer the haze that closes over it",
  optResolution: "RESOLUTION",
  optResolutionHint: "How many pixels the water is drawn at before it reaches the screen",
  optDetail: "DETAIL",
  optDetailHint:
    "Everything around the water — the sea life, what grows on the shore, how much cloud is in the sky, and how much rain falls out of it",
  optSeeThrough: "SEE-THROUGH",
  optSeeThroughHint: "The bed, the rocks and what swims under the hull — off, the sea is solid",
  /** The one row on the picture page that is about TIME: the two stops are
   * spelled as the figures they are, and the top of the ladder is whatever
   * the screen itself does. */
  optFrameRate: "FRAME RATE",
  optFrameRateHint:
    "The most frames a second the game draws — hold it to what this machine can keep, and the ride is even",
  optFrameRateMax: "MAX",
  optFps: "FPS",
  optFpsHint: "Frames a second in the corner, beside the build",
  /** The one fader. It reads OFF at the bottom of its travel and a share
   * everywhere else; there is no MUSIC row until there is a score. */
  optSound: "EFFECTS",
  optSoundHint: "The engine, the spray, the sea and every splash — OFF at the bottom of the travel",
  optSoundOff: "OFF",
  /** The motor. Only drawn on a device that has one, so the words may
   * assume a phone in two hands — and they name the WATER rather than the
   * hardware, because what the row switches off is the sea hitting the
   * hull, not a feature called haptics. */
  optRumble: "VIBRATION",
  optRumbleHint: "The sea through the bars — every slap of the bottom, every landing, every rock",
  percent: (share: number): string => `${Math.round(share * 100)}%`,
  /** The door to the bindings page, and what stands where a value would:
   * how many actions are behind it, so a row that opens a page still says
   * what is in there the way every other row says what it is set to. It is
   * named for what is BEHIND it rather than for the hardware — a page of
   * bindings is what a rider goes looking for, and KEYBOARD is what the thing
   * on the desk is called. */
  optKeyBindings: "KEY BINDINGS",
  optKeyBindingsHint:
    "Which key does what — every action on the craft, and the presses around a run",
  optKeysCount: (n: number): string => `${n} KEYS`,
  optRestore: "RESTORE DEFAULTS",
  /** The camera rows, in the ladder's own order — the handlebars backwards.
   * Each is one word: the row is seven chips wide and read at a glance. */
  cameraBow: "BOW",
  cameraNose: "NOSE",
  cameraClose: "CLOSE",
  cameraChase: "CHASE",
  cameraFar: "FAR",
  cameraHeli: "HELI",
  cameraDrone: "DRONE",
  /** The broadcast, which no OPTIONS row offers and no run may be ridden
   * from — the camera key reaches it in a REPLAY and nowhere else
   * (`camera-tv.ts`). */
  cameraTv: "TV",

  /* ── THE KEYBOARD PAGE (menu-keys.tsx, settings-input.ts) ──────────── */
  /** One word per action, and every one of them says what the CRAFT does
   * rather than what the code is called: a rider looking for the brake is
   * looking for the word BRAKE, and `reverse` is the engine's name for it. */
  keysTitle: "KEY BINDINGS",
  keyThrottle: "THROTTLE",
  keyReverse: "BRAKE / REVERSE",
  keyLeft: "STEER LEFT",
  keyRight: "STEER RIGHT",
  keyLeanBack: "LEAN BACK",
  keyLeanForward: "LEAN FORWARD",
  keyTuck: "TUCK",
  keyReset: "BACK TO THE GATE",
  keyRestart: "RESTART THE RUN",
  keyCamera: "CAMERA",
  keyHud: "HUD ON / OFF",
  keyShot: "SCREENSHOT",
  keyPause: "PAUSE",
  /** What a row says while it waits for the key, what an action with no key
   * on it says, and the page's own line at the foot. */
  keysPrompt: "PRESS A KEY…",
  keysUnbound: "UNBOUND",
  keysCaption: "Press a row, then the key you want on it. One key replaces the whole binding",
  keysRowHint: (label: string): string =>
    `Press the row, then the key you want on ${label}. Escape keeps what is there`,
  /** A key doing two jobs at once. Allowed — a rider may want the brake and
   * the reset under one finger — but never hidden. */
  keysClash: "ALSO ON",
  keysClashHint: (label: string, others: string): string =>
    `${label} shares its key with ${others} — both happen on one press`,
  keysRestore: "RESET KEYS",

  /* ── THE DEVELOPER PAGE (menu-dev.tsx) ─────────────────────────────── */
  /** The one group of rows left on the page: the instruments over the top.
   * The shore, the scene and the water the run is stood up in are the START
   * CARD's and the repro link's — see the file's header. */
  devGroupTools: "TOOLS",
  devCost: "FRAME COST",
  devCostHint: "The water's CPU time, the draw calls and the triangles, in the HUD's corner",
  /** The page's own line under the rows — the bargain the whole page is
   * built on, said where a row is not being looked at. */
  devCaption: "Every row here is a parameter the repro link carries",
  devLock: "LOCK THE DEVELOPER MENU",
  devRepro: "COPY REPRO LINK",
  devReproCopied: "COPIED",
  devReproFailed: "COPY FAILED",

  /* ── THE UNLOCKS PAGE (menu-unlocks.tsx) ───────────────────────────── */
  /** The row into it, its title, and the one figure it bills itself with. */
  unlocksTitle: "UNLOCKS",
  unlocksRowHint: (cleared: number, of: number): string =>
    `Open or shut the campaign's shores — ${cleared} of ${of} levels cleared`,
  unlocksLine: (cleared: number, of: number): string =>
    `${cleared} of ${of} levels cleared · the record book is kept either way`,
  /** THE RULE, on the page rather than in a tooltip: a phone has no hover,
   * and a press whose reach is a surprise is a press nobody trusts twice. */
  unlocksRule:
    "A shore at a time. UNLOCK wins it and every shore before it; LOCK puts it and every shore " +
    "after back to never ridden — a campaign is a ladder, and it has no rung hanging in mid-air.",
  unlocksAll: "UNLOCK EVERYTHING",
  unlocksAllHint: (spent: boolean): string =>
    spent
      ? "Every shore is already won — in the campaign and in the modes it opens"
      : "Win every level of every shore, which opens them in race, tricks and time trial too",
  unlocksNone: "LOCK EVERYTHING",
  unlocksNoneHint: (spent: boolean): string =>
    spent
      ? "Nothing has been ridden — the campaign is already back at its first level"
      : "Back to a board that has never ridden a level; your records are untouched",
  unlocksShoreLine: (cleared: number, of: number, open: boolean): string =>
    `${cleared} of ${of} cleared · ${open ? "open" : "shut"}`,
  unlocksOpen: "UNLOCK",
  unlocksShut: "LOCK",
  unlocksOpenHint: (shore: string): string =>
    `Win every level of ${shore} and every shore before it`,
  unlocksShutHint: (shore: string): string =>
    `Put ${shore} and every shore after it back to never ridden`,

  /* ── THE BENCHMARK (menu-bench.tsx, benchmark*.ts) ─────────────────── */
  /** The developer page's two rows into it, and what each promises. The
   * length is read off the plan rather than spelled, so the row cannot
   * disagree with the run it starts. */
  benchTitle: "BENCHMARK",
  benchRowHint: (seconds: number, craft: number): string =>
    `Race ${craft} craft off one green and time it — the same ${seconds.toFixed(0)} seconds ` +
    "every run, drawn as fast as this machine will draw them",
  benchHistoryRowHint: (kept: number): string =>
    kept === 0
      ? "Nothing scored on this machine yet"
      : `${kept} run${kept === 1 ? "" : "s"} kept, with what the picture was set to on each`,
  /** THE SCORE'S UNIT, and the one gradation on its scale that means
   * something on its own. Said the same way on the card, on the graph's own
   * axis and in the pasted sheet, because they are one number. */
  benchIndexUnit: "INDEX",
  benchRealTime: "100 · REAL TIME",
  benchScoreLine: (index: number, fps: number): string => `INDEX ${index} · ${fps} FPS`,
  benchFpsAverage: (fps: number): string => `${fps} FPS AVERAGE`,
  /** What a run was measured ON — the billing under every one of the
   * benchmark's three surfaces. */
  benchShore: (seed: number, biome: string): string => `SEED ${seed} · ${biome.toUpperCase()}`,
  benchConditions: (shore: string, craft: number, w: number, h: number): string =>
    `${shore} · ${craft} CRAFT · ${w}×${h}`,
  /** The card's own presses. STOP is the way out MID-RUN and says what
   * leaving costs; once there is a score the same corner goes back to the
   * page the run was started from. */
  benchStop: "STOP",
  benchClose: "CLOSE",
  benchAgain: "RUN AGAIN",
  /** One word for one control, wherever it stands: a ROW on the card (which is
   * 28rem and, on a phone, the whole screen — see the note beside it) and a
   * head corner on the two surfaces wide enough for one. */
  benchCopyReport: "COPY DEBUG REPORT",
  benchCopySheet: "COPY SCORE SHEET",
  benchEnlarge: "TAP TO ENLARGE",
  benchEnlargeHint: "See the whole run full screen",
  /** A browser stops drawing a page nobody is looking at, and a clock that
   * kept running through it would be timing the machine's screensaver. */
  benchKeepInFront: "LEAVE THE WINDOW IN FRONT",
  /** The way to the list, from the card that has just made a row for it. */
  benchHistory: "HISTORY",
  benchHistorySub: (kept: number): string =>
    kept === 1
      ? "This run, kept — run it again with a row of VIDEO moved and the two sit side by side"
      : `All ${kept} runs this machine has scored, with what the picture was set to on each`,
  /** THE LIST. Its billing says what the scale means, because a page of
   * numbers with no unit on it is a page nobody can read twice. */
  benchHistoryTitle: "BENCHMARK HISTORY",
  benchHistoryBilling: (kept: number): string =>
    kept === 0
      ? "Nothing scored on this machine yet"
      : `${kept} run${kept === 1 ? "" : "s"} kept, newest first · 100 is real time, higher is better`,
  benchHistoryEmpty:
    "Run the BENCHMARK, move a row of OPTIONS ▸ VIDEO, run it again — the two land here side by " +
    "side and the difference is what that row costs on this machine",
  benchRunHint: "See this run's graph, and copy its debug report",
  benchDraws: (calls: string): string => `${calls} DRAWS`,
  benchClear: "CLEAR",
  /** The glyph code's legend, under the list — the same words the pasted
   * sheet prints, so the screen and the paste read alike. */
  benchLegendHead: "PICTURE — ONE GLYPH A ROW, LOW BAR CHEAPEST, IN THIS ORDER",
  benchLegendUnknown: "A STOP THIS BUILD DOES NOT HAVE",

  /* ── THE LOADING CARD (loading-screen.tsx) ─────────────────────────── */
  /** What each slice of standing a run up is called, for the card's line.
   * Steps sharing a label are one PHASE and one slot in the count. */
  loadLevel: "Building the shore",
  loadScene: "Standing the world up",
  loadWarm: "Compiling shaders",
  /** The benchmark's own last phase: the lights, counted out frame by frame
   * so the measurement behind the card starts on a warm machine at green
   * (`benchmark.ts`). Only ever seen on the way into a benchmark. */
  loadGrid: "Warming up on the grid",
  /** The phase and where it sits in the plan — a count of PHASES, never of
   * seconds (see `run-loader.ts`). */
  loadStep: (label: string, at: number, of: number): string => `${label}… (${at}/${of})`,
  /** THE LOAD THAT DID NOT FINISH. The generator refuses a seed it cannot
   * build a clean coast on — that is the search working, not a crash — and
   * the card it refuses under is the one place the player is looking. Worded
   * as a fact about the shore rather than as an error, because that is what
   * it is: this number is not a coast, and the next one along will be. */
  loadFailed: "NO COAST AT THIS SEED",
  loadFailedHint: "Try another shore",
  loadFailedBack: "BACK",

  /* ── THE PAUSE CARD (menu-pause.tsx) ───────────────────────────────── */
  /** The card a run is held under, and what it bills the held run as — the
   * same two words the HUD's build corner carries, so the card and the frame
   * behind it name the run the same way. */
  pauseTitle: "PAUSED",
  pauseSub: (seed: number, craft: string): string => `SEED ${seed} · ${craft.toUpperCase()}`,
  /** The three ways on. RESUME is the way OUT of the card as well as its
   * first row, and OPTIONS stands between it and the one press that ends the
   * run — see menu-pause.tsx. */
  pauseResume: "RESUME",
  pauseOptions: "OPTIONS",
  pauseMainMenu: "MAIN MENU",
  /** The card BEHIND the pause card's own options panel, named on the way
   * back out of it: a head says where ‹ goes, and where ‹ goes from here is
   * the held run's card and not the front door. */
  pauseBack: "PAUSED",
  /** The panel's own line while no row is being looked at. It says the one
   * thing that is different about settings changed HERE: the run is standing
   * still behind them, so what they do is visible on the held frame. */
  pauseOptionsCaption:
    "Point at a row to read what it does — the held frame behind this card answers to all four",
  /** What the minimap does when it is pressed — the way into the card on a
   * screen with no Escape key to press. */
  pauseOpen: "Pause (Esc)",
  /** WATCHING THE RUN SO FAR, off the pause card. The row says what it COSTS
   * on the row itself rather than behind a confirmation: a recording is
   * watched instead of the run, not as well as it, and a player who finds
   * that out afterwards has lost a race to a menu. */
  pauseReplay: "WATCH REPLAY",
  pauseReplayNote: "ends this run",

  /* ── A RUN BEING WATCHED (hud-replay.tsx, replay.ts) ─────────────────── */
  /** The strip over a recording: what it is, what it was ridden in, and how
   * it went. `value` is null on a run nobody finished — which is every
   * recording cut off the pause card. */
  replayLabel: "REPLAY",
  replayTitle: (bill: { name: string | null; seed: number }): string =>
    bill.name ? bill.name.toUpperCase() : `SEED ${bill.seed}`,
  replayLine: (bill: { mode: GameMode; craft: CraftId; value: number | null }): string =>
    [
      MODE_NAMES[bill.mode],
      // The hull's NAME, the way the pause card bills a held run — the id is
      // what the tape carries and not what anybody calls it.
      craftById(bill.craft).name.toUpperCase(),
      bill.value === null
        ? STRINGS.replayUnfinished
        : bill.mode === "tricks"
          ? STRINGS.resultScore(bill.value)
          : formatTime(bill.value),
    ].join(" · "),
  /** A recording of a run that never reached the line. It states the one
   * fact it has rather than naming a cause: a tape is cut short by a rider
   * who retired, by one who ran out of shore, and by one who simply wanted
   * to see the gate they lost it at — three different things, and the bar
   * cannot tell which of them it is looking at. */
  replayUnfinished: "UNFINISHED",
  /** The way out, and the one line of help under the bar. */
  replayExit: "EXIT",
  replayNote: "C for the camera · ESC to leave",
  /** The mark over the frame while the picture is running slow. */
  replaySlow: "SLOW",

  /* ── THE SHUTTER AND THE GALLERY (screenshots.ts, menu-gallery.tsx) ── */
  /** The one line of context a picture carries — the same two words the
   * pause card bills a held run with, because a picture of a run and a card
   * over one should name it the same way. It is the gallery's caption and,
   * slugged, half of the file's name. */
  shotLabel: (seed: number, craft: string): string => `SEED ${seed} · ${craft.toUpperCase()}`,
  /** The receipt, in the news column. A picture is filed frames after the
   * press that asked for it, so the press gets an answer either way — the
   * one thing worse than a failed capture is a shutter that says nothing.
   * The second line is the same picture with a copy of it on the CLIPBOARD,
   * which is what most presses get: it is said only once the write has come
   * back, because a browser may hold the permission back and a receipt that
   * promised a paste that is not there is worse than no receipt at all. */
  shotKept: "PICTURE SAVED",
  shotCopied: "PICTURE SAVED · COPIED",
  shotFailed: "PICTURE FAILED",
  /** The gallery. The subtitle counts the roll against its cap, because the
   * oldest picture falling off is the one thing about this page a player
   * would otherwise discover by losing something. */
  galleryTitle: "GALLERY",
  gallerySub: (kept: number, cap: number): string => `${kept}/${cap} — the oldest falls off`,
  /** Before the roll has been read, and after it has come back empty. Two
   * different sentences on purpose: a player with forty pictures must not be
   * told for a frame that they have none. */
  galleryReading: "Reading the roll…",
  galleryEmpty: "Nothing here yet. Press ENTER during a run and the picture lands here.",
  /** The three ways a picture leaves the game, offered only where the
   * browser will actually do them (lib/share-image.ts), and the two-step
   * delete beside them — a stray press must not destroy a picture that
   * cannot be taken again, because the shore it was taken on has long since
   * been rebuilt. */
  galleryShare: "SHARE",
  galleryCopy: "COPY",
  gallerySave: "SAVE",
  galleryDelete: "DELETE",
  galleryDeleteArm: "SURE?",
  /** What each of them says afterwards. A dismissed share sheet is an
   * ordinary outcome rather than a failure, and says so. */
  galleryShareOff: "SHARE CANCELLED",
  galleryCopied: "COPIED",
  galleryCopyOff: "COPY REFUSED",
  gallerySaved: "SAVED",
  gallerySaveOff: "SAVE REFUSED",
  /** Which picture of how many, and when it was taken, in the reader's own
   * clock. */
  galleryAt: (at: number, of: number, when: string): string => `${at}/${of} · ${when}`,
  galleryPrev: "Previous screenshot",
  galleryNext: "Next screenshot",
  galleryThumb: (n: number): string => `Screenshot ${n}`,
} as const;
