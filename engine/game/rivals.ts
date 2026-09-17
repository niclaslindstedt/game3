// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FIELD — the other riders in a race, from the grid they start on to
// the shoulder they lean on you with.
//
// A RIVAL IS A RUN. Not a second kind of craft with a second stepper: each
// one is a whole `GameState` of its own — its craft, its progress, its
// input, its events — over the SAME world, sharing the player's level, sea,
// wind, rules and random stream by reference. So a rival is stepped by the
// very function the player is (`run.ts`), ridden by the very bot the sim
// rides (`sim/bot.ts`), and takes a ramp, a gate and a rock exactly as the
// player's hull would. Eleven of them cost eleven hulls' worth of physics
// and nothing else new, and every rule the engine has applies to them
// unchanged. What tells one from the next is one number: the throttle the
// bot is allowed on that hull (`Rival.pace`), dealt off the run's own
// stream at the grid, so the same seed deals the same field.
//
// THE GRID stands at the level's start in rows of three, the front row on
// the start itself and the rest behind it, and the player is put on the
// BACK row in the middle: an arcade race is ridden from the back of the
// pack forward, and the first straight is worth nothing from pole. R11
// only promises water from the start on toward the first gate, so the
// slots behind it are sounded (`RACE.gridDepth`) and the whole grid moved
// forward a row at a time until every slot floats — a run-up ten metres
// shorter is a run-up; a rival stood on the beach is a race with ten in it.
//
// HULL AGAINST HULL is `hull-contact.ts`'s: two oriented shells, resolved
// through whichever face is the shallowest way out of the other, by a
// sequential-impulse solver over the contacts that come back. Which END of
// a rival you meet is the whole of it — a flank stops you and lines the two
// of you up, a transom met with the bow down drives her nose under, two
// bows shoulder each other outward — and this file only says which pairs
// are asked and whose contact earns an event.
//
// Nothing here draws, nothing here is random past the one deal at the grid,
// and a rival's own events stay on its own run — the player's list carries
// only the contacts that were his (`bump`).

import { sampleField } from "../lib/heightfield.ts";
import { botInput } from "../sim/bot.ts";
import type { Level } from "../mapgen/types.ts";
import { solidNear } from "./collision.ts";
import { freshProgress, standCraft } from "./course.ts";
import { RACE } from "./defs/modes.ts";
import { clipHulls } from "./hull-contact.ts";
import { stepRun } from "./run.ts";
import { NEUTRAL_INPUT, type CraftState, type GameEvent, type GameState } from "./state.ts";
import { freshTricks } from "./tricks.ts";

const G = RACE.grid;
const B = RACE.bump;

export type GridPose = { x: number; z: number; heading: number };

/** Which grid slot the PLAYER takes for a grid of `slots`: the middle of
 * the back row (the last row's middle lane — with three abreast, one in
 * from its end). */
export function playerSlot(slots: number): number {
  const rows = Math.ceil(slots / G.abreast);
  const inLastRow = slots - (rows - 1) * G.abreast;
  return (rows - 1) * G.abreast + Math.floor((inLastRow - 1) / 2);
}

/** The slot rival `i` of the field takes: the slots in order, with the
 * player's skipped. */
export function rivalSlot(i: number, slots: number): number {
  const mine = playerSlot(slots);
  return i < mine ? i : i + 1;
}

/** Where slot `slot` of a grid of `slots` stands, shifted `rows` rows
 * forward of the start. Row 0 is ON the start; each row after it stands
 * `pitch` further back; the lanes stand `lane` apart across the start's
 * heading, the middle lane on the line. */
function slotAt(level: Level, slot: number, shift: number): GridPose {
  const s = level.start;
  const row = Math.floor(slot / G.abreast);
  const lane = (slot % G.abreast) - (G.abreast - 1) / 2;
  const back = row * G.pitch - shift;
  const fx = Math.sin(s.heading);
  const fz = Math.cos(s.heading);
  return {
    x: s.x - fx * back + fz * lane * G.lane,
    z: s.z - fz * back - fx * lane * G.lane,
    heading: s.heading,
  };
}

