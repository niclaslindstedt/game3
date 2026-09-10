// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// OPTIONS — every knob the game actually has, and not one it does not.
//
// That second half is the rule this page is written to. A settings screen
// carrying a row the app ignores is worse than a settings screen without it:
// the player moves it, nothing happens, and now nothing else on the page can
// be trusted either. So there is no volume fader here, because `game/audio/`
// is a placeholder and there is nothing to make quieter; and no key bindings,
// because `input.ts` carries a fixed table. Each of those becomes a row here
// on the day the thing behind it exists, and not before.
//
// What is left is what a rider chooses ABOUT THE APP: what the picture costs,
// where the eye rides, and whether the readouts are over the water at all.
// What a rider chooses about the RUN — the craft, the shore, the hour, the
// day — is the start card's (`menu-start.tsx`), asked once on the way to the
// water rather than twice in two places.
//
// THREE GROUPS IN TWO COLUMNS, AND EVERY ROW THE SAME SILHOUETTE
// (`menu-knobs.tsx`): the name, then the value between two arrows, then the
// pips under it. The page carries no sentence per row — a switch that explains
// itself under its own label is two lines of height, and seven of them do not
// fit a phone — so every explanation goes to the ONE caption bar at the foot,
// which reads whichever row the pointer or the cursor is on.
//
// THE PICTURE ROWS ARE OVER A LIVE SEA and apply the moment they are pressed
// (`App.tsx` hands them to the renderer), which is the whole reason they are
// here rather than behind their own card: WATER and SEE-THROUGH are judged by
// looking at the water twenty metres out, and it is right there behind the
// card. What each row buys is `settings-video.ts`; this page only asks.
//
// THE PAUSE CARD DOES NOT OPEN THIS PAGE. It carries the handful of knobs a
// rider stops mid-run for, as a strip of these same rows (`menu-pause.tsx`),
// and everything else waits for the front door — because a picture row is
// judged against a sea that is MOVING, and the one thing the pause card does
// is stop it.

import { CAMERA_MODES, type CameraMode } from "./camera.ts";
import { MenuHead } from "./menu.tsx";
import { Caption, KnobGroup, ON_OFF, StepRow, onOff, type Stop } from "./menu-knobs.tsx";
import { freshSettings, type Settings } from "./settings.ts";
import {
  DETAIL_LEVELS,
  DETAIL_PRESETS,
  RESOLUTION_LEVELS,
  WATER_LEVELS,
  detailOf,
  type DetailLevel,
  type ResolutionLevel,
  type VideoSettings,
  type WaterLevel,
} from "./settings-video.ts";
import { STRINGS } from "./strings.ts";
import { useState } from "preact/hooks";

/** The cameras, in the ladder's own order, so the arrows walk them the way
 * the camera key does. */
const CAMERA_LABELS: Record<CameraMode, string> = {
  bow: STRINGS.cameraBow,
  nose: STRINGS.cameraNose,
  close: STRINGS.cameraClose,
  chase: STRINGS.cameraChase,
  far: STRINGS.cameraFar,
  heli: STRINGS.cameraHeli,
};

/** Exported because the PAUSE CARD's strip carries the same row: a camera
 * picked mid-run and a camera picked on the front door are one setting, and
 * two lists of six words would be two ladders the day one of them grows a
 * seventh. */
export const CAMERA_STOPS: Stop<CameraMode>[] = CAMERA_MODES.map((id) => ({
  id,
  label: CAMERA_LABELS[id],
}));

/** The three picture ladders. Every one of them is cheapest first, left to
 * right, so a rider who is looking for frames always walks the same way — and
 * the words come off the strings table like every other word on every other
 * card (§39.1), never off the id. */
const STEPS: Record<"low" | "medium" | "high", string> = {
  low: STRINGS.optLow,
  medium: STRINGS.optMedium,
  high: STRINGS.optHigh,
};

const WATER_STOPS: Stop<WaterLevel>[] = WATER_LEVELS.map((id) => ({ id, label: STEPS[id] }));

const RESOLUTION_STOPS: Stop<ResolutionLevel>[] = RESOLUTION_LEVELS.map((id) => ({
  id,
  label: STEPS[id],
}));

const DETAIL_STOPS: Stop<DetailLevel>[] = DETAIL_LEVELS.map((id) => ({ id, label: STEPS[id] }));

