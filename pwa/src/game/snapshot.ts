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
  activeMissedCheckpoint,
  biomeOf,
  gatesReached,
  maxRpm,
  racePlace,
  sampleField,
  sunHourAt,
  windAt,
  type CraftId,
  type GameState,
  type TrickPart,
} from "@engine";

import { daylightOf, lampsAt, sunOver, type Daylight } from "./daylight.ts";
import { SCREEN_TO_ENGINE } from "./input-model.ts";
import { buildMinimap, type HudMinimap } from "./minimap-view.ts";

/** The gate's share past which the HUD says the brake is on — the same
 * rung the spray starts its boil at — and the way, m/s, a craft must be
 * making astern before the word changes to REVERSE. */
const BRAKE_SHOWN = 0.05;
const ASTERN_FROM = 0.3;

/** THE AIR CLOCK'S OWN NUMBERS.
 *
 * The readout grows over TWO ranges with a knee between them, because the
 * flights it has to cover span two orders. `AIR_KNEE` is the flight, s, a
 * rider reads as a big one — five seconds, well past any ramp on the course
 * — and the tile spends `KNEE_SHARE` of its whole growth getting there, so
 * every second of an ordinary jump is worth something on screen. Past it the
 * range runs on to `AIR_BIG`, twenty seconds, which is not a jump at all but
 * a rider thrown by the open ocean or taken by the tornado: the last of the
 * size is spread thin over it, so the top stays reachable and almost never
 * reached. At the line a flight starts counting at (`flight.airCounts`) the
 * tile is at its floor — half a second in the air is not news.
 *
 * `AIR_HOLD` is how long the record stays on screen after the landing that
 * set it — long enough to read the number and see the word, not long enough
 * to still be there at the next buoy. It is read against the engine's own
 * clock (`progress.bestAirAt`), so nothing here keeps time.
 *
 * How much bigger the tile is DRAWN at the top of the range is the styling's
 * to say (`.hud-air` in `styles.css`); this hands it the share. */
const AIR_KNEE = 5;
const AIR_BIG = 20;
const KNEE_SHARE = 0.7;
const AIR_HOLD = 2.4;

/** THE COMBO'S HOLD, s — how long the figure a combo resolved at stays on
 * screen after it banked or was thrown away. Shorter than the air record's:
 * that one is a run-long best worth reading twice, this is the receipt for
 * the moment just gone, and the next flight is usually seconds away. Read
 * against `tricks.lastAt`, the engine's own clock, so nothing here keeps
 * time. */
const COMBO_HOLD = 1.6;

/** THE ALTIMETER'S SCALE — where a height in metres sits on the tape.
 *
 * The tape has to carry three readings that span two orders: a hull riding
 * a sea, which swings a metre or two either side of the still plane; a
 * flight off a ramp or a crest, which is a handful of metres; and the
 * column past the ocean's far edge (`tornado.ts`), which lifts a rider tens
 * of metres. A straight scale over the last of those makes the first two
 * one motionless pixel.
 *
 * So: the still-water line stands a quarter of the way up at `ALT_ZERO`,
 * with the TROUGHS under it running to `ALT_DOWN` at the foot — a rider on
 * the open ocean is genuinely below the plane he measures from, and the
 * swing between the two is how big that sea is. Above it are two straight
 * runs with a knee, exactly as the air clock's growth has: `KNEE_SHARE` of
 * the remaining track is spent reaching `ALT_KNEE`, a good jump, so every
 * metre of an ordinary one MOVES; the rest is spread thin out to `ALT_BIG`,
 * which is not a jump at all but a rider taken by the tornado — twenty-odd
 * metres at the shipped class and about twice that at the top of the class
 * band, since the column's apex goes as the class squared (`defs/sea.ts`).
 * The top is therefore reachable and almost never reached.
 *
 * And the FIGURE beside the marker is exact at every height on here, so the
 * compression costs no precision — only travel. */
