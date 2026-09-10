// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PAUSE CARD — the one menu you reach from INSIDE a run, by pressing the
// minimap or by pressing Escape. The run holds where it stands (`shell.ts`
// says why this is the one card that freezes) and the card carries the three
// ways on:
//
//   RESUME     back to the water, on the very frame it was left.
//   OPTIONS    the same page the front door has, over the frozen run —
//              which is where the camera you cannot see out of, the HUD in
//              the way of a picture and the picture rows themselves are
//              actually wanted, with the frame still standing behind them.
//   MAIN MENU  out of the run and back to the front door. Nothing is torn
//              down: the same craft carries on under the bot.
//
// RESUME IS BOTH THE FIRST ROW AND THE WAY OUT (`data-nav-back`), and it is
// where the cursor lands (`data-nav-focus`). A card opened by a thumb aiming
// for the map has to cost one press to leave, and the row under it hands the
// run back to the bot — so the cursor must never start there. The BACKDROP
// resumes for the same reason.
//
// It wears the front door's own chrome (`.menu` / `.menu-card`) rather than
// a look of its own: it is the same game asking the same kind of question,
// and `menu-nav.ts` already walks anything inside a `.menu-card`. Every word
// comes from strings.ts (§39.1).

import { craftById, type CraftId } from "@engine";

import { OptionsPage } from "./menu-options.tsx";
import type { Settings } from "./settings.ts";
import { STRINGS } from "./strings.ts";

/** Which page of the pause surface is up. The same shape as the front
 * door's `MenuPage`, and for the same reason: there is no URL to keep in
 * step and the whole thing is one component tree over one canvas. */
export type PausePage = "root" | "options";

export function PauseMenu({
  page,
  seed,
  craft,
  settings,
  onSettings,
  onNavigate,
  onResume,
  onMainMenu,
}: {
  page: PausePage;
  /** What the card bills the held run as — read off the run itself rather
   * than off the settings, because a run stood up from a link is a run the
   * settings never named. */
  seed: number;
  craft: CraftId;
  settings: Settings;
  onSettings: (settings: Settings) => void;
  onNavigate: (page: PausePage) => void;
  onResume: () => void;
  onMainMenu: () => void;
}) {
  return (
    <div
      class="menu"
      // The backdrop resumes — but only from the card that has no other way
      // back. The options page under it has its own, and a stray press
      // there should not throw the player onto the water mid-thought.
      onPointerDown={page === "root" ? onResume : undefined}
      role="presentation"
    >
      {page === "root" && (
        <div
          class="menu-card menu-card-pause"
          onPointerDown={(e) => e.stopPropagation()}
          role="presentation"
        >
          <div class="menu-pause-head">
            <div class="menu-title">{STRINGS.pauseTitle}</div>
            <div class="menu-sub">{STRINGS.pauseSub(seed, craftById(craft).name)}</div>
          </div>
          <div class="menu-items">
            <button
              type="button"
              class="menu-item menu-item-start"
              data-nav-back
              data-nav-focus
              onClick={onResume}
            >
              <span class="menu-item-name">{STRINGS.pauseResume}</span>
            </button>
            <button type="button" class="menu-item" onClick={() => onNavigate("options")}>
              <span class="menu-item-name">{STRINGS.menuOptions}</span>
            </button>
            {/* The one press here that ends the run, held apart from the two
                above it so a thumb aiming for RESUME cannot land on it. */}
            <button type="button" class="menu-item menu-item-leave" onClick={onMainMenu}>
              <span class="menu-item-name">{STRINGS.pauseMainMenu}</span>
            </button>
          </div>
        </div>
      )}
      {/* The front door's own options page, unchanged — one camera row and
          one set of picture rows, wherever they are asked from. Only the way
          back reads differently, because from here it is not the menu. */}
      {page === "options" && (
        <OptionsPage
          settings={settings}
          onSettings={onSettings}
          onBack={() => onNavigate("root")}
          backLabel={STRINGS.pauseBack}
        />
      )}
    </div>
  );
}
