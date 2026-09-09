// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ATMOSPHERE — the sky a level is ridden under, built out of the colours
// `sky.ts` works out for its hour and its weather (R19). The target look is
// Wave Race 64's chunky saturated water sitting inside a modern northern
// air: a sky whose horizon glows around the sun, coloured distance fog, a
// sun or moon with a soft halo, cumulus riding the wind — and, under
// weather, a real ceiling with the daylight coming in under its rim.
//
// This module owns everything about the scene that is AIR: the two lights,
// the fog, the background, the dome and the clouds. It reads `GameState` and
// never writes it, and it hands out what other things need to answer to the
// same sky — the preset the water reflects, and the two lights it is lit by.
//
// THE SUN DOES NOT MOVE during a run. A run is ninety seconds; the sun
// climbs a third of a degree in that time, which is less than the ladder's
// smallest step. So the preset is built ONCE per level, and the only things
// that move per frame are the clouds riding the wind and the shells
// following the lens. That is also what makes the whole sky affordable on a
// phone: repainting the dome's 600 vertices and the ceiling's 800 is a
// once-per-level cost, not a per-frame one.
//
// Neighbours own the parts that are their own craft: `sky.ts` decides what
// colour everything is, `sky-dome.ts` draws the shells, `clouds.ts` the ring
// and the ceiling, and `water-mesh.ts` (through `water-shader.ts`) puts the
// sky's own gradient back on the water, wave face by wave face.

import * as THREE from "three";
import { biomeOf, type GameState, type Level } from "@engine";

import { createClouds, type Clouds } from "./clouds.ts";
import { createSkyDome, type SkyDome } from "./sky-dome.ts";
import { skyAt, skyFor, sunVector, type Preset } from "./sky.ts";

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

/** The coast the opening sky stands over until a level says otherwise. */
const TAIGA_LATITUDE = biomeOf("taiga").latitude;

export type Environment = {
  /** Build the sky for a level. Everything is repainted here and almost
   * nothing per frame. */
  load: (level: Level) => void;
  /** Follow the lens and ride the wind. `dt` is the frame's wall time, s. */
  update: (state: GameState, camera: THREE.Camera, eye: THREE.Vector3, dt: number) => void;
  /** The sky as it stands — for anything that has to answer to it. */
  preset: () => Preset;
  /** THE TWO LIGHTS, as set for that sky. The water's shader lights itself
   * from these rather than from the preset, so what the sea is lit by is
   * exactly what the hull beside it is lit by — the deck's skylight and
   * the beam's share of the key are decided once, here. */
  hemi: THREE.HemisphereLight;
  key: THREE.DirectionalLight;
  dispose: () => void;
};

export function createEnvironment(scene: THREE.Scene): Environment {
  // ── The shells ───────────────────────────────────────────────────────────
  // THE EYE'S OWN SKY: the dome, the disc and the halo follow the camera in
  // all three axes. The clouds follow it in x and z only, because
  // a cloud is a thing at an ALTITUDE — a hull thrown four metres up should
  // rise a little toward the ceiling, and under a squall whose base is at
  // 110 m that is a difference the rider can see.
  const dome: SkyDome = createSkyDome();
  scene.add(dome.group);
  const clouds: Clouds = createClouds();
  const air = new THREE.Group();
  air.add(clouds.group);
  scene.add(air);

  // ── The air ──────────────────────────────────────────────────────────────
  const background = new THREE.Color(0xffffff);
  scene.background = background;
  const fog = new THREE.Fog(0xffffff, 140, 560);
  scene.fog = fog;

  // ── The lights ───────────────────────────────────────────────────────────
  // Two, and no more: a hemisphere for the skylight and the bounce off the
  // water, and one directional for the key. Everything on this coast is
  // flat-shaded Lambert, so a third light buys nothing a hemisphere colour
  // cannot say more cheaply.
  const hemi = new THREE.HemisphereLight(0xffffff, 0x7f9aa3, 2.3);
  const key = new THREE.DirectionalLight(0xfff2dc, 1.3);
  scene.add(hemi, key);

  // The sky before a level has been handed over: a clear taiga noon. The
  // renderer stands the scene up before it has a state to draw, and a scene
  // whose lights are still black for one frame flashes.
  let preset: Preset = skyAt(12, TAIGA_LATITUDE, "clear", 0.3);
  let windSpeed = 0;
  let level: Level | null = null;

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
    key.intensity = p.sunIntensity * (0.25 + 0.75 * p.beam);
    const v = sunVector(p.sunElevation, p.sunAzimuth);
    key.position.set(v.x, v.y, v.z).multiplyScalar(KEY_DISTANCE);

    fog.color.set(p.fog);
    fog.near = p.fogNear;
    fog.far = p.fogFar;
    // The canvas is cleared to the ZENITH rather than to the fog: the fog is
    // what the far water fades into and the background is what shows where
    // there is no geometry at all, which above the dome's rim is sky.
    background.set(p.zenith);

    dome.apply(p);
    clouds.apply(p);
  };

  const load = (next: Level): void => {
    level = next;
    windSpeed = next.wind.speed;
    apply(skyFor(next, biomeOf(next.biome).latitude));
  };

  const update = (state: GameState, camera: THREE.Camera, eye: THREE.Vector3, dt: number): void => {
    if (state.level !== level) load(state.level);
    dome.update(eye.x, eye.y, eye.z);
    air.position.set(eye.x, 0, eye.z);
    clouds.update(windSpeed, dt, camera, air.position);
  };

  return {
    load,
    update,
    preset: () => preset,
    hemi,
    key,
    dispose: () => {
      dome.dispose();
      clouds.dispose();
    },
  };
}
