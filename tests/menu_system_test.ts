// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MENU SYSTEM'S DOM-FREE HALVES — everything the shell decides before a
// browser is involved: when the attract card may take a press, where the
// cursor goes next, what a seven-second hold means, what the craft card
// bills a hull at, which surface is up and what follows from it, how a load
// is sequenced into phases, and what survives a stored settings blob.
//
// These are the payload modules the `hud-and-menus` split exists for. Each
// component next door does nothing but render what one of these returns, so
// a rule proved here is a rule the surface cannot get wrong on its own.
import { CLASS_BAND, SEASONS, TIMES_OF_DAY, WEATHER_IDS } from "@engine";
import { describe, expect, it } from "vitest";
import { CRAFT, craftById } from "@engine";

import { craftBars, craftFacts, steadiness, turnRate } from "../pwa/src/game/craft-stats.ts";
import {
  DEFAULT_KEYS,
  KEYS_PER_ACTION,
  KEY_ACTIONS,
  bindKey,
  boundLabel,
  clashesWith,
  freshKeys,
  isHeldAction,
  keyLabel,
  type KeyAction,
} from "../pwa/src/game/settings-input.ts";
import { pickNeighbour, type NavRect } from "../pwa/src/game/menu-cursor.ts";
import {
  NO_HOLD,
  holdProgress,
  releaseHold,
  takePress,
  tickHold,
} from "../pwa/src/game/menu-hold.ts";
import {
  advanceLoad,
  createLoad,
  loadBudgetMs,
  loadPhase,
  loadTimes,
  type LoadStep,
} from "../pwa/src/game/run-loader.ts";
import {
  CONDITIONS,
  CONDITION_DAY,
  DEFAULT_SETTINGS,
  DEV_HOLD_MS,
  conditionsFor,
  freshSettings,
  mergeSettings,
} from "../pwa/src/game/settings.ts";
import { WATER_PRESETS } from "../pwa/src/game/settings-video.ts";
import { SHELLS, canPause, hudOver, playerRides, simulates } from "../pwa/src/game/shell.ts";
import {
  SPLASH_MIN_MS,
  SPLASH_STUCK_MS,
  splashReady,
  splashSkipped,
} from "../pwa/src/game/splash.ts";

describe("the attract card's timing (splash.ts)", () => {
  it("holds the card for its minimum however fast the game arrives", () => {
    expect(splashReady(0, true)).toBe(false);
    expect(splashReady(SPLASH_MIN_MS - 1, true)).toBe(false);
    expect(splashReady(SPLASH_MIN_MS, true)).toBe(true);
  });

  it("WAITS FOR THE LOAD, not just for the clock — the whole point of it", () => {
    expect(splashReady(SPLASH_MIN_MS * 3, false)).toBe(false);
  });

  it("opens up anyway past the dead man's handle", () => {
    expect(splashReady(SPLASH_STUCK_MS, false)).toBe(true);
  });

  it("stands aside for a URL that names a run, and comes back when asked", () => {
    expect(splashSkipped("")).toBe(false);
    expect(splashSkipped("?seed=38")).toBe(false);
    expect(splashSkipped("?start=1")).toBe(true);
    expect(splashSkipped("?shot=1")).toBe(true);
    expect(splashSkipped("?scene=launch")).toBe(true);
    expect(splashSkipped("?splash=0")).toBe(true);
    // `?splash=1` wins over everything: it is how the card itself is looked at.
    expect(splashSkipped("?shot=1&splash=1")).toBe(false);
  });
});

