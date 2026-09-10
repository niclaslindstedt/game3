// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKY, held to what it claims. Two halves, and both are arithmetic:
//
//   THE ENGINE's (R19) — which sky a seed draws, and how the level's own
//   wind weights that draw. The rule is that the darkest skies stand over
//   the biggest seas, and this is what makes it a rule rather than a hope.
//
//   THE APP's — the astronomy (`daylight.ts`), the ladder of authored looks,
//   the season's cast and the lid a weather puts over it (`sky.ts`). Both
//   are plain arithmetic on numbers, with no renderer under them, which is
//   what lets the model be asserted here at all; the modules that DRAW it
//   own a mesh apiece and are judged by looking (`make sky`), never here.
//
//   And THE CLOCK between them: the sun moves an hour a minute of riding
//   (`sunHourAt`), so the ladder has to be CONTINUOUS from a sunset start
//   down into whatever night the season has — twilight in June, black under
//   the moon in October — and back up into the dawn.
//
// What is NOT asserted here is which colour anything is. A rung is art
// direction; a test that pins a hex to a number is a test that fails every
// time somebody improves the sunset. What is asserted is the RELATIONS
// between them — a squall is darker than an overcast, a rain deck is
// brighter overhead than at its rim, the view is shorter under weather —
// because those are the claims the model actually makes.
import { describe, expect, it } from "vitest";

import {
  DECLINATION,
  LEVEL_RULES as R,
  SEASONS,
  SUN_SECONDS_PER_HOUR,
  TIMES_OF_DAY,
  WEATHER_IDS,
  biomeOf,
  createGame,
  createRng,
  daylightWindow,
  dealtTimeOfDay,
  hourOfDay,
  pickWeather,
  skyCover,
  sunHourAt,
  type Season,
} from "@engine";

import { luminance } from "../pwa/src/lib/colour.ts";
import {
  DAY_ABOVE,
  NIGHT_BELOW,
  daylightOf,
  lampsAt,
  litAt,
  moonAt,
  sunOver,
} from "../pwa/src/game/daylight.ts";
import {
  dayLight,
  deckToneAt,
  seaMirror,
  skyAt,
  skyToneAt,
  sunHardness,
} from "../pwa/src/game/sky.ts";
import { syntheticLevel } from "./support/synthetic.ts";

