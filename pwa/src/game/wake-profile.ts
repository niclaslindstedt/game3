// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WAKE'S SHAPE — what a hull's passage does to a cross-section of the
// water behind it, by how fast it went and how long ago. Three-free and
// DOM-free so `tests/wake_test.ts` can hold the claims below; `wake.ts`
// lays these sections along the trail and rasterises them into the map the
// water shader reads.
//
// The reference is the aerial photograph of a runabout at speed: three
// things in it, each with its own life.
//
//   THE ROAD   the jet's churned white core, about a beam wide, solid at the
//              transom and lasting several seconds — long enough that the
//              trail behind a craft at pace runs out of the picture before
//              it runs out of white — breaking into mottled patches as the
//              bubbles pop rather than paling evenly.
//   THE BOIL   the bulb right behind the transom, wider than the road,
//              where the jet's hole collapses and the chine sheets land: the
//              widest, whitest, most turbulent water in the picture, and
//              gone in under a second, which is what necks the road in
//              behind it.
//   THE FAN    the V either side, Kelvin's angle whatever the speed. At the
//              transom it is a pair of rails — the diverging crests — with
//              water the hull has merely aerated between them; with AGE the
//              rails break inward until the whole wedge is broken white,
//              and the wedge KEEPS OPENING the length of the trail. It is
//              the fan, not the road, that carries most of the white in an
//              aerial photograph, and it outlives the boil by many seconds:
//              the trail leaves the frame still white rather than fading
//              out inside it.
//
// Each section carries four things the map has a channel for: FOAM (the
// white share, drawn by the water's own foam term), CHURN (how broken the
// surface is — it bends the reflection, lightens the body and animates the
// foam), and a hollow and a crest (the surface displaced down or up, m —
// and SIDEWAYS along the slope between them, so the transom's trough
// shoves the surface outward and the bow wave piles it on its crest).
// Foam is gated to pace and the pump the way a real road is; the churn and
// the displacement start from a crawl, because a hull pushed through water
// disturbs it long before it whitens it.

import { TUNING } from "@engine";

import { clamp } from "../lib/util.ts";

/** Kelvin's angle — the half-angle of the V a hull's diverging waves make,
 * whatever the hull and whatever its speed — as its tangent (19.47°). */
export const KELVIN_TAN = 0.3536;

/** Below this along-track speed, m/s, the pump churns no white; the road's
 * strength ramps to full over `SPEED_FULL`. */
export const SPEED_MIN = 2.5;
export const SPEED_FULL = 14;
/** The speed, m/s, at which the disturbance itself — the churn, the hollow,
 * the fan's crest — is at full strength. */
export const WASH_FULL = 8;

/** How long the road's white lives, s, and the power its fade runs on —
 * steep at first, then a long pale tail. The LIFE is what the reference
 * photographs are about: a road still visible where it leaves the frame.
 * The POWER must stay above one all the same, because the lace only cuts
 * holes in the road once its share has come off full — hold the road near
 * 1 for two seconds and the whole of it is a flat white blanket with no
 * tile in it, which is what a 3× capture at the transom shows and a 1280 px
 * frame does not. */
export const ROAD_LIFE = 7;
const ROAD_FADE_POWER = 1.2;
/** The road's half-width at the transom as a share of the beam, what a m/s
 * of pace adds to it, m, and how fast it spreads with age, m/s. The road is
 * the THIN bright line down the middle of the photograph — what opens is
 * the fan round it — so it spreads slowly. */
const ROAD_HALF_BEAM = 0.42;
const ROAD_HALF_PER_SPEED = 0.008;
const ROAD_SPREAD = 0.12;
/** Where the road's flat top ends, as a share of its half-width; outside it
 * the section feathers to nothing. */
const ROAD_CORE = 0.55;
/** How long the boil lives, s, and how much wider than the road it is at
 * the transom, as a share of the beam. */
export const BOIL_LIFE = 0.9;
const BOIL_HALF_BEAM = 0.6;
/** How long the churn behind the transom lives, s. The road carries no
 * relief of its own: the hollow behind the transom is the STERN WAVE's,
 * laid on a footprint wide enough for the grid to stand on. */
const CHURN_LIFE = 1.6;
/** HOW LONG THE RELIEF TAKES TO FORM, s — the hollow collapsing into the
 * hole the jet leaves, the bow wave rolling out from the chine. The water
 * shader moves the surface by this relief, and a trough that stood at full
 * depth the instant the transom passed would drop every vertex under it
 * by its whole depth within a few frames: a twitch, where the sea's own
 * waves, which take seconds to pass, are silk. A quarter of a second is
 * enough to make the forming a motion rather than a step. */
const RELIEF_RISE = 0.25;

/** The relief's envelope at an age: rising over `RELIEF_RISE`, then dying
 * over `life`. */
function relief(age: number, life: number): number {
  return (1 - Math.exp(-age / RELIEF_RISE)) * Math.exp(-age / life);
}

/** How long the fan's foam lives, s, and the power its fade runs on — under
 * one, so the wedge holds its white while it opens and then breaks into
 * patches, rather than dissolving as fast as it spreads. Its half-width at
 * the transom as a share of the beam, and the most it may ever spread to,
 * m. The WHITE FOLLOWS THE RELIEF OUT: the stern wave's arms ride Kelvin's
 * angle for the whole length of the trail, and a wedge of foam that stopped
 * opening halfway along left the water bending past the edge of the white
 * that was supposed to be the same wave. So the cap sits far enough back to
 * be most of the map rather than the near half of it — it is still a cap,
 * because Kelvin's angle never stops and an uncapped V is a field of foam
 * with a craft somewhere in it, but the V a rider looks back at is opening
 * the whole way. What makes it read LONG is still the life, not the
 * spread. */
