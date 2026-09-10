// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ATMOSPHERE — the sky a level is ridden under, built out of the colours
// `sky.ts` works out for its hour and its weather (R19) and the cloud stack
// `cloud-field.ts` dresses it in. The target look is the 90s jetski racers'
// chunky saturated water sitting inside a modern northern air: a sky whose
// horizon glows around the sun, real cloud at real altitudes with the light
// coming through it, coloured distance fog, and — under weather — a ceiling
// with the daylight arriving under its rim and rain falling out of it.
//
// This module owns everything about the scene that is AIR: the two lights,
// the fog, the background, the dome and what falls out of it. It reads
// `GameState` and never writes it, and it hands out what other things need
// to answer to the same sky — the preset, the two lights, and the SHARED
// SKY UNIFORMS the water reflects the dome through.
//
// THE SUN MOVES. One minute of riding is one hour of sun (`sunHourAt`), so
// the preset is worked out again EVERY FRAME off the run's own clock — a
// few dozen colour mixes — and everything that hangs on it follows: the
// two lights, the fog, the dome, the moon taking the key over as the sun
// goes, the stars coming out, the craft's lamp switching on. Only the
// cloud STACK is built once per level; what is in front of the sun still
// moves on its own — the sheets ride the wind, and when one comes over the
// sun the whole coast goes dull and brightens again as it passes
// (`sunOcclusion`).
//
// Neighbours own the parts that are their own craft: `sky.ts` decides what
// colour everything is, `cloud-field.ts` what is up there, `sky-glsl.ts`
// what a ray through all of it comes back as, `sky-dome.ts` draws it,
// `rain.ts` is the sheet in the air, and `water-mesh.ts` (through
// `water-shader.ts`) reflects the very same sky off every wave face.

import * as THREE from "three";
import { biomeOf, skyCover, sunHourAt, type GameState, type Level } from "@engine";

import { dressSky, sunOcclusion, type SkyDressing } from "./cloud-field.ts";
import { litAt } from "./daylight.ts";
import { createRain, type Rain } from "./rain.ts";
import { SKY_LOOK, type SkyLevel } from "./settings-video.ts";
import { createSkyDome, type SkyDome, type SkyLook } from "./sky-dome.ts";
import { createSkyUniforms, type SkyUniforms } from "./sky-glsl.ts";
import { highLightFor, skyAt, skyFor, sunVector, type Preset } from "./sky.ts";
import { skyTurnAt } from "./starfield.ts";
import { fallOf, precipReach, squallOf } from "./weather.ts";

/** How far out the key light is parked, m. It is directional, so the
 * distance changes nothing about the light — it only has to be outside
 * anything that will ever cast into it. */
const KEY_DISTANCE = 900;

/** What is left of the hemisphere's UPPER half when the sky is a lid.
 *
 * Three's hemisphere light is the whole sky in two colours, and under a
 * deck the "sky" a hull sees is the ceiling rather than the blue behind it.
 * The preset's own `hemiSky` has already been greyed toward the lid
 * (`sky.ts`), so what is left here is the intensity — and a lid REPLACES
 * the beam with scattered light rather than only removing it, which is why
 * an overcast noon is still a bright day with no shadows in it.
 */
const DECK_SKYLIGHT = 1.18;

/** How much of the key a sheet drifting over the sun takes, at full cover.
 * Not all of it: the sky behind the cloud is still lighting the water, and
 * that half is the hemisphere's — this is only the BEAM going away. */
const CLOUD_DIM = 0.72;

/** The coast the opening sky stands over until a level says otherwise. */
const TAIGA_LATITUDE = biomeOf("taiga").latitude;

export type Environment = {
  /** Build the sky for a level. */
  load: (level: Level) => void;
  /** Follow the lens, ride the wind, rain. `eye` is where the lens ended up
   * this frame and `dt` is the frame's wall time, s. Nothing in the sky is
   * culled against the camera — the dome is ONE draw call and it is already
   * depth-tested against the world (sky-depth.ts), which is what retiring
   * the ring of cloud billboards bought. */
  update: (state: GameState, eye: THREE.Vector3, dt: number) => void;
  /** Take the picture ladder's SKY stop — how deep the sheets are read and
   * how many of them are stacked. Recompiles the dome. */
  setLook: (level: SkyLevel) => void;
  /** Take the picture ladder's DISTANCE stop, as what the sky's own fog range
   * is worth: `DISTANCE_LOOK.haze`. Under one the air thickens so the world
   * can end nearer without the rider seeing it end; over one it thins and the
   * coast is drawn out to meet it.
   *
   * It multiplies the PRESET's range rather than replacing it, so the weather
   * still decides what a day looks like and the row only says how much of that
   * day is in front of the lens. Applies at once. */
  setHaze: (haze: number) => void;
  /** The sky as it stands — for anything that has to answer to it. */
  preset: () => Preset;
  /** The shared sky uniforms. The water's material holds these very objects,
   * so the sea reflects the dome that is over it by construction. */
  uniforms: SkyUniforms;
  /** How many cloud sheets are drawn — the one thing about the sky the
   * water's mirror has to be COMPILED for. */
  cloudLayers: () => number;
  /** How hard it is coming down on the sea right now, 0..1. */
  rainfall: () => number;
  /** THE TWO LIGHTS, as set for that sky and for whatever is in front of the
   * sun this instant. The water's shader lights itself from these rather
   * than from the preset, so what the sea is lit by is exactly what the hull
   * beside it is lit by. */
  hemi: THREE.HemisphereLight;
  key: THREE.DirectionalLight;
  /** What the sky owns that the water's mirror must NOT draw
   * (`reflection.ts`): the dome, because the sea reflects the sky as a
   * function and blurred, and the rain, which is in the air over the
   * water rather than standing on the shore. */
  unmirrored: readonly THREE.Object3D[];
  dispose: () => void;
};