describe("the craft card's spec sheet (craft-stats.ts)", () => {
  const bar = (id: string, key: string): number => {
    const found = craftBars(craftById(id)).find((b) => b.key === key);
    if (!found) throw new Error(`no ${key} bar`);
    return found.value;
  };

  it("QUOTES THE CATALOG rather than a second table beside it", () => {
    for (const spec of CRAFT) {
      const [top, sprint] = craftFacts(spec);
      expect(top.value).toBe(spec.topSpeed);
      expect(sprint.value).toBe(spec.accel0to50);
    }
  });

  it("draws four axes and no more — the card's whole budget beside the craft", () => {
    expect(craftBars(CRAFT[0]).map((b) => b.key)).toEqual(["accel", "top", "turn", "steady"]);
  });

  it("scales every bar across the ROSTER, so the best fills and the worst is not empty", () => {
    for (const key of ["accel", "top", "turn", "steady"]) {
      const values = CRAFT.map((spec) => bar(spec.id, key));
      expect(Math.max(...values)).toBeCloseTo(1, 6);
      // Never zero: an empty bar reads as a missing value, not as the
      // slowest craft on the water.
      expect(Math.min(...values)).toBeGreaterThan(0);
      expect(Math.min(...values)).toBeLessThan(1);
    }
  });

  it("bills each hull the way its own blurb does", () => {
    // The dart is the stand-up: the quickest to come round and the one that
    // will throw its rider. The otter is the touring hull: the slowest round
    // and the hardest to unsettle. A retune that swapped either pair would
    // leave four blurbs describing craft the sheet no longer shows.
    expect(turnRate(craftById("dart"))).toBeGreaterThan(turnRate(craftById("marlin")));
    expect(turnRate(craftById("otter"))).toBeLessThan(turnRate(craftById("skiff")));
    expect(steadiness(craftById("otter"))).toBeGreaterThan(steadiness(craftById("marlin")));
    expect(steadiness(craftById("dart"))).toBeLessThan(steadiness(craftById("skiff")));
    // And the marlin is the fastest thing here, which is a bar as well as a
    // sentence.
    expect(bar("marlin", "top")).toBeCloseTo(1, 6);
  });
});

describe("the hold that unlocks the developer menu (menu-hold.ts)", () => {
  const held = (fromMs: number) => ({ from: fromMs, armed: false });

  it("is nothing at all until a finger is down", () => {
    expect(holdProgress(NO_HOLD, 5_000, DEV_HOLD_MS)).toBe(0);
    expect(tickHold(NO_HOLD, 5_000, DEV_HOLD_MS)).toBe(NO_HOLD);
  });

  it("runs the fraction from nothing to full over its length", () => {
    expect(holdProgress(held(0), 0, DEV_HOLD_MS)).toBe(0);
    expect(holdProgress(held(0), DEV_HOLD_MS / 2, DEV_HOLD_MS)).toBeCloseTo(0.5, 6);
    expect(holdProgress(held(0), DEV_HOLD_MS * 2, DEV_HOLD_MS)).toBe(1);
  });

  it("arms only once the whole length has been held", () => {
    expect(tickHold(held(0), DEV_HOLD_MS - 1, DEV_HOLD_MS).armed).toBe(false);
    expect(tickHold(held(0), DEV_HOLD_MS, DEV_HOLD_MS).armed).toBe(true);
  });

  it("is SEVEN SECONDS — past anything a press or a lean does by accident", () => {
    expect(DEV_HOLD_MS).toBe(7000);
    // A press, and a finger resting on the row while its owner decides.
    expect(tickHold(held(0), 200, DEV_HOLD_MS).armed).toBe(false);
    expect(tickHold(held(0), 2_000, DEV_HOLD_MS).armed).toBe(false);
  });

  it("makes an ordinary press a press", () => {
    expect(takePress(NO_HOLD).press).toBe(true);
    expect(takePress(releaseHold(held(0))).press).toBe(true);
  });

  it("SWALLOWS the click a completed hold's own release produces", () => {
    // The rule that stops a run being started over the top of the menu the
    // player just spent seven seconds asking for.
    const armed = tickHold(held(0), DEV_HOLD_MS, DEV_HOLD_MS);
    const released = releaseHold(armed);
    expect(released.from).toBeNull();
    // ...and it is still armed here, because the click has not arrived yet.
    expect(released.armed).toBe(true);
    expect(takePress(released).press).toBe(false);
  });

  it("swallows exactly ONE click, so the row still starts a run afterwards", () => {
    // The bug this pins: an `armed` that is never spent is a START button
    // that unlocked the developer menu once and then never rode again.
    const armed = tickHold(held(0), DEV_HOLD_MS, DEV_HOLD_MS);
    const after = takePress(releaseHold(armed));
    expect(after.press).toBe(false);
    expect(takePress(after.hold).press).toBe(true);
  });

  it("holds the fraction at full once armed, whatever the clock says next", () => {
    const armed = tickHold(held(0), DEV_HOLD_MS, DEV_HOLD_MS);
    expect(holdProgress(armed, 0, DEV_HOLD_MS)).toBe(1);
    expect(tickHold(armed, DEV_HOLD_MS * 9, DEV_HOLD_MS)).toBe(armed);
  });
});

