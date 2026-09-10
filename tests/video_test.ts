// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PICTURE'S OWN RULES, DOM-FREE — the dictionary between a row on
// OPTIONS ▸ VIDEO and what the renderer does about it
// (`pwa/src/game/settings-video.ts`), and the frame rate the corner reads
// (`frame-rate.ts`).
//
// Neither module draws anything, which is exactly why they can be held to a
// rule here: a ladder that is not monotonic, or a DETAIL preset that no longer
// reads back as itself, is a menu row that lies about the frame under it — and
// no screenshot would catch either.
import { describe, expect, it } from "vitest";

import { BIOME_IDS, WEATHER_IDS, biomeOf } from "@engine";

import { FPS_SMOOTHING, FPS_STALL_MS, FPS_UNKNOWN, smoothFps } from "../pwa/src/game/frame-rate.ts";
import { skyAt } from "../pwa/src/game/sky.ts";
import {
  DEFAULT_VIDEO,
  DETAIL_LEVELS,
  DETAIL_PRESETS,
  DISTANCE_LEVELS,
  DISTANCE_LOOK,
  FLORA_SCALE,
  RESOLUTION_SCALE,
  SPRAY_SCALE,
  WATER_LEVELS,
  WATER_LOOK,
  detailOf,
} from "../pwa/src/game/settings-video.ts";

describe("the WATER ladder", () => {
  it("is a real step at every stop, in every direction that matters", () => {
    // The row's promise: a stop up is a finer sea, further out, that survives
    // further into the distance. A ladder that only moved one of the four
    // would be a row a rider moves and cannot see.
    for (let i = 1; i < WATER_LEVELS.length; i++) {
      const under = WATER_LOOK[WATER_LEVELS[i - 1]];
      const over = WATER_LOOK[WATER_LEVELS[i]];
      expect(over.grid).toBeGreaterThan(under.grid);
      expect(over.half).toBeGreaterThan(under.half);
      // The CELL goes the other way: smaller is finer.
      expect(over.cell).toBeLessThan(under.cell);
      expect(over.rippleFade[0]).toBeGreaterThan(under.rippleFade[0]);
      expect(over.rippleFade[1]).toBeGreaterThan(under.rippleFade[1]);
      expect(over.anisotropy).toBeGreaterThan(under.anisotropy);
    }
  });

  it("keeps the ripples fading out rather than in", () => {
    for (const look of Object.values(WATER_LOOK)) {
      expect(look.rippleFade[0]).toBeLessThan(look.rippleFade[1]);
    }
  });

  it("leaves the grid coarse enough at the edge to hand over to the far water", () => {
    // The near grid is laid on a cubic, `offset(s) = half·(a·s + (1−a)·s³)`
    // with `a` set by the centre cell. `a` above 1 would UNBEND the curve —
    // cells finest at the RIM — which is the grid spending its budget where
    // the rider is not looking. It is a fact about the three numbers together,
    // so a stop cannot be retuned into it by accident.
    for (const look of Object.values(WATER_LOOK)) {
      const a = (look.cell * (look.grid - 1)) / (2 * look.half);
      expect(a).toBeGreaterThan(0);
      expect(a).toBeLessThan(1);
    }
  });

  it("prices the top stop honestly against the design point", () => {
    // The samples-a-frame bill is the grid squared, and it is the whole reason
    // this is a row rather than a number the game picks. HIGH is under twice
    // the design point: past that the water alone eats a 60 Hz frame, and the
    // stop would be one nobody could actually use.
    const calls = (level: keyof typeof WATER_LOOK): number => WATER_LOOK[level].grid ** 2;
    expect(calls("low")).toBeLessThan(calls("medium"));
    expect(calls("high") / calls("medium")).toBeGreaterThan(1.3);
    expect(calls("high") / calls("medium")).toBeLessThan(2);
  });
});

/** THE CLEAREST AIR THE GAME CAN DEAL — the longest `fogFar` any level's sky
 * can be built with, over every coast's latitude, every weather (R19), every
 * hour (R13) and every cover the wind can raise. It is a search rather than a
 * constant because the answer is `sky.ts`'s and moves when a rung is retuned;
 * pinning a number here would be a second copy of it that nothing updates. */
