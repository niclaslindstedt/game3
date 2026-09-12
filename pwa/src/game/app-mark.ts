// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE APP MARK, as geometry anything in the app can draw.
//
// A wave standing up against a low sun: a long swell runs in from the left,
// steepens, and throws its lip over into a barrel with the sun burning
// through the hollow of it. The CREST is two lines — the foam along the lip
// and the darker face under it — and they are the part worth reusing,
// because a wave is a thing that BUILDS, and a crest filling itself from its
// tail to its curl is the app's own mark saying it is working
// (`mark-wave.tsx`). The BODY and the SUN belong to the icon: on a tile
// there is room for the water the crest stands in, and on a loading card
// there is not.
//
// WHY CURVES AND NOT ARCS. The mark was two circular arcs, and a circle has
// one curvature: it cannot be flat far out and steep at the crest, which is
// the whole profile of a wave. What it drew instead was a rainbow. A cubic
// runs flat, steepens, and rolls over — so the geometry here is stated as
// chains of them, and the `d` strings every drawing uses are BUILT from that
// statement rather than typed out beside it.
//
// THE GEOMETRY IS STATED TWICE and they must agree: here, and in
// `pwa/public/icons/icon.svg` as the same path data. A static SVG cannot
// import a module, so that is not a comment anybody has to remember —
// `tests/app_mark_test.ts` reads the SVG and holds it to every export below.
// The raster icons are the third drawing and restate NOTHING:
// `scripts/generate-icons.mjs` imports this module and rasterizes it.

/** One segment of a path: six numbers are a cubic's two controls and its
 * end point, two are a straight line to a point. Nothing else, because
 * nothing else is needed to draw water. */
export type MarkSeg = readonly number[];

export type MarkPath = {
  readonly start: readonly [number, number];
  readonly segs: readonly MarkSeg[];
  /** Closed paths are filled; open ones are stroked. */
  readonly closed?: boolean;
};

/** The SVG `d` string for a path — the one place a path becomes text, so the
 * icon's drawing and the app's are the same numbers in the same order. */
export function markPathData(path: MarkPath): string {
  const parts = [`M ${path.start[0]} ${path.start[1]}`];
  for (const seg of path.segs) {
    parts.push(seg.length === 2 ? `L ${seg[0]} ${seg[1]}` : `C ${seg.join(" ")}`);
  }
  if (path.closed) parts.push("Z");
  return parts.join(" ");
}

/**
 * THE CREST, tail first: it runs from the tail off the left edge, up the
 * back, over the lip and round into the curl. Filled in that direction the
 * wave is BUILDING; reversed, it is falling back — which is why
 * `mark-wave.tsx` wipes it left to right.
 *
 * ONE line, not two. The mark used to carry a second line for the face under
 * the foam, hand-fitted to run parallel to it — and a hand-fitted parallel is
 * only parallel where the curve is shallow. On the wave's own face, which is
 * the steep part, a line offset DOWN the picture slides along the crest
 * instead of away from it, and the two collapse into each other. The face is
 * `MARK_RIM` now — the water's own edge, lit — and an edge cannot drift from
 * the shape it is the edge of.
 */
export const MARK_CREST: readonly MarkPath[] = [
  {
    start: [-64, 353],
    segs: [
      [60, 353, 154, 334, 215, 259],
      [255, 210, 267, 102, 343, 75],
      [428, 47, 503, 116, 494, 198],
      [486, 273, 428, 313, 371, 299],
    ],
  },
];

/** The crest as `d` strings — what `mark-wave.tsx` strokes and what the icon
 * SVG restates. */
export const MARK_WAVE = MARK_CREST.map(markPathData);

/** How wide the crest is drawn in the mark's 512-unit space. */
export const MARK_WIDTH = 24;

/** How deep a band of the water's edge is LIT, in the same units — the face
 * of the wave under the foam, drawn as a rim of the body rather than as a
 * line beside it. Wide enough to read at a launcher's size, narrow enough
 * that the mass below it still says deep water. */
