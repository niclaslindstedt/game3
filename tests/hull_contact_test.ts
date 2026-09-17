// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// HULL AGAINST HULL (`engine/game/hull-contact.ts`): that the shell is the
// hull's own shape, that which END of a rival you meet is what decides the
// outcome, and that a meeting is worth a shove rather than a pirouette.
//
// Every case here stands both hulls on the SYNTHETIC coast, well offshore
// over the flat of the bed, running along the shore so neither is climbing
// out of the water; the striker is let trim out at his throttle first and
// then stood on an intercept, because a contact staged from rest is a
// contact between two hulls still settling.
import { describe, expect, it } from "vitest";

import {
  RACE,
  TUNING,
  clipHulls,
  craftById,
  createGame,
  hullShell,
  standCraft,
  step,
  type CraftId,
  type CraftInput,
  type CraftState,
  type GameState,
} from "@engine";

import { syntheticLevel } from "./support/synthetic.ts";

const LEVEL = syntheticLevel({ depth: 20, windSpeed: 0, swell: 0, noSolids: true });
const CALM = { from: 0, speed: 0 };
const DEG = 180 / Math.PI;
const dt = TUNING.dt;
/** Along the shore, well out — the bed is flat and level under both. */
const LANE = Math.PI / 2;
const OFF = 260;

const CRUISE: CraftInput = {
  steer: 0,
  throttle: 0.7,
  reverse: 0,
  lean: 0,
  crouch: 0,
  reset: false,
};

function stand(craft: CraftId, x: number, z: number, heading: number, speed: number): GameState {
  const game = createGame({ seed: 1, level: LEVEL, wind: CALM, craft, rules: { rivals: 0 } });
  game.phase = "running";
  game.countdown = 0;
  standCraft(game, x, z, heading);
  const c = game.craft;
  c.heading = heading;
  c.vx = Math.sin(heading) * speed;
  c.vz = Math.cos(heading) * speed;
  return game;
}

function pitchOf(c: CraftState): number {
  return c.pitch * DEG;
}

type Meeting = {
  craft?: CraftId;
  /** Where on the victim the striker is aimed, in HER frame: +z her bow,
   * +x her starboard. */
  where: { x: number; z: number };
  /** The striker's heading against hers, rad. */
  bearing: number;
  speed?: number;
  victimSpeed?: number;
  /** What the striker's rider is doing on the way in: −1 forward, +1 back. */
  lean?: number;
  hold?: number;
};

type Outcome = {
  hit: number;
  /** Peak yaw rate the VICTIM was turned at, rad/s, and how far her heading
   * moved in the end, deg. */
  yawPeak: number;
  turned: number;
  strikerTurned: number;
  /** How nearly parallel the two ended up, deg — 0 is lined up. */
  parallel: number;
  apart: number;
  /** The victim's pitch over the meeting, deg: nose-up is positive. */
  pitchUp: number;
  pitchDown: number;
  /** How far either hull was lifted over where it started, m. */
  liftVictim: number;
  liftStriker: number;
  victimSpeed: number;
  strikerSpeed: number;
};

