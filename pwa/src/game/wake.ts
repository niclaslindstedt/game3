// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WAKE: what the craft has done to the water behind it, as a MAP the
// water shader reads. Nothing here is drawn on the sea: the trail is
// rasterised once a frame, from straight above, into a small texture round
// the craft — one channel each for the foam's share, the churn, the crest
// and the hollow — and `water-shader.ts` reads it per pixel and per vertex.
// So the road behind the transom is drawn by the SAME foam term, in the
// same light, with the same tile, as a whitecap out at sea; the churn
// bends the sky the water reflects and lightens the water it aerates; and
// the crest and the hollow move the surface itself, which is the water
// bending for the craft. A ribbon laid over the sea could match none of
// that — it was a second material pretending to be the first.
//
// The shape of it — the road, the boil, the fan, each by speed and by age —
// is `wake-profile.ts`, three-free so a test can hold it. This module lays
// those sections along the trail: a ring buffer of where the transom was,
// one sample per metre or so of travel, and two ribbons through it, a
// narrow long-lived one for the road and a wide short-lived one for the
// fan, both rasterised ADDITIVELY so where they overlap the map carries
// both. A SPLASH — a landing, a bow driven under, a hull coming down on its
// side — is stamped into the same map (`stamp`): the foam patch, the crater
// the hull knocked in the water and the ring wave rolling out of it, laid
// as a fan of rings whose radii sit on those features. And a hull lying on
// its back, or being righted, has the water round it BOILING — the air out
// of the hull, the rider climbing on — which is a mark under the craft laid
// off its state every frame rather than a stamp.
//
// Two cadences. `observe(state)` runs once per ENGINE STEP and only decides
// whether the transom has moved far enough for a new sample (and drops a
// gap sample when the hull leaves the water OR goes astern under its
// bucket, so a flight and a reverse are both a break in the road and not a
// bridge across it). `render(renderer, state)` runs once per FRAME, lays
// the geometry and draws the map. A scene pre-rolled for a screenshot
// observes every step and renders once, and gets the same trail the player
// would see.
//
// Whether the map is drawn at all is the DETAIL row's (`WAKE_LOOK.map`,
// settings-video.ts): switched off, `render` lays nothing and draws nothing,
// and the water reads nothing either (`applyWakeLook`). The trail is still
// SAMPLED — `observe` costs a hypot a step — so a rider who turns the row
// back on mid-run gets the road they have actually laid rather than one
// that starts at the press.

import * as THREE from "three";
import { type GameState } from "@engine";

import { type SplashLook } from "./settings-video.ts";
import { type WakeMap } from "./water-shader.ts";
import {
  FAN_LIFE,
  ROAD_LIFE,
  SPLASH_LIFE,
  SPLASH_STATIONS,
  WAKE_HEIGHT,
  WAKE_MAP,
  WAKE_MAP_BACK,
  WAKE_REACH,
  fanAt,
  fanHalf,
  roadAt,
  roadHalf,
  roadStrength,
  splashAt,
  splashStations,
  wakeSection,
} from "./wake-profile.ts";

/** Trail length in samples and the travel between samples, m — at top speed
 * the road runs out of samples a little after it runs out of the map. Each
 * ribbon carries one row more than the trail: the HEAD row, laid at the
 * transom itself every frame, so the road starts at the hull rather than
 * up to a sample's spacing behind it. */
const SAMPLES = 128;
const ROWS = SAMPLES + 1;
const SPACING = 1.0;
/** Where the trail starts: this far behind the centre of gravity, as a share
 * of the hull's length — the transom, not the seat. */
const STERN = 0.45;
/** Below this along-track speed, m/s, the hull is not laying a trail. */
const SPEED_LIVE = 1;
/** Vertices across each ribbon. The fan's are placed so one stands on its
 * crest (`RIDGE` in the profile) rather than spread evenly. */
const ROAD_ACROSS = 4;
const FAN_S = [-1, -0.85, -0.6, -0.3, 0.3, 0.6, 0.85, 1];
/** The splash stamps: how many ride the water at once, and the segments
 * round each of their rings. */