describe("where the cursor goes (menu-cursor.ts)", () => {
  /** A card of three full-width rows, top to bottom. */
  const rows: NavRect[] = [
    { x: 0, y: 0, w: 100, h: 20 },
    { x: 0, y: 30, w: 100, h: 20 },
    { x: 0, y: 60, w: 100, h: 20 },
  ];

  it("walks a column of rows the way a thumb reads it", () => {
    expect(pickNeighbour(rows, 0, "down")).toBe(1);
    expect(pickNeighbour(rows, 1, "up")).toBe(0);
  });

  it("wraps rather than stopping dead at either end", () => {
    expect(pickNeighbour(rows, 2, "down")).toBe(0);
    expect(pickNeighbour(rows, 0, "up")).toBe(2);
  });

  it("prefers the row underneath to a nearer button off to one side", () => {
    // A full-width row, then a pair side by side under it. DOWN off the row
    // must land on the pair, not walk sideways.
    const card: NavRect[] = [
      { x: 0, y: 0, w: 100, h: 20 },
      { x: 0, y: 30, w: 48, h: 20 },
      { x: 52, y: 30, w: 48, h: 20 },
    ];
    expect(pickNeighbour(card, 0, "down")).toBe(1);
    // ...and RIGHT off the left of the pair means the one beside it, even
    // though the full-width row above has its centre to the right as well.
    expect(pickNeighbour(card, 1, "right")).toBe(2);
  });

  it("lands somewhere sensible when the cursor is nowhere", () => {
    expect(pickNeighbour(rows, -1, "down")).toBe(0);
    expect(pickNeighbour([], 0, "down")).toBeNull();
  });
});

describe("which surface is up, and what follows from it (shell.ts)", () => {
  it("hands the craft to the player under a run and to the bot everywhere else", () => {
    expect(playerRides("run")).toBe(true);
    for (const shell of SHELLS.filter((s) => s !== "run")) {
      expect(playerRides(shell)).toBe(false);
    }
  });

  it("KEEPS THE SEA MOVING BEHIND EVERY CARD BUT THE PAUSE CARD", () => {
    for (const shell of SHELLS.filter((s) => s !== "pause")) expect(simulates(shell)).toBe(true);
    // The one exception, and the whole reason this module exists: the other
    // cards stand over a run nobody is riding, this one over the player's.
    expect(simulates("pause")).toBe(false);
  });

  it("keeps the readouts up under the pause card — the frozen frame IS the run", () => {
    expect(hudOver("run")).toBe(true);
    expect(hudOver("pause")).toBe(true);
    expect(hudOver("menu")).toBe(false);
    expect(hudOver("loading")).toBe(false);
    expect(hudOver("splash")).toBe(false);
  });

  it("lets the pause card be reached from a RUN and from nowhere else", () => {
    expect(canPause("run")).toBe(true);
    for (const shell of SHELLS.filter((s) => s !== "run")) expect(canPause(shell)).toBe(false);
  });
});

