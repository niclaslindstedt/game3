// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TORNADO — the wall of weather at the far edge of the open ocean, and
// what is out there for a rider who keeps going.
//
// `ocean.ts` says how the sea builds past the level's rim, and it says where
// that stops: at `sea.open.reach` the storm stands in full and grows no
// further. Past there the ocean is FLAT in the only sense that matters — a
// ceiling sea, the same every kilometre, over a bed nobody can touch, with
// no coast, no course and nothing built. A rider holding the throttle open
// out there is riding away from the game.
//
// So this is what he meets instead. One ramp past one edge, in EVERY
// direction the bounds let him out of (`collision.ts` — seaward, and along
// the coast either way where the rim stands in open water), and two things
// on it:
//
//   THE WIND blows toward the level's start line, at EF3 strength, spiralled
//   in cyclonically the way a tornado's surface inflow is. It goes out
//   through `wind.ts` like any other wind and is felt through the one aero
//   term in `flight.ts`, so it pushes the hull, heels it, and weathervanes
//   it, and nothing had to learn a new force to feel it.
//
//   THE UPDRAFT is the column, and it is the point. It cannot be a third
//   component on that wind: `spec.cdA` is the hull's drag area NOSE-ON, and
//   a hull going up is not going forwards — it meets the column bottom-first
//   and shows it the plan area as a flat plate. So the updraft is its own
//   force, worked against `length · beam` at a plate's Cd, in proportion to
//   how much of the hull is out of the water (`airShare`). Which is the
//   whole design: on the water the rider is only shoved about, and the
//   moment a wave throws him clear the column has him and he goes up.
//
// AND THAT IS ALL IT IS. Nothing here teleports a craft, resets a run, ends
// a run, or stands a wall in the water. The rider is thrown — some 25 to
// 33 m up and a long way back toward where he started — by a wind, lands,
// and rides on. Ride out again and it happens again.
//
// Deterministic and stateless, like every other answer past the rim: pure
// functions of the level's bounds, its start line and a plan point, with no
// clock and no randomness.

import { sampleField } from "../lib/heightfield.ts";
import { clamp } from "../lib/math.ts";
import { smooth } from "../lib/noise.ts";
import type { Bounds, Level } from "../mapgen/types.ts";
import type { CraftSpec } from "./defs/craft.ts";
import { CRAFT } from "./defs/craft.ts";
import { TUNING } from "./defs/tuning.ts";
import { topSpeedOf } from "./limits.ts";
import { oceanOut, STORM_CEILING } from "./ocean.ts";

const T = TUNING.wind.tornado;
const RHO = TUNING.air.density;

/** The roster's best, m/s — what the rider who reaches the edge soonest is
 * riding, and the speed every distance and every wind out here is quoted
 * against. */
const TOP = Math.max(...CRAFT.map(topSpeedOf));

/** THE SPEED OF A WAVE on the sea out here, m/s — √(g·`STORM_CEILING`). The
 * one speed the open ocean has, and so the one a throw over it is sized
 * against: it goes as the speed class, since the ceiling goes as its square. */
const WAVE_SPEED = Math.sqrt(TUNING.g * STORM_CEILING);

/** THE CLIMB the column buys a hull, m/s — `tornado.climb` wave-speeds. The
 * throw's whole size: the column's height is quoted in seconds of it, and
 * every hull's updraft is its own hover speed plus it.
 *
 * A constant and not a function of the run's class, and that is not an
 * oversight: `createSea` deals its storm against `STORM_CEILING` off the
 * CATALOG, so the sea past the rim is the same height whatever class a run
 * is ridden at. The throw is sized to the sea it stands over, so it holds
 * still with it. Turn `TUNING.pump.speedClass` — the BUILD's class, which is
 * what the ceiling is derived from — and both move together. */
export const CLIMB: number = T.climb * WAVE_SPEED;

/** ...THE OTHER THREE ARE PER RUN, because they are quoted against what the
 * CRAFT can do and `createGame({ speedClass })` derives the hull at whatever
 * class it was handed (R32; `craftAtClass`). `Level.pace` is that class — the
 * level carries it because the course was laid to it — and it is the honest
 * handle here for the same reason: a rider on a hull twice as quick reaches
 * the edge in half the time and can push through twice the wind, so an edge
 * and a blow fixed to the catalog would be a minute of grace that is thirty
 * seconds and a wall he rides straight out through. */

/** HOW HARD IT BLOWS at full strength, m/s at the reference height. */
export function tornadoBlow(pace: number): number {
  return T.blow * TOP * pace;
}