export const MARK_RIM = 30;

/**
 * HOW FAR UNDER THE FOAM the water's own edge runs, in the mark's units.
 * Under half the stroke's width the foam would be drawn ON the edge with no
 * daylight beneath the lip; much over it and the line floats free of the
 * water. Twenty leaves eight units of sky showing under a stroke twenty-four
 * wide, which is the gap a thrown lip actually has under it.
 */
const UNDER = 20;

/** One cubic segment dropped straight down the picture. A translated cubic
 * is still a cubic, which is why the body's back can BE the crest's back
 * instead of a second set of numbers hand-fitted to look like it. */
function under(seg: MarkSeg): MarkSeg {
  return seg.map((v, i) => (i % 2 === 0 ? v : v + UNDER));
}

/**
 * THE WATER THE CREST STANDS IN — icon only. Its top edge IS the crest's own
 * back and face, dropped `UNDER` down the picture, so the foam always sits on
 * the water rather than floating over it. Past the lip it leaves the crest
 * and turns down the INSIDE wall of the barrel and out across the trough in
 * front, so what is left between that wall and the curl over it is a hollow
 * with the sky in it. That hollow is the reason the mark reads as a wave
 * breaking rather than as a line curling: a barrel is a hole you can see
 * through.
 *
 * It runs off three edges of the tile on purpose — a wave cropped by the
 * frame is a wave that continues, and one that fits inside it is a puddle.
 */
export const MARK_BODY: MarkPath = {
  start: [-96, 394],
  segs: [
    [-86, 391, -74, 385, MARK_CREST[0].start[0], MARK_CREST[0].start[1] + UNDER],
    ...MARK_CREST[0].segs.slice(0, 2).map(under),
    [358, 104, 348, 250, 371, 328],
    [427, 377, 510, 384, 600, 377],
    [600, 780],
    [-96, 780],
  ],
  closed: true,
};

/** THE SUN through the hollow — icon only. Low and half-swallowed by the
 * barrel, which is what puts the hour of the day in a drawing with no sky in
 * it. `glow` is how far its haze reaches past the disc. */
export const MARK_SUN = { cx: 415, cy: 200, r: 70, glow: 134 } as const;

/** The box the CREST alone inks, stroke and round caps included — the
 * framing `mark-wave.tsx` mounts it in. Derived from the curves rather than
 * measured off them once and typed in, so a reshaped lip cannot leave the
 * mark hanging out of its own box. */
export const MARK_WAVE_VIEWBOX = crestBox();

function crestBox(): string {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const path of MARK_CREST) {
    for (const [x, y] of samplePath(path, 24)) {
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  }
  const pad = MARK_WIDTH / 2;
  const round = (v: number) => Math.round(v);
  return `${round(x0 - pad)} ${round(y0 - pad)} ${round(x1 - x0 + MARK_WIDTH)} ${round(y1 - y0 + MARK_WIDTH)}`;
}

/**
 * A path walked as points, `per` to a segment. The one place a cubic here is
 * evaluated — the icon's rasterizer samples through this too, so the ink it
 * lays and the box the app reserves come off the same walk.
 */
export function samplePath(path: MarkPath, per: number): [number, number][] {
  const pts: [number, number][] = [[path.start[0], path.start[1]]];
  let [px, py] = path.start;
  for (const seg of path.segs) {
    if (seg.length === 2) {
      pts.push([seg[0], seg[1]]);
      [px, py] = [seg[0], seg[1]];
      continue;
    }
    const [c1x, c1y, c2x, c2y, ex, ey] = seg;
    for (let i = 1; i <= per; i++) {
      const t = i / per;
      const u = 1 - t;
      pts.push([
        u * u * u * px + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * ex,
        u * u * u * py + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * ey,
      ]);
    }
    [px, py] = [ex, ey];
  }
  return pts;
}
