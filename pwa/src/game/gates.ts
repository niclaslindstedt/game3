// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE COURSE, DRAWN: a water gate is two buoys riding the wave surface
// (the engine's `surfaceAt`, so they bob on the same water the hull does),
// an air gate is a ring standing at its height, and every ring has its
// ramp — a floating deck laid out on the engine's own hinge convention
// (`rampSurface`: the anchor is the hinge at the waterline, the deck runs
// `length` up along `heading` at `angle`) with the lip the collision model
// lets the hull ride behind the hinge. The NEXT gate is lit, a passed gate
// is dimmed, so the course reads at a glance from the saddle.

import * as THREE from "three";
import { gateBuoys, surfaceAt, type GameState, type Level, type Ramp } from "@engine";

import { PALETTE } from "../identity.ts";

const BUOY = new THREE.Color(PALETTE.buoy);
const BUOY_NEXT = new THREE.Color(0xffb14d);
const BUOY_DONE = new THREE.Color(0x7a5a44);
const CAP = new THREE.Color(PALETTE.foam);
const CAP_DONE = new THREE.Color(0x8a8f92);
const RING = new THREE.Color(PALETTE.buoy);
const RING_NEXT = new THREE.Color(0xffc266);
const RING_DONE = new THREE.Color(0x6a5a4c);
const DECK = new THREE.Color(0x5b6b7c);
const RAIL = new THREE.Color(PALETTE.buoy);
const LIP = new THREE.Color(0x3a4756);
const FLOAT = new THREE.Color(0xd9dde0);

/** A buoy's body: a taper from a wide waterline to a narrow shoulder, and
 * its cap. Unit height 1.2 m, waterline at y = 0. */
const BUOY_BODY = new THREE.CylinderGeometry(0.26, 0.46, 0.9, 7, 1);
BUOY_BODY.translate(0, 0.25, 0);
const BUOY_CAP = new THREE.CylinderGeometry(0.1, 0.27, 0.42, 7, 1);
BUOY_CAP.translate(0, 0.9, 0);

export type Gates = {
  group: THREE.Group;
  /** Bob the buoys on this frame's surface and light the next gate. */
  update: (state: GameState) => void;
};

const m = new THREE.Matrix4();
const pos = new THREE.Vector3();
const up = new THREE.Vector3();
const quat = new THREE.Quaternion();
const unit = new THREE.Vector3(1, 1, 1);
const Y = new THREE.Vector3(0, 1, 0);
const color = new THREE.Color();

function buildRamp(ramp: Ramp): THREE.Group {
  const g = new THREE.Group();
  g.position.set(ramp.x, 0, ramp.z);
  g.rotation.y = ramp.heading;
  const flat = (c: THREE.Color) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
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
  const gates = level.course.gates;
  // The buoys, instanced: two per water gate.
  const buoyAt: { gate: number; x: number; z: number }[] = [];
  for (const g of gates)
    for (const b of gateBuoys(g)) buoyAt.push({ gate: g.index, x: b.x, z: b.z });
  const bodies = new THREE.InstancedMesh(
    BUOY_BODY,
    new THREE.MeshLambertMaterial({ flatShading: true }),
    Math.max(1, buoyAt.length),
  );
  const caps = new THREE.InstancedMesh(
    BUOY_CAP,
    new THREE.MeshLambertMaterial({ flatShading: true }),
    Math.max(1, buoyAt.length),
  );
  bodies.count = caps.count = buoyAt.length;
  bodies.frustumCulled = caps.frustumCulled = false;
  group.add(bodies, caps);

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

  let litFor = -1;
  const sample = { height: 0, nx: 0, ny: 1, nz: 0, vx: 0, vy: 0, vz: 0 };

  const update = (state: GameState): void => {
    const next = state.progress.nextGate;
    const { sea, level: lvl, t } = state;
    for (let i = 0; i < buoyAt.length; i++) {
      const b = buoyAt[i];
      surfaceAt(sea, lvl, b.x, b.z, t, sample);
      pos.set(b.x, sample.height, b.z);
      up.set(sample.nx, sample.ny, sample.nz);
      // A buoy leans with the slope it sits on — half of it, since a
      // moored float rights itself against its chain.
      quat.setFromUnitVectors(Y, up.lerp(Y, 0.5).normalize());
      m.compose(pos, quat, unit);
      bodies.setMatrixAt(i, m);
      caps.setMatrixAt(i, m);
    }
    bodies.instanceMatrix.needsUpdate = true;
    caps.instanceMatrix.needsUpdate = true;
    if (next !== litFor) {
      litFor = next;
      for (let i = 0; i < buoyAt.length; i++) {
        const g = buoyAt[i].gate;
        bodies.setColorAt(i, color.copy(g === next ? BUOY_NEXT : g < next ? BUOY_DONE : BUOY));
        caps.setColorAt(i, color.copy(g < next ? CAP_DONE : CAP));
      }
      if (bodies.instanceColor) bodies.instanceColor.needsUpdate = true;
      if (caps.instanceColor) caps.instanceColor.needsUpdate = true;
      for (const r of rings) {
        r.material.color.copy(r.gate === next ? RING_NEXT : r.gate < next ? RING_DONE : RING);
        r.material.emissive.setHex(r.gate === next ? 0x663300 : 0x000000);
      }
    }
  };

  return { group, update };
}
