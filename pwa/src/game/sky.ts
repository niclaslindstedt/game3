// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT COLOUR THE AIR IS — where the sun stands and what sky the level was
// generated under, turned into one `Preset` the renderer can hang a whole
// atmosphere on. Pure data and colour arithmetic: nothing here owns a mesh,
// a light or a frame, which is what lets `environment.ts` be about the scene
// it builds out of this, and what lets the tests read the whole model
// without standing up a renderer.
//
// Four layers, applied in this order and in this order for a reason:
//
//   THE SUN     astronomy (daylight.ts) — how high it stands at this hour on
//               this coast in this season, and which way it is going. THE
//               SUN MOVES: the clock runs an hour a minute (`sunHourAt`),
//               so this is asked every frame, and a run started at sunset
//               is ridden down the whole ladder below.
//   THE LADDER  the authored art direction (sky-rungs.ts), keyed on that
//               elevation: a rung for the dark, for the twilight, for the
//               sun on the water, for the golden hour, for morning and for
//               full day, with the rungs the sun CLIMBS through painted
//               differently from the ones it comes down in. The sky at any
//               moment is the blend of the two rungs its elevation lies
//               between, so nothing in a day has a cut in it. Under the
//               twilight the KEY LIGHT hands over from the sun's afterglow
//               to the full moon (`MOON_TAKES_OVER`), which stands opposite
//               the sun and is what a night sea is lit by.
//   THE SEASON  what the year does to the air (sky-looks.ts's
//               `TAIGA_SEASONS`): a colour cast and a clarity, shown in
//               proportion to the sun. Where the sun IS in that season is
//               already in the elevation.
//   THE SKY     what the level was generated under (R19), as a LID over the
//               top of it (`weathered`). Overcast, rain and a squall are not
//               the same sky dimmed by different amounts — one is flat grey,
//               one is white, one is black — and all three replace the
//               gradient overhead with the underside of a cloud deck.
//
// THREE-FREE ON PURPOSE. Colours are packed sRGB hexes and every mix goes
// through `lib/colour.ts`, which mixes in linear light exactly the way
// `THREE.Color.lerp` does. The renderer turns a hex into a `THREE.Color` at
// the last moment; nothing before that needs a renderer to exist.

import { skyCover, sunHourAt, type Level, type Season, type Weather } from "@engine";

import { luminance, mixHex } from "../lib/colour.ts";
import { daylightOf, lampsAt, moonAt, sunOver, type Daylight, type SunPlace } from "./daylight.ts";
import { KEYS, DAY } from "./sky-rungs.ts";
import {
  TAIGA_LOOKS,
  TAIGA_SEASONS,
  type OpenLook,
  type SeasonLook,
  type WeatherLook,
} from "./sky-looks.ts";

/** How far out the sky's shells stand, m. Past everything the world puts in
 * front of them and inside the camera's far plane. */
export const DOME_RADIUS = 1800;

const DEG = Math.PI / 180;

/**
 * THE CLOUD DECK — an overcast sky's LID, and the whole difference between
 * weather that reads as weather and weather that reads as a grey filter.
 *
 * A clear sky is a gradient with clouds floating in it. An overcast one is
 * not: it is a ceiling a few hundred metres up, and what the rider is
 * looking at over most of the sky is the UNDERSIDE of that ceiling. So the
 * deck is drawn as a real surface, and it is lit from two directions —
 * diffusely from above (`overhead`) and from the open air out past the
 * weather (`rim`).
 *
 * Those two move OPPOSITE ways between rain and a squall, and that is the
 * realism the whole model is built for:
 *
 *   * Under RAIN the deck is thin enough to glow. Overhead it is near white
 *     — brighter than the water — and it greys off toward the rim, where
 *     the line of sight runs the long way through it. A wet day is a WHITE
 *     sky, not a dark one.
 *   * Under a SQUALL the deck is kilometres thick and lets nothing through.
 *     Overhead it is nearly black, and the one bright thing in the sky is
 *     the strip at the rim where daylight gets in UNDER the base. Over open
 *     water that strip runs the whole way round the horizon, which is what
 *     makes a gust front look like a gust front.
 */
export type Deck = {
  /** The underside directly overhead. */
  overhead: number;
  /** …and out at the rim, where the light comes in under the base. */
  rim: number;
  /** How far above the sea the base hangs, m. */
  base: number;
  /** How lumpy the underside is, 0..1 — a smooth stratus sheet at nothing,
   * a ragged mammatus ceiling at one. */
  relief: number;
};

