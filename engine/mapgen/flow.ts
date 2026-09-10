// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R27 — THE RIVER RUNS DOWNHILL. R26 drew the water that carries on inland
// past the race; this is the fact that it is going somewhere. A river is
// not a still channel with a bend in it — it is a body of water in
// TRANSIT, and the whole of what that means to a rider is that sitting
// still is not sitting still: hold the throttle shut up there and the
// country goes past anyway, ride up against it and the ground comes slower
// than the speedo says, turn across it and the hull is set down.
//
// WHAT IS CONSERVED IS THE VOLUME, NOT THE SPEED. A river is quoted in
// cubic metres a second (`river.discharge`, R27), and the speed is what is
// left when that volume has to fit through the channel it has there:
//
//     v = Q / A,   A ≈ 4/3 · w · d
//
// the cross-section of a parabolic channel of half-width `w` over a bed
// `d` deep on the centreline, read off the level's own baked ground. So
// the water SLOWS where the river spreads — the wide, deep reach at the
// mouth is the lazy one — and QUICKENS where the banks close in, which is
// the whole feel of riding up one.
//
// The discharge is not the same all the way up, because a river's
// catchment grows the whole way down and that is precisely why it widens.
// A section carries `(A/A_mouth)^flow.gather` of the mouth's water, so the
// quickening goes as A^(gather − 1) — the creek at the head runs about
// four times the mouth's speed rather than the thousand times a rigid
// continuity would demand of a bed that thin.
//
// Across the channel it is the open-channel parabola — fastest on the
// centreline, nothing at the bank, which is where the friction is, and
// scaled so its mean across the width is exactly v. Past the mouth it is a
// PLUME: the river does not stop at the sea, it fans out into it and dies
// over `flow.plume` metres.
//
// BAKED, like everything else a hull reads at 120 Hz (§24.5): two fields
// over the river's own box, one per plan axis, so the whole question "which
// way is this water going and how fast" is two bilinear samples and no
// walk of a polyline. Over its OWN box rather than the level's, because
// the flow is nothing over nine tenths of a level and a field of zeroes is
// a megabyte spent saying so.

import { createHeightfield, sampleField, type Heightfield } from "../lib/heightfield.ts";
import type { River } from "./river.ts";
import { LEVEL_RULES as R } from "./rules.ts";
import type { Flow } from "./types.ts";

/** A station of the water in transit: where it is, how wide the channel
 * is there, and how fast and which way the water is going. */
type Station = {
  x: number;
  z: number;
  width: number;
  speed: number;
  dx: number;
  dz: number;
};

/** The cross-section a channel of half-width `w` over `d` metres of water
 * carries, m²: a parabola's area is two thirds of the box round it, and
 * the box here is 2·w wide by d deep. */
function section(width: number, depth: number): number {
  return (4 / 3) * width * Math.max(depth, 0.05);
}

/** The river's stations, MOUTH FIRST like the river itself, and then the
 * plume that carries on out of it into the basin. */
function stations(river: River, ground: Heightfield): Station[] {
  const { points, widths } = river;
  const out: Station[] = [];
  const depthAt = (i: number): number => -sampleField(ground, points[i].x, points[i].z);
  const mouth = section(widths[0], depthAt(0));
  for (let i = 0; i < points.length; i++) {
    // Downstream is toward the mouth, so the tangent is read backwards
    // along the line the river was drawn up.
    const a = points[Math.max(i - 1, 0)];
    const b = points[Math.min(i + 1, points.length - 1)];
    const dx = a.x - b.x;
    const dz = a.z - b.z;
    const len = Math.hypot(dx, dz) || 1;
    const area = section(widths[i], depthAt(i));
    // What this section carries, and therefore how fast it has to run.
    const carried = river.discharge * Math.pow(area / mouth, R.flow.gather);
    const speed = Math.min(R.flow.max, carried / area);
    out.push({
      x: points[i].x,
      z: points[i].z,
      width: widths[i],
      speed,
      dx: dx / len,
      dz: dz / len,
    });
  }
  // THE PLUME. The river's own heading at the mouth, carried on into the
  // water the race is run in, spreading as it goes and gone by the end of
  // it — which is what a river mouth looks like from the air and what it
  // feels like to ride across one.
  const head = out[0];
  const steps = Math.max(1, Math.round(R.flow.plume / R.river.step));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    out.unshift({
      x: head.x + head.dx * R.flow.plume * t,
      z: head.z + head.dz * R.flow.plume * t,
      width: head.width * (1 + R.flow.spread * t),
      speed: head.speed * (1 - t),
      dx: head.dx,
      dz: head.dz,
    });
  }
  return out;
}

