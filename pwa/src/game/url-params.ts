// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE URL AS SETTINGS. Every parameter the app reads is listed and explained
// here (the developer page's REPRO LINK writes exactly this set, and
// `docs/configuration.md` is the player's copy); this module is the
// reading of it — what each parameter is checked against, and how the ones
// that are SETTINGS are laid over the stored ones without deciding that
// RIDE has already been pressed.
//
// The query string is an argument rather than read off `location`, the way
// `splash.ts` takes it, so the reading is a pure function of a string.
//
// URL PARAMS, the whole set (the developer page's REPRO LINK writes exactly
// these, so a frame is always handed on as a URL):
//   ?seed=38       which level (default 38)
//   ?biome=taiga   which COAST the seed is built on (taiga | mangrove | arctic)
//   ?mode=race     the start card's MODE row: race | tricks | timeTrial
//   ?minutes=4     ...and its LENGTH row, for a tricks run: 2 | 4 | 6
//   ?craft=skiff   which craft (skiff | marlin | otter | dart)
//   ?scene=launch  stand the run in a staged moment (scenarios.ts) and ride
//                  its script; without it the run starts at `level.start`
//                  with the clock running
//   ?t=2.5         seconds of the script to run before the first frame
//   ?shot=1        FREEZE after that and set `window.__SH_READY__` once the
//                  frame is drawn — what the screenshot tool waits on
//   ?wind=12       ride in this wind, m/s, from the level's own quarter
//   ?hs=20         ...or in a sea quoted by its significant height, m
//   ?hour=20.5     ride at this hour on the clock in place of the level's
//   ?weather=rain  ...and under this sky (clear | haze | high | overcast |
//                  rain | squall) — the sea stays the wind's
//   ?time=sunset   the start card's TIME row (a FREE ride's; on a measured
//                  run it is the lab's override of the shore's own day, and
//                  no row offers it): sunrise | day | sunset, resolved
//                  against this coast's own daylight (R13) in the season
//                  being ridden
//   ?season=autumn ...and its SEASON row: spring | summer | autumn | winter
//                  — the sun's arc, and so the day's length and the
//                  night's dark; the clock runs an hour a minute from the
//                  start, so a sunset start rides into whatever night the
//                  season has
//   ?day=storm     ...and its WIND row: fine | windy | storm — a sky AND the
//                  wind under it — or the wind in m/s (?day=33) on a free ride
//   ?windfrom=90   FREE's own row, on ?mode=free alone: which QUARTER that
//                  wind blows from, degrees off dead onshore (±180 offshore)
//   ?waves=9       ...and its WAVES row (R36): how big the GROUNDSWELL out
//                  past the coast is, m — 1 | 2.5 | 4 | 6 | 9 | 14 | 20, and
//                  anywhere between on a free ride. Not the wind's sea, not
//                  moved by ?day, and a BASELINE the open ocean builds on
//   ?camera=heli   which rung of the camera ladder the run opens on (bow |
//                  nose | close | chase | far | heli | drone) — a setting like the
//                  rows below, so a link lays it over the stored one; the
//                  camera key still walks the whole ladder from there
//   ?water=high    the picture rows, as OPTIONS ▸ VIDEO sets them:
//   ?res=low       WATER, RESOLUTION, DETAIL and DISTANCE (low | medium |
//   ?detail=low    high), SEE-THROUGH (?see=0/1) and the FRAME RATE cap
//   ?distance=low  (?fps=30/60/max). They are settings like the start
//   ?see=0         card's, so a link lays them over the stored ones rather
//   ?fps=30        than reading them into the run — which is what lets the
//                  screenshot lab photograph one row of the ladder, and a
//                  bug report about the water name the picture it was seen
//                  at
//   ?start=1       skip both cards and ride: a pinned run
//   ?paused=1      ...and open with the run HELD under the pause card, which
//                  is how the screenshot lab photographs that surface and how
//                  a report about it is handed on
//   ?splash=0/1    force the attract card off, or back on
//   ?menu=start    open the front door ON that page (root | campaign | levels |
//                  start | craft | options | keys | developer | benchHistory) — how
//                  the lab photographs a menu surface, and how a link points at one.
//                  The last two let the developer menu out with them: a URL
//                  that names a page has, by definition, found it
//   ?update=1      show the new-build button as if a build were waiting, so
//                  the surface can be photographed (read where it is drawn,
//                  in game/update-button.tsx — it is not part of a repro)
//   ?probe=0       do not measure the machine on this visit: the first-visit
//                  probe (game/video-probe.ts) is what may promote an
//                  untouched picture to HIGH, and a lab photographing a
//                  surface must not have a row move under its camera
//

