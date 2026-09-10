// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT THE RIDER FEELS — the vibration table, its one-motor ledger, and the
// seam that carries a pulse out to the phone.
//
// Worth a test rather than a hand on a phone for four reasons, and each is a
// fault nobody would see:
//
//   * A PULSE THAT IS THE WRONG SIZE. A device has one motor, so every buzz
//     spent on a slap is a buzz taken off the next landing — and the ordering
//     between the chop, a touchdown, a rock and going over is the whole
//     information content of the surface. On a desktop it cannot be felt at
//     all, and in a simulator there is no haptic engine to feel it with.
//   * A SLAM READ IN NEWTONS. `CraftState.slam` is a FORCE, and the same
//     wave slaps a heavy hull harder than a light one for the same jolt
//     through the bars. Read without dividing by the craft's own weight, the
//     otter would buzz through a chop the dart rides in silence.
//   * A LEDGER THAT LETS THE CHOP EAT THE LANDING. Asking for a pulse while
//     one is running CUTS the running one off, so a hull hammering a short
//     chop would truncate every landing it came down into. That reads as
//     "the vibration is weak" rather than as a bug.
//   * A SEAM THAT DRIFTS APART. The event's name and the message's shape are
//     stated in three files that cannot import each other — the page's
//     `shell-host.ts`, the shell's injected bridge, and the shell's parser.
//     A rename in one of them is a phone that silently stops buzzing.
//
// No DOM: the table takes a sink and a `dt`, and the bridge is a source
// string held to the constants beside it.

import { describe, expect, it } from "vitest";

import { CRAFT, TUNING, totalMass, type CraftSpec, type GameEvent } from "@engine";

import { RUMBLE_BRIDGE } from "../native/src/injected.ts";
import { RUMBLE_KIND, parseRumble, rumbleBurst } from "../native/src/rumble.ts";
import {
  RUMBLE,
  createRunRumble,
  rumbleForEvent,
  rumbleForSlam,
  type Rumble,
  type SlamRead,
} from "../pwa/src/game/rumble.ts";
import { SHELL_RUMBLE } from "../pwa/src/shell-host.ts";

/** A pulse, or the failure spelled out — every one of these assertions is
 * about a table entry that could just as easily be null. */
function felt(event: GameEvent): Rumble {
  const pulse = rumbleForEvent(event);
  if (!pulse) throw new Error(`${event.kind} is not felt`);
  return pulse;
}

/** A craft carrying a slam of `g` times its own weight, long enough after a
 * landing that the slam is the chop's rather than the landing's. */
function slammed(g: number, spec: CraftSpec = CRAFT[0]): SlamRead {
  return { slam: g * totalMass(spec) * TUNING.g, landing: 10, spec };
}

