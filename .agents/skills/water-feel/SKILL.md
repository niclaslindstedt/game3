---
name: water-feel
description: "Use when working on THE SEA — the wave field the hull rides (the Stokes-corrected component sum, its spectrum, its steepness), the sea state a level's wind and fetch build (the JONSWAP / Pierson–Moskowitz spectrum, the fetch-limited growth), how a wave changes coming ashore (dispersion, shoaling, breaking), the orbital velocity the craft feels, the gusts, and how the renderer's water mesh follows all of it. Owns `engine/game/water.ts` and `wind.ts`, `TUNING.sea`, `pwa/src/game/water-mesh.ts`'s displacement, and `make waves` — the lab that must run before and after any change here. Not the hull's answer to the water (`craft-physics`)."
---

# The water's feel

This skill owns **one question**: what is the surface doing at `(x, z, t)`,
and why?

Everything about the answer lives in **`engine/game/water.ts`** — with what
the BED does to a wave (dispersion, shoaling, the depth table, the eikonal
phase field) split into **`engine/game/wave-bed.ts`** beside it for the §20.5
cap — a DOM-free
module of pure functions: a `SeaState` built ONCE from the level's wind and
seed, and `surfaceAt(sea, level, x, z, t)` evaluated wherever anything needs
the surface — twelve times a step under the hull, a few thousand times a
frame under the water mesh, once per transect sample in the lab. Nothing in
it advances; `t` is the only clock. That is what makes the sea deterministic,
what lets the renderer and the engine agree exactly, and what this skill
protects above all else.

**Read this skill's lessons first** —
`node scripts/skill-lessons.mjs water-feel --list`.

| Load beside this one | For |
| --- | --- |
| `craft-physics` | how the hull ANSWERS the surface — buoyancy, slamming, the orbital velocity in the drag |
| `game-feel` | whether the sea reads as drama — the sensation the numbers are in service of |
| `water-look` | what the surface LOOKS like once sampled — the grid of rings, the light, the mirror, the foam; anything that is not a height |
| `mapgen-improvement` | the `offshore` field the fetch reads, the depth the shoaling reads |
| `nature` | what the bed and the shore are made of under the water the mesh colours |

## The models, and where each is written down

Every term here is a published model, named in the comment above it, so a
session can look it up rather than re-derive it. Change a term and the
comment's claim has to stay true.

