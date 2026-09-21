// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WASH: the waves a hull leaves in the water — the sea's memory of
// having been ridden through. Every other wave in the field is a function
// of (x, z, t) the sea brought with it; these are the ones the craft made,
// and they are real water: the hull's probes read them through `surfaceAt`
// exactly as they read the swell, so a rider crossing his own wake — or a
// rival's — is lifted by it, and the renderer's grid, displaced by the same
// function, draws the very wave he felt.
//
// THE MODEL is Huygens': a hull moving through water is a line of point
// sources, and the V of a wake is what their rings add up to. Each source
// is ONE RING PACKET —
//
//   η(d, τ) = a·(1 − e^(−τ/rise))·e^(−τ/life) · √(birth/d) · (1 − (u/2·width)²)²
//             · cos(k·d − k·(birth + c·τ))
//
// with d the distance from where it was laid, τ its age, u = d − (birth +
// c_g·τ) how far off the packet's centre the point is, and the ring
// standing up over `rise` before it dies over `life`. A ring stands only
// OUTSIDE the birth radius — inside it the water was the hull — and a
// source younger than `young` stands nowhere inside the footprint of the
// hull that laid it, which is now a hull length on and would otherwise be
// riding up on the forward arcs of its own fresh rings. The envelope rides
// out at the GROUP speed and the crests inside it at the PHASE speed, which
// is what a real wave packet does, and the amplitude thins as 1/√d, which
// is a ring's circumference growing. One wavelength serves every source:
// the deep-water wave whose celerity is the hull's HUMP speed
// (`TUNING.wash.hump`), λ = 2π·U²/g, because that is the wave a hull of
// this length is tuned to make and the one it sits in at the hump. A
// moving hull's rings then interfere into the V by themselves — narrowing
// as the speed rises past the celerity, exactly as a planing hull's wake
// does — and a hull with no way on lays rings that simply spread.
//
// WHAT STRIKES A SOURCE is three readings off the craft, summed into one
// amplitude: the PASSAGE (the hull's own displacement shoved aside —
// rising with the square of the speed to the hump and then, as the hull
// comes up on the plane, falling to a fraction), the BOB (the hull's
// plunge rate relative to the water under it, which is the only wake a
// floating hull has, and small), and a SPLASH (a `land` or a `dive`
// event, struck at once rather than on the cadence, because the moment is
// the whole of it). A source under `minCrest` is not laid at all, so a
// hull lying on a flat calm costs the sea nothing.
//
// EACH RIDER HAS A TRAIL (`GameState.wash`) and the sea holds every trail
// on it (`SeaState.washes`) — the player's and every rival's, since a
// rival is a run over the same sea and its wake is on the same water.
// A trail is a ring buffer of sources, laid by `stepWash` once per step
// for the rider that owns it, and read by `washAt` from inside `surfaceAt`
// for anyone at all. Nothing is drawn from `state.rng`; the trail is a
// pure function of the ride, so a run replays it exactly. `place.ts`
// stands a run at a moment with the sea unmarked, which is what a still
// wants.
//
// THE COST is bounded three ways: a trail is at most `maxAge` seconds of
// sources at the cadence (a couple of hundred); a sample first asks whether
// it is inside the trail's box at all — one compare per axis — before it
// asks any source, so the forty thousand vertices of the water grid that
// are nowhere near a wake pay a few nanoseconds each; and a sample that IS
// near one reads a list gathered for the patch of water it stands in
// (`gatherAt`, `GATHER`) rather than walking the trail itself. The age-only
// half of every source (its radius, its faded amplitude, its carrier's
// phase) is refreshed once per distinct `t` and shared by every sample of
// that step or frame.
//
// THAT THIRD BOUND IS WORTH THE PARAGRAPH, because what it fixes is not
// obvious from the model: nine tenths of what the wash cost was DECIDING
// rather than adding waves up. Measured on a twelve-craft race, a sample
// walked 434 slots to find the hundred worth a cosine — and a hull asks for
// the wash once per buoyancy probe, so that walk was done two dozen times
// over for one hull standing in one place. The whole sum of every packet
// was a sixteenth of it. The gather does the deciding once for a patch a
// hull wide and hands the same short list to every probe in it, and because
// it is a SUPERSET walked in the trail's own order, every sample still runs
// the same tests and adds the same terms in the same order: a run replays
// to the bit, and `make sim` comes back byte for byte.

