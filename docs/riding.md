# Riding

The craft model (`engine/game/craft.ts`, with `hull.ts`, `hydro.ts`, `propulsion.ts`, `flight.ts`, `collision.ts`; numbers in `engine/game/defs/tuning.ts` and the catalog in `defs/craft.ts`) is a rigid body afloat, integrated semi-implicitly at 120 Hz. Every force is summed in `stepCraft`, each from the module that owns its model, and each model names its source at the function that implements it. **There is no MODE.** A launch is a hull whose probes all came out of the water; a landing is one whose probes went back in; a dive is a landing whose bow went in first. Each is read off the same forces every other step is made of, and the events say so after the fact. The one exception is the rider righting a capsized hull (below), which is a half-second in which nothing is a force.

Every number below is quoted with its unit as `TUNING` states it; the per-craft ones are the catalog's, and the measured ones at the end come from riding the real engine on the synthetic drag strip the tests use.

## The rider first

The rider is a point mass in the spec (`riderMass` kg, `riderHeight` m above the centre of gravity) that nothing draws yet and the physics still carries. The inputs move it, slower than a thumb: full lean back or forward shifts it `rider.leanReach` = 0.55 m aft or forward, full steer hangs it `rider.leanIn` = 0.28 m into the turn, and both lag with a time constant of `rider.leanLag` = 0.18 s. Gravity on the two masses (the rider's at `riderHeight`, the hull's balanced below it so the pair cancels at neutral) turns the shift into a trim moment — which is the whole of what `lean` does afloat, and `tests/craft_test.ts` holds that leaning back at speed lifts the nose.

## The hull as probes (`hull.ts`)

The hull is 22 probes laid out from the spec's `length`, `beam`, `height` and `deadrise`: six stations along the keel at `hull.stations` = 0.06, 0.22, 0.4, 0.58, 0.76, 0.92 of the length from the transom, each a keel probe and two chine probes (`chineOut` = 0.8 of the half-beam, drawn in by `stationTaper` toward the bow, lifted by the deadrise), plus four deck probes at the sheer — the gunwales, both sides, fore and aft — owning the sealed volume above the bottom. Each probe owns a share of the hull's volume (`stationShare`, aft-heavy — a planing hull carries its volume aft; `keelShare` = 0.4 of a station on the keel), a share of its bottom area (the plan area is `length × beam × 0.72`), and a share of its lateral projection (`lateralStationShare` = 0.35, 0.28, 0.17, 0.1, 0.06, 0.04 — the sponsons are at the stern and the bow is out at speed, so the lateral centre lands behind the centre of gravity and a yawed hull weathervanes rather than spins). The bow's rise is `stationRise` = 0, 0, 0, 0, 0.12, 0.42 of the hull depth, which gives the forward probes a slope. The deck probes hold `deckShare` = 0.55 of the displacement so an inverted hull still floats (a PWC does not self-right from all the way over; the rider flips it, which is what `reset` is for); upright they never fill.

Every step, `placeProbes` puts each probe in the world off the body's pose and rates (`v_p = v + R(ω × p)`) and the craft reads `surfaceAt` under every one — the height, the normal AND the orbital velocity, so every water force below is computed against the flow relative to water that is itself moving. The inertia tensor is the hull as a box of its own dimensions plus the rider's mass at `riderHeight` on the pitch and roll axes (`inertia`); `totalMass` is hull plus rider.

**Buoyancy (Archimedes).** `F = ρ·g·V·fill` straight up per probe, `fill` the smooth clip of the probe's depth under the surface over its band (0.72 of the hull depth for a bottom probe, 0.3 for a deck probe); the torque falls out of where the probe sits. At rest the craft floats where Archimedes puts it — `restY(spec, density)` bisects the level, still-water immersion at which the probes' volume × density = mass — and `tests/buoyancy_test.ts` holds a settled craft to it, holds a denser hull lower, rights a heeled one and floats one all the way over. `standCraft` stands every craft at `restY` above the surface; a craft placed under way sits `hull.planingRise` = 0.3 m higher so it is not dropped into the water at seventy an hour.

**The drags**, per wet probe, on the relative flow resolved into the body frame:

- _Skin friction_ along the hull: `−½·ρ·C_F·A·|u|·u` over the wet patch (a patch is wet in AREA as soon as the surface reaches `patchWet` = 0.3 of the hull depth — the friction's measure, where the volume fill is the buoyancy's), with `C_F` the ITTC-57 model-ship correlation line, `C_F = 0.075 / (log₁₀ Re − 2)²`, `Re = u·L/ν`, `ν` = `water.viscosity` = 1.14·10⁻⁶ m²/s, floored at Re = 10⁵.
- _Residuary (form) drag_ in displacement mode: a bluff-body drag `formCd` = 0.14 on the submerged frontal section (`beam × immersion × lateralShare`), sized so the hump costs ~15 % of the weight at C_v ≈ 1 as Savitsky's hump data has it. It fades with `(1 − planingShare)` — past the hump the bottom is a lifting surface and the lift's tilt is the pressure drag.
- _Lateral_: the keel and the sponsons as a plate against the sideways flow, `−½·ρ·lateralCd·A_lat·|u_r|·u_r` with `A_lat = length × immersion × lateralShare` and `lateralCd` the spec's — the force that makes the hull carve rather than skate.
- _Heave_: the bottom as a flat plate moving normal to itself, `heaveCd` = 1.15 (Hoerner 1965 ~1.17).
- _The bow's lift_: the rising bottom forward meets the flow at its slope plus the local trim, and the pressure on an inclined plate — Newtonian impact theory's `C_p = 2·sin²σ` (Hayes & Probstein 1959), scaled by `bowCp` = 1 — acts normal to the bottom: mostly up, a little back. This is the bow wave's lift, what trims a hull nose-up through the hump before Savitsky's lift takes the weight, and what a bow buried at speed is pushed back out by, and decelerated by.
- _The dive's drag_: a section immersed past `diveDepth` = 0.75 of the hull depth is BURIED and pushes water ahead of itself as the bluff body it then is, `diveCd` = 0.7 on the buried frontal area — the deceleration of a dive.
- _The chine's bank-in_: the sideways flow meets the V panel on the side the hull slides toward, and that panel's normal has an upward part of `tan(deadrise)` per unit of lateral force (`chineBank` = 1 is the geometry). Lifting the outer chine rolls the hull INTO the turn, which is what a PWC does and a keel-level lateral force alone would do the opposite of.
- _Rotational damping_ beyond the probes': `hull.rotDamp` = 300 / 650 / 400 N·m·s about pitch / yaw / roll, scaled by how wet the hull is — the added-mass damping a dozen point drags under-count.

**Slamming (von Kármán 1929).** A probe ENTERING the water — descending into a band it has not yet filled — feels the wedge impact: the added mass of the entering wedge grows with the wetted half-width `c = V·t·cot β`, an average pressure of `½·ρ·V²·(π·cot β)` over the strip, applied over the part of the probe's patch still to be wetted `(1 − fill)` and scaled by `slamShare` = 0.35 (a hull landing at speed meets the water progressively, not flat). It acts along the hull's up, so a wedge entering nose-down pushes the bow back up — the pitch-up a flat landing recovers by, and the pitch-down a buried bow does not get. The whole hull's slam is capped at `slamCapG` = 7 g of the total weight (the pile-up Wagner 1932 doubles `c` by is a pressure real hulls spread and riders' knees absorb), and the fastest entering probe's descent is what the `land` event reports as `vy`.

**Planing lift (Savitsky 1964, `hydro.ts`).** The lift coefficient of a prismatic planing surface at trim `τ` (degrees) and mean wetted length-to-beam ratio `λ` at speed coefficient `C_v = V/√(g·B)`:

```
C_L0 = τ^1.1 · (0.0120·λ^0.5 + 0.0055·λ^2.5 / C_v²)
C_Lβ = C_L0 − 0.0065·β·C_L0^0.6        (β the deadrise, degrees)
L    = ½·ρ·V²·B²·C_Lβ                   along the hull's up
```

