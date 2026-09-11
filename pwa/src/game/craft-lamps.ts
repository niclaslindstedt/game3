// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CRAFT'S LAMPS — the one light the rider carries into the dark, and
// the two that say which way the hull is pointing. A personal watercraft
// ridden at night carries a headlamp on the hood that lays a pool of water
// ahead of the bow, and a red and a green sidelight at the rail the way
// every small boat does: red to port, green to starboard, so another hull
// can tell at a glance which way this one is going. The sky throws the
// switch (`Preset.lamps`, off `lampsAt`): on as the sun touches the water,
// full by civil twilight.
//
// THE HEADLAMP IS ONE SPOTLIGHT, and it is a child of the craft's group, so
// the hull's own quaternion aims it: pitched into a wave the beam goes into
// the water, thrown off a ramp it sweeps the sky. Three lights the hull, the
// rider, the buoys and the shore with it through their Lambert materials;
// the WATER is a shader of its own and reads the very same light
// (`applyLamp`, water-shader.ts), so the pool on the sea is the pool on
// the hull beside it. The lamp is hidden rather than dimmed by day: three
// compiles every lit material against however many lights are visible, so
// a run in daylight costs no beam at all, and the one recompile is paid
// at dusk.
//
// WHAT IT IS WORTH, in candela, is the whole feel of a night run. Too
// little and the sea is black past the nose and the rider steers by the
// buoys' own lights alone; too much and the near water is a white sheet
// with the wave shapes burnt out of it. The figure below lays a readable
// pool to a couple of boat lengths and a fading road to a few more, which
// is what a real machine's lamp does — and it is scaled by how dark it is,
// because a lamp on the water at sunset is a lamp nobody can see.

import * as THREE from "three";
import type { CraftSpec } from "@engine";

import { lampOf } from "./craft-body.ts";
import type { CraftStyle } from "./craft-styles.ts";
import { spriteTexture } from "./fx-textures.ts";

/** The headlamp at full: its strength, cd; its reach, m; the half-angle of
 * its cone, rad, and how soft the cone's edge is; and how far below level
 * it is aimed, rad — a beam aimed level lights the far horizon and nothing
 * under the bow, and a beam that grazes flat water lights almost nothing
 * whatever its strength, so the axis is put into the sea a few lengths
 * ahead. */
const HEAD = { light: 640, reach: 60, cone: 0.55, penumbra: 0.5, dip: 0.2 };

/** The lenses: the headlamp's warm white, and the sidelights' red and
 * green. Fullbright, because a lens is a light and not a lit thing. */
const LENS = 0xfff1cf;
const PORT = 0xff2a1e;
const STARBOARD = 0x2aff5e;

/** The bloom round a lit lens, m across, and how strong. A lamp seen
 * from in front is a blaze with no edge, and a lens drawn as a disc alone
 * reads as a painted-on decal. */
const BLOOM_SIZE = 0.9;
const BLOOM = 0.85;

export type CraftLamps = {
  /** Added under the craft's group by the caller. */
  group: THREE.Group;
  /** The headlamp itself — what the water's shader reads. */
  light: THREE.SpotLight;
  /** How lit the lamps are, 0..1 (the sky's switch), and how dark it is,
   * 0..1 (`1 - dayLight`), which is what the beam is worth on the water. */
  setLit: (lit: number, dark: number) => void;
  /** Whether the lens the frame is drawn from is one of the two bolted ONTO
   * the craft (`isEyeCamera`). The lamps' own hardware is hidden while it is
   * — it sits between that lens and the water — and the beam is not. */
  setAboard: (aboard: boolean) => void;
  dispose: () => void;
};

