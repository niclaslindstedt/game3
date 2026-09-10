// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE START CARD — the one question between the front door and the water:
// what is this run?
//
// FOUR ROWS, AND NOT ONE MORE. A card standing between a player and a game
// they have already said yes to earns its place only if every row on it
// changes the ride they are about to have, so it asks the four things that
// do and leaves everything else to OPTIONS:
//
//   CRAFT    which hull. The one row here that does NOT ask its question:
//            a craft is a shape, and four names in a chip row asks a rider
//            to choose between four hulls they have never seen. So the row
//            reads back the craft and opens the card that shows it turning
//            on the water (`menu-craft.tsx`).
//   SHORE    which seed, with the coast it makes drawn underneath: the
//            schematic is the row, because a number nobody can picture is
//            not a choice.
//   TIME     sunrise, day or sunset — resolved by the ENGINE against this
//            coast's own daylight window (`hourOfDay`), never as three
//            hours written down here.
//   WEATHER  fine, wind or storm: one word covering the sky AND the sea,
//            because R19 deals a level's sky off the wind that grew its
//            waves and splitting them would hand that agreement back.
//
// EVERY ROW DEFAULTS TO THE SHORE'S OWN. A generated level is a whole day,
// and a card that arrived with an opinion about any of it would quietly take
// that away from every player who never touched it.
//
// The rows are `menu.tsx`'s, shared with OPTIONS and the developer page, and
// what they WRITE is `settings.ride` — so a run stood up from here and a run
// stood up from a link are the same run read the same way.

import { craftById, TIMES_OF_DAY, type TimeOfDay } from "@engine";

import { MenuBody, MenuHead, OptionRow, PageRow, StepRow } from "./menu.tsx";
import { SeedPreview } from "./seed-preview.tsx";
import { CONDITIONS, DEFAULT_SEED, type Conditions, type Settings } from "./settings.ts";
import { STRINGS } from "./strings.ts";

/** What null means on every row here: the shore rides as it was dealt. */
const OWN = "own";

const TIME_LABELS: Record<TimeOfDay, string> = {
  sunrise: STRINGS.timeSunrise,
  day: STRINGS.timeDay,
  sunset: STRINGS.timeSunset,
};

/** The hours in the engine's own order — earliest first, which is the order
 * they read as a ladder. */
const TIME_OPTIONS: readonly { id: TimeOfDay | typeof OWN; label: string }[] = [
  { id: OWN, label: STRINGS.startOwn },
  ...TIMES_OF_DAY.map((id) => ({ id, label: TIME_LABELS[id] })),
];

const CONDITION_LABELS: Record<Conditions, string> = {
  fine: STRINGS.weatherFine,
  windy: STRINGS.weatherWind,
  storm: STRINGS.weatherStorm,
};

const CONDITION_OPTIONS: readonly { id: Conditions | typeof OWN; label: string }[] = [
  { id: OWN, label: STRINGS.startOwn },
  ...CONDITIONS.map((id) => ({ id, label: CONDITION_LABELS[id] })),
];

export function StartPage({
  settings,
  onSettings,
  onBack,
  onCraft,
  onRide,
}: {
  settings: Settings;
  onSettings: (settings: Settings) => void;
  onBack: () => void;
  /** Open the craft card — the one row here that is a way on rather than a
   * question (see this module's header). */
  onCraft: () => void;
  onRide: () => void;
}) {
  const ride = settings.ride;
  const setRide = (patch: Partial<Settings["ride"]>): void =>
    onSettings({ ...settings, ride: { ...ride, ...patch } });
  const seed = ride.seed ?? DEFAULT_SEED;

  return (
    <div class="menu-card">
      <MenuHead
        back={onBack}
        backLabel={STRINGS.menuBack}
        title={STRINGS.startTitle}
        sub={STRINGS.startSub}
      />
      <MenuBody>
        <PageRow
          label={STRINGS.optCraft}
          read={craftById(ride.craft).name.toUpperCase()}
          onOpen={onCraft}
        />
        <StepRow
          label={STRINGS.startShore}
          read={String(seed)}
          // Never below 1: seed 0 is not a level, and an arrow that walks off
          // the bottom of the catalog is an arrow that hangs the card.
          onStep={(by) => setRide({ seed: Math.max(1, seed + by) })}
          onClear={() => setRide({ seed: null })}
          clearLabel={`${STRINGS.startShore} ${STRINGS.startOwn}`}
        />
        {/* The coast that seed makes, cut from the real generated level —
            the row above is a number, and this is what the number means. */}
        <SeedPreview seed={seed} />
        <OptionRow
          label={STRINGS.startTime}
          options={TIME_OPTIONS}
          value={ride.time ?? OWN}
          onPick={(time) => setRide({ time: time === OWN ? null : time })}
        />
        <OptionRow
          label={STRINGS.startWeather}
          options={CONDITION_OPTIONS}
          value={ride.conditions ?? OWN}
          onPick={(c) => setRide({ conditions: c === OWN ? null : c })}
        />
        {/* The way on, wearing the front door's own START weight so the eye
            lands on it first — and marked as this surface's `next`, so a
            controller that walked in here can ride without hunting for it. */}
        <button
          type="button"
          class="menu-item menu-item-start menu-start-go"
          data-menu="ride"
          data-nav-next
          data-nav-focus
          onClick={onRide}
        >
          <span class="menu-item-name">{STRINGS.startGo}</span>
        </button>
      </MenuBody>
    </div>
  );
}
