// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SEA AND THE WIND OVER IT — the two blocks of `TUNING` that answer to
// `water-feel`: the wave field a level's wind and fetch build (`water.ts`)
// and the wind itself, gusts, shelter and the tornado past the far edge
// (`wind.ts`).
//
// They live beside `tuning.ts` for the same reason the arcade assist does
// — that file had grown past the §20.5 cap and these are the pieces that
// come out cleanly, being one subject with one owner and one lab
// (`make waves`). `TUNING.sea` and `TUNING.wind` are still how the whole
// repo spells them; `tuning.ts` folds these in under those names, and
// nothing anywhere reads this module directly.

/** THE SEA — the wave field built from the wind (`water.ts`).
 *
 * A WAVE IS FOUR NUMBERS and everything else is derived from them:
 * its HEIGHT H (crest to trough), its WAVELENGTH λ (crest to crest),
 * its PERIOD T (crest to crest past a point) and its DIRECTION. From
 * those come its CELERITY c = λ/T (how fast the crest travels), its
 * STEEPNESS H/λ (which is what the eye actually reads, and which breaks
 * the wave past Michell's 1/7), and — against the water it stands in —
 * the DEPTH RATIO d/λ, which decides whether it is a deep-water wave
 * (d/λ > ½, the bed does nothing), an intermediate one, or a shallow-
 * water wave (d/λ < 1/20, the bed has it entirely). A SEA is a spread
 * of those: a spectrum of heights and periods about a peak, fanned
 * about a mean direction.
 *
 * So the dials below come in five groups — how BIG (the energy), how
 * LONG (the scale), how SHARP (the shape), how CONFUSED (the spread),
 * and what WATER it stands in. `docs/water.md` has the whole board. */
