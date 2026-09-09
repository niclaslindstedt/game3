# The water

The sea is the game, and it is built in one file: `engine/game/water.ts`, numbers in `TUNING.sea` and `TUNING.water` (`engine/game/defs/tuning.ts`). A `SeaState` is built ONCE per run from the level's wind and the seed; after that the surface is a pure function of `(x, z, t)`. Nothing advances, nothing is stored between calls, and `t` is the only clock — which is why the craft's hull probes can read it at 120 Hz and the renderer can read the SAME function to displace its mesh, and what is drawn is what is simulated.

What comes back from one call (`surfaceAt(sea, level, x, z, t, out?)`, a `SurfaceSample`): the surface `height` (m against sea level), its unit normal `(nx, ny, nz)`, and the water's orbital velocity at the surface `(vx, vy, vz)` (m/s, world frame). `heightAt` is the height alone. Every formula below names its source; every number is quoted with its unit as `TUNING` states it.

## Building the sea (`createSea(level, seed, wind = level.wind)`)

The field is a sum of `TUNING.sea.components` = 8 sinusoidal components — Gerstner/trochoidal waves (Tessendorf 2001; Finch, _GPU Gems_ 1 ch. 1) **with the horizontal displacement dropped**, so that the height is a function of the undisplaced `(x, z)` the physics asks about. The crests lose their trochoidal sharpening; the heights, slopes and orbital velocities are linear (Airy) theory's, which is what the rest of the model — dispersion, shoaling, breaking — is stated in anyway.

1. **The reference fetch.** The sea is quoted at the COURSE: the mean offshore distance of the level's gates (`courseOffshore`; the furthest cell of open water for a level with no gates) is stretched into the fetch the growth laws work in: `fetchRef = effectiveFetch(courseOffshore)`, where

   ```
   effectiveFetch(offshore) = baseFetch + fetchScale · max(offshore, 0)     [m]
   baseFetch = 30 000 m, fetchScale = 100
   ```

   A level is a kilometre of coast, but the fetch-limited growth laws work in tens of kilometres — a hundred metres of real fetch grows a four-centimetre ripple. So the game's fiction is that the shore is a piece of a longer coast facing the open sea, and the level lies nearer it than its bounds say: the lee of the shore reads 30 km of fetch (half a metre of significant height at the lightest wind the rule book draws), and a point 100 m out reads 40 km. The growth SHAPE is still Hasselmann's; only the metre is stretched. Quoting at the course rather than at the furthest cell is what gives the gates the period their own fetch earns: the one peak period the field carries (below) is the sea under the course, not the longer, gentler swell of the open water several hundred metres further out.