const wrap = (a: number): number =>
  ((((a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;

/** Stage one meeting and report what both riders came away with. */
function meet(plan: Meeting): Outcome {
  const craft = plan.craft ?? "marlin";
  const speed = plan.speed ?? 16;
  const victimSpeed = plan.victimSpeed ?? 9;
  const lean = plan.lean ?? 0;
  const head = LANE + plan.bearing;
  const vic = stand(craft, 0, OFF, LANE, victimSpeed);
  const str = stand(craft, 0, OFF - 40, head, speed);
  const v = vic.craft;
  const s = str.craft;
  const leaning: CraftInput = { ...CRUISE, lean };
  const settle = Math.round(1.2 / dt);
  for (let i = 0; i < settle; i++) {
    stepBoth(vic, str, CRUISE, leaning);
  }
  // Stand him a hull's length or two back down his own approach, aimed at
  // where she will BE when he arrives rather than where she is now.
  const sp = Math.hypot(s.vx, s.vz) || 1;
  const tau = 6 / sp;
  const sh = Math.sin(v.heading);
  const ch = Math.cos(v.heading);
  const aimX = v.x + v.vx * tau + plan.where.z * sh + plan.where.x * ch;
  const aimZ = v.z + v.vz * tau + plan.where.z * ch - plan.where.x * sh;
  s.x = aimX - Math.sin(head) * sp * tau;
  s.z = aimZ - Math.cos(head) * sp * tau;

  const heading0 = v.heading;
  const strikerHeading0 = s.heading;
  const y0v = v.y;
  const y0s = s.y;
  const out: Outcome = {
    hit: 0,
    yawPeak: 0,
    turned: 0,
    strikerTurned: 0,
    parallel: 0,
    apart: 0,
    pitchUp: 0,
    pitchDown: 0,
    liftVictim: 0,
    liftStriker: 0,
    victimSpeed: 0,
    strikerSpeed: 0,
  };
  const steps = Math.round((plan.hold ?? 2.4) / dt);
  for (let i = 0; i < steps; i++) {
    stepBoth(vic, str, CRUISE, leaning);
    out.hit = Math.max(out.hit, clipHulls(s, v));
    out.yawPeak = Math.max(out.yawPeak, Math.abs(v.wy));
    out.pitchUp = Math.max(out.pitchUp, pitchOf(v));
    out.pitchDown = Math.min(out.pitchDown, pitchOf(v));
    out.liftVictim = Math.max(out.liftVictim, v.y - y0v);
    out.liftStriker = Math.max(out.liftStriker, s.y - y0s);
  }
  out.turned = wrap(v.heading - heading0) * DEG;
  out.strikerTurned = wrap(s.heading - strikerHeading0) * DEG;
  out.parallel = Math.abs(wrap(s.heading - v.heading)) * DEG;
  out.apart = Math.hypot(s.x - v.x, s.z - v.z);
  out.victimSpeed = Math.hypot(v.vx, v.vz);
  out.strikerSpeed = Math.hypot(s.vx, s.vz);
  return out;
}

/** Both riders by one step of the world. Each is a run of its own with no
 * field in it (`rules.rivals` 0), so the only thing that ever puts one hull
 * against the other is the `clipHulls` call the case makes itself. */
function stepBoth(a: GameState, b: GameState, ai: CraftInput, bi: CraftInput): void {
  step(a, ai);
  step(b, bi);
}

describe("the contact shell", () => {
  it("is the hull's own shape: rockered keel, tapered plan, flat deck", () => {
    for (const id of ["skiff", "marlin", "otter", "dart"] as const) {
      const spec = craftById(id);
      const shell = hullShell(spec);
      // Longer forward of the centre of gravity than aft, because the CoG
      // does not stand amidships.
      expect(shell.fore - shell.aft).toBeCloseTo(spec.length, 6);
      expect(shell.fore, id).toBeGreaterThan(-shell.aft);
      // Keel to deck is the hull's own depth, and the deck is where the
      // spec says the topsides end.
      expect(shell.top - shell.bottom).toBeCloseTo(spec.height, 6);
      expect(shell.bottom).toBeCloseTo(-spec.cog.y, 6);
      const runs = shell.runs;
      // THE BOW IS FINE AND IT IS RAISED. The plan draws in toward the stem
      // and the keel sweeps up to it — both read off the hull's own tables,
      // so neither can drift from the probes the water is sampled at.
      const stem = runs[runs.length - 1];
      const transom = runs[0];
      expect(stem.w1, id).toBeLessThan(transom.w0 * 0.5);
      expect(stem.k1, id).toBeGreaterThan(transom.k0 + 0.1);
      expect(transom.k0).toBeCloseTo(shell.bottom, 6);
      // Every sample point stands ON the shell, and there are enough of
      // them down the rail to carry a couple.
      expect(shell.points.length).toBeGreaterThanOrEqual(12);
      for (const p of shell.points) {
        expect(p.z).toBeGreaterThanOrEqual(shell.aft - 1e-9);
        expect(p.z).toBeLessThanOrEqual(shell.fore + 1e-9);
        expect(p.y).toBeGreaterThanOrEqual(shell.bottom - 1e-9);
        expect(p.y).toBeLessThanOrEqual(shell.top + 1e-9);
      }
      expect(shell.reach).toBeGreaterThan(shell.fore);
    }
  });

  it("leaves two hulls that never touch alone", () => {
    const vic = stand("marlin", 0, OFF, LANE, 10);
    const str = stand("marlin", 0, OFF + 12, LANE, 10);
    const before = { ...str.craft };
    expect(clipHulls(str.craft, vic.craft)).toBe(0);
    expect(str.craft.vx).toBe(before.vx);
    expect(str.craft.wy).toBe(before.wy);
  });

  it("lets a hull FLY over a rival, and puts one that did not clear her on her deck", () => {
    // The shell stops at the deck, so the clearance a rider needs to pass
    // over a rival is the gap between his keel and her deck and nothing
    // more. A ring ridden over her head costs him nothing; coming down
    // half a metre short lands him ON her, and the contact pushes him up
    // and her down — which no model resolved in the plan alone can do.
    const shell = hullShell(craftById("marlin"));
    const clear = shell.top - shell.bottom;
    // She runs up the lane (+x), so a hull set BESIDE her is offset across
    // it, in z — half a beam over, which puts his keel over her side deck.
    const vic = stand("marlin", 0, OFF, LANE, 10);
    const over = stand("marlin", 0, OFF + 0.5, LANE, 10);
    over.craft.y = vic.craft.y + clear + 0.2;
    expect(clipHulls(over.craft, vic.craft)).toBe(0);
    // ...and just short of clearing her deck, coming down.
    over.craft.y = vic.craft.y + shell.top - shell.bottom - 0.05;
    over.craft.vy = -4;
    const herVy = vic.craft.vy;
    expect(clipHulls(over.craft, vic.craft)).toBeGreaterThan(0);
    expect(over.craft.vy).toBeGreaterThan(-4);
    expect(vic.craft.vy).toBeLessThan(herVy);
  });
});

describe("which end of a rival you meet", () => {
  it("IN THE SIDE: stops the way across her and lines the two of them up", () => {
    // A flank is a WALL: the striker keeps the component of his way that
    // runs ALONG her and loses the one that ran into her, which is what
    // carries him up beside her rather than through her. Leaned on at a
    // shallow angle the two settle PARALLEL — the contact manifold's own
    // couple plus the one `RACE.bump.align` adds to it.
    for (const angle of [10, 20]) {
      const r = meet({
        speed: 16,
        victimSpeed: 11,
        where: { x: -0.6, z: 0.2 },
        bearing: (angle * Math.PI) / 180,
        hold: 3.5,
      });
      expect(r.hit, `${angle}°`).toBeGreaterThan(1);
      // Lined up: within a few degrees of parallel, still alongside, and
      // neither rider stopped by it.
      expect(r.parallel, `${angle}° parallel`).toBeLessThan(6);
      expect(r.apart, `${angle}° apart`).toBeLessThan(8);
      expect(r.strikerSpeed, `${angle}° speed`).toBeGreaterThan(12);
      expect(r.victimSpeed, `${angle}° speed`).toBeGreaterThan(12);
    }
  });

  it("IN THE SIDE: a square shoulder shoves her across, and does not spin her", () => {
    for (const craft of ["skiff", "marlin", "otter", "dart"] as const) {
      const r = meet({
        craft,
        speed: 14,
        victimSpeed: 8,
        where: { x: -0.6, z: 0 },
        bearing: Math.PI / 2,
      });
      expect(r.hit, craft).toBeGreaterThan(4);
      // She is turned off her line — that is the whole point of leaning on
      // somebody — but she is not set spinning: a hull put round more than
      // once a second is a bottle, not a machine with a rider on it.
      expect(Math.abs(r.turned), `${craft} turned`).toBeGreaterThan(5);
      // `spinCap` bounds what ONE STEP of one meeting may add, and a hull
      // leaned on for a fifth of a second is many steps of it — so what is
      // held here is the rate a rider is actually left riding, which has to
      // stay well under a turn a second however square the shoulder was.
      expect(r.yawPeak, `${craft} yaw`).toBeLessThan(6);
      // And nothing is thrown into the air by a contact on the water.
      expect(r.liftVictim, `${craft} lift`).toBeLessThan(0.5);
      expect(r.liftStriker, `${craft} lift`).toBeLessThan(0.5);
    }
  });

  it("IN THE BACK: the striker's LEAN decides which way she pitches", () => {
    // The contact is on her transom, so where his bow STANDS when it
    // arrives is the whole of it: a low bow pushes below her centre of
    // gravity and lifts her nose, a high one pushes above it and drives her
    // nose down. The rider's lean is what moves that bow, so leaning
    // forward and leaning back are two different attacks on the same hull.
    const rear = { where: { x: 0, z: -1.45 }, bearing: 0, speed: 19, hold: 2 };
    const forward = meet({ ...rear, victimSpeed: 9, lean: -1 });
    const level = meet({ ...rear, victimSpeed: 9, lean: 0 });
    const back = meet({ ...rear, victimSpeed: 9, lean: 1 });
    for (const r of [forward, level, back]) expect(r.hit).toBeGreaterThan(2);
    // Nose-down into her transom lifts her nose hardest, because the push
    // lands furthest BELOW her centre of gravity; coming in nose-up moves
    // that push up past it and stops lifting her at all. The two ends of
    // the lean are what is held — the middle of it is a crossing, not a
    // rung, and where exactly it falls is the water's business.
    expect(forward.pitchUp).toBeGreaterThan(back.pitchUp * 1.3);
    expect(level.pitchUp).toBeLessThan(forward.pitchUp);
    // ...and the rider who came in leaning back is the one who ends up
    // climbing over her rather than shoving her along.
    expect(back.liftStriker).toBeGreaterThan(forward.liftStriker + 0.15);
  });

  it("IN THE BACK: a hull not yet on the plane can be driven under", () => {
    // A planing hull sits bow-up and a shove will not bury it; one still in
    // displacement trim has nothing holding its nose up, and a rider who
    // rides up over her transom puts it down. This is the submarining case,
    // and it is the same contact resolved through her deck.
    const r = meet({
      where: { x: 0, z: -1.45 },
      bearing: 0,
      speed: 19,
      victimSpeed: 4,
      lean: 1,
      hold: 2,
    });
    expect(r.hit).toBeGreaterThan(2);
    expect(r.pitchDown).toBeLessThan(-3);
  });

  it("IN THE FRONT: two hulls running the same way shoulder each other outward", () => {
    // Catching a rival's bow quarter on the way past is not a crash: both
    // fine bows are RAKED, so the shallowest way out of either is sideways,
    // and each leaves a few degrees off the line he came in on with his way
    // still on him.
    for (const off of [0.4, 0.6, 0.9]) {
      const r = meet({
        speed: 19,
        victimSpeed: 12,
        where: { x: -off, z: 1.5 },
        bearing: 0,
        hold: 2.4,
      });
      expect(r.hit, `${off} m`).toBeGreaterThan(1);
      // Both still going, and neither turned more than a course correction.
      expect(r.strikerSpeed, `${off} m striker`).toBeGreaterThan(14);
      expect(r.victimSpeed, `${off} m victim`).toBeGreaterThan(14);
      expect(Math.abs(r.turned), `${off} m turned`).toBeLessThan(25);
      expect(Math.abs(r.strikerTurned), `${off} m turned`).toBeLessThan(25);
    }
  });
});

describe("the ceiling on the spin", () => {
  it("holds every bearing under the cap, and lifts nobody off the water", () => {
    // The sweep that is the whole verification of a contact change: every
    // approach onto her midships, at one speed, on one hull. What it is
    // watching for is the pirouette — a hull turned so far so fast that the
    // rider has nothing to ride out — and the launch, which is what any
    // upward component in a contact normal becomes when it is wrong.
    for (let deg = 0; deg < 360; deg += 30) {
      const r = meet({
        speed: 16,
        victimSpeed: 9,
        where: { x: -0.6, z: 0 },
        bearing: (deg * Math.PI) / 180,
      });
      expect(r.yawPeak, `${deg}° yaw`).toBeLessThan(4);
      expect(Math.abs(r.turned), `${deg}° turned`).toBeLessThan(110);
      expect(r.liftVictim, `${deg}° lift`).toBeLessThan(0.5);
      expect(r.liftStriker, `${deg}° lift`).toBeLessThan(0.5);
    }
  });

  it("caps what ONE meeting is worth however deep the overlap", () => {
    // A hull that somehow arrives exactly on top of another — a reset onto
    // a rival, a landing square on her deck — is pushed off rather than
    // fired off: the positional bias is a velocity and it is capped, and no
    // single meeting may be worth more than `spinCap` of fresh rotation.
    const vic = stand("marlin", 0, OFF, LANE, 0);
    const str = stand("marlin", 0.2, OFF + 0.2, LANE + 0.4, 0);
    str.craft.y = vic.craft.y;
    const w0 = Math.hypot(str.craft.wx, str.craft.wy, str.craft.wz);
    clipHulls(str.craft, vic.craft);
    const w1 = Math.hypot(str.craft.wx, str.craft.wy, str.craft.wz);
    expect(w1 - w0).toBeLessThanOrEqual(RACE.bump.spinCap + 1e-9);
    expect(Math.hypot(str.craft.vx, str.craft.vy, str.craft.vz)).toBeLessThan(
      RACE.bump.maxBias * 2,
    );
  });
});
