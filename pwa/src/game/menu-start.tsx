// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE START CARD — the first of the two questions between the front door and
// the water: WHERE, and WHEN.
//
// FIVE ROWS, AND NOT ONE MORE. A card standing between a player and a game
// they have already said yes to earns its place only if every row on it
// changes the ride they are about to have, so it asks the five things that
// do and leaves everything else to OPTIONS:
//
//   SHORE    which seed, with the coast it makes drawn underneath: the
//            schematic is the row, because a number nobody can picture is
//            not a choice.
//   SEASON   spring, summer, autumn or winter — the sun's arc, which is how
//            long the day is and how dark the night gets (R13).
//   TIME     sunrise, day or sunset — resolved by the ENGINE against this
//            coast's own daylight window in that season (`hourOfDay`),
//            never as three hours written down here. The clock runs on
//            from there at an hour a minute, so SUNSET is a run that rides
//            into the night.
//   WIND     calm, brisk or storm — the wind, and so the SEA, because the
//            fetch law is what turns one into the other.
//   WEATHER  the sky over it: R19's own five, off `WEATHER_IDS`.
//
// THE CRAFT IS THE SECOND QUESTION AND IT IS NOT ASKED HERE. A shore is a
// seed with a chart under it and an hour is a word that means an hour; a
// craft is a SHAPE, and it takes the card that can show one turning on the
// water (`menu-craft.tsx`) — which is also where RIDE lives, because the
// last thing a rider does before the water should be looking at the hull
// they are about to ride. This card's way on is that card.
//
// WIND AND WEATHER ARE TWO ROWS, AND THE SECOND ONE DEFERS TO THE FIRST.
// They were one row once, for a good reason: R19 deals a level's sky off the
// wind that grew its waves, so that the water and the ceiling tell the rider
// about the same weather, and offering "squall" and "flat calm" as free
// answers hands that agreement straight back. The split keeps it by making
// WEATHER an OVERRIDE rather than a peer — leave it alone and the sky is
// still the one the wind implies (`CONDITION_DAY`), so the agreement holds
// for everybody who does not go looking. What the row buys is the ride the
// bundle could not ask for at all: rain over a calm morning, a clear noon
// over a sea running at twenty metres a second.
//
// EVERY ROW DEFAULTS TO THE SHORE'S OWN, AND THE ROW SAYS WHICH ANSWER THAT
// IS. A generated level is a whole day, and a card that arrived with an
// opinion about any of it would quietly take that away from every player who
// never touched it — but a stop meaning "as dealt" asks a rider to pick an
// answer nobody has told them. So the seed's own day comes back with its
// chart (`SeedDeal`), the value it names is MARKED — a dot beside the word and
// a ring round its pip — and leaving the row alone stands on it. Landing back
// on the marked value is how a row goes back to deferring: it stores null,
// which is the shore's own hour, wind or sky rather than the rung's figure.
//
// THE ROWS ARE THE KNOBS (`menu-knobs.tsx`), the same silhouette OPTIONS, the
// developer page and the pause strip wear: the name, the value between two
// arrows, the pips under it. They used to be chips — every answer on screen at
// once — and the five skies were what broke that: a six-word ladder wraps to
// two lines on any card narrow enough for a phone, and one row wrapping while
// the rows above it do not reads as a bug rather than as a tight fit. The pips
// carry what the chips did (where on the ladder this answer stands, and how
// many there are) in the width of the value itself.
//
// What the rows WRITE is `settings.ride` — so a run stood up from here and a
// run stood up from a link are the same run read the same way.

import {
  SEASONS,
  TIMES_OF_DAY,
  WEATHER_IDS,
  type Season,
  type TimeOfDay,
  type Weather,
} from "@engine";
import { useState } from "preact/hooks";

import { MenuHead } from "./menu.tsx";
import { Caption, NumberRow, StepRow, type Stop } from "./menu-knobs.tsx";
import { SeedPreview, useSeedPreview } from "./seed-preview.tsx";
import {
  CONDITIONS,
  CONDITION_DAY,
  DEFAULT_SEED,
  SEED_RANGE,
  conditionsFor,
  type Conditions,
  type Settings,
} from "./settings.ts";
import { STRINGS } from "./strings.ts";

