// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PLAYER'S SETTINGS: every choice the game remembers between visits, in
// one table, with the storage layer around it (OSS_GAME_SPEC §36).
//
// The module is in two halves and the split is deliberate. `mergeSettings` is
// a PURE function of a parsed blob — it never touches storage, so the root
// suite reads it without a browser (`tests/menu_system_test.ts`) — and
// `loadSettings` / `saveSettings` are the thin skin over `localStorage` that
// call it. Everything a test would want to ask about a stored blob is a
// question about the merge.
//
// THE MERGE IS FIELD BY FIELD, NEVER `Object.assign` OVER THE WHOLE THING.
// A blob written by an older build carries settings this one no longer has,
// and a value off a ladder this build still offers is worse than a default:
// the menu has no chip to put the cursor back on, so the player can never
// return to it once they move away. Every field below is therefore CHECKED
// against what the build actually offers, and anything that fails the check
// falls back to the default rather than being carried.

import {
  BIOME_IDS,
  type BiomeId,
  CLASS_BAND,
  CRAFT_IDS,
  type CraftId,
  type GameMode,
  isBiomeId,
  isGameMode,
  SWELL_DIAL,
  TRICK_LIMITS,
  SEASONS,
  type Season,
  TIMES_OF_DAY,
  type TimeOfDay,
  WEATHER_IDS,
  type Weather,
} from "@engine";

import { CAMERA_MODES, type CameraMode } from "./camera.ts";
import { CAMPAIGN_LEVELS } from "./campaign-levels.ts";
import { type ScenarioName } from "./scenarios.ts";
import {
  DEFAULT_VIDEO,
  DISTANCE_LEVELS,
  FLORA_LEVELS,
  FRAME_RATE_LEVELS,
  RAIN_LEVELS,
  RESOLUTION_LEVELS,
  SKY_LEVELS,
  WATER_LEVELS,
  WATER_PRESETS,
  type VideoSettings,
} from "./settings-video.ts";
import { DEFAULT_KEYS, freshKeys, mergeKeys, type KeyBindings } from "./settings-input.ts";

/** What the HUD draws. The whole overlay, and one readout that is not part of
 * it until it is asked for.
 *
 * `on` is the switch a rider actually reaches for, either to look at the water
 * with nothing over it or to take a picture of it. `fps` is the exception to
 * the rule that per-readout switches are a page of questions nobody asked: it
 * is not a fact about the RUN like the speed or the gate count, it is a fact
 * about the machine, and the only reason to want it on screen is that the
 * picture options next to it are being judged. It rides under `on` all the
 * same — it is a readout over the water, and a switch worded "the readouts
 * over the water" has to mean it. */
export type HudSettings = {
  on: boolean;
  fps: boolean;
};

/**
 * THE WINDS A PLAYER MAY ASK FOR — the ladder the SEA is read off.
 *
 * The wind is what builds the water here: the fetch law grows the waves out
 * of it and the gusts breathe around it, so asking for a wind is the one way
 * to ask for a sea. Each rung names a mean wind at 10 m and, with it, the sky
 * that BELONGS over that wind — which is R19's own agreement (a level's sky
 * is dealt off the wind that grew its waves) carried onto the card, so a
 * player who names a wind and leaves the sky alone still rides a day whose
 * water and ceiling are telling them the same thing. {@link RideSettings.weather}
 * is how that agreement is broken on purpose.
 *
 * `windy` rather than `wind` as an id because the value beside it is a wind
 * in m/s and two different things called `wind` in one table is a bug
 * waiting for a tired afternoon. The player reads the label, not the id.
 */
export const CONDITIONS = ["fine", "windy", "storm"] as const;
export type Conditions = (typeof CONDITIONS)[number];

/** What each rung IS: the mean wind at 10 m that builds the sea, and the sky
 * that belongs over it. The winds bracket R12's own band (6–14 m/s) — one
 * under it, one at the top of it, one well past it — so the three are a
 * ladder a rider can feel rather than three shades of the same afternoon. */
export const CONDITION_DAY: Record<Conditions, { weather: Weather; wind: number }> = {
  fine: { weather: "clear", wind: 4 },
  windy: { weather: "overcast", wind: 12 },
  storm: { weather: "squall", wind: 20 },
};

