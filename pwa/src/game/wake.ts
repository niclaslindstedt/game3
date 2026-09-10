// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WAKE: the churned white road a waterjet leaves. A ribbon of foam laid
// on the water surface behind the transom — one sample per metre or so of
// travel, four vertices across so the edges feather out, textured with the
// foam tile so it reads as turbulence rather than paint — widening and
// fading as it ages. It rides the waves: every vertex is put on the
// engine's own `surfaceAt` each frame (a few hundred calls, against the
// water mesh's thousands), so the trail climbs a swell with the water.
//
// Two cadences. `observe(state)` runs once per ENGINE STEP and only decides
// whether the transom has moved far enough for a new sample (and drops a
// gap sample when the hull leaves the water OR goes astern under its
// bucket, so a flight and a reverse are both a break in the road and not a
// bridge across it). `update(state)` runs once per FRAME and
// lays the geometry. A scene pre-rolled for a screenshot observes every
// step and updates once, and gets the same trail the player would see.

import * as THREE from "three";
import { surfaceAt, type GameState } from "@engine";

import { PALETTE } from "../identity.ts";
import { clamp } from "../lib/util.ts";
import { foamTexture } from "./fx-textures.ts";

/** Ribbon length in samples, the travel between samples, m, and how long a
 * sample lives, s — at top speed the ribbon runs out of samples before it
 * runs out of life, at a crawl the other way round. */
const SAMPLES = 64;
const SPACING = 1.0;
const LIFE = 6;
/** How far the ribbon sits over the surface, m, so it is not swallowed by
 * the water it lies on. */
const LIFT = 0.1;
/** The wake's half-width at the transom as a share of the beam, what a m/s
 * of pace adds to it, m, and how fast it spreads with age, m/s. */
const HALF_BEAM = 0.55;
const HALF_PER_SPEED = 0.012;
const SPREAD = 0.55;
/** How white it is when fresh (the vertex alpha the material multiplies the
 * foam tile by), and the power the fade runs on — steep at first, then a
 * long pale tail, the way a wake goes. */
const STRENGTH = 1;
const FADE_POWER = 1.3;
/** Where the flat top of the cross-section ends, as a share of the
 * half-width; outside it the alpha feathers to nothing. */
const CORE = 0.55;
/** Metres of travel per repeat of the foam tile along the ribbon. */
const TILE_ALONG = 5;
/** Where the wake starts: this far behind the centre of gravity, as a share
 * of the hull's length — the transom, not the seat. */
const STERN = 0.45;
/** Below this speed, m/s, nothing is churned; the strength ramps to full
 * over `SPEED_FULL`. */
const SPEED_MIN = 2.5;
const SPEED_FULL = 14;

const ACROSS = 4;
const FOAM = new THREE.Color(PALETTE.foam);

export type Wake = {
  mesh: THREE.Mesh;
  /** Once per engine step: sample the transom. */
  observe: (state: GameState) => void;
  /** Once per frame: lay the ribbon on this instant's water. */
  update: (state: GameState) => void;
  reset: () => void;
  dispose: () => void;
};

