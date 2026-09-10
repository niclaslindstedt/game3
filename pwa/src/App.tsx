// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE APP: the shell the game lives inside, and the §37 clock underneath it.
//
// FIVE SURFACES, ONE CANVAS, AND THE SEA NEVER STOPS — except under the one
// card that is standing over the PLAYER's own run. `game/shell.ts` names the
// surfaces and owns that distinction; this file decides when one gives way to
// the next.
//
//   splash   the attract card (`splash-screen.tsx`) — the house's name while
//            the first shore is built, then the title and an invitation.
//   menu     the front door (`menu-main.tsx`), over a bot-ridden sea. A menu
//            that stopped the water would announce that the game is not
//            running.
//   loading  a run being stood up (`loading-screen.tsx` over `run-loader.ts`),
//            paid for in slices so the page stays a page.
//   pause    the run HELD (`menu-pause.tsx`), reached by pressing the minimap
//            or Escape: RESUME, OPTIONS, or out to the front door.
//   run      the player's hands on it, with the HUD over the top.
//
// ONE ENGINE STATE THROUGHOUT, and the mode decides who rides it: `botInput`
// under a menu, the input manager under a run. Leaving a run for the front
// door hands the same craft back to the bot rather than tearing anything
// down, which is why the menu comes up over the shore the player was just on.
//
// URL PARAMS, the whole set (the developer page's REPRO LINK writes exactly
// these, so a frame is always handed on as a URL):
//   ?seed=38       which level (default 38)
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
//   ?weather=rain  ...and under this sky (clear | high | overcast | rain |
//                  squall) — the sea stays the wind's
//   ?time=sunset   the start card's TIME row: sunrise | day | sunset,
//                  resolved against this coast's own daylight (R13) in the
//                  season being ridden
//   ?season=autumn ...and its SEASON row: spring | summer | autumn | winter
//                  — the sun's arc, and so the day's length and the
//                  night's dark; the clock runs an hour a minute from the
//                  start, so a sunset start rides into whatever night the
//                  season has
//   ?day=storm     ...and its WEATHER row: fine | windy | storm, which is a
//                  sky AND the wind that builds the sea under it
//   ?camera=heli   which rung of the camera ladder the run opens on (bow |
//                  nose | close | chase | far | heli) — a setting like the
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
//   ?menu=start    open the front door ON that page (root | start | craft |
//                  options | developer) — how the screenshot lab
//                  photographs a menu surface, and how a link points at
//                  one. `developer` lets the developer menu out with it: a
//                  URL that names the page has, by definition, found it
//   ?update=1      show the new-build button as if a build were waiting, so
//                  the surface can be photographed (read where it is drawn,
//                  in game/update-button.tsx — it is not part of a repro)
//
// A URL that NAMES A RUN (`start`, `scene`, `shot`, `paused`) boots into one. Anything
// else opens the front door, and the URL's seed, craft, time and day become
// the settings the menu is standing on — so a link still decides what RIDE
// rides, without deciding that it has already been pressed.
//
// THE LOOP: `requestAnimationFrame` hands the clock (run-loop.ts) the wall
// time; the clock says how many fixed steps to take; each step samples the
// input (§37.1, once per step) and calls `step`. The renderer draws the state
// once per frame; the HUD is refreshed from a snapshot at ~12 Hz. A hidden
// tab pauses the clock (§37.3) and the HUD says so.
//
// THE SOUND FOLLOWS THE SAME RULE AS THE SEA: it never stops behind a card,
// except the pause card's. The beds (`game/audio/`) are fed every frame the
// engine steps — ducked under the front door, where the bot's run is
// scenery — and told to be quiet on every frame it does not, because a bed
// that is merely not fed holds its last note. The run's events make a
// noise only with the player's hands on the craft: a gate the bot takes
// under the menu is not news.
//
// AND THE MOTOR FOLLOWS THE HANDS. The rumble (`game/haptics.ts`) is fed
// the same events and the same frames the sound is, minus the bot's: a
// phone buzzing in a pocket while the attract card rides a sea nobody is
// holding is the one surface that has to know the difference.