/** Every rung's wind, m/s — what the start card's row stores and what a
 * link carries, so the setting and the engine's option are the same number.
 * The same shape as {@link SEA_METRES} below it, and for the same reason:
 * the row picks among figures, and FREE's fader picks between them. */
export const CONDITION_WINDS: readonly number[] = CONDITIONS.map((c) => CONDITION_DAY[c].wind);

/**
 * The rung a wind of this speed stands nearest to, m/s.
 *
 * A level's own wind is a FIGURE rather than a rung — R12 grows it inside a
 * band and no seed lands on 4, 12 or 20 exactly — so the start card cannot
 * point at one of its three chips and say "this is the wind you were dealt"
 * without a rule for which chip that is. This is the rule: the nearest rung,
 * which is the one whose sea is closest to the sea the level actually has.
 * The chip it marks still rides the LEVEL's wind while nothing is chosen
 * (`RideSettings.conditions` null) — the mark says which sea is coming, not
 * which number is being asked for.
 */
export function conditionsFor(windMs: number): Conditions {
  let nearest: Conditions = CONDITIONS[0];
  let gap = Infinity;
  for (const rung of CONDITIONS) {
    const from = Math.abs(windMs - CONDITION_DAY[rung].wind);
    if (from < gap) {
      gap = from;
      nearest = rung;
    }
  }
  return nearest;
}

/** THE SKY THAT BELONGS OVER A WIND, off R19's own agreement — the nearest
 * rung's, because the agreement is between a sea and a ceiling and neither
 * of them is quoted to a tenth of a metre per second. It is what the WEATHER
 * row marks and what it overrides, and it is stated here rather than in the
 * card so that a wind arriving off a link and a wind pressed on the row
 * imply the same sky. */
export function skyForWind(windMs: number): Weather {
  return CONDITION_DAY[conditionsFor(windMs)].weather;
}

/** THE LENGTHS A TRICKS RUN MAY BE, in whole minutes — the engine's own
 * ladder (`TRICK_LIMITS`, s) read as the row reads it. */
export const TRICK_MINUTES: readonly number[] = TRICK_LIMITS.map((s) => s / 60);

/**
 * THE SEAS A PLAYER MAY ASK FOR — the ladder R36's wave-size dial is read
 * off, and the one row on the card that is not the wind's.
 *
 * The WIND row builds a sea out of the weather standing over this coast
 * right now; this one is the sea that came from somebody else's weather and
 * has been piling up outside the coast for days — the GROUNDSWELL (`Level.
 * swell`), which is why the two need not agree and why a flat blue morning
 * can have ten metres rolling under it.
 *
 * The rungs are the DOUGLAS SEA SCALE's, which is a real scale and so not
 * ours to invent: each id is the state's own name and each value the top of
 * its band in metres of significant height. That is where the ladder's two
 * ends come from rather than from a designer's taste — SLIGHT at a metre is
 * the smallest sea worth telling a player about, and PHENOMENAL at twenty
 * is where the scale itself stops counting. It is exactly `SWELL_DIAL`,
 * because the dial was quoted off the same scale.
 *
 * The height is the sea OUT PAST THE COAST, which is where a groundswell is
 * measured and where this one has accumulated; how much of it reaches the
 * shore is that coast's own share of the ocean, so the same rung rides
 * bigger on the open mangrove than on the sheltered taiga.
 */
export const SEA_STATES = [
  { id: "slight", hs: 1 },
  { id: "moderate", hs: 2.5 },
  { id: "rough", hs: 4 },
  { id: "veryRough", hs: 6 },
  { id: "high", hs: 9 },
  { id: "veryHigh", hs: 14 },
  { id: "phenomenal", hs: 20 },
] as const;
/** `SeaStateId` rather than `SeaState`: the engine already has a `SeaState`
 * and it is the whole wave field, not a word for how big it is. */
export type SeaStateId = (typeof SEA_STATES)[number]["id"];

/** Every rung's height, m — what a row stores and what a link carries, so
 * the setting and the engine's option are the same number. */
export const SEA_METRES: readonly number[] = SEA_STATES.map((s) => s.hs);

