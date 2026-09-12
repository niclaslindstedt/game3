// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// EVERY WORD THE PLAYER READS, in one table (OSS_GAME_SPEC §39.1). The HUD
// and the touch overlay reference a key here and never carry a literal of
// their own, so a line can be fixed without a code review and a second
// language is a second table rather than a rewrite. Composed lines are
// templates — functions of their parameters — never concatenations at the
// call site (§39.2). Developer diagnostics are deliberately not here.

import { formatScore, formatTime } from "../lib/util.ts";

/** The class ladder's words, by the multiple each rung is. Novice is the
 * detuned ski a rider is handed first; stock is the roster as the catalog
 * tunes it; limited and open are the paddock's own two steps above it. */
const CLASS_NAMES: Record<string, string> = {
  "0.75": "NOVICE",
  "1": "STOCK",
  "1.25": "LIMITED",
  "1.5": "OPEN",
};

/** What a flight's Nth revolution is called. Past a triple the count is
 * spelled with a figure — nobody has a word for a fifth one, and a rider who
 * gets there has earned a number rather than an adjective. */
const SPINS: Record<number, string> = { 1: "", 2: "DOUBLE ", 3: "TRIPLE " };

export const STRINGS = {
  /** The speedometer's unit. */
  speedUnit: "km/h",
  /** The rev bar's caption — and what it reads instead while the reverse
   * bucket is down: BRAKE while the craft is still going ahead, REVERSE
   * once it is backing up. */
  revs: "RPM",
  brake: "BRAKE",
  reverse: "REVERSE",
  /** The gate counter, `passed / total`. */
  gates: (passed: number, total: number): string => `${passed} / ${total}`,
  gatesLabel: "GATES",
  /** R30 — which lap of how many, on a circuit. Nothing to read on a coast
   * sprint, which is one pass of one course, so the HUD leaves it out. */
  laps: (lap: number, total: number): string => `${lap} / ${total}`,
  lapsLabel: "LAP",
  clockLabel: "TIME",
  /** The wind chip: metres per second, one decimal. */
  wind: (ms: number): string => `${ms.toFixed(1)} m/s`,
  windLabel: "WIND",
  /** The air-time readout, tenths. */
  air: (seconds: number): string => `${seconds.toFixed(1)}s`,
  airLabel: "AIR",
  /** The word under the air clock while the flight on it is the run's
   * longest. Under rather than beside: the clock keeps the centreline and
   * the news is read as a second line of the same readout. */
  airRecordLabel: "RECORD",
  /** THE SCORE (`engine/game/tricks.ts`): what the rider has banked this
   * run, and the combo he is still riding on. The combo carries its
   * MULTIPLIER as a separate word, because the two are read differently —
   * the points are a number that climbs and the multiplier is a rung he
   * either has or has not reached. */
  score: (points: number): string => formatScore(points),
  scoreLabel: "SCORE",
  comboPoints: (points: number): string => `+${formatScore(points)}`,
  comboMult: (mult: number): string => `\u00d7${mult}`,
  comboLabel: "COMBO",
  /** ...and the two words the combo's last moment ends on: paid, because
   * the rider was still on the craft when the window ran out, or lost
   * because he was not. */
  comboBanked: "BANKED",
  comboBailed: "BAILED",
  /** A trick as it completes, for the news column: the revolution's own
   * name and the multiplier it just bought. A double is named as a double
   * rather than reported twice — it is one harder trick, which is exactly
   * what the multiplier says. */
  trick: (spins: number, backwards: boolean, mult: number): string =>
    `${SPINS[spins] ?? `${spins}\u00d7 `}${backwards ? "BACKFLIP" : "FRONTFLIP"}  \u00d7${mult}`,
  /** ...and the combo lost, which is the one half of the score the picture
   * does not already say: the tile is gone by the time the rider looks. */
  bailed: (points: number): string => `BAILED  \u2212${formatScore(points)}`,
  /** The minimap's readout: how far the next gate is, whole metres — and
   * what stands there once the last one is behind the craft. */
  mapToNext: (metres: number): string => `${Math.round(metres)} M`,
  mapAtFinish: "FINISH",
  /** What the minimap's scale bar is worth. Always a round figure, so it is
   * read rather than parsed. */
  mapScale: (metres: number): string => `${metres} M`,
  /** The two presses on the HUD's action row (hud-actions.tsx). Both are a
   * MARK rather than a word — the top bar is the one strip that has to stay
   * out of the way of the water — so these are what a hover, a screen reader
   * and the keyboard hint get. */
  resetTitle: "Back to the last gate (R)",
  cameraTitle: "Next camera (C)",
  /** ...and the third, the SHUTTER. Named for what it keeps rather than for
   * what it does, because the picture landing somewhere is the half a rider
   * cannot see happen. */
  shotTitle: "Take a screenshot (Enter)",
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
  /** ...and the same flight when it is the longest of the run so far. The
   * number is the point, so it reads the same way and the word is what is
   * added to it. */
  airRecord: (airSeconds: number): string => `BEST AIR ${airSeconds.toFixed(1)}s`,
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
  menuGallery: "GALLERY",
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
  startTimeHint:
    "The hour to start at, set against this coast's own daylight in the season — NIGHT is midnight, and the clock runs on from wherever you start, an hour a minute",
  startSeason: "SEASON",
  startSeasonHint:
    "The sun's arc: how long the day is, and how dark the night gets — a summer night here never gets past twilight",
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
  /** The way on from the start card — the craft, and RIDE with it. One word,
   * because it stands in the head's corner rather than across the card's
   * foot, and the card it opens is titled CRAFT. */
  startNext: "NEXT",
  /** The press that actually rides, on the craft card at the end of it. */
  startGo: "RIDE",

  /* ── THE CRAFT CARD (menu-craft.tsx, craft-picker.tsx) ─────────────── */
  /** The second card's own title. */
  craftTitle: "CRAFT",
  /** THE CLASS the craft is ridden in. A kart game counts its classes in
   * engine size; the sport this one is about counts them the way its own
   * race paddock does — a stock ski, a limited one, an open one — so the
   * rungs are the classes a rider would actually enter, with a novice
   * class under them for a first ride. The row moves the whole roster at
   * once and PACES THE COURSE with it, so a class is a different race
   * rather than only a faster hull. */
  classRow: "CLASS",
  className: (id: string): string => CLASS_NAMES[id] ?? id,
  /** The arrows either side of the hull, for a reader who cannot see it. */
  craftPrev: "Previous craft",
  craftNext: "Next craft",
  /** Where this hull stands in the roster — `2 / 4`, so four craft turning
   * one at a time read as a set with edges rather than as a carousel. */
  craftOf: (at: number, of: number): string => `${at} / ${of}`,
  /** The hours, in the order a day passes through them. */
  timeSunrise: "SUNRISE",
  timeDay: "DAY",
  timeSunset: "SUNSET",
  timeNight: "NIGHT",
  /** The seasons, in the year's order. */
  seasonSpring: "SPRING",
  seasonSummer: "SUMMER",
  seasonAutumn: "AUTUMN",
  seasonWinter: "WINTER",
  /** The HUD's sun clock: the hour the run has reached, and the word for
   * its light under it. */
  sunClockLabel: (daylight: "dawn" | "day" | "dusk" | "night"): string =>
    ({ dawn: "DAWN", day: "DAY", dusk: "DUSK", night: "NIGHT" })[daylight],
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
  /** The four groups the page's rows stand under: what the picture costs,
   * how the ride reaches the rider (where it is watched from, and what it
   * does to the hands), what it sounds like, what is drawn over it. */
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
  optWaterHint:
    "The whole sea — how fine the grid is and how far out it reaches, plus the spray, the wake, the splash and what the water mirrors",
  optDistance: "DISTANCE",
  optDistanceHint:
    "How much of the coast is drawn — the shorter the view, the closer the haze that closes over it",
  optResolution: "RESOLUTION",
  optResolutionHint: "How many pixels the water is drawn at before it reaches the screen",
  optDetail: "DETAIL",
  optDetailHint:
    "Everything around the water — the sea life, what grows on the shore, how much cloud is in the sky, and how much rain falls out of it",
  optSeeThrough: "SEE-THROUGH",
  optSeeThroughHint: "The bed, the rocks and what swims under the hull — off, the sea is solid",
  /** The one row on the picture page that is about TIME: the two stops are
   * spelled as the figures they are, and the top of the ladder is whatever
   * the screen itself does. */
  optFrameRate: "FRAME RATE",
  optFrameRateHint:
    "The most frames a second the game draws — hold it to what this machine can keep, and the ride is even",
  optFrameRateMax: "MAX",
  optFps: "FPS",
  optFpsHint: "Frames a second in the corner, beside the build",
  /** The one fader. It reads OFF at the bottom of its travel and a share
   * everywhere else; there is no MUSIC row until there is a score. */
  optSoundGroup: "SOUND",
  optSound: "EFFECTS",
  optSoundHint: "The engine, the spray, the sea and every splash — OFF at the bottom of the travel",
  optSoundOff: "OFF",
  /** The motor. Only drawn on a device that has one, so the words may
   * assume a phone in two hands — and they name the WATER rather than the
   * hardware, because what the row switches off is the sea hitting the
   * hull, not a feature called haptics. */
  optRumble: "VIBRATION",
  optRumbleHint: "The sea through the bars — every slap of the bottom, every landing, every rock",
  percent: (share: number): string => `${Math.round(share * 100)}%`,
  /** The door to the bindings page, and what stands where a value would:
   * how many actions are behind it, so a row that opens a page still says
   * what is in there the way every other row says what it is set to. */
  optControlsGroup: "CONTROLS",
  optKeyboard: "KEYBOARD",
  optKeyboardHint: "Which key does what — every action on the craft, and the presses around a run",
  optKeysCount: (n: number): string => `${n} KEYS`,
  optRestore: "RESTORE DEFAULTS",
  /** The camera rows, in the ladder's own order — the handlebars backwards.
   * Each is one word: the row is seven chips wide and read at a glance. */
  cameraBow: "BOW",
  cameraNose: "NOSE",
  cameraClose: "CLOSE",
  cameraChase: "CHASE",
  cameraFar: "FAR",
  cameraHeli: "HELI",
  cameraDrone: "DRONE",

  /* ── THE KEYBOARD PAGE (menu-keys.tsx, settings-input.ts) ──────────── */
  /** One word per action, and every one of them says what the CRAFT does
   * rather than what the code is called: a rider looking for the brake is
   * looking for the word BRAKE, and `reverse` is the engine's name for it. */
  keysTitle: "KEYBOARD",
  keyThrottle: "THROTTLE",
  keyReverse: "BRAKE / REVERSE",
  keyLeft: "STEER LEFT",
  keyRight: "STEER RIGHT",
  keyLeanBack: "LEAN BACK",
  keyLeanForward: "LEAN FORWARD",
  keyTuck: "TUCK",
  keyReset: "BACK TO THE GATE",
  keyRestart: "RESTART THE RUN",
  keyCamera: "CAMERA",
  keyShot: "SCREENSHOT",
  keyPause: "PAUSE",
  /** What a row says while it waits for the key, what an action with no key
   * on it says, and the page's own line at the foot. */
  keysPrompt: "PRESS A KEY…",
  keysUnbound: "UNBOUND",
  keysCaption: "Press a row, then the key you want on it. One key replaces the whole binding",
  keysRowHint: (label: string): string =>
    `Press the row, then the key you want on ${label}. Escape keeps what is there`,
  /** A key doing two jobs at once. Allowed — a rider may want the brake and
   * the reset under one finger — but never hidden. */
  keysClash: "ALSO ON",
  keysClashHint: (label: string, others: string): string =>
    `${label} shares its key with ${others} — both happen on one press`,
  keysRestore: "RESET KEYS",

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

  /* ── THE SHUTTER AND THE GALLERY (screenshots.ts, menu-gallery.tsx) ── */
  /** The one line of context a picture carries — the same two words the
   * pause card bills a held run with, because a picture of a run and a card
   * over one should name it the same way. It is the gallery's caption and,
   * slugged, half of the file's name. */
  shotLabel: (seed: number, craft: string): string => `SEED ${seed} · ${craft.toUpperCase()}`,
  /** The receipt, in the news column. A picture is filed frames after the
   * press that asked for it, so the press gets an answer either way — the
   * one thing worse than a failed capture is a shutter that says nothing.
   * The second line is the same picture with a copy of it on the CLIPBOARD,
   * which is what most presses get: it is said only once the write has come
   * back, because a browser may hold the permission back and a receipt that
   * promised a paste that is not there is worse than no receipt at all. */
  shotKept: "PICTURE SAVED",
  shotCopied: "PICTURE SAVED · COPIED",
  shotFailed: "PICTURE FAILED",
  /** The gallery. The subtitle counts the roll against its cap, because the
   * oldest picture falling off is the one thing about this page a player
   * would otherwise discover by losing something. */
  galleryTitle: "GALLERY",
  gallerySub: (kept: number, cap: number): string => `${kept}/${cap} — the oldest falls off`,
  /** Before the roll has been read, and after it has come back empty. Two
   * different sentences on purpose: a player with forty pictures must not be
   * told for a frame that they have none. */
  galleryReading: "Reading the roll…",
  galleryEmpty: "Nothing here yet. Press ENTER during a run and the picture lands here.",
  /** The three ways a picture leaves the game, offered only where the
   * browser will actually do them (lib/share-image.ts), and the two-step
   * delete beside them — a stray press must not destroy a picture that
   * cannot be taken again, because the shore it was taken on has long since
   * been rebuilt. */
  galleryShare: "SHARE",
  galleryCopy: "COPY",
  gallerySave: "SAVE",
  galleryDelete: "DELETE",
  galleryDeleteArm: "SURE?",
  /** What each of them says afterwards. A dismissed share sheet is an
   * ordinary outcome rather than a failure, and says so. */
  galleryShareOff: "SHARE CANCELLED",
  galleryCopied: "COPIED",
  galleryCopyOff: "COPY REFUSED",
  gallerySaved: "SAVED",
  gallerySaveOff: "SAVE REFUSED",
  /** Which picture of how many, and when it was taken, in the reader's own
   * clock. */
  galleryAt: (at: number, of: number, when: string): string => `${at}/${of} · ${when}`,
  galleryPrev: "Previous screenshot",
  galleryNext: "Next screenshot",
  galleryThumb: (n: number): string => `Screenshot ${n}`,
} as const;