import type { GameEvent, GameState } from "./state.ts";
import { TUNING } from "./defs/tuning.ts";

const W = TUNING.wash;
const TAU = Math.PI * 2;
/** The one wave: its wavenumber, angular frequency, phase and group speed,
 * off the hump speed's deep-water celerity (λ = 2π·U²/g ⇒ k = g/U²). */
export const WASH_K = TUNING.g / (W.hump * W.hump);
export const WASH_OMEGA = Math.sqrt(TUNING.g * WASH_K);
export const WASH_CELERITY = WASH_OMEGA / WASH_K;
export const WASH_GROUP = WASH_CELERITY / 2;
export const WASH_WAVELENGTH = TAU / WASH_K;
/** How far from a source its packet can stand at all, m: the centre at
 * `maxAge` plus the envelope's tail. Past this a source is not asked. */
export const WASH_REACH = W.birth + WASH_GROUP * W.maxAge + 2.5 * W.width;
/** The fastest a hull is allowed to lay sources for, m/s — past this the
 * buffer drops its oldest early, which is the same wake a little shorter. */
const FASTEST = 40;
/** How many sources a trail can hold: `maxAge` worth of passage at that
 * speed and of bob at the cadence, plus room for the splashes. */
const CAPACITY = Math.ceil(W.maxAge * (FASTEST / W.spacing + TUNING.physicsHz / W.every)) + 16;
/** The buffer in CHUNKS of consecutive slots, each with a box of its own.
 * Sources are laid in time order along a trail that is one continuous line,
 * so a chunk is a short stretch of it, and a sample near the hull asks the
 * last chunk or two rather than every source of the last nine seconds. */
const CHUNK = 16;
/** HOW BIG A PATCH OF WATER ONE GATHER SERVES, m. A hull asks for the wash
 * once per buoyancy probe and it has a couple of dozen of them, all inside
 * its own footprint and all at the same instant — so the walk that decides
 * WHICH sources are near enough to matter was being done a couple of dozen
 * times for one answer. It is done once for a patch this wide instead, and
 * every probe inside it reads the short list that came back.
 *
 * Wider is a longer list for everybody; narrower is more walks, and the two
 * cross at about a HULL'S LENGTH — which is the answer reasoning gives as
 * well as the one counting does, since a hull's length is exactly the
 * spread its probes have to be served over. Counted over a twelve-craft
 * race: the walking and the reading together come to 60k slots a tick here
 * against 115k before, and to 62k at either two metres or four. It serves
 * the renderer's grid as well — its vertices arrive in scan order, so a run
 * of them falls in one patch. */
const GATHER = 3;
const CHUNKS = Math.ceil(CAPACITY / CHUNK);

/** One rider's trail: a ring buffer of sources, oldest first from `start`. */
export type Wash = {
  /** Where each source was laid, m, when, s, and how hard, m. */
  readonly x: Float64Array;
  readonly z: Float64Array;
  readonly t0: Float64Array;
  readonly a: Float64Array;
  /** The buffer's first live slot and how many follow it (wrapping). */
  start: number;
  count: number;
  /** The box every live source's packet could reach, m — refreshed when
   * the sources change. `minX > maxX` while the trail is empty. */
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /** ...and the same per chunk of `CHUNK` slots: how many of its slots are
   * live, and the box their packets could reach. A chunk's box only grows
   * while it has a source in it and is reset when it empties. */
  readonly chunkLive: Int32Array;
  readonly chunkMinX: Float64Array;
  readonly chunkMaxX: Float64Array;
  readonly chunkMinZ: Float64Array;
  readonly chunkMaxZ: Float64Array;
  /** The age-only half of every source at `cacheT`, by slot: the packet's
   * radius, m, the amplitude at that age, m, its own rate of change as a
   * share a second (the rise and the decay), and the carrier's phase at
   * d = 0. */
  cacheT: number;
  readonly radius: Float64Array;
  readonly amp: Float64Array;
  readonly ampRate: Float64Array;
  readonly phase0: Float64Array;
  /** The last step a bob source was laid on the cadence, and where the
   * last passage source was laid. */
  lastTick: number;
  lastX: number;
  lastZ: number;
  /** Where the hull laying this trail is NOW, m — the footprint its own
   * young sources are masked inside. NaN while nothing has laid. */
  ownerX: number;
  ownerZ: number;
  /** Whether each source is still younger than `young` at `cacheT`. */
  readonly young: Uint8Array;
  /** THE GATHER (`gatherAt`): the slots whose packets could reach anywhere
   * within `GATHER` of `gatherX, gatherZ` at `gatherT`, in the order the
   * walk would have met them. `gatherT` is NaN while there is none. */
  gatherT: number;
  gatherX: number;
  gatherZ: number;
  gatherN: number;
  readonly gather: Int32Array;
};

