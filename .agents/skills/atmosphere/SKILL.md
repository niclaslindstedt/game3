---
name: atmosphere
description: "Use when working on the SKY and the air under it — where the sun stands at this hour on this coast in this season and what colour it makes the sky, the ladder of authored looks, what each of R19's five weathers puts over the top of it, the clouds and the altitudes they ride at, the night (the stars, the moon's key, the craft's lamps), the haze the distance fades into, the rain in the air, and the two lights and the fog every material is lit by. Owns `pwa/src/game/sky.ts` and its kin, `daylight.ts`, `cloud-field.ts`, `sky-glsl.ts`'s `skyAlong`, `rain.ts`, `weather.ts`, `craft-lamps.ts`, `environment.ts`, and `make sky` — the contact sheet that is the only honest way to judge any of it. Not the water that reflects it (`water-look`), not the shore under it (`nature`), and not what the craft throws off (`visual-effects`)."
---

# The atmosphere: the sky, the light and the weather

Everything over the water and in the air between the lens and the far shore.
The picture is set here before a single wave is drawn: the sun's elevation
decides the palette, the weather decides the contrast, the haze decides how
far the coast reads — and because the sea is a mirror, every one of those
decisions is made twice in the frame. A change here moves every screenshot
in the game.

**Read this skill's lessons first** — `node scripts/skill-lessons.mjs
atmosphere --list`, then the ones the task touches. Load **`skill-reflection`**
at both ends of the session and **`write-code`** beside this one for any code
change. For the sea that reflects this sky, `water-look`; for the shore and
what grows on it, `nature`; for the spray and the wake, `visual-effects`; for
how the weather SOUNDS (the wind, the rain on the water), `sound-effects`.

## The engine's half, and the app's

The engine decides the FACTS and the app decides the PICTURE, and nothing in
the engine has an opinion about colour:

| Fact | Where |
| --- | --- |
| Which of the coast's five skies a seed is ridden under, and HOW HEAVY it is — read off the wind the level already has, so the darkest skies stand over the biggest seas (R19) | `engine/mapgen/weather.ts`, `biomes.ts`'s `weathers`; `skyCover(wind.speed)` is the one measure of heaviness |
| The three hours a level offers, worked out from the coast's own daylight (R13) | `engine/mapgen/daytime.ts` |
| The hour the run has REACHED — an hour of sun a minute of riding | `sunHourAt(level, state.t)` in `engine/game/clock.ts` |
| The astronomy itself: declination by season, the sun's elevation and bearing at a latitude | `engine/lib/solar.ts` — the generator needs it to pick an hour at all |

Which sky, which season and which hour are the ONLY inputs. A row on the
start card that overrides one of them overrides exactly that one (SEASON
moves the sun and nothing else), and the sky is asked for again EVERY FRAME
because the sun moves.

## The files, one direction of flow

The sun is decided first; everything else reads it.

| File | Owns |
| --- | --- |
| `pwa/src/game/daylight.ts` | WHERE THE SUN IS, read as a kind of light: the hour, the season and the coast's latitude turned into an elevation and a bearing; the full moon opposite it (`moonAt`); the word for the light, night included; the lamp switch (`lampsAt`); `litAt` for anything at altitude |
| `pwa/src/game/sky.ts` | WHAT COLOUR THE AIR IS: the four layers (the sun, the ladder, the lid, the season's cast) applied in order into ONE `Preset` — the gradient, the two lights, the fog, the lamp switch, the mirror's horizon — with `skyToneAt` the gradient as TypeScript so `tests/sky_test.ts` can hold the model. Three-free; every mix goes through `pwa/src/lib/colour.ts` |
| `pwa/src/game/sky-rungs.ts` | THE LADDER: complete looks keyed on the sun's elevation — the dark, the two twilights, the sun on the water, the low sun, morning, full day — each authored WHOLE so a sunset stays a sunset, and the hour blends between the two the sun stands between. These are a SEA's rungs: the band over the horizon is haze off the water, cooler and paler than a road's dust |
| `pwa/src/game/sky-looks.ts` | WHAT EACH WEATHER DOES over the top of it, read at its lightest and heaviest so no two overcasts are the same overcast; and what each season does to the air (a cast, a clarity, the dawn's sea mist) |
| `pwa/src/game/cloud-field.ts` | WHAT CLOUD IS UP THERE: the genera at the altitudes the cloud chart puts them, dressed onto one level by its weather, its heaviness and its seed (a clear sky is dealt none); the noise the sheets are cut from, stated once as GLSL and once on the CPU. Built ONCE per level |
| `pwa/src/game/starfield.ts` | THE NIGHT SKY: where the sphere of stars has turned to this hour and season about a pole at the coast's latitude, the Milky Way at its tilt, as GLSL the dome adds under the disc |
| `pwa/src/game/sky-glsl.ts` | THE SKY ALONG A RAY — `skyAlong`, one GLSL function: the gradient, the warm bleed round the sun, the disc and halo, and every cloud sheet projected onto the ray in perspective. Stated once because TWO surfaces ask it: the dome, and the water's mirror. `SkyBuild` is what each caller was COMPILED for |
| `pwa/src/game/sky-dome.ts` | The dome that paints `skyAlong`; `sky-depth.ts` the trick it shares with every backdrop — drawn LAST at the far plane, so a covered pixel is never shaded |
| `pwa/src/game/weather.ts` | HOW HARD IT IS COMING DOWN — the numbers everything wet is scaled by, read off the live gust, DOM-free so the tests and the audio read the same rain |
| `pwa/src/game/rain.ts` | The sheet in the air: a pooled box of streaks round the lens, each stretched along the velocity it is SEEN at (the drop's minus the craft's). The rings it pocks the sea with are the water shader's |
| `pwa/src/game/craft-lamps.ts` | The one light the rider carries into the dark: a headlamp under the hull's own quaternion, the two sidelights, thrown by the sky's switch (`Preset.lamps`); the water reads the very same spotlight (`applyLamp`). The buoys' own caps are `gates.ts`'s `setNight` and `buoys.ts`, lit by an emissive because forty marks are not forty lamps |
| `pwa/src/game/environment.ts` | Hangs it all in the scene: the two lights, the fog, the dome, the cloud stack, the rain, the shared sky uniforms the water reflects through; the preset re-read EVERY FRAME; the key dimmed by whatever sheet has drifted over it (`sunOcclusion`) |

## The lab: `make sky`

A seed is dealt ONE sky at ONE hour, so a screenshot of a run can only ever
say whether that one cell is wrong — and the sky here is a LADDER, judged
side by side or not at all. So the review is a contact sheet: every weather
against every three hours of the clock, day and night, on one coast in one
season, labelled.

```sh
CHROMIUM_PATH=/opt/pw-browsers/chromium make sky        # previews/sky.png
make sky ARGS="--season=autumn"                          # the black nights
make sky ARGS="--rows=squall,rain --hours=5,12,22"       # one slice, while iterating
make sky ARGS=--skip-build                               # reuse the last bundle
```

The page is `pwa/src/tools/sky-preview.ts` over `pwa/sky-preview.html`,
driven by `scripts/sky-preview.mjs`; it builds its own one-off bundle, so it
needs no `make build`. **REQUIRED before and after any change to the sky, the
weather, the clouds or the night** — keep both sheets and put them in the PR.
A slice is for iterating; shoot the whole sheet again before the commit.

Read the sheet as a sheet: the failure mode of this subsystem is a change
that looks right at noon in clear weather and wrong in every other cell.
Check the low-sun rungs and the heaviest column especially — that is where a
palette change breaks. The NIGHT columns are their own review: a thumbnail
lies about them, so crop the cells at native resolution. And when a picture
is "somehow flat", sample a vertical column of pixels through the skyline
rather than arguing about it — the step at the waterline is a number.

Then the run: `make build`, `make screenshots SCENE=cruise HOUR=20.5
WEATHER=squall` (and `SEASON=`) rides the seed under the cell in question,
which is where the sea's mirror of it is judged (`water-look`).

## Craft rules

- **The sun is the single input, and it is asked every frame.** Anything
  that needs to know how bright, how hard-edged or what colour the light is
  reads the `Preset` — the water, the craft's gel coat, the fog, the lamp
  switch, the HUD's clock. Nothing restates an elevation or picks its own sun
  colour, and nothing caches a preset across a frame.
- **The moon is not a second light; it is the KEY handing over.** Through
  civil twilight the preset's sun slides to the full moon opposite it, and
  the disc, the halo, the glint's road and the cloud occlusion all follow
  that one key. Nothing downstream learns a moon exists.
- **The season is the declination, and nothing else about the sun.** A night
  at 62°N is a fact about the date; what the season does to the AIR is a cast
  shown in proportion to `daytime`, so midnight is the same dark in every
  season — `tests/sky_test.ts` holds it.
- **The sky is authored in linear light.** Every mix in `sky.ts` goes through
  `lib/colour.ts`, which converts exactly as `THREE.Color.lerp` does; a mix
  against another curve drifts from every material the same preset lights.
  And every hand-written `ShaderMaterial` ends with
  `#include <colorspace_fragment>` — the fault reads as a far shore glowing
  brighter than the sky behind it, never as "too dark".
