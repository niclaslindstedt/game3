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
//
// ...and one thing that is not DOM-free at all: the run a card actually
// stands up. The three measured modes ride one of the campaign's PINNED
// shores rather than a seed, and the only honest test of that is to build
// one and look at what came out — which is why the last block in this file
// generates levels and the rest of it does not.
import {
  BIOME_IDS,
  CLASS_BAND,
  GAME_MODES,
  SEASONS,
  SWELL_DIAL,
  TIMES_OF_DAY,
  WEATHER_IDS,
} from "@engine";
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
import { NO_HOLD, releaseHold, takePress, tickHold } from "../pwa/src/game/menu-hold.ts";
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
  TRICK_MINUTES,
  conditionsFor,
  seaRungFor,
  SEA_METRES,
  SEA_STATES,
  freshSettings,
  mergeSettings,
  saveSettings,
} from "../pwa/src/game/settings.ts";
import { WATER_PRESETS } from "../pwa/src/game/settings-video.ts";
import { CAMPAIGN_LEVELS, shoreOf } from "../pwa/src/game/campaign.ts";
import { gameFor, pinnedFor, recordKeyFor } from "../pwa/src/game/new-game.ts";
import { readParams, settingsFor } from "../pwa/src/game/url-params.ts";
import {
  SHELLS,
  appDraws,
  canPause,
  hudOver,
  playerRides,
  simulates,
  soundsLive,
  watching,
} from "../pwa/src/game/shell.ts";
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
    expect(tickHold(NO_HOLD, 5_000, DEV_HOLD_MS)).toBe(NO_HOLD);
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

  it("stays armed whatever the clock says next, and re-renders nothing", () => {
    const armed = tickHold(held(0), DEV_HOLD_MS, DEV_HOLD_MS);
    // The SAME object back, which is how the component tells 'nothing
    // happened' from 'it fired' without a second piece of state.
    expect(tickHold(armed, DEV_HOLD_MS * 9, DEV_HOLD_MS)).toBe(armed);
    expect(tickHold(held(0), DEV_HOLD_MS - 1, DEV_HOLD_MS)).toEqual(held(0));
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
    for (const shell of SHELLS.filter((s) => s !== "pause" && s !== "bench")) {
      expect(simulates(shell)).toBe(true);
    }
    // The one exception, and the whole reason this module exists: the other
    // cards stand over a run nobody is riding, this one over the player's.
    expect(simulates("pause")).toBe(false);
  });

  it("leaves the canvas to the benchmark, which pumps its own frames", () => {
    // TWO DIFFERENT NOES. The pause card stops the clock and keeps drawing;
    // the bench stops neither — somebody else is turning the water, and a
    // frame the app drew between two of the benchmark's own is time the
    // measurement is charged for and did not spend.
    expect(simulates("bench")).toBe(false);
    expect(appDraws("bench")).toBe(false);
    for (const shell of SHELLS.filter((s) => s !== "bench")) expect(appDraws(shell)).toBe(true);
    expect(appDraws("pause")).toBe(true);
    // And nothing about a benchmark is a run: no hands on the craft, no
    // readouts over it, no card to pause it with.
    expect(playerRides("bench")).toBe(false);
    expect(hudOver("bench")).toBe(false);
    expect(canPause("bench")).toBe(false);
  });

  it("keeps the readouts up under the pause card — the frozen frame IS the run", () => {
    expect(hudOver("run")).toBe(true);
    expect(hudOver("pause")).toBe(true);
    expect(hudOver("menu")).toBe(false);
    expect(hudOver("loading")).toBe(false);
    expect(hudOver("splash")).toBe(false);
    expect(hudOver("bench")).toBe(false);
  });

  it("lets the pause card be reached from a RUN and from nowhere else", () => {
    expect(canPause("run")).toBe(true);
    for (const shell of SHELLS.filter((s) => s !== "run")) expect(canPause(shell)).toBe(false);
  });

  it("makes a RECORDING a run nobody is riding rather than a flag on one", () => {
    // The whole of what the surface means (`replay.ts`): the engine steps,
    // the app draws and the readouts are over it — they are reading the
    // recording, and the recording IS the run — while nobody's hands are on
    // the craft and the pause card is not offered, because a recording has
    // nothing to lose by being left.
    expect(watching("replay")).toBe(true);
    for (const shell of SHELLS.filter((s) => s !== "replay")) expect(watching(shell)).toBe(false);
    expect(simulates("replay")).toBe(true);
    expect(appDraws("replay")).toBe(true);
    expect(hudOver("replay")).toBe(true);
    expect(playerRides("replay")).toBe(false);
    expect(canPause("replay")).toBe(false);
  });

  it("gives the full mix to a run being RIDDEN and to one being WATCHED, and ducks the rest", () => {
    // Not the opposite of `playerRides`: nobody is riding a replay and yet
    // everything a player would hear is still on — it is the run, an hour
    // later. Every card is the game talking over the sea instead.
    expect(soundsLive("run")).toBe(true);
    expect(soundsLive("replay")).toBe(true);
    for (const shell of SHELLS.filter((s) => s !== "run" && s !== "replay")) {
      expect(soundsLive(shell)).toBe(false);
    }
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

  // THE FAULT THIS EXISTS FOR: the generator refuses a seed it cannot build a
  // clean coast on, by THROWING out of `generateLevel` — and the load runs
  // inside a frame, where the next frame is already booked. An exception let
  // out of here is thrown again every frame from then on, against a card
  // whose mark is a compositor transform and so keeps turning: the game
  // reads as "still loading" forever, with no way off it.
  it("ABANDONS the load when a step throws, rather than letting it out", () => {
    const ran: string[] = [];
    const job = createLoad([
      {
        id: "level",
        label: "Building the shore",
        run: () => {
          throw new Error("level generation failed for seed 42 after 24 attempts");
        },
      },
      once("scene", "Standing the world up", ran),
    ]);
    expect(() =>
      advanceLoad(
        job,
        () => true,
        () => 0,
      ),
    ).not.toThrow();
    expect(job.failed).toContain("seed 42");
    // Done, so the caller's one question — "is there more?" — stays one
    // question, and the steps after the failure never run over a world that
    // was never built.
    expect(
      advanceLoad(
        job,
        () => true,
        () => 0,
      ),
    ).toBe(false);
    expect(ran).toEqual([]);
    // A failed load is abandoned part-way whatever its step counter reads, so
    // its costs must not become the next card's estimate.
    expect(loadTimes(job)).toEqual({});
  });

  it("carries a non-Error throw through as words too", () => {
    const job = createLoad([
      {
        id: "level",
        label: "Building the shore",
        run: () => {
          throw "no coast";
        },
      },
    ]);
    advanceLoad(
      job,
      () => true,
      () => 0,
    );
    expect(job.failed).toBe("no coast");
  });

  it("says nothing failed on a load that simply finished", () => {
    const ran: string[] = [];
    const job = createLoad([once("a", "Building", ran)]);
    advanceLoad(
      job,
      () => true,
      () => 0,
    );
    expect(job.failed).toBeNull();
  });
});