export const SEA = {
  /** How many components the field is summed from, and THE FRAME'S BUDGET
   * IS WHAT SETS IT. Eight.
   *
   * A component is ~140 ns of every `surfaceAt` against ~300 ns of fixed
   * work, and the water mesh calls `surfaceAt` once per vertex per frame —
   * 5400 of them at the design WATER row (`DESIGN_WATER`). So the eight
   * ocean components plus the five local ones are most of a 10 ms frame on
   * this machine, and every component added is another 0.75 ms. Sixteen
   * was tried and shipped and taken back out: it put the same frame at
   * 17 ms, which is the difference between a sea that holds 60 fps and one
   * that does not.
   *
   * A phase field per ocean component is ~20 ms of `createSea` on top,
   * a third of a run's whole build at eight — the other reason.
   *
   * WHAT THIS NUMBER IS NOT is how far the sea gets before it repeats.
   * That is `sliceMix`, which decides where the eight slices SIT: crowded
   * on the peak they carry one wave train with a beat hundreds of metres
   * long, and spread evenly over the band they are an octave apart and
   * beat inside the water a rider can see. Raising the count to fix a
   * repeat is paying a frame for what a cut costs nothing. */
  components: 8,
  /** HOW THE BAND IS CUT INTO ONE SLICE PER COMPONENT: the exponent the
   * spectral density is raised to before the cut is made even. 0 cuts
   * evenly in log frequency — a plain octave ladder, one slice the same
   * width as the next; 1 cuts evenly in ENERGY, which crowds the slices
   * onto the peak where a JONSWAP sea keeps most of it.
   *
   * It has to be most of the way to 1, because the peak is where the wave
   * a rider READS comes from: cut evenly in frequency and the peak is one
   * component, which is one sine, with its nearest neighbour a whole
   * octave away — so the two beat against each other inside the water he
   * can see, which is the corduroy. Crowd three or four slices within a
   * tenth of the peak and they carry ONE wave train between them whose
   * beat is hundreds of metres long.
   *
   * And it has to be short of 1, because a slice is finally represented by
   * ONE sine at its energy centroid: out in the tail, where an octave of
   * band holds its whole eighth of the sea, that puts an eighth of the sea
   * into a single wave at a short wavelength. MEASURED over the seed
   * corpus, the worst component of any band (Michell breaks at a·k 0.44):
   * 0.06 at 0, 0.16 at 0.7, 0.41 at 1 — that last on the OPEN band, whose
   * 4.8-peak span is the widest the field lays.
   *
   * 0.7 is where the repeat has left the drawn sea and no band is within a
   * third of breaking. */
  sliceMix: 0.7,
  /** The frequency band the components are laid over, as multiples of the
   * spectrum's peak: JONSWAP's energy sits between ~0.7 and ~2 f_p, and
   * the tail past 2.5 f_p is too short to feel through a hull. */
  bandLow: 0.7,
  bandHigh: 2.4,
  /** ...but `bandHigh` is a multiple of the PEAK, and a big sea's peak
   * is slow: at a twelve-second peak, 2.4 f_p is still a five-second,
   * forty-metre wave, so a storm swell comes out with no wind chop on
   * it at all — a mirror the size of a hill, which is the one thing a
   * storm does not look like. The band's short end is therefore also
   * held to an ABSOLUTE shortest period, s, and the wider of the two
   * wins: a four-second wind sea is untouched (2.4 f_p is already
   * shorter than this), and a swell gets the chop that rides on it.
   * The floor is what the water mesh can still draw — 2.5 s is a ten-
   * metre wave, some six cells at the craft. */
  minPeriod: 2.5,
  /** Directional spread half-width AT THE PEAK, radians (~26°) — a cos²
   * spread (Longuet-Higgins 1963) truncated there, DRAWN through rather
   * than weighted against (`spreadQuantile`). How CONFUSED the sea is
   * across the frame: at 0 every component runs the same way and the sea is
   * a corduroy of parallel crests; wide, the crests cross and the surface
   * is a chop with no direction to it, with no wave front long enough to
   * read as a wave.
   *
   * IT IS A NOMINAL HALF-WIDTH AND THE SEA REALISES LESS THAN IT — so the
   * number to tune against is the realised one, measured as the
   * energy-weighted circular spread of the band: 26° nominal comes out as
   * 11°. It was 34° nominal for as long as the heading was drawn flat and
   * the cos² weighted the energy, which realised the same 11° because the
   * weighting threw away most of the fan; drawing through the spread made
   * the nominal nearly honest, and 34° then realised 16° — a sea with no
   * wave in it. The realised 11° is what the game was tuned at and what
   * wave fronts 20 m long come from. */
  spread: 0.45,
  /** ...AND IT OPENS ABOVE THE PEAK. A real sea is not one fan: the swell
   * that carries the energy runs nearly together, and the shorter waves
   * riding on it are increasingly confused, which is why open water reads
   * as texture over order rather than as one corduroy. Mitsuyasu et al.
   * (1975) and Hasselmann et al. (1980) measure the spreading parameter s
   * peaking at f_p and falling as (f/f_p)^-2.5 above it; with D(θ) ∝
   * cos^2s(θ/2) the width goes as s^-1/2, so the half-width is `spread`
   * times (ω/ω_p) to this exponent — the measured −2.5 halved by that
   * square root, and signed the other way because it is a WIDTH.
   *
   * AT AND BELOW THE PEAK it is `spread` flat, and that is a deliberate
   * simplification of the same measurements: they have s falling below the
   * peak too (as (f/f_p)^5), but this band's floor is 0.7 f_p — still the
   * peak region — and fanning the longest, most energetic components is
   * exactly what stops a wave front forming. Taken literally it asked for
   * 2.4× the peak's width at the band's floor, and the sea lost a third of
   * its crest length to it. */
  spreadTilt: 1.25,
  /** ...held under this half-width, radians (~43°). The law above has no
   * ceiling in it — at 4.8 f_p (the open ocean's short end) it asks for
   * 1.7 rad, which is a component running back INTO the wind. Measured
   * directional widths do not go past about this even in the tail
   * (Mitsuyasu et al. 1975), and the eikonal is the other reason: a
   * component crossing the wind this steeply enters the level's grid by one
   * rim only, and the field swept from that rim alone holds |∇φ| = k(d) to
   * a few per cent less well than one fed from two
   * (`tests/waves_test.ts`). */
  spreadMax: 0.75,
  /** JONSWAP's peak enhancement γ, dimensionless — how much of the
   * sea's energy sits AT the peak period rather than spread around it.
   * 3.3 is Hasselmann et al. (1973)'s mean for the North Sea and the
   * value the spectrum is usually quoted at; 1 collapses JONSWAP to
   * Pierson–Moskowitz (a broad, fully developed sea, every wavelength
   * represented); 7 is a narrow, ordered swell where wave follows wave
   * at nearly one length. Higher reads as ORDER, lower as confusion. */
  peakEnhancement: 3.3,
  /** HOW BIG, as a plain multiple of what the fetch law grows — the one
   * place the wind sea's height is allowed to be more than the Baltic
   * would give a 2–12 m/s wind. The growth SHAPE is untouched (the
   * fetch ratio is a ratio, so it cancels): only the metre the sea is
   * quoted in moves. 1 is the honest ocean. An ARCADE DIAL. */
  heightScale: 1.5,
  /** HOW LONG — a plain multiple on the wind sea's peak period, and so
   * (through L₀ = g·T²/2π) on its WAVELENGTH, which moves as the
   * SQUARE of this. It is the frequency dial: under 1 the same sea
   * arrives in shorter, steeper, more frequent waves — a wave meets
   * the bow every two seconds instead of every three — and over 1 it
   * stretches into a longer, gentler swell. Steepness Hs/L₀ goes as
   * `heightScale / periodScale²`, so these two together are the whole
   * of how a wind sea reads. An ARCADE DIAL.
   *
   * It is a twentieth under 1 to hold the sea's FACES where they have
   * always been. A band's energy is sampled once per component, and at
   * eight components the top slice of a log-spaced band is an octave
   * wide — so the sea carried more of its energy at short wavelengths
   * than its own spectrum says, and stood about a tenth steeper than
   * JONSWAP asks for. Sampling the band finely enough to draw an
   * unrepeating sea (`components`) took that tenth away with it, and the
   * ride felt it: rms surface slope 4.35 % → 3.97 %, and a quarter off
   * the air a bot run turns in. The dial puts it back where the accident
   * had it, which is where it belongs — a number somebody chose. */
  periodScale: 0.95,
  /** THE FETCH the level's shore is stood in front of. A level is a
   * kilometre of coast, but the fetch-limited growth laws work in tens of
   * kilometres: a hundred metres of real fetch grows a four-centimetre
   * ripple. So the game's fiction is that the shore is a piece of a
   * longer coast facing the open sea, and the whole level is nearer it
   * than its bounds say: the wave model reads fetch as `baseFetch +
   * fetchScale × offshore` (m). The base is what puts HALF A METRE of
   * significant height in the lee of the shore at the lightest wind the
   * rule book draws (6 m/s over 30 km: Hs 0.53 m, Tp 3.5 s), and the
   * scale is what makes the sea build visibly riding out over the few
   * hundred metres a course spans (a strong wind at the seaward bound:
   * Hs near two metres). The growth SHAPE is still Hasselmann's; only
   * the metre is stretched. */
  baseFetch: 30_000,
  fetchScale: 100,
  /** The smallest depth the wave model reads, m: keeps the dispersion
   * relation and the shoaling coefficient finite where the bed comes up
   * to the surface, and is where the breaking cap has already clipped
   * every wave to nothing worth drawing. */
  minDepth: 0.15,
  /** McCowan (1894): a solitary wave breaks when its height passes 0.78
   * of the depth. It bounds ONE wave, so it is quoted here for the labs
   * and the analyzer; the field's own limit is `breakingHs` below, on
   * the sea rather than on a wave. */
  breakingRatio: 0.78,
  /** DEPTH-LIMITED SIGNIFICANT HEIGHT, Hs/d — what the surface is
   * actually clipped to. Nelson (1994) measures Hs/d ≈ 0.55 for an
   * irregular sea over a flat bed, and Hs is what the spectrum carries,
   * so this is the limit the model can hold a random sea to honestly.
   * (McCowan's 0.78 applied to the SUM of the component amplitudes — the
   * once-in-forever superposition, ~1.8× the significant amplitude —
   * held a sea in twenty-five metres of water to a third of the height
   * its own spectrum carried, and made every quoted sea above six
   * metres come out the same ten. The individual crests still ride past
   * this, as they do in nature.) A MEASUREMENT. */
  breakingHs: 0.55,
  /** CREST SHARPNESS, as a multiple of Stokes' own second-order term.
   * The field sums linear (sinusoidal) components, whose crests are
   * rounded humps; Stokes (1847) second order adds −½·k·a²·cos 2φ per
   * component, lifting and peaking the crest and filling the trough
   * flat, which is the shape a real wave has and the shape the eye
   * reads as water. 1 is the textbook coefficient; above it the peaking
   * is exaggerated past the physics. An ARCADE DIAL. */
  crestSharpness: 1.6,
  /** ...and the steepness a·k the correction is evaluated at, at most.
   * The second-order expansion is asymptotic in a·k and grows bumps in
   * the trough once it is pushed past its range; Stokes' own series is
   * quoted to about a third. */
  crestMaxSteepness: 0.32,
  /** The per-component shoaling lookup (`buildTable` in water.ts): the
   * pitch of its depth axis and how deep that axis reaches, m.
   *
   * The axis is √d, not d — row `i` sits at (i·`tableRoot`)² metres — so
   * the pitch is in m^½ and the SPACING it gives is 2·`tableRoot`·√d:
   * eight centimetres where the bed breaks the surface, a metre at 25 m,
   * and three out where the open ocean's floor is. That is the shape of
   * the question: every coefficient in the table moves with k·d and is
   * flat once k·d is past π, so the resolution is wanted in the shallows
   * and wasted in deep water. Measured against the exact functions, it is
   * closer than a uniform tenth-of-a-metre axis where the bed breaks the
   * surface (2.8 % against 6.7 %) and costs a fifth of the rows.
   *
   * The reach has to cover the DEEPEST water the model ever samples,
   * because the table's read clamps to its last row: past it a long storm
   * swell would be read at a depth it is not in, shoaled and given
   * several times the orbital velocity it has. That depth is the open
   * ocean's floor (`open.depth`), and this stands well past it. The
   * generator's own bed stops at −25 m. */
  tableRoot: 0.1,
  tableDepth: 250,
  /** Significant steepness Hs/L₀, dimensionless — what turns a sea
   * quoted by its height alone (`SeaOverride`) into a period, and so
   * into a WAVELENGTH: L₀ = Hs/steepness. It is the one number that
   * decides whether a big sea reads as a wave or as a tilted floor,
   * because what the eye reads is the FACE, and the face's angle is the
   * steepness — not the height. A mature ocean sea runs 0.03–0.05 (Toba
   * 1972), which is why the real twenty-metre sea is a five-hundred-
   * metre swell with a ten-degree face: at sea you feel it and from a
   * boat you cannot see it. The game wants the young, wind-driven
   * storm sea instead — a wall — so this sits above nature's range and
   * under Michell's 1/7 breaking limit (0.142) — far enough under it
   * that the sea is not uniformly ON the point of breaking, which is
   * both wrong and unreadable: a face at the limit everywhere is a
   * face the renderer paints entirely in foam, and a twenty-metre sea
   * comes out looking like a snowfield. An ARCADE DIAL: the deliberate
   * place the sea is steeper than the Baltic would give. */
  steepness: 0.09,
  /** THE UPWIND FAN the fetch at a point is measured over: its half
   * width, rad, and how many rays it is read on. SPM (1984)'s effective
   * fetch (Saville) averages the over-water reach upwind over ±45° in
   * 7.5° steps, weighted cos², because a narrow body of water gives the
   * wind a different run at every angle and one ray up the middle
   * cannot say so.
   *
   * Five rays rather than thirteen: each is a sweep over the whole grid,
   * and MEASURED over the seed corpus the fan's shape barely moves the
   * answer — the share of gates standing in near-flat water is 26% at
   * ±45° and 26% at ±90°, and a river reads zero exposure at every
   * width. What shelters a piece of water here is that land encloses
   * it, not the angle it is measured at. */
  fanSpread: 45 * (Math.PI / 180),
  fanRays: 5,
  /** THE LOCAL BAND — the wind chop that grows on water the ocean's own
   * sea cannot reach: a river, a creek, the far end of a channel. It is
   * quoted ONCE per level, at the mean wind over `localFetch` metres of
   * arcade fetch, and a point takes a share of it (`chop`) from its own
   * sheltered wind and its own upwind reach.
   *
   * The reference is deliberately short — a couple of kilometres against
   * the ocean band's sixty — because what this band is FOR is the shape
   * of enclosed water: a 1.8 s, five-metre ripple rather than a swell.
   * It sets the band's PERIOD alone: `chop` is a ratio against this same
   * quote, so `localFetch` cancels out of the height and only
   * `localFetchScale` decides how big a point's own chop is.
   *
   * `localFetchScale` is the same fiction as `fetchScale`, a tenth of
   * its stretch, and it has to stay the smaller of the two: the fiction
   * that the level is a piece of a longer coast is what buys the ocean
   * band its sixty kilometres, and it says nothing about water with a
   * bank on both sides. Ten is what a river's own reach is worth — a
   * mouth with 160 m of water upwind is quoted at 1.6 km, not the 6.4
   * that 40 was claiming for it.
   *
   * MEASURED against the seed corpus, at the quarter of top speed
   * `scenarios.ts` rides a river at, bars centred: at 40 the river hit
   * the hull with the same 13°/s pitch rate as the open sea on a fifth
   * of its wave height — a rumble strip rather than a sea, which is the
   * one thing a sheltered reach is not. At 10 the wedge impact falls
   * 182 N → 76 N and the pitch rate 12.9 → 6.0°/s, half the open sea's,
   * so the two waters read in the right order. The open sea does not
   * move at all: its share of this band is `1 − exposure`, which is
   * nothing out there. */
  localComponents: 5,
  localFetch: 2_000,
  localFetchScale: 10,
  /** ...and the band they are laid over, as multiples of their own peak
   * — narrower than the ocean band's, because chop IS narrow: it is one
   * wind's answer over one short fetch.
   *
   * FIVE of them over that narrow a band is more than the shape needs,
   * and the reason it once had — a component's share of the energy
   * carried the cos² directional weight, which VANISHES at the edge of
   * the spread, so a band with few components could deal one draw most
   * of the sea — is gone: the heading is DRAWN through that cos² now
   * (`spreadQuantile`) rather than weighted against it, and a component's
   * energy is the spectrum's alone. What five still buys is the chop's
   * own texture at close range, where the local band is most of what is
   * under the hull. MEASURED over the seed corpus: the steepest local
   * component reached a·k 0.32 while the draw was weighted, 0.15 now. */
  localBandLow: 0.8,
  localBandHigh: 1.8,
  /** THE OPEN OCEAN — the sea past the edge of the built level
   * (`engine/game/ocean.ts`). A level is a stretch of coast on a grid a
   * couple of kilometres across, and the water does not stop where the
   * grid does: a rider who turns his back on the course and holds the
   * throttle open rides out into the storm the coast is sheltering him
   * from, and it builds the whole way.
   *
   * HOW BIG IT GETS IS NOT A NUMBER HERE. It is the biggest sea the
   * roster's fastest craft can still fly over the rim of and down to the
   * floor of — `jumpableHs` in `ocean.ts`, off `topSpeedOf` and so off
   * `speedClass`. A wave's width grows with its height (the `steepness`
   * dial fixes the ratio) while a flight's reach does not, so past that
   * height the ocean stops being something a rider jumps and becomes a
   * hillside he crawls over, and there is no reason to build it. Turn the
   * speed class up and the ocean grows to match. */
  open: {
    /** ...and the storm a given coast is DEALT is not the ceiling every
     * time: it is drawn once per level, uniformly over the top of what
     * the craft can jump, from this share of the ceiling up to it. A
     * uniform draw over the band is what makes the biggest rare in the
     * plainest way there is — a seed has one chance in ten of landing in
     * the top tenth of it. At the shipped class that band is about 24 m
     * to 32 m. */
    vary: 0.75,
    /** How far past the level's own rim the dealt storm stands in full,
     * m. At a catalog top speed of 30–45 m/s that is a minute or two of
     * riding out with the sea building every second of it, and it is a
     * CEILING: past here the sea stops growing. */
    reach: 2_500,
    /** THE RUNGS the open band is laid on, as shares of the dealt storm's
     * height. One band would have to serve every height along the way
     * out, and a sea quoted by its height takes its WAVELENGTH from that
     * height (`periodForHeight`) — so a single band laid at the storm's
     * full height and scaled down to the sea a rider meets halfway would
     * deal him the storm's wavelength at a quarter of its face, an ocean
     * tilting rather than a wave. A rung each keeps every height at its
     * own steepness, and neighbouring rungs hand over on the height.
     *
     * Three is enough because the error is what the gap between rungs
     * costs: at a quarter-and-half ladder no sea is ever drawn from a
     * band more than twice its own height. */
    rungs: [0.25, 0.5, 1],
    /** The band a rung is laid over, as a multiple of its own peak — the
     * one place the open band does not use `minPeriod`.
     *
     * `minPeriod` is an ABSOLUTE floor in seconds, and against a slow
     * storm swell it asks for a band many times a coastal sea's frequency
     * range on the same components — and a band that wide lumps: the
     * worst component over the seed corpus reached a·k 0.89 carrying 90 %
     * of its band's energy, several times past breaking and painted
     * entirely in foam, where capping the band at a multiple of its OWN
     * peak brought it to 0.462.
     *
     * The lumping itself has since been fixed at its source — the heading
     * is drawn THROUGH the cos² spread rather than weighted against it,
     * so no component is robbed of its spectral share by where it happens
     * to point, and the corpus's worst open component is now a·k 0.148.
     * The cap stays: a band that wide would still hand one component a
     * whole octave of a spectrum, and 4.8 is what the twenty-metre storm
     * has always had. */
    bandHigh: 4.8,
    /** The mean wind out there, m/s at 10 m. A violent storm, and not an
     * arbitrary one: it is about the wind a fully developed sea of twenty
     * metres is grown by under Pierson–Moskowitz with `heightScale` on it
     * (Hs = 0.21·U²/g). A level whose own wind is already stronger keeps
     * it.
     *
     * It does NOT follow the ceiling, and deliberately: inverting the same
     * law at a fifty-metre sea asks for 220 m/s, and the wind is the one
     * weather a rider feels DIRECTLY — the aero term and the air control
     * read it, and that much pressure blows the craft off the water
     * before he has seen any of the sea he rode out for. */
    wind: 25,
    /** The bed out there, m below the surface, reached at `reach`: the
     * level's own rim depth falls on to this. It is not a seabed a hull
     * can ever touch — it is what keeps the depth-limited clip
     * (`breakingHs`·d) off the storm, which at the shipped ceiling needs
     * some sixty metres and is given more than twice it.
     * `tests/waves_test.ts` holds it ahead of the ceiling, so a speed
     * class that outgrew this bed would fail rather than quietly clip. */
    depth: 150,
  },
} as const;