import { useEffect, useRef, useState } from "preact/hooks";
import {
  type CraftId,
  type CraftInput,
  type GameEvent,
  type GameState,
  SEASONS,
  type Season,
  TIMES_OF_DAY,
  TUNING,
  type TimeOfDay,
  WEATHER_IDS,
  type TrackKind,
  type Weather,
  botInput,
  createGame,
  isCraftId,
  step,
} from "@engine";

import { connectOutput } from "./output-bridge.ts";
import { onShellCommand } from "./shell-host.ts";
import { createRunAudio, setAudioVolumes, unlockAudio } from "./game/audio/index.ts";
import { CAMERA_MODES, type CameraMode } from "./game/camera.ts";
import { FPS_UNKNOWN, createFrameGate, smoothFps } from "./game/frame-rate.ts";
import { runRumble, setRumble } from "./game/haptics.ts";
import { Hud, hasTouch, type HudFlash } from "./game/hud.tsx";
import { UpdateButton } from "./game/update-button.tsx";
import { createInputManager, type InputAction } from "./game/input.ts";
import { LoadingScreen } from "./game/loading-screen.tsx";
import { MainMenu, type MenuPage } from "./game/menu-main.tsx";
import { createMenuNav } from "./game/menu-nav.ts";
import { PauseMenu } from "./game/menu-pause.tsx";
import { createRenderer, type FrameCost } from "./game/renderer.ts";
import { createRunClock } from "./game/run-loop.ts";
import { advanceLoad, createLoad, loadBudgetMs, loadPhase, loadTimes } from "./game/run-loader.ts";
import type { LoadJob, LoadPhase, LoadStep } from "./game/run-loader.ts";
import {
  isScenarioName,
  stageScenario,
  type Scenario,
  type ScenarioName,
} from "./game/scenarios.ts";
import {
  CONDITIONS,
  CONDITION_DAY,
  DEFAULT_SEED,
  loadSettings,
  saveSettings,
  type Conditions,
  type Settings,
} from "./game/settings.ts";
import {
  DETAIL_LEVELS,
  DETAIL_PRESETS,
  DISTANCE_LEVELS,
  FRAME_RATE_CAP,
  FRAME_RATE_LEVELS,
  RESOLUTION_LEVELS,
  WATER_LEVELS,
  type DetailLevel,
  type DistanceLevel,
  type FrameRateLevel,
  type ResolutionLevel,
  type WaterLevel,
} from "./game/settings-video.ts";
import { canPause, hudOver, playerRides, simulates, type Shell } from "./game/shell.ts";
import { SplashScreen } from "./game/splash-screen.tsx";
import { splashSkipped } from "./game/splash.ts";
import { takeSnapshot, type HudSnapshot } from "./game/snapshot.ts";
import { STRINGS } from "./game/strings.ts";
import { clamp } from "./lib/util.ts";

/** How often the HUD's readouts are refreshed, s. Twelve a second reads
 * as live on a clock and a speedo; the canvas is the sixty-frame surface. */
const HUD_TICK = 1 / 12;
/** How long a line stays in the news column, s. */
const FLASH_LIFE = 3.2;
/** A flight shorter than this is a wave, not a jump, and gets no line. */
const AIR_WORTH_A_LINE = 0.6;
/** How long the loading card takes to fade off the run underneath. Must
 * match the `.loading.leaving` transition in styles.css. */
const LOAD_FADE_MS = 260;
/** How much of the mix the bot's run gets under a card — the front door,
 * the attract card, the loading card. Half: present, and not the point. */
const CARD_DUCK = 0.5;

declare global {
  interface Window {
    __SH_READY__?: boolean;
    __SH_COST__?: unknown;
  }
}

type Params = {
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
};

function readParams(): Params {
  const p = new URLSearchParams(location.search);
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
      menu === "options" ||
      menu === "developer" ||
      menu === "root"
        ? { page: menu }
        : null,
  };
}

/** The line an event earns in the news column, or null for the ones the
 * picture already says everything about. */
