// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// ONE OF THE GAME'S OWN BUTTONS, WHEREVER THE PRESS CAME FROM.
//
// Three things press these and there is one handler for all of them: a KEY
// (`settings-input.ts` says which key is which action), a THUMB on the HUD's
// own presses (`hud-actions.tsx`), and a ROW OF THE DESKTOP SHELL'S MENU BAR
// (`shell-host.ts`, mirrored in `tauri/shell/src/menu.rs`). That last one is
// the rule rather than a convenience: a shell may add a second way to reach a
// button the game already has, never a second button — so every word the menu
// bar can send lands on the very line a key lands on.
//
// WHAT THE SURFACE DOES TO A PRESS is the whole of this module, and it reads
// top-down as a ladder of narrowing surfaces:
//
//   A BENCHMARK IS NOT A RUN. None of the run's keys mean what they usually
//   mean over one, and every one of them is somebody reaching for the way
//   out — so they all are.
//   ESCAPE AND THE SHUTTER reach the HELD frame as well as the moving one,
//   which is why they are answered before anything narrows to a run.
//   THE HUD SWITCH is answered wherever the readouts are UP, the pause card
//   included: a held frame is exactly where a rider wants the water
//   uncovered, and the key writes the same switch the options row writes.
//   A RECORDING answers to the camera key and nothing else — there is no
//   craft to reset and no run to restart, and the camera key there walks the
//   WATCHING ladder, which is the one place the broadcast can be reached
//   (`camera-tv.ts`).
//   A RUN answers to the rest.
//
// A FACTORY over the app's own closures, the `run-settle.ts` shape: the
// engine state, the renderer and the surfaces are `App.tsx`'s.

import type { CameraRig } from "./camera.ts";
import type { InputAction } from "./settings-input.ts";
import type { RunSurfaces } from "./run-surfaces.ts";
import { hudOver, watching, type Shell } from "./shell.ts";

export type RunActionWorld = {
  shell: () => Shell;
  camera: CameraRig;
  /** The five ways a run is left and come back to (`run-surfaces.ts`). */
  surfaces: RunSurfaces;
  /** Out of the benchmark, which owns the canvas while one is up. */
  leaveBench: () => void;
  /** The shutter (`screenshots.ts`). */
  shoot: () => void;
  /** Toggle the readouts over the water — the same switch OPTIONS ▸ HUD and
   * the pause card's own row write, so a screen cleared for a wave is still
   * clear next run. */
  toggleHud: () => void;
  /** The run again from the line, on the shore it is on. */
  restart: () => void;
};

export function createRunActions(world: RunActionWorld): (action: InputAction) => void {
  return (action: InputAction): void => {
    const shell = world.shell();
    if (shell === "bench") {
      world.leaveBench();
      return;
    }
    // Over a CARD Escape never reaches here at all: `walkCardsOnKeys` takes
    // it in the capture phase and presses the surface's own way back —
    // RESUME on the pause card, EXIT on a recording's bar, and the head's way
    // out on the options page under either.
    if (action === "pause") {
      world.surfaces.pause();
      return;
    }
    if (action === "shot") {
      world.shoot();
      return;
    }
    if (action === "hud") {
      if (hudOver(shell)) world.toggleHud();
      return;
    }
    if (watching(shell)) {
      if (action === "camera") world.camera.cycle();
      return;
    }
    if (shell !== "run") return;
    if (action === "restart") world.restart();
    else if (action === "camera") world.camera.cycle();
  };
}