/**
 * HOW HIGH THE DECK'S LIT RIM REACHES, radians above the horizon.
 *
 * The gradient runs on the ELEVATION of the ceiling above the eye, not on
 * how far out it is — and the difference is the whole look. A rider sits a
 * metre off the water and looks along it, so the sky they see most of is a
 * band a few degrees high: read against DISTANCE, that band is all "nearly
 * at the rim" and the entire visible ceiling comes out the rim's colour,
 * which is a light grey sky in a thunderstorm. Read against ELEVATION the
 * rim is what it physically is — the last few degrees where the line of
 * sight passes out from under the base — and everything above it is the
 * black underside.
 *
 * Stated here rather than in the module that draws the ceiling, because the
 * horizon haze reads it too: the band it fades the far water into is the
 * same band, and a haze shaded against one flat colour hangs in front of
 * the ceiling instead of under it.
 */
export const RIM_BAND = 0.16;

/**
 * WHAT THE CEILING LOOKS LIKE at `elevation` radians above the eye — its
 * dark underside overhead, its lit strip at the rim, and the ramp between.
 * Whatever is IN the sky at that height is the caller's business, which is
 * why this takes a plain elevation and nothing else.
 */
export function deckToneAt(deck: Deck, elevation: number): number {
  const rim = 1 - Math.min(1, Math.max(0, elevation) / RIM_BAND);
  return mixHex(deck.overhead, deck.rim, Math.pow(rim, 1.5));
}

/** One rung of the ladder: everything about a clear sky that is authored
 * rather than derived, at one elevation of the sun. */
export type Rung = {
  zenith: number;
  horizon: number;
  glow: number;
  glowStrength: number;
  sun: number;
  sunIntensity: number;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  fog: number;
  fogNear: number;
  fogFar: number;
  disc: number;
  discSize: number;
  halo: number;
  haloSize: number;
  haloOpacity: number;
  /** How much of the night sky shows, 0..1: the stars, and — its own
   * number, because the two die at very different rates — the DIFFUSE sky
   * behind them, the Milky Way and the galaxies (starfield.ts). A first
   * magnitude star is still there in the last of the twilight; the band
   * needs a genuinely black sky. */
  stars: number;
  galaxy: number;
  /** How much sea mist lies on the water, 0..1 — a dawn's bank, burnt off
   * by mid-morning. Shortens the view and veils the horizon. */
  mist: number;
  cloud: number;
  cloudShade: number;
  cloudOpacity: number;
};

export type Preset = Rung & {
  /** THE KEY LIGHT's place: radians above the horizon — never under it,
   * because a key light from below the water lights nothing — and the world
   * heading it stands at. The sun by day, the moon by night, and a blend of
   * the two through the twilight between; the disc and the halo are drawn
   * here too, so the moon is the disc once it has taken the key. */
  sunElevation: number;
  sunAzimuth: number;
  /** THE REAL SUN, wherever it is — under the horizon included. Anything
   * asking how much sun a thing at ALTITUDE gets — a cloud, the deck's own
   * underside — reads these rather than the key, because the sun sets on
   * the water before it sets on a ceiling two kilometres up. */
  sunUp: number;
  sunBearing: number;
  /** How lit the craft's lamps are, 0..1 (`lampsAt`) — the sky's say,
   * because what a rider reaches for the switch about is the sky. */
  lamps: number;
  /** The word for this light, for anything that keys on one. */
  daylight: Daylight;
  /** How much of the light arrives as a BEAM rather than as skylight
   * scattered on the way down, 0..1. An open sky is all beam; a deck is a
   * lampshade over the sea, and what comes through it arrives from
   * everywhere at once. Nothing about the KEY reads this — a cloudy noon is
   * still bright — only the things a beam does that scattered light cannot,
   * the glint on the water first among them. */
  beam: number;
  /** The lid over the sky, or null for an open one. */
  deck: Deck | null;
};

function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smooth(t: number): number {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}

/** Which of a rung's fields are colours. They are told apart by WHICH they
 * are rather than by their size: a fog distance of 400 is not a colour, and
 * a colour of 0x000000 is not a zero. */
