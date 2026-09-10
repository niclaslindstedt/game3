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

import { BIOME_IDS, WEATHER_IDS, biomeOf, skyCover } from "@engine";

import { LEVEL_SEEDS, levelFor } from "./support/levels.ts";

import {
  FPS_SMOOTHING,
  FPS_STALL_MS,
  FPS_UNKNOWN,
  createFrameGate,
  smoothFps,
} from "../pwa/src/game/frame-rate.ts";
import { dressSky } from "../pwa/src/game/cloud-field.ts";
import { skyAt } from "../pwa/src/game/sky.ts";
import {
  DEFAULT_VIDEO,
  DETAIL_LEVELS,
  DETAIL_PRESETS,
  DISTANCE_LEVELS,
  DISTANCE_LOOK,
  FLORA_SCALE,
  FRAME_RATE_CAP,
  FRAME_RATE_LEVELS,
  RAIN_LEVELS,
  RAIN_LOOK,
  REFLECTION_LEVELS,
  REFLECTION_LOOK,
  RESOLUTION_SCALE,
  SKY_LEVELS,
  SKY_LOOK,
  SPRAY_SCALE,
  WAKE_LEVELS,
  WAKE_LOOK,
  WATER_LEVELS,
  WATER_LOOK,
  detailOf,
} from "../pwa/src/game/settings-video.ts";
import { layWaterGrid, waterReach, waterSamples } from "../pwa/src/game/water-grid.ts";