| Term | Model | Where |
| --- | --- | --- |
| The surface: a sum of N (8) linear components, each carrying a second-order crest correction — a peaked top over a long flat trough | Airy + Stokes (1847) second order, `η = a·sin φ − ½·k·a²·cos 2φ`. NOT Gerstner (Tessendorf 2001): the horizontal displacement would have to be inverted at every probe and vertex | `surfaceAt`, the component loop |
| Each component's amplitude, from the wind and the fetch | A fetch-limited JONSWAP spectrum (Hasselmann et al. 1973), falling back to Pierson–Moskowitz (1964) for the fully developed sea | `createSea` — the spectrum sampled at N frequencies |
| The directions, spread about the wind | A cos²ⁿ spreading function about the mean wind direction | `createSea` |
| Frequency from wavenumber, given the depth | Linear dispersion, ω² = g k tanh(k d) (Fenton & McKee 1990's explicit fit), `d` from `level.ground` | `wavenumber(omega, d)` in `wave-bed.ts` |
| The phase of a component over the level — the wavelength shortening ashore, the crests turning toward the shallows and wrapping into a river mouth | The eikonal |∇φ| = k(d), solved once at build time by fast sweeping (Zhao 2005) from the deep-water plane wave at the rim; its gradient is the local wave vector | `buildPhaseField` in `wave-bed.ts`, read by `surfaceAt` through `sampleFieldGradient` |
| Amplitude growth coming ashore | The linear-theory shoaling coefficient K_s = √(c_g,deep / c_g), with Green's law (H ∝ d^−¼) as the shallow limit | `shoaling(omega, k, d)` in `wave-bed.ts`, precomputed per component into a √d-axis depth table |
| The ceiling on height in shallow water | The depth-limited SIGNIFICANT height, Hs/d = 0.55 (Nelson 1994) — never McCowan's 0.78 applied to the summed amplitudes, which saturates every big sea to one value | the clip inside `surfaceAt` |
| How far out to sea the sea has built | The fetch-limited significant-height law, Hs ∝ U √F (SPM / JONSWAP), capped at the fully developed sea; F is the EFFECTIVE fetch upwind of the point, over a cos-weighted fan (SPM 1984 / Saville) | `engine/game/fetch.ts` — `fetchHeight`, `fetchPeriod`, `createShelter` |
| Which of a level's two seas a point is dealt (R28) | Its EXPOSURE — the share of that fan reaching the open sea. Ocean band × exposure, local wind chop × (1 − exposure) × the chop it grows on its own water | `seaShares(sea, x, z)` |
| How much of the mean wind reaches a place | The same measurement, averaged onto `wind.cell` squares: full over open water, `wind.shelter` of it behind the land | `createShelter`'s `shelter` field |
| What the water itself is doing, where a river runs (R27) | v = Q/A over the channel's cross-section, summed into the wave model's own velocity | `engine/mapgen/flow.ts` — `flowAt` |
| What the water under the surface is doing | The orbital velocity of the same components (the tangent of the water particle's circle) | `surfaceAt`'s `vx, vy, vz` |
| The mean wind, and the gusts on it | A log-law height profile, the shelter field over the plan, and a slowly varying gust factor (Ornstein–Uhlenbeck-like, seeded from `state.rng`) | `engine/game/wind.ts` — `createWind`, `stepWind`, `windAt(wind, y, x, z)` |
| The summary a level or a lab quotes | Hs = 4√m₀ over every band at its share, Tp of whichever is carrying it there | `seaSummary(sea, x, z) → { Hs, Tp }` |
| How big the sea is PAST the level's rim | The biggest a craft can still fly over the rim of and down to the floor of — a closed form QUADRATIC in the top speed, since a wave's width grows with its height and a flight's reach does not. Each level deals its own storm just under it, so the biggest is rare | `jumpableHs`, `STORM_CEILING` (`ocean.ts`), `TUNING.sea.open` |

The knobs are `TUNING.sea` (`engine/game/defs/tuning.ts`): the component
count, the spectrum's peak-enhancement γ (3.3 is JONSWAP's), the spreading
exponent, the steepness cap per component, the fully developed cap, the
breaking ratio (0.78), and the gust's time constant and amplitude. Every one
carries a unit and says whether it is a MEASUREMENT (γ, 0.78, the fetch law's
constant — change one and you are claiming the ocean is wrong) or an ARCADE
DIAL (the steepness cap, the fully developed cap — the two places the sea is
allowed to be more or less than the Baltic would give a 2–12 m/s wind).

## The instrument: `make waves`

A sea is a spectrum, a set of components, and a surface that changes with
depth and fetch — none of which a screenshot can show you. So do not: draw it
on the bench and read it.

```sh
make waves SEED=7                     # one seed's sea
make waves SEED=7 ARGS="--wind 12"    # …at the biome's strongest wind
npm run waves -- --seed 7 --t 0,2,4   # the transect at several instants
```

It writes `previews/waves-<seed>.png` and prints a table. Three panels:

| Panel | The question it answers |
| --- | --- |
| **TRANSECT** | The surface from the shore out to sea, at several `t`, over the bed — does it build with fetch, shoal coming in, break where the bed says, and stay under the cap? |
| **Hs vs OFFSHORE** | The significant height along the same line — the fetch law as a curve; the plateau is the fully developed sea |
| **SPECTRUM** | The N components as bars over the JONSWAP curve they sampled — is the energy where the peak says, and is the spread sane? |

And the table: `Hs`, `Tp`, the peak wavelength, the breaking depth, the
steepest component's `Q·k·A`, and the max and min height over the transect.

**Run it BEFORE the first edit and AFTER the last**, and put both tables in
the PR. It drives the engine directly — no build, no browser, a second or two.

## The rules

- **THE SURFACE IS ONE FUNCTION, AND EVERYBODY CALLS IT.** The hull's probes,
  the water mesh's vertices, the lab's transect and the analyzer's depth
  check all call `surfaceAt`. A renderer-side "improvement" — a shader that
  displaces on its own, a mesh that samples at last frame's `t`, a
  vertex that adds a ripple — is a hull drawn floating above or buried in
  the picture, and it is the single most visible way this game can break.
  Bigger waves are a `TUNING.sea` change, seen by everyone at once.
- **A wave has a CEILING, and it is stated twice.** Per component, the
  crest correction is evaluated at `crestMaxSteepness` at most, or the
  second-order term grows a spurious bump in its own trough; across
  components, the local SIGNIFICANT height is clipped against the depth
  (`breakingHs`·d). Clip the significant height, never the summed
  amplitudes — that sum is the once-in-forever superposition, and a cap on
  it makes every sea above a few metres come out the same height. A sea that
  grows without a cap — a fetch law with no fully developed limit, a
  shoaling coefficient that runs to infinity at zero depth (K_s does; that
  is what Green's law and the breaking clip are FOR), a gust factor that
  compounds — is a sea that eventually throws the craft into orbit, on a
  seed nobody rendered. `tests/waves_test.ts`'s bounded-heights case
  sweeps for it.
- **THE SPECTRUM READS THE FETCH, AND THE FETCH IS WHAT THE WIND CROSSED.**
  `Hs ∝ U √F` is the whole reason one stretch of a level is rougher than
  another, and the reason R12 draws the wind off the sea. `F` is NOT the
  distance from the shore — with an onshore wind a point a few metres off
  a beach has the whole ocean upwind of it, which is why the waves come IN
  against the shore. It is the effective fetch over the WATER upwind
  (`engine/game/fetch.ts`), which land cuts: that is what makes a river a
  river and a channel behind a headland a channel.
- **THE PHASE IS AN EIKONAL, NEVER AN INTEGRAL ALONG A HEADING.** A wave
  field's crests keep |∇φ| = k(d) everywhere and TURN where the bed or the
  land asks them to; a phase integrated along one fixed direction keeps the
  heading and breaks the wavenumber instead, carrying every shoal's delay
  downwind as an offset between neighbouring paths. That reads as a swell
  several times too short, standing or crawling sideways, in every lee and
  either side of every river mouth. The rim is fed the deep-water plane
  wave on the sides the wave enters by and nothing on the others; the wave
  vector `surfaceAt` tilts and pushes the water along is the field's own
  gradient. `tests/waves_test.ts` holds |∇φ|/k at every gate of the corpus
  and Snell's law on the synthetic shore.
- **Dispersion reads the DEPTH AT THE POINT, from `level.ground`.** ω² =
  g k tanh(k d): in deep water a wave's period fixes its length; coming in,
  the same period gets shorter and slower, and the crest steepens. A
  component whose ω was fixed at creation from deep water and never re-read
  gives the same wavelength on the beach as offshore, and the shoaling
  reads wrong on top of it. Read `d` at the sample; clamp it above a small
  positive floor so the tanh never sees zero.
- **THE SEA IS BUILT FROM THE MEAN WIND, NEVER THE GUSTS.** `createSea`
  reads `level.wind`; `stepWind` varies `state.wind` with the gusts. A sea
  rebuilt from the gusted wind is a sea that changes shape every step (and
  a `SeaState` that is no longer a pure function of the seed). The gusts
  reach the craft through the AERO term and the flight, not through the
  water.
- **Zero wind is zero sea — and a spectrum that divides by U says so
  loudly.** JONSWAP's peak frequency is ∝ g/U; at U = 0 it is infinite, and
  a `createSea` that does not short-circuit returns NaN into every probe.
  Every physics test stages a calm sea with `wind: { from: 0, speed: 0 }`,
  so this is the first thing a test suite finds.
- **The orbital velocity is real and the hull feels it.** `surfaceAt`
  returns `vx, vy, vz` — the water's own motion at the point — and the hull's
  drag is against the RELATIVE velocity. That is what makes a wave push the
  craft up its face and pull it back over the crest; a drag against the
  absolute velocity makes the sea a bumpy floor. Sign it against the
  crest's direction of travel (water moves forward at the crest, backward
  in the trough), and prove the sign in `tests/waves_test.ts`.
- **Determinism: no state advances.** Phases are seeded in `createSea`;
  `t` is `state.t`; nothing in `water.ts` reads `state.rng` after creation
  or keeps a counter. Two calls with the same arguments return the same
  surface, and `tests/determinism_test.ts` digests the whole run on it.
- **The renderer displaces on the CPU, calling the same function.** The
  water mesh (`pwa/src/game/water-mesh.ts`) is a lattice of nested rings
  that follows the craft, its vertices displaced each frame by `surfaceAt`
  at the frame's interpolated `t`. It allocates nothing per frame — the
  positions buffer is written in place and flagged. A GPU displacement is a
  second implementation of the surface, and the rule above says why not.
  Everything about that grid that is not the height — the rings, the far
  grid, the colour, the light, the foam — is `water-look`'s.

## Workflow

1. **Take the baseline first.** `make waves` at two or three seeds (a calm
   one, the windiest) before the first edit — it is seconds.
2. **State the sea you want in the lab's terms** — "Hs at the seaward bound
   should be about 0.8 m at 8 m/s, breaking on the bar at 1 m depth" — so the
   after-table has something to be checked against.
3. **Move a `TUNING.sea` number or a term in `water.ts`.** If the change is
   a measurement's constant, say in the PR why the world is wrong.
4. **Re-run the lab, then the tests** — `npx vitest run tests/waves_test.ts
   tests/wind_test.ts`: dispersion (deep-water ω² = gk, shallow ω = k√(gd)),
   shoaling (a wave grows coming in), fetch growth (Hs grows with
   `offshore`, plateaus), the breaking cap (H/d ≤ 0.78 everywhere), bounded
   heights (a sweep over seeds, winds and points never exceeds the cap),
   and the wind's gust statistics.
5. **Then the hull** — `make ride SCENARIO=chop` and `SCENARIO=swell`,
   because a sea change is a hull change: taller water is more slams, more
   launches, more dives. And `make sim`: the `Hs`, `air`, `dive` and `avg`
   columns are where a sea change shows.
6. **LOOK.** `make build`, `make screenshots SCENE=swell` (and `chop`,
   `offshore`) — the surface, the specular, the hull sitting IN the water.
7. Docs: `docs/water.md` — the models, the constants, the lab.

## The traps

- **A wave that grows without a cap** (above). Every term that multiplies
  an amplitude — shoaling, fetch, gust — has a ceiling beside it.
- **A spectrum that ignores fetch** (above). The sea at the shore is not the
  sea at the bound.
- **A renderer that displaces differently from the engine** (above). Same
  function, same `t`.
- **Interpolating `t` past the last step.** The renderer draws between
  steps; the water it draws is at the FRAME's `t`, not the last step's, or
  the hull (at the step's `t`) sits a few centimetres off the drawn surface
  at every frame boundary and shimmers. The accumulator's alpha decides
  the frame's `t`; `run-loop.ts` owns it.
- **Reading the surface outside the level.** The heightfield's sampler
  clamps to its edge; a probe or a mesh vertex beyond the bounds reads the
  edge cell's depth, which is usually the deep bound — fine — but a
  transect that starts inland reads negative fetch and must be treated as
  flat, not extrapolated.
- **Per-call allocation in `surfaceAt`.** It is called tens of thousands of
  times a frame. Return into a caller-supplied object; keep the components
  in flat typed arrays.

## What the change obliges elsewhere

- `docs/water.md` for any model or constant; the README's Why if the claim
  about the water changed.
- `make waves` before/after and `make sim` before/after in the PR.
- A `.changes/unreleased/` fragment — the sea is what the player rides.

## Skill self-improvement

Record lessons under `.agents/skills/water-feel/.lessons/` via the
**`skill-reflection`** skill. What belongs here: a constant that turned out to
be the whole feel, a term whose ceiling was missing, a place the renderer and
the engine disagreed and why.
