// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A MODELLED RIDER POSED AS THE GAME POSES ITS OWN. The game's rider has no
// clips: `poseRider` puts every joint in the craft's body frame off the
// cockpit and the engine's readings, and `rider.ts` lays each piece of him
// along a span between two joints (`figureParts`, each naming the bone it
// rides). A rider made by `make blender KIND=rider` is one skinned figure
// whose BONES are those spans, so the same pose drives it:
//
//   riderBones(pose)   every bone's frame for a pose — its head on a joint,
//                      its +y along the span, its axes the very ones the
//                      builder lofts that span's pieces in (the segment's
//                      `hint` squared off its axis), so a piece of the
//                      model rides its bone exactly as the builder's piece
//                      is laid. Three-free: the Blender driver binds the
//                      model in the riding pose off it and samples every
//                      clip through it.
//   RIDING             the craft and the reading the model is bound in: on
//                      the skiff, on the throttle, the bars straight.
//   riderClips()       the clips a model carries, each SAMPLED off the
//                      game's own `poseRider` over a program of readings —
//                      the ride, a hang each way, the lean, the tuck, the
//                      stand, a flight and its landing, the haul — so a
//                      clip is the game's pose played, not another one.
//   rigRider(root)     a loaded model's bones set to `riderBones(pose)`.
//
// The frame is the craft's body frame (x right, y up, z forward, the origin
// at the centre of gravity), which the model is exported in: the game's
// figure and the model stand in one place.

import * as THREE from "three";

import type { Cockpit } from "./craft-body.ts";
import {
  BODY,
  add,
  REST_READ,
  cross,
  dot,
  length,
  normalize,
  poseRider,
  scale,
  sub,
  type P,
  type RiderPose,
  type RiderRead,
} from "./rider-pose.ts";

export const RIDER_BONES = [
  "pelvis",
  "spine",
  "head",
  "thigh_l",
  "shin_l",
  "boot_l",
  "thigh_r",
  "shin_r",
  "boot_r",
  "upperarm_l",
  "forearm_l",
  "hand_l",
  "upperarm_r",
  "forearm_r",
  "hand_r",
] as const;
export type RiderBone = (typeof RIDER_BONES)[number];

/** A bone's frame: its head, its axes (right-handed, x = y × z) and length. */
export type BoneFrame = { head: P; x: P; y: P; z: P; length: number };

/** A frame along `axis` from `head`, squared off it the way `rider.ts`'s
 * `segment` squares its hint: `u` the hint off the axis, `v` = axis × u. */
