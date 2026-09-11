// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT THE HUD READS, taken off the state about twelve times a second. The
// canvas is the sixty-frame surface; the HUD is not, and a readout that
// re-rendered every frame would spend more on the DOM than on the sea. So
// the loop takes THIS every ~80 ms and the HUD draws from it. DOM-free —
// a snapshot is numbers, and the same numbers a lab could print.
//
// Nothing in here decides anything: the speed is the engine's `speed`, the
// rev fraction is against the engine's own redline, the gate count is the
// progress the engine keeps. A number that decided an outcome would be a
// rule in the shell (§23.2), and there are none.

import {
  TUNING,
  biomeOf,
  gatesReached,
  maxRpm,
  sunHourAt,
  windAt,
  type CraftId,
  type GameState,
} from "@engine";

import { daylightOf, lampsAt, sunOver, type Daylight } from "./daylight.ts";
import { SCREEN_TO_ENGINE } from "./input-model.ts";
import { buildMinimap, type HudMinimap } from "./minimap-view.ts";

/** The gate's share past which the HUD says the brake is on — the same
 * rung the spray starts its boil at — and the way, m/s, a craft must be
 * making astern before the word changes to REVERSE. */
const BRAKE_SHOWN = 0.05;
const ASTERN_FROM = 0.3;

export type HudSnapshot = {
  speedKmh: number;
  /** Revs as a share of the redline, 0..1, and where idle sits on the
   * same scale — the bar starts there. */
  rpm: number;
  idle: number;
  /** THE BRAKE: whether the reverse bucket is down over the jet — the
   * engine's own reading of the gate, not the lever — and, while it is,
   * whether the craft is already going ASTERN. The rev bar reads these to
   * say so: on the keys the lever is a bar with no light of its own, and a
   * rider who cannot see the pool the gate boils up has nothing else to
   * tell them the only brake the craft has is on. */
  braking: boolean;
  astern: boolean;
  /** The run clock, s, and whether it has stopped. */
  time: number;
  finished: boolean;
  /** THE SUN'S CLOCK: the hour the run has reached (`sunHourAt`, an hour a
   * minute from the level's own), and the word for its light — which is
   * the astronomy's word (`daylightOf`), the same one the sky keys on. */
  hour: number;
  daylight: Daylight;
  /** HOW FAR THE CHROME IS DIPPED, 0..1 — the HUD's night dressing, and
   * nothing is DRAWN from it: it goes on the HUD root as `--hud-dark` and
   * the dressing in styles.css is what reads it. Every colour on that
   * screen was mixed to hold over a bright sea at noon — pure white ink, a
   * hard navy drop under it, plates in the arcade's own blue — and over a
   * coast lit by nothing but the craft's own lamp the same chrome has
   * several times the contrast it needs and spends the surplus as glare.
   * This is how much of that surplus is handed back.
   *
   * IT IS THE LAMP SWITCH (`lampsAt`), not a threshold of the HUD's. That
   * is the wire a real machine has — a cluster dips off the lamp switch,
   * never off a light meter — and a second opinion about when it is dark
   * is one that can drift from the light the rider is actually riding by.
   * It also rules out the one reading that looks right and is not: the
   * astronomy's WORD. A taiga winter noon at 62°N is a sun 8.9° up, which
   * is "dusk" by the bands in daylight.ts and broad daylight in the frame
   * — dressing the HUD down there would dim it against the brightest hour
   * that seed ever sees.
   *
   * And unlike the sibling rally game's, which dips on ONE frame because
   * its headlamps are a switch, this RAMPS: our lamps come up over the
   * four degrees either side of the horizon (`lampsAt`), so the cluster
   * comes down with them. A HUD that stepped while the lamp faded would
   * read as two machines. */
  dark: number;
  /** Gates passed (missed ones count as reached) and gates in the course. */
  passed: number;
  gates: number;
  /** R30 — which lap is being ridden and how many there are. Both 1 on a
   * coast sprint, which is what the HUD reads to leave the chip out. */
  lap: number;
  laps: number;
  /** The wind at the craft: the SCREEN angle its arrow points along, rad
   * clockwise from straight up (the direction it blows TO, relative to the
   * craft's nose), and its speed, m/s. */
  windAngle: number;
  windMs: number;
  airborne: boolean;
  /** THE AIR CLOCK, s — the flight so far, and 0 until it has lasted
   * `flight.airCounts`. A hop off a crest is not air time, and a readout
   * that counted it would flicker through a whole head sea, so
   * the clock starts at the line rather than at the water. `airborne` is
   * the hull's own truth and stays honest: the spray and the sound read
   * the state, this is what is READ OUT. */
  airTime: number;
  seed: number;
  craft: CraftId;
  /** The minimap for this frame — the coast around the craft, the gates on
   * it and the run's share of them (minimap-view.ts). The one readout here
   * that is a PICTURE, so it is built rather than measured, but it is built
   * from the state like every other field and decides nothing. */
  minimap: HudMinimap;
};

export function takeSnapshot(state: GameState): HudSnapshot {
  const c = state.craft;
  const p = state.progress;
  const wind = windAt(state.wind, Math.max(0, c.y), c.x, c.z);
  const blowsTo = Math.atan2(wind.vx, wind.vz);
  const hour = sunHourAt(state.level, state.t);
  const sun = sunOver(hour, biomeOf(state.level.biome).latitude, state.level.season);
  return {
    hour,
    daylight: daylightOf(sun),
    // Quantised to a hundredth: the sun moves an hour a minute, so the dip
    // takes about a minute and a half of riding end to end, and a style
    // recalculation of the whole HUD on every one of the snapshot's twelve
    // ticks a second buys nothing an eye can see.
    dark: Math.round(lampsAt(sun.elevation) * 100) / 100,
    speedKmh: c.speed * 3.6,
    rpm: c.rpm / maxRpm(c.spec),
    idle: c.spec.idleRpm / maxRpm(c.spec),
    braking: c.bucket > BRAKE_SHOWN,
    // The way it points, signed — `speed` is |v| and cannot tell astern
    // from ahead; the same reading the wake's road closes on.
    astern:
      c.bucket > BRAKE_SHOWN &&
      c.vx * Math.sin(c.heading) + c.vz * Math.cos(c.heading) < -ASTERN_FROM,
    time: p.time,
    finished: p.finished,
    passed: gatesReached(p),
    gates: state.level.course.gates.length,
    // The final crossing of the start line belongs to the last lap rather
    // than to a lap after it: the race is over on it, not begun.
    lap: Math.min(
      state.level.course.laps,
      Math.floor(p.nextGate / state.level.course.lapGates) + 1,
    ),
    laps: state.level.course.laps,
    // Relative to the nose, then onto the screen: the engine's clockwise
    // is the screen's counter-clockwise (input-model.ts).
    windAngle: (blowsTo - c.heading) * SCREEN_TO_ENGINE,
    windMs: Math.hypot(wind.vx, wind.vz),
    airborne: c.airborne,
    airTime: c.airTime > TUNING.flight.airCounts ? c.airTime : 0,
    seed: state.seed,
    craft: c.spec.id,
    minimap: buildMinimap(state),
  };
}