describe("what an event is worth in the hands", () => {
  it("sizes the hull arriving by how fast it was coming down", () => {
    const touch = felt({ kind: "land", t: 0, vy: -1.5, airTime: 0.4, pitch: 0, speed: 14 });
    const hard = felt({ kind: "land", t: 0, vy: -6, airTime: 1.2, pitch: 0.1, speed: 18 });
    const slam = felt({ kind: "land", t: 0, vy: -11, airTime: 2.4, pitch: 0.3, speed: 22 });
    expect(touch.strength).toBeLessThan(hard.strength);
    expect(hard.strength).toBeLessThan(slam.strength);
    expect(touch.ms).toBeLessThan(slam.ms);
    // A runabout has no suspension: there is no landing the rider does not
    // take, so even the gentlest touchdown is felt.
    expect(touch.strength).toBeGreaterThan(0);
  });

  it("sizes a solid by how fast the two were closing", () => {
    const nudge = felt({ kind: "hit", t: 0, solid: "skerry", speed: 3 });
    const rock = felt({ kind: "hit", t: 0, solid: "skerry", speed: 22 });
    expect(nudge.strength).toBeLessThan(rock.strength);
    expect(nudge.ms).toBeLessThan(rock.ms);
    // The hardest single blow this hull takes short of going over.
    expect(rock.strength).toBeGreaterThan(0.9);
  });

  it("makes the bow burying a SHOVE — long, and never a knock", () => {
    const dive = felt({ kind: "dive", t: 0, depth: 1.2, speed: 20 });
    const ground = felt({ kind: "ground", t: 0, speed: 10 });
    expect(dive.ms).toBeGreaterThan(120);
    // A grounding is a scrape rather than a blow: longer than a nudge, and
    // never as hard as the rock it did not hit.
    expect(ground.strength).toBeLessThan(
      felt({ kind: "hit", t: 0, solid: "reef", speed: 10 }).strength,
    );
  });

  it("gives going over the whole of what the motor has", () => {
    const over = felt({ kind: "capsize", t: 0, speed: 8 });
    expect(over.strength).toBe(1);
    expect(over.ms).toBe(RUMBLE.longest);
    // …and nothing else reaches it.
    const others: GameEvent[] = [
      { kind: "land", t: 0, vy: -20, airTime: 3, pitch: 0.4, speed: 25 },
      { kind: "hit", t: 0, solid: "boulder", speed: 40 },
      { kind: "dive", t: 0, depth: 3, speed: 25 },
    ];
    for (const event of others) expect(felt(event).ms).toBeLessThanOrEqual(RUMBLE.longest);
  });

  it("leaves the news to the HUD and the bank", () => {
    const quiet: GameEvent[] = [
      { kind: "gate", t: 0, gate: 2, split: 12.5 },
      { kind: "airGate", t: 0, gate: 3, split: 18, height: 4 },
      { kind: "missedGate", t: 0, gate: 4, penalty: 5 },
      { kind: "launch", t: 0, vy: 6, speed: 22 },
      { kind: "reset", t: 0, gate: 4 },
      { kind: "finish", t: 0, time: 96.3 },
    ];
    for (const event of quiet) expect(rumbleForEvent(event), event.kind).toBe(null);
  });
});

describe("the sea under the hull", () => {
  it("says nothing while the bottom is merely riding", () => {
    expect(rumbleForSlam(slammed(0))).toBe(null);
    expect(rumbleForSlam(slammed(RUMBLE.slapFrom * 0.5))).toBe(null);
  });

  it("grows from the first slap worth feeling to the hardest the hull takes", () => {
    const light = rumbleForSlam(slammed(RUMBLE.slapFrom + 0.2));
    const full = rumbleForSlam(slammed(TUNING.hull.slamCapG));
    expect(light).not.toBe(null);
    expect(full).not.toBe(null);
    expect(light!.strength).toBeLessThan(full!.strength);
    expect(full!.strength).toBeCloseTo(RUMBLE.slapStrength[1], 5);
    // Past the physics' own cap there is nothing more to feel.
    expect(rumbleForSlam(slammed(TUNING.hull.slamCapG * 3))!.strength).toBeCloseTo(
      RUMBLE.slapStrength[1],
      5,
    );
  });

  it("reads the slam in g, so every craft answers the same wave the same way", () => {
    // The force differs with the hull's mass; the JOLT does not, and the jolt
    // is what a rider feels. Every craft in the catalog, at the same g.
    const felt = CRAFT.map((spec) => rumbleForSlam(slammed(2, spec))!.strength);
    for (const strength of felt) expect(strength).toBeCloseTo(felt[0], 10);
    // …and the same FORCE on a lighter hull is a bigger jolt.
    const heavy = CRAFT.reduce((a, b) => (totalMass(a) >= totalMass(b) ? a : b));
    const light = CRAFT.reduce((a, b) => (totalMass(a) <= totalMass(b) ? a : b));
    expect(totalMass(light)).toBeLessThan(totalMass(heavy));
    const force = 2 * totalMass(heavy) * TUNING.g;
    const onHeavy = rumbleForSlam({ slam: force, landing: 10, spec: heavy })!;
    const onLight = rumbleForSlam({ slam: force, landing: 10, spec: light })!;
    expect(onLight.strength).toBeGreaterThan(onHeavy.strength);
  });

  it("leaves a landing's own slam to the landing", () => {
    const hard = slammed(4);
    expect(rumbleForSlam({ ...hard, landing: RUMBLE.landingOwns * 0.5 })).toBe(null);
    expect(rumbleForSlam({ ...hard, landing: RUMBLE.landingOwns + 0.01 })).not.toBe(null);
  });
});

