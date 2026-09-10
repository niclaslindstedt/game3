// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Global tuning — the numbers that shape the FEEL, shared by every craft
// (per-craft numbers live in craft.ts). Grouped by subject: the clock, the
// two fluids, the sea, the wind, the hull in the water, the planing
// surface, the pump, the flight, the contacts, the course. Every number
// carries its unit; every model it feeds names its source at the function
// that implements it. Tweak here, verify with `npm run sim` and the
// craft/flight/buoyancy tests; the render layer never reads these directly.

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
    /** Depth table pitch, m, and reach, m, for the per-component shoaling
     * lookup (`buildTable` in water.ts). A tenth of a metre resolves the
     * shallows where the coefficient actually moves; the reach is past
     * half the wavelength of the longest swell the model is asked to
     * carry (a twenty-metre sea's five hundred metres), so a deep bed
     * reads as deep water rather than as the table's last row. The
     * generator's own bed stops at −25 m. */
    tableStep: 0.1,
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
    /** A landing whose bow buries deeper than this, m, with the nose this
     * far down, rad, is a DIVE. */
    diveDepth: 0.55,
    divePitch: -0.12,
  },

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
    /** A probe further under a ramp's deck than this, m, and within
     * `rampFlankBand` m of the deck's edge, did not sink through the deck
     * — it came in through the flank, and is pushed back out sideways. A
     * deep probe in the MIDDLE of the deck is a hull slammed onto it, and
     * the deck pushes back, up to `rampDeckCap` N a probe. */
    rampFlankBelow: 0.3,
    rampFlankBand: 0.6,
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
