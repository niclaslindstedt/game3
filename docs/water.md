# The water

The sea is the game, and it is built in one file: `engine/game/water.ts`, numbers in `TUNING.sea` and `TUNING.water` (the sea's and the wind's own block sits beside the rest in `engine/game/defs/sea.ts`, folded into `TUNING` by `defs/tuning.ts` under the same names). A `SeaState` is built ONCE per run from the level's wind and the seed; after that the surface is a pure function of `(x, z, t)`. Nothing advances, nothing is stored between calls, and `t` is the only clock — which is why the craft's hull probes can read it at 120 Hz and the renderer can read the SAME function to displace its mesh, and what is drawn is what is simulated.

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

   The wind sea's height and period then take `TUNING.sea.heightScale` = 1.5 and `periodScale` = 0.95 — the two arcade dials that say how big and how long a wind sea is _here_ against what the law alone grows. The fetch growth is a ratio, so neither disturbs its shape. Steepness goes as `heightScale / periodScale²`, so the two together are the whole of how a wind sea reads; pushing them to 1.8 / 0.85 (2.5× the natural steepness) made a sea the bot spent a third of every run airborne in, and `make sim` fell from 16/16 finished to 12/16.

   The first term of each is the SPM (1984) fetch-limited law — `g·Hs/U² = 1.6·10⁻³·(g·F/U²)^½` and `g·Tp/U = 0.286·(g·F/U²)^⅓` — and the cap is the fully developed Pierson–Moskowitz (1964) sea, `Hs = 0.21·U²/g` and `ω_p = 0.877·g/U`. `g` is `TUNING.g` = 9.81 m/s². A wind of 0 makes a flat sea (`Hs = 0`, `Tp = 1`).

   **A sea can also be quoted outright** — `createSea(level, seed, wind, { hs, tp? })`, a `SeaOverride`; `createGame({ sea: { hs } })` and the app's `?hs=` hand it in. The significant height at the course is then the number given, in place of the wind's, and the period, when not given, is the one a grown wind sea of that height carries: the significant steepness `Hs/L₀` is `TUNING.sea.steepness` = 0.09 and `L₀ = g·Tp²/2π` turns that round —

   ```
   periodForHeight(Hs):  Tp = max( 0.6, √( 2π·Hs / (g · steepness) ) )     [s]
   ```

   **The steepness is the dial that decides whether a big sea reads as a wave at all**, because what the eye reads is the FACE and the face's angle is the steepness, not the height. A mature ocean sea runs 0.03–0.05 (Toba 1972), which is why a real twenty-metre sea is a five-hundred-metre swell with a ten-degree face — at sea you feel it and from a boat you cannot see it. 0.09 buys the young, wind-driven storm sea instead: a twenty-metre sea is a twelve-second, 222 m wave you have to climb. It stays clear of Michell's 1/7 = 0.142 breaking limit deliberately: a sea sitting ON the limit is one the renderer paints entirely in foam, and a twenty-metre swell comes out looking like a snowfield. The fetch still shapes an overridden sea: the height quoted is the course's and it grows to seaward by the wind's own law (uniform when there is no wind). **There is no arcade ceiling**: the field is bounded by the fully developed law and by the depth under it (below) and by nothing else, and every term — the depth table, the phase field, the orbital velocity — is sized so a twenty-metre sea over deep water stands (`tests/waves_test.ts`'s storm case rides one for ten seconds), and past the level's rim the same terms carry the storm out there (below). **A wave only stands its full height in water it cannot feel the bottom of**, so where the sea is quoted matters as much as what it is quoted at: over the 25 m at the foot of R3's coastal shelf the clip holds a twenty-metre sea to some fourteen, and it is only itself out past 400 m where the bed has fallen to the open sea's 60 m. The `storm` scenario stands the craft there.

3. **The components — THREE BANDS (R28).** There are three kinds of water a rider can reach and they do not carry the same waves, so the field is laid in three bands and every point takes a share of each.

   **The ocean band** (`sea.components` = 8) is the sea the wind grew over the whole coast's fetch — the long, ordered thing a race is ridden in. Its share at a point is that point's **exposure**: 1 out at sea and 1 a few metres off an open beach (R12's wind blows in off the water, so the ocean is upwind of the whole coast — _the waves come in against the shore_), 0 a hundred metres up a river the land has closed round.

   **The local band** (`sea.localComponents` = 5) is the chop the local wind grows on the water it actually crossed: short, small, and quoted ONCE per level at the mean wind over `sea.localFetch` = 2 km of arcade fetch, with `localFetchScale` = 10 stretching a point's own reach (a tenth of `fetchScale`, and it has to stay the smaller of the two — the fiction about a longer coast is what buys the ocean band its sixty kilometres, and it says nothing about water with a bank on both sides). `localFetch` sets the band's PERIOD alone: `chop` is a ratio against that same quote, so it cancels out of the height and `localFetchScale` is the one dial deciding how big a point's own chop is. Its share is `(1 − exposure) · chop`, where `chop` is the local wind sea's height at that point against the level's quote — so it fills in exactly where the ocean band does not and the two never double-count. A river ends up with a 5 m, 1.8 s ripple a few centimetres high — a couple of tenths at a wide mouth, falling to a centimetre or two at the head; a wide channel behind a headland gets something between. The stretch was 40 until it was measured against the ride: at that value a sheltered reach hit the hull with the same 13°/s pitch rate as the open sea on a fifth of its wave height, which is a rumble strip rather than a sea. The local band carries no phase field: a five-metre wave feels the bottom only in water a hull is already aground in, so it is a plane wave, which is a grid sample per component saved in the hottest loop in the engine. Five components over so narrow a band is more than the shape needs, and the reason it once had is gone: a component's energy share used to carry the cos² directional weight, which vanishes at the edge of the spread, so a band with few components could deal one draw most of the sea (at three the steepest local component reached `a·k` 0.43, on the point of breaking). The heading is DRAWN through that cos² now rather than weighted against it, and the corpus's steepest local component is `a·k` 0.15 against the 0.32 the weighted draw left. What five still buys is the chop's own texture at close range, where this band is most of what is under the hull.

   **The open bands** (`sea.components` again, one per rung of `sea.open.rungs`) are the storm past the edge of the built level — [the open ocean](#the-open-ocean-past-the-rim-enginegameoceants) below, which owns the whole of it. Every one of their shares is 0 inside a level's bounds, so the coast's own water is untouched by them and the whole storm costs one comparison a sample: `surfaceAt` walks the field BAND BY BAND and skips a band whose share is nothing in a single test rather than once per component.

   All three bands are laid the same way. The ocean band's eight frequencies, log-spaced over the band `bandLow..bandHigh` = 0.7–2.4 × the peak `ω_p = 2π/Tp` (JONSWAP's energy sits between ~0.7 and ~2 f_p; the tail past 2.5 f_p is too short to feel through a hull), each owning the band between the midpoints to its neighbours:

   ```
   bandHigh = max( 2.4,  Tp / minPeriod )                    minPeriod = 2.5 s
   lo = 0.7·(bandHigh/0.7)^(i/8),  hi = 0.7·(bandHigh/0.7)^((i+1)/8)
   ω_i = ω_p · √(lo·hi),   Δω_i = ω_p · (hi − lo)
   ```

   `bandHigh` is a multiple of the PEAK, and a big sea's peak is slow: at a twelve-second peak, 2.4 f_p is still a five-second, forty-metre wave, so a storm swell arrives with no wind chop on it at all — a mirror the size of a hill, which is the one thing a storm does not look like. So the band's short end is also held to an absolute shortest period and the wider of the two wins. A four-second wind sea is untouched (2.4 f_p is already shorter than 2.5 s); a swell gets the chop that rides on it. The floor is what the water mesh can still draw without aliasing — 2.5 s is a ten-metre wave, some six cells at the craft.

   **The band is cut into one slice of equal ENERGY per component** (`energySlices`), not one slice of equal frequency. That is the whole reason a sea of eight components does not repeat, and it is free: cut evenly in frequency and the peak — where a JONSWAP sea keeps most of its energy — is carried by one component, which is one sine, with its nearest neighbour a whole octave away, so the two beat against each other inside the water a rider can see. Cut by energy and three or four slices crowd within a tenth of the peak: they carry ONE wave train between them and the beat of frequencies that close is hundreds of metres long. The tail gets the two or three wide slices it deserves, which is the texture riding on top.

   `sea.sliceMix` = 0.7 is the exponent the density is raised to before the cut is made even, so 0 is the plain octave ladder and 1 is exactly equal energy. It is short of 1 because a slice is finally represented by ONE sine at its energy centroid (the centroid, not the slice's middle, because a wide tail slice holds its energy at the low end): out in the tail, where an octave of band holds a whole eighth of the sea, cutting at 1 stands that eighth up as a single wave and the worst component over the corpus reaches `a·k` 0.41 against Michell's 0.44. The OPEN band is cut at 0 regardless — its 4.8-peak span is the widest the field lays, and a rung's waves are 130–250 m long, so its beat is kilometres either way.

   Both of a component's draws are then STRATIFIED — the frequency about its slice's centroid, the heading inside its own slice of the SPREAD rather than anywhere in the fan. A sum of a handful of sines is only as unrepeating as its components are unalike, and a fixed ladder of frequencies all running one way beats against itself into a pattern that repeats down the wind.

   The direction comes off the wind's direction of travel (`wind.from + π` — waves travel WITH the wind) through the cos² directional spread (Longuet-Higgins et al. 1963) truncated at its half-width, **by inverse transform** (`spreadQuantile`, bisected at build time) rather than drawn flat and weighted. That distinction is the whole of whether a band lumps: while the cos² multiplied the component's ENERGY, a component that landed at the edge of the fan was handed nearly none of it and its neighbours took the whole sea, so a band of eight could arrive as two or three waves — measured over the seed corpus, one component carried two thirds of its band, and the steepest reached `a·k` 0.63, past Michell's 0.44 breaking limit. Drawn through the spread instead, the corpus's worst share is 0.25 and its worst component `a·k` 0.15, and the sea realises the directional spread it is quoted at (an energy-weighted 17° against the 10° the weighted draw left of a ±34° fan).

   **The half-width opens above the peak**, which is why open water reads as texture riding on order rather than as one corduroy. Mitsuyasu et al. (1975) and Hasselmann et al. (1980) measure the spreading parameter `s` peaking at `f_p` and falling as `(f/f_p)⁻²·⁵` above it; with `D(θ) ∝ cos^2s(θ/2)` the width goes as `s^−1/2`, so the half-width is `spread` = 0.45 rad (~26°) times `(ω/ω_p)` to `spreadTilt` = 1.25, held under `spreadMax` = 0.75 rad (~43°). The cap is not cosmetic: the law has no ceiling in it — at 4.8 f_p it asks for 1.7 rad, a component running back into the wind — and a component crossing the wind more steeply than this enters the level's grid by one rim only, which the eikonal sweep holds a few per cent less well.

   At and **below** the peak the fan is `spread` flat, which is a deliberate simplification of the same measurements: they have `s` falling below the peak too (as `(f/f_p)⁵`), but this band's floor is 0.7 f_p — still the peak region — and fanning the longest, most energetic components is exactly what stops a wave FRONT forming. Taken literally it asked for 2.4× the peak's width at the band's floor and the sea lost a third of its crest length to it: the along-crest correlation length over ten seeds fell from 20 m to 13 m, which reads as a surface with no wave in it.

   `spread` is a NOMINAL half-width and the sea realises less than it, so the number to tune against is the realised one — the energy-weighted circular spread of the band, 11° for this 26° nominal. It was 34° nominal for as long as the heading was drawn flat and the cos² weighted the energy, which realised the same 11° because the weighting threw most of the fan away; drawing through the spread made the nominal nearly honest, and 34° then realised 16°.

   A component's energy weight is then the JONSWAP density at its frequency times its bandwidth, and nothing else:

   ```
   S(ω) ∝ ω⁻⁵ · exp(−1.25·(ω_p/ω)⁴) · γ^r,   γ = sea.peakEnhancement = 3.3,
   r = exp(−(ω − ω_p)² / (2σ²ω_p²)),  σ = 0.07 below the peak, 0.09 above
   ```

   (Hasselmann et al. 1973; the Phillips constant α is dropped because the amplitudes are normalised afterwards.) γ is how much of the sea's energy sits AT the peak rather than spread around it: 1 collapses JONSWAP to Pierson–Moskowitz, a broad fully developed sea with every wavelength in it; 7 is a narrow, ordered swell where wave follows wave at nearly one length. Higher reads as order, lower as confusion. The deep-water amplitudes are scaled so the components' energy sums to the reference sea's zeroth moment, `m0 = Σ a²/2 = (Hs/4)²`, i.e. `a_i = √(2·m0·w_i / Σw)`. Each component also draws a phase offset in `[0, 2π)`. The stream is `createRng((seed ^ 0x5ea5ea) >>> 0)` — the sea's own, so a level and its sea reproduce from the seed alone.

4. **Per component, a depth table and a phase field** (below).

`SeaState` carries `windSpeed`, `windFrom`, the level's `bounds` (where its grid, and so its coast, stops), the `shelter` the level was measured into, `fetchRef`, `hsRef`, `tp` (the ocean band's), `localHs`, `localTp` (the local band's), `openHs`, `openTp` (the storm this level was DEALT, and the period that height earns), the `bands`, and the components.

`bands` is every band of the field — the ocean's, the local one, and one per rung of the storm — each with the height and period it was laid at and `at`, the positions of its components. It is what `surfaceAt` walks, in both of its passes, so a band standing at nothing costs one comparison instead of one per component: over a course that is the whole storm, and it is why carrying three rungs of it is cheaper than the single open band was.

The components are sorted LONGEST FIRST across every band — the storm's swell reaches kilometres and the local band's chop stops at two metres, so only a sort puts "the first few components" and "the swell" back together for `surfaceAt`'s `count` — and each carries a `band` naming its kind and a `bandIndex` into `bands`. A band's `at` is therefore its own ascending run through that sorted array, which is how `count` still means "the longest n of the field" when the sum is walked band by band.

`seaShares(sea, x, z)` returns the three KINDS of share at a point (the storm's rungs summed in energy, as a fraction of the height it was dealt) and `seaBandShares` returns every band's separately; `seaSummary(sea, x, z)` returns `{ Hs, Tp }`: every band summed in energy, and the period of whichever is carrying the most of it there. `stormSeaAt` is the same reading for the STORM alone, which is what the renderer judges a crest against out there. The sim's `maxHs` column is `seaSummary`'s Hs at the craft's position.

## Dispersion (`wavenumber(ω, d)`)

Each component keeps ONE frequency and direction and lets its wavenumber follow the depth through the dispersion relation `ω² = g·k·tanh(k·d)` (Airy). Rather than iterate the root, the engine uses Fenton & McKee (1990)'s explicit fit, within 1.7 % of the exact root everywhere and exact in both limits:

```
k₀ = ω²/g                                (deep water)
k  = k₀ / tanh((k₀·d)^0.75)^(2/3)
```

The depth is floored at `minDepth` = 0.15 m so the relation and the shoaling coefficient stay finite where the bed comes up to the surface — by then the breaking cap has already clipped every wave to nothing worth drawing. `tests/waves_test.ts` holds the fit to both limits and to `ω² = g·k·tanh(k·d)` within 3 % over ω = 0.7–2.5 rad/s and d = 0.4–30 m.

Each component precomputes a table over depth — the local `k`, the shoaling coefficient `Ks`, and `coth(k·d)` for the orbital velocity — and `surfaceAt` reads it linearly between rows.

**The axis is √d, not d**: row `i` sits at `(i·tableRoot)²` metres, `tableRoot` = 0.1 m^½, so the SPACING it gives is `2·tableRoot·√d` — eight centimetres where the bed breaks the surface, a metre at 25 m, three out where the open ocean's floor is. That is the shape of the question: every coefficient in the table moves with `k·d` and is flat once `k·d` is past π, so the resolution is wanted in the shallows and wasted in deep water. Measured against the exact functions over the water a course is ridden in, the worst interpolation error is 0.23 % (the old uniform tenth-of-a-metre axis gave 0.085 % there and 6.7 % at the `minDepth` floor, where this one gives 2.8 %).

The reach has to cover the DEEPEST water the model ever samples, because the read CLAMPS to the last row: past it a long storm swell would be read at a depth it is not in, shoaled and given several times the orbital velocity it has. That depth is the open ocean's floor (`sea.open.depth` = 150 m), and `tableDepth` = 250 m stands well past it — 159 rows on this axis against 2 501 for the uniform one it replaced. The generator's own bed stops at −25 m.

## The phase field

The spatial phase of a component is not `k₀·(d̂·x)` — that is the deep-water plane wave — but the solution of the **eikonal equation** `|∇φ| = k(d)` over the level's grid, solved ONCE at build time (`buildPhaseField`) by fast sweeping (Zhao 2005): every cell takes Godunov's upwind update from its two nearest neighbours, in each of the four sweep orders, `PHASE_ROUNDS` = 2 times (two rounds settle every exposed cell of a generated level to a thousandth of a radian of what eight give). The plane wave flows in over the rims the component travels in across and nothing over the rims it leaves by; land is impassable and takes no part; what the sweep never reaches — the land, and any water no path from the sea gets to — carries the finished water beside it on at the plane wave's rate for two cells, so a bilinear sample in the last metres before a beach reads a wave and not a cliff.

What comes out is the FIRST-ARRIVAL phase, which is what a wave field does with a bed and a coast: where the depth is uniform it is the plane wave exactly; where the bed rises the wavelength shortens; where the bed rises obliquely the crests **turn toward the shallows** (refraction — Snell's law falls out of the eikonal); and at a headland or a river mouth the front **wraps round the corner** as arcs about it, which is diffraction's kinematics (how MUCH gets round is the exposure's question, below). The field's gradient is the component's LOCAL WAVE VECTOR, and `surfaceAt` reads it with the phase in one bilinear sample (`sampleFieldGradient`): the slope and the horizontal orbital velocity follow it, so a crest that has turned is lit and felt as the crest it is. Where two arrivals meet in a lee the field creases, as two crossing trains do — the phase gradient is short across the crease and the wave there reads long; it is a line a cell or two wide, at an exposure of a few tenths, and it is the price of one field per component rather than a directional spectrum.

**Why an eikonal and not `∫k·ds` along the heading.** Integrating the wavenumber along a fixed direction carries every shoal's and every bank's delay forever downwind of it, as a phase OFFSET between neighbouring paths that nothing ever relaxes; the lateral gradient of that offset is a wavenumber the wave never had. Measured over ten seeds, a fifth of all exposed water carried an ocean band three to seven times too short and heading sideways — a swell that stood still or crawled — in the lee of every reef and either side of every river mouth, which is exactly where a course's first gates stand.

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

**The fan.** SPM (1984)'s effective fetch (Saville): the reach over water is read on `sea.fanRays` = 5 rays spread ±`sea.fanSpread` = 45° about the wind and averaged with cos weights, `Fe = Σ(Xᵢ·cos²θᵢ) / Σ(cos θᵢ)`, because a narrow body of water gives the wind a different run at every angle and one ray up the middle cannot say so. Each ray is not marched per point — it is a SWEEP over the whole grid in that ray's direction, each cell reading the two upwind neighbours mixed by the direction cosines (the standard first-order upwind scheme, O(cells) per direction). Land resets a run to nothing, so shelter falls away behind a headland and up a channel on its own, and the lateral half of the scheme is a cheap stand-in for the way a little wind — and a little wave — does get in round a corner. Water at the RIM of the level is the open sea, and what lies beyond it is the fiction above: the basin cuts its open water off at a straight line and pads every other side with land (R14, R15), so the only water at the grid's edge is the sea's.

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
| 26 m off the beach  | 0.88     | 0.16        | 9.3 m/s     | 2.32 m | 6.0 s | —        |
| at the water's edge | 0.64     | 0.42        | 9.3 m/s     | 1.69 m | 6.0 s | —        |
| the river mouth     | 0.00     | 0.42        | 6.2 m/s     | 0.19 m | 1.9 s | 0.78 m/s |
| 800 m up the river  | 0.00     | 0.11        | 3.6 m/s     | 0.05 m | 1.9 s | 1.49 m/s |
| the river's head    | 0.00     | 0.04        | 3.4 m/s     | 0.02 m | 1.9 s | 1.88 m/s |

## The open ocean past the rim (`engine/game/ocean.ts`)

A level is a stretch of coast baked onto a grid a couple of kilometres across (R14), and everything inside it is read off that grid. **The water does not stop where the grid does.** A rider who turns his back on the course and holds the throttle open rides OUT, and out there the coast stops sheltering him: the wind freshens, the bed falls away, and the sea builds the whole way. None of that can be baked — a grid reaching far enough out would be a level's whole build time spent on water nobody rides — so past the rim the ocean is ANALYTIC, and `ocean.ts` is the whole of it.

It is one question with several readings, and everything downstream reads them rather than restating them:

| Reading                                         | What it is                                                                                                                                      |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `oceanOffset(bounds, x, z, out)`                | how far out of the box a point is along each axis, m, signed and pointing away from the level — and the distance past the bounds, 0 inside them |
| `jumpableHs(speed)` / `STORM_CEILING`           | THE BIGGEST SEA WORTH BUILDING: the one a craft doing `speed` can still fly over the rim of and down to the floor of                            |
| `stormRamp(out)` / `stormAt(bounds, x, z)`      | THE one ramp: how much of that storm stands `out` metres past the rim, eased from 0 at the rim to 1 at `sea.open.reach`                         |
| `oceanDepth(bed, storm)` / `bedAt(level, x, z)` | the bottom out there: the rim's own ground falling away to `sea.open.depth`                                                                     |
| `oceanWind(mean, shelter, storm)`               | the mean wind a point feels: the level's own under its shelter, both giving way to the storm as the coast falls astern                          |

### How big it gets is not a number anywhere

**It is the biggest sea the roster's fastest craft can still JUMP.** A sea quoted by its height is a wave of `L₀ = Hs / steepness`, so the run from its crest to its trough — the wave's WIDTH — is `Hs/(2·steepness)` and grows with its height. A flight's reach does not: it is the craft's own. The two therefore cross exactly once, and past that height the ocean stops being something a rider jumps and becomes a hillside he crawls over, which is no reason to build it.

Launching off the wave's own steepest face — `atan(π·steepness)`, a constant the dial sets, 15.8° at 0.09 — at `v` and dropping `Hs`, the ballistic flight spans the width when

```
Hs = v²·(8·s²·cos²θ + 4·s·sinθ·cosθ) / g,   θ = atan(π·s)
   = 0.0157·v²                              at s = 0.09
```

**Quadratic in the speed**, so the ocean grows with the square of whatever the SPEED CLASS buys. At the shipped class the roster's fastest is 108 km/h and the ceiling is **14.2 m**; the class table is in [riding.md](riding.md).

It is the ceiling of what is POSSIBLE, off a perfect launch. Measured in the engine — the craft staged at every phase of one wavelength and ridden into the sea at its top speed — a hull spans about **0.45** of it on a typical attempt: it leaves the water near the crest where the face has already flattened, loses way climbing, and carries aero drag through the flight. That gap is the difficulty, and it is deliberate — a sea nobody could fail to clear is not a sea worth riding out to.

### …and the storm a coast is dealt is not the ceiling

Each level draws its own, once, uniformly over the top `sea.open.vary` = 0.75 of the ceiling — **10.6 m to 14.2 m** at the shipped class. A uniform draw is what makes the biggest rare in the plainest way there is: a seed has one chance in ten of landing in the top tenth of the band. Measured over 200 seeds: min 10.6, median 12.5, max 14.1, and **22 of 200** in the top tenth.

### A band per rung, not one band scaled

A sea quoted by its height takes its period, and so its wavelength, from `steepness` — so a single band laid at the storm's full height and scaled down to the sea a rider meets halfway out would deal him the storm's wavelength at a quarter of its face: an ocean tilting, not a wave. The open band is therefore laid as several, at `sea.open.rungs` = 0.25, 0.5 and 1 of the dealt storm, and neighbouring rungs hand over on the HEIGHT. No sea is ever drawn from a band more than twice its own height, so the wavelength tracks it to within that.

Each rung is laid over `sea.open.bandHigh` = 4.8 of its own peak rather than over `minPeriod` in absolute seconds. That floor would give a slow storm swell a band many times a coastal sea's frequency range on the same components, and a band that wide lumps: measured over the corpus at a thousand-metre quote one component reached `a·k` **0.89** carrying 90 % of the band's energy — several times past breaking, which the renderer paints entirely in foam — and more components barely helped (0.49 at twenty-four), because the width was the fault and not the resolution. The lumping has since been fixed at its source (the heading is drawn THROUGH the cos² spread rather than weighted against it, so no component is robbed of its spectral share by where it happens to point), and the corpus's worst open component is now `a·k` 0.15. The cap stays: a band that wide would still hand one component a whole octave of a spectrum.

That fix is most visible out here, because a lumped band was a bigger lie about a storm than about a breeze: measured in the tornado zone, the open sea's **rms face fell from 100 % to 33 %** — a mean slope of 45° is a saw and not a sea — and with it the median throw the column gives a rider doubled from 5 s to 9 s while the apex did not move at all. The column is a HEIGHT (`TUNING.wind.tornado.column`) and the height is what held; how long a throw lasts is also how long the water under it takes to come back up, which over a nine-second swell is most of a wave period.

### The handover is written on the HEIGHT, not on the shares

The OCEAN band fades by `1 − storm` and the rungs make up the rest of the sea in energy:

```
coast   = hsRef · exposure                   the coast's own sea here
carried = coast · (1 − storm)                what is left of it
target  = carried + openHs · storm           the height that should stand here
need    = √(target² − carried²)              the height the storm has to make up
```

so Hs grows STRAIGHT from the coast's own sea to the storm's, with no dip where the two spectra cross. Inside the level `storm` is 0, every open band's share is exactly 0, the whole storm is skipped in one comparison, and the sum a coast's water returns is term for term the one it returned before there was an ocean beyond the rim.

**Which rungs carry `need`**: a rung's own place on the ramp is its height over the storm's, so the height standing here sits between two of them, and those two share it by ENERGY (`f` and `1 − f`), which is what makes their combined height exactly `need` whatever their own quoted heights are.

**The ramp is EASED, and that is not decoration.** `need` is a square root of the ramp, so a straight ramp leaves the rim with an infinite slope — a kink in the water exactly where a rider crosses out of the level. A Hermite fade starts flat, so its square root is straight; twice is flatter still, which is what it takes for the step across the rim to be no bigger than the steps either side of it. `tests/waves_test.ts` measures that as CONTINUITY — the step has to shrink in proportion when the sampling step shrinks — rather than as "the rim is not the steepest point", which says nothing, since the rim is as likely as anywhere else to sit on a wave's steep part.

**Two things had to be carried past the rim to make it work**, and both are the same fault: a grid's sampler CLAMPS to its edge cell, so the rim's last row is repeated forever outward.

- **The phase.** A clamped field value stops changing along the axis a sample left the grid by and its gradient there is zero — a wave vector of nothing, which is a sea heaving in one place with no crest going anywhere. So `surfaceAt` carries the rim's own phase on outward at the local rate along the component's heading, `φ = φ(rim) + k·(d̂·o)`. It is continuous, because the field was seeded at the rim with exactly that plane wave (the seaward rim is the one a wave comes IN over, under R12), and it travels, because the wave vector out there is the heading's.
- **The bed.** The clamped rim is thirty-odd metres of water, which the depth-limited clip (`breakingHs`·d) would hold the storm down in; past a corner where the coast happened to reach the box it is a plateau of LAND standing out in the open ocean. `bedAt` falls the rim's ground away to `sea.open.depth` = 150 m over the same ramp the height climbs. `tests/waves_test.ts` holds that depth ahead of the CEILING, so a speed class that outgrew this bed fails rather than quietly clipping.

**The edge of the world lets you out.** `boundsPush` (`engine/game/collision.ts`) is the soft spring back inside the bounds, and it now holds a rider in only where that edge is LAND: the basin cuts its open water off at a straight line and pads every other side with land (R14, R15), so a rim standing in more than `contact.boundsOpenDepth` = 15 m of water is the open sea and the sea has no far side. Measured over the seed corpus, the wet rim cells of a level stand in 21 to 60 m, so every one of them opens and a creek's last shallow metres still turn a rider back. Each axis's spring also asks that the rider still be WITHIN the box along the other one, so a rider a kilometre out is not reeled sideways by a land rim he is now abeam of.

**What that gives, on one seed** (38, wind 13.4 m/s from 300°, dealt an 11.9 m storm; `make waves --seed 38`'s open-ocean table):

| Past the rim | storm | depth   | ocean share | open share | wind at 2 m | Hs      | Tp    | λ dom |
| ------------ | ----- | ------- | ----------- | ---------- | ----------- | ------- | ----- | ----- |
| 1 m          | 0.00  | 38.6 m  | 1.00        | 0.00       | 11.4 m/s    | 2.63 m  | 6.0 s | 53 m  |
| 432 m        | 0.02  | 33.6 m  | 0.98        | 0.09       | 11.6 m/s    | 2.79 m  | 6.0 s | 53 m  |
| 864 m        | 0.19  | 49.8 m  | 0.81        | 0.32       | 13.2 m/s    | 4.35 m  | 4.6 s | 33 m  |
| 1 295 m      | 0.54  | 92.8 m  | 0.46        | 0.63       | 16.7 m/s    | 7.64 m  | 6.5 s | 66 m  |
| 1 737 m      | 0.87  | 134.1 m | 0.13        | 0.90       | 20.0 m/s    | 10.73 m | 9.2 s | 131 m |
| 2 500 m +    | 1.00  | 150.0 m | 0.00        | 1.00       | 21.3 m/s    | 11.90 m | 9.2 s | 131 m |

The `ocean` scenario stands the craft out there; `make ride SCENARIO=ocean` rides it and `make screenshots SCENE=ocean` photographs it.

**What the RENDERER had to learn.** Every threshold that says how high or how steep a wave is standing was written against `sea.hsRef`, the coast's own swell — a crest tint, a frustum margin, the relative tilt bands, the whitecap and breaking gates. Judged against a one-metre coastal sea, a storm many times it is above every one of them at every vertex and comes out solid white. `pwa/src/game/water-mesh.ts` reads `stormSeaAt` once a frame at the craft (the storm alone, both numbers 0 inside a level, so nothing a course is ridden over changes) and takes the bigger of the two seas for each threshold. The storm is uniform to a fraction of a percent across a mesh two hundred metres wide, so once a frame is enough.

## The tornado past the far edge (`engine/game/tornado.ts`)

The storm stops building at `sea.open.reach`. Past there the ocean is a ceiling sea, the same every kilometre, over a bed nobody can touch, with no coast, no course and nothing built — and a rider holding the throttle open out there is riding away from the game rather than into more of it. **So there is something out there instead.**

`tornadoEdge(level.pace)` is where it stands: `sea.open.reach` plus `wind.tornado.grace` = 60 s of riding at the roster's fastest craft, which at the shipped class is **4 300 m past the rim**.

**Three of the dials read `Level.pace`, and three deliberately do not.** R32 made the speed class a per-RUN option (`createGame({ speedClass })`, which derives the hull through `craftAtClass` and lays the course to it), and the split follows what each dial is quoted against. The edge, the band and the blow are quoted against what the CRAFT can do, so they read the run's own class — otherwise a rider on a hull twice as quick gets half the grace and a wall he rides straight out through. The climb and the column are quoted against the SEA, and `createSea` deals its storm against `STORM_CEILING` off the catalog, so the sea past the rim is the same height at any per-run class and the throw holds still with it. Turning the BUILD's `TUNING.pump.speedClass` moves both together, which is the case the class sweep below measures. It stands past **every** rim the bounds let a rider out of (`collision.ts`), not only the seaward one: a rider who followed the coast too far out of the level along `x` meets the same weather as one who turned his back on the whole thing and rode out to sea.

`tornadoRamp(out)` eases it in over `wind.tornado.band` = 500 m, so crossing the line is a freshening over a few seconds rather than a pane of glass. Inside a level, and anywhere in the storm short of the edge, it is exactly 0 — `tests/tornado_test.ts` holds it at 0 at every gate of every seed in the corpus.

| What                                           | Answers                                                                                                          |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `TORNADO_EDGE`                                 | how far past the rim it stands, m — derived off the storm's reach and the roster's top speed                     |
| `tornadoRamp(out)` / `tornadoAt(bounds, x, z)` | how much of it stands there: 0 at the edge, 1 a `band` further out                                               |
| `tornadoInflow(grip, home, x, z, out)`         | the horizontal wind it adds, m/s — toward the level's start line, spiralled cyclonically by `swirl`              |
| `tornadoColumn(level, x, z)`                   | how tall the updraft's column is there, m over the water — the shore's over the shallows, the ocean's out at sea |
| `columnFade(height, top)` / `tornadoLift(…)`   | what is left of the column `height` metres up, and the force it puts on the hull, N                              |

### The wind, and the column

**The wind** blows toward `level.start` at `tornado.blow` = 2.17 × the roster's top speed — 65 m/s at the shipped class, EF3 on the enhanced Fujita scale and the bottom of what throws vehicles — spiralled `tornado.swirl` = 0.6 rad (34°) off the straight line home, cyclonically, the way a tornado's surface inflow crosses in at a large angle rather than running at the core. It is added to the level's own mean **as a vector** in `windAt`, under the same height profile and the same gust factor as any other wind, so it is felt through the one aero term in `flight.ts` and nothing had to learn a new force. It blows toward the START rather than toward the nearest rim on purpose: the rim tells a rider where the edge was, the start tells him where the game is.

Against the roster's `cdA` that is some **9 m/s² of push** on a craft afloat, which is most of what a hull can make — which is why nobody rides out through it.

**The column** is the updraft, and it is the point. It cannot be a third component on that wind: `cdA` is the hull's drag area NOSE-ON, three quarters of a square metre of something 3.5 m long and shaped to go forwards, and a hull going UP is not going forwards — it meets the column bottom-first and shows it the plan area as a flat plate. So it is its own force, `½·ρ·(L·B·plateCd)·v_rel·|v_rel|` at `plateCd` = 1.2 (Hoerner 1965), signed on the relative speed, capped at `liftCap` = 3 weights, and scaled by `airShare` — the same reading `flight.ts` fades its own air terms in with.

`airShare` is the whole design. **On the water the rider is only shoved about; the moment a wave throws him clear, the column has him.** A hull planing with a fifth of its bottom wetted is already partly in it and feels the machine trying to be plucked off the sea; one that leaves the water is gone.

### Not one absolute number in it

The ocean past the rim is sized off `STORM_CEILING`, which goes as the **square** of `TUNING.pump.speedClass`. A hazard standing in that ocean and quoted in metres and metres per second is therefore a hazard that is correct at exactly one speed class and quietly wrong at every other. So every dial is a ratio against the thing it has to stay in proportion to:

| Dial            | Against                                             | Shipped        |
| --------------- | --------------------------------------------------- | -------------- |
| `grace`, `band` | seconds of riding at the roster's best              | 1 800 m, 490 m |
| `blow`          | the roster's top speed                              | 65 m/s         |
| `climb`         | √(g·`STORM_CEILING`), the speed of a wave out there | 24 m/s         |
| `column`        | seconds of that climb                               | 18 m, 20 m     |
| `eventShare`    | a share of `blow`                                   | 29 m/s         |

Two of those are less obvious than they look, and both were found by sweeping the class rather than by reasoning:

**The updraft is quoted as a CLIMB, not as an air speed.** The speed at which a hull _hovers_ — where the plate drag exactly carries its weight — is set by its mass over its plan area and by nothing else: `hoverSpeed`, 34 to 38 m/s across the shipped roster, and it moves with neither the class nor the sea. An updraft quoted outright is therefore a different throw on every hull, and at a low enough class it is a number _under_ the hover speed on the heaviest one — a tornado that lifts nothing and fails silently. `updraftFor(spec)` is each hull's own hover speed plus the climb, which makes the throw the same on all four by construction.

**The column is quoted in SECONDS of that climb, not in metres of sea.** Quoted against `STORM_CEILING` it would go as the square of the class, and the throw is not a throw at either end: measured at half the class it stands 5 m and lofts the roster over its own height once in two minutes, and at double it stands 80 m and holds a rider 26 to 33 s. What a rider reads is seconds, so the height is quoted in them and the column grows **linearly** with the class while the sea around it grows quadratically.

**And the lift has a ceiling.** The plate drag goes as the square of the relative speed, so on a hull _falling_ back into a column that is still rising the two speeds add: uncapped, a fast class turns the column into a trampoline — 44 s of air at four times the shipped class, against the 5 s the same storm gives with no tornado in it. `liftCap` = 3 weights lets the column accelerate a hull at 2 g and slow a falling one by no more, whatever the class. At the shipped class the uncapped force at the water is about 2.8 weights, so it barely binds where the game actually is.

### What bounds the throw

Three things bound it, and each bounds a different axis:

- **The speed** is bounded by the sign on `v_rel`: a hull climbing faster than the air around it is pushed back DOWN, so the climb settles at `climb` wave-speeds however long it is held.
- **The height** is bounded by `columnFade`. The climb is one thing; how LONG a rider is up is how long the column keeps holding him, and out here that is however long the inflow takes to carry him back inside — twenty seconds. Given a column with no top the roster went to **150 m for seventeen seconds**, which is not a jump, it is weather. Past about 24 m of column at the shipped class the lift at the apex carries the weight outright and a throw stops coming down at all.
- **The force** is bounded by `liftCap`, above.

The column has **two** tops, because a tornado is only ever as big as the water under it: `column.shore` over the shallows a rider reaches by following the coast, `column.ocean` over the open sea he reaches by turning his back on the level. `tornadoColumn` reads the level's own `offshore` field to say which — a baked field clamps at its rim, which is exactly the reading wanted, so nothing extra is built to answer it.

Measured over the roster at the shipped class, counting only the flights the column actually lofted:

| Column | p10 air | median | p90    | apex median | apex max |
| ------ | ------- | ------ | ------ | ----------- | -------- |
| shore  | 2.6 s   | 4.6 s  | 9.9 s  | 16 m        | 31 m     |
| ocean  | 1.9 s   | 5.2 s  | 13.1 s | 17 m        | 28 m     |

Swept over the class, median and p90: at ×0.5, 3.1 / 11.1 alongshore and 4.3 / 18.3 at sea; at ×1, 4.6 / 9.9 and 5.2 / 13.1; at ×2, 10.8 / 24.1 and 5.9 / 18.5. Past about ×2 the throw runs long — but so does every flight out there, because the sea is then over a hundred metres and outside what the spectrum itself is held to (`sea.open.bandHigh`). That is the ocean outgrowing the model, not this hazard losing its calibration.

### What it is not

Nothing here teleports a craft, resets a run, ends a run, or stands a wall in the water. The rider is thrown — twenty-odd metres up and a long way back toward where he started — by a wind, lands, and rides on; the course, the gate count and the clock are untouched, and he is free to ride straight back out and be thrown again. `tests/tornado_test.ts` holds all four of those.

The engine says so with one event, `{ kind: "tornado", t, wind, speed }`, emitted when the column takes a hull that is more than half out of the water in a wind of at least `eventShare` = 0.45 of the full blow, and no oftener than `eventGap` = 6 s — one telling a throw. `pwa/src/game/rumble.ts` spends the whole motor on it. It needs no sound of its own: the ride bed's wind layer already reads `windAt`, so a 65 m/s inflow roars through the mix that was always there.

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

For every component at the point, with `a` the deep amplitude × `Ks(d)` × its BAND's share here (`seaShares`) × the breaking clip, `k` the local wavenumber, `k⃗` the local wave vector — the phase field's gradient for the ocean band, `k·d̂` for the local band — and the phase `φ = phaseField(x, z) − ω·t + φ₀` (the plane wave `k₀·(d̂·x)` for the local band, which carries no field):

```
peak    = ½·min(k·a, crestMaxSteepness)·crestSharpness·a        (Stokes' second order)
height  = Σ [ a·sin φ − peak·cos 2φ ]
slope   = Σ [ a·cos φ + 2·peak·sin 2φ ]·k⃗       (the wave vector; the amplitude's own
                                                 gradient is a shoaling effect too slow to tilt the surface)
normal  = (−slope_x, 1, −slope_z) / |…|
v_h     = Σ a·ω·coth(k·d)·sin φ · k⃗/k          (Airy: horizontal orbital velocity, in phase with the height,
                                                 along the wave vector)
v_y     = −Σ a·ω·cos φ                          (the surface's own rate of rise)
v_x,v_z += flowAt(level.flow, x, z)             (R27: the water itself, where a river is running)
```

A band whose share at the point is under a thousandth — under a millimetre of water — is skipped outright rather than multiplied by zero, and that is most of a level: out at sea the local band is absent and up a river the ocean band is, so all but the water round a river mouth pays for one band. Each component's depth table is read ONCE and held between the two passes.

**What a component costs, and where it is paid.** The fixed work — the shares, the depth, the clip — is about 300 ns a call, and a component is about **140 ns on top of it**, whether or not it carries a phase field (the field's gradient read is not the expensive part; the sines, the crest correction, the normal and the orbital velocity are). The water mesh calls this once per vertex per frame — 5400 of them at the design WATER row — so the eight ocean components and the five local ones are most of a 10 ms frame, and every component added is another 0.75 ms of it. That is why `sea.components` is 8 and why a repeat is fixed by where the slices SIT (`sliceMix`) rather than by laying more of them: sixteen put the same frame at 17 ms.

**Measure it where the band is actually carried.** A band whose share is nothing is skipped in one comparison, so a benchmark that samples a point the ocean band does not reach — a river mouth, a sheltered start — measures the local band and a skipped branch, and reports an ocean component as nearly free. Check `seaShares` at the sample point before believing a per-component cost.

The orbital velocity is what makes a wave face lift the bow and a crest carry the hull: the hull's drags are computed against the flow RELATIVE to the water (`hull.ts` subtracts the sample's `vx, vy, vz` from each probe's velocity), so a hull sitting on a crest is pushed along with it and one climbing a face meets water coming at it. A mesh of forty thousand vertices calls this once a vertex a frame; the `out` parameter is how it allocates nothing.

## What the renderer reads

`pwa/src/game/water-mesh.ts` displaces a grid following the craft by calling `surfaceAt` per vertex on the CPU (the height; the normal for shading). The grid is a fine core round the craft inside nested square rings, each ring's cell twice the one inside it (`water-grid.ts`), and its origin snaps to the COARSEST cell — so every vertex, in every ring, samples the same world point frame after frame and the drawn sea stands still under a moving craft rather than sliding along with it. Under it a coarse FAR grid, out to the fog, calls the same function with `surfaceAt`'s `count` — the first that many components, which are the longest, since the field is laid from the low end of the band up — so a storm's swell stands out to the horizon while the chop that would alias on a thirty-metre cell is left off; the near grid's edge fades to the far grid's surface rather than to flat. The wake is not a second surface laid over this one: `wake.ts` rasterises the trail — the road's foam, the churn, a crest and a hollow, each by the speed the hull was making and the age of the water (`wake-profile.ts`) — into a small map round the craft, and the water shader reads it per vertex and per pixel, so the road is drawn by the same foam term in the same light as a whitecap, and the transom's trough is a few centimetres of relief on the engine's own surface, behind the hull where no probe reads. There is no second wave function — not in a shader, not in the renderer — which is the whole point: a wave the physics did not compute cannot be drawn, and one the renderer cannot draw cannot be felt.

What the LIGHT does at that surface is `water-shader.ts`'s, per pixel, and none of it moves a vertex: Schlick's Fresnel on the real viewing angle (two per cent straight down, everything at a grazing angle) between the water's body colour and the sky's own gradient in the direction each wave face reflects; the sun's glint as a tight lobe over a ripple tile made in code and scrolled downwind — the sparkle — and a broad lobe over the swell — the road a low sun lays toward the rider — both scaled by how much of the sun arrives as a beam (`Preset.beam`), so a squall's ceiling glints nothing; the light through a crest with the sun behind it; and the vertex's foam share broken up by the foam tile. The ripples are the one thing drawn that the physics does not carry, and they are a NORMAL, not a height: a probe reading the same water agrees with the picture to the millimetre.

## The wind the sea is built from (`engine/game/wind.ts`)

The sea is built from the level's MEAN wind (the spectrum needs a wind that has blown for hours, not this second's gust). The gusts are what the hull and the rider feel through the aero drag and what a hull in the air feels as a side force and a pitch moment. Three things shape what a rider actually meets:

- **The shelter** is the field above — a level is a coast, which is the one place a wind changes over a few hundred metres — so the speed is read at the craft's POSITION as well as its height.
- **The profile** is the log law (Prandtl; Stull 1988 §9): `U(z) = U_ref · ln(z/z₀) / ln(z_ref/z₀)` with the sea's roughness length `z₀` = `roughness` = 2·10⁻⁴ m (Charnock 1955 at moderate winds), `referenceHeight` = 10 m, and the height floored at `minHeight` = 0.3 m so a probe in a trough never reads a wind blowing backwards. A rider six metres up off a ramp feels more wind than the hull did.
- **The gust factor** is an Ornstein–Uhlenbeck process about 1 — `dx = −(x − 1)/τ·dt + σ·√(2dt/τ)·N` — with `intensity` σ = 0.11 (the turbulence intensity σ_u/U over water at 10 m, IEC 61400-3 offshore class), `gustTime` τ = 12 s (the gust integral time scale), clamped to `gustMin..gustMax` = 0.55–1.6 × the mean. A second, slower process wanders the direction: `veer` σ = 0.12 rad, `veerTime` = 25 s, clamped to ±3σ.
- Each Gaussian is one Box–Muller draw (two uniforms off `state.rng`, the second of the pair deliberately NOT kept — a state that carries a spare draw replays differently from where it was saved), so `stepWind` draws four uniforms a step, every step, whether or not anything feels the wind. That is what keeps a calm level and a gale consuming the same stream and a replay on the same numbers.

`windAt(wind, y, x, z)` is the wind VELOCITY there — it blows TOWARD the opposite of `from`. `tests/wind_test.ts` holds the profile, the reference height, the shelter's floor and the drop over the land, the bounds and the seeding.

## The numbers, in one place

| Knob                                 | Value       | Unit   | What it buys                                                      |
| ------------------------------------ | ----------- | ------ | ----------------------------------------------------------------- |
| `sea.components`                     | 8           | —      | OCEAN band components — the FRAME's budget sets it                |
| `sea.sliceMix`                       | 0.7         | —      | 0 cuts the band evenly in frequency, 1 evenly in ENERGY           |
| `sea.localComponents`                | 5           | —      | LOCAL band components — the chop on enclosed water                |
| `sea.localFetch` / `localFetchScale` | 2000 / 10   | m, —   | the local band's PERIOD, and the stretch that sets its HEIGHT     |
| `sea.localBandLow` / `localBandHigh` | 0.8 / 1.8   | × ω_p  | the narrower band the chop is laid over                           |
| `sea.fanSpread` / `fanRays`          | 45 / 5      | °, —   | the upwind fan the effective fetch is read on                     |
| `sea.bandLow` / `bandHigh`           | 0.7 / 2.4   | × ω_p  | the band the components are laid over                             |
| `sea.minPeriod`                      | 2.5         | s      | absolute short end of the band — the chop on a slow swell         |
| `sea.spread`                         | 0.45        | rad    | nominal cos² half-width AT THE PEAK (~26°, realising ~11°)        |
| `sea.spreadTilt`                     | 1.25        | —      | how that half-width opens ABOVE the peak (Mitsuyasu 1975)         |
| `sea.spreadMax`                      | 0.75        | rad    | ...and the widest it ever gets (~43°)                             |
| `sea.peakEnhancement`                | 3.3         | —      | JONSWAP's γ — energy at the peak vs spread around it              |
| `sea.heightScale`                    | 1.5         | ×      | HOW BIG: multiple on what the fetch law grows                     |
| `sea.periodScale`                    | 0.95        | ×      | HOW LONG: multiple on the wind sea's peak period (λ ∝ this²)      |
| `sea.baseFetch` / `fetchScale`       | 30000 / 100 | m, —   | the ocean band's stretched fetch: `30000 + 100·reach`             |
| `sea.minDepth`                       | 0.15        | m      | floor on the depth the model reads                                |
| `sea.breakingRatio`                  | 0.78        | —      | McCowan's H/d for one wave — quoted, not applied                  |
| `sea.breakingHs`                     | 0.55        | —      | Nelson's depth-limited Hs/d — what the field is clipped to        |
| `sea.crestSharpness`                 | 1.6         | ×      | HOW SHARP: multiple on Stokes' second-order crest term            |
| `sea.crestMaxSteepness`              | 0.32        | a·k    | the steepness that correction is evaluated at, at most            |
| `sea.tableRoot` / `tableDepth`       | 0.1 / 250   | m^½, m | the per-component depth table, on a √d axis                       |
| `sea.steepness`                      | 0.09        | —      | Hs/L₀ of a QUOTED sea — its period, and so its wavelength         |
| `sea.open.vary`                      | 0.75        | —      | the band the dealt storm is drawn over, as a share of the ceiling |
| `sea.open.reach`                     | 2500        | m      | how far past the rim the dealt storm stands in full               |
| `sea.open.rungs`                     | 3           | —      | the shares of it the open band is laid on                         |
| `sea.open.bandHigh`                  | 4.8         | f_p    | the band a rung is laid over, as a multiple of its own peak       |
| `sea.open.wind`                      | 25          | m/s    | the wind out there at 10 m                                        |
| `sea.open.depth`                     | 150         | m      | the ocean floor out there, so nothing clips the storm             |
| `contact.boundsOpenDepth`            | 15          | m      | how deep a rim must be for the bounds to let a rider out          |
| `water.viscosity`                    | 1.14·10⁻⁶   | m²/s   | kinematic viscosity for the ITTC-57 line (fresh water at ~15 °C)  |
| `wind.roughness`                     | 2·10⁻⁴      | m      | the log law's z₀                                                  |
| `wind.referenceHeight` / `minHeight` | 10 / 0.3    | m      | where the mean is quoted; the profile's floor                     |
| `wind.intensity` / `gustTime`        | 0.11 / 12   | —, s   | the gust process                                                  |
| `wind.veer` / `veerTime`             | 0.12 / 25   | rad, s | the direction's wander                                            |
| `wind.gustMin` / `gustMax`           | 0.55 / 1.6  | × mean | the gust factor's bounds                                          |
| `wind.shelter` / `shelterFetch`      | 0.3 / 220   | ×, m   | what a wind off the land keeps, and the run it recovers over      |
| `wind.cell`                          | 100         | m      | the square the shelter is averaged onto                           |
| `flow.gather`                        | 0.8         | —      | how the river's discharge falls going up (R27)                    |
| `flow.max` / `flow.plume`            | 3.5 / 90    | m/s, m | the current's ceiling, and how far its plume carries out          |

The level contributes `wind.speed` (6–14 m/s, R12) and `wind.from` (always off the sea — R12, which is what puts the ocean upwind of the whole coast), its `offshore`, `ground` and `flow` fields, `river.discharge` (120–600 m³/s, R27), and `water.density` (1005 kg/m³ on the taiga coast — brackish; R13), which is the density every hydrostatic and hydrodynamic force uses.

## What holds it

`tests/waves_test.ts`: the dispersion relation in both limits and everywhere between; the shoaling coefficient's growth; the phase field (the wavelength the field carries against the depth's own at every gate of the shared corpus and over the exposed water, and crests turning toward the shore off an oblique wind); the fetch law and its PM cap; R28's two bands (the ocean's sea reaching the shore undiminished, the river getting the wind's chop and none of the ocean's); R27's current running down the channel and quickening as the banks close; the depth-limited clip in the shallows; bounded heights everywhere; purity (the same point at the same time is the same surface). `tests/wind_test.ts`: the profile, the shelter, the gusts, and the wind freshening into the storm past the rim. `tests/collision_test.ts`: the bounds holding at a land rim and letting a rider out at an open one. `tests/determinism_test.ts`: a run replays. **`make waves SEED=`** (`scripts/waves-lab.mjs`) is the lab: a transect from the shore out to sea at several moments, Hs against offshore distance, the spectrum, a walk OUT INTO THE OPEN OCEAN past the level's rim and a walk UP THE RIVER (the two other kinds of water a rider can reach), and a table of the two bands' shares, the local wind, Hs, Tp, wavelength, steepness H/λ, celerity, the depth ratio d/λ with the regime it puts the wave in (deep / intermediate / shallow), and the depth a wave breaks at — required before and after any change to `water.ts`, because a wave model is judged by the sea it makes and a screenshot shows one wave.

## What is NOT modelled

A list a future session can pick from, each a known simplification rather than an oversight:

- **Refraction's and diffraction's AMPLITUDE.** The phase field turns the crests (the kinematics), but the energy a bent ray bundle concentrates or spreads — the focusing behind a shoal, the `1/√r` decay of a front fanning out of a narrow mouth — is not followed; a point's amplitude is its exposure's share, the cos-weighted fan of `fetch.ts`, which decays into a lee and round a corner but knows nothing of the rays' spacing.
- **Horizontal Gerstner displacement.** The trochoidal shape is taken as Stokes' second-order correction on the HEIGHT instead (`−½·k·a²·cos 2φ`), so the surface is a function of the undisplaced `(x, z)` the physics can ask about; the horizontal orbital displacement of the water itself is not drawn.
- **Wave–current interaction.** The river's current (R27) is ADDED to the orbital velocity; it does not refract, shorten or steepen the waves running against it, which is what a real ebb tide does to a swell.
- **Whitecapping and dissipation.** The only energy loss is the McCowan clip at a point; nothing breaks progressively, and a breaking wave sheds no foam, spray or turbulence into the physics.
- **A varying peak period.** The three bands each carry ONE period for the whole level; a point takes a share of each, so a river gets the short band and the open sea the long one, but neither band's own period changes across the water. A quoted sea (`SeaOverride`) replaces the ocean band rather than standing beside it as a third peak.
- **Directional spread beyond ±35°.** Truncated cos² — the sea is always more or less aligned with the wind, which under R12 always blows in against the shore.
- **Wave–wave (nonlinear) interaction**, wave set-up, set-down and run-up at the shore.
- **Reflection and diffraction** off skerries and headlands, beyond what the exposure sweep's lateral mixing gives for free: the lee of a single skerry is not calmer, though the lee of a headland is.
- **The amplitude's own gradient in the slope** (shoaling is too slow to tilt the surface, and it is left out of the normal).
- **Gusts in the sea.** The spectrum reads the mean wind only; a gust changes the aero, never the water.
- **Temperature.** One viscosity for the friction line; the water's temperature is carried on the level for the fauna and the spray to read later.
- **Rain, ice, tides.** The weather module (`engine/mapgen/weather.ts`) is a placeholder.

## Sources

Tessendorf, _Simulating Ocean Water_ (2001) · Finch, "Effective Water Simulation from Physical Models", _GPU Gems_ 1 ch. 1 (2004) · Hasselmann et al., JONSWAP (1973) · Pierson & Moskowitz (1964) · _Shore Protection Manual_ (SPM, 1984) fetch-limited growth · Longuet-Higgins, Cartwright & Smith, directional spectra (1963) · Fenton & McKee, "On calculating the lengths of water waves" (1990) · Dean & Dalrymple, _Water Wave Mechanics for Engineers and Scientists_ (1991) · McCowan (1894) · Charnock (1955) · Stull, _An Introduction to Boundary Layer Meteorology_ (1988) · IEC 61400-3.
