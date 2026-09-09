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
   * The bot decides at the same rate (`botHz`). */
  physicsHz: PHYSICS_HZ,
  /** ...and the same number as the timestep every rate in here is spent in,
   * seconds. Derived, never authored. */
  dt: 1 / PHYSICS_HZ,
  /** How often the bot re-reads the course, decisions a second. */
  botHz: PHYSICS_HZ,

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

  /** THE SEA — the wave field built from the wind (`water.ts`). */
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
    /** Directional spread half-width about the wind, radians (~35°) — a
     * cos² spread (Longuet-Higgins 1963) truncated there. */
    spread: 0.6,
    /** THE FETCH the level's shore is stood in front of. A level is a
     * kilometre of coast, but the fetch-limited growth laws work in tens of
     * kilometres: a hundred metres of real fetch grows a four-centimetre
     * ripple. So the game's fiction is that the shore is a piece of a
     * longer coast and the whole level is nearer the open sea than its
     * bounds say: the wave model reads fetch as `baseFetch + fetchScale ×
     * offshore` (m), which is what makes the chop visibly build riding out
     * over the hundred metres the course spans. The growth SHAPE is still
     * Hasselmann's; only the metre is stretched. */
    baseFetch: 4000,
    fetchScale: 40,
    /** The smallest depth the wave model reads, m: keeps the dispersion
     * relation and the shoaling coefficient finite where the bed comes up
     * to the surface, and is where the breaking cap has already clipped
     * every wave to nothing worth drawing. */
    minDepth: 0.15,
    /** McCowan (1894): a solitary wave breaks when its height passes 0.78
     * of the depth. Applied to the summed height at a point. */
    breakingRatio: 0.78,
    /** Depth table pitch, m, and reach, m, for the per-component shoaling
     * lookup (`waveTable`). The bed never goes below the compiler's −25 m
     * and a tenth of a metre resolves the shallows where the coefficient
     * actually moves. */
    tableStep: 0.1,
    tableDepth: 40,
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
     * length from the transom (0) to the bow (1). */
    stations: [0.08, 0.35, 0.62, 0.88],
    /** How much of the hull's volume each station owns, transom first —
     * a planing hull carries its volume aft. Normalised at build. */
    stationShare: [0.3, 0.32, 0.25, 0.13],
    /** Of a station's share, how much sits on the keel probe against the
     * two chine probes. */
    keelShare: 0.4,
    /** Where the chine probes sit across the beam, as a fraction of the
     * half-beam, and how much the bow station is drawn in toward the keel. */
    chineOut: 0.8,
    bowTaper: 0.45,
    /** How much the keel rises toward the bow, as a fraction of the hull
     * depth at the bow station (rocker plus the bow's rise). */
    bowRise: 0.45,
    /** The DECK probes: the share of the volume above the chines, so an
     * inverted hull still floats (a PWC does not self-right from all the
     * way over; the rider flips it, which is what `reset` is for). */
    deckShare: 0.18,
    /** Vertical (heave) drag coefficient of the bottom as a flat plate
     * moving normal to itself (Hoerner 1965 ~1.17). */
    heaveCd: 1.15,
    /** Form drag coefficient of the submerged frontal section in
     * displacement mode — the bluff shape a hull pushes at hump speed. */
    formCd: 0.65,
    /** How much of the deadrise angle the lateral flow on the V bottom is
     * allowed to turn into vertical force at the outer chine — the hull's
     * bank-in. Tangent of the deadrise gives the panel geometry; PWCs bank
     * harder than their bottom alone explains because the sponsons and the
     * outer planing surface load up in a yawed turn, which this scales. */
    chineBank: 2.2,
    /** Rotational damping about each body axis, N·m·s (linear), on top of
     * what the probes' drag produces: the water's added-mass damping that
     * a dozen point drags under-count. Pitch, yaw, roll. */
    rotDamp: { x: 60, y: 40, z: 45 },
    /** The share of the total slam that may decelerate the hull, g — the
     * von Kármán pressure on a whole bottom at once is a load the real hull
     * spreads over the pile-up and the flex of the rider's legs; the cap
     * keeps a flat landing a hard event rather than a wall. */
    slamCapG: 7,
    /** Slam pressure fraction: von Kármán's average is for a wedge landing
     * flat; a hull landing at speed meets the water progressively, and
     * this scales the whole force. Dimensionless. */
    slamShare: 0.35,
    /** Wetted-area share of the bottom the friction line runs over at
     * full plane — the wetted length is only the aft part of the keel. */
    planingWet: 0.45,
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
    keelYaw: 1.2,
  },

  /** THE RIDER as a point mass the inputs move (`craft.ts`). */
  rider: {
    /** How far the rider's mass moves aft at full lean back (and forward at
     * full lean forward), m — a rider sliding on the seat. */
    leanReach: 0.32,
    /** How far the rider's mass moves into a turn at full steer, m, and
     * how much of the steer input becomes lean (a rider hangs off into a
     * hard turn, not into a twitch). */
    leanIn: 0.28,
    /** Rider mass shift lag, s: a body moves slower than a thumb. */
    leanLag: 0.18,
  },

  /** FLIGHT (`flight.ts`): the air over the water. */
  flight: {
    /** The rider's pitch authority in the air, N·m at full lean — the
     * arcade number the whole air game hangs on. Sized so a full backflip is
     * REACHABLE from a big ramp with the lean held back and nothing else
     * (the flight tests hold it there), and no more: a normal jump levels
     * with a touch, not a fight. */
    leanTorque: 950,
    /** The rider's roll authority in the air, N·m at full steer, and the
     * yaw the same input buys. */
    steerRoll: 260,
    steerYaw: 120,
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
     * as a launch, m/s — a chop hop is not a jump. */
    launchVy: 1.2,
    /** A landing whose bow buries deeper than this, m, with the nose this
     * far down, rad, is a DIVE. */
    diveDepth: 0.55,
    divePitch: -0.12,
    /** Seconds after a landing the readout keeps counting toward before
     * it stops mattering (the camera's settle window). */
    landingWindow: 3,
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

  /** THE COURSE (`course.ts`). */
  course: {
    /** Seconds added to the run for a gate passed over, so a missed gate
     * still counts as reached at a price. */
    missedPenalty: 5,
    /** Where a reset stands the craft: this far behind the gate it goes
     * back to, m, so the line is crossed by a MOVE. */
    resetBack: 6,
  },
} as const;
