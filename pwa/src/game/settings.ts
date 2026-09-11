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
  CLASS_BAND,
  CRAFT_IDS,
  type CraftId,
  SEASONS,
  type Season,
  TIMES_OF_DAY,
  type TimeOfDay,
  WEATHER_IDS,
  type Weather,
} from "@engine";

import { CAMERA_MODES, type CameraMode } from "./camera.ts";
import { SCENARIO_NAMES, type ScenarioName } from "./scenarios.ts";
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

export type RideSettings = {
  craft: CraftId;
  /** THE CLASS the craft is ridden in — the sport's own ladder, and this
   * game's answer to a kart game's engine sizes. It is a multiple of the
   * catalog's own speed (`CLASS_BAND`), and it is TWO things at once: the
   * hull is derived at it and the COURSE is paced for it, because gates
   * are laid in metres and a faster rider needs them further apart to be
   * the same race. So the same seed in two classes is two different
   * courses, and the class belongs beside the craft rather than under the
   * shore. */
  speedClass: number;
  /** Which shore. Null is {@link DEFAULT_SEED}, which is what a player who
   * has not gone looking gets — and therefore what a bug report is about
   * until somebody says otherwise. */
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
  /** The wind to ride in, and so the sea it builds — see {@link CONDITIONS}.
   * Null rides the shore as it was generated. */
  conditions: Conditions | null;
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
    // The skiff: the middle of the roster and the one a rider who has not
    // chosen should meet the water on.
    craft: "skiff",
    // STOCK — the roster as the catalog tunes it, and the class every
    // measurement in the docs is quoted at.
    speedClass: 1,
    // The shore as it was dealt: its own seed, its own hour, its own wind
    // and its own sky. A generated level is a whole DAY rather than a
    // backdrop — the wind that grew the waves is the wind its sky was dealt
    // off (R19) — and a card that arrived with an opinion about any of the
    // four would take that agreement away from every player who never
    // touched it.
    seed: null,
    time: null,
    season: null,
    conditions: null,
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
  if (TIMES_OF_DAY.some((id) => id === ride?.time)) settings.ride.time = ride?.time as TimeOfDay;
  if (SEASONS.some((id) => id === ride?.season)) settings.ride.season = ride?.season as Season;
  if (CONDITIONS.some((id) => id === ride?.conditions)) {
    settings.ride.conditions = ride?.conditions as Conditions;
  }
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
    if (SCENARIO_NAMES.some((name) => name === dev.scene)) {
      settings.dev.scene = dev.scene as ScenarioName;
    }
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
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* storage unavailable — the choice still applies to this session */
  }
}
