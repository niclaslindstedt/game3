// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// HULL AGAINST HULL — what one rider running into another does to both of
// them. The rocks are `collision.ts`'s and the sea bed is the probes';
// this is the one contact in the game where BOTH sides are a machine with
// a rider on it, and it is stated here rather than in `rivals.ts` so that
// the field's own file stays about the field.
//
// THE HULL IS A SHELL, NOT A CIRCLE. A runabout is three metres long and
// one across, and which END of it you meet is the whole question — so the
// collider is an oriented shell in the hull's own body frame, keel to deck,
// transom to stem, with BOTH its shapes read off the hull's own tables
// (`TUNING.hull.stationTaper` for the plan's draw-in toward a fine bow,
// `.stationRise` for the keel's sweep up to a raised forefoot — the same
// two `hullProbes` is laid out from), so the outside another hull meets can
// never drift from the bottom the water reads. Six faces, and a contact is
// resolved out through whichever of them is the shallowest way back out —
// the minimum-translation rule the ramp's wedge already runs on. That one
// rule is where all three of the behaviours below come from: none is
// special-cased, and none asks which craft hit which.
//
// - IN THE SIDE the shallowest way out is the struck hull's FLANK, whose
//   normal stands square across her keel. She is a wall: the striker's way
//   in that direction is taken off him and none of it is handed back as a
//   turn. What he is left with is the component ALONG her flank, which is
//   the one that carries him up beside her. Keep leaning and a second and
//   third point of his rail come up against hers — a contact MANIFOLD
//   rather than one point — and the couple a manifold carries is what
//   swings the two of them parallel. That is lining up, and it is the
//   geometry doing it rather than a rule about it.
// - IN THE BACK the way out is her TRANSOM, and the push on her runs
//   FORWARD along her keel. Where the striker's bow stands when it arrives
//   is then the whole of it, because a forward push is a couple about her
//   centre of gravity and the sign of that couple is the sign of the
//   HEIGHT. A bow low against her transom pushes BELOW it and lifts her
//   nose — the same reason a thrust line under a boat's centre of gravity
//   trims its bow up. A bow riding high pushes ABOVE it and buries her
//   nose instead; higher still and the way out stops being her transom at
//   all and becomes her DECK, which presses her stern down and stands the
//   striker on his tail. The rider's lean is what moves that bow through
//   all three, so leaning forward and leaning back are two different
//   attacks on the same hull — and the rocker is what makes the range
//   reachable, since a flat-keeled shell would meet every transom at one
//   height. Nothing here knows the word "flip": it is r × F with r read at
//   the height the bow actually is.
// - IN THE FRONT, bow to bow, neither shell is deep along its own length
//   and both points are close to a RAKED flank, so the shallowest way out
//   is sideways on one of them and it leans forward by the bow's own
//   taper. The two are shouldered apart across their keels and each leaves
//   on a course a few degrees off the one he came in on — which is what
//   two fine bows meeting actually do.
//
// THE SOLVER is a sequential-impulse (Gauss–Seidel) contact solver over
// that manifold, in the form Catto (2005) states: a normal impulse per
// contact sized by the effective mass along the contact normal — the
// ROTATIONAL TERM INCLUDED, which is what keeps the spin bounded — a
// Baumgarte velocity bias to push the overlap out, and a Coulomb friction
// impulse across it, clamped to the friction cone. Relaxed twice over the
// whole manifold, because resolving a line contact one point at a time in
// a single pass over-corrects at the first point and throws the hull the
// solver was there to steady.
//
// The rest is dials (`RACE.bump`), named as dials rather than as
// measurements: the three axes of the spin can be traded against each
// other, the couple that squares two rafted hulls up can be leaned on, and
// the whole angular answer has a ceiling. Set the three gains to 1, the
// couple to 0 and the ceiling out of reach and what is left is the
// rigid-body answer.
//
// Nothing here draws, nothing here is random, nothing here reads a clock.

import { rotate, unrotate, type Vec3 } from "../lib/quat.ts";
import { angleDiff, clamp } from "../lib/math.ts";
import type { CraftSpec } from "./defs/craft.ts";
import { RACE } from "./defs/modes.ts";
import { TUNING } from "./defs/tuning.ts";
import { inertia } from "./hull.ts";
import type { CraftState } from "./state.ts";

