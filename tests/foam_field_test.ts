// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FOAM THAT STAYS (foam-field.ts), held without a GPU. The whole point
// of the field is that foam belongs to the WATER: what is sown at a place
// is still there when the craft has moved on, it dies at the rate a
// whitecap dies at, and water that has been out of reach comes back clean
// rather than carrying somebody else's foam round the wrap.
import { describe, expect, it } from "vitest";

import { createFoamField, FOAM_LIFE, FOAM_SIDE } from "../pwa/src/game/foam-field.ts";

/** A field with a round cell, so the cases can name world points rather
 * than chase a fraction: 2 m cells over `FOAM_SIDE` of them. */
const REACH = FOAM_SIDE;
const CELL = 2;

describe("the foam field", () => {
  it("covers the reach it was asked for, at one cell count for every row", () => {
    const field = createFoamField(REACH);
    expect(field.side).toBe(FOAM_SIDE);
    expect(field.cell).toBeCloseTo(CELL, 9);
    // The whole near grid the row draws is inside it, both ways.
    expect(field.side * field.cell).toBeCloseTo(2 * REACH, 9);
  });

  it("holds what was sown at the place it was sown, not at the craft", () => {
    const field = createFoamField(REACH);
    field.advance(0, 0, 0);
    field.sow(30, -12, CELL, 0.8);
    expect(field.read(30, -12)).toBeGreaterThan(0.7);
    // The craft rides on a hundred metres; the foam has not come with it.
    field.advance(100, 0, 0);
    expect(field.read(30, -12)).toBeGreaterThan(0.7);
    expect(field.read(130, -12)).toBe(0);
  });

  it("dies at a whitecap's rate", () => {
    const field = createFoamField(REACH);
    field.advance(0, 0, 0);
    field.sow(0, 0, CELL, 1);
    field.advance(0, 0, FOAM_LIFE);
    expect(field.read(0, 0)).toBeCloseTo(Math.exp(-1), 3);
    field.advance(0, 0, FOAM_LIFE);
    expect(field.read(0, 0)).toBeCloseTo(Math.exp(-2), 3);
    // And it goes out rather than lingering forever at a share that lights
    // nothing in the tile.
    field.advance(0, 0, 40 * FOAM_LIFE);
    expect(field.read(0, 0)).toBe(0);
  });

  it("is quiet where nothing has broken, and outside its own reach", () => {
    const field = createFoamField(REACH);
    field.advance(0, 0, 0);
    field.sow(0, 0, CELL, 1);
    expect(field.read(40, 40)).toBe(0);
    expect(field.read(4 * REACH, 0)).toBe(0);
    expect(field.read(0, -4 * REACH)).toBe(0);
  });

  it("the louder share wins, and sowing is order-free", () => {
    const a = createFoamField(REACH);
    const b = createFoamField(REACH);
    a.advance(0, 0, 0);
    b.advance(0, 0, 0);
    a.sow(0, 0, CELL, 0.3);
    a.sow(0, 0, CELL, 0.9);
    b.sow(0, 0, CELL, 0.9);
    b.sow(0, 0, CELL, 0.3);
    expect(a.read(0, 0)).toBeCloseTo(b.read(0, 0), 9);
    expect(a.read(0, 0)).toBeGreaterThan(0.85);
  });

  it("spreads a sample over the water it speaks for, so a coarse ring leaves no holes", () => {
    const fine = createFoamField(REACH);
    const coarse = createFoamField(REACH);
    fine.advance(0, 0, 0);
    coarse.advance(0, 0, 0);
    // One vertex of a 1 m core cell, and one of a 16 m ring cell, at the
    // same place. The coarse one speaks for all the water round it.
    fine.sow(0, 0, 1, 1);
    coarse.sow(0, 0, 16, 1);
    expect(fine.read(6, 6)).toBe(0);
    expect(coarse.read(6, 6)).toBeGreaterThan(0.9);
  });

  it("forgets water that has been out of reach, rather than wrapping it round", () => {
    const field = createFoamField(REACH);
    field.advance(0, 0, 0);
    field.sow(0, 0, CELL, 1);
    // Far enough that the cell holding that foam is reused for water a
    // whole field away — and that water has never broken.
    field.advance(2 * REACH + 10 * CELL, 0, 0);
    expect(field.read(2 * REACH + 10 * CELL, 0)).toBe(0);
    // ...and coming back, the foam that was here is gone with it.
    field.advance(0, 0, 0);
    expect(field.read(0, 0)).toBe(0);
  });

  it("forgets everything on a new sea", () => {
    const field = createFoamField(REACH);
    field.advance(0, 0, 0);
    field.sow(0, 0, CELL, 1);
    field.clear();
    field.advance(0, 0, 0);
    expect(field.read(0, 0)).toBe(0);
  });
});
