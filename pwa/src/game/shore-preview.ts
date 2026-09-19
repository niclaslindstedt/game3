// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT THE CARDS SHOW OF A PIECE OF WATER BEFORE IT IS RIDDEN — a level's
// course as a SHAPE, and a coast as a PHOTOGRAPH.
//
// The two are deliberately different kinds of thing, because a level and a
// coast are different kinds of thing:
//
//   A LEVEL is one line through one stretch of water, and the useful picture
//   of it is its LAYOUT — how it hooks round the headlands, how far it runs
//   out to sea, whether it comes back to where it started. That is a
//   polyline, so it ships as one (`shore-routes.ts`, written by `make
//   routes`) and is stroked here into an SVG path. Being a path rather than
//   an image is what lets it take the colour of the box it sits in — lit on
//   an open level, grey on a shut one — and stay sharp at any size, on any
//   screen.
//
//   A COAST is nine levels, so no one line is a picture of it. What it gets
//   instead is a real render taken by the game itself, from a camera over
//   the shore's first level (`make coasts`), and there is nothing to do here
//   but name the file. That is the sibling rally game's answer to the same
//   question, and the reason is the same: a coast is sold by the light on
//   it, what grows there and what the water is like, and the only honest
//   source for any of that is the renderer that draws it in a run.
//
// Neither is derived at runtime, and that is a measurement rather than a
// preference: `generateLevel` costs one to two seconds a shore here, so a
// card that built its own pictures would freeze on the way in. Drawing is
// the cheap half, and drawing is all that happens here.
//
// BOTH HALVES OF THE LAYOUT'S FORMAT ARE HERE — the one that writes the
// bytes (`routeOf`, called only by `make routes`) and the one that reads them
// back (`routeShape`, called by every level box). They are inverses, so
// stating them apart is stating the format twice, and the failure that would
// cause is the one the whole scheme exists to prevent: an encoder and a
// decoder that quietly disagree ship a card full of plausible wrong shapes.
// `tests/shore_preview_test.ts` rebuilds a shore and runs the committed bytes
// back through `routeOf` for the same reason — a second implementation in the
// tool or in the test would be a check on the copy rather than on the data.
// Nothing in the app calls `routeOf`, so the bundler drops it.
//
// DOM-free — it is geometry and a URL, and the tests read both without a
// browser. Node-free too: the encoder's base64 is `btoa`, which both a
// browser and the tool's Node have, rather than a `Buffer` only one of them
// does.

import type { BiomeId, Level } from "@engine";

import { SHORE_ROUTES } from "./shore-routes.ts";

/** The side of the box a stored route is quantised into. Both axes span
 * this, whatever the line's real shape; `aspect` is what puts the shape back.
 *
 * One byte a coordinate: a level box draws its layout in a couple of hundred
 * pixels, so a 1/255 grid is already finer than the screen it lands on, and
 * the whole campaign's lines come to a couple of kilobytes. */
const GRID = 255;

/** How far the stored line may stray from the course path, in those same
 * units — under a pixel at the size a level box draws it. The generator's own
 * path is already a coarse polyline (a hundred-odd points a shore), so this
 * drops the straight runs and keeps every hook the coast put in. */
const TOLERANCE = 0.75;

/** How thick the drawn line is, in the same units, and the room kept around
 * it for the round cap at each end. Without the padding a level whose line
 * runs to the edge of its own bounding box — which every level does, twice,
 * by construction — loses half its stroke to the viewBox edge. */
export const ROUTE_STROKE = 13;
const PAD = ROUTE_STROKE / 2 + 1;

/** A layout ready to draw: the path, and the box it wants drawing in. */
export type RouteShape = {
  /** The `d` of an SVG path, in the viewBox below. */
  d: string;
  /** The viewBox, in the same units. Proportional to the line's real
   * extent, so the drawing is the shape of the RIDE rather than the shape of
   * the space it is being shown in — hand it to `preserveAspectRatio` and
   * let it letterbox. */
  width: number;
  height: number;
};

/** The shape of a pinned shore's racing line, or null for a level with no
 * route stored. Null rather than a throw: a level added to
 * `campaign-levels.ts` without `make routes` being re-run should cost the
 * card its picture, not the page. */
export function routeShape(levelId: string): RouteShape | null {
  const route = SHORE_ROUTES[levelId];
  if (!route) return null;
  const bytes = decode(route.d);
  if (bytes.length < 4) return null;
  // Put the ride's proportions back. The stored line fills 0..GRID on both
  // axes whatever shape the level is, so the SHORTER side is scaled down:
  // the longer one keeps the full grid, and a level that runs north-south is
  // drawn tall instead of being stretched square.
  const scaleX = route.aspect >= 1 ? 1 : route.aspect;
  const scaleY = route.aspect >= 1 ? 1 / route.aspect : 1;
  const parts: string[] = [];
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    const x = PAD + bytes[i] * scaleX;
    const y = PAD + bytes[i + 1] * scaleY;
    parts.push(`${i === 0 ? "M" : "L"}${round(x)} ${round(y)}`);
  }
  return {
    d: parts.join(" "),
    width: GRID * scaleX + PAD * 2,
    height: GRID * scaleY + PAD * 2,
  };
}