export function freshWash(): Wash {
  return {
    gatherT: NaN,
    gatherX: 0,
    gatherZ: 0,
    gatherN: 0,
    gather: new Int32Array(CAPACITY),
    x: new Float64Array(CAPACITY),
    z: new Float64Array(CAPACITY),
    t0: new Float64Array(CAPACITY),
    a: new Float64Array(CAPACITY),
    start: 0,
    count: 0,
    minX: Infinity,
    maxX: -Infinity,
    minZ: Infinity,
    maxZ: -Infinity,
    chunkLive: new Int32Array(CHUNKS),
    chunkMinX: new Float64Array(CHUNKS).fill(Infinity),
    chunkMaxX: new Float64Array(CHUNKS).fill(-Infinity),
    chunkMinZ: new Float64Array(CHUNKS).fill(Infinity),
    chunkMaxZ: new Float64Array(CHUNKS).fill(-Infinity),
    cacheT: NaN,
    radius: new Float64Array(CAPACITY),
    amp: new Float64Array(CAPACITY),
    ampRate: new Float64Array(CAPACITY),
    phase0: new Float64Array(CAPACITY),
    lastTick: -1,
    lastX: NaN,
    lastZ: NaN,
    ownerX: NaN,
    ownerZ: NaN,
    young: new Uint8Array(CAPACITY),
  };
}

/** Forget the trail: a run stood at a moment (`place.ts`) stands on water
 * nothing has been ridden through. */
export function clearWash(w: Wash): void {
  w.start = 0;
  w.count = 0;
  w.minX = w.minZ = Infinity;
  w.maxX = w.maxZ = -Infinity;
  w.amp.fill(0);
  w.chunkLive.fill(0);
  w.chunkMinX.fill(Infinity);
  w.chunkMinZ.fill(Infinity);
  w.chunkMaxX.fill(-Infinity);
  w.chunkMaxZ.fill(-Infinity);
  w.cacheT = NaN;
  w.gatherT = NaN;
  w.gatherN = 0;
  w.lastTick = -1;
  w.lastX = w.lastZ = NaN;
  w.ownerX = w.ownerZ = NaN;
}

/** Lay one source struck with `a` m, either sign; one under `minCrest` is
 * not laid at all, and one past `maxCrest` is capped there. A full buffer
 * drops its oldest. */
function lay(w: Wash, x: number, z: number, t: number, a: number): void {
  if (!(Math.abs(a) >= W.minCrest)) return;
  // A LIST GATHERED BEFORE THIS SOURCE EXISTED DOES NOT KNOW ABOUT IT, and
  // a hull lays into the same instant it reads from. Thrown away here and
  // in `drop`, which is where a trail can change at all — anywhere else and
  // the exactness this is only worth having for is gone.
  w.gatherT = NaN;
  if (a > W.maxCrest) a = W.maxCrest;
  else if (a < -W.maxCrest) a = -W.maxCrest;
  if (w.count === CAPACITY) drop(w);
  const slot = (w.start + w.count) % CAPACITY;
  w.x[slot] = x;
  w.z[slot] = z;
  w.t0[slot] = t;
  w.a[slot] = a;
  w.count++;
  w.cacheT = NaN;
  // The boxes grow at once — a splash is struck between beats, and a
  // source outside its box would be skipped until the next one.
  const c = (slot / CHUNK) | 0;
  const x0 = x - WASH_REACH;
  const x1 = x + WASH_REACH;
  const z0 = z - WASH_REACH;
  const z1 = z + WASH_REACH;
  if (w.chunkLive[c]++ === 0) {
    w.chunkMinX[c] = x0;
    w.chunkMaxX[c] = x1;
    w.chunkMinZ[c] = z0;
    w.chunkMaxZ[c] = z1;
  } else {
    if (x0 < w.chunkMinX[c]) w.chunkMinX[c] = x0;
    if (x1 > w.chunkMaxX[c]) w.chunkMaxX[c] = x1;
    if (z0 < w.chunkMinZ[c]) w.chunkMinZ[c] = z0;
    if (z1 > w.chunkMaxZ[c]) w.chunkMaxZ[c] = z1;
  }
  if (x0 < w.minX) w.minX = x0;
  if (x1 > w.maxX) w.maxX = x1;
  if (z0 < w.minZ) w.minZ = z0;
  if (z1 > w.maxZ) w.maxZ = z1;
}

