// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LEVEL MAP: one level from above, annotated — the picture to reason
// about a level from instead of riding it.
//
// Everything on it is read straight off the compiled level the game
// itself rides, with nothing rendered in between: no three.js, no browser,
// no built app. The water is shaded by DEPTH (pale over the shallows, dark
// over the deep, with the contour the course rules care about drawn in),
// the land is coloured by what `materialAt` says it is made of and shaded
// by height, every rock is a circle by kind, the course is a line through
// its gates — a water gate as the bar between its buoys, an air gate as a
// ring with its ramp drawn as an arrow from the hinge to the lip — and the
// wind is an arrow with its speed. Down the right is the key. Every id is
// the one `level-map.mjs` prints in its table, so "the ramp before G6" is
// a claim about `J6` on both.

import { sampleField } from "../../engine/index.ts";
import { createDrawing, textWidth } from "./draw.mjs";

export const TITLE_H = 48;
export const LEGEND_W = 230;
const MARGIN = 12;

const PAPER = [246, 244, 238];
const INK = [24, 24, 28];
const WHITE = [255, 255, 255];

/** Water by depth, shallow to deep: the fade a chart uses, so a bar reads
 * as a bar. Positions are metres of depth. */
const BATHY = [
  [0, [178, 222, 222]],
  [1.5, [130, 196, 210]],
  [5, [70, 150, 190]],
  [12, [34, 100, 150]],
  [25, [14, 52, 96]],
];

/** Land by material (R16) — granite grey, the darker boulder field, ochre
 * sand — and a fallback for a material this file has never heard of. */
const LAND = {
  bedrock: [158, 156, 150],
  rock: [108, 104, 98],
  sand: [216, 194, 136],
  water: [178, 222, 222],
  unknown: [200, 120, 200],
};

/** Depth contours, m: the course rules' floor (R5, 1.5 m) heavier than the
 * chart's own. */
const CONTOURS = [
  { depth: 1.5, ink: [40, 90, 120, 200] },
  { depth: 5, ink: [40, 90, 120, 80] },
  { depth: 10, ink: [40, 90, 120, 80] },
  { depth: 20, ink: [40, 90, 120, 80] },
];

const SOLID = {
  skerry: { fill: [122, 128, 116], edge: [60, 64, 58] },
  boulder: { fill: [86, 82, 78], edge: [40, 38, 36] },
  reef: { fill: [230, 90, 70, 90], edge: [200, 60, 50] },
  erratic: { fill: [64, 58, 52], edge: [24, 22, 20] },
  stack: { fill: [148, 140, 128], edge: [40, 38, 34] },
  mark: { fill: [214, 206, 190], edge: [30, 28, 24] },
};

export const MARK = {
  path: [244, 128, 36],
  buoy: [255, 110, 20],
  ring: [220, 40, 160],
  ramp: [220, 40, 160],
  start: [30, 168, 72],
  finish: INK,
  shore: [70, 60, 40],
  river: [60, 130, 190],
  wind: [30, 40, 60],
};

function mix(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function bathy(depth) {
  if (depth <= BATHY[0][0]) return BATHY[0][1];
  for (let i = 1; i < BATHY.length; i++) {
    if (depth <= BATHY[i][0]) {
      const [d0, c0] = BATHY[i - 1];
      const [d1, c1] = BATHY[i];
      return mix(c0, c1, (depth - d0) / (d1 - d0));
    }
  }
  return BATHY[BATHY.length - 1][1];
}

/** Text with a paper halo, so a label survives whatever it lands on. */
export function label(canvas, x, y, str, color = INK, scale = 2) {
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx || dy) canvas.text(str, x + dx, y + dy, WHITE, scale);
    }
  }
  return canvas.text(str, x, y, color, scale);
}