const STAMPS = 6;
const STAMP_SEGMENTS = 20;
/** THE BOIL under a hull on its back: how long after it goes over the water
 * round it is boiling at full, s — the air coming out of the hull — and how
 * far past the hull's own plan it reaches, as a share of the beam. Its
 * churn is what the map carries most of; a capsized hull is not laying
 * white, it is stirring the water it lies in. */
const BOIL_RISE = 0.5;
const BOIL_PAST_BEAM = 0.6;
const BOIL_FOAM = 0.45;

export type Wake = {
  /** The map as the water reads it (`applyWake`): the texture and the box —
   * the centre's plan coordinates and its reach — held by the water's
   * material as the very objects written here, so a frame's map is read by
   * the frame that made it without anything being copied. */
  map: WakeMap;
  /** Once per engine step: sample the transom. */
  observe: (state: GameState) => void;
  /** A splash: a disc of `radius` m at `strength` 0..1 of white, stamped at
   * the clock's `t`, with a crater `depth` m deep at full (0 for foam alone)
   * and the ring wave that depth throws. */
  stamp: (
    x: number,
    z: number,
    t: number,
    radius: number,
    strength: number,
    depth?: number,
  ) => void;
  /** Once per frame: lay the trail and draw the map. Returns the pass's
   * draw calls and triangles, for the frame's own bill. */
  render: (renderer: THREE.WebGLRenderer, state: GameState) => { calls: number; triangles: number };
  /** Whether the map is rasterised at all — the DETAIL row's `WAKE_LOOK.map`.
   * Off, `render` is free and the map is cleared once so nothing stale is
   * ever read off it. */
  setDrawn: (drawn: boolean) => void;
  /** How much of a splash the map carries — the DETAIL row's `SPLASH_LOOK`:
   * the crater's share, the ring's, and whether a capsized hull's boil is
   * laid. Applies to the stamps already on the water as well as the next. */
  setSplashLook: (look: SplashLook) => void;
  reset: () => void;
  dispose: () => void;
};

/** The material every mark is rasterised with: the vertex's plan position
 * straight to the map's clip space off the box, its colour — foam, churn,
 * crest, hollow — written as it is. Additive, so overlapping marks sum, and
 * the map is cleared to nothing. Neither three's camera nor its colour
 * management touch it: the map is data. */
function markMaterial(box: THREE.Vector3): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uBox: { value: box } },
    vertexShader: `
      uniform vec3 uBox;
      varying vec4 vMark;
      void main() {
        vMark = color;
        gl_Position = vec4((position.xz - uBox.xy) / uBox.z, 0.0, 1.0);
      }`,
    fragmentShader: `
      varying vec4 vMark;
      void main() { gl_FragColor = vMark; }`,
    vertexColors: true,
    // Both faces: a ribbon's winding in plan turns with the heading, and on
    // the inside of a turn it folds over itself.
    side: THREE.DoubleSide,
    transparent: true,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    depthTest: false,
    depthWrite: false,
  });
}

/** A ribbon of `rows` rows by `across` vertices, dynamic in every
 * attribute, with its colour four wide for the four channels. */
