// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TEXTURES THE WATER EFFECTS ARE DRAWN WITH, made in code: the game
// ships no asset files, so the foam's mottling and the spray's soft
// droplet are value noise and a radial falloff written into a DataTexture
// once, at first use. Both are white with the pattern in the ALPHA, so a
// material tints them with the palette's foam and a vertex alpha scales
// them — one texture serves every effect that wants foam.

import * as THREE from "three";
import { valueNoise } from "@engine";

/** Anisotropic samples for a tile seen ALONG the water — the foam under the
 * wake, the water's ripples. Isotropic mip selection at a grazing angle
 * blurs a tile across the view as hard as along it, and what is left is
 * streaks radiating from the lens. Eight is what a phone GPU has; three
 * takes the hardware's maximum where that is less.
 *
 * The rider moves it with the WATER row (`WaterLook.anisotropy`) — it is the
 * half of that row that decides whether the picture STAYS legible where the
 * grid's own detail has been pushed out to. This is the design point it moves
 * around, and what the tiles are made with before any setting is applied. */
export const TEXTURE_ANISOTROPY = 8;

/** Every tile that is seen along the water, so a change of row reaches all of
 * them. They are made once at first use and kept for the life of the page, and
 * a tile made after a row has been set still gets that row's answer — which is
 * the whole reason they are registered rather than each setting a number. */
const tiles: THREE.Texture[] = [];
let anisotropy = TEXTURE_ANISOTROPY;

/** Give a tile the anisotropy the picture is set to, and keep it on the list.
 * three clamps the number to what the hardware actually has. */
export function anisotropic<T extends THREE.Texture>(tile: T): T {
  tiles.push(tile);
  tile.anisotropy = anisotropy;
  return tile;
}

/** Re-sample every registered tile. `needsUpdate` is what makes the sampler
 * parameters be written again — anisotropy is set on upload, so a tile already
 * on the GPU keeps the old number without it. */
export function setTextureAnisotropy(samples: number): void {
  if (samples === anisotropy) return;
  anisotropy = samples;
  for (const tile of tiles) {
    tile.anisotropy = samples;
    tile.needsUpdate = true;
  }
}

const FOAM_SIZE = 128;
const SPRITE_SIZE = 64;

let foam: THREE.DataTexture | null = null;
let sprite: THREE.DataTexture | null = null;

/** Three octaves of value noise over a repeating tile, 0..1 — enough that
 * no lattice shows through as a grid of cells. */
function mottle(x: number, y: number, size: number, seed: number): number {
  // Sampled on a torus so the tile repeats without a seam: every lattice
  // period divides the size.
  const a = valueNoise(x, y, size / 8, seed);
  const b = valueNoise(x, y, size / 16, seed + 7);
  const c = valueNoise(x, y, size / 32, seed + 19);
  return 0.5 * a + 0.32 * b + 0.18 * c;
}

/** The foam: a repeating tile of streaks and holes, alpha 0.18..1. */
export function foamTexture(): THREE.DataTexture {
  if (foam) return foam;
  const n = FOAM_SIZE;
  const data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      // Streaked ALONG u (the wake's length): the noise is read twice as
      // fine across as along.
      const v = mottle(x * 0.5, y, n, 3);
      const a = 0.18 + 0.82 * Math.min(1, Math.max(0, (v - 0.36) / 0.3));
      const k = (y * n + x) * 4;
      data[k] = data[k + 1] = data[k + 2] = 255;
      data[k + 3] = Math.round(a * 255);
    }
  }
  foam = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  foam.wrapS = foam.wrapT = THREE.RepeatWrapping;
  foam.minFilter = THREE.LinearMipmapLinearFilter;
  foam.magFilter = THREE.LinearFilter;
  foam.generateMipmaps = true;
  anisotropic(foam);
  foam.needsUpdate = true;
  return foam;
}

/**
 * R31 — A LAMP'S GLARE: one soft disc, bright in the middle and gone by the
 * rim, which is what a light at range actually is on the eye.
 *
 * The opposite texture to the spray's, and for the opposite reason. Spray
 * is a handful of separate drops and reads as smoke if it is drawn soft;
 * a light has no shape at all past a few hundred metres — it is a point
 * whose glare spreads on the eye — and reads as a painted decal if it is
 * drawn hard. The falloff is the fourth power of the distance from the
 * middle, which puts a small bright core inside a wide faint halo rather
 * than a uniform blob.
 */
let glow: THREE.DataTexture | null = null;
export function glowTexture(): THREE.DataTexture {
  if (glow) return glow;
  const n = SPRITE_SIZE;
  const data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx = (x + 0.5) / n - 0.5;
      const dy = (y + 0.5) / n - 0.5;
      const d = Math.min(1, Math.hypot(dx, dy) * 2);
      const fade = (1 - d) * (1 - d);
      const i = (y * n + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 255;
      data[i + 3] = Math.round(255 * fade * fade);
    }
  }
  glow = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  glow.needsUpdate = true;
  return glow;
}

/** The spray's droplet: a CLUSTER of small solid drops scattered inside
 * the sprite rather than one soft disc — a soft disc reads as a puff of
 * smoke, a handful of drops as water thrown up. */
const DROPS = 9;
export function spriteTexture(): THREE.DataTexture {
  if (sprite) return sprite;
  const n = SPRITE_SIZE;
  const data = new Uint8Array(n * n * 4);
  // The drops: hashed positions inside the sprite's disc, sized 8–15% of
  // it, the first one at the middle so no sprite is hollow.
  const drops: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < DROPS; i++) {
    const ang = valueNoise(i * 7.3, 1.5, 1, 5) * Math.PI * 2;
    const rad = i === 0 ? 0 : 0.12 + 0.3 * valueNoise(i * 3.1, 9.5, 1, 6);
    drops.push({
      x: 0.5 + Math.cos(ang) * rad,
      y: 0.5 + Math.sin(ang) * rad,
      r: 0.08 + 0.07 * valueNoise(i * 5.7, 4.5, 1, 8),
    });
  }
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const u = (x + 0.5) / n;
      const v = (y + 0.5) / n;
      let a = 0;
      for (const d of drops) {
        const dist = Math.hypot(u - d.x, v - d.y) / d.r;
        // Solid to two-thirds of the drop, then a quick soft edge.
        a = Math.max(a, 1 - Math.min(1, Math.max(0, (dist - 0.65) / 0.35)));
      }
      const k = (y * n + x) * 4;
      data[k] = data[k + 1] = data[k + 2] = 255;
      data[k + 3] = Math.round(a * 255);
    }
  }
  sprite = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  sprite.minFilter = THREE.LinearFilter;
  sprite.magFilter = THREE.LinearFilter;
  sprite.needsUpdate = true;
  return sprite;
}
