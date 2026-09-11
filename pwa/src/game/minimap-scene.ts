// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MINIMAP'S SCHEMATIC — the water and the shore around the craft, seen
// from above. Adapted from the rally game's, which draws a country of roads;
// this one draws a coast.
//
// The map does not show the whole course. It shows a fixed square of WORLD,
// `SPAN` metres across, with the craft in the middle of it, and it travels
// with the craft wherever the craft goes — down the line, out to sea, back
// over a reef it has just bounced off. That is the whole reason it exists: a
// 1.6 km course squeezed into a seven-rem box is a squiggle with a dot on
// it, and the one question a rider actually asks the map — what is coming,
// and which way is the line from here — is the one question that framing
// cannot answer.
//
// What it draws is a CARTOON of the coast, and the whole of it is cut from
// ONE ladder of ground heights (`BANDS`): the deepest water is the plate's
// own ground, the shelf and the shallows are bands over it, the land is a
// band over those and the bare headland a band over that, with the
// shoreline stroked between. Every rock is a disc and the racing line a
// ribbon along the shore. Nothing here is to scale except the ground itself
// — a two-metre boulder at this framing is under a pixel, so a rock is drawn
// with a floor under its radius and the line is drawn several times its
// width. The exaggeration is the map.
//
// The bands are CUT THROUGH the lattice rather than built out of whole
// cells of it, which is what lets the lattice stay coarse (and the cut
// cheap) while the coast comes out a coastline instead of a staircase.
//
// SIGN BOUNDARY: the one flip is `input-model.ts`'s `SCREEN_TO_ENGINE`, and
// this file is downstream of it. The renderer maps the engine's axes onto
// three.js's y-up frame, whose top-down view MIRRORS the map, so the map
// draws in SCREEN space — `mx = -x`, `my = -z` — which puts a
// heading-growing turn on the LEFT of the picture, exactly as the rider sees
// it through the chase camera: a thumb pushed right swings the icon
// clockwise. North is up and east is left, which is the price of that
// agreement and the right price to pay — the map answers to the screen, not
// to a chart.
//
// THE ANCHOR is what keeps this affordable. The paths are built around a
// world point that only moves when the craft has travelled `REBUILD` metres
// from it, and the whole schematic is then TRANSLATED by the offset between
// that anchor and the craft. So the map scrolls smoothly every snapshot
// while the geometry behind it is rebuilt a couple of times a second.

import { sampleField, type GameState, type Level, type Solid, type Vec2 } from "@engine";

import { TREE_LINE } from "./flora-defs.ts";

/** The map's own square user space; everything below is in these units. */
export const VIEW = 100;

/** How much sea the box holds, edge to edge, m, at the middle of the
 * speedo's range. It is the figure the zoom below works from rather than
 * one the map often sits at.
 *
 * Gates on a generated course stand a hundred-odd metres apart and the line
 * runs forty to seventy metres off the shore, so three hundred metres holds
 * the next gate, the one after it, and the beach the line is drawn against
 * — which is the shape of the decision a rider is making. */
export const SPAN = 320;

/** ...and how the window BREATHES with the speedo, which is the one thing on
 * the map a rider reads without looking at it.
 *
 * What the map owes the rider is a fixed amount of WARNING, and warning is
 * time rather than distance: at twenty-four metres a second the same three
 * hundred metres is half the notice it was at twelve. So the window is tied
 * to the speedo at BOTH ends rather than merely stretched at the top. Idling
 * through a skerry field it closes right in and the map is a plan of the
 * water under the hull; on the plane it opens to most of half a kilometre
 * and the map is the sea about to arrive. The zoom is then something the eye
 * reads as SPEED — the coast visibly pulling back as the craft winds up, and
 * settling as it comes off the throttle for a buoy.
 *
 * `at` is the speed the opening is full at (km/h — a little under the
 * fastest craft's top, so the map is fully open on the plane rather than
 * only at the limiter), `close` the fraction of `SPAN` shown at a
 * standstill, and `far` the fraction shown at `at` and above. The two stops
 * are more than three times apart, because a breath the rider has to be
 * told about is not one the eye reads as speed. */
