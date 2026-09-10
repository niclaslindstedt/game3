// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MENU SYSTEM'S DOM-FREE HALVES — everything the shell decides before a
// browser is involved: when the attract card may take a press, where the
// cursor goes next, what a seven-second hold means, how a load is sequenced
// into phases, and what survives a stored settings blob.
//
// These are the payload modules the `hud-and-menus` split exists for. Each
// component next door does nothing but render what one of these returns, so
// a rule proved here is a rule the surface cannot get wrong on its own.
import { describe, expect, it } from "vitest";

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
  DEFAULT_SETTINGS,
  DEV_HOLD_MS,
  freshSettings,
  mergeSettings,
} from "../pwa/src/game/settings.ts";
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

describe("what survives a stored settings blob (settings.ts)", () => {
  it("gives a first visit the defaults, sharing no reference with them", () => {
    const fresh = freshSettings();
    expect(fresh).toEqual(DEFAULT_SETTINGS);
    fresh.ride.craft = "dart";
    expect(DEFAULT_SETTINGS.ride.craft).toBe("skiff");
    expect(mergeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(mergeSettings("not a blob")).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps the choices a build still offers", () => {
    const stored = mergeSettings({
      ride: { craft: "dart", camera: "nose", seed: 12, time: "sunset", conditions: "storm" },
      hud: { on: false },
    });
    expect(stored.ride).toEqual({
      craft: "dart",
      camera: "nose",
      seed: 12,
      time: "sunset",
      conditions: "storm",
    });
    expect(stored.hud.on).toBe(false);
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
      ride: { craft: "hovercraft", camera: "orbit", time: "midnight", conditions: "drizzle" },
    });
    expect(stored.ride).toEqual(DEFAULT_SETTINGS.ride);
    expect(mergeSettings({ ride: { seed: -4 } }).ride.seed).toBeNull();
    expect(mergeSettings({ ride: { seed: 2.5 } }).ride.seed).toBeNull();
    expect(mergeSettings({ developer: true, dev: { scene: "moonwalk" } }).dev.scene).toBeNull();
    expect(mergeSettings({ developer: true, dev: { wind: 900 } }).dev.wind).toBeNull();
    expect(mergeSettings({ developer: true, dev: { hs: 900 } }).dev.hs).toBeNull();
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
