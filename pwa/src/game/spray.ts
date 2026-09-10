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
// `airborne`, `submergedDepth` — engine readings, never re-derived), emits,
// and moves every droplet by the engine's own `dt`, so a scene pre-rolled
// for a screenshot carries the same spray the player would have seen.
// `update` runs once per frame and only uploads. The droplets read nothing
// off the sea after they are born — a splash is over before the water
// under it has moved.
//
// Renderer-side and stateless toward the engine: nothing here mutates the
// `GameState`, and the randomness is a local generator reseeded on reset
// so a staged moment always throws the same water.

import * as THREE from "three";
import { TUNING, rotate, type GameState } from "@engine";

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
 * the transom and along the hull instead: a low, wide, white boil rather
 * than an arc. Droplets a second at a full gate, how fast they are thrown
 * forward and out, and how little they are thrown up — a boil that arced
 * would just be a rooster tail pointing the wrong way. */
const BOIL_RATE = 460;
const BOIL_FWD = 2.4;
const BOIL_FWD_PER_THROTTLE = 3.2;
const BOIL_OUT = 2.6;
const BOIL_UP = 1.5;
/** ...and how far forward along the hull the boil reaches, as a share of
 * the length from the transom: the flow runs up under the bottom rather
 * than pooling at one point. */
const BOIL_ALONG = 0.4;
/** THE LANDING PLUME: the descent, m/s, past which a landing is a full
 * splash, and the droplets a full one throws. */
const PLUME_VY = 7;
const PLUME_BURST = 520;
/** THE BOW PLUNGE: the rate the deepest probe goes under, m/s, past which
 * the bow is driving into a face, and the droplets each metre-per-second
 * of it throws a step. */
const PLUNGE_RATE = 1.6;
const PLUNGE_PER_RATE = 5;
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

/** Where a landing's foam goes: the wake's `stamp`. */
export type FoamStamp = (x: number, z: number, t: number, radius: number, strength: number) => void;

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

  /** A landing's foam on the water, into the wake's map — unless the
   * budget is nothing, in which case the sea takes it silently. */
  const patch = (x: number, z: number, t: number, radius: number, strength: number): void => {
    if (budget > 0) stamp(x, z, t, radius, strength);
  };

  // ── Reading the craft ───────────────────────────────────────────────
  let prevAirborne = false;
  let prevVy = 0;
  let prevSub = 0;
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
    // up around the transom and runs along the bottom — white water low to
    // the surface on both sides, going the way the craft is being stopped
    // rather than the way it is pointing. Bigger, shorter-lived droplets
    // than the tail's: a boil is broken water, not spray.
    if (afloat && gateDown > 0.05 && c.throttleEff > 0.08) {
      const strength = gateDown * clamp(c.throttleEff, 0, 1);
      boilAcc += budget * BOIL_RATE * strength * dt;
      while (boilAcc >= 1) {
        boilAcc -= 1;
        const side = rng() < 0.5 ? -1 : 1;
        const along = rng();
        const p = at(
          c,
          side * spec.beam * (0.3 + 0.24 * rng()),
          keelY + 0.02,
          -L / 2 - spec.cog.z + L * BOIL_ALONG * along,
        );
        const fwd = (BOIL_FWD + BOIL_FWD_PER_THROTTLE * strength) * (0.5 + 0.5 * rng());
        const out = BOIL_OUT * (0.3 + 0.7 * rng());
        spawn(
          c.x + p.x,
          c.y + p.y,
          c.z + p.z,
          c.vx * 0.3 + fwdX * fwd + rightX * side * out,
          BOIL_UP * (0.4 + 0.6 * rng()),
          c.vz * 0.3 + fwdZ * fwd + rightZ * side * out,
          0.35 + 0.3 * rng(),
          0.22,
          0.55,
          0.8,
        );
      }
    } else boilAcc = 0;

    // THE LANDING PLUME: the hull coming back down, the whole wet perimeter
    // thrown out at once, sized by how fast it arrived.
    if (prevAirborne && !c.airborne) {
      const strength = clamp((-prevVy - 1) / (PLUME_VY - 1), 0, 1);
      burst(c, budget * (40 + PLUME_BURST * strength), strength, -0.45, 0.45);
      patch(c.x, c.z, state.t, spec.beam * 1.2, 0.5 + 0.5 * strength);
    }
    // THE BOW PLUNGE: the deepest probe going under faster than a hull
    // settling ever does — the bow driving into the next face.
    const plunge = (c.submergedDepth - prevSub) / dt;
    if (afloat && plunge > PLUNGE_RATE && c.speed > 4) {
      const n = Math.min(60, Math.round(plunge * PLUNGE_PER_RATE));
      burst(c, budget * n, clamp(plunge / 6, 0.3, 1), 0.15, 0.48);
    }
    for (const e of state.events) {
      if (e.kind === "dive") {
        burst(c, budget * 220, 1, 0.1, 0.5);
        patch(c.x + fwdX * L * 0.3, c.z + fwdZ * L * 0.3, state.t, spec.beam * 1.4, 1);
      }
    }
    prevAirborne = c.airborne;
    prevVy = c.vy;
    prevSub = c.submergedDepth;

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

  /** `n` droplets off both chines between two shares of the length, out
   * and up in proportion to `strength`. */
  function burst(c: GameState["craft"], count: number, strength: number, from: number, to: number) {
    const n = Math.round(count);
    const spec = c.spec;
    const keelY = -spec.cog.y;
    const rightX = Math.cos(c.heading);
    const rightZ = -Math.sin(c.heading);
    for (let k = 0; k < n; k++) {
      const side = rng() < 0.5 ? -1 : 1;
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
    reset: () => {
      rng = makeRng(7);
      age.fill(1);
      life.fill(0);
      prevAirborne = false;
      prevVy = 0;
      prevSub = 0;
      sheetAcc = tailAcc = boilAcc = 0;
    },
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
}
