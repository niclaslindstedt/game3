// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// EVERY WORD THE PLAYER READS, in one table (OSS_GAME_SPEC §39.1). The HUD
// and the touch overlay reference a key here and never carry a literal of
// their own, so a line can be fixed without a code review and a second
// language is a second table rather than a rewrite. Composed lines are
// templates — functions of their parameters — never concatenations at the
// call site (§39.2). Developer diagnostics are deliberately not here.

import { formatTime } from "../lib/util.ts";

export const STRINGS = {
  /** The speedometer's unit. */
  speedUnit: "km/h",
  /** The rev bar's caption. */
  revs: "RPM",
  /** The gate counter, `passed / total`. */
  gates: (passed: number, total: number): string => `${passed} / ${total}`,
  gatesLabel: "GATES",
  clockLabel: "TIME",
  /** The wind chip: metres per second, one decimal. */
  wind: (ms: number): string => `${ms.toFixed(1)} m/s`,
  windLabel: "WIND",
  /** The air-time readout, tenths. */
  air: (seconds: number): string => `${seconds.toFixed(1)}s`,
  airLabel: "AIR",
  /** The minimap's readout: how far the next gate is, whole metres — and
   * what stands there once the last one is behind the craft. */
  mapToNext: (metres: number): string => `${Math.round(metres)} M`,
  mapAtFinish: "FINISH",
  /** The RESET button — back to the last gate. */
  reset: "RESET",
  resetTitle: "Back to the last gate (R)",
  /** The build corner: which stage and which craft this frame is of. */
  stage: (seed: number): string => `SEED ${seed}`,
  /** The split flash after a gate, and the penalty after a missed one. */
  split: (gate: number, seconds: number): string => `GATE ${gate}  ${formatTime(seconds)}`,
  airGate: (gate: number, seconds: number): string => `RING ${gate}  ${formatTime(seconds)}`,
  missed: (gate: number, penalty: number): string => `MISSED GATE ${gate}  +${penalty.toFixed(0)}s`,
  finish: (seconds: number): string => `FINISH  ${formatTime(seconds)}`,
  dive: "DIVE",
  hit: "HIT",
  grounded: "AGROUND",
  landed: (airSeconds: number): string => `AIR ${airSeconds.toFixed(1)}s`,
  /** The new-build button: the word the armed mark shows, and the two
   * labels a pointer and a screen reader get — one for the mark, one for
   * the armed button, whose press throws the run away. */
  updateWord: "RELOAD",
  updateReady: (version: string | null): string =>
    version
      ? `New build v${version} ready — reload to install`
      : "New build ready — reload to install",
  updateArmed: "Press again to reload onto the new build",
  /** The pause card while the tab is away. */
  paused: "PAUSED",
  pausedNote: "The run waits until you come back",
  /** The boot card, and the word the attract card and the loading card both
   * wear while they are waiting on something. */
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
  /** The game's own billing, under the wordmark on the front door. */
  menuTag: "ride the northern shores",
  menuStart: "START",
  menuOptions: "OPTIONS",
  menuDeveloper: "DEVELOPER",
  /** The way out of every page under the front door. */
  menuBack: "MENU",
  /** What START says while it is being held down — the developer menu is
   * seven seconds away and the row says so before it arrives, never after
   * (menu-hold.ts). */
  menuHolding: "KEEP HOLDING…",
  menuUnlocked: "DEVELOPER MENU UNLOCKED",
  /** The way back to the front door from inside a run (Escape). */
  menuLeave: "MENU",
  menuLeaveTitle: "Back to the main menu (Esc)",

  /* ── OPTIONS (menu-options.tsx) ────────────────────────────────────── */
  optCraft: "CRAFT",
  optCamera: "CAMERA",
  optHud: "HUD",
  optHudHint: "The readouts over the water — off leaves the sea and nothing else",
  optRestore: "RESTORE DEFAULTS",
  /** The camera rows, in the ladder's own order. */
  cameraChase: "CHASE",
  cameraNose: "NOSE",

  /* ── THE DEVELOPER PAGE (menu-dev.tsx) ─────────────────────────────── */
  devSeed: "SEED",
  devWind: "WIND",
  devSea: "SEA",
  devScene: "SCENE",
  devCost: "FRAME COST",
  devCostHint: "The water's CPU time, the draw calls and the triangles, in the HUD's corner",
  devAuto: "AUTO",
  devStart: "START",
  devLock: "LOCK THE DEVELOPER MENU",
  /** A wind, a sea and a seed as the developer page reads them back. */
  devWindValue: (ms: number): string => `${ms.toFixed(0)} m/s`,
  devSeaValue: (m: number): string => `${m.toFixed(1)} m`,
  devRepro: "COPY REPRO LINK",
  devReproCopied: "COPIED",
  devReproFailed: "COPY FAILED",

  /* ── THE LOADING CARD (loading-screen.tsx) ─────────────────────────── */
  /** What each slice of standing a run up is called, for the card's line.
   * Steps sharing a label are one PHASE and one slot in the count. */
  loadLevel: "Building the shore",
  loadScene: "Standing the world up",
  loadWarm: "Compiling shaders",
  /** The phase and where it sits in the plan — a count of PHASES, never of
   * seconds (see `run-loader.ts`). */
  loadStep: (label: string, at: number, of: number): string => `${label}… (${at}/${of})`,
} as const;
