// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE IN-RUN PRESS. `click` is synthesised from the PRIMARY pointer only, and
// a phone riding this game has that pointer spoken for — it is the thumb on
// the handlebar or on the lever. So every button drawn over a run is pressed
// from the pointer events instead, and the click that may or may not follow
// is swallowed rather than allowed to fire the action twice.
//
// Measured in Chromium at 390x844 with touch on: a button tapped alone gets
// pointerdown(primary=true), pointerup and click; the same button tapped with
// a finger held in a thumb zone gets pointerdown(primary=false) and pointerup
// and NO CLICK. That is the bug this module exists for, and these are its
// claims.

import { describe, expect, it } from "vitest";

import { createHudPress } from "../pwa/src/game/hud-press.ts";

const BOX = { left: 100, top: 20, right: 160, bottom: 80 };
/** A point comfortably inside BOX. */
const inside = (pointerId: number, pointerType = "touch") => ({
  pointerId,
  pointerType,
  clientX: 130,
  clientY: 50,
});

describe("a finger's press", () => {
  it("fires on the lift, with no click anywhere in it", () => {
    const press = createHudPress();
    press.down(inside(4));
    expect(press.up(inside(4), BOX, 1000)).toBe(true);
  });

  it("fires for a NON-PRIMARY finger just the same — the whole point", () => {
    // Nothing in the machine asks whether the pointer is primary: the second
    // finger is the one that has to work, because the first is on the bar.
    const press = createHudPress();
    press.down({ pointerId: 9, pointerType: "touch", clientX: 130, clientY: 50 });
    expect(press.up(inside(9), BOX, 1000)).toBe(true);
  });

  it("ignores a lift from a finger it never took", () => {
    const press = createHudPress();
    press.down(inside(4));
    expect(press.up(inside(5), BOX, 1000)).toBe(false);
  });

  it("does not fire when the thumb slid off the button first", () => {
    const press = createHudPress();
    press.down(inside(4));
    expect(
      press.up({ pointerId: 4, pointerType: "touch", clientX: 300, clientY: 50 }, BOX, 1000),
    ).toBe(false);
  });

  it("fires when the button could not be measured — a lift that reached it is a press", () => {
    const press = createHudPress();
    press.down(inside(4));
    expect(press.up(inside(4), null, 1000)).toBe(true);
  });

  it("is over when the browser takes the touch for a gesture", () => {
    const press = createHudPress();
    press.down(inside(4));
    press.cancel(inside(4));
    expect(press.up(inside(4), BOX, 1000)).toBe(false);
  });
});

describe("the click behind it", () => {
  it("is swallowed when it echoes a press this button just fired", () => {
    const press = createHudPress();
    press.down(inside(4));
    press.up(inside(4), BOX, 1000);
    expect(press.click(1010)).toBe(false);
  });

  it("is swallowed even when the thumb slid off — an abandoned press stays abandoned", () => {
    const press = createHudPress();
    press.down(inside(4));
    press.up({ pointerId: 4, pointerType: "touch", clientX: 300, clientY: 50 }, BOX, 1000);
    expect(press.click(1010)).toBe(false);
  });

  it("is a press of its own once the echo can no longer be that touch", () => {
    const press = createHudPress();
    press.down(inside(4));
    press.up(inside(4), BOX, 1000);
    expect(press.click(9000)).toBe(true);
  });

  it("is the whole of a MOUSE press: nothing is armed on the pointer down", () => {
    // A mouse has a real activation path — the drag-off cancel, the secondary
    // buttons, Enter and Space on a focused button arriving as clicks — and
    // it keeps it.
    const press = createHudPress();
    press.down(inside(1, "mouse"));
    expect(press.up(inside(1, "mouse"), BOX, 1000)).toBe(false);
    expect(press.click(1010)).toBe(true);
  });

  it("carries a keyboard press, which has no pointer at all", () => {
    expect(createHudPress().click(1000)).toBe(true);
  });

  it("is let through again after a cancelled touch", () => {
    const press = createHudPress();
    press.down(inside(4));
    press.up(inside(4), BOX, 1000);
    press.down(inside(5));
    press.cancel(inside(5));
    expect(press.click(1010)).toBe(true);
  });
});
