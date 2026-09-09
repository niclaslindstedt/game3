// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CRAFT'S BODY, built from its spec. One parametric low-poly jet ski:
// a V hull lofted from cross-sections that take the spec's length, beam,
// depth and deadrise, a deck with a hood rising to the bars, a saddle, a
// handlebar column, a rear tray, the intake grate under the stern and the
// jet nozzle out of the transom. No rider — the rider is future work
// (rider.ts). The four catalog ids share this builder and differ only in
// the dimensions their spec carries and the paint in craft-styles.ts.
//
// BODY FRAME, the engine's: x is the craft's right, y up, z forward, and
// the ORIGIN IS THE CENTRE OF GRAVITY — `spec.cog` says where that sits
// against the keel and the mid-length, so the mesh is laid out around it
// and the renderer only has to put the group at `craft.x/y/z` with the
// state's quaternion. Flat-shaded, vertex-coloured, one draw call for the
// lofted parts and a handful of primitives for the tubes.

import * as THREE from "three";
import type { CraftSpec } from "@engine";

import type { CraftStyle } from "./craft-styles.ts";

const DEG = Math.PI / 180;

/** A pile of coloured triangles, flat-shaded once it is a geometry. */
class Builder {
  private readonly pos: number[] = [];
  private readonly col: number[] = [];
  private readonly c = new THREE.Color();

  tri(a: number[], b: number[], c: number[], color: number): void {
    this.c.setHex(color);
    for (const p of [a, b, c]) {
      this.pos.push(p[0], p[1], p[2]);
      this.col.push(this.c.r, this.c.g, this.c.b);
    }
  }

  /** Two triangles, wound a→b→c→d seen from the outside. */
  quad(a: number[], b: number[], c: number[], d: number[], color: number): void {
    this.tri(a, b, c, color);
    this.tri(a, c, d, color);
  }

  /** An axis-aligned box from its two corners. */
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: number): void {
    const p = (x: number, y: number, z: number) => [x, y, z];
    const a = p(x0, y0, z0);
    const b = p(x1, y0, z0);
    const c = p(x1, y1, z0);
    const d = p(x0, y1, z0);
    const e = p(x0, y0, z1);
    const f = p(x1, y0, z1);
    const g = p(x1, y1, z1);
    const h = p(x0, y1, z1);
    this.quad(d, c, b, a, color); // back (-z), seen from behind
    this.quad(e, f, g, h, color); // front (+z)
    this.quad(a, b, f, e, color); // bottom
    this.quad(h, g, c, d, color); // top
    this.quad(e, h, d, a, color); // left (-x)
    this.quad(b, c, g, f, color); // right (+x)
  }

  geometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 3));
    g.computeVertexNormals();
    return g;
  }
}

/** Stations along the hull, transom (0) to bow (1). Dense toward the bow,
 * where the taper and the rise are. */
const STATIONS = [0, 0.16, 0.34, 0.5, 0.64, 0.76, 0.86, 0.94, 1];

/** How much of the half-beam a station keeps: full to midships, then the
 * bow's taper to a near-point. */
function taper(s: number): number {
  if (s < 0.5) return 1;
  const u = (s - 0.5) / 0.5;
  return 1 - 0.88 * u * u;
}

/** How far the keel has risen toward the bow, as a share of the depth. */
function rise(s: number): number {
  if (s < 0.55) return 0;
  const u = (s - 0.55) / 0.45;
  return 0.6 * u * u;
}

/** The deck's crown over the gunwale, as a share of the depth: flat over
 * the footwells aft, a hood swelling up to the column and falling to the
 * bow. */
function crown(s: number): number {
  if (s < 0.42) return 0.05;
  const u = (s - 0.42) / 0.58;
  return 0.05 + 0.42 * Math.sin(Math.PI * Math.min(1, u * 1.15)) ** 2 * (1 - 0.5 * u);
}

