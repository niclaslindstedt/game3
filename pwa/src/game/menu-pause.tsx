// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PAUSE CARD — the one menu you reach from INSIDE a run, by pressing the
// minimap or by pressing Escape. The run holds where it stands (`shell.ts`
// says why this is the one card that freezes) and the card carries three ways
// on and nothing else:
//
//   RESUME     back to the water, on the very frame it was left.
//   OPTIONS    the handful of settings a rider actually stops mid-run for,
//              ON A PANEL OF THEIR OWN rather than inline under RESUME.
//   MAIN MENU  out of the run and back to the front door. Nothing is torn
//              down: the same craft carries on under the bot.
//
// THE SETTINGS ARE BEHIND A DOOR, NOT SPREAD ACROSS THE CARD. They were four
// rows standing between RESUME and MAIN MENU, and four knobs are four things
// to read past on a card whose entire job is to be left again — the reason
// nine people in ten open it is RESUME, and every row above that press is a
// row in the way of it. One word costs the card one row and says exactly as
// much, which is what lets the three presses this card is actually for stand
// at the size they deserve.
//
// IT IS STILL NOT THE OPTIONS PAGE, which is the difference between this
// panel and the front door's. A picture row is judged against a sea that is
// MOVING — RESOLUTION, DETAIL and WATER are answers to "how does the water
// look while I ride it" — and the one thing this card does is stop it, so
// those rows wait for the menu, where the sea behind the card is still
// running. What is here is the four that are about the FRAME in front of you
// and read perfectly well held still: the sound, where the eye rides, and the
// two readouts over the water.
//
// OPTIONS ALSO DOES THE JOB THE STRIP DID: it stands between RESUME and MAIN
// MENU, so a thumb aiming for the way back to the water is never one row's
// travel from the press that ends the run.
//
// EACH PANEL OWNS ITS OWN WAY OUT, and the way out is one press deep at all
// times. On the card that is RESUME (`data-nav-back`, and where the cursor
// lands — `data-nav-focus`): a card opened by a thumb aiming for the map has
// to cost one press to leave. On the panel it is the head's ‹ back to the
// card. The BACKDROP follows whichever is up, so Escape, the backdrop and the
// cursor's own way out are always the same step.
//
// It wears the front door's own chrome (`.menu` / `.menu-card`) rather than a
// look of its own: it is the same game asking the same kind of question, and
// `menu-nav.ts` already walks anything inside a `.menu-card`. Every word comes
// from strings.ts (§39.1).

import { craftById, type CraftId } from "@engine";
import { useState } from "preact/hooks";

import { CAMERA_STOPS, SoundRow } from "./menu-options.tsx";
import { Caption, type Hint, KnobGroup, ON_OFF, StepRow, onOff } from "./menu-knobs.tsx";
import { MenuHead } from "./menu.tsx";
import type { Settings } from "./settings.ts";
import { STRINGS } from "./strings.ts";

/** The pause card's OPTIONS panel: the same rows the front door carries, in
 * the same groups under the same marks, minus every row that would have to be
 * judged against water that is moving. It keeps the caption bar — a rider who
 * has stopped mid-run is exactly the one with a moment to read what a row
 * does, and the held frame behind the card is what the answer shows up on. */
function PauseOptions({
  settings,
  onSettings,
  onBack,
}: {
  settings: Settings;
  onSettings: (settings: Settings) => void;
  onBack: () => void;
}) {
  const [hint, setHint] = useState<Hint | null>(null);
  return (
    <div
      class="menu-card menu-card-pause menu-card-pause-options"
      onPointerDown={(e) => e.stopPropagation()}
      onPointerLeave={() => setHint(null)}
      role="presentation"
    >
      <MenuHead back={onBack} backLabel={STRINGS.pauseBack} title={STRINGS.menuOptions} />
      <div class="knob-groups">
        <KnobGroup title={STRINGS.optRiding} glyph="eye">
          <StepRow
            label={STRINGS.optCamera}
            hint={STRINGS.optCameraHint}
            stops={CAMERA_STOPS}
            value={settings.ride.camera}
            onPick={(camera) => onSettings({ ...settings, ride: { ...settings.ride, camera } })}
            onHint={setHint}
          />
        </KnobGroup>
        <KnobGroup title={STRINGS.optHudGroup} glyph="gauge">
          <StepRow
            label={STRINGS.optHud}
            hint={STRINGS.optHudHint}
            stops={ON_OFF}
            value={onOff(settings.hud.on)}
            onPick={(id) => onSettings({ ...settings, hud: { ...settings.hud, on: id === "on" } })}
            onHint={setHint}
          />
          <StepRow
            label={STRINGS.optFps}
            hint={STRINGS.optFpsHint}
            stops={ON_OFF}
            value={onOff(settings.hud.fps)}
            onPick={(id) => onSettings({ ...settings, hud: { ...settings.hud, fps: id === "on" } })}
            onHint={setHint}
          />
        </KnobGroup>
        <KnobGroup title={STRINGS.optSoundGroup} glyph="speaker">
          <SoundRow settings={settings} onSettings={onSettings} onHint={setHint} />
        </KnobGroup>
      </div>
      <Caption hint={hint} fallback={STRINGS.pauseOptionsCaption} />
    </div>
  );
}

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
  // Which of the card's two faces is up. Local, and dropped the moment the
  // card is: a panel is not somewhere a run can be left standing, and coming
  // back to a held run should cost the same one press it cost last time.
  const [options, setOptions] = useState(false);
  return (
    <div
      class="menu"
      // The backdrop presses whatever the card's own way out is: one step
      // back off the panel, and off the card back to the water. A card opened
      // by mis-aiming for the minimap must cost one press to leave.
      onPointerDown={() => (options ? setOptions(false) : onResume())}
      role="presentation"
    >
      {options ? (
        <PauseOptions
          settings={settings}
          onSettings={onSettings}
          onBack={() => setOptions(false)}
        />
      ) : (
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
            {/* Between the two, so a thumb aiming for the water cannot land
                on the press that ends the run. */}
            <button type="button" class="menu-item" onClick={() => setOptions(true)}>
              <span class="menu-item-name">{STRINGS.pauseOptions}</span>
            </button>
          </div>
          <div class="menu-items">
            <button type="button" class="menu-item menu-item-leave" onClick={onMainMenu}>
              <span class="menu-item-name">{STRINGS.pauseMainMenu}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
