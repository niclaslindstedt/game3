// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CHASE RIGS, as data. Where the lens stands behind the craft, how far
// it lags, how much of a hull being carried sideways it lets show, and how
// it frames the water ahead — one row per outside view, because the
// difference between them IS the row. `camera.ts` drives them; the
// `game-feel` skill owns what each number does to the sensation.
//
// The four outside cameras are ONE rig at four sizes, and what separates
// them is not only where they stand but how HEAVY they are. `close` and
// `chase` are the two the game is ridden from: a boom is answered briskly
// and settles without overshooting, at either length. From `far` outwards
// the lens answers slowly and its lateral swing is a sprung mass that
// overshoots a turn and settles back into it, which is what reads as
// something being FLOWN rather than something bolted on.
//
// The heights are a jet ski's, not a car's: the hull is a metre tall and it
// is ridden on water that is itself moving, so a lens two metres over it is
// already looking DOWN on the swell it is supposed to be riding. `chase` is
// the reference — the 90s jetski-racer read, where the wave coming at the
// hull fills the bottom of the frame and the horizon rides high — and every
// other row is that shot moved rather than a shot of its own.

/** A lens behind the craft, as a set of numbers. The standoff and the height
 * decide how big the hull is in frame; the aim point decides the PITCH, and
 * the pitch is what a shot is really made of — where the craft sits
 * vertically and how much sky is left over the horizon. */
export type ChaseRig = {
  /** Standoff behind the craft at a standstill, m, and the metres added per
   * m/s of pace — the boom straining ahead as the pump opens. */
  dist: number;
  distPerSpeed: number;
  /** Height over the craft's SPRUNG height, m, and what pace adds. */
  height: number;
  heightPerSpeed: number;
  /** How far ahead of the craft the aim point sits, m, and how high over the
   * sprung height. Aiming at the water ahead rather than at the hull is what
   * puts the horizon in the top third and the craft at the bottom. */
  aimAhead: number;
  aimHeight: number;
  /** Design lens at rest, deg, what a m/s adds, and the ceiling before the
   * sea turns into a tunnel. */
  fov: number;
  fovPerSpeed: number;
  fovMax: number;
  /** How briskly the yaw follows the nose, 1/s — the one knob for how heavy
   * the rig is. Halved in the air, so the framing goes loose while the craft
   * is ballistic. */
  followRate: number;
  /** How much of the slip angle (travel against nose) the framing carries,
   * 0..1, and the ceiling it eases onto, rad. A hull carried sideways across
   * the water shows across the frame; past the ceiling the shot would be
   * looking at the hull's flank instead of where it is going. The two rigs
   * that look DOWN on the craft are given a ceiling nothing reaches, because
   * from up there a hull crabbing across the frame hides nothing and is half
   * the appeal of the shot. */
  slipWeight: number;
  slipMax: number;
  /** LOOKING THROUGH THE TURN: how far the aim point slides toward the
   * inside per rad/s of yaw rate, m, and the most it may. */
  lookThrough: number;
  lookThroughMax: number;
  /** LATERAL SWING toward the OUTSIDE of the turn, m per rad/s of yaw rate,
   * so a carve reads in the framing before the slip angle develops, and the
   * most of it a turn can ever buy, m. */
  swing: number;
  swingMax: number;
  /** The swing is sprung rather than eased: natural frequency in rad/s, and
   * the damping ratio. Under 1 the lens OVERSHOOTS the new framing and
   * settles back into it, which is what reads as a heavy thing being swung
   * around — a first-order ease just arrives, and arriving is what makes a
   * distant camera look bolted to the craft. Close in, near-critical and
   * quick: at three metres an overshoot is a lurch, not a sway. */
  swingFreq: number;
  swingDamp: number;
  /** The HEIGHT SPRING: how fast the sprung height follows the craft's own
   * y, 1/s, afloat and in the air. Slow afloat — a wave under the hull is
   * not a wave under the lens — and quick in the air, so a launch is tracked
   * and a fall is followed down. */
  heightFollow: number;
  heightFollowAir: number;
  /** In the air the aim and the lens climb toward the craft itself, this
   * share of its height over the sprung water line — the flight is the shot,
   * and the shot stays on the craft. */
  airAim: number;
  airLift: number;
  /** Share of the FLIGHT read this rig's rod takes, 0..1 — how far the boom
   * swings out of the horizontal to lie along the path of a craft that is
   * off the water. The rod's LENGTH never changes, so the hull is exactly as
   * big in the frame off a ramp as it was on the water before it; what turns
   * is where the lens is hung, which is the difference between watching a
   * launch and watching a craft leave. The rigs down behind the craft take
   * all of it; the two that already look down from a long way up are most of
   * the way there before the hull leaves the water, so they take a fraction.
   */
  flight: number;
  /** The lens never goes under the sea: it is held this far over the surface
   * under it, m. */
  clearance: number;
};

