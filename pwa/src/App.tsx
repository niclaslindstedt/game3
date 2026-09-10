// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE APP: the shell the game lives inside, and the §37 clock underneath it.
//
// FOUR SURFACES, ONE CANVAS, AND THE SEA NEVER STOPS. That last part is the
// rule everything here is arranged around: the engine is stepping and the
// renderer is drawing behind every card the app can put up.
//
//   splash   the attract card (`splash-screen.tsx`) — the house's name while
//            the first shore is built, then the title and an invitation.
//   menu     the front door (`menu-main.tsx`), over a bot-ridden sea. A menu
//            that stopped the water would announce that the game is not
//            running.
//   loading  a run being stood up (`loading-screen.tsx` over `run-loader.ts`),
//            paid for in slices so the page stays a page.
//   run      the player's hands on it, with the HUD over the top.
//
// ONE ENGINE STATE THROUGHOUT, and the mode decides who rides it: `botInput`
// under a menu, the input manager under a run. Leaving a run (Escape) hands
// the same craft back to the bot rather than tearing anything down, which is
// why the menu comes up over the shore the player was just on.
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
//                  resolved against this coast's own daylight (R13)
//   ?day=storm     ...and its WEATHER row: fine | windy | storm, which is a
//                  sky AND the wind that builds the sea under it
//   ?start=1       skip both cards and ride: a pinned run
//   ?splash=0/1    force the attract card off, or back on
//   ?menu=start    open the front door ON that page — how the screenshot
//                  lab photographs a menu surface, and how a link points at
//                  one. `developer` lets the developer menu out with it: a
//                  URL that names the page has, by definition, found it
//   ?update=1      show the new-build button as if a build were waiting, so
//                  the surface can be photographed (read where it is drawn,
//                  in game/update-button.tsx — it is not part of a repro)
//
// A URL that NAMES A RUN (`start`, `scene`, `shot`) boots into one. Anything
// else opens the front door, and the URL's seed, craft, time and day become
// the settings the menu is standing on — so a link still decides what RIDE
// rides, without deciding that it has already been pressed.
//
// THE LOOP: `requestAnimationFrame` hands the clock (run-loop.ts) the wall
// time; the clock says how many fixed steps to take; each step samples the
// input (§37.1, once per step) and calls `step`. The renderer draws the state
// once per frame; the HUD is refreshed from a snapshot at ~12 Hz. A hidden
// tab pauses the clock (§37.3) and the HUD says so.

import { useEffect, useRef, useState } from "preact/hooks";
import {
  TUNING,
  botInput,
  createGame,
  isCraftId,
  TIMES_OF_DAY,
  WEATHER_IDS,
  step,
  type CraftId,
  type CraftInput,
  type GameEvent,
  type GameState,
  type TimeOfDay,
  type Weather,
} from "@engine";

import { connectOutput } from "./output-bridge.ts";
import { Hud, hasTouch, type HudFlash } from "./game/hud.tsx";
import { UpdateButton } from "./game/update-button.tsx";
import { createInputManager } from "./game/input.ts";
import { LoadingScreen } from "./game/loading-screen.tsx";
import { MainMenu, type MenuPage } from "./game/menu-main.tsx";
import { createMenuNav } from "./game/menu-nav.ts";
import { createRenderer } from "./game/renderer.ts";
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
import { SplashScreen } from "./game/splash-screen.tsx";
import { splashSkipped } from "./game/splash.ts";
import { takeSnapshot, type HudSnapshot } from "./game/snapshot.ts";
import { STRINGS } from "./game/strings.ts";

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

