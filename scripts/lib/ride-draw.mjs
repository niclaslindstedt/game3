// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// DRAWING A RIDE — the schematic half of the ride lab.
//
// The game's own picture of a hull meeting a wave is a craft, at speed,
// half hidden in spray. So this draws it the way a towing tank plots it:
// no craft model, no water shader, no light — a hull silhouette, the
// surface line it crossed, the bed, the ramp, and the NUMBERS beside each
// frame. Three panels:
//
//   THE PROFILE  — the hull in side view at its own pitch, placed where it
//                  was along the track and at its own height, over the
//                  water it met there: the picture that says whether it
//                  planed, porpoised, launched flat or buried its bow.
//   THE PLAN     — where it went and which way it pointed, for a scenario
//                  that turns.
//   THE FRAMES   — one cell per sample: the silhouette against its local
//                  waterline, and every number that decides the next step.
//
// Everything is in the RELEASE FRAME (`ride-lab.mjs`): `along` runs down
// the heading the craft was stood on and `across` to its right.

export const INK = {
  paper: [16, 18, 22],
  panel: [22, 25, 31],
  rule: [46, 50, 58],
  label: [206, 212, 222],
  dim: [124, 130, 142],
  water: [92, 160, 220],
  waterFill: [24, 44, 70],
  bed: [120, 104, 80],
  ramp: [220, 90, 180],
  early: [110, 200, 160],
  late: [240, 120, 80],
  air: [110, 160, 226],
  event: [250, 206, 84],
  bad: [244, 100, 90],
  travel: [96, 214, 158],
};

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const round = (v, n = 0) => v.toFixed(n);
const deg = (rad) => (rad * 180) / Math.PI;

/** The hull in side view, body frame (forward, up) about the centre of
 * gravity, from the spec's length, height and CoG: a flat run aft, a
 * rocker into the bow, a deck, and the seat as a hump — enough to read
 * which end is which and how it sits. */
export function hullSide(spec) {
  const L = spec.length;
  const H = spec.height;
  const cz = spec.cog.z;
  const cy = spec.cog.y;
  return [
    [-L / 2 - cz, -cy],
    [L * 0.3 - cz, -cy],
    [L / 2 - cz, -cy + H * 0.45],
    [L / 2 - cz, H * 0.85 - cy],
    [L * 0.2 - cz, H - cy],
    [L * 0.05 - cz, H - cy + 0.3],
    [-L * 0.3 - cz, H - cy + 0.3],
    [-L * 0.42 - cz, H - cy],
    [-L / 2 - cz, H * 0.9 - cy],
  ];
}

/** ...and from above: a pointed box, nose first, in (right, forward). */
export function hullPlan(spec) {
  const L = spec.length;
  const B = spec.beam;
  const cz = spec.cog.z;
  return [
    [-B / 2, -L / 2 - cz],
    [B / 2, -L / 2 - cz],
    [B / 2, L * 0.25 - cz],
    [0, L / 2 - cz],
    [-B / 2, L * 0.25 - cz],
  ];
}

function outline(canvas, points, ink, stroke = 1) {
  canvas.polyline(points, ink, stroke, true);
}

function arrow(canvas, x, y, dx, dy, ink) {
  const len = Math.hypot(dx, dy);
  if (len < 1.5) return;
  const ux = dx / len;
  const uy = dy / len;
  canvas.line(x, y, x + dx, y + dy, ink);
  for (const s of [-1, 1]) {
    canvas.line(
      x + dx,
      y + dy,
      x + dx - ux * 4 + s * uy * 2.6,
      y + dy - uy * 4 - s * ux * 2.6,
      ink,
    );
  }
}

function scaleBar(canvas, x, y, s, metres) {
  canvas.line(x, y, x + metres * s, y, INK.dim);
  canvas.line(x, y - 3, x, y + 3, INK.dim);
  canvas.line(x + metres * s, y - 3, x + metres * s, y + 3, INK.dim);
  canvas.text(`${metres}M`, x + metres * s + 5, y - 2, INK.dim, 1);
}

/** A frame of reference for a panel: metres in, pixels out, the whole
 * run fitted with a margin and never zoomed past `maxScale`. */
function fit(box, span, mid, maxScale) {
  const sx = Math.min((box.w - box.pad * 2) / Math.max(span.x, 1e-3), maxScale);
  const sy = Math.min((box.h - box.pad * 2) / Math.max(span.y, 1e-3), maxScale);
  const s = Math.min(sx, sy);
  return {
    s,
    at: (a, b) => [box.x + box.w / 2 + (a - mid.x) * s, box.y + box.h / 2 - (b - mid.y) * s],
  };
}

function extent(values, pad) {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  return { lo: lo - pad, hi: hi + pad, span: hi - lo + pad * 2, mid: (lo + hi) / 2 };
}

/** A side-view point turned by the pitch and placed at the hull's
 * (along, y): nose-up pitch lifts the bow. */