import {
  type CraftId,
  type GameMode,
  isGameMode,
  SEASONS,
  type Season,
  TIMES_OF_DAY,
  type TimeOfDay,
  type TrackKind,
  WEATHER_IDS,
  type Weather,
  isCraftId,
  type BiomeId,
  isBiomeId,
  SWELL_DIAL,
} from "@engine";

import { CAMERA_MODES, type CameraMode } from "./camera.ts";
import type { MenuPage } from "./menu-page.ts";
import { isScenarioName, type ScenarioName } from "./scenarios.ts";
import {
  CONDITIONS,
  CONDITION_DAY,
  FREE_WIND_RANGE,
  QUARTER_RANGE,
  TRICK_MINUTES,
  type Settings,
} from "./settings.ts";
import {
  DETAIL_LEVELS,
  DETAIL_PRESETS,
  DISTANCE_LEVELS,
  FRAME_RATE_LEVELS,
  RESOLUTION_LEVELS,
  WATER_LEVELS,
  WATER_PRESETS,
  type DetailLevel,
  type DistanceLevel,
  type FrameRateLevel,
  type ResolutionLevel,
  type WaterLevel,
} from "./settings-video.ts";

export type Params = {
  seed: number | null;
  craft: CraftId | null;
  scene: ScenarioName | null;
  t: number;
  shot: boolean;
  /** A wind speed, m/s, in place of the level's; a sea quoted by its
   * significant height, m, in place of the one the wind grows. */
  wind: number | undefined;
  hs: number | undefined;
  /** An hour on the clock in place of the level's own. Read off the URL
   * alone: it is the LEVEL's, an exact figure rather than a named hour, so
   * nothing on a menu writes it. */
  hour: number | undefined;
  /** R29 — which chapter of the rule book the seed is dealt from: a coast
   * sprint or an ocean circuit ridden in laps. The LEVEL's, like the hour,
   * so it comes off the URL and no menu writes one yet. */
  track: TrackKind | undefined;
  /** The start card's own three rows, as a link carries them: a named hour,
   * a named wind and a named sky. Unlike `hour` these ARE the player's
   * settings, so they are laid over the stored ones rather than read
   * straight into the run. */
  time: TimeOfDay | undefined;
  season: Season | undefined;
  /** The WIND row, m/s — written either way it is worded on a card: one of
   * the three rungs by NAME (`?day=storm`, which is what the start card
   * presses) or the figure itself (`?day=33`, which is what FREE's fader
   * stands on). Both end up as the same setting, because the setting IS the
   * figure. */
  day: number | undefined;
  /** FREE's own row: which QUARTER that wind blows from, degrees off dead
   * onshore. Only a free ride reads it (`new-game.ts`), so a link that
   * carries one and does not say `?mode=free` is a link that set a row
   * nothing is looking at. */
  windFrom: number | undefined;
  /** R36 — how big the swell out past the coast is, m of significant height
   * anywhere inside the engine's `SWELL_DIAL`: one of the WAVES row's own
   * rungs, or, on a free ride, whatever its fader was left on. A setting
   * like the rows around it. */
  waves: number | undefined;
  weather: Weather | undefined;
  /** The start card's COAST row: which biome the seed is built on. */
  biome: BiomeId | undefined;
  /** The start card's MODE row, and the LENGTH row under it in a tricks
   * run, minutes. Settings like the rows above them. */
  mode: GameMode | undefined;
  minutes: number | undefined;
  /** The picture rows a link names — the same three ladders and the same
   * switch OPTIONS ▸ VIDEO turns, and settings in the same way: laid over the
   * stored ones, never read straight into the renderer. */
  camera: CameraMode | undefined;
  water: WaterLevel | undefined;
  resolution: ResolutionLevel | undefined;
  detail: DetailLevel | undefined;
  distance: DistanceLevel | undefined;
  seeThrough: boolean | undefined;
  frameRate: FrameRateLevel | undefined;
  /** True when the URL names a RUN rather than a visit — a pinned run, a
   * staged moment, a screenshot. Those boot past both cards. */
  rides: boolean;
  /** ...and this one boots into a run and immediately holds it under the
   * pause card. A surface the lab can reach is a surface a bug report can
   * link to, and the pause card is the one surface that has no meaning
   * without a run standing behind it. */
  paused: boolean;
  /** The page of the front door to open on, for a link or the screenshot
   * lab that is pointing at one. Null opens the door where it opens. */
  menu: MenuPage | null;
  /** Whether the first-visit probe may run — false only when the URL says
   * `probe=0`, which is the labs' word for "hold the picture still". */
  probe: boolean;
};