/** THE ROD'S OWN MASS — how the boom's angle out of the horizontal is
 * carried, shared by every outside rig (each scales the reading by its own
 * `flight`).
 *
 * The angle is not eased onto, it is SPRUNG onto. An ease answers the lip
 * with a step in its own velocity, so the frame the hull leaves the water is
 * the frame the whole boom starts swinging, and — far worse — the frame it
 * comes back is the frame the boom stops dead: a craft that has been falling
 * with the lens hung out over it lands, the angle it was asking for goes to
 * nothing at once, and the shot SNAPS through several metres in one frame.
 * That snap is the whole of what a rider reads as a camera with no weight.
 *
 * A mass has to be wound up and cannot be stopped: it winds on through the
 * flight and, at the landing, swings THROUGH the horizontal before it
 * settles — the boom dips a little under its natural angle, the lens drops
 * with it, and it comes back up. That is the bounce, and its size is a share
 * of whatever the rod had wound on to, so a hop off a chop barely shows it
 * and a long drop off a ramp gives the landing its punctuation.
 */
export const FLIGHT_ROD = {
  /** Natural frequency, Hz. Low enough that a moment of air only gets part
   * of the way to the angle it is asking for — which is what makes a hop
   * read as a nod and a real launch read as the whole gesture — and high
   * enough that the bounce is over well inside the second after a landing
   * rather than wallowing. */
  freq: 1.15,
  /** Damping ratio. Under 1 on purpose: this IS the bounce. Much under and
   * the boom rings a second time, which reads as a fault rather than as
   * weight; at 1 there is no bounce at all and the landing is a stop. */
  damping: 0.55,
  /** The two ceilings the reading is clamped to, deg — asymmetric, because
   * the two ends are not the same shot and neither is the same danger.
   *
   * Coming UP off a lip the rod swings under the craft and the shot looks
   * along the arc into the sky; the ceiling is generous because that is a
   * good shot and the hull's own climb rarely reaches it.
   *
   * Going DOWN it comes over the craft to look down the fall — but the plan
   * speed under a craft dropping near-vertically goes to nothing, so the raw
   * flight path angle runs away to the vertical, and a rod stood straight up
   * over a craft falling straight down puts the lens, the hull and the aim
   * on ONE LINE with the world's up vector as the only thing left to build a
   * frame from: the shot tumbles. Short of the vertical there is always a
   * run of sea left in the bottom of the frame. */
  up: 50,
  down: 62,
  /** A step bigger than this between two frames is a teleport rather than a
   * flight, rad — past any angle the clamped reading can produce, so only a
   * rig that has been picked up and put down somewhere else trips it. */
  snap: 100,
};

/** Which of the ladder's rungs are stood BEHIND the craft — every camera but
 * the one sat on it. */
export type ChaseCamera = "close" | "chase" | "far" | "heli";

