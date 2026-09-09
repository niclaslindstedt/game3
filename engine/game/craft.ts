// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CRAFT — one step of the rigid body, afloat or in the air. The whole
// game is the sensation of a hull meeting a wave, and this is where that
// happens: every force is summed here, each from the module that owns its
// model, and the body is integrated once, semi-implicitly, at 120 Hz.
//
// The order is the physics' own. The probes are placed and the surface is
// read under each of them; the water pushes back (`hull.ts` — buoyancy,
// friction, the hump's form drag, the keel's lateral bite, heave damping,
// the slam of a landing); the planing surface lifts (`hydro.ts`); the pump
// pushes and the nozzle steers (`propulsion.ts`); the rider's weight sits
// where the inputs put it; the air drags and, once the hull is out of the
// water, the rider's pull on the bars is the only control there is
// (`flight.ts`); the ground, the ramps and the rocks say no
// (`collision.ts`). Then gravity, the integration, and the readings.
//
// There is no MODE. A launch is a hull whose probes all came out of the
// water; a landing is one whose probes went back in; a dive is a landing
// whose bow went in first. Each is read off the same forces every other
// step is made of, and the events say so after the fact.

import { clamp } from "../lib/math.ts";
import { integrate, rotate, toEuler, unrotate } from "../lib/quat.ts";
import { boundsPush, clipSolids, contactForces, type ContactResult } from "./collision.ts";
import { TUNING } from "./defs/tuning.ts";
import { aeroForces, type AeroResult } from "./flight.ts";
import {
  hullForces,
  hullProbes,
  inertia,
  placeProbes,
  probeSamples,
  totalMass,
  type HullProbe,
  type HullResult,
  type ProbeSample,
} from "./hull.ts";
import { planingLift, pressureCentre, wettedLength } from "./hydro.ts";
import { stepEngine, stepNozzle, thrust } from "./propulsion.ts";
import type { CraftInput, CraftState, GameEvent, GameState } from "./state.ts";
import { surfaceAt } from "./water.ts";
import { windAt } from "./wind.ts";

const T = TUNING;
const G = TUNING.g;

/** Per-craft scratch: the probe layout and every accumulator, allocated
 * once so a step allocates nothing. Keyed weakly off the craft state so a
 * game that is dropped takes its scratch with it. */
type Work = {
  probes: readonly HullProbe[];
  samples: ProbeSample[];
  hull: HullResult;
  contact: ContactResult;
  aero: AeroResult;
};

const works = new WeakMap<CraftState, Work>();

function workFor(craft: CraftState): Work {
  let w = works.get(craft);
  if (!w) {
    const probes = hullProbes(craft.spec);
    w = {
      probes,
      samples: probeSamples(probes.length),
      hull: {
        fx: 0,
        fy: 0,
        fz: 0,
        tx: 0,
        ty: 0,
        tz: 0,
        wetted: 0,
        submerged: 0,
        transomDepth: 0,
        bowDepth: 0,
        intakeWet: false,
        flowFwd: 0,
        flowUp: 0,
        nx: 0,
        ny: 1,
        nz: 0,
        entryVy: 0,
        liftX: 0,
      },
      contact: { fx: 0, fy: 0, fz: 0, tx: 0, ty: 0, tz: 0, onGround: false, onRamp: false, groundSpeed: 0 },
      aero: { fx: 0, fy: 0, fz: 0, tx: 0, ty: 0, tz: 0 },
    };
    works.set(craft, w);
  }
  return w;
}

/** The trim of the bottom against the flow it meets, rad, nose up
 * positive: the angle between the keel plane and the relative velocity.
 * A level hull running horizontally has none; one pitched up by τ has τ. */
function trimAngle(flowFwd: number, flowUp: number): number {
  if (flowFwd < 0.5) return 0;
  return Math.atan2(-flowUp, flowFwd);
}

