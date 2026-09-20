// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DEVELOPER PAGE: out of the way of a player who never found it (hold
// the craft card's turning hull for seven seconds — `DEV_HOLD_MS`), and
// blunt for one who did.
//
// EVERY ROW HERE IS A URL PARAMETER `App.tsx` ALREADY READS. That is the rule
// for anything added, not a coincidence about what happened to be easy: a
// developer setting exists to reach, from inside the game, a frame that could
// otherwise only be reached by typing a query string — so a frame somebody
// FINDS by poking at this page can always be handed to somebody else as a
// link. COPY REPRO LINK is the other half of that bargain, and the reason the
// page is worth having at all rather than more URL parameters nobody can
// remember.
//
// WHAT THE PAGE DOES NOT CARRY IS A SECOND SET OF FADERS FOR THE RUN. The
// shore, the staged moment and the water a run is stood up in are `?seed=`,
// `?scene=`, `?wind=` and `?hs=` — still read on boot, still carried by the
// repro link — and the start card already owns the seed and the day as
// rows a PLAYER turns. Two places to turn one dial is two answers to one
// question the first time they disagree, so the tools stay here and the
// dials stay where the game keeps them.
//
// The rows are the KNOBS (`menu-knobs.tsx`), shared with OPTIONS, the start
// card and the pause strip: a row picked here and a camera picked there have
// to be the same kind of row, or the page reads as a different program bolted
// onto the side of the game. Their sentences go to the ONE caption bar at the
// foot, which is what lets a page of tools stay a page rather than a booklet.
//
// UNLOCKS is the one press here that changes the SAVE rather than the run
// (`menu-unlocks.tsx`), and it is a page of its own for the room it needs.
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
import { campaignStanding, type CampaignProgress } from "./campaign.ts";
import { MenuHead } from "./menu.tsx";
import { Caption, type Hint, KnobGroup, ON_OFF, StepRow, onOff } from "./menu-knobs.tsx";
import { DEFAULT_SEED, freshSettings, type Settings } from "./settings.ts";
import { STRINGS } from "./strings.ts";

/** How long a copy button wears its receipt before going back to its label. */
const SAID_MS = 2000;

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
  // The start card's own weather rows travel as well — the hour, the wind,
  // the sea outside, the sky — because a link that
  // dropped them would stand the frame up under different weather from the
  // one it was copied out of, which is the one thing a repro link may never
  // do. Each is a FIGURE where the row stores one, which is the same spelling
  // `url-params.ts` reads back.
  if (ride.time !== null) params.set("time", ride.time);
  if (ride.wind !== null) params.set("day", String(ride.wind));
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
  progress,
  onSettings,
  onBack,
  onUnlocks,
  onBenchmark,
  onBenchmarkHistory,
}: {
  settings: Settings;
  /** The campaign's board, for the one figure the UNLOCKS row bills itself
   * with. The page that SETS it is `menu-unlocks.tsx`. */
  progress: CampaignProgress;
  onSettings: (settings: Settings) => void;
  onBack: () => void;
  /** Open or shut the campaign's shores. */
  onUnlocks: () => void;
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
  const standing = campaignStanding(progress);

  return (
    <div class="menu-card menu-card-options" onPointerLeave={() => setHint(null)}>
      <MenuHead back={onBack} backLabel={STRINGS.menuBack} title={STRINGS.menuDeveloper} />
      {/* ONE GROUP, FULL WIDTH — no `knob-groups` wrapper, because the two
          columns it deals on a wide screen are OPTIONS' answer to a page of
          twenty rows and would leave this one row sitting in half a card
          with the presses under it running the whole width. */}
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
      <Caption hint={hint} fallback={STRINGS.devCaption} />
      {/* THE SAVE, not the run: the one press on this page that changes what
          the campaign card says has been ridden. */}
      <button type="button" class="menu-item menu-item-dev" onClick={onUnlocks}>
        {STRINGS.unlocksTitle}
        <span class="menu-item-sub">{STRINGS.unlocksRowHint(standing.cleared, standing.of)}</span>
      </button>
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