/** Two decimals, without the trailing zeroes — a path string this is not
 * worth being long. */
function round(v: number): string {
  return String(Math.round(v * 100) / 100);
}

/** The stored base64 back into bytes. `atob` rather than Buffer: this runs
 * in the browser, and the strings are a couple of hundred bytes each. */
function decode(base64: string): Uint8Array {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/** The banner for a coast — a render of the place, written by `make coasts`
 * into the site's own assets.
 *
 * `base` is the bundler's base (`import.meta.env.BASE_URL`), and it is a
 * PARAMETER rather than read here: this module is imported by the root test
 * suite, whose tsconfig has no Vite client types in it, and a bare
 * `import.meta.env` there is a typecheck error rather than a wrong URL.
 * Passing it also makes the one thing worth checking — that a deploy slot's
 * prefix survives (`/`, `/preview/`, and the desktop and store shells' own
 * schemes) — checkable without a browser. */
export function coastShot(biome: BiomeId, base: string): string {
  return `${base}previews/coast-${biome}.jpg`;
}

/* ── THE WRITING HALF (`make routes`, and the test that holds it) ─────── */

/** Douglas–Peucker: drop every point the straight line between its
 * neighbours already accounts for, to within `tol`. Iterative rather than
 * recursive — the cost is the same, and a path that never straightens cannot
 * then run the stack out. */
function simplify(points: readonly (readonly [number, number])[], tol: number): [number, number][] {
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [lo, hi] = stack.pop()!;
    if (hi - lo < 2) continue;
    const [ax, ay] = points[lo];
    const [bx, by] = points[hi];
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy);
    let worst = -1;
    let at = -1;
    for (let i = lo + 1; i < hi; i++) {
      const [px, py] = points[i];
      // Perpendicular distance to the chord, or to the endpoint where the
      // chord has no length — which is a closed circuit, whose first and last
      // point stand in the same water (R30).
      const d =
        len < 1e-9 ? Math.hypot(px - ax, py - ay) : Math.abs(dx * (ay - py) - (ax - px) * dy) / len;
      if (d > worst) {
        worst = d;
        at = i;
      }
    }
    if (worst <= tol) continue;
    keep[at] = 1;
    stack.push([lo, at], [at, hi]);
  }
  return points.filter((_p, i) => keep[i] === 1).map(([x, y]) => [x, y]);
}

/** ONE SHORE'S LINE, ready to store: the built level's course path projected
 * into its OWN bounding box, north up, simplified, and quantised.
 *
 * The PATH rather than the gates, and the path's own box rather than the
 * level's: what a box has to show is the shape of the RIDE — where the line
 * hooks round a headland, where it runs straight out to sea, whether it comes
 * back to where it started — and a level is a couple of kilometres of water
 * either side of a line that uses a third of it. Framed on the level, every
 * shore is the same small squiggle in the middle of the same square.
 *
 * ON A LAPPED SHORE THAT IS THE LAP DRAWN `laps` TIMES, over itself, which is
 * exactly right: the loop is what the rider rides and the overdraw is free —
 * the second pass lands on the first one's pixels (R30).
 *
 * A TRICKS SHORE HAS NO RINGS TO TAKE and still has this line: R35 lays the
 * ramp field the length of the racing line, so the course path is the shape
 * of the field's water as much as of a race's (`mapgen/trick-field.ts`).
 *
 * Each axis is normalised to its own extent rather than to a shared square,
 * so the stored line always fills the box and keeps every byte of resolution
 * it has. What that throws away is the ride's real proportion, which comes
 * back as `aspect` — `routeShape` fits its drawing box to that, so a shore
 * that runs along the coast is drawn wide and one that runs out to sea is
 * drawn tall. */
export function routeOf(level: Level): { d: string; aspect: number; points: number } {
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
  const spanX = Math.max(1, maxX - minX);
  const spanZ = Math.max(1, maxZ - minZ);
  // Screen y grows downward and world z grows north, so z is flipped here and
  // the stored line is already the way up a box draws it.
  const points = path.map((p): [number, number] => [
    ((p.x - minX) / spanX) * GRID,
    ((maxZ - p.z) / spanZ) * GRID,
  ]);
  const line = simplify(points, TOLERANCE);
  let binary = "";
  for (const [x, y] of line) {
    binary += String.fromCharCode(clampByte(x), clampByte(y));
  }
  // Four decimals is finer than a level box can show; `Number` takes the
  // trailing zeroes back off, because prettier strips them from a number
  // literal and `0.7290` in the emitted module is a formatting failure on
  // every regeneration.
  return {
    d: btoa(binary),
    aspect: Number((spanX / spanZ).toFixed(4)),
    points: line.length,
  };
}

function clampByte(v: number): number {
  return Math.max(0, Math.min(GRID, Math.round(v)));
}