export const CHASE_RIGS: Record<ChaseCamera, ChaseRig> = {
  // The same shot as `chase` pulled in over the transom: the wake is the
  // whole bottom of the frame and a wave arriving is a wall. It takes a
  // touch more look-over than `chase` for the same reason a rally camera
  // does — at three metres the hull subtends half again as much picture, so
  // the shared framing would hang it too high up the frame.
  close: {
    dist: 3.4,
    distPerSpeed: 0.045,
    height: 1.5,
    heightPerSpeed: 0.01,
    aimAhead: 7,
    aimHeight: 0.4,
    fov: 62,
    fovPerSpeed: 0.7,
    fovMax: 86,
    followRate: 4.5,
    slipWeight: 0.6,
    slipMax: 0.35,
    lookThrough: 2.6,
    lookThroughMax: 3.2,
    swing: 0.25,
    swingMax: 0.8,
    swingFreq: 6.5,
    swingDamp: 1,
    heightFollow: 2.2,
    heightFollowAir: 7,
    airAim: 0.85,
    airLift: 0.4,
    flight: 1,
    clearance: 0.7,
  },
  // THE REFERENCE. Low: a jet ski is a metre tall, and a lens two metres
  // over it already looks down on the water it is riding; the swell has to
  // be in the frame as a wall coming at the hull, not a texture under it.
  chase: {
    dist: 5.6,
    distPerSpeed: 0.06,
    height: 1.9,
    heightPerSpeed: 0.012,
    aimAhead: 9,
    aimHeight: 0.45,
    fov: 60,
    fovPerSpeed: 0.75,
    fovMax: 84,
    followRate: 4.5,
    slipWeight: 0.6,
    slipMax: 0.35,
    lookThrough: 3.2,
    lookThroughMax: 4,
    swing: 0.3,
    swingMax: 0.9,
    swingFreq: 6.5,
    swingDamp: 1,
    heightFollow: 2.2,
    heightFollowAir: 7,
    airAim: 0.85,
    airLift: 0.4,
    flight: 1,
    clearance: 0.7,
  },
  // Stood back and a little higher: less drama, more warning. This is where
  // the heaviness starts — the standoff is long enough that a sway is
  // legible as a gesture of its own rather than as the shot being unsteady.
  far: {
    dist: 9.6,
    distPerSpeed: 0.08,
    height: 3.2,
    heightPerSpeed: 0.016,
    aimAhead: 12.5,
    aimHeight: 0.9,
    fov: 58,
    fovPerSpeed: 0.6,
    fovMax: 80,
    followRate: 3.2,
    slipWeight: 0.7,
    slipMax: 0.42,
    lookThrough: 4,
    lookThroughMax: 5,
    swing: 1.1,
    swingMax: 2.4,
    swingFreq: 3.2,
    swingDamp: 0.72,
    heightFollow: 1.8,
    heightFollowAir: 6,
    airAim: 0.8,
    airLift: 0.35,
    flight: 0.95,
    clearance: 1,
  },
  // The shot a helicopter would fly: standoff and aim are a pair — 9 m up
  // and 16 m back puts the craft 29° below the horizontal, and an aim 13 m
  // ahead pitches the shot some 17° down, so the hull sits three quarters of
  // the way down the frame with the horizon still inside the top third.
  heli: {
    dist: 16,
    distPerSpeed: 0.1,
    height: 9,
    heightPerSpeed: 0.02,
    aimAhead: 13,
    aimHeight: 0.9,
    fov: 52,
    fovPerSpeed: 0.3,
    fovMax: 64,
    followRate: 2.2,
    slipWeight: 0.9,
    slipMax: 0.7,
    lookThrough: 5,
    lookThroughMax: 7,
    swing: 3.2,
    swingMax: 4.5,
    swingFreq: 1.7,
    swingDamp: 0.5,
    heightFollow: 1.2,
    heightFollowAir: 4,
    airAim: 0.6,
    airLift: 0.2,
    flight: 0.6,
    clearance: 1.5,
  },
};

/** THE TWO RIGS BOLTED TO THE CRAFT — no standoff, no boom, no spring: they
 * go where the hull goes. What makes them worth riding from is that the
 * water is RIGHT THERE, close enough that a wave face fills the screen; what
 * makes them readable is that the pitch and the roll they carry are DAMPED,
 * because a lens that takes every degree of a hull on chop is a picture
 * nobody can read. */
export type EyeCamera = "bow" | "nose";

export type EyeRig = {
  /** Where the eye sits on the craft, BODY metres from the centre of
   * gravity: `up` over it, `forward` toward the bow. The body frame is the
   * engine's (x right, y up, z forward) and the origin is the cog, which is
   * what `craft-body.ts` lofts the hull around — so a lens forward of the
   * saddle is a lens with the rider BEHIND it. */
  up: number;
  forward: number;
  /** How far ahead the aim point sits, m. */
  aimAhead: number;
  /** How much of the hull's pitch and roll the eye takes, 0..1 — the rest is
   * the rider's neck levelling their head against the deck. The bow lens is
   * not a head and takes more of both. */
  pitchShare: number;
  rollShare: number;
  fov: number;
  fovPerSpeed: number;
  fovMax: number;
};

export const EYE_RIGS: Record<EyeCamera, EyeRig> = {
  // Out on the foredeck, ahead of everything: no hull in the frame at all,
  // and the sea a metre under the lens. The wave the hull is about to meet
  // is the whole picture, which is the closest this game gets to the water.
  bow: {
    up: 0.62,
    forward: 1.15,
    aimAhead: 14,
    pitchShare: 0.6,
    rollShare: 0.5,
    fov: 72,
    fovPerSpeed: 0.5,
    fovMax: 92,
  },
  // The rider's own view over the handlebars: the bar, the grips and the
  // hood are in frame and the water is what is left over them.
  nose: {
    up: 0.95,
    forward: 0.72,
    aimAhead: 12,
    pitchShare: 0.45,
    rollShare: 0.35,
    fov: 68,
    fovPerSpeed: 0.5,
    fovMax: 90,
  },
};
