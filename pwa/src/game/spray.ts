// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SPRAY: the water a hull throws. Every event the engine already reads
// off its probes — the planing bottom shedding a sheet off each chine, the
// pump's rooster tail, the boil the reverse bucket makes instead of one, a
// landing's plume, the bow driving into the next face — is turned here
// into a burst of droplets, one particle cloud drawn as a single point
// sprite batch (`THREE.Points`, a custom shader so every droplet has its
// own size). The droplets are lit by the SAME two lights the water is —
// the hemisphere and the key, handed over each frame — so a plume at dusk
// is the dusk's colour and not a paler paint over it. The foam a landing
// leaves ON the water is not drawn here at all: it is stamped into the
// wake's map (`wake.ts`) through the `stamp` handed in, and the water
// shader draws it as it draws every other foam. The budget is spent where
// the camera is: everything here happens within a hull length of the
// craft, and the far water is left to the water mesh.
//
// Two cadences, like the wake. `observe(state)` runs once per ENGINE STEP:
// it reads the craft (`planing`, `wetted`, `throttleEff`, `bucket`,
// `airborne`, `submergedDepth`, `capsizedFor`, `righting` — engine
// readings, never re-derived), emits, and moves every droplet by the
// engine's own `dt`, so a scene pre-rolled for a screenshot carries the
// same spray the player would have seen. `update` runs once per frame and
// only uploads. The droplets read nothing off the sea after they are born —
// a splash is over before the water under it has moved.
//
// THE THREE WAYS A HULL GOES IN, each its own throw and its own stamp: a
// LANDING is the wet perimeter thrown out at once and a shallow crater; a
// DIVE is the bow driving under — a wall of water up over the deck and back
// over the rider as the hull is stopped, and the deepest crater a hull
// makes; going OVER is the whole length coming down on one side — a sheet
// off that side alone, a crater the length of the hull — and the righting,
// half a second later, is the same again the other way as the hull comes
// back onto its bottom. Every stamp carries a depth, and the wake's map
// turns that into the crater and the ring wave the water shader moves the
// surface by, which is how the sea takes the blow rather than wears it.
//
// Renderer-side and stateless toward the engine: nothing here mutates the
// `GameState`, and the randomness is a local generator reseeded on reset
// so a staged moment always throws the same water.

import * as THREE from "three";
import { TUNING, heightAt, rotate, type GameState } from "@engine";

import { PALETTE } from "../identity.ts";
import { clamp } from "../lib/util.ts";
import { spriteTexture } from "./fx-textures.ts";

/** Droplets in the pool. Dead ones cost a vertex and nothing else. */
const POOL = 2400;
/** Droplet drag: the rate, 1/s, spray loses its speed to the air. */
const DRAG = 1.9;
/** A droplet that has fallen this far under where it was born, m, is back
 * in the water. */
const SPLASHDOWN = 0.25;
/** The biggest a droplet may be drawn, device pixels — inside every GPU's
 * point-size range — and the distance from the lens, m, inside which a
 * droplet fades out rather than filling the frame. */
const MAX_PX = 256;
const NEAR_FADE_FROM = 2;
const NEAR_FADE_TO = 5;

/** THE CHINE SHEETS: droplets a second at full planing and pace, the pace
 * (m/s) that is full, and how far along the hull they are shed (shares of
 * the length from the centre of gravity). */
const SHEET_RATE = 520;
const SHEET_FULL_SPEED = 18;
const SHEET_FROM = -0.08;
const SHEET_TO = 0.32;
/** THE ROOSTER TAIL: droplets a second at full throttle, and how high and
 * how far back the pump throws them, m/s. */