function ribbon(rows: number, across: number, material: THREE.Material) {
  const positions = new Float32Array(rows * across * 3);
  const colors = new Float32Array(rows * across * 4);
  const index: number[] = [];
  for (let i = 0; i + 1 < rows; i++) {
    for (let a = 0; a + 1 < across; a++) {
      const p = i * across + a;
      const q = p + across;
      index.push(p, q, p + 1, p + 1, q, q + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage);
  const colAttr = new THREE.BufferAttribute(colors, 4).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("position", posAttr);
  geometry.setAttribute("color", colAttr);
  geometry.setIndex(index);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  return { mesh, geometry, positions, colors, posAttr, colAttr };
}

export function createWake(): Wake {
  // A ring buffer of samples: where the transom was, its heading, when, how
  // fast it was going the way it pointed, how white the pump churned the
  // road (0 for a gap), and the beam it was cut for.
  const sx = new Float32Array(SAMPLES);
  const sz = new Float32Array(SAMPLES);
  const sh = new Float32Array(SAMPLES);
  const st = new Float32Array(SAMPLES);
  const sv = new Float32Array(SAMPLES);
  const ss = new Float32Array(SAMPLES);
  const sb = new Float32Array(SAMPLES);
  const gap = new Uint8Array(SAMPLES);
  let head = 0;
  let filled = 0;

  const box = new THREE.Vector3(0, 0, WAKE_REACH);
  // Mipmapped, regenerated by three after every pass: the water reads the
  // relief and its slope a few levels down, blurred to the grid's scale, and
  // the foam and the churn off the top.
  const target = new THREE.WebGLRenderTarget(WAKE_MAP, WAKE_MAP, {
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: true,
  });
  target.texture.wrapS = target.texture.wrapT = THREE.ClampToEdgeWrapping;
  const material = markMaterial(box);
  const road = ribbon(ROWS, ROAD_ACROSS, material);
  const fan = ribbon(ROWS, FAN_S.length, material);

  // The stamps: a centre vertex and a ring of segments at each station out
  // from it, the stations' radii laid on the splash's features each frame
  // (`splashStations`), so the crater's rim and the ring's crest are each a
  // ring of vertices and never a gap between two.
  const stampX = new Float32Array(STAMPS);
  const stampZ = new Float32Array(STAMPS);
  const stampT = new Float32Array(STAMPS).fill(-1e9);
  const stampR = new Float32Array(STAMPS);
  const stampS = new Float32Array(STAMPS);
  const stampD = new Float32Array(STAMPS);
  let stampCursor = 0;
  const stations = new Float32Array(SPLASH_STATIONS);
  const stampVerts = 1 + (SPLASH_STATIONS - 1) * STAMP_SEGMENTS;
  const stampPositions = new Float32Array(STAMPS * stampVerts * 3);
  const stampColors = new Float32Array(STAMPS * stampVerts * 4);
  const stampIndex: number[] = [];
  for (let p = 0; p < STAMPS; p++) {
    const base = p * stampVerts;
    // The centre's fan to the first ring…
    for (let s = 0; s < STAMP_SEGMENTS; s++) {
      stampIndex.push(base, base + 1 + ((s + 1) % STAMP_SEGMENTS), base + 1 + s);
    }
    // …then a band of quads between each ring and the next.
    for (let k = 1; k + 1 < SPLASH_STATIONS; k++) {
      const inner = base + 1 + (k - 1) * STAMP_SEGMENTS;
      const outer = inner + STAMP_SEGMENTS;
      for (let s = 0; s < STAMP_SEGMENTS; s++) {
        const n = (s + 1) % STAMP_SEGMENTS;
        stampIndex.push(inner + s, outer + n, outer + s, inner + s, inner + n, outer + n);
      }
    }
  }
  const stampGeometry = new THREE.BufferGeometry();
  const stampPos = new THREE.BufferAttribute(stampPositions, 3).setUsage(THREE.DynamicDrawUsage);
  const stampCol = new THREE.BufferAttribute(stampColors, 4).setUsage(THREE.DynamicDrawUsage);
  stampGeometry.setAttribute("position", stampPos);
  stampGeometry.setAttribute("color", stampCol);
  stampGeometry.setIndex(stampIndex);
  const stamps = new THREE.Mesh(stampGeometry, material);
  stamps.frustumCulled = false;

  // The boil under a capsized hull: one fan, the hull's plan as an ellipse,
  // the mark at the centre feathering to nothing at the rim.
  const boilVerts = STAMP_SEGMENTS + 1;
  const boilPositions = new Float32Array(boilVerts * 3);
  const boilColors = new Float32Array(boilVerts * 4);
  const boilIndex: number[] = [];
  for (let s = 0; s < STAMP_SEGMENTS; s++) {
    boilIndex.push(0, 1 + ((s + 1) % STAMP_SEGMENTS), 1 + s);
  }
  const boilGeometry = new THREE.BufferGeometry();
  const boilPos = new THREE.BufferAttribute(boilPositions, 3).setUsage(THREE.DynamicDrawUsage);
  const boilCol = new THREE.BufferAttribute(boilColors, 4).setUsage(THREE.DynamicDrawUsage);
  boilGeometry.setAttribute("position", boilPos);
  boilGeometry.setAttribute("color", boilCol);
  boilGeometry.setIndex(boilIndex);
  const boil = new THREE.Mesh(boilGeometry, material);
  boil.frustumCulled = false;

  // The map's own scene and lens. The lens is never read — the material
  // places every vertex off the box — but three wants one to draw with.
  const marks = new THREE.Scene();
  marks.add(road.mesh, fan.mesh, stamps, boil);
  const lens = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const clearColor = new THREE.Color();
  const section = wakeSection();
  let drawn = true;
  let splash: SplashLook = { crater: 1, ring: 1, throw: 1, boil: true };
  /** Whether the map holds marks that a switched-off pass should wipe. */
  let dirty = false;

  const push = (
    x: number,
    z: number,
    heading: number,
    t: number,
    speed: number,
    strength: number,
    beam: number,
    isGap: boolean,
  ) => {
    sx[head] = x;
    sz[head] = z;
    sh[head] = heading;
    st[head] = t;
    sv[head] = speed;
    ss[head] = strength;
    sb[head] = beam;
    gap[head] = isGap ? 1 : 0;
    head = (head + 1) % SAMPLES;
    if (filled < SAMPLES) filled++;
  };

  /** The transom as it stands: where, how fast the craft is going the way
   * it is POINTING, how white the pump churns, and whether a trail is being
   * laid at all. Reused, never allocated. */
  const transom = { x: 0, z: 0, along: 0, strength: 0, live: false };
  const readTransom = (state: GameState): typeof transom => {
    const c = state.craft;
    const back = c.spec.length * STERN;
    transom.x = c.x - Math.sin(c.heading) * back;
    transom.z = c.z - Math.cos(c.heading) * back;
    // A hull under its bucket stops and then backs up, and a craft moving
    // astern is not laying a trail: it is churning the water it is already
    // sitting in, which the spray's boil draws and this map must not.
    // Reading the sign here rather than off `speed` is the whole point —
    // `speed` is |v| and cannot tell the two apart.
    transom.along = c.vx * Math.sin(c.heading) + c.vz * Math.cos(c.heading);
    transom.live = !c.airborne && c.wetted > 0.05 && transom.along > SPEED_LIVE;
    // How white: pace, and the pump working — a hull coasting leaves a paler
    // road than one on full throttle — and only the flow still leaving
    // astern whitens it: with the bucket part way down, that much of the
    // pump is going forward and under instead, and the road behind pales
    // with it.
    const pump = Math.max(0, c.throttleEff) * (1 - Math.min(1, Math.max(0, c.bucket)));
    transom.strength = roadStrength(transom.along, pump);
    return transom;
  };

  const observe = (state: GameState): void => {
    const c = state.craft;
    const now = readTransom(state);
    const last = filled > 0 ? (head - 1 + SAMPLES) % SAMPLES : -1;
    if (!now.live) {
      // Out of the water, or stopped: one gap sample closes the trail, at
      // the transom, so the last real row fades out where it ended.
      if (last >= 0 && !gap[last]) push(now.x, now.z, c.heading, state.t, 0, 0, c.spec.beam, true);
      return;
    }
    const moved = last < 0 || Math.hypot(now.x - sx[last], now.z - sz[last]) >= SPACING;
    if (!moved) return;
    push(now.x, now.z, c.heading, state.t, now.along, now.strength, c.spec.beam, false);
  };

  const stamp: Wake["stamp"] = (x, z, t, radius, strength, depth = 0) => {
    const p = stampCursor;
    stampCursor = (stampCursor + 1) % STAMPS;
    stampX[p] = x;
    stampZ[p] = z;
    stampT[p] = t;
    stampR[p] = radius;
    stampS[p] = strength;
    // A height channel is eight bits of `WAKE_HEIGHT`, so a crater asked
    // for deeper than that is one the bytes would clamp.
    stampD[p] = Math.min(WAKE_HEIGHT, Math.max(0, depth));
  };

  /** Write one vertex of a mark: its plan place, and the section's four
   * channels scaled by its coverage. */
  const write = (
    positions: Float32Array,
    colors: Float32Array,
    v: number,
    x: number,
    z: number,
    s: typeof section,
  ): void => {
    positions[v * 3] = x;
    positions[v * 3 + 1] = 0;
    positions[v * 3 + 2] = z;
    colors[v * 4] = s.foam * s.cover;
    colors[v * 4 + 1] = s.churn * s.cover;
    colors[v * 4 + 2] = (s.up / WAKE_HEIGHT) * s.cover;
    colors[v * 4 + 3] = (s.down / WAKE_HEIGHT) * s.cover;
  };

  /** One row of both ribbons: the road's section and the fan's across a
   * sample at `(x, z)` with `heading`, laid `age` seconds ago at `speed`
   * with `strength` of white. A dead row has no width and no cover. */
  const row = (
    n: number,
    x: number,
    z: number,
    heading: number,
    age: number,
    speed: number,
    strength: number,
    beam: number,
    dead: boolean,
  ): void => {
    const rv = n * ROAD_ACROSS;
    const fv = n * FAN_S.length;
    const rx = Math.cos(heading);
    const rz = -Math.sin(heading);
    const rHalf = dead || age >= ROAD_LIFE ? 0 : roadHalf(beam, speed, age);
    for (let a = 0; a < ROAD_ACROSS; a++) {
      const s = (a / (ROAD_ACROSS - 1)) * 2 - 1;
      if (rHalf > 0) roadAt(s, age, speed, strength, section);
      else section.cover = 0;
      write(road.positions, road.colors, rv + a, x + rx * rHalf * s, z + rz * rHalf * s, section);
    }
    // The fan: Kelvin's V at the speed this sample was laid at.
    const fHalf = dead || age >= FAN_LIFE ? 0 : fanHalf(beam, speed, age);
    for (let a = 0; a < FAN_S.length; a++) {
      const s = FAN_S[a];
      if (fHalf > 0) fanAt(s, age, speed, strength, section);
      else section.cover = 0;
      write(fan.positions, fan.colors, fv + a, x + rx * fHalf * s, z + rz * fHalf * s, section);
    }
  };

  const lay = (state: GameState): void => {
    const t = state.t;
    // Lay both ribbons oldest to newest. The buffer is a ring: once full,
    // `head` is the oldest sample, and before that the first
    // `SAMPLES - filled` slots are simply unused and folded to nothing.
    for (let n = 0; n < SAMPLES; n++) {
      const i = (head + n) % SAMPLES;
      const has = n >= SAMPLES - filled;
      row(
        n,
        sx[i],
        sz[i],
        sh[i],
        has ? t - st[i] : Infinity,
        sv[i],
        ss[i],
        sb[i],
        !has || gap[i] === 1,
      );
    }
    // …and the head row at the transom as it stands this frame, age nought,
    // so the road begins at the hull. Dead when nothing is being laid, which
    // closes the trail at the last real sample.
    const now = readTransom(state);
    const c = state.craft;
    const last = filled > 0 ? (head - 1 + SAMPLES) % SAMPLES : -1;
    const open = now.live && last >= 0 && gap[last] === 0;
    row(SAMPLES, now.x, now.z, c.heading, 0, now.along, now.strength, c.spec.beam, !open);
    road.posAttr.needsUpdate = true;
    road.colAttr.needsUpdate = true;
    fan.posAttr.needsUpdate = true;
    fan.colAttr.needsUpdate = true;

    // The stamps: each splash's section at every station, round every
    // segment. A dead stamp is folded to its centre with no cover.
    for (let p = 0; p < STAMPS; p++) {
      const base = p * stampVerts;
      const age = t - stampT[p];
      const alive = age >= 0 && age < SPLASH_LIFE;
      const depth = stampD[p] * splash.crater;
      if (alive) splashStations(stampR[p], age, splash.ring, stations);
      else stations.fill(0);
      for (let k = 0; k < SPLASH_STATIONS; k++) {
        const r = stations[k];
        if (alive) splashAt(r, stampR[p], age, stampS[p], depth, splash.ring, section);
        else section.cover = 0;
        const count = k === 0 ? 1 : STAMP_SEGMENTS;
        const first = k === 0 ? base : base + 1 + (k - 1) * STAMP_SEGMENTS;
        for (let s = 0; s < count; s++) {
          const ang = (s / STAMP_SEGMENTS) * Math.PI * 2;
          write(
            stampPositions,
            stampColors,
            first + s,
            stampX[p] + Math.cos(ang) * r,
            stampZ[p] + Math.sin(ang) * r,
            section,
          );
        }
      }
    }
    stampPos.needsUpdate = true;
    stampCol.needsUpdate = true;

    // The boil: the hull's plan under a craft on its back or being righted,
    // churned harder the longer it has lain there, whitened by the air out
    // of it. Folded to nothing on a hull the right way up.
    const stir = !splash.boil ? 0 : c.righting > 0 ? 1 : Math.min(1, c.capsizedFor / BOIL_RISE);
    const fx = Math.sin(c.heading);
    const fz = Math.cos(c.heading);
    const along = (c.spec.length / 2 + c.spec.beam * BOIL_PAST_BEAM) * stir;
    const across = c.spec.beam * (0.5 + BOIL_PAST_BEAM) * stir;
    for (let v = 0; v < boilVerts; v++) {
      const ang = v === 0 ? 0 : ((v - 1) / STAMP_SEGMENTS) * Math.PI * 2;
      const a = v === 0 ? 0 : along * Math.cos(ang);
      const b = v === 0 ? 0 : across * Math.sin(ang);
      section.foam = v === 0 ? BOIL_FOAM * stir : 0;
      section.churn = v === 0 ? stir : 0;
      section.up = 0;
      section.down = 0;
      section.cover = stir > 0 ? 1 : 0;
      write(
        boilPositions,
        boilColors,
        v,
        c.x + fx * a + Math.cos(c.heading) * b,
        c.z + fz * a - Math.sin(c.heading) * b,
        section,
      );
    }
    boilPos.needsUpdate = true;
    boilCol.needsUpdate = true;
  };

  const render: Wake["render"] = (renderer, state) => {
    if (!drawn && !dirty) return { calls: 0, triangles: 0 };
    const c = state.craft;
    // The box stands behind the craft, where the wake is, and snaps to its
    // own texel so the marks are rasterised on the same lattice frame after
    // frame rather than shimmering along their edges.
    const texel = (2 * WAKE_REACH) / WAKE_MAP;
    box.x = Math.round((c.x - Math.sin(c.heading) * WAKE_MAP_BACK) / texel) * texel;
    box.y = Math.round((c.z - Math.cos(c.heading) * WAKE_MAP_BACK) / texel) * texel;
    if (drawn) lay(state);
    renderer.getClearColor(clearColor);
    const clearAlpha = renderer.getClearAlpha();
    renderer.setClearColor(0x000000, 0);
    renderer.setRenderTarget(target);
    renderer.clear();
    if (drawn) renderer.render(marks, lens);
    const cost = drawn
      ? { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }
      : { calls: 0, triangles: 0 };
    renderer.setRenderTarget(null);
    renderer.setClearColor(clearColor, clearAlpha);
    dirty = drawn;
    return cost;
  };

  return {
    map: { texture: target.texture, box },
    observe,
    stamp,
    render,
    setDrawn: (next) => {
      drawn = next;
    },
    setSplashLook: (look) => {
      splash = look;
    },
    reset: () => {
      head = 0;
      filled = 0;
      stampT.fill(-1e9);
    },
    dispose: () => {
      road.geometry.dispose();
      fan.geometry.dispose();
      stampGeometry.dispose();
      boilGeometry.dispose();
      material.dispose();
      target.dispose();
    },
  };
}