/** Bake the current over the river and its plume. */
export function layFlow(river: River, ground: Heightfield): Flow {
  const line = stations(river, ground);
  const cell = R.grid.cell;
  let minX = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxZ = -Infinity;
  for (const s of line) {
    minX = Math.min(minX, s.x - s.width);
    maxX = Math.max(maxX, s.x + s.width);
    minZ = Math.min(minZ, s.z - s.width);
    maxZ = Math.max(maxZ, s.z + s.width);
  }
  // One cell of margin all round, so the field's rim reads the standing
  // water a bilinear sample outside the box would be clamped to anyway.
  const originX = Math.floor(minX / cell - 1) * cell;
  const originZ = Math.floor(minZ / cell - 1) * cell;
  const cols = Math.ceil((maxX - originX) / cell) + 2;
  const rows = Math.ceil((maxZ - originZ) / cell) + 2;
  const vx = createHeightfield(originX, originZ, cell, cols, rows);
  const vz = createHeightfield(originX, originZ, cell, cols, rows);

  // Nearest station wins, the way the basin's own stamp works: a bend
  // where two stretches of channel come close is one current, not their
  // sum. Walked by arc length so the samples are evenly spaced across the
  // joins whatever the line's own step is.
  const near = new Float64Array(cols * rows).fill(Infinity);
  const put = (s: Station): void => {
    const reach = s.width;
    const r0 = Math.max(0, Math.ceil((s.z - reach - originZ) / cell));
    const r1 = Math.min(rows - 1, Math.floor((s.z + reach - originZ) / cell));
    for (let r = r0; r <= r1; r++) {
      const dz = originZ + r * cell - s.z;
      const half = Math.sqrt(Math.max(0, reach * reach - dz * dz));
      const c0 = Math.max(0, Math.ceil((s.x - half - originX) / cell));
      const c1 = Math.min(cols - 1, Math.floor((s.x + half - originX) / cell));
      for (let c = c0; c <= c1; c++) {
        const dx = originX + c * cell - s.x;
        const d2 = dx * dx + dz * dz;
        const i = r * cols + c;
        if (d2 >= near[i]) continue;
        near[i] = d2;
        // The open-channel profile: fastest on the centreline, nothing at
        // the bank, and scaled so that its mean across the width is the
        // section's own speed — a parabola averages two thirds of its
        // peak, so the peak is three halves of the mean.
        const across = 1.5 * (1 - d2 / (reach * reach));
        vx.data[i] = s.speed * across * s.dx;
        vz.data[i] = s.speed * across * s.dz;
      }
    }
  };
  const step = R.grid.cell / 2;
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i];
    const b = line[i + 1];
    const span = Math.hypot(b.x - a.x, b.z - a.z);
    const count = Math.max(1, Math.ceil(span / step));
    for (let k = 0; k < count; k++) {
      const t = k / count;
      put({
        x: a.x + (b.x - a.x) * t,
        z: a.z + (b.z - a.z) * t,
        width: a.width + (b.width - a.width) * t,
        speed: a.speed + (b.speed - a.speed) * t,
        dx: a.dx + (b.dx - a.dx) * t,
        dz: a.dz + (b.dz - a.dz) * t,
      });
    }
  }
  put(line[line.length - 1]);
  return { vx, vz };
}

/** How fast the water itself is going at a plan point, m/s, and which way.
 * Zero everywhere outside the river's own box, which is most of a level —
 * so this is four comparisons rather than two samples out at sea. */
export function flowAt(
  flow: Flow | null,
  x: number,
  z: number,
  out: { x: number; z: number },
): void {
  out.x = 0;
  out.z = 0;
  if (!flow) return;
  const f = flow.vx;
  const dx = (x - f.originX) / f.cell;
  const dz = (z - f.originZ) / f.cell;
  if (dx < 0 || dz < 0 || dx > f.cols - 1 || dz > f.rows - 1) return;
  out.x = bilinear(flow.vx, dx, dz);
  out.z = bilinear(flow.vz, dx, dz);
}

/** `sampleField`'s read, given cell coordinates that are already known to
 * be inside the grid. */
function bilinear(field: Heightfield, cx: number, cz: number): number {
  const c0 = Math.floor(cx);
  const r0 = Math.floor(cz);
  const c1 = Math.min(c0 + 1, field.cols - 1);
  const r1 = Math.min(r0 + 1, field.rows - 1);
  const tx = cx - c0;
  const tz = cz - r0;
  const d = field.data;
  const cols = field.cols;
  const a = d[r0 * cols + c0];
  const b = d[r0 * cols + c1];
  const c = d[r1 * cols + c0];
  const e = d[r1 * cols + c1];
  return (a + (b - a) * tx) * (1 - tz) + (c + (e - c) * tx) * tz;
}