const ZOOM = { at: 80, close: 0.5, far: 1.7 };

/** The window this frame: the base framing, closed or opened by the
 * speedo. */
export function spanFor(base: number, speedKmh: number): number {
  const t = Math.min(1, Math.max(0, speedKmh / ZOOM.at));
  return base * (ZOOM.close + (ZOOM.far - ZOOM.close) * t);
}

/** How long the window takes to follow the speedo, s of e-folding.
 *
 * The reading it follows is `CraftState.speed`, which is `|v|` with the
 * vertical in it — so on a chop it carries every crest the hull drops off,
 * several a second, and a window wired straight to it PUMPS. What the zoom
 * is for is the difference between idling and planing, which is a thing
 * that takes seconds, so the window is given a lag about as long as a hull
 * takes to come up on the plane: it opens as the craft winds up, holds
 * through the slam, and settles as the throttle comes off for a buoy. */
const ZOOM_LAG = 0.5;

/** …and where it has got to. Frame state, like the cut above: the level it
 * belongs to, the clock it was last moved on, and the span it had reached.
 */
let zoom: { level: Level; t: number; span: number } | null = null;

/** THE WINDOW AS THE RIDER SEES IT BREATHE — `spanFor`'s answer, chased
 * rather than jumped to.
 *
 * Keyed off the ENGINE's clock, so it neither runs at the browser's frame
 * rate nor moves at all while a run is held behind the pause card. A clock
 * that has gone backwards is a fresh run at the same level, which lands the
 * window rather than sliding it back down the coast. */
export function spanNow(level: Level, base: number, speedKmh: number, t: number): number {
  const want = spanFor(base, speedKmh);
  const last = zoom;
  if (last === null || last.level !== level || t < last.t) {
    zoom = { level, t, span: want };
    return want;
  }
  const dt = Math.min(1, t - last.t);
  const span = last.span + (want - last.span) * (1 - Math.exp(-dt / ZOOM_LAG));
  zoom = { level, t, span };
  return span;
}

/** The span the geometry is actually CUT at, m — the shown span rounded up
 * to a step. The cut is the expensive half and the zoom moves every frame,
 * so the two are separated: the paths are cut at a span that changes a few
 * times a run, and the difference between that and the span being shown is
 * carried as a SCALE on the group.
 *
 * Rounding UP is what makes it safe: the cut always covers at least the box
 * being shown, so the scale only ever magnifies country that was drawn. And
 * because the scale compensates the cut exactly, crossing a step is
 * invisible — the same picture, cut at a different size. */
const CUT_STEP = 40;

/** How far the craft may travel from the anchor before the schematic is cut
 * again, m. Under a second of riding, so the geometry never lags the window
 * by more than the margin below. */
const REBUILD = 20;

/** How far past the box the schematic is built, view units. It covers the
 * anchor's slack (`REBUILD` metres of it) plus the half-width of the widest
 * stroke, so nothing pops into existence at the frame's edge. */
const MARGIN = 16;

/** HOW FINE THE GROUND LATTICE IS, as cells across the box.
 *
 * A cell fixed in METRES is a cell that costs four times as much every time
 * the window doubles, and the window here more than triples between a
 * standstill and the plane: at the open end a six-metre lattice was ten
 * thousand cells and sixty kilobytes of path, rebuilt about once a second
 * on the thread the sea is drawn on. Fixed in CELLS ACROSS, the cut costs
 * the same at every zoom and the map's detail is what it always was —
 * because what the eye can resolve is a share of the box, not a number of
 * metres.
 *
 * The cells are not what is drawn, either: the bands are cut THROUGH them
 * (`cellAbove`), so a coarse lattice buys a cheap cut rather than a
 * staircase. */
const GROUND_CELLS = 55;

/** …and the metre ladder that count is rounded onto, so the lattice takes a
 * handful of values over a run rather than a new one per re-cut. A lattice
 * is a cache key (`bedAt`), and one that moved with the span would throw
 * every sampled node away on each step of the zoom. */
const CELL_STEP = 2;
const CELL_RANGE = { min: 4, max: 14 };

