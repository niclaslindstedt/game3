// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE NIGHT SKY'S GEOMETRY, and the two ways it used to repeat itself.
// Nothing here compiles a shader, so what is held is everything the GLSL is
// GENERATED from, plus the shape of the text it generates:
//
//   THE TURN — the sphere of fixed stars wheels about a pole standing at the
//   coast's own latitude, and the season moves it a quarter of the sky a
//   quarter of the year. The basis that carries it to the dome is a rotation
//   or it is nothing.
//
//   THE WRAP — a galaxy is mottled round a CIRCLE, and value noise on an
//   open lattice does not come back round with it. The band's field folds at
//   a WHOLE number of cells, and a turn of longitude has to move the sample
//   by exactly that many or the fold does not close: what the player sees
//   when it does not is a hard line down the sky, straight through the
//   brightest part of the band.
//
//   THE STARS — one star to a cell of a three-dimensional grid, hashed in
//   three dimensions. Flattened to two the hash is not injective and the
//   cells that collide lie along a circle, so a whole band of the sky comes
//   out an exact copy of another band.
import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { SEASONS } from "@engine";

import {
  GALAXY_CELLS,
  galaxyUv,
  skyTurnAt,
  starfieldGlsl,
  turnBasis,
} from "../pwa/src/game/starfield.ts";

const TAU = Math.PI * 2;
const TAIGA = 62;

describe("the turn of the sphere", () => {
  it("stands the pole at the coast's own latitude", () => {
    for (const lat of [0, 35, 62, 78]) {
      expect(skyTurnAt(3, "autumn", lat).pole).toBeCloseTo((lat * Math.PI) / 180, 12);
    }
  });

  it("looks out at a different sky at the same hour in a different season", () => {
    const spins = SEASONS.map((s) => skyTurnAt(0, s, TAIGA).spin);
    for (let i = 0; i < spins.length; i++)
      for (let j = i + 1; j < spins.length; j++) {
        // How far apart the two skies stand, as a fraction of a turn, the
        // short way round. A season is months of sky; anything under a few
        // degrees would be the same stars twice.
        const apart = Math.abs(((spins[i] - spins[j]) / TAU) % 1);
        expect(Math.min(apart, 1 - apart)).toBeGreaterThan(0.05);
      }
  });

  it("carries the world into celestial coordinates by a rotation and nothing else", () => {
    const out = new THREE.Matrix3();
    for (const hour of [0, 6, 13.5, 21]) {
      turnBasis(skyTurnAt(hour, "winter", TAIGA), out);
      const rows = [0, 1, 2].map(
        (r) => new THREE.Vector3(...[0, 1, 2].map((c) => out.elements[c * 3 + r])),
      );
      for (const row of rows) expect(row.length()).toBeCloseTo(1, 10);
      expect(rows[0].dot(rows[1])).toBeCloseTo(0, 10);
      expect(rows[1].dot(rows[2])).toBeCloseTo(0, 10);
      expect(rows[0].dot(rows[2])).toBeCloseTo(0, 10);
      // A rotation, not a reflection: the stars are not mirrored.
      expect(new THREE.Vector3().crossVectors(rows[0], rows[1]).dot(rows[2])).toBeCloseTo(1, 10);
    }
  });
});

describe("the band's lattice folds where the turn closes", () => {
  it("is cut into a whole number of cells", () => {
    for (const cells of Object.values(GALAXY_CELLS)) {
      expect(Number.isInteger(cells)).toBe(true);
      expect(cells).toBeGreaterThan(0);
    }
  });

  it("moves the sample by exactly that many cells over a turn of longitude", () => {
    for (const cells of Object.values(GALAXY_CELLS))
      for (const lat of [-0.6, -0.02, 0, 0.35, 0.9]) {
        const [xLo, yLo] = galaxyUv(-Math.PI, lat, cells, 9);
        const [xHi, yHi] = galaxyUv(Math.PI, lat, cells, 9);
        // Exactly, not nearly: the fold is `mod` on the cell index, and a
        // span a hair off a whole number lands the two ends of the turn in
        // neighbouring cells instead of the same one.
        expect(xHi - xLo).toBe(cells);
        // …and across the band there is nothing to come back to, so that
        // coordinate is free to run wherever the pitch takes it.
        expect(yHi).toBe(yLo);
      }
  });

  it("fades the band out at its floor rather than stopping at it", () => {
    const glsl = starfieldGlsl();
    // Tested against, the floor is a hard circle round each galactic pole.
    // Taken off, the band reaches the same place at nothing.
    expect(glsl).toMatch(/band -= [\d.]+;\s*\n\s*if \( band <= 0\.0 \)/);
  });

  it("reads the band off the folding field, never the open one", () => {
    const glsl = starfieldGlsl();
    const band = glsl.slice(glsl.indexOf("vec3 milkyWay("), glsl.indexOf("vec3 smudge("));
    expect(band).toContain("galField(");
    // `cloudField` is the cloud chart's, and it is deliberately NOT periodic
    // — the sheets are planes and have no turn to close.
    expect(band).not.toContain("cloudField");
    // The fold itself, and the doubling that keeps it whole octave by octave.
    expect(glsl).toMatch(/float galNoise\([^)]*\)[\s\S]*?mod\(\s*i\.x/);
    expect(glsl).toMatch(/period \*= 2\.0/);
  });
});

describe("every cell of the star grid gets its own star", () => {
  it("hashes the cell in three dimensions", () => {
    const glsl = starfieldGlsl();
    const shell = glsl.slice(glsl.indexOf("vec3 starShell("), glsl.indexOf("vec3 milkyWay("));
    expect(shell).toContain("starHash( cell");
    // The flattening this replaced: two of these three cells shared a key,
    // and the ones that did lay along a circle on the sphere.
    expect(shell).not.toMatch(/cell\.[xyz]\s*[-+]\s*cell\.[xyz]\s*\*/);
    expect(glsl).toMatch(/float starHash\(\s*vec3 p/);
  });
});
