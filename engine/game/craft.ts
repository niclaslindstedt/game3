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
import { fromEuler, integrate, rotate, toEuler, unrotate } from "../lib/quat.ts";
import { boundsPush, clipSolids, contactForces, type ContactResult } from "./collision.ts";
import { TUNING } from "./defs/tuning.ts";
import { aeroForces, type AeroResult } from "./flight.ts";
import {
  hullForces,
  hullProbes,
  inertia,
  placeProbes,
  probeSamples,
  restY,
  totalMass,
  type HullProbe,
  type HullResult,
  type ProbeSample,
} from "./hull.ts";
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
        lateral: 0,
        waterVx: 0,
        waterVy: 0,
        waterVz: 0,
        planingLift: 0,
        wettedLength: 0,
        buoyancy: 0,
        bank: 0,
        bowLift: 0,
        heave: 0,
        slam: 0,
      },
      contact: {
        fx: 0,
        fy: 0,
        fz: 0,
        tx: 0,
        ty: 0,
        tz: 0,
        onGround: false,
        onRamp: false,
        groundSpeed: 0,
      },
      aero: { fx: 0, fy: 0, fz: 0, tx: 0, ty: 0, tz: 0 },
    };
    works.set(craft, w);
  }
  return w;
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

  // THE RIDER CLIMBING BACK ON. A hull left on its back is righted by the
  // rider over `capsize.righting` seconds: the orientation is turned back
  // upright along the shortest way, the way is scrubbed off, and the
  // engine idles. Nothing else acts on the hull meanwhile — the rider is
  // standing on it.
  if (c.righting > 0) {
    const before = c.righting;
    c.righting = Math.max(0, c.righting - dt);
    const share = c.righting / before;
    const e = toEuler(c.q);
    c.q = fromEuler(e.heading, e.pitch * share, e.roll * share);
    c.wx = c.wy = c.wz = 0;
    const keep = Math.exp(-dt / T.capsize.slow);
    c.vx *= keep;
    c.vz *= keep;
    c.vy = 0;
    const rest = restY(spec, density) + surfaceAt(state.sea, level, c.x, c.z, state.t).height;
    c.y = c.righting > 0 ? c.y + (rest - c.y) * Math.min(1, dt / before) : rest;
    c.x += c.vx * dt;
    c.z += c.vz * dt;
    c.rpm = spec.idleRpm;
    c.throttleEff = 0;
    const r = toEuler(c.q);
    c.heading = r.heading;
    c.pitch = r.pitch;
    c.roll = r.roll;
    c.speed = Math.hypot(c.vx, c.vy, c.vz);
    c.airborne = false;
    c.airTime = 0;
    c.capsizedFor = 0;
    return;
  }
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
  // The hump's drag fades with whichever comes first: the lift carrying
  // the weight, or the speed passing Savitsky's band.
  const cv = c.speed / Math.sqrt(G * spec.beam);
  const hump = Math.max(
    c.planing,
    clamp((cv - T.planing.fadeLow) / (T.planing.fadeHigh - T.planing.fadeLow), 0, 1),
  );
  hullForces(spec, probes, samples, c.q, c.x, c.y, c.z, density, hump, hull);

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

  const up = rotate(c.q, { x: 0, y: 1, z: 0 });
  const keelY = -spec.cog.y;

  // THE PLANING SURFACE was applied probe by probe in `hullForces`; what
  // is left to do is read how much of the weight it is carrying.
  const liftShare = clamp(hull.planingLift / (mass * G), 0, 1);
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

  // THE SPONSONS: the outside one planes on the water the hull is being
  // pushed across and banks it INTO the turn. A push to the right (the
  // water turning the hull right) rolls the right side down, which in
  // right-handed body axes is a negative z torque.
  tbz -= hull.lateral * T.hull.sponsonLever * spec.cog.y;

  // THE PUMP: the intake is fed while the transom station is wet, and the
  // engine has a tilt cut-off — a capsized craft's throttle is closed.
  const wet = hull.intakeWet && up.y > 0;
  const throttle = up.y > 0 ? input.throttle : 0;
  const engine = stepEngine(spec, density, c.rpm, c.throttleEff, throttle, wet, dt);
  c.rpm = engine.rpm;
  c.throttleEff = engine.throttleEff;
  c.nozzle = stepNozzle(spec, c.nozzle, input.steer, dt);
  const throughWater =
    hull.flowFwd > 0 ? hull.flowFwd : Math.max(0, unrotate(c.q, { x: c.vx, y: c.vy, z: c.vz }).z);
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
  const wetShare = clamp(hull.wetted * 2, 0, 1);
  tby += T.pump.keelYaw * c.nozzle * throughWater * throughWater * wetShare;
  // THE CARVE: a banked bottom turns toward its bank. Read off where the
  // wet bottom's centre actually sits across the hull (`liftX`, body
  // right positive) rather than off the roll angle: a hull leaned far
  // enough to put a chine in the water carves on that chine, and one
  // wobbling two degrees in chop with both chines dry does not. Positive
  // liftX is the right chine in, and a clockwise yaw is +y.
  const dig = Math.max(0, Math.abs(hull.liftX) - T.hull.carveDead) * Math.sign(hull.liftX);
  tby += T.hull.carve * dig * throughWater * throughWater * wetShare * c.planing;

  // THE WATER'S ROTATIONAL DAMPING beyond the probes'.
  {
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
  // The ceilings nothing honest reaches (`hull.maxSpin`, `hull.maxSpeed`).
  const spin = Math.hypot(c.wx, c.wy, c.wz);
  if (spin > T.hull.maxSpin) {
    const k = T.hull.maxSpin / spin;
    c.wx *= k;
    c.wy *= k;
    c.wz *= k;
  }
  const pace = Math.hypot(c.vx, c.vy, c.vz);
  if (pace > T.hull.maxSpeed) {
    const k = T.hull.maxSpeed / pace;
    c.vx *= k;
    c.vy *= k;
    c.vz *= k;
  }
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
  // touches anything. A launch is reported once the hull has been clear
  // for `flight.minAir` — a stern probe re-touching a ramp's lip for a
  // step is not two jumps — and a landing only after a flight that long.
  const inWater = hull.submerged > 0;
  const airborne = !inWater && !contact.onRamp && !contact.onGround;
  if (airborne && !c.airborne) {
    c.airTime = 0;
    c.launchVy = c.vy;
    c.launchPending = true;
    c.dived = false;
    c.pull = 0;
  } else if (!airborne && c.airborne) {
    if (c.airTime >= T.flight.minAir) {
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
    c.launchPending = false;
  }
  c.airborne = airborne;
  if (airborne) {
    c.airTime += dt;
    // THE PULL. A lean held back from the lip through `flight.pullWindow`
    // is the rider yanking the bars up, delivered once as an angular
    // impulse (nose-up is −wx) — the rotation a backflip is made of, on
    // top of the hold. Let go before the window is out and there is no
    // pull this flight: a touch of lean off the lip is not a flip.
    if (c.pull >= 0) {
      if (input.lean > 0.5) {
        c.pull += dt;
        if (c.pull >= T.flight.pullWindow) {
          c.wx -= T.flight.pull / I.x;
          c.pull = -1;
        }
      } else {
        c.pull = -1;
      }
    }
    if (c.launchPending && c.airTime >= T.flight.minAir) {
      c.launchPending = false;
      if (c.launchVy >= T.flight.launchVy) {
        events.push({ kind: "launch", t: state.t, vy: c.launchVy, speed: c.speed });
      }
    }
  } else {
    c.airTime = 0;
  }
  // A DIVE develops over the steps after a landing: the bow keeps going
  // in. Reported once per landing.
  if (
    !c.dived &&
    c.landing < 1 &&
    hull.bowDepth > T.flight.diveDepth &&
    c.pitch < T.flight.divePitch
  ) {
    c.dived = true;
    events.push({ kind: "dive", t: state.t, depth: hull.bowDepth, speed: c.speed });
  }
  // CAPSIZE: a hull on its back (its up pointing down) with the water
  // under it for `capsize.after` seconds is over for good — a PWC does
  // not self-right — and the rider climbs back on and rights it.
  if (up.y < 0 && !airborne) {
    c.capsizedFor += dt;
    if (c.capsizedFor >= T.capsize.after) {
      events.push({ kind: "capsize", t: state.t, speed: c.speed });
      c.righting = T.capsize.righting;
      c.capsizedFor = 0;
    }
  } else {
    c.capsizedFor = 0;
  }
  if (contact.onGround && contact.groundSpeed > 0.4 && c.groundCooldown <= 0) {
    events.push({ kind: "ground", t: state.t, speed: c.speed });
    c.groundCooldown = T.contact.groundCooldown;
  }
}
