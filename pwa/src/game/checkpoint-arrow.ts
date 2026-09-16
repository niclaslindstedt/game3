// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MISSED CHECKPOINT'S ARROW — a small low-poly solid in camera space,
// occupying the transparent slot between the HUD's warning and its distance.
// The engine owns WHICH gate remains active; this module only turns the
// rendered camera's view of that world point into a screen bearing.

import * as THREE from "three";
import type { GameState } from "@engine";

import { PALETTE } from "../identity.ts";

/** How far in front of the camera the arrow rides, m. */
const DIST = 6;
/** Arrow length as a fraction of the frame's half-height. */
const SIZE = 0.075;
/** Fallback slot centre, 0 (top) .. 1 (bottom), before the HUD is measured. */
const SLOT = 0.34;
/** Lean into the screen, rad, so the head and shaft read as a solid. */
const TILT = 0.4;
/** Appearance and bearing easing, 1/s. */
const FADE = 6;
const SWING = 7;

export type CheckpointArrow = {
  /** Parent is the camera: every position below is expressed in view space. */
  group: THREE.Group;
  setShown: (shown: boolean) => void;
  update: (state: GameState, camera: THREE.PerspectiveCamera, dt: number) => void;
  dispose: () => void;
};

/** Build the arrow once. Its +z axis is its point, so one rotation aims the
 * head and shaft together at the checkpoint's bearing on the frame. */
export function createCheckpointArrow(canvas: HTMLCanvasElement): CheckpointArrow {
  const group = new THREE.Group();
  const headMaterial = new THREE.MeshBasicMaterial({
    color: PALETTE.hudBad,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
  });
  const shaftMaterial = headMaterial.clone();
  shaftMaterial.color.copy(headMaterial.color).multiplyScalar(0.72);

  const head = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.95, 6), headMaterial);
  head.rotation.x = Math.PI / 2;
  head.position.z = 0.85;
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 1.3), shaftMaterial);
  shaft.position.z = -0.3;
  group.add(head, shaft);
  group.renderOrder = 100;
  group.visible = false;

  const toGate = new THREE.Vector3();
  const cameraRotation = new THREE.Quaternion();
  let enabled = false;
  let shown = 0;
  let bearing = 0;
  let arrowSlot: Element | null = null;

  /** Read the DOM slot into `out`, in 0..1 canvas coordinates. The HUD and
   * canvas fill the same box, so this keeps the solid between its two labels
   * through portrait, landscape and safe-area changes without restating CSS. */
  const slotOnFrame = (out: THREE.Vector2): void => {
    if (!arrowSlot?.isConnected) arrowSlot = document.querySelector(".hud-missed-arrow-slot");
    const frame = canvas.getBoundingClientRect();
    if (!arrowSlot || frame.width <= 0 || frame.height <= 0) {
      out.set(0.5, SLOT);
      return;
    }
    const slot = arrowSlot.getBoundingClientRect();
    out.set(
      (slot.left + slot.width / 2 - frame.left) / frame.width,
      (slot.top + slot.height / 2 - frame.top) / frame.height,
    );
  };

  const screen = new THREE.Vector2(0.5, SLOT);
  const update = (state: GameState, camera: THREE.PerspectiveCamera, dt: number): void => {
    const index = state.progress.activeMissedGate;
    const gate = index === null ? undefined : state.level.course.gates[index];
    const want = enabled && gate ? 1 : 0;
    shown += (want - shown) * Math.min(1, FADE * dt);
    headMaterial.opacity = 0.94 * shown;
    shaftMaterial.opacity = 0.94 * shown;
    group.visible = shown > 0.01;
    if (!group.visible || !gate) {
      if (!group.visible) arrowSlot = null;
      return;
    }

    // Camera space is the one bearing that survives every rung of the camera
    // ladder: +x is screen-right and -z is straight ahead by construction.
    camera.getWorldQuaternion(cameraRotation);
    toGate
      .set(gate.x - state.craft.x, 0, gate.z - state.craft.z)
      .applyQuaternion(cameraRotation.invert());
    const target = Math.atan2(toGate.x, -toGate.z);
    let delta = (target - bearing) % (Math.PI * 2);
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    bearing += delta * Math.min(1, SWING * dt);

    slotOnFrame(screen);
    const halfHeight = DIST * Math.tan((camera.fov * Math.PI) / 360);
    const halfWidth = halfHeight * camera.aspect;
    group.position.set(halfWidth * (screen.x * 2 - 1), halfHeight * (1 - screen.y * 2), -DIST);
    group.scale.setScalar(halfHeight * SIZE * (0.75 + 0.25 * shown));

    // Up is dead ahead, down is behind, and either side is that side of the
    // frame. The extra pitch exposes the solid's top instead of a cut-out.
    group.rotation.set(-Math.PI / 2 - TILT, 0, -bearing, "ZXY");
  };

  return {
    group,
    setShown: (shown) => {
      enabled = shown;
    },
    update,
    dispose: () => {
      head.geometry.dispose();
      shaft.geometry.dispose();
      headMaterial.dispose();
      shaftMaterial.dispose();
    },
  };
}
