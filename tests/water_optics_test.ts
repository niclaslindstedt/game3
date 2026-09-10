// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT THE WATER IS MADE OF, PER COAST — the optical half of a biome
// (`pwa/src/game/water-optics.ts`), which is a table rather than a drawing
// and so can be held to a rule here.
//
// Two things it holds that no screenshot would catch. The first is the
// PARITY: `engine/mapgen/biomes.ts` says which coasts are built and this
// table says what their water looks like, and neither can import the other's
// reason to exist — so a coast added to one and not the other is a level
// that throws on load, and the case below is what turns that into a red test
// instead. The second is the SHAPE of a row: a window that runs backwards or
// a ramp whose ends are the wrong way round is a sea that gets CLEARER with
// depth, which reads as a bug in the shader rather than as a bad number.
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { BIOME_IDS } from "@engine";

import { PALETTE } from "../pwa/src/identity.ts";
import {
  seaHaze,
  seaTone,
  seaTones,
  seaWindow,
  WATER_OPTICS,
  waterOpticsOf,
} from "../pwa/src/game/water-optics.ts";

describe("water optics", () => {
  it("draws the water of every coast the engine can build", () => {
    for (const id of BIOME_IDS) expect(() => waterOpticsOf(id)).not.toThrow();
    // …and nothing else: a row here for a coast the engine cannot generate
    // is a look nobody will ever see, and the pair drifts from then on.
    expect(Object.keys(WATER_OPTICS).sort()).toEqual([...BIOME_IDS].sort());
  });

  it("refuses a coast whose water nobody has drawn", () => {
    expect(() => waterOpticsOf("atoll")).toThrow(/atoll/);
  });

  it("keeps the taiga's water the app's own palette", () => {
    // `identity.ts` is the one source of the app's colours, and the taiga's
    // sea IS the sea the palette was authored around — so this row cites it
    // rather than restating three hexes that would then drift from the icon.
    const taiga = waterOpticsOf("taiga");
    expect(taiga.shallow).toBe(PALETTE.seaShallow);
    expect(taiga.sea).toBe(PALETTE.sea);
    expect(taiga.deep).toBe(PALETTE.seaDeep);
  });

  for (const id of BIOME_IDS) {
    describe(id, () => {
      const optics = waterOpticsOf(id);

      it("thickens its window with depth and never reaches a mirror", () => {
        const [clear, deep] = optics.window;
        expect(clear).toBeGreaterThan(0);
        expect(deep).toBeGreaterThan(clear);
        // Short of 1: a surface that is fully opaque straight down is not a
        // window at all, and the sea life under it is drawn for nobody.
        expect(deep).toBeLessThan(1);
        expect(seaWindow(optics, 0)).toBeCloseTo(clear);
        expect(seaWindow(optics, optics.clarity)).toBeCloseTo(deep);
        // Flat past the clarity rather than climbing on.
        expect(seaWindow(optics, optics.clarity * 4)).toBeCloseTo(deep);
      });

      it("takes what is under it over the clarity and no further", () => {
        expect(optics.clarity).toBeGreaterThan(0);
        expect(seaHaze(optics, 0)).toBe(0);
        expect(seaHaze(optics, optics.clarity / 2)).toBeCloseTo(0.5);
        expect(seaHaze(optics, optics.clarity)).toBe(1);
        expect(seaHaze(optics, optics.clarity * 10)).toBe(1);
      });

      it("keeps the sea life inside what the eye can reach", () => {
        // Every animal in the catalog holds shallower than this, so the
        // deepest are ghosts rather than gone — the whole reason `depth` and
        // `water` are separate fields in `defs/fauna.ts`. A coast whose
        // clarity fell under its own sea life would draw pods nobody can see.
        expect(optics.clarity).toBeGreaterThan(6);
      });

      it("runs its tones from the shallows to the deep, and its bed darker still", () => {
        expect(optics.shallowTo).toBeGreaterThan(0);
        expect(optics.deepTo).toBeGreaterThan(optics.shallowTo);
        const tones = seaTones(optics);
        const out = new THREE.Color();
        expect(seaTone(optics, 0, out).getHex()).toBe(tones.shallow.getHex());
        expect(seaTone(optics, optics.shallowTo, out).getHex()).toBe(tones.sea.getHex());
        expect(seaTone(optics, optics.deepTo, out).getHex()).toBe(tones.deep.getHex());
        // Past the deep it stays there rather than running on past the tone.
        expect(seaTone(optics, optics.deepTo * 3, out).getHex()).toBe(tones.deep.getHex());
        // The water gets DARKER with depth, and the unlit bottom it fades
        // into is darker than any of it: fade the bed toward the bright
        // water instead and the sea comes back pale and milky.
        const lum = (c: THREE.Color): number => c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722;
        expect(lum(tones.sea)).toBeLessThan(lum(tones.shallow));
        expect(lum(tones.deep)).toBeLessThan(lum(tones.sea));
        expect(lum(tones.bed)).toBeLessThan(lum(tones.deep));
      });
    });
  }
});