export function createEnvironment(scene: THREE.Scene): Environment {
  const uniforms = createSkyUniforms();
  const dome: SkyDome = createSkyDome(uniforms);
  scene.add(dome.mesh);
  const rain: Rain = createRain();
  scene.add(rain.lines);

  // ── The air ──────────────────────────────────────────────────────────────
  const background = new THREE.Color(0xffffff);
  scene.background = background;
  const fog = new THREE.Fog(0xffffff, 140, 560);
  scene.fog = fog;

  // ── The lights ───────────────────────────────────────────────────────────
  // Two, and no more of the sky's: a hemisphere for the skylight and the
  // bounce off the water, and one directional for the key — the sun by day,
  // the moon by night. Everything on this coast is flat-shaded — Lambert on
  // the shore, Phong on the craft, and the water and the craft reflect the
  // dome itself for the rest — so a third sky light buys nothing a
  // hemisphere colour cannot say more cheaply. The one other light in the
  // scene is the craft's own headlamp (`craft-lamps.ts`), a spotlight the
  // rider carries into the dark.
  const hemi = new THREE.HemisphereLight(0xffffff, 0x7f9aa3, 2.3);
  const key = new THREE.DirectionalLight(0xfff2dc, 1.3);
  scene.add(hemi, key);

  // The sky before a level has been handed over: a clear taiga noon. The
  // renderer stands the scene up before it has a state to draw, and a scene
  // whose lights are still black for one frame flashes.
  let preset: Preset = skyAt(12, TAIGA_LATITUDE, "clear", 0.3);
  let dressing: SkyDressing = { layers: [] };
  let look: SkyLook = SKY_LOOK.medium;
  let level: Level | null = null;
  let latitude = TAIGA_LATITUDE;
  /** The level's mean wind as a VELOCITY, m/s — which way the air is going,
   * not where it came from. The sheets ride this; the rain rides the live
   * gust on top of it. */
  const wind = { x: 0, z: 0 };
  /** What the key light is before anything comes over the sun. */
  let keyFull = 1;
  let fogNear = 140;
  let fogFar = 560;
  /** What the DISTANCE row makes of that range (`DISTANCE_LOOK.haze`). */
  let haze = 1;
  let standingFall = 0;
  let fall = 0;
  const sunDir = new THREE.Vector3(0, 1, 0);
  const keyDir = new THREE.Vector3(0, 1, 0);
  const rainTone = new THREE.Color();

  /** THE FOG AS IT STANDS: the sky's own range, pulled in by the DISTANCE row
   * and again by whatever is falling. One function because the three are
   * multiplied together and any of them can move on its own — a row pressed
   * mid-run, a squall thickening, a new level — and a fog set from two places
   * is a fog that keeps whichever was set last. */
  const setFog = (): void => {
    const wet = standingFall > 0 ? precipReach(fall) : 1;
    fog.near = fogNear * haze * wet;
    fog.far = fogFar * haze * wet;
  };

  const apply = (p: Preset): void => {
    preset = p;
    hemi.color.set(p.hemiSky);
    hemi.groundColor.set(p.hemiGround);
    // Under a lid the skylight is what there IS: the deck scatters the beam
    // rather than only taking it away.
    hemi.intensity = p.hemiIntensity * (p.deck ? DECK_SKYLIGHT : 1);
    key.color.set(p.sun);
    // …and what is left of the key is its own strength times how much of it
    // still arrives as a BEAM. Never all the way to nothing: under a squall
    // the key is the only thing giving the water and the hull a lit side at
    // all, and a scene lit by a hemisphere alone has no form in it.
    keyFull = p.sunIntensity * (0.25 + 0.75 * p.beam);
    key.intensity = keyFull;
    const v = sunVector(p.sunElevation, p.sunAzimuth);
    key.position.set(v.x, v.y, v.z).multiplyScalar(KEY_DISTANCE);
    keyDir.set(v.x, v.y, v.z).normalize();
    // The REAL sun, which is on the horizon at the lowest a level is ridden
    // at: a cloud two kilometres up is still in full sun after the water has
    // lost it, so anything at altitude reads this rather than the key.
    const s = sunVector(p.sunUp, p.sunBearing);
    sunDir.set(s.x, s.y, s.z).normalize();

    fogNear = p.fogNear;
    fogFar = p.fogFar;
    fog.color.set(p.fog);
    setFog();
    // The canvas is cleared to the ZENITH rather than to the fog: the fog is
    // what the far water fades into and the background is what shows where
    // there is no geometry at all, which above the dome's rim is sky.
    background.set(p.zenith);

    dome.apply(p);
    dome.setLit(litFor);
    dome.setSun(sunDir, keyDir, p.beam);
    // A DROP IS A LENS, NOT A LIGHT. Against a rain deck — the brightest
    // thing in the frame — a streak is DARKER than the sky behind it; only
    // against a squall's black ceiling does it read pale. Taking the tone
    // from the cloud's own shaded side is what gets that right for both
    // without a special case.
    rainTone.set(highLightFor(p, 0.35));
    rain.setTone(rainTone);
  };

  /** How much daylight a sheet at its own altitude is standing in. The sun
   * sets on the water first, so the cirrus burns after the cumulus under it
   * has gone grey — which is the whole of what a sunset sky is made of. */
  const litFor = (layer: { altitude: number }): number => litAt(layer.altitude, preset.sunUp);

  /** The sky as it stands at run time `t` on this level. Every frame. */
  const follow = (lvl: Level, t: number): void => {
    apply(skyFor(lvl, latitude, t));
  };

  const load = (next: Level): void => {
    level = next;
    latitude = biomeOf(next.biome).latitude;
    const speed = next.wind.speed;
    wind.x = -Math.sin(next.wind.from) * speed;
    wind.z = -Math.cos(next.wind.from) * speed;
    // The stack is dressed for the sky the level was DEALT under: its deck's
    // base is a fact about the weather and does not move with the hour.
    const dealt = skyFor(next, latitude, 0);
    const cover = skyCover(speed);
    dressing = dressSky(next, next.weather, cover, dealt.deck ? dealt.deck.base : null);
    dome.dress(dressing, look);
    follow(next, 0);
    standingFall = fallOf(next.weather, cover);
    fall = standingFall;
    setFog();
  };

  const setLook = (levelName: SkyLevel): void => {
    look = SKY_LOOK[levelName];
    dome.dress(dressing, look);
    dome.setLit(litFor);
  };

  const update = (state: GameState, eye: THREE.Vector3, dt: number): void => {
    if (state.level !== level) load(state.level);
    // WHERE THE SUN HAS GOT TO. The whole preset, every frame, off the
    // run's own clock — and the sphere of stars turned to the same hour.
    follow(state.level, state.t);
    dome.setTurn(skyTurnAt(sunHourAt(state.level, state.t), state.level.season, latitude), dt);
    dome.update(eye.x, eye.y, eye.z);
    dome.tick(wind.x, wind.z, dt);

    // WHAT IS IN FRONT OF THE KEY, this frame, at the craft — the sun by
    // day, the moon by night. The same field the sky is drawn from, read on
    // the CPU along the ray to the light — so the cloud the rider can see
    // over it is the cloud the light answers to. Sampled at ONE point rather
    // than per pixel, which is what keeps the sea, the hull and the shore
    // under one light: a sea in shadow beside a craft in full sun is worse
    // than no shadow at all.
    let shade = 0;
    const drift = dome.wind();
    for (const { layer, offsetX, offsetZ } of dome.layers()) {
      if (layer.deck) continue;
      shade = Math.max(
        shade,
        sunOcclusion(
          layer,
          state.craft.x,
          state.craft.y,
          state.craft.z,
          keyDir,
          offsetX,
          offsetZ,
          drift.x,
          drift.z,
          look.octaves,
        ),
      );
    }
    key.intensity = keyFull * (1 - CLOUD_DIM * shade);
    dome.setSun(sunDir, keyDir, preset.beam * (1 - shade));

    // THE RAIN, and how far the view runs through it. A squall IS a gust, so
    // the sheet thickens exactly as the hull is shoved sideways — for free,
    // and in step.
    if (standingFall > 0) {
      fall = standingFall * (0.55 + 0.45 * squallOf(state.wind.gust));
      setFog();
      rain.setIntensity(fall);
      // The drops hang in the air the sea owns: the live wind carries them,
      // and the camera's own travel is taken back out inside `rain.update`.
      const live = state.wind.meanSpeed * state.wind.gust;
      const from = state.wind.meanFrom + state.wind.veer;
      rain.update(eye.x, eye.y, eye.z, -Math.sin(from) * live, -Math.cos(from) * live, dt);
    }
  };

  return {
    load,
    update,
    setLook,
    setHaze: (next) => {
      haze = next;
      setFog();
    },
    preset: () => preset,
    uniforms,
    cloudLayers: () => dome.layers().length,
    unmirrored: [dome.mesh, rain.lines],
    rainfall: () => (standingFall > 0 ? fall : 0),
    hemi,
    key,
    dispose: () => {
      dome.dispose();
      rain.dispose();
    },
  };
}