const B = RACE.bump;
const H = TUNING.hull;

/** One run of the shell's shape: from `z0` to `z1` metres of body frame,
 * the half-beam goes from `w0` to `w1` and the keel from `k0` to `k1`,
 * metres. `rake` is the flank's own slope over that run (dw/dz) and
 * `rocker` the keel's (dk/dz) — the two slopes that make the shell a hull
 * rather than a box, and the two that decide which way a bow arriving at
 * an angle is turned. */
type Run = {
  z0: number;
  z1: number;
  w0: number;
  w1: number;
  k0: number;
  k1: number;
  rake: number;
  rocker: number;
};

/** THE CONTACT SHELL: the hull as the solid a second hull meets, in body
 * frame (x right, y up, z forward, origin at the centre of gravity).
 *
 * It is NOT the buoyancy probes' layout. Those are a BOTTOM, sampled where
 * the water is; this is an OUTSIDE, and a hull's outside includes topsides
 * no probe models. Vertically it runs keel to deck and stops there: a rider
 * is not a wall, and the gap between one hull's deck and the next hull's
 * keel is exactly the clearance a rider flying over a rival's head needs. */
export type HullShell = {
  /** The transom and the stem, m, against the centre of gravity — which
   * does NOT stand amidships (`CraftSpec.cog.z`), so these are not each
   * other's negative and a hull is longer forward of its CoG than aft. */
  readonly aft: number;
  readonly fore: number;
  /** The keel at the TRANSOM — the lowest the shell ever is — and the deck,
   * m, against the centre of gravity. The keel forward of the transom is
   * the runs', because it rises. */
  readonly bottom: number;
  readonly top: number;
  /** The half-beam and the keel along the length, as runs from transom to
   * stem. */
  readonly runs: readonly Run[];
  /** The sphere that contains the whole shell, m — the cull radius, so a
   * pair that cannot touch costs one hypot and no faces. */
  readonly reach: number;
  /** The points this hull is sampled at against another's shell, body
   * frame: the rail at three stations, at the keel and at the deck. Read
   * in a hot loop, so they are laid out once. */
  readonly points: readonly Vec3[];
};

/** Where station `s` of the hull (0 at the transom, 1 at the stem) stands
 * in the body frame, m — the same mapping `hullProbes` lays its probes on,
 * so the shell and the probes describe one hull. */
function stationZ(spec: CraftSpec, s: number): number {
  return (s - 0.5) * spec.length - spec.cog.z;
}

const SHELLS = new WeakMap<CraftSpec, HullShell>();

/** The shell for a spec, built once. Keyed on the spec OBJECT rather than
 * its id because every rival rides a copy of the catalog's spec with its
 * own rider's weight in it (`rivals.ts`): the dimensions are the same
 * either way, and a dozen entries that agree cost less than a rule about
 * when they would not. */