- **`skyAlong` is stated once, and the mirror is compiled BLURRED.** The dome
  and the water read the same function off the same uniform bundle; what
  differs is `SkyBuild`. Any sharp feature of the sky (a squall's lit rim)
  must be widened for the water's build or it lands as hard white streaks
  the sea reads as foam it does not have.
- **A sheet is lit where the ray meets it.** A cloud drawn as a plane takes
  the ceiling's own gradient at the RAY's elevation, never a fixed tone — a
  fixed tone is a billboard's habit and flattens a squall into a pale veil.
- **The haze is the sky in that direction.** `Preset.fog` is pulled most of
  the way to the horizon band (`FOG_IS_SKY`); under a lid it is the ceiling a
  few degrees up, neither the overhead nor the rim. An authored grey rules a
  headland across every sunset.
- **Under a lid the horizon band IS the lit rim** — one colour, or a hard
  line runs across the whole skyline, which over water has no ridge to hide
  behind.
- **Sky elements are an ANGULAR size.** A cloud sheet is a plane at an
  altitude, so it foreshortens and crowds toward the rim by projection;
  anything placed in metres pops as the lens moves.
- **The fog's end is not a free cull distance.** The far tree line is the
  shore's silhouette against the sky, so a cut inside the fog must pull the
  fog IN to cover it — that is what the DISTANCE row's `haze` does
  (`settings-video.ts`, `draw-distance.ts`), and why nothing culls at the
  sky's own `fogFar`.
- **The weather is shared.** `weather.ts` is DOM-free so the rain, the water's
  rings and the audio read one number for how hard it is coming down; do not
  fork a second notion of it.
- **The lamp is one spotlight, hidden by day.** three recompiles lit
  materials per visible light, so the one recompile is paid at dusk; the
  water reads the same light through `applyLamp` rather than a second lamp.

## What the change obliges elsewhere

- `make sky` before and after, both sheets in the PR; a run screenshot at
  the cell in question for the mirror.
- `npx vitest run tests/sky_test.ts tests/cloud_field_test.ts
  tests/weather_test.ts tests/water_shader_test.ts` — the last because the
  shader's uniform contract reads the preset.
- A weights or skies change in `engine/mapgen/weather.ts` or `biomes.ts` →
  `docs/level-generator.md` (R19) and the corpus digest.
- The sky bullet in `docs/architecture.md`; `docs/configuration.md` if a
  `?hour=` / `?weather=` / `?season=` reader moves.
- A `.changes/unreleased/` fragment — the sky is what the player looks at.

## Skill self-improvement

Load **`skill-reflection`** before this session commits. Worth a fragment
here: a cell of the sheet that broke while the rest held, a colour that only
read right in linear light, a thing the mirror showed that the dome hid.