function longestFog(): number {
  let far = 0;
  for (const id of BIOME_IDS) {
    const lat = biomeOf(id).latitude;
    for (const weather of WEATHER_IDS) {
      for (let hour = 0; hour < 24; hour += 0.5) {
        for (let cover = 0; cover <= 1; cover += 0.1) {
          far = Math.max(far, skyAt(hour, lat, weather, cover).fogFar);
        }
      }
    }
  }
  return far;
}

describe("the DISTANCE ladder", () => {
  it("is a real step at every stop, in every direction that matters", () => {
    // A stop up is more coast, more cover on it, and clearer air to see the
    // two through. A ladder that moved the radii and not the haze would buy
    // frames a rider could watch being bought.
    for (let i = 1; i < DISTANCE_LEVELS.length; i++) {
      const under = DISTANCE_LOOK[DISTANCE_LEVELS[i - 1]];
      const over = DISTANCE_LOOK[DISTANCE_LEVELS[i]];
      expect(over.shore).toBeGreaterThan(under.shore);
      expect(over.cover).toBeGreaterThan(under.cover);
      expect(over.haze).toBeGreaterThan(under.haze);
    }
  });

  it("never stands a wood on water", () => {
    // The cover is a silhouette and the slab under it is not, so cover that
    // outlived its ground would read as trees floating off the shore.
    for (const look of Object.values(DISTANCE_LOOK)) {
      expect(look.cover).toBeLessThanOrEqual(look.shore);
      expect(look.cover).toBeGreaterThan(0);
    }
  });

  it("CLOSES THE FOG OVER ITS OWN CUT-OFF, on the clearest sky it can deal", () => {
    // THE ROW'S ONE PROMISE, and the only one that matters: everything it
    // stops drawing was already invisible. The fog is complete at `fogFar`, so
    // a stop is honest exactly when both its radii are at or beyond the
    // furthest the fog can reach once that stop has pulled it in — and it has
    // to hold for the CLEAREST sky the generator can deal, because that is the
    // one level where a dishonest stop shows the shore ending.
    const clearest = longestFog();
    expect(clearest).toBeGreaterThan(0);
    for (const id of DISTANCE_LEVELS) {
      const look = DISTANCE_LOOK[id];
      expect(clearest * look.haze).toBeLessThanOrEqual(look.cover);
      expect(clearest * look.haze).toBeLessThanOrEqual(look.shore);
    }
  });

  it("leaves the design point's own air alone", () => {
    // MEDIUM ships, and it may not change what a level looks like: at haze 1
    // the fog is the sky's own, and the radii only decline to draw what the
    // sky had already finished with.
    expect(DEFAULT_VIDEO.distance).toBe("medium");
    expect(DISTANCE_LOOK.medium.haze).toBe(1);
    // …and LOW pays for its frames in air rather than in missing world, while
    // HIGH stays a stop of headroom rather than a view to the end of the map.
    expect(DISTANCE_LOOK.low.haze).toBeGreaterThan(0.4);
    expect(DISTANCE_LOOK.high.haze).toBeLessThan(1.5);
  });
});

describe("the picture's other ladders", () => {
  it("tops out at the device's own screen and never above it", () => {
    expect(RESOLUTION_SCALE.high).toBe(1);
    expect(RESOLUTION_SCALE.medium).toBeLessThan(RESOLUTION_SCALE.high);
    expect(RESOLUTION_SCALE.low).toBeLessThan(RESOLUTION_SCALE.medium);
    expect(RESOLUTION_SCALE.low).toBeGreaterThan(0);
  });

  it("lets the spray be turned off outright and never past full", () => {
    expect(SPRAY_SCALE.off).toBe(0);
    expect(SPRAY_SCALE.full).toBe(1);
    expect(SPRAY_SCALE.low).toBeGreaterThan(0);
    expect(SPRAY_SCALE.low).toBeLessThan(SPRAY_SCALE.full);
  });

  it("keeps a tree line at every stop", () => {
    // The stand is planted at `lush` and thinned by count, so nothing may ask
    // for more than that — and a taiga shore with no trees on it is a quarry,
    // which is why the bottom stop is a share rather than nothing.
    expect(FLORA_SCALE.sparse).toBeGreaterThan(0);
    expect(FLORA_SCALE.normal).toBe(1);
    expect(FLORA_SCALE.lush).toBeGreaterThanOrEqual(FLORA_SCALE.normal);
    for (const share of Object.values(FLORA_SCALE)) {
      expect(share).toBeLessThanOrEqual(FLORA_SCALE.lush);
    }
  });
});