/** The lattice for a window this wide, m. */
function cellFor(span: number): number {
  const want = Math.round(span / GROUND_CELLS / CELL_STEP) * CELL_STEP;
  return Math.min(CELL_RANGE.max, Math.max(CELL_RANGE.min, want));
}

/** WHERE THE GROUND IS BANDED, m against sea level, lowest first — the one
 * ladder the whole plan is cut at, water and shore alike.
 *
 * BELOW THE WATERLINE it is a nautical chart's idea. A two-tone plan —
 * water and not-water — leaves the biggest thing on the map saying almost
 * nothing: every piece of sea looks like every other, and the rider cannot
 * tell the channel he is in from the bank he is about to run onto. So the
 * bed gets two rungs: the SHELF, where the bottom has come up far enough to
 * be worth knowing about, and the SHALLOWS, where a wave stands up on it
 * and a hull dropping off one can touch.
 *
 * ABOVE IT the rungs are the coast's own, because a shore drawn in one flat
 * tone is a shore the map has an opinion about and the world does not. What
 * the rider actually goes past on this coast is granite sliding into the
 * water, a wood over it, and bare headland above where the trees stop — so
 * the plan says so: everything over 0 is LAND, and everything over the tree
 * line (`flora-defs.ts`, the same number the wood itself is held to) is
 * bare HIGHLAND. Paint the first green and the second stone and the map
 * agrees with the shore the rider can see.
 *
 * Measured against sea level throughout, so it is a plan of the GROUND
 * rather than of the water passing over it. */
const BANDS = [-9, -3, 0, TREE_LINE] as const;

/** How many ground cells are remembered. The window holds about three
 * thousand of them, so this is a couple of minutes of riding before the oldest water is
 * dropped and re-sampled — and it is a cap rather than an eviction queue
 * because a map that has to forget something can forget all of it: the next
 * cut pays for one window, which is what it pays anyway on the first frame
 * of every run. */
const GROUND_MEMORY = 24_000;

/** The smallest a rock may be drawn, view units of radius — a boulder at
 * true scale is under a pixel, and a pixel is not a warning. */
const MIN_ROCK = 1.7;

/** The schematic for one frame: paths in the `VIEW`-square user space, drawn
 * as one group translated by `offset`. */
export type MinimapScene = {
  /** Where the group stands this frame — the anchor's own position in the
   * window, in view units, relative to where it was cut. */
  offset: { x: number; y: number };
  /** WHICH CUT this is. It changes only when the paths were rebuilt, and the
   * frame it changes on is the one frame the group's transform must not be
   * tweened: the offset and the zoom both jump there, and the new paths jump
   * with them, so the picture is continuous ONLY if the transform lands
   * immediately. Tweened, the coast slides half a box sideways twice a
   * second at speed. */
  cut: number;
  /** What the group is scaled by, about the middle of the box: the cut's
   * span over the span being shown, so it is never under 1. Strokes are held
   * off it (`vector-effect`), because a line drawn thinner at speed is a line
   * that reads as further away rather than as more of it. */
  zoom: number;
  /** Water with the bottom coming up under it — the outer band of the depth
   * ramp, and the first thing on the map that says which way the shore is
   * when no shore is in the window. */
  shelf: string;
  /** The water shallow enough to stand a wave up. */
  shallows: string;
  /** Everything above sea level — the shore as the rider sees it go past:
   * the wooded ground the coast runs on. */
  land: string;
  /** …and the bare ground over the tree line, which is a headland rather
   * than a wood and is painted as one. */
  highland: string;
  /** The shoreline itself, stroked — the edge the whole course is measured
   * off, and the one line on the map that is a piece of the world rather
   * than a piece of the race. */
  shore: string;
  /** The rocks that break the surface: a skerry or a boulder standing proud
   * of it, which is a thing to be steered round. */
  rocks: string;
  /** ...and the ones that do not: a reef under the surface, which is a thing
   * to be steered round anyway and cannot be seen from the seat. */
  reefs: string;
  /** The racing line through the gates. */
  route: string;
};

type Pt = [number, number];

/** ONE CUT of the schematic: the world point it is drawn around, the scale
 * it is drawn at, and how far past the box it reaches. Threaded through
 * every builder below rather than read off module constants, because the
 * scale belongs to the FRAME being drawn. */