function sidePoint(view, f, [fwd, up]) {
  const cos = Math.cos(f.pitch);
  const sin = Math.sin(f.pitch);
  return view.at(f.along + fwd * cos - up * sin, f.y + fwd * sin + up * cos);
}

/** PANEL 1 — THE PROFILE. The hull at its pitch and height, where it was
 * along the track, over the water it met and the bed under that. */
export function drawProfile(canvas, run, box, shown) {
  canvas.text(
    "PROFILE — THE HULL AT ITS PITCH AND HEIGHT, OVER THE WATER IT MET (BLUE) AND ANY RAMP (PINK)",
    box.x,
    box.y - 9,
    INK.label,
    1,
  );
  const spec = run.spec;
  const a = extent([...run.frames.map((f) => f.along), 0], spec.length);
  const ys = run.frames.flatMap((f) => [f.y, f.water]);
  for (const r of run.ramps) ys.push(r.lipY);
  const u = extent(ys, spec.height * 1.2);
  // The bed is drawn where it is if it is within reach of the picture, and
  // otherwise named: a hull riding in nine metres of water would flatten a
  // wave to a line if the bed set the scale.
  const bedLo = Math.min(...run.frames.map((f) => f.ground));
  const bedInReach = u.lo - bedLo < u.span * 1.5;
  const lo = bedInReach ? Math.min(u.lo, bedLo - 0.3) : u.lo;
  const view = fit(box, { x: a.span, y: u.hi - lo }, { x: a.mid, y: (u.hi + lo) / 2 }, 40);

  // Still water, the surface it crossed (filled down to the bed or the
  // panel's floor), and the bed.
  const [, y0] = view.at(0, 0);
  canvas.line(box.x + 4, y0, box.x + box.w - 4, y0, INK.rule);
  const floor = box.y + box.h - 4;
  for (let i = 1; i < run.frames.length; i++) {
    const p = view.at(run.frames[i - 1].along, run.frames[i - 1].water);
    const q = view.at(run.frames[i].along, run.frames[i].water);
    const g = bedInReach ? view.at(run.frames[i].along, run.frames[i].ground)[1] : floor;
    canvas.line(q[0], q[1], q[0], Math.min(g, floor), INK.waterFill);
    canvas.line(p[0], p[1], q[0], q[1], INK.water);
  }
  if (bedInReach) {
    for (let i = 1; i < run.frames.length; i++) {
      const p = view.at(run.frames[i - 1].along, run.frames[i - 1].ground);
      const q = view.at(run.frames[i].along, run.frames[i].ground);
      canvas.line(p[0], p[1], q[0], q[1], INK.bed);
    }
  } else {
    canvas.text(
      `BED AT ${round(bedLo, 1)} M, OFF THE PICTURE`,
      box.x + 8,
      box.y + box.h - 12,
      INK.bed,
      1,
    );
  }
  for (const r of run.ramps) {
    const h = view.at(r.hingeAlong, 0);
    const l = view.at(r.lipAlong, r.lipY);
    canvas.line(h[0], h[1], l[0], l[1], INK.ramp, 2);
  }

  // The path of the centre of gravity, every step, then the hull at the
  // shown frames.
  for (let i = 1; i < run.frames.length; i++) {
    const p = view.at(run.frames[i - 1].along, run.frames[i - 1].y);
    const q = view.at(run.frames[i].along, run.frames[i].y);
    canvas.line(p[0], p[1], q[0], q[1], INK.rule);
  }
  const side = hullSide(spec);
  shown.forEach((f, i) => {
    const t = shown.length > 1 ? i / (shown.length - 1) : 0;
    const ink = mix(INK.early, INK.late, t);
    outline(
      canvas,
      side.map((p) => sidePoint(view, f, p)),
      ink,
    );
    const [cx, cy] = view.at(f.along, f.y);
    canvas.disk(cx, cy, 1.5, ink);
    if (f.airborne) {
      const [x, y] = view.at(f.along, f.y + spec.height + 0.5);
      canvas.disk(x, y, 1.6, INK.air);
    }
    const tag = eventTag(f.events);
    if (tag) {
      const [x, y] = view.at(f.along, f.y + spec.height + 0.9);
      canvas.text(tag, x - tag.length * 3, y - 8, INK.event, 1);
    }
    canvas.text(String(i), cx - 2, cy + 6, INK.dim, 1);
  });
  scaleBar(canvas, box.x + 8, box.y + 12, view.s, 5);
}