/** How far past {@link tornadoEdge} the tornado reaches full strength, m —
 * `band` seconds of riding at the run's own best, so crossing it takes the
 * same few seconds whatever the class. */
export function tornadoBand(pace: number): number {
  return T.band * TOP * pace;
}

/** HOW FAR OUT THE TORNADO STANDS, m past the level's rim: the storm's own
 * full reach plus `tornado.grace` seconds of riding at the roster's fastest
 * AT THIS RUN'S CLASS (`Level.pace`, R32).
 *
 * The fastest craft rather than an average, and for `STORM_CEILING`'s reason
 * turned around: this is a question about how much rope the rider is given,
 * and the rider who reaches the edge soonest is the one on the quickest
 * hull. Sizing it off him gives every other craft longer, never shorter.
 *
 * So it follows the speed class exactly as the ocean does — turn
 * the class up — the build's or the run's — and the grace stays a minute of
 * riding rather than shrinking into one. */
export function tornadoEdge(pace: number): number {
  return TUNING.sea.open.reach + T.grace * TOP * pace;
}

/** ...at the build's own class, for a caller with no level in hand (a lab, a
 * doc, a test bench). */
export const TORNADO_EDGE: number = tornadoEdge(TUNING.pump.speedClass);

/** How much of the tornado stands `out` metres past the rim: 0 up to
 * {@link TORNADO_EDGE}, 1 a `tornado.band` further out, easing between.
 *
 * Eased for the reason `stormRamp` is, one layer plainer: this ramp scales a
 * wind rather than an energy, so a single Hermite fade already leaves the
 * edge flat. A rider crossing it feels the air freshen over a few seconds
 * instead of walking into a pane of glass. */
export function tornadoRamp(out: number, pace: number): number {
  return smooth(clamp((out - tornadoEdge(pace)) / tornadoBand(pace), 0, 1));
}

/** The same, at a plan point — 0 anywhere inside the level and anywhere in
 * the storm short of the edge, which is everywhere a run is actually
 * ridden. */
export function tornadoAt(bounds: Bounds, pace: number, x: number, z: number): number {
  return tornadoRamp(oceanOut(bounds, x, z), pace);
}

/** THE INFLOW at a plan point, m/s at the reference height, written into
 * `out` as [vx, vz] — the horizontal wind the tornado adds to the level's
 * own, which is nothing at all until `grip` rises off zero.
 *
 * It blows toward the level's START (`level.start`) rather than
 * toward the nearest rim, and that is deliberate: the rim a rider left by
 * tells him where the edge was, the start tells him where the game is. A
 * rider who followed the coast twenty gates downwind and out is put back
 * near the line rather than back where he strayed.
 *
 * Spiralled by `tornado.swirl` off that straight line, cyclonically —
 * headings here grow CLOCKWISE seen from above, so the cyclonic turn is the
 * negative one. That is what keeps a throw from being a shove down a
 * corridor: the hull is carried home on a curve, yawing as the crosswind
 * works on its windage. */
export function tornadoInflow(
  grip: number,
  pace: number,
  home: { readonly x: number; readonly z: number },
  x: number,
  z: number,
  out: Float64Array,
): void {
  out[0] = 0;
  out[1] = 0;
  if (grip <= 0) return;
  const dx = home.x - x;
  const dz = home.z - z;
  const len = Math.hypot(dx, dz);
  // Dead on the start line there is no way home to blow along. It cannot
  // happen — the start is inside the level and the tornado is kilometres
  // outside it — but a direction divided by nothing is a NaN loose in the
  // wind field, and every other reader of this would inherit it.
  if (len < 1e-6) return;
  const ux = dx / len;
  const uz = dz / len;
  const cs = Math.cos(T.swirl);
  const sn = Math.sin(T.swirl);
  const speed = tornadoBlow(pace) * grip;
  out[0] = speed * (ux * cs - uz * sn);
  out[1] = speed * (uz * cs + ux * sn);
}

/** HOW TALL THE COLUMN IS at a plan point, m over the water — `tornado
 * .column` SECONDS OF {@link CLIMB}: the shore's over the shallows, the
 * ocean's out over the open sea, and the level's own offshore field to say
 * which.
 *
 * A tornado is only ever as big as the water under it, and that is what
 * makes the two ways out of a level feel like two different mistakes: a
 * rider who followed the coast too far is stood over the shallows and gets
 * the smaller of them, and one who turned his back on the whole level and
 * rode out to sea gets what is standing over the open ocean.
 *
 * `offshore` is a BAKED field and every baked field clamps at its rim, which
 * is exactly the reading wanted here: past the seaward bound it holds the
 * rim's own reach, and past a bound along the coast it holds whatever that
 * stretch of coast reads — small near the beach, large where the level's own
 * water was already open. Nothing extra is built to answer this. */