/** THE WIND (`wind.ts`). */
export const WIND = {
  /** Aerodynamic roughness length of a sea surface, m — the log-law's
   * z0, ~2e-4 m for open water (Charnock 1955 at moderate winds). */
  roughness: 2e-4,
  /** The height the level's mean wind is quoted at, m (the meteorological
   * standard). */
  referenceHeight: 10,
  /** Lowest height the profile is read at, m: the law is singular at z0
   * and a probe under a wave trough would otherwise read a wind blowing
   * backwards. */
  minHeight: 0.3,
  /** Turbulence intensity σ_u/U over water, ~0.1 at 10 m (IEC 61400-3
   * offshore class); drives the gust factor's stationary variance. */
  intensity: 0.11,
  /** Gust integral time scale, s — how long a gust lasts. Over the sea
   * ~10–20 s for the energy-containing eddies at 10 m. */
  gustTime: 12,
  /** How far the gust direction wanders, radians (σ), and its own time
   * scale, s. */
  veer: 0.12,
  veerTime: 25,
  /** The gust factor's floor and ceiling, as multiples of the mean, so a
   * three-sigma draw is a strong gust and never a calm or a hurricane. */
  gustMin: 0.55,
  gustMax: 1.6,
  /** THE WIND IS NOT THE SAME EVERYWHERE. A level is a coast, and a
   * coast is the one place the wind changes over a few hundred metres:
   * it blows full strength over the open sea, drops as it crosses the
   * trees on a headland, and is a fraction of itself over a river a
   * kilometre inland with country all round it. `shelter` is what a
   * point's mean wind is multiplied by where nothing upwind is water at
   * all, and `shelterFetch` is the run of open water, m, over which it
   * recovers toward the full mean (an internal boundary layer growing
   * back off a new surface; Stull 1988 §14.5).
   *
   * The floor is the taiga's rather than open country's: a boreal
   * forest is the roughest surface a wind meets short of a town, and
   * three tenths is what a river in it feels of the wind out at sea. */
  shelter: 0.3,
  shelterFetch: 220,
  /** ...and the cell the shelter is READ on, m. The sea's own exposure
   * is baked on the level's 4 m grid because a river ten metres across
   * has to be able to be a river; the WIND is not that fine a thing —
   * it is a mass of air a hundred metres deep, and a rider crossing a
   * bank does not meet a wall of it. So the shelter is averaged over
   * this square (banks, trees and water together, which is exactly the
   * mixture a hundred metres of coast is) and read back bilinearly, so
   * what the craft feels changes slowly across the level and never
   * steps. */
  cell: 100,

  /** THE TORNADO — the wall of weather at the far edge of the open ocean
   * (`engine/game/tornado.ts`), and the answer to "what if I just keep
   * going". The storm past the rim stops building at `open.reach`, and past
   * there a rider is on a ceiling sea no level was built for. Out there
   * instead: a wind toward the level's start line from every direction at
   * once, and a column that takes a hull the moment a wave throws it clear
   * of the water. A HAZARD, not a wall — the rider is thrown, lands and
   * rides on; nothing is reset or stopped.
   *
   * NOT ONE ABSOLUTE NUMBER IN HERE: the ocean out there is sized off
   * `STORM_CEILING`, quadratic in the speed class, so a hazard quoted in
   * metres and m/s is right at one class and wrong at every other. Every
   * dial is a RATIO, shipped value beside it; `docs/water.md` has the board,
   * the class sweep, and which of them read the RUN's own class. */
  tornado: {
    /** How long past the storm's reach a rider gets, and how long the
     * tornado takes to come up — both s of riding at the roster's best, so
     * the same few seconds at any class. 1 800 m, 490 m shipped. */
    grace: 60,
    band: 16,
    /** THE HORIZONTAL WIND at full strength, × the roster's TOP SPEED —
     * 65 m/s shipped, EF3 and the bottom of what throws vehicles. Against
     * the top speed because the one thing it must be true about is that a
     * hull cannot push through it. */
    blow: 2.17,
    /** THE CLIMB the column buys a hull, × √(g·`STORM_CEILING`), the speed
     * of a wave out there. 24 m/s shipped. A CLIMB and not an updraft: the
     * air speed at which a hull HOVERS is its mass over its plan area
     * (`hoverSpeed`, 34–38 m/s) and moves with neither class nor sea, so an
     * updraft quoted outright is a different throw on every hull — and, low
     * enough, under it: a tornado that lifts nothing, silently. */
    climb: 2.0,
    /** HOW TALL THE COLUMN IS, as SECONDS OF THAT CLIMB: full at the water,
     * gone at the top. 18 m and 20 m shipped. Two of them because a tornado
     * is only as big as the water under it — `shore` over the shallows a
     * rider reaches along the coast, `ocean` over the open sea.
     * IT IS THE HEIGHT AND NOT THE CLIMB THAT SETS THE THROW: how long a
     * rider is UP is how long the column holds him, and one with no top
     * held the roster at 150 m for seventeen seconds. SECONDS, not metres of
     * sea: against the ceiling it goes as the class SQUARED — 5 m and no
     * lift at half, a 30 s hang at double.
     *
     * The HEIGHT is what these numbers hold, and the TIME follows from the
     * sea as much as from them: a throw's apex is a bounded twenty-odd
     * metres whatever the storm is shaped like, but how long it lasts is
     * also how long the water under it takes to come back up. The median
     * throw doubled, 5 s to 9 s, on the day the open band's energy stopped
     * lumping into one breaking-steep component — the rms face out there
     * fell from 100 % to 33 % and the apex did not move at all. Do not
     * recalibrate these against a flight TIME; measure the apex. */
    column: { shore: 0.76, ocean: 0.85 },
    /** How far out the offshore field must read for the column to be the
     * OCEAN's rather than the shore's, m — a level's seaward reach does not
     * move with the class (R14), so this IS a distance. */
    openReach: 600,
    /** The drag coefficient the hull's PLAN area is worked against in the
     * column (Hoerner 1965: a flat plate normal to the flow) — and why the
     * updraft is its own force and not a third component on the wind: `cdA`
     * is the drag area NOSE-ON, and a hull rising is not going forwards. */
    plateCd: 1.2,
    /** THE MOST THE COLUMN MAY PUSH, × the craft's own weight. The plate
     * drag goes as the SQUARE of the relative speed, so on a hull FALLING
     * into a column still rising the two add and a fast class turns it into
     * a trampoline (44 s of air at ×4). Uncapped it is 2.8 weights at the
     * shipped class, so it barely binds where the game is. */
    liftCap: 3,
    /** How far the inflow spirals off the straight line home, rad — 34°,
     * mid-range for a tornado's surface inflow, and what makes a throw a
     * ride round rather than a shove down a corridor. Cyclonic: in this
     * engine's clockwise-from-above heading, a NEGATIVE turn. */
    swirl: 0.6,
    /** How much of the full blow a hull must be taken by before the run is
     * told, and how long before it can be told again, s. A share because
     * `blow` moves with the class; the event carries its `grip` back the
     * same way, so a presentation never reads a wind in m/s. */
    eventShare: 0.45,
    eventGap: 6,
  },
} as const;