/**
 * The rung a swell of this height stands in — the scale's own word for it.
 *
 * BY BAND rather than by the nearest rung, unlike {@link conditionsFor}:
 * these rungs ARE bands on a scale somebody else drew, so a 3.2 m sea is a
 * ROUGH one and there is nothing to decide. A height past the top of the
 * scale is phenomenal, which is what the scale says too.
 */
export function seaRungFor(hs: number): SeaStateId {
  for (const rung of SEA_STATES) {
    if (hs <= rung.hs) return rung.id;
  }
  return SEA_STATES[SEA_STATES.length - 1].id;
}

export type RideSettings = {
  /** WHICH WAY ONTO THE WATER (`GAME_MODES`): a race against the field, a
   * timed run for tricks, or the course against the clock alone. The first
   * row of the start card, because it decides what the rows under it are
   * FOR. */
  mode: GameMode;
  /** How long a TRICKS run is, minutes, off {@link TRICK_MINUTES}. Only
   * read in that mode, and kept when another is chosen so the row is where
   * the rider left it when he comes back. */
  tricksMinutes: number;
  craft: CraftId;
  /** WHICH COAST — the biome the shore is built on (`BIOME_IDS`). Never
   * null: unlike the hour or the sky, a coast is not something a seed
   * DEALS — the same seed builds a taiga shore or a mangrove one depending
   * on what it is asked for — so there is no "the shore's own" to defer to,
   * and the row always states an answer. The first id the engine offers is
   * the default, as the first craft in the catalog is. */
  biome: BiomeId;
  /** THE CLASS the craft is ridden in — the sport's own ladder, and this
   * game's answer to a kart game's engine sizes. It is a multiple of the
   * catalog's own speed (`CLASS_BAND`), and it is TWO things at once: the
   * hull is derived at it and the COURSE is paced for it, because gates
   * are laid in metres and a faster rider needs them further apart to be
   * the same race. So the same seed in two classes is two different
   * courses, and the class belongs beside the craft rather than under the
   * shore. */
  speedClass: number;
  /** WHICH PINNED LEVEL a measured run is ridden on — the id of one of the
   * campaign's pinned shores (`campaign-levels.ts`), which is what RACE, TRICKS and
   * TIME TRIAL choose instead of a seed (`menu-levels.tsx`). Null is no
   * pinned shore at all: a FREE ride, which asks for a seed and a day of its
   * own, and a LINK that named a seed, which is how every lab photographs a
   * shore that is nobody's rung.
   *
   * It is stored beside the seed rather than in place of it because the two
   * are different questions and both rows are still asked — the day the
   * pinned level pins is its own (`pinnedGame`), and the seed row's day is
   * the free ride's. */
  level: string | null;
  /** Which shore, on a ride that is choosing one. Null is
   * {@link DEFAULT_SEED}, which is what a player who has not gone looking
   * gets — and therefore what a bug report is about until somebody says
   * otherwise. */
  seed: number | null;
  /** Which hour to ride at, named rather than counted: the engine resolves
   * it against the coast's own daylight window (`hourOfDay`). Null rides
   * the hour the level was dealt (R13). */
  time: TimeOfDay | null;
  /** Which SEASON to ride in — the sun's arc, and so how long the day is
   * and how dark the night gets (R13). Null rides the season the level was
   * dealt. A season asked for here moves the sun and nothing else: the
   * water and what swims in it stay the level's own. */
  season: Season | null;
  /** THE WIND to ride in, m/s at 10 m, and so the sea it builds — see
   * {@link CONDITIONS}. Null rides the shore as it was generated.
   *
   * A FIGURE rather than one of the three rungs' names, because the row that
   * writes it is FREE's fader and may stand anywhere on
   * {@link FREE_WIND_RANGE}; a link may still name a rung by WORD
   * (`url-params.ts`'s `windParam`) and it resolves to that rung's figure.
   * One field, so nothing has to decide which of two winds a run is ridden
   * in — and the sky it implies is read off the figure either way
   * (`skyForWind`). */
  wind: number | null;
  /** WHICH QUARTER that wind blows from, DEGREES off dead onshore: 0 is
   * straight in off the open water, ±90 along the shore, ±180 off the land
   * behind (the engine's `windQuarter`, which is the same angle in rad).
   * Null rides the quarter the level was dealt, which R12 always deals
   * within 60° of onshore.
   *
   * Only FREE's row writes it, and that is the point: a quarter past a
   * right angle turns the fetch round onto the land and flattens the sea
   * however hard the wind is set, which is a real day and not a day any
   * mode that measures a rider should be able to deal itself.
   *
   * Degrees rather than radians because it is a stored blob and a link: a
   * row worth reading back off a URL is a row somebody can read. */
  windQuarter: number | null;
  /** R36 — HOW BIG THE SEA OUTSIDE IS, m of significant height inside the
   * engine's own `SWELL_DIAL` — FREE's fader stands anywhere on it and
   * {@link SEA_METRES} is the scale a figure is READ on
   * ({@link seaRungFor}), the way the wind above it works: the groundswell
   * that has piled up past this coast,
   * which is not the wind's and does not move with the row above. Null
   * rides the swell the shore was dealt. It is the BASELINE and not a
   * ceiling — the open ocean past the level's rim still builds on top of
   * whatever is asked for here. */
  swell: number | null;
  /** The SKY to ride under, off the engine's own ladder (R19's five). Null
   * takes the sky the wind implies — the chosen rung's, or, where nothing is
   * chosen, the one the level was dealt — so the row only ever OVERRIDES the
   * agreement between the water and the ceiling, never states it. That is
   * the one thing this row can do that the wind row cannot: a downpour over
   * a flat calm, or a clear noon over a sea that has no business being that
   * big. */
  weather: Weather | null;
  /** The camera. It decides what a run OPENS on, and moving it moves the
   * camera NOW as well — the pause card opens OPTIONS over a frozen run, and
   * a row worded CAMERA that only took effect next time would be a row the
   * app ignores exactly where it is most obviously being asked (`App.tsx`).
   * The camera key still walks the whole ladder without writing this, so the
   * two never argue. */
  camera: CameraMode;
};