export function createCraftLamps(spec: CraftSpec, style: CraftStyle): CraftLamps {
  const group = new THREE.Group();
  const at = lampOf(spec, style);

  const light = new THREE.SpotLight(LENS, 0, HEAD.reach, HEAD.cone, HEAD.penumbra, 2);
  light.position.set(at.x, at.y, at.z);
  // The target is a child too, so the aim turns with the hull.
  light.target.position.set(at.x, at.y - Math.tan(HEAD.dip) * 20, at.z + 20);
  light.visible = false;
  group.add(light, light.target);

  const lensMaterial = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.05, 8), lensMaterial);
  lens.rotation.x = Math.PI / 2;
  lens.position.set(at.x, at.y, at.z);
  group.add(lens);

  const bloomMaterial = new THREE.SpriteMaterial({
    map: spriteTexture(),
    color: LENS,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const bloom = new THREE.Sprite(bloomMaterial);
  bloom.scale.setScalar(BLOOM_SIZE);
  bloom.position.set(at.x, at.y, at.z + 0.05);
  group.add(bloom);

  // WHICH RAIL IS WHICH, and why it is not the one the body frame reads.
  // Red is carried to port and green to starboard — defined from ON BOARD,
  // facing forward — so the only frame that can answer "which side is
  // starboard" here is the one the RIDER is looking along. The body frame is
  // not that frame: the engine's map axes (x east, z north, y up) draw
  // MIRRORED on screen, so from behind the craft — which is where both the
  // rider and every chase lens look from — body +x is on the viewer's LEFT.
  // `input-model.ts` states the same fact from the other end, and has to
  // flip the steer for it (`SCREEN_TO_ENGINE`): the engine's positive steer
  // grows the heading toward +x and reads as a turn to the LEFT.
  //
  // So the rider's starboard rail is body -x, and the lamp on it is green.
  // Everything else on the craft is symmetric and cannot show the mirror;
  // this pair is the one place in the game that can, which is why it is the
  // one place it has to be spelled out.
  const sides: { mesh: THREE.Mesh; material: THREE.MeshBasicMaterial; lit: number }[] = [];
  for (const { sign, lit } of [
    { sign: -1, lit: STARBOARD },
    { sign: 1, lit: PORT },
  ] as const) {
    const material = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), material);
    mesh.position.set(sign * at.side, at.y - 0.08, at.z - 0.15);
    group.add(mesh);
    sides.push({ mesh, material, lit });
  }
  const dim = new THREE.Color();

  let was = -1;
  const setLit = (lit: number, dark: number): void => {
    const on = lit > 0.01;
    if (on !== light.visible) light.visible = on;
    light.intensity = HEAD.light * lit * (0.2 + 0.8 * dark);
    if (Math.abs(lit - was) < 0.002) return;
    was = lit;
    // The lenses go from a dark glass to their own colour, and the bloom
    // comes up with them.
    lensMaterial.color.set(0x1a1a1a).lerp(dim.set(LENS), lit);
    for (const side of sides) side.material.color.set(0x111111).lerp(dim.set(side.lit), lit);
    bloomMaterial.opacity = BLOOM * lit;
  };

  // THE HARDWARE IS FOR SOMEBODY ELSE'S EYES. Every piece of it — the lens
  // in the hood, the bloom round it, the two rail lamps — is sized to be
  // read from off the craft, and the two rungs of the ladder that sit ON the
  // craft are all BEHIND it: the skiff's lamp stands half a metre in front
  // of the bow lens and a third of a metre in front of the sidelights, so a
  // 0.9 m bloom sprite becomes a flare across the frame and a 7 cm rail lamp
  // becomes a coloured slab in the corner. Nobody riding a machine sees
  // their own navigation lights, and hiding them costs the night nothing:
  // the BEAM is a separate object and stays lit, so the pool it lays on the
  // water — which is the whole of what the rider is steering by — is
  // untouched.
  let aboardWas = false;
  const setAboard = (aboard: boolean): void => {
    if (aboard === aboardWas) return;
    aboardWas = aboard;
    lens.visible = !aboard;
    bloom.visible = !aboard;
    for (const side of sides) side.mesh.visible = !aboard;
  };

  return {
    group,
    light,
    setLit,
    setAboard,
    dispose: () => {
      lens.geometry.dispose();
      lensMaterial.dispose();
      bloomMaterial.dispose();
      for (const side of sides) side.material.dispose();
      group.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
    },
  };
}