describe("standing a run up (run-loader.ts)", () => {
  /** A step that finishes in one call, recording that it ran. */
  const once = (id: string, label: string, ran: string[]): LoadStep => ({
    id,
    label,
    run: () => {
      ran.push(id);
      return false;
    },
  });

  it("scales the frame's budget to how long frames actually are", () => {
    // The trap this exists for: a fixed budget is most of a frame at 60 Hz
    // and one percent of one on a phone that has fallen over, so the slower
    // the device the smaller the share it would be allowed.
    expect(loadBudgetMs(16)).toBeGreaterThan(0);
    expect(loadBudgetMs(1000)).toBeGreaterThan(loadBudgetMs(16));
    // ...bounded at both ends, so neither extreme runs away.
    expect(loadBudgetMs(0)).toBe(loadBudgetMs(1));
    expect(loadBudgetMs(100_000)).toBe(loadBudgetMs(10_000));
  });

  it("runs every step, in order, and then says it is done", () => {
    const ran: string[] = [];
    const job = createLoad([
      once("level", "Building the shore", ran),
      once("scene", "Standing the world up", ran),
      once("warm", "Compiling shaders", ran),
    ]);
    let clock = 0;
    while (
      advanceLoad(
        job,
        () => true,
        () => clock++,
      )
    ) {
      /* until it is done */
    }
    expect(ran).toEqual(["level", "scene", "warm"]);
    expect(job.at).toBe(job.steps.length);
  });

  it("STOPS AT A PHASE BOUNDARY so the card can name what it is about to pay for", () => {
    const ran: string[] = [];
    const job = createLoad([
      once("a", "First", ran),
      once("b", "Second", ran),
      once("c", "Third", ran),
    ]);
    // An unlimited budget, and it still yields after the first phase.
    expect(
      advanceLoad(
        job,
        () => true,
        () => 0,
      ),
    ).toBe(true);
    expect(ran).toEqual(["a"]);
  });

  it("counts PHASES, not steps: neighbours sharing a label are one slot", () => {
    const ran: string[] = [];
    const job = createLoad([
      once("a", "Building", ran),
      once("b", "Building", ran),
      once("c", "Compiling", ran),
    ]);
    const phase = loadPhase(job);
    expect(phase.of).toBe(2);
    expect(phase.at).toBe(1);
    expect(phase.label).toBe("Building");
  });

  it("holds the count at the last phase once done, never `(3/2)`", () => {
    const ran: string[] = [];
    const job = createLoad([once("a", "Building", ran), once("b", "Compiling", ran)]);
    while (
      advanceLoad(
        job,
        () => true,
        () => 0,
      )
    ) {
      /* to the end */
    }
    const phase = loadPhase(job);
    expect(phase.at).toBe(phase.of);
  });

  it("offers a MEASURED fill only where a step can count itself", () => {
    const ran: string[] = [];
    const blind = createLoad([once("a", "Building", ran)]);
    expect(loadPhase(blind).done).toBeNull();

    const counted = createLoad([
      { id: "a", label: "Building", progress: () => 0.4, run: () => true },
    ]);
    expect(loadPhase(counted).done).toBeCloseTo(0.4, 6);
  });

  it("estimates a phase off last time's clock, or admits it cannot", () => {
    const ran: string[] = [];
    const steps = [once("a", "Building", ran), once("b", "Building", ran)];
    expect(loadPhase(createLoad(steps)).expectedMs).toBeNull();
    // All of a phase's steps or none — a half-known phase would run its bar
    // against a fraction of the work.
    expect(loadPhase(createLoad(steps, { a: 100 })).expectedMs).toBeNull();
    expect(loadPhase(createLoad(steps, { a: 100, b: 50 })).expectedMs).toBe(150);
  });

  it("keeps times off a load that RAN TO THE END, and off no other", () => {
    const ran: string[] = [];
    const job = createLoad([once("a", "Building", ran), once("b", "Compiling", ran)]);
    advanceLoad(
      job,
      () => true,
      () => 0,
    );
    // Abandoned part-way: half a step's cost would tell the next card the
    // work takes half as long as it does.
    expect(loadTimes(job)).toEqual({});
    while (
      advanceLoad(
        job,
        () => true,
        () => 0,
      )
    ) {
      /* to the end */
    }
    expect(Object.keys(loadTimes(job)).sort()).toEqual(["a", "b"]);
  });
});

describe("the wind a seed deals, as one of the card's three rungs (conditionsFor)", () => {
  it("names the rung a wind is standing exactly on", () => {
    for (const rung of CONDITIONS) expect(conditionsFor(CONDITION_DAY[rung].wind)).toBe(rung);
  });

  it("names the nearest rung for the winds R12 actually deals", () => {
    // No seed lands on a rung: R12 grows a level's wind inside its own band,
    // so the chip the start card marks is the one whose sea is closest to
    // the sea the level has.
    expect(conditionsFor(6)).toBe("fine");
    expect(conditionsFor(9)).toBe("windy");
    expect(conditionsFor(14)).toBe("windy");
    expect(conditionsFor(25)).toBe("storm");
    // Exactly between two rungs the calmer one takes it, which is the rung
    // whose wind the sea is more likely to be under.
    expect(conditionsFor(8)).toBe("fine");
  });

  it("leaves no wind with nothing marked", () => {
    // The row always has a chip to stand on: a mark that vanished on some
    // seeds would read as a broken row rather than as an unusual wind.
    for (let ms = 0; ms <= 40; ms += 0.5) expect(CONDITIONS).toContain(conditionsFor(ms));
  });
});

