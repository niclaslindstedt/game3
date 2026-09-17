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
// The rows are the KNOBS (`menu-knobs.tsx`), shared with OPTIONS, the start
// card and the pause strip: a wind picked here and a camera picked there have
// to be the same kind of row, or the page reads as a different program bolted
// onto the side of the game. Their sentences go to the ONE caption bar at the
// foot, which is what lets a page of tools stay a page rather than a booklet.
//
// THE BENCHMARK IS THE ONE ROW HERE THAT IS NOT A URL PARAMETER, and it is
// the exception the rule is worth stating for: it does not stand a frame up,
// it TIMES one (`benchmark.ts`). Every dial of the race it runs is pinned in
// `benchmark-plan.ts` precisely so that it cannot be handed round as a link
// with the conditions changed — a score is only a score against a second
// score taken on the same race.
//
// LOCK is the way back out. It is not a tidy-up — RESTORE DEFAULTS on the
// options page deliberately leaves the menu unlocked — it is for somebody
// who opened the door by accident and wants it shut.

import { useState } from "preact/hooks";
import { MODE_RULES } from "@engine";

import { BENCHMARK, benchmarkSeconds } from "./benchmark-plan.ts";
import { benchmarkRuns } from "./benchmark-history.ts";
import { SCENARIO_NAMES, type ScenarioName } from "./scenarios.ts";
import { MenuHead } from "./menu.tsx";
import {
  Caption,
  FadeRow,
  type Hint,
  KnobGroup,
  NumberRow,
  ON_OFF,
  StepRow,
  onOff,
  type Stop,
} from "./menu-knobs.tsx";
import {
  DEFAULT_SEED,
  DEV_HS_RANGE,
  DEV_WIND_RANGE,
  SEED_RANGE,
  freshSettings,
  type Settings,
} from "./settings.ts";
import { STRINGS } from "./strings.ts";

/** How long a copy button wears its receipt before going back to its label. */
const SAID_MS = 2000;

/** The scenes, plus the one that is not a scene: START, which is the level's
 * own start line with the clock running — what a player gets, and therefore
 * what a bug report is about until somebody says otherwise. */