export const FAN_LIFE = 6;
const FAN_FADE_POWER = 0.75;
const FAN_HALF_BEAM = 0.6;
export const FAN_HALF_MAX = 26;
/** The fan's foam at full pace — the loudest white in the picture, which is
 * what the aerial photographs say and the first pass did not: a fan at 0.4
 * sat under the lace's threshold and read as a grey smear beside the road.
 * Its churn, and the churn's own life, s — SHORTER than the foam's, because
 * the surface settles long before the bubbles pop, and a churn as long-lived
 * as the foam would hold the window shut over the whole wedge. */
const FAN_FOAM = 0.7;
const FAN_CHURN = 0.9;
const FAN_CHURN_LIFE = 2.4;
/** How long the rails take to SEPARATE from the boil, s. At the transom
 * there is no fan yet — the diverging train has not left the chine — and a
 * rail laid on top of the road there is buried in it anyway: all it does is
 * drive the summed share past the lace's saturation, and a saturated share
 * is a flat white blanket rather than white with the tile's holes cut in. */
const FAN_RISE = 0.45;
/** HOW THE WEDGE FILLS IN. At the transom the fan is two rails — the
 * diverging crests — with aerated water between them; by `FAN_FILL_AGE`
 * seconds the rails have broken inward and the whole wedge is white. The
 * share the interior reaches, against the rails' own. */
const FAN_FILL = 0.78;
const FAN_FILL_AGE = 1.8;
/** THE RAILS: where across the fan the broken crest stands, as shares of
 * the half-width — full over the plateau, feathering in to `RAIL_FROM` and
 * out to the rim. The fan's vertices are placed on these. */
const RAIL_IN = 0.72;
const RAIL_OUT = 0.88;
const RAIL_FROM = 0.5;
/** THE CUSPS: the edge of a real wake is not a ruled line but a row of
 * crescents — the diverging train breaking one crest at a time — so the
 * fan's half-width is wobbled along the TRAIL by two sines at
 * incommensurate wavelengths, m, by this share of the half-width. Anchored
 * to the sample's distance along the trail, never to its age, or the
 * scallops would crawl down a wake that should be standing still in the
 * water. */
export const CUSP_WAVE = 3.7;
const CUSP_WAVE_LONG = 6.1;
const CUSP_SHARE = 0.07;
/** …and how much of the rails' white a cusp carries with it: a crescent
 * that bulges is brighter than the notch beside it. */
const CUSP_FOAM = 0.3;
/** THE TURN'S SHOULDER. A hull carving does not lay the symmetric V of a
 * hull running straight: it throws its wash to the OUTSIDE of the turn,
 * where the aerial photographs show a broad brilliant band, and lays
 * almost nothing on the inside, where the hull is sliding away from the
 * water it just left. The heading rate, rad/s, at which that bias is full,
 * and how much wider and whiter the outside runs at it. */
export const TURN_FULL = 0.7;
const TURN_WIDEN = 0.5;
const TURN_FOAM = 0.45;

/** Which side of a turn a section's `s` is on: +1 fully the OUTSIDE, −1
 * fully the inside, 0 on a hull running straight. `turn` is the heading
 * rate, rad/s, positive turning toward +s (the craft's right). */
export function turnBias(s: number, turn: number): number {
  if (s === 0 || turn === 0) return 0;
  return clamp((-Math.sign(s) * turn) / TURN_FULL, -1, 1);
}
/** THE FAN CARRIES NO RELIEF. The diverging crest it draws in white is a
 * real wave and the surface does bend for it — but that bend is the STERN
 * WAVE's arms, laid on a section cut to follow them and fading over tens of
 * metres, where the fan's own foam is capped, aged and gone in six seconds.
 * Stated in two places the two disagreed: the crest died while the white it
 * belonged to was still there, and the wedge read as paint on flat water.
 * One owner for the shape, one for the colour. */

/** One cross-section's worth of a channel each: reused, never allocated. */
export type WakeSection = {
  foam: number;
  churn: number;
  /** The surface lifted, m, and the surface hollowed, m — both ≥ 0. */
  up: number;
  down: number;
  /** The section's coverage, 0..1: the feathered edge, and 0 outside it. */
  cover: number;
};

export function wakeSection(): WakeSection {
  return { foam: 0, churn: 0, up: 0, down: 0, cover: 0 };
}

/** How white the pump churns the road at a speed and a pump share. */
export function roadStrength(speed: number, pump: number): number {
  const pace = clamp((speed - SPEED_MIN) / (SPEED_FULL - SPEED_MIN), 0, 1);
  return pace * (0.55 + 0.45 * clamp(pump, 0, 1));
}

/** How strongly the hull has disturbed the water at a speed, 0..1. */
export function washOf(speed: number): number {
  return clamp(speed / WASH_FULL, 0, 1);
}

/** The road's half-width at an age, m: the boil's bulb at the transom
 * decaying into the road proper, which spreads slowly. */
export function roadHalf(beam: number, speed: number, age: number): number {
  return (
    beam * ROAD_HALF_BEAM +
    speed * ROAD_HALF_PER_SPEED +
    ROAD_SPREAD * age +
    beam * BOIL_HALF_BEAM * Math.exp(-age / BOIL_LIFE)
  );
}

