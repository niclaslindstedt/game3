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
// What is left is what a rider chooses ABOUT THE APP: the camera a run opens
// on, whether the readouts are over the water at all, and what the picture
// costs. What a rider chooses about the RUN — the craft, the shore, the hour,
// the day — is the start card's (`menu-start.tsx`), asked once on the way to
// the water rather than twice in two places.
//
// THE PICTURE ROWS ARE OVER A LIVE SEA and apply the moment they are pressed
// (`App.tsx` hands them to the renderer), which is the whole reason they are
// here rather than behind their own card: WATER and SEE-THROUGH are judged by
// looking at the water twenty metres out, and it is right there behind the
// card. What each row buys is `settings-video.ts`; this page only asks.
//
// The rows themselves are `menu.tsx`'s, shared with the developer page. The
// PAGE is shared too: the pause card (`menu-pause.tsx`) opens this one rather
// than growing knobs of its own, because a camera picked mid-run and a camera
// picked on the front door are one setting and must be one row.

import { CAMERA_MODES, type CameraMode } from "./camera.ts";
import { MenuBody, MenuHead, OptionRow, ToggleRow } from "./menu.tsx";
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

/** The cameras, in the ladder's own order, so the chips read left to right
 * the way the camera key walks them. */
const CAMERA_LABELS: Record<CameraMode, string> = {
  bow: STRINGS.cameraBow,
  nose: STRINGS.cameraNose,
  close: STRINGS.cameraClose,
  chase: STRINGS.cameraChase,
  far: STRINGS.cameraFar,
  heli: STRINGS.cameraHeli,
};

const CAMERA_OPTIONS: readonly { id: CameraMode; label: string }[] = CAMERA_MODES.map((id) => ({
  id,
  label: CAMERA_LABELS[id],
}));

/** The three picture ladders as chips. Every one of them is cheapest first,
 * left to right, so a rider who is looking for frames always walks the same
 * way — and the words come off the strings table like every other word on
 * every other card (§39.1), never off the id. */
const STEPS: Record<"low" | "medium" | "high", string> = {
  low: STRINGS.optLow,
  medium: STRINGS.optMedium,
  high: STRINGS.optHigh,
};

const WATER_OPTIONS: readonly { id: WaterLevel; label: string }[] = WATER_LEVELS.map((id) => ({
  id,
  label: STEPS[id],
}));

const RESOLUTION_OPTIONS: readonly { id: ResolutionLevel; label: string }[] = RESOLUTION_LEVELS.map(
  (id) => ({ id, label: STEPS[id] }),
);

const DETAIL_OPTIONS: readonly { id: DetailLevel; label: string }[] = DETAIL_LEVELS.map((id) => ({
  id,
  label: STEPS[id],
}));

export function OptionsPage({
  settings,
  onSettings,
  onBack,
  backLabel = STRINGS.menuBack,
}: {
  settings: Settings;
  onSettings: (settings: Settings) => void;
  onBack: () => void;
  /** Where BACK goes, in words. The page is reached from two places — the
   * front door and the pause card — and the one thing that differs between
   * them is what the player is stepping back into. */
  backLabel?: string;
}) {
  const setVideo = (video: Partial<VideoSettings>): void =>
    onSettings({ ...settings, video: { ...settings.video, ...video } });
  return (
    <div class="menu-card">
      <MenuHead back={onBack} backLabel={backLabel} title={STRINGS.menuOptions} />
      <MenuBody>
        <OptionRow
          label={STRINGS.optCamera}
          options={CAMERA_OPTIONS}
          value={settings.ride.camera}
          onPick={(camera) => onSettings({ ...settings, ride: { ...settings.ride, camera } })}
        />
        <OptionRow
          label={STRINGS.optWater}
          options={WATER_OPTIONS}
          value={settings.video.water}
          onPick={(water) => setVideo({ water })}
        />
        <OptionRow
          label={STRINGS.optResolution}
          options={RESOLUTION_OPTIONS}
          value={settings.video.resolution}
          onPick={(resolution) => setVideo({ resolution })}
        />
        {/* One chip sets three levers, and the row READS BACK whichever preset
            the three most resemble (`detailOf`) — so a blob stored by another
            build still puts the cursor somewhere the rider can move it from. */}
        <OptionRow
          label={STRINGS.optDetail}
          options={DETAIL_OPTIONS}
          value={detailOf(settings.video)}
          onPick={(detail) => setVideo(DETAIL_PRESETS[detail])}
        />
        <div class="opt-toggles">
          <ToggleRow
            label={STRINGS.optSeeThrough}
            hint={STRINGS.optSeeThroughHint}
            on={settings.video.seeThrough}
            onToggle={() => setVideo({ seeThrough: !settings.video.seeThrough })}
          />
          <ToggleRow
            label={STRINGS.optHud}
            hint={STRINGS.optHudHint}
            on={settings.hud.on}
            onToggle={() =>
              onSettings({ ...settings, hud: { ...settings.hud, on: !settings.hud.on } })
            }
          />
          <ToggleRow
            label={STRINGS.optFps}
            hint={STRINGS.optFpsHint}
            on={settings.hud.fps}
            onToggle={() =>
              onSettings({ ...settings, hud: { ...settings.hud, fps: !settings.hud.fps } })
            }
          />
        </div>
        {/* RESTORE DEFAULTS keeps the developer menu OUT once it has been
            found. It is not a setting the player chose and it is not a mess
            this button is for tidying: making somebody hold START for seven
            seconds again because they wanted their camera back would be the
            page punishing them for using it. */}
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
      </MenuBody>
    </div>
  );
}
