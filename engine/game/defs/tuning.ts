// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Global tuning — the numbers that shape the FEEL, shared by every craft
// (per-craft numbers live in craft.ts). Grouped by subject: the clock, the
// two fluids, the sea, the wind, the hull in the water, the planing
// surface, the pump, the flight, the contacts, the course. Every number
// carries its unit; every model it feeds names its source at the function
// that implements it. Tweak here, verify with `npm run sim` and the
// craft/flight/buoyancy tests; the render layer never reads these directly.
//
// The one block stated NEXT DOOR is the arcade assist (`defs/assist.ts`),
// folded in below as `TUNING.assist`: it is the only group in here that
// models nothing, and moving it is what keeps this file under the §20.5
// cap.

import { ASSIST } from "./assist.ts";

/** The clock the whole engine runs on — see `TUNING.physicsHz`. Named out
 * here so the timestep can be derived from it rather than restated. */
const PHYSICS_HZ = 120;

export const TUNING = {
  /** HOW OFTEN THE WORLD IS SOLVED, steps a second. It stays at 120 for the
   * stiff contacts: a ramp and a grounding are penalty springs, and a
   * penalty spring stiff enough to hold three hundred kilos on a plank with
   * millimetres of sink has a natural frequency that 60 Hz cannot follow.
   * The bot decides on every step too: there is no decision hold. */
  physicsHz: PHYSICS_HZ,
  /** ...and the same number as the timestep every rate in here is spent in,
   * seconds. Derived, never authored. */
  dt: 1 / PHYSICS_HZ,

  /** Standard gravity, m/s². */
  g: 9.81,

  /** THE AIR the hull and the rider push through. */
  air: {
    /** Density at sea level, 15 °C, kg/m³ (ISA). */
    density: 1.225,
  },

  /** THE WATER, beyond what the level says about it (`WaterBody.density`). */
  water: {
    /** Kinematic viscosity, m²/s — fresh water at ~15 °C (ITTC 1.139e-6 at
     * 15 °C; the taiga's 8–18 °C brackish water sits within 15% of it, and
     * the friction line is logarithmic in it, so one value serves). */
    viscosity: 1.14e-6,
  },

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
  sea: {
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
  },

  /** THE WIND (`wind.ts`). */
  wind: {
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
  },

  /** THE HULL IN THE WATER (`hull.ts`): buoyancy and the drags. */
  hull: {
    /** Stations along the hull the probes are laid at, as fractions of the
     * length from the transom (0) to the bow (1). Six, because the trim a
     * planing hull settles to is set by where the lift's resultant stands
     * against the centre of gravity, and with fewer the resultant can only
     * jump between stations. */
    stations: [0.06, 0.22, 0.4, 0.58, 0.76, 0.92],
    /** How much of the hull's volume each station owns, transom first —
     * a planing hull carries its volume aft. Normalised at build. */
    stationShare: [0.19, 0.2, 0.19, 0.17, 0.14, 0.11],
    /** ...and how much of the hull's LATERAL area each station carries —
     * aft-heavy, because the sponsons are at the stern and the bow is out
     * of the water at speed. The lateral centre lands a little behind the
     * centre of gravity, which is what makes a yawed hull straighten
     * (weathervane) rather than spin. */
    lateralStationShare: [0.35, 0.28, 0.17, 0.1, 0.06, 0.04],
    /** How far the keel has risen toward the bow at each station, as a
     * fraction of the hull depth: flat aft, then the bow's rise. */
    stationRise: [0, 0, 0, 0, 0.12, 0.42],
    /** How far in toward the keel each station's chines are drawn, as a
     * fraction of the half-beam: the bow's taper. */
    stationTaper: [1, 1, 1, 0.95, 0.75, 0.45],
    /** Of a station's share, how much sits on the keel probe against the
     * two chine probes. */
    keelShare: 0.4,
    /** Where the chine probes sit across the beam, as a fraction of the
     * half-beam. */
    chineOut: 0.8,
    /** The DECK probes: the sealed volume ABOVE the bottom the spec's
     * displacement describes, as a share of it — the seat and the deck —
     * so an inverted hull still floats (a PWC does not self-right from
     * all the way over; the rider flips it, which is what `capsize`
     * below stands in for). It never fills upright. */
    deckShare: 0.55,
    /** Past this immersion, as a fraction of the hull depth, a probe's
     * section counts as BURIED and drags as a bluff body (`diveCd`): a
     * hull on the plane runs shallower, one at rest sits just short of
     * it, and a bow driven in runs well past it. */
    diveDepth: 0.75,
    diveCd: 0.7,
    /** Vertical (heave) drag coefficient of the bottom as a flat plate
     * moving normal to itself (Hoerner 1965 ~1.17). */
    heaveCd: 1.15,
    /** Residuary (wave-making) drag coefficient on the submerged frontal
     * section in displacement mode, sized so the hump costs ~15% of the
     * weight at C_v ≈ 1 as Savitsky's hump data has it. */
    formCd: 0.14,
    /** ...and the same section's coefficient going ASTERN, where the hull
     * is not a hull at all but a flat transom pushed backwards through the
     * water: a bluff plate, Hoerner's ~1.1, near an order of magnitude
     * over the fine end's. It is why a watercraft backs up at walking pace
     * however hard the bucket pushes, and it is a MEASUREMENT of a shape
     * rather than a limiter on reverse. */
    asternCd: 1.1,
    /** Scale on the Newtonian pressure coefficient of the bow's rising
     * bottom (2·sin²σ); 1 is the theory. */
    bowCp: 1,
    /** How much higher a hull at speed rides than at rest, m — what
     * `placeRun` stands a moving craft at so it is not dropped into the
     * water at seventy an hour; the physics settles the rest. */
    planingRise: 0.3,
    /** How much of the deadrise angle the lateral flow on the V bottom
     * turns into vertical force at the outer chine — the panel geometry
     * says tan(deadrise), and 1 is that. */
    chineBank: 1,
    /** THE SPONSONS' BANK-IN, as a lever in units of the keel's own depth
     * below the centre of gravity (`cog.y`): the outside sponson planes on
     * the water it is being pushed across, and the lift it makes rolls the
     * hull INTO the turn in proportion to the sideways force. A PWC leans
     * in where a keel-level side force alone would lean it out (the force
     * acts below the centre of gravity), and the sponsons — plus the rider
     * hanging off (`rider.leanIn`) and the V bottom's own bank
     * (`chineBank`) — are what turn that round. At 1 the sponsons exactly
     * cancel the keel's lever and the lean-in is the rider's and the
     * chines'. */
    sponsonLever: 1.05,
    /** How far under the surface a probe's PATCH counts as fully wet, as a
     * fraction of the hull depth — the friction's measure, where the
     * volume fill is the buoyancy's. */
    patchWet: 0.3,
    /** The fastest the body may spin about any axis, rad/s, and the fastest
     * it may move, m/s — ceilings the integrator clamps to after every step.
     * Nothing in the game reaches either honestly (four turns a second, three
     * times the top speed); they are the wall between a contact that goes
     * wrong and a NaN. */
    maxSpin: 25,
    maxSpeed: 80,
    /** Rotational damping about each body axis, N·m·s (linear), on top of
     * what the probes' drag produces: the water's added-mass damping that
     * a dozen point drags under-count. Pitch, yaw, roll.
     *
     * YAW IS THE SMALLEST OF THE THREE, and the geometry is why: the water
     * a rotating hull has to shift is the area it sweeps normal to the
     * motion. Pitching and rolling sweep the BOTTOM — length × beam, a few
     * square metres; yawing sweeps only the hull's LATERAL profile, length
     * × immersion, which on the plane is a strip a couple of tenths of a
     * metre deep. That is roughly a fifth of the bottom's area on the same
     * lever, so yaw damping belongs well under pitch's, not over it. */
    rotDamp: { x: 300, y: 150, z: 400 },
    /** The share of the total slam that may decelerate the hull, g — the
     * von Kármán pressure on a whole bottom at once is a load the real hull
     * spreads over the pile-up and the flex of the rider's legs; the cap
     * keeps a flat landing a hard event rather than a wall. */
    slamCapG: 7,
    /** Slam pressure fraction: von Kármán's average is for a wedge landing
     * flat; a hull landing at speed meets the water progressively, and
     * this scales the whole force. Dimensionless. */
    slamShare: 0.35,
    /** How much lift a probe at the transom carries against one at the
     * bow, 0..1: the pressure on a planing bottom is a stagnation peak
     * forward tapering to nothing at the transom, and this is the taper's
     * floor (0 would be a clean Kutta transom; a little is kept because
     * the probes stand for whole stations). */
    liftAft: 0.15,
    /** THE CARVE: a banked V bottom is a rudder — the immersed outer chine
     * turns the hull toward the bank. Yaw moment per radian of bank past
     * the dead band per (m/s)² of speed through the water, N·m, read
     * through sin(2·bank) so it peaks at 45°. What lets a leaned hull turn
     * once the thrust, and so the nozzle's authority, has fallen away at
     * speed — and nothing at all inside `carveDead` rad of roll, where
     * both chines are dry: the couple of degrees a crosswind heels a hull
     * or chop rocks it are not a rudder.
     *
     * An ARCADE DIAL, and the one that decides how hard the game can be
     * turned: the nozzle's moment falls away with speed (thrust is
     * ρQ(V_j − V_in), and V_in is the hull's own pace), so past the hump it
     * is the immersed chine that turns a personal watercraft, not the
     * pump. Sized toward the band a ridden ski actually holds — about a g
     * in a committed carve — which puts the skiff near nine tenths of one,
     * a forty-metre circle and a seven-second 180 at speed, the roster
     * spread either side of it. The ceiling on going the rest of the way
     * is `sim/bot.ts`, not the water: past here the bot's steering loop
     * saturates and weaves rather than holding a line, and no pair of its
     * gains fixes that (see its lessons). Raise the two together. */
    carve: 16,
    carveDead: 0.09,
    /** How quickly `planing` (the state readout) follows the lift share,
     * per second. */
    planingFollow: 6,
  },

  /** THE PLANING SURFACE (Savitsky, `hydro.ts`). */
  planing: {
    /** Below this speed coefficient C_v = V/√(gB) the method is invalid and
     * the hull is in displacement mode; the lift fades in over the band to
     * `fadeHigh`. Savitsky's data starts at C_v ≈ 0.6. */
    fadeLow: 0.5,
    fadeHigh: 1.4,
    /** Trim angle band the formula is evaluated over, degrees. Savitsky's
     * data covers 2–15°; below the floor the lift is scaled linearly to
     * zero so a level hull still lifts a little. */
    trimMin: 1.5,
    trimMax: 14,
    /** Wetted length-to-beam ratio band λ. */
    lambdaMin: 0.4,
    lambdaMax: 4,
    /** The lift coefficient's ceiling — the formula runs away at high trim
     * and low speed, where the hull would in truth be porpoising. */
    clMax: 0.35,
    /** The lift's pressure centre sits `cpAft` of the wetted length ahead
     * of the transom when Savitsky's own formula would read past the hull. */
    cpAft: 0.33,
  },

  /** THE PUMP and the engine (`propulsion.ts`). */
  pump: {
    /** THE SPEED CLASS — the one knob that makes every craft on the roster
     * faster or slower TOGETHER, the way a kart game's engine classes do,
     * and the knob the open ocean's biggest wave is sized off (`ocean.ts`).
     *
     * It is quoted in what it BUYS: 1.4 means every hull runs 1.4× the
     * speed the catalog quotes it at. Underneath it is a taller impeller
     * and the engine to swing it — the pitch goes as `speedClass^(1 /
     * classGain)` and the engine's torque as the cube of that pitch,
     * because the pump's load torque goes as pitch³ at a given shaft speed
     * and an engine that did not grow with it would simply bog. MEASURED
     * top speed, km/h, flat out on the calm strip, at the pitch each class
     * asks for:
     *
     *   class    0.75    1.00    1.15    1.30    1.50    1.75    2.00
     *   skiff      58      95     115     134     157     190     195
     *   marlin     62     108     130     150     179     205     246
     *   otter      57      91     110     128     153     185     217
     *   dart       50      78      95     111     133     164     194
     *
     * At 1 every craft reproduces its catalog `topSpeed` exactly. Past 2 the
     * hull is unstable at the speeds it reaches and the top falls again, so
     * 0.75–2 is the usable ladder.
     *
     * IT SHIPS AT 1, AND THE REASON IS THE COURSES. A level's gates are
     * spaced in METRES (`mapgen/rules.ts` reads no speed at all), so a class
     * does not stretch the course it is ridden on — it only gives the rider
     * less time between gates. MEASURED at 1.5 over the sim's corpus: every
     * craft still finishes, but the missed-gate count goes from 5 to 32 on
     * the dart and 24 to 37 on the skiff, the dives roughly double, and the
     * PACE falls (the marlin's 39.6 km/h to 35.6) because a hull that
     * overshoots a gate has to come back for it. `tests/simulation_test.ts`
     * fails outright there. Raising this is therefore a two-part change: the
     * class, and a course whose spacing is a function of the same top speed
     * the ocean's ceiling already reads.
     *
     * Why here and not on a craft: what separates the four hulls is
     * `defs/craft.ts`'s business and must not move when a class does. This
     * scales all four at once and leaves every difference between them
     * where it was — the catalog's `topSpeed` stays the hull's own number,
     * at class 1, and `topSpeedOf` is the one place the class is applied. */
    speedClass: 1,
    /** ...and how much faster a taller impeller actually makes a hull: the
     * exponent in speed ∝ pitch^`classGain`. It is not 1, and the reason is
     * the hull rather than the pump — a planing hull lifts as it speeds up,
     * so its wetted area shrinks and its drag grows SLOWER than v², and a
     * pitch that doubles the jet buys more than double the speed.
     *
     * A MEASUREMENT, fitted over the table above: 1.2 holds every class from
     * 1.15 to 2 to within 2 %. It is here so the class can be quoted in what
     * a player would notice — "half as fast again" — rather than in impeller
     * pitch, which is the thing nobody outside this file thinks in. */
    classGain: 1.2,
    /** ...and HOW MUCH OF THAT SPEED THE CONTROLS ARE TOLD ABOUT. An
     * ARCADE DIAL, 0..1, because every steering term in the model is quoted
     * against the water in ABSOLUTE metres a second — the nozzle's side
     * force is a share of a thrust that grew with the class, the keel's bite
     * and the carve go as v², the plate in the air goes as v² — so a class
     * that scaled only the pump hands the rider a different craft rather
     * than a faster one: four times the yaw acceleration off the same flick
     * of the bars, and a hull that comes round HARDER per metre of track the
     * faster it goes.
     *
     * A CLASS IS A SPEED, NOT A HANDLING PACKAGE. The rule it is sized to is
     * that one craft's classes all manoeuvre the same — and that a faster
     * class never turns SHARPER than a slower one, because nothing that goes
     * faster turns tighter. Slightly wider is right and expected; sharper is
     * the twitch that spins a rider on a gate line. What separates the four
     * HULLS is untouched either way: this scales every craft's own numbers
     * by the same factor, so the roster keeps its spread.
     *
     * 0 leaves the physics alone; 1 takes the rider's deflection down as
     * fast as the speed goes up, which overshoots into a hull that goes soft
     * at the top of the band. THREE QUARTERS is where the turn per metre
     * goes flat-to-slightly-wider across the band on every hull the dial can
     * reach — `craftAtClass`, which applies it, carries the bench. The
     * factor is exactly 1 at class 1, so nothing the roster is tuned or
     * documented at moves because this exists. */
    classSteer: 0.75,
    /** Overall thrust efficiency against the ideal momentum-theory jet —
     * intake duct loss, nozzle loss, impeller slip. Marine waterjets run
     * 0.6–0.75 overall (Bulten 2006); the lower half because a PWC's short
     * flush intake is the poorer of them. Dimensionless. */
    thrustEfficiency: 0.66,
    /** Hydraulic efficiency of the pump, engine shaft → jet kinetic power.
     * Sets the shaft load the engine sees at a given rpm. */
    pumpEfficiency: 0.86,
    /** How much of the hull's forward speed arrives at the intake as inflow
     * velocity: the boundary layer under the hull slows it (wake fraction
     * ~0.1 for a flush intake). */
    inflowFactor: 0.9,
    /** Engine plus impeller shaft inertia, kg·m² — a small marine two- or
     * four-stroke with a light impeller. */
    inertia: 0.06,
    /** Throttle-to-torque lag time constant, s (throttle body, ECU, intake
     * fill). */
    throttleLag: 0.12,
    /** Engine friction torque at redline as a share of peak torque — the
     * over-run drag with the throttle shut. */
    friction: 0.12,
    /** How fast the nozzle swings, rad/s at full input (a cable and a
     * hand). */
    nozzleRate: 6,
    /** How fast the TRIM travels, in trim-ranges a second: a screw or a
     * small motor moving the whole nozzle housing, so about a second and a
     * half from one stop to the other rather than the steering's fifth of
     * one. Quoted as a rate against each craft's own range so a wide-range
     * system is not also a faster one. */
    trimRate: 1.4,
    /** How much of the reversed jet leaves DOWNWARD under the transom, as
     * a share of what the bucket turns. The gate is a clamshell: the flow
     * it catches goes forward and under rather than straight back up the
     * hull's own line, and the reaction squats the stern and puts the bow
     * down — which is why braking hard on a watercraft buries the nose.
     * An ARCADE DIAL sized for that read, not a measured deflection. */
    bucketDown: 0.55,
    /** THE GATE AS A PLATE IN THE WATER: its drag area (C_d·A) fully
     * deployed, in multiples of the nozzle's own area, on a craft whose
     * bucket takes the whole flow (`bucket.reverse` of 1) — `bucketDrag`
     * scales it by both. It is quoted against the nozzle so a bigger pump
     * carries a bigger gate without a second number per craft.
     *
     * WHY IT HAS TO EXIST. Jet thrust falls as the hull speeds up, so a
     * brake built only out of reversed thrust is weakest exactly where a
     * rider reaches for it: at the top of the range the gate was worth
     * about a twentieth of a g, and dropping it at ninety was something a
     * rider could not feel. A real gate is a bluff body hung in the stream
     * and it bites as v², which is what lets a modern electronic brake
     * roughly HALVE a stopping distance from fifty.
     *
     * MEASURED on the flat bench, full lock from a steady top speed, the
     * skiff: it is worth about a fifth of a g at ninety and nothing at the
     * walking pace reverse runs at. Sized so a braked stop lands at about
     * half the coasting distance — the figure quoted for a real electronic
     * brake — rather than to a deflection anyone has measured, so it is an
     * ARCADE DIAL with a real shape rather than a coefficient. */
    bucketDragArea: 1.1,
    /** How far the brake lever opens the throttle on its own, 0..1. The
     * bucket can only turn flow the pump is making, so pulling the lever
     * asks the engine for enough of it to stop with — which is exactly
     * what an electronic brake does and why a watercraft brakes with the
     * engine revving. */
    bucketThrottle: 0.65,
    /** Intake depth below the keel probe at the transom, m: the intake is
     * fed while the transom station is wet to this. */
    intakeDepth: 0.05,
    /** The pump's air load as a share of its water load, when the intake is
     * dry — the impeller spins in spray and the engine runs up to the
     * limiter. */
    airLoad: 0.08,
    /** Hull-keel yaw authority with the throttle closed, N·m per rad of
     * nozzle per (m/s)² — the sponsons and the hull's turned attitude turn
     * it a little without thrust, the way a real one barely answers. */
    keelYaw: 0.6,
    /** THE HIGH-SPEED STEER — how much more everything the nozzle is worth
     * (the jet's side thrust and `keelYaw` alike) buys at the craft's OWN
     * top speed, ramping in with the square of the speed so the bottom half
     * of the range barely moves.
     *
     * An ARCADE DIAL, and what asks for it is geometry rather than the
     * pump: a turn rate is the lateral acceleration over the speed, so the
     * same force on the same hull swings it half as fast at twice the
     * speed. An honest model therefore hands the rider a machine that stops
     * answering the bars exactly where a course needs it most — and the 90s
     * arcade generation this game is measured against did not.
     *
     * MEASURED on the flat strip, full lock held for 4 s from 0.95 of each
     * craft's top speed: degrees of heading turned, and the tightest radius
     * it comes round at, m — at 0 and at this value.
     *
     *   craft      deg →        radius →
     *   skiff    121   134      40.5  33.4
     *   marlin   112   120      40.8  38.7
     *   otter     91   104      54.6  46.9
     *   dart     145   161      26.0  23.0
     *
     * — about a tenth more turn for a tenth off the radius, nothing at all
     * below half speed, and SUB-LINEAR past here: another 0.1 on the dial is
     * worth about 2 % more turn, because at these speeds most of the yaw is
     * already the hull's own. What holds it where it is rather than higher is
     * `make sim` over eight seeds: at 0.35 every craft's pace rises and the
     * resets halve, and at 0.45 the bot starts grounding instead. */
    steerHighSpeed: 0.35,
  },

  /** THE RIDER as a point mass the inputs move (`craft.ts`). */
  rider: {
    /** How far the rider's mass moves aft at full lean back (and forward at
     * full lean forward), m — a rider sliding right back on the seat and
     * hanging off the bars. */
    leanReach: 0.55,
    /** How far the rider's mass moves into a turn at full steer, m, and
     * how much of the steer input becomes lean (a rider hangs off into a
     * hard turn, not into a twitch). */
    leanIn: 0.28,
    /** Rider mass shift lag, s: a body moves slower than a thumb. */
    leanLag: 0.18,
  },

  /** FLIGHT (`flight.ts`): the air over the water. */
  flight: {
    /** The rider's pitch authority in the air, N·m at full lean — the HOLD,
     * sized for attitude: a lean held forward through a 0.7 s hang puts
     * the nose 20–30° down, not on the water's floor. */
    leanTorque: 450,
    /** THE PULL: the angular impulse, N·m·s, a lean held back through the
     * first `pullWindow` seconds off the lip is worth — the rider yanking
     * the bars up. Together with the hold it is what a backflip is made
     * of: with the lean held back, a 1.5 s hang completes one and not much
     * more (`flight_test`), and a lean let go inside the window is no pull
     * at all. Nose-up only: a rider stood on the hull has nothing to push
     * the nose down against. */
    pull: 620,
    pullWindow: 0.25,
    /** Where the windage stands: this high above the centre of gravity, m,
     * and this share of the length AFT of it — the rider's body, over
     * the water's lateral centre. */
    windageY: 0.3,
    windageZ: -0.12,
    /** The rider's roll authority in the air, N·m at full steer, and the
     * yaw the same input buys. */
    steerRoll: 140,
    steerYaw: 60,
    /** Aerodynamic pitch-moment reference: the hull as a flat plate of
     * area `length × beam × plateShare` with its centre of pressure
     * `cpLead` of the length ahead of the centre of gravity. Nose-up in a
     * headwind lifts the nose further (the plate is statically unstable). */
    plateShare: 0.55,
    cpLead: 0.08,
    /** Rotational aero damping, N·m·s per (m/s)... quoted as N·m·s at the
     * reference speed of 20 m/s; scales with airspeed. Keeps a flight
     * that nobody is steering from tumbling. */
    rotDamp: 35,
    rotDampSpeed: 20,
    /** Vertical speed the hull has to LEAVE the water with for it to count
     * as a launch, m/s — a chop hop is not a jump — and how long it has to
     * stay clear, s, before a launch or a landing is reported at all. */
    launchVy: 1.2,
    minAir: 0.2,
    /** ...and how long it has to stay clear for the flight to be AIR TIME,
     * s. A different question from `minAir`, which is the line a flight is
     * read to have HAPPENED at: a hull skipping off a crest for a third of
     * a second still lands, still slams, still throws a sheet, and all of
     * that is reported. It just did not go anywhere, and in a head sea it
     * does it a fifth of the steps — so a clock that started for those
     * would flicker over the horizon all run. Nothing under this counts:
     * the air clock does not start, no line is printed, and no record can
     * fall on it. Half a second is about the shortest flight a rider reads
     * as one. */
    airCounts: 0.5,
    /** A landing whose bow buries deeper than this, m, with the nose this
     * far down, rad, is a DIVE. */
    diveDepth: 0.55,
    divePitch: -0.12,
  },

  /** THE ARCADE ASSIST — the help the rider is given, stated in
   * `defs/assist.ts` beside this file rather than in it. Two hands on
   * two dials (`assist.ts`, `GameState.assist` / `.rampAssist`) and the
   * difficulty ladder over both; the split is the §20.5 cap, not a
   * second tuning file, and every reader still spells it
   * `TUNING.assist`. */
  assist: ASSIST,

  /** CONTACTS with what is not water (`collision.ts`). */
  contact: {
    /** Penalty spring stiffness and damping for a probe pressed into the
     * ground or a ramp, N/m and N·s/m per probe. Stiff enough that a hull
     * riding a ramp sinks millimetres, damped near critical. */
    stiffness: 90_000,
    damping: 3_200,
    /** Coulomb friction on ground (rock, sand — a keel dragging) and on a
     * ramp's wet deck. */
    groundFriction: 0.45,
    rampFriction: 0.08,
    /** A probe further under a ramp's deck than this, m (measured normal
     * to it), did not sink through the deck — it came in through one of
     * the wedge's walls, and is pushed back out through whichever wall is
     * the shallowest way out. Under it, the probe is riding the deck: it
     * is what lets a hull grazing the ramp near its hinge, where the deck
     * stands centimetres up, climb aboard instead of being deflected. */
    rampWallBelow: 0.3,
    /** ...and the most the DECK may then push back on one probe, N. A
     * wall's push is uncapped — it has to stop a hull — but a probe deep
     * in the MIDDLE of the deck is a hull slammed onto it, and this is
     * what holds that push to a landing rather than a launch. */
    rampDeckCap: 20_000,
    /** Restitution against a solid rock, and how much of the tangential
     * speed a glancing hit keeps. */
    restitution: 0.25,
    tangentKeep: 0.85,
    /** The hull's plan radius for solid contact, as a fraction of the
     * half-beam (the probes do the shaping; this is the round-off). */
    hullRadius: 0.9,
    /** The closing speed a `hit` is worth reporting from, m/s, and the
     * cooldown between reports, s. */
    hitSpeed: 1,
    hitCooldown: 0.35,
    /** How far past the bounds a craft may go before the push, m, and the
     * spring that returns it, m/s² per m. */
    boundsMargin: 5,
    boundsSpring: 4,
    /** ...and HOW DEEP the water at the rim has to be for the bound to let
     * a rider through instead, m. The basin cuts its open water off at a
     * straight line and pads every other side with land (R14, R15), so the
     * only water standing at the grid's rim is the sea's — and the sea has
     * no far side (`engine/game/ocean.ts`). Measured over the seed corpus
     * the wet rim cells of a level stand in 21 to 60 m of water, so fifteen
     * opens every one of them and still holds a rider in at the last
     * shallow metres of a river (R26) or a beach that happens to reach the
     * box's corner. */
    boundsOpenDepth: 15,
    /** Cooldown between `ground` events, s. */
    groundCooldown: 0.5,
  },

  /** CAPSIZE (`craft.ts`): a PWC does not self-right, the rider does. */
  capsize: {
    /** How long the hull may lie on its back, s, before the rider has
     * climbed back on and rights it. */
    after: 1.5,
    /** How long the righting takes, s, turning the hull back upright the
     * shortest way with the engine idling. */
    righting: 0.5,
    /** Time constant, s, the way is scrubbed off with meanwhile. */
    slow: 0.15,
  },

  /** THE COURSE (`course.ts`). */
  course: {
    /** Seconds added to the run for a gate passed over, so a missed gate
     * still counts as reached at a price. */
    missedPenalty: 5,
    /** Where a reset stands the craft: this far behind the gate it goes
     * back to, m, so the line is crossed by a MOVE. */
    resetBack: 6,
    /** How far off a gate's centre a crossing still counts as having gone
     * PAST that gate, m — five gate-widths.
     *
     * A gate's line is infinite, and a craft crossing it half a level away
     * has not passed the gate, it has passed somewhere else. Inside this,
     * a crossing outside the buoys is a rider who went by the gate on the
     * wrong side, and the run carries on with the miss charged; outside it
     * the crossing means nothing and the gate is still ahead. Without it a
     * course with corners in it (R22) can deadlock — a rider who misses
     * two gates in a row is never given a third. */
    missWide: 60,
  },
} as const;