export function hullShell(spec: CraftSpec): HullShell {
  const held = SHELLS.get(spec);
  if (held) return held;
  const aft = stationZ(spec, 0);
  const fore = stationZ(spec, 1);
  const bottom = -spec.cog.y;
  const top = spec.height - spec.cog.y;
  const half = (spec.beam / 2) * B.shellBeam;
  // THE SHAPE IS THE HULL'S OWN, both ways. `stationTaper` is the beam left
  // at each of the six stations the probes stand on and `stationRise` is
  // how far the keel has swept up by each of them — the same two tables
  // `hullProbes` is laid out from, so the shell is the outside of the hull
  // the water is already reading. Aft of the first station both run
  // parallel out to the transom; forward of the last, the last segment's
  // own slope is carried on to the stem, which puts a fine raised point on
  // the bow instead of a blunt square end at 45% of the beam.
  //
  // THE ROCKER IS NOT DRESSING. A planing hull's forefoot sits a third of a
  // metre above its transom, and that third of a metre is the whole
  // difference between a bow that wedges UNDER a rival's stern and one that
  // rides up OVER her transom onto her deck — which is the same contact
  // resolved through two different faces, pitching her two opposite ways.
  const stations = [0, ...H.stations, 1];
  const zs = stations.map((s) => stationZ(spec, s));
  const last = H.stations.length - 1;
  const span = H.stations[last] - H.stations[last - 1];
  const carry = (table: readonly number[], floor: number): number[] => {
    const slope = (table[last] - table[last - 1]) / span;
    return [table[0], ...table, Math.max(floor, table[last] + slope * (1 - H.stations[last]))];
  };
  const ws = carry(H.stationTaper, B.stemBeam).map((t) => half * t);
  const lift = spec.height * spec.bowRise;
  const ks = carry(H.stationRise, H.stationRise[last]).map((r) => bottom + r * lift);
  const runs: Run[] = [];
  for (let i = 0; i < zs.length - 1; i++) {
    const run = zs[i + 1] - zs[i];
    const per = run > 1e-6 ? 1 / run : 0;
    runs.push({
      z0: zs[i],
      z1: zs[i + 1],
      w0: ws[i],
      w1: ws[i + 1],
      k0: ks[i],
      k1: ks[i + 1],
      rake: (ws[i] - ws[i + 1]) * per,
      rocker: (ks[i + 1] - ks[i]) * per,
    });
  }
  // Three stations — transom, the widest part of the run aft, stem — each
  // sampled port and starboard at the shell's own keel there and at the
  // deck. Three is the fewest that can carry a COUPLE down a flank (two
  // rails touching leaves the third free to swing), and the two heights are
  // what let the bow's own attitude decide which face of a rival it finds.
  const points: Vec3[] = [];
  for (const z of [aft, stationZ(spec, 0.4), fore]) {
    const out = spanAt(runs, z);
    for (const side of [-1, 1]) {
      for (const y of [out.keel, top]) points.push({ x: side * out.wide, y, z });
    }
  }
  const shell: HullShell = {
    aft,
    fore,
    bottom,
    top,
    runs,
    reach: Math.hypot(Math.max(-aft, fore), half, Math.max(-bottom, top)),
    points,
  };
  SHELLS.set(spec, shell);
  return shell;
}

/** The shell's section at a station: half the beam and the keel's height,
 * m, and the two slopes there. Written into one reused object, because it
 * is read once per sample point per pair per step. */
const section = { wide: 0, keel: 0, rake: 0, rocker: 0 };

function spanAt(runs: readonly Run[], z: number): typeof section {
  for (const r of runs) {
    if (z > r.z1 && r !== runs[runs.length - 1]) continue;
    const t = r.z1 - r.z0 > 1e-6 ? clamp((z - r.z0) / (r.z1 - r.z0), 0, 1) : 0;
    section.wide = r.w0 + (r.w1 - r.w0) * t;
    section.keel = r.k0 + (r.k1 - r.k0) * t;
    section.rake = r.rake;
    section.rocker = r.rocker;
    return section;
  }
  return section;
}

/** One resolved contact: where it is (world), which way the FIRST hull of
 * the pair has to go to get out of the second (world, unit), and how deep
 * it is (m). */
type Contact = {
  px: number;
  py: number;
  pz: number;
  nx: number;
  ny: number;
  nz: number;
  depth: number;
};

const pool: Contact[] = [];
const manifold: Contact[] = [];

function take(): Contact {
  const held = pool[manifold.length];
  if (held) return held;
  const made = { px: 0, py: 0, pz: 0, nx: 0, ny: 0, nz: 0, depth: 0 };
  pool.push(made);
  return made;
}

/** A point in a shell's own body frame, against that shell: the shallowest
 * way back OUT of it, as a body-frame unit normal written into `out` and a
 * depth returned, or 0 when the point is outside.
 *
 * Two of the six faces are sloped, and each earns its slope: the FLANK
 * leans forward by the run's rake, which is what shoulders two meeting bows
 * apart instead of stopping them dead, and the KEEL leans up by the run's
 * rocker, which is what turns a bow driving in under a stern down and away
 * rather than letting it sit there. */