function frameOf(head: P, axis: P, hint: P, len: number): BoneFrame {
  const y = normalize(axis);
  let u = sub(hint, scale(y, dot(hint, y)));
  if (length(u) < 1e-6) {
    const seed: P = Math.abs(y[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    u = sub(seed, scale(y, dot(seed, y)));
  }
  u = normalize(u);
  return { head, x: scale(u, -1), y, z: cross(y, u), length: len };
}

/** Where a limb's middle joint points out of the line its two ends make —
 * the way a knee or an elbow sticks out — leaning on `bias` so a limb held
 * straight keeps a roll rather than flipping to whatever the seed says. */
function bend(root: P, mid: P, tip: P, bias: P): P {
  const out = sub(mid, scale(add(root, tip), 0.5));
  return add(out, scale(bias, 0.02));
}

/** EVERY BONE'S FRAME FOR A POSE — the spans `figureParts` lays the
 * figure's pieces along. A limb's bones are ROLLED TO ITS BEND: their +z
 * faces where its middle joint points (a knee's front, an elbow's point),
 * so the two bones of a limb turn together and a bent knee never twists
 * the skin between them. */
export function riderBones(p: RiderPose): Record<RiderBone, BoneFrame> {
  const out = {
    pelvis: frameOf(p.pelvis, p.pelvisUp, p.torsoRight, 0.15),
    spine: frameOf(p.pelvis, p.torsoUp, p.torsoRight, BODY.torso + BODY.neck),
    head: frameOf(p.neck, p.headUp, p.headRight, BODY.helmet),
  } as Record<RiderBone, BoneFrame>;
  ([-1, 1] as const).forEach((side, i) => {
    const s = i === 0 ? "l" : "r";
    const knee = bend(p.hips[i], p.knees[i], p.ankles[i], [0, 0.3, 1]);
    const elbow = bend(p.shoulders[i], p.elbows[i], p.wrists[i], [side, -0.5, -0.3]);
    // `frameOf` squares its hint off the axis and turns it a quarter round
    // (z = y × u): the hint that puts +z on the bend is the bend × y.
    const rolled = (axis: P, toward: P): P => cross(toward, normalize(axis));
    const thigh = sub(p.knees[i], p.hips[i]);
    const shin = sub(p.ankles[i], p.knees[i]);
    const upper = sub(p.elbows[i], p.shoulders[i]);
    const fore = sub(p.wrists[i], p.elbows[i]);
    out[`thigh_${s}`] = frameOf(p.hips[i], thigh, rolled(thigh, knee), BODY.thigh);
    out[`shin_${s}`] = frameOf(p.knees[i], shin, rolled(shin, knee), BODY.shin);
    out[`boot_${s}`] = frameOf(p.ankles[i], [0, 0, 1], [side, 0, 0], BODY.foot);
    out[`upperarm_${s}`] = frameOf(p.shoulders[i], upper, rolled(upper, elbow), BODY.upperArm);
    out[`forearm_${s}`] = frameOf(p.elbows[i], fore, rolled(fore, elbow), BODY.forearm - BODY.fist);
    out[`hand_${s}`] = frameOf(p.hands[i], p.bars[i], sub(p.wrists[i], p.hands[i]), 0.1);
  });
  return out;
}

/** The craft and the reading the model is bound in: sat on the skiff with
 * the throttle half open — the limbs mid-range, so every other pose is a
 * short bend from this one. */
export const RIDING: { craft: "skiff"; read: RiderRead } = {
  craft: "skiff",
  read: { ...REST_READ, throttle: 0.5, pace: 0.5 },
};

const ease = (u: number): number => {
  const k = Math.max(0, Math.min(1, u));
  return k * k * (3 - 2 * k);
};
/** In over `a..b` s, out over `c..d` s. */
const held = (t: number, a: number, b: number, c: number, d: number): number =>
  ease((t - a) / (b - a)) * (1 - ease((t - c) / (d - c)));

/** THE CLIPS' PROGRAMS: seconds, and the reading at `t` over the bind's. */
const PROGRAMS: { name: string; seconds: number; at: (t: number) => Partial<RiderRead> }[] = [
  {
    name: "ride",
    seconds: 2,
    at: (t) => ({
      bob: 0.04 * Math.sin(2 * Math.PI * 1.5 * t),
      crush: 0.025 * Math.sin(2 * Math.PI * 3 * t),
    }),
  },
  {
    name: "turn",
    seconds: 3,
    at: (t) => ({
      right: 0.3 * Math.sin((2 * Math.PI * t) / 3),
      sway: 0.1 * Math.sin((2 * Math.PI * t) / 3),
    }),
  },
  { name: "lean", seconds: 2, at: (t) => ({ aft: 0.3 * Math.sin(Math.PI * t) }) },
  { name: "tuck", seconds: 2, at: (t) => ({ tuck: held(t, 0.1, 0.6, 1.3, 1.9) }) },
  { name: "stand", seconds: 2.4, at: (t) => ({ stand: held(t, 0.1, 0.8, 1.6, 2.3) }) },
  {
    name: "air",
    seconds: 2,
    at: (t) =>
      t < 0.3
        ? {}
        : t < 1.2
          ? { airborne: true, crush: -0.05 * held(t, 0.3, 0.5, 1, 1.2) }
          : { crush: 0.09 * Math.exp(-5 * (t - 1.2)) * Math.cos(9 * (t - 1.2)) },
  },
  {
    name: "haul",
    seconds: 3,
    at: (t) => ({
      haul: held(t, 0.2, 0.8, 2.2, 2.9),
      haulSide: 1,
      haulPull: Math.sin(2 * Math.PI * 1.2 * t),
    }),
  },
];

/** Every clip's poses, `fps` a second, off the game's own pose on
 * `cockpit` (the bind's craft — `RIDING`). */
export function riderClips(
  cockpit: Cockpit,
  fps = 30,
): { name: string; seconds: number; poses: RiderPose[] }[] {
  return PROGRAMS.map(({ name, seconds, at }) => {
    const poses: RiderPose[] = [];
    for (let f = 0; f <= Math.round(seconds * fps); f++) {
      poses.push(poseRider(cockpit, { ...RIDING.read, ...at(f / fps) }));
    }
    return { name, seconds, poses };
  });
}

export type RiderRig = {
  pose(p: RiderPose): void;
  play(name: string, t: number): void;
  clips: string[];
  /** A clip's length, s. */
  seconds(name: string): number;
};

/** A loaded model's bones set to the game's pose, or its clips played.
 * `root` stands in the craft's body frame (the loader's turn under it). */
export function rigRider(root: THREE.Object3D, animations: THREE.AnimationClip[]): RiderRig {
  const bones = new Map<string, THREE.Object3D>();
  root.traverse((o) => {
    if ((RIDER_BONES as readonly string[]).includes(o.name)) bones.set(o.name, o);
  });
  const mixer = new THREE.AnimationMixer(root);
  const m = new THREE.Matrix4();
  const parentInv = new THREE.Matrix4();
  const x = new THREE.Vector3();
  const y = new THREE.Vector3();
  const z = new THREE.Vector3();
  return {
    clips: animations.map((c) => c.name),
    seconds: (name) => animations.find((c) => c.name === name)?.duration ?? 0,
    pose(p) {
      mixer.stopAllAction();
      root.updateMatrixWorld(true);
      const frames = riderBones(p);
      // Parents before children (the list's order): each bone's world
      // matrix is set, then taken back into its parent's frame.
      for (const name of RIDER_BONES) {
        const node = bones.get(name);
        if (!node?.parent) continue;
        const f = frames[name];
        m.makeBasis(x.fromArray(f.x), y.fromArray(f.y), z.fromArray(f.z)).setPosition(
          f.head[0],
          f.head[1],
          f.head[2],
        );
        m.premultiply(root.matrixWorld);
        parentInv.copy(node.parent.matrixWorld).invert();
        m.premultiply(parentInv).decompose(node.position, node.quaternion, node.scale);
        node.updateMatrixWorld(true);
      }
    },
    play(name, t) {
      mixer.stopAllAction();
      const clip = animations.find((c) => c.name === name);
      if (!clip) return;
      const action = mixer.clipAction(clip).reset();
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.play();
      mixer.setTime(t);
      root.updateMatrixWorld(true);
    },
  };
}