const TAIL_RATE = 340;
const TAIL_UP = 3;
const TAIL_UP_PER_THROTTLE = 4.5;
const TAIL_BACK = 3;
const TAIL_BACK_PER_THROTTLE = 5;
/** THE BUCKET BOIL: what the reverse gate makes instead of a tail.
 *
 * With the gate down the jet does not leave astern at all — it is turned
 * FORWARD and UNDER, so the tail collapses and the water erupts alongside
 * the hull instead: two wings of broken white either side of it, thrown
 * forward and out and — at pace, where the reversed jet meets water rushing
 * the other way — up past the deck, which is what a chase camera reads as
 * BRAKING. Droplets a second at a full gate, how fast they are thrown
 * forward and out, how high at a stop and what pace adds to that; a boil
 * that arced would just be a rooster tail pointing the wrong way. */
const BOIL_RATE = 640;
const BOIL_FWD = 2.4;
const BOIL_FWD_PER_THROTTLE = 3.2;
const BOIL_OUT = 2.8;
const BOIL_UP = 1.8;
const BOIL_UP_PER_PACE = 2.4;
/** ...how far forward along the hull the boil reaches, as a share of the
 * length from the transom — to the bow: the flow runs the whole bottom —
 * and how far above the surface a droplet is born, m. The boil is born AT
 * THE SURFACE, never at the keel: a braking hull sits its keel a quarter
 * of a metre under, and a droplet born there never breaks the water. */
const BOIL_ALONG = 0.9;
const BOIL_LIFT = 0.05;
/** THE LANDING PLUME: the descent, m/s, past which a landing is a full
 * splash, and the droplets a full one throws. */
const PLUME_VY = 7;
const PLUME_BURST = 520;
/** THE BOW PLUNGE: the rate the deepest probe goes under, m/s, past which
 * the bow is driving into a face, and the droplets each metre-per-second
 * of it throws a step. */
const PLUNGE_RATE = 1.6;
const PLUNGE_PER_RATE = 5;
/** THE LANDING'S CRATER: how deep the hull knocks the water at a touchdown
 * and at a full slam, m. */
const LAND_CRATER = 0.1;
const LAND_CRATER_FULL = 0.22;
/** THE DIVE: the droplets the bow's wall throws, how hard it goes up and
 * how far along the hull it rises from (shares of the length from the
 * centre of gravity), and how much of the bow's depth the crater takes. */
const DIVE_WALL = 360;
const DIVE_WALL_UP = 7;
const DIVE_WALL_FROM = 0.3;
const DIVE_WALL_TO = 0.5;
const DIVE_CRATER_SHARE = 0.6;
/** GOING OVER: the droplets the side sheet throws, the speed, m/s, past
 * which the hull goes over as hard as it can, the crater the hull's length
 * knocks in the water coming down on its side, m, and how far to that
 * side its centre lies as a share of the beam. The righting is the same
 * blow at a fixed size: the rider hauls a hull over at one speed. */
const OVER_SHEET = 480;
const OVER_FULL_SPEED = 12;
const OVER_CRATER = 0.35;
const OVER_SIDE = 0.5;
const RIGHT_SHEET = 260;
const RIGHT_CRATER = 0.18;
/** How a cloud of droplets takes the two lights: the share of the sky
 * hemisphere it sees against the ground's, and how much of the key it
 * catches — a sheet in the air is lit from every side at once, so it takes
 * about half the sun whichever way it faces. */
const SKY_SHARE = 0.7;
const KEY_SHARE = 0.5;

const FOAM = new THREE.Color(PALETTE.foam);

/** xorshift32 — a few hundred draws a step, reseeded on reset. */
function makeRng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

/** Where a splash's mark on the water goes: the wake's `stamp` — the foam
 * patch, and the crater `depth` m deep the ring wave rolls out of. */
export type FoamStamp = (
  x: number,
  z: number,
  t: number,
  radius: number,
  strength: number,
  depth: number,
) => void;