export function tornadoColumn(level: Level, x: number, z: number): number {
  const open = clamp(sampleField(level.offshore, x, z) / T.openReach, 0, 1);
  return (T.column.shore + (T.column.ocean - T.column.shore) * open) * CLIMB;
}

/** How much of the column is still blowing `height` metres over the water,
 * where the column stands `top` metres tall: all of it at the surface, none
 * of it at the top. Eased at both ends, so a hull leaving the top does not
 * meet a step in the force that reads as hitting a ceiling. */
export function columnFade(height: number, top: number): number {
  return smooth(clamp(1 - height / top, 0, 1));
}

/** THE AIR SPEED AT WHICH THIS HULL HOVERS, m/s — where the column's plate
 * drag exactly carries its weight, from √(m·g / (½·ρ·L·B·`plateCd`)).
 *
 * It is the floor the updraft has to stand above before anything is lifted at
 * all, and it depends on the hull's mass over its plan area and on NOTHING
 * else: 34 to 38 m/s across the shipped roster, and it does not move with the
 * speed class or with the sea. That is exactly why the tuning quotes a CLIMB
 * rather than an updraft — see `TUNING.wind.tornado.climb`. */
export function hoverSpeed(
  spec: Pick<CraftSpec, "mass" | "riderMass" | "length" | "beam">,
): number {
  const area = spec.length * spec.beam * T.plateCd;
  return Math.sqrt(((spec.mass + spec.riderMass) * TUNING.g) / (0.5 * RHO * area));
}

/** THE UPDRAFT this hull meets in the column at full strength, m/s: the speed
 * that just holds it, plus the climb the sea out here earns
 * (`tornado.climb` × the speed of a wave on it). Per craft, so all four are
 * thrown alike by construction rather than by luck. */
export function updraftFor(
  spec: Pick<CraftSpec, "mass" | "riderMass" | "length" | "beam">,
): number {
  return hoverSpeed(spec) + CLIMB;
}

/** THE COLUMN'S LIFT on the hull, N upward — `height` is the hull's own
 * height over the water it is falling back toward and `top` how tall the
 * column is there ({@link tornadoColumn}), both m.
 *
 * The plate drag of a column rising at {@link updraftFor} × `grip` × `fade`
 * against a hull already rising at `vy`, on the plan area at
 * `tornado.plateCd`, in proportion to how much of the hull is in the air
 * (`airShare`, the same reading `flight.ts` fades its own air terms in with).
 *
 * SIGNED on the relative speed, which is what keeps the column from being a
 * rocket: a hull climbing faster than the air around it is pushed back DOWN
 * by it, so the climb settles at `tornado.climb` wave-speeds however long it
 * is held. That bounds the SPEED, and `columnFade` is what bounds the HEIGHT:
 * the throw is a hull accelerated up through a column with a top and then
 * coasting out of it.
 *
 * Nothing special happens on the way down: a hull falling back into the
 * column meets the same air rising past it and is slowed by it, which is this
 * term with `vy` negative, and is why a landing from a height no ramp could
 * ever give is one a rider walks away from. */
export function tornadoLift(
  spec: Pick<CraftSpec, "mass" | "riderMass" | "length" | "beam">,
  grip: number,
  height: number,
  top: number,
  vy: number,
  airShare: number,
): number {
  if (grip <= 0 || airShare <= 0) return 0;
  const fade = columnFade(height, top);
  if (fade <= 0) return 0;
  const rel = updraftFor(spec) * grip * fade - vy;
  const area = spec.length * spec.beam * T.plateCd;
  const force = 0.5 * RHO * area * rel * Math.abs(rel) * airShare;
  // ...and the ceiling (`tornado.liftCap`). The plate drag goes as the SQUARE
  // of the relative speed, and on a hull FALLING back into a column that is
  // still rising the two speeds add: uncapped, a fast class turns the column
  // into a trampoline a rider never comes down off. Capped, it accelerates a
  // hull at `liftCap − 1` g and slows a falling one by no more.
  const cap = T.liftCap * (spec.mass + spec.riderMass) * TUNING.g;
  return clamp(force, -cap, cap);
}

/** Where the tornado's wind blows a rider back to — the level's start line,
 * which is the one point every level has and every rider has already been
 * at. Read once when the wind is built (`wind.ts`), so nothing carries a
 * whole `Level` around to answer a question about the air. */
export function tornadoHome(level: Level): { readonly x: number; readonly z: number } {
  return { x: level.start.x, z: level.start.z };
}