function flashFor(e: GameEvent): { text: string; tone: HudFlash["tone"] } | null {
  switch (e.kind) {
    case "gate":
      return { text: STRINGS.split(e.gate + 1, e.split), tone: "good" };
    case "airGate":
      return { text: STRINGS.airGate(e.gate + 1, e.split), tone: "good" };
    case "missedGate":
      return { text: STRINGS.missed(e.gate + 1, e.penalty), tone: "bad" };
    case "finish":
      return { text: STRINGS.finish(e.time), tone: "good" };
    case "dive":
      return { text: STRINGS.dive, tone: "bad" };
    case "hit":
      return { text: STRINGS.hit, tone: "bad" };
    case "ground":
      return { text: STRINGS.grounded, tone: "bad" };
    case "land":
      return e.airTime >= AIR_WORTH_A_LINE
        ? { text: STRINGS.landed(e.airTime), tone: "info" }
        : null;
    default:
      return null;
  }
}

/** The settings a URL asks for, laid over the stored ones. A repro link
 * carries a seed and a craft, and landing on a menu that says something else
 * would make the link a lie about the run START is about to ride. */
function settingsFor(stored: Settings, params: Params): Settings {
  const settings: Settings = {
    ...stored,
    ride: { ...stored.ride },
    video: { ...stored.video },
    dev: { ...stored.dev },
  };
  if (params.camera !== undefined) settings.ride.camera = params.camera;
  if (params.water !== undefined) settings.video.water = params.water;
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

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [snap, setSnap] = useState<HudSnapshot | null>(null);
  const [flashes, setFlashes] = useState<HudFlash[]>([]);
  /** The TAB is away and the clock with it (§37.3). Nothing to do with the
   * pause card, which is a surface — see `game/shell.ts`. */
  const [away, setAway] = useState(false);
  const [shell, setShell] = useState<Shell>("splash");
  const [menuPage, setMenuPage] = useState<MenuPage>(() => readParams().menu ?? { page: "root" });
  const [loadingPhase, setLoadingPhase] = useState<LoadPhase | null>(null);
  const [loadLeaving, setLoadLeaving] = useState(false);
  /** True once the renderer has drawn a frame — what the attract card waits
   * on before it will take a press (`splash.ts`). */
  const [warm, setWarm] = useState(false);
  const [params] = useState(readParams);
  const [settings, setSettings] = useState<Settings>(() =>
    settingsFor(loadSettings(), readParams()),
  );
  const inputRef = useRef<ReturnType<typeof createInputManager> | null>(null);
  const rendererRef = useRef<ReturnType<typeof createRenderer> | null>(null);
  const [touch] = useState(hasTouch);
  /** The frame rate as the corner reads it — refreshed on the HUD's own tick,
   * not per frame, so the readout is a React render twelve times a second
   * rather than sixty. The smoothing itself is `frame-rate.ts` and runs in the
   * loop, on every frame, whether or not anybody is looking. */
  const [fps, setFps] = useState(FPS_UNKNOWN);
  /** ...and what that frame cost, for the developer page's FRAME COST row. A
   * COPY, because the renderer's own record is one object rewritten in place
   * every frame and a state holding it would never look changed. */
  const [cost, setCost] = useState<FrameCost | null>(null);
  /** The two flags the loop raises at most once a frame and React re-renders
   * on. Refs beside the state so the loop can ask "have I already said this?"
   * without waiting for a render to answer. */
  const warmRef = useRef(false);
  const awayRef = useRef(false);
  /** THE FRAME RATE ROW, applied: the gate every animation frame is asked
   * past before anything is stepped or drawn (`frame-rate.ts`). Built once
   * with the loop and re-capped from the effect below, so a cap moved on the
   * options page takes hold on the next frame. */
  const [gate] = useState(() => createFrameGate(FRAME_RATE_CAP[settings.video.frameRate]));

  /** The frame loop's handle on everything React owns. It reads these every
   * frame and must never re-run because one of them changed — the engine and
   * the renderer are built once, on mount, and outlive every card. */
  const shellRef = useRef<Shell>("splash");
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  /** Set by the loop, called by the menu. Boxed rather than passed down so
   * the button that starts a run is not a reason to rebuild the loop. */
  const startRunRef = useRef<() => void>(() => {});
  /** ...and the same for the presses that move a RUN between surfaces: the
   * minimap and Escape put the pause card up, and the card takes it down
   * again — back to the water, or out to the front door. The loop owns the
   * run, so it owns these. */
  const runRef = useRef<{ pause: () => void; resume: () => void; toMenu: () => void }>({
    pause: () => {},
    resume: () => {},
    toMenu: () => {},
  });

  // Every change is written through, so a visit's choices survive the tab
  // being closed. Cheap: a settings change is a press, not a frame.
  useEffect(() => saveSettings(settings), [settings]);

  // THE PICTURE ROWS REACH THE RENDERER THE MOMENT THEY MOVE, and that is the
  // whole reason OPTIONS is over a live sea rather than over a still: a rider
  // turning WATER up watches the wave twenty metres out gain its detail
  // without leaving the card. The renderer decides what a row costs to apply.
  useEffect(() => {
    rendererRef.current?.setVideo(settings.video);
    gate.setCap(FRAME_RATE_CAP[settings.video.frameRate]);
  }, [settings.video, gate]);

  // ...AND SO DOES THE CAMERA ROW, for the same reason and one more: the
  // pause card opens that page over a FROZEN run, and a row worded CAMERA
  // that only took effect on the next one would be a row the app ignores
  // exactly where it is most obviously being asked. The C key still walks the
  // ladder without writing the setting, so the two never argue — this fires
  // only when the stored choice itself moves.
  useEffect(() => {
    rendererRef.current?.camera.setMode(settings.ride.camera);
  }, [settings.ride.camera]);

  // The fader reaches the bus the moment it moves; a layer reads the bus
  // every frame, so the engine under the card gets quieter as the thumb
  // does — the same rule the picture rows are held to.
  useEffect(() => {
    setAudioVolumes(settings.audio);
  }, [settings.audio]);

  // The switch reaches the motor the moment it moves, and turning it off
  // ends the pulse already running — the same rule as the fader beside it.
  useEffect(() => {
    setRumble(settings.rumble);
  }, [settings.rumble]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    connectOutput();
    const input = createInputManager(window, () => playerRides(shellRef.current));
    inputRef.current = input;
    const renderer = createRenderer(canvas, settingsRef.current.video);
    rendererRef.current = renderer;
    const audio = createRunAudio();
    const clock = createRunClock(TUNING.physicsHz);
    const nav = createMenuNav();

    /** Which seed and which sea the settings currently ask for. Read at the
     * moment a run is stood up rather than captured, so a seed changed on
     * the developer page is the seed START rides.
     *
     * The HOUR comes off the URL instead, because it is not a setting: an
     * exact figure says what the LEVEL is, the way the seed does, and
     * nothing on a menu writes one. */
    const newGame = (): GameState => {
      const s = settingsRef.current;
      // The start card's WIND row is two of these at once: the wind that
      // builds the sea, and the sky that belongs over that wind (R19 keeps
      // the pair honest, and `CONDITION_DAY` is where the rung becomes both).
      const day = s.ride.conditions === null ? null : CONDITION_DAY[s.ride.conditions];
      return createGame({
        seed: s.ride.seed ?? DEFAULT_SEED,
        craft: s.ride.craft,
        track: params.track,
        // The developer's own rows win where they are set: they are the
        // exact figure, and the card's is a word standing for one.
        windSpeed: s.dev.wind ?? day?.wind,
        sea: s.dev.hs !== null ? { hs: s.dev.hs } : undefined,
        hour: params.hour,
        timeOfDay: s.ride.time ?? undefined,
        season: s.ride.season ?? undefined,
        // The WEATHER row wins over the sky its wind implies — that is the
        // whole of what it is for. Left alone (null) it defers, and the pair
        // stays the one R19 would have dealt.
        weather: s.ride.weather ?? day?.weather,
      });
    };

    let state: GameState = newGame();
    let scenario: Scenario | null = null;
    /** The run clock the scenario's script started at, s. */
    let scriptFrom = 0;
    let frozen = false;
    let ready = false;
    const live: { id: number; text: string; tone: HudFlash["tone"]; until: number }[] = [];
    let flashId = 0;
    let hudClock = 0;
    let wall = 0;

    const setShellNow = (next: Shell): void => {
      shellRef.current = next;
      setShell(next);
    };

    /** What this step is ridden on: the scenario's script while it runs, the
     * player's hands after — and the BOT whenever a card is up, because the
     * sea behind a menu is a game that is still being played. */
    const inputFor = (): CraftInput => {
      if (!playerRides(shellRef.current)) return botInput(state);
      if (scenario) {
        const at = state.t - scriptFrom;
        if (at <= scenario.seconds) return scenario.script(at);
        scenario = null;
      }
      return input.sample(TUNING.dt);
    };

    const stepOnce = (): void => {
      step(state, inputFor());
      renderer.observe(state);
      if (playerRides(shellRef.current)) {
        audio.events(state.events);
        runRumble.events(state.events);
        // The hull, every STEP: the slam is a spike a couple of steps wide
        // at 120 Hz, so a frame that sampled it would feel a random fifth of
        // the chop on a phone that is struggling. `rumble.ts` says why.
        runRumble.step(state.craft);
      }
      for (const e of state.events) {
        const line = flashFor(e);
        if (line) live.push({ id: flashId++, ...line, until: wall + FLASH_LIFE });
      }
    };

    /** Stand a fresh run: a new state, the world rebuilt, and — when the
     * settings ask for a scene — the craft placed in it and `ahead` seconds
     * of its script already ridden. */
    const stand = (scene: ScenarioName | null, ahead: number): void => {
      state = newGame();
      scenario = null;
      live.length = 0;
      audio.reset();
      runRumble.reset();
      if (scene) {
        scenario = stageScenario(state, scene);
        scriptFrom = state.t;
      }
      renderer.load(state);
      renderer.camera.setMode(settingsRef.current.ride.camera);
      renderer.camera.restand();
      const steps = Math.round(ahead * TUNING.physicsHz);
      for (let i = 0; i < steps; i++) stepOnce();
      hudClock = HUD_TICK;
    };

    // The sea the attract card is covering, and the sea the menu is over. It
    // is a real run at the settings the URL and the store agreed on, ridden
    // by the bot — so the water the player presses START over is the water
    // they are about to ride.
    stand(params.scene, params.t);
    frozen = params.shot;
    // A URL that names a run boots into one — held under the pause card when
    // it asked for that; one that names a menu page opens the door on it;
    // anything else gets the attract card first.
    const opensOn: Shell = params.rides
      ? params.paused
        ? "pause"
        : "run"
      : params.menu
        ? "menu"
        : "splash";
    setShellNow(splashSkipped(location.search) && opensOn === "splash" ? "menu" : opensOn);

    /* ── STANDING A RUN UP ───────────────────────────────────────────────
       The steps are closures over this loop's own state; `run-loader.ts`
       sequences them and never learns what any of them does. Two of the
       three are single indivisible calls that will overrun their budget —
       that is the honest cost of work that cannot be cut up, and the reason
       the card's mark and bars are compositor transforms. */
    let job: LoadJob | null = null;
    /** What each step cost last time on this machine, ms — the next card's
     * `expectedMs`. Kept in memory rather than stored: it is a fact about
     * this session's device under this session's load, and a figure carried
     * over from a visit when the tab was in the background would tell the
     * card the work takes half as long as it does. */
    let expected: Record<string, number> = {};

    const loadSteps = (): LoadStep[] => {
      const s = settingsRef.current;
      let built: GameState | null = null;
      return [
        {
          id: "level",
          label: STRINGS.loadLevel,
          run: () => {
            built = newGame();
            if (s.dev.scene) {
              scenario = stageScenario(built, s.dev.scene);
              scriptFrom = built.t;
            } else {
              scenario = null;
            }
            return false;
          },
        },
        {
          id: "scene",
          label: STRINGS.loadScene,
          run: () => {
            if (built) state = built;
            live.length = 0;
            audio.reset();
            runRumble.reset();
            renderer.load(state);
            renderer.camera.setMode(s.ride.camera);
            renderer.camera.restand();
            return false;
          },
        },
        {
          id: "warm",
          label: STRINGS.loadWarm,
          // The first draw is where the driver compiles every shader in the
          // scene, and it is the one that would otherwise be paid for out of
          // the player's first second on the water.
          run: () => {
            renderer.render(state, 0);
            return false;
          },
        },
      ];
    };

    startRunRef.current = () => {
      if (shellRef.current === "loading") return;
      job = createLoad(loadSteps(), expected);
      setLoadingPhase(loadPhase(job));
      setLoadLeaving(false);
      setShellNow("loading");
    };

    /* ── WALKING A CARD ON THE KEYS ──────────────────────────────────────
       The DIRECTIONS only, and BACK. CONFIRM is deliberately absent: every
       control on every card is a real `<button>`, so Enter and Space on a
       focused one already activate it — and a `confirm` here would press it
       a second time, which on START is a run started over the top of the
       developer menu the hold just opened.

       On `window` in the capture phase, upstream of the input manager, so a
       key walking a menu never also rides the craft behind it. */
    const NAV_KEYS: Record<string, "up" | "down" | "left" | "right"> = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
      KeyW: "up",
      KeyS: "down",
      KeyA: "left",
      KeyD: "right",
    };
    /** True once a card has been walked with the keys — see `nav.sync()`. */
    let walking = false;
    const onMenuKey = (e: KeyboardEvent): void => {
      if (shellRef.current === "run" || !nav.active()) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const dir = NAV_KEYS[e.code];
      if (dir) {
        e.preventDefault();
        e.stopPropagation();
        walking = true;
        nav.move(dir);
        return;
      }
      // The way out of a page, which is the same key that leaves a run — so
      // one press means "back" wherever the player happens to be.
      if (e.code === "Escape" || e.code === "Backspace") {
        e.preventDefault();
        e.stopPropagation();
        nav.back();
      }
    };
    window.addEventListener("keydown", onMenuKey, true);

    /* ── THE PAUSE CARD, AND THE WAY OUT OF A RUN ────────────────────────
       The card is a SURFACE, so putting it up is a shell change and nothing
       else: the frame loop reads `simulates()` and stops stepping, the state
       is left exactly where it stood, and RESUME is one press that lands on
       the very frame it was left on. Going to the front door instead tears
       nothing down either — the same craft carries on under the bot, which
       is what keeps the water moving under the menu. */
    runRef.current = {
      pause: () => {
        if (!canPause(shellRef.current)) return;
        setShellNow("pause");
      },
      resume: () => {
        if (shellRef.current !== "pause") return;
        setShellNow("run");
        // The clock is not what held the run — the loop simply stopped
        // asking it for steps — so there is no debt to forgive, and `last`
        // moved with every frame. The next frame is one frame long.
      },
      toMenu: () => {
        frozen = false;
        clock.resume();
        setMenuPage({ page: "root" });
        setShellNow("menu");
      },
    };

    /** One of the game's own buttons, wherever the press came from. */
    const act = (action: InputAction): void => {
      // Escape over a run. Over the CARD it never reaches here at all:
      // `onMenuKey` above takes it in the capture phase and presses the
      // surface's own way back — RESUME on the card, and the head's way out
      // on the options page under it.
      if (action === "pause") {
        runRef.current.pause();
        return;
      }
      if (shellRef.current !== "run") return;
      if (action === "restart") {
        frozen = false;
        stand(settingsRef.current.dev.scene, 0);
        clock.resume();
      } else if (action === "camera") renderer.camera.cycle();
    };
    input.onAction(act);

    /* ── A MENU ROW, PRESSED ──────────────────────────────────────────────
       The desktop shell's macOS menu bar reaches the game by NAME, on one
       event (shell-host.ts, mirrored in tauri/shell/src/menu.rs), and every
       word it may send is a key the player can already press. So each one
       lands on the very handler the key lands on rather than on a path of
       its own: a shell may add a second way to reach a button, never a
       second button. In a browser nothing ever dispatches the event and
       this is one listener that never fires. */
    const stopShellCommands = onShellCommand((command) => {
      if (command === "reset") input.requestReset();
      else act(command);
    });

    let raf = 0;
    let last = performance.now();
    let frameMs = 1000 / 60;
    let rate = FPS_UNKNOWN;
    const frame = (now: number): void => {
      raf = requestAnimationFrame(frame);
      // A FRAME THE CAP REFUSES COSTS NOTHING: no step, no water, no draw.
      // `last` is left where it was, so the wall time this frame would have
      // carried arrives with the next one that is drawn — the run clock
      // takes elapsed time, and a capped loop rides the same seconds.
      if (!gate.due(now)) return;
      // CLAMPED AT BOTH ENDS. The ceiling is the long-frame guard; the FLOOR
      // is not paranoia — the first callback after a level has been built
      // carries the timestamp of the frame that was already under way when
      // the build began, so `now` lands more than a second BEHIND the
      // `performance.now()` taken after it and the first `dtFrame` of every
      // run is negative. Everything counted in seconds off this line runs
      // backwards for as long as it takes to pay that back: the HUD's tick
      // does not fire, so the readouts are missing for the first seconds of
      // a run and from every screenshot, and the news column holds its lines
      // that much longer.
      const dtFrame = clamp((now - last) / 1000, 0, 0.1);
      frameMs = now - last || frameMs;
      last = now;
      wall += dtFrame;
      rate = smoothFps(rate, frameMs);

      // A LOAD IS PAID FOR BEFORE THE STEPS, and the steps still happen: the
      // sea under the card keeps running, so the card lifts onto water that
      // has been moving the whole time rather than onto a frozen frame that
      // jerks into life.
      if (job) {
        const until = performance.now() + loadBudgetMs(frameMs);
        const more = advanceLoad(
          job,
          () => performance.now() < until,
          () => performance.now(),
        );
        setLoadingPhase(loadPhase(job));
        if (!more) {
          expected = { ...expected, ...loadTimes(job) };
          job = null;
          setLoadLeaving(true);
          setShellNow("run");
          hudClock = HUD_TICK;
          window.setTimeout(() => setLoadLeaving(false), LOAD_FADE_MS);
        }
      }

      // THE PAUSE CARD IS THE ONE SURFACE THE ENGINE DOES NOT STEP UNDER
      // (`shell.ts`), and a held run is a FROZEN one: drawn with no time
      // passing, so the wave holds, the spray hangs and the camera stops. A
      // frame's worth of dt handed to the renderer over a state that is not
      // moving is a craft doing 90 km/h on standing water.
      const held = !simulates(shellRef.current);
      if (!frozen && !held) {
        const steps = clock.frame(dtFrame);
        for (let i = 0; i < steps; i++) stepOnce();
      } else {
        // Frozen: the controls are still read, so a banked reset does not
        // fire the moment the picture thaws — and a thumb resting on a zone
        // behind the card does not either.
        input.sample(TUNING.dt);
      }
      renderer.render(state, held || clock.paused() ? 0 : dtFrame);
      // The beds follow the same frames the engine took: fed whenever the
      // sea moved, hushed whenever it did not — see this file's header.
      if (!frozen && !held && !clock.paused()) {
        audio.setView(renderer.camera.mode());
        audio.frame(state, dtFrame, shellRef.current === "run" ? 1 : CARD_DUCK);
        // …and the sea under it paid out, at most one slap per gap. Only
        // with the player's hands on the craft: there is no ducking a motor,
        // so a card is the difference between a pulse and no pulse rather
        // than a quieter one.
        if (playerRides(shellRef.current)) runRumble.frame(dtFrame);
      } else {
        audio.silence();
      }
      window.__SH_COST__ = renderer.cost();
      if (!warmRef.current) {
        warmRef.current = true;
        setWarm(true);
      }
      // The frame above is presented on the NEXT animation frame; the flag
      // waits for it, and for every card to be off, so a screenshot never
      // captures one.
      if (!ready && shellRef.current === "run") {
        ready = true;
        requestAnimationFrame(() => {
          window.__SH_READY__ = true;
        });
      }
      // The cursor follows whichever card is up, and lets go when the last
      // one goes. It does nothing at all until the surface CHANGES — and
      // nothing at all until somebody has actually walked a card with the
      // keys: a ring that appeared under a mouse would be a second cursor
      // moving on its own.
      if (walking) nav.sync();
      hudClock += dtFrame;
      if (hudClock >= HUD_TICK) {
        hudClock = 0;
        setSnap(takeSnapshot(state));
        setFps(rate);
        setCost(settingsRef.current.dev.cost ? { ...renderer.cost() } : null);
        const kept = live.filter((f) => f.until > wall);
        if (kept.length !== live.length) live.splice(0, live.length, ...kept);
        setFlashes(live.map(({ id, text, tone }) => ({ id, text, tone })));
        if (clock.paused() !== awayRef.current) {
          awayRef.current = clock.paused();
          setAway(awayRef.current);
        }
      }
    };
    raf = requestAnimationFrame(frame);

    // §37.3: a hidden tab is a paused run. `blur` alone is not — a window
    // still on screen keeps riding (the held keys are let go of by the input
    // manager, which is what stops a craft riding off on its own).
    const onVisibility = (): void => {
      if (document.hidden) {
        clock.pause();
        // The frame loop is what feeds the beds and it stops with the page:
        // said here, not left to the audio context's own suspend, which iOS
        // declines when it interrupted the session on the way out.
        audio.silence();
      } else {
        clock.resume();
        last = performance.now();
      }
      awayRef.current = clock.paused();
      setAway(awayRef.current);
    };
    document.addEventListener("visibilitychange", onVisibility);
    // A browser makes no sound before the player has touched something, and
    // a context built outside a real gesture is one iOS will never resume:
    // so the unlock hangs off actual gestures only — any press, any key,
    // anywhere — captured, so a card that stops propagation cannot swallow
    // it, and passive, since nothing here prevents a default.
    const unlockOpts = { capture: true, passive: true } as const;
    document.addEventListener("pointerdown", unlockAudio, unlockOpts);
    document.addEventListener("keydown", unlockAudio, unlockOpts);
    // Nothing here watches the canvas's size: the renderer observes its own
    // box and matches the drawing buffer to it, which is the only way a
    // rotation is measured after the browser has laid the page out again.

    return () => {
      cancelAnimationFrame(raf);
      audio.silence();
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("pointerdown", unlockAudio, unlockOpts);
      document.removeEventListener("keydown", unlockAudio, unlockOpts);
      window.removeEventListener("keydown", onMenuKey, true);
      stopShellCommands();
      input.dispose();
      renderer.dispose();
    };
    // Boots once: the URL is read on mount and a new URL is a new page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The HUD stands under the pause card as well as over a run: the frozen
  // frame the player stopped to read is still the run, and its clock, its
  // gate count and its map are part of what they stopped to read.
  const hudUp = hudOver(shell) && settings.hud.on && snap !== null && inputRef.current !== null;
  return (
    <>
      <canvas ref={canvasRef} />
      {hudUp && (
        <Hud
          snap={snap!}
          flashes={flashes}
          touch={touch}
          input={inputRef.current!}
          away={away}
          fps={settings.hud.fps ? fps : null}
          cost={cost}
          onReset={() => inputRef.current?.requestReset()}
          onCamera={() => rendererRef.current?.camera.cycle()}
          onPause={() => runRef.current.pause()}
        />
      )}
      {/* THE NEW-BUILD NOTICE IS NOT A READOUT, so the HUD's own switch does
          not reach it: a setting worded "the readouts over the water" must
          not quietly turn off the one thing the app ever says on its own
          initiative. With the HUD up it rides in the top bar where
          `update-button.tsx` argues it belongs; with the HUD off it stands
          in the same corner, in the same chrome, on its own. It draws
          itself or it draws nothing, so on nearly every day this is an
          empty box. */}
      {hudOver(shell) && !settings.hud.on && (
        <div class="hud">
          <div class="hud-topright">
            <div class="hud-topright-row">
              <UpdateButton />
            </div>
          </div>
        </div>
      )}
      {/* THE RUN, HELD. Over the HUD and over the frozen frame, wearing the
          front door's own chrome — it is the same game asking the same kind
          of question, and one card look beats two. */}
      {shell === "pause" && snap !== null && (
        <PauseMenu
          seed={snap.seed}
          craft={snap.craft}
          settings={settings}
          onSettings={setSettings}
          onResume={() => runRef.current.resume()}
          onMainMenu={() => runRef.current.toMenu()}
        />
      )}
      {shell === "menu" && (
        <MainMenu
          page={menuPage}
          settings={settings}
          onSettings={setSettings}
          onNavigate={setMenuPage}
          onStart={() => startRunRef.current()}
        />
      )}
      {(shell === "loading" || loadLeaving) && (
        <LoadingScreen leaving={loadLeaving} phase={loadingPhase} />
      )}
      {shell === "splash" && <SplashScreen warm={warm} onDone={() => setShell("menu")} />}
    </>
  );
}
