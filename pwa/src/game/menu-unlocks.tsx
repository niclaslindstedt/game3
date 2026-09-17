// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// DEVELOPER ▸ UNLOCKS — the campaign's progress as something to SET rather
// than to earn.
//
// The ladder costs evenings: twelve levels, each one behind a podium or a
// medal on the one before it, and a shore behind a table won outright. That
// is the right price for a player and the wrong one for anybody who has to
// LOOK at the last rung — a shore's banner, a circuit's boxes, the plate at
// the end of the arctic finale — which is every review pass this game has.
// So every shore is offered both ways, plus the two presses that take the
// whole ladder at once: a state four evenings away is one press, and the
// state that used to cost clearing the browser's storage is another.
//
// EVERY DECISION IS `campaign.ts`'s, not this card's. What a grant writes,
// what a lock takes away, which press still has anything left to do — all of
// it is `unlockShores` / `lockShores` / `unlockRows`, storage-free and read
// by `tests/campaign_test.ts`. This file is the markup over those answers,
// which is the same split every other card here is built on.
//
// THE PAGE IS A PAGE and not a row on the developer card, for the reason the
// keyboard is a page behind OPTIONS: it is one question asked once per shore,
// and the answers do not fit beside a fader without pushing the tools that
// ARE settings off the card.

import {
  campaignStanding,
  lockShores,
  unlockRows,
  unlockShores,
  type CampaignProgress,
} from "./campaign.ts";
import { MenuHead } from "./menu.tsx";
import { STRINGS } from "./strings.ts";

export function UnlocksPage({
  progress,
  onProgress,
  onBack,
}: {
  progress: CampaignProgress;
  onProgress: (progress: CampaignProgress) => void;
  onBack: () => void;
}) {
  const rows = unlockRows(progress);
  const { cleared, of } = campaignStanding(progress);
  // Both whole-ladder presses read the row model rather than the board a
  // second time: UNLOCK EVERYTHING is spent when the LAST shore's unlock is
  // (it reads over every shore there is), and LOCK EVERYTHING when the
  // FIRST shore's lock is, for the same reason in reverse.
  const allWon = rows[rows.length - 1]?.won ?? false;
  const allShut = rows[0]?.shut ?? true;
  return (
    <div class="menu-card menu-card-options">
      <MenuHead back={onBack} backLabel={STRINGS.menuDeveloper} title={STRINGS.unlocksTitle} />
      <div class="menu-sub">{STRINGS.unlocksLine(cleared, of)}</div>
      <button
        type="button"
        class="menu-item menu-item-dev"
        disabled={allWon}
        onClick={() => onProgress(unlockShores(progress, null))}
      >
        {STRINGS.unlocksAll}
        <span class="menu-item-sub">{STRINGS.unlocksAllHint(allWon)}</span>
      </button>
      <button
        type="button"
        class="menu-item menu-item-dev"
        disabled={allShut}
        onClick={() => onProgress(lockShores(progress, null))}
      >
        {STRINGS.unlocksNone}
        <span class="menu-item-sub">{STRINGS.unlocksNoneHint(allShut)}</span>
      </button>
      <div class="menu-sub">{STRINGS.unlocksRule}</div>
      <div class="dev-locks">
        {rows.map((row) => (
          <div class="dev-lock" key={row.shore.id}>
            <span class="dev-lock-text">
              <b>{row.shore.name.toUpperCase()}</b>
              <span class="menu-item-sub">
                {STRINGS.unlocksShoreLine(row.cleared, row.of, row.open)}
              </span>
            </span>
            <button
              type="button"
              class="menu-item menu-item-dev dev-lock-act"
              disabled={row.won}
              title={STRINGS.unlocksOpenHint(row.shore.name)}
              onClick={() => onProgress(unlockShores(progress, row.shore.id))}
            >
              {STRINGS.unlocksOpen}
            </button>
            <button
              type="button"
              class="menu-item menu-item-dev dev-lock-act"
              disabled={row.shut}
              title={STRINGS.unlocksShutHint(row.shore.name)}
              onClick={() => onProgress(lockShores(progress, row.shore.id))}
            >
              {STRINGS.unlocksShut}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