function exitFace(shell: HullShell, p: Vec3, out: Vec3): number {
  if (p.z < shell.aft || p.z > shell.fore) return 0;
  if (p.y > shell.top || p.y < shell.bottom) return 0;
  const { wide, keel, rake, rocker } = spanAt(shell.runs, p.z);
  if (p.y < keel) return 0;
  const side = p.x >= 0 ? 1 : -1;
  const rl = Math.hypot(1, rake);
  // Distance in along the raked flank's own normal, so a point just inside
  // a fine bow is barely inside it.
  const flank = (wide - side * p.x) / rl;
  if (flank <= 0) return 0;
  let best = flank;
  out.x = side / rl;
  out.y = 0;
  out.z = rake / rl;
  const kl = Math.hypot(1, rocker);
  const faces: readonly (readonly [number, number, number, number])[] = [
    [shell.fore - p.z, 0, 0, 1],
    [p.z - shell.aft, 0, 0, -1],
    [shell.top - p.y, 0, 1, 0],
    [(p.y - keel) / kl, 0, -1 / kl, rocker / kl],
  ];
  for (const [depth, nx, ny, nz] of faces) {
    if (depth >= best) continue;
    best = depth;
    out.x = nx;
    out.y = ny;
    out.z = nz;
  }
  return best;
}

const offset = { x: 0, y: 0, z: 0 };
const bodyNormal = { x: 0, y: 0, z: 0 };

/** Every point of `probe`'s shell that is inside `wall`'s, added to the
 * manifold with the normal turned the way `sign` says the FIRST hull of
 * the pair has to move to get clear. */
function gather(probe: CraftState, wall: CraftState, sign: number): void {
  const ps = hullShell(probe.spec);
  const ws = hullShell(wall.spec);
  for (const p of ps.points) {
    const at = rotate(probe.q, p);
    const px = probe.x + at.x;
    const py = probe.y + at.y;
    const pz = probe.z + at.z;
    offset.x = px - wall.x;
    offset.y = py - wall.y;
    offset.z = pz - wall.z;
    const local = unrotate(wall.q, offset);
    const depth = exitFace(ws, local, bodyNormal);
    if (depth <= 0) continue;
    if (manifold.length >= B.maxContacts) return;
    const n = rotate(wall.q, bodyNormal);
    const c = take();
    c.px = px;
    c.py = py;
    c.pz = pz;
    c.nx = n.x * sign;
    c.ny = n.y * sign;
    c.nz = n.z * sign;
    c.depth = depth;
    manifold.push(c);
  }
}

const spin = { x: 0, y: 0, z: 0 };
const tau = { x: 0, y: 0, z: 0 };

/** The velocity of the point `r` metres off a hull's centre of gravity,
 * world frame, m/s — the hull's own way plus what its rotation adds. */
function pointVelocity(c: CraftState, rx: number, ry: number, rz: number, out: Vec3): void {
  spin.x = c.wx;
  spin.y = c.wy;
  spin.z = c.wz;
  const ww = rotate(c.q, spin);
  out.x = c.vx + (ww.y * rz - ww.z * ry);
  out.y = c.vy + (ww.z * rx - ww.x * rz);
  out.z = c.vz + (ww.x * ry - ww.y * rx);
}

const arm = { x: 0, y: 0, z: 0 };

/** How much mass a hull presents to an impulse along the unit direction
 * `d` applied `r` metres off its centre of gravity — as the INVERSE, the
 * way the solver wants it: 1/m plus the rotational term
 * d · ((I⁻¹(r × d)) × r).
 *
 * Leaving that second term out is what makes a contact hand out FREE
 * rotation: the impulse is sized as if the hull could only slide, and then
 * the same impulse is spent again on turning it. At a metre and a half of
 * lever arm that is a hull pirouetting off a shoulder it should have been
 * nudged by, and it is the single thing most worth having right here. */
function inverseMass(
  c: CraftState,
  I: Vec3,
  rx: number,
  ry: number,
  rz: number,
  dx: number,
  dy: number,
  dz: number,
): number {
  tau.x = ry * dz - rz * dy;
  tau.y = rz * dx - rx * dz;
  tau.z = rx * dy - ry * dx;
  const tb = unrotate(c.q, tau);
  arm.x = tb.x / I.x;
  arm.y = tb.y / I.y;
  arm.z = tb.z / I.z;
  const ww = rotate(c.q, arm);
  const ax = ww.y * rz - ww.z * ry;
  const ay = ww.z * rx - ww.x * rz;
  const az = ww.x * ry - ww.y * rx;
  return 1 / (c.spec.mass + c.spec.riderMass) + (dx * ax + dy * ay + dz * az);
}