type Cut = {
  /** The anchor, in world space. */
  x: number;
  z: number;
  /** View units per metre. */
  k: number;
  /** How far from the anchor the schematic is built, m. */
  reach: number;
  /** The ground lattice's cell, m. It rides on the cut rather than on a
   * module constant because the two customers frame at wildly different
   * scales: the map's own 300 m window wants six-metre cells, and the whole
   * course at two kilometres would be a hundred thousand of them. */
  cell: number;
  /** A world point in this cut's own view space. */
  at: (x: number, z: number) => Pt;
};

function cutAround(x: number, z: number, span: number, cell = cellFor(span)): Cut {
  const k = VIEW / span;
  const at = (px: number, pz: number): Pt => [VIEW / 2 + (x - px) * k, VIEW / 2 + (z - pz) * k];
  return { x, z, k, reach: span / 2 + MARGIN / k, cell, at };
}

/** WHERE THE CRAFT IS, in the map's screen space. Everything projected for a
 * given frame is measured from here, so the craft sits at the middle of the
 * box however far the schematic behind it has drifted from its anchor. */
export function project(state: GameState, x: number, z: number, span: number): Pt {
  const k = VIEW / span;
  return [VIEW / 2 + (state.craft.x - x) * k, VIEW / 2 + (state.craft.z - z) * k];
}

/** True where a point is inside the box the marks are drawn in. */
export function inView(p: Pt): boolean {
  return p[0] >= 0 && p[0] <= VIEW && p[1] >= 0 && p[1] <= VIEW;
}

/** The last schematic cut: the world point it was cut around, and the level
 * it was cut from.
 *
 * The LEVEL ITSELF is the identity, not its seed: a seed is a number two
 * different levels can share (a synthetic rig and a generated coast), and a
 * cache that answered for the wrong one would draw the other shore. */
let cache: { level: Level; span: number; cut: Cut; scene: MinimapScene } | null = null;

/** How many cuts have been made, ever — the id the component watches to know
 * which frame it must not tween (`MinimapScene.cut`). */
let cuts = 0;

/** Bed heights already sampled, keyed by their world lattice NODE — and the
 * level whose water they describe. Nodes rather than cell centres because
 * every band below is cut through the cell between four of them, and four
 * neighbouring cells share each one. */
let ground = new Map<number, number>();
let groundOf: Level | null = null;

function built(p: Pt): boolean {
  return p[0] >= -MARGIN && p[0] <= VIEW + MARGIN && p[1] >= -MARGIN && p[1] <= VIEW + MARGIN;
}

function n(v: number): string {
  return v.toFixed(1);
}

/** Stroke a polyline, keeping only the runs that reach the built box. A point
 * is kept when it or a neighbour is inside, so a line that crosses the window
 * is drawn out to the frame rather than stopping at the last point that
 * happened to be visible. */
function stroke(points: readonly Pt[]): string {
  let out = "";
  let open = false;
  for (let i = 0; i < points.length; i++) {
    const keep =
      built(points[i]) ||
      (i > 0 && built(points[i - 1])) ||
      (i + 1 < points.length && built(points[i + 1]));
    if (!keep) {
      open = false;
      continue;
    }
    out += `${open ? "L" : "M"} ${n(points[i][0])} ${n(points[i][1])} `;
    open = true;
  }
  return out;
}

/** A polyline of world points, in this cut's view space. */
function line(points: readonly Vec2[], cut: Cut): string {
  return stroke(points.map((p) => cut.at(p.x, p.z)));
}

/** …and the coastlines, which are several: the mainland and one round each
 * island (R15). Drawn as one path so the minimap still strokes the shore in
 * a single element. */
function lines(runs: readonly (readonly Vec2[])[], cut: Cut): string {
  return runs.map((run) => line(run, cut)).join(" ");
}

/** How high the bed stands at one lattice NODE, m against sea level. Cached
 * per world node, because the window re-cut every twenty metres re-asks for
 * all but one row of the water it asked about last time — and because all
 * three bands are cut from the same numbers, so a node sampled for the
 * shoreline is a node the shelf gets for nothing. */