/** THE DEVELOPER'S OWN, and every one of them is a URL parameter `App.tsx`
 * already reads (`?seed=`, `?wind=`, `?hs=`, `?scene=`). That is not a
 * coincidence and it is the rule for anything added here: a developer
 * setting is a way of reaching, from inside the game, a frame that could
 * otherwise only be reached by typing a query string — so a frame found by
 * poking at the menu can always be handed to somebody else as a link.
 *
 * Only reachable once `developer` is true, and only ever switched on
 * deliberately. */
export type DevSettings = {
  /** Ride in this wind, m/s, from the level's own quarter — null for the
   * wind the level was generated with. The fastest way to see the hull in a
   * sea it would take a dozen seeds to meet. */
  wind: number | null;
  /** ...or in a sea quoted by its significant height, m. Null for the sea
   * the wind grows. Set alongside `wind` it wins, which is the same
   * precedence `?hs=` has over `?wind=` in the URL. */
  hs: number | null;
  /** Stand the run in a staged moment (`scenarios.ts`) instead of at the
   * level's start — the launch off a ramp, the nose-down landing, the chop.
   * Null rides from the start line with the clock running. */
  scene: ScenarioName | null;
  /** The frame cost under the minimap: the water's CPU time, the draw calls,
   * the triangles. What `make profile` counts, while playing. */
  cost: boolean;
};

/**
 * WHAT THE GAME SOUNDS LIKE, as far as the player may move it: one fader,
 * 0..1 in twentieths, over every sound effect — the engine bed, the spray,
 * the splashes and the chimes alike. 0 is OFF. A second fader for the music
 * arrives with the music (`soundtrack`), never before, because a row the app
 * ignores is worse than no row.
 */
export type AudioSettings = {
  sfx: number;
};

/** The fader's own ladder: twentieths, so OFF, a whisper and full are each
 * a few presses apart on a controller. */
export const SFX_STEP = 0.05;