describe("the wind a level was dealt, as one of the scale's three rungs (conditionsFor)", () => {
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

  it("leaves no wind with no word for it", () => {
    // Every wind has a rung: a box whose day line lost a word on some seeds
    // would read as a broken card rather than as an unusual wind.
    for (let ms = 0; ms <= 40; ms += 0.5) expect(CONDITIONS).toContain(conditionsFor(ms));
  });
});

describe("R36 — a swell as a rung of the Douglas scale (seaRungFor)", () => {
  it("is exactly the dial the engine offers, end to end", () => {
    // The scale and R36's band are one thing quoted twice: the ladder may
    // not stop short of a sea the generator can deal, and FREE's fader runs
    // the whole of it.
    expect(SEA_METRES[0]).toBe(SWELL_DIAL.min);
    expect(SEA_METRES[SEA_METRES.length - 1]).toBe(SWELL_DIAL.max);
    expect([...SEA_METRES]).toEqual([...SEA_METRES].sort((a, b) => a - b));
    expect(new Set(SEA_METRES).size).toBe(SEA_METRES.length);
  });

  it("names the rung a swell is standing exactly on", () => {
    for (const rung of SEA_STATES) expect(seaRungFor(rung.hs)).toBe(rung.id);
  });

  it("puts a dealt height in its own BAND, not at the nearest rung", () => {
    // The rungs ARE the Douglas scale's bands, so a 3.2 m sea is a ROUGH
    // one and there is nothing to decide — where the WIND scale, whose
    // rungs are three winds somebody picked, has to take the nearest.
    expect(seaRungFor(1)).toBe("slight");
    expect(seaRungFor(1.01)).toBe("moderate");
    expect(seaRungFor(3.2)).toBe("rough");
    expect(seaRungFor(8.9)).toBe("high");
    expect(seaRungFor(9.1)).toBe("veryHigh");
  });

  it("leaves no swell with no word for it", () => {
    // Every height has a rung — including under the dial's floor and over
    // its ceiling, which the generator cannot deal but a stored blob or a
    // link could still carry.
    const ids = SEA_STATES.map((rung) => rung.id);
    for (let hs = 0; hs <= 30; hs += 0.25) expect(ids).toContain(seaRungFor(hs));
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

  it("takes a MODE off the engine's list and a tricks LENGTH off its ladder, and nothing else", () => {
    for (const mode of GAME_MODES) expect(mergeSettings({ ride: { mode } }).ride.mode).toBe(mode);
    expect(mergeSettings({ ride: { mode: "campaign" } }).ride.mode).toBe("race");
    expect(mergeSettings({ ride: { mode: 2 } }).ride.mode).toBe("race");
    for (const m of TRICK_MINUTES) {
      expect(mergeSettings({ ride: { tricksMinutes: m } }).ride.tricksMinutes).toBe(m);
    }
    expect(mergeSettings({ ride: { tricksMinutes: 3 } }).ride.tricksMinutes).toBe(2);
    expect(mergeSettings({ ride: { tricksMinutes: "4" } }).ride.tricksMinutes).toBe(2);
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
        wind: 20,
        weather: "rain",
      },
      hud: { on: false },
    });
    expect(stored.ride).toEqual({
      // Not in the blob either: the mode and the tricks run's length a
      // blob from before the start card asked them rides at the defaults.
      mode: "race",
      tricksMinutes: 2,
      biome: "taiga",
      craft: "dart",
      camera: "nose",
      // Not in the blob: a blob from before the measured modes rode the
      // campaign's pinned shores names no level, which is the seed row's
      // own shore and every lab's link.
      level: null,
      seed: 12,
      time: "sunset",
      // Not in the blob, so the shore's own — a blob from before the row
      // existed keeps riding the season it was dealt.
      season: null,
      wind: 20,
      // ...and FREE's own row, which no other card writes: a blob that has
      // never been on a free ride rides the quarter R12 dealt.
      windQuarter: null,
      // ...and the same for R36's WAVES row: a blob from before it existed
      // rides the swell its shore was dealt.
      swell: null,
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

  it("keeps a coast this build has BUILT, and falls back to the first for any other", () => {
    for (const biome of BIOME_IDS) {
      expect(mergeSettings({ ride: { biome } }).ride.biome).toBe(biome);
    }
    // A reserved id with no row is a level that throws on load, so it is
    // not a setting; nor is a word the engine has never heard.
    expect(mergeSettings({ ride: { biome: "atoll" } }).ride.biome).toBe(BIOME_IDS[0]);
    expect(mergeSettings({ ride: { biome: "tundra" } }).ride.biome).toBe(BIOME_IDS[0]);
    expect(mergeSettings({ ride: { biome: 7 } }).ride.biome).toBe(BIOME_IDS[0]);
    expect(DEFAULT_SETTINGS.ride.biome).toBe("taiga");
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
    const stored = mergeSettings({ ride: { wind: 4, weather: "rain" } });
    expect(stored.ride.wind).toBe(4);
    expect(stored.ride.weather).toBe("rain");
    // …and a wind with no sky beside it still leaves the sky to the wind:
    // null here is what `new-game.ts` reads as "the one `skyForWind` implies".
    expect(mergeSettings({ ride: { wind: 20 } }).ride.weather).toBeNull();
  });

  it("carries a WIND, a QUARTER and a SEA anywhere on the travel a free ride offers", () => {
    // The three rows a FREE ride turns into faders write the same fields the
    // worded card's ladders do, so the merge checks a RANGE rather than a
    // list: a figure between two rungs is a free ride's answer, not a corrupt
    // blob. The measured modes put it back on their own ladder when the run
    // is stood up (`new-game.ts`), which is why the stored figure may stand
    // anywhere.
    const stored = mergeSettings({ ride: { wind: 33, windQuarter: -135, swell: 7.5 } });
    expect(stored.ride.wind).toBe(33);
    expect(stored.ride.windQuarter).toBe(-135);
    expect(stored.ride.swell).toBe(7.5);
  });

  it("DROPS a wind, a quarter or a sea off the end of its own travel", () => {
    // A figure past the fader's end is one no row could put the thumb back
    // on — the same rule every ladder row is merged by.
    expect(mergeSettings({ ride: { wind: 400 } }).ride.wind).toBeNull();
    expect(mergeSettings({ ride: { wind: -1 } }).ride.wind).toBeNull();
    expect(mergeSettings({ ride: { windQuarter: 270 } }).ride.windQuarter).toBeNull();
    // The sea's ends are the ENGINE's, so a height the generator would clamp
    // is one this card never offers.
    expect(mergeSettings({ ride: { swell: SWELL_DIAL.max + 1 } }).ride.swell).toBeNull();
    expect(mergeSettings({ ride: { swell: SWELL_DIAL.min - 0.5 } }).ride.swell).toBeNull();
    // ...and a blob from the build before the fold, whose wind was a WORD.
    expect(mergeSettings({ ride: { wind: "storm" } }).ride.wind).toBeNull();
  });

  it("keeps the START CARD's rows for a player who never found the developer menu", () => {
    // The seed moved out of `dev` and onto `ride` when the start card began
    // asking for it. A blob that still carried it under `dev` must not
    // resurrect it there, and the ride's own rows must survive without the
    // developer flag — they are a player's choices, not a tool.
    const stored = mergeSettings({ ride: { seed: 7, wind: 4 }, dev: { seed: 999 } });
    expect(stored.ride.seed).toBe(7);
    expect(stored.ride.wind).toBe(4);
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

  it("lets the developer menu out with a link that names one of its pages", () => {
    // A URL naming a page behind the seven-second hold has, by definition,
    // found it — and a lab that landed on a page with the menu still locked
    // would photograph a card with no way back to the front door.
    for (const page of ["developer", "unlocks", "benchHistory"] as const) {
      const laid = settingsFor(DEFAULT_SETTINGS, readParams(`?menu=${page}`));
      expect(readParams(`?menu=${page}`).menu).toEqual({ page });
      expect(laid.developer).toBe(true);
    }
    // ...and a page a player can reach on their own does not.
    expect(settingsFor(DEFAULT_SETTINGS, readParams("?menu=options")).developer).toBe(false);
    expect(readParams("?menu=nowhere").menu).toBeNull();
  });

  it("clears every developer tool for anyone who never found the menu", () => {
    // A tool nobody can reach is a tool nobody can switch off.
    const sneaked = mergeSettings({ dev: { cost: true, scene: "dive" } });
    expect(sneaked.developer).toBe(false);
    expect(sneaked.dev).toEqual(DEFAULT_SETTINGS.dev);
  });

  it("remembers a developer's TOGGLE and never their OVERRIDES", () => {
    // The rule, stated once: a row with a knob on the page to switch it off
    // is a preference and is kept; a row only a URL can set, that silently
    // rewrites every run and that no card can clear, is not.
    const dev = mergeSettings({
      developer: true,
      dev: { wind: 14, hs: 3, scene: "dive", cost: true },
    });
    expect(dev.dev).toEqual({ wind: null, hs: null, scene: null, cost: true });
  });

  it("never reads a developer's OVERRIDES out of the store, and never writes them in", () => {
    // Each of the three rewrites every run that follows — a scene STAGES it
    // (and `placeRun` takes the lights off in front of it), a wind or a sea
    // replaces the day the generator dealt — and each one also stops the
    // finish being written down. None has a row on any card to clear it, so
    // kept, a rider who picked one up from a link had no way back: every ride
    // re-staged, and the game silent at the end of all of them.
    for (const [row, value] of Object.entries({ scene: "cruise", wind: 14, hs: 3 })) {
      const back = mergeSettings({ developer: true, dev: { [row]: value } }).dev;
      expect(back[row as "scene" | "wind" | "hs"]).toBeNull();
    }
    const saved: Record<string, string> = {};
    const store = globalThis as unknown as { localStorage?: unknown };
    const had = "localStorage" in store;
    store.localStorage = {
      setItem: (k: string, v: string) => {
        saved[k] = v;
      },
    };
    try {
      saveSettings({
        ...DEFAULT_SETTINGS,
        developer: true,
        dev: { scene: "cruise", wind: 14, hs: 3, cost: true },
      });
    } finally {
      if (!had) delete store.localStorage;
    }
    const blob = JSON.parse(Object.values(saved)[0]!) as {
      dev: { scene: unknown; wind: unknown; hs: unknown; cost: unknown };
    };
    expect(blob.dev.scene).toBeNull();
    expect(blob.dev.wind).toBeNull();
    expect(blob.dev.hs).toBeNull();
    // ...and the TOGGLE is still written down.
    expect(blob.dev.cost).toBe(true);
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

  it("keeps SHIFT for the tuck alone, with the lean it displaced on Q", () => {
    // A rider holding himself down behind the bars must not also be pushing
    // the nose down, so the two never share a key.
    expect(DEFAULT_KEYS.crouch).toEqual(["ShiftLeft", "ShiftRight"]);
    expect(DEFAULT_KEYS.leanForward).toEqual(["KeyQ", "ArrowUp"]);
    expect(clashesWith(DEFAULT_KEYS, "crouch")).toEqual([]);
  });

  it("keeps R for the press a rider makes mid-run, and the shutter on ENTER", () => {
    // R is the one of the two reached for with the craft upside down in the
    // surf; standing the whole run back up is the rarer press and gets a key
    // of its own beside it. Neither is on Enter, which is the shutter.
    expect(DEFAULT_KEYS.reset).toEqual(["KeyR"]);
    expect(DEFAULT_KEYS.restart).toEqual(["KeyB"]);
    expect(DEFAULT_KEYS.shot).toEqual(["Enter"]);
  });

  it("puts the readouts' own switch on H, beside the camera's C", () => {
    // The two presses about the PICTURE rather than the craft, under the hand
    // that is not on the throttle. H writes `hud.on` — the same switch
    // OPTIONS ▸ HUD and the pause card's row write.
    expect(DEFAULT_KEYS.hud).toEqual(["KeyH"]);
    expect(DEFAULT_KEYS.camera).toEqual(["KeyC"]);
    expect(isHeldAction("hud")).toBe(false);
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

describe("a measured run rides a PINNED shore rather than a seed (new-game.ts)", () => {
  const RACE_LEVEL = CAMPAIGN_LEVELS.find((level) => level.mode === "race")!;
  const TRICKS_LEVEL = CAMPAIGN_LEVELS.find((level) => level.mode === "tricks")!;
  const rides = (patch: Partial<(typeof DEFAULT_SETTINGS)["ride"]>) => ({
    ...DEFAULT_SETTINGS,
    ride: { ...DEFAULT_SETTINGS.ride, ...patch },
  });
  /** A link that names nothing, which is how a run stood up from a card
   * arrives: every override undefined. */
  const NO_LINK = readParams("");

  it("pins nothing until a card has picked one, so a fresh app rides its own seed", () => {
    expect(DEFAULT_SETTINGS.ride.level).toBeNull();
    expect(pinnedFor(DEFAULT_SETTINGS)).toBeNull();
  });

  it("pins nothing on a FREE ride, whatever the last card left stored", () => {
    // FREE is the one mode with a seed row and three faders; a level id left
    // over from a race must not follow the rider onto it.
    expect(pinnedFor(rides({ mode: "free", level: RACE_LEVEL.id }))).toBeNull();
  });

  it("drops an id the mode cannot ride", () => {
    expect(pinnedFor(rides({ mode: "race", level: TRICKS_LEVEL.id }))).toBeNull();
    expect(pinnedFor(rides({ mode: "tricks", level: RACE_LEVEL.id }))).toBeNull();
    expect(pinnedFor(rides({ mode: "timeTrial", level: RACE_LEVEL.id }))).toBe(RACE_LEVEL);
  });

  it("stands a TIME TRIAL up on the pinned shore's own day, with nobody on it", () => {
    const state = gameFor(rides({ mode: "timeTrial", level: RACE_LEVEL.id }), NO_LINK);
    // The DAY is the level's and not the settings': that is what makes two
    // riders' times down this rung the same figure.
    expect(state.seed).toBe(RACE_LEVEL.seed);
    expect(state.level.biome).toBe(shoreOf(RACE_LEVEL).id);
    expect(state.level.track).toBe(RACE_LEVEL.track);
    expect(state.level.season).toBe(RACE_LEVEL.season);
    expect(state.level.weather).toBe(RACE_LEVEL.weather);
    // ...and the FIELD is the MODE's rather than the campaign's: a time
    // trial is the course against the clock alone.
    expect(state.rivals).toHaveLength(0);
    expect(state.rules.course).toBe(true);
  });

  it("stands a RACE up on the same shore with the grid on it", () => {
    const state = gameFor(rides({ mode: "race", level: RACE_LEVEL.id }), NO_LINK);
    expect(state.rivals.length).toBeGreaterThan(0);
    expect(state.level.tricks).toBe(false);
  });

  it("stands a TRICKS run up on a tricks shore, for the length the row asks", () => {
    const minutes = TRICK_MINUTES[TRICK_MINUTES.length - 1];
    const state = gameFor(
      rides({ mode: "tricks", level: TRICKS_LEVEL.id, tricksMinutes: minutes }),
      NO_LINK,
    );
    // R35's field is on it — the whole reason a tricks rung is its own shore.
    expect(state.level.tricks).toBe(true);
    expect(state.level.ramps.length).toBeGreaterThan(0);
    // The LENGTH is the card's row, not the rung's: outside the campaign it
    // is a real choice, and the record book keys on it.
    expect(state.rules.limit).toBe(minutes * 60);
  });

  it("names the record book's row after the LEVEL, not after the seed row", () => {
    // The seed row is a free ride's and may be standing anywhere; a row on a
    // pinned shore has to be the shore's own identity or two riders' times
    // land in two different rows.
    const s = rides({ mode: "race", level: RACE_LEVEL.id, seed: 999, biome: "taiga" });
    const key = recordKeyFor(s, "circuit");
    expect(key.seed).toBe(RACE_LEVEL.seed);
    expect(key.biome).toBe(shoreOf(RACE_LEVEL).id);
    expect(key.track).toBe(RACE_LEVEL.track);
  });

  it("stands aside for a LINK that names a seed", () => {
    // Every lab photographs a shore by number, and a `?seed=` that quietly
    // rode a campaign rung instead would photograph the wrong coast.
    const stored = rides({ mode: "race", level: RACE_LEVEL.id });
    const laid = settingsFor(stored, readParams("?seed=38"));
    expect(laid.ride.level).toBeNull();
    expect(laid.ride.seed).toBe(38);
    expect(pinnedFor(laid)).toBeNull();
  });

  it("keeps a stored level the ladder still has, and drops one it does not", () => {
    expect(mergeSettings({ ride: { level: RACE_LEVEL.id } }).ride.level).toBe(RACE_LEVEL.id);
    expect(mergeSettings({ ride: { level: "atoll-1" } }).ride.level).toBeNull();
    expect(mergeSettings({ ride: { level: 7 } }).ride.level).toBeNull();
  });
});
