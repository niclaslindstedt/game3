// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE APP: boots the engine off the URL, runs the §37 clock, and mounts the
// renderer and the HUD over it. There are no menus yet — the page IS a run.
//
// URL PARAMS, the whole set (the developer overlay's REPRO line will print
// exactly these, so a frame reproduces as a URL):
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
//
// THE LOOP: `requestAnimationFrame` hands the clock (run-loop.ts) the wall
// time; the clock says how many fixed steps to take; each step samples the
// input (§37.1, once per step) and calls `step`. The renderer draws the
// state once per frame; the HUD is refreshed from a snapshot at ~12 Hz. A
// hidden tab pauses the clock (§37.3) and the HUD says so.

import { useEffect, useRef, useState } from "preact/hooks";
import {
  TUNING,
  createGame,
  isCraftId,
  step,
  type CraftId,
  type CraftInput,
  type GameEvent,
  type GameState,
} from "@engine";

import { APP_NAME } from "./identity.ts";
import { connectOutput } from "./output-bridge.ts";
import { Hud, hasTouch, type HudFlash } from "./game/hud.tsx";
import { createInputManager } from "./game/input.ts";
import { createRenderer } from "./game/renderer.ts";
import { createRunClock } from "./game/run-loop.ts";
import {
  isScenarioName,
  stageScenario,
  type Scenario,
  type ScenarioName,
} from "./game/scenarios.ts";
import { takeSnapshot, type HudSnapshot } from "./game/snapshot.ts";
import { STRINGS } from "./game/strings.ts";

/** How often the HUD's readouts are refreshed, s. Twelve a second reads
 * as live on a clock and a speedo; the canvas is the sixty-frame surface. */
const HUD_TICK = 1 / 12;
/** How long a line stays in the news column, s. */
const FLASH_LIFE = 3.2;
/** A flight shorter than this is a wave, not a jump, and gets no line. */
const AIR_WORTH_A_LINE = 0.6;

declare global {
  interface Window {
    __SH_READY__?: boolean;
    __SH_COST__?: unknown;
  }
}

type Params = {
  seed: number;
  craft: CraftId;
  scene: ScenarioName | null;
  t: number;
  shot: boolean;
  /** A wind speed, m/s, in place of the level's; a sea quoted by its
   * significant height, m, in place of the one the wind grows. */
  wind: number | undefined;
  hs: number | undefined;
};

function readParams(): Params {
  const p = new URLSearchParams(location.search);
  const seed = Number(p.get("seed"));
  const craft = p.get("craft") ?? "skiff";
  const scene = p.get("scene") ?? "";
  const t = Number(p.get("t"));
  const metres = (key: string): number | undefined => {
    const v = p.get(key);
    if (v === null) return undefined;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  };
  return {
    seed: Number.isFinite(seed) && seed > 0 ? Math.floor(seed) : 38,
    craft: isCraftId(craft) ? craft : "skiff",
    scene: isScenarioName(scene) ? scene : null,
    t: Number.isFinite(t) && t > 0 ? t : 0,
    shot: p.get("shot") === "1",
    wind: metres("wind"),
    hs: metres("hs"),
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

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [snap, setSnap] = useState<HudSnapshot | null>(null);
  const [flashes, setFlashes] = useState<HudFlash[]>([]);
  const [paused, setPaused] = useState(false);
  const inputRef = useRef<ReturnType<typeof createInputManager> | null>(null);
  const [touch] = useState(hasTouch);
  /** Whether the HUD has committed to the DOM — what the ready flag waits
   * on, so a screenshot never captures the boot card over the first frame. */
  const hudUp = useRef(false);
  const pausedRef = useRef(false);
  useEffect(() => {
    if (snap) hudUp.current = true;
  }, [snap]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    connectOutput();
    const params = readParams();
    const input = createInputManager(window);
    inputRef.current = input;
    const renderer = createRenderer(canvas);
    const clock = createRunClock(TUNING.physicsHz);

    const newGame = (): GameState =>
      createGame({
        seed: params.seed,
        craft: params.craft,
        windSpeed: params.wind,
        sea: params.hs !== undefined ? { hs: params.hs } : undefined,
      });
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

    /** What this step is ridden on: the scenario's script while it runs,
     * the player's hands after. */
    const inputFor = (): CraftInput => {
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
     * URL asks for a scene — the craft placed in it and `t` seconds of its
     * script already ridden. */
    const stand = (scene: ScenarioName | null, ahead: number): void => {
      state = newGame();
      scenario = null;
      live.length = 0;
      if (scene) {
        scenario = stageScenario(state, scene);
        scriptFrom = state.t;
      }
      renderer.load(state);
      const steps = Math.round(ahead * TUNING.physicsHz);
      for (let i = 0; i < steps; i++) stepOnce();
      hudClock = HUD_TICK;
    };
    stand(params.scene, params.t);
    frozen = params.shot;

    input.onAction((action) => {
      if (action === "restart") {
        frozen = false;
        stand(null, 0);
        clock.resume();
      } else if (action === "camera") renderer.camera.cycle();
    });

    let raf = 0;
    let last = performance.now();
    const frame = (now: number): void => {
      raf = requestAnimationFrame(frame);
      const dtFrame = Math.min(0.1, (now - last) / 1000);
      last = now;
      wall += dtFrame;
      if (!frozen) {
        const steps = clock.frame(dtFrame);
        for (let i = 0; i < steps; i++) stepOnce();
      } else {
        // Frozen: the controls are still read, so a banked reset does
        // not fire the moment the picture thaws.
        input.sample(TUNING.dt);
      }
      renderer.render(state, clock.paused() ? 0 : dtFrame);
      window.__SH_COST__ = renderer.cost();
      if (!ready && hudUp.current) {
        ready = true;
        // The frame above is presented on the NEXT animation frame; the
        // flag waits for it, and for the HUD to be up (`hudUp`), so a
        // screenshot never captures the boot card.
        requestAnimationFrame(() => {
          window.__SH_READY__ = true;
        });
      }
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
    // still on screen keeps riding (the held keys are let go of by the
    // input manager, which is what stops a craft riding off on its own).
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
    const onResize = (): void => renderer.resize();
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", onResize);
      input.dispose();
      renderer.dispose();
    };
    // Boots once: the URL is read on mount and a new URL is a new page.
  }, []);

  return (
    <>
      <canvas ref={canvasRef} />
      {snap && inputRef.current ? (
        <Hud
          snap={snap}
          flashes={flashes}
          touch={touch}
          input={inputRef.current}
          paused={paused}
          onReset={() => inputRef.current?.requestReset()}
        />
      ) : (
        <div class="boot" role="status">
          <span class="boot-name">{APP_NAME}</span>
          <span class="boot-note">
            {STRINGS.loading} · {__BUILD_LABEL__}
          </span>
        </div>
      )}
    </>
  );
}
