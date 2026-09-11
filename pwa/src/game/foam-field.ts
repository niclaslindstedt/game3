// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FOAM THAT STAYS. A crest goes over, and the air it drove under the
// surface comes back up as a patch of white — and then the WAVE ROLLS ON
// AND THE PATCH DOES NOT. Foam belongs to the water, not to the wave that
// made it: it sits where it was made, drifting only at the surface's own
// crawl, and dies over seconds as the bubbles surface and burst.
//
// The water mesh cannot say that on its own. Its foam share is read off the
// surface AT THIS INSTANT — how steep this face is, how high this crest
// stands — and a world point is at the top of a wavelet for about a tenth
// of a second. So every patch of white it drew was a flash of a tenth of a
// second: measured on seed 28, the median spell a point spent foamed was
// 0.13 s and not one in a thousand reached half a second. That is not foam.
// It is a sea sprinkled with sparks.
//
// This is the memory that was missing: a field of foam anchored to the
// WORLD, not to the mesh and not to the craft. The mesh SOWS what the
// surface is breaking off right now and READS BACK what is still there
// from before; in between, the whole field decays. Two decisions make it
// cheap:
//
// - IT IS ANCHORED TO A WORLD LATTICE AND WRAPS. The store is a square of
//   `side` cells indexed modulo `side`, so following the craft costs the
//   clearing of the one band of cells that has just come round — never a
//   copy of the field. A cell holds the same patch of sea for as long as
//   that sea is in reach, whatever the grid's origin does under it.
// - IT IS COARSE, AND DELIBERATELY. The share is a LOW-FREQUENCY
//   modulation: what draws the streaks and the holes is the foam tile in
//   the shader, metres across, and all the share does is say how much of
//   that tile lights. So a cell a few metres across loses nothing, and old
//   foam coming back blurred is old foam that has spread — which is what
//   old foam does.
//
// The mesh takes the LOUDER of what it sowed and what it read, so the
// instant a crest goes over it is drawn at the grid's own fineness and the
// field only ever adds the tail. Nothing here allocates after the field is
// made.
//
// Three-free and DOM-free, so `tests/foam_field_test.ts` holds the lot.

/** How long foam lives, s — the e-folding time of a whitecap's decay once
 * the crest has passed and the patch is left standing in the water
 * (Monahan and Lu's stage B, ~3.5 s; stage A, the breaking itself, is the
 * mesh's own instantaneous term and needs no memory). Below `FLOOR` a cell
 * is cleared outright: a share that small lights nothing in the tile, and
 * carrying it keeps the whole field warm forever. */
export const FOAM_LIFE = 3.5;
const FLOOR = 0.004;

/** Cells a side — a POWER OF TWO, so following the craft round the wrap is
 * a mask rather than two divisions on every read of every vertex. One
 * number for every WATER row: the field's CELL is sized from the row's
 * reach instead, so the store costs the same on a phone as on a desktop and
 * always covers the water the row draws. */
export const FOAM_SIDE = 128;

export type FoamField = {
  /** The cell's edge, m. */
  readonly cell: number;
  /** Cells a side. */
  readonly side: number;
  /** Follow the craft and age the whole field by `dt` s. Call once a frame,
   * before any sowing. */
  advance(cx: number, cz: number, dt: number): void;
  /** Lay a breaking share over the square of `step` m centred on the plan
   * point — `step` being the edge of the cell the sample stands for, so a
   * coarse ring covers the sea it speaks for and leaves no holes between
   * its vertices. The louder share wins; sowing is order-free. */
  sow(x: number, z: number, step: number, share: number): void;
  /** What foam is standing at a plan point, 0 outside the field. */
  read(x: number, z: number): number;
  /** Forget everything — a new sea, or a clock that has jumped. */
  clear(): void;
};

/** A field covering `reach` m either side of the craft. */
export function createFoamField(reach: number, side: number = FOAM_SIDE): FoamField {
  if (side < 2 || (side & (side - 1)) !== 0)
    throw new Error(`foam field side ${side} is not a power of two`);
  const cell = (2 * reach) / side;
  const data = new Float32Array(side * side);
  // The world cell index of the field's low corner, and whether it has ever
  // been placed.
  let ax = 0;
  let az = 0;
  let placed = false;

  // Two's complement makes the mask right for a negative world cell too.
  const mask = side - 1;
  const wrap = (i: number): number => i & mask;
  const clearCol = (i: number): void => {
    const c = wrap(i);
    for (let j = 0; j < side; j++) data[j * side + c] = 0;
  };
  const clearRow = (j: number): void => {
    const r = wrap(j) * side;
    for (let i = 0; i < side; i++) data[r + i] = 0;
  };

  return {
    cell,
    side,
    advance(cx, cz, dt) {
      const nax = Math.floor(cx / cell) - (side >> 1);
      const naz = Math.floor(cz / cell) - (side >> 1);
      if (!placed) {
        data.fill(0);
        placed = true;
      } else if (Math.abs(nax - ax) >= side || Math.abs(naz - az) >= side) {
        // Further than the field is wide: nothing in it is this sea.
        data.fill(0);
      } else {
        // The cells that have gone out of reach are the cells that have
        // just come into it — the same texels, a whole field apart — so
        // clearing the band once does both.
        for (let i = Math.min(ax, nax); i < Math.max(ax, nax); i++) clearCol(i);
        for (let j = Math.min(az, naz); j < Math.max(az, naz); j++) clearRow(j);
      }
      ax = nax;
      az = naz;
      if (dt <= 0) return;
      const k = Math.exp(-dt / FOAM_LIFE);
      for (let i = 0; i < data.length; i++) {
        const v = data[i] * k;
        data[i] = v > FLOOR ? v : 0;
      }
    },
    sow(x, z, step, share) {
      if (!(share > FLOOR)) return;
      const half = Math.max(0, step) / 2;
      const i0 = Math.max(ax, Math.floor((x - half) / cell));
      const i1 = Math.min(ax + side - 1, Math.floor((x + half) / cell));
      const j0 = Math.max(az, Math.floor((z - half) / cell));
      const j1 = Math.min(az + side - 1, Math.floor((z + half) / cell));
      for (let j = j0; j <= j1; j++) {
        const r = wrap(j) * side;
        for (let i = i0; i <= i1; i++) {
          const k = r + wrap(i);
          if (share > data[k]) data[k] = share;
        }
      }
    },
    read(x, z) {
      // Bilinear off the cell CENTRES, so a patch read back has no step in
      // it at a cell's edge.
      const fx = x / cell - 0.5;
      const fz = z / cell - 0.5;
      const i0 = Math.floor(fx);
      const j0 = Math.floor(fz);
      if (i0 < ax || i0 + 1 >= ax + side || j0 < az || j0 + 1 >= az + side) return 0;
      const tx = fx - i0;
      const tz = fz - j0;
      const ia = wrap(i0);
      const ib = wrap(i0 + 1);
      const ra = wrap(j0) * side;
      const rb = wrap(j0 + 1) * side;
      const top = data[ra + ia] + (data[ra + ib] - data[ra + ia]) * tx;
      const bot = data[rb + ia] + (data[rb + ib] - data[rb + ia]) * tx;
      return top + (bot - top) * tz;
    },
    clear() {
      data.fill(0);
      placed = false;
    },
  };
}