/** Drop the oldest source: its slot reads as nothing until it is laid
 * again, and its chunk's box is reset once the chunk is empty. */
function drop(w: Wash): void {
  w.gatherT = NaN;
  const slot = w.start;
  w.amp[slot] = 0;
  const c = (slot / CHUNK) | 0;
  if (--w.chunkLive[c] === 0) {
    w.chunkMinX[c] = w.chunkMinZ[c] = Infinity;
    w.chunkMaxX[c] = w.chunkMaxZ[c] = -Infinity;
  }
  w.start = (slot + 1) % CAPACITY;
  w.count--;
  w.cacheT = NaN;
}

/** Drop the sources past `maxAge` — the oldest first, so the buffer is a
 * run of live ones — and refresh the box the rest can reach off the
 * chunks'. */
function expire(w: Wash, t: number): void {
  while (w.count > 0 && t - w.t0[w.start] > W.maxAge) drop(w);
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let c = 0; c < CHUNKS; c++) {
    if (w.chunkLive[c] === 0) continue;
    if (w.chunkMinX[c] < minX) minX = w.chunkMinX[c];
    if (w.chunkMaxX[c] > maxX) maxX = w.chunkMaxX[c];
    if (w.chunkMinZ[c] < minZ) minZ = w.chunkMinZ[c];
    if (w.chunkMaxZ[c] > maxZ) maxZ = w.chunkMaxZ[c];
  }
  w.minX = minX;
  w.maxX = maxX;
  w.minZ = minZ;
  w.maxZ = maxZ;
}

/** THE PASSAGE's amplitude, m, for a hull making `speed` m/s through the
 * water with `planing` of its weight on the lift: the square of the speed
 * to the hump, and a planing hull's share of it past. */
export function passageCrest(speed: number, planing: number): number {
  const s = Math.min(1, (speed * speed) / (W.hump * W.hump));
  return W.crest * s * (1 - (1 - W.planingShare) * planing);
}

/** Lay this step's sources for one rider: a splash for every landing on
 * the step's list, a passage source for every `spacing` of travel, and on
 * the cadence what the hull's bob is worth. Called from `stepRun` after
 * the craft has moved. Every reading is scaled by how much of the bottom
 * is in the water — a hull in the air makes no wave. */
export function stepWash(run: GameState, events: readonly GameEvent[]): void {
  const w = run.wash;
  const c = run.craft;
  const t = run.t;
  w.ownerX = c.x;
  w.ownerZ = c.z;
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.kind !== "land" && e.kind !== "dive") continue;
    const descent = e.kind === "land" ? Math.abs(e.vy) : Math.max(0, e.speed) * 0.5;
    lay(w, c.x, c.z, t, Math.min(W.maxCrest, W.splash * descent));
  }
  // THE PASSAGE: one source per `spacing` of the hull's travel. A hull
  // stood somewhere new — the start, a reset — begins a fresh line rather
  // than laying a source for the distance it was carried.
  const dx = c.x - w.lastX;
  const dz = c.z - w.lastZ;
  const moved = dx * dx + dz * dz;
  if (!(moved < W.spacing * W.spacing)) {
    if (moved <= 4 * W.spacing * W.spacing && c.wetted > 0) {
      lay(w, c.x, c.z, t, c.wetted * passageCrest(Math.abs(c.way), c.planing));
    }
    w.lastX = c.x;
    w.lastZ = c.z;
  }
  // THE BOB, on the cadence: the plunge against the water under the hull,
  // wash included — a hull carried up a swell in step with it shoves
  // nothing aside — and signed, so a heave radiates a train.
  if (run.tick - w.lastTick >= W.every) {
    w.lastTick = run.tick;
    if (c.wetted > 0) {
      const plunge = c.waterVy - c.vy;
      const a = c.wetted * W.bob * plunge;
      lay(w, c.x, c.z, t, a > W.bobMax ? W.bobMax : a < -W.bobMax ? -W.bobMax : a);
    }
    expire(w, t);
  }
}