export type Settings = {
  hud: HudSettings;
  ride: RideSettings;
  audio: AudioSettings;
  /**
   * WHAT THE RIDE DOES TO THE HAND HOLDING IT: the phone's motor, on or
   * off. One switch and no fader, because there is nothing honest to put a
   * fader on — a browser motor has one axis (how long), the device decides
   * how hard, and a row worded "how much" that a phone rounds back to the
   * same buzz would be the page pretending to a control it has not got.
   * What each moment is worth is authored in `rumble.ts`.
   *
   * Top-level rather than under `audio` even though the two answer the same
   * events: a rider who wants the game silent on a train usually still
   * wants to feel the water, and folding one into the other would take that
   * away. On a machine with no motor the row is not offered at all
   * (`haptics.ts`'s `canRumble`) — the setting is still stored, so a phone
   * and the laptop beside it do not argue over one blob.
   */
  rumble: boolean;
  /** What the picture costs — the rows of OPTIONS ▸ VIDEO. What each one buys
   * is `settings-video.ts`, which is also where the ladders are stated. */
  video: VideoSettings;
  /** WHICH KEY DOES WHAT — the rows of OPTIONS ▸ KEYBOARD. The actions, the
   * defaults and the words for them are `settings-input.ts`; this is only
   * where the rider's own answer is kept. Stored on a phone as well as a
   * laptop, though the phone is never offered the page: one blob, and two
   * devices reading it must never argue about it. */
  keys: KeyBindings;
  /** True once THIS MACHINE HAS BEEN MEASURED — the first-visit probe
   * (`video-probe.ts`) has drawn the design point for a couple of seconds
   * under the attract card and given its verdict, whichever way it went.
   * It stays true so nobody is measured twice: a rider the probe promoted
   * who turned a row back down has said what they think, and a probe that
   * ran again would overrule them. RESTORE DEFAULTS clears it with the rest,
   * which is the one honest way back to a first visit. */
  probed: boolean;
  /** True once the developer menu has been let out — the START row held
   * down for {@link DEV_HOLD_MS}. It STAYS out: a player who found it
   * deliberately does not want to find it again every time they open the
   * game. */
  developer: boolean;
  dev: DevSettings;
};

/** How long the main menu's START row has to be held before the developer
 * menu is let out.
 *
 * Seven seconds is the whole design. A press is a fifth of a second and a
 * player leaning on the row while they decide is under two, so nothing
 * anybody does on the way into a game reaches it; and it is short enough
 * that somebody TOLD about it finds it on their first try. There is no
 * combination to remember and nothing to type — the way in is the same
 * button as the way in.
 *
 * The row says so while it is being held (`menu-hold.ts` owns the ramp), so
 * a hold that is going to unlock something says it is going to before it
 * does, and a finger resting on START is never a surprise. */
export const DEV_HOLD_MS = 7000;

export const DEFAULT_SETTINGS: Settings = {
  hud: { on: true, fps: false },
  video: DEFAULT_VIDEO,
  keys: DEFAULT_KEYS,
  // Loud enough to be the game, short of full so a landing has somewhere to
  // go — the bank is mixed at the chase seat with this much headroom.
  audio: { sfx: 0.8 },
  // On, where there is a motor to feel it with. The sea hitting the hull is
  // half of what riding one of these is, and a rider who does not want it
  // has one row to find.
  rumble: true,
  probed: false,
  ride: {
    // THE RACE. The first mode on the card and the one the game is: a
    // field on the water is what the front door's own sea shows.
    mode: "race",
    // The shortest tricks run — long enough to string a few combos, short
    // enough that a first one is not a commitment.
    tricksMinutes: TRICK_MINUTES[0],
    // The taiga: the coast every rule was written against, and the one the
    // game opened on.
    biome: BIOME_IDS[0],
    // The skiff: the middle of the roster and the one a rider who has not
    // chosen should meet the water on.
    craft: "skiff",
    // STOCK — the roster as the catalog tunes it, and the class every
    // measurement in the docs is quoted at.
    speedClass: 1,
    // NO PINNED LEVEL until a card picks one. A fresh app stands its
    // attract sea up on the shore the game ships with, exactly as it did
    // before the pinned shores were a way on, and every lab's `?seed=` link still
    // rides the seed it names.
    level: null,
    // The shore as it was dealt: its own seed, its own hour, its own wind
    // and its own sky. A generated level is a whole DAY rather than a
    // backdrop — the wind that grew the waves is the wind its sky was dealt
    // off (R19) — and a card that arrived with an opinion about any of the
    // four would take that agreement away from every player who never
    // touched it.
    seed: null,
    time: null,
    season: null,
    wind: null,
    // FREE's own row, and the only one that does not also appear on the
    // other three cards: the quarter is a knob a measured run does not get.
    windQuarter: null,
    // R36 — and its own sea outside: a shore is dealt a swell as surely as
    // it is dealt a wind, and the two are separate weather.
    swell: null,
    weather: null,
    // Behind and above, which is the camera the game is tuned to be read
    // at — the nose view is a thing you go looking for.
    camera: "chase",
  },
  developer: false,
  dev: { wind: null, hs: null, scene: null, cost: false },
};