const ALT_DOWN = 5;
export const ALT_ZERO = 0.24;
const ALT_KNEE = 6;
const ALT_BIG = 60;
const ALT_KNEE_SHARE = 0.7;

/** THE PEAK'S FLOOR, m — how high the run has to have been before the tape
 * carries a high-water tick. A brisk sea lifts a hull a metre and a half
 * just by being a sea, and a mark that read the chop would sit against the
 * zero line all run saying nothing. Two metres is clear of every sea a
 * sheltered coast deals and short of every ramp on the course, so the tick
 * arrives on the first jump and on nothing else. */
const ALT_PEAK_SHOWN = 2;

/** Where `m` metres above still water sits on the tape, 0 at its foot and
 * 1 at its top. Exported because the tape draws its own still-water line
 * off the same scale (`hud-dial.tsx`), and a second opinion about where
 * zero is would be a zero line the marker does not agree with. */
export function altitudeShare(m: number): number {
  if (m <= 0) return ALT_ZERO * (1 - Math.min(1, -m / ALT_DOWN));
  const above = 1 - ALT_ZERO;
  if (m <= ALT_KNEE) return ALT_ZERO + above * ALT_KNEE_SHARE * (m / ALT_KNEE);
  const past = Math.min(1, (m - ALT_KNEE) / (ALT_BIG - ALT_KNEE));
  return ALT_ZERO + above * (ALT_KNEE_SHARE + (1 - ALT_KNEE_SHARE) * past);
}