export type Spray = {
  group: THREE.Group;
  /** Once per engine step: emit and move. */
  observe: (state: GameState) => void;
  /** Once per frame: upload. */
  update: () => void;
  /** Light the droplets for a sky: the scene's two lights, already set for
   * the preset, so the spray is lit by exactly what lights the water it was
   * thrown off. Every frame — within a run the light moves. */
  light: (hemi: THREE.HemisphereLight, key: THREE.DirectionalLight) => void;
  /** The lens the droplets are sized for: the drawing buffer's height,
   * device pixels, and the vertical field of view, degrees. */
  setLens: (pixelHeight: number, fovDeg: number) => void;
  /** How much water the hull throws, as a share of the design rate — the
   * DETAIL row's `SPRAY_SCALE`. At 0 nothing is emitted and the whole group
   * goes dark; the droplets already in the air fall and expire on their own
   * rather than vanishing mid-flight. */
  setBudget: (share: number) => void;
  /** How much of a SPLASH's own throw is thrown — the DETAIL row's
   * `SPLASH_LOOK.throw`: the wall a dive puts up, the sheet off a hull
   * going over and the righting's. At 0 a dive is the plume and the chines'
   * burst it always was, and going over throws nothing. The stamps go into
   * the map whatever this says; the map's own look decides what it keeps. */
  setSplashThrow: (share: number) => void;
  reset: () => void;
  dispose: () => void;
};

