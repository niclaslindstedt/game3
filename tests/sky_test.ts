// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKY, held to what it claims. Two halves, and both are arithmetic:
//
//   THE ENGINE's (R19) — which sky a seed draws, and how the level's own
//   wind weights that draw. The rule is that the darkest skies stand over
//   the biggest seas, and this is what makes it a rule rather than a hope.
//
//   THE APP's — the astronomy (`daylight.ts`), the ladder of authored looks
//   and the lid a weather puts over it (`sky.ts`). Both are plain arithmetic
//   on numbers, with no renderer under them, which is what lets the model be
//   asserted here at all; the modules that DRAW it own a mesh apiece and are
//   judged by looking (`make screenshots`), never here.
//
// What is NOT asserted here is which colour anything is. A rung is art
// direction; a test that pins a hex to a number is a test that fails every
// time somebody improves the sunset. What is asserted is the RELATIONS
// between them — a squall is darker than an overcast, a rain deck is
// brighter overhead than at its rim, the view is shorter under weather —
// because those are the claims the model actually makes.
import { describe, expect, it } from "vitest";

import {
  LEVEL_RULES as R,
  WEATHER_IDS,
  biomeOf,
  createGame,
  createRng,
  daylightWindow,
  pickWeather,
  skyCover,
} from "@engine";

import { luminance } from "../pwa/src/lib/colour.ts";
import { DAY_ABOVE, daylightOf, litAt, sunAt } from "../pwa/src/game/daylight.ts";
import {
  dayLight,
  deckToneAt,
  seaMirror,
  seaReflection,
  skyAt,
  skyToneAt,
  sunHardness,
} from "../pwa/src/game/sky.ts";
import { syntheticLevel } from "./support/synthetic.ts";

const TAIGA = biomeOf("taiga");
const LAT = TAIGA.latitude;
/** R13 — the hours a level on this coast can be ridden at. Every claim
 * about the ladder below is a claim about THESE hours: no other hour is
 * reachable, so a rung under the horizon is a rung nobody sees. */
const DAY = daylightWindow(LAT, R.day.minSun);
if (!DAY) throw new Error("the taiga coast has daylight");

describe("R19 — the sky is drawn from the coast's chart, weighted by the wind", () => {
  it("reads the wind's place in R12's band as the weather's heaviness", () => {
    expect(skyCover(R.wind.speed.min)).toBe(0);
    expect(skyCover(R.wind.speed.max)).toBe(1);
    // Outside the band is still a legal question — a synthetic level may
    // carry any wind — and the answer is the nearest end of it.
    expect(skyCover(0)).toBe(0);
    expect(skyCover(100)).toBe(1);
  });

  it("only ever draws a sky the coast offers", () => {
    const rng = createRng(7);
    for (let i = 0; i < 400; i++) {
      expect(TAIGA.weathers).toContain(pickWeather(rng, TAIGA.weathers, (i % 11) / 10));
    }
  });

  it("puts the heavy skies over the heavy winds and the light ones over the calm", () => {
    // The draw is a distribution, not a lookup, so the claim is about a
    // population: over many seeds a calm coast is mostly fair and a blowing
    // one is mostly not.
    const share = (cover: number): number => {
      const rng = createRng(1234);
      let heavy = 0;
      const runs = 600;
      for (let i = 0; i < runs; i++) {
        const w = pickWeather(rng, TAIGA.weathers, cover);
        if (w === "rain" || w === "squall") heavy++;
      }
      return heavy / runs;
    };
    expect(share(0)).toBeLessThan(0.05);
    expect(share(1)).toBeGreaterThan(0.6);
    expect(share(0)).toBeLessThan(share(0.5));
    expect(share(0.5)).toBeLessThan(share(1));
  });

  it("offers a sky for every word in the vocabulary", () => {
    // A weather the engine can name and the app cannot paint is a level
    // that crashes on load, so the chart and the vocabulary move together.
    for (const w of WEATHER_IDS) expect(() => skyAt(12, LAT, w, 0.5)).not.toThrow();
  });
});