function bedAt(level: Level, i: number, j: number, cell: number): number {
  // Hashed rather than a string key: this runs a few thousand times per cut
  // and a template literal per node is the cut's biggest cost. The CELL is
  // in the key because an index means a different piece of sea bed at a
  // different lattice, and two framings share this cache.
  const key = i * 73_856_093 + j * 19_349_663 + cell * 83_492_791;
  const seen = ground.get(key);
  if (seen !== undefined) return seen;
  const bed = sampleField(level.ground, i * cell, j * cell);
  if (ground.size >= GROUND_MEMORY) ground.clear();
  ground.set(key, bed);
  return bed;
}

/** ONE BAND being built up across the lattice: the depth it is drawn above,
 * the path so far, and the run of whole cells the current row is holding
 * open. */
type Band = { at: number; out: string; from: number; open: boolean };

/** THE BANDS, cut through a WORLD-ALIGNED lattice of ground heights.
 *
 * World-aligned so a cell belongs to a piece of sea bed rather than to the
 * window — without it the whole coast crawls sideways every time the map is
 * re-cut.
 *
 * A cell whose four corners are all deeper than a band's level contributes
 * nothing to it; one whose corners are all shallower is a whole rectangle,
 * and those are run-length merged along the row so the open sea inside a
 * band costs one path command per row rather than one per cell. The cells
 * the CONTOUR actually crosses are the interesting ones: the band's edge is
 * cut through them by interpolating each crossed side, which is what turns
 * a six-metre lattice into a coastline instead of a staircase. A coarse
 * lattice is then a cheap cut rather than a visible one, and the same walk
 * pays for every band at once.
 *
 * The bands NEST — each is the whole region above its level, not a ring —
 * so they are drawn over one another back to front and the ramp is what the
 * eye adds up. Nesting is also why nothing here has to find a band's inner
 * edge: the band above it covers it. */
function bandsOf(level: Level, cut: Cut, levels: readonly number[]): string[] {
  const cell = cut.cell;
  const i0 = Math.floor((cut.x - cut.reach) / cell);
  const i1 = Math.ceil((cut.x + cut.reach) / cell);
  const j0 = Math.floor((cut.z - cut.reach) / cell);
  const j1 = Math.ceil((cut.z + cut.reach) / cell);
  const bands: Band[] = levels.map((at) => ({ at, out: "", from: i0, open: false }));
  // One row of node heights carried forward: the cells in row j read nodes
  // on rows j and j + 1, and row j + 1's are row j + 1's own top edge.
  let top: number[] = [];
  for (let i = i0; i <= i1 + 1; i++) top.push(bedAt(level, i, j0, cell));
  for (let j = j0; j <= j1; j++) {
    const bottom: number[] = [];
    for (let i = i0; i <= i1 + 1; i++) bottom.push(bedAt(level, i, j + 1, cell));
    // The row's own two view-space edges, computed once: the lattice is
    // axis-aligned in world space and the projection is a flip and a scale,
    // so every cell in a row shares them.
    const [, ya] = cut.at(0, j * cell);
    const [, yb] = cut.at(0, (j + 1) * cell);
    for (const band of bands) {
      band.open = false;
      band.from = i0;
    }
    for (let i = i0; i <= i1; i++) {
      const k = i - i0;
      // The cell's four corners, clockwise from its top-left in world terms.
      const a = top[k];
      const b = top[k + 1];
      const c = bottom[k + 1];
      const d = bottom[k];
      const lo = Math.min(a, b, c, d);
      const hi = Math.max(a, b, c, d);
      for (const band of bands) {
        const whole = lo >= band.at;
        if (whole) {
          if (!band.open) {
            band.open = true;
            band.from = i;
          }
          continue;
        }
        if (band.open) {
          band.out += rowRun(cut, band.from, i, cell, ya, yb);
          band.open = false;
        }
        if (hi >= band.at) band.out += cellAbove(cut, i, j, cell, [a, b, c, d], band.at);
      }
    }
    for (const band of bands) {
      if (band.open) band.out += rowRun(cut, band.from, i1 + 1, cell, ya, yb);
    }
    top = bottom;
  }
  return bands.map((band) => band.out);
}

