// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PAUSE CARD — the one menu you reach from INSIDE a run, by pressing the
// minimap or by pressing Escape. The run holds where it stands (`shell.ts`
// says why this is the one card that freezes) and the card carries the two
// ways on, with a strip of knobs between them:
//
//   RESUME     back to the water, on the very frame it was left.
//   THE STRIP  the handful of settings a rider actually stops mid-run for —
//              the camera you cannot see out of, the readouts in the way of
//              the water, and the frame rate you wanted the moment the ride
//              started stuttering. Every one of them applies to the frame
//              standing behind the card.
//   MAIN MENU  out of the run and back to the front door. Nothing is torn
//              down: the same craft carries on under the bot.
//
// IT IS A STRIP AND NOT THE OPTIONS PAGE, which is the difference between
// this card and the front door's. A picture row is judged against a sea that
// is MOVING — RESOLUTION, DETAIL and WATER are answers to "how does the water
// look while I ride it" — and the one thing this card does is stop it, so
// those rows wait for the menu, where the sea behind the card is still
// running. What is left is the three that are about the FRAME in front of you
// and read perfectly well held still.
//
// The strip also does a second job: it stands between RESUME and MAIN MENU, so
// a thumb aiming for the way back to the water is never one row's travel from
// the press that ends the run.
//
// RESUME IS BOTH THE FIRST ROW AND THE WAY OUT (`data-nav-back`), and it is
// where the cursor lands (`data-nav-focus`). A card opened by a thumb aiming
// for the map has to cost one press to leave. The BACKDROP resumes for the
// same reason.
//
// It wears the front door's own chrome (`.menu` / `.menu-card`) rather than a
// look of its own: it is the same game asking the same kind of question, and
// `menu-nav.ts` already walks anything inside a `.menu-card`. Every word comes
// from strings.ts (§39.1).

import { craftById, type CraftId } from "@engine";

import { CAMERA_STOPS } from "./menu-options.tsx";
import { ON_OFF, StepRow, onOff } from "./menu-knobs.tsx";
import type { Settings } from "./settings.ts";
import { STRINGS } from "./strings.ts";

export function PauseMenu({
  seed,
  craft,
  settings,
  onSettings,
  onResume,
  onMainMenu,
}: {
  /** What the card bills the held run as — read off the run itself rather
   * than off the settings, because a run stood up from a link is a run the
   * settings never named. */
  seed: number;
  craft: CraftId;
  settings: Settings;
  onSettings: (settings: Settings) => void;
  onResume: () => void;
  onMainMenu: () => void;
}) {
  return (
    <div
      class="menu"
      // The backdrop resumes: a card opened by mis-aiming for the minimap must
      // cost one press to leave.
      onPointerDown={onResume}
      role="presentation"
    >
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
        </div>
        {/* The strip. No caption bar under it: this is three rows a rider
            already knows the names of, and a card over a held run is not the
            place to start reading. */}
        <div class="knob-rows menu-pause-knobs">
          <StepRow
            label={STRINGS.optCamera}
            stops={CAMERA_STOPS}
            value={settings.ride.camera}
            onPick={(camera) => onSettings({ ...settings, ride: { ...settings.ride, camera } })}
          />
          <StepRow
            label={STRINGS.optHud}
            stops={ON_OFF}
            value={onOff(settings.hud.on)}
            onPick={(id) => onSettings({ ...settings, hud: { ...settings.hud, on: id === "on" } })}
          />
          <StepRow
            label={STRINGS.optFps}
            stops={ON_OFF}
            value={onOff(settings.hud.fps)}
            onPick={(id) => onSettings({ ...settings, hud: { ...settings.hud, fps: id === "on" } })}
          />
        </div>
        <div class="menu-items">
          {/* The one press here that ends the run, held apart from RESUME by
              the strip above so a thumb aiming for the water cannot land on
              it. */}
          <button type="button" class="menu-item menu-item-leave" onClick={onMainMenu}>
            <span class="menu-item-name">{STRINGS.pauseMainMenu}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
