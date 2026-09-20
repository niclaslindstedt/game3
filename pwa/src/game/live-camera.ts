// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHICH CAMERA THE APP IS SHOWING, moment to moment — and, for the one rung
// that is framed around a CARD rather than around a rider, where that card is
// standing.
//
// Two things decide the rung, and they are stated side by side here because
// they interact:
//
//   THE STORED ROW. `settings.ride.camera` reaches the renderer the moment it
//   moves, never on the next run — OPTIONS is opened over a live sea and over
//   a FROZEN one (the pause card), and a row worded CAMERA that did nothing
//   where it is most obviously being asked is worse than no row at all
//   (`menu-system`'s rule). The C key walks the ladder WITHOUT writing the
//   setting, so the two never argue.
//
//   THE SURFACE THAT IS UP. Behind the front door nobody is steering, the
//   middle of the screen is a card, and the only thing the picture owes the
//   player is that the game is plainly still RUNNING — so the sea goes to the
//   menu drone (`camera-menu.ts`), which stands a dozen storeys up and holds
//   the rider out in whatever band of frame the card leaves. Every other
//   surface hands the lens back to whatever the row says.
//
// The drone goes up on every PAGE of the door rather than on the root card
// alone: walking to OPTIONS and back would otherwise drop the lens to the
// boom and lift it again, which reads as the picture glitching rather than as
// a page turning. And the row still wins while it is being MOVED — a rider
// changing the CAMERA row on the door sees the camera it names, exactly as on
// the pause card — because that effect fires on its own; the next page turn
// puts the drone back. The ATTRACT card is not on the list at all: its cover
// is opaque, so there is no sea behind it to compose.
//
// WHERE THE CARD IS is the honest answer the browser laid out, never a copy
// of the stylesheet's `min(30rem, 100%)` arithmetic — a second statement of
// the card's width that nothing holds to the first and that goes stale the
// day a card grows a row. `cardBox` is that reading as pure arithmetic, so
// `tests/camera_menu_test.ts` reads it; the rest is as thin a DOM seam as it
// can be.

import { useEffect } from "preact/hooks";

import type { CameraMode } from "./camera.ts";
import type { ScreenBox } from "./camera-menu.ts";
import type { CameraRig } from "./camera.ts";
import type { Shell } from "./shell.ts";

/** THE CARD, whichever page of the front door is up. Every one of them wears
 * this class (`styles.css`, `.menu-card`), so the selector does not have to
 * learn a new page. */
const CARD = ".menu-card";

/** A laid-out box against a viewport, in the FRAME's own coordinates: −1 is
 * the left and the BOTTOM, +1 the right and the TOP. The vertical flip is the
 * difference between the DOM's axes (y down from the top) and a lens's (y up
 * from the middle), and it is the one thing here worth getting wrong. */
export function cardBox(
  box: { left: number; right: number; top: number; bottom: number },
  width: number,
  height: number,
): ScreenBox {
  const w = width || 1;
  const h = height || 1;
  return {
    left: (2 * box.left) / w - 1,
    right: (2 * box.right) / w - 1,
    bottom: 1 - (2 * box.bottom) / h,
    top: 1 - (2 * box.top) / h,
  };
}

/** Measure the card over the sea and keep it measured, handing each reading
 * to `set` — `null` the moment there is no card to measure. Returns the way
 * to stop.
 *
 * Re-measured on the CARD's own resize and on the WINDOW's, because those are
 * different events: a card that grows a row changes its own box, and a window
 * that changes shape moves a box that has not changed size at all. */
export function watchMenuCard(on: boolean, set: (card: ScreenBox | null) => void): () => void {
  const card = on ? document.querySelector(CARD) : null;
  if (!card) {
    set(null);
    return () => {};
  }
  const measure = (): void =>
    set(cardBox(card.getBoundingClientRect(), window.innerWidth, window.innerHeight));
  measure();
  const boxes = new ResizeObserver(measure);
  boxes.observe(card);
  window.addEventListener("resize", measure);
  return () => {
    boxes.disconnect();
    window.removeEventListener("resize", measure);
  };
}

/** Hold the lens on the rung the surface that is up asks for, and keep the
 * menu's drone told where the card is. `rig` is undefined until the render
 * stack has been fetched, which is why the caller passes whatever says a
 * frame has been drawn (`warm`) as one of the things this watches: a boot
 * straight onto the front door runs this before there is a camera to set.
 *
 * `page` is watched rather than read: turning a page re-lays the card, and a
 * page turn is also what puts the drone back after a CAMERA row has taken the
 * lens off it. */
export function useLiveCamera(
  rig: CameraRig | undefined,
  shell: Shell,
  page: string,
  ride: CameraMode,
  warm: boolean,
): void {
  useEffect(() => {
    if (!rig) return;
    if (shell === "menu") rig.setMode("menu");
    else if (rig.mode() === "menu") rig.setMode(ride);
    return watchMenuCard(shell === "menu", (card) => rig.setFrame({ card }));
    // `ride` is deliberately NOT a dependency: the row has an effect of its
    // own, and re-running this one when the row moves would put the drone
    // straight back over the camera the rider has just asked to look at.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rig, shell, page, warm]);
}
