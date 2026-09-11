// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE COURSE, DRAWN: a water gate is two lit MARKS riding the wave surface
// (the engine's `surfaceAt`, so they bob on the same water the hull does),
// an air gate is a ring standing at its height, and every ring has its
// ramp — a floating deck laid out on the engine's own hinge convention
// (`rampSurface`: the anchor is the hinge at the waterline, the deck runs
// `length` up along `heading` at `angle`) with the lip the collision model
// lets the hull ride behind the hinge. The NEXT gate is lit, a passed gate
// is dimmed, so the course reads at a glance from the saddle.
//
// A MARK IS A LITTLE BROTHER OF THE ROUNDING BUOY (buoys.ts): the same
// moulded-plastic navigation float an exposed coast is actually marked
// with — a wide float collar riding the waterline, a ribbed cone over it
// and a lantern on the top of that — at half the height, since a gate is a
// line to cross rather than a corner to find from a kilometre out. It
// stands 2 m out of the water where a rounding buoy stands four, on a
// 1.3 m collar whose widest point is AT the waterline: a float drawn to
// the surface reads as a cone stuck in the sea, and what says something is
// moored is the shoulder of the collar standing clear of it.
//
// AND THE LANTERN IS WHAT SAYS WHICH GATES ARE STILL AHEAD. A mark's lamp
// burns while its gate is unridden and GOES OUT the moment the line is
// crossed, so the course reads from the saddle as a chain of lights
// running away down the coast with darkness closing up behind — the one
// reading a rider can take at a glance in the dark without looking at the
// minimap. `markLamp` is the whole rule and the only place it is stated;
// the rounding buoys' flash CHARACTER is a different question entirely and
// lives in the engine (`buoyLightAt`), because that one is charted.

import * as THREE from "three";
import { gateBuoys, surfaceAt, type GameState, type Level, type Ramp } from "@engine";

import { PALETTE } from "../identity.ts";
import type { BuoyLamp } from "./buoys.ts";
import { glowTexture } from "./fx-textures.ts";

/** The mark's paint. A gate mark is the yellow-amber of the rounding buoys
 * so the two read as the same furniture at two sizes; the NEXT gate is
 * pulled warmer and brighter, and a gate already crossed goes to a dull
 * weathered tone that keeps its shape without asking to be steered at. */
const HULL = new THREE.Color(0xf0b323);
const HULL_NEXT = new THREE.Color(0xffb14d);
const HULL_DONE = new THREE.Color(0x7a6a4a);
/** The lantern's ironmongery: the flange it stands on and the cap over it.
 * Near-black, because the one strong accent on a yellow float is what picks
 * the lantern out of it at gate range and holds the silhouette when the
 * whole mark is backlit. */
const FITTING = new THREE.Color(0x2e3134);
/** The lens, unlit and lit. A lamp's glass is dark amber with nothing
 * behind it and very nearly white with the lamp on: a lens drawn at its own
 * colour when lit reads as a painted dot rather than as a light. */
const GLASS = new THREE.Color(0x6d5426);
const LENS = new THREE.Color(0xfff2cc);
const RING = new THREE.Color(PALETTE.buoy);
const RING_NEXT = new THREE.Color(0xffc266);
const RING_DONE = new THREE.Color(0x6a5a4c);
const DECK = new THREE.Color(0x5b6b7c);
const RAIL = new THREE.Color(PALETTE.buoy);
const LIP = new THREE.Color(0x3a4756);
const FLOAT = new THREE.Color(0xd9dde0);

/** How far up the lantern's light sits, m above the mark's own waterline —
 * where the lens is centred, where the glare is drawn, and the height the
 * pool on the sea is thrown from. */
const LANTERN_Y = 1.735;

/** What the lamp is worth on a gate STILL AHEAD, as a share of the next
 * gate's. The chain behind the next one is information, not a target, and
 * a course of forty equally bright lamps says nothing about which is
 * which. */
const AHEAD = 0.5;
/** How much of the lamp survives DAYLIGHT, 0..1. A lit mark in sunshine is
 * a wink of glass rather than a beacon — but it is not nothing, or the one
 * reading that says "this gate is still yours" would exist only after
 * dark. */