/** How long GO stays on screen after the lights go out, s of run clock. */
const GO_HOLD = 1;

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
  /** THE CLOCK RUNNING DOWN: on a timed run (`rules.limit`), the seconds
   * left rather than the seconds gone — what the clock reads, with LEFT
   * for its caption. Null on a run that ends at a finish line. */
  left: number | null;
  /** THE LIGHTS: the whole second showing (3, 2, 1) while they hold the
   * field, and 0 once they are out — or on a run that never had any. `go`
   * is the moment after: true for `GO_HOLD` seconds of the run clock on a
   * run that had lights, read off the engine's clock so nothing here keeps
   * time. */
  countdown: number;
  go: boolean;
  /** WHAT THIS RUN IS PLAYING FOR (`rules`): whether the gates count and
   * whether the tricks do. A chip for a thing the run is not counting is a
   * chip that says nothing, so the HUD leaves each out. */
  courseOn: boolean;
  tricksOn: boolean;
  /** THE FIELD: where the rider stands in it, 1-based, and how many are in
   * it, the rider included. 1 of 1 on a run alone, which is what the HUD
   * reads to leave the chip out. */
  place: number;
  riders: number;
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
  /** Metres back to the most recent missed checkpoint, or null once the
   * craft has returned to its opening. */
  missedDistance: number | null;
  /** HOW FAR OUT THE RIDER IS, m from the water's edge — the level's own
   * `offshore` field read at the craft, which is the ONE answer to that
   * question in this tree (the wave model reads it as fetch, the course
   * rules bound it, the tornado's column is sized off it). Nothing is
   * measured here.
   *
   * Clamped at zero, because the field is signed — it runs negative inland
   * — and a hull beached on the sand is AT the shore rather than a
   * negative distance from it. The far end is the field's own: every baked
   * field holds its rim's reading past the bound, so a rider who turns his
   * back on the level and rides out into the open ocean sees the figure
   * stop climbing rather than carry on. That is the same reading the
   * tornado's column takes out there, deliberately, and a second opinion
   * worked out from the coastlines would be this HUD keeping a formula. */
  shoreDistance: number;
  /** R30 — which lap is being ridden and how many there are. Both 1 on a
   * coast sprint, which is what the HUD reads to leave the chip out. */
  lap: number;
  laps: number;
  /** The wind at the craft: the SCREEN angle its arrow points along, rad
   * clockwise from straight up (the direction it blows TO, relative to the
   * craft's nose), and its speed, m/s. */
  windAngle: number;
  windMs: number;
  /** THE ALTIMETER, m above still water (`CraftState.altitude`) — signed,
   * and the engine's own reading rather than anything worked out here.
   * This is the FIGURE that rides beside the tape's marker. */
  altitude: number;
  /** ...and where that marker sits on the tape, 0..1 (`altitudeShare`).
   * The travel is compressed and the figure is not, so the shape says how
   * big the moment is and the number says exactly how big. */
  altitudeShare: number;
  /** The run's high-water tick, 0..1 on the same scale — or −1 when the run
   * has not yet been above `ALT_PEAK_SHOWN` and the tape carries no mark.
   * A share rather than the metres, because nothing draws the figure: it is
   * a line on the track. */
  altitudePeakShare: number;
  airborne: boolean;
  /** THE AIR CLOCK, s — the flight so far, and 0 until it has lasted
   * `flight.airCounts`. A hop off a crest is not air time, and a readout
   * that counted it would flicker through a whole head sea, so
   * the clock starts at the line rather than at the water. `airborne` is
   * the hull's own truth and stays honest: the spray and the sound read
   * the state, this is what is READ OUT. */
  airTime: number;
  /** How far the clock has grown, 0..1 from the line (`flight.airCounts`) to
   * a flight worth the whole size — the one readout that says how big the
   * moment is by how big it IS. */
  airGrow: number;
  /** THE RUN'S BEST, being flown or just flown: true while the clock above
   * is on course to beat `progress.bestAir`, and for a moment after the
   * landing that took it, which is the moment the clock is HOLDING rather
   * than running. What makes the readout stick and pulse, and what puts the
   * word beside it. */
  airRecord: boolean;
  /** THE SCORE, banked (`tricks.score`) — the run's other total, and the
   * only number on this screen the clock has no opinion about. */
  score: number;
  /** THE COMBO: what is riding on the rider staying on the craft, and the
   * multiplier it will be paid at. `combo` is 0 with nothing in hand.
   * `comboPhase` is what the tile is showing — a combo still building, or
   * the figure the last one resolved at, held for `COMBO_HOLD`.
   *
   * `comboParts` is what it is MADE of, and it is handed over as the
   * engine's own elements rather than as a line of text: the words are the
   * strings table's (§39.1) and the HUD asks it for them. Empty with
   * nothing in hand, and it follows the figure through the hold — the
   * receipt says what was banked AND what for. */
  combo: number;
  mult: number;
  comboPhase: "live" | "banked" | "bailed";
  comboParts: readonly TrickPart[];
  seed: number;
  craft: CraftId;
  /** The minimap for this frame — the coast around the craft, the gates on
   * it and the run's share of them (minimap-view.ts). The one readout here
   * that is a PICTURE, so it is built rather than measured, but it is built
   * from the state like every other field and decides nothing. */
  minimap: HudMinimap;
};

/** THE AIR CLOCK: what it reads, how big it is drawn, and whether it is
 * showing a record.
 *
 * A flight under `flight.airCounts` is a hop off a crest and not air time at
 * all, so the clock is 0 through it. Past the line it reads the flight, and
 * once the flight has beaten the run's best it says so WHILE IT IS STILL IN
 * THE AIR — the rider knows he is on one before he has landed it, which is
 * the whole point of putting the number over the nose.
 *
 * Then it STICKS. `progress.bestAirAt` is the run clock the record landed
 * at, so the readout holds the winning number for `AIR_HOLD` seconds off the
 * engine's own time rather than starting a timer of its own — and a hold
 * interrupted by the next flight simply loses to it, because a live clock is
 * always the better news. */
/** How far the air clock has grown, 0..1, for a flight of `time` seconds
 * counted from `line`. Two straight runs with a knee at `AIR_KNEE`: steep
 * to there so an ordinary jump grows visibly second by second, shallow past
 * it so the seconds only the open ocean deals still have somewhere to go.
 * A single straight line across the whole range would spend nearly all of
 * its size on flights nobody flies; a single curve would have no flight a
 * rider could point at as the moment it stops climbing. */