const COLOUR_FIELDS = new Set<keyof Rung>([
  "zenith",
  "horizon",
  "glow",
  "sun",
  "hemiSky",
  "hemiGround",
  "fog",
  "disc",
  "halo",
  "cloud",
  "cloudShade",
]);

/** One rung blended into the next. */
function blendRung(a: Rung, b: Rung, t: number): Rung {
  const out = {} as Rung;
  for (const key of Object.keys(a) as (keyof Rung)[]) {
    out[key] = COLOUR_FIELDS.has(key) ? mixHex(a[key], b[key], t) : lerp(a[key], b[key], t);
  }
  return out;
}

/** The clear sky for this much sun, going this way. */
function rungAt(elevation: number, rising: boolean): Rung {
  const el = elevation / DEG;
  const side = rising ? "dawn" : "dusk";
  if (el <= KEYS[0].at) return { ...KEYS[0][side] };
  for (let i = 1; i < KEYS.length; i++) {
    if (el <= KEYS[i].at) {
      const t = (el - KEYS[i - 1].at) / (KEYS[i].at - KEYS[i - 1].at);
      return blendRung(KEYS[i - 1][side], KEYS[i][side], smooth(t));
    }
  }
  return { ...KEYS[KEYS.length - 1][side] };
}

/** The key light is never allowed under this, radians: a sun ON the horizon
 * still lights the sea from the side, but a light exactly at grazing throws
 * nothing on a horizontal surface — every hull, buoy and skerry facing the
 * lens would go black at the one moment the sky is most worth looking at. */
const KEY_FLOOR = 2 * DEG;

/** Between which elevations of the SUN the key hands over to the moon,
 * degrees under the horizon. Above the top of the band the sea is lit by
 * the afterglow's skylight from the sun's side; below the bottom it is
 * moonlit from the other. The band is the civil twilight, which is where a
 * real evening's light stops being the sun's. */
const MOON_TAKES_OVER = { from: -3, to: -9 };

/** THE OPEN SKY at a sun's place: the rung, with the key light placed. */
function openSky(sun: SunPlace): Preset {
  const rung = rungAt(sun.elevation, sun.rising);
  const moon = moonAt(sun);
  // How far the moon has taken the key over, 0..1.
  const handed = clamp01(
    (sun.elevation / DEG - MOON_TAKES_OVER.from) / (MOON_TAKES_OVER.to - MOON_TAKES_OVER.from),
  );
  // The sun's side of the sky keeps the key while the afterglow lasts; the
  // moon's takes it as the dark comes down. Both stand off the floor.
  const sunKey = Math.max(KEY_FLOOR, sun.elevation);
  const moonKey = Math.max(KEY_FLOOR, moon.elevation);
  return {
    ...rung,
    // HOW VISIBLE THE BAND IS is far steeper than any pair of rungs can
    // blend: a sky twice as bright does not show half the Milky Way, it
    // shows almost none of it, because the band is a glow a shade over the
    // sky's own floor and the twilight it is competing with is not. So the
    // rungs author how much band a sky HAS and this is the curve between
    // them — at the bottom of the ladder the whole of it, and at nautical
    // twilight, four degrees up the ladder, a fifth.
    galaxy: rung.galaxy * rung.galaxy * rung.galaxy,
    sunElevation: lerp(sunKey, moonKey, handed),
    sunAzimuth: sun.azimuth + Math.PI * handed,
    sunUp: sun.elevation,
    sunBearing: sun.azimuth,
    lamps: lampsAt(sun.elevation),
    daylight: daylightOf(sun),
    beam: 1,
    deck: null,
  };
}

/** THE SEASON'S CAST over the open sky, in the proportion the sun is up —
 * a colour cast is a statement about sunlight, and a midnight has none to
 * cast. Before the weather, because a lid greys whatever is under it and
 * that includes the year's colour. */
function seasoned(p: Preset, look: SeasonLook): Preset {
  const day = daytime(p.sunUp);
  p.horizon = mixHex(p.horizon, look.horizon[0], look.horizon[1] * day);
  p.fog = mixHex(p.fog, look.fog[0], look.fog[1] * day);
  p.fogNear *= look.reach;
  p.fogFar *= look.reach;
  p.sunIntensity *= lerp(1, look.sun, day);
  p.mist = clamp01(p.mist * look.mist);
  return p;
}