describe("one motor, one pulse at a time", () => {
  /** The rumble with a list of everything it asked the device for. */
  function ledger() {
    const felt: Rumble[] = [];
    return { rumble: createRunRumble((pulse) => felt.push(pulse)), felt };
  }

  it("pays out the chop no oftener than the gap, however many steps it is fed", () => {
    const { rumble, felt } = ledger();
    const chop = slammed(2);
    // Two seconds of hammering: 240 steps at 120 Hz, drawn at 60.
    for (let i = 0; i < 240; i++) {
      rumble.step(chop);
      if (i % 2) rumble.frame(1 / 60);
    }
    expect(felt.length).toBeGreaterThan(1);
    expect(felt.length).toBeLessThanOrEqual(Math.ceil(2 / RUMBLE.slapGap) + 1);
  });

  it("feels the HARDEST slam of an interval, not whichever one a frame landed on", () => {
    // The fault this exists to catch: the slam is a spike a couple of steps
    // wide, and a frame reading it directly would sample a random fifth of
    // the chop on a phone that is struggling — as likely to miss the worst
    // slap of a crossing as any other.
    const { rumble, felt } = ledger();
    for (const g of [0.6, 5, 0.6, 0.6]) rumble.step(slammed(g));
    rumble.frame(1 / 15); // one long frame over all four steps
    expect(felt).toHaveLength(1);
    expect(felt[0].strength).toBeCloseTo(rumbleForSlam(slammed(5))!.strength, 10);
  });

  it("keeps a slap that lands inside the gap rather than throwing it away", () => {
    const { rumble, felt } = ledger();
    rumble.step(slammed(1));
    rumble.frame(1 / 60);
    expect(felt).toHaveLength(1);
    // A second slap arrives while the gap is still open…
    rumble.step(slammed(1));
    rumble.frame(1 / 60);
    expect(felt).toHaveLength(1);
    // …and is felt the moment it closes, with nothing fed in between.
    for (let i = 0; i < 20; i++) rumble.frame(1 / 60);
    expect(felt).toHaveLength(2);
  });

  it("feels nothing on a frame no step fed it", () => {
    const { rumble, felt } = ledger();
    for (let i = 0; i < 60; i++) rumble.frame(1 / 60);
    expect(felt).toHaveLength(0);
  });

  it("does not let the chop truncate the landing it comes down into", () => {
    const { rumble, felt } = ledger();
    const chop = slammed(2);
    rumble.events([{ kind: "land", t: 0, vy: -9, airTime: 2, pitch: 0.2, speed: 20 }]);
    const landing = felt.length;
    expect(landing).toBe(1);
    // The whole of the landing's pulse, fed the chop the entire way.
    const frames = Math.ceil((felt[0].ms / 1000) * 120);
    for (let i = 0; i < frames; i++) {
      rumble.step(chop);
      rumble.frame(1 / 120);
    }
    expect(felt.length).toBe(landing);
    // …and it is felt again the moment the landing has run out.
    for (let i = 0; i < 30; i++) {
      rumble.step(chop);
      rumble.frame(1 / 120);
    }
    expect(felt.length).toBeGreaterThan(landing);
  });

  it("lets a bigger blow cut a smaller one short — the rock beats the chop", () => {
    const { rumble, felt } = ledger();
    rumble.step(slammed(2));
    rumble.frame(1 / 120);
    expect(felt.length).toBe(1);
    rumble.events([{ kind: "hit", t: 0, solid: "boulder", speed: 25 }]);
    expect(felt.length).toBe(2);
    expect(felt[1].strength).toBeGreaterThan(felt[0].strength);
  });

  it("spends one frame's events on the strongest of them, never on all", () => {
    const { rumble, felt } = ledger();
    rumble.events([
      { kind: "gate", t: 0, gate: 1, split: 9 },
      { kind: "land", t: 0, vy: -2, airTime: 0.3, pitch: 0, speed: 12 },
      { kind: "capsize", t: 0, speed: 8 },
    ]);
    expect(felt).toHaveLength(1);
    expect(felt[0].strength).toBe(1);
  });

  it("forgets the ledger when a run is put down", () => {
    const { rumble, felt } = ledger();
    rumble.events([{ kind: "capsize", t: 0, speed: 8 }]);
    rumble.reset();
    rumble.step(slammed(2));
    rumble.frame(1 / 120);
    expect(felt).toHaveLength(2);
  });
});