/** A figure off a link, held inside the travel the row that stores it has —
 * the same check `mergeSettings` makes of a stored blob, for the same
 * reason: a value no row could put the thumb back on is a setting the player
 * can never leave. */
function within(value: string | null, range: { min: number; max: number }): number | undefined {
  if (value === null) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < range.min || n > range.max) return undefined;
  return n;
}

/** THE WIND A LINK ASKS FOR, m/s — a rung's NAME, which is the word the start
 * card's row presses, or the figure itself, which is where FREE's fader
 * stands. Two spellings of one setting rather than two settings: the stored
 * row is a figure either way (`RideSettings.wind`). */
function windParam(value: string | null): number | undefined {
  if (value === null) return undefined;
  const rung = CONDITIONS.find((id) => id === value);
  if (rung !== undefined) return CONDITION_DAY[rung].wind;
  return within(value, FREE_WIND_RANGE);
}

export function readParams(search: string): Params {
  const p = new URLSearchParams(search);
  const seed = Number(p.get("seed"));
  const craft = p.get("craft") ?? "";
  const scene = p.get("scene") ?? "";
  const t = Number(p.get("t"));
  const metres = (key: string): number | undefined => {
    const v = p.get(key);
    if (v === null) return undefined;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  };
  const shot = p.get("shot") === "1";
  const named = isScenarioName(scene) ? scene : null;
  const menu = p.get("menu");
  /** A stop off one of the picture ladders, or nothing — the same check
   * `mergeSettings` makes of a stored blob, for the same reason. */
  const stop = <T extends string>(stops: readonly T[], key: string): T | undefined => {
    const value = p.get(key);
    return stops.some((id) => id === value) ? (value as T) : undefined;
  };
  const see = p.get("see");
  const paused = p.get("paused") === "1";
  return {
    // Null rather than the default, so `readParams` says whether the URL
    // ASKED for a seed. A URL that did overrides the stored setting; one
    // that did not leaves the player's own choice alone.
    seed: Number.isFinite(seed) && seed > 0 ? Math.floor(seed) : null,
    craft: isCraftId(craft) ? craft : null,
    scene: named,
    t: Number.isFinite(t) && t > 0 ? t : 0,
    shot,
    wind: metres("wind"),
    hs: metres("hs"),
    hour: metres("hour"),
    track: p.get("track") === "circuit" ? "circuit" : undefined,
    weather: (WEATHER_IDS as readonly string[]).includes(p.get("weather") ?? "")
      ? (p.get("weather") as Weather)
      : undefined,
    time: (TIMES_OF_DAY as readonly string[]).includes(p.get("time") ?? "")
      ? (p.get("time") as TimeOfDay)
      : undefined,
    season: (SEASONS as readonly string[]).includes(p.get("season") ?? "")
      ? (p.get("season") as Season)
      : undefined,
    day: windParam(p.get("day")),
    windFrom: within(p.get("windfrom"), QUARTER_RANGE),
    waves: within(p.get("waves"), SWELL_DIAL),
    biome: isBiomeId(p.get("biome")) ? (p.get("biome") as BiomeId) : undefined,
    mode: isGameMode(p.get("mode")) ? (p.get("mode") as GameMode) : undefined,
    minutes: TRICK_MINUTES.find((m) => String(m) === p.get("minutes")),
    camera: stop(CAMERA_MODES, "camera"),
    water: stop(WATER_LEVELS, "water"),
    resolution: stop(RESOLUTION_LEVELS, "res"),
    detail: stop(DETAIL_LEVELS, "detail"),
    distance: stop(DISTANCE_LEVELS, "distance"),
    seeThrough: see === null ? undefined : see === "1",
    frameRate: stop(FRAME_RATE_LEVELS, "fps"),
    rides: shot || named !== null || paused || p.get("start") === "1",
    paused,
    menu:
      menu === "start" ||
      menu === "campaign" ||
      menu === "levels" ||
      menu === "craft" ||
      menu === "gallery" ||
      menu === "options" ||
      menu === "keys" ||
      menu === "developer" ||
      menu === "benchHistory" ||
      menu === "root"
        ? { page: menu }
        : null,
    probe: p.get("probe") !== "0",
  };
}