/** Whether a slot floats: water enough under it and no solid in it. */
function floats(level: Level, at: GridPose): boolean {
  return (
    -sampleField(level.ground, at.x, at.z) >= RACE.gridDepth &&
    solidNear(level, at.x, at.z, G.lane / 2) === null
  );
}

/** Every slot of a grid of `slots`, the first on the start and the rest
 * behind it, the whole grid moved forward a row at a time until all of
 * them float — or as far forward as it can go, which is the front row a
 * grid's depth ahead of the start, if the shore never lets it. */
export function gridPoses(level: Level, slots: number): GridPose[] {
  const rows = Math.ceil(slots / G.abreast);
  let poses: GridPose[] = [];
  for (let shift = 0; shift <= rows; shift++) {
    poses = [];
    for (let slot = 0; slot < slots; slot++) poses.push(slotAt(level, slot, shift * G.pitch));
    if (poses.every((at) => floats(level, at))) break;
  }
  return poses;
}

/** STAND THE FIELD: one rival per fresh craft handed in, each on its grid
 * slot with its pace dealt, and the player on his — in place of the start
 * `createGame` stood him on. Called once, from `createGame`, and only for
 * a run with rivals in it, so a run without draws nothing off the stream. */
export function createRivals(state: GameState, crafts: readonly CraftState[]): void {
  const slots = crafts.length + 1;
  const poses = gridPoses(state.level, slots);
  const mine = poses[playerSlot(slots)];
  standCraft(state, mine.x, mine.z, mine.heading);
  state.rivals = crafts.map((craft, i) => {
    const run: GameState = {
      ...state,
      craft,
      input: { ...NEUTRAL_INPUT },
      progress: freshProgress(state.level),
      tricks: freshTricks(),
      rivals: [],
      events: [],
    };
    // ...AND THE RIDER ON IT, before the hull is stood anywhere: a spec is
    // what the draft, the inertia and the windage are all read off, and
    // `standCraft` floats the craft at the draft the spec it has says. The
    // catalog's own rider is the nominal one and every rival gets his own
    // weight off it (`RACE.riderBand`), so no two hulls on the grid sit
    // quite as deep, answer a gust quite as fast, or turn quite as easily.
    craft.spec = {
      ...craft.spec,
      riderMass: craft.spec.riderMass * state.rng.range(RACE.riderBand.min, RACE.riderBand.max),
    };
    const at = poses[rivalSlot(i, slots)];
    standCraft(run, at.x, at.z, at.heading);
    return { id: i, run, pace: state.rng.range(RACE.paceBand.min, RACE.paceBand.max) };
  });
}

/** Step every rival by the step the world has just taken: the bot rides
 * each one's own run, throttled to its pace, and the run answers to the
 * player's lights and nothing else of his. */
export function stepRivals(state: GameState): void {
  for (const rival of state.rivals) {
    const run = rival.run;
    run.t = state.t;
    run.tick = state.tick;
    run.phase = run.progress.finished
      ? "finished"
      : state.phase === "countdown"
        ? "countdown"
        : "running";
    run.events.length = 0;
    const input = run.phase === "running" ? botInput(run) : NEUTRAL_INPUT;
    run.input.steer = input.steer;
    run.input.throttle = Math.min(input.throttle, rival.pace);
    run.input.lean = input.lean;
    run.input.reset = input.reset;
    stepRun(run, run.input, run.events);
  }
}

/** Every hull against every other, once a step, after all of them have
 * moved. The player's contacts are reported on `events` (`bump`), at most
 * once per `bump.cooldown` per hull. */
export function clipRiders(state: GameState, events: GameEvent[]): void {
  const n = state.rivals.length;
  if (n === 0) return;
  const me = state.craft;
  for (let i = 0; i < n; i++) {
    const r = state.rivals[i];
    const closing = clipHulls(me, r.run.craft);
    if (closing >= B.speed && me.bumpCooldown <= 0) {
      me.bumpCooldown = B.cooldown;
      events.push({ kind: "bump", t: state.t, rival: r.id, speed: closing });
    }
    for (let k = i + 1; k < n; k++) clipHulls(r.run.craft, state.rivals[k].run.craft);
  }
}

