// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// OPTIONS — every knob the game actually has, and not one it does not.
//
// That second half is the rule this page is written to. A settings screen
// carrying a row the app ignores is worse than a settings screen without it:
// the player moves it, nothing happens, and now nothing else on the page can
// be trusted either. So there is ONE fader here — every sound effect, which is
// every sound the game makes today — and no MUSIC fader, because there is no
// score yet. It becomes a row here on the day the score exists, and not
// before.
//
// A ROW IS ALSO NOT OFFERED TO A MACHINE THAT CANNOT USE IT: the motor's
// switch is drawn only where there is a motor (`canRumble`) and the door to
// the bindings only where there are keys (`hasKeyboard`). The setting behind
// each is stored either way, so a phone and the laptop beside it never argue
// over one blob.
//
// What is left is what a rider chooses ABOUT THE APP: what the picture costs,
// where the eye rides, how loud the water is, and whether the readouts are
// over the water at all.
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
import { canRumble } from "./haptics.ts";
import { hasKeyboard } from "./input.ts";
import { MenuHead } from "./menu.tsx";
import {
  Caption,
  FadeRow,
  KnobGroup,
  LinkRow,
  ON_OFF,
  StepRow,
  onOff,
  type Stop,
} from "./menu-knobs.tsx";
import { KEY_ACTIONS } from "./settings-input.ts";
import { SFX_STEP, freshSettings, type Settings } from "./settings.ts";
import {
  DETAIL_LEVELS,
  DETAIL_PRESETS,
  DISTANCE_LEVELS,
  FRAME_RATE_LEVELS,
  RESOLUTION_LEVELS,
  WATER_LEVELS,
  WATER_PRESETS,
  detailOf,
  type DetailLevel,
  type DistanceLevel,
  type FrameRateLevel,
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

/** The four picture ladders. Every one of them is cheapest first, left to
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

const DISTANCE_STOPS: Stop<DistanceLevel>[] = DISTANCE_LEVELS.map((id) => ({
  id,
  label: STEPS[id],
}));

/** The cap's ladder: two figures and the screen's own rate. Slowest first,
 * like every other ladder here — the cheap end is on the left. */
const FRAME_RATE_STOPS: Stop<FrameRateLevel>[] = FRAME_RATE_LEVELS.map((id) => ({
  id,
  label: id === "max" ? STRINGS.optFrameRateMax : id,
}));

/** The fader's reading: OFF at the bottom of the travel rather than 0%,
 * because silence is a state a rider chooses and "0%" reads as a setting that
 * did not take. */
const soundLevel = (share: number): string =>
  share <= 0 ? STRINGS.optSoundOff : STRINGS.percent(share);

/** The one fader, exported because the PAUSE CARD's strip carries it too: a
 * rider who stops mid-run to turn the water down is the fader's commonest
 * caller, and one row in two places is one setting.
 *
 * THE WHOLE SETTING IS ON THE TRAVEL — silence is the bottom stop, not a word
 * beside the track — so the thumb dragged to the far left is the water going
 * off, and a rider hunting for quiet never has to find a second control to
 * get there. */
export function SoundRow({
  settings,
  onSettings,
  onHint,
}: {
  settings: Settings;
  onSettings: (settings: Settings) => void;
  onHint?: (hint: string | null) => void;
}) {
  return (
    <FadeRow
      label={STRINGS.optSound}
      hint={STRINGS.optSoundHint}
      value={settings.audio.sfx}
      min={0}
      max={1}
      step={SFX_STEP}
      read={soundLevel}
      onChange={(sfx) => onSettings({ ...settings, audio: { sfx: sfx ?? 0 } })}
      onHint={onHint}
    />
  );
}

export function OptionsPage({
  settings,
  onSettings,
  onBack,
  onKeys,
}: {
  settings: Settings;
  onSettings: (settings: Settings) => void;
  onBack: () => void;
  onKeys: () => void;
}) {
  const [hint, setHint] = useState<string | null>(null);
  // Asked once per opening rather than per render: the answer is a fact
  // about the machine, and the probe reaches for `navigator` and the
  // touchscreen.
  const [rumbleOffered] = useState(canRumble);
  // Same question, same reason: a phone has no keys to rebind, and a door
  // onto a page of them is a door onto a room it cannot walk into. Asked
  // once per opening, because it is a fact about the machine.
  const [keysOffered] = useState(hasKeyboard);
  const setVideo = (video: Partial<VideoSettings>): void =>
    onSettings({ ...settings, video: { ...settings.video, ...video } });
  return (
    <div class="menu-card menu-card-options" onPointerLeave={() => setHint(null)}>
      <MenuHead back={onBack} backLabel={STRINGS.menuBack} title={STRINGS.menuOptions} />
      {/* Two columns on anything wide enough, packed by ROW COUNT rather than
          by subject order — six on the left, four on the right — so a laptop
          holds the whole page without scrolling and neither column ends
          short. On a phone the grid collapses and they stack. */}
      <div class="knob-groups">
        <div class="knob-col">
          {/* Five rows, not one, because they are five different costs: how
              many pixels, how much sea, how much stuff on it, how far out
              there IS any, and how far the eye gets INTO it. A machine can be
              short of one and rich in another — and a sixth for how OFTEN all
              of it is asked for. */}
          <KnobGroup title={STRINGS.optPicture}>
            <StepRow
              label={STRINGS.optResolution}
              hint={STRINGS.optResolutionHint}
              stops={RESOLUTION_STOPS}
              value={settings.video.resolution}
              onPick={(resolution) => setVideo({ resolution })}
              onHint={setHint}
            />
            {/* One stop sets four levers, and the row READS BACK whichever
                preset the four most resemble (`detailOf`) — so a blob stored
                by another build still puts the value somewhere the rider can
                move it from. None of the four is the sea: turning DETAIL up
                on a LOW water cannot buy back a droplet of spray. */}
            <StepRow
              label={STRINGS.optDetail}
              hint={STRINGS.optDetailHint}
              stops={DETAIL_STOPS}
              value={detailOf(settings.video)}
              onPick={(detail) => setVideo(DETAIL_PRESETS[detail])}
              onHint={setHint}
            />
            {/* DISTANCE sits under DETAIL because they are the same question
                asked twice — how much world — and a rider hunting frames
                should find the two of them together. It is also the one row
                on the page that changes the WEATHER: a shorter view is a
                hazier day, which is how the cut-off stays out of sight. */}
            <StepRow
              label={STRINGS.optDistance}
              hint={STRINGS.optDistanceHint}
              stops={DISTANCE_STOPS}
              value={settings.video.distance}
              onPick={(distance) => setVideo({ distance })}
              onHint={setHint}
            />
            {/* THE WHOLE SEA IN ONE WORD: the stop is stored, and the four
                levers drawn ON the water — the spray, the wake, the splash
                and the mirror — are its expansion rather than settings of
                their own, so the row cannot disagree with itself and DETAIL
                cannot raise the sea behind the rider's back. */}
            <StepRow
              label={STRINGS.optWater}
              hint={STRINGS.optWaterHint}
              stops={WATER_STOPS}
              value={settings.video.water}
              onPick={(water) => setVideo({ water, ...WATER_PRESETS[water] })}
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
            {/* The last row is not a picture cost but a schedule: every row
                above makes a frame cheaper, this one asks for fewer of them,
                which on a phone that draws unevenly is the row that makes
                the ride smooth. `App.tsx`'s loop reads it through the gate in
                `frame-rate.ts`. */}
            <StepRow
              label={STRINGS.optFrameRate}
              hint={STRINGS.optFrameRateHint}
              stops={FRAME_RATE_STOPS}
              value={settings.video.frameRate}
              onPick={(frameRate) => setVideo({ frameRate })}
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
            {/* The door to the bindings, in RIDING rather than under a
                CONTROLS heading of its own: a group title is height, this
                card already reaches the bottom of a phone, and which keys
                are under the hands is as much "how this is ridden" as where
                the eye sits and what the bars do to them. */}
            {keysOffered && (
              <LinkRow
                label={STRINGS.optKeyboard}
                hint={STRINGS.optKeyboardHint}
                value={STRINGS.optKeysCount(KEY_ACTIONS.length)}
                onOpen={onKeys}
                onHint={setHint}
              />
            )}
            {/* THE MOTOR IS OFFERED ONLY WHERE THERE IS ONE. A desktop
                browser answers `navigator.vibrate` and does nothing with it,
                so the check is `canRumble()` rather than the API's existence
                — a row on a laptop that moves and changes nothing is worse
                than no row. The setting is stored either way, so the phone
                and the laptop reading the same blob never argue. */}
            {rumbleOffered && (
              <StepRow
                label={STRINGS.optRumble}
                hint={STRINGS.optRumbleHint}
                stops={ON_OFF}
                value={onOff(settings.rumble)}
                onPick={(id) => onSettings({ ...settings, rumble: id === "on" })}
                onHint={setHint}
              />
            )}
          </KnobGroup>
          {/* THE FADER IS OVER A LIVE SEA TOO: the bus reads it every frame,
              so the engine under the front door gets quieter as the thumb
              moves — all the way to silence, which is the bottom of the travel
              and not a word beside it. It is the same row the pause card
              carries. */}
          <KnobGroup title={STRINGS.optSoundGroup}>
            <SoundRow settings={settings} onSettings={onSettings} onHint={setHint} />
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