export function OptionsPage({
  settings,
  onSettings,
  onBack,
}: {
  settings: Settings;
  onSettings: (settings: Settings) => void;
  onBack: () => void;
}) {
  const [hint, setHint] = useState<string | null>(null);
  const setVideo = (video: Partial<VideoSettings>): void =>
    onSettings({ ...settings, video: { ...settings.video, ...video } });
  return (
    <div class="menu-card menu-card-options" onPointerLeave={() => setHint(null)}>
      <MenuHead back={onBack} backLabel={STRINGS.menuBack} title={STRINGS.menuOptions} />
      {/* Two columns on anything wide enough, packed by ROW COUNT rather than
          by subject order — four on the left, three on the right — so a laptop
          holds the whole page without scrolling and neither column ends
          short. On a phone the grid collapses and they stack. */}
      <div class="knob-groups">
        <div class="knob-col">
          {/* Four rows, not one, because they are four different costs: how
              many pixels, how much sea, how much stuff on it, and how far the
              eye gets INTO it. A machine can be short of one and rich in
              another. */}
          <KnobGroup title={STRINGS.optPicture}>
            <StepRow
              label={STRINGS.optResolution}
              hint={STRINGS.optResolutionHint}
              stops={RESOLUTION_STOPS}
              value={settings.video.resolution}
              onPick={(resolution) => setVideo({ resolution })}
              onHint={setHint}
            />
            {/* One stop sets three levers, and the row READS BACK whichever
                preset the three most resemble (`detailOf`) — so a blob stored
                by another build still puts the value somewhere the rider can
                move it from. */}
            <StepRow
              label={STRINGS.optDetail}
              hint={STRINGS.optDetailHint}
              stops={DETAIL_STOPS}
              value={detailOf(settings.video)}
              onPick={(detail) => setVideo(DETAIL_PRESETS[detail])}
              onHint={setHint}
            />
            <StepRow
              label={STRINGS.optWater}
              hint={STRINGS.optWaterHint}
              stops={WATER_STOPS}
              value={settings.video.water}
              onPick={(water) => setVideo({ water })}
              onHint={setHint}
            />
            <StepRow
              label={STRINGS.optSeeThrough}
              hint={STRINGS.optSeeThroughHint}
              stops={ON_OFF}
              value={onOff(settings.video.seeThrough)}
              onPick={(id) => setVideo({ seeThrough: id === "on" })}
              onHint={setHint}
            />
          </KnobGroup>
        </div>
        <div class="knob-col">
          <KnobGroup title={STRINGS.optRiding}>
            <StepRow
              label={STRINGS.optCamera}
              hint={STRINGS.optCameraHint}
              stops={CAMERA_STOPS}
              value={settings.ride.camera}
              onPick={(camera) => onSettings({ ...settings, ride: { ...settings.ride, camera } })}
              onHint={setHint}
            />
          </KnobGroup>
          <KnobGroup title={STRINGS.optHudGroup}>
            <StepRow
              label={STRINGS.optHud}
              hint={STRINGS.optHudHint}
              stops={ON_OFF}
              value={onOff(settings.hud.on)}
              onPick={(id) =>
                onSettings({ ...settings, hud: { ...settings.hud, on: id === "on" } })
              }
              onHint={setHint}
            />
            <StepRow
              label={STRINGS.optFps}
              hint={STRINGS.optFpsHint}
              stops={ON_OFF}
              value={onOff(settings.hud.fps)}
              onPick={(id) =>
                onSettings({ ...settings, hud: { ...settings.hud, fps: id === "on" } })
              }
              onHint={setHint}
            />
          </KnobGroup>
        </div>
      </div>
      <Caption text={hint} fallback={STRINGS.optCaption} />
      {/* RESTORE DEFAULTS keeps the developer menu OUT once it has been
          found. It is not a setting the player chose and it is not a mess this
          button is for tidying: making somebody hold START for seven seconds
          again because they wanted their camera back would be the page
          punishing them for using it. */}
      <button
        type="button"
        class="opt-reset"
        onClick={() => {
          const fresh = freshSettings();
          onSettings({ ...fresh, developer: settings.developer, dev: { ...settings.dev } });
        }}
      >
        {STRINGS.optRestore}
      </button>
    </div>
  );
}