describe("the DETAIL row's reverse reading (detailOf)", () => {
  it("reads every preset back as itself", () => {
    // The row shows `detailOf(video)`, so a preset that did not survive the
    // round trip would be a chip a rider presses and the cursor leaves.
    for (const id of DETAIL_LEVELS) {
      expect(detailOf(DETAIL_PRESETS[id])).toBe(id);
    }
  });

  it("lands a hand-tuned set on the picture it most resembles", () => {
    expect(detailOf({ ...DETAIL_PRESETS.high, fauna: false })).toBe("high");
  });

  it("breaks a tie toward the CHEAPER picture", () => {
    // `medium` and `high` differ only in the tree line, so a blob that agrees
    // with neither on it agrees equally with both — and must never be handed
    // the heavier one.
    expect(detailOf({ spray: "full", fauna: true })).toBe("medium");
  });

  it("calls a blob with no opinion the design point, not the floor", () => {
    expect(detailOf({})).toBe("medium");
    expect(detailOf({ water: "low" })).toBe("medium");
  });

  it("is what the shipped default reads as", () => {
    expect(detailOf(DEFAULT_VIDEO)).toBe("medium");
    expect(DEFAULT_VIDEO.water).toBe("medium");
    expect(DEFAULT_VIDEO.seeThrough).toBe(true);
  });
});

describe("the frame rate the corner reads (frame-rate.ts)", () => {
  it("takes the first real frame whole", () => {
    // Easing up from zero would spend half a second saying something untrue on
    // exactly the frames somebody turned the readout on to look at.
    expect(smoothFps(FPS_UNKNOWN, 1000 / 60)).toBeCloseTo(60);
  });

  it("settles on a steady rate and holds still on it", () => {
    let rate = smoothFps(FPS_UNKNOWN, 1000 / 30);
    for (let i = 0; i < 60; i++) rate = smoothFps(rate, 1000 / 30);
    expect(rate).toBeCloseTo(30, 4);
  });

  it("moves toward a new rate rather than jumping to it", () => {
    const rate = smoothFps(60, 1000 / 30);
    expect(rate).toBeLessThan(60);
    expect(rate).toBeGreaterThan(30);
    expect(rate).toBeCloseTo(60 + (30 - 60) * FPS_SMOOTHING);
  });

  it("reaches a halved rate within a second of frames", () => {
    // The other half of the balance: a reading that is honest about a stutter
    // only after the corner it happened in is a reading nobody can act on.
    let rate = 60;
    for (let i = 0; i < 30; i++) rate = smoothFps(rate, 1000 / 30);
    expect(rate).toBeLessThan(31);
  });

  it("holds through a STALL rather than burying itself", () => {
    // The tab coming back, a shore being built, the first draw compiling every
    // shader: none of them is a frame rate, and folding one in reads as single
    // digits for seconds after the game is fine again.
    const steady = smoothFps(60, 1000 / 60);
    expect(smoothFps(steady, FPS_STALL_MS + 1)).toBe(steady);
    expect(smoothFps(steady, 4000)).toBe(steady);
  });

  it("refuses a frame that is not a duration", () => {
    expect(smoothFps(60, 0)).toBe(60);
    expect(smoothFps(60, -8)).toBe(60);
    expect(smoothFps(60, Number.NaN)).toBe(60);
    expect(smoothFps(60, Number.POSITIVE_INFINITY)).toBe(60);
  });
});