/** TAKE THE FIELD OFF A RUN THAT WAS DEALT ONE, leaving everything the grid
 * decided exactly where it left it: the player's hull on its slot, and the
 * run's random stream past the draws `createRivals` made.
 *
 * That last part is the whole point of the call. A rival costs nothing
 * random once it is standing — the bot decides, `stepRun` draws nothing —
 * but the grid deals a rider's weight and a pace off `state.rng` for every
 * one of them, so the same run built with `rivals: 0` has its wind gusting
 * off a stream twenty-two draws further back and rides different water from
 * its first step. A GHOST is the recorded run ridden again and must not pay
 * for eleven hulls of physics to be a picture, so it is built the way the
 * run was built and then has the field taken off it
 * (`pwa/src/game/ghost-run.ts`).
 *
 * Nothing else about the state moves: a run with no field in it is a run
 * nobody can lean on, which is what a ghost is. */
export function dropField(state: GameState): void {
  state.rivals = [];
}

/** HOW FAR DOWN THE COURSE A RUN IS, in gates and a share of the leg to
 * the next: what the standings are ordered on while nobody has finished.
 * The share is one less the distance still to the gate over the leg's own
 * length, and it is NOT floored at zero: the grid stands behind the start
 * line, and a field read as all level there would put the back row first.
 * It is capped short of the next whole gate, so a rider a metre from a
 * buoy is still behind one who has crossed it. */
export function courseProgress(run: GameState): number {
  const gates = run.level.course.gates;
  const p = run.progress;
  // `nextGate` rather than the book: it IS the gates reached — taken or
  // charged for — and it is what a run stood at a moment carries.
  const done = p.nextGate;
  if (p.nextGate >= gates.length) return done;
  const next = gates[p.nextGate];
  const from = p.nextGate === 0 ? run.level.start : gates[p.nextGate - 1];
  const leg = Math.hypot(next.x - from.x, next.z - from.z) || 1;
  const left = Math.hypot(next.x - run.craft.x, next.z - run.craft.z);
  return done + Math.min(0.999, 1 - left / leg);
}

/** Whether run `a` stands AHEAD of run `b`: home first, by the clock; then
 * further down the course. On a run where the course does NOT count (a
 * tricks run with a field on it), the standings are the SCORE'S: the
 * higher banked total is ahead, and the buzzer that ends it ends it for
 * everybody at once, so there is no "home first" to read. */
function ahead(a: GameState, b: GameState): boolean {
  if (!a.rules.course) return a.tricks.score > b.tricks.score;
  if (a.progress.finished || b.progress.finished) {
    if (a.progress.finished && b.progress.finished) return a.progress.time < b.progress.time;
    return a.progress.finished;
  }
  return courseProgress(a) > courseProgress(b);
}

/** THE WHOLE FIELD IN ORDER, best first: every rival's id, and `null`
 * where the player stands among them. The same ordering `racePlace` reads
 * one row of, for a results sheet that has to file everybody — the field
 * behind a rider who has just finished is filed where it STANDS, by the
 * course it has covered or the score it has banked, since a buzzer ends a
 * tricks run for everyone at once and a race's stragglers are not waited
 * for. */
export function fieldOrder(state: GameState): (number | null)[] {
  const runs: { id: number | null; run: GameState }[] = [
    { id: null, run: state },
    ...state.rivals.map((r) => ({ id: r.id, run: r.run })),
  ];
  runs.sort((a, b) => (ahead(a.run, b.run) ? -1 : ahead(b.run, a.run) ? 1 : 0));
  return runs.map((r) => r.id);
}

/** THE PLAYER'S PLACE in the field, 1-based: one more than the rivals ahead
 * of him. 1 on a run with nobody else in it. Read every frame by the HUD,
 * and by the finish (`course.ts`'s `placeOf` is the same reading with the
 * player already home). */
export function racePlace(state: GameState): number {
  let place = 1;
  for (const r of state.rivals) if (ahead(r.run, state)) place += 1;
  return place;
}