/** The whole craft, at the origin, ready for a quaternion. */
export function buildCraft(spec: CraftSpec, style: CraftStyle): THREE.Group {
  const L = spec.length;
  const B = spec.beam;
  const H = spec.height;
  const dead = Math.tan(spec.deadrise * DEG);
  // The mid-length sits `cog.z` BEHIND the centre of gravity's z... the
  // spec quotes the CoG `z` ahead of mid-length, so mid-length is at -z.
  const zMid = -spec.cog.z;
  const zTransom = zMid - L / 2;
  const keelY = -spec.cog.y;
  const gunwaleY = keelY + H;

  const b = new Builder();

  // THE HULL, lofted. Each station is a ring of eight points, port to
  // starboard by way of the deck: keel, chine, gunwale, deck edge, crown,
  // and back down the other side.
  type Ring = number[][];
  const rings: Ring[] = STATIONS.map((s) => {
    const z = zTransom + s * L;
    const half = (B / 2) * taper(s);
    const ky = keelY + rise(s) * H;
    const chineY = Math.min(ky + half * dead, gunwaleY - 0.12 * H);
    const sheer = gunwaleY + 0.1 * H * s * s;
    const deckY = sheer + crown(s) * H;
    const edge = half * 0.62;
    return [
      [0, ky, z],
      [half, chineY, z],
      [half * 1.02, sheer, z],
      [edge, deckY - 0.03 * H, z],
      [0, deckY, z],
      [-edge, deckY - 0.03 * H, z],
      [-half * 1.02, sheer, z],
      [-half, chineY, z],
    ];
  });
  const paint = [
    style.hull,
    style.topside,
    style.deck,
    style.deck,
    style.deck,
    style.deck,
    style.topside,
    style.hull,
  ];
  for (let i = 0; i + 1 < rings.length; i++) {
    const r0 = rings[i];
    const r1 = rings[i + 1];
    for (let k = 0; k < 8; k++) {
      const k1 = (k + 1) % 8;
      // The ring runs counter-clockwise seen from the bow, so stepping
      // along it and then forward winds every panel's outside out.
      b.quad(r0[k], r0[k1], r1[k1], r1[k], paint[k]);
    }
  }
  // The transom: a fan over the stern ring, seen from behind.
  const stern = rings[0];
  for (let k = 1; k + 1 < 8; k++) b.tri(stern[0], stern[k + 1], stern[k], style.topside);
  // The bow: the last ring is nearly a point; cap it.
  const bow = rings[rings.length - 1];
  for (let k = 1; k + 1 < 8; k++) b.tri(bow[0], bow[k], bow[k + 1], style.deck);

  // THE SADDLE: a wedge on the deck, narrower on top, its nose a little
  // lower than its tail so a rider sits INTO it.
  const seatZ0 = zTransom + 0.2 * L;
  const seatZ1 = zMid + 0.2 * L;
  const seatW = 0.36 * B;
  const seatBase = gunwaleY + 0.06 * H;
  const seatH = 0.42 * H;
  {
    const p = (x: number, y: number, z: number) => [x, y, z];
    const w0 = seatW / 2;
    const w1 = seatW * 0.36;
    const back = [
      p(-w0, seatBase, seatZ0),
      p(w0, seatBase, seatZ0),
      p(w1, seatBase + seatH, seatZ0 + 0.05),
      p(-w1, seatBase + seatH, seatZ0 + 0.05),
    ];
    const front = [
      p(-w0, seatBase, seatZ1),
      p(w0, seatBase, seatZ1),
      p(w1, seatBase + seatH * 0.8, seatZ1 - 0.1),
      p(-w1, seatBase + seatH * 0.8, seatZ1 - 0.1),
    ];
    b.quad(back[3], back[2], back[1], back[0], style.seat);
    b.quad(front[0], front[1], front[2], front[3], style.seat);
    b.quad(back[2], back[3], front[3], front[2], style.seat); // top
    b.quad(back[1], back[2], front[2], front[1], style.seat); // right
    b.quad(back[3], back[0], front[0], front[3], style.seat); // left
  }

  // THE REAR TRAY: the rubber footplate behind the saddle, and the two
  // footwell mats either side of it.
  b.box(
    -0.3 * B,
    gunwaleY + 0.05 * H,
    zTransom + 0.04 * L,
    0.3 * B,
    gunwaleY + 0.08 * H,
    seatZ0 - 0.02,
    style.tray,
  );
  b.box(-0.47 * B, gunwaleY + 0.05 * H, seatZ0, -0.2 * B, gunwaleY + 0.075 * H, seatZ1, style.tray);
  b.box(0.2 * B, gunwaleY + 0.05 * H, seatZ0, 0.47 * B, gunwaleY + 0.075 * H, seatZ1, style.tray);

  // THE INTAKE GRATE under the stern and the NOZZLE out of the transom.
  b.box(
    -0.11 * B,
    keelY - 0.02,
    zTransom + 0.06 * L,
    0.11 * B,
    keelY + 0.01,
    zTransom + 0.24 * L,
    style.tray,
  );
  b.box(
    -0.06,
    keelY + 0.05 * H,
    zTransom - 0.1,
    0.06,
    keelY + 0.25 * H,
    zTransom + 0.02,
    style.grip,
  );

  const group = new THREE.Group();
  const body = new THREE.Mesh(
    b.geometry(),
    new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
  );
  group.add(body);

  // THE BARS: a column rising from the hood, raked back, with a crossbar
  // and two grips. Primitives, since they are tubes.
  const colZ = zMid + 0.26 * L;
  const colBase = gunwaleY + crown(0.66) * H + 0.02;
  const colLen = 0.55 * H + 0.12;
  const rake = 22 * DEG;
  const column = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.045, colLen, 6),
    new THREE.MeshLambertMaterial({ color: style.bar, flatShading: true }),
  );
  column.position.set(
    0,
    colBase + (colLen / 2) * Math.cos(rake),
    colZ - (colLen / 2) * Math.sin(rake),
  );
  // A positive rotation about x tips the top forward; the column leans
  // back toward the rider.
  column.rotation.x = -rake;
  group.add(column);
  const barY = colBase + colLen * Math.cos(rake);
  const barZ = colZ - colLen * Math.sin(rake);
  const barW = Math.min(0.72, 0.6 * B);
  const bar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, barW, 6),
    new THREE.MeshLambertMaterial({ color: style.bar, flatShading: true }),
  );
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, barY, barZ);
  group.add(bar);
  const gripGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.13, 6);
  const gripMat = new THREE.MeshLambertMaterial({ color: style.grip, flatShading: true });
  for (const side of [-1, 1]) {
    const grip = new THREE.Mesh(gripGeo, gripMat);
    grip.rotation.z = Math.PI / 2;
    grip.position.set(side * (barW / 2 - 0.06), barY, barZ);
    group.add(grip);
  }
  // A small hood cowl under the bars, so the column rises out of something.
  const cowl = new THREE.Mesh(
    new THREE.BoxGeometry(0.34 * B, 0.12 * H, 0.16 * L),
    new THREE.MeshLambertMaterial({ color: style.seat, flatShading: true }),
  );
  cowl.position.set(0, colBase + 0.02, colZ - 0.02 * L);
  group.add(cowl);
  return group;
}