/** The default shore. Stated here rather than in `App.tsx` because the
 * start card's SEED row has to be able to say what NULL means, and a row
 * that named a different number from the one the game rides would be the
 * menu lying about the frame under it. */
export const DEFAULT_SEED = 38;

/** The shores a row may be walked or typed to. Seed 0 is not a level, so the
 * floor is 1; the ceiling is six digits because that is what a seed being
 * PASSED BETWEEN PEOPLE has to stay — a number somebody can read off a screen,
 * say out loud and type back in. The generator takes any integer, so this is
 * the CARD's range and not the engine's. */
export const SEED_RANGE = { min: 1, max: 999999 } as const;

/** The wind the developer's row may ask for, m/s, and the sea it may ask
 * for, m. Both are the range the model is honest over: past the top of the
 * wind the fetch law is extrapolating, and a sea quoted taller than this
 * over a shore this shallow is breaking before it arrives. */
export const DEV_WIND_RANGE = { min: 0, max: 30 } as const;
export const DEV_HS_RANGE = { min: 0, max: 8 } as const;

/**
 * FREE'S OWN TRAVEL — how far its three faders go, and the one place in the
 * app where a row is deliberately allowed past what the generator deals.
 *
 * THE WIND runs from a flat calm to forty metres a second. R12 deals between
 * six and fourteen and the start card's three rungs bracket that (4, 12, 20);
 * forty is roughly twice the top of the ladder and well past hurricane force,
 * which is the point — the model will extrapolate and the sea it builds is
 * not a sea anybody has ridden, and a mode called FREE is where you go to
 * find out what that looks like. Nothing is measured on it (`records.ts`), so
 * nothing is being cheated.
 *
 * THE QUARTER is the whole circle, in degrees off dead onshore: past a right
 * angle the wind is blowing out to sea and the fetch is measured over the
 * land, so the water goes flat however hard the row is pushed. That is the
 * honest answer and it is worth being able to see.
 *
 * THE SWELL is not stated here at all — it is the ENGINE's `SWELL_DIAL`, and
 * restating its ends in the app is how a card comes to offer a sea the
 * generator would clamp.
 */
export const FREE_WIND_RANGE = { min: 0, max: 40 } as const;
export const QUARTER_RANGE = { min: -180, max: 180 } as const;
/** What one press of the quarter row's arrow is worth, degrees. Fifteen is
 * a point of the compass rose's own eighth, so the ladder passes through
 * dead onshore, the corners and along the shore exactly. */
export const QUARTER_STEP = 15;

const SETTINGS_KEY = "sea-haven-settings";

/** The defaults, as a blob nothing else shares a reference with — what a
 * first visit loads, and what RESTORE DEFAULTS puts back. */
export function freshSettings(): Settings {
  return {
    hud: { ...DEFAULT_SETTINGS.hud },
    ride: { ...DEFAULT_SETTINGS.ride },
    video: { ...DEFAULT_SETTINGS.video },
    // Deep, unlike every other line here: each action holds a LIST, and a
    // shallow copy would hand the rider the defaults' own arrays to rebind.
    keys: freshKeys(),
    audio: { ...DEFAULT_SETTINGS.audio },
    rumble: DEFAULT_SETTINGS.rumble,
    probed: false,
    developer: false,
    dev: { ...DEFAULT_SETTINGS.dev },
  };
}

/** A finite number inside a range, or null for anything else — which is
 * what a row set to AUTO stores and what a blob from a build with a wider
 * range comes back as. */
function inRange(value: unknown, range: { min: number; max: number }): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value >= range.min && value <= range.max ? value : null;
}