const BY_DAY = 0.26;
/** The next gate's slow breath: how deep it dips and how fast, rad/s. A
 * lantern that moves is the one the eye goes to first, and at this depth it
 * reads as a light rather than as a fault. */
const BREATH = { depth: 0.12, rate: 2.1 };

/** What a gate mark's lamp is worth on the WATER against what a rounding
 * buoy's is, 0..1. The rounding mark's pool is tuned for a four-metre
 * lantern found from half a kilometre out; this is a small lens a metre and
 * a half up, and a pool as wide as the big one's would read as a gate lit
 * by a floodlight. */
const POOL = 0.42;

/** How wide the glare round a lit lens is drawn, as a share of the frame's
 * HEIGHT, and how far off a mark's lamp has faded to nothing, m.
 *
 * The width is a fixed ANGLE rather than a size in the world, because that
 * is what glare on an eye is: a lamp at 300 m does not shrink out of sight,
 * it stays a point and gets dimmer, and the dimming is what the reach does.
 * A share of the frame rather than a count of pixels because the point
 * shader works in the DRAWING BUFFER's pixels — pinned to a number, the
 * glare would be three times the angle at the bottom of the RESOLUTION row
 * that it is at the top. */
const GLARE = { share: 0.03, reach: 420 };
/** The frame height the glare falls back to until the renderer has said
 * what the buffer is, px. */
const LENS_HEIGHT = 720;

export type Gates = {
  group: THREE.Group;
  /** The lit lanterns as the WATER wants them, refreshed by `update` — the
   * same shape the rounding buoys hand over, so the two lists are picked
   * from together (`nearestLamps` in buoys.ts). */
  lamps: readonly BuoyLamp[];
  /** Bob the marks on this frame's surface, light the next gate and put
   * out the lamps behind it. The camera is wanted for the glare alone,
   * which is dimmed by how far off it is. */
  update: (state: GameState, camera: THREE.Object3D) => void;
  /** How lit the marks' own lamps are, 0..1 — the sky's say
   * (`Preset.lamps`). A channel buoy carries a light because a channel has
   * to be found in the dark, and so do these: the lanterns come up once the
   * sun is down, which is what makes a night course a course rather than a
   * black sea with a minimap. */
  setNight: (lit: number) => void;
  /** How tall the drawing buffer is, px — the glare is a share of it, so a
   * lamp is the same ANGLE of glare at every stop of the RESOLUTION row. */
  setLens: (height: number) => void;
};

/**
 * What a gate mark's lantern is worth at a moment, 0..1 — the one place the
 * rule is stated.
 *
 * `gate` is the mark's own gate index and `next` the gate the run is riding
 * at. A gate already crossed is DARK, which is the whole signal: the lamps
 * ahead of the rider are the gates still owed, and a finished course (every
 * gate behind) is a dark one. The gate being ridden at burns full with a
 * slow breath under it; the rest of the chain burns at `AHEAD`.
 */
export function markLamp(gate: number, next: number, night: number, t: number): number {
  if (gate < next) return 0;
  const sky = BY_DAY + (1 - BY_DAY) * night;
  if (gate > next) return AHEAD * sky;
  return (1 - BREATH.depth + BREATH.depth * Math.sin(t * BREATH.rate)) * sky;
}

const m = new THREE.Matrix4();
const local = new THREE.Matrix4();
const pos = new THREE.Vector3();
const up = new THREE.Vector3();
const world = new THREE.Vector3();
const quat = new THREE.Quaternion();
const unit = new THREE.Vector3(1, 1, 1);
const Y = new THREE.Vector3(0, 1, 0);
const color = new THREE.Color();

/** A solid of revolution from an (r, y) profile in metres, built about the
 * mark's own waterline so the whole thing is simply lifted onto the wave
 * under it every frame. */
function lathe(profile: readonly [number, number][], segments: number): THREE.LatheGeometry {
  return new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(r, y)),
    segments,
  );
}

/** The float: a wide collar straddling the waterline — the widest part of
 * it is AT the water, which is what makes a wave look like it is lifting
 * something moored rather than washing over a post — a flat rim in to the
 * cone's foot, the ribbed cone over that, and the flange the lantern bolts
 * to. The rim is nearly horizontal on purpose: run the collar smoothly into
 * the cone and the whole mark reads as one taper, which is the cone this
 * replaces. */
