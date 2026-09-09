// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// PLACEHOLDER — the SPRAY will live here: the bow wave thrown off a hull on
// the plane, the sheet off a landing, the rooster tail behind the pump, a
// dive's wall of water, each an engine event or a reading (`planing`,
// `wetted`, `land`, `dive`) turned into a transient in the three.js world.
// That is the `visual-effects` craft, and it is future work.
//
// What IS here is the bare minimum a hull cannot be seen without: a WAKE.
// A short ribbon of foam laid on the water surface behind the craft, one
// segment per metre or so of travel, fading as it ages — cheap (a few
// dozen `surfaceAt` calls a frame so it rides the waves), and enough that a
// craft at speed leaves a mark on the sea instead of sliding over it.

import * as THREE from "three";
import { surfaceAt, type GameState } from "@engine";

import { PALETTE } from "../identity.ts";

/** Ribbon length in samples, the travel between samples, m, and how long a
 * sample lives, s. */
const SAMPLES = 24;
const SPACING = 1.6;
const LIFE = 1.8;
/** How far the ribbon sits over the surface, m, so it is not swallowed by
 * the water it lies on. */
const LIFT = 0.14;
/** The wake's width at the transom, m, how much it spreads per second, and
 * how white it is when fresh — a wash, not a road. */
const WIDTH = 0.8;
const SPREAD = 0.7;
const STRENGTH = 0.38;
/** Where the wake starts: this far behind the centre of gravity, m, as a
 * share of the hull's length — the transom, not the seat. */
const STERN = 0.45;

const FOAM = new THREE.Color(PALETTE.foam);

export type Wake = {
  mesh: THREE.Mesh;
  update: (state: GameState) => void;
  reset: () => void;
};

export function createWake(): Wake {
  // A ring buffer of samples: the position the transom was at, its
  // heading, and when.
  const sx = new Float32Array(SAMPLES);
  const sz = new Float32Array(SAMPLES);
  const sh = new Float32Array(SAMPLES);
  const st = new Float32Array(SAMPLES);
  let head = 0;
  let filled = 0;

  const positions = new Float32Array(SAMPLES * 2 * 3);
  const colors = new Float32Array(SAMPLES * 2 * 4);
  const index: number[] = [];
  for (let i = 0; i + 1 < SAMPLES; i++) {
    const p = i * 2;
    index.push(p, p + 2, p + 1, p + 1, p + 2, p + 3);
  }
  const geometry = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage);
  const colAttr = new THREE.BufferAttribute(colors, 4).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("position", posAttr);
  geometry.setAttribute("color", colAttr);
  geometry.setIndex(index);
  const material = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  const sample = { height: 0, nx: 0, ny: 1, nz: 0, vx: 0, vy: 0, vz: 0 };

  const update = (state: GameState): void => {
    const c = state.craft;
    const t = state.t;
    // A new sample once the transom has moved far enough, and only while
    // the hull is on the water and going somewhere.
    const last = filled > 0 ? (head - 1 + SAMPLES) % SAMPLES : -1;
    const moved =
      last < 0 || Math.hypot(c.x - sx[last], c.z - sz[last]) >= SPACING + c.spec.length * STERN;
    if (moved && !c.airborne && c.speed > 4 && c.wetted > 0.05) {
      const back = c.spec.length * STERN;
      sx[head] = c.x - Math.sin(c.heading) * back;
      sz[head] = c.z - Math.cos(c.heading) * back;
      sh[head] = c.heading;
      st[head] = t;
      head = (head + 1) % SAMPLES;
      if (filled < SAMPLES) filled++;
    }
    // Lay the ribbon oldest to newest, each edge on this frame's surface.
    // The buffer is a ring: once full, `head` is the oldest sample, and
    // before that the first `SAMPLES - filled` slots are simply unused.
    for (let n = 0; n < SAMPLES; n++) {
      const i = (head + n) % SAMPLES;
      const k3 = n * 6;
      const k4 = n * 8;
      if (n >= SAMPLES - filled) {
        const age = t - st[i];
        const alpha = Math.max(0, 1 - age / LIFE) * STRENGTH;
        const half = (WIDTH + SPREAD * age) / 2;
        const rx = Math.cos(sh[i]) * half;
        const rz = -Math.sin(sh[i]) * half;
        for (const side of [0, 1]) {
          const s = side === 0 ? -1 : 1;
          const x = sx[i] + rx * s;
          const z = sz[i] + rz * s;
          surfaceAt(state.sea, state.level, x, z, t, sample);
          positions[k3 + side * 3] = x;
          positions[k3 + side * 3 + 1] = sample.height + LIFT;
          positions[k3 + side * 3 + 2] = z;
          colors[k4 + side * 4] = FOAM.r;
          colors[k4 + side * 4 + 1] = FOAM.g;
          colors[k4 + side * 4 + 2] = FOAM.b;
          colors[k4 + side * 4 + 3] = alpha;
        }
      } else {
        // Nothing here yet: fold the pair onto the craft, invisible.
        for (let j = 0; j < 6; j += 3) {
          positions[k3 + j] = c.x;
          positions[k3 + j + 1] = c.y;
          positions[k3 + j + 2] = c.z;
        }
        colors[k4 + 3] = colors[k4 + 7] = 0;
      }
    }
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  };

  return {
    mesh,
    update,
    reset: () => {
      head = 0;
      filled = 0;
    },
  };
}
