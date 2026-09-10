// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE START CARD — the first of the two questions between the front door and
// the water: WHERE, and WHEN.
//
// FOUR ROWS, AND NOT ONE MORE. A card standing between a player and a game
// they have already said yes to earns its place only if every row on it
// changes the ride they are about to have, so it asks the four things that
// do and leaves everything else to OPTIONS:
//
//   SHORE    which seed, with the coast it makes drawn underneath: the
//            schematic is the row, because a number nobody can picture is
//            not a choice.
//   TIME     sunrise, day or sunset — resolved by the ENGINE against this
//            coast's own daylight window (`hourOfDay`), never as three
//            hours written down here.
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
// never touched it — but a chip meaning "as dealt" asks a rider to pick an
// answer nobody has told them. So the seed's own day comes back with its
// chart (`SeedDeal`), the chip it names is MARKED, and leaving the row alone
// stands on that chip. Pressing the marked chip is how a row goes back to
// deferring: it stores null, which is the shore's own hour, wind or sky
// rather than the rung's figure.
//
// The rows are `menu.tsx`'s, shared with OPTIONS and the developer page, and
// what they WRITE is `settings.ride` — so a run stood up from here and a run
// stood up from a link are the same run read the same way.

import { TIMES_OF_DAY, WEATHER_IDS, type TimeOfDay, type Weather } from "@engine";

import { MenuBody, MenuHead, OptionRow, StepRow } from "./menu.tsx";
import { SeedPreview, useSeedPreview } from "./seed-preview.tsx";
import {
  CONDITIONS,
  CONDITION_DAY,
  DEFAULT_SEED,
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
const TIME_OPTIONS: readonly { id: TimeOfDay; label: string }[] = TIMES_OF_DAY.map((id) => ({
  id,
  label: TIME_LABELS[id],
}));

const CONDITION_LABELS: Record<Conditions, string> = {
  fine: STRINGS.windCalm,
  windy: STRINGS.windBrisk,
  storm: STRINGS.windStorm,
};

const CONDITION_OPTIONS: readonly { id: Conditions; label: string }[] = CONDITIONS.map((id) => ({
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
 * read as a ladder, and one this card never restates: a sky added to R19 is
 * a chip here the same day. */
const WEATHER_OPTIONS: readonly { id: Weather; label: string }[] = WEATHER_IDS.map((id) => ({
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
  const ride = settings.ride;
  const setRide = (patch: Partial<Settings["ride"]>): void =>
    onSettings({ ...settings, ride: { ...ride, ...patch } });
  const seed = ride.seed ?? DEFAULT_SEED;

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
    <div class="menu-card">
      <MenuHead
        back={onBack}
        backLabel={STRINGS.menuBack}
        title={STRINGS.startTitle}
        sub={STRINGS.startSub}
      />
      <MenuBody>
        <StepRow
          label={STRINGS.startShore}
          read={String(seed)}
          // Never below 1: seed 0 is not a level, and an arrow that walks off
          // the bottom of the catalog is an arrow that hangs the card.
          onStep={(by) => setRide({ seed: Math.max(1, seed + by) })}
          onClear={() => setRide({ seed: null })}
          clearLabel={STRINGS.startShoreDefault}
        />
        {/* The coast that seed makes, cut from the real generated level —
            the row above is a number, and this is what the number means. */}
        <SeedPreview chart={chart} />
        <OptionRow
          label={STRINGS.startTime}
          options={TIME_OPTIONS}
          value={ride.time ?? deal?.time ?? null}
          dealt={deal?.time ?? null}
          pending={!chart.fresh}
          onPick={(time) => setRide({ time: pick(time, deal?.time ?? null) })}
        />
        <OptionRow
          label={STRINGS.startWind}
          options={CONDITION_OPTIONS}
          value={ride.conditions ?? dealtWind}
          dealt={dealtWind}
          pending={!chart.fresh}
          onPick={(c) => setRide({ conditions: pick(c, dealtWind) })}
        />
        {/* Under the wind, because it defers to it: the marked sky here is
            the one the row above implies, not a sky of its own. */}
        <OptionRow
          label={STRINGS.startWeather}
          options={WEATHER_OPTIONS}
          value={ride.weather ?? dealtWeather}
          dealt={dealtWeather}
          // A wind CHOSEN implies its sky with no level to wait for; only a
          // row still deferring to the shore is provisional.
          pending={ride.conditions === null && !chart.fresh}
          onPick={(w) => setRide({ weather: pick(w, dealtWeather) })}
        />
        {/* The way on, wearing the front door's own START weight so the eye
            lands on it first — and marked as this surface's `next`, so a
            controller that walked in here reaches the craft without
            hunting. */}
        <button
          type="button"
          class="menu-item menu-item-start menu-start-go"
          data-menu="craft"
          data-nav-next
          data-nav-focus
          onClick={onNext}
        >
          <span class="menu-item-name">{STRINGS.startNext}</span>
        </button>
      </MenuBody>
    </div>
  );
}
