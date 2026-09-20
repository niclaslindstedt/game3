// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CRAFT PICKER: the craft itself, floating and turning, with an arrow
// either side of it. A row of name chips tells a rider nothing about what
// they are about to take out — the shape does, and so does how deep it sits
// — so the shape is the control.
//
// The turntable's three.js lives in `craft-turntable.ts` and is pulled in
// dynamically: this component is on the app shell's static import chain,
// and the entry script has a critical-path budget the render stack would
// blow on its own. Until the chunk lands the pane is the scrim it will be
// drawn on, which is why the name and the arrows are markup rather than
// anything the canvas paints.
//
// THE PICTURE IS ALSO THE DOOR TO THE DEVELOPER MENU, held for seven
// seconds (`menu-hold.ts`, `DEV_HOLD_MS`). The rule and the flourish that
// answers it are next door and DOM-free; what is here is the pointer, the
// one timer that asks whether the hold has run its length, and the call
// that whips the hull round to say so. Nothing is drawn while the finger is
// down — see `menu-hold.ts` for why — so there is no fraction to repaint
// and the only moment that matters is a known time away.

import { useEffect, useRef, useState } from "preact/hooks";
import { CRAFT, craftById, type CraftId } from "@engine";

import type { CraftTurntable } from "./craft-turntable.ts";
import { NO_HOLD, holdWait, tickHold, type HoldState } from "./menu-hold.ts";
import { DEV_HOLD_MS } from "./settings.ts";
import { STRINGS } from "./strings.ts";

export function CraftPicker({
  craft,
  onPick,
  cursor,
  unlocked,
  onUnlock,
}: {
  craft: CraftId;
  onPick: (id: CraftId) => void;
  /** Stand the controller's cursor here when the page comes up. The card
   * whose whole question is WHICH CRAFT asks for it. */
  cursor?: boolean;
  /** True once the developer menu is already out, which is what stops the
   * stage holding: a hold with nothing left to open is a picture that whips
   * round every time somebody rests a thumb on it. */
  unlocked: boolean;
  /** Let the developer menu out. Called once, at the moment the hold runs
   * its length, with the finger still down. */
  onUnlock: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const standRef = useRef<CraftTurntable | null>(null);
  const spec = craftById(craft);
  const index = Math.max(
    0,
    CRAFT.findIndex((c) => c.id === spec.id),
  );
  const step = (by: number): void => onPick(CRAFT[(index + by + CRAFT.length) % CRAFT.length].id);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    void import("./craft-turntable.ts").then(({ createCraftTurntable }) => {
      if (disposed) return;
      standRef.current = createCraftTurntable(canvas);
      standRef.current.setCraft(craftById(canvas.dataset.craft ?? CRAFT[0].id));
    });
    const onResize = (): void => standRef.current?.resize();
    window.addEventListener("resize", onResize);
    return () => {
      disposed = true;
      window.removeEventListener("resize", onResize);
      standRef.current?.dispose();
      standRef.current = null;
    };
    // Built once; the chosen craft flows in through the effect below, so a
    // pick swaps the hull on the water instead of tearing the canvas down.
  }, []);

  // The id also rides on the canvas so the turntable can pick it up if it
  // finishes loading after a pick has already happened.
  useEffect(() => {
    if (canvasRef.current) canvasRef.current.dataset.craft = spec.id;
    standRef.current?.setCraft(spec);
  }, [spec]);

  const [hold, setHold] = useState<HoldState>(NO_HOLD);

  // ONE TIMER FOR THE WHOLE HOLD, not a tick a tenth of a second: nothing is
  // drawn while the finger is down, so the only moment that matters is the
  // one the hold completes at — and that is a known time away. `tickHold` is
  // still what decides it, so the rule stays in the module the tests read.
  //
  // AND IT ASKS AGAIN IF IT COMES BACK SHORT rather than giving up — a wake
  // a millisecond early is an ordinary event, and `holdWait` is where that
  // rule is written down.
  useEffect(() => {
    if (hold.from === null || hold.fired) return;
    let timer = 0;
    const ask = (): void => {
      const next = tickHold(hold, performance.now(), DEV_HOLD_MS);
      if (next === hold) {
        timer = window.setTimeout(ask, holdWait(hold, performance.now(), DEV_HOLD_MS));
        return;
      }
      setHold(next);
      standRef.current?.flourish();
      onUnlock();
    };
    timer = window.setTimeout(ask, holdWait(hold, performance.now(), DEV_HOLD_MS));
    return () => window.clearTimeout(timer);
    // `onUnlock` is a fresh closure each render and would restart the timer;
    // the hold itself is the only thing this should answer to.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hold]);

  // The stage is not a button, so a finger going down on it starts a hold
  // and nothing else, and letting go simply stops the clock. There is no
  // press to swallow on the way out — which is the whole reason the secret
  // moved onto the picture (`menu-hold.ts`).
  const begin = (): void => {
    if (unlocked || hold.from !== null) return;
    setHold({ from: performance.now(), fired: false });
  };
  // Letting go, INCLUDING dragging the finger off the picture — which is how
  // somebody who changed their mind, or who is scrolling the card, says so.
  const end = (): void => setHold(NO_HOLD);

  return (
    <div class="craft-pick-row">
      {/* The arrows and the craft between them are ONE stop on a
          controller's walk, not three (`data-nav-steps`, menu-nav.ts): left
          and right over the water change the craft and leave the cursor
          where it is, the way an arrow either side of something means to a
          thumb. */}
      <div class="craft-pick" data-nav-steps data-nav-focus={cursor ? "" : undefined}>
        <button
          type="button"
          class="craft-pick-step"
          data-nav-step="left"
          onClick={() => step(-1)}
          aria-label={STRINGS.craftPrev}
        >
          ‹
        </button>
        <div
          class="craft-pick-stage"
          role="presentation"
          onPointerDown={begin}
          onPointerUp={end}
          onPointerLeave={end}
          onPointerCancel={end}
        >
          <canvas ref={canvasRef} class="craft-pick-canvas" />
        </div>
        <button
          type="button"
          class="craft-pick-step"
          data-nav-step="right"
          onClick={() => step(1)}
          aria-label={STRINGS.craftNext}
        >
          ›
        </button>
      </div>
      {/* The name and how many of the roster it is are ONE line of billing
          in their own box, so the card can stand them side by side over the
          water without either having to move in the markup. The count is
          there because four hulls turning one at a time is a carousel with
          no edges: `2 / 4` is the whole roster in five characters. */}
      <div class="craft-pick-id">
        <span class="craft-pick-name">{spec.name.toUpperCase()}</span>
        <span class="craft-pick-count">{STRINGS.craftOf(index + 1, CRAFT.length)}</span>
      </div>
    </div>
  );
}