/** A run of whole cells in one row, as a rectangle. */
function rowRun(cut: Cut, from: number, to: number, cell: number, ya: number, yb: number): string {
  const [xa] = cut.at(from * cell, 0);
  const [xb] = cut.at(to * cell, 0);
  const left = Math.min(xa, xb);
  const right = Math.max(xa, xb);
  const t = Math.min(ya, yb);
  const b = Math.max(ya, yb);
  return `M ${n(left)} ${n(t)} H ${n(right)} V ${n(b)} H ${n(left)} Z `;
}

/** The part of ONE cell that stands above a level, as a polygon.
 *
 * The cell's four corners are walked in order; a corner above the level is
 * kept, and a side with the level crossing it contributes the point where it
 * crosses, found by interpolating between the two corners. Three to five
 * points come back and they are the cell's share of the band's edge.
 *
 * The two ends of a crossed side are the same two heights whichever of the
 * two cells sharing it asks, so neighbouring cells agree on the point to the
 * last bit and the edge comes out continuous. The one case this reads wrong
 * is a saddle — two high corners diagonally opposite — which it joins one
 * way rather than the other; at six metres on a coast that is a decision
 * about a corner smaller than the stroke drawn over it. */
function cellAbove(
  cut: Cut,
  i: number,
  j: number,
  cell: number,
  v: readonly [number, number, number, number],
  at: number,
): string {
  const corner = (k: number): Pt => {
    const ci = i + (k === 1 || k === 2 ? 1 : 0);
    const cj = j + (k === 2 || k === 3 ? 1 : 0);
    return cut.at(ci * cell, cj * cell);
  };
  let out = "";
  let started = false;
  const put = (p: Pt): void => {
    out += `${started ? "L" : "M"} ${n(p[0])} ${n(p[1])} `;
    started = true;
  };
  for (let k = 0; k < 4; k++) {
    const k2 = (k + 1) & 3;
    if (v[k] >= at) put(corner(k));
    if (v[k] >= at !== v[k2] >= at) {
      const f = (at - v[k]) / (v[k2] - v[k]);
      const p = corner(k);
      const q = corner(k2);
      put([p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f]);
    }
  }
  return started ? `${out}Z ` : "";
}

/** The plan's four layers, lowest first — the ladder of `BANDS`, drawn back
 * to front. */
type Ground = { shelf: string; shallows: string; land: string; highland: string };

function groundLayers(level: Level, cut: Cut): Ground {
  const [shelf, shallows, land, highland] = bandsOf(level, cut, BANDS);
  return { shelf, shallows, land, highland };
}

/** A rock, as a disc: two half-arcs, which is a whole circle in one path
 * command and a great deal less string than a polygon of it. */
function disc(p: Pt, r: number): string {
  return `M ${n(p[0] - r)} ${n(p[1])} A ${n(r)} ${n(r)} 0 1 0 ${n(p[0] + r)} ${n(p[1])} A ${n(r)} ${n(r)} 0 1 0 ${n(p[0] - r)} ${n(p[1])} Z `;
}

/** Every rock near the window, split by whether it breaks the surface. A
 * reef the rider cannot see from the seat is exactly the one the map is
 * worth having for, so the two are drawn apart rather than together. */
function rocks(solids: readonly Solid[], cut: Cut): { rocks: string; reefs: string } {
  let over = "";
  let under = "";
  for (const solid of solids) {
    if (Math.abs(solid.x - cut.x) > cut.reach || Math.abs(solid.z - cut.z) > cut.reach) continue;
    const path = disc(cut.at(solid.x, solid.z), Math.max(MIN_ROCK, solid.r * cut.k));
    if (solid.top > 0) over += path;
    else under += path;
  }
  return { rocks: over, reefs: under };
}

/** THE WHOLE COURSE AT ONCE — the second thing this cutter is for.
 *
 * The map above frames a travelling window because a rider is asking what is
 * COMING. Somebody choosing a seed is asking the opposite question — what is
 * this place — and that one is answered by the whole coast in one box: how
 * the shore runs, how far out the line stands off it, where the skerries are
 * and how long the course is. Same paths, same projection, one fixed cut
 * around the middle of the course instead of around a craft.
 *
 * Expensive by the standards of a frame (a coarse lattice over two square
 * kilometres) and cheap by the standards of the level generation that had to
 * happen before it, which is why both run in the preview's worker rather
 * than on the thread the sea is being drawn on.
 */