/** An arrow from (x, y) along (dx, dy) pixels, `stroke` wide. */
function arrow(canvas, x, y, dx, dy, ink, stroke = 2) {
  const len = Math.hypot(dx, dy);
  if (len < 2) return;
  const ux = dx / len;
  const uy = dy / len;
  const head = Math.min(10, len * 0.4);
  canvas.line(x, y, x + dx, y + dy, ink, stroke);
  for (const s of [-1, 1]) {
    canvas.line(
      x + dx,
      y + dy,
      x + dx - ux * head + s * uy * head * 0.55,
      y + dy - uy * head - s * ux * head * 0.55,
      ink,
      stroke,
    );
  }
}

/**
 * Draw a level. `scale` is pixels per metre; `title` is the strip across
 * the top and `lines` the key's caption lines. Returns the drawing (call
 * `.toPng()`).
 */
export function renderLevelMap({ level, scale = 1, title, lines = [] }) {
  const b = level.bounds;
  const mapW = Math.ceil((b.maxX - b.minX) * scale);
  const mapH = Math.ceil((b.maxZ - b.minZ) * scale);
  const width = MARGIN + mapW + MARGIN + LEGEND_W;
  const height = TITLE_H + mapH + MARGIN;
  const canvas = createDrawing(width, height, PAPER);
  const ox = MARGIN;
  const oy = TITLE_H;
  // North (+z) is up the page.
  const px = (x) => ox + (x - b.minX) * scale;
  const py = (z) => oy + (b.maxZ - z) * scale;
  const materialAt = level.materialAt ?? level.surfaceAt;

  // ── The ground: one sample per pixel, water by depth, land by material ─
  const { ground } = level;
  const heights = new Float32Array(mapW * mapH);
  for (let j = 0; j < mapH; j++) {
    const z = b.maxZ - (j + 0.5) / scale;
    for (let i = 0; i < mapW; i++) {
      const x = b.minX + (i + 0.5) / scale;
      const h = sampleField(ground, x, z);
      heights[j * mapW + i] = h;
      let color;
      if (h < 0) {
        color = bathy(-h);
      } else {
        const material = materialAt(x, z);
        const base = LAND[material] ?? LAND.unknown;
        // Lighter with height, so a slab reads as rising.
        const lift = 0.88 + 0.3 * Math.min(1, h / 25);
        color = [base[0] * lift, base[1] * lift, base[2] * lift].map((v) => Math.min(255, v));
      }
      canvas.set(ox + i, oy + j, color);
    }
  }
  // ── Contours, marched pixel to pixel: the waterline in ink, depths in blue ─
  for (let j = 0; j + 1 < mapH; j++) {
    for (let i = 0; i + 1 < mapW; i++) {
      const h = heights[j * mapW + i];
      const hr = heights[j * mapW + i + 1];
      const hd = heights[(j + 1) * mapW + i];
      if (h < 0 !== hr < 0 || h < 0 !== hd < 0) {
        canvas.set(ox + i, oy + j, MARK.shore);
        continue;
      }
      if (h >= 0) continue;
      for (const c of CONTOURS) {
        const d = -h;
        if (d < c.depth !== -hr < c.depth || d < c.depth !== -hd < c.depth) {
          canvas.set(ox + i, oy + j, c.ink);
          break;
        }
      }
    }
  }

  // ── Every coastline the level states: the mainland and its islands ────
  for (const run of level.shore) {
    canvas.polyline(
      run.map((p) => [px(p.x), py(p.z)]),
      [MARK.shore[0], MARK.shore[1], MARK.shore[2], 140],
      1,
    );
  }

  // ── R26 — the river's own line, mouth to head ─────────────────────────
  // Drawn over the water it was stamped into rather than instead of it: the
  // point of the picture is the water NARROWING, and the line is what says
  // which of the level's channels is the one that runs on into the country.
  if (level.river.length > 1) {
    canvas.polyline(
      level.river.map((p) => [px(p.x), py(p.z)]),
      [MARK.river[0], MARK.river[1], MARK.river[2], 190],
      Math.max(1, scale),
    );
    const head = level.river[level.river.length - 1];
    canvas.text("HEAD", px(head.x) + 6, py(head.z) - 4, MARK.river, 1);
  }

  // ── The rocks, by kind ────────────────────────────────────────────────
  for (const s of level.solids) {
    const ink = SOLID[s.kind] ?? SOLID.boulder;
    // A reef's fill carries an alpha, so the water shows through it — a
    // rock under the surface reads as a hazard, not an island.
    const r = Math.max(2, s.r * scale);
    canvas.disk(px(s.x), py(s.z), r, ink.fill);
    canvas.circle(px(s.x), py(s.z), r, ink.edge, 1);
  }

  // ── The course: the line, then every gate with its id ─────────────────
  const path = level.course.path.map((p) => [px(p.x), py(p.z)]);
  canvas.polyline(path, [MARK.path[0], MARK.path[1], MARK.path[2], 210], Math.max(1, scale * 1.5));

  const gates = level.course.gates;
  for (const g of gates) {
    const rx = Math.cos(g.heading);
    const rz = -Math.sin(g.heading);
    const fx = Math.sin(g.heading);
    const fz = Math.cos(g.heading);
    if (g.kind === "water") {
      const half = g.width / 2;
      const a = [px(g.x + rx * half), py(g.z + rz * half)];
      const c = [px(g.x - rx * half), py(g.z - rz * half)];
      canvas.line(a[0], a[1], c[0], c[1], MARK.buoy, Math.max(1, scale));
      canvas.disk(a[0], a[1], Math.max(2.5, 1.2 * scale), MARK.buoy);
      canvas.disk(c[0], c[1], Math.max(2.5, 1.2 * scale), MARK.buoy);
      // A tick in the direction of passage, so a gate reads which way it faces.
      canvas.line(px(g.x), py(g.z), px(g.x + fx * 4), py(g.z + fz * 4), MARK.buoy, 1);
    } else {
      const r = Math.max(5, (g.width / 2) * scale + 2);
      canvas.circle(px(g.x), py(g.z), r, MARK.ring, 2);
      canvas.circle(px(g.x), py(g.z), r - 3, [MARK.ring[0], MARK.ring[1], MARK.ring[2], 120], 1);
      if (g.ramp) {
        const rp = g.ramp;
        const hx = Math.sin(rp.heading);
        const hz = Math.cos(rp.heading);
        // The hinge at the waterline, the arrow up the deck to the lip.
        const lipX = rp.x + hx * rp.length;
        const lipZ = rp.z + hz * rp.length;
        const wx = Math.cos(rp.heading) * (rp.width / 2);
        const wz = -Math.sin(rp.heading) * (rp.width / 2);
        canvas.line(px(rp.x + wx), py(rp.z + wz), px(rp.x - wx), py(rp.z - wz), MARK.ramp, 2);
        arrow(
          canvas,
          px(rp.x),
          py(rp.z),
          px(lipX) - px(rp.x),
          py(lipZ) - py(rp.z),
          MARK.ramp,
          Math.max(2, scale * 1.5),
        );
        label(canvas, px(rp.x) - hx * 14 - 8, py(rp.z) + hz * 14 - 4, rp.id, MARK.ramp, 1);
      }
    }
    const isFinish = g.index === gates.length - 1;
    const tag = isFinish ? `${g.id} FIN` : g.id;
    // The label sits to the gate's RIGHT (seaward, on a coast the sea lies
    // right of): (cos h, −sin h) in the plan, y flipped on the page.
    const off = Math.max(9, g.width * scale * 0.6 + 4);
    label(
      canvas,
      px(g.x) + rx * off - (rx < 0 ? textWidth(tag, 2) : 0),
      py(g.z) - rz * off - 7,
      tag,
      g.kind === "air" ? MARK.ring : INK,
      2,
    );
  }

  // ── The start ─────────────────────────────────────────────────────────
  const st = level.start;
  canvas.disk(px(st.x), py(st.z), Math.max(4, 2.5 * scale), MARK.start);
  arrow(
    canvas,
    px(st.x),
    py(st.z),
    Math.sin(st.heading) * 16,
    -Math.cos(st.heading) * 16,
    MARK.start,
    2,
  );
  label(canvas, px(st.x) - 26, py(st.z) - 6, "START", MARK.start, 2);

  // ── The wind, top right of the map: the arrow points where it blows TO ─
  const w = level.wind;
  const to = w.from + Math.PI;
  const wx0 = ox + mapW - 70;
  const wy0 = oy + 70;
  const wl = 20 + w.speed * 3;
  canvas.disk(wx0, wy0, 34, [255, 255, 255, 160]);
  arrow(
    canvas,
    wx0 - Math.sin(to) * wl * 0.5,
    wy0 + Math.cos(to) * wl * 0.5,
    Math.sin(to) * wl,
    -Math.cos(to) * wl,
    MARK.wind,
    3,
  );
  label(canvas, wx0 - 30, wy0 + 40, `WIND ${w.speed.toFixed(1)} M/S`, MARK.wind, 1);

  // ── Scale bar ─────────────────────────────────────────────────────────
  const bar = 100 * scale;
  const bx = ox + 16;
  const by = oy + mapH - 16;
  canvas.fillRect(bx - 4, by - 12, bar + 8, 22, [255, 255, 255, 170]);
  canvas.line(bx, by, bx + bar, by, INK, 2);
  canvas.line(bx, by - 5, bx, by + 5, INK, 2);
  canvas.line(bx + bar, by - 5, bx + bar, by + 5, INK, 2);
  label(canvas, bx + bar / 2 - 15, by - 10, "100 M", INK, 1);

  // ── Frame, title, key ─────────────────────────────────────────────────
  canvas.rect(ox, oy, mapW - 1, mapH - 1, INK);
  canvas.text(title, MARGIN, 10, INK, 3);
  const lx = ox + mapW + MARGIN + 6;
  let ly = oy + 8;
  for (const line of lines) {
    canvas.text(line, lx, ly, INK, 1);
    ly += 11;
  }
  ly += 10;
  const key = (draw, text) => {
    draw(lx + 10, ly + 5);
    canvas.text(text, lx + 26, ly + 1, INK, 1);
    ly += 15;
  };
  canvas.text("KEY", lx, ly, INK, 2);
  ly += 20;
  for (const [d, c] of BATHY)
    key((x, y) => canvas.fillRect(x - 6, y - 5, 12, 10, c), `WATER ${d} M DEEP`);
  key((x, y) => canvas.line(x - 8, y, x + 8, y, CONTOURS[0].ink), "1.5 M — R5'S FLOOR");
  for (const [m, c] of Object.entries(LAND)) {
    if (m === "water" || m === "unknown") continue;
    key((x, y) => canvas.fillRect(x - 6, y - 5, 12, 10, c), m.toUpperCase());
  }
  key((x, y) => canvas.line(x - 8, y, x + 8, y, MARK.shore), "SHORELINE");
  key((x, y) => canvas.line(x - 8, y, x + 8, y, MARK.river, 2), "THE RIVER (R26)");
  for (const [k, c] of Object.entries(SOLID)) {
    key((x, y) => {
      canvas.disk(x, y, 5, c.fill);
      canvas.circle(x, y, 5, c.edge, 1);
    }, k.toUpperCase());
  }
  key((x, y) => canvas.line(x - 8, y, x + 8, y, MARK.path, 2), "THE COURSE");
  key((x, y) => {
    canvas.line(x - 7, y, x + 7, y, MARK.buoy, 1);
    canvas.disk(x - 7, y, 2.5, MARK.buoy);
    canvas.disk(x + 7, y, 2.5, MARK.buoy);
  }, "WATER GATE (BUOYS)");
  key((x, y) => canvas.circle(x, y, 6, MARK.ring, 2), "AIR GATE (RING)");
  key((x, y) => arrow(canvas, x - 8, y, 16, 0, MARK.ramp, 2), "RAMP, HINGE → LIP");
  key((x, y) => canvas.disk(x, y, 4, MARK.start), "START");
  key((x, y) => arrow(canvas, x - 8, y, 16, 0, MARK.wind, 3), "WIND, BLOWING TO");
  return canvas;
}