/** THE MIST, before the weather for the same reason. It is a fact about the
 * water's own air rather than about the sky: the view pulls in — hard at the
 * near end, because a bank on the water is dense where the rider is — and
 * the haze goes toward the horizon's own pale, which is what a bank looks
 * like with the sky behind it. */
function misted(p: Preset): Preset {
  const m = p.mist;
  p.fogNear *= 1 - 0.7 * m;
  p.fogFar *= 1 - 0.5 * m;
  p.fog = mixHex(p.fog, p.horizon, 0.5 * m);
  return p;
}

/** The clear-weather baseline, for anything needing a REFERENCE sky rather
 * than the one being drawn. */
export const NOON: Preset = {
  ...DAY,
  sunElevation: 0.9,
  sunAzimuth: Math.PI,
  sunUp: 0.9,
  sunBearing: Math.PI,
  lamps: 0,
  daylight: "day",
  beam: 1,
  deck: null,
};

/**
 * HOW MUCH DAY THERE IS IN THE AIR, 0..1 — the sun's elevation in degrees
 * read as a ramp: one for a sun well up, falling away as it comes down
 * onto the water, and gone by nautical twilight.
 *
 * Every colour a weather look puts on the sky is a statement about SUNLIGHT
 * in it — the grey of a lid, the lit strip under a gust front, the white
 * glow of a rain deck, a season's cast. Not one of them is a property of
 * the air itself, so each is shown in this proportion, and a lid over a
 * setting sun is a dark ceiling rather than a daylight grey over a red sea.
 *
 * The mixes it guards cannot simply be left at full strength after dark.
 * `mixHex` mixes in LINEAR light, where a midnight sky sits four orders
 * under a bright authored grey — so a fifth of the way toward one lands two
 * thirds of the way up the sRGB ramp, and a night under a lid came out a
 * mid-grey ceiling over a black sea.
 *
 * Keyed on the SUN rather than on how much light there is, because no
 * measure of the light can tell a low sun from weather: a clear sunset and
 * a squall at noon put the same amount on the water, and `dayLight` after
 * dark is the MOON. The ladder can tell — its rungs ARE elevations.
 */
function daytime(elevation: number): number {
  return clamp01((elevation / DEG + 10) / 8);
}

/** A sky with no lid: the ladder, softened by whatever haze the look
 * carries. The clear row does nothing at all; the high row is where this
 * earns its place — a cirrostratus sheet has no ceiling to draw and still
 * changes every colour in the frame. */
function opened(p: Preset, look: OpenLook, cover: number): Preset {
  const day = daytime(p.sunUp);
  const greyed = (c: number): number => mixHex(c, look.grey, look.mix * day);
  const through = lerp(look.through[0], look.through[1], cover);
  p.zenith = greyed(p.zenith);
  p.horizon = greyed(p.horizon);
  p.glow = greyed(p.glow);
  p.sun = mixHex(p.sun, look.grey, look.mix * day);
  p.sunIntensity *= lerp(look.dim[0], look.dim[1], cover);
  p.hemiSky = greyed(p.hemiSky);
  p.hemiIntensity *= lerp(look.hemi[0], look.hemi[1], cover);
  p.fog = mixHex(greyed(p.fog), p.horizon, FOG_IS_SKY);
  p.fogNear *= lerp(look.fogNear[0], look.fogNear[1], cover);
  p.fogFar *= lerp(look.fogFar[0], look.fogFar[1], cover);
  // A sheet does not hide the sun, it takes its EDGE: the disc swells and
  // softens into the halo rather than shrinking.
  p.discSize *= lerp(1, 1.35, 1 - through);
  p.haloSize *= lerp(1, 1.5, 1 - through);
  p.haloOpacity *= lerp(0.5, 1, through);
  p.beam = through;
  // A sheet over the night takes the faint sky first: the band needs a
  // black sky and a veil of cirrus is not one, where the bright stars
  // still come through it.
  p.stars *= through;
  p.galaxy *= through * through;
  return p;
}

/** …and a sky with one. The lid goes over the hour rather than replacing
 * it, which is what keeps a squall at sunset a different picture from a
 * squall at noon. */