export type LevelSchematic = {
  shelf: string;
  shallows: string;
  land: string;
  highland: string;
  shore: string;
  rocks: string;
  reefs: string;
  route: string;
  /** The gates, in order, as points in the same `VIEW`-square space. */
  gates: Pt[];
  start: Pt;
};

/** How much of the box the course is drawn into, leaving the rest as the
 * sea and shore around it — a route pressed against the frame reads as a
 * route that continues past it. */
const PREVIEW_FILL = 0.78;

/** How many lattice cells the preview's ground is walked at, across the
 * box. The map's own six-metre cell over a two-kilometre course would be a
 * hundred thousand samples for a picture two inches wide. */
const PREVIEW_CELLS = 150;

export function levelSchematic(level: Level): LevelSchematic {
  // Framed on the COURSE rather than on the level's bounds: the generator's
  // water reaches a long way out to sea, and a box that held all of it would
  // draw the race as a thread down one edge.
  const path = level.course.path;
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of path) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
  }
  const span = Math.max(maxX - minX, maxZ - minZ) / PREVIEW_FILL;
  const cut = cutAround((minX + maxX) / 2, (minZ + maxZ) / 2, span, span / PREVIEW_CELLS);
  // The lattice is a different one from the map's, and the cache is keyed by
  // cell — but a preview walks a whole coast the map will never ask about,
  // so it is dropped rather than left to crowd out the map's own cells.
  ground = new Map();
  groundOf = null;
  const bed = groundLayers(level, cut);
  const stone = rocks(level.solids, cut);
  return {
    shelf: bed.shelf,
    shallows: bed.shallows,
    land: bed.land,
    highland: bed.highland,
    shore: lines(level.shore, cut),
    rocks: stone.rocks,
    reefs: stone.reefs,
    route: line(path, cut),
    gates: level.course.gates.map((g) => cut.at(g.x, g.z)),
    start: cut.at(level.start.x, level.start.z),
  };
}

/** The schematic for this frame — the cached cut, translated to where the
 * craft now stands, or a fresh cut when the craft has outrun it. */
export function minimapScene(state: GameState, span: number = SPAN): MinimapScene {
  const { level, craft } = state;
  const cutSpan = Math.ceil(span / CUT_STEP) * CUT_STEP;
  const stale =
    cache === null ||
    cache.level !== level ||
    cache.span !== cutSpan ||
    Math.abs(cache.cut.x - craft.x) > REBUILD ||
    Math.abs(cache.cut.z - craft.z) > REBUILD;
  if (stale) {
    // The ground cells describe one coast; keeping them across a change of
    // level would paint the last one's islands on this one. The span does not
    // touch them: a cell is a piece of sea bed, not a piece of the picture.
    if (groundOf !== level) {
      ground = new Map();
      groundOf = level;
    }
    const cut = cutAround(craft.x, craft.z, cutSpan);
    const bed = groundLayers(level, cut);
    const stone = rocks(level.solids, cut);
    cache = {
      level,
      span: cutSpan,
      cut,
      scene: {
        offset: { x: 0, y: 0 },
        cut: ++cuts,
        zoom: 1,
        shelf: bed.shelf,
        shallows: bed.shallows,
        land: bed.land,
        highland: bed.highland,
        shore: lines(level.shore, cut),
        rocks: stone.rocks,
        reefs: stone.reefs,
        route: line(level.course.path, cut),
      },
    };
  }
  const last = cache as NonNullable<typeof cache>;
  // The offset is in the SHOWN scale, not the cut's: it is applied after the
  // zoom, so it has to be the drift the rider sees rather than the drift the
  // paths were built at.
  const k = VIEW / span;
  return {
    ...last.scene,
    offset: { x: (craft.x - last.cut.x) * k, y: (craft.z - last.cut.z) * k },
    zoom: last.span / span,
  };
}
