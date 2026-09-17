// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE START CARD — the first of the two questions between the front door and
// the water on a FREE RIDE: WHERE, and WHEN.
//
// IT IS FREE'S CARD AND NOBODY ELSE'S. A race, a tricks run and a time trial
// are MEASURED, and a figure is only worth keeping if the water it was set
// on is water somebody else can ride — so those three pick one of the
// campaign's twelve pinned shores (`menu-levels.tsx`) and take its day with
// it. What is left here is the mode where nothing is compared, which is
// exactly where a seed of your own, a wind of any strength and a sea of any
// size belong. FREE is the only tile that opens this card, so the head's
// title is FREE every time a player reaches it; a LINK may still open it in
// another mode (`?menu=start`), and then it is what it says it is — the
// card that picks a seed, for a mode whose pinned shore a `?seed=` has
// taken off (`new-game.ts`'s `pinnedFor`).
//
// SEVEN ROWS, AND NOT ONE MORE. A card standing between a player and a game
// they have already said yes to earns its place only if every row on it
// changes the ride they are about to have, so it asks the seven things that
// do and leaves everything else to OPTIONS:
//
//   COAST    which BIOME the seed is built on — the taiga's granite and
//            pine, or the mangrove's white sand and turquoise water. Above
//            the seed because the seed is read against it: the same number
//            is a different shore on each coast, and the chart under both
//            rows is cut from the level the pair actually builds. The one
//            row with no dealt mark, because a coast is a choice a seed
//            never makes.
//   SHORE    which seed, with the coast it makes drawn underneath: the
//            schematic is the row, because a number nobody can picture is
//            not a choice.
//   SEASON   spring, summer, autumn or winter — the sun's arc, which is how
//            long the day is and how dark the night gets (R13).
//   TIME     sunrise, day, sunset or night — resolved by the ENGINE against
//            this coast's own daylight window in that season (`hourOfDay`),
//            never as four hours written down here. The clock runs on from
//            there at an hour a minute, so SUNSET is a run that rides into
//            the night and NIGHT is one that starts there and rides out of
//            it into the dawn. Night is the one rung a seed can never be
//            dealt (R13 starts every level in daylight), so it is the one
//            row value that is always an override and never the mark.
//   WIND     calm, brisk or storm — the wind, and so the CHOP, because the
//            fetch law is what turns one into the other.
//   WAVES    how big the swell out past the coast is (R36), on the Douglas
//            scale from a slight metre to a phenomenal twenty. It is the
//            seventh row and the newest, and it is not a second WIND row:
//            the wind row asks about the weather standing over this coast
//            NOW, and this one about somebody else's weather a thousand
//            kilometres away, whose sea has been piling up outside the coast
//            for days. They are two different questions and the water knows
//            it — a flat blue morning with ten metres rolling under it is a
//            real day and the card can now ask for one.
//   WEATHER  the sky over it: the skies THIS COAST offers (`Biome.weathers`,
//            R19), lightest first — a warm coast has a haze on the ladder
//            where a cold one has none.
//
// THE MODE IS NOT ONE OF THEM, AND IT IS NOT ASKED HERE. Which game is being
// played is the front door's own question (`menu-main.tsx`), because it is
// not a setting on a run: it decides what the shore is FOR, and a door that
// opens onto a card and then asks which game you meant has not answered
// anything. What is left of it here is the card's HEAD, which is titled
// with the game that was chosen — always FREE, since that is the one tile
// this card is behind.
//
// THE CRAFT IS THE SECOND QUESTION AND IT IS NOT ASKED HERE. A shore is a
// seed with a chart under it and an hour is a word that means an hour; a
// craft is a SHAPE, and it takes the card that can show one turning on the
// water (`menu-craft.tsx`) — which is also where RIDE lives, because the
// last thing a rider does before the water should be looking at the hull
// they are about to ride. This card's way on is that card.
//
// WAVES DEFERS TO NOBODY, WHICH IS WHY IT IS A ROW AND NOT A RUNG OF WIND.
// R19's agreement is between the wind and the SKY; the groundswell was never
// part of it, because no coast's own wind made it. So the row marks the
// height the shore was dealt and nothing above it moves that mark — where
// choosing a wind re-marks the sky under it, choosing a wind leaves this row
// exactly where the seed left it.
//
// TWO OF THE ROWS ARE FADERS RATHER THAN LADDERS. The wind and the sea
// outside stop being rungs the generator would deal and become figures that
// run past anything it ever would. They can be, because nothing here is
// measured — the row above the fader would be a promise about comparable
// water, and there is nobody to compare with.
//
// WHICH QUARTER THE WIND BLOWS FROM IS NOT A ROW, AND WAS ONE. It is always
// dead onshore now — square on to the average line of the shore, which is
// what `Level.seaHeading` is and what the engine measures a quarter against
// (`new-game.ts`'s `quarterOf` is where the run is given it). The row had to
// go because it was the only one on the card that could silently undo the
// two above it: the quarter is what the FETCH is measured along, so a wind
// turned off the sea has no water at its back and grows nothing, and a rider
// who set forty metres a second and a twenty-metre swell and then dragged
// the quarter round got flat water with no row on the card saying which
// answer had cancelled which. A fader whose own travel can make its
// neighbours mean nothing is not a choice, it is a trap; the sea a free ride
// asks for is now the sea it gets.
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
  BIOME_IDS,
  SEASONS,
  SWELL_DIAL,
  TIMES_OF_DAY,
  type BiomeId,
  type Season,
  type TimeOfDay,
  type Weather,
  biomeOf,
} from "@engine";
import { useState } from "preact/hooks";

