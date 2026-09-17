// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LEVEL CARD — which of the pinned shores a RACE, a TRICKS run or a
// TIME TRIAL is ridden on.
//
// THE GAME HAS TWELVE SHORES AND THEY ARE THE CAMPAIGN'S. A measured run is
// only worth measuring against somebody else's if the two were ridden down
// the same water, and a seed dialled on a card is a shore nobody else has
// ever seen — so the three modes that keep a record book pick a LEVEL here,
// exactly as the sibling rally game's time trial picks one of its stages,
// and the seed row stays where nothing is measured (FREE, `menu-start.tsx`).
//
// WHAT IS OPEN IS WHAT THE CAMPAIGN HAS OPENED, a whole shore at a time
// (`shoreUnlocked`). Not level by level: this is not a second ladder to
// climb, it is the shores you have been given, and a rider who has reached
// the cold coast should be able to time any of it. The warm shore is open
// on a fresh app, so the card is never empty.
//
// A LEVEL RIDES IN THE DISCIPLINE IT WAS CURATED IN and no other
// (`fitsMode`): a race shore takes RACE and TIME TRIAL, a tricks shore
// takes TRICKS. R35's field is laid at BUILD time, so the same seed asked
// for ramps is not always the same shore — riding a race rung "as tricks"
// would be riding a shore the campaign's own box never shows.
//
// The card is the campaign ladder's own silhouette and wears its classes
// (`.menu-shores`, `.menu-levels`, `.menu-level*` in styles.css), because a
// shore should look like itself wherever it is offered. What is INSIDE a
// box differs and is each card's own: the ladder shows what a rung paid —
// the points, the place, the medal — and this shows what the run would BE
// and the best it has ever been ridden in.

import { type GameMode } from "@engine";
import { useState } from "preact/hooks";

import {
  SHORES,
  levelsForMode,
  shoreOf,
  shoreUnlocked,
  type CampaignLevel,
  type CampaignProgress,
  type CampaignShore,
} from "./campaign.ts";
import { Glyph } from "./menu-glyphs.tsx";
import { StepRow, type Stop } from "./menu-knobs.tsx";
import { MenuHead } from "./menu.tsx";
import { classFor } from "./new-game.ts";
import { bestFor, scoresHigher, type RecordBook } from "./records.ts";
import { TRICK_MINUTES, conditionsFor, seaRungFor, type Settings } from "./settings.ts";
import { STRINGS } from "./strings.ts";

const SEASON_WORDS: Record<string, string> = {
  spring: STRINGS.seasonSpring,
  summer: STRINGS.seasonSummer,
  autumn: STRINGS.seasonAutumn,
  winter: STRINGS.seasonWinter,
};
/** R12's three winds, as the card says them — the same table the start
 * card's ladder used to press, read here rather than pressed. */
const WIND_WORDS: Record<string, string> = {
  fine: STRINGS.windCalm,
  windy: STRINGS.windBrisk,
  storm: STRINGS.windStorm,
};
const SKY_WORDS: Record<string, string> = {
  clear: STRINGS.skyClear,
  haze: STRINGS.skyHaze,
  high: STRINGS.skyHigh,
  overcast: STRINGS.skyOvercast,
  rain: STRINGS.skyRain,
  squall: STRINGS.skySquall,
};

/** THE DAY a level pins, on one line under its name — the hour, the season,
 * the sky, the wind and the sea outside. Stated here and read by the
 * campaign's ladder too: a rung and the same shore offered for a time trial
 * must not be able to disagree about what day it is. */
export function dayLine(level: CampaignLevel): string {
  return STRINGS.campaignDay(
    level.hour,
    SEASON_WORDS[level.season] ?? level.season,
    SKY_WORDS[level.weather] ?? level.weather,
    STRINGS.windAt(WIND_WORDS[conditionsFor(level.wind)], level.wind),
    STRINGS.seaState(seaRungFor(level.swell), level.swell),
  );
}

/** How long a tricks run is, as the row spells it — the ids are the minutes
 * themselves, so the row and the setting are the same number. */
const MINUTE_STOPS: Stop<string>[] = TRICK_MINUTES.map((m) => ({
  id: String(m),
  label: STRINGS.minutes(m),
}));

/** What the run on this box would BE, which is the MODE's billing and not
 * the level's: the same shore is a sprint against eleven or the same sprint
 * alone against the clock, and on a lapped one it is the laps that say how
 * long the afternoon is (R29, R30). */
function billing(level: CampaignLevel, mode: GameMode, minutes: number): string {
  if (mode === "tricks") return `${STRINGS.modeName(mode)} · ${STRINGS.minutes(minutes)}`;
  if (level.laps !== undefined)
    return `${STRINGS.modeName(mode)} · ${STRINGS.campaignLaps(level.laps)}`;
  return STRINGS.modeName(mode);
}

function LevelBox({
  level,
  mode,
  minutes,
  best,
  chosen,
  onPick,
}: {
  level: CampaignLevel;
  mode: GameMode;
  minutes: number;
  /** The best this shore has seen in THIS mode, as the record book reads
   * it, or null where it has never been ridden. */
  best: string | null;
  /** The box the card would ride — where the cursor lands and what the
   * head's RIDE takes. One per card. */
  chosen: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      class={`menu-level menu-level-open${chosen ? " menu-level-next" : ""}`}
      aria-current={chosen ? "step" : undefined}
      data-nav-next={chosen ? "" : undefined}
      data-nav-focus={chosen ? "" : undefined}
      onClick={onPick}
    >
      <span class="menu-level-head">
        <Glyph name={mode === "tricks" ? "air" : "flag"} className="menu-level-mode" />
        <span class="menu-level-billing">{billing(level, mode, minutes)}</span>
      </span>
      <span class="menu-level-name">{level.name}</span>
      <span class="menu-level-day">{dayLine(level)}</span>
      <span class="menu-level-marks">
        <span class={`menu-level-mark${best === null ? "" : " menu-level-mark-lit"}`}>
          {best ?? STRINGS.levelsNoBest}
        </span>
      </span>
    </button>
  );
}