export function createSpray(stamp: FoamStamp): Spray {
  const group = new THREE.Group();
  let rng = makeRng(7);

  // ── The droplets ────────────────────────────────────────────────────
  const px = new Float32Array(POOL);
  const py = new Float32Array(POOL);
  const pz = new Float32Array(POOL);
  const vx = new Float32Array(POOL);
  const vy = new Float32Array(POOL);
  const vz = new Float32Array(POOL);
  const age = new Float32Array(POOL);
  const life = new Float32Array(POOL);
  const size0 = new Float32Array(POOL);
  const size1 = new Float32Array(POOL);
  const bright = new Float32Array(POOL);
  const floor = new Float32Array(POOL);
  let cursor = 0;

  const positions = new Float32Array(POOL * 3);
  const sizes = new Float32Array(POOL);
  const alphas = new Float32Array(POOL);
  const geometry = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage);
  const sizeAttr = new THREE.BufferAttribute(sizes, 1).setUsage(THREE.DynamicDrawUsage);
  const alphaAttr = new THREE.BufferAttribute(alphas, 1).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("position", posAttr);
  geometry.setAttribute("aSize", sizeAttr);
  geometry.setAttribute("aAlpha", alphaAttr);
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: spriteTexture() },
      uColor: { value: FOAM.clone() },
      uScale: { value: 600 },
      uLight: { value: new THREE.Color(1, 1, 1) },
    },
    vertexShader: `
      attribute float aSize;
      attribute float aAlpha;
      uniform float uScale;
      varying float vAlpha;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float away = -mv.z;
        gl_PointSize = min(${MAX_PX.toFixed(1)}, aSize * uScale / max(0.5, away));
        gl_Position = projectionMatrix * mv;
        // A droplet flying at the lens is a blob the size of the frame:
        // it fades out over the last few metres instead.
        vAlpha = aAlpha * smoothstep(${NEAR_FADE_FROM.toFixed(1)}, ${NEAR_FADE_TO.toFixed(1)}, away);
      }`,
    fragmentShader: `
      #include <common>
      uniform sampler2D uMap;
      uniform vec3 uColor;
      uniform vec3 uLight;
      varying float vAlpha;
      void main() {
        float a = texture2D(uMap, gl_PointCoord).a * vAlpha;
        if (a < 0.01) discard;
        // The foam's colour under the frame's irradiance, as the water
        // shader lights its own foam.
        gl_FragColor = vec4(uColor * uLight * RECIPROCAL_PI, a);
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 3;
  group.add(points);

  const spawn = (
    x: number,
    y: number,
    z: number,
    ux: number,
    uy: number,
    uz: number,
    seconds: number,
    from: number,
    to: number,
    alpha: number,
  ): void => {
    const i = cursor;
    cursor = (cursor + 1) % POOL;
    px[i] = x;
    py[i] = y;
    pz[i] = z;
    vx[i] = ux;
    vy[i] = uy;
    vz[i] = uz;
    age[i] = 0;
    life[i] = seconds;
    size0[i] = from;
    size1[i] = to;
    bright[i] = alpha;
    floor[i] = y - SPLASHDOWN;
  };

  /** The DETAIL row's share of the design spawn rate. It multiplies the RATES
   * and the burst counts rather than the pool: a thinner spray is fewer
   * droplets thrown, each living its full life, which reads as a lighter sea
   * — where a shorter-lived droplet would read as spray that evaporates. */
  let budget = 1;
  /** The splash's share of its throw, `setSplashThrow`. */
  let splashThrow = 1;

  /** A splash's mark on the water, into the wake's map — unless the budget
   * is nothing, in which case the sea takes it silently. */
  const patch = (
    x: number,
    z: number,
    t: number,
    radius: number,
    strength: number,
    depth: number,
  ): void => {
    if (budget > 0) stamp(x, z, t, radius, strength, depth);
  };

  // ── Reading the craft ───────────────────────────────────────────────
  let prevAirborne = false;
  let prevVy = 0;
  let prevSub = 0;
  let prevOver = false;
  let prevRighting = 0;
  let sheetAcc = 0;
  let tailAcc = 0;
  let boilAcc = 0;
  const body = { x: 0, y: 0, z: 0 };

  /** A world point on the hull, from body coordinates. */
  const at = (c: GameState["craft"], bx: number, by: number, bz: number) => {
    body.x = bx;
    body.y = by;
    body.z = bz;
    return rotate(c.q, body);
  };

  const observe = (state: GameState): void => {
    const c = state.craft;
    const spec = c.spec;
    const dt = TUNING.dt;
    const L = spec.length;
    const keelY = -spec.cog.y;
    const fwdX = Math.sin(c.heading);
    const fwdZ = Math.cos(c.heading);
    const rightX = Math.cos(c.heading);
    const rightZ = -Math.sin(c.heading);
    const pace = clamp(c.speed / SHEET_FULL_SPEED, 0, 1);
    const afloat = !c.airborne && c.wetted > 0.04;

    // THE CHINE SHEETS: a planing bottom throws water off both chines,
    // from a little aft of the centre of gravity forward to the stagnation
    // line, out and up and a touch back.
    if (afloat && c.planing > 0.1 && c.speed > 4) {
      sheetAcc += budget * SHEET_RATE * c.planing * pace * dt;
      while (sheetAcc >= 1) {
        sheetAcc -= 1;
        const side = rng() < 0.5 ? -1 : 1;
        const r = rng();
        const p = at(
          c,
          side * spec.beam * 0.46,
          keelY + 0.04,
          L * (SHEET_FROM + (SHEET_TO - SHEET_FROM) * r) - spec.cog.z,
        );
        const out = (2.2 + 3.6 * rng()) * pace;
        const up = (1.4 + 2.6 * rng()) * pace;
        spawn(
          c.x + p.x,
          c.y + p.y,
          c.z + p.z,
          c.vx * 0.25 + rightX * side * out - fwdX * rng() * 1.5,
          up,
          c.vz * 0.25 + rightZ * side * out - fwdZ * rng() * 1.5,
          0.4 + 0.4 * rng(),
          0.16,
          0.38 + 0.22 * pace,
          0.75,
        );
      }
    } else sheetAcc = 0;

    // THE ROOSTER TAIL: the pump's jet breaking the surface behind the
    // transom, thrown up and back with the throttle — and only what the
    // BUCKET has not already caught. A gate half down is half a tail; a
    // gate fully down is none, because none of the flow is going that way
    // any more. (`c.bucket` is the engine's own reading of where the gate
    // is, the same number the thrust is turned by.)
    const gateDown = clamp(c.bucket, 0, 1);
    const astern = 1 - gateDown;
    if (afloat && c.throttleEff * astern > 0.08) {
      const thr = clamp(c.throttleEff, 0, 1) * astern;
      tailAcc += budget * TAIL_RATE * thr * (0.35 + 0.65 * pace) * dt;
      while (tailAcc >= 1) {
        tailAcc -= 1;
        const p = at(c, (rng() - 0.5) * 0.18, keelY + 0.05, -L / 2 - spec.cog.z);
        const back = TAIL_BACK + TAIL_BACK_PER_THROTTLE * thr;
        const up =
          (TAIL_UP + TAIL_UP_PER_THROTTLE * thr * (0.3 + 0.7 * c.planing)) * (0.6 + 0.4 * rng());
        spawn(
          c.x + p.x,
          c.y + p.y,
          c.z + p.z,
          c.vx * 0.2 - fwdX * back + rightX * (rng() - 0.5) * 1.6,
          up,
          c.vz * 0.2 - fwdZ * back + rightZ * (rng() - 0.5) * 1.6,
          0.45 + 0.4 * rng(),
          0.16,
          0.45,
          0.7,
        );
      }
    } else tailAcc = 0;

    // THE BUCKET BOIL: the other half of the same jet. What the gate
    // catches is thrown forward and down under the hull, so it comes back
    // up along both sides and runs the length of the bottom — broken white
    // water going the way the craft is being stopped rather than the way
    // it is pointing, thrown higher the faster the water is rushing past.
    // Bigger, shorter-lived droplets than the tail's: a boil is broken
    // water, not spray. Each is born at the SEA'S surface beside the hull
    // (`heightAt`, sampled where it is born), because the keel of a hull
    // under its bucket is well under it.
    if (afloat && gateDown > 0.05 && c.throttleEff > 0.08) {
      const strength = gateDown * clamp(c.throttleEff, 0, 1);
      const rush = 0.5 + 0.5 * pace;
      boilAcc += budget * BOIL_RATE * strength * rush * dt;
      while (boilAcc >= 1) {
        boilAcc -= 1;
        const side = rng() < 0.5 ? -1 : 1;
        const along = rng();
        const p = at(
          c,
          side * spec.beam * (0.34 + 0.24 * rng()),
          keelY,
          -L / 2 - spec.cog.z + L * BOIL_ALONG * along,
        );
        const x = c.x + p.x;
        const z = c.z + p.z;
        const y = Math.max(c.y + p.y, heightAt(state.sea, state.level, x, z, state.t)) + BOIL_LIFT;
        const fwd = (BOIL_FWD + BOIL_FWD_PER_THROTTLE * strength) * (0.5 + 0.5 * rng());
        const out = BOIL_OUT * (0.3 + 0.7 * rng());
        spawn(
          x,
          y,
          z,
          c.vx * 0.3 + fwdX * fwd + rightX * side * out,
          (BOIL_UP + BOIL_UP_PER_PACE * pace) * (0.4 + 0.6 * rng()),
          c.vz * 0.3 + fwdZ * fwd + rightZ * side * out,
          0.4 + 0.35 * rng(),
          0.22,
          0.6,
          0.8,
        );
      }
    } else boilAcc = 0;

    // THE LANDING PLUME: the hull coming back down, the whole wet perimeter
    // thrown out at once, sized by how fast it arrived.
    if (prevAirborne && !c.airborne) {
      const strength = clamp((-prevVy - 1) / (PLUME_VY - 1), 0, 1);
      burst(c, budget * (40 + PLUME_BURST * strength), strength, -0.45, 0.45, 0);
      patch(
        c.x,
        c.z,
        state.t,
        spec.beam * 1.2,
        0.5 + 0.5 * strength,
        LAND_CRATER + (LAND_CRATER_FULL - LAND_CRATER) * strength,
      );
    }
    // THE BOW PLUNGE: the deepest probe going under faster than a hull
    // settling ever does — the bow driving into the next face.
    const plunge = (c.submergedDepth - prevSub) / dt;
    if (afloat && plunge > PLUNGE_RATE && c.speed > 4) {
      const n = Math.min(60, Math.round(plunge * PLUNGE_PER_RATE));
      burst(c, budget * n, clamp(plunge / 6, 0.3, 1), 0.15, 0.48, 0);
    }
    // THE DIVE: the bow under and the hull stopping on it — the chines'
    // burst, the wall of water up over the deck, and the crater where the
    // bow went in, as deep as the engine says it went.
    for (const e of state.events) {
      if (e.kind === "dive") {
        burst(c, budget * 220, 1, 0.1, 0.5, 0);
        wall(c, budget * splashThrow * DIVE_WALL, clamp(e.speed / SHEET_FULL_SPEED, 0.4, 1));
        patch(
          c.x + fwdX * L * 0.3,
          c.z + fwdZ * L * 0.3,
          state.t,
          spec.beam * 1.4,
          1,
          e.depth * DIVE_CRATER_SHARE,
        );
      }
    }
    // GOING OVER: the first step the hull is on its back is the step its
    // side came down — the sheet off that side, and the crater under it.
    // `roll` past a right angle keeps the sign of the way it went.
    const over = c.capsizedFor > 0;
    if (over && !prevOver) {
      const side = c.roll > 0 ? 1 : -1;
      const strength = clamp(0.5 + c.speed / OVER_FULL_SPEED, 0.5, 1);
      burst(c, budget * splashThrow * OVER_SHEET, strength, -0.45, 0.45, side);
      patch(
        c.x + rightX * side * spec.beam * OVER_SIDE,
        c.z + rightZ * side * spec.beam * OVER_SIDE,
        state.t,
        L * 0.55,
        strength,
        OVER_CRATER * strength,
      );
    }
    // THE RIGHTING: the hull coming back down onto its bottom on the last
    // step of the rider's haul — both chines at once, a shallower crater.
    if (prevRighting > 0 && c.righting === 0) {
      burst(c, budget * splashThrow * RIGHT_SHEET, 0.7, -0.45, 0.45, 0);
      patch(c.x, c.z, state.t, L * 0.5, 0.8, RIGHT_CRATER);
    }
    prevAirborne = c.airborne;
    prevVy = c.vy;
    prevSub = c.submergedDepth;
    prevOver = over;
    prevRighting = c.righting;

    // MOVE every droplet: ballistic, dragged by the air, gone when it is
    // back in the water or spent.
    const keep = Math.exp(-DRAG * dt);
    for (let i = 0; i < POOL; i++) {
      if (age[i] >= life[i]) continue;
      age[i] += dt;
      vy[i] -= TUNING.g * dt;
      vx[i] *= keep;
      vy[i] *= keep;
      vz[i] *= keep;
      px[i] += vx[i] * dt;
      py[i] += vy[i] * dt;
      pz[i] += vz[i] * dt;
      if (py[i] < floor[i]) age[i] = life[i];
    }
  };

  /** `n` droplets off the chines between two shares of the length, out and
   * up in proportion to `strength` — off both chines at `only` 0, or off
   * one side alone (±1) for a hull coming down on it. */
  function burst(
    c: GameState["craft"],
    count: number,
    strength: number,
    from: number,
    to: number,
    only: number,
  ) {
    const n = Math.round(count);
    const spec = c.spec;
    const keelY = -spec.cog.y;
    const rightX = Math.cos(c.heading);
    const rightZ = -Math.sin(c.heading);
    for (let k = 0; k < n; k++) {
      const side = only !== 0 ? only : rng() < 0.5 ? -1 : 1;
      const p = at(
        c,
        side * spec.beam * (0.3 + 0.25 * rng()),
        keelY + 0.05,
        spec.length * (from + (to - from) * rng()) - spec.cog.z,
      );
      const out = (1.5 + 7 * strength) * (0.3 + 0.7 * rng());
      const up = (1.5 + 6.5 * strength) * (0.3 + 0.7 * rng());
      spawn(
        c.x + p.x,
        c.y + p.y,
        c.z + p.z,
        c.vx * 0.35 + rightX * side * out,
        up,
        c.vz * 0.35 + rightZ * side * out,
        0.55 + 0.6 * rng(),
        0.2,
        (0.42 + 0.33 * strength) * (0.6 + 0.4 * rng()),
        0.8,
      );
    }
  }

  /** THE BOW'S WALL: `n` droplets from across the bow's deck, thrown
   * straight up hardest in the middle and carried on with most of the
   * hull's way — so as the hull is stopped by the water the wall arches
   * back over the rider, which is what a dive looks like from the saddle. */
  function wall(c: GameState["craft"], count: number, strength: number) {
    const n = Math.round(count);
    const spec = c.spec;
    const keelY = -spec.cog.y;
    const rightX = Math.cos(c.heading);
    const rightZ = -Math.sin(c.heading);
    for (let k = 0; k < n; k++) {
      const across = (rng() - 0.5) * 2;
      const p = at(
        c,
        across * spec.beam * 0.4,
        keelY + 0.1,
        spec.length * (DIVE_WALL_FROM + (DIVE_WALL_TO - DIVE_WALL_FROM) * rng()) - spec.cog.z,
      );
      const up = DIVE_WALL_UP * strength * (1 - 0.5 * across * across) * (0.5 + 0.5 * rng());
      spawn(
        c.x + p.x,
        c.y + p.y,
        c.z + p.z,
        c.vx * 0.6 + rightX * across * 1.2,
        up,
        c.vz * 0.6 + rightZ * across * 1.2,
        0.7 + 0.6 * rng(),
        0.2,
        0.5 + 0.2 * strength,
        0.8,
      );
    }
  }

  const update = (): void => {
    for (let i = 0; i < POOL; i++) {
      const k = i * 3;
      if (age[i] >= life[i]) {
        alphas[i] = 0;
        sizes[i] = 0;
        continue;
      }
      const a = age[i] / life[i];
      positions[k] = px[i];
      positions[k + 1] = py[i];
      positions[k + 2] = pz[i];
      sizes[i] = size0[i] + (size1[i] - size0[i]) * Math.sqrt(a);
      alphas[i] = bright[i] * (1 - a) * (1 - a) * Math.min(1, a * 8);
    }
    posAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
    alphaAttr.needsUpdate = true;
  };

  return {
    group,
    observe,
    update,
    setLens: (pixelHeight, fovDeg) => {
      material.uniforms.uScale.value = pixelHeight / (2 * Math.tan((fovDeg * Math.PI) / 360));
    },
    light: (hemi, key) => {
      const lit = material.uniforms.uLight.value as THREE.Color;
      lit.copy(hemi.groundColor).lerp(hemi.color, SKY_SHARE).multiplyScalar(hemi.intensity);
      lit.r += key.color.r * key.intensity * KEY_SHARE;
      lit.g += key.color.g * key.intensity * KEY_SHARE;
      lit.b += key.color.b * key.intensity * KEY_SHARE;
    },
    setBudget: (share) => {
      budget = Math.max(0, share);
      group.visible = budget > 0;
    },
    setSplashThrow: (share) => {
      splashThrow = clamp(share, 0, 1);
    },
    reset: () => {
      rng = makeRng(7);
      age.fill(1);
      life.fill(0);
      prevAirborne = false;
      prevVy = 0;
      prevSub = 0;
      prevOver = false;
      prevRighting = 0;
      sheetAcc = tailAcc = boilAcc = 0;
    },
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
}