/** Which surface is up. See this module's header for what each one covers. */
type Shell = "splash" | "menu" | "loading" | "run";

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
  /** An hour on the clock and a sky in place of the level's own. Read off
   * the URL alone: they are the LEVEL's conditions rather than the player's
   * settings, so nothing on a menu writes them. */
  hour: number | undefined;
  weather: Weather | undefined;
  /** The start card's own two rows, as a link carries them: a named hour
   * and a named day. Unlike `hour` and `weather` these ARE the player's
   * settings, so they are laid over the stored ones rather than read
   * straight into the run. */
  time: TimeOfDay | undefined;
  day: Conditions | undefined;
  /** True when the URL names a RUN rather than a visit — a pinned run, a
   * staged moment, a screenshot. Those boot past both cards. */
  rides: boolean;
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
    weather: (WEATHER_IDS as readonly string[]).includes(p.get("weather") ?? "")
      ? (p.get("weather") as Weather)
      : undefined,
    time: (TIMES_OF_DAY as readonly string[]).includes(p.get("time") ?? "")
      ? (p.get("time") as TimeOfDay)
      : undefined,
    day: (CONDITIONS as readonly string[]).includes(p.get("day") ?? "")
      ? (p.get("day") as Conditions)
      : undefined,
    rides: shot || named !== null || p.get("start") === "1",
    menu:
      menu === "start" || menu === "options" || menu === "developer" || menu === "root"
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
    dev: { ...stored.dev },
  };
  if (params.craft !== null) settings.ride.craft = params.craft;
  if (params.seed !== null) settings.ride.seed = params.seed;
  if (params.time !== undefined) settings.ride.time = params.time;
  if (params.day !== undefined) settings.ride.conditions = params.day;
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
  const [paused, setPaused] = useState(false);
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
  const [touch] = useState(hasTouch);
  /** The two flags the loop raises at most once a frame and React re-renders
   * on. Refs beside the state so the loop can ask "have I already said this?"
   * without waiting for a render to answer. */
  const warmRef = useRef(false);
  const pausedRef = useRef(false);

  /** The frame loop's handle on everything React owns. It reads these every
   * frame and must never re-run because one of them changed — the engine and
   * the renderer are built once, on mount, and outlive every card. */
  const shellRef = useRef<Shell>("splash");
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  /** Set by the loop, called by the menu. Boxed rather than passed down so
   * the button that starts a run is not a reason to rebuild the loop. */
  const startRunRef = useRef<() => void>(() => {});

  // Every change is written through, so a visit's choices survive the tab
  // being closed. Cheap: a settings change is a press, not a frame.
  useEffect(() => saveSettings(settings), [settings]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    connectOutput();
    const input = createInputManager(window);
    inputRef.current = input;
    const renderer = createRenderer(canvas);
    const clock = createRunClock(TUNING.physicsHz);
    const nav = createMenuNav();

    /** Which seed and which sea the settings currently ask for. Read at the
     * moment a run is stood up rather than captured, so a seed changed on
     * the developer page is the seed START rides.
     *
     * The hour and the sky come off the URL instead, because they are not
     * settings: they say what the LEVEL is, the way the seed does, and
     * nothing on a menu writes them. */
    const newGame = (): GameState => {
      const s = settingsRef.current;
      // The start card's DAY is one word covering two of these: the sky to
      // ride under and the wind that builds the sea under it (R19 keeps the
      // pair honest, and `CONDITION_DAY` is where the word becomes both).
      const day = s.ride.conditions === null ? null : CONDITION_DAY[s.ride.conditions];
      return createGame({
        seed: s.ride.seed ?? DEFAULT_SEED,
        craft: s.ride.craft,
        // The developer's own rows win where they are set: they are the
        // exact figure, and the card's is a word standing for one.
        windSpeed: s.dev.wind ?? day?.wind,
        sea: s.dev.hs !== null ? { hs: s.dev.hs } : undefined,
        hour: params.hour,
        timeOfDay: s.ride.time ?? undefined,
        weather: params.weather ?? day?.weather,
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
      if (shellRef.current !== "run") return botInput(state);
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
    // A URL that names a run boots into one; one that names a menu page
    // opens the door on it; anything else gets the attract card first.
    const opensOn: Shell = params.rides ? "run" : params.menu ? "menu" : "splash";
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

    input.onAction((action) => {
      if (action === "menu") {
        // Out of a run and back to the front door. Nothing is torn down: the
        // same craft carries on under the bot, which is what keeps the water
        // moving under the card.
        if (shellRef.current !== "run") return;
        frozen = false;
        clock.resume();
        setMenuPage({ page: "root" });
        setShellNow("menu");
        return;
      }
      if (shellRef.current !== "run") return;
      if (action === "restart") {
        frozen = false;
        stand(settingsRef.current.dev.scene, 0);
        clock.resume();
      } else if (action === "camera") renderer.camera.cycle();
    });

    let raf = 0;
    let last = performance.now();
    let frameMs = 1000 / 60;
    const frame = (now: number): void => {
      raf = requestAnimationFrame(frame);
      const dtFrame = Math.min(0.1, (now - last) / 1000);
      frameMs = now - last || frameMs;
      last = now;
      wall += dtFrame;

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

      if (!frozen) {
        const steps = clock.frame(dtFrame);
        for (let i = 0; i < steps; i++) stepOnce();
      } else {
        // Frozen: the controls are still read, so a banked reset does not
        // fire the moment the picture thaws.
        input.sample(TUNING.dt);
      }
      renderer.render(state, clock.paused() ? 0 : dtFrame);
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
        const kept = live.filter((f) => f.until > wall);
        if (kept.length !== live.length) live.splice(0, live.length, ...kept);
        setFlashes(live.map(({ id, text, tone }) => ({ id, text, tone })));
        if (clock.paused() !== pausedRef.current) {
          pausedRef.current = clock.paused();
          setPaused(pausedRef.current);
        }
      }
    };
    raf = requestAnimationFrame(frame);

    // §37.3: a hidden tab is a paused run. `blur` alone is not — a window
    // still on screen keeps riding (the held keys are let go of by the input
    // manager, which is what stops a craft riding off on its own).
    const onVisibility = (): void => {
      if (document.hidden) clock.pause();
      else {
        clock.resume();
        last = performance.now();
      }
      pausedRef.current = clock.paused();
      setPaused(pausedRef.current);
    };
    document.addEventListener("visibilitychange", onVisibility);
    // Nothing here watches the canvas's size: the renderer observes its own
    // box and matches the drawing buffer to it, which is the only way a
    // rotation is measured after the browser has laid the page out again.

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("keydown", onMenuKey, true);
      input.dispose();
      renderer.dispose();
    };
    // Boots once: the URL is read on mount and a new URL is a new page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hudUp = shell === "run" && settings.hud.on && snap !== null && inputRef.current !== null;
  return (
    <>
      <canvas ref={canvasRef} />
      {hudUp && (
        <Hud
          snap={snap!}
          flashes={flashes}
          touch={touch}
          input={inputRef.current!}
          paused={paused}
          onReset={() => inputRef.current?.requestReset()}
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
      {shell === "run" && !settings.hud.on && (
        <div class="hud">
          <div class="hud-topright">
            <div class="hud-topright-row">
              <UpdateButton />
            </div>
          </div>
        </div>
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