/** Refresh the age-only half of every source for time `t`. */
function refresh(w: Wash, t: number): void {
  if (w.cacheT === t) return;
  w.cacheT = t;
  for (let j = 0; j < w.count; j++) {
    const i = (w.start + j) % CAPACITY;
    const age = t - w.t0[i];
    w.radius[i] = W.birth + WASH_GROUP * age;
    const risen = 1 - Math.exp(-age / W.rise);
    const decay = age > W.maxAge ? 0 : Math.exp(-age / W.life);
    const amp = w.a[i] * risen * decay;
    // A ring faded under a quarter of the least worth laying is DEAD, and
    // costs a sample one compare rather than a square root and two
    // transcendentals: most of a bobbing hull's rings, most of the time.
    w.amp[i] = Math.abs(amp) < W.minCrest * 0.25 ? 0 : amp;
    // d/dτ of the two envelopes, as a share of their product: the ring
    // still standing up, less the ring dying. A fresh source has risen by
    // nothing, and its share is then the rise's own rate.
    w.ampRate[i] = risen > 1e-9 ? (1 - risen) / (W.rise * risen) - 1 / W.life : 1 / W.rise;
    w.phase0[i] = -WASH_K * (W.birth + WASH_CELERITY * age);
    w.young[i] = age < W.young ? 1 : 0;
  }
}

/** What `washAt` adds to a sample: the height, the surface slope and the
 * water's velocity, all world frame, SI. */
export type WashSample = {
  height: number;
  sx: number;
  sz: number;
  vx: number;
  vy: number;
  vz: number;
};

/** THE PACKET'S WINDOW: (1 − (u/tail)²)², a bump the shape of a Gaussian
 * of `width` that is exactly nothing past `tail` — so a packet has an edge
 * a box test can stand on, and costs no exponential per source. */
const tail = 2 * W.width;
const inv = 1 / (tail * tail);
/** How far inside the birth radius the inner gate closes over, m, and the
 * smoothstep it closes on. */
const GATE = 0.5;
function ramp(s: number): number {
  return s * s * (3 - 2 * s);
}

/** THE WASH AT A POINT: every live source of every trail on the sea, summed
 * into `out`. `fade` is the shallows' cut, 0..1 (`depth / shoal`, clamped
 * by the caller). Zero-cost outside every trail's box. */
/**
 * WALK THE TRAIL ONCE for a patch of water `GATHER` wide, and keep the
 * slots whose packets could reach any part of it.
 *
 * This is the whole of the saving, and it is a saving of BOOKKEEPING rather
 * than of physics: measured on a twelve-craft race, a sample walked 434
 * slots to find the hundred that were actually near enough to be worth a
 * cosine, and it did that again for every one of a hull's two dozen probes.
 * Nine tenths of the wash's cost was the deciding, not the waves.
 *
 * WHAT COMES BACK IS EXACT, and deliberately so: the list is a SUPERSET —
 * every box is grown by the patch's own half-width, so nothing that could
 * matter anywhere in it is dropped — and each sample still runs the same
 * per-source tests it always did, in the same order. The sum is added up in
 * the order the walk would have met it, so a run replays to the bit and no
 * digest moves.
 */
function gatherAt(w: Wash, x: number, z: number, t: number): void {
  refresh(w, t);
  w.gatherT = t;
  w.gatherX = x;
  w.gatherZ = z;
  let n = 0;
  const minX = x - GATHER;
  const maxX = x + GATHER;
  const minZ = z - GATHER;
  const maxZ = z + GATHER;
  for (let c = 0; c < CHUNKS; c++) {
    if (
      w.chunkLive[c] === 0 ||
      maxX < w.chunkMinX[c] ||
      minX > w.chunkMaxX[c] ||
      maxZ < w.chunkMinZ[c] ||
      minZ > w.chunkMaxZ[c]
    )
      continue;
    const end = Math.min(CAPACITY, (c + 1) * CHUNK);
    for (let i = c * CHUNK; i < end; i++) {
      // A dead slot — never laid, dropped, or faded to nothing — is 0.
      if (w.amp[i] === 0) continue;
      const box = w.radius[i] + tail + GATHER;
      const dx = x - w.x[i];
      const dz = z - w.z[i];
      if (dx > box || dx < -box || dz > box || dz < -box) continue;
      w.gather[n++] = i;
    }
  }
  w.gatherN = n;
}