describe("the seam out to the phone", () => {
  it("the bridge listens for the event the page dispatches", () => {
    expect(RUMBLE_BRIDGE).toContain(SHELL_RUMBLE);
  });

  it("the bridge posts what the shell's parser reads", () => {
    expect(RUMBLE_BRIDGE).toContain(`sh: "${RUMBLE_KIND}"`);
    // Its own round trip: exactly the message the script builds.
    const posted = JSON.stringify({ sh: RUMBLE_KIND, ms: 120, strength: 0.8 });
    expect(parseRumble(posted)).toEqual({ ms: 120, strength: 0.8 });
  });

  it("drops everything that is not a rumble, rather than throwing", () => {
    for (const raw of [
      "",
      "{",
      "null",
      "[]",
      JSON.stringify({ sh: "something-else", ms: 100, strength: 0.5 }),
      JSON.stringify({ sh: RUMBLE_KIND, ms: "100", strength: 0.5 }),
      JSON.stringify({ sh: RUMBLE_KIND, ms: 0, strength: 0.5 }),
      JSON.stringify({ sh: RUMBLE_KIND, ms: Number.NaN, strength: 0.5 }),
      JSON.stringify({ sh: RUMBLE_KIND, ms: 100 }),
    ]) {
      expect(parseRumble(raw), raw).toBe(null);
    }
  });

  it("clamps a strength the page had no business sending", () => {
    expect(parseRumble(JSON.stringify({ sh: RUMBLE_KIND, ms: 50, strength: 4 }))?.strength).toBe(1);
    expect(parseRumble(JSON.stringify({ sh: RUMBLE_KIND, ms: 50, strength: -2 }))?.strength).toBe(
      0,
    );
  });

  it("spends a duration as a COUNT of taps, because a phone has no duration", () => {
    // Every pulse the game actually asks for, from the shortest to the
    // longest, lands where it should on hardware that only knows taps.
    expect(rumbleBurst({ ms: RUMBLE.slapMs, strength: 0.3 }).count).toBe(1);
    expect(rumbleBurst({ ms: 70, strength: 0.5 }).count).toBe(1);
    expect(rumbleBurst({ ms: 190, strength: 0.9 }).count).toBe(2);
    expect(rumbleBurst({ ms: RUMBLE.longest, strength: 1 }).count).toBe(3);
    // …and never more, however long the page asks for.
    expect(rumbleBurst({ ms: 5000, strength: 1 }).count).toBe(3);
  });

  it("spends a strength as a STYLE, because that is the axis a phone has", () => {
    expect(rumbleBurst({ ms: 26, strength: 0.2 }).style).toBe("light");
    expect(rumbleBurst({ ms: 90, strength: 0.55 }).style).toBe("medium");
    expect(rumbleBurst({ ms: 200, strength: 0.95 }).style).toBe("heavy");
  });

  it("leaves the Taptic Engine time to re-arm between the taps in a burst", () => {
    // Under about 40 ms the second tap is simply dropped.
    expect(rumbleBurst({ ms: RUMBLE.longest, strength: 1 }).gapMs).toBeGreaterThanOrEqual(40);
  });
});