describe("the sun over this coast", () => {
  it("stands highest at noon and lowest at midnight", () => {
    const noon = sunAt(12, LAT).elevation;
    const midnight = sunAt(0, LAT).elevation;
    for (let h = 0; h < 24; h += 0.25) {
      expect(sunAt(h, LAT).elevation).toBeLessThanOrEqual(noon + 1e-9);
      expect(sunAt(h, LAT).elevation).toBeGreaterThanOrEqual(midnight - 1e-9);
    }
  });

  it("R13 — the sun is up at every hour a level can be ridden at, and only there", () => {
    // The window is the rule: inside it the sun is over the horizon at
    // every hour, and the hours either side of it are the ones no level is
    // ever drawn at. That is what "no night" means in this game.
    // The window's ends are found by interpolating between three-minute
    // samples of the arc, so they land within a thousandth of a degree of
    // the horizon rather than exactly on it.
    for (let h = DAY.min; h <= DAY.max; h += 0.25) {
      expect(sunAt(h, LAT).elevation).toBeGreaterThan(-1e-4);
    }
    expect(sunAt(DAY.min - 0.5, LAT).elevation).toBeLessThan(0);
    expect(sunAt(DAY.max + 0.5, LAT).elevation).toBeLessThan(0);
    // …and the window is most of a High Coast midsummer day.
    expect(DAY.max - DAY.min).toBeGreaterThan(18);
  });

  it("rises in the small hours and sets late in the evening", () => {
    expect(sunAt(2, LAT).elevation).toBeLessThan(0);
    expect(sunAt(4, LAT).elevation).toBeGreaterThan(0);
    expect(sunAt(21, LAT).elevation).toBeGreaterThan(0);
    expect(sunAt(22, LAT).elevation).toBeLessThan(0);
  });

  it("is rising before noon and setting after it", () => {
    expect(sunAt(8, LAT).rising).toBe(true);
    expect(sunAt(16, LAT).rising).toBe(false);
  });

  it("names the light by the elevation, and dawn and dusk by the way it is going", () => {
    expect(daylightOf({ elevation: DAY_ABOVE + 0.1, rising: true })).toBe("day");
    expect(daylightOf({ elevation: 0.05, rising: true })).toBe("dawn");
    expect(daylightOf({ elevation: 0.05, rising: false })).toBe("dusk");
  });

  it("keeps a cloud in the sun after the water has lost it", () => {
    // The horizon dips with height: two kilometres up, the sun is still a
    // fraction of a degree above the cloud's own horizon when it has set on
    // the sea. That difference IS the sunset sky.
    const justSet = -0.004;
    expect(litAt(0, justSet)).toBeLessThan(litAt(2000, justSet));
    expect(litAt(2000, justSet)).toBeGreaterThan(0.5);
    // …and by full dark nothing at any altitude sees it.
    expect(litAt(2000, -0.05)).toBe(0);
  });
});

describe("the ladder", () => {
  const clearAt = (hour: number) => skyAt(hour, LAT, "clear", 0);

  it("puts the most light on the water at noon and the least as the sun goes in", () => {
    expect(dayLight(clearAt(12))).toBeGreaterThan(dayLight(clearAt(18)));
    expect(dayLight(clearAt(18))).toBeGreaterThan(dayLight(clearAt(20.5)));
    expect(dayLight(clearAt(20.5))).toBeGreaterThan(dayLight(clearAt(DAY.max)));
  });

  it("never puts the key light under the horizon", () => {
    // A key from below the water lights nothing: every face turned to the
    // lens would go black, and the rider would lose the buoys.
    for (let h = DAY.min; h <= DAY.max; h += 0.5) {
      expect(clearAt(h).sunElevation).toBeGreaterThan(0);
    }
  });

  it("keeps the key on the sun's own side of the sky all day", () => {
    // There is no second key light: no level is ridden dark enough to need
    // one, so the bearing the world is lit from is always the sun's.
    for (let h = DAY.min; h <= DAY.max; h += 0.5) {
      expect(clearAt(h).sunAzimuth).toBe(sunAt(h, LAT).azimuth);
    }
  });

  it("holds its lowest rung under the horizon rather than going on down", () => {
    // R13 never asks for a sky under a set sun, so the ladder's floor is
    // the sun ON the water — and anything below simply reads as that.
    const set = clearAt(DAY.max);
    const under = skyAt(DAY.max + 1, LAT, "clear", 0);
    expect(luminance(under.horizon)).toBeCloseTo(luminance(set.horizon), 1);
  });

  it("blends without a cut: no step in the day is a jump in the light", () => {
    let was = dayLight(clearAt(DAY.min));
    for (let h = DAY.min + 0.1; h <= DAY.max; h += 0.1) {
      const now = dayLight(clearAt(h));
      expect(Math.abs(now - was)).toBeLessThan(0.06);
      was = now;
    }
  });
});

