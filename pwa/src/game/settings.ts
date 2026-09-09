// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PLAYER'S SETTINGS: every choice the game remembers between visits, in
// one table, with the storage layer around it (OSS_GAME_SPEC §36).
//
// The module is in two halves and the split is deliberate. `mergeSettings` is
// a PURE function of a parsed blob — it never touches storage, so the root
// suite reads it without a browser (`tests/settings_test.ts`) — and
// `loadSettings` / `saveSettings` are the thin skin over `localStorage` that
// call it. Everything a test would want to ask about a stored blob is a
// question about the merge.
//
// THE MERGE IS FIELD BY FIELD, NEVER `Object.assign` OVER THE WHOLE THING.
// A blob written by an older build carries settings this one no longer has,
// and a value off a ladder this build still offers is worse than a default:
// the menu has no chip to put the cursor back on, so the player can never
// return to it once they move away. Every field below is therefore CHECKED
// against what the build actually offers, and anything that fails the check
// falls back to the default rather than being carried.

import { CRAFT_IDS, type CraftId } from "@engine";

import { CAMERA_MODES, type CameraMode } from "./camera.ts";
import { SCENARIO_NAMES, type ScenarioName } from "./scenarios.ts";

/** What the HUD draws. One switch today — the whole overlay — because that
 * is the one a player actually reaches for, either to look at the water
 * with nothing over it or to take a picture of it. Per-readout switches are
 * a page of questions nobody asked. */
export type HudSettings = {
  on: boolean;
};

/** How a RUN is set up before it is stood up: which craft, which shore,
 * which camera it opens on. These are the run's own parameters rather than
 * preferences about the app, but they are remembered for the same reason
 * everything else here is — a player who rides the Dart rides the Dart
 * again next time, and being asked twice is being asked once too often. */
export type RideSettings = {
  craft: CraftId;
  /** The camera a run OPENS on. The camera key still walks the whole ladder
   * from wherever the run started; this only decides where it starts. */
  camera: CameraMode;
};

/** THE DEVELOPER'S OWN, and every one of them is a URL parameter `App.tsx`
 * already reads (`?seed=`, `?wind=`, `?hs=`, `?scene=`). That is not a
 * coincidence and it is the rule for anything added here: a developer
 * setting is a way of reaching, from inside the game, a frame that could
 * otherwise only be reached by typing a query string — so a frame found by
 * poking at the menu can always be handed to somebody else as a link.
 *
 * Only reachable once `developer` is true, and only ever switched on
 * deliberately. */
export type DevSettings = {
  /** Which shore. Null is the default seed, which is what a player gets and
   * therefore what a bug report is about until somebody says otherwise. */
  seed: number | null;
  /** Ride in this wind, m/s, from the level's own quarter — null for the
   * wind the level was generated with. The fastest way to see the hull in a
   * sea it would take a dozen seeds to meet. */
  wind: number | null;
  /** ...or in a sea quoted by its significant height, m. Null for the sea
   * the wind grows. Set alongside `wind` it wins, which is the same
   * precedence `?hs=` has over `?wind=` in the URL. */
  hs: number | null;
  /** Stand the run in a staged moment (`scenarios.ts`) instead of at the
   * level's start — the launch off a ramp, the nose-down landing, the chop.
   * Null rides from the start line with the clock running. */
  scene: ScenarioName | null;
  /** The frame cost in the HUD's corner: the water's CPU time, the draw
   * calls, the triangles. What `make profile` counts, while playing. */
  cost: boolean;
};

export type Settings = {
  hud: HudSettings;
  ride: RideSettings;
  /** True once the developer menu has been let out — the START row held
   * down for {@link DEV_HOLD_MS}. It STAYS out: a player who found it
   * deliberately does not want to find it again every time they open the
   * game. */
  developer: boolean;
  dev: DevSettings;
};

/** How long the main menu's START row has to be held before the developer
 * menu is let out.
 *
 * Seven seconds is the whole design. A press is a fifth of a second and a
 * player leaning on the row while they decide is under two, so nothing
 * anybody does on the way into a game reaches it; and it is short enough
 * that somebody TOLD about it finds it on their first try. There is no
 * combination to remember and nothing to type — the way in is the same
 * button as the way in.
 *
 * The row says so while it is being held (`menu-hold.ts` owns the ramp), so
 * a hold that is going to unlock something says it is going to before it
 * does, and a finger resting on START is never a surprise. */
