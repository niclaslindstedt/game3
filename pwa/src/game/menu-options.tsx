// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// OPTIONS — every knob the game actually has, and not one it does not.
//
// That second half is the rule this page is written to. A settings screen
// carrying a row the app ignores is worse than a settings screen without it:
// the player moves it, nothing happens, and now nothing else on the page can
// be trusted either. So there is no volume fader here, because `game/audio/`
// is a placeholder and there is nothing to make quieter; no video row,
// because the renderer has no quality ladder yet; and no key bindings,
// because `input.ts` carries a fixed table. Each of those becomes a row here
// on the day the thing behind it exists, and not before.
//
// What is left is what a rider chooses: the craft they ride, the camera they
// ride it from, and whether the readouts are over the water at all.
//
// The rows themselves are `menu.tsx`'s, shared with the developer page.

import { CRAFT, type CraftId } from "@engine";

import { CAMERA_MODES, type CameraMode } from "./camera.ts";
import { MenuBody, MenuHead, OptionRow, ToggleRow } from "./menu.tsx";
import { freshSettings, type Settings } from "./settings.ts";
import { STRINGS } from "./strings.ts";

/** The craft, as chips — off the catalog rather than restated, so a craft
 * added to `engine/game/defs/craft.ts` is on this page the same day. */
const CRAFT_OPTIONS: readonly { id: CraftId; label: string }[] = CRAFT.map((craft) => ({
  id: craft.id,
  label: craft.name.toUpperCase(),
}));

/** The cameras, in the ladder's own order, so the chips read left to right
 * the way the camera key walks them. */
const CAMERA_LABELS: Record<CameraMode, string> = {
  chase: STRINGS.cameraChase,
  nose: STRINGS.cameraNose,
};

const CAMERA_OPTIONS: readonly { id: CameraMode; label: string }[] = CAMERA_MODES.map((id) => ({
  id,
  label: CAMERA_LABELS[id],
}));

export function OptionsPage({
  settings,
  onSettings,
  onBack,
}: {
  settings: Settings;
  onSettings: (settings: Settings) => void;
  onBack: () => void;
}) {
  return (
    <div class="menu-card">
      <MenuHead back={onBack} backLabel={STRINGS.menuBack} title={STRINGS.menuOptions} />
      <MenuBody>
        <OptionRow
          label={STRINGS.optCraft}
          options={CRAFT_OPTIONS}
          value={settings.ride.craft}
          onPick={(craft) => onSettings({ ...settings, ride: { ...settings.ride, craft } })}
        />
        <OptionRow
          label={STRINGS.optCamera}
          options={CAMERA_OPTIONS}
          value={settings.ride.camera}
          onPick={(camera) => onSettings({ ...settings, ride: { ...settings.ride, camera } })}
        />
        <div class="opt-toggles">
          <ToggleRow
            label={STRINGS.optHud}
            hint={STRINGS.optHudHint}
            on={settings.hud.on}
            onToggle={() => onSettings({ ...settings, hud: { on: !settings.hud.on } })}
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