/** The shore banners across the top: a press each, the one being looked at
 * lit, a shut one wearing its padlock and saying what opens it. */
function ShoreTabs({
  shown,
  mode,
  progress,
  onShow,
}: {
  shown: CampaignShore;
  mode: GameMode;
  progress: CampaignProgress;
  onShow: (shore: CampaignShore) => void;
}) {
  return (
    <div class="menu-shores">
      {SHORES.map((shore) => {
        const open = shoreUnlocked(shore, progress);
        return (
          <button
            key={shore.id}
            type="button"
            class={`menu-shore${shore === shown ? " menu-shore-shown" : ""}${open ? "" : " menu-shore-locked"}`}
            title={open ? shore.blurb : STRINGS.levelsShoreLocked}
            aria-pressed={shore === shown}
            onClick={() => onShow(shore)}
          >
            <span class="menu-shore-name">
              {!open && <Glyph name="lock" />}
              {STRINGS.coastName(shore.id)}
            </span>
            <span class="menu-shore-line">
              {open
                ? STRINGS.levelsShoreCount(levelsForMode(shore, mode).length)
                : STRINGS.campaignShoreShut}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** The furthest shore the campaign has opened — where the card opens, the
 * same rule the ladder's own tabs follow. */
function reachedShore(progress: CampaignProgress): CampaignShore {
  let reached = SHORES[0];
  for (const shore of SHORES) if (shoreUnlocked(shore, progress)) reached = shore;
  return reached;
}

export function LevelsPage({
  settings,
  records,
  progress,
  onSettings,
  onBack,
  onNext,
}: {
  settings: Settings;
  /** The record book, for the figure on each box. */
  records: RecordBook;
  /** The campaign's board — what is open here is what it has opened. */
  progress: CampaignProgress;
  onSettings: (settings: Settings) => void;
  onBack: () => void;
  /** On to the craft card, which is where RIDE is — the same second half
   * every way onto the water ends with. */
  onNext: () => void;
}) {
  const mode = settings.ride.mode;
  const [shown, setShown] = useState<CampaignShore>(() => reachedShore(progress));
  const minutes = settings.ride.tricksMinutes;
  const open = shoreUnlocked(shown, progress) ? levelsForMode(shown, mode) : [];
  // WHICH BOX THE CARD WOULD RIDE: the one the settings already stand on
  // where it is here and open, and otherwise the first of them. Never null
  // while a shore is open, so the head always has a way on.
  const chosen = open.find((level) => level.id === settings.ride.level) ?? open[0] ?? null;

  const pick = (level: CampaignLevel): void => {
    onSettings({ ...settings, ride: { ...settings.ride, level: level.id } });
    onNext();
  };
  const bestOn = (level: CampaignLevel): string | null => {
    const row = bestFor(records, {
      mode,
      biome: shoreOf(level).id,
      seed: level.seed,
      track: level.track,
      speedClass: classFor(settings),
      minutes,
    });
    if (row === null) return null;
    return scoresHigher(mode)
      ? STRINGS.startBestScore(row.value, row.craft)
      : STRINGS.startBestTime(row.value, row.craft);
  };

  return (
    <div class="menu-card menu-card-levels">
      <MenuHead
        back={onBack}
        backLabel={STRINGS.menuBack}
        title={STRINGS.modeName(mode)}
        action={
          chosen ? (
            <button
              type="button"
              class="menu-item menu-item-start menu-head-go"
              data-menu="craft"
              onClick={() => pick(chosen)}
            >
              <span class="menu-item-name">{STRINGS.campaignRide}</span>
            </button>
          ) : undefined
        }
      />
      <ShoreTabs shown={shown} mode={mode} progress={progress} onShow={setShown} />
      {/* THE ONE ROW THAT IS NOT A SHORE, and only one mode has it: how many
          minutes the buzzer is set for. It stands above the boxes because it
          is part of what every box on the card would be, and it is on the
          boxes' own billing for the same reason. */}
      {mode === "tricks" && (
        <div class="knob-rows">
          <StepRow
            label={STRINGS.startMinutes}
            hint={STRINGS.startMinutesHint}
            stops={MINUTE_STOPS}
            value={String(minutes)}
            onPick={(m) =>
              onSettings({ ...settings, ride: { ...settings.ride, tricksMinutes: Number(m) } })
            }
          />
        </div>
      )}
      {open.length === 0 ? (
        <p class="menu-empty">{STRINGS.levelsShoreLocked}</p>
      ) : (
        <div class="menu-levels">
          {open.map((level) => (
            <LevelBox
              key={level.id}
              level={level}
              mode={mode}
              minutes={minutes}
              best={bestOn(level)}
              chosen={level === chosen}
              onPick={() => pick(level)}
            />
          ))}
        </div>
      )}
      <p class="menu-shore-blurb">{STRINGS.levelsCaption}</p>
    </div>
  );
}
