// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WASH — the block of `TUNING` that answers to `wash.ts`: the waves a
// hull leaves in the water, as opposed to the waves the sea brought. It
// lives beside `tuning.ts` the way the sea and the assist do — that file is
// at the §20.5 cap — and `tuning.ts` folds it in as `TUNING.wash`, which
// is how the whole repo spells it; nothing reads this module directly.

/** THE WASH — every wave a hull makes (`wash.ts`).
 *
 * A hull moving through water is a line of point sources, and the V of a
 * wake is nothing but their rings adding up (Huygens; Kelvin 1887 for the
 * dispersive case). Each source is one ring packet: born at the hull's
 * waterline, spreading at the group speed of ONE wave — the wave whose
 * celerity is the hull's HUMP speed, because that is the wave a hull of
 * this length is tuned to make — thinning as its circumference grows and
 * dying over a few seconds. So the whole model is one wavelength, one
 * decay, and how hard each source is struck; everything else is the sum.
 *
 * Three things strike a source: the hull's PASSAGE (the displacement it
 * shoves aside, largest at the hump and a fraction of that once it is up
 * on the plane), its BOB (a floating hull heaving against the water under
 * it radiates, which is the only wake a hull with no way on has), and a
 * SPLASH (a landing, a bow driven under — the ring a slap raises). */
export const WASH = {
  /** THE HUMP SPEED, m/s — the speed the roster's hulls sit deepest in
   * their own wave, Fn ≈ 0.55 on a three-metre waterline, and the ONE
   * wavelength of the wash follows from it: the deep-water wave whose
   * celerity is this speed, λ = 2π·U²/g ≈ 6 m. Named as a speed rather
   * than a length because that is what a rider can find with the
   * throttle. */
  hump: 3.06,
  /** THE CREST one source raises at its birth radius, m, for a hull
   * passing at the hump — per source, and the sources are laid one a
   * `spacing` of travel, so what a rider meets is their SUM: at the hump a
   * hull rides in the coherent trough of the dozen behind it, and at pace
   * the V is where their rings cross. Calibrated off the wash lab against
   * the reference photographs — a runabout at hump speed drags a stern
   * wave a quarter of a metre crest to trough, and a planing hull's wake
   * stands a hand's breadth beside the road. */
  crest: 0.07,
  /** How much of that a hull ON THE PLANE still leaves, 0..1: up on its
   * lift it shoves aside a fraction of its displacement, and the wake
   * narrows and flattens to the V of the reference photographs. */
  planingShare: 0.35,
  /** How far the hull travels between two passage sources, m. A sixth of
   * the wavelength: as coarse as a line of sources can be laid and still
   * add up to a wave rather than to a string of beads, and what bounds the
   * count at speed. */
  spacing: 1,
  /** THE BOB — metres of ring per metre a second of the hull's plunge
   * relative to the water under it, SIGNED: a hull going down shoves a
   * crest out and a hull coming up draws a trough after it, so a heaving
   * hull radiates a train at its own period. A hull heaving a hand's
   * breadth a second in a chop radiates a centimetre; a hull on a flat
   * calm radiates nothing. Small on purpose, and CAPPED at `bobMax` on
   * its own — a hull pounding in a storm sea plunges at metres a second,
   * and the bob is the ripple of a drifting hull, not the splash of a
   * landing (which has its own reading below): a bob is meant to VANISH
   * into the sea round it within a few metres. */
  bob: 0.06,
  bobMax: 0.05,
  /** ...laid every this many physics steps — ten a second, five times the
   * fastest a hull heaves, which is as often as a train needs sampling. */
  every: 12,
  /** THE SPLASH — metres of ring per metre a second of descent at a
   * `land` or a `dive`: a hull coming down at five metres a second knocks
   * a fifteen-centimetre ring out of the water. */
  splash: 0.03,
  /** The most any one source may be struck, m, and the least worth laying
   * at all — under that the ring would be finer than a hull or an eye can
   * tell from the sea, so it is not laid and costs nothing. */
  maxCrest: 0.35,
  minCrest: 0.002,
  /** Where the ring is BORN, m from the source — past the roster's longest
   * half-diagonal (the otter's is 1.9 m, bow corner to centre), so a ring
   * stands just off the hull that made it and INSIDE that radius, less the
   * half-metre the gate closes over, there is no wave at all: the water
   * there is the hull, and a hull that felt its own fresh ring would heave
   * itself into one. The same radius is the owner's footprint for `young`
   * below, and it has to cover every PROBE — a bow corner reading a tenth
   * of a young ring was enough to turn the marlin's synthetic ride into a
   * different race. It feels its older rings, which is the squat at the
   * hump. */
  birth: 2.6,
  /** HOW LONG A SOURCE IS THE HULL'S OWN, s. A ring is a full circle from
   * its birth, and the forward arc of one laid a hull length ago is
   * standing where the hull now is — under it, not in the water: a hull
   * that read it would ride up on its own fresh wake. So a source younger
   * than this is masked inside its OWN hull's footprint and nowhere else;
   * a rival passing over the same water feels every ring, and the hull
   * that laid them feels them again the moment it turns back across its
   * trail, two seconds and more behind. */
  young: 2,
  /** The packet's half-width, m — how far each side of the ring's centre
   * the wave stands before the envelope has taken it (a bump that is nothing
   * past twice this). Half a wavelength: a ring is one crest and the trough
   * behind it. */
  width: 3,
  /** HOW LONG A RING TAKES TO FORM, s — the e-fold of its rise. Water
   * struck does not stand up at once: the hole fills, then the ring
   * stands, and a landing hull at pace is two hull lengths on before its
   * own splash is up. It is also what keeps the surface smooth in TIME
   * for the water grid, which a ring appearing whole between two frames
   * is not. */
  rise: 0.35,
  /** How long a source lives, s — the e-fold of its decay. Three seconds
   * is a ring that has gone out to the reach and is gone by the time the
   * hull is thirty metres on; `maxAge` below is when it is dropped from
   * the sum outright, at five per cent of what it was struck with. */
  life: 3,
  maxAge: 9,
  /** The depth the wash fades out under, m: in less water than this the
   * hull is on the beach and its wave has broken on it. */
  shoal: 1,
} as const;