const TAIGA = biomeOf("taiga");
const LAT = TAIGA.latitude;
const DEG = Math.PI / 180;
/** The sun over this coast, in a season — the app's own reading. */
const sunAt = (hour: number, season: Season = "summer") => sunOver(hour, LAT, season);
/** R13 — the hours a level on this coast can START at, per season. */
const window = (season: Season): { min: number; max: number } => {
  const w = daylightWindow(LAT, R.day.minSun, DECLINATION[season]);
  if (!w) throw new Error(`the taiga coast has daylight in ${season}`);
  return w;
};
const DAY = window("summer");

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
    const noon = sunAt(12).elevation;
    const midnight = sunAt(0).elevation;
    for (let h = 0; h < 24; h += 0.25) {
      expect(sunAt(h).elevation).toBeLessThanOrEqual(noon + 1e-9);
      expect(sunAt(h).elevation).toBeGreaterThanOrEqual(midnight - 1e-9);
    }
  });

  it("R13 — the sun is up at every hour a level can START at, in every season", () => {
    // The window is the rule: inside it the sun is over the horizon at
    // every hour, and the hours either side of it are the ones no level is
    // ever dealt. The window's ends are found by interpolating between
    // three-minute samples of the arc, so they land within a thousandth of
    // a degree of the horizon rather than exactly on it.
    for (const season of SEASONS) {
      const w = window(season);
      for (let h = w.min; h <= w.max; h += 0.25) {
        expect(sunAt(h, season).elevation).toBeGreaterThan(-1e-4);
      }
      expect(sunAt(w.min - 0.5, season).elevation).toBeLessThan(0);
      expect(sunAt(w.max + 0.5, season).elevation).toBeLessThan(0);
    }
  });

  it("gives each season the day the Bothnian coast actually has", () => {
    // The facts the table was written against (engine/lib/solar.ts): an
    // eighteen-hour day in high summer and a six-and-a-half-hour one in
    // mid-November; sunrise before five in July and after eight in
    // November; the noon sun nine degrees up in November and near fifty in
    // July.
    const length = (s: Season): number => window(s).max - window(s).min;
    expect(length("summer")).toBeGreaterThan(17);
    expect(length("summer")).toBeLessThan(19);
    expect(length("spring")).toBeGreaterThan(15);
    expect(length("autumn")).toBeGreaterThan(10);
    expect(length("autumn")).toBeLessThan(12);
    expect(length("winter")).toBeGreaterThan(6);
    expect(length("winter")).toBeLessThan(7);
    expect(window("summer").min).toBeLessThan(5);
    expect(window("winter").min).toBeGreaterThan(8);
    expect(sunAt(12, "winter").elevation / DEG).toBeCloseTo(9, 0);
    expect(sunAt(12, "summer").elevation / DEG).toBeGreaterThan(47);
  });

  it("never reaches astronomical dark in spring or summer, and always does in autumn and winter", () => {
    // At 62°N the sun cannot get eighteen degrees under between late April
    // and the middle of August — which is why a taiga summer night is a
    // long blue twilight and an October one is black.
    const midnight = (s: Season): number => sunAt(0, s).elevation / DEG;
    expect(midnight("spring")).toBeGreaterThan(-18);
    expect(midnight("summer")).toBeGreaterThan(-18);
    expect(midnight("autumn")).toBeLessThan(-18);
    expect(midnight("winter")).toBeLessThan(-18);
    // …and the summer night is a NIGHT by the sky's word all the same: it
    // is past civil twilight, if never past nautical.
    expect(daylightOf(sunAt(0, "summer"))).toBe("night");
    expect(midnight("summer")).toBeGreaterThan(-12);
  });

  it("is rising before noon and setting after it", () => {
    expect(sunAt(8).rising).toBe(true);
    expect(sunAt(16).rising).toBe(false);
  });

  it("names the light by the elevation, and dawn and dusk by the way it is going", () => {
    expect(daylightOf({ elevation: DAY_ABOVE + 0.1, rising: true })).toBe("day");
    expect(daylightOf({ elevation: 0.05, rising: true })).toBe("dawn");
    expect(daylightOf({ elevation: 0.05, rising: false })).toBe("dusk");
    expect(daylightOf({ elevation: NIGHT_BELOW - 0.01, rising: false })).toBe("night");
  });

  it("puts the full moon opposite the sun", () => {
    const sun = sunAt(0, "autumn");
    const moon = moonAt(sun);
    expect(moon.elevation).toBeCloseTo(-sun.elevation, 9);
    expect(moon.azimuth).toBeCloseTo(sun.azimuth + Math.PI, 9);
    // High over the sea at an October midnight.
    expect(moon.elevation / DEG).toBeGreaterThan(30);
  });

  it("switches the craft's lamp on as the sun touches the water", () => {
    expect(lampsAt(20 * DEG)).toBe(0);
    expect(lampsAt(2 * DEG)).toBe(0);
    expect(lampsAt(0)).toBeGreaterThan(0);
    expect(lampsAt(0)).toBeLessThan(1);
    expect(lampsAt(-2 * DEG)).toBe(1);
    expect(lampsAt(-30 * DEG)).toBe(1);
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

describe("the sun's clock", () => {
  it("runs an hour of sun a minute of riding, and wraps", () => {
    expect(SUN_SECONDS_PER_HOUR).toBe(60);
    expect(sunHourAt({ hour: 17 }, 60)).toBeCloseTo(18, 9);
    expect(sunHourAt({ hour: 23.5 }, 120)).toBeCloseTo(1.5, 9);
    expect(sunHourAt({ hour: 6 }, 0)).toBe(6);
    expect(sunHourAt({ hour: 6 }, 24 * 60)).toBeCloseTo(6, 9);
  });

  it("rides a SUNSET start into the night, and how dark a night is the season's", () => {
    // The start card's own sunset, in each season, four minutes on.
    const level = syntheticLevel({ windSpeed: 4, noSolids: true });
    for (const season of SEASONS) {
      const set = hourOfDay({ biome: level.biome, season }, "sunset");
      expect(daylightOf(sunAt(set, season))).toBe("dusk");
      expect(daylightOf(sunAt(sunHourAt({ hour: set }, 4 * 60), season))).toBe("night");
    }
    const lateOn = (season: Season): number =>
      sunAt(
        sunHourAt({ hour: hourOfDay({ biome: level.biome, season }, "sunset") }, 5 * 60),
        season,
      ).elevation / DEG;
    expect(lateOn("summer")).toBeGreaterThan(lateOn("autumn"));
    expect(lateOn("autumn")).toBeLessThan(-18);
  });
});

describe("the ladder", () => {
  const clearAt = (hour: number, season: Season = "summer") => skyAt(hour, LAT, "clear", 0, season);

  it("puts the most light on the water at noon and the least as the sun goes in", () => {
    expect(dayLight(clearAt(12))).toBeGreaterThan(dayLight(clearAt(18)));
    expect(dayLight(clearAt(18))).toBeGreaterThan(dayLight(clearAt(20.5)));
    expect(dayLight(clearAt(20.5))).toBeGreaterThan(dayLight(clearAt(DAY.max)));
    // …and an October midnight has the least of all: the moon, a tenth of
    // a noon at most.
    expect(dayLight(clearAt(0, "autumn"))).toBeLessThan(dayLight(clearAt(DAY.max)));
    expect(dayLight(clearAt(0, "autumn"))).toBeLessThan(0.12);
    expect(dayLight(clearAt(0, "autumn"))).toBeGreaterThan(0);
  });

  it("never puts the key light under the horizon, at any hour of any season", () => {
    // A key from below the water lights nothing: every face turned to the
    // lens would go black, and the rider would lose the buoys.
    for (const season of SEASONS) {
      for (let h = 0; h < 24; h += 0.5) expect(clearAt(h, season).sunElevation).toBeGreaterThan(0);
    }
  });

  it("keeps the key on the sun's own side of the sky while the sun is up", () => {
    for (let h = DAY.min; h <= DAY.max; h += 0.5) {
      expect(clearAt(h).sunAzimuth).toBe(sunAt(h).azimuth);
    }
  });

  it("hands the key over to the moon in the dark", () => {
    const night = clearAt(0, "autumn");
    expect(night.sunUp).toBeLessThan(-12 * DEG);
    expect(night.sunAzimuth).toBeCloseTo(night.sunBearing + Math.PI, 6);
    expect(night.sunElevation).toBeCloseTo(-night.sunUp, 6);
    // …and the moon is a cold light where the sun was a warm one.
    const blue = (hex: number): number => hex & 0xff;
    const red = (hex: number): number => (hex >> 16) & 0xff;
    expect(blue(night.sun)).toBeGreaterThan(red(night.sun));
    expect(night.sunIntensity).toBeLessThan(clearAt(12).sunIntensity);
  });

  it("brings the stars out only once the sun is well under, and the band only in the dark", () => {
    expect(clearAt(12).stars).toBe(0);
    expect(clearAt(DAY.max).stars).toBeLessThan(1e-3);
    const dusk = clearAt(DAY.max + 1.2);
    expect(dusk.stars).toBeGreaterThan(0);
    expect(dusk.stars).toBeLessThan(1);
    const night = clearAt(0, "autumn");
    expect(night.stars).toBe(1);
    expect(night.galaxy).toBe(1);
    // The band is far steeper than the stars: in the twilight it is a
    // fraction of what the stars are.
    expect(dusk.galaxy).toBeLessThan(dusk.stars * 0.5);
    // A summer midnight, nautical twilight: some stars, little band.
    const june = clearAt(0, "summer");
    expect(june.stars).toBeGreaterThan(0);
    expect(june.galaxy).toBeLessThan(night.galaxy);
  });

  it("holds its lowest rung under nautical twilight rather than going on down", () => {
    const dark = clearAt(0, "autumn");
    const darker = clearAt(0, "winter");
    expect(luminance(darker.horizon)).toBeCloseTo(luminance(dark.horizon), 2);
    expect(darker.stars).toBe(dark.stars);
  });

  it("blends without a cut: no step in the day OR THE NIGHT is a jump in the light", () => {
    for (const season of SEASONS) {
      let was = dayLight(clearAt(0, season));
      let wasStars = clearAt(0, season).stars;
      for (let h = 0.1; h <= 24; h += 0.1) {
        const p = clearAt(h, season);
        expect(Math.abs(dayLight(p) - was)).toBeLessThan(0.06);
        expect(Math.abs(p.stars - wasStars)).toBeLessThan(0.12);
        was = dayLight(p);
        wasStars = p.stars;
      }
    }
  });

  it("lays a mist on the water at dawn and burns it off by mid-morning", () => {
    const dawn = clearAt(DAY.min - 0.6);
    const morning = clearAt(10);
    const dusk = clearAt(DAY.max + 0.6);
    expect(dawn.mist).toBeGreaterThan(morning.mist);
    expect(dawn.mist).toBeGreaterThan(dusk.mist);
    expect(dawn.fogFar).toBeLessThan(dusk.fogFar);
    // …and the Gulf of Bothnia's spring is its foggiest season.
    expect(clearAt(window("spring").min - 0.6, "spring").mist).toBeGreaterThan(dawn.mist);
  });

  it("casts the season on the air by day and not by night", () => {
    // October's air is warmer than July's, and November's colder and
    // shorter — at noon. At midnight there is no sun to cast anything, and
    // the same rung is the same dark.
    const red = (hex: number): number => (hex >> 16) & 0xff;
    const blue = (hex: number): number => hex & 0xff;
    const noon = (s: Season) => clearAt(12, s);
    expect(red(noon("autumn").horizon) - blue(noon("autumn").horizon)).toBeGreaterThan(
      red(noon("summer").horizon) - blue(noon("summer").horizon),
    );
    expect(noon("winter").fogFar).toBeLessThan(noon("summer").fogFar);
    expect(noon("spring").fogFar).toBeGreaterThan(noon("winter").fogFar);
    expect(clearAt(0, "autumn").horizon).toBe(clearAt(0, "winter").horizon);
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
    const night = skyAt(0, LAT, "squall", 1, "autumn").deck;
    if (!noon || !night) throw new Error("a squall has a deck");
    expect(luminance(night.overhead)).toBeLessThan(luminance(noon.overhead));
    expect(luminance(night.rim)).toBeLessThan(luminance(noon.rim));
    expect(luminance(night.overhead)).toBeLessThan(0.02);
  });

  it("takes the stars away under a lid", () => {
    const clear = skyAt(0, LAT, "clear", 0, "autumn");
    const sheet = skyAt(0, LAT, "high", 0.5, "autumn");
    const rain = skyAt(0, LAT, "rain", 1, "autumn");
    expect(sheet.stars).toBeLessThan(clear.stars);
    expect(rain.stars).toBe(0);
    expect(rain.galaxy).toBe(0);
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

  it("puts the ceiling's own rim on the skyline under a lid", () => {
    // The water reflects the SAME `skyAlong` the dome is painted with
    // (sky-glsl.ts), so there is no second gradient to hold to this one.
    // What is left to assert is the hand-over the whole thing rests on:
    // under a lid the sky's horizon IS the ceiling's lit rim, so the sliver
    // of open dome under the base and the strip right above it are one
    // colour rather than a hard band ruled across the skyline.
    if (!squall.deck) throw new Error("a squall has a deck");
    expect(squall.horizon).toBe(squall.deck.rim);
    expect(luminance(squall.zenith)).toBeLessThan(luminance(clear.zenith));
  });

  it("gives the glint the beam's share, so a ceiling glints nothing", () => {
    // The sparkle on the water is the sun's image in ten thousand facets,
    // and a sun behind a squall's ceiling has no image to give.
    expect(clear.beam).toBe(1);
    expect(squall.beam).toBe(0);
    // A high sheet keeps some of it: a patch of light, no hard sparkle.
    const sheet = skyAt(12, LAT, "high", 1).beam;
    expect(sheet).toBeGreaterThan(0);
    expect(sheet).toBeLessThan(1);
  });
});

describe("R13 — the named hour a level was dealt (dealtTimeOfDay)", () => {
  // The start card offers three hours and marks the one the seed already
  // gives, so every hour R13 can deal has to answer to one of the three.
  const level = syntheticLevel({ windSpeed: 4, noSolids: true });
  const at = (hour: number) => dealtTimeOfDay({ ...level, hour });

  it("names the hour it is standing exactly on", () => {
    for (const when of TIMES_OF_DAY) expect(at(hourOfDay(level, when))).toBe(when);
  });

  it("names the nearest of them for every hour in between", () => {
    const sunrise = hourOfDay(level, "sunrise");
    const noon = hourOfDay(level, "day");
    const sunset = hourOfDay(level, "sunset");
    expect(at((sunrise + noon) / 2 - 0.1)).toBe("sunrise");
    expect(at((sunrise + noon) / 2 + 0.1)).toBe("day");
    expect(at((noon + sunset) / 2 - 0.1)).toBe("day");
    expect(at((noon + sunset) / 2 + 0.1)).toBe("sunset");
  });

  it("leaves no hour of the window unnamed", () => {
    for (let h = DAY.min; h <= DAY.max; h += 0.25) expect(TIMES_OF_DAY).toContain(at(h));
  });

  it("reads the window off the level's own season", () => {
    // A winter sunrise is four hours after a summer one.
    const june = hourOfDay({ ...level, season: "summer" }, "sunrise");
    const november = hourOfDay({ ...level, season: "winter" }, "sunrise");
    expect(november - june).toBeGreaterThan(3.5);
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

  it("rides the season asked for, and resolves a named hour against it", () => {
    const winter = createGame({
      seed: 3,
      level,
      season: "winter",
      timeOfDay: "sunset",
      quiet: true,
    });
    expect(winter.level.season).toBe("winter");
    expect(winter.level.hour).toBeCloseTo(hourOfDay({ ...level, season: "winter" }, "sunset"), 9);
    // The water and what swims in it are the level's own still.
    expect(winter.level.water).toEqual(level.water);
    expect(winter.level.fauna).toBe(level.fauna);
  });
});
