// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE APP MARK, INKED — the wave of `pwa/src/game/app-mark.ts` rasterized
// into an RGBA buffer at any size, for the two tools that draw it outside a
// browser: the install icons (`generate-icons.mjs`, which composites it over
// a sky) and the share card (`hero-shots.mjs`, which composites it over a
// photograph of the game).
//
// IT RESTATES NO GEOMETRY. The curves come from the app's own module, so the
// tile, the loading card's crest and the icon SVG cannot drift into three
// different waves. The COLOURS are the caller's — the mark is drawn in the
// palette a plain-Node script has no bundler to resolve, and
// `tests/identity_test.ts` holds each caller's hexes to `identity.ts`.
//
// The mark is inked ONCE at MASTER with 2×2 supersampling and every size is
// an area average of that, rather than its own rasterization: it is how a
// 32-pixel favicon keeps a lip one pixel wide instead of losing it to a
// sample that happened to fall beside it.

import {
  MARK_BODY,
  MARK_CREST,
  MARK_RIM,
  MARK_SUN,
  MARK_WIDTH,
  samplePath,
} from "../../pwa/src/game/app-mark.ts";

/** The mark's own square. Every number in app-mark.ts is in it. */
const SPACE = 512;

/** How finely a cubic is walked before it is inked. At 48 points a segment
 * the longest curve here steps under two units — well inside one pixel of
 * the master, so the sampling is not what any edge is made of. */
const WALK = 48;

/** Where the mark is inked before anything is resampled out of it, and how
 * far PAST the mark's own square it is inked. The margin is what an inset
 * tile reads: a maskable icon shrinks the mark toward the middle, so its
 * edges land outside the 512-square, and a master inked only inside that
 * square hands back open sky there — which draws as a pale band along the
 * bottom of the tile where the water should run off it. */
const MASTER = 1536;
const MARGIN = 96;
const SPAN = SPACE + MARGIN * 2;

/** Where inside a master pixel the mark is sampled. */
const SAMPLES = [
  [0.25, 0.25],
  [0.75, 0.25],
  [0.25, 0.75],
  [0.75, 0.75],
];

const HALF = MARK_WIDTH / 2;
const BODY_PTS = samplePath(MARK_BODY, WALK);

/** A segment index over a coarse grid of the mark's square, so a pixel asks
 * its own neighbourhood rather than every one of six hundred segments. The
 * cell is as wide as the widest reach measured against it — the crest's
 * stroke or the body's lit rim — so the nine cells around a point hold every
 * segment that could possibly be within that reach. */
const CELL = Math.max(MARK_WIDTH, MARK_RIM);
const ORIGIN = Math.ceil(MARGIN / CELL) + 2; // cells of margin, for the parts that run off the tile
const COLS = Math.ceil(SPACE / CELL) + ORIGIN * 2;

function cellIndex(pts) {
  const grid = new Map();
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[i + 1];
    const cx0 = Math.floor(Math.min(ax, bx) / CELL) + ORIGIN;
    const cx1 = Math.floor(Math.max(ax, bx) / CELL) + ORIGIN;
    const cy0 = Math.floor(Math.min(ay, by) / CELL) + ORIGIN;
    const cy1 = Math.floor(Math.max(ay, by) / CELL) + ORIGIN;
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const key = cy * COLS + cx;
        const bucket = grid.get(key);
        if (bucket) bucket.push(i);
        else grid.set(key, [i]);
      }
    }
  }
  return grid;
}

const CREST_PTS = samplePath(MARK_CREST[0], WALK);
const CREST_GRID = cellIndex(CREST_PTS);
const BODY_GRID = cellIndex(BODY_PTS);

/** Squared distance from (x, y) to the segment pts[i] → pts[i + 1]. */
function segDistSq(pts, i, x, y) {
  const [ax, ay] = pts[i];
  const [bx, by] = pts[i + 1];
  const dx = bx - ax;
  const dy = by - ay;
  const len = dx * dx + dy * dy;
  let t = len > 0 ? ((x - ax) * dx + (y - ay) * dy) / len : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const ex = ax + dx * t - x;
  const ey = ay + dy * t - y;
  return ex * ex + ey * ey;
}

/** Is (x, y) within `reach` of a walked outline? Distance to the polyline is
 * what gives a stroke round caps and round joins, and a rim a constant
 * width through every turn, with nothing to special-case. */
