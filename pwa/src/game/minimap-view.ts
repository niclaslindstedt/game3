// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT STANDS ON THE MINIMAP — everything that moves or changes, over the
// schematic the coast is drawn as (minimap-scene.ts).
//
// The window travels with the craft, so every mark here is a mark that may
// be off the edge of it, and each one answers that differently:
//
//   the CRAFT is always in the middle, because the middle is where the
//   window is centred — it is the only glyph that cannot leave;
//
//   a GATE simply goes when it leaves the box. A buoy pair three hundred
//   metres away pinned to the rim is a gate the rider would look for and not
//   find;
//
//   the GATE THE RUN STILL OWES never goes. It is the one place on the water
//   the run has to reach next, and a rider blown off the line with no buoy
//   in sight is exactly who needs it, so once it is off the window it rides
//   the rim as a chevron pointing at where it is.
//
// DOM-free, like every HUD payload here: this module decides, `minimap.tsx`
// draws, and `tests/minimap_test.ts` reads this half without a browser.

import { bearingToNext, gateBuoys, gatesReached, type GameState } from "@engine";

import {
  SPAN,
  VIEW,
  inView,
  minimapScene,
  project,
  spanFor,
  type MinimapScene,
} from "./minimap-scene.ts";
import { STRINGS } from "./strings.ts";

/** How far inside the frame a marker driven off the window rides, view
 * units — clear of the gauge ring's own stroke. */
const RIM = 9;

/** How far a gate has to be off the window before its chevron is drawn at
 * all, m. Zero would flicker the mark between the ring and the rim on the
 * frame the gate crosses the edge; a few metres of hysteresis is invisible
 * and the flicker is not. */
const RIM_SLACK = 4;

/** Where the run stands against one gate. `next` is the one being ridden
 * for; `missed` is one the rider went past and was charged for, which stays
 * on the map because knowing you left one behind is worth more than a tidy
 * picture. */
export type GateMark = {
  index: number;
  kind: "water" | "air";
  /** The gate's centre, in view units. */
  x: number;
  y: number;
  /** A water gate's two buoys, in view units — the line to be crossed,
   * projected rather than reconstructed from a heading, so a gate on the
   * map is the same line the engine tests a crossing against. Empty for an
   * air gate, which is a ring and has no line. */
  buoys: [number, number][];
  /** An air gate's ring radius, view units. Zero for a water gate. */
  radius: number;
  state: "passed" | "missed" | "next" | "ahead";
};

/** The gate the run owes, once it is outside the window: the point is then
 * on the rim rather than on the gate, and `angle` (degrees clockwise, zero
 * pointing up-screen) is the way to it. */
export type MinimapChevron = { x: number; y: number; angle: number };

/** The run's two ends, drawn while the window holds them: where the craft
 * was launched from, and the line it is riding for. */
export type MinimapEnd = { x: number; y: number; kind: "start" | "finish" };

export type HudMinimap = {
  /** The coast around the craft, as paths (minimap-scene.ts). */
  scene: MinimapScene;
  /** The gates the window holds, in course order. */
  gates: GateMark[];
  /** The craft's heading, degrees clockwise for the icon. It stands at the
   * middle of the box by construction, so there is no position to carry. */
  heading: number;
  /** Where the next gate is, when it is off the window; null while it is on
   * it (the gate's own mark carries it then) and on a finished run. */
  chevron: MinimapChevron | null;
  ends: MinimapEnd[];
  /** Gauge fill, 0..1 — the share of the course's gates that has been
   * reached, missed ones included, which is exactly what the HUD's own gate
   * counter says in figures. */
  progress: number;
  /** The readout on the frame's bottom edge: how far the next gate is. The
   * window no longer holds the whole course, so how much of it is LEFT is
   * not something the picture can be read for — the ring says what share is
   * done and this says what the next leg is worth in metres. */
  label: string;
};

/** Put a point that is off the window onto its rim, with the bearing to it.
 * The scale is the box's, not the point's distance, so a gate a kilometre
 * away and one just past the edge both sit on the same rim. */
function onRim(x: number, y: number): MinimapChevron {
  const dx = x - VIEW / 2;
  const dy = y - VIEW / 2;
  const half = VIEW / 2 - RIM;
  const t = Math.min(half / Math.max(1e-3, Math.abs(dx)), half / Math.max(1e-3, Math.abs(dy)));
  return {
    x: VIEW / 2 + dx * t,
    y: VIEW / 2 + dy * t,
    // SVG's rotation is clockwise from up-screen, and up-screen is -y.
    angle: (Math.atan2(dx, -dy) * 180) / Math.PI,
  };
}

