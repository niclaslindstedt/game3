// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CAMPAIGN CARD — two shores, six boxes each, and the table under the
// one being looked at.
//
// The card is one column: the shore's banner (its name, how far the table
// has got, or a padlock and why), the six boxes in a grid, then the table.
// A BOX is a number, a name, what the level is (a race over a distance or
// laps, a tricks run over minutes) and what has been got out of it — the
// best place and the points it pays, the best figure, the medal — with the
// day it pins on one line under the name, because the day is half of what
// a rung asks. Shut, it is the number and a padlock, and the reason is
// its accessible name.
//
// THE RING is on the box the campaign would pick next (`continueAt`):
// where the cursor lands, and what CONTINUE in the head takes, so a pad
// walks INTO the campaign rather than back to the first box every time.
//
// Which shore is being looked at is the card's own state and nothing the
// game remembers: it opens on the furthest shore the campaign has reached,
// which is where a returning player wants to be.

import { RACE } from "@engine";
import { useState } from "preact/hooks";

import { formatTime } from "../lib/util.ts";
import {
  MEDALS,
  PLAYER_ID,
  POINTS,
  SHORES,
  continueAt,
  levelUnlocked,
  levelsRidden,
  playerStanding,
  shoreStandings,
  shoreUnlocked,
  shoreWon,
  type CampaignLevel,
  type CampaignProgress,
  type CampaignShore,
} from "./campaign.ts";
import { MenuHead } from "./menu.tsx";
import { Glyph } from "./menu-glyphs.tsx";
import { STRINGS } from "./strings.ts";

const SEASON_WORDS: Record<string, string> = {
  spring: STRINGS.seasonSpring,
  summer: STRINGS.seasonSummer,
  autumn: STRINGS.seasonAutumn,
  winter: STRINGS.seasonWinter,
};
const SKY_WORDS: Record<string, string> = {
  clear: STRINGS.skyClear,
  haze: STRINGS.skyHaze,
  high: STRINGS.skyHigh,
  overcast: STRINGS.skyOvercast,
  rain: STRINGS.skyRain,
  squall: STRINGS.skySquall,
};

/** A level's billing without building it: laps on a circuit, minutes on a
 * tricks run, otherwise the mode's word. The distance is the shore's own
 * and would cost a build to quote, so a coast race says what it is. */
function billing(level: CampaignLevel): string {
  if (level.mode === "tricks")
    return `${STRINGS.modeName("tricks")} · ${STRINGS.minutes(level.minutes ?? 0)}`;
  if (level.laps !== undefined)
    return `${STRINGS.modeName("race")} · ${STRINGS.campaignLaps(level.laps)}`;
  return STRINGS.modeName("race");
}

function dayLine(level: CampaignLevel): string {
  return STRINGS.campaignDay(
    level.hour,
    SEASON_WORDS[level.season] ?? level.season,
    SKY_WORDS[level.weather] ?? level.weather,
    level.wind,
    level.swell,
  );
}

function LevelBox({
  level,
  index,
  open,
  next,
  progress,
  onRide,
}: {
  level: CampaignLevel;
  index: number;
  open: boolean;
  next: boolean;
  progress: CampaignProgress;
  onRide: () => void;
}) {
  if (!open) {
    const hint = STRINGS.campaignLevelLocked(level.mode);
    return (
      <div
        class="menu-level menu-level-locked"
        title={hint}
        aria-label={`${index + 1}, locked — ${hint}`}
      >
        <span class="menu-level-no">{index + 1}</span>
        <Glyph name="lock" className="menu-level-lock" />
      </div>
    );
  }
  const result = progress.results[level.id];
  const points = progress.points[level.id]?.[PLAYER_ID];
  const field = RACE.rivals + 1;
  return (
    <button
      type="button"
      class={`menu-level menu-level-open${next ? " menu-level-next" : ""}`}
      aria-current={next ? "step" : undefined}
      data-nav-next={next ? "" : undefined}
      data-nav-focus={next ? "" : undefined}
      onClick={onRide}
    >
      <span class="menu-level-head">
        <span class="menu-level-no">{index + 1}</span>
        <Glyph name={level.mode === "tricks" ? "air" : "flag"} className="menu-level-mode" />
        <span class="menu-level-billing">{billing(level)}</span>
      </span>
      <span class="menu-level-name">{level.name}</span>
      <span class="menu-level-day">{dayLine(level)}</span>
      {level.medals && (
        <span class="menu-level-medals">
          {MEDALS.map((medal) => (
            <span
              key={medal}
              class={`menu-level-medal menu-level-medal-${medal}${result?.medal !== undefined && result.medal !== null && MEDALS.indexOf(result.medal) >= MEDALS.indexOf(medal) ? " menu-level-medal-won" : ""}`}
            >
              {STRINGS.campaignMedalCost(medal, level.medals![medal])}
            </span>
          ))}
        </span>
      )}
      {result && (
        <span class="menu-level-marks">
          {points !== undefined && (
            <span class={`menu-level-mark${points === POINTS[0] ? " menu-level-mark-lit" : ""}`}>
              {STRINGS.campaignPoints(points)}
            </span>
          )}
          <span
            class={`menu-level-mark${result.place <= POINTS.length ? " menu-level-mark-lit" : ""}`}
          >
            {STRINGS.campaignPlace(result.place, field)}
          </span>
          <span class="menu-level-mark">
            {level.mode === "tricks" ? STRINGS.resultScore(result.best) : formatTime(result.best)}
          </span>
        </span>
      )}
    </button>
  );
}