describe("the weather over it", () => {
  const at = (weather: Parameters<typeof skyAt>[2], cover = 1) => skyAt(13, LAT, weather, cover);

  it("gives a lid to the three skies that have one and not to the two that do not", () => {
    expect(at("clear").deck).toBeNull();
    expect(at("high").deck).toBeNull();
    expect(at("overcast").deck).not.toBeNull();
    expect(at("rain").deck).not.toBeNull();
    expect(at("squall").deck).not.toBeNull();
  });

  it("takes the light away in the order the skies are named", () => {
    expect(dayLight(at("clear"))).toBeGreaterThan(dayLight(at("high")));
    expect(dayLight(at("high"))).toBeGreaterThan(dayLight(at("overcast")));
    expect(dayLight(at("overcast"))).toBeGreaterThan(dayLight(at("squall")));
  });

  it("takes the BEAM away faster than the light — an overcast noon is bright and shadowless", () => {
    expect(sunHardness(at("clear"))).toBeGreaterThan(0.8);
    expect(sunHardness(at("squall"))).toBe(0);
    // The lid keeps most of the daylight and loses all of the shadow, which
    // is the difference between weather and a dimmer switch.
    expect(dayLight(at("overcast"))).toBeGreaterThan(0.3);
    expect(sunHardness(at("overcast"))).toBeLessThan(0.15);
  });

  it("makes rain a WHITE ceiling and a squall a black one", () => {
    const rain = at("rain").deck;
    const squall = at("squall").deck;
    expect(rain && squall).toBeTruthy();
    if (!rain || !squall) return;
    expect(luminance(rain.overhead)).toBeGreaterThan(luminance(squall.overhead));
    // A rain deck glows from above and greys off toward the rim; a squall's
    // is dark overhead with the daylight arriving under its base, so the two
    // gradients run OPPOSITE ways. That is the whole model.
    expect(luminance(rain.overhead)).toBeGreaterThan(luminance(rain.rim));
    expect(luminance(squall.rim)).toBeGreaterThan(luminance(squall.overhead));
  });

  it("hangs a heavier ceiling lower and lumpier than a lighter one", () => {
    const thin = at("squall", 0).deck;
    const thick = at("squall", 1).deck;
    if (!thin || !thick) throw new Error("a squall has a deck");
    expect(thick.base).toBeLessThan(thin.base);
    expect(thick.relief).toBeGreaterThan(thin.relief);
  });

  it("reads the ceiling by ELEVATION, so the rim's strip is only the rim", () => {
    const deck = at("squall").deck;
    if (!deck) throw new Error("a squall has a deck");
    // On the skyline it is the lit strip; a few degrees up it is the black
    // underside. Reading it by DISTANCE instead is what turns a thunderstorm
    // into a flat light-grey sky.
    expect(luminance(deckToneAt(deck, 0))).toBeGreaterThan(
      luminance(deckToneAt(deck, 0.5)) + 0.001,
    );
    expect(luminance(deckToneAt(deck, 0.5))).toBeCloseTo(luminance(deck.overhead), 6);
  });

  it("shortens the view, and shortens it most under the heaviest sky", () => {
    expect(at("rain").fogFar).toBeLessThan(at("clear").fogFar);
    expect(at("squall").fogFar).toBeLessThan(at("clear").fogFar);
    // Overcast is a DRY lid: dark, but the view still runs.
    expect(at("overcast").fogFar).toBeGreaterThan(at("rain").fogFar);
  });

  it("puts the ceiling on the water rather than a blue sky the deck hides", () => {
    // What the sea reflects at a grazing angle is the sky it is pointing at,
    // and under a lid that is the lid. A squall over a teal sea is the one
    // thing that gives a pasted-on sky away.
    const squall = at("squall");
    expect(luminance(seaMirror(squall))).toBeLessThan(luminance(seaMirror(at("clear"))));
    // …and a sunset puts its own warmth on the water: more red than blue,
    // where a clear noon is the other way round.
    const sunset = skyAt(21, LAT, "clear", 0);
    const red = (hex: number): number => (hex >> 16) & 0xff;
    const blue = (hex: number): number => hex & 0xff;
    expect(red(seaMirror(sunset))).toBeGreaterThan(blue(seaMirror(sunset)));
    expect(blue(seaMirror(at("clear")))).toBeGreaterThan(red(seaMirror(at("clear"))));
  });

  it("paints the sliver of dome under the ceiling the same colour as its rim", () => {
    // The ceiling's rim stands a fraction of a degree above the eye, so
    // there is always open dome between it and the water. Left on the
    // hour's own horizon that sliver is a different colour from the strip
    // right above it, and it reads as a hard band ruled across the skyline.
    for (const w of ["overcast", "rain", "squall"] as const) {
      const p = at(w);
      expect(p.deck?.rim).toBe(p.horizon);
    }
  });

  it("keeps a night lid dark rather than a daylight grey over a dark sea", () => {
    // The lid's greys are all statements about SUNLIGHT in cloud, so they
    // are shown in proportion to the day. Left at full strength, a midnight
    // squall comes out with a bright grey ceiling over black water.
    const noon = skyAt(12, LAT, "squall", 1).deck;
    const night = skyAt(0, LAT, "squall", 1).deck;
    if (!noon || !night) throw new Error("a squall has a deck");
    expect(luminance(night.overhead)).toBeLessThan(luminance(noon.overhead));
    expect(luminance(night.rim)).toBeLessThan(luminance(noon.rim));
  });
});

