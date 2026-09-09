#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Generates the PWA install icons, the favicon, and the social-preview
// image from the same geometry as pwa/public/icons/icon.svg — a hull meeting
// a wave: a crest that rises from the left, tips over and curls, drawn as
// the foam along its lip and the darker face under it, with a small orange
// hull held nose-up beside it, on deep teal water. Pure Node (the shared
// lib/png.mjs encoder), so the pipeline needs no native image dependencies.
// Rerun with `npm run icons` / `make icons` after changing the mark, and keep
// icon.svg and pwa/src/game/app-mark.ts in lockstep.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { encodePng } from "./lib/png.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const iconsDir = join(root, "pwa", "public", "icons");
mkdirSync(iconsDir, { recursive: true });

// Palette — mirrors PALETTE in pwa/src/identity.ts and the SVG's stops.
const SEA_TOP = [11, 61, 79]; // #0b3d4f seaDeep
const SEA_BOT = [27, 111, 138]; // #1b6f8a sea
const FOAM = [242, 247, 248]; // #f2f7f8 foam
const FACE = [63, 167, 184]; // #3fa7b8 seaShallow
const BUOY = [242, 140, 40]; // #f28c28 buoy
const INK = [8, 42, 56]; // #082a38 hudShadow
const HULL_EDGE = 8; // how wide the hull's ink outline draws

// --- geometry in the SVG's 512-unit space -----------------------------------
// The wave is two circular arcs joined tangentially at the lip (341, 182.78):
// the swell rises from the left and the curl tips over and under. The curl's
// centre sits on the swell's radial through the lip, at R1 - R2 from the
// swell's centre (internally tangent), so a line at a fixed radial offset
// from the spine keeps that offset through the inflection with no step.
const TRACK_W = 13; // half width of one line
const ARCS = [
  { cx: 256, cy: 330, r: 170, from: 180, to: 300 },
  { cx: 306, cy: 243.4, r: 70, from: 300, to: 420 },
];
// The two lines: the foam along the lip on the spine, the face 36 in from it.
const LINES = [
  { offset: 0, color: FOAM },
  { offset: -36, color: FACE },
];
// Round caps at each line's two ends, so a stroke does not end on a chisel.
const CAPS = [
  { arc: 0, deg: 180 },
  { arc: 1, deg: 420 },
];

// The hull, as rounded boxes in its own frame (+x is the nose, +y is down
// the picture), held nose-up beside the wave.
const HULL = { cx: 390, cy: 400, angle: (-14 * Math.PI) / 180 };
const BODY = { x: 0, y: 0, hw: 80, hh: 22, r: 14 };
const SEAT = { x: -14, y: -24, hw: 36, hh: 12, r: 8 };
const BAR = { x: 44, y: -30, hw: 5, hh: 14, r: 3 };

function seaAt(v) {
  const t = Math.max(0, Math.min(1, v));
  return [
    SEA_TOP[0] + (SEA_BOT[0] - SEA_TOP[0]) * t,
    SEA_TOP[1] + (SEA_BOT[1] - SEA_TOP[1]) * t,
    SEA_TOP[2] + (SEA_BOT[2] - SEA_TOP[2]) * t,
  ];
}

/** Signed distance from hull-frame point (lx, ly) to one rounded box part. */
function boxSdf(part, lx, ly) {
  const px = Math.abs(lx - part.x) - (part.hw - part.r);
  const py = Math.abs(ly - part.y) - (part.hh - part.r);
  return Math.hypot(Math.max(px, 0), Math.max(py, 0)) + Math.min(Math.max(px, py), 0) - part.r;
}

/** Is 512-space point (x, y) on one of the wave's lines? Returns its colour. */
function waveAt(x, y) {
  for (const arc of ARCS) {
    const r = Math.hypot(x - arc.cx, y - arc.cy);
    let deg = (Math.atan2(y - arc.cy, x - arc.cx) * 180) / Math.PI;
    if (deg < 0) deg += 360;
    // The curl's sweep runs past 360; read the angle on the same turn.
    if (deg < arc.from) deg += 360;
    if (deg < arc.from || deg > arc.to) continue;
    for (const line of LINES) {
      if (Math.abs(r - (arc.r + line.offset)) <= TRACK_W) return line.color;
    }
  }
  for (const cap of CAPS) {
    const arc = ARCS[cap.arc];
    const a = (cap.deg * Math.PI) / 180;
    for (const line of LINES) {
      const cx = arc.cx + (arc.r + line.offset) * Math.cos(a);
      const cy = arc.cy + (arc.r + line.offset) * Math.sin(a);
      if (Math.hypot(x - cx, y - cy) <= TRACK_W) return line.color;
    }
  }
  return null;
}