const TIME_LABELS: Record<TimeOfDay, string> = {
  sunrise: STRINGS.timeSunrise,
  day: STRINGS.timeDay,
  sunset: STRINGS.timeSunset,
};

/** The hours in the engine's own order — earliest first, which is the order
 * they read as a ladder. */
const TIME_STOPS: Stop<TimeOfDay>[] = TIMES_OF_DAY.map((id) => ({
  id,
  label: TIME_LABELS[id],
}));

const SEASON_LABELS: Record<Season, string> = {
  spring: STRINGS.seasonSpring,
  summer: STRINGS.seasonSummer,
  autumn: STRINGS.seasonAutumn,
  winter: STRINGS.seasonWinter,
};

/** The seasons in the year's order, which is the engine's. */
const SEASON_STOPS: Stop<Season>[] = SEASONS.map((id) => ({ id, label: SEASON_LABELS[id] }));

const CONDITION_LABELS: Record<Conditions, string> = {
  fine: STRINGS.windCalm,
  windy: STRINGS.windBrisk,
  storm: STRINGS.windStorm,
};

const CONDITION_STOPS: Stop<Conditions>[] = CONDITIONS.map((id) => ({
  id,
  label: CONDITION_LABELS[id],
}));

const WEATHER_LABELS: Record<Weather, string> = {
  clear: STRINGS.skyClear,
  high: STRINGS.skyHigh,
  overcast: STRINGS.skyOvercast,
  rain: STRINGS.skyRain,
  squall: STRINGS.skySquall,
};

/** The skies in the ENGINE's order, which is lightest first — the order they
 * read as a ladder, and one this card never restates: a sky added to R19 is a
 * stop here the same day. */
const WEATHER_STOPS: Stop<Weather>[] = WEATHER_IDS.map((id) => ({
  id,
  label: WEATHER_LABELS[id],
}));

