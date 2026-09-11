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
  /** How many Gerstner components the field is summed from. Eight is
   * enough to lose the visible periodicity of a single sine and few enough
   * that the renderer can displace a two-hundred-metre mesh with it. */
  components: 8,
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
  /** Directional spread half-width about the wind, radians (~35°) — a
   * cos² spread (Longuet-Higgins 1963) truncated there. How CONFUSED
   * the sea is across the frame: at 0 every component runs the same
   * way and the sea is a corduroy of parallel crests; wide, the crests
   * cross and the surface is a chop with no direction to it. */
  spread: 0.6,
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
   * of how a wind sea reads. An ARCADE DIAL. */
  periodScale: 1.0,
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
   * FIVE of them over that narrow a band is more than the shape needs
   * and is there for a different reason: a component's share of the
   * energy carries the cos² directional weight, which VANISHES at the
   * edge of the spread, so a band with few components can deal one
   * draw most of the sea. MEASURED over the seed corpus — at three the
   * steepest local component reached a·k 0.43, on the point of breaking
   * and a face the renderer paints entirely in foam; at five the worst
   * is 0.27, in line with the ocean band's own. */
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
     * range on the same eight components. That breaks on the cos²
     * directional weight, which VANISHES at the edge of the spread: when
     * the longest component's draw lands out there its energy is
     * normalised onto whatever is left, and across a wide band that is a
     * far shorter wave. MEASURED over the seed corpus at a thousand-metre
     * quote, the worst component reached a·k 0.89 with 90 % of its band's
     * energy — a wave several times past breaking, which the renderer
     * paints entirely in foam — and more components barely helped (0.49
     * at twenty-four), because the width is the fault and not the
     * resolution. At 4.8, which is what the twenty-metre storm has always
     * had, the worst is 0.462 against that storm's own 0.461. */
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
     * lift at half, a 30 s hang at double. */
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