function airGrow(time: number, line: number): number {
  if (time <= line) return 0;
  if (time <= AIR_KNEE) return (KNEE_SHARE * (time - line)) / (AIR_KNEE - line);
  const past = Math.min(1, (time - AIR_KNEE) / (AIR_BIG - AIR_KNEE));
  return KNEE_SHARE + (1 - KNEE_SHARE) * past;
}

function airClock(state: GameState): { time: number; grow: number; record: boolean } {
  const c = state.craft;
  const p = state.progress;
  const line = TUNING.flight.airCounts;
  const live = c.airTime > line ? c.airTime : 0;
  const held = p.bestAir > 0 && state.t - p.bestAirAt < AIR_HOLD;
  const time = live > 0 ? live : held ? p.bestAir : 0;
  return {
    time,
    grow: airGrow(time, line),
    record: live > 0 ? p.bestAir > 0 && live > p.bestAir : held,
  };
}

/** WHAT THE COMBO TILE READS. While one is building it is the live figure
 * and its multiplier — `base × mult`, the number the rider is watching
 * climb. When the combo closes there is nothing live to show and the tile
 * holds what it resolved at for a moment, which is the one reading a rider
 * cannot take himself: he is looking at the water by then.
 *
 * The multiplier is dropped in the held state on purpose. `points` is
 * already `base × mult` and the combo is over; a ×4 still standing beside a
 * figure nothing is multiplying any more reads as a combo still running. */
function comboTile(
  state: GameState,
): Pick<HudSnapshot, "combo" | "mult" | "comboPhase" | "comboParts"> {
  const k = state.tricks;
  if (k.base > 0) {
    return {
      combo: Math.round(k.base * k.mult),
      mult: k.mult,
      comboPhase: "live",
      comboParts: k.parts,
    };
  }
  if (k.last > 0 && state.t - k.lastAt < COMBO_HOLD) {
    return {
      combo: k.last,
      mult: 1,
      comboPhase: k.lastBailed ? "bailed" : "banked",
      comboParts: k.lastParts,
    };
  }
  return { combo: 0, mult: 1, comboPhase: "live", comboParts: [] };
}

export function takeSnapshot(state: GameState): HudSnapshot {
  const c = state.craft;
  const p = state.progress;
  const wind = windAt(state.wind, Math.max(0, c.y), c.x, c.z);
  const blowsTo = Math.atan2(wind.vx, wind.vz);
  const hour = sunHourAt(state.level, state.t);
  const sun = sunOver(hour, biomeOf(state.level.biome).latitude, state.level.season);
  const air = airClock(state);
  const missed = activeMissedCheckpoint(state);
  return {
    ...comboTile(state),
    score: state.tricks.score,
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
    left: state.rules.limit > 0 ? Math.max(0, state.rules.limit - p.time) : null,
    countdown: state.phase === "countdown" ? Math.ceil(state.countdown) : 0,
    go: state.rules.countdown > 0 && state.phase !== "countdown" && p.time < GO_HOLD,
    courseOn: state.rules.course,
    tricksOn: state.rules.tricks,
    place: racePlace(state),
    riders: state.rivals.length + 1,
    passed: gatesReached(p),
    gates: state.level.course.gates.length,
    missedDistance: missed?.distance ?? null,
    shoreDistance: Math.max(0, sampleField(state.level.offshore, c.x, c.z)),
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
    altitude: c.altitude,
    altitudeShare: altitudeShare(c.altitude),
    altitudePeakShare: p.peakAltitude >= ALT_PEAK_SHOWN ? altitudeShare(p.peakAltitude) : -1,
    airborne: c.airborne,
    airTime: air.time,
    airGrow: air.grow,
    airRecord: air.record,
    seed: state.seed,
    craft: c.spec.id,
    minimap: buildMinimap(state),
  };
}