/** Where the run stands against a gate. A gate is `passed` once it is in the
 * book, `missed` once it has been charged for, `next` while it is the one
 * being ridden for, and `ahead` after that. */
function gateState(state: GameState, index: number): GateMark["state"] {
  const p = state.progress;
  if (p.missed.includes(index)) return "missed";
  if (p.passed.includes(index)) return "passed";
  return index === p.nextGate ? "next" : "ahead";
}

/** The gates the window holds. A course is a dozen gates, so this walks all
 * of them and keeps the ones on the map — cheaper than any structure that
 * would save the walk, and it never has to be kept in step with one.
 *
 * R30 — ONE LAP of them, and the lap being ridden. A lapped course lists
 * the same buoys once a lap, all at the same place: walked whole, every
 * mark on the map is drawn over by a later lap's copy of itself, which is
 * always still ahead, and the map shows a race where nothing has been taken
 * yet. A coast course is one lap of everything, so this is the same walk it
 * always was. */
function gateMarks(state: GameState, span: number): GateMark[] {
  const out: GateMark[] = [];
  const k = VIEW / span;
  const { gates, lapGates, laps } = state.level.course;
  const lap = Math.min(Math.floor(state.progress.nextGate / lapGates), laps - 1);
  for (let slot = 0; slot < lapGates; slot++) {
    const gate = gates[lap * lapGates + slot];
    const at = project(state, gate.x, gate.z, span);
    if (!inView(at)) continue;
    out.push({
      index: gate.index,
      kind: gate.kind,
      x: at[0],
      y: at[1],
      buoys: gateBuoys(gate).map((b) => project(state, b.x, b.z, span)),
      radius: gate.kind === "air" ? (gate.width / 2) * k : 0,
      state: gateState(state, gate.index),
    });
  }
  return out;
}

/** The next gate's chevron, once the gate is off the window. Null while it is
 * on it, and on a finished run — a run with nothing left to ride for has
 * nowhere to point. */
function chevronFor(state: GameState, span: number): MinimapChevron | null {
  const gates = state.level.course.gates;
  const n = state.progress.nextGate;
  if (n >= gates.length) return null;
  const at = project(state, gates[n].x, gates[n].z, span);
  const slack = RIM_SLACK * (VIEW / span);
  const on = at[0] >= -slack && at[0] <= VIEW + slack && at[1] >= -slack && at[1] <= VIEW + slack;
  return on ? null : onRim(at[0], at[1]);
}

/** The run's two ends, where the window holds them. The finish is the last
 * gate — the place the run actually ends, which is the gate's own line and
 * not a point past it. */
function endMarks(state: GameState, span: number): MinimapEnd[] {
  const out: MinimapEnd[] = [];
  const start = project(state, state.level.start.x, state.level.start.z, span);
  if (inView(start)) out.push({ x: start[0], y: start[1], kind: "start" });
  const gates = state.level.course.gates;
  const last = gates[gates.length - 1];
  const finish = project(state, last.x, last.z, span);
  if (inView(finish)) out.push({ x: finish[0], y: finish[1], kind: "finish" });
  return out;
}

/** The HUD's minimap payload for this frame. */
export function buildMinimap(state: GameState): HudMinimap {
  // The window breathes with the speedo, so what it holds is a roughly
  // constant amount of NOTICE rather than a constant piece of sea. The
  // speedo's own reading, which is |v| with the vertical in it: a hull
  // dropping off a wave is not covering ground any faster, but it is a hull
  // whose next second happens further away, and the map that opens for it is
  // the map that was useful.
  const span = spanFor(SPAN, state.craft.speed * 3.6);
  const bearing = bearingToNext(state);
  const total = state.level.course.gates.length;
  return {
    scene: minimapScene(state, span),
    gates: gateMarks(state, span),
    // Screen space runs the heading backwards (see minimap-scene.ts's sign
    // boundary), so the icon's clockwise rotation is the negated heading.
    heading: -state.craft.heading * (180 / Math.PI),
    chevron: chevronFor(state, span),
    ends: endMarks(state, span),
    // The gauge and the HUD's own `n / N` are the same reading in two forms,
    // so both ask the engine for it rather than each summing the book.
    progress: total === 0 ? 0 : Math.min(1, gatesReached(state.progress) / total),
    label: bearing === null ? STRINGS.mapAtFinish : STRINGS.mapToNext(bearing.distance),
  };
}
