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
// ...and a fourth that is only there when there is something to offer: WATCH
// REPLAY, the run so far put back on the water with nobody riding it
// (`replay.ts`). It stands BETWEEN the two — under OPTIONS, over the door —
// because it is the one row here nobody would think to look for, and it says
// what it costs ON THE ROW, out at the end of its own line: watching a
// recording ends the run it is a recording of, and that is not something to
// discover after the press.
//
// THE ROWS ARE READ BY THEIR MARKS (`menu-glyphs.tsx`), the front door's
// habit brought to the one card reached from inside a run. A rider who has
// stopped mid-ride is looking for ONE of four presses and knows which before
// they have read anything, so a column of four identical word-only slabs
// makes them read all four to find it. The play triangle, the faders, the
// two wedges and the door are each found without reading — and the marks are
// also what lets the rows come DOWN to a single line apiece, which is the
// height the figures below the head are paid for out of.
//
// AND THE RUN ITSELF IS BILLED (`pause-stats.ts`): four figures under the
// head, the run's own high-water marks first. The HUD is still up behind
// this card, so the strip deliberately leads with what the corner behind it
// CANNOT hold — the longest flight, the furthest jump, the highest the hull
// has been, each of which the HUD can only flash for a moment because a
// rider at speed cannot read a number that is not happening now.
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

import { craftById } from "@engine";
import { useState } from "preact/hooks";

import { CAMERA_STOPS, SoundRow } from "./menu-options.tsx";
import { Caption, type Hint, KnobGroup, ON_OFF, StepRow, onOff } from "./menu-knobs.tsx";
import { Glyph } from "./menu-glyphs.tsx";
import { MenuHead } from "./menu.tsx";
import { pauseStats } from "./pause-stats.ts";
import type { Settings } from "./settings.ts";
import type { HudSnapshot } from "./snapshot.ts";
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
  snap,
  settings,
  onSettings,
  onResume,
  onReplay,
  onMainMenu,
}: {
  /** THE HELD RUN, as the HUD behind this card reads it (`snapshot.ts`) —
   * which is what the card bills it by. Off the RUN rather than off the
   * settings, because a run stood up from a link is a run the settings
   * never named; and the whole snapshot rather than the three fields this
   * card happens to want, because the figures under the head are chosen
   * from it by rule (`pause-stats.ts`) and the rule is free to want a
   * fourth. */
  snap: HudSnapshot;
  settings: Settings;
  onSettings: (settings: Settings) => void;
  onResume: () => void;
  /** Watch the run so far — null on a run that keeps no recording (a free
   * ride, a staged scene), so the card never grows a row that does nothing. */
  onReplay: (() => void) | null;
  onMainMenu: () => void;
}) {
  // Which of the card's two faces is up. Local, and dropped the moment the
  // card is: a panel is not somewhere a run can be left standing, and coming
  // back to a held run should cost the same one press it cost last time.
  const [options, setOptions] = useState(false);
  const stats = pauseStats(snap);
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
            <div class="menu-sub">{STRINGS.pauseSub(snap.seed, craftById(snap.craft).name)}</div>
          </div>
          {/* HOW THE RUN HAS GONE, in one row across. The figure over its
              caption, the HUD's own arrangement, because a rider reading
              this card has just been reading those chips. */}
          {stats.length > 0 && (
            <div class="pause-stats">
              {stats.map((stat) => (
                <div class="pause-stat" key={stat.key}>
                  <span class="pause-stat-value">{stat.value}</span>
                  <span class="pause-stat-label">{stat.label}</span>
                </div>
              ))}
            </div>
          )}
          <div class="menu-items">
            <button
              type="button"
              class="menu-item menu-item-start"
              data-nav-back
              data-nav-focus
              onClick={onResume}
            >
              <Glyph name="play" />
              <span class="menu-item-name">{STRINGS.pauseResume}</span>
            </button>
            {/* Second, so a thumb aiming for the water cannot land on the
                press that ends the run — and second in the DOM as well,
                which is what `--surface pauseOptions` reaches for. */}
            <button type="button" class="menu-item" onClick={() => setOptions(true)}>
              <Glyph name="sliders" />
              <span class="menu-item-name">{STRINGS.pauseOptions}</span>
            </button>
            {/* THE ROW NOBODY GOES LOOKING FOR, so it is given an accent of
                its own: the mark and a rule down its edge in the shallows'
                cyan, at a row's height and not a tile's. NOT the buoy's
                orange — that colour means the way ON and means it once per
                card (`menu-main.tsx`), and a second lit control cancels the
                first rather than doubling it. Its price rides at the far end
                of the same line: a qualifier on the press, not a second line
                to read, and not a row's worth of height to pay for. */}
            {onReplay && (
              <button type="button" class="menu-item menu-item-watch" onClick={onReplay}>
                <Glyph name="replay" />
                <span class="menu-item-name">{STRINGS.pauseReplay}</span>
                <span class="menu-item-note">{STRINGS.pauseReplayNote}</span>
              </button>
            )}
            <button type="button" class="menu-item menu-item-leave" onClick={onMainMenu}>
              <Glyph name="exit" />
              <span class="menu-item-name">{STRINGS.pauseMainMenu}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