The lift is faded in over `planing.fadeLow..fadeHigh` = C_v 0.5–1.4 (Savitsky's data starts at ~0.6; below it the hull is in displacement mode and the probes are the whole story), `τ` clamped to `trimMin..trimMax` = 1.5–14° with the lift scaled linearly to zero under the floor, `λ` clamped to `lambdaMin..lambdaMax` = 0.4–4 with the same scaling under the floor, and `C_Lβ` capped at `clMax` = 0.35 (the formula runs away at high trim and low speed, where a real hull would be porpoising). The wetted length is read off the keel's immersion at the transom and the bow stations (`wettedLength`), continuous in the hull's pose so the trim settles rather than hunts. The lift's tilt by the trim IS the method's induced drag `W·tan τ`.

It is applied in `hullForces` as a **strip model**: each wet bottom probe lifts by the coefficient its OWN local flow angle earns, weighted by its share of the bottom (rising toward the bow — `liftAft` = 0.15 is the taper's floor at the transom, where a clean Kutta transom would be 0) times how wet its patch is. Every bottom probe is counted in the shares, wet or not: a strip lifts only while it is in the water, so a hull with half its bottom clear carries half the lift, not all of it on whatever is left wet. A probe moving down into the water meets it at a steeper angle and lifts harder. That is the planing surface's heave and pitch damping falling out of the geometry rather than being added, and what keeps the hull from porpoising. The resultant stands at the wetted bottom's centroid rather than at Savitsky's `0.75·λ·B`; `pressureCentre` in `hydro.ts` computes the latter and is exported, but nothing in the physics reads it. An inverted hull's bottom is in the air: no planing lift. The `planing` readout (0..1, the lift's share of the weight) follows the lift at `planingFollow` = 6 /s for the HUD and the spray.

## The pump (`propulsion.ts`)

A personal watercraft has no propeller, no rudder and no gears: an axial-flow pump draws water through a flush intake under the transom and throws it out of a nozzle, and the nozzle swings to steer. Three consequences the whole handling model rests on: thrust falls as the hull speeds up, thrust vanishes the moment the intake leaves the water, and with no thrust there is almost nothing to steer with.

- **Momentum theory** (Allison 1993; Bulten 2006 ch. 2): the jet velocity `V_j = impellerPitch · rpm / 60`, the flow `Q = A_nozzle · V_j` (`A_nozzle = π·d²/4` from the spec's `nozzleDiameter`), and the thrust `T = η_t · ρ · Q · (V_j − V_in)`, with the inflow `V_in = inflowFactor · V_through_water`, `inflowFactor` = 0.9 (the boundary layer under the hull slows the intake's inflow), and the overall thrust efficiency `thrustEfficiency` = 0.66 for the duct, nozzle and impeller losses (marine waterjets run 0.6–0.75; a PWC's short flush intake is the poorer). Never negative — at a closed throttle at speed the intake is a drag, not a brake, and the hull's own drag stands for it — and zero with the intake out of the water. The intake is fed while the transom-station keel is within `pump.intakeDepth` = 0.05 m of the surface, and the engine has a tilt cut-off: a capsized craft's throttle is closed.
- **The pump load**: the jet's kinetic power `½·ρ·Q·V_j²` over `pumpEfficiency` = 0.86, which is ∝ rpm³, so the shaft torque is ∝ rpm². With the intake dry it falls to `airLoad` = 0.08 of that and the engine runs up to the limiter — `tests/craft_test.ts` holds an airborne engine at > 98 % of redline.
- **The engine**: the spec's torque curve (a marine four-stroke's shape — rising to a plateau at 70 % of redline and falling to the rated power at `maxRpm`) times the lagged throttle (`throttleLag` = 0.12 s), less a friction torque of `friction` = 0.12 of peak torque at redline growing linearly with rpm; the shaft (`inertia` = 0.06 kg·m²) integrates `(T_engine − T_pump)/I`. The pump term is integrated IMPLICITLY — its stiffness at redline is several times the step's reciprocal, and an explicit step would ring. The idle governor holds `idleRpm` and the limiter `maxRpm`.
- The jet leaves the transom turned by the nozzle and the reaction on the hull is its opposite, applied 0.1 m ahead of the transom and 0.1 m above the keel, so a nozzle swung for a clockwise turn throws the jet to the right-rear and pushes the stern LEFT.

`staticThrust` is the pull at the dock at redline; `jetCeiling` (in `limits.ts`) is the jet's own speed at redline, which nothing pushes the hull past. The catalog test holds every pump matched to its engine at the limiter (pump torque 0.85–1.05 × engine torque) and its static pull to 0.6–1.6 × the weight — a jet ski, not a tug.

## Steering, and the off-throttle characteristic

- **The nozzle** swings toward the steer input at `nozzleRate` = 6 rad/s × its full deflection (a cable and a hand), to `±nozzleAngle` — the spec's, 20–26°. The thrust vector yaws with it; the yaw moment is the reaction's lever about the centre of gravity.
- **With the throttle shut** there is only the little the keel and the sponsons turn by the nozzle's attitude rather than its thrust: `pump.keelYaw` = 0.6 N·m per rad of nozzle per (m/s)² through the water, scaled by how wet the hull is. This is the real off-throttle characteristic, kept on purpose: a jet ski steers by pointing its thrust, and with no thrust there is nothing to point.
- **The carve.** A banked V bottom is a rudder: `hull.carve` = 7 N·m per metre of `liftX` per (m/s)² of speed through the water, scaled by how wet the hull is and how far onto the plane. `liftX` is where the wet bottom's centre actually sits across the hull (`hull.ts`: the wetness-weighted lateral centre of the lift shares, body right positive) rather than the roll angle — a hull leaned far enough to put a chine in the water carves on that chine, and one wobbling two degrees in chop with both chines dry does not. This is what lets a leaned hull keep turning once the thrust — and so the nozzle's authority — has fallen away at speed, and why the stand-up (which lays over furthest) is the one craft that still turns much with the throttle shut.
- **The bank.** The lateral force acts on the keel below the centre of gravity, which alone would lean the hull OUT of a turn. Three things turn that round: the outside sponson planing on the water it is being pushed across (`sponsonLever` = 1.05 in units of the keel's own depth below the centre of gravity — at 1 it exactly cancels the keel's lever), the V bottom's own bank-in (`chineBank`), and the rider hanging off (`rider.leanIn`). `tests/craft_test.ts` holds every craft banking INTO a full-lock turn at 20 m/s, under 0.9 rad for the sit-downs and under 1.6 for the stand-up.

Measured on the synthetic drag strip — four seconds of full lock at 20 m/s, the way `craft_test` does it — the heading turned WITH the throttle open against SHUT, at the bootstrap commit: skiff 1.38 vs 0.41 rad, marlin 1.51 vs 0.30, otter 0.91 vs 0.25, dart 1.65 vs 0.70 (the stand-up's rider steers it by leaning, and a leaned V bottom carves whether the pump is pushing or not). The test holds the ratio above 1.8 for the sit-downs and 1.2 for the dart, and the tightest radius under power between 4 and 80 m.

## The air (`flight.ts`)

Afloat, the air is drag: `½·ρ_air·C_dA·|v_rel|·v_rel` against the WIND-relative velocity (`windAt` at the craft's height — the gusts, the log-law profile), `ρ_air` = `air.density` = 1.225 kg/m³, `cdA` the spec's (hull plus rider, 0.75–0.95 m²), at the centre of gravity. Out of the water — `airShare` rises from 0 to 1 as the wetted share falls, and is 1 when airborne — three more things fade in:

- **The flat plate.** The hull at angle of attack `α` to the airflow with the Newtonian normal-force coefficient `C_N = 2·sin α·cos α` (Hoerner 1965; good to 45° and bounded past it) on a plate of `plateShare` = 0.55 of `length × beam`, acting `cpLead` = 0.08 of the length ahead of the centre of gravity: a nose-up hull in a headwind lifts its nose further — the flat plate's static instability, and what a rider leans against.
- **The rider's authority**, stated as the arcade number it is: `leanTorque` = 950 N·m at full lean in pitch (nose-up for lean back), `steerRoll` = 140 N·m at full steer in roll and `steerYaw` = 60 N·m in yaw. Real riders do rotate a craft in the air by pulling on the bars and moving their mass; the size is chosen for what the air game needs rather than measured — the hold alone is sized for ATTITUDE, so a normal jump levels with a touch. **The pull** is what a backflip is made of: for the first `popWindow` = 0.25 s of a flight a lean held BACK is the rider yanking the bars up off the lip, worth `popTorque` = 2800 N·m on top (an impulse of 700 N·m·s). Pulling only — a rider standing on the hull has nothing to push the nose down against. `airPitchTorque()` in `limits.ts` is the hold's number for the bot.
- **Rotational damping** `rotDamp` = 35 N·m·s at `rotDampSpeed` = 20 m/s, scaling with airspeed, so a flight nobody is steering does not tumble.

**The events.** The hull is airborne when nothing on it touches water, ground or ramp — read, not declared. A launch is reported once the hull has been clear for `flight.minAir` = 0.2 s (a stern probe re-touching a ramp's lip for a step is not two jumps) and only if it left with at least `launchVy` = 1.2 m/s of climb (a chop hop is not a jump); a landing only after a flight that long. A dive develops over the steps after a landing — the bow keeps going in — and is reported once per landing when the bow probe is `diveDepth` = 0.55 m under with the nose below `divePitch` = −0.12 rad.

**The backflip.** `tests/flight_test.ts` holds it: a 10 m ramp at 0.5 rad, entered at 20 m/s with the lean held back from the deck onward, rotates the hull through more than 2π in more than 1.5 s of air, and the same ramp levelled by the rider lands upright and rides on. That ramp is steeper than any the generator lays (R8's band is 15–22°, 8–10 m) — from a generated ramp the flip is a matter of pace and the lean, and it is reachable, not scored (`engine/game/tricks.ts` is a placeholder).

## Contacts (`collision.ts`)

- **Ground and ramps** are penalty contacts on the probes: a probe under the surface is pushed back along the surface's normal by a spring `contact.stiffness` = 90 000 N/m and a damper `damping` = 3200 N·s/m per probe (stiff enough that a hull riding a ramp sinks millimetres, damped near critical — and the reason the engine runs at 120 Hz: 60 cannot follow that spring), with Coulomb friction against the tangential slide, `groundFriction` = 0.45 on rock and sand, `rampFriction` = 0.08 on a wet deck. The ground's normal is the heightfield's gradient. A ramp is a plane hinged at the water at its rear edge (`(x, z)` is the HINGE — the one statement of the anchor is `rampSurface` in `mapgen/course.ts`; `rampDeckY` here is the same line), rising `angle` toward its front, with a submerged approach lip half its length behind the hinge so a hull slides onto it rather than hitting a step. A probe more than `rampFlankBelow` = 0.3 m under the deck and within `rampFlankBand` = 0.6 m of the deck's edge came in through the ramp's FLANK and is pushed back out sideways instead; a deep probe in the MIDDLE of the deck is a hull slammed onto it, and the deck pushes back, capped at `rampDeckCap` = 20 000 N a probe.
- **Solids** (skerries, boulders, reefs) are vertical cylinders resolved as an impulse at three keel points (stern, middle, bow) against the hull's plan radius `hullRadius` = 0.9 of the half-beam: the hull is pushed out along the radial, the closing speed is reversed by `restitution` = 0.25, `tangentKeep` = 0.85 of the slide is kept, and the contact's offset from the centre of gravity turns the impulse into yaw. A reef whose top the keel clears is not a contact. A `hit` is reported from `hitSpeed` = 1 m/s of closing, at most every `hitCooldown` = 0.35 s.
- **The bounds** push softly back inside: past `boundsMargin` = 5 m from the edge, an acceleration of `boundsSpring` = 4 m/s² per metre of overshoot, clamped at ±40 m/s² — a slope, never a wall.
- A `ground` event is reported when the keel meets the ground closing at over 0.4 m/s, at most every `groundCooldown` = 0.5 s.

`tests/collision_test.ts` holds a skerry pushing the hull out and reporting, a beach grounding it, a ramp carrying it up its deck, a cleared reef being no contact, and the edge being a slope.

## The capsize

A PWC does not self-right; the rider does. A hull on its back — its up pointing down — with the water under it for `capsize.after` = 1.5 s is over for good: a `capsize` event fires and the rider climbs back on. For `capsize.righting` = 0.5 s the orientation is turned back upright the shortest way, the way is scrubbed off with a time constant of `capsize.slow` = 0.15 s, the hull is eased to its rest draft and the engine idles; nothing else acts on the hull meanwhile — the rider is standing on it. This is the one branch of `stepCraft` that is a STATE rather than a force (`craft.righting` counts it down; `capsizedFor` counts toward it), and it is deterministic: `tests/buoyancy_test.ts` holds an inverted hull afloat, the event firing once, and two capsizes righting the same way twice. The bot no longer resets on a capsize; it waits.

## Gates and the reset (`course.ts`)

A WATER gate is a line between two buoys `width` (12 m) apart, crossed by a move through it in the facing direction; an AIR gate is a ring of `width` (6 m) diameter whose centre stands `y` metres up, passed by a move through its disc. Gates are taken in order: the next counts; the one after counts too but charges `course.missedPenalty` = 5 s for the one skipped (`missedGate` — the skipped gate is then treated as reached, so a rider who overshoots a buoy is not sent back for it); anything further ahead is ignored. The last gate is the finish. `reset` stands the craft `resetBack` = 6 m behind the last gate it took (or at the start), facing the next, at rest at its rest draft with its cooldowns cleared, and records `progress.lastResetAt`. `tests/course_test.ts` holds all of it.

## The integration

Velocity first, then position off the new velocity (semi-implicit Euler); the torques summed in the body frame with the gyroscopic term `ω × Iω` kept — negligible for a hull afloat, and the thing that makes a tumbling one tumble the way a real body does; the orientation quaternion integrated from the body rates. Two ceilings nothing honest reaches, `hull.maxSpin` = 25 rad/s and `hull.maxSpeed` = 80 m/s, are the wall between a contact that goes wrong and a NaN — `tests/simulation_test.ts` rides sixty seconds of chop, a gale, a capsize and a beach and holds every number finite. Then the readings: `heading`, `pitch`, `roll` off the quaternion (`lib/quat.ts` owns the sign flip: pitch nose-up positive, roll right-side-down positive, rates right-handed), `speed` = |v| (what the speedo reads), `wetted`, `submergedDepth`, `onRamp`, `onGround`, `landing` (seconds since the last landing).

## The catalog (`defs/craft.ts`)

Four answers to the same shore, not four points on one scale. None of them is real: the numbers sit inside the published range for personal watercraft (dry mass 150–420 kg, 60–230 kW, 70–110 km/h, deadrise 16–24°) without being any one manufacturer's row, and `tests/craft_test.ts` holds the range. `topSpeed` and `accel0to50` are DERIVED EXPECTATIONS, not inputs: the physics is what makes the craft go that fast, and the test holds the physics to reproducing each within 10 % (top) and 20 % (0–50) on flat water — the measured columns below are that run, on the synthetic strip at density 1005 kg/m³.

|                                                        | Skiff               | Marlin              | Otter               | Dart               |
| ------------------------------------------------------ | ------------------- | ------------------- | ------------------- | ------------------ |
| Character                                              | light runabout      | heavy performance   | stable touring      | stand-up           |
| Dry mass / with rider (kg)                             | 245 / 325           | 360 / 442           | 420 / 505           | 150 / 228          |
| Length × beam × depth (m)                              | 3.10 × 1.18 × 0.62  | 3.45 × 1.26 × 0.68  | 3.55 × 1.32 × 0.72  | 2.70 × 0.90 × 0.50 |
| Deadrise (°) / displacement (m³)                       | 18 / 0.66           | 22 / 0.92           | 20 / 1.05           | 16 / 0.34          |
| CoG above keel / ahead of mid (m)                      | 0.42 / −0.31        | 0.45 / −0.35        | 0.46 / −0.36        | 0.30 / −0.27       |
| Power (kW) / redline / idle (rpm)                      | 96 / 7600 / 1500    | 225 / 8000 / 1600   | 130 / 7300 / 1500   | 60 / 7000 / 1400   |
| Nozzle Ø (m) / deflection (°) / impeller pitch (m/rev) | 0.0675 / 24 / 0.283 | 0.0853 / 22 / 0.305 | 0.0868 / 20 / 0.275 | 0.069 / 26 / 0.26  |
| C_dA (m²) / lateral C_d                                | 0.75 / 1.25         | 0.85 / 1.35         | 0.95 / 1.15         | 0.80 / 1.05        |
| Rider (kg) / height (m)                                | 80 / 0.55           | 82 / 0.58           | 85 / 0.60           | 78 / 0.95          |
| **Top speed, sheet / measured (km/h)**                 | 88 / 85.6           | 108 / 110.0         | 85 / 85.2           | 76 / 72.1          |
| **0–50 km/h, sheet / measured (s)**                    | 2.6 / 2.67          | 1.8 / 1.59          | 2.8 / 2.75          | 2.7 / 2.91         |
| Rpm at top speed                                       | 7228                | 7605                | 6979                | 6628               |
| Rest draft, keel below still water (m)                 | 0.34                | 0.39                | 0.40                | 0.33               |
| Static thrust / weight                                 | 0.96                | 1.45                | 0.89                | 1.02               |
| Jet ceiling (km/h)                                     | 129                 | 146                 | 120                 | 109                |
| Tightest radius, full lock on power at 20 m/s (m)      | 61                  | 70                  | 95                  | 45                 |
| Bank in that turn (rad)                                | 0.28                | 0.46                | 0.23                | 0.30               |

The measured rows are a snapshot from the bootstrap commit, taken while the carve was being retuned (the otter's radius was over the test's 80 m ceiling at that moment); the sheet and the test's tolerances are the contract, and `make ride` and `craft_test` re-measure in seconds. Change a row and the test says what the change did to the sheet; change a shared number and `make sim` says what it did to the roster (`craft-tuning` owns the loop). For the ride lab's cells, `hullForces` also reports the vertical budget along the hull's up — `buoyancy`, `planingLift`, `bank`, `bowLift`, `heave`, `slam` — so a picture can say what carried the hull at each sixth of a second.

## The input contract

```ts
type CraftInput = {
  steer: number; // −1..1, positive = CLOCKWISE seen from above (right in map view)
  throttle: number; // 0..1, analogue — there is no brake; the throttle IS the control
  lean: number; // −1..1, +1 = the rider leans BACK (nose up); in the air, the pitch control
  reset: boolean; // edge: back to the last gate passed, facing the next, at rest
};
```

No brake, no handbrake, no gears. The screen-side sign flip (the chase camera's view mirrors the map) lives in `pwa/src/game/input-model.ts` and nowhere else.

## What holds it

`tests/buoyancy_test.ts` (Archimedes, the draft, righting), `tests/craft_test.ts` (the sheet, the pump, the steering), `tests/flight_test.ts` (the arc, the landing, the dive's cost, the backflip, the quaternion algebra), `tests/collision_test.ts`, `tests/course_test.ts`, `tests/place_test.ts`, `tests/simulation_test.ts` (nothing explodes; the bot finishes), `tests/determinism_test.ts`. **`make ride SCENARIO=`** (`scripts/ride-lab.mjs`) is the lab: the craft in profile every sixth of a second over the water it crossed, with speed, pitch, wetted share, rpm and air time beside each cell — required before and after any change to the hull, the planing lift, the slamming or the flight.

## What is NOT modelled

- **Ventilation and cavitation** of the pump — thrust never breaks away at high rpm or in aerated water; the intake is either fed or dry.
- **Trim tabs, an adjustable nozzle trim, a reverse bucket** — the nozzle only yaws.
- **Rider body dynamics** — the rider is a lagged point mass; no legs absorbing a slam, no standing, no falling off. The capsize is the one thing the rider "does", and it is a timer (`wipeout` — the rider thrown, the swim back — is a reserved skill).
- **Damage** — `engine/game/damage.ts` is a placeholder; a hit costs speed and heading, never the machinery.
- **Added mass** beyond the slam and the lumped rotational damping; **hull flex**; **spray** as a force; **wave-making** beyond the form drag.
- **Porpoising** — clamped away by `clMax` rather than reproduced.
- **The intake's drag with the throttle shut** — thrust floors at zero; the hull's own drag stands in.
- **Fuel and its mass**, water in the hull, temperature effects on the water or the engine.
- **Trick scoring** — `engine/game/tricks.ts` is a placeholder; the orientation history is already there to read.

## Sources

Savitsky, "Hydrodynamic Design of Planing Hulls", _Marine Technology_ (1964) · ITTC 1957 model-ship correlation line · von Kármán, "The impact on seaplane floats during landing" (1929) · Wagner (1932) · Hayes & Probstein, _Hypersonic Flow Theory_ (1959) for the Newtonian pressure coefficient · Hoerner, _Fluid-Dynamic Drag_ (1965) · Allison, "Marine waterjet propulsion" (1993) · Bulten, _Numerical Analysis of a Waterjet Propulsion System_ (2006) · Archimedes.