function lidded(p: Preset, look: WeatherLook, cover: number): Preset {
  const day = daytime(p.sunUp);
  // How lit the deck is from ABOVE, 0..1 — what its own brightness is
  // scaled by, so a ceiling over a sun that has set is dark rather than a
  // white sheet over a black sea. Saturating: any real daylight lights a
  // rain deck to its authored white, and it is only the last of the light
  // going that takes the ceiling down with it.
  const light = smooth((dayLight(p) - 0.1) / 0.4);
  /** The lid's grey on one of the LIGHTS, taken whole: a deck kilometres
   * thick greys the moon as surely as it greys the sun. */
  const toward = (c: number): number => mixHex(c, look.grey, look.mix);
  /** …and on one of the SKY's own colours, which is cloud with the DAY on
   * it (see `daytime`): a midnight lid is not grey, it is black. */
  const greyed = (c: number): number => mixHex(c, look.grey, look.mix * day);
  p.zenith = greyed(p.zenith);
  p.horizon = greyed(p.horizon);
  p.glow = greyed(p.glow);
  p.glowStrength *= 0.4;
  p.sun = toward(p.sun);
  p.sunIntensity *= lerp(look.dim[0], look.dim[1], cover);
  p.hemiSky = toward(p.hemiSky);
  p.hemiGround = toward(p.hemiGround);
  p.hemiIntensity *= lerp(look.hemi[0], look.hemi[1], cover);
  p.fog = greyed(p.fog);
  p.fogNear *= lerp(look.fogNear[0], look.fogNear[1], cover);
  p.fogFar *= lerp(look.fogFar[0], look.fogFar[1], cover);
  // A lit sun behind a deck is a bright PATCH, never a disc with an edge —
  // and behind a squall's ceiling it is not there at all.
  const through = lerp(look.through[0], look.through[1], cover);
  p.beam = through;
  p.discSize = 0;
  p.haloOpacity *= 0.3 * through;
  p.haloSize *= 1.5;
  p.cloud = greyed(p.cloud);
  p.cloudShade = greyed(p.cloudShade);
  // A lid over the night: the stars are gone under a thick one and a hint
  // through a thin one, and the band never gets through at all.
  p.stars *= 0.2 * through;
  p.galaxy = 0;
  const deck: Deck = {
    // The underside is lit from above by whatever day there is: at night it
    // is as dark as the sky it hides.
    overhead: mixHex(
      0x05070b,
      mixHex(look.overhead[0], look.overhead[1], cover),
      0.06 + 0.94 * light,
    ),
    // The rim is the hour's own horizon pulled toward the strip's tone, so
    // a midnight squall keeps a dark one and a noon squall gets the lit gap
    // under the base. The strip IS daylight arriving under the base from
    // outside the weather, so after dark there is none of it to arrive.
    rim: mixHex(p.horizon, look.rim, look.rimMix * day),
    base: lerp(look.base[0], look.base[1], cover),
    relief: lerp(look.relief[0], look.relief[1], cover),
  };
  p.deck = deck;
  // THE DISTANCE GOES THE COLOUR OF THE CEILING A FEW DEGREES UP — which is
  // neither the underside overhead nor the lit strip at the rim, and the
  // difference is what a far shore looks like under weather.
  //
  // What erases the shore is a few hundred metres of air, and that air is
  // lit by the piece of ceiling directly over it. Read at the OVERHEAD, a
  // rain deck (near white up there) turns the far shore into a paper cut-out
  // brighter than the sky above it. Read at the RIM, a squall's shore comes
  // back as bright as the gust front's lit strip, which is the one place in
  // the sky with any daylight in it. `DECK_HAZE` is where between the two
  // the air actually stands.
  p.fog = mixHex(p.fog, deckToneAt(deck, RIM_BAND * DECK_HAZE), look.fogDeck);
  // AND THE HORIZON BAND IS THE LIT STRIP. The ceiling is a real surface
  // and its rim stands a fraction of a degree above the eye, so under it
  // there is always a sliver of open dome between the ceiling and the
  // water. That sliver is not a different sky — it is the same daylight
  // arriving under the base that makes the rim bright — and leaving the
  // dome on the hour's own horizon paints it a different colour from the
  // strip directly above it, which reads as a hard band ruled across the
  // skyline. They are one thing, so they are one colour.
  p.horizon = deck.rim;
  // Nobody can SEE the zenith under a lid, so the blue behind it is pulled
  // most of the way to the ceiling: what is left shows only where the deck
  // does not quite reach, and as the colour the canvas is cleared to.
  p.zenith = mixHex(p.zenith, deck.overhead, 0.55);
  return p;
}

