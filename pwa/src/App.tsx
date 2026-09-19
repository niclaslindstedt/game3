// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE APP: the shell the game lives inside, and the §37 clock underneath it.
//
// SIX SURFACES, ONE CANVAS, AND THE SEA NEVER STOPS — except under the card
// standing over the PLAYER's own run, and while the benchmark is turning the
// water itself. `game/shell.ts` names the surfaces and owns both
// distinctions; this file decides when one gives way to the next.
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
//   bench    a race being TIMED behind the developer page's card
//            (`game/benchmark.ts`), which pumps its own frames.
//
// ONE ENGINE STATE THROUGHOUT, and the mode decides who rides it: `botInput`
// under a menu, the input manager under a run. Leaving a run for the front
// door hands the same craft back to the bot rather than tearing anything
// down, which is why the menu comes up over the shore the player was just on.
//
// THE URL: every parameter the app reads is listed and explained in
// `game/url-params.ts`'s header, which is the reading of it; `readParams`
// and `settingsFor` below are that module's.
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
// THE SHUTTER IS A REQUEST, NOT A FREEZE. ENTER (and the HUD's own shutter
// where there is no keyboard) asks for a picture; the HUD is serialized at
// the PRESS, because the clock and the gate count the picture has to carry
// are the ones that were on screen when the button went down, and the frame
// that serves it is one or three later — the drawing buffer can only be
// read inside the animation callback that filled it (`game/screenshots.ts`).
// Everything after the grab waits: the stamp, the encode and the write into
// the roll the GALLERY reads (`game/menu-gallery.tsx`).
//
// ONE THING CANNOT WAIT: the CLIPBOARD. A picture is worth most in the
// window somebody is still talking in, so every shutter press also puts the
// PNG on the clipboard — and a clipboard write has to be started from the
// press itself, while the browser still counts the gesture as live. So the
// press claims the write with the picture still undrawn and the frame loop
// settles it (`lib/share-image.ts`), which is why the receipt says COPIED
// rather than SAVED only once the write has actually come back.
//
// AND THE MOTOR FOLLOWS THE HANDS. The rumble (`game/haptics.ts`) is fed
// the same events and the same frames the sound is, minus the bot's: a
// phone buzzing in a pocket while the attract card rides a sea nobody is
// holding is the one surface that has to know the difference.

import { useEffect, useRef, useState } from "preact/hooks";
import { type CraftInput, type GameState, TUNING, botInput, step } from "@engine";

import { connectOutput } from "./output-bridge.ts";
import { onShellCommand } from "./shell-host.ts";
import { createRunAudio, setAudioVolumes, unlockAudio } from "./game/audio/index.ts";
import { FPS_UNKNOWN, createFrameGate, smoothFps } from "./game/frame-rate.ts";
import { runRumble, setRumble } from "./game/haptics.ts";
import { Hud, hasTouch, type HudFlash } from "./game/hud.tsx";
import { ResultPlate, type HudResult } from "./game/hud-result.tsx";
import { flashFor, shotLabel } from "./game/run-news.ts";
import {
  campaignGame,
  loadProgress,
  saveProgress,
  type CampaignLevel,
  type CampaignProgress,
} from "./game/campaign.ts";
import { UpdateButton } from "./game/update-button.tsx";
import { createInputManager } from "./game/input.ts";
import { createBenchmark, createLoader } from "./game/app-load.ts";
import type { BenchmarkStatus } from "./game/benchmark.ts";
import { BenchmarkCard } from "./game/menu-bench.tsx";
import { LoadingScreen } from "./game/loading-screen.tsx";
import { MainMenu, type MenuPage } from "./game/menu-main.tsx";
import { createMenuNav, walkCardsOnKeys } from "./game/menu-nav.ts";
import { PauseMenu } from "./game/menu-pause.tsx";
import type { FrameCost, GameRenderer } from "./game/renderer.ts";
import { fallbackGame, gameFor, tryGame } from "./game/new-game.ts";
import { loadRecords, saveRecords, type RecordBook } from "./game/records.ts";
import { snapInput } from "./game/ghost.ts";
import { createGhostRig } from "./game/ghost-run.ts";
import { createRunActions } from "./game/run-actions.ts";
import { createRunSurfaces, type RunSurfaces } from "./game/run-surfaces.ts";
import { createReplayRun } from "./game/replay-run.ts";
import { ReplayBar, type ReplayBarProps } from "./game/hud-replay.tsx";
import { createRunClock } from "./game/run-loop.ts";
import { createSettler } from "./game/run-settle.ts";
import type { LoadPhase } from "./game/run-loader.ts";
import { stageScenario, type Scenario, type ScenarioName } from "./game/scenarios.ts";
import { readHudLayer } from "./game/shot-hud.ts";
import { createShotRequest } from "./game/shot-request.ts";
import { loadSettings, saveSettings, type Settings } from "./game/settings.ts";
import { FRAME_RATE_CAP } from "./game/settings-video.ts";
import { appDraws, hudOver, playerRides, simulates, soundsLive, type Shell } from "./game/shell.ts";
import { readParams, settingsFor } from "./game/url-params.ts";
import { createVideoProbe, promoteVideo } from "./game/video-probe.ts";
import { SplashScreen } from "./game/splash-screen.tsx";
import { splashSkipped } from "./game/splash.ts";
import { takeSnapshot, type HudSnapshot } from "./game/snapshot.ts";
import { clamp } from "./lib/util.ts";

