// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The ANALYSIS budgets — how the checks LOOK, as data, in one place.
// `mapgen/rules.ts` is this file's opposite number: that one says what a
// level has to be (the bands), this one says how closely the analyzer
// reads the finished level for it (the stride it walks the path at, the
// tolerance it gives a stated distance, how far past the reach it judges
// the plateau). The bands are never restated here — every check reads
// them from the rule book — so a rule moved there moves the check with it,
// and a tolerance moved here is a visible change to what "clean" means.
//
// Every number carries its unit and the reason it is that number. A
// tolerance nobody can justify is a tolerance that will be quietly widened
// the first time a seed fails.

export const ANALYSIS = {
  /** How far apart the probes along the path are, m — under the hull's
   * length, so a shallow or a rock the hull would meet is a probe it
   * meets too, and a 2 km course is a thousand probes. */
  stride: 2,
  /** Tolerance on a stated distance — a gate spacing, a ramp's lead, the
   * start's setback — m. The geometry is measured along a polyline of
   * 10 m stations and interpolated; a hand's width is float noise and
   * nothing a rider would notice. */
  distance: 0.5,
  /** Tolerance on an alignment, rad (about half a degree). A ring off its
   * ramp's axis by more than this is a jump aimed at nothing. */
  heading: 0.009,
  /** How far a path vertex may sit off the chord of a straight window, m,
   * before the window is not straight (R9). */
  straight: 0.5,
  land: {
    /** How far over `land.maxHeight` the baked grid may reach, m: the
     * slabs' amplitude is inside the cap by construction, so this is a
     * float-and-bilinear allowance only. */
    tolerance: 0.5,
    /** How far past `land.reach` the plateau is judged from, m. The grid
     * is bilinear over 4 m cells and the reach falls between two of them,
     * so a cell straddling it blends the step's last rise into the flat. */
    margin: 12,
    /** How steeply the land may still be climbing inland past the reach,
     * m per m.
     *
     * Not float noise. The hills vary ALONG the coast (R21) and the inland
     * direction this walks is the shore's own normal, which beside an
     * inlet runs almost entirely along the base line — so a step "inland"
     * there reads a different stretch of coast, and its hills a different
     * height. The character changes by about 0.003 per metre of coast at
     * its fastest and the hill by `land.plateau · land.hill` times that,
     * which is a tenth of a metre per metre of apparent climb in the worst
     * place on the worst seed. A fifth is clear of it and still three
     * times under the 0.6 m/m the land's own step (R2) climbs at, which is
     * the failure this is here to catch. */
    rise: 0.2,
  },
  sea: {
    /** How far under `sea.depth` the bed may go, m — the detail's
     * amplitude plus a little, because R3's "never deeper" is a promise
     * about the profile the grain rides on. */
    tolerance: 1,
    /** How far past `sea.reach` the full depth is judged from, m, past the
     * shelf's blend and the grid's blur. */
    margin: 20,
    /** How far out a sea cell must be, m, before it is required to be
     * under the surface. Inside this the zero contour is being drawn
     * through cells that straddle the line. */
    waterline: 8,
  },
  ring: {
    /** Tolerance on a ring's derived lead and height against
     * `ringPlacement`, m — the geometry is interpolated along a polyline
     * of stations. */
    place: 0.3,
    /** Tolerance on the hinge speed a ring asks for against the design
     * band's ends, as a share: the bot's own formula carries a few percent
     * for the deck's friction. */
    speed: 0.08,
  },
  day: {
    /** Tolerance on R13's daylight window, h. The window is found by
     * stepping the sun's arc in three-minute samples and interpolating
     * between the last two, so its ends are worth a minute either way. */
    hour: 0.05,
  },
  wind: {
    /** Tolerance on R12's swing off the sea, rad (about five degrees).
     * The analyzer has no base line to read the sea's direction from —
     * only the published shore, whose ends wander either side of the
     * heading the coast was drawn on — so its estimate of "off the sea"
     * is a few degrees loose, and a wind drawn at the band's edge must
     * not fail on the estimate's error. */
    direction: 0.09,
  },
  course: {
    /** R23 — how far apart the three points the corner's circle is drawn
     * through stand, m. The path is a polyline of 10 m stations and its
     * vertices carry the search's own rounding, so a circle through three
     * neighbours measures that rounding rather than the corner; three
     * stations apart is a stencil the size of a hull's turn. */
    stencil: 30,
  },
  shore: {
    /** How sharply the shore polyline may turn at a vertex, rad — R15's
     * slope cap read as an angle, with a little room. */
    turn: 0.6,
    /** R21 — how far apart the walk along the waterline samples the
     * material, m. Under a hull's length, so a patch a rider would ride
     * past is a patch the walk sees. */
    walk: 8,
    /** …and how far in from the line it stands to read it, m. The zero
     * contour wanders a few metres either side of the polyline where the
     * slabs ride over it, so a probe closer in reads water on a third of a
     * low coast; ten metres is past that and still on the beach rather
     * than behind it. */
    probe: 10,
  },
  /** How many cells across the grid the classifier is sampled at for
   * R16 — enough to see every kind of ground, cheap enough to run on every
   * attempt. */
  surfaceSamples: 48,
} as const;