describe("what survives a stored settings blob (settings.ts)", () => {
  it("gives a first visit the defaults, sharing no reference with them", () => {
    const fresh = freshSettings();
    expect(fresh).toEqual(DEFAULT_SETTINGS);
    fresh.ride.craft = "dart";
    expect(DEFAULT_SETTINGS.ride.craft).toBe("skiff");
    expect(mergeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(mergeSettings("not a blob")).toEqual(DEFAULT_SETTINGS);
  });

  it("takes a CLASS the build still offers and refuses one it does not", () => {
    // The same rule every picture row is held to: a rung that has been
    // retuned or dropped is one the craft card could not put the cursor
    // back on, so a stored blob naming it rides stock instead.
    for (const k of CLASS_BAND) {
      expect(mergeSettings({ ride: { speedClass: k } }).ride.speedClass).toBe(k);
    }
    for (const bad of [0, -1, 3, "1.25", null]) {
      expect(mergeSettings({ ride: { speedClass: bad } }).ride.speedClass).toBe(1);
    }
  });

  it("keeps the choices a build still offers", () => {
    const stored = mergeSettings({
      ride: {
        craft: "dart",
        camera: "nose",
        seed: 12,
        time: "sunset",
        conditions: "storm",
        weather: "rain",
      },
      hud: { on: false },
    });
    expect(stored.ride).toEqual({
      craft: "dart",
      camera: "nose",
      seed: 12,
      time: "sunset",
      // Not in the blob, so the shore's own — a blob from before the row
      // existed keeps riding the season it was dealt.
      season: null,
      conditions: "storm",
      weather: "rain",
      // ...and the same for the CLASS: a blob from before it existed rides
      // stock, which is the roster the catalog tunes.
      speedClass: 1,
    });
    expect(stored.hud.on).toBe(false);
  });

  it("takes a TIME off the engine's own ladder, and only off it", () => {
    // The start card's TIME row: R13's hours, checked against the engine
    // rather than a copy, so a rung added there is a rung this build stores
    // the same day — NIGHT was, and a blob carrying it has to survive.
    for (const time of TIMES_OF_DAY) {
      expect(mergeSettings({ ride: { time } }).ride.time).toBe(time);
    }
    expect(mergeSettings({ ride: { time: "dusk" } }).ride.time).toBeNull();
  });

  it("takes a SEASON off the engine's own four, and only off them", () => {
    for (const season of SEASONS) {
      expect(mergeSettings({ ride: { season } }).ride.season).toBe(season);
    }
    expect(mergeSettings({ ride: { season: "monsoon" } }).ride.season).toBeNull();
  });

  it("takes a SKY off the engine's own ladder, and only off it", () => {
    // The start card's WEATHER row: R19's five, checked against the engine
    // rather than a copy, so a sky the generator stops dealing is a sky this
    // build stops carrying.
    for (const weather of WEATHER_IDS) {
      expect(mergeSettings({ ride: { weather } }).ride.weather).toBe(weather);
    }
    expect(mergeSettings({ ride: { weather: "sleet" } }).ride.weather).toBeNull();
    expect(mergeSettings({ ride: { weather: 3 } }).ride.weather).toBeNull();
  });

  it("keeps the WIND and the SKY as separate answers", () => {
    // They were one row once. The split is only worth having if a stored
    // blob can carry a sky that does NOT belong over its wind — a downpour
    // over a calm morning is the ride the bundle could not ask for.
    const stored = mergeSettings({ ride: { conditions: "fine", weather: "rain" } });
    expect(stored.ride.conditions).toBe("fine");
    expect(stored.ride.weather).toBe("rain");
    // …and a wind with no sky beside it still leaves the sky to the wind:
    // null here is what `App.tsx` reads as "the one CONDITION_DAY implies".
    expect(mergeSettings({ ride: { conditions: "storm" } }).ride.weather).toBeNull();
  });

  it("keeps the START CARD's rows for a player who never found the developer menu", () => {
    // The seed moved out of `dev` and onto `ride` when the start card began
    // asking for it. A blob that still carried it under `dev` must not
    // resurrect it there, and the ride's own rows must survive without the
    // developer flag — they are a player's choices, not a tool.
    const stored = mergeSettings({ ride: { seed: 7, conditions: "fine" }, dev: { seed: 999 } });
    expect(stored.ride.seed).toBe(7);
    expect(stored.ride.conditions).toBe("fine");
    expect(stored.developer).toBe(false);
    expect(stored.dev).toEqual(DEFAULT_SETTINGS.dev);
  });

  it("DROPS a value this build no longer offers rather than carrying it", () => {
    // The rule the field-by-field merge exists for: a value off the ladder is
    // one the menu has no chip to put the cursor back on.
    const stored = mergeSettings({
      ride: {
        craft: "hovercraft",
        camera: "orbit",
        time: "midnight",
        conditions: "drizzle",
        weather: "fog",
      },
    });
    expect(stored.ride).toEqual(DEFAULT_SETTINGS.ride);
    expect(mergeSettings({ ride: { seed: -4 } }).ride.seed).toBeNull();
    expect(mergeSettings({ ride: { seed: 2.5 } }).ride.seed).toBeNull();
    expect(mergeSettings({ developer: true, dev: { scene: "moonwalk" } }).dev.scene).toBeNull();
    expect(mergeSettings({ developer: true, dev: { wind: 900 } }).dev.wind).toBeNull();
    expect(mergeSettings({ developer: true, dev: { hs: 900 } }).dev.hs).toBeNull();
  });

  it("keeps a picture the rider chose", () => {
    const stored = mergeSettings({
      hud: { on: true, fps: true },
      video: {
        water: "high",
        resolution: "low",
        seeThrough: false,
        fauna: false,
        flora: "sparse",
      },
    });
    expect(stored.hud.fps).toBe(true);
    expect(stored.video).toEqual({
      water: "high",
      resolution: "low",
      seeThrough: false,
      fauna: false,
      flora: "sparse",
      // A row the stored blob has never heard of — this one was written
      // before the sky, the rain and the draw distance were levers — comes
      // back at THIS build's default rather than off, so an old blob is a
      // picture with a row added to it and not a picture with a row missing.
      sky: DEFAULT_SETTINGS.video.sky,
      rain: DEFAULT_SETTINGS.video.rain,
      distance: DEFAULT_SETTINGS.video.distance,
      frameRate: DEFAULT_SETTINGS.video.frameRate,
      // The four the WATER stop expands into are the stop's, not the blob's:
      // `water: "high"` is a high sea in every part of itself.
      ...WATER_PRESETS.high,
    });
  });

  it("expands the WATER stop over anything the blob stored beside it", () => {
    // THE DECOUPLING, held at the door. A blob from the build where the
    // spray, the wake, the splash and the mirror hung off DETAIL carries them
    // at DETAIL's stop; honouring one would leave a sharp mirror on a sea the
    // rider asked to be cheap, which is the fault the row was moved to end.
    const stale = mergeSettings({
      video: { water: "low", spray: "full", wake: "full", splash: "full", reflections: "sharp" },
    });
    expect(stale.video.water).toBe("low");
    for (const [key, value] of Object.entries(WATER_PRESETS.low)) {
      expect(stale.video[key as keyof typeof stale.video]).toBe(value);
    }
    // ...and the levers around the water are untouched by it.
    expect(stale.video.flora).toBe(DEFAULT_SETTINGS.video.flora);
    expect(stale.video.sky).toBe(DEFAULT_SETTINGS.video.sky);
  });

  it("keeps a frame-rate cap the rider set and drops one this build does not offer", () => {
    expect(mergeSettings({ video: { frameRate: "30" } }).video.frameRate).toBe("30");
    expect(mergeSettings({ video: { frameRate: 30 } }).video.frameRate).toBe(
      DEFAULT_SETTINGS.video.frameRate,
    );
    expect(mergeSettings({ video: { frameRate: "144" } }).video.frameRate).toBe(
      DEFAULT_SETTINGS.video.frameRate,
    );
  });

  it("drops a picture stop this build no longer has, one row at a time", () => {
    // A stop off the ladder is a chip the options page cannot put the cursor
    // back on — but only THAT row falls back, or a renamed stop would take a
    // rider's whole picture with it.
    const stored = mergeSettings({
      video: {
        water: "ultra",
        resolution: "high",
        sky: "low",
        flora: "jungle",
        distance: "low",
        rain: "sometimes",
      },
    });
    expect(stored.video.water).toBe(DEFAULT_SETTINGS.video.water);
    expect(stored.video.flora).toBe(DEFAULT_SETTINGS.video.flora);
    expect(stored.video.resolution).toBe("high");
    expect(stored.video.sky).toBe("low");
    expect(stored.video.distance).toBe("low");
    expect(stored.video.rain).toBe(DEFAULT_SETTINGS.video.rain);
  });

  it("takes no opinion from a blob written before the picture had rows", () => {
    expect(mergeSettings({ hud: { on: false } }).video).toEqual(DEFAULT_SETTINGS.video);
    expect(mergeSettings({ hud: { on: false } }).hud.fps).toBe(false);
    expect(mergeSettings({ video: "high" }).video).toEqual(DEFAULT_SETTINGS.video);
  });

  it("carries the motor's switch, and defaults it ON where there is a motor", () => {
    // Stored either way, on every machine: a phone and the laptop beside it
    // read one blob, and a laptop dropping the field would switch the phone's
    // vibration off the next time it synced. Whether the ROW is offered is a
    // question about the device (`haptics.ts`), never about the blob.
    expect(DEFAULT_SETTINGS.rumble).toBe(true);
    expect(mergeSettings({ rumble: false }).rumble).toBe(false);
    expect(mergeSettings({ rumble: "off" }).rumble).toBe(true);
    expect(mergeSettings({ hud: { on: false } }).rumble).toBe(true);
  });

  it("remembers that the machine has been measured, and reads an old blob as unmeasured", () => {
    // Whichever way the first-visit probe went, it went once; a blob from a
    // build before it existed is measured on its next visit, which is safe
    // because the promotion only touches an untouched picture.
    expect(DEFAULT_SETTINGS.probed).toBe(false);
    expect(mergeSettings({ probed: true }).probed).toBe(true);
    expect(mergeSettings({ probed: "yes" }).probed).toBe(false);
    expect(mergeSettings({ hud: { on: false } }).probed).toBe(false);
    expect(freshSettings().probed).toBe(false);
  });

  it("keeps the developer menu OUT once it has been let out", () => {
    expect(mergeSettings({ developer: true }).developer).toBe(true);
  });

  it("clears every developer tool for anyone who never found the menu", () => {
    // A tool nobody can reach is a tool nobody can switch off.
    const sneaked = mergeSettings({ dev: { cost: true, scene: "dive" } });
    expect(sneaked.developer).toBe(false);
    expect(sneaked.dev).toEqual(DEFAULT_SETTINGS.dev);
  });

  it("carries a developer's own settings once the menu is out", () => {
    const dev = mergeSettings({
      developer: true,
      dev: { wind: 14, hs: 3, scene: "dive", cost: true },
    });
    expect(dev.dev).toEqual({ wind: 14, hs: 3, scene: "dive", cost: true });
  });

  it("ignores settings a build has dropped, rather than choking on them", () => {
    const old = mergeSettings({ gearbox: "manual", audio: { music: 0.5 }, hud: { on: true } });
    expect(old).toEqual(DEFAULT_SETTINGS);
  });
});

describe("the key bindings", () => {
  const ACTIONS = Object.keys(DEFAULT_KEYS) as KeyAction[];

  it("prints every action the game has, once", () => {
    // The page is a hand-written ORDER over a table the type system checks,
    // so this is the one thing that can drift: an action added to the
    // bindings and not to the list would be a key nobody could rebind, and
    // the compiler would say nothing.
    const printed = KEY_ACTIONS.map((entry) => entry.id);
    expect([...printed].sort()).toEqual([...ACTIONS].sort());
    expect(new Set(printed).size).toBe(printed.length);
    for (const entry of KEY_ACTIONS) expect(entry.label).not.toBe("");
  });

  it("ships S on the brake and leaves the arrow cluster the handlebar", () => {
    // The left hand gets the driving set — W throttle, S brake and reverse,
    // A D steer — and the arrows stay the rider's body: ↓ leans back, and
    // the brake is NOT on it.
    expect(DEFAULT_KEYS.throttle).toContain("KeyW");
    expect(DEFAULT_KEYS.reverse).toContain("KeyS");
    expect(DEFAULT_KEYS.reverse).toContain("Space");
    expect(DEFAULT_KEYS.leanBack).toEqual(["ArrowDown"]);
    expect(DEFAULT_KEYS.leanBack).not.toContain("KeyS");
  });

  it("ships no key on two actions at once", () => {
    for (const action of ACTIONS) expect(clashesWith(DEFAULT_KEYS, action)).toEqual([]);
  });

  it("knows which actions are HELD and which happen on the press", () => {
    expect(isHeldAction("throttle")).toBe(true);
    expect(isHeldAction("reverse")).toBe(true);
    expect(isHeldAction("leanForward")).toBe(true);
    expect(isHeldAction("reset")).toBe(false);
    expect(isHeldAction("camera")).toBe(false);
    expect(isHeldAction("pause")).toBe(false);
  });

  it("reads a key code the way it is printed on the cap", () => {
    expect(keyLabel("KeyS")).toBe("S");
    expect(keyLabel("Space")).toBe("SPACE");
    expect(keyLabel("ArrowDown")).toBe("DOWN ARROW");
    expect(keyLabel("ShiftLeft")).toBe("L SHIFT");
    expect(keyLabel("Digit4")).toBe("4");
    expect(keyLabel("Numpad7")).toBe("NUM 7");
    expect(keyLabel("Enter")).toBe("ENTER");
    expect(boundLabel(["KeyS", "Space"])).toBe("S / SPACE");
    expect(boundLabel([])).not.toBe("");
  });

  it("replaces a whole binding with the one key pressed, and touches nothing else", () => {
    const bound = bindKey(DEFAULT_KEYS, "reverse", "KeyB");
    expect(bound.reverse).toEqual(["KeyB"]);
    expect(bound.throttle).toEqual(DEFAULT_KEYS.throttle);
    // The defaults are not the rider's to rebind.
    expect(DEFAULT_KEYS.reverse).toContain("KeyS");
  });

  it("says when a key is doing two jobs", () => {
    const shared = bindKey(DEFAULT_KEYS, "reset", "KeyW");
    expect(clashesWith(shared, "reset")).toEqual(["throttle"]);
    expect(clashesWith(shared, "throttle")).toEqual(["reset"]);
    expect(clashesWith(shared, "camera")).toEqual([]);
    // An action with no key on it clashes with nothing, however many other
    // actions are also unbound.
    const none = { ...shared, camera: [], pause: [] };
    expect(clashesWith(none, "camera")).toEqual([]);
  });

  it("hands out bindings nothing else holds a reference to", () => {
    const fresh = freshKeys();
    expect(fresh).toEqual(DEFAULT_KEYS);
    for (const action of ACTIONS) expect(fresh[action]).not.toBe(DEFAULT_KEYS[action]);
    expect(freshSettings().keys.reverse).not.toBe(DEFAULT_KEYS.reverse);
  });

  it("keeps a rider's own keys across a visit, and drops what this build cannot use", () => {
    const stored = mergeSettings({
      keys: {
        reverse: ["KeyB"],
        // An action this build does not have, a code that is not a string,
        // one that is empty, and a list longer than any keyboard needs.
        handbrake: ["KeyH"],
        camera: ["KeyV", 7, "", "KeyN"],
        restart: ["KeyP", "KeyP", "KeyO", "KeyI", "KeyU", "KeyY"],
        left: "KeyJ",
      },
    });
    expect(stored.keys.reverse).toEqual(["KeyB"]);
    expect(stored.keys.camera).toEqual(["KeyV", "KeyN"]);
    expect(stored.keys.restart).toHaveLength(KEYS_PER_ACTION);
    expect(stored.keys.restart).toEqual(["KeyP", "KeyO", "KeyI", "KeyU"]);
    // Not an array, so the row keeps the key it shipped with.
    expect(stored.keys.left).toEqual(DEFAULT_KEYS.left);
    expect("handbrake" in stored.keys).toBe(false);
    // Everything the blob said nothing about is the shipped layout.
    expect(stored.keys.throttle).toEqual(DEFAULT_KEYS.throttle);
  });

  it("lets a rider unbind an action, and reads a blob that is not bindings at all", () => {
    // An empty list is a choice — an action a rider wants no key on — and
    // the manager simply never presses it.
    expect(mergeSettings({ keys: { restart: [] } }).keys.restart).toEqual([]);
    expect(mergeSettings({ keys: "wasd" }).keys).toEqual(DEFAULT_KEYS);
    expect(mergeSettings({ hud: { on: false } }).keys).toEqual(DEFAULT_KEYS);
  });
});
