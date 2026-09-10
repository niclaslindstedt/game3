// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R31 — THE ROUNDING BUOYS, DRAWN: the moored steel cans a circuit's lap is
// ridden round, and the lamps that make them findable in the dark.
//
// A rounding buoy is not a gate buoy grown large. A gate's pair are little
// floats marking a line to cross; these are the CORNERS of the race — the
// thing the line bends around, standing out in open water where there is
// nothing else to steer by — and they are built the way the real ones on an
// exposed coast are: a steel can two or three metres across riding the
// swell on its mooring, a black band round its waist, a lattice tower over
// it and the lantern at the top of that, four metres up so a sea does not
// hide it.
//
// THE LIGHT IS THE POINT. `buoyLightAt` (engine/game/buoy.ts) is the
// character the generator drew — one flash, or a group of two, three or
// four, every few seconds — as a pure function of the level's clock, and
// this reads it once per buoy per frame and does nothing else with it. Two
// things are drawn from it: the LENS, which is what the light looks like
// from close in, and a BLOOM, which is what it looks like from half a
// kilometre out, where the lens is a fraction of a pixel and the only
// honest way to draw a light is as glare. The bloom grows with range for
// exactly that reason — a lamp at the horizon does not shrink out of sight,
// it stays a point and gets dimmer — and both are scaled by the sky's own
// lamp switch (`Preset.lamps`), so a buoy winks in daylight and blazes at
// dusk, through the night, and into the dawn.

import * as THREE from "three";
import { buoyLightAt, surfaceAt, type GameState, type Level, type Solid } from "@engine";

import { glowTexture } from "./fx-textures.ts";

/** The can: how far it stands out of the water and how far under, m. A can
 * drawn to the waterline reads as a disc painted on the sea, and the draft
 * is what the eye reads as something MOORED when a wave lifts past it. */
const CAN = { over: 1.15, under: 0.95 };
/** The black band round its waist, m of height and where it sits. Every
 * lateral mark on a real coast carries one, and it is what stops a yellow
 * cylinder reading as a floating drum. */
const BAND = { height: 0.36, at: 0.34 };
/** The lattice tower: how far in the four legs lean by the top, and how
 * thick they are, m. */
const CAGE = { waist: 0.42, leg: 0.11 };
/** The lantern at the top, m. */
const LAMP = { radius: 0.26, height: 0.44 };

/** The paint: a buoy is YELLOW because a yellow buoy is the one thing on a
 * grey sea a rider finds without looking for it, and the band and the
 * tower are what make it read as steel rather than as a float. */
const HULL = 0xf0b323;
const STRIPE = 0x1c1a17;
const TOWER = 0x9aa2a6;
/** The lens, unlit and lit. A lamp's glass is dark amber with nothing
 * behind it and very nearly white with the lamp on: a lens drawn at its own
 * colour when lit reads as a painted dot. */
const GLASS = 0x6b4a12;
const LENS = 0xfff0c4;

/** How big the bloom is at arm's length and how fast it grows with range,
 * m per m, and the two ends it is clamped between. A light is glare rather
 * than a shape, and glare on the eye is a roughly constant ANGLE — so the
 * sprite grows with distance, which is what keeps a buoy 500 m out a thing
 * the rider can steer at rather than a pixel that flickers in and out. */
const BLOOM = { grow: 0.03, min: 3.4, max: 18 };

/** How much of the lamp survives DAYLIGHT, 0..1. A lit buoy in sunshine is
 * a wink of glass, not a beacon — but it is not nothing, and a rounding
 * mark that only exists after dark is a mark that reads as unlit furniture
 * on every day run. */
const BY_DAY = 0.22;

/** What the lamp is worth BETWEEN its flashes, 0..1 of full.
 *
 * A flash character is mostly darkness — one flash of half a second in five
 * is the commonest of them — and a buoy drawn to it exactly is invisible
 * nine frames in ten, which at forty km/h in the dark is a corner that is
 * not there until it is. A real one is not invisible either: the lantern's
 * glass holds the last of the flash and the band round the can is
 * retroreflective, so it sits in the dark as a dull point and then punches
 * out on the beat. This is that dull point, and the BLOOM is left to the
 * flash alone — the glare is the thing that says "now", and a glare that
 * never goes out says nothing. */