const BODY = lathe(
  [
    [0.0, -0.62],
    [0.24, -0.6],
    [0.46, -0.5],
    [0.6, -0.34],
    [0.65, -0.16],
    [0.65, 0.3],
    [0.63, 0.38],
    [0.5, 0.4],
    [0.47, 0.46],
    [0.22, 1.3],
    [0.195, 1.38],
    [0.25, 1.4],
    [0.25, 1.46],
    [0.16, 1.48],
    [0.0, 1.48],
  ],
  16,
);

/** The moulded ribs up the cone, standing proud of the flank. Three of
 * them, because the cone is otherwise one unbroken sweep of one colour and
 * reads flat at every range where it matters. */
const RIBS = 3;
const RIB_FLANK = { r0: 0.47, y0: 0.46, r1: 0.22, y1: 1.3 };
const RIB = new THREE.BoxGeometry(
  0.09,
  Math.hypot(RIB_FLANK.r1 - RIB_FLANK.r0, RIB_FLANK.y1 - RIB_FLANK.y0),
  0.07,
);
/** Where each rib stands on one mark, in the mark's own frame. */
const RIB_AT: THREE.Matrix4[] = [];
for (let i = 0; i < RIBS; i++) {
  const a = (i / RIBS) * Math.PI * 2;
  const lean = Math.atan2(RIB_FLANK.r0 - RIB_FLANK.r1, RIB_FLANK.y1 - RIB_FLANK.y0);
  const r = (RIB_FLANK.r0 + RIB_FLANK.r1) / 2 + 0.03;
  RIB_AT.push(
    new THREE.Matrix4()
      .makeRotationY(a)
      .multiply(new THREE.Matrix4().makeTranslation(0, (RIB_FLANK.y0 + RIB_FLANK.y1) / 2, r))
      .multiply(new THREE.Matrix4().makeRotationX(-lean)),
  );
}

/** The lantern's frame: the flange it stands on, the post the lens sleeves
 * over, and the cap over the top — one piece, because a real one is one
 * casting and because a post inside the glass is what stops a lit lens
 * reading as a hollow tube. */
const FRAME = lathe(
  [
    [0.0, 1.48],
    [0.15, 1.49],
    [0.165, 1.55],
    [0.15, 1.59],
    [0.065, 1.61],
    [0.065, 1.82],
    [0.19, 1.87],
    [0.18, 1.94],
    [0.08, 1.98],
    [0.0, 1.99],
  ],
  10,
);

/** The lens: an open sleeve of ridged glass round the post. The ridges are
 * the prisms every real lantern is moulded with, and they are what catches
 * the sun by day — a smooth cylinder at this size is a grey pip. */
const GLASS_LENS = lathe(
  [
    [0.14, 1.6],
    [0.163, 1.635],
    [0.14, 1.67],
    [0.163, 1.705],
    [0.14, 1.74],
    [0.163, 1.775],
    [0.14, 1.81],
    [0.155, 1.845],
    [0.14, 1.87],
  ],
  10,
);

function flat(c: THREE.Color): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color: c, flatShading: true });
}

function buildRamp(ramp: Ramp): THREE.Group {
  const g = new THREE.Group();
  g.position.set(ramp.x, 0, ramp.z);
  g.rotation.y = ramp.heading;
  // The deck: `length` up the slope from the hinge, rotated up about the
  // hinge. A positive rotation about x tips +z DOWN, so the rise is -angle.
  const deck = new THREE.Group();
  deck.rotation.x = -ramp.angle;
  const top = new THREE.Mesh(new THREE.BoxGeometry(ramp.width, 0.22, ramp.length), flat(DECK));
  top.position.set(0, -0.11, ramp.length / 2);
  deck.add(top);
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, ramp.length), flat(RAIL));
    rail.position.set(side * (ramp.width / 2 - 0.09), 0.05, ramp.length / 2);
    deck.add(rail);
  }
  // The lip behind the hinge, in the same plane and under the water.
  const lip = new THREE.Mesh(new THREE.BoxGeometry(ramp.width, 0.18, ramp.length * 0.5), flat(LIP));
  lip.position.set(0, -0.12, -ramp.length * 0.25);
  deck.add(lip);
  g.add(deck);
  // Two floats under the deck, so it reads as something moored rather
  // than a plank the sea forgot.
  const rise = ramp.length * Math.sin(ramp.angle);
  for (const side of [-1, 1]) {
    const float = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.42, ramp.length * 0.9, 7),
      flat(FLOAT),
    );
    float.rotation.x = Math.PI / 2 - ramp.angle;
    float.position.set(
      side * (ramp.width / 2 - 0.5),
      rise / 2 - 0.5,
      (ramp.length * Math.cos(ramp.angle)) / 2,
    );
    g.add(float);
  }
  return g;
}