/**
 * HOW MUCH OF THE DISTANCE IS SIMPLY THE SKY BEHIND IT, 0..1.
 *
 * The far shore is the one thing in the frame that is not LIT — it is
 * ERASED, by a few hundred metres of the same air the sky itself is made of.
 * So what the fog fades it into has to be the sky in THAT DIRECTION, which
 * at the skyline is the horizon band. A haze colour authored beside the
 * horizon rather than out of it puts a pale grey headland across a burning
 * sunset — the distance stops answering to the light, which is the one thing
 * distance can never do.
 *
 * Not all the way, because haze is not exactly the sky: it is a little
 * paler and a little less saturated, and the rungs' own `fog` is where that
 * is authored. This is how much of it the horizon wins.
 */
const FOG_IS_SKY = 0.78;

/** …and where under a LID the same question is asked, as a share of the
 * rim band (`RIM_BAND`): the patch of ceiling a few degrees up, which is
 * what lights the air the shore is seen through. See `lidded`. */
const DECK_HAZE = 0.35;

/** Whether a sky has a lid — the two shapes `Looks` is written in. */
function isOpen(weather: Weather): weather is "clear" | "high" {
  return weather === "clear" || weather === "high";
}

/**
 * THE WHOLE SKY at `hour` over a coast at `latitude` in `season`, under
 * `weather` at `cover` (R19's heaviness, 0..1).
 *
 * Takes the five facts rather than a `Level` so that a lab, a test or a
 * contact sheet can ask for a sky nobody generated — every hour of the day
 * and night under every sky there is, which is the only honest way to look
 * at a ladder.
 */
export function skyAt(
  hour: number,
  latitude: number,
  weather: Weather,
  cover: number,
  season: Season = "summer",
): Preset {
  const p = misted(seasoned(openSky(sunOver(hour, latitude, season)), TAIGA_SEASONS[season]));
  const looks = TAIGA_LOOKS;
  return isOpen(weather) ? opened(p, looks[weather], cover) : lidded(p, looks[weather], cover);
}

/** …for the level actually being ridden, at run time `t`. The coast, the
 * season and the sky are all its own and the hour is its own run on
 * (`sunHourAt`); the heaviness is its wind read against R12's band, which
 * is what makes the biggest seas come under the darkest skies. */
export function skyFor(level: Level, latitude: number, t: number): Preset {
  return skyAt(
    sunHourAt(level, t),
    latitude,
    level.weather,
    skyCover(level.wind.speed),
    level.season,
  );
}

/** HOW MUCH LIGHT a preset puts on a horizontal surface — the skylight from
 * the hemisphere's upper half plus what is left of the key at its
 * elevation, summed in LINEAR light because that is what two lights shining
 * on the same water actually do. A scalar rather than a colour: everything
 * that reads it is comparing one sky's light with another's. */
function keyLight(p: Preset): number {
  const sky = luminance(p.hemiSky) * p.hemiIntensity;
  const sun = luminance(p.sun) * p.sunIntensity * Math.max(0, Math.sin(p.sunElevation));
  return sky + sun;
}

/**
 * HOW MUCH DAYLIGHT THERE IS, 0..1 against a clear noon.
 *
 * The things not lit by the scene's own lights have to be TOLD how dark it
 * is — the foam on a crest, the lens of the craft's lamp, the pool it lays
 * on the water in the dark and cannot lay by day. One number answers all of
 * them and follows any retune of the ladder for free. After dark it is the
 * MOON's light, a tenth of a noon's under a clear sky.
 */
export function dayLight(p: Preset): number {
  const full = keyLight(NOON);
  return full > 0 ? Math.min(1, keyLight(p) / full) : 1;
}

/**
 * HOW HARD THE LIGHT THROWS A SHADOW, 0..1 — the BEAM's share of the light
 * on the water, measured against a clear noon's own share.
 *
 * What the key light cannot say on its own is whether it is a beam at all:
 * under a deck the key is still there — the sea would be black without it —
 * but the light it stands in for arrives from everywhere at once and throws
 * nothing. A shadow is the ABSENCE of the direct half, so what decides how
 * dark it goes is how much of the light would be missing: a low sun under a
 * dark sky throws a harder shadow than a high one under a bright one, which
 * is why a sunset's shadows read black and a bright overcast noon has none.
 */