function within(pts, grid, x, y, reach) {
  const cx = Math.floor(x / CELL) + ORIGIN;
  const cy = Math.floor(y / CELL) + ORIGIN;
  for (let oy = -1; oy <= 1; oy++) {
    for (let ox = -1; ox <= 1; ox++) {
      const bucket = grid.get((cy + oy) * COLS + cx + ox);
      if (!bucket) continue;
      for (const i of bucket) if (segDistSq(pts, i, x, y) <= reach * reach) return true;
    }
  }
  return false;
}

/**
 * Where the body's outline crosses one scanline, sorted. The body is a
 * single closed loop, so parity against these is the whole inside test —
 * and asking it PER ROW rather than per sample is the difference between
 * three minutes and three seconds: a row has three or four crossings where
 * the outline has six hundred edges.
 */
function crossingsAt(y) {
  const xs = [];
  for (let i = 0, j = BODY_PTS.length - 1; i < BODY_PTS.length; j = i++) {
    const [xi, yi] = BODY_PTS[i];
    const [xj, yj] = BODY_PTS[j];
    if (yi > y !== yj > y) xs.push(((xj - xi) * (y - yi)) / (yj - yi) + xi);
  }
  return xs.sort((a, b) => a - b);
}

function insideRow(xs, x) {
  let n = 0;
  for (const cx of xs) {
    if (cx > x) break;
    n++;
  }
  return n % 2 === 1;
}

/** How much sun there is at (x, y): 1 on the disc, falling away through the
 * haze around it. Squared, so the glow sits close rather than washing the
 * whole tile warm. */
function sunAt(x, y) {
  const d = Math.hypot(x - MARK_SUN.cx, y - MARK_SUN.cy);
  if (d <= MARK_SUN.r) return 1;
  if (d >= MARK_SUN.glow) return 0;
  const t = 1 - (d - MARK_SUN.r) / (MARK_SUN.glow - MARK_SUN.r);
  return t * t;
}

/** What the caller paints each part of the mark in, in this order. */
export const MARK_PARTS = ["face", "foam", "body", "sun"];

/**
 * The mark at one point of its own square: which part is there and how much
 * of it. Null is open sky, which the caller's own background fills.
 *
 * Stacked the way the water is: the sun behind everything, the body's dark
 * mass over it — which is what half-swallows it and makes the hollow read as
 * a hole rather than a gap — and the foam along the lip on top of both.
 */
function markAt(x, y, xs) {
  if (within(CREST_PTS, CREST_GRID, x, y, HALF)) return [1, 1];
  if (insideRow(xs, x)) {
    // The water's own edge, lit: the face of the wave under the foam. It is
    // a band INSIDE the body, so it turns where the water turns.
    return [within(BODY_PTS, BODY_GRID, x, y, MARK_RIM) ? 0 : 2, 1];
  }
  const sun = sunAt(x, y);
  return sun > 0 ? [3, sun] : null;
}

/** The inked master, kept between sizes — and keyed by the palette it was
 * inked in, so a second caller with different colours gets its own rather
 * than the first one's. */
const masters = new Map();

/** `colors` is one RGB triple per MARK_PARTS entry. */
function renderMaster(colors) {
  const buf = new Float32Array(MASTER * MASTER * 4);
  const step = SPAN / MASTER;
  // One crossing list per sub-row, shared by every sample on it.
  const subRows = [...new Set(SAMPLES.map(([, oy]) => oy))].sort((a, b) => a - b);
  const rows = new Map();
  for (let y = 0; y < MASTER; y++) {
    for (const oy of subRows) rows.set(oy, crossingsAt((y + oy) * step - MARGIN));
    for (let x = 0; x < MASTER; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (const [ox, oy] of SAMPLES) {
        const hit = markAt((x + ox) * step - MARGIN, (y + oy) * step - MARGIN, rows.get(oy));
        if (!hit) continue;
        const c = colors[hit[0]];
        r += c[0] * hit[1];
        g += c[1] * hit[1];
        b += c[2] * hit[1];
        a += hit[1];
      }
      const o = (y * MASTER + x) * 4;
      buf[o] = r / SAMPLES.length;
      buf[o + 1] = g / SAMPLES.length;
      buf[o + 2] = b / SAMPLES.length;
      buf[o + 3] = a / SAMPLES.length;
    }
  }
  return buf;
}

/**
 * The mark at `size`, as PREMULTIPLIED RGBA in 0..255 — so averaging a
 * half-lit edge cannot drag its colour toward whatever is behind it, and a
 * caller composites with `rgb + background * (1 - a)`.
 *
 * `inset` shrinks the mark toward the centre of its square without touching
 * what the caller draws behind it: a maskable icon crops the tile, not the
 * sea. `at` places the mark's square anywhere in a larger canvas — the share
 * card draws it in a corner of a photograph.
 */