describe("what a wave face reflects", () => {
  const clear = skyAt(12, LAT, "clear", 0);
  const sunset = skyAt(21, LAT, "clear", 0);
  const squall = skyAt(12, LAT, "squall", 1);
  const red = (hex: number): number => (hex >> 16) & 0xff;
  const blue = (hex: number): number => hex & 0xff;

  it("is the horizon at the skyline and the zenith overhead", () => {
    expect(skyToneAt(clear, 0, 0)).toBe(clear.horizon);
    expect(skyToneAt(clear, 1, 0)).toBe(clear.zenith);
    // Most of the change is in the first twenty degrees: a third of the
    // way up in sine is past halfway in tone.
    const third = skyToneAt(clear, 0.33, 0);
    const mid = luminance(clear.horizon) + (luminance(clear.zenith) - luminance(clear.horizon)) / 2;
    expect(luminance(third) - mid).toBeLessThan(0);
    expect(luminance(clear.horizon) - luminance(third)).toBeGreaterThan(mid - luminance(third));
  });

  it("warms toward the sun's bearing at a sunset and not away from it", () => {
    const toward = skyToneAt(sunset, 0.05, 1);
    const away = skyToneAt(sunset, 0.05, 0);
    expect(red(toward) - blue(toward)).toBeGreaterThan(red(away) - blue(away));
    // …and the glow is gone by the zenith, whichever way one looks.
    expect(skyToneAt(sunset, 1, 1)).toBe(skyToneAt(sunset, 1, 0));
  });

  it("hands the water the open gradient under a clear sky and the ceiling under a lid", () => {
    const open = seaReflection(clear);
    expect(open.horizon).toBe(clear.horizon);
    expect(open.zenith).toBe(clear.zenith);
    expect(open.glowStrength).toBe(clear.glowStrength);
    const lid = seaReflection(squall);
    if (!squall.deck) throw new Error("a squall has a deck");
    expect(lid.horizon).toBe(squall.deck.rim);
    expect(lid.zenith).toBe(squall.deck.overhead);
    expect(lid.glowStrength).toBe(0);
    // The ceiling's gradient is a few degrees tall; the open sky's is the
    // whole dome.
    expect(lid.band).toBeLessThan(open.band);
  });

  it("gives the glint the beam's share, so a ceiling glints nothing", () => {
    expect(seaReflection(clear).glint).toBe(1);
    expect(seaReflection(squall).glint).toBe(0);
    // A high sheet keeps some of it: a patch of light, no hard sparkle.
    const sheet = seaReflection(skyAt(12, LAT, "high", 1)).glint;
    expect(sheet).toBeGreaterThan(0);
    expect(sheet).toBeLessThan(1);
  });
});

describe("riding a level under another hour and another sky", () => {
  const level = syntheticLevel({ windSpeed: 4, noSolids: true });

  it("leaves the level alone when nothing is asked", () => {
    expect(createGame({ seed: 3, level, quiet: true }).level).toBe(level);
  });

  it("stands the level at the hour asked for, on the clock", () => {
    const evening = createGame({ seed: 3, level, hour: 20.5, quiet: true }).level;
    expect(evening.hour).toBe(20.5);
    expect(evening.weather).toBe(level.weather);
    expect(createGame({ seed: 3, level, hour: 25, quiet: true }).level.hour).toBe(1);
    expect(createGame({ seed: 3, level, hour: -1, quiet: true }).level.hour).toBe(23);
  });

  it("puts the sky asked for over it and keeps the sea the wind's", () => {
    const stormy = createGame({ seed: 3, level, weather: "squall", quiet: true });
    expect(stormy.level.weather).toBe("squall");
    expect(stormy.level.hour).toBe(level.hour);
    const fair = createGame({ seed: 3, level, quiet: true });
    expect(stormy.sea.hsRef).toBe(fair.sea.hsRef);
  });
});
