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
// What it draws is a CARTOON of the sea: the deep water is the plate's own
// ground, the shallows a paler band over it, the land a solid mass, the
// shoreline a line between them, every rock a disc, and the racing line a
// ribbon along the shore. Nothing here is to scale except the ground itself
// — a two-metre boulder at this framing is under a pixel, so a rock is drawn
// with a floor under its radius and the line is drawn several times its
// width. The exaggeration is the map.
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
 * standstill, and `far` the fraction shown at `at` and above. */
const ZOOM = { at: 80, close: 0.6, far: 1.5 };

/** The window this frame: the base framing, closed or opened by the
 * speedo. */
export function spanFor(base: number, speedKmh: number): number {
  const t = Math.min(1, Math.max(0, speedKmh / ZOOM.at));
  return base * (ZOOM.close + (ZOOM.far - ZOOM.close) * t);
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

/** The ground grid's cell, m. It is the resolution of the shoreline's fill
 * and of the shallows' edge, and it is coarse on purpose: this is a
 * schematic of where the water is deep and where it is not, and a bay with
 * a jagged rim reads as a bay at seven rem across. */
const GROUND_CELL = 6;

/** How deep the water has to be before it stops being SHALLOWS, m. Under
 * this the sea bed is close enough that a wave stands up on it and a hull
 * dropping off one can touch it — which is what the pale band is warning
 * about. Measured against sea level, so it is a plan of the bed rather than
 * of the surface passing over it. */
const SHALLOW_DEPTH = 3;

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
  /** The water shallow enough to stand a wave up, as filled cells. */
  shallows: string;
  /** Everything above sea level, as filled cells. */
  land: string;
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
  /** A world point in this cut's own view space. */
  at: (x: number, z: number) => Pt;
};

function cutAround(x: number, z: number, span: number): Cut {
  const k = VIEW / span;
  const at = (px: number, pz: number): Pt => [VIEW / 2 + (x - px) * k, VIEW / 2 + (z - pz) * k];
  return { x, z, k, reach: span / 2 + MARGIN / k, at };
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

/** Ground cells already sampled, keyed by their world lattice index — and
 * the level whose water they describe. */
let ground = new Map<number, 0 | 1 | 2>();
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

/** What the ground under one cell is: open water, shallows, or land. Cached
 * per world cell, because the window re-cut every twenty metres re-asks for
 * all but one row of the water it asked about last time. */
function groundAt(level: Level, i: number, j: number): 0 | 1 | 2 {
  // Hashed rather than a string key: this runs a few thousand times
  // per cut and a template literal per cell is the cut's biggest cost.
  const key = i * 73_856_093 + j * 19_349_663;
  const seen = ground.get(key);
  if (seen !== undefined) return seen;
  const bed = sampleField(level.ground, (i + 0.5) * GROUND_CELL, (j + 0.5) * GROUND_CELL);
  const kind: 0 | 1 | 2 = bed >= 0 ? 2 : bed > -SHALLOW_DEPTH ? 1 : 0;
  if (ground.size >= GROUND_MEMORY) ground.clear();
  ground.set(key, kind);
  return kind;
}

/** The ground layers: one walk of a WORLD-ALIGNED lattice, emitting each
 * row's runs as rectangles. World-aligned so a cell belongs to a piece of sea
 * bed rather than to the window — without it the whole coast crawls sideways
 * every time the map is re-cut. */
function groundLayers(level: Level, cut: Cut): { shallows: string; land: string } {
  const i0 = Math.floor((cut.x - cut.reach) / GROUND_CELL);
  const i1 = Math.ceil((cut.x + cut.reach) / GROUND_CELL);
  const j0 = Math.floor((cut.z - cut.reach) / GROUND_CELL);
  const j1 = Math.ceil((cut.z + cut.reach) / GROUND_CELL);
  let shallows = "";
  let land = "";
  for (let j = j0; j <= j1; j++) {
    // The row's own two view-space edges, computed once: the lattice is
    // axis-aligned in world space and the projection is a flip and a scale,
    // so every cell in a row shares them.
    const [, ya] = cut.at(0, j * GROUND_CELL);
    const [, yb] = cut.at(0, (j + 1) * GROUND_CELL);
    const top = Math.min(ya, yb);
    const bottom = Math.max(ya, yb);
    let run = 0 as 0 | 1 | 2;
    let from = i0;
    const flush = (to: number): void => {
      if (run === 0) return;
      const [xa] = cut.at(from * GROUND_CELL, 0);
      const [xb] = cut.at(to * GROUND_CELL, 0);
      const left = Math.min(xa, xb);
      const right = Math.max(xa, xb);
      const rect = `M ${n(left)} ${n(top)} H ${n(right)} V ${n(bottom)} H ${n(left)} Z `;
      if (run === 1) shallows += rect;
      else land += rect;
    };
    for (let i = i0; i <= i1; i++) {
      const kind = groundAt(level, i, j);
      if (kind === run) continue;
      flush(i);
      run = kind;
      from = i;
    }
    flush(i1 + 1);
  }
  return { shallows, land };
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
        shallows: bed.shallows,
        land: bed.land,
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
