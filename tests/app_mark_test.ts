// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The app mark is stated TWICE — as path data in pwa/src/game/app-mark.ts
// and as the same data in the icon SVG, which is a static file and cannot
// import a module. This holds the two to each other: the crest the loading
// card strokes, the water under it, the band of that water which is lit, and
// the sun through the barrel. The raster icons and the favicon are the third
// drawing and restate nothing — scripts/generate-icons.mjs imports the module
// and rasterizes it — so these two are the whole of the drift risk.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  MARK_BODY,
  MARK_RIM,
  MARK_SUN,
  MARK_WAVE,
  MARK_WIDTH,
  markPathData,
} from "../pwa/src/game/app-mark.ts";

const svg = readFileSync(
  fileURLToPath(new URL("../pwa/public/icons/icon.svg", import.meta.url)),
  "utf8",
);

/** Every `d` in the file, in document order. */
const paths = [...svg.matchAll(/\sd="([^"]+)"/g)].map((m) => m[1]);

describe("the app mark", () => {
  it("draws the crest the app draws", () => {
    expect(MARK_WAVE).toHaveLength(1);
    expect(paths).toContain(MARK_WAVE[0]);
  });

  it("strokes the crest as wide as the app does", () => {
    const crest = /<path[^>]*stroke="#f2f7f8"[^>]*stroke-width="(\d+)"/.exec(svg);
    expect(crest, "the foam-stroked crest path").not.toBeNull();
    expect(Number(crest![1])).toBe(MARK_WIDTH);
  });

  it("fills the same water the rasterizer fills", () => {
    const body = markPathData(MARK_BODY);
    // Three times over: the clip that keeps the lit band inside the water,
    // the dark mass, and the band itself. A copy that drifts draws a rim
    // along an edge the water no longer has.
    expect(paths.filter((d) => d === body)).toHaveLength(3);
  });

  it("lights a band of the water's edge as deep as MARK_RIM", () => {
    // The band is a stroke ALONG the outline clipped to the inside of it, so
    // it is twice as wide as the depth it actually lights.
    const rim = /<path[^>]*stroke="#3fa7b8"[^>]*stroke-width="(\d+)"/.exec(svg);
    expect(rim, "the rim-stroked water path").not.toBeNull();
    expect(Number(rim![1])).toBe(MARK_RIM * 2);
  });

  it("puts the sun where the rasterizer puts it", () => {
    // The drawn circle is the whole haze; the disc inside it is the first
    // stop of the gradient, at r / glow of the way out.
    const circle = /<circle cx="(\d+)" cy="(\d+)" r="(\d+)"/.exec(svg);
    expect(circle, "the sun's circle").not.toBeNull();
    const [, cx, cy, r] = circle!;
    expect([Number(cx), Number(cy), Number(r)]).toEqual([MARK_SUN.cx, MARK_SUN.cy, MARK_SUN.glow]);
    const opaque = [...svg.matchAll(/<stop offset="([0-9.]+)"[^>]*stop-opacity="1"/g)];
    expect(opaque.length, "the sun's opaque stops").toBeGreaterThan(0);
    const disc = Number(opaque[opaque.length - 1][1]);
    expect(disc).toBeCloseTo(MARK_SUN.r / MARK_SUN.glow, 3);
  });
});
