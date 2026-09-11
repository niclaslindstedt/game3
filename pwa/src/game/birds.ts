// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SEA BIRDS, DRAWN — the flocks and the crossings `bird-plan.ts` laid
// over the level, as three.js sees them: one instanced mesh a species,
// holding whatever of that species is within sight this frame, each bird
// posed off the engine's own clock and its wings hinged in the shader.
//
// The split is the app's usual one. `bird-defs.ts` says what a bird is,
// `bird-plan.ts` works out where every flock lives and where every bird is
// at a moment with no renderer in sight, `bird-shapes.ts` builds the one
// geometry a species is drawn from and the material that flaps it, and this
// file is the wiring: the meshes, the per-instance matrix and the two wing
// attributes, the cull, the sea under a raft, and the one thing here with
// MEMORY — when each flock was last put up by the craft.
//
// NOTHING IS ALLOCATED PER FRAME. A few hundred poses a frame are written
// into one scratch object and straight into the instance buffers, the way
// the sea life's are.

import * as THREE from "three";
import { surfaceAt, type GameState, type Level, type SurfaceSample } from "@engine";

import { BIRDS, type BirdId } from "./bird-defs.ts";
import {
  activityAt,
  birdPlanFor,
  birdPose,
  crossingCapacity,
  crossingPose,
  flushAt,
  forEachCrossing,
  freshBirdPose,
  residentCount,
  type BirdPlan,
} from "./bird-plan.ts";
import { BIRD_STYLES, birdMaterial, buildBird } from "./bird-shapes.ts";

/** How far from the LENS a flock is drawn at all, m, and how far a
 * crossing is: a gull is a speck at half a kilometre and nothing past it,
 * where a skein of fifteen at a hundred metres up is a shape from much
 * further off. Both inside the clearest sky's fog, so what is left out was
 * already in the haze. */
const FLOCK_REACH = 650;
const CROSSING_REACH = 1500;

type Roster = {
  mesh: THREE.InstancedMesh;
  flaps: THREE.InstancedBufferAttribute;
  folds: THREE.InstancedBufferAttribute;
  /** How many instances have been written this frame. */
  n: number;
};

export type Birds = {
  group: THREE.Group;
  /** See one engine STEP: whether the craft has come close enough to a
   * resting raft to put it up. On the step's cadence rather than the
   * frame's — the same door the wake and the spray read the craft through
   * — so a scene pre-rolled for a screenshot flushes the raft the craft
   * ran through three seconds ago, and a slow machine never skips the one
   * step the hull was inside the radius on. */
  observe: (state: GameState) => void;
  /** Put every bird within sight of (`eyeX`, `eyeZ`) where the plan says it
   * is at the state's clock. */
  update: (state: GameState, eyeX: number, eyeZ: number) => void;
  /** The plan itself, for anything that wants to know what is here. */
  plan: BirdPlan;
  dispose: () => void;
};

export function createBirds(level: Level): Birds {
  const group = new THREE.Group();
  const plan = birdPlanFor(level);
  const rosters = new Map<BirdId, Roster>();
  for (const spec of BIRDS) {
    const capacity = residentCount(plan, spec.id) + crossingCapacity(plan, spec.id);
    if (capacity === 0) continue;
    const geometry = buildBird(spec, BIRD_STYLES[spec.id]);
    const flaps = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
    flaps.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("aFlap", flaps);
    const folds = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
    folds.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("aFold", folds);
    const mesh = new THREE.InstancedMesh(geometry, birdMaterial(spec), capacity);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0;
    // The instances move every frame and the mesh has no fixed extent, so
    // there is nothing for three to cull it against; the reach test below
    // is the cull.
    mesh.frustumCulled = false;
    group.add(mesh);
    rosters.set(spec.id, { mesh, flaps, folds, n: 0 });
  }

  /** When each flock was last put up by the craft, on the engine's clock.
   * The renderer's memory, like the wake's: the craft's path decides it
   * and the craft's path is deterministic, so a replay flushes the same
   * raft at the same second. */
  const flushed = new Float64Array(plan.flocks.length).fill(-Infinity);

  const pose = freshBirdPose();
  const m = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);
  const sample: SurfaceSample = { height: 0, nx: 0, ny: 1, nz: 0, vx: 0, vy: 0, vz: 0 };

  const write = (roster: Roster): void => {
    if (roster.n >= roster.mesh.instanceMatrix.count) return;
    pos.set(pose.x, pose.y, pose.z);
    quat.set(pose.q.x, pose.q.y, pose.q.z, pose.q.w);
    m.compose(pos, quat, one);
    roster.mesh.setMatrixAt(roster.n, m);
    roster.flaps.setX(roster.n, pose.flap);
    roster.folds.setX(roster.n, pose.fold);
    roster.n++;
  };

  const observe = (state: GameState): void => {
    const t = state.t;
    const cx = state.craft.x;
    const cz = state.craft.z;
    plan.flocks.forEach((flock, f) => {
      flushed[f] = flushAt(flock, cx, cz, t, flushed[f]);
    });
  };

  const update = (state: GameState, eyeX: number, eyeZ: number): void => {
    for (const roster of rosters.values()) roster.n = 0;
    const t = state.t;
    const activity = activityAt(level, t);

    plan.flocks.forEach((flock, f) => {
      const roster = rosters.get(flock.species);
      if (!roster) return;
      // The whole beat, not the home: a flock wheeling just inside the
      // reach must not pop as it comes round.
      const far = Math.max(
        Math.hypot(flock.home.x - eyeX, flock.home.z - eyeZ),
        Math.hypot(flock.loop.x - eyeX, flock.loop.z - eyeZ) - flock.loop.radius,
      );
      if (far > FLOCK_REACH) return;
      // The sea under a raft, sampled once per flock: a raft is a few
      // metres across and the swell it rides is fifty.
      const waterY =
        flock.home.kind === "water"
          ? surfaceAt(state.sea, level, flock.home.x, flock.home.z, t, sample).height
          : 0;
      for (let i = 0; i < flock.count; i++) {
        birdPose(flock, i, t, pose, activity, waterY, flushed[f]);
        write(roster);
      }
    });

    forEachCrossing(plan, t, (crossing) => {
      const roster = rosters.get(crossing.species);
      if (!roster) return;
      crossingPose(level, crossing, 0, t, pose);
      if (Math.hypot(pose.x - eyeX, pose.z - eyeZ) > CROSSING_REACH) return;
      write(roster);
      for (let i = 1; i < crossing.count; i++) {
        crossingPose(level, crossing, i, t, pose);
        write(roster);
      }
    });

    for (const roster of rosters.values()) {
      roster.mesh.count = roster.n;
      roster.mesh.visible = roster.n > 0;
      if (roster.n === 0) continue;
      roster.mesh.instanceMatrix.needsUpdate = true;
      roster.flaps.needsUpdate = true;
      roster.folds.needsUpdate = true;
    }
  };

  return {
    group,
    observe,
    update,
    plan,
    dispose: () => {
      for (const roster of rosters.values()) {
        roster.mesh.geometry.dispose();
        (roster.mesh.material as THREE.Material).dispose();
      }
    },
  };
}