describe("the WATER ladder", () => {
  it("is a real step at every stop, in every direction that matters", () => {
    // The row's promise: a stop up is a finer sea, further out, that survives
    // further into the distance. A ladder that only moved one of the four
    // would be a row a rider moves and cannot see.
    for (let i = 1; i < WATER_LEVELS.length; i++) {
      const under = WATER_LOOK[WATER_LEVELS[i - 1]];
      const over = WATER_LOOK[WATER_LEVELS[i]];
      expect(waterSamples(over)).toBeGreaterThan(waterSamples(under));
      expect(waterReach(over)).toBeGreaterThan(waterReach(under));
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

  it("keeps the craft on fine water however far off the grid's centre it sits", () => {
    // The grid snaps to its coarsest cell, so the craft stands up to half of
    // one — on the diagonal, a little more — off the core's centre. What is
    // left of the core past that is the fine water round the hull, and it has
    // to be at least a hull's length or the rider is on the first ring.
    for (const look of Object.values(WATER_LOOK)) {
      const grid = layWaterGrid(look);
      const coreHalf = (look.core / 2) * look.cell;
      expect(coreHalf - grid.snap / 2).toBeGreaterThan(8);
    }
  });

  it("prices the top stop honestly against the design point", () => {
    // The samples-a-frame bill is the grid's vertex count, and it is the whole
    // reason this is a row rather than a number the game picks. HIGH is under
    // twice the design point: past that the water alone eats a 60 Hz frame,
    // and the stop would be one nobody could actually use.
    const calls = (level: keyof typeof WATER_LOOK): number => waterSamples(WATER_LOOK[level]);
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

describe("the SKY ladder", () => {
  it("is a real step at every stop, in what a sheet costs", () => {
    // A stop up reads every sheet deeper, and never fewer of them.
    for (let i = 1; i < SKY_LEVELS.length; i++) {
      const under = SKY_LOOK[SKY_LEVELS[i - 1]];
      const over = SKY_LOOK[SKY_LEVELS[i]];
      expect(over.octaves).toBeGreaterThan(under.octaves);
      expect(over.layers).toBeGreaterThanOrEqual(under.layers);
      expect(Number(over.sunlit)).toBeGreaterThanOrEqual(Number(under.sunlit));
    }
  });

  it("promises at the top exactly the sheets the chart deals, and no more", () => {
    // The dome compiles for the sheets actually dealt, so a stop that named a
    // sheet the chart never stacks would cost nothing and buy nothing — a
    // row the page could not tell from the one under it. Every weather over
    // the shared corpus, so a chart that starts dealing a third sheet moves
    // the ladder with it rather than silently under-drawing it.
    let most = 0;
    for (const seed of LEVEL_SEEDS) {
      const level = levelFor(seed);
      for (const weather of WEATHER_IDS) {
        const deck = skyAt(12, biomeOf(level.biome).latitude, weather, 0.5).deck;
        const dealt = dressSky(level, weather, skyCover(level.wind.speed), deck ? deck.base : null);
        most = Math.max(most, dealt.layers.length);
      }
    }
    expect(most).toBeGreaterThan(1);
    expect(SKY_LOOK.high.layers).toBe(most);
  });
});

describe("the picture's other ladders", () => {
  it("tops out at the device's own screen and never above it", () => {
    expect(RESOLUTION_SCALE.high).toBe(1);
    expect(RESOLUTION_SCALE.medium).toBeLessThan(RESOLUTION_SCALE.high);
    expect(RESOLUTION_SCALE.low).toBeLessThan(RESOLUTION_SCALE.medium);
    expect(RESOLUTION_SCALE.low).toBeGreaterThan(0);
  });

  it("halves the PIXELS at every stop down, not merely the side", () => {
    // The bill is per pixel, and the scale is a length: a stop that trimmed
    // the side by a quarter would trim the bill by under half, which is a
    // stop a struggling machine could not feel.
    const pixels = (scale: number): number => scale * scale;
    expect(pixels(RESOLUTION_SCALE.high) / pixels(RESOLUTION_SCALE.medium)).toBeGreaterThanOrEqual(
      2,
    );
    expect(pixels(RESOLUTION_SCALE.medium) / pixels(RESOLUTION_SCALE.low)).toBeGreaterThanOrEqual(
      1.9,
    );
  });

  it("reads a bigger mirror LESS blurred, so the top stop is a picture and not a price", () => {
    // Measured before the blur was on the ladder: under two per cent of the
    // sea's pixels moved between SOFT and SHARP, because a texture with 2.25
    // times the pixels read the same number of mip levels down is the same
    // smear. A stop that grows the picture has to read it sharper too — and
    // never sharp: a tree line read off a wave at full resolution is a
    // second tree line standing on its head.
    expect(REFLECTION_LOOK.off.scale).toBe(0);
    for (let i = 1; i < REFLECTION_LEVELS.length; i++) {
      const under = REFLECTION_LOOK[REFLECTION_LEVELS[i - 1]];
      const over = REFLECTION_LOOK[REFLECTION_LEVELS[i]];
      expect(over.scale).toBeGreaterThan(under.scale);
      expect(over.blur).toBeLessThanOrEqual(under.blur);
    }
    expect(REFLECTION_LOOK.sharp.blur).toBeLessThan(REFLECTION_LOOK.soft.blur);
    expect(REFLECTION_LOOK.sharp.blur).toBeGreaterThan(0);
  });

  it("lets the wake be turned off outright, and keeps the road under the relief", () => {
    // OFF is no map and no pass; the middle stop keeps the foam and the churn
    // (the map) and drops the relief, which is the dear half of the read. A
    // stop that read the relief off no map would be a shader reading nothing
    // four times over.
    expect(WAKE_LOOK.off).toEqual({ map: false, relief: false });
    expect(WAKE_LOOK.full).toEqual({ map: true, relief: true });
    for (const id of WAKE_LEVELS) {
      if (WAKE_LOOK[id].relief) expect(WAKE_LOOK[id].map).toBe(true);
    }
    // …and the ladder only ever adds: nothing a lower stop draws is missing
    // from the one over it.
    for (let i = 1; i < WAKE_LEVELS.length; i++) {
      const under = WAKE_LOOK[WAKE_LEVELS[i - 1]];
      const over = WAKE_LOOK[WAKE_LEVELS[i]];
      expect(Number(over.map)).toBeGreaterThanOrEqual(Number(under.map));
      expect(Number(over.relief)).toBeGreaterThanOrEqual(Number(under.relief));
    }
  });

  it("rains more at every stop up, in the air and on the water, and not at all at the bottom", () => {
    expect(RAIN_LOOK.off).toEqual({ sheet: 0, rings: [0, 0] });
    expect(RAIN_LOOK.far.sheet).toBe(1);
    for (let i = 1; i < RAIN_LEVELS.length; i++) {
      const under = RAIN_LOOK[RAIN_LEVELS[i - 1]];
      const over = RAIN_LOOK[RAIN_LEVELS[i]];
      expect(over.sheet).toBeGreaterThan(under.sheet);
      expect(over.rings[1]).toBeGreaterThan(under.rings[1]);
      expect(over.rings[0]).toBeGreaterThanOrEqual(under.rings[0]);
    }
    // The rings fade OUT, and the middle stop is about half the sheet: a real
    // step a machine can feel, and still weather rather than scratches.
    for (const look of Object.values(RAIN_LOOK)) {
      expect(look.rings[0]).toBeLessThanOrEqual(look.rings[1]);
    }
    expect(RAIN_LOOK.near.sheet).toBeGreaterThanOrEqual(0.4);
    expect(RAIN_LOOK.near.sheet).toBeLessThanOrEqual(0.6);
  });

  it("lets the spray be turned off outright and never past full", () => {
    expect(SPRAY_SCALE.off).toBe(0);
    expect(SPRAY_SCALE.full).toBe(1);
    expect(SPRAY_SCALE.low).toBeGreaterThan(0);
    expect(SPRAY_SCALE.low).toBeLessThan(SPRAY_SCALE.full);
  });

  it("caps the frame rate slowest first, and not at all at the top", () => {
    for (let i = 1; i < FRAME_RATE_LEVELS.length; i++) {
      expect(FRAME_RATE_CAP[FRAME_RATE_LEVELS[i]]).toBeGreaterThan(
        FRAME_RATE_CAP[FRAME_RATE_LEVELS[i - 1]],
      );
    }
    expect(FRAME_RATE_CAP.max).toBe(Number.POSITIVE_INFINITY);
    expect(DEFAULT_VIDEO.frameRate).toBe("max");
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
    // `medium` and `high` agree on the spray, the wake and the sea life, so a
    // blob that carries only those agrees equally with both — and must never
    // be handed the heavier one.
    expect(detailOf({ spray: "full", wake: "full", fauna: true })).toBe("medium");
  });

  it("never parks a stop on a craft that leaves no mark", () => {
    // The bottom of DETAIL is a phone that wants frames, not a craft on a
    // painting: the road and the spray stay at every preset, thinned, and
    // only the levers a rider cannot see the craft moving by go all the way
    // off. The WAKE lever's own OFF is for a blob that asks for it by name.
    for (const id of DETAIL_LEVELS) {
      expect(DETAIL_PRESETS[id].wake).not.toBe("off");
      expect(DETAIL_PRESETS[id].spray).not.toBe("off");
    }
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

describe("the frame gate (frame-rate.ts)", () => {
  /** How many of a display's callbacks over `seconds` a gate at `cap` lets
   * through, the callbacks landing every `1000 / hz` ms with `jitter` ms of
   * alternating early-and-late. */
  const drawn = (hz: number, cap: number, seconds = 4, jitter = 0): number => {
    const gate = createFrameGate(cap);
    let n = 0;
    const frames = Math.round(hz * seconds);
    for (let i = 0; i < frames; i++) {
      const now = (i * 1000) / hz + (i % 2 === 0 ? jitter : -jitter);
      if (gate.due(now)) n++;
    }
    return n / seconds;
  };

  it("never skips a frame under a cap the display cannot exceed", () => {
    expect(drawn(60, 60)).toBe(60);
    expect(drawn(60, 60, 4, 1.5)).toBe(60);
    expect(drawn(60, Number.POSITIVE_INFINITY)).toBe(60);
    expect(drawn(30, 60)).toBe(30);
    // A slow machine delivering twenty a second under a cap of sixty draws
    // every one it gets — the cap is a ceiling, never a burst.
    expect(drawn(20, 60)).toBe(20);
  });

  it("lands on the rate asked for, not on the display's nearest divisor", () => {
    expect(drawn(120, 60)).toBe(60);
    expect(drawn(60, 30)).toBe(30);
    expect(drawn(120, 30)).toBe(30);
    // The awkward one: a display at half again the cap, whose callbacks
    // never land on the cap's grid. A gate that started each period from the
    // frame it took would drift to seventy-two.
    expect(drawn(144, 60)).toBeCloseTo(60, 0);
    expect(drawn(90, 60)).toBeCloseTo(60, 0);
  });

  it("takes a new cap on the next frame", () => {
    const gate = createFrameGate(Number.POSITIVE_INFINITY);
    expect(gate.due(0)).toBe(true);
    expect(gate.due(8)).toBe(true);
    gate.setCap(30);
    expect(gate.due(16)).toBe(true);
    expect(gate.due(24)).toBe(false);
    expect(gate.due(33)).toBe(false);
    expect(gate.due(50)).toBe(true);
    gate.setCap(Number.NaN);
    expect(gate.due(51)).toBe(true);
  });
});
