// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE URL AS SETTINGS. Every parameter the app reads is listed and explained
// in `App.tsx`'s header (the developer page's REPRO LINK writes exactly that
// set, and `docs/configuration.md` is the player's copy); this module is
// the reading of it — what each parameter is checked against, and how the
// ones that are SETTINGS are laid over the stored ones without deciding
// that RIDE has already been pressed.
//
// The query string is an argument rather than read off `location`, the way
// `splash.ts` takes it, so the reading is a pure function of a string.

import {
  type CraftId,
  SEASONS,
  type Season,
  TIMES_OF_DAY,
  type TimeOfDay,
  type TrackKind,
  WEATHER_IDS,
  type Weather,
  isCraftId,
} from "@engine";

import { CAMERA_MODES, type CameraMode } from "./camera.ts";
import type { MenuPage } from "./menu-main.tsx";
import { isScenarioName, type ScenarioName } from "./scenarios.ts";
import { CONDITIONS, type Conditions, type Settings } from "./settings.ts";
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
  day: Conditions | undefined;
  weather: Weather | undefined;
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
    day: (CONDITIONS as readonly string[]).includes(p.get("day") ?? "")
      ? (p.get("day") as Conditions)
      : undefined,
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
      menu === "craft" ||
      menu === "gallery" ||
      menu === "options" ||
      menu === "keys" ||
      menu === "developer" ||
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
  if (params.seed !== null) settings.ride.seed = params.seed;
  if (params.time !== undefined) settings.ride.time = params.time;
  if (params.season !== undefined) settings.ride.season = params.season;
  if (params.day !== undefined) settings.ride.conditions = params.day;
  if (params.weather !== undefined) settings.ride.weather = params.weather;
  if (params.scene !== null) settings.dev.scene = params.scene;
  // A URL that names the developer page has, by definition, found it — the
  // hold is a way IN, not a lock, and making the lab hold a button for seven
  // seconds to photograph a page would be the harness re-earning a secret it
  // was handed.
  if (params.menu?.page === "developer") settings.developer = true;
  if (params.wind !== undefined) settings.dev.wind = params.wind;
  if (params.hs !== undefined) settings.dev.hs = params.hs;
  return settings;
}