/** THE TABLE — every rider on the shore, the player's row lit. */
function ShoreTable({ shore, progress }: { shore: CampaignShore; progress: CampaignProgress }) {
  const rows = shoreStandings(shore, progress);
  return (
    <div class="menu-table" aria-label={STRINGS.campaignTable}>
      {rows.map((row) => (
        <div key={row.id} class={`menu-table-row${row.you ? " menu-table-you" : ""}`}>
          <span class="menu-table-place">{row.place}</span>
          <span class="menu-table-name">
            {row.you ? STRINGS.campaignYou : STRINGS.campaignRider(Number(row.id.slice(1)))}
          </span>
          <span class="menu-table-wins">{STRINGS.campaignWins(row.wins)}</span>
          <span class="menu-table-points">{STRINGS.campaignPoints(row.points)}</span>
        </div>
      ))}
    </div>
  );
}

/** The shore banners across the top: a press each, the one being looked at
 * lit, a shut one wearing its padlock. */
function ShoreTabs({
  shown,
  progress,
  onShow,
}: {
  shown: CampaignShore;
  progress: CampaignProgress;
  onShow: (shore: CampaignShore) => void;
}) {
  return (
    <div class="menu-shores">
      {SHORES.map((shore) => {
        const open = shoreUnlocked(shore, progress);
        const won = shoreWon(shore, progress);
        return (
          <button
            key={shore.id}
            type="button"
            class={`menu-shore${shore === shown ? " menu-shore-shown" : ""}${open ? "" : " menu-shore-locked"}`}
            title={open ? shore.blurb : STRINGS.campaignShoreLocked}
            aria-pressed={shore === shown}
            onClick={() => onShow(shore)}
          >
            <span class="menu-shore-name">
              {!open && <Glyph name="lock" />}
              {STRINGS.coastName(shore.id)}
            </span>
            <span class="menu-shore-line">
              {open
                ? won
                  ? STRINGS.campaignShoreWon
                  : STRINGS.campaignShoreLine(
                      levelsRidden(shore, progress),
                      shore.levels.length,
                      playerStanding(shore, progress).place,
                    )
                : STRINGS.campaignShoreShut}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** The furthest shore the campaign has opened — where the card opens. */
function reachedShore(progress: CampaignProgress): CampaignShore {
  let reached = SHORES[0];
  for (const shore of SHORES) if (shoreUnlocked(shore, progress)) reached = shore;
  return reached;
}

export function CampaignPage({
  progress,
  onBack,
  onRide,
}: {
  progress: CampaignProgress;
  onBack: () => void;
  /** Stand the level up — the craft card comes first, then the water. */
  onRide: (level: CampaignLevel) => void;
}) {
  const [shown, setShown] = useState<CampaignShore>(() => reachedShore(progress));
  const next = continueAt(shown, progress);
  return (
    <div class="menu-card menu-card-campaign">
      <MenuHead
        back={onBack}
        backLabel={STRINGS.menuBack}
        title={STRINGS.campaign}
        action={
          next ? (
            <button
              type="button"
              class="menu-item menu-item-start menu-head-go"
              data-menu="ride"
              onClick={() => onRide(next)}
            >
              <span class="menu-item-name">{STRINGS.campaignRide}</span>
            </button>
          ) : undefined
        }
      />
      <ShoreTabs shown={shown} progress={progress} onShow={setShown} />
      <p class="menu-shore-blurb">{shown.blurb}</p>
      <div class="menu-levels">
        {shown.levels.map((level, index) => (
          <LevelBox
            key={level.id}
            level={level}
            index={index}
            open={levelUnlocked(shown, index, progress)}
            next={level === next}
            progress={progress}
            onRide={() => onRide(level)}
          />
        ))}
      </div>
      <ShoreTable shore={shown} progress={progress} />
    </div>
  );
}