/** Apply an impulse of `j` newton-seconds along the unit direction `d` at
 * a point `r` off the hull's centre of gravity. The linear half is exact;
 * the angular half is where the arcade's three gains are spent, and they
 * are spent HERE rather than at the end so that the solver's next pass
 * reads the rates the hull actually came away with. */
function applyImpulse(
  c: CraftState,
  I: Vec3,
  rx: number,
  ry: number,
  rz: number,
  dx: number,
  dy: number,
  dz: number,
  j: number,
): void {
  const m = c.spec.mass + c.spec.riderMass;
  c.vx += (dx * j) / m;
  c.vy += (dy * j) / m;
  c.vz += (dz * j) / m;
  const jx = dx * j;
  const jy = dy * j;
  const jz = dz * j;
  tau.x = ry * jz - rz * jy;
  tau.y = rz * jx - rx * jz;
  tau.z = rx * jy - ry * jx;
  const tb = unrotate(c.q, tau);
  c.wx += (tb.x / I.x) * B.pitchGain;
  c.wy += (tb.y / I.y) * B.yawGain;
  c.wz += (tb.z / I.z) * B.rollGain;
}

/** THE COUPLE THAT SQUARES TWO RAFTED HULLS UP. Three points down a rail
 * carry most of a line contact's couple but not the last of it, and that
 * last of it is exactly what a rider feels as being LINED UP: leaned on
 * along the flank, the two machines settle parallel and run side by side.
 *
 * Stated as an INTERNAL couple — equal and opposite, so the pair's angular
 * momentum is untouched — on the sine of TWICE the heading difference, so
 * that both ways of lying parallel are equilibria and overtaking a rival
 * the other way up the course settles as readily as running with her. It
 * exists only while the two are pressed together and scales with how hard
 * (`press`), and it is weighted by how FLAT the manifold is, so a hull
 * landing on another's deck is not squared up by a contact that is pushing
 * it straight into the air. */
function squareUp(a: CraftState, b: CraftState, impulse: number, flat: number): void {
  if (B.align <= 0 || impulse <= 0) return;
  const mass = a.spec.mass + a.spec.riderMass + b.spec.mass + b.spec.riderMass;
  const press = clamp(impulse / (mass * B.alignFull), 0, 1) * flat;
  if (press <= 0) return;
  const off = angleDiff(a.heading, b.heading);
  const turn = -Math.sin(2 * off) * B.align + (b.wy - a.wy) * B.alignDamp;
  const step = turn * press * TUNING.dt;
  a.wy += step;
  b.wy -= step;
}

/** ...and the ceiling over the whole meeting: one hull against another is
 * worth at most `spinCap` rad/s of fresh rotation, however the arithmetic
 * came out. A rider shoved at a buoy is turned off his line; he is not set
 * spinning like a bottle. Applied to the CHANGE rather than to the rate, so
 * a hull already mid-backflip keeps its flip. */
function capSpin(c: CraftState, wx: number, wy: number, wz: number): void {
  const dx = c.wx - wx;
  const dy = c.wy - wy;
  const dz = c.wz - wz;
  const got = Math.hypot(dx, dy, dz);
  if (got <= B.spinCap) return;
  const k = B.spinCap / got;
  c.wx = wx + dx * k;
  c.wy = wy + dy * k;
  c.wz = wz + dz * k;
}

const rel = { x: 0, y: 0, z: 0 };
const va = { x: 0, y: 0, z: 0 };
const vb = { x: 0, y: 0, z: 0 };

/** RESOLVE ONE PAIR OF HULLS, and say how hard they met: the closing speed
 * at the contact, m/s, or 0 when they never touched. Both states are
 * mutated in place, the way an impulse does.
 *
 * Called once a step per pair, after every hull in the field has moved. */