/**
 * Stored settings laid over the defaults, one field at a time.
 *
 * Pure, and takes the parsed blob rather than reading storage itself, so the
 * root suite can hand it a blob from an older build and check what survives.
 * Anything it does not recognise is dropped on the floor: an unknown craft,
 * a camera this build no longer has, a scene that was renamed. That is the
 * whole job — see this module's header for why a check beats a merge.
 */
export function mergeSettings(parsed: unknown): Settings {
  const settings = freshSettings();
  if (!parsed || typeof parsed !== "object") return settings;
  const blob = parsed as Partial<Record<keyof Settings, unknown>>;

  const hud = blob.hud as Partial<Record<keyof HudSettings, unknown>> | undefined;
  if (typeof hud?.on === "boolean") settings.hud.on = hud.on;
  if (typeof hud?.fps === "boolean") settings.hud.fps = hud.fps;

  // Every picture row is checked against the ladder THIS build offers, for the
  // reason the header gives: a stop that has been renamed or dropped is a chip
  // the options page cannot put the cursor back on, so the rider would be
  // stuck on a picture they can see but not choose.
  const video = blob.video as Partial<Record<keyof VideoSettings, unknown>> | undefined;
  if (video) {
    const on = <T extends string>(stops: readonly T[], value: unknown): T | null =>
      stops.some((id) => id === value) ? (value as T) : null;
    settings.video.water = on(WATER_LEVELS, video.water) ?? settings.video.water;
    // THE WATER ROW IS ONE WORD, EXPANDED — the spray, the wake, the splash
    // and the mirror are read off the stop above rather than out of the blob,
    // so a sea the rider asked to be cheap is cheap in every part of itself.
    // Any of the four stored beside it is a leftover from the build where
    // they hung off DETAIL, and honouring one would keep a sharp mirror on a
    // LOW sea for ever — the exact disagreement the row was moved to end.
    Object.assign(settings.video, WATER_PRESETS[settings.video.water]);
    settings.video.distance = on(DISTANCE_LEVELS, video.distance) ?? settings.video.distance;
    settings.video.resolution =
      on(RESOLUTION_LEVELS, video.resolution) ?? settings.video.resolution;
    settings.video.flora = on(FLORA_LEVELS, video.flora) ?? settings.video.flora;
    settings.video.sky = on(SKY_LEVELS, video.sky) ?? settings.video.sky;
    settings.video.rain = on(RAIN_LEVELS, video.rain) ?? settings.video.rain;
    settings.video.frameRate = on(FRAME_RATE_LEVELS, video.frameRate) ?? settings.video.frameRate;
    if (typeof video.seeThrough === "boolean") settings.video.seeThrough = video.seeThrough;
    if (typeof video.fauna === "boolean") settings.video.fauna = video.fauna;
  }

  // The bindings are checked action by action against the ones this build
  // has, the way every other stored value is — see `mergeKeys`.
  mergeKeys(settings.keys, blob.keys);

  // The fader is a share, and a share it is not — a percentage from a build
  // that stored one, a string — is the default rather than a scream.
  const audio = blob.audio as Partial<Record<keyof AudioSettings, unknown>> | undefined;
  const sfx = inRange(audio?.sfx, { min: 0, max: 1 });
  if (sfx !== null) settings.audio.sfx = Math.round(sfx / SFX_STEP) * SFX_STEP;

  if (typeof blob.rumble === "boolean") settings.rumble = blob.rumble;

  const ride = blob.ride as Partial<Record<keyof RideSettings, unknown>> | undefined;
  // The mode against the engine's own list, and the length against its
  // ladder: a length off it is a row with no pip to stand on.
  if (isGameMode(ride?.mode)) settings.ride.mode = ride.mode;
  if (TRICK_MINUTES.some((m) => m === ride?.tricksMinutes)) {
    settings.ride.tricksMinutes = ride?.tricksMinutes as number;
  }
  // Checked against the coasts this build has BUILT: a biome id the engine
  // reserves but has no row for is a level that throws on load.
  if (isBiomeId(ride?.biome)) settings.ride.biome = ride.biome;
  // Checked against the catalog rather than merged: a craft this build
  // dropped is a run with no hull to build.
  if (CRAFT_IDS.some((id) => id === ride?.craft)) settings.ride.craft = ride?.craft as CraftId;
  // The class is checked against the ladder THIS build offers, for the same
  // reason every picture row is: a rung that has been retuned or dropped is
  // one the card could not put the cursor back on.
  if (CLASS_BAND.some((k) => k === ride?.speedClass)) {
    settings.ride.speedClass = ride?.speedClass as number;
  }
  if (typeof ride?.seed === "number" && Number.isInteger(ride.seed) && ride.seed > 0) {
    settings.ride.seed = ride.seed;
  }
  // A LEVEL THAT NO LONGER EXISTS IS NOT A LEVEL: the id is checked against
  // the ladder the same way `mergeProgress` checks a board's rows, so a
  // level renamed or retired leaves no shore nothing can build.
  if (CAMPAIGN_LEVELS.some((level) => level.id === ride?.level)) {
    settings.ride.level = ride?.level as string;
  }
  if (TIMES_OF_DAY.some((id) => id === ride?.time)) settings.ride.time = ride?.time as TimeOfDay;
  if (SEASONS.some((id) => id === ride?.season)) settings.ride.season = ride?.season as Season;
  // The wind, the quarter and the sea are RANGES rather than ladders now
  // that FREE's faders write them: a stored figure between two of the start
  // card's rungs is a free run's answer, not a corrupt blob. Each is still
  // checked — a figure off the travel is one no row could put the thumb back
  // on — and the sea's range is the ENGINE's, never a copy of it.
  settings.ride.wind = inRange(ride?.wind, FREE_WIND_RANGE);
  settings.ride.windQuarter = inRange(ride?.windQuarter, QUARTER_RANGE);
  settings.ride.swell = inRange(ride?.swell, SWELL_DIAL);
  // Checked against the ENGINE's ladder, not a copy of it: a sky R19 stops
  // dealing is a sky this card stops offering, on the same day.
  if (WEATHER_IDS.some((id) => id === ride?.weather)) {
    settings.ride.weather = ride?.weather as Weather;
  }
  if (CAMERA_MODES.some((mode) => mode === ride?.camera)) {
    settings.ride.camera = ride?.camera as CameraMode;
  }

  // A blob written before the probe existed reads as unmeasured, and that is
  // safe: the promotion only ever touches a picture with every row at its
  // default, so an old rider's own choices survive the measuring.
  if (blob.probed === true) settings.probed = true;

  if (blob.developer === true) settings.developer = true;
  const dev = blob.dev as Partial<Record<keyof DevSettings, unknown>> | undefined;
  if (dev) {
    settings.dev.wind = inRange(dev.wind, DEV_WIND_RANGE);
    settings.dev.hs = inRange(dev.hs, DEV_HS_RANGE);
    // ...but NOT the SCENE, which is read off the URL every time and never
    // out of the store (`saveSettings` does not write one either). A scene
    // is a moment STAGED — `placeRun` stands the craft at speed somewhere
    // down the shore and takes the lights off in front of it, because a
    // moment held at the grid for three seconds is a scene of nothing. That
    // is right for the frame a lab is photographing and wrong for every run
    // after it: kept, it silently re-staged every ride this browser ever
    // started again, with no row on any card to take it off. It lives as
    // long as the `?scene=` that asked for it and not one load longer, and
    // a blob written before this rule heals on the next visit.
    if (dev.cost === true) settings.dev.cost = true;
  }
  // A tool nobody can reach is a tool nobody can switch off: if the menu
  // that owns these was never let out, none of them is set.
  if (!settings.developer) settings.dev = { ...DEFAULT_SETTINGS.dev };
  return settings;
}

export function loadSettings(): Settings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    return mergeSettings(stored === null ? null : JSON.parse(stored));
  } catch {
    /* storage unavailable, or a blob that is not JSON — the defaults are a
       perfectly good game */
    return freshSettings();
  }
}

export function saveSettings(settings: Settings): void {
  try {
    // The SCENE is never written down — see `mergeSettings`. Stripped here
    // rather than left to the read side alone so a blob this build wrote
    // cannot re-stage a run for a build that reads it more trustingly.
    const kept: Settings = { ...settings, dev: { ...settings.dev, scene: null } };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(kept));
  } catch {
    /* storage unavailable — the choice still applies to this session */
  }
}