/** Color of the mark at 512-space point (x, y), or null for background. */
function markAt(x, y) {
  // The hull first: it sits on top of the water.
  const dx = x - HULL.cx;
  const dy = y - HULL.cy;
  const cos = Math.cos(-HULL.angle);
  const sin = Math.sin(-HULL.angle);
  const lx = dx * cos - dy * sin;
  const ly = dx * sin + dy * cos;
  const body = boxSdf(BODY, lx, ly);
  if (body <= 0) return body > -HULL_EDGE ? INK : BUOY;
  if (boxSdf(SEAT, lx, ly) <= 0 || boxSdf(BAR, lx, ly) <= 0) return INK;
  return waveAt(x, y);
}

/** Where inside a pixel the renderers sample — a 2x2 supersample, for edges
 * that are soft rather than staircased. */
const SAMPLES = [
  [0.25, 0.25],
  [0.75, 0.25],
  [0.25, 0.75],
  [0.75, 0.75],
];

/** Render the mark at `size`, with the geometry scaled by `inset` toward the
 * center (maskable icons keep the mark inside the safe zone). */
function renderIcon(size, inset = 1) {
  const rgb = Buffer.alloc(size * size * 3);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (const [ox, oy] of SAMPLES) {
        const u = ((x + ox) / size - 0.5) / inset + 0.5;
        const v = ((y + oy) / size - 0.5) / inset + 0.5;
        const px = u * 512;
        const py = v * 512;
        const mark = px >= 0 && px < 512 && py >= 0 && py < 512 ? markAt(px, py) : null;
        const c = mark ?? seaAt(v);
        r += c[0];
        g += c[1];
        b += c[2];
      }
      const o = (y * size + x) * 3;
      rgb[o] = r / 4;
      rgb[o + 1] = g / 4;
      rgb[o + 2] = b / 4;
    }
  }
  return encodePng(size, size, rgb);
}

/** The OG image: the mark on the right, swell lines running in from the
 * left — three long low waves in foam, fading up out of the water toward
 * the mark so they read as a sea rather than as a ruled page. */
function renderOg(width, height) {
  const rgb = Buffer.alloc(width * height * 3);
  const markSize = height;
  const markX = width - markSize;
  const swells = [
    { y: 0.3, amp: 14, len: 260, phase: 0.4 },
    { y: 0.52, amp: 18, len: 320, phase: 2.1 },
    { y: 0.74, amp: 12, len: 210, phase: 4.6 },
  ];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = y / height;
      let c = seaAt(v);
      if (x < markX) {
        for (const s of swells) {
          const cy = s.y * height + s.amp * Math.sin((x / s.len) * Math.PI * 2 + s.phase);
          if (Math.abs(y - cy) <= 3) {
            // Fade in over the first stretch, out again as the mark nears.
            const t = Math.min(1, x / 140, (markX - x) / 140);
            c = [
              c[0] + (FOAM[0] - c[0]) * t,
              c[1] + (FOAM[1] - c[1]) * t,
              c[2] + (FOAM[2] - c[2]) * t,
            ];
          }
        }
      } else {
        const mark = markAt(((x - markX) / markSize) * 512, (y / markSize) * 512);
        if (mark) c = mark;
      }
      const o = (y * width + x) * 3;
      rgb[o] = c[0];
      rgb[o + 1] = c[1];
      rgb[o + 2] = c[2];
    }
  }
  return encodePng(width, height, rgb);
}

/** Wrap one PNG in an ICO container (valid since Vista). */
function pngToIco(png, size) {
  const header = Buffer.alloc(6 + 16);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // count
  header[6] = size < 256 ? size : 0;
  header[7] = size < 256 ? size : 0;
  header.writeUInt16LE(1, 10); // planes
  header.writeUInt16LE(32, 12); // bpp
  header.writeUInt32LE(png.length, 14);
  header.writeUInt32LE(header.length, 18);
  return Buffer.concat([header, png]);
}

// THE MASTER RASTER — the mark at the largest size any store asks for, and
// the one file the SHELLS will derive their own icon sets from when they
// arrive (a shell imports the core, never another shell, so the
// full-resolution mark lives here, in the website's own icon directory,
// where both of them will look). Not in the manifest: nothing serves it to a
// browser, and an install icon above 512 buys nothing.
writeFileSync(join(iconsDir, "icon-1024.png"), renderIcon(1024));
writeFileSync(join(iconsDir, "pwa-192.png"), renderIcon(192));
writeFileSync(join(iconsDir, "pwa-512.png"), renderIcon(512));
writeFileSync(join(iconsDir, "pwa-512-maskable.png"), renderIcon(512, 0.78));
writeFileSync(join(iconsDir, "apple-touch-icon-180.png"), renderIcon(180));
writeFileSync(join(root, "pwa", "public", "favicon.ico"), pngToIco(renderIcon(32), 32));
writeFileSync(join(root, "pwa", "public", "og.png"), renderOg(1200, 630));

console.log(
  "icons: icon-1024, pwa-192, pwa-512, pwa-512-maskable, apple-touch-180, favicon.ico, og.png",
);