const SCENE_STOPS: Stop<ScenarioName | "start">[] = [
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
  const { dev, ride } = settings;
  const params = new URLSearchParams();
  params.set("seed", String(ride.seed ?? DEFAULT_SEED));
  params.set("craft", ride.craft);
  params.set("mode", ride.mode);
  if (ride.mode === "tricks") params.set("minutes", String(ride.tricksMinutes));
  // The start card's own weather rows travel as well — the hour, the wind and
  // the quarter it blows from, the sea outside, the sky — because a link that
  // dropped them would stand the frame up under different weather from the
  // one it was copied out of, which is the one thing a repro link may never
  // do. Each is a FIGURE where the row stores one, which is the same spelling
  // `url-params.ts` reads back.
  if (ride.time !== null) params.set("time", ride.time);
  if (ride.wind !== null) params.set("day", String(ride.wind));
  if (ride.windQuarter !== null) params.set("windfrom", String(ride.windQuarter));
  if (ride.swell !== null) params.set("waves", String(ride.swell));
  if (ride.weather !== null) params.set("weather", ride.weather);
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
  onBenchmark,
  onBenchmarkHistory,
}: {
  settings: Settings;
  onSettings: (settings: Settings) => void;
  onBack: () => void;
  /** Take the canvas and time a race on it. */
  onBenchmark: () => void;
  /** …and the list of every one this machine has scored, reachable without
   * running another: the whole use of the tool is the COMPARISON, and a page
   * you could only reach out of a fresh run would charge thirty seconds for
   * looking something up. */
  onBenchmarkHistory: () => void;
}) {
  const [said, setSaid] = useState<string | null>(null);
  const [hint, setHint] = useState<Hint | null>(null);
  const dev = settings.dev;
  const setDev = (patch: Partial<Settings["dev"]>): void =>
    onSettings({ ...settings, dev: { ...dev, ...patch } });
  // The SEED is the START CARD's row, shown here too because a developer
  // reaching for a seed should not have to walk back out to the front door
  // for it. One setting, two places to turn it — never two seeds.
  const seed = settings.ride.seed ?? DEFAULT_SEED;
  // The default shore stays stored as null, exactly as it is on the start
  // card — see the note beside `setSeed` there.
  const setSeed = (next: number): void =>
    onSettings({
      ...settings,
      ride: { ...settings.ride, seed: next === DEFAULT_SEED ? null : next },
    });

  return (
    <div class="menu-card menu-card-options" onPointerLeave={() => setHint(null)}>
      <MenuHead back={onBack} backLabel={STRINGS.menuBack} title={STRINGS.menuDeveloper} />
      <div class="knob-groups">
        <div class="knob-col">
          <KnobGroup title={STRINGS.devGroupRun}>
            <NumberRow
              label={STRINGS.devSeed}
              hint={STRINGS.devSeedHint}
              value={seed}
              min={SEED_RANGE.min}
              max={SEED_RANGE.max}
              onValue={setSeed}
              onHint={setHint}
            />
            <StepRow
              label={STRINGS.devScene}
              hint={STRINGS.devSceneHint}
              stops={SCENE_STOPS}
              value={dev.scene ?? "start"}
              onPick={(scene) => setDev({ scene: scene === "start" ? null : scene })}
              onHint={setHint}
            />
          </KnobGroup>
          <KnobGroup title={STRINGS.devGroupTools}>
            <StepRow
              label={STRINGS.devCost}
              hint={STRINGS.devCostHint}
              stops={ON_OFF}
              value={onOff(dev.cost)}
              onPick={(id) => setDev({ cost: id === "on" })}
              onHint={setHint}
            />
          </KnobGroup>
        </div>
        <div class="knob-col">
          <KnobGroup title={STRINGS.devGroupSea}>
            <FadeRow
              label={STRINGS.devWind}
              hint={STRINGS.devWindHint}
              value={dev.wind}
              min={DEV_WIND_RANGE.min}
              max={DEV_WIND_RANGE.max}
              step={1}
              autoLabel={STRINGS.devAuto}
              read={STRINGS.devWindValue}
              onChange={(wind) => setDev({ wind })}
              onHint={setHint}
            />
            <FadeRow
              label={STRINGS.devSea}
              hint={STRINGS.devSeaHint}
              value={dev.hs}
              min={DEV_HS_RANGE.min}
              max={DEV_HS_RANGE.max}
              step={0.5}
              autoLabel={STRINGS.devAuto}
              read={STRINGS.devSeaValue}
              onChange={(hs) => setDev({ hs })}
              onHint={setHint}
            />
          </KnobGroup>
        </div>
      </div>
      <Caption hint={hint} fallback={STRINGS.devCaption} />
      {/* THE STOPWATCH, under the rows rather than among them: it is not a
          setting, it is a press that takes the canvas for thirty seconds. */}
      <button type="button" class="menu-item menu-item-dev" onClick={onBenchmark}>
        {STRINGS.benchTitle}
        <span class="menu-item-sub">
          {/* The field the PLAN's mode puts on the water, plus the rider the
              card stands over — never the race's own number, which would go
              on saying twelve the day the benchmark was pinned to a time
              trial. */}
          {STRINGS.benchRowHint(benchmarkSeconds(), MODE_RULES[BENCHMARK.mode].rivals + 1)}
        </span>
      </button>
      <button type="button" class="menu-item menu-item-dev" onClick={onBenchmarkHistory}>
        {STRINGS.benchHistoryTitle}
        <span class="menu-item-sub">{STRINGS.benchHistoryRowHint(benchmarkRuns().length)}</span>
      </button>
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
          the MENU looks like rather than what the run does. Last, and styled
          as the quiet one: a page of tools should not put its own trapdoor
          where a thumb reaching for a fader lands. */}
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
    </div>
  );
}
