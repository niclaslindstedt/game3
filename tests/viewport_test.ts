// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The canvas sizing arithmetic, DOM-free (pwa/src/lib/viewport.ts): what a
// measured CSS box turns into, and which measurements are worth acting on.
// The rotation this holds the line against is the one a browser reports
// twice — once with the old box and once with the new — so the rule that
// matters is that a rotated box is never mistaken for the box it replaced.
import { describe, expect, it } from "vitest";

import { MAX_DPR, MIN_DPR, sameViewport, viewportOf } from "../pwa/src/lib/viewport.ts";
import { RESOLUTION_SCALE } from "../pwa/src/game/settings-video.ts";

describe("viewportOf", () => {
  it("takes the box as measured", () => {
    const v = viewportOf(1280, 720, 1);
    expect(v.w).toBe(1280);
    expect(v.h).toBe(720);
    expect(v.dpr).toBe(1);
  });

  it("rounds a fractional box to whole pixels", () => {
    const v = viewportOf(390.4, 843.6, 2);
    expect(v.w).toBe(390);
    expect(v.h).toBe(844);
  });

  it("never reports a zero side", () => {
    // A box measured between layouts reads 0, and an aspect of w/0 poisons
    // the projection matrix for good.
    const v = viewportOf(0, 0, 2);
    expect(v.w).toBe(1);
    expect(v.h).toBe(1);
    expect(v.w / v.h).toBe(1);
  });

  it("caps the pixel ratio and refuses a nonsense one", () => {
    expect(viewportOf(390, 844, 3).dpr).toBe(MAX_DPR);
    expect(viewportOf(390, 844, 0).dpr).toBe(1);
    expect(viewportOf(390, 844, Number.NaN).dpr).toBe(1);
  });

  it("takes the RESOLUTION row as a share of what the cap already allows", () => {
    // The cap is the page's policy about a dense screen, the row is the
    // rider's about their machine, and the row applies AFTER the cap — so a
    // 3× phone asked for half draws at 1, not at 1.5.
    expect(viewportOf(390, 844, 3, 0.5).dpr).toBe(1);
    expect(viewportOf(390, 844, 1, 0.5).dpr).toBe(0.5);
    expect(viewportOf(390, 844, 3, 1).dpr).toBe(MAX_DPR);
  });

  it("means the same thing on every device at every stop", () => {
    // The whole point of a share rather than a second ceiling: HIGH is the
    // screen the device has, and each stop below it is that share of it.
    for (const scale of Object.values(RESOLUTION_SCALE)) {
      expect(viewportOf(1280, 720, 1, scale).dpr).toBeCloseTo(scale);
      expect(viewportOf(390, 844, 2, scale).dpr).toBeCloseTo(2 * scale);
    }
  });

  it("never lets a share collapse the buffer", () => {
    expect(viewportOf(1280, 720, 1, 0.001).dpr).toBe(MIN_DPR);
    expect(viewportOf(1280, 720, 1, 0).dpr).toBe(1);
    expect(viewportOf(1280, 720, 1, Number.NaN).dpr).toBe(1);
  });
});

describe("sameViewport", () => {
  const portrait = viewportOf(390, 844, 2);

  it("has nothing to compare before the first measurement", () => {
    expect(sameViewport(null, portrait)).toBe(false);
  });

  it("holds a repeated measurement to be the same box", () => {
    expect(sameViewport(portrait, viewportOf(390, 844, 2))).toBe(true);
  });

  it("sees a rotation, sides swapped", () => {
    expect(sameViewport(portrait, viewportOf(844, 390, 2))).toBe(false);
  });

  it("sees a ratio change under an unchanged box", () => {
    expect(sameViewport(portrait, viewportOf(390, 844, 1))).toBe(false);
  });
});