/** PANEL 2 — THE PLAN. Where it went and which way it pointed. */
export function drawPlan(canvas, run, box, shown) {
  canvas.text("PLAN — WHERE IT WENT, AND WHICH WAY IT POINTED", box.x, box.y - 9, INK.label, 1);
  const a = extent([...run.frames.map((f) => f.along), 0], 4);
  // Right of the craft is DOWN the page, so the across axis is negated.
  const c = extent([...run.frames.map((f) => -f.across), 0], 4);
  const view = fit(box, { x: a.span, y: c.span }, { x: a.mid, y: c.mid }, 14);
  const at = (along, across) => view.at(along, -across);
  const [ox, oy] = at(0, 0);
  canvas.line(box.x + 4, oy, box.x + box.w - 4, oy, INK.rule);
  canvas.line(ox, oy - 7, ox, oy + 7, INK.dim);
  for (let i = 1; i < run.frames.length; i++) {
    const p = at(run.frames[i - 1].along, run.frames[i - 1].across);
    const q = at(run.frames[i].along, run.frames[i].across);
    canvas.line(p[0], p[1], q[0], q[1], INK.rule);
  }
  const plan = hullPlan(run.spec);
  shown.forEach((f, i) => {
    const t = shown.length > 1 ? i / (shown.length - 1) : 0;
    const ink = mix(INK.early, INK.late, t);
    const yaw = f.heading - run.heading0;
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    // Body (right, forward) → release frame (along, across).
    const corners = plan.map(([r, fwd]) =>
      at(f.along + fwd * cos + r * sin, f.across + r * cos - fwd * sin),
    );
    outline(canvas, corners, ink);
    const [cx, cy] = at(f.along, f.across);
    arrow(canvas, cx, cy, f.vAlong * 0.4 * view.s, f.vAcross * 0.4 * view.s, INK.travel);
    canvas.text(String(i), cx + 3, cy + 3, INK.dim, 1);
  });
  scaleBar(canvas, box.x + 8, box.y + box.h - 8, view.s, 10);
}

/** PANEL 3 — THE FRAMES. One cell per sample: the hull against the
 * water at its own station, and the numbers. Returns the height used. */
export function drawFrames(canvas, run, box, shown) {
  canvas.text("FRAMES — EVERY SAMPLE, WITH ITS NUMBERS", box.x, box.y - 9, INK.label, 1);
  const CELL = { w: 196, h: 118 };
  const cols = Math.max(1, Math.floor(box.w / CELL.w));
  shown.forEach((f, i) => {
    const cx = box.x + (i % cols) * CELL.w;
    const cy = box.y + Math.floor(i / cols) * CELL.h;
    drawCell(canvas, run, f, i, cx, cy, CELL, shown.length);
  });
  return Math.ceil(shown.length / cols) * CELL.h;
}

function drawCell(canvas, run, f, index, x, y, cell, count) {
  const t = count > 1 ? index / (count - 1) : 0;
  const ink = mix(INK.early, INK.late, t);
  canvas.rect(x + 1, y + 1, cell.w - 4, cell.h - 4, INK.rule);
  const tag = eventTag(f.events);
  canvas.text(`${index}  ${round(f.t, 2)}S  ${round(f.along, 1)}M`, x + 6, y + 6, INK.dim, 1);
  if (tag)
    canvas.text(
      tag,
      x + cell.w - 8 - tag.length * 6,
      y + 6,
      tag === "DIVE" ? INK.bad : INK.event,
      1,
    );

  // The hull against its local waterline: the surface height at its own
  // station, at a scale where the whole silhouette fits.
  const s = 16;
  const midX = x + 62;
  const waterY = y + 58;
  canvas.line(x + 6, waterY, x + 118, waterY, INK.water);
  const local = { along: 0, y: f.y - f.water, pitch: f.pitch };
  const view = { at: (a, b) => [midX + a * s, waterY - b * s] };
  outline(
    canvas,
    hullSide(run.spec).map((p) => sidePoint(view, local, p)),
    ink,
  );
  const [cx, cy] = view.at(0, local.y);
  canvas.disk(cx, cy, 1.5, ink);

  const rows = [
    `${round(f.speed * 3.6)}KM/H  PIT ${round(deg(f.pitch))}°  ROL ${round(deg(f.roll))}°`,
    `WET ${round(f.wetted * 100)}%  PLANE ${round(f.planing * 100)}%`,
    `${round(f.rpm)}RPM  THR ${round(f.throttleEff * 100)}%  LEAN ${round(f.lean, 1)}`,
    `${f.airborne ? `AIR ${round(f.airTime, 2)}S` : f.onRamp ? "ON RAMP" : "AFLOAT"}  Y ${round(f.y, 2)}  VY ${round(f.vy, 1)}`,
  ];
  rows.forEach((row, i) => canvas.text(row, x + 6, y + 74 + i * 9, INK.label, 1));
  canvas.text(
    `HDG ${round(deg(f.heading))}°  X ${round(f.x)} Z ${round(f.z)}`,
    x + 124,
    y + 20,
    INK.dim,
    1,
  );
  canvas.text(`SUB ${round(f.submergedDepth, 2)}M`, x + 124, y + 30, INK.dim, 1);
  canvas.text(`WAVE ${round(f.water, 2)}M`, x + 124, y + 40, INK.dim, 1);
}

/** What happened on this step, worst first, as a tag for its cell. */
export function eventTag(events) {
  for (const want of [
    "dive",
    "hit",
    "ground",
    "reset",
    "land",
    "launch",
    "airGate",
    "gate",
    "finish",
  ]) {
    if (events.some((e) => e.kind === want)) return want.toUpperCase();
  }
  return null;
}