export function createGates(level: Level): Gates {
  const group = new THREE.Group();
  // R30 — ONE LAP of buoys and rings. A lapped course publishes the whole
  // ride, so the same buoy pair appears in the list once a lap; built from
  // the list as it stands, a three-lap circuit stands three buoys inside
  // each other, flickering against themselves and costing three times the
  // draw. The gate a lit buoy answers to is its own LAP SLOT, which is
  // what `slotOf` turns the run's `nextGate` into.
  const lapGates = level.course.lapGates;
  const gates = level.course.gates.slice(0, lapGates);
  const slotOf = (gate: number): number => (gate >= lapGates ? gate % lapGates : gate);
  // The marks, instanced: two per water gate, and one draw call per part of
  // them however many gates the course has.
  const markAt: { gate: number; x: number; z: number }[] = [];
  for (const g of gates)
    for (const b of gateBuoys(g)) markAt.push({ gate: g.index, x: b.x, z: b.z });
  const n = markAt.length;
  const part = (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    copies = 1,
  ): THREE.InstancedMesh => {
    const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, n * copies));
    mesh.count = n * copies;
    mesh.frustumCulled = false;
    group.add(mesh);
    return mesh;
  };
  const paint = new THREE.MeshLambertMaterial({ flatShading: true });
  const bodies = part(BODY, paint);
  const ribs = part(RIB, paint, RIBS);
  const frames = part(FRAME, flat(FITTING));
  // The lens is unlit by the scene: what it is worth is the LAMP, and a
  // lantern that dims with the sun going down is a lantern nobody would
  // fit. Its instance colour carries the whole of it.
  const lenses = part(GLASS_LENS, new THREE.MeshBasicMaterial({ toneMapped: false }));

  // The glare, as one cloud of points rather than a sprite per mark: a
  // lamp is read as a fixed ANGLE of glare on the eye, which is exactly
  // what a point of a fixed pixel size is, and forty of them cost one draw
  // call. Additive and depth-tested, so a lamp behind a headland is hidden
  // by it and one over the sea lies on top of the water without punching a
  // hole in it.
  const glarePos = new Float32Array(Math.max(1, n) * 3);
  const glareColour = new Float32Array(Math.max(1, n) * 3);
  const glareGeometry = new THREE.BufferGeometry();
  glareGeometry.setAttribute("position", new THREE.BufferAttribute(glarePos, 3));
  glareGeometry.setAttribute("color", new THREE.BufferAttribute(glareColour, 3));
  glareGeometry.setDrawRange(0, n);
  const glare = new THREE.Points(
    glareGeometry,
    new THREE.PointsMaterial({
      map: glowTexture(),
      size: LENS_HEIGHT * GLARE.share,
      sizeAttenuation: false,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  glare.frustumCulled = false;
  group.add(glare);

  // The rings and their ramps.
  const rings: { gate: number; mesh: THREE.Mesh; material: THREE.MeshLambertMaterial }[] = [];
  for (const g of gates) {
    if (g.kind !== "air") continue;
    const material = new THREE.MeshLambertMaterial({ color: RING, flatShading: true });
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(g.width / 2, 0.18, 6, 22), material);
    mesh.position.set(g.x, g.y, g.z);
    // A torus faces along its own z; turned to the gate's heading it faces
    // the approach.
    mesh.rotation.y = g.heading;
    group.add(mesh);
    rings.push({ gate: g.index, mesh, material });
    if (g.ramp) group.add(buildRamp(g.ramp));
  }

  const lamps: BuoyLamp[] = markAt.map((b) => ({ x: b.x, y: LANTERN_Y, z: b.z, lit: 0 }));
  let litFor = -1;
  let night = 0;
  const sample = { height: 0, nx: 0, ny: 1, nz: 0, vx: 0, vy: 0, vz: 0 };

  /** The rings' own light, by how dark it is. Emissive rather than a light
   * in the scene, because forty marks are forty lamps and the one thing a
   * mark's light has to do is be SEEN — it lights nothing but itself. */
  const applyNight = (): void => {
    for (const r of rings) {
      r.material.emissive.setHex(r.gate === litFor ? 0x663300 : 0x000000);
      r.material.emissive.lerp(color.copy(r.material.color).multiplyScalar(0.8), night);
    }
  };

  const update = (state: GameState, camera: THREE.Object3D): void => {
    // The lap slot the run's next gate stands in, and how many of this
    // lap's gates are behind it — the finish is the start line again, so on
    // the last crossing every buoy of the lap is already done.
    const raw = state.progress.nextGate;
    const next = raw >= level.course.gates.length ? lapGates : slotOf(raw);
    const { sea, level: lvl, t } = state;
    camera.getWorldPosition(world);
    for (let i = 0; i < n; i++) {
      const b = markAt[i];
      surfaceAt(sea, lvl, b.x, b.z, t, sample);
      pos.set(b.x, sample.height, b.z);
      up.set(sample.nx, sample.ny, sample.nz);
      // A mark leans with the slope it sits on — half of it, since a
      // moored float rights itself against its chain.
      quat.setFromUnitVectors(Y, up.lerp(Y, 0.5).normalize());
      m.compose(pos, quat, unit);
      bodies.setMatrixAt(i, m);
      frames.setMatrixAt(i, m);
      lenses.setMatrixAt(i, m);
      for (let k = 0; k < RIBS; k++)
        ribs.setMatrixAt(i * RIBS + k, local.multiplyMatrices(m, RIB_AT[k]));

      // THE LAMP: what this mark's gate is worth this frame, and the three
      // things that spend it — the glass, the glare, and the pool the water
      // throws under it.
      const lit = markLamp(b.gate, next, night, t);
      lenses.setColorAt(i, color.copy(GLASS).lerp(LENS, lit));
      const lamp = lamps[i];
      lamp.y = sample.height + LANTERN_Y;
      lamp.lit = lit * POOL;
      // The glare is the NIGHT's alone: by day a lens is a wink of glass
      // and glare painted over it reads as a lens flare on a sunny sea.
      pos.y = sample.height + LANTERN_Y;
      const range = pos.distanceTo(world);
      const seen = lit * night * Math.max(0, 1 - range / GLARE.reach);
      glarePos[i * 3] = pos.x;
      glarePos[i * 3 + 1] = pos.y;
      glarePos[i * 3 + 2] = pos.z;
      glareColour[i * 3] = LENS.r * seen;
      glareColour[i * 3 + 1] = LENS.g * seen;
      glareColour[i * 3 + 2] = LENS.b * seen;
    }
    bodies.instanceMatrix.needsUpdate = true;
    ribs.instanceMatrix.needsUpdate = true;
    frames.instanceMatrix.needsUpdate = true;
    lenses.instanceMatrix.needsUpdate = true;
    if (lenses.instanceColor) lenses.instanceColor.needsUpdate = true;
    glareGeometry.attributes.position.needsUpdate = true;
    glareGeometry.attributes.color.needsUpdate = true;
    if (next !== litFor) {
      litFor = next;
      for (let i = 0; i < n; i++) {
        const g = markAt[i].gate;
        color.copy(g === next ? HULL_NEXT : g < next ? HULL_DONE : HULL);
        bodies.setColorAt(i, color);
        for (let k = 0; k < RIBS; k++) ribs.setColorAt(i * RIBS + k, color);
      }
      if (bodies.instanceColor) bodies.instanceColor.needsUpdate = true;
      if (ribs.instanceColor) ribs.instanceColor.needsUpdate = true;
      for (const r of rings) {
        r.material.color.copy(r.gate === next ? RING_NEXT : r.gate < next ? RING_DONE : RING);
      }
      applyNight();
    }
  };

  return {
    group,
    lamps,
    update,
    setNight: (lit) => {
      if (Math.abs(lit - night) < 0.002) return;
      night = lit;
      applyNight();
    },
    setLens: (height) => {
      (glare.material as THREE.PointsMaterial).size = height * GLARE.share;
    },
  };
}