/** One physics step of the craft. Emits into `events`. */
export function stepCraft(state: GameState, input: CraftInput, events: GameEvent[]): void {
  const c = state.craft;
  const spec = c.spec;
  const level = state.level;
  const dt = T.dt;
  const density = level.water.density;
  const mass = totalMass(spec);
  const I = inertia(spec);
  const w = workFor(c);
  const { probes, samples, hull, contact, aero } = w;
  // THE RIDER moves first: a body on a seat, slower than a thumb. Back is
  // aft; a turn is leaned INTO.
  {
    const k = 1 - Math.exp(-dt / T.rider.leanLag);
    c.riderAft += (clamp(input.lean, -1, 1) * T.rider.leanReach - c.riderAft) * k;
    c.riderRight += (clamp(input.steer, -1, 1) * T.rider.leanIn - c.riderRight) * k;
  }

  // THE WATER under every probe.
  placeProbes(probes, samples, c.q, c.x, c.y, c.z, c.vx, c.vy, c.vz, c.wx, c.wy, c.wz);
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    surfaceAt(state.sea, level, s.px, s.pz, state.t, s.surface);
  }
  hullForces(spec, probes, samples, c.q, c.x, c.y, c.z, density, c.planing, hull);

  // World-frame force and torque accumulators, and body-frame torque.
  let fx = hull.fx;
  let fy = hull.fy;
  let fz = hull.fz;
  let twx = hull.tx;
  let twy = hull.ty;
  let twz = hull.tz;
  let tbx = 0;
  let tby = 0;
  let tbz = 0;

  const fwd = rotate(c.q, { x: 0, y: 0, z: 1 });
  const up = rotate(c.q, { x: 0, y: 1, z: 0 });
  const keelY = -spec.cog.y;

  // THE PLANING SURFACE (Savitsky), lifting at its pressure centre along
  // the keel, at the wet bottom's lateral centre.
  const trim = trimAngle(hull.flowFwd, hull.flowUp);
  const wetLen = wettedLength(spec, hull.transomDepth, hull.bowDepth);
  const plane = planingLift(spec, density, Math.max(hull.flowFwd, 0), trim, wetLen);
  if (plane.lift > 0) {
    const zcp = -spec.length / 2 + pressureCentre(spec, hull.flowFwd, wetLen) - spec.cog.z;
    const r = rotate(c.q, { x: hull.liftX, y: keelY, z: zcp });
    const lx = up.x * plane.lift;
    const ly = up.y * plane.lift;
    const lz = up.z * plane.lift;
    fx += lx;
    fy += ly;
    fz += lz;
    twx += r.y * lz - r.z * ly;
    twy += r.z * lx - r.x * lz;
    twz += r.x * ly - r.y * lx;
  }
  const liftShare = clamp(plane.lift / (mass * G), 0, 1);
  c.planing += (liftShare - c.planing) * (1 - Math.exp(-dt * T.hull.planingFollow));

  // GRAVITY on the two masses, so the rider's shift is a moment and the
  // rest of the weight cancels it at neutral.
  {
    const riderY = spec.riderHeight;
    const hullY = -(spec.riderMass * riderY) / spec.mass;
    const rr = rotate(c.q, { x: c.riderRight, y: riderY, z: -c.riderAft });
    const rh = rotate(c.q, { x: 0, y: hullY, z: 0 });
    const fr = -spec.riderMass * G;
    const fh = -spec.mass * G;
    fy += fr + fh;
    // r × (0, f, 0) = (−r.z·f, 0, r.x·f).
    twx += -rr.z * fr - rh.z * fh;
    twz += rr.x * fr + rh.x * fh;
  }

  // THE PUMP: the intake is fed while the transom station is wet.
  const wet = hull.intakeWet;
  const engine = stepEngine(spec, density, c.rpm, c.throttleEff, input.throttle, wet, dt);
  c.rpm = engine.rpm;
  c.throttleEff = engine.throttleEff;
  c.nozzle = stepNozzle(spec, c.nozzle, input.steer, dt);
  const throughWater = hull.flowFwd > 0 ? hull.flowFwd : Math.max(0, unrotate(c.q, { x: c.vx, y: c.vy, z: c.vz }).z);
  const push = thrust(spec, density, c.rpm, throughWater, wet);
  if (push > 0) {
    // The jet leaves the transom turned by the nozzle; the reaction on the
    // hull is the jet's opposite. A nozzle swung for a clockwise turn
    // throws the jet to the right-rear, pushing the stern LEFT.
    const bx = -push * Math.sin(c.nozzle);
    const bz = push * Math.cos(c.nozzle);
    const nozzleZ = -spec.length / 2 - spec.cog.z + 0.1;
    const nozzleY = keelY + 0.1;
    const wf = rotate(c.q, { x: bx, y: 0, z: bz });
    const r = rotate(c.q, { x: 0, y: nozzleY, z: nozzleZ });
    fx += wf.x;
    fy += wf.y;
    fz += wf.z;
    twx += r.y * wf.z - r.z * wf.y;
    twy += r.z * wf.x - r.x * wf.z;
    twz += r.x * wf.y - r.y * wf.x;
  }
  // ...and the little the hull turns with the throttle shut: the sponsons
  // and the keel answering the nozzle's attitude, not its thrust.
  tby += T.pump.keelYaw * c.nozzle * throughWater * throughWater * clamp(hull.wetted * 2, 0, 1);

  // THE WATER'S ROTATIONAL DAMPING beyond the probes'.
  {
    const wetShare = clamp(hull.wetted * 2, 0, 1);
    tbx -= T.hull.rotDamp.x * c.wx * wetShare;
    tby -= T.hull.rotDamp.y * c.wy * wetShare;
    tbz -= T.hull.rotDamp.z * c.wz * wetShare;
  }

  // THE AIR: drag always; the plate, the rider's authority and the air's
  // damping in proportion to how much of the hull is out of the water.
  {
    const wind = windAt(state.wind, c.y);
    const airShare = c.airborne ? 1 : clamp(1 - hull.wetted * 3, 0, 1);
    aeroForces(
      spec,
      c.q,
      c.vx,
      c.vy,
      c.vz,
      wind.vx,
      wind.vz,
      c.wx,
      c.wy,
      c.wz,
      input.steer,
      input.lean,
      airShare,
      aero,
    );
    fx += aero.fx;
    fy += aero.fy;
    fz += aero.fz;
    tbx += aero.tx;
    tby += aero.ty;
    tbz += aero.tz;
  }

  // THE GROUND AND THE RAMPS.
  contactForces(level, probes, samples, c.x, c.y, c.z, contact);
  fx += contact.fx;
  fy += contact.fy;
  fz += contact.fz;
  twx += contact.tx;
  twy += contact.ty;
  twz += contact.tz;

  // THE EDGE OF THE WORLD.
  const edge = boundsPush(level, c.x, c.z);

  // INTEGRATE: semi-implicit Euler, the velocity first and the position
  // off the new velocity. The torque is summed in the body frame and the
  // gyroscopic term ω × Iω kept — negligible for a hull afloat, and the
  // thing that makes a tumbling one tumble the way a real body does.
  const tb = unrotate(c.q, { x: twx, y: twy, z: twz });
  tbx += tb.x;
  tby += tb.y;
  tbz += tb.z;
  const gyroX = c.wy * I.z * c.wz - c.wz * I.y * c.wy;
  const gyroY = c.wz * I.x * c.wx - c.wx * I.z * c.wz;
  const gyroZ = c.wx * I.y * c.wy - c.wy * I.x * c.wx;
  c.wx += ((tbx - gyroX) / I.x) * dt;
  c.wy += ((tby - gyroY) / I.y) * dt;
  c.wz += ((tbz - gyroZ) / I.z) * dt;
  c.vx += (fx / mass + edge.ax) * dt;
  c.vy += (fy / mass) * dt;
  c.vz += (fz / mass + edge.az) * dt;
  c.x += c.vx * dt;
  c.y += c.vy * dt;
  c.z += c.vz * dt;
  c.q = integrate(c.q, c.wx, c.wy, c.wz, dt);

  // THE ROCKS, as an impulse on the new pose.
  clipSolids(level, spec, c, state.t, events);

  // THE READINGS.
  const e = toEuler(c.q);
  c.heading = e.heading;
  c.pitch = e.pitch;
  c.roll = e.roll;
  c.speed = Math.hypot(c.vx, c.vy, c.vz);
  c.wetted = hull.wetted;
  c.submergedDepth = Math.max(0, hull.submerged);
  c.onRamp = contact.onRamp;
  c.onGround = contact.onGround;
  c.hitCooldown = Math.max(0, c.hitCooldown - dt);
  c.groundCooldown = Math.max(0, c.groundCooldown - dt);
  c.landing = Math.min(c.landing + dt, 1e6);

  // FLIGHT is read, not declared: the hull is airborne when nothing on it
  // touches anything.
  const inWater = hull.submerged > 0;
  const airborne = !inWater && !contact.onRamp && !contact.onGround;
  if (airborne && !c.airborne) {
    c.airTime = 0;
    c.launchVy = c.vy;
    c.dived = false;
    if (c.vy >= T.flight.launchVy) {
      events.push({ kind: "launch", t: state.t, vy: c.vy, speed: c.speed });
    }
  } else if (!airborne && c.airborne) {
    if (c.airTime > 0.15 || c.launchVy >= T.flight.launchVy) {
      events.push({
        kind: "land",
        t: state.t,
        vy: Math.min(c.vy, hull.entryVy > 0 ? -hull.entryVy : c.vy),
        airTime: c.airTime,
        pitch: c.pitch,
        speed: c.speed,
      });
      c.landing = 0;
    }
  }
  c.airborne = airborne;
  if (airborne) c.airTime += dt;
  else c.airTime = 0;
  // A DIVE develops over the steps after a landing: the bow keeps going
  // in. Reported once per landing.
  if (!c.dived && c.landing < 1 && hull.bowDepth > T.flight.diveDepth && c.pitch < T.flight.divePitch) {
    c.dived = true;
    events.push({ kind: "dive", t: state.t, depth: hull.bowDepth, speed: c.speed });
  }
  if (contact.onGround && contact.groundSpeed > 0.4 && c.groundCooldown <= 0) {
    events.push({ kind: "ground", t: state.t, speed: c.speed });
    c.groundCooldown = T.contact.groundCooldown;
  }
}