import { MenuHead } from "./menu.tsx";
import { Caption, FadeRow, type Hint, NumberRow, StepRow, type Stop } from "./menu-knobs.tsx";
import { SeedPreview, useSeedPreview } from "./seed-preview.tsx";
import {
  DEFAULT_SEED,
  FREE_WIND_RANGE,
  SEED_RANGE,
  skyForWind,
  type Settings,
} from "./settings.ts";
import { STRINGS } from "./strings.ts";

const TIME_LABELS: Record<TimeOfDay, string> = {
  sunrise: STRINGS.timeSunrise,
  day: STRINGS.timeDay,
  sunset: STRINGS.timeSunset,
  night: STRINGS.timeNight,
};

/** The hours in the engine's own order — the arc of a day, which is the order
 * they read as a ladder. NIGHT is the last rung and never the marked one: R13
 * only ever deals a level a daylight hour (`dealtTimeOfDay`). */
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

const WEATHER_LABELS: Record<Weather, string> = {
  clear: STRINGS.skyClear,
  haze: STRINGS.skyHaze,
  high: STRINGS.skyHigh,
  overcast: STRINGS.skyOvercast,
  rain: STRINGS.skyRain,
  squall: STRINGS.skySquall,
};

/** The skies a coast offers, in the ENGINE's order, which is lightest first
 * — the order they read as a ladder, and one this card never restates: a
 * sky added to a biome's chart is a stop here the same day. */
const weatherStops = (biome: BiomeId): Stop<Weather>[] =>
  biomeOf(biome).weathers.map((id) => ({ id, label: WEATHER_LABELS[id] }));

