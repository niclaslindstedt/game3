# The water

The sea is the game, and it is built in one file: `engine/game/water.ts`, numbers in `TUNING.sea` and `TUNING.water` (`engine/game/defs/tuning.ts`). A `SeaState` is built ONCE per run from the level's wind and the seed; after that the surface is a pure function of `(x, z, t)`. Nothing advances, nothing is stored between calls, and `t` is the only clock — which is why the craft's hull probes can read it at 120 Hz and the renderer can read the SAME function to displace its mesh, and what is drawn is what is simulated.

What comes back from one call (`surfaceAt(sea, level, x, z, t, out?)`, a `SurfaceSample`): the surface `height` (m against sea level), its unit normal `(nx, ny, nz)`, and the water's orbital velocity at the surface `(vx, vy, vz)` (m/s, world frame). `heightAt` is the height alone. Every formula below names its source; every number is quoted with its unit as `TUNING` states it.

## Building the sea (`createSea(level, seed, wind = level.wind)`)

The field is a sum of `TUNING.sea.components` = 8 components, each a linear (Airy) wave carrying **Stokes' second-order correction** (1847): `η = a·sin φ − ½·k·a²·cos 2φ`. That second term is the trochoidal shape — a peaked crest over a long flat trough — and taking it this way rather than as the Gerstner horizontal displacement (Tessendorf 2001; Finch, _GPU Gems_ 1 ch. 1) keeps the height a function of the **undisplaced** `(x, z)` the physics asks about: a Gerstner field would have to be inverted at every hull probe and every mesh vertex. Heights, slopes and orbital velocities are otherwise linear theory's, which is what the rest of the model — dispersion, shoaling, breaking — is stated in anyway. `TUNING.sea.crestSharpness` multiplies the correction (1 is Stokes' own coefficient) and `crestMaxSteepness` is the `a·k` it is evaluated at, at most, since the expansion grows a second bump in the trough if pushed past its range.

1. **The reference fetch, and what stands upwind.** Before anything is quoted, the level is MEASURED against the wind it is to be ridden in (`createShelter` in `engine/game/fetch.ts`, below): every cell of the grid gets its **effective fetch** — how much water the wind crossed to reach it — and its **exposure**, how much of that run reaches the open sea rather than stopping at land. The ocean band is then quoted at the COURSE: the mean of the reach over the level's gates, stretched into the fetch the growth laws work in:

   ```
   effectiveFetch(reach) = baseFetch + fetchScale · max(reach, 0)     [m]
   baseFetch = 30 000 m, fetchScale = 100
   ```

   A level is a kilometre of coast, but the fetch-limited growth laws work in tens of kilometres — a hundred metres of real fetch grows a four-centimetre ripple. So the game's fiction is that the shore is a piece of a longer coast facing the open sea, and the level lies nearer it than its bounds say. The growth SHAPE is still Hasselmann's; only the metre is stretched. Quoting at the course rather than at the furthest cell of open water is what gives the gates the period their own fetch earns: the one peak period the ocean band carries is the sea under the course, not the longer, gentler swell several hundred metres further out.

2. **The headline numbers.** The significant height and the peak period at the reference fetch, for the mean wind `U` (m/s at 10 m):

   ```
   fetchHeight(U, F):  Hs = min( 1.6e-3 · √(gF/U²) · U²/g ,  0.21 · U²/g )          [m]
   fetchPeriod(U, F):  Tp = max( 0.6, min( 0.286 · (gF/U²)^⅓ · U/g ,  2π·U/(0.877·g) ) )   [s]
   ```

   The wind sea's height and period then take `TUNING.sea.heightScale` = 1.5 and `periodScale` = 1.0 — the two arcade dials that say how big and how long a wind sea is _here_ against what the law alone grows. The fetch growth is a ratio, so neither disturbs its shape. Steepness goes as `heightScale / periodScale²`, so the two together are the whole of how a wind sea reads; pushing them to 1.8 / 0.85 (2.5× the natural steepness) made a sea the bot spent a third of every run airborne in, and `make sim` fell from 16/16 finished to 12/16.

   The first term of each is the SPM (1984) fetch-limited law — `g·Hs/U² = 1.6·10⁻³·(g·F/U²)^½` and `g·Tp/U = 0.286·(g·F/U²)^⅓` — and the cap is the fully developed Pierson–Moskowitz (1964) sea, `Hs = 0.21·U²/g` and `ω_p = 0.877·g/U`. `g` is `TUNING.g` = 9.81 m/s². A wind of 0 makes a flat sea (`Hs = 0`, `Tp = 1`).

   **A sea can also be quoted outright** — `createSea(level, seed, wind, { hs, tp? })`, a `SeaOverride`; `createGame({ sea: { hs } })` and the app's `?hs=` hand it in. The significant height at the course is then the number given, in place of the wind's, and the period, when not given, is the one a grown wind sea of that height carries: the significant steepness `Hs/L₀` is `TUNING.sea.steepness` = 0.09 and `L₀ = g·Tp²/2π` turns that round —

   ```
   periodForHeight(Hs):  Tp = max( 0.6, √( 2π·Hs / (g · steepness) ) )     [s]
   ```

   **The steepness is the dial that decides whether a big sea reads as a wave at all**, because what the eye reads is the FACE and the face's angle is the steepness, not the height. A mature ocean sea runs 0.03–0.05 (Toba 1972), which is why a real twenty-metre sea is a five-hundred-metre swell with a ten-degree face — at sea you feel it and from a boat you cannot see it. 0.09 buys the young, wind-driven storm sea instead: a twenty-metre sea is a twelve-second, 222 m wave you have to climb. It stays clear of Michell's 1/7 = 0.142 breaking limit deliberately: a sea sitting ON the limit is one the renderer paints entirely in foam, and a twenty-metre swell comes out looking like a snowfield. The fetch still shapes an overridden sea: the height quoted is the course's and it grows to seaward by the wind's own law (uniform when there is no wind). **There is no arcade ceiling**: the field is bounded by the fully developed law and by the depth under it (below) and by nothing else, and every term — the depth table, the phase field, the orbital velocity — is sized so a twenty-metre sea over deep water stands (`tests/waves_test.ts`'s storm case rides one for ten seconds). **A wave only stands its full height in water it cannot feel the bottom of**, so where the sea is quoted matters as much as what it is quoted at: over the 25 m at the foot of R3's coastal shelf the clip holds a twenty-metre sea to some fourteen, and it is only itself out past 400 m where the bed has fallen to the open sea's 60 m. The `storm` scenario stands the craft there.

3. **The components — TWO BANDS (R28).** A level holds two kinds of water and they do not carry the same waves, so the field is laid in two bands and every point takes a share of each.

   **The ocean band** (`sea.components` = 8) is the sea the wind grew over the whole coast's fetch — the long, ordered thing a race is ridden in. Its share at a point is that point's **exposure**: 1 out at sea and 1 a few metres off an open beach (R12's wind blows in off the water, so the ocean is upwind of the whole coast — _the waves come in against the shore_), 0 a hundred metres up a river the land has closed round.

   **The local band** (`sea.localComponents` = 5) is the chop the local wind grows on the water it actually crossed: short, small, and quoted ONCE per level at the mean wind over `sea.localFetch` = 2 km of arcade fetch, with `localFetchScale` = 40 stretching a point's own reach (a fortieth of `fetchScale` — the fiction about a longer coast says nothing about water with a bank on both sides). Its share is `(1 − exposure) · chop`, where `chop` is the local wind sea's height at that point against the level's quote — so it fills in exactly where the ocean band does not and the two never double-count. A river ends up with a 5 m, 1.8 s ripple a few centimetres high; a wide channel behind a headland gets something between. The local band carries no phase field: a five-metre wave feels the bottom only in water a hull is already aground in, so it is a plane wave, which is a grid sample per component saved in the hottest loop in the engine. Five components over so narrow a band is more than the shape needs and is there for a different reason — a component's energy share carries the cos² directional weight, which vanishes at the edge of the spread, so a band with few components can deal one draw most of the sea; at three the steepest local component reached `a·k` 0.43 on some seeds, on the point of breaking, and at five the worst is 0.27.

   Both bands are laid the same way. The ocean band's eight frequencies, log-spaced over the band `bandLow..bandHigh` = 0.7–2.4 × the peak `ω_p = 2π/Tp` (JONSWAP's energy sits between ~0.7 and ~2 f_p; the tail past 2.5 f_p is too short to feel through a hull), each owning the band between the midpoints to its neighbours:

   ```
   bandHigh = max( 2.4,  Tp / minPeriod )                    minPeriod = 2.5 s
   lo = 0.7·(bandHigh/0.7)^(i/8),  hi = 0.7·(bandHigh/0.7)^((i+1)/8)
   ω_i = ω_p · √(lo·hi),   Δω_i = ω_p · (hi − lo)
   ```

   `bandHigh` is a multiple of the PEAK, and a big sea's peak is slow: at a twelve-second peak, 2.4 f_p is still a five-second, forty-metre wave, so a storm swell arrives with no wind chop on it at all — a mirror the size of a hill, which is the one thing a storm does not look like. So the band's short end is also held to an absolute shortest period and the wider of the two wins. A four-second wind sea is untouched (2.4 f_p is already shorter than 2.5 s); a swell gets the chop that rides on it. The floor is what the water mesh can still draw without aliasing — 2.5 s is a ten-metre wave, some six cells at the craft.

   Each draws a direction off the wind's direction of travel (`wind.from + π` — waves travel WITH the wind) from a cos² directional spread (Longuet-Higgins et al. 1963) truncated at `spread` = ±0.6 rad (~35°), by inverse transform on the seeded stream — `s = 0.6·(2u − 1)`, weighted `cos²((s/0.6)·π/2)` — so the components lean toward the wind. Its energy weight is the JONSWAP density at its frequency times its bandwidth times that directional weight:

   ```
   S(ω) ∝ ω⁻⁵ · exp(−1.25·(ω_p/ω)⁴) · γ^r,   γ = sea.peakEnhancement = 3.3,
   r = exp(−(ω − ω_p)² / (2σ²ω_p²)),  σ = 0.07 below the peak, 0.09 above
   ```

   (Hasselmann et al. 1973; the Phillips constant α is dropped because the amplitudes are normalised afterwards.) γ is how much of the sea's energy sits AT the peak rather than spread around it: 1 collapses JONSWAP to Pierson–Moskowitz, a broad fully developed sea with every wavelength in it; 7 is a narrow, ordered swell where wave follows wave at nearly one length. Higher reads as order, lower as confusion. The deep-water amplitudes are scaled so the components' energy sums to the reference sea's zeroth moment, `m0 = Σ a²/2 = (Hs/4)²`, i.e. `a_i = √(2·m0·w_i / Σw)`. Each component also draws a phase offset in `[0, 2π)`. The stream is `createRng((seed ^ 0x5ea5ea) >>> 0)` — the sea's own, so a level and its sea reproduce from the seed alone.

4. **Per component, a depth table and a phase field** (below).

`SeaState` carries `windSpeed`, `windFrom`, the `shelter` the level was measured into, `fetchRef`, `hsRef`, `tp` (the ocean band's), `localHs`, `localTp` (the local band's), the components — ocean band first, longest first, so `surfaceAt`'s `count` still picks the swell — and `oceanCount`, where the second band begins. `seaShares(sea, x, z)` returns the two shares at a point and `seaSummary(sea, x, z)` returns `{ Hs, Tp }`: the two bands summed in energy, and the period of whichever is carrying it there. The sim's `maxHs` column is this Hs at the craft's position.

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

## Exposure, the shelter, and the two seas (`engine/game/fetch.ts`)

The one measurement everything about the difference between the open sea and a river comes out of. For a level and a wind, `createShelter(level, wind)` bakes four fields:

| Field      | Grid               | What it is                                                       |
| ---------- | ------------------ | ---------------------------------------------------------------- |
| `exposure` | the level's, 4 m   | 0..1 — how much of the upwind fan reaches the open sea           |
| `reach`    | the level's, 4 m   | m — SPM effective fetch over the water INSIDE the level          |
| `chop`     | the level's, 4 m   | 0..1 — the local wind sea's height against the level's own quote |
| `shelter`  | `wind.cell`, 100 m | 0..1 — what the mean wind speed is multiplied by at a point      |

**The fan.** SPM (1984)'s effective fetch (Saville): the reach over water is read on `sea.fanRays` = 5 rays spread ±`sea.fanSpread` = 45° about the wind and averaged with cos weights, `Fe = Σ(Xᵢ·cos²θᵢ) / Σ(cos θᵢ)`, because a narrow body of water gives the wind a different run at every angle and one ray up the middle cannot say so. Each ray is not marched per point — it is a SWEEP over the whole grid in that ray's direction, each cell reading the two upwind neighbours mixed by the direction cosines (the same upwind scheme the phase field is integrated with, at the same O(cells) per direction). Land resets a run to nothing, so shelter falls away behind a headland and up a channel on its own, and the lateral half of the scheme is a cheap stand-in for the way a little wind — and a little wave — does get in round a corner. Water at the RIM of the level is the open sea, and what lies beyond it is the fiction above: the basin cuts its open water off at a straight line and pads every other side with land (R14, R15), so the only water at the grid's edge is the sea's.

Afterwards the two fields the SEA reads are grown two cells into the land, because everything reads them bilinearly and a sample taken in the last metres before a beach would otherwise mix the water's cell with the land's — a sea that fades out exactly where R12's wind is driving it hardest.

**The wind.** A point's mean wind is `meanSpeed · shelter(x, z)`, where

```
shelter = wind.shelter + (1 − wind.shelter) · max( exposure, 1 − exp(−reach / wind.shelterFetch) )
wind.shelter = 0.3,  wind.shelterFetch = 220 m
```

— the floor a wind that crossed only land keeps (the taiga's, not open country's: a boreal forest is the roughest surface a wind meets short of a town), recovering toward the full mean over a couple of hundred metres of open water as an internal boundary layer grows back off the new surface (Stull 1988 §14.5). It is averaged onto `wind.cell` = 100 m squares — land and water together, which is exactly the mixture a hundred metres of coast is — and read back bilinearly, so what a rider feels changes slowly across a level and never steps at a bank. Measured on seed 38: 11.4 m/s out at sea, 6.2 m/s at the river mouth, 3.4 m/s at its head.

**What that gives, on one seed** (38, wind 13.4 m/s from 300°, `make waves --seed 38`):

| Where               | exposure | local share | wind at 2 m | Hs     | Tp    | current  |
| ------------------- | -------- | ----------- | ----------- | ------ | ----- | -------- |
| 358 m out           | 1.00     | 0.00        | 11.4 m/s    | 2.63 m | 6.0 s | —        |
| 26 m off the beach  | 0.88     | 0.32        | 9.3 m/s     | 2.32 m | 6.0 s | —        |
| at the water's edge | 0.64     | 0.84        | 9.3 m/s     | 1.72 m | 6.0 s | —        |
| the river mouth     | 0.00     | 0.83        | 6.2 m/s     | 0.38 m | 1.9 s | 0.78 m/s |
| 800 m up the river  | 0.00     | 0.22        | 3.6 m/s     | 0.10 m | 1.9 s | 1.49 m/s |
| the river's head    | 0.00     | 0.09        | 3.4 m/s     | 0.04 m | 1.9 s | 1.88 m/s |

## The current (R27, `engine/mapgen/flow.ts`)

The river is going somewhere. It carries `river.discharge` (120–600 m³/s, drawn per level — a real Gulf of Bothnia band) out of its mouth, and the SPEED is what is left when that volume has to fit through the channel:

```
A = 4/3 · w · d                              (a parabolic section, half-width w over d metres of water)
Q(s) = Q_mouth · (A/A_mouth)^flow.gather      flow.gather = 0.8
v    = min( Q(s)/A,  flow.max )               flow.max = 3.5 m/s
```

So the water is SLOW across the wide, deep reach at the mouth and QUICKENS as the banks close in. `gather` is under 1 because a river is not a pipe: its catchment grows the whole way down, which is exactly why it widens, and rigid continuity would run the creek at the head at a thousand times the mouth's speed. Across the channel it is the open-channel parabola — `1.5·(1 − (r/w)²)`, fastest on the centreline, nothing at the bank, scaled so its mean across the width is `v`. Past the mouth it is a plume: the mouth's own heading carried `flow.plume` = 90 m into the basin, spreading and dying.

Two heightfields over the river's OWN box (it is nothing over nine tenths of a level), read by `flowAt(level.flow, x, z, out)` — four comparisons and no sample out at sea — and summed into `surfaceAt`'s reported velocity. So everything that asks the water how fast it is going feels the river without knowing there is one: the hull's drags are computed against the flow relative to the water, so a craft sitting still on a river is not sitting still.

## Breaking

The limit is on the **significant height** the sea carries at the point, not on any one wave: Nelson (1994) measures `Hs/d ≈ 0.55` for an irregular sea over a flat bed, and that is `TUNING.sea.breakingHs`. `surfaceAt` computes `Hs = 4√m0` over the shoaled spectrum at the point, both bands at their shares and scales every component by `breakingHs·d / Hs` when it passes. Individual crests still ride above it, as they do in nature; energy is not removed and the crest is not reshaped — it is a clip, applied at each point.

McCowan's (1894) `H/d = 0.78` for a single solitary wave stays in `TUNING.sea.breakingRatio`, quoted for the labs and the analyzer.

> **Why it is not McCowan's limit on the sum.** It used to be: the summed component amplitudes were capped at `0.78·d/2`. But the arithmetic sum of eight amplitudes is the once-in-forever superposition where every component crests together — about 1.8× the significant amplitude — so clipping to it held a sea in 25 m of water to a third of the height its own spectrum carried, and **made every quoted sea above about six metres come out the same ten**: `?hs=8` and `?hs=50` rendered identically. A twenty-metre sea was 8.5 m of actual wave spread over 500 m at a 9.8° face, which is why the storm photographed as a flat sheet.

## The surface (`surfaceAt`)

For every component at the point, with `a` the deep amplitude × `Ks(d)` × its BAND's share here (`seaShares`) × the breaking clip, `k` the local wavenumber and the phase `φ = phaseField(x, z) − ω·t + φ₀` (the plane wave `k₀·(d̂·x)` for the local band, which carries no field):

```
peak    = ½·min(k·a, crestMaxSteepness)·crestSharpness·a        (Stokes' second order)
height  = Σ [ a·sin φ − peak·cos 2φ ]
slope   = Σ [ a·cos φ + 2·peak·sin 2φ ]·k·d̂     (the phase gradient; the amplitude's own
                                                 gradient is a shoaling effect too slow to tilt the surface)
normal  = (−slope_x, 1, −slope_z) / |…|
v_h     = Σ a·ω·coth(k·d)·sin φ · d̂            (Airy: horizontal orbital velocity, in phase with the height)
v_y     = −Σ a·ω·cos φ                          (the surface's own rate of rise)
v_x,v_z += flowAt(level.flow, x, z)             (R27: the water itself, where a river is running)
```

A band whose share at the point is under a thousandth — under a millimetre of water — is skipped outright rather than multiplied by zero, and that is most of a level: out at sea the local band is absent and up a river the ocean band is, so all but the water round a river mouth pays for one band. Each component's depth table is read ONCE and held between the two passes, which is why thirteen components cost slightly less per call than the eight did before them.

The orbital velocity is what makes a wave face lift the bow and a crest carry the hull: the hull's drags are computed against the flow RELATIVE to the water (`hull.ts` subtracts the sample's `vx, vy, vz` from each probe's velocity), so a hull sitting on a crest is pushed along with it and one climbing a face meets water coming at it. A mesh of forty thousand vertices calls this once a vertex a frame; the `out` parameter is how it allocates nothing.

## What the renderer reads

`pwa/src/game/water-mesh.ts` displaces a grid following the craft by calling `surfaceAt` per vertex on the CPU (the height; the normal for shading). The grid is a fine core round the craft inside nested square rings, each ring's cell twice the one inside it (`water-grid.ts`), and its origin snaps to the COARSEST cell — so every vertex, in every ring, samples the same world point frame after frame and the drawn sea stands still under a moving craft rather than sliding along with it. Under it a coarse FAR grid, out to the fog, calls the same function with `surfaceAt`'s `count` — the first that many components, which are the longest, since the field is laid from the low end of the band up — so a storm's swell stands out to the horizon while the chop that would alias on a thirty-metre cell is left off; the near grid's edge fades to the far grid's surface rather than to flat. The wake (`wake.ts`) and the foam patches (`spray.ts`) put their vertices on the same call. There is no second wave function — not in a shader, not in the renderer — which is the whole point: a wave the physics did not compute cannot be drawn, and one the renderer cannot draw cannot be felt.

What the LIGHT does at that surface is `water-shader.ts`'s, per pixel, and none of it moves a vertex: Schlick's Fresnel on the real viewing angle (two per cent straight down, everything at a grazing angle) between the water's body colour and the sky's own gradient in the direction each wave face reflects; the sun's glint as a tight lobe over a ripple tile made in code and scrolled downwind — the sparkle — and a broad lobe over the swell — the road a low sun lays toward the rider — both scaled by how much of the sun arrives as a beam (`Preset.beam`), so a squall's ceiling glints nothing; the light through a crest with the sun behind it; and the vertex's foam share broken up by the foam tile. The ripples are the one thing drawn that the physics does not carry, and they are a NORMAL, not a height: a probe reading the same water agrees with the picture to the millimetre.

## The wind the sea is built from (`engine/game/wind.ts`)

The sea is built from the level's MEAN wind (the spectrum needs a wind that has blown for hours, not this second's gust). The gusts are what the hull and the rider feel through the aero drag and what a hull in the air feels as a side force and a pitch moment. Three things shape what a rider actually meets:

- **The shelter** is the field above — a level is a coast, which is the one place a wind changes over a few hundred metres — so the speed is read at the craft's POSITION as well as its height.
- **The profile** is the log law (Prandtl; Stull 1988 §9): `U(z) = U_ref · ln(z/z₀) / ln(z_ref/z₀)` with the sea's roughness length `z₀` = `roughness` = 2·10⁻⁴ m (Charnock 1955 at moderate winds), `referenceHeight` = 10 m, and the height floored at `minHeight` = 0.3 m so a probe in a trough never reads a wind blowing backwards. A rider six metres up off a ramp feels more wind than the hull did.
- **The gust factor** is an Ornstein–Uhlenbeck process about 1 — `dx = −(x − 1)/τ·dt + σ·√(2dt/τ)·N` — with `intensity` σ = 0.11 (the turbulence intensity σ_u/U over water at 10 m, IEC 61400-3 offshore class), `gustTime` τ = 12 s (the gust integral time scale), clamped to `gustMin..gustMax` = 0.55–1.6 × the mean. A second, slower process wanders the direction: `veer` σ = 0.12 rad, `veerTime` = 25 s, clamped to ±3σ.
- Each Gaussian is one Box–Muller draw (two uniforms off `state.rng`, the second of the pair deliberately NOT kept — a state that carries a spare draw replays differently from where it was saved), so `stepWind` draws four uniforms a step, every step, whether or not anything feels the wind. That is what keeps a calm level and a gale consuming the same stream and a replay on the same numbers.

`windAt(wind, y, x, z)` is the wind VELOCITY there — it blows TOWARD the opposite of `from`. `tests/wind_test.ts` holds the profile, the reference height, the shelter's floor and the drop over the land, the bounds and the seeding.

## The numbers, in one place

| Knob                                 | Value       | Unit   | What it buys                                                     |
| ------------------------------------ | ----------- | ------ | ---------------------------------------------------------------- |
| `sea.components`                     | 8           | —      | OCEAN band components                                            |
| `sea.localComponents`                | 5           | —      | LOCAL band components — the chop on enclosed water               |
| `sea.localFetch` / `localFetchScale` | 2000 / 40   | m, —   | where the local band is quoted, and the stretch on a point's own |
| `sea.localBandLow` / `localBandHigh` | 0.8 / 1.8   | × ω_p  | the narrower band the chop is laid over                          |
| `sea.fanSpread` / `fanRays`          | 45 / 5      | °, —   | the upwind fan the effective fetch is read on                    |
| `sea.bandLow` / `bandHigh`           | 0.7 / 2.4   | × ω_p  | the band the components are laid over                            |
| `sea.minPeriod`                      | 2.5         | s      | absolute short end of the band — the chop on a slow swell        |
| `sea.spread`                         | 0.6         | rad    | cos² directional spread half-width (~35°)                        |
| `sea.peakEnhancement`                | 3.3         | —      | JONSWAP's γ — energy at the peak vs spread around it             |
| `sea.heightScale`                    | 1.5         | ×      | HOW BIG: multiple on what the fetch law grows                    |
| `sea.periodScale`                    | 1.0         | ×      | HOW LONG: multiple on the wind sea's peak period (λ ∝ this²)     |
| `sea.baseFetch` / `fetchScale`       | 30000 / 100 | m, —   | the ocean band's stretched fetch: `30000 + 100·reach`            |
| `sea.minDepth`                       | 0.15        | m      | floor on the depth the model reads                               |
| `sea.breakingRatio`                  | 0.78        | —      | McCowan's H/d for one wave — quoted, not applied                 |
| `sea.breakingHs`                     | 0.55        | —      | Nelson's depth-limited Hs/d — what the field is clipped to       |
| `sea.crestSharpness`                 | 1.6         | ×      | HOW SHARP: multiple on Stokes' second-order crest term           |
| `sea.crestMaxSteepness`              | 0.32        | a·k    | the steepness that correction is evaluated at, at most           |
| `sea.tableStep` / `tableDepth`       | 0.1 / 250   | m      | the per-component depth table                                    |
| `sea.steepness`                      | 0.09        | —      | Hs/L₀ of a QUOTED sea — its period, and so its wavelength        |
| `water.viscosity`                    | 1.14·10⁻⁶   | m²/s   | kinematic viscosity for the ITTC-57 line (fresh water at ~15 °C) |
| `wind.roughness`                     | 2·10⁻⁴      | m      | the log law's z₀                                                 |
| `wind.referenceHeight` / `minHeight` | 10 / 0.3    | m      | where the mean is quoted; the profile's floor                    |
| `wind.intensity` / `gustTime`        | 0.11 / 12   | —, s   | the gust process                                                 |
| `wind.veer` / `veerTime`             | 0.12 / 25   | rad, s | the direction's wander                                           |
| `wind.gustMin` / `gustMax`           | 0.55 / 1.6  | × mean | the gust factor's bounds                                         |
| `wind.shelter` / `shelterFetch`      | 0.3 / 220   | ×, m   | what a wind off the land keeps, and the run it recovers over     |
| `wind.cell`                          | 100         | m      | the square the shelter is averaged onto                          |
| `flow.gather`                        | 0.8         | —      | how the river's discharge falls going up (R27)                   |
| `flow.max` / `flow.plume`            | 3.5 / 90    | m/s, m | the current's ceiling, and how far its plume carries out         |

The level contributes `wind.speed` (6–14 m/s, R12) and `wind.from` (always off the sea — R12, which is what puts the ocean upwind of the whole coast), its `offshore`, `ground` and `flow` fields, `river.discharge` (120–600 m³/s, R27), and `water.density` (1005 kg/m³ on the taiga coast — brackish; R13), which is the density every hydrostatic and hydrodynamic force uses.

## What holds it

`tests/waves_test.ts`: the dispersion relation in both limits and everywhere between; the shoaling coefficient's growth; the fetch law and its PM cap; R28's two bands (the ocean's sea reaching the shore undiminished, the river getting the wind's chop and none of the ocean's); R27's current running down the channel and quickening as the banks close; the depth-limited clip in the shallows; bounded heights everywhere; purity (the same point at the same time is the same surface). `tests/wind_test.ts`: the profile, the shelter and the gusts. `tests/determinism_test.ts`: a run replays. **`make waves SEED=`** (`scripts/waves-lab.mjs`) is the lab: a transect from the shore out to sea at several moments, Hs against offshore distance, the spectrum, a walk UP THE RIVER (the other kind of water a level holds), and a table of the two bands' shares, the local wind, Hs, Tp, wavelength, steepness H/λ, celerity, the depth ratio d/λ with the regime it puts the wave in (deep / intermediate / shallow), and the depth a wave breaks at — required before and after any change to `water.ts`, because a wave model is judged by the sea it makes and a screenshot shows one wave.

## What is NOT modelled

A list a future session can pick from, each a known simplification rather than an oversight:

- **Refraction.** Components keep their heading; the phase field shortens the wavelength with the depth but never turns the crests parallel to the shore. (Would need a ray trace or a per-component direction field.)
- **Horizontal Gerstner displacement.** The trochoidal sharpening of the crests is dropped so the height is a function of the undisplaced `(x, z)`; crests are sinusoidal, not peaked.
- **Wave–current interaction.** The river's current (R27) is ADDED to the orbital velocity; it does not refract, shorten or steepen the waves running against it, which is what a real ebb tide does to a swell.
- **Whitecapping and dissipation.** The only energy loss is the McCowan clip at a point; nothing breaks progressively, and a breaking wave sheds no foam, spray or turbulence into the physics.
- **A varying peak period.** The two bands each carry ONE period for the whole level; a point takes a share of each, so a river gets the short band and the open sea the long one, but neither band's own period changes across the water. A quoted sea (`SeaOverride`) replaces the ocean band rather than standing beside it as a third peak.
- **Directional spread beyond ±35°.** Truncated cos² — the sea is always more or less aligned with the wind, which under R12 always blows in against the shore.
- **Wave–wave (nonlinear) interaction**, wave set-up, set-down and run-up at the shore.
- **Reflection and diffraction** off skerries and headlands, beyond what the exposure sweep's lateral mixing gives for free: the lee of a single skerry is not calmer, though the lee of a headland is.
- **The amplitude's own gradient in the slope** (shoaling is too slow to tilt the surface, and it is left out of the normal).
- **Gusts in the sea.** The spectrum reads the mean wind only; a gust changes the aero, never the water.
- **Temperature.** One viscosity for the friction line; the water's temperature is carried on the level for the fauna and the spray to read later.
- **Rain, ice, tides.** The weather module (`engine/mapgen/weather.ts`) is a placeholder.

## Sources

Tessendorf, _Simulating Ocean Water_ (2001) · Finch, "Effective Water Simulation from Physical Models", _GPU Gems_ 1 ch. 1 (2004) · Hasselmann et al., JONSWAP (1973) · Pierson & Moskowitz (1964) · _Shore Protection Manual_ (SPM, 1984) fetch-limited growth · Longuet-Higgins, Cartwright & Smith, directional spectra (1963) · Fenton & McKee, "On calculating the lengths of water waves" (1990) · Dean & Dalrymple, _Water Wave Mechanics for Engineers and Scientists_ (1991) · McCowan (1894) · Charnock (1955) · Stull, _An Introduction to Boundary Layer Meteorology_ (1988) · IEC 61400-3.