export function renderMark(size, { colors, inset = 1, width = size, height = size, at } = {}) {
  const key = colors.map((c) => c.join(",")).join("|");
  let master = masters.get(key);
  if (!master) {
    master = renderMaster(colors);
    masters.set(key, master);
  }
  const out = new Float32Array(width * height * 4);
  // One output pixel is this wide in the mark's own units; an inset makes it
  // wider, which is what shrinks the mark inside the tile.
  const unit = SPACE / size / inset;
  const perUnit = MASTER / SPAN;
  const x0 = at ? at[0] : 0;
  const y0 = at ? at[1] : 0;
  for (let y = 0; y < size; y++) {
    const oy = y0 + y;
    if (oy < 0 || oy >= height) continue;
    const my0 = SPACE / 2 + (y - size / 2) * unit;
    const sy0 = Math.max(0, Math.floor((my0 + MARGIN) * perUnit));
    const sy1 = Math.min(MASTER, Math.max(sy0 + 1, Math.ceil((my0 + unit + MARGIN) * perUnit)));
    for (let x = 0; x < size; x++) {
      const ox = x0 + x;
      if (ox < 0 || ox >= width) continue;
      const mx0 = SPACE / 2 + (x - size / 2) * unit;
      const sx0 = Math.max(0, Math.floor((mx0 + MARGIN) * perUnit));
      const sx1 = Math.min(MASTER, Math.max(sx0 + 1, Math.ceil((mx0 + unit + MARGIN) * perUnit)));
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let n = 0;
      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) {
          const o = (sy * MASTER + sx) * 4;
          r += master[o];
          g += master[o + 1];
          b += master[o + 2];
          a += master[o + 3];
          n++;
        }
      }
      const o = (oy * width + ox) * 4;
      out[o] = n > 0 ? r / n : 0;
      out[o + 1] = n > 0 ? g / n : 0;
      out[o + 2] = n > 0 ? b / n : 0;
      out[o + 3] = n > 0 ? a / n : 0;
    }
  }
  return out;
}

/**
 * THE MARK ON ITS TILE: the sea's gradient — `sea`'s two RGB stops, lightest
 * first — with the mark composited over it. Returns RGBA in 0..255, opaque
 * except where `radius` rounds the corners off, so a caller can write it
 * straight out as an icon or alpha-blend it into a corner of a photograph.
 *
 * The gradient is LIGHTEST AT THE TOP. It reads as air over water, and more
 * to the point it is what gives the wave its mass: the crest and the curl
 * are drawn in the upper half, and a dark body against a dark sky is a white
 * line floating on nothing.
 */
export function renderTile(size, { colors, sea, inset = 1, radius = 0 }) {
  const mark = renderMark(size, { colors, inset });
  const out = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    const t = y / size;
    const sky = [
      sea[0][0] + (sea[1][0] - sea[0][0]) * t,
      sea[0][1] + (sea[1][1] - sea[0][1]) * t,
      sea[0][2] + (sea[1][2] - sea[0][2]) * t,
    ];
    for (let x = 0; x < size; x++) {
      const o = (y * size + x) * 4;
      const open = 1 - mark[o + 3];
      out[o] = mark[o] + sky[0] * open;
      out[o + 1] = mark[o + 1] + sky[1] * open;
      out[o + 2] = mark[o + 2] + sky[2] * open;
      out[o + 3] = 255 * cornerCover(size, radius, x, y);
    }
  }
  return out;
}

/** How much of pixel (x, y) is inside a `size` square whose corners are
 * rounded off at `radius`. Sampled 3×3 rather than solved: a rounded corner
 * is a handful of pixels and an exact area is arithmetic nobody will read
 * again. */
function cornerCover(size, radius, x, y) {
  if (radius <= 0) return 1;
  let hit = 0;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const px = x + (i + 0.5) / 3;
      const py = y + (j + 0.5) / 3;
      // How far the point lies outside the square shrunk by the radius —
      // zero anywhere but in a corner, which is where the test bites.
      const dx = Math.max(radius - px, px - (size - radius), 0);
      const dy = Math.max(radius - py, py - (size - radius), 0);
      if (dx * dx + dy * dy <= radius * radius) hit++;
    }
  }
  return hit / 9;
}