export function StartPage({
  settings,
  onSettings,
  onBack,
  onNext,
}: {
  settings: Settings;
  onSettings: (settings: Settings) => void;
  onBack: () => void;
  /** On to the craft card, which is where RIDE is (see the header). */
  onNext: () => void;
}) {
  const [hint, setHint] = useState<string | null>(null);
  const ride = settings.ride;
  const setRide = (patch: Partial<Settings["ride"]>): void =>
    onSettings({ ...settings, ride: { ...ride, ...patch } });
  const seed = ride.seed ?? DEFAULT_SEED;
  /** THE DEFAULT SHORE IS STILL STORED AS NULL, whether it was arrived at by
   * never touching the row or by walking back onto it. The two ride the same
   * coast today, and null is the one that keeps riding the right one the day
   * {@link DEFAULT_SEED} moves — which is exactly what the row that used to
   * have a "back to the default shore" press was for. */
  const setSeed = (next: number): void => setRide({ seed: next === DEFAULT_SEED ? null : next });

  // The day this seed deals, off the same reply the chart is drawn from. Null
  // until the first one lands — a level takes hundreds of milliseconds to
  // build — and the last one stays up, dimmed, while the next is being built.
  const chart = useSeedPreview(seed);
  const deal = chart.shown?.ok === true ? chart.shown.deal : null;
  // WHAT THE SKY WOULD BE IF NOBODY TOUCHED IT, which is not always the sky
  // the LEVEL was dealt: a wind chosen on the row above carries its own sky
  // (R19's agreement, kept by `CONDITION_DAY`), and that is the one this row
  // is overriding. So the mark follows the wind while a wind is chosen.
  const dealtWeather =
    ride.conditions === null ? (deal?.weather ?? null) : CONDITION_DAY[ride.conditions].weather;
  const dealtWind = deal === null ? null : conditionsFor(deal.wind);
  /** What a press means: the marked chip hands the row back to the shore
   * (null), anything else is the override. */
  const pick = <T extends string>(id: T, dealtId: T | null): T | null =>
    id === dealtId ? null : id;

  return (
    <div class="menu-card menu-card-start" onPointerLeave={() => setHint(null)}>
      <MenuHead
        back={onBack}
        backLabel={STRINGS.menuBack}
        title={STRINGS.startTitle}
        sub={STRINGS.startSub}
        /* THE WAY ON STANDS IN THE HEAD, opposite the way back. It used to be
           a full-width press under the caption, which put the card's tallest
           row below the one square element on it — and `.menu-card` scrolls
           rather than clipping, so on a phone the press the card exists for
           was the part that hung off the bottom. Up here it costs no height,
           and back-on-the-left / on-to-the-right is the pair a rider reads
           without being told. Its word is NEXT for the same reason: a head
           button is a corner, not a banner, and the card that follows says
           what it is. Still `menu-item-start`'s orange and still this
           surface's `next` and its landing, so a controller walking in finds
           it first. */
        action={
          <button
            type="button"
            class="menu-item menu-item-start menu-head-go"
            data-menu="craft"
            data-nav-next
            data-nav-focus
            onClick={onNext}
          >
            <span class="menu-item-name">{STRINGS.startNext}</span>
          </button>
        }
      />
      {/* TWO COLUMNS WHERE THERE IS WIDTH FOR THEM, and the CHART is what
          they are for. It is square, so every pixel of its width is a pixel
          of card height — beside the three rows it costs nothing, and it can
          be drawn half again as big as it could when it stood over them
          (`.menu-card-start` in styles.css). On a phone the grid collapses
          and the card is the column it always was. */}
      <div class="start-cols">
        <div class="start-col">
          <div class="knob-rows">
            <NumberRow
              label={STRINGS.startShore}
              hint={STRINGS.startShoreHint}
              value={seed}
              // Never below 1: seed 0 is not a level, and an arrow that walks
              // off the bottom of the catalog is an arrow that hangs the card.
              min={SEED_RANGE.min}
              max={SEED_RANGE.max}
              onValue={setSeed}
              onHint={setHint}
            />
          </div>
          {/* The coast that seed makes, cut from the real generated level —
              the row above is a number, and this is what the number means. */}
          <SeedPreview chart={chart} />
        </div>
        <div class="start-col">
          <div class="knob-rows">
            <StepRow
              label={STRINGS.startSeason}
              hint={STRINGS.startSeasonHint}
              stops={SEASON_STOPS}
              value={ride.season ?? deal?.season ?? null}
              dealt={deal?.season ?? null}
              pending={!chart.fresh}
              onPick={(season) => setRide({ season: pick(season, deal?.season ?? null) })}
              onHint={setHint}
            />
            <StepRow
              label={STRINGS.startTime}
              hint={STRINGS.startTimeHint}
              stops={TIME_STOPS}
              value={ride.time ?? deal?.time ?? null}
              dealt={deal?.time ?? null}
              pending={!chart.fresh}
              onPick={(time) => setRide({ time: pick(time, deal?.time ?? null) })}
              onHint={setHint}
            />
            <StepRow
              label={STRINGS.startWind}
              hint={STRINGS.startWindHint}
              stops={CONDITION_STOPS}
              value={ride.conditions ?? dealtWind}
              dealt={dealtWind}
              pending={!chart.fresh}
              onPick={(c) => setRide({ conditions: pick(c, dealtWind) })}
              onHint={setHint}
            />
            {/* Under the wind, because it defers to it: the marked sky here is the
            one the row above implies, not a sky of its own. */}
            <StepRow
              label={STRINGS.startWeather}
              hint={STRINGS.startWeatherHint}
              stops={WEATHER_STOPS}
              value={ride.weather ?? dealtWeather}
              dealt={dealtWeather}
              // A wind CHOSEN implies its sky with no level to wait for; only a
              // row still deferring to the shore is provisional.
              pending={ride.conditions === null && !chart.fresh}
              onPick={(w) => setRide({ weather: pick(w, dealtWeather) })}
              onHint={setHint}
            />
          </div>
        </div>
      </div>
      {/* The mark is explained ONCE, at the foot of the whole card rather than
          as a tooltip on three rows nobody hovers. */}
      <Caption text={hint} fallback={STRINGS.startCaption} />
    </div>
  );
}
