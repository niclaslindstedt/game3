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
  /** The two presses on the HUD's action row (hud-actions.tsx). Both are a
   * MARK rather than a word — the top bar is the one strip that has to stay
   * out of the way of the water — so these are what a hover, a screen reader
   * and the keyboard hint get. */
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
  /** The card the HUD puts up while the TAB is away (§37.3) — not the pause
   * menu, which is next door in menu-pause.tsx and shares only the word. */
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

  /* ── THE START CARD (menu-start.tsx, seed-preview.tsx) ─────────────── */
  /** The card START opens: where this run is and what day it is in, before
   * the craft card asks what rides it. */
  startTitle: "THE RUN",
  startSub: "Your shore, and the day you want it in",
  startShore: "SHORE",
  startShoreHint: "The seed the whole coast is built from — type one in to ride somebody else's",
  startTime: "TIME",
  startTimeHint: "The hour to ride at, set against this coast's own daylight rather than a clock",
  /** The wind, which is the sea; then the sky over it. Two rows because they
   * are two questions — see `menu-start.tsx` for why they used to be one. */
  startWind: "WIND",
  startWindHint: "The wind, and so the sea it builds — the fetch law turns one into the other",
  startWeather: "WEATHER",
  startWeatherHint:
    "The sky over it. Left alone it is the one the wind implies, which is R19's own agreement",
  /** What the mark on a value means: this is the answer the shore came with,
   * and the one that rides while the row is left alone. */
  startDealt: "Dealt by this seed",
  /** The card's own line under the rows, which is where the mark is
   * explained: a dot on three of four rows needs saying once, not four
   * times. */
  startCaption: "Marked · the answer this shore was dealt. Land back on it to ride the shore's own",
  /** The way on from the start card — the craft, and RIDE with it. */
  startNext: "CHOOSE YOUR CRAFT",
  /** The press that actually rides, on the craft card at the end of it. */
  startGo: "RIDE",

  /* ── THE CRAFT CARD (menu-craft.tsx, craft-picker.tsx) ─────────────── */
  /** The second card's own title. */
  craftTitle: "CRAFT",
  /** The arrows either side of the hull, for a reader who cannot see it. */
  craftPrev: "Previous craft",
  craftNext: "Next craft",
  /** Where this hull stands in the roster — `2 / 4`, so four craft turning
   * one at a time read as a set with edges rather than as a carousel. */
  craftOf: (at: number, of: number): string => `${at} / ${of}`,
  /** The hours, earliest first. */
  timeSunrise: "SUNRISE",
  timeDay: "DAY",
  timeSunset: "SUNSET",
  /** The winds, calmest first. Named for the SEA they build rather than for
   * a number, because a rung of this ladder is something a rider feels
   * through the hull long before they read it off the vane. */
  windCalm: "CALM",
  windBrisk: "BRISK",
  windStorm: "STORM",
  /** The skies, lightest first — R19's own five, in the engine's order.
   * Plain-weather words for ids that are art direction's: `high` is a thin
   * sheet up there, `overcast` is the dry lid, `rain` is that lid falling. */
  skyClear: "CLEAR",
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
  /** The three groups the page's rows stand under: what the picture costs,
   * what the ride is watched from, what is drawn over it. */
  optPicture: "PICTURE",
  optRiding: "RIDING",
  optHudGroup: "HUD",
  /** The page's own line, under the rows, while no row is being looked at. */
  optCaption: "Every row here changes the sea behind this card as you press it",
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
  optWaterHint: "How far out the sea is drawn properly, and how fine the grid under it is",
  optResolution: "RESOLUTION",
  optResolutionHint: "How many pixels the water is drawn at before it reaches the screen",
  optDetail: "DETAIL",
  optDetailHint:
    "The spray, the sea life, what grows on the shore, how much cloud is in the sky, and whether the rain lands on the water",
  optSeeThrough: "SEE-THROUGH",
  optSeeThroughHint: "The bed, the rocks and what swims under the hull — off, the sea is solid",
  optFps: "FPS",
  optFpsHint: "Frames a second in the corner, beside the build",
  /** The one fader. It reads OFF at the bottom of its travel and a share
   * everywhere else; there is no MUSIC row until there is a score. */
  optSoundGroup: "SOUND",
  optSound: "EFFECTS",
  optSoundHint: "The engine, the spray, the sea and every splash — OFF at the bottom of the travel",
  optSoundOff: "OFF",
  percent: (share: number): string => `${Math.round(share * 100)}%`,
  optRestore: "RESTORE DEFAULTS",
  /** The camera rows, in the ladder's own order — the handlebars backwards.
   * Each is one word: the row is six chips wide and read at a glance. */
  cameraBow: "BOW",
  cameraNose: "NOSE",
  cameraClose: "CLOSE",
  cameraChase: "CHASE",
  cameraFar: "FAR",
  cameraHeli: "HELI",

  /* ── THE DEVELOPER PAGE (menu-dev.tsx) ─────────────────────────────── */
  /** The three groups: which shore and where on it, what the water is doing,
   * and the instruments over the top. */
  devGroupRun: "THE RUN",
  devGroupSea: "THE SEA",
  devGroupTools: "TOOLS",
  devSeed: "SEED",
  devSeedHint: "The same shore the start card picks — one setting, two places to turn it",
  devWind: "WIND",
  devWindHint:
    "Ride in this wind from the level's own quarter, whatever the shore was generated with",
  devSea: "SEA",
  devSeaHint: "…or quote the sea by its significant height. Set beside a wind, this one wins",
  devScene: "SCENE",
  devSceneHint: "Stand the run in a staged moment instead of at the start line",
  devCost: "FRAME COST",
  devCostHint: "The water's CPU time, the draw calls and the triangles, in the HUD's corner",
  /** The page's own line under the rows — the bargain the whole page is
   * built on, said where a row is not being looked at. */
  devCaption: "Every row here is a parameter the repro link carries",
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

  /* ── THE PAUSE CARD (menu-pause.tsx) ───────────────────────────────── */
  /** The card a run is held under, and what it bills the held run as — the
   * same two words the HUD's build corner carries, so the card and the frame
   * behind it name the run the same way. */
  pauseTitle: "PAUSED",
  pauseSub: (seed: number, craft: string): string => `SEED ${seed} · ${craft.toUpperCase()}`,
  /** The two ways on. RESUME is the way OUT of the card as well as its first
   * row — see menu-pause.tsx. */
  pauseResume: "RESUME",
  pauseMainMenu: "MAIN MENU",
  /** What the minimap does when it is pressed — the way into the card on a
   * screen with no Escape key to press. */
  pauseOpen: "Pause (Esc)",
} as const;