/** The cusp wobble at `run` m along the trail, −1..1: two sines whose
 * wavelengths do not divide one another, so the edge reads as crescents
 * rather than as a ripple pattern. */
export function fanCusp(run: number): number {
  const a = Math.sin((2 * Math.PI * run) / CUSP_WAVE);
  const b = Math.sin((2 * Math.PI * run) / CUSP_WAVE_LONG + 1.7);
  return 0.6 * a + 0.4 * b;
}

/** The fan's half-width at an age, m: Kelvin's V at the speed the hull was
 * making, scalloped by where the sample sits along the trail (`run`, m),
 * thrown wide on the outside of a turn (`bias`, `turnBias`) and capped so a
 * long trail at pace is not a map full of fan. */
export function fanHalf(beam: number, speed: number, age: number, run = 0, bias = 0): number {
  const half = Math.min(FAN_HALF_MAX, beam * FAN_HALF_BEAM + age * speed * KELVIN_TAN);
  return half * (1 + CUSP_SHARE * fanCusp(run)) * (1 + TURN_WIDEN * bias);
}

function smoothstep(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

/** THE ROAD'S SECTION at `s` across it (−1..1 of `roadHalf`), for a sample
 * laid at `speed` with `strength` of white, `age` seconds ago. */
export function roadAt(s: number, age: number, speed: number, strength: number, out: WakeSection) {
  const a = Math.abs(s);
  const edge = 1 - smoothstep(ROAD_CORE, 1, a);
  const wash = washOf(speed);
  const fade = Math.pow(Math.max(0, 1 - age / ROAD_LIFE), ROAD_FADE_POWER);
  const boil = Math.exp(-age / BOIL_LIFE);
  out.foam = strength * Math.min(1, fade + boil * 0.5);
  out.churn = wash * (0.5 + 0.5 * boil) * Math.exp(-age / CHURN_LIFE);
  out.up = 0;
  out.down = 0;
  out.cover = age < ROAD_LIFE ? edge * edge : 0;
}

/** THE FAN'S SECTION at `s` across it (−1..1 of `fanHalf`), for a sample
 * laid `run` m back along the trail, on the `bias` side of a turn. */
export function fanAt(
  s: number,
  age: number,
  speed: number,
  strength: number,
  out: WakeSection,
  run = 0,
  bias = 0,
) {
  const a = Math.abs(s);
  const wash = washOf(speed);
  const life = Math.pow(Math.max(0, 1 - age / FAN_LIFE), FAN_FADE_POWER);
  // The rails along the outer edge — the crests breaking — and the wedge
  // between them, which starts as aerated water and fills with white as the
  // rails break inward. The louder of the two wins, so a young section is
  // two bands and an old one is a solid broken wedge.
  const rail = smoothstep(RAIL_FROM, RAIL_IN, a) * (1 - smoothstep(RAIL_OUT, 1, a));
  const fill = FAN_FILL * smoothstep(0, FAN_FILL_AGE, age) * (1 - smoothstep(RAIL_OUT, 1, a));
  const profile = Math.max(rail * (1 + CUSP_FOAM * fanCusp(run)), fill) * (1 + TURN_FOAM * bias);
  const rise = smoothstep(0, FAN_RISE, age);
  out.foam = Math.max(0, FAN_FOAM * strength * life * rise * profile);
  out.churn = FAN_CHURN * wash * Math.exp(-age / FAN_CHURN_LIFE) * Math.max(0, profile);
  out.up = 0;
  out.down = 0;
  out.cover = age < FAN_LIFE ? 1 - smoothstep(0.9, 1, a) : 0;
}

// ── THE STERN WAVE ────────────────────────────────────────────────────
// WHAT THE HULL'S PASSAGE DOES TO THE HEIGHT OF THE WATER — as against what
// the pump does to its colour. The road and the fan are about WHITE; this
// is the mark that is about SHAPE, and it is the one the eye reads as the
// sea bending for the craft rather than merely going pale behind it.
//
// Every photograph of a runabout's stern has the same two things in it, and
// the measurements agree on both:
//
//   THE HOLLOW  right behind the transom the water stands BELOW the still
//               line. Past a Froude number on the transom's own immersion
//               of about two the flow no longer closes round the corner —
//               the transom runs DRY, fully ventilated — and what is left
//               astern is a glassy depression whose floor is the transom's
//               immersion, not some share of the beam. For a craft of this
//               class that threshold is about three metres a second, which
//               is why the hollow is gated on a speed of its own rather
//               than on the wash every other mark here uses.
//   THE MOUND   the water thrown out to either side comes back together on
//               the centreline, and where it meets it SPROUTS: a narrow
//               ridge standing proud of the still line, right where the
//               hollow was deepest. Its place is not a free number — it is
//               where the fan's own rails first cross the axis, half a beam
//               over the tangent of Kelvin's angle — and a waterjet throws
//               it higher and further back than a propeller would, because
//               the nozzle is a horizontal plunging jet firing into the
//               hollow rather than a disc turning under it.
//
// Both are anchored to DISTANCE ASTERN rather than to age, because that is
// how they read: the pattern stands still in the CRAFT's frame and is
// dragged along behind it, so the mound sits the same distance back whether
// the rider is doing 30 or 90. A sample's distance astern only ever grows,
// so the pattern still sweeps over a patch of water and leaves it behind.
// The one thing taken on the water's own clock is the RISE, so a vertex the
// transom has just crossed is not dropped its whole depth in a frame.
//
// The transverse train — the following waves at 2πV²/g — is deliberately
// ABSENT. At these speeds its first crest is sixty to four hundred metres
// astern, tens of times past the far edge of the map: the near wake of a
// craft this size is the hollow, the mound and the diverging fan, and
// nothing else.
//
// It carries no foam and no churn. The road and the fan own the white, and
// a third contributor to that channel over the same water only drives the
// lace past saturation, which is a flat blanket rather than a brighter wake.

/** THE TRANSOM'S IMMERSION, m — the depth scale of the whole mark, and the
 * length in the Froude number that decides when it exists at all. A runabout
 * of this class floats its transom 0.15–0.25 m under. */
const TRANSOM_DRAFT = 0.2;
/** The Froude number on that draft at which the transom clears — measured
 * between 1.9 and 2.1 on a towed hull and up to 2.5 on a long slender one —
 * and how far past it the hollow is fully formed, as a multiple. Below the
 * first the flow still closes behind the transom and there is no hollow at
 * all; the road's own white starts at very nearly the same speed, which is
 * not a coincidence. */
const TRANSOM_CLEAR_FR = 2;
const CLEAR_FULL = 2.2;
export const TRANSOM_CLEAR = TRANSOM_CLEAR_FR * Math.sqrt(TUNING.g * TRANSOM_DRAFT);

/** The stern wave's half-width: the arms' own stand-off (below) with room
 * outside them, on a FLOOR of this many beams. The floor is what the near
 * water needs — the water shader reads the relief blurred to about two
 * metres (`WAKE_RELIEF_LOD`), so anything narrower is held by the map and
 * never seen by the grid, which is exactly what the road's own hollow was
 * and why the relief left the road entirely. */
const STERN_HALF_BEAM = 2.2;
const ARM_OUTSIDE = 1.3;
/** How long the relief takes to form on the water's own clock, s. */
const STERN_RISE = 0.12;
/** HOW FAR ASTERN THE MARK IS GONE, m, and the power its fade runs on —
 * under one, so it holds most of its height over the near water and then
 * goes SLOWLY, rather than dissolving as fast as it opens. The V is what a
 * rider sees the whole time they are looking behind them; it must still be
 * there at the far edge of the map. */
const STERN_FADE = 52;
const STERN_FADE_POWER = 0.8;

/** How deep the hollow runs at full — the transom's immersion — and how far
 * astern it has filled back in, m: a length of its own plus a share of
 * V²/g, which is how the measured hollow grows with speed. The share is
 * small deliberately; taken whole, a trail at pace is one long ditch. */
const HOLLOW = TRANSOM_DRAFT;
const HOLLOW_RUN = 1.8;
const HOLLOW_RUN_SPEED = 0.04;

/** THE MOUND at the apex: how high it stands at full, m, what a working
 * pump adds as a share of that, and how much further astern a working pump
 * throws it, in beams. It stands TALLER than the hollow is deep — a free
 * surface recovering from a depression overshoots it — which is what makes
 * this read as water being thrown up rather than as a dent. */
const MOUND = 0.26;
const MOUND_PUMP = 0.4;
const MOUND_PUMP_BACK = 0.55;
/** …and the multiple THE WHOLE PATTERN IS STRETCHED BY so that the grid can
 * carry it. On a craft of this beam the sides close 1.7 m astern, and the
 * water reads its relief blurred to about two metres: laid at the true
 * distance the hollow and the mound sit inside ONE blur kernel and average
 * each other away — the map holds both and the sea shows neither, which is
 * what the first pass did. Stretched, each is a feature a vertex can stand
 * on, and the pattern still reads as the one thing it is. This is the
 * renderer's grid showing through the physics, and it is the only number
 * here that is not measured. */
const MOUND_STRETCH = 2.7;
/** How far ahead of the apex it can be felt, m — the sides have not met
 * yet, so this is a lead-in and not a shape — its half-width there as a
 * share of the section, and how far astern of the apex it has handed over
 * to the arms entirely, m. It HANDS OVER rather than simply dying: the
 * water that piled up on the axis is the water that goes out to the sides,
 * and the eye follows it from the one into the other. */
const MOUND_RUN = 1.1;
const MOUND_HALF = 0.42;
const MOUND_HANDS_OVER = 7;
/** …and how much of the hollow the mound has CLOSED where it stands. */
const MOUND_CLOSES = 0.6;

/** THE ARMS — the diverging crests, and the whole reason the wake reads as
 * a TRIANGLE rather than as a stripe. They leave the transom's corners and
 * ride outward at Kelvin's angle forever, so the raised water is further
 * off the axis the further astern it is read, and the shape a rider looks
 * back at is a V that never stops opening. How high a crest stands at full
 * wash, m, how far astern its height has halved by spreading along an
 * ever-longer crest, m, and its width as a share of the section. */
const ARM = 0.2;
const ARM_SPREAD = 14;
const ARM_WIDE = 0.3;
/** …and the water INSIDE the V, which is drawn down: the arms took it. It
 * is shallow and wide where the crests are sharp and narrow, which is what
 * makes the triangle read as relief rather than as two unexplained lines. */
const INSIDE = 0.07;

/** How far off the axis the diverging crest stands at `run` m astern, m:
 * the transom's corner, plus Kelvin's angle every metre after it. */
export function armAt(beam: number, run: number): number {
  return beam / 2 + KELVIN_TAN * run;
}

/** How far astern the apex mound stands, m: where the two sides close —
 * half a beam over the tangent of Kelvin's angle — thrown further back by
 * a working pump, and stretched to what the grid can carry. */
export function moundAt(beam: number, strength: number): number {
  return beam * (MOUND_STRETCH / (2 * KELVIN_TAN) + MOUND_PUMP_BACK * clamp(strength, 0, 1));
}

/** Whether the transom has cleared, 0..1 — the gate the whole mark stands
 * behind. */
export function transomClear(speed: number): number {
  return smoothstep(TRANSOM_CLEAR, TRANSOM_CLEAR * CLEAR_FULL, speed);
}

/** The stern wave's half-width at `run` m astern, m — outside the arms, and
 * never narrower than the blur can see. */
export function sternHalf(beam: number, run: number): number {
  return Math.max(beam * STERN_HALF_BEAM, armAt(beam, run) * ARM_OUTSIDE);
}

/** THE STERN WAVE'S SECTION at `s` across it (−1..1 of `sternHalf`), `run` m
 * astern of the transom, on water the hull passed `age` seconds ago at
 * `speed` m/s with the pump churning `strength`. Relief only. */
export function sternAt(
  s: number,
  run: number,
  age: number,
  speed: number,
  strength: number,
  beam: number,
  out: WakeSection,
): void {
  const a = Math.abs(s);
  const half = sternHalf(beam, run);
  const wash = washOf(speed);
  const live =
    transomClear(speed) *
    (1 - Math.exp(-age / STERN_RISE)) *
    Math.exp(-Math.pow(run / STERN_FADE, STERN_FADE_POWER));
  // THE ARMS: a crest either side, standing where the diverging train has
  // got to by here and thinning as that crest lengthens. In SHARES of the
  // section, because the section is cut to follow them.
  const arm = armAt(beam, run) / half;
  const ridge = Math.exp(-Math.pow((a - arm) / ARM_WIDE, 2)) / Math.sqrt(1 + run / ARM_SPREAD);
  // THE APEX MOUND: on the axis where the sides close, handing its water
  // over to the arms as they draw apart.
  const past = run - moundAt(beam, strength);
  const lead = past < 0 ? Math.exp(-Math.pow(past / MOUND_RUN, 2)) : 1;
  const handover = Math.max(0, 1 - Math.max(0, past) / MOUND_HANDS_OVER);
  const mound = lead * handover * (1 - smoothstep(0, MOUND_HALF, a));
  // THE HOLLOW behind the transom, and the shallower drawdown inside the V
  // that outlives it — already closed where the apex mound stands out of
  // it, since the mound IS that hollow filling in and overshooting.
  const fill = Math.exp(-run / (HOLLOW_RUN + (HOLLOW_RUN_SPEED * speed * speed) / TUNING.g));
  const dip = (1 - smoothstep(arm * 0.7, arm, a)) * (1 - MOUND_CLOSES * mound);
  out.foam = 0;
  out.churn = 0;
  out.up = (ARM * ridge + MOUND * (1 + MOUND_PUMP * clamp(strength, 0, 1)) * mound) * wash * live;
  out.down = (HOLLOW * fill * (1 - a * a) + INSIDE * dip) * wash * live;
  out.cover = 1 - smoothstep(0.88, 1, a);
}

// ── THE SPLASH ────────────────────────────────────────────────────────
// What a hull arriving from ABOVE does to a disc of water — a landing's
// plume falling back, a bow driven under, a hull coming down on its side —
// as against what a hull moving THROUGH it does (the road and the fan).
// Three things in it, each with its own life, all stamped into the same
// map so the water shader draws and moves them the way it draws the wake:
//
//   THE PATCH   the foam the plume leaves on the water: a disc that spreads
//               slowly and breaks up as the bubbles pop, churned hardest at
//               first — what the landing's stamp has always carried.
//   THE CRATER  the water the hull displaced: a hollow under it, forming
//               over the relief's rise and filling back in under a second.
//   THE RING    where the displaced water went — a ring wave rolling out
//               from the crater's rim with a trough drawn in behind its
//               crest, thinning as its circumference grows and lacing the
//               crest white. The wave is what the eye reads as the sea
//               taking the blow: a splash with no ring is paint.

/** How long the patch's foam lives, s, and how fast it spreads, m/s. */
export const SPLASH_LIFE = 2.6;
export const SPLASH_SPREAD = 0.9;
/** How long the crater takes to fill, s — the hollow's decay after the
 * relief's rise. */
export const CRATER_LIFE = 0.6;
/** THE RING WAVE: how fast it travels, m/s — a wave a few metres long at
 * deep-water celerity (√(gλ/2π) for λ ≈ 3 m) — its width crest to foot,
 * m, how long it lives, s, and its crest's height at the crater's rim as
 * a share of the crater's depth. The width is the wave's own scale AND the
 * grid's: the water shader reads the relief blurred to about two metres
 * (`WAKE_RELIEF_LOD`) and the near grid's cell is a metre and a half, so a
 * ring narrower than this is smoothed into nothing before a vertex ever
 * stands on it. */
export const RING_SPEED = 2.2;
export const RING_WIDTH = 3.2;
export const RING_LIFE = 2.4;
export const RING_SHARE = 1.2;
/** Where the ring's trough sits, in half-widths inside its crest, and how
 * deep it runs as a share of the crest. */
const RING_TROUGH_AT = 1.2;
const RING_TROUGH = 0.6;
/** How much white the crest carries at full strength, and how much churn. */
const RING_FOAM = 0.7;
const RING_CHURN = 1;
/** How much of a stamp's strength the patch's foam takes. */
const PATCH_FOAM = 0.7;
/** The stations a splash is laid across, centre to reach: the crater's
 * middle and its rim, the patch's edge, the ring's trough, crest and foot,
 * and the reach — placed ON the features rather than spread evenly, so a
 * crest a metre wide is a vertex and not a gap between two. */
export const SPLASH_STATIONS = 8;

/** How far out from its centre a splash reaches at an age, m — the further
 * of the patch's edge and the ring's foot, while the ring lives and is
 * drawn (`ring` is the DETAIL row's share of it, 0 for none). */
export function splashReach(radius: number, age: number, ring: number): number {
  const patch = radius + SPLASH_SPREAD * age;
  if (ring <= 0 || age >= RING_LIFE) return patch;
  return Math.max(patch, radius + RING_SPEED * age + RING_WIDTH);
}

/** The radii of a splash's stations at an age, m, ascending from 0 into
 * `out` (`SPLASH_STATIONS` long). */
export function splashStations(radius: number, age: number, ring: number, out: Float32Array): void {
  const reach = splashReach(radius, age, ring);
  const rc = radius + RING_SPEED * age;
  const half = RING_WIDTH / 2;
  out[0] = 0;
  out[1] = radius * 0.5;
  out[2] = radius;
  out[3] = radius + SPLASH_SPREAD * age;
  out[4] = rc - RING_TROUGH_AT * half;
  out[5] = rc;
  out[6] = rc + half;
  out[7] = reach;
  // Ascending, and inside the reach: the features overtake one another as
  // the ring outruns the patch, and a station past the reach is a vertex
  // with no cover, which is fine, but one out of order folds the fan.
  for (let i = 1; i < SPLASH_STATIONS; i++) {
    out[i] = Math.min(reach, Math.max(out[i - 1], out[i]));
  }
}

/** THE SPLASH'S SECTION at `r` m from its centre, for a splash of `radius`
 * m laid `age` seconds ago with `strength` of white, a crater `depth` m
 * deep at full, and `ring` of the ring wave (0..1). */
export function splashAt(
  r: number,
  radius: number,
  age: number,
  strength: number,
  depth: number,
  ring: number,
  out: WakeSection,
): void {
  const life = age / SPLASH_LIFE;
  if (age < 0 || life >= 1) {
    out.foam = out.churn = out.up = out.down = out.cover = 0;
    return;
  }
  // The patch: flat, feathered over its outer third, paling and settling.
  const patchR = radius + SPLASH_SPREAD * age;
  const inPatch = 1 - smoothstep(0.7, 1, r / patchR);
  const fade = Math.pow(1 - life, 1.6);
  let foam = strength * fade * PATCH_FOAM * inPatch;
  let churn = strength * fade * (1 - life) * inPatch;
  // The crater: a bowl over the radius, rising in and filling.
  const rim = Math.min(1, r / radius);
  let down = depth * relief(age, CRATER_LIFE) * (1 - rim * rim);
  let up = 0;
  // The ring: a crest at the wave's front and a trough inside it, its
  // height spread thinner round a growing circumference.
  if (ring > 0 && age < RING_LIFE) {
    const rc = radius + RING_SPEED * age;
    const amp =
      depth *
      RING_SHARE *
      ring *
      Math.sqrt(radius / rc) *
      Math.exp(-age / RING_LIFE) *
      (1 - Math.exp(-age / RELIEF_RISE));
    const d = (r - rc) / (RING_WIDTH / 2);
    const crest = Math.exp(-d * d * 2);
    const trough = Math.exp(-(d + RING_TROUGH_AT) * (d + RING_TROUGH_AT) * 2);
    up += amp * crest;
    down += amp * RING_TROUGH * trough;
    const lace = strength * ring * crest * Math.exp(-age / RING_LIFE);
    foam += RING_FOAM * lace;
    churn += RING_CHURN * lace;
  }
  out.foam = Math.min(1, foam);
  out.churn = Math.min(1, churn);
  out.up = up;
  out.down = down;
  out.cover = 1 - smoothstep(0.85, 1, r / splashReach(radius, age, ring));
}

// ── THE BRAKE ─────────────────────────────────────────────────────────
// What the reverse bucket does to the water ROUND the hull. With the gate
// down the jet does not leave astern: it is thrown forward and under, so
// the water alongside and ahead of the hull erupts white and stays white
// while the lever is held — a pool the craft sits in, wider than the hull
// and reaching past the bow, that the water shader draws with the same
// foam term as the road. Nothing here is a trail: the pool is laid under
// the hull every frame off its state (`bucket` and `throttleEff`, the two
// numbers the thrust is turned by), and the road behind carries what the
// hull has passed over. It is the one mark that says BRAKING from any
// camera, which is why it is as wide as it is.

/** A mark laid round the hull off its state — the boil under a capsized
 * hull, the pool under a braking one. Reused, never allocated. */
export type HullMark = {
  /** How hard, 0..1 — the mark's churn; nothing at 0. */
  stir: number;
  /** The white share at the mark's centre. */
  foam: number;
  /** The centre's offset ahead of the centre of gravity, m. */
  ahead: number;
  /** Half-reaches of the ellipse, m, along the hull and across it. */
  along: number;
  across: number;
  /** The share of the reach the mark holds its full strength over before
   * feathering to nothing at the rim: a pool is flat-topped, a boil under a
   * capsized hull peaks at its middle. */
  core: number;
};

export function hullMark(): HullMark {
  return { stir: 0, foam: 0, ahead: 0, along: 0, across: 0, core: 0 };
}

/** The pool's white at full, its half-reach along the hull and across it
 * as shares of the length and the beam, how far ahead of the centre of
 * gravity it stands as a share of the length, and what PACE adds to each:
 * at speed the reversed jet meets water rushing the other way and the
 * pool is thrown forward past the bow; at a stop it boils round the hull. */
const BRAKE_FOAM = 0.65;
const BRAKE_CORE = 0.6;
const BRAKE_ALONG = 0.55;
const BRAKE_ALONG_PACE = 0.35;
const BRAKE_ACROSS = 1.1;
const BRAKE_ACROSS_PACE = 0.5;
const BRAKE_AHEAD = 0.1;
const BRAKE_AHEAD_PACE = 0.3;
/** The gate's share past which the pool starts, and the pace, m/s, at
 * which it is thrown as far as it goes. */
const BRAKE_FROM = 0.05;
export const BRAKE_PACE_FULL = 12;
/** How much wider the road behind a braking hull is laid, as a multiple of
 * the beam at a full gate: the flow the bucket sends under the hull
 * aerates the water it passes over, chine to chine and beyond. */
export const BRAKE_ROAD_WIDEN = 0.6;

/** The pool under a hull with its `bucket` down and its pump at
 * `throttle`, going `along` m/s the way it points (astern negative). */
export function brakeMark(
  bucket: number,
  throttle: number,
  along: number,
  length: number,
  beam: number,
  out: HullMark,
): void {
  const gate = clamp((bucket - BRAKE_FROM) / (1 - BRAKE_FROM), 0, 1);
  // The pump at the throttle the lever opens on its own is the whole boil
  // — the gate never sees more flow than that unless the rider is also on
  // the throttle, and then it is no whiter.
  const stir = gate * clamp(throttle / TUNING.pump.bucketThrottle, 0, 1);
  const pace = clamp(Math.abs(along) / BRAKE_PACE_FULL, 0, 1) * Math.sign(along);
  out.stir = stir;
  out.foam = BRAKE_FOAM * stir;
  out.core = BRAKE_CORE;
  out.ahead = length * (BRAKE_AHEAD + BRAKE_AHEAD_PACE * pace);
  out.along = length * (BRAKE_ALONG + BRAKE_ALONG_PACE * Math.abs(pace));
  out.across = beam * (BRAKE_ACROSS + BRAKE_ACROSS_PACE * Math.abs(pace));
}

// ── THE TRAIL'S BREAKS ────────────────────────────────────────────────
// The trail is ONE ribbon of rows, so every row is stitched to the next
// whether or not the hull was in the water between them. A flight is the
// case that matters: the hull leaves the water, one dead row closes the
// trail where it left, and the next live row is laid where it came down —
// a whole air's worth of water away. Stitched, those two rows are a single
// quad stretched across the entire flight, its white ramping from nothing
// at the take-off to full at the touchdown: a wedge of road pointing back
// at where the rider jumped from, which is the one place there is no wake.
//
// The cure is topological, not a number: a trail that RESUMES opens with a
// dead row of its own, at the transom, so the void is spanned by two dead
// rows — no width, no cover, no area — instead of by one dead row and one
// live one. The same rule covers a hull backing up under its bucket, and
// covers the first sample of a run, whose neighbour is an unused slot
// sitting at the world's origin.

/** What the end of the trail is: nothing yet, a row that closed it, or a
 * live sample. */
export type TrailEnd = "none" | "gap" | "sample";
/** What a step does to it: nothing, close it where the hull left the water,
 * open it again with a dead row at the transom, or lay a live sample. */
export type TrailAction = "none" | "close" | "open" | "lay";

/** The trail's next move, for a hull that is or is not laying a trail
 * (`live`), an `end` as it stands, and whether the transom has travelled a
 * sample's spacing since the last one (`moved`). */
export function trailAction(live: boolean, end: TrailEnd, moved: boolean): TrailAction {
  if (!live) return end === "sample" ? "close" : "none";
  if (end !== "sample") return "open";
  return moved ? "lay" : "none";
}

// ── THE JET ───────────────────────────────────────────────────────────
// WHAT THE PUMP DOES TO THE WATER BEFORE THE HULL HAS MOVED. Every other
// mark here is something the hull's PASSAGE left: the road is water it went
// over, the fan is water it shoved aside, and every one of them is gated on
// pace, because at a standstill a hull has passed over nothing. But a
// waterjet at a standstill is not doing nothing — it is firing its whole
// mass flow astern, and the water behind the transom erupts. On the clock
// that is what comes FIRST: the throttle opens, the jet blasts, and only
// then does the craft begin to move and start laying a trail.
//
// So the jet is a mark laid off the craft's STATE — like the brake's pool
// and the capsized hull's boil, and unlike the trail — because it is
// attached to the nozzle rather than to the water. A narrow tongue astern
// of the transom, spreading and dying over its reach, driven by the pump
// and not by the speed.
//
// It FADES OUT as the craft picks up pace, and that is the physics rather
// than a fudge: a transom standing still blasts the same patch of water for
// as long as the throttle is open, so the white piles up in one place; a
// transom at speed has left that water behind before it has finished
// breaking, and what the jet churns becomes the ROAD instead. By the time
// the road is white (`SPEED_FULL`) the jet has handed over entirely, and
// the two cross without either of them popping.

/** How far astern the jet reaches at a standstill, as a multiple of the
 * hull's length, and its half-width at the nozzle and at that reach, as
 * shares of the beam: a tongue, narrow where it leaves and spread where it
 * has broken up. */
const JET_REACH = 4.5;
const JET_HALF_NOZZLE = 0.35;
const JET_HALF_REACH = 1.6;
/** The pace by which the jet has handed the water over to the road. It IS
 * the pace at which the road is fully white, read off it rather than quoted
 * beside it: the two are one hand-over, and a jet that let go before the
 * road arrived would leave a stretch of open throttle with nothing on the
 * water at all — which is the fault this whole mark exists to fix. */
export const JET_STALL = SPEED_FULL;
/** The white the jet churns at full throttle, and its churn — the highest
 * in the file, because the water directly behind a nozzle is the most
 * broken water anywhere near the craft. */
const JET_FOAM = 0.95;
const JET_CHURN = 1;
/** How deep the jet digs the water at the nozzle at full, m: the stream is
 * driving down and back, and the surface it leaves is a trench rather than
 * a bulge. */
const JET_HOLLOW = 0.12;
/** …AND WHERE IT COMES BACK UP, which is the other half of the same event
 * and the one that reads: a horizontal plunging jet fired into the water
 * scours a trench where it enters and piles what it displaced into a mound
 * further along. How high that mound stands at full, m, where along the
 * reach it stands, and its half-length there — the stern wave's mound
 * before the craft is moving fast enough to have one, and it hands over to
 * that the same way the jet's white hands over to the road's. */
const JET_MOUND = 0.13;
const JET_MOUND_AT = 0.42;
const JET_MOUND_RUN = 0.22;
/** The stations the jet is laid across, nozzle to reach. */
export const JET_ROWS = 7;

/** What the jet is doing, for a pump at `throttle` on a hull making `speed`
 * m/s the way it points. `reach` and the half-widths are m; `blast` is 0..1
 * — nothing at all at 0, which is what a shut throttle or a craft at pace
 * both come to. */
export type JetMark = {
  blast: number;
  reach: number;
  halfNozzle: number;
  halfReach: number;
};

export function jetMark(): JetMark {
  return { blast: 0, reach: 0, halfNozzle: 0, halfReach: 0 };
}

export function jetBlast(
  throttle: number,
  speed: number,
  length: number,
  beam: number,
  out: JetMark,
): void {
  // Linear in the hand-over, not squared: squared, the jet was already half
  // gone by walking pace and the road had not started, which is a hole.
  const stall = 1 - clamp(speed / JET_STALL, 0, 1);
  out.blast = clamp(throttle, 0, 1) * stall;
  out.reach = length * JET_REACH * out.blast;
  out.halfNozzle = beam * JET_HALF_NOZZLE;
  out.halfReach = beam * JET_HALF_REACH;
}

/** THE JET'S SECTION at `u` along it (0 at the nozzle, 1 at the reach) and
 * `s` across it (−1..1 of the half-width there). */
/** The jet's half-width at `u` along it, as a share of the beam. It opens
 * FAST out of the nozzle and then holds, rather than widening evenly over
 * the whole reach: a tongue that is still a hull's beam wide two metres
 * astern is a tongue the hull itself hides from every camera in the game,
 * which is where the first pass put it. */
export function jetHalf(u: number, beam: number): number {
  return beam * (JET_HALF_NOZZLE + (JET_HALF_REACH - JET_HALF_NOZZLE) * Math.sqrt(clamp(u, 0, 1)));
}

export function jetAt(u: number, s: number, blast: number, out: WakeSection): void {
  const a = Math.abs(s);
  // Along: full out of the nozzle, then broken up and gone. Across: a flat
  // core feathering to nothing, so the tongue has an edge rather than being
  // a cone of speckles — the same shape the brake's pool wants, and for the
  // same reason.
  const along = (1 - smoothstep(0.35, 1, u)) * (0.55 + 0.45 * (1 - u));
  const across = 1 - smoothstep(0.45, 1, a);
  const share = blast * along * across;
  out.foam = JET_FOAM * share;
  out.churn = JET_CHURN * share;
  // The mound the stream piles up where it has spent itself — narrower
  // across than the tongue's white, because what is thrown up gathers on
  // the axis while the foam spreads.
  const land = (u - JET_MOUND_AT) / JET_MOUND_RUN;
  // Broad across, not a point: the tongue is barely wider than the relief
  // blur to begin with, so a mound feathered over its inner third is one
  // the map holds and the grid never stands on.
  out.up = JET_MOUND * blast * Math.exp(-land * land) * (1 - smoothstep(0.45, 1, a));
  // The trench, at the nozzle and nowhere else: by the far end the stream is
  // spread foam lying on the water rather than a jet driving into it.
  out.down = JET_HOLLOW * share * (1 - smoothstep(0, 0.5, u));
  out.cover = blast > 0 ? 1 : 0;
}

/** THE MAP the water shader reads the wake off: texels a side, and how far
 * it reaches either side of its centre, m. The centre stands
 * `WAKE_MAP_BACK` m behind the craft, because the wake is. */
export const WAKE_MAP = 512;
export const WAKE_REACH = 64;
export const WAKE_MAP_BACK = 24;
/** What one unit of a height channel is worth, m — the map is eight bits a
 * channel, so this is the deepest hollow and the tallest crest it can carry. */
export const WAKE_HEIGHT = 0.35;