/** The settings a URL asks for, laid over the stored ones. A repro link
 * carries a seed and a craft, and landing on a menu that says something else
 * would make the link a lie about the run START is about to ride. */
export function settingsFor(stored: Settings, params: Params): Settings {
  const settings: Settings = {
    ...stored,
    ride: { ...stored.ride },
    video: { ...stored.video },
    dev: { ...stored.dev },
  };
  if (params.camera !== undefined) settings.ride.camera = params.camera;
  // Both rows are a word that expands: `?water=low` is a low sea in every
  // part of itself, exactly as pressing the chip would be.
  if (params.water !== undefined) {
    settings.video.water = params.water;
    Object.assign(settings.video, WATER_PRESETS[params.water]);
  }
  if (params.resolution !== undefined) settings.video.resolution = params.resolution;
  if (params.detail !== undefined) Object.assign(settings.video, DETAIL_PRESETS[params.detail]);
  if (params.distance !== undefined) settings.video.distance = params.distance;
  if (params.seeThrough !== undefined) settings.video.seeThrough = params.seeThrough;
  if (params.frameRate !== undefined) settings.video.frameRate = params.frameRate;
  if (params.craft !== null) settings.ride.craft = params.craft;
  // A LINK THAT NAMES A SEED RIDES THAT SEED. The measured modes otherwise
  // ride one of the campaign's pinned shores (`new-game.ts`'s `pinnedFor`),
  // and a lab photographing seed 38 as a race must get seed 38 — so naming
  // one takes the pinned level off as well as writing the row.
  if (params.seed !== null) {
    settings.ride.seed = params.seed;
    settings.ride.level = null;
  }
  if (params.biome !== undefined) settings.ride.biome = params.biome;
  if (params.mode !== undefined) settings.ride.mode = params.mode;
  if (params.minutes !== undefined) settings.ride.tricksMinutes = params.minutes;
  if (params.time !== undefined) settings.ride.time = params.time;
  if (params.season !== undefined) settings.ride.season = params.season;
  if (params.day !== undefined) settings.ride.wind = params.day;
  if (params.windFrom !== undefined) settings.ride.windQuarter = params.windFrom;
  if (params.waves !== undefined) settings.ride.swell = params.waves;
  if (params.weather !== undefined) settings.ride.weather = params.weather;
  if (params.scene !== null) settings.dev.scene = params.scene;
  // A URL that names the developer page has, by definition, found it — the
  // hold is a way IN, not a lock, and making the lab hold a button for seven
  // seconds to photograph a page would be the harness re-earning a secret it
  // was handed.
  if (params.menu?.page === "developer" || params.menu?.page === "benchHistory") {
    settings.developer = true;
  }
  if (params.wind !== undefined) settings.dev.wind = params.wind;
  if (params.hs !== undefined) settings.dev.hs = params.hs;
  return settings;
}