2. **The headline numbers.** The significant height and the peak period at the reference fetch, for the mean wind `U` (m/s at 10 m):

   ```
   fetchHeight(U, F):  Hs = min( 1.6e-3 · √(gF/U²) · U²/g ,  0.21 · U²/g )          [m]
   fetchPeriod(U, F):  Tp = max( 0.6, min( 0.286 · (gF/U²)^⅓ · U/g ,  2π·U/(0.877·g) ) )   [s]
   ```

   The first term of each is the SPM (1984) fetch-limited law — `g·Hs/U² = 1.6·10⁻³·(g·F/U²)^½` and `g·Tp/U = 0.286·(g·F/U²)^⅓` — and the cap is the fully developed Pierson–Moskowitz (1964) sea, `Hs = 0.21·U²/g` and `ω_p = 0.877·g/U`. `g` is `TUNING.g` = 9.81 m/s². A wind of 0 makes a flat sea (`Hs = 0`, `Tp = 1`).

   **A sea can also be quoted outright** — `createSea(level, seed, wind, { hs, tp? })`, a `SeaOverride`; `createGame({ sea: { hs } })` and the app's `?hs=` hand it in. The significant height at the course is then the number given, in place of the wind's, and the period, when not given, is the one a grown wind sea of that height carries: the significant steepness `Hs/L₀` of a mature sea sits near `TUNING.sea.steepness` = 0.04 (Toba 1972's 3/2 law lands there), and `L₀ = g·Tp²/2π` turns that round —

   ```
   periodForHeight(Hs):  Tp = max( 0.6, √( 2π·Hs / (g · steepness) ) )     [s]
   ```

   so a one-metre sea is a four-second one and a twenty-metre sea an eighteen-second one (λ₀ = 500 m). The fetch still shapes an overridden sea: the height quoted is the course's and it grows to seaward by the wind's own law (uniform when there is no wind). **There is no arcade ceiling**: the field is bounded by the fully developed law and by the depth under it (McCowan, below) and by nothing else, and every term — the depth table, the phase field, the orbital velocity — is sized so a twenty-metre sea over deep water stands (`tests/waves_test.ts`'s storm case rides one for ten seconds). Over the generator's 25 m bed the breaking clip holds such a sea to some ten metres of height; a deeper bed lets it stand whole.

3. **The components.** Eight frequencies, log-spaced over the band `bandLow..bandHigh` = 0.7–2.4 × the peak `ω_p = 2π/Tp` (JONSWAP's energy sits between ~0.7 and ~2 f_p; the tail past 2.5 f_p is too short to feel through a hull), each owning the band between the midpoints to its neighbours:

   ```
   lo = 0.7·(2.4/0.7)^(i/8),  hi = 0.7·(2.4/0.7)^((i+1)/8)
   ω_i = ω_p · √(lo·hi),   Δω_i = ω_p · (hi − lo)
   ```

   Each draws a direction off the wind's direction of travel (`wind.from + π` — waves travel WITH the wind) from a cos² directional spread (Longuet-Higgins et al. 1963) truncated at `spread` = ±0.6 rad (~35°), by inverse transform on the seeded stream — `s = 0.6·(2u − 1)`, weighted `cos²((s/0.6)·π/2)` — so the components lean toward the wind. Its energy weight is the JONSWAP density at its frequency times its bandwidth times that directional weight:

   ```
   S(ω) ∝ ω⁻⁵ · exp(−1.25·(ω_p/ω)⁴) · γ^r,   γ = 3.3,
   r = exp(−(ω − ω_p)² / (2σ²ω_p²)),  σ = 0.07 below the peak, 0.09 above
   ```

   (Hasselmann et al. 1973; the Phillips constant α is dropped because the amplitudes are normalised afterwards.) The deep-water amplitudes are scaled so the components' energy sums to the reference sea's zeroth moment, `m0 = Σ a²/2 = (Hs/4)²`, i.e. `a_i = √(2·m0·w_i / Σw)`. Each component also draws a phase offset in `[0, 2π)`. The stream is `createRng((seed ^ 0x5ea5ea) >>> 0)` — the sea's own, so a level and its sea reproduce from the seed alone.

4. **Per component, a depth table and a phase field** (below).

`SeaState` carries `windSpeed`, `windFrom`, `fetchRef`, `hsRef`, `tp`, `windHs` (what the wind alone grows at the reference fetch — the fetch growth's denominator) and the components; `seaSummary(sea, offshore)` returns `{ Hs, Tp }` — the quoted Hs grown by the fetch law to that distance, Tp the field's one peak period. The sim's `maxHs` column is this Hs at the craft's position.

## Dispersion (`wavenumber(ω, d)`)

Each component keeps ONE frequency and direction and lets its wavenumber follow the depth through the dispersion relation `ω² = g·k·tanh(k·d)` (Airy). Rather than iterate the root, the engine uses Fenton & McKee (1990)'s explicit fit, within 1.7 % of the exact root everywhere and exact in both limits:

```
k₀ = ω²/g                                (deep water)
k  = k₀ / tanh((k₀·d)^0.75)^(2/3)
```

The depth is floored at `minDepth` = 0.15 m so the relation and the shoaling coefficient stay finite where the bed comes up to the surface — by then the breaking cap has already clipped every wave to nothing worth drawing. `tests/waves_test.ts` holds the fit to both limits and to `ω² = g·k·tanh(k·d)` within 3 % over ω = 0.7–2.5 rad/s and d = 0.4–30 m.

Each component precomputes a table over depth, `tableStep` = 0.1 m apart out to `tableDepth` = 250 m (2 501 rows — past half the wavelength of the longest swell the model is asked to carry, so a deep bed reads as deep water rather than as the table's last row; the generator's own bed stops at −25 m, and a tenth of a metre resolves the shallows where the coefficients actually move): the local `k`, the shoaling coefficient `Ks`, and `coth(k·d)` for the orbital velocity. `surfaceAt` reads it linearly between rows.

## The phase field

The spatial phase of a component is not `k₀·(d̂·x)` — that is the deep-water plane wave — but `∫ k(d)·ds` along its direction of travel, integrated ONCE over the level's grid at build time (`buildPhaseField`): an upwind sweep in the component's direction, each cell one step of `k(d)·ds` past the weighted average of its two upwind neighbours, `ds = cell / (|d̂_x| + |d̂_z|)`. Cells upwind of the grid read the plane wave, which is where the deep water is. Where the depth is uniform this reproduces the plane wave exactly; where the bed rises the wavelength shortens honestly toward the shore. **Refraction — the direction bending toward the shore — is not modelled**: every component keeps its heading.

## Shoaling (`shoaling(ω, k, d)`)

The amplitude grows as the group velocity slows over a rising bed, energy flux conserved (Dean & Dalrymple 1991 §5):

```
n  = ½·(1 + 2kd / sinh 2kd)
cg = n·ω/k,   cg₀ = g/(2ω)
Ks = √(cg₀ / cg)
```

Green's law `√√(d₀/d)` is its shallow limit. `Ks` is 1 in deep water and grows in the shallows; the test holds both and that it never falls below 1 on the way in.

## Fetch growth (`fetchGrowth(sea, offshore)`)

How much of the quoted amplitude reaches a point `offshore` metres out is the fetch law's own growth, `fetchHeight(U, effectiveFetch(offshore)) / windHs` — under 1 inshore of the course, past 1 to seaward of it, so the chop builds riding out and calms riding in; 1 everywhere for a quoted sea with no wind to grow it. Read off the engine (`fetchHeight` / `fetchPeriod` at the stretched fetch):

| Wind (m/s at 10 m) | 0 m out (30 km)     | 50 m (35 km)  | 100 m (40 km) | 250 m (55 km) |
| ------------------ | ------------------- | ------------- | ------------- | ------------- |
| 6                  | Hs 0.53 m, Tp 3.5 s | 0.57 m, 3.7 s | 0.61 m, 3.9 s | 0.72 m, 4.3 s |
| 10                 | 0.88 m, 4.2 s       | 0.96 m, 4.4 s | 1.02 m, 4.6 s | 1.20 m, 5.1 s |
| 14                 | 1.24 m, 4.7 s       | 1.34 m, 4.9 s | 1.43 m, 5.1 s | 1.68 m, 5.7 s |

The rule book draws a level's wind from 6–14 m/s (R12 — a fresh breeze most days, a strong one on some), so the calmest shore in the game carries half a metre of significant height in its lee and the roughest close to two metres at its seaward bound; the individual waves run to nearly twice that. At a hull's pace that is a crest every second or so: the climb, the launch, the drop into the next face. `offshore` is the level's `offshore` heightfield (metres from the nearest shoreline, negative inland), read with `sampleField`; the generator (`compile.ts`) bakes it.

## Breaking

McCowan (1894): a solitary wave breaks when its height passes `breakingRatio` = 0.78 of the depth. The limit is on the wave HEIGHT (crest to trough), which for a sum of sinusoids is at most twice the summed amplitude, so `surfaceAt` caps the summed, shoaled, fetch-grown amplitude at `0.78·d/2` and scales every component by the same factor when the sum passes it. Energy is not removed and the crest is not reshaped — it is a clip, applied to the sum at each point. The test holds the height everywhere in 0.5 m of water under the cap and the sea bounded everywhere.

## The surface (`surfaceAt`)

For every component at the point, with `a` the deep amplitude × `Ks(d)` × the fetch growth × the breaking clip, `k` the local wavenumber and the phase `φ = phaseField(x, z) − ω·t + φ₀`:

```
height  = Σ a·sin φ
slope   = Σ a·k·d̂·cos φ                        (the phase gradient; the amplitude's own
                                                 gradient is a shoaling effect too slow to tilt the surface)
normal  = (−slope_x, 1, −slope_z) / |…|
v_h     = Σ a·ω·coth(k·d)·sin φ · d̂            (Airy: horizontal orbital velocity, in phase with the height)
v_y     = −Σ a·ω·cos φ                          (the surface's own rate of rise)
```

The orbital velocity is what makes a wave face lift the bow and a crest carry the hull: the hull's drags are computed against the flow RELATIVE to the water (`hull.ts` subtracts the sample's `vx, vy, vz` from each probe's velocity), so a hull sitting on a crest is pushed along with it and one climbing a face meets water coming at it. A mesh of forty thousand vertices calls this once a vertex a frame; the `out` parameter is how it allocates nothing.

## What the renderer reads

`pwa/src/game/water-mesh.ts` displaces a grid following the craft by calling `surfaceAt` per vertex on the CPU (the height; the normal for shading). Under it a coarse FAR grid, out to the fog, calls the same function with `surfaceAt`'s `count` — the first that many components, which are the longest, since the field is laid from the low end of the band up — so a storm's swell stands out to the horizon while the chop that would alias on a thirty-metre cell is left off; the near grid's edge fades to the far grid's surface rather than to flat. The wake (`wake.ts`) and the foam patches (`spray.ts`) put their vertices on the same call. There is no second wave function — not in a shader, not in the renderer — which is the whole point: a wave the physics did not compute cannot be drawn, and one the renderer cannot draw cannot be felt.

## The wind the sea is built from (`engine/game/wind.ts`)

The sea is built from the level's MEAN wind (the spectrum needs a wind that has blown for hours, not this second's gust). The gusts are what the hull and the rider feel through the aero drag and what a hull in the air feels as a side force and a pitch moment:

- **The profile** is the log law (Prandtl; Stull 1988 §9): `U(z) = U_ref · ln(z/z₀) / ln(z_ref/z₀)` with the sea's roughness length `z₀` = `roughness` = 2·10⁻⁴ m (Charnock 1955 at moderate winds), `referenceHeight` = 10 m, and the height floored at `minHeight` = 0.3 m so a probe in a trough never reads a wind blowing backwards. A rider six metres up off a ramp feels more wind than the hull did.
- **The gust factor** is an Ornstein–Uhlenbeck process about 1 — `dx = −(x − 1)/τ·dt + σ·√(2dt/τ)·N` — with `intensity` σ = 0.11 (the turbulence intensity σ_u/U over water at 10 m, IEC 61400-3 offshore class), `gustTime` τ = 12 s (the gust integral time scale), clamped to `gustMin..gustMax` = 0.55–1.6 × the mean. A second, slower process wanders the direction: `veer` σ = 0.12 rad, `veerTime` = 25 s, clamped to ±3σ.
- Each Gaussian is one Box–Muller draw (two uniforms off `state.rng`, the second of the pair deliberately NOT kept — a state that carries a spare draw replays differently from where it was saved), so `stepWind` draws four uniforms a step, every step, whether or not anything feels the wind. That is what keeps a calm level and a gale consuming the same stream and a replay on the same numbers.

`windAt(wind, y)` is the wind VELOCITY at height `y` — it blows TOWARD the opposite of `from`. `tests/wind_test.ts` holds the profile, the reference height, the bounds and the seeding.

## The numbers, in one place

| Knob                                 | Value       | Unit   | What it buys                                                     |
| ------------------------------------ | ----------- | ------ | ---------------------------------------------------------------- |
| `sea.components`                     | 8           | —      | components in the sum                                            |
| `sea.bandLow` / `bandHigh`           | 0.7 / 2.4   | × ω_p  | the band the components are laid over                            |
| `sea.spread`                         | 0.6         | rad    | cos² directional spread half-width (~35°)                        |
| `sea.baseFetch` / `fetchScale`       | 30000 / 100 | m, —   | the stretched fetch: `30000 + 100·offshore`                      |
| `sea.minDepth`                       | 0.15        | m      | floor on the depth the model reads                               |
| `sea.breakingRatio`                  | 0.78        | —      | McCowan's H/d                                                    |
| `sea.tableStep` / `tableDepth`       | 0.1 / 250   | m      | the per-component depth table                                    |
| `sea.steepness`                      | 0.04        | —      | Hs/L₀ of a grown sea — a quoted height's period                  |
| `water.viscosity`                    | 1.14·10⁻⁶   | m²/s   | kinematic viscosity for the ITTC-57 line (fresh water at ~15 °C) |
| `wind.roughness`                     | 2·10⁻⁴      | m      | the log law's z₀                                                 |
| `wind.referenceHeight` / `minHeight` | 10 / 0.3    | m      | where the mean is quoted; the profile's floor                    |
| `wind.intensity` / `gustTime`        | 0.11 / 12   | —, s   | the gust process                                                 |
| `wind.veer` / `veerTime`             | 0.12 / 25   | rad, s | the direction's wander                                           |
| `wind.gustMin` / `gustMax`           | 0.55 / 1.6  | × mean | the gust factor's bounds                                         |

The level contributes `wind.speed` (6–14 m/s, R12) and `wind.from`, its `offshore` and `ground` fields, and `water.density` (1005 kg/m³ on the taiga coast — brackish; R13), which is the density every hydrostatic and hydrodynamic force uses.

## What holds it

`tests/waves_test.ts`: the dispersion relation in both limits and everywhere between; the shoaling coefficient's growth; the fetch law's growth to seaward and its PM cap; McCowan's cap in the shallows; bounded heights everywhere; purity (the same point at the same time is the same surface). `tests/wind_test.ts`: the profile and the gusts. `tests/determinism_test.ts`: a run replays. **`make waves SEED=`** (`scripts/waves-lab.mjs`) is the lab: a transect from the shore out to sea at several moments, Hs against offshore distance, the spectrum, and a table of Hs, Tp, wavelength and the depth a wave breaks at — required before and after any change to `water.ts`, because a wave model is judged by the sea it makes and a screenshot shows one wave.

## What is NOT modelled

A list a future session can pick from, each a known simplification rather than an oversight:

- **Refraction.** Components keep their heading; the phase field shortens the wavelength with the depth but never turns the crests parallel to the shore. (Would need a ray trace or a per-component direction field.)
- **Horizontal Gerstner displacement.** The trochoidal sharpening of the crests is dropped so the height is a function of the undisplaced `(x, z)`; crests are sinusoidal, not peaked.
- **Wave–current interaction.** There is no current; the orbital velocity is the only water motion.
- **Whitecapping and dissipation.** The only energy loss is the McCowan clip at a point; nothing breaks progressively, and a breaking wave sheds no foam, spray or turbulence into the physics.
- **Wind sea vs swell.** One peak period per level: a quoted sea (`SeaOverride`) REPLACES the wind sea rather than standing beside it as a second peak.
- **Directional spread beyond ±35°.** Truncated cos², eight draws — the sea is always more or less aligned with the wind.
- **Wave–wave (nonlinear) interaction**, wave set-up, set-down and run-up at the shore.
- **Reflection and diffraction** off skerries and headlands; the lee of a skerry is not calmer.
- **The amplitude's own gradient in the slope** (shoaling is too slow to tilt the surface, and it is left out of the normal).
- **Gusts in the sea.** The spectrum reads the mean wind only; a gust changes the aero, never the water.
- **Temperature.** One viscosity for the friction line; the water's temperature is carried on the level for the fauna and the spray to read later.
- **Rain, ice, tides.** The weather module (`engine/mapgen/weather.ts`) is a placeholder.

## Sources

Tessendorf, _Simulating Ocean Water_ (2001) · Finch, "Effective Water Simulation from Physical Models", _GPU Gems_ 1 ch. 1 (2004) · Hasselmann et al., JONSWAP (1973) · Pierson & Moskowitz (1964) · _Shore Protection Manual_ (SPM, 1984) fetch-limited growth · Longuet-Higgins, Cartwright & Smith, directional spectra (1963) · Fenton & McKee, "On calculating the lengths of water waves" (1990) · Dean & Dalrymple, _Water Wave Mechanics for Engineers and Scientists_ (1991) · McCowan (1894) · Charnock (1955) · Stull, _An Introduction to Boundary Layer Meteorology_ (1988) · IEC 61400-3.
