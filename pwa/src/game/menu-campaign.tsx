// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CAMPAIGN CARD — two shores, six boxes each, and the table under the
// one being looked at.
//
// IT IS TWO STEPS: WHICH COAST, then its ladder. The coast is asked on a page
// of its own (`menu-shores.tsx`) — a row the width of the card, with a
// photograph of the place behind it — because a shore is a PLACE and a tab
// two words wide could never say so; and the boxes under it then get the
// height the tabs were spending. CONTINUE stays in the head of the coast
// step all the same: it is the press that walks a returning player back into
// the rung they stopped on, and making them choose a coast first to find it
// would be the one press the card exists to save.
//
// The card is one column: the six boxes in a grid, then the table.
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
// game remembers: the coast step marks the furthest shore the campaign has
// reached, which is where a returning player wants to be.

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
import { dayLine } from "./menu-levels.tsx";
import { CourseMap, ShoreList } from "./menu-shores.tsx";
import { STRINGS } from "./strings.ts";

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
        <CourseMap levelId={level.id} />
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
      <CourseMap levelId={level.id} />
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

/** The furthest shore the campaign has opened — where the coast step puts
 * the cursor, and the shore CONTINUE walks back into. */
function reachedShore(progress: CampaignProgress): CampaignShore {
  let reached = SHORES[0];
  for (const shore of SHORES) if (shoreUnlocked(shore, progress)) reached = shore;
  return reached;
}

/** What a shore's row says it has given up so far: won outright, how far its
 * table has got, or what opens it. */
function shoreLine(shore: CampaignShore, progress: CampaignProgress): string {
  if (shoreWon(shore, progress)) return STRINGS.campaignShoreWon;
  return STRINGS.campaignShoreLine(
    levelsRidden(shore, progress),
    shore.levels.length,
    playerStanding(shore, progress).place,
  );
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
  // WHICH STEP THE CARD IS ON: null is the coast, a shore is its ladder.
  const [shown, setShown] = useState<CampaignShore | null>(null);
  const reached = reachedShore(progress);
  const next = continueAt(shown ?? reached, progress);
  const ride = next ? (
    <button
      type="button"
      class="menu-item menu-item-start menu-head-go"
      data-menu="ride"
      onClick={() => onRide(next)}
    >
      <span class="menu-item-name">{STRINGS.campaignRide}</span>
    </button>
  ) : undefined;

  // THE COAST STEP — and CONTINUE still in its head, standing on the rung
  // the furthest shore has reached. See the file's header.
  if (shown === null) {
    return (
      <div class="menu-card menu-card-campaign">
        <MenuHead
          back={onBack}
          backLabel={STRINGS.menuBack}
          title={STRINGS.campaign}
          action={ride}
        />
        <ShoreList
          open={(shore) => shoreUnlocked(shore, progress)}
          hint={() => STRINGS.campaignShoreLocked}
          line={(shore) => shoreLine(shore, progress)}
          next={reached}
          onPick={setShown}
        />
      </div>
    );
  }

  return (
    <div class="menu-card menu-card-campaign">
      {/* BACK steps within the card before it leaves it — the level card's
          own rule, and the same two presses in reverse. */}
      <MenuHead
        back={() => setShown(null)}
        backLabel={STRINGS.campaign}
        title={STRINGS.coastName(shown.id)}
        action={ride}
      />
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
