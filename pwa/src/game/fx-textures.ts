// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TEXTURES THE WATER EFFECTS ARE DRAWN WITH, made in code: the game
// ships no asset files, so the foam's mottling and the spray's soft
// droplet are value noise and a radial falloff written into a DataTexture
// once, at first use. Both are white with the pattern in the ALPHA, so a
// material tints them with the palette's foam and a vertex alpha scales
// them — one texture serves every effect that wants foam.

import * as THREE from "three";
import { tiledValueNoise, valueNoise } from "@engine";

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

/** THE FOAM TILE IS NOT SQUARE. Foam on a sea is what the wind combs out of
 * a broken crest — spume lines that run a long way downwind and end abruptly
 * across it — so the tile is four times longer ALONG the wind than across
 * it, and the shader gives it a world footprint stretched to match
 * (`FOAM_STREAK`, water-foam.ts) so a texel is square on the water. The
 * lattice under it is read at its own cell count per axis rather than at one
 * square scale with the result squashed, which is what lets the streaks be
 * long without the grain inside them being smeared. */
const FOAM_ALONG = 512;
const FOAM_ACROSS = 128;
const SPRITE_SIZE = 64;

/** The octaves the streaks are summed from — cells ALONG × cells ACROSS the
 * whole tile, and the share of the sum each carries. Four of them, each half
 * the last: the coarsest says where a band of foam is at all, the finest is
 * the grain inside it, and having both is what stops a lace from reading as
 * one stamp repeated. Every count divides its axis into whole texels, and the
 * along counts are half the across ones at every octave, so a feature comes
 * out eight times longer downwind than it is wide. */
const FOAM_OCTAVES: readonly { along: number; across: number; weight: number }[] = [
  { along: 2, across: 4, weight: 0.4 },
  { along: 4, across: 8, weight: 0.28 },
  { along: 8, across: 16, weight: 0.2 },
  { along: 16, across: 32, weight: 0.12 },
];

/** How far the streaks WANDER across the wind, as a share of the tile's
 * width. Spume is laid by a wind that is itself turning, so the lines
 * meander; drawn dead straight the tile is a comb, and a comb is the one
 * thing the eye picks out as a repeat however big the tile is. The warp is
 * read off the same torus as the field and applied to every octave alike, so
 * it neither reopens the seam nor slides the grain off its own streak. */
const FOAM_WANDER = 0.18;

/** The PATCHINESS baked into the tile: a low-frequency mask that thins the
 * foam over part of it and thickens it over the rest, and the floor it never
 * thins past. This is the tile's own variety; the shader lays a second,
 * coarser and INCOMMENSURATE reading of the same tile over the top
 * (`water-foam.ts`), so what repeats at the tile's own period is only ever
 * the grain. */
const FOAM_PATCH_FLOOR = 0.4;

/** Where the threshold field is centred and how wide its spread is. The
 * shader reads this tile's alpha against a sliding window
 * (`smoothstep(1 - share, …)`), so what matters about the distribution is
 * not its mean brightness but how much of it sits inside that window: too
 * narrow and a whitecap is all-or-nothing, too wide and a full share never
 * closes into white. */
const FOAM_MID = 0.34;
const FOAM_SPREAD = 0.36;

let foam: THREE.DataTexture | null = null;
let sprite: THREE.DataTexture | null = null;

/** The streak field at a point of the tile, 0..1 — the octave sum, wandered
 * across the wind and thinned by the patch mask. Both coordinates are a
 * SHARE of the tile, so each octave is asked for its own cell count and
 * every one of them wraps at the tile's edge. */
function streak(u: number, v: number): number {
  const wander = (tiledValueNoise(u * 3, v * 2, 3, 2, 41) - 0.5) * FOAM_WANDER;
  const warped = v + wander;
  let sum = 0;
  for (const o of FOAM_OCTAVES) {
    sum +=
      o.weight * tiledValueNoise(u * o.along, warped * o.across, o.along, o.across, 3 + o.across);
  }
  const patch = tiledValueNoise(u * 2, warped * 3, 2, 3, 17);
  return sum * (FOAM_PATCH_FLOOR + (1 - FOAM_PATCH_FLOOR) * 2 * patch);
}

/** The foam: a repeating tile of streaks and holes, alpha 0.18..1 — and it
 * genuinely repeats. The lattice wraps, so the tile meets itself at its own
 * edges; a field merely SAMPLED over a whole number of periods butts against
 * an unrelated one at every join, and those joins are a hard line every few
 * metres of sea, which is the loudest half of what reads as a pattern. */
export function foamTexture(): THREE.DataTexture {
  if (foam) return foam;
  const w = FOAM_ALONG;
  const h = FOAM_ACROSS;
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = streak((x + 0.5) / w, (y + 0.5) / h);
      const a = 0.18 + 0.82 * Math.min(1, Math.max(0, (v - FOAM_MID) / FOAM_SPREAD));
      const k = (y * w + x) * 4;
      data[k] = data[k + 1] = data[k + 2] = 255;
      data[k + 3] = Math.round(a * 255);
    }
  }
  foam = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
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