/** The coasts, in the order the engine offers them. */
const COAST_STOPS: Stop<BiomeId>[] = BIOME_IDS.map((id) => ({
  id,
  label: STRINGS.coastName(id),
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
  const [hint, setHint] = useState<Hint | null>(null);
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
  /** A NEW COAST re-reads the sky row against its own chart: a sky the
   * last coast offered and this one does not (a haze on the taiga) is not a
   * stop the row can stand on, so it goes back to deferring. */
  const setCoast = (biome: BiomeId): void =>
    setRide({
      biome,
      weather:
        ride.weather !== null && biomeOf(biome).weathers.includes(ride.weather)
          ? ride.weather
          : null,
    });

  // The day this seed deals ON THIS COAST, off the same reply the chart is
  // drawn from. Null until the first one lands — a level takes hundreds of
  // milliseconds to build — and the last one stays up, dimmed, while the
  // next is being built.
  const chart = useSeedPreview(seed, ride.biome);
  const deal = chart.shown?.ok === true ? chart.shown.deal : null;
  // WHAT THE SKY WOULD BE IF NOBODY TOUCHED IT, which is not always the sky
  // the LEVEL was dealt: a wind chosen on the row above carries its own sky
  // (R19's agreement, kept by `CONDITION_DAY`), and that is the one this row
  // is overriding. So the mark follows the wind while a wind is chosen.
  const dealtWeather = ride.wind === null ? (deal?.weather ?? null) : skyForWind(ride.wind);
  /** What a press means: the marked chip hands the row back to the shore
   * (null), anything else is the override. */
  const pick = <T extends string>(id: T, dealtId: T | null): T | null =>
    id === dealtId ? null : id;

  return (
    <div class="menu-card menu-card-start" onPointerLeave={() => setHint(null)}>
      <MenuHead
        back={onBack}
        backLabel={STRINGS.menuBack}
        /* THE HEAD IS WHERE THE MODE IS NOW — the game is chosen on the
           front door, and a card that never named it would leave a rider who
           pressed TRICKS setting up a shore with no way to tell which of the
           four they are about to ride. THE NAME IS ALL OF IT: the card used
           to carry a line of billing under the title saying what that game
           was, and a sentence explaining a word the player pressed thirty
           seconds ago is a card talking to itself. It cost two rows of head
           on a phone and told nobody anything. */
        title={STRINGS.modeName(ride.mode)}
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
            <StepRow
              label={STRINGS.startCoast}
              hint={STRINGS.startCoastHint}
              stops={COAST_STOPS}
              value={ride.biome}
              onPick={setCoast}
              onHint={setHint}
            />
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
          <p class="start-best start-best-none">{STRINGS.startBestFree}</p>
        </div>
        {/* THE DAY'S ROWS. A measured run rides the day its shore pins, so a
            time on it is a time on the same water for everybody; the free
            ride asks the five questions the generator would otherwise
            answer, three of them as figures (`new-game.ts`'s `dayFor` is the
            other half). */}
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
            {/* THE WIND, as the figure itself: anywhere from a flat calm
                to twice the top of the band R12 deals from.

                A FADER HAS NO "AS DEALT". The worded rows defer to the shore
                and MARK the answer it came with; a figure simply STANDS on
                it — the fader opens at the shore's own wind and moving it
                pins one. That is the same promise the mark makes, with no
                state to explain and nothing on the row but a thumb and a
                reading. Until the chart lands there is no dealt figure to
                stand on, so the fader sits at the foot of its travel for the
                fraction of a second the level takes to build. */}
            <FadeRow
              label={STRINGS.startWind}
              hint={STRINGS.freeWindHint(deal?.wind ?? null)}
              value={ride.wind ?? deal?.wind ?? FREE_WIND_RANGE.min}
              min={FREE_WIND_RANGE.min}
              max={FREE_WIND_RANGE.max}
              step={1}
              read={STRINGS.freeWindValue}
              onChange={(wind) => setRide({ wind })}
              onHint={setHint}
            />
            {/* Under the wind, and NOT under it in the way the sky is: this is
            the sea that came in off the ocean days ago, which the wind here
            neither grew nor can ask for. Anywhere on the scale — and the ends
            are the ENGINE's (`SWELL_DIAL`), never a copy of them. */}
            <FadeRow
              label={STRINGS.startWaves}
              hint={STRINGS.freeWavesHint(deal?.swell ?? null)}
              value={ride.swell ?? deal?.swell ?? SWELL_DIAL.min}
              min={SWELL_DIAL.min}
              max={SWELL_DIAL.max}
              step={0.5}
              read={STRINGS.freeWavesValue}
              onChange={(swell) => setRide({ swell })}
              onHint={setHint}
            />
            {/* Under the wind, because it defers to it: the marked sky here is the
            one the row above implies, not a sky of its own. */}
            <StepRow
              label={STRINGS.startWeather}
              hint={STRINGS.startWeatherHint}
              stops={weatherStops(ride.biome)}
              value={ride.weather ?? dealtWeather}
              dealt={dealtWeather}
              // A wind CHOSEN implies its sky with no level to wait for; only a
              // row still deferring to the shore is provisional.
              pending={ride.wind === null && !chart.fresh}
              onPick={(w) => setRide({ weather: pick(w, dealtWeather) })}
              onHint={setHint}
            />
          </div>
        </div>
      </div>
      {/* The mark is explained ONCE, at the foot of the whole card rather than
          as a tooltip on three rows nobody hovers. */}
      <Caption hint={hint} fallback={STRINGS.freeCaption} />
    </div>
  );
}