const BETWEEN = 0.16;

/** R31 — one lantern as the WATER wants it: where it is this frame and what
 * it is worth, 0..1. `applyBuoyLamps` turns these into the pools on the
 * sea. */
export type BuoyLamp = { x: number; y: number; z: number; lit: number };

export type Buoys = {
  group: THREE.Group;
  /** The lanterns, in the order the water reads them — refreshed by
   * `update`, so the caller hands them straight on. */
  lamps: readonly BuoyLamp[];
  /** Bob them on this frame's sea and flash their lamps. The camera is
   * wanted for the bloom alone, which is sized by how far off it is. */
  update: (state: GameState, camera: THREE.Object3D) => void;
  /** How lit the lamps are by the sky's say (`Preset.lamps`) — the same
   * switch the craft's own headlamp and the gate buoys' caps answer to. */
  setNight: (lit: number) => void;
};

type Lit = {
  readonly solid: Solid;
  readonly water: BuoyLamp;
  readonly group: THREE.Group;
  /** The can's own paint: it catches the lantern over it when the lamp
   * fires, which is what stops a flash reading as a light floating free of
   * anything. */
  readonly paint: THREE.MeshLambertMaterial;
  readonly lens: THREE.MeshBasicMaterial;
  readonly glow: THREE.SpriteMaterial;
  readonly bloom: THREE.Sprite;
  readonly lamp: THREE.Vector3;
};

const sample = { height: 0, nx: 0, ny: 1, nz: 0, vx: 0, vy: 0, vz: 0 };
const up = new THREE.Vector3();
const world = new THREE.Vector3();
const Y = new THREE.Vector3(0, 1, 0);
const lensColour = new THREE.Color();
const dark = new THREE.Color(GLASS);
const bright = new THREE.Color(LENS);
/** What the flash puts back into the can's own paint. */
const GLOW = new THREE.Color(0x4a3410);

function flat(colour: number): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color: colour, flatShading: true });
}

/** One buoy, built about its own waterline: y = 0 is the sea, so the whole
 * thing is simply lifted onto the wave under it every frame. */