export const DEV_HOLD_MS = 7000;

export const DEFAULT_SETTINGS: Settings = {
  hud: { on: true },
  ride: {
    // The skiff: the middle of the roster and the one a rider who has not
    // chosen should meet the water on.
    craft: "skiff",
    // Behind and above, which is the camera the game is tuned to be read
    // at — the nose view is a thing you go looking for.
    camera: "chase",
  },
  developer: false,
  dev: { seed: null, wind: null, hs: null, scene: null, cost: false },
};

/** The default shore. Stated here rather than in `App.tsx` because the
 * developer page's SEED row has to be able to say what NULL means, and a
 * row that named a different number from the one the game rides would be
 * the menu lying about the frame under it. */
export const DEFAULT_SEED = 38;

/** The wind the developer's row may ask for, m/s, and the sea it may ask
 * for, m. Both are the range the model is honest over: past the top of the
 * wind the fetch law is extrapolating, and a sea quoted taller than this
 * over a shore this shallow is breaking before it arrives. */
export const DEV_WIND_RANGE = { min: 0, max: 30 } as const;
export const DEV_HS_RANGE = { min: 0, max: 8 } as const;

const SETTINGS_KEY = "sea-haven-settings";

/** The defaults, as a blob nothing else shares a reference with — what a
 * first visit loads, and what RESTORE DEFAULTS puts back. */
export function freshSettings(): Settings {
  return {
    hud: { ...DEFAULT_SETTINGS.hud },
    ride: { ...DEFAULT_SETTINGS.ride },
    developer: false,
    dev: { ...DEFAULT_SETTINGS.dev },
  };
}

/** A finite number inside a range, or null for anything else — which is
 * what a row set to AUTO stores and what a blob from a build with a wider
 * range comes back as. */
function inRange(value: unknown, range: { min: number; max: number }): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value >= range.min && value <= range.max ? value : null;
}

/**
 * Stored settings laid over the defaults, one field at a time.
 *
 * Pure, and takes the parsed blob rather than reading storage itself, so the
 * root suite can hand it a blob from an older build and check what survives.
 * Anything it does not recognise is dropped on the floor: an unknown craft,
 * a camera this build no longer has, a scene that was renamed. That is the
 * whole job — see this module's header for why a check beats a merge.
 */
export function mergeSettings(parsed: unknown): Settings {
  const settings = freshSettings();
  if (!parsed || typeof parsed !== "object") return settings;
  const blob = parsed as Partial<Record<keyof Settings, unknown>>;

  const hud = blob.hud as Partial<Record<keyof HudSettings, unknown>> | undefined;
  if (typeof hud?.on === "boolean") settings.hud.on = hud.on;

  const ride = blob.ride as Partial<Record<keyof RideSettings, unknown>> | undefined;
  // Checked against the catalog rather than merged: a craft this build
  // dropped is a run with no hull to build.
  if (CRAFT_IDS.some((id) => id === ride?.craft)) settings.ride.craft = ride?.craft as CraftId;
  if (CAMERA_MODES.some((mode) => mode === ride?.camera)) {
    settings.ride.camera = ride?.camera as CameraMode;
  }

  if (blob.developer === true) settings.developer = true;
  const dev = blob.dev as Partial<Record<keyof DevSettings, unknown>> | undefined;
  if (dev) {
    if (typeof dev.seed === "number" && Number.isInteger(dev.seed) && dev.seed > 0) {
      settings.dev.seed = dev.seed;
    }
    settings.dev.wind = inRange(dev.wind, DEV_WIND_RANGE);
    settings.dev.hs = inRange(dev.hs, DEV_HS_RANGE);
    if (SCENARIO_NAMES.some((name) => name === dev.scene)) {
      settings.dev.scene = dev.scene as ScenarioName;
    }
    if (dev.cost === true) settings.dev.cost = true;
  }
  // A tool nobody can reach is a tool nobody can switch off: if the menu
  // that owns these was never let out, none of them is set.
  if (!settings.developer) settings.dev = { ...DEFAULT_SETTINGS.dev };
  return settings;
}

export function loadSettings(): Settings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    return mergeSettings(stored === null ? null : JSON.parse(stored));
  } catch {
    /* storage unavailable, or a blob that is not JSON — the defaults are a
       perfectly good game */
    return freshSettings();
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* storage unavailable — the choice still applies to this session */
  }
}