/** How often the HUD's readouts are refreshed, s. Twelve a second reads
 * as live on a clock and a speedo; the canvas is the sixty-frame surface. */
const HUD_TICK = 1 / 12;
/** How long a line stays in the news column, s. */
const FLASH_LIFE = 3.2;
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

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [snap, setSnap] = useState<HudSnapshot | null>(null);
  const [flashes, setFlashes] = useState<HudFlash[]>([]);
  /** The TAB is away and the clock with it (§37.3). Nothing to do with the
   * pause card, which is a surface — see `game/shell.ts`. */
  const [away, setAway] = useState(false);
  const [shell, setShell] = useState<Shell>("splash");
  const [menuPage, setMenuPage] = useState<MenuPage>(
    () => readParams(location.search).menu ?? { page: "root" },
  );
  const [loadingPhase, setLoadingPhase] = useState<LoadPhase | null>(null);
  const [loadLeaving, setLoadLeaving] = useState(false);
  /** Why the run being stood up will not be — a seed the generator refuses,
   * almost always. Holds the loading card up until the player presses out. */
  const [loadFailed, setLoadFailed] = useState<string | null>(null);
  /** True once the renderer has drawn a frame — what the attract card waits
   * on before it will take a press (`splash.ts`). */
  const [warm, setWarm] = useState(false);
  const [params] = useState(() => readParams(location.search));
  const [settings, setSettings] = useState<Settings>(() =>
    settingsFor(loadSettings(), readParams(location.search)),
  );
  /** THE RECORD BOOK (`game/records.ts`), and the run's RESULT once it has
   * one — the plate the HUD draws over a finished run, cleared by whatever
   * stands a new run. */
  const [records, setRecords] = useState<RecordBook>(loadRecords);
  const [result, setResult] = useState<HudResult | null>(null);
  const recordsRef = useRef(records);
  recordsRef.current = records;
  useEffect(() => saveRecords(records), [records]);
  /** THE CAMPAIGN'S BOARD (`game/campaign.ts`), and the level the player is
   * on when the run under the HUD is one of its rungs — null on every other
   * run, which is what tells `settle` which book a finish goes in and
   * `stand` which shore a restart rebuilds. */
  const [progress, setProgress] = useState<CampaignProgress>(loadProgress);
  const progressRef = useRef(progress);
  progressRef.current = progress;
  useEffect(() => saveProgress(progress), [progress]);
  const ridingRef = useRef<CampaignLevel | null>(null);
  const inputRef = useRef<ReturnType<typeof createInputManager> | null>(null);
  const rendererRef = useRef<GameRenderer | null>(null);
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
  /** THE BENCHMARK IN PROGRESS, or null when the canvas is the game's own
   * (`game/benchmark.ts`). Non-null IS the `bench` surface: the card is the
   * status and the status is the card. */
  const [bench, setBench] = useState<BenchmarkStatus | null>(null);
  /** THE BAR OVER A RECORDING (`game/replay.ts`), or null over a run somebody
   * is riding. Refreshed on the HUD's own tick like every other readout —
   * how far through and whether the picture is running slow both move every
   * frame, and a React render per frame is the one thing a replay must not
   * cost. */
  const [replayBar, setReplayBar] = useState<ReplayBarProps | null>(null);
  /** Whether there is a recording worth OFFERING — what puts WATCH REPLAY on
   * the pause card and on the finish plate, and leaves both without it on a
   * run that keeps none. */
  const [canReplay, setCanReplay] = useState(false);
  /** The two flags the loop raises at most once a frame and React re-renders
   * on. Refs beside the state so the loop can ask "have I already said this?"
   * without waiting for a render to answer. */
  const warmRef = useRef(false);
  const awayRef = useRef(false);
  const canReplayRef = useRef(false);
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
  const startRunRef = useRef<(campaign?: CampaignLevel) => void>(() => {});
  /** ...and the same for the presses that move a RUN between surfaces: the
   * minimap and Escape put the pause card up, and the card takes it down
   * again — back to the water, out to a recording of it, round again from the
   * line, or out to the front door; the finish plate presses the same three
   * the card does. What each one MEANS is `run-surfaces.ts`'s; the loop owns
   * the run, so it owns the closures they are built over. */
  const runRef = useRef<RunSurfaces>({
    pause: () => {},
    resume: () => {},
    toMenu: () => {},
    restart: () => {},
    abandonLoad: () => {},
    watch: () => {},
  });
  /** ...and the presses that hand the canvas to the stopwatch and take it
   * back, boxed for the same reason: the loop owns the run, the renderer and
   * the engine state a benchmark needs. */
  const benchRef = useRef<{ start: () => void; leave: (page?: MenuPage) => void }>({
    start: () => {},
    leave: () => {},
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

  // …and so does the HUD's own switch, because one of the HUD's readouts is
  // drawn in the WATER rather than on the glass: the guide line under the
  // surface (`guide-line.ts`).
  useEffect(() => {
    rendererRef.current?.setGuide(settings.hud.on);
  }, [settings.hud.on]);

  // The missed-checkpoint arrow is geometry rather than DOM, but it is one
  // half of a HUD instrument. Keep it off under cards that do not draw that
  // instrument, and leave it standing under the pause card with the rest of
  // the frozen run.
  useEffect(() => {
    rendererRef.current?.setMissedGuide(settings.hud.on && hudOver(shell));
  }, [settings.hud.on, shell]);

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

  // A key rebound on the card reaches the manager before the card is even
  // closed — the same rule as every row above. Which matters more here than
  // it looks: the binding page is over a bot-ridden sea, so a rider who has
  // just moved the throttle to a new key can walk out and use it, and one
  // that did not take would look like a page that stored nothing.
  useEffect(() => {
    inputRef.current?.setKeys(settings.keys);
  }, [settings.keys]);

  // THE RENDER STACK, FETCHED RATHER THAN BUNDLED. `renderer.ts` is the ONE
  // static import in this file that reaches three.js, and three.js is 509 KB
  // raw / 127 KB gzip — 41 % of the old first-paint payload, on a critical
  // path that has no room to grow. Fetched here it
  // leaves the entry chunk entirely, alongside the splash the app already
  // shows, so nothing a player sees arrives later: the attract card waits on
  // `drawn`, which cannot go true before a renderer exists either way.
  const [renderKit, setRenderKit] = useState<typeof import("./game/renderer.ts") | null>(null);
  useEffect(() => {
    let live = true;
    void import("./game/renderer.ts").then((mod) => {
      if (live) setRenderKit(mod);
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !renderKit) return;
    connectOutput();
    const input = createInputManager(
      window,
      () => playerRides(shellRef.current),
      settingsRef.current.keys,
    );
    inputRef.current = input;
    const renderer = renderKit.createRenderer(canvas, settingsRef.current.video);
    renderer.setMissedGuide(settingsRef.current.hud.on && hudOver(shellRef.current));
    rendererRef.current = renderer;
    const audio = createRunAudio();
    const clock = createRunClock(TUNING.physicsHz);
    const nav = createMenuNav();

    /** The level the settings ask for, and the refusal made an answer —
     * both in `new-game.ts`, closed over this loop's own refs so the seed a
     * run is stood up on is the one the settings hold at that moment. */
    /** The run the settings ask for — or, with a campaign level under the
     * HUD, that level again: a restart rides the same pinned shore. */
    const tryNewGame = (): GameState | null =>
      ridingRef.current
        ? campaignGame(ridingRef.current, settingsRef.current.ride.craft)
        : tryGame(settingsRef.current, params);

    // THE PAGE HAS TO MOUNT. This is the sea every card stands over, and a
    // seed the generator refuses would take the whole app down with it
    // before a frame is drawn — and the seed is stored, so the next visit
    // would die the same way with no menu to change it from. Falling back to
    // the shore the game ships with costs nothing honest: nobody chose this
    // water as a race, and the moment the player asks to RIDE that seed the
    // loading card reports the refusal to their face.
    let state: GameState = tryNewGame() ?? fallbackGame(settingsRef.current);
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
     * sea behind a menu is a game that is still being played. The script
     * comes FIRST, whatever surface is up: a scene is stood and pre-rolled
     * before the shell has settled on a surface, and a pre-roll the bot
     * rode would level a hull the scene had thrown nose-down, so the still
     * that came back would be of a landing and not of the dive it names. */
    const inputFor = (): CraftInput => {
      // A RECORDING IS RIDDEN BY ITS TAPE, and nothing else is asked: not the
      // script, not the bot, not the thumb on the glass. Above the scenario
      // for the same reason the scenario is above the bot — whoever owns the
      // controls owns them from the first step.
      const taped = replays.input();
      if (taped) return taped;
      if (scenario) {
        const at = state.t - scriptFrom;
        if (at <= scenario.seconds) return scenario.script(at);
        scenario = null;
      }
      if (!playerRides(shellRef.current)) return botInput(state);
      return input.sample(TUNING.dt);
    };

    /** A line in the news column that no engine event earned — today the
     * shutter's receipt, which is the one thing the app says about a press
     * whose answer arrives several frames after it. */
    const say = (text: string, tone: HudFlash["tone"]): void => {
      live.push({ id: flashId++, text, tone, until: wall + FLASH_LIFE });
    };

    /** THE SHUTTER (`shot-request.ts`): a picture asked for at the press and
     * served frames later, when there is one to serve. */
    const shots = createShotRequest({
      canvas: () => canvasRef.current,
      answers: () => hudOver(shellRef.current),
      label: () => shotLabel(state),
      hud: readHudLayer,
      say,
    });

    /** THE GHOST (`ghost-run.ts`): your best run on this water, riding it
     * again beside you — on a tricks run or a time trial, where there is
     * nobody else out there to be measured against. It is armed with every
     * run the player is handed, stepped with every step of the engine, and
     * sealed by the finish below. */
    const ghost = createGhostRig({
      renderer,
      settings: () => settingsRef.current,
      rides: () => playerRides(shellRef.current) && scenario === null,
    });

    /** THE RECORDING (`replay-run.ts`): every measured run written down as
     * the controls that rode it, with the moments worth a camera beside
     * them — armed with every run the player is handed, stepped with every
     * step of the engine, and cut where a card asks to watch it back. */
    const replays = createReplayRun({
      renderer,
      params,
      settings: () => settingsRef.current,
      adopt: (next) => world.adopt(next),
      shell: () => shellRef.current,
    });

    /** THE RUN IS OVER — the finish line or the buzzer. What a figure does to
     * the books, the tape and the plate is `run-settle.ts`'s; what this loop
     * owns is the run it came off and the surface it was ridden on. */
    const settle = createSettler({
      current: () => state,
      settings: () => settingsRef.current,
      track: params.track,
      rides: () => playerRides(shellRef.current),
      riding: () => ridingRef.current,
      progress: progressRef,
      setProgress,
      records: recordsRef,
      setRecords,
      setResult,
      ghost,
    });

    const stepOnce = (): void => {
      // SNAPPED WHOEVER PRODUCED IT (`ghost.ts`), at the one place the engine
      // is handed an input: a recorded run's first steps are the BOT's while
      // the loading card is still up, and `run.ts` throws those away only for
      // as long as the lights are on — so a load that outlasts the countdown
      // would put lock on the tape that the tape cannot write down.
      const driven = snapInput(inputFor());
      step(state, driven);
      // The tape is what the ENGINE was handed, and the ghost's own run walks
      // forward beside it off its own — both before anything is observed, so
      // the bodies on both craft are posed off the step just taken.
      ghost.step(driven);
      // ...and the recording is written from the run's OWN first step, which
      // is why the state is handed over with the controls: the tape belongs
      // to a run, not to a surface, and the loading card's own frames take
      // steps of it before anybody's hands are on it (`replay.ts`).
      replays.step(driven, state);
      renderer.observe(state);
      if (soundsLive(shellRef.current)) {
        audio.events(state.events, state.rules.tricks);
      }
      if (playerRides(shellRef.current)) {
        runRumble.events(state.events);
        // The hull, every STEP: the slam is a spike a couple of steps wide
        // at 120 Hz, so a frame that sampled it would feel a random fifth of
        // the chop on a phone that is struggling. `rumble.ts` says why.
        runRumble.step(state.craft);
      }
      for (const e of state.events) {
        const line = flashFor(e, state);
        if (line) live.push({ id: flashId++, ...line, until: wall + FLASH_LIFE });
        // The figure is remembered whether or not the books take it: the bar
        // over a recording bills the run it is of, and a run outside the
        // honesty test still has a clock on it.
        if (e.kind === "finish") {
          replays.finished(e.time);
          settle(e.time);
        } else if (e.kind === "timeUp") {
          replays.finished(e.score);
          settle(e.score);
        }
      }
    };

    /** Stand a fresh run: a new state, the world rebuilt, and — when the
     * settings ask for a scene — the craft placed in it and `ahead` seconds
     * of its script already ridden. */
    const stand = (scene: ScenarioName | null, ahead: number): void => {
      // A refused seed leaves the sea that is already standing where it is,
      // and the rest of this still runs: the renderer has to be handed a
      // world whatever happened, or the page behind the card is empty.
      state = tryNewGame() ?? state;
      scenario = null;
      // The ghost goes with the run it was armed for — and a new one is
      // armed here only where the player is about to ride: the sea behind a
      // card is the bot's, and nobody records a bot.
      ghost.arm(state, playerRides(shellRef.current));
      replays.arm(state, ridingRef.current, playerRides(shellRef.current) && scenario === null);
      live.length = 0;
      setResult(null);
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
    // A link that boots straight onto the water is a run somebody is riding,
    // so it gets its ghost too — armed here rather than in `stand` above,
    // which ran before there was a surface to ask about.
    ghost.arm(state, playerRides(shellRef.current));
    replays.arm(state, null, playerRides(shellRef.current) && scenario === null);

    /* ── STANDING A RUN UP ───────────────────────────────────────────────
       `run-loader.ts` sequences a load; `app-load.ts` owns the steps and the
       bookkeeping. What is left here is what only this loop can give them —
       the engine state a load adopts, and the surfaces a finished one lifts
       onto. */
    const world = {
      renderer,
      adopt: (next: GameState): void => {
        state = next;
        live.length = 0;
        setResult(null);
        audio.reset();
        runRumble.reset();
      },
      current: (): GameState => state,
    };

    const loader = createLoader(world, {
      phase: setLoadingPhase,
      start: () => {
        setLoadLeaving(false);
        setShellNow("loading");
      },
      failed: setLoadFailed,
    });

    /** The card lifting, whichever surface is under it. */
    const lift = (next: Shell): void => {
      setLoadLeaving(true);
      setShellNow(next);
      window.setTimeout(() => setLoadLeaving(false), LOAD_FADE_MS);
    };

    startRunRef.current = (campaign) => {
      loader.begin({
        build: () => {
          const s = settingsRef.current;
          // A campaign level is the pinned shore on the hull the craft card
          // chose; anything else is the start card's. Which one is under
          // the HUD is remembered for the finish and for a restart.
          ridingRef.current = campaign ?? null;
          const game = campaign ? campaignGame(campaign, s.ride.craft) : gameFor(s, params);
          // Armed on the step that BUILT the shore, so the ghost's own run is
          // stood up on the level object beside it rather than on a second
          // build of the same seed.
          ghost.arm(game, true);
          replays.arm(game, campaign ?? null, true);
          if (s.dev.scene) {
            scenario = stageScenario(game, s.dev.scene);
            scriptFrom = game.t;
          } else {
            scenario = null;
          }
          return game;
        },
        camera: settingsRef.current.ride.camera,
        done: () => {
          lift("run");
          hudClock = HUD_TICK;
        },
      });
    };

    /* ── THE BENCHMARK ───────────────────────────────────────────────────
       The developer page's stopwatch, in `app-load.ts` beside the steps that
       stand its race up. Everything it needs from this loop is handed to it
       below; it reaches for nothing on its own. */
    const benchmark = createBenchmark({
      renderer,
      current: () => state,
      begin: loader.begin,
      lift,
      silence: () => audio.silence(),
      restand: () => stand(settingsRef.current.dev.scene, 0),
      setStatus: setBench,
      toMenu: (page) => {
        setMenuPage(page);
        setShellNow("menu");
      },
      video: () => settingsRef.current.video,
    });
    benchRef.current = benchmark;

    // Walking a card on the keys is `menu-nav.ts`'s — it owns the cursor,
    // and the keyboard is one of the two things that moves it.
    const walk = walkCardsOnKeys(nav, () => shellRef.current !== "run");

    /* ── THE WAYS A RUN IS LEFT ──────────────────────────────────────────
       `run-surfaces.ts` owns all six — the pause card up and down, the run
       watched back, the run again from the line, the front door, and giving
       up on a load. What only this loop can give them is handed over below. */
    runRef.current = createRunSurfaces({
      settings: () => settingsRef.current,
      shell: () => shellRef.current,
      setShell: setShellNow,
      unfreeze: () => {
        frozen = false;
      },
      resumeClock: () => clock.resume(),
      restand: () => stand(settingsRef.current.dev.scene, 0),
      onCampaign: () => ridingRef.current !== null,
      leaveCampaign: () => {
        ridingRef.current = null;
      },
      setMenuPage,
      setResult,
      abandon: () => loader.abandon(),
      ghost,
      replays,
    });

    /** One of the game's own buttons, wherever the press came from —
     * `run-actions.ts` owns what each surface does to one. */
    const act = createRunActions({
      shell: () => shellRef.current,
      camera: renderer.camera,
      surfaces: runRef.current,
      leaveBench: () => benchRef.current.leave(),
      shoot: shots.take,
      toggleHud: () => setSettings((s) => ({ ...s, hud: { ...s.hud, on: !s.hud.on } })),
    });
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

    /* ── MEASURING THE MACHINE ───────────────────────────────────────────
       Once, on a visit that has never been measured: the design point is
       drawn under the card for a couple of seconds with the GPU drained
       after every frame, and a machine with room to spare is handed the
       HIGH picture before the rider ever sees OPTIONS (`video-probe.ts`
       owns the rule; the verdict is written to the settings whichever way
       it goes, so nobody is measured twice). Only under a card the bot is
       riding — never a run, where the drain would be a stutter the rider
       felt, and never the loading card, whose frames are the load's. */
    let probe = params.probe && !settingsRef.current.probed ? createVideoProbe() : null;

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
      loader.frame(frameMs);

      // The cursor follows whichever card is up and lets go when the last one
      // goes — and only once somebody has actually walked a card with the
      // keys, since a ring appearing under a mouse would be a second cursor
      // moving on its own. ABOVE the handover below: the benchmark's card is
      // a card and is walked like one.
      if (walk.walked()) nav.sync();

      // THE BENCHMARK OWNS THE CANVAS while one is up (`game/shell.ts`):
      // every frame drawn here between two of its own is time it is charged
      // for and did not spend. Below the load, which stands its race up.
      if (!appDraws(shellRef.current)) return;

      // THE PAUSE CARD IS THE ONE SURFACE THE ENGINE DOES NOT STEP UNDER
      // (`shell.ts`), and a held run is a FROZEN one: drawn with no time
      // passing, so the wave holds, the spray hangs and the camera stops. A
      // frame's worth of dt handed to the renderer over a state that is not
      // moving is a craft doing 90 km/h on standing water.
      // THE DIRECTOR, once a frame and before anything is stepped: the camera
      // is told which moment holds the frame and this loop is told how fast
      // the picture runs (`replay-run.ts`). 1 on everything that is not a
      // recording in slow motion.
      const timeRate = replays.frame();
      const held = !simulates(shellRef.current);
      if (!frozen && !held) {
        const steps = clock.frame(dtFrame * timeRate);
        for (let i = 0; i < steps; i++) stepOnce();
        // The tape has run out: a recording ends at the front door, which is
        // where the run it was cut from would have left the player anyway.
        if (replays.over()) runRef.current.toMenu();
      } else {
        // Frozen: the controls are still read, so a banked reset does not
        // fire the moment the picture thaws — and a thumb resting on a zone
        // behind the card does not either.
        input.sample(TUNING.dt);
      }
      // ...and the picture ages at the same rate the engine does, so the
      // spray hangs and the wake spreads in slow motion with the hull that
      // threw them rather than racing ahead of it.
      renderer.render(state, held || clock.paused() ? 0 : dtFrame * timeRate);
      // THE PICTURE, IF ONE WAS ASKED FOR — served here and nowhere else,
      // in the same task as the render that filled the buffer
      // (`shot-request.ts` says why).
      shots.serve();
      // The beds follow the same frames the engine took: fed whenever the
      // sea moved, hushed whenever it did not — see this file's header.
      if (!frozen && !held && !clock.paused()) {
        audio.setView(renderer.camera.mode());
        audio.frame(state, dtFrame * timeRate, soundsLive(shellRef.current) ? 1 : CARD_DUCK);
        // …and the sea under it paid out, at most one slap per gap. Only
        // with the player's hands on the craft: there is no ducking a motor,
        // so a card is the difference between a pulse and no pulse rather
        // than a quieter one.
        if (playerRides(shellRef.current)) runRumble.frame(dtFrame);
      } else {
        audio.silence();
      }
      window.__SH_COST__ = renderer.cost();
      if (probe && !playerRides(shellRef.current) && !loader.busy() && !clock.paused() && !frozen) {
        const verdict = probe.frame(frameMs, renderer.cost().frameMs + renderer.drain());
        if (verdict !== null) {
          probe = null;
          setSettings((s) => ({
            ...s,
            probed: true,
            video: verdict ? promoteVideo(s.video) : s.video,
          }));
        }
      }
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
      hudClock += dtFrame;
      if (hudClock >= HUD_TICK) {
        hudClock = 0;
        setSnap(takeSnapshot(state, ghost.state()));
        setFps(rate);
        setCost(settingsRef.current.dev.cost ? { ...renderer.cost() } : null);
        const kept = live.filter((f) => f.until > wall);
        if (kept.length !== live.length) live.splice(0, live.length, ...kept);
        setFlashes(live.map(({ id, text, tone }) => ({ id, text, tone })));
        if (clock.paused() !== awayRef.current) {
          awayRef.current = clock.paused();
          setAway(awayRef.current);
        }
        // The bar over a recording, refreshed with every other readout —
        // never per frame, which is the one cost a replay must not carry.
        const bar = replays.bar();
        setReplayBar(bar && { ...bar, onLeave: () => runRef.current.toMenu() });
        // ...and whether the two cards may offer one at all. Guarded on a ref
        // so a run that keeps no recording is not a `setState` a second.
        const offers = replays.offers();
        if (offers !== canReplayRef.current) {
          canReplayRef.current = offers;
          setCanReplay(offers);
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
      benchmark.stop();
      audio.silence();
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("pointerdown", unlockAudio, unlockOpts);
      document.removeEventListener("keydown", unlockAudio, unlockOpts);
      walk.stop();
      stopShellCommands();
      input.dispose();
      renderer.dispose();
    };
    // Boots once: the URL is read on mount and a new URL is a new page, and
    // `renderKit` is set exactly once by the loader above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderKit]);

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
      {/* THREE LAYERS OVER THE WATER ARE NOT READOUTS, so the HUD's own
          switch reaches none of them: a setting worded "the readouts over the
          water" must not take away the one thing the app says on its own
          initiative, the only way out of a recording, or the only ways off a
          finished run. Each is its own layer, drawn whether or not the
          instruments under it are. THE NEW-BUILD NOTICE rides the HUD's own
          news column with the HUD up and stands alone in that same corner
          without it — `update-button.tsx` argues both, and this is only the
          condition: the attract and loading cards are the app covering its
          own screen, so the notice waits for whatever is under them. It draws
          itself or it draws nothing, so most days this is an empty box. */}
      {!hudUp && (hudOver(shell) || shell === "menu") && (
        <div class={shell === "menu" ? "hud hud-over-card" : "hud"}>
          <div class="hud-right">
            <UpdateButton />
          </div>
        </div>
      )}
      {/* THE BAR OVER A RECORDING (hud-replay.tsx). */}
      {replayBar && (
        <div class="hud hud-replay-layer">
          <ReplayBar {...replayBar} />
        </div>
      )}
      {/* THE PLATE OVER A FINISHED RUN (hud-result.tsx): the craft coasts
          from the line on, so its three presses are all the rider has left.
          Down under the pause card, which offers the same three, and with the
          tab away. */}
      <ResultPlate
        result={shell === "run" && !away ? result : null}
        touch={touch}
        replay={canReplay}
        surfaces={runRef.current}
      />
      {/* THE RUN, HELD. Over the HUD and over the frozen frame, wearing the
          front door's own chrome — it is the same game asking the same kind
          of question, and one card look beats two. */}
      {shell === "pause" && snap !== null && (
        <PauseMenu
          snap={snap}
          settings={settings}
          onSettings={setSettings}
          onResume={() => runRef.current.resume()}
          onReplay={canReplay ? () => runRef.current.watch() : null}
          onMainMenu={() => runRef.current.toMenu()}
        />
      )}
      {shell === "menu" && (
        <MainMenu
          page={menuPage}
          settings={settings}
          records={records}
          progress={progress}
          onSettings={setSettings}
          onNavigate={setMenuPage}
          onProgress={setProgress}
          onStart={() => startRunRef.current()}
          onCampaign={(level) => startRunRef.current(level)}
          onBenchmark={() => benchRef.current.start()}
        />
      )}
      {(shell === "loading" || loadLeaving) && (
        <LoadingScreen
          leaving={loadLeaving}
          phase={loadingPhase}
          failed={loadFailed}
          onBack={() => runRef.current.abandonLoad()}
        />
      )}
      {/* THE STOPWATCH'S CARD, over the race it is timing. It is not a menu
          page: the thing being measured is on the canvas underneath it, and
          the card is the only thing on screen that is not part of the
          measurement. */}
      {shell === "bench" && bench !== null && (
        <BenchmarkCard
          status={bench}
          video={settings.video}
          onAgain={() => benchRef.current.start()}
          onHistory={() => benchRef.current.leave({ page: "benchHistory" })}
          onLeave={() => benchRef.current.leave()}
        />
      )}
      {shell === "splash" && <SplashScreen warm={warm} onDone={() => setShell("menu")} />}
    </>
  );
}