function build(solid: Solid): Lit {
  const group = new THREE.Group();
  group.position.set(solid.x, 0, solid.z);
  const r = solid.r;

  const paint = flat(HULL);
  const can = new THREE.Mesh(
    new THREE.CylinderGeometry(r * 0.94, r, CAN.over + CAN.under, 12, 1),
    paint,
  );
  can.position.y = (CAN.over - CAN.under) / 2;
  group.add(can);

  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(r * 1.03, r * 1.03, BAND.height, 12, 1),
    flat(STRIPE),
  );
  band.position.y = BAND.at;
  group.add(band);

  // The shoulder the tower stands on.
  const shoulder = new THREE.Mesh(
    new THREE.CylinderGeometry(r * 0.6, r * 0.94, 0.34, 12, 1),
    paint,
  );
  shoulder.position.y = CAN.over + 0.17;
  group.add(shoulder);

  // The tower: four legs leaning in to the lantern's platform, and a hoop
  // round their waist. Drawn as boxes rather than cylinders because a
  // lattice is angle iron and because four thin cylinders at this range are
  // four times the triangles for the same silhouette.
  const foot = CAN.over + 0.3;
  const head = solid.top - LAMP.height / 2 - 0.12;
  const legLength = Math.hypot(head - foot, r * 0.55 - CAGE.waist * 0.5);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const leg = new THREE.Mesh(new THREE.BoxGeometry(CAGE.leg, legLength, CAGE.leg), flat(TOWER));
    const outFoot = r * 0.55;
    const outHead = CAGE.waist * 0.5;
    leg.position.set(
      (Math.cos(a) * (outFoot + outHead)) / 2,
      (foot + head) / 2,
      (Math.sin(a) * (outFoot + outHead)) / 2,
    );
    // Leaned in by the angle the two ends make: the lean is about the axis
    // across the leg's own radius, which is the tangent at its bearing.
    const lean = Math.atan2(outFoot - outHead, head - foot);
    leg.rotation.set(Math.sin(a) * lean, 0, -Math.cos(a) * lean);
    group.add(leg);
  }
  const hoop = new THREE.Mesh(
    new THREE.TorusGeometry((r * 0.55 + CAGE.waist * 0.5) / 2, 0.05, 4, 12),
    flat(TOWER),
  );
  hoop.rotation.x = Math.PI / 2;
  hoop.position.y = (foot + head) / 2;
  group.add(hoop);

  // The lantern, and the little cage over it that every real one carries.
  const lens = new THREE.MeshBasicMaterial({ color: GLASS });
  const lamp = new THREE.Mesh(
    new THREE.CylinderGeometry(LAMP.radius, LAMP.radius, LAMP.height, 10, 1),
    lens,
  );
  lamp.position.y = solid.top;
  group.add(lamp);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(LAMP.radius * 1.25, 0.3, 10), flat(TOWER));
  cap.position.y = solid.top + LAMP.height / 2 + 0.15;
  group.add(cap);

  // The bloom: additive, depth-tested but not depth-written, so it lies
  // over the sea and the tower without punching a hole in either.
  const glow = new THREE.SpriteMaterial({
    map: glowTexture(),
    color: LENS,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const bloom = new THREE.Sprite(glow);
  bloom.position.y = solid.top;
  group.add(bloom);

  return {
    solid,
    group,
    paint,
    lens,
    glow,
    bloom,
    lamp: new THREE.Vector3(solid.x, solid.top, solid.z),
    water: { x: solid.x, y: solid.top, z: solid.z, lit: 0 },
  };
}

export function createBuoys(level: Level): Buoys {
  const group = new THREE.Group();
  const buoys = level.solids.filter((s) => s.kind === "buoy").map(build);
  for (const b of buoys) group.add(b.group);
  let night = 0;

  const update = (state: GameState, camera: THREE.Object3D): void => {
    camera.getWorldPosition(world);
    for (const b of buoys) {
      const { x, z } = b.solid;
      surfaceAt(state.sea, state.level, x, z, state.t, sample);
      b.group.position.y = sample.height;
      // A buoy leans with the slope it sits on — half of it, because a
      // mooring chain rights what the wave tips, and a tower four metres
      // up magnifies whatever lean is left.
      up.set(sample.nx, sample.ny, sample.nz);
      b.group.quaternion.setFromUnitVectors(Y, up.lerp(Y, 0.5).normalize());

      // R31 — the character, and what the sky leaves of it. The lens
      // carries the standing glow and the flash together; the bloom is the
      // flash alone.
      const flash = buoyLightAt(b.solid.light, state.t);
      const sky = BY_DAY + (1 - BY_DAY) * night;
      const lit = (BETWEEN + (1 - BETWEEN) * flash) * sky;
      const glare = flash * night;
      b.lens.color.copy(lensColour.copy(dark).lerp(bright, lit));
      // The can under the lantern, lit by it: a lamp that throws a pool on
      // the sea and leaves the steel it stands on black reads as a light
      // painted on the night rather than as a buoy.
      b.paint.emissive.setRGB(GLOW.r * glare, GLOW.g * glare, GLOW.b * glare);
      b.glow.opacity = glare * 0.95;
      // What the SEA gets: the lantern where it is riding this wave, and
      // the flash it is throwing, with the standing glow under it so the
      // pool breathes rather than blinking out of existence.
      b.water.y = sample.height + b.solid.top;
      b.water.lit = lit;
      if (glare > 0) {
        b.lamp.set(x, sample.height + b.solid.top, z);
        const range = b.lamp.distanceTo(world);
        b.bloom.scale.setScalar(
          Math.min(BLOOM.max, Math.max(BLOOM.min, range * BLOOM.grow)) * (0.55 + 0.45 * glare),
        );
      }
    }
  };

  return {
    group,
    lamps: buoys.map((b) => b.water),
    update,
    setNight: (lit) => {
      night = lit;
    },
  };
}