export function washAt(
  washes: readonly Wash[],
  x: number,
  z: number,
  t: number,
  fade: number,
  out: WashSample,
): WashSample {
  let height = 0;
  let sx = 0;
  let sz = 0;
  let vx = 0;
  let vy = 0;
  let vz = 0;
  for (let n = 0; n < washes.length; n++) {
    const w = washes[n];
    if (w.count === 0 || x < w.minX || x > w.maxX || z < w.minZ || z > w.maxZ) continue;
    refresh(w, t);
    // THE OWNER'S FOOTPRINT: how much of a young source stands here — none
    // under the hull that laid it, all of it a gate's width outside.
    const ox = x - w.ownerX;
    const oz = z - w.ownerZ;
    const own = Math.sqrt(ox * ox + oz * oz);
    const mask = !(own < W.birth)
      ? 1
      : own <= W.birth - GATE
        ? 0
        : ramp((own - (W.birth - GATE)) / GATE);
    // THE SHORT LIST for the patch this sample is in, walked once and read
    // by every sample that lands in it. Index order is the walk's own, so
    // the sum is added up in exactly the order it always was.
    if (
      !(w.gatherT === t) ||
      x < w.gatherX - GATHER ||
      x > w.gatherX + GATHER ||
      z < w.gatherZ - GATHER ||
      z > w.gatherZ + GATHER
    )
      gatherAt(w, x, z, t);
    for (let g = 0; g < w.gatherN; g++) {
      const i = w.gather[g];
      const dx = x - w.x[i];
      const dz = z - w.z[i];
      const r = w.radius[i];
      const box = r + tail;
      if (dx > box || dx < -box || dz > box || dz < -box) continue;
      const d = Math.sqrt(dx * dx + dz * dz);
      const u = d - r;
      if (u > tail || u < -tail) continue;
      // INSIDE THE BIRTH RADIUS THERE IS NO WAVE: that water is the hull,
      // and a hull lifted by its own fresh ring would heave itself into
      // one. The gate closes over the inner half-metre so the surface
      // stays smooth for a hull that is passing over an older source.
      if (d <= W.birth - GATE) continue;
      const gate = d >= W.birth ? 1 : ramp((d - (W.birth - GATE)) / GATE);
      const q = 1 - u * u * inv;
      const env = q * q * gate * (w.young[i] ? mask : 1);
      // Under half a millimetre here — the tail of a ring, or a ring
      // nearly dead — is not worth the cosine.
      if (!(Math.abs(w.amp[i]) * env > 5e-4)) continue;
      // Cylindrical spreading: a ring's energy over its circumference, so
      // its amplitude goes as 1/√d.
      const spread = Math.sqrt(W.birth / d);
      const amp = w.amp[i] * spread * env;
      const phase = WASH_K * d + w.phase0[i];
      const cos = Math.cos(phase);
      const sin = Math.sin(phase);
      const eta = amp * cos;
      height += eta;
      // dη/dd: the carrier's own slope, the envelope's, and the spreading's.
      // d(ln window)/du — finite, since |u| < tail keeps q above nothing.
      const dEnv = (-4 * u * inv) / q;
      const dSpread = -0.5 / d;
      const dEta = amp * (cos * (dEnv + dSpread) - sin * WASH_K);
      // ∂η/∂t: the rise and the decay, the envelope going out at the group
      // speed, and the carrier going out at the phase speed.
      const rate = amp * (cos * (w.ampRate[i] - dEnv * WASH_GROUP) + sin * WASH_OMEGA);
      vy += rate;
      if (d > 1e-6) {
        const ux = dx / d;
        const uz = dz / d;
        sx += dEta * ux;
        sz += dEta * uz;
        // Airy's horizontal orbit at the surface, in phase with the height
        // and along the ring's travel: u = ω·η.
        const orbit = WASH_OMEGA * eta;
        vx += orbit * ux;
        vz += orbit * uz;
      }
    }
  }
  out.height = height * fade;
  out.sx = sx * fade;
  out.sz = sz * fade;
  out.vx = vx * fade;
  out.vy = vy * fade;
  out.vz = vz * fade;
  return out;
}
