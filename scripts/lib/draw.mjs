// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A SMALL RASTER, for the labs. Every lab in `scripts/` draws the same few
// things — a filled box, a line, a circle, a polyline, a label — onto a
// picture it then writes as a PNG, and none of them wants a canvas library
// for it. So this is the canvas: a Uint8 RGBA buffer, painters over it, and
// a 5x7 bitmap font for the numbers beside each frame. Pure Node; the PNG
// encoder is `png.mjs` beside it.
//
// Colours are `[r, g, b]` or `[r, g, b, a]` (0..255); an alpha under 255
// blends over what is there, which is how a wave transect is drawn a dozen
// moments deep and still readable. Coordinates are pixels, y down.

import { encodeRgbaPng } from "./png.mjs";

/**
 * A 5x7 bitmap font, one 5-bit row per scanline, MSB leftmost. Upper case
 * only — a caption on a lab picture is a tag, not prose — so `text()` folds
 * its input. Anything the font does not know draws as a blank: a lab is
 * allowed to be missing a glyph, and a lab is not allowed to throw over one.
 */
export const FONT_5X7 = {
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f],
  H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  J: [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
  N: [0x11, 0x11, 0x19, 0x15, 0x13, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  V: [0x11, 0x11, 0x11, 0x11, 0x0a, 0x0a, 0x04],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x15, 0x0a],
  X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
  Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  0: [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
  1: [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  2: [0x0e, 0x11, 0x01, 0x02, 0x04, 0x08, 0x1f],
  3: [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
  4: [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  5: [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  6: [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  7: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  8: [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  9: [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
  "-": [0x00, 0x00, 0x00, 0x1f, 0x00, 0x00, 0x00],
  "+": [0x00, 0x04, 0x04, 0x1f, 0x04, 0x04, 0x00],
  ".": [0x00, 0x00, 0x00, 0x00, 0x00, 0x0c, 0x0c],
  ",": [0x00, 0x00, 0x00, 0x00, 0x0c, 0x04, 0x08],
  ":": [0x00, 0x0c, 0x0c, 0x00, 0x0c, 0x0c, 0x00],
  "/": [0x01, 0x02, 0x02, 0x04, 0x08, 0x08, 0x10],
  "%": [0x19, 0x1a, 0x02, 0x04, 0x08, 0x0b, 0x13],
  "(": [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02],
  ")": [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08],
  "[": [0x0e, 0x08, 0x08, 0x08, 0x08, 0x08, 0x0e],
  "]": [0x0e, 0x02, 0x02, 0x02, 0x02, 0x02, 0x0e],
  "°": [0x0c, 0x12, 0x0c, 0x00, 0x00, 0x00, 0x00],
  "'": [0x04, 0x04, 0x04, 0x00, 0x00, 0x00, 0x00],
  '"': [0x0a, 0x0a, 0x0a, 0x00, 0x00, 0x00, 0x00],
  "=": [0x00, 0x00, 0x1f, 0x00, 0x1f, 0x00, 0x00],
  "<": [0x02, 0x04, 0x08, 0x10, 0x08, 0x04, 0x02],
  ">": [0x08, 0x04, 0x02, 0x01, 0x02, 0x04, 0x08],
  "?": [0x0e, 0x11, 0x01, 0x02, 0x04, 0x00, 0x04],
  "!": [0x04, 0x04, 0x04, 0x04, 0x04, 0x00, 0x04],
  "×": [0x00, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x00],
  _: [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x1f],
  "#": [0x0a, 0x0a, 0x1f, 0x0a, 0x1f, 0x0a, 0x0a],
  "*": [0x00, 0x04, 0x15, 0x0e, 0x15, 0x04, 0x00],
  "→": [0x00, 0x04, 0x02, 0x1f, 0x02, 0x04, 0x00],
  "←": [0x00, 0x04, 0x08, 0x1f, 0x08, 0x04, 0x00],
  "↑": [0x04, 0x0e, 0x15, 0x04, 0x04, 0x04, 0x04],
  "↓": [0x04, 0x04, 0x04, 0x04, 0x15, 0x0e, 0x04],
};

/** Glyph cell: five columns and one of space, seven rows and one of lead. */
export const GLYPH_W = 6;
export const GLYPH_H = 8;

/** Width in pixels a string takes at `scale`, for laying captions out. */
export function textWidth(str, scale = 1) {
  return str.length * GLYPH_W * scale;
}

/** A drawing surface `width × height`, cleared to `bg` (opaque by default). */
export function createDrawing(width, height, bg = [0, 0, 0]) {
  const rgba = Buffer.alloc(width * height * 4);
  const bgA = bg[3] ?? 255;
  for (let i = 0; i < width * height; i++) {
    rgba[i * 4] = bg[0];
    rgba[i * 4 + 1] = bg[1];
    rgba[i * 4 + 2] = bg[2];
    rgba[i * 4 + 3] = bgA;
  }

  /** Paint one pixel, blending when the colour carries an alpha under 255.
   * Off-canvas is silently dropped: a lab that draws past its own edge has
   * framed badly, and framing is a thing to see rather than a thing to
   * crash over. */
  const set = (x, y, color) => {
    const xi = Math.round(x);
    const yi = Math.round(y);
    if (xi < 0 || yi < 0 || xi >= width || yi >= height) return;
    const o = (yi * width + xi) * 4;
    const a = color[3] ?? 255;
    if (a >= 255) {
      rgba[o] = color[0];
      rgba[o + 1] = color[1];
      rgba[o + 2] = color[2];
      rgba[o + 3] = 255;
      return;
    }
    if (a <= 0) return;
    const t = a / 255;
    rgba[o] = rgba[o] + (color[0] - rgba[o]) * t;
    rgba[o + 1] = rgba[o + 1] + (color[1] - rgba[o + 1]) * t;
    rgba[o + 2] = rgba[o + 2] + (color[2] - rgba[o + 2]) * t;
    rgba[o + 3] = Math.max(rgba[o + 3], a);
  };

  const get = (x, y) => {
    const xi = Math.round(x);
    const yi = Math.round(y);
    if (xi < 0 || yi < 0 || xi >= width || yi >= height) return [0, 0, 0, 0];
    const o = (yi * width + xi) * 4;
    return [rgba[o], rgba[o + 1], rgba[o + 2], rgba[o + 3]];
  };

  const fillRect = (x, y, w, h, color) => {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(width, Math.ceil(x + w));
    const y1 = Math.min(height, Math.ceil(y + h));
    for (let py = y0; py < y1; py++) for (let px = x0; px < x1; px++) set(px, py, color);
  };

  /** A box's outline, one pixel wide. */
  const rect = (x, y, w, h, color) => {
    line(x, y, x + w, y, color);
    line(x + w, y, x + w, y + h, color);
    line(x + w, y + h, x, y + h, color);
    line(x, y + h, x, y, color);
  };

  const disk = (cx, cy, radius, color) => {
    for (let y = Math.floor(cy - radius); y <= cy + radius; y++) {
      for (let x = Math.floor(cx - radius); x <= cx + radius; x++) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy <= radius * radius) set(x, y, color);
      }
    }
  };

  /** A ring, `stroke` pixels wide, inside `radius`. */
  const circle = (cx, cy, radius, color, stroke = 1) => {
    const inner = Math.max(0, radius - stroke);
    for (let y = Math.floor(cy - radius); y <= cy + radius; y++) {
      for (let x = Math.floor(cx - radius); x <= cx + radius; x++) {
        const d2 = (x - cx) ** 2 + (y - cy) ** 2;
        if (d2 <= radius * radius && d2 >= inner * inner) set(x, y, color);
      }
    }
  };

  /** A straight line, `stroke` pixels wide. Sampled a pixel at a time along
   * its length: a lab draws thousands of short segments and none of them
   * long enough for the rounding to show. */
  const line = (x0, y0, x1, y1, color, stroke = 1) => {
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    // A blended stroke must not paint a pixel twice, or the seams between
    // steps read darker than the line: remember what this call has touched.
    const seen = (color[3] ?? 255) < 255 ? new Set() : null;
    const paint = (x, y) => {
      if (seen) {
        const key = Math.round(x) * 65536 + Math.round(y);
        if (seen.has(key)) return;
        seen.add(key);
      }
      set(x, y, color);
    };
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t;
      if (stroke <= 1) {
        paint(x, y);
        continue;
      }
      const r = stroke / 2;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy <= r * r) paint(x + dx, y + dy);
        }
      }
    }
  };

  /** Consecutive points joined; `close` joins the last back to the first. */
  const polyline = (points, color, stroke = 1, close = false) => {
    for (let i = 0; i + 1 < points.length; i++) {
      line(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1], color, stroke);
    }
    if (close && points.length > 2) {
      const a = points[points.length - 1];
      const b = points[0];
      line(a[0], a[1], b[0], b[1], color, stroke);
    }
  };

  /** Fill a CONVEX polygon (points in order). Bounding box plus a half-plane
   * test, which is all a convex fill needs and keeps this file dependency-
   * free. A sliver thinner than a pixel still gets the one it deserves. */
  const poly = (points, color) => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [px, py] of points) {
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    }
    const x0 = Math.max(0, Math.floor(minX));
    const x1 = Math.min(width - 1, Math.ceil(maxX));
    const y0 = Math.max(0, Math.floor(minY));
    const y1 = Math.min(height - 1, Math.ceil(maxY));
    if (x1 < x0 || y1 < y0) return;
    if (x1 === x0 && y1 === y0) {
      set(x0, y0, color);
      return;
    }
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const cx = x + 0.5;
        const cy = y + 0.5;
        let inside = true;
        let sign = 0;
        for (let i = 0; i < points.length && inside; i++) {
          const [ax, ay] = points[i];
          const [bx, by] = points[(i + 1) % points.length];
          const cross = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
          if (Math.abs(cross) < 1e-9) continue;
          const s = cross > 0 ? 1 : -1;
          if (sign === 0) sign = s;
          else if (s !== sign) inside = false;
        }
        if (inside) set(x, y, color);
      }
    }
  };

  /** A label in the 5x7 font, at `scale` pixels per font pixel, its top-left
   * at (x, y). Returns the width drawn, so captions can be laid out. */
  const text = (str, x, y, color, scale = 1) => {
    let cx = x;
    for (const ch of String(str).toUpperCase()) {
      const glyph = FONT_5X7[ch];
      if (glyph) {
        for (let row = 0; row < 7; row++) {
          for (let col = 0; col < 5; col++) {
            if (!(glyph[row] & (0b10000 >> col))) continue;
            for (let dy = 0; dy < scale; dy++) {
              for (let dx = 0; dx < scale; dx++) {
                set(cx + col * scale + dx, y + row * scale + dy, color);
              }
            }
          }
        }
      }
      cx += GLYPH_W * scale;
    }
    return cx - x;
  };

  return {
    width,
    height,
    rgba,
    set,
    get,
    fillRect,
    rect,
    disk,
    circle,
    line,
    polyline,
    poly,
    text,
    textWidth,
    toPng: () => encodeRgbaPng(width, height, rgba),
  };
}
