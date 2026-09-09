// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DEVELOPER PAGE: out of the way of a player who never found it (hold
// START for seven seconds — `DEV_HOLD_MS`), and blunt for one who did.
//
// EVERY ROW HERE IS A URL PARAMETER `App.tsx` ALREADY READS (`?seed=`,
// `?wind=`, `?hs=`, `?scene=`). That is the rule for anything added, not a
// coincidence about what happened to be easy: a developer setting exists to
// reach, from inside the game, a frame that could otherwise only be reached
// by typing a query string — so a frame somebody FINDS by poking at this page
// can always be handed to somebody else as a link. COPY REPRO LINK is the
// other half of that bargain, and the reason the page is worth having at all
// rather than four more URL parameters nobody can remember.
//
// The rows are `menu.tsx`'s, shared with OPTIONS: a wind picked here and a
// camera picked there have to be the same kind of row, or the page reads as
// a different program bolted onto the side of the game.
//
// LOCK is the way back out. It is not a tidy-up — RESTORE DEFAULTS on the
// options page deliberately leaves the menu unlocked — it is for somebody
// who opened the door by accident and wants it shut.

import { useState } from "preact/hooks";

import { SCENARIO_NAMES, type ScenarioName } from "./scenarios.ts";
import { MenuBody, MenuHead, OptionRow, SliderRow, StepRow, ToggleRow } from "./menu.tsx";
import {
  DEFAULT_SEED,
  DEV_HS_RANGE,
  DEV_WIND_RANGE,
  freshSettings,
  type Settings,
} from "./settings.ts";
import { STRINGS } from "./strings.ts";

/** How long a copy button wears its receipt before going back to its label. */
const SAID_MS = 2000;

/** The scenes, plus the one that is not a scene: START, which is the level's
 * own start line with the clock running — what a player gets, and therefore
 * what a bug report is about until somebody says otherwise. */
const SCENE_OPTIONS: readonly { id: ScenarioName | "start"; label: string }[] = [
  { id: "start", label: STRINGS.devStart },
  ...SCENARIO_NAMES.map((id) => ({ id, label: id.toUpperCase() })),
];

/**
 * The query string that stands this exact run up again — the same parameters
 * `App.tsx` reads on boot, and only the ones that are actually set.
 *
 * `?splash=0` rides along because a link handed to somebody else is a link
 * they want to land IN the frame, not on the attract card in front of it.
 */
export function reproQuery(settings: Settings): string {
  const dev = settings.dev;
  const params = new URLSearchParams();
  params.set("seed", String(dev.seed ?? DEFAULT_SEED));
  params.set("craft", settings.ride.craft);
  if (dev.scene !== null) params.set("scene", dev.scene);
  if (dev.wind !== null) params.set("wind", String(dev.wind));
  if (dev.hs !== null) params.set("hs", String(dev.hs));
  params.set("splash", "0");
  return `?${params.toString()}`;
}

export function DeveloperPage({
  settings,
  onSettings,
  onBack,
}: {
  settings: Settings;
  onSettings: (settings: Settings) => void;
  onBack: () => void;
}) {
  const [said, setSaid] = useState<string | null>(null);
  const dev = settings.dev;
  const setDev = (patch: Partial<Settings["dev"]>): void =>
    onSettings({ ...settings, dev: { ...dev, ...patch } });

  return (
    <div class="menu-card">
      <MenuHead
        back={onBack}
        backLabel={STRINGS.menuBack}
        title={STRINGS.menuDeveloper}
        sub="Every row here is a URL the next person can open"
      />
      <MenuBody>
        <StepRow
          label={STRINGS.devSeed}
          read={String(dev.seed ?? DEFAULT_SEED)}
          // Never below 1: seed 0 is not a level, and an arrow that walks
          // off the bottom of the catalog is an arrow that hangs the page.
          onStep={(by) => setDev({ seed: Math.max(1, (dev.seed ?? DEFAULT_SEED) + by) })}
          onClear={() => setDev({ seed: null })}
          clearLabel={`${STRINGS.devSeed} ${STRINGS.devAuto}`}
        />
        <SliderRow
          label={STRINGS.devWind}
          value={dev.wind}
          min={DEV_WIND_RANGE.min}
          max={DEV_WIND_RANGE.max}
          step={1}
          autoLabel={STRINGS.devAuto}
          format={STRINGS.devWindValue}
          onChange={(wind) => setDev({ wind })}
        />
        <SliderRow
          label={STRINGS.devSea}
          value={dev.hs}
          min={DEV_HS_RANGE.min}
          max={DEV_HS_RANGE.max}
          step={0.5}
          autoLabel={STRINGS.devAuto}
          format={STRINGS.devSeaValue}
          onChange={(hs) => setDev({ hs })}
        />
        <OptionRow
          label={STRINGS.devScene}
          options={SCENE_OPTIONS}
          value={dev.scene ?? "start"}
          onPick={(scene) => setDev({ scene: scene === "start" ? null : scene })}
        />
        <div class="opt-toggles">
          <ToggleRow
            label={STRINGS.devCost}
            hint={STRINGS.devCostHint}
            on={dev.cost}
            onToggle={() => setDev({ cost: !dev.cost })}
          />
        </div>
        <button
          type="button"
          class="opt-reset"
          onClick={() => {
            const url = `${location.origin}${location.pathname}${reproQuery(settings)}`;
            void navigator.clipboard
              ?.writeText(url)
              .then(() => setSaid(STRINGS.devReproCopied))
              .catch(() => setSaid(STRINGS.devReproFailed))
              .finally(() => setTimeout(() => setSaid(null), SAID_MS));
          }}
        >
          {said ?? STRINGS.devRepro}
        </button>
        {/* The way back out, and the one press on this page that changes what
            the MENU looks like rather than what the run does. Last, and
            styled as the quiet one: a page of tools should not put its own
            trapdoor where a thumb reaching for a slider lands. */}
        <button
          type="button"
          class="opt-reset opt-reset-quiet"
          onClick={() => {
            const fresh = freshSettings();
            onSettings({ ...settings, developer: false, dev: fresh.dev });
            onBack();
          }}
        >
          {STRINGS.devLock}
        </button>
      </MenuBody>
    </div>
  );
}