export function sunHardness(p: Preset): number {
  const noon = beamShare(NOON);
  return noon > 0 ? Math.min(1, beamShare(p) / noon) : 0;
}

function beamShare(p: Preset): number {
  const beam = luminance(p.sun) * p.sunIntensity * Math.sin(Math.max(0, p.sunElevation)) * p.beam;
  const sky = luminance(p.hemiSky) * p.hemiIntensity;
  const total = beam + sky;
  return total > 0 ? beam / total : 0;
}

/**
 * WHAT COLOUR A THING AT ALTITUDE IS LIT — a cloud, the deck's own base.
 *
 * The sun sets on the water first. A cloud two kilometres up is still in
 * full sun minutes after the sea below it has lost it, so it burns the
 * sunset's orange over water that has already gone grey, and then goes grey
 * itself. The lit tone and the shade are the preset's; how much of each a
 * given altitude gets is where the REAL sun is (`litAt`).
 */
export function highLightFor(p: Preset, lit: number): number {
  return mixHex(p.cloudShade, p.cloud, lit);
}

/**
 * WHAT THE WATER REFLECTS at a grazing angle under this sky.
 *
 * The sea is a mirror at the horizon and its own colour under the rider, so
 * what the far half of the frame is made of is SKY. Feeding the water mesh
 * a fixed pale blue is the single loudest way a dramatic sky can end up
 * looking pasted on: a sunset with a teal sea under it is not a sunset.
 *
 * It is the sky just ABOVE the horizon rather than the horizon band itself
 * — the water reflects the sky it is pointing at, and a wave face tilted
 * toward the rider is pointing a few degrees up — so the horizon is pulled
 * a little toward the zenith. Under a lid it is the ceiling that is
 * reflected, at the same few degrees, which is what puts a squall's black
 * on the water and is most of why one reads as dangerous.
 */
export function seaMirror(p: Preset): number {
  if (p.deck) return deckToneAt(p.deck, 0.06);
  return mixHex(p.horizon, p.zenith, 0.25);
}

/**
 * THE OPEN SKY'S GRADIENT, in three numbers the dome and the water share.
 *
 * `SKY_CURVE` is the exponent the horizon-to-zenith blend runs on against
 * the sine of the elevation: steep low down and slack overhead, which is
 * what a real sky does — nearly all of the colour change happens in the
 * first twenty degrees, and a linear ramp puts it in the wrong half.
 * `GLOW_FOCUS` is how tightly the warm bleed hugs the sun's own bearing
 * (a power on the cosine of the bearing difference) and `GLOW_REACH` how
 * fast it dies with height (a power on one minus the sine of the
 * elevation): strongest at the horizon and gone by halfway up — Valheim's
 * trick, and the reason a low sun lights a quarter of the sky rather than
 * a disc.
 *
 * `skyToneAt` below is the model in TypeScript, which is what `sky_test.ts`
 * holds it to; `sky-glsl.ts` restates the same formula in GLSL off these
 * same three constants, and BOTH the dome and the water's mirror are painted
 * with that one function — so the sea reflects the sky that is over it by
 * construction rather than by two files agreeing.
 */
export const SKY_CURVE = 0.62;
export const GLOW_FOCUS = 3;
export const GLOW_REACH = 2.2;

/** The open sky's tone at `up` — the SINE of the elevation, 0..1 — looking
 * `toward` the sun's bearing (the cosine of the bearing difference, 0..1),
 * packed sRGB. Mixed in linear light, like every colour in the model. */
export function skyToneAt(p: Preset, up: number, toward: number): number {
  const tone = mixHex(p.horizon, p.zenith, Math.pow(clamp01(up), SKY_CURVE));
  const w =
    Math.pow(clamp01(toward), GLOW_FOCUS) * Math.pow(1 - clamp01(up), GLOW_REACH) * p.glowStrength;
  return mixHex(tone, p.glow, Math.min(1, w));
}

/** Direction from the origin TOWARD a light at elevation `el` on world
 * heading `az` — the engine's heading convention, so it drops straight onto
 * a three.js vector with no sign flipped. */
export function sunVector(el: number, az: number): { x: number; y: number; z: number } {
  const c = Math.cos(el);
  return { x: Math.sin(az) * c, y: Math.sin(el), z: Math.cos(az) * c };
}