export function clipHulls(a: CraftState, b: CraftState): number {
  const gap = hullShell(a.spec).reach + hullShell(b.spec).reach;
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  if (Math.abs(dx) > gap || Math.abs(dy) > gap || Math.abs(dz) > gap) return 0;
  if (Math.hypot(dx, dy, dz) > gap) return 0;
  manifold.length = 0;
  // Both ways round: a bow inside a flank and a flank against a bow are
  // different contacts, and a solver handed only one of them lets the
  // other hull through.
  gather(a, b, 1);
  gather(b, a, -1);
  if (manifold.length === 0) return 0;

  // Read once for the pair rather than per contact per pass: the tensor is
  // a function of the spec alone and `inertia` builds a fresh one each call.
  const Ia = inertia(a.spec);
  const Ib = inertia(b.spec);
  const awx = a.wx;
  const awy = a.wy;
  const awz = a.wz;
  const bwx = b.wx;
  const bwy = b.wy;
  const bwz = b.wz;
  let hardest = 0;
  let impulse = 0;
  // How much of this manifold is a SIDE of something rather than a deck or
  // a keel — 1 for a flank or a transom, 0 for a hull sitting on another's
  // deck. It weights the couple, and nothing else.
  let flat = 0;
  for (const c of manifold) flat += 1 - Math.abs(c.ny);
  flat /= manifold.length;

  for (let pass = 0; pass < B.passes; pass++) {
    for (const c of manifold) {
      const rax = c.px - a.x;
      const ray = c.py - a.y;
      const raz = c.pz - a.z;
      const rbx = c.px - b.x;
      const rby = c.py - b.y;
      const rbz = c.pz - b.z;
      pointVelocity(a, rax, ray, raz, va);
      pointVelocity(b, rbx, rby, rbz, vb);
      rel.x = va.x - vb.x;
      rel.y = va.y - vb.y;
      rel.z = va.z - vb.z;
      // The normal points the way `a` has to go to get out of `b`, so a
      // pair closing on each other has a NEGATIVE normal speed.
      const vn = rel.x * c.nx + rel.y * c.ny + rel.z * c.nz;
      if (pass === 0 && -vn > hardest) hardest = -vn;
      const k =
        inverseMass(a, Ia, rax, ray, raz, c.nx, c.ny, c.nz) +
        inverseMass(b, Ib, rbx, rby, rbz, c.nx, c.ny, c.nz);
      if (k <= 0) continue;
      // Baumgarte: the overlap past the slop is pushed out over a share of
      // a step rather than teleported apart. A positional shove cannot be
      // damped and one that grows with depth is a catapult; this one is a
      // VELOCITY, so the restitution and the friction both see it and the
      // next pass can take it back.
      const bias = Math.min(B.maxBias, (B.push * Math.max(0, c.depth - B.slop)) / TUNING.dt);
      const want = -(1 + B.restitution) * Math.min(0, vn) + bias;
      if (want <= 0) continue;
      const jn = want / k;
      applyImpulse(a, Ia, rax, ray, raz, c.nx, c.ny, c.nz, jn);
      applyImpulse(b, Ib, rbx, rby, rbz, -c.nx, -c.ny, -c.nz, jn);
      impulse += jn;
      // COULOMB FRICTION across the contact, clamped to the cone. It is
      // what makes a flank a flank rather than ice: the slide along a
      // rival's side is resisted, so a rider leaning on one loses a little
      // of his way to her and the two of them run on together — which is
      // the other half of lining up.
      pointVelocity(a, rax, ray, raz, va);
      pointVelocity(b, rbx, rby, rbz, vb);
      rel.x = va.x - vb.x;
      rel.y = va.y - vb.y;
      rel.z = va.z - vb.z;
      const rn = rel.x * c.nx + rel.y * c.ny + rel.z * c.nz;
      let tx = rel.x - rn * c.nx;
      let ty = rel.y - rn * c.ny;
      let tz = rel.z - rn * c.nz;
      const ts = Math.hypot(tx, ty, tz);
      if (ts < 1e-4) continue;
      tx /= ts;
      ty /= ts;
      tz /= ts;
      const kt =
        inverseMass(a, Ia, rax, ray, raz, tx, ty, tz) +
        inverseMass(b, Ib, rbx, rby, rbz, tx, ty, tz);
      if (kt <= 0) continue;
      const jt = Math.min(ts / kt, B.friction * jn);
      applyImpulse(a, Ia, rax, ray, raz, -tx, -ty, -tz, jt);
      applyImpulse(b, Ib, rbx, rby, rbz, tx, ty, tz, jt);
    }
  }
  squareUp(a, b, impulse, flat);
  capSpin(a, awx, awy, awz);
  capSpin(b, bwx, bwy, bwz);
  return hardest;
}