export function createWake(): Wake {
  // A ring buffer of samples: where the transom was, its heading, when,
  // how hard the pump was churning (0 is a gap), and the distance run.
  const sx = new Float32Array(SAMPLES);
  const sz = new Float32Array(SAMPLES);
  const sh = new Float32Array(SAMPLES);
  const st = new Float32Array(SAMPLES);
  const ss = new Float32Array(SAMPLES);
  const sw = new Float32Array(SAMPLES);
  const sd = new Float32Array(SAMPLES);
  let head = 0;
  let filled = 0;
  let run = 0;

  const positions = new Float32Array(SAMPLES * ACROSS * 3);
  const colors = new Float32Array(SAMPLES * ACROSS * 4);
  const uvs = new Float32Array(SAMPLES * ACROSS * 2);
  const index: number[] = [];
  for (let i = 0; i + 1 < SAMPLES; i++) {
    for (let a = 0; a + 1 < ACROSS; a++) {
      const p = i * ACROSS + a;
      const q = p + ACROSS;
      index.push(p, q, p + 1, p + 1, q, q + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage);
  const colAttr = new THREE.BufferAttribute(colors, 4).setUsage(THREE.DynamicDrawUsage);
  const uvAttr = new THREE.BufferAttribute(uvs, 2).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("position", posAttr);
  geometry.setAttribute("color", colAttr);
  geometry.setAttribute("uv", uvAttr);
  geometry.setIndex(index);
  const material = new THREE.MeshBasicMaterial({
    map: foamTexture(),
    vertexColors: true,
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  const sample = { height: 0, nx: 0, ny: 1, nz: 0, vx: 0, vy: 0, vz: 0 };

  const push = (x: number, z: number, heading: number, t: number, strength: number, w: number) => {
    const last = filled > 0 ? (head - 1 + SAMPLES) % SAMPLES : -1;
    if (last >= 0) run += Math.hypot(x - sx[last], z - sz[last]);
    sx[head] = x;
    sz[head] = z;
    sh[head] = heading;
    st[head] = t;
    ss[head] = strength;
    sw[head] = w;
    sd[head] = run;
    head = (head + 1) % SAMPLES;
    if (filled < SAMPLES) filled++;
  };

  const observe = (state: GameState): void => {
    const c = state.craft;
    const back = c.spec.length * STERN;
    const tx = c.x - Math.sin(c.heading) * back;
    const tz = c.z - Math.cos(c.heading) * back;
    const last = filled > 0 ? (head - 1 + SAMPLES) % SAMPLES : -1;
    // How fast the craft is going the way it is POINTING. A hull under
    // its bucket stops and then backs up, and a craft moving astern is not
    // laying a road: it is churning the water it is already sitting in,
    // which the spray's boil draws and this ribbon must not. Reading the
    // sign here rather than off `speed` is the whole point — `speed` is
    // |v| and cannot tell the two apart.
    const alongTrack = c.vx * Math.sin(c.heading) + c.vz * Math.cos(c.heading);
    const churning = !c.airborne && c.wetted > 0.05 && alongTrack > SPEED_MIN;
    if (!churning) {
      // Out of the water, or stopped: one gap sample closes the road, at
      // the transom, so the last real segment fades out where it ended.
      if (last >= 0 && ss[last] > 0) push(tx, tz, c.heading, state.t, 0, sw[last]);
      return;
    }
    const moved = last < 0 || Math.hypot(tx - sx[last], tz - sz[last]) >= SPACING;
    if (!moved) return;
    // How white: pace, and the pump working — a hull coasting leaves a
    // paler road than one on full throttle.
    // ...and only the flow still leaving astern whitens it: with the
    // bucket part way down, that much of the pump is going forward and
    // under instead, and the road behind pales with it.
    const pace = clamp((alongTrack - SPEED_MIN) / (SPEED_FULL - SPEED_MIN), 0, 1);
    const pump = clamp(c.throttleEff, 0, 1) * (1 - clamp(c.bucket, 0, 1));
    const strength = pace * (0.55 + 0.45 * pump);
    const half = c.spec.beam * HALF_BEAM + alongTrack * HALF_PER_SPEED;
    push(tx, tz, c.heading, state.t, strength, half);
  };

  const update = (state: GameState): void => {
    const c = state.craft;
    const t = state.t;
    // Lay the ribbon oldest to newest, each row on this frame's surface.
    // The buffer is a ring: once full, `head` is the oldest sample, and
    // before that the first `SAMPLES - filled` slots are simply unused.
    for (let n = 0; n < SAMPLES; n++) {
      const i = (head + n) % SAMPLES;
      const k3 = n * ACROSS * 3;
      const k4 = n * ACROSS * 4;
      const k2 = n * ACROSS * 2;
      if (n >= SAMPLES - filled) {
        const age = t - st[i];
        const fade = Math.pow(Math.max(0, 1 - age / LIFE), FADE_POWER);
        const alpha = fade * ss[i] * STRENGTH;
        const half = sw[i] + SPREAD * age;
        const rx = Math.cos(sh[i]) * half;
        const rz = -Math.sin(sh[i]) * half;
        const u = sd[i] / TILE_ALONG;
        for (let a = 0; a < ACROSS; a++) {
          // Across: −1 at the left edge, +1 at the right; the core is
          // flat, the flanks feather.
          const s = (a / (ACROSS - 1)) * 2 - 1;
          const edge = 1 - clamp((Math.abs(s) - CORE) / (1 - CORE), 0, 1);
          const x = sx[i] + rx * s;
          const z = sz[i] + rz * s;
          surfaceAt(state.sea, state.level, x, z, t, sample);
          positions[k3 + a * 3] = x;
          positions[k3 + a * 3 + 1] = sample.height + LIFT;
          positions[k3 + a * 3 + 2] = z;
          colors[k4 + a * 4] = FOAM.r;
          colors[k4 + a * 4 + 1] = FOAM.g;
          colors[k4 + a * 4 + 2] = FOAM.b;
          colors[k4 + a * 4 + 3] = alpha * edge * edge;
          uvs[k2 + a * 2] = u;
          uvs[k2 + a * 2 + 1] = (s + 1) / 2;
        }
      } else {
        // Nothing here yet: fold the row onto the craft, invisible.
        for (let a = 0; a < ACROSS; a++) {
          positions[k3 + a * 3] = c.x;
          positions[k3 + a * 3 + 1] = c.y;
          positions[k3 + a * 3 + 2] = c.z;
          colors[k4 + a * 4 + 3] = 0;
        }
      }
    }
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    uvAttr.needsUpdate = true;
  };

  return {
    mesh,
    observe,
    update,
    reset: () => {
      head = 0;
      filled = 0;
      run = 0;
    },
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
}
