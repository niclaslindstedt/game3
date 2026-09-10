// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TOUCH CONTROLS — the two thumb zones the phone rides the craft with:
// the HANDLEBAR on the lower left, the THROTTLE LEVER on the lower right.
// Both stop short of the top of the screen so the readouts and their
// buttons keep their own presses; styles.css owns where the line falls.
//
// They are a HUD surface but not a HUD readout: everything here writes
// straight into the input manager between snapshots, at pointer rate,
// rather than being drawn from the ~12 Hz snapshot the rest of the HUD
// reads. That is the whole reason they sit in their own module — and it is
// what the two rules below protect.
//
// TWO THINGS EVERY ZONE HERE OWES:
//
// - It must LET GO. A control that trusts only its own pointerup is one
//   that eventually sticks, with the axis it wrote outliving the run.
//   `thumb-guard.ts` is every way a grip has to be able to end, and no zone
//   may hold a finger without one.
// - It must answer at POINTER rate. The bar's rotation and the lever's
//   position are written onto the DOM directly; nothing in here re-renders
//   to move, because a thumb feeling a 12 Hz handlebar is a thumb feeling
//   a broken game.
//
// The MATHS of both — how far a thumb goes for full lock, the lever's
// throw, the lean's dead band — is input-model.ts, which the tests read.

import { useEffect, useMemo, useRef } from "preact/hooks";

import { BAR_REACH_PX, LEVER_FULL_PX, barLean, barSteer, leverThrottle } from "./input-model.ts";
import type { InputManager } from "./input.ts";
import { createThumbGuard } from "./thumb-guard.ts";

/** Capture the pointer so a drag that leaves the zone keeps steering; a
 * pointer that cannot be captured (synthetic, already released) is fine —
 * the zone still tracks it by id. */
function capturePointer(e: { currentTarget: EventTarget | null; pointerId: number }): void {
  try {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  } catch {
    /* see above */
  }
}

/** Ask the DOM whether a finger is still on the glass. Capture is the only
 * one who knows: the browser drops it the moment a touch ends, whether or
 * not it ever told us the touch ended. */
function stillDown(zone: EventTarget | null): (pointerId: number) => boolean {
  const el = zone as HTMLElement | null;
  return (pointerId) => el?.hasPointerCapture(pointerId) ?? false;
}

/** Bar rotation at full lock, degrees. */
const BAR_LOCK_DEG = 28;
/** The bar's drawing is this many px across (styles.css `.hud-bar-svg`),
 * mapped onto a hundred-unit box — so the reach ring can be drawn at the
 * thumb's real travel. */
const BAR_SVG_PX = 200;

/** The left thumb: touching anywhere in the zone anchors a handlebar under
 * the finger; dragging sideways turns it, dragging up or down leans the
 * rider, and releasing centres both. Screen-space: right = +1
 * (input-model.ts flips the sign for the engine, once). */
export function BarZone({ touch }: { touch: InputManager["touch"] }) {
  const barRef = useRef<HTMLDivElement>(null);
  const rotorRef = useRef<SVGGElement>(null);
  const originRef = useRef({ x: 0, y: 0 });

  const write = (steer: number, lean: number): void => {
    touch.steer = steer;
    touch.lean = lean;
    const rotor = rotorRef.current;
    if (rotor) {
      // A bar seen from the saddle: it turns with the steer and slides
      // toward the rider (down) with the lean back.
      rotor.setAttribute(
        "transform",
        `translate(0 ${(lean * 8).toFixed(1)}) rotate(${(steer * BAR_LOCK_DEG).toFixed(1)} 50 50)`,
      );
    }
  };

  /** Centre the bar and put it away. Everything it touches is a ref, so
   * the guard can call it from a window event or an unmount just as safely
   * as the pointerup does. */
  const letGo = (): void => {
    touch.bar = false;
    write(0, 0);
    if (barRef.current) barRef.current.style.display = "none";
  };
  const letGoRef = useRef(letGo);
  letGoRef.current = letGo;
  const guard = useMemo(() => createThumbGuard(() => letGoRef.current(), window), []);
  useEffect(() => () => guard.dispose(), [guard]);

  return (
    <div
      class="hud-zone hud-zone-left"
      data-touch="bar"
      onPointerDown={(e) => {
        // The first finger owns the bar; a second touch on this half is
        // ignored rather than re-anchoring the steering under the first —
        // unless the first is a finger the browser never told us about,
        // which is what the guard refuses to keep believing in.
        capturePointer(e);
        if (!guard.claim(e.pointerId, stillDown(e.currentTarget))) return;
        originRef.current = { x: e.clientX, y: e.clientY };
        const bar = barRef.current;
        if (bar) {
          const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
          bar.style.left = `${e.clientX - box.left}px`;
          bar.style.top = `${e.clientY - box.top}px`;
          bar.style.display = "block";
        }
        touch.bar = true;
        write(0, 0);
      }}
      onPointerMove={(e) => {
        if (!guard.owns(e.pointerId)) return;
        write(barSteer(e.clientX - originRef.current.x), barLean(e.clientY - originRef.current.y));
      }}
      onPointerUp={(e) => guard.release(e.pointerId)}
      onPointerCancel={(e) => guard.release(e.pointerId)}
      // Capture taken away mid-drag: whatever the browser does with the rest
      // of that touch, this zone is no longer hearing about it.
      onLostPointerCapture={(e) => guard.release(e.pointerId)}
    >
      <div ref={barRef} class="hud-bar" aria-hidden="true">
        <svg class="hud-bar-svg" viewBox="0 0 100 100">
          {/* The reach ring: how far the thumb can go for full lock. */}
          <circle cx="50" cy="50" r={(BAR_REACH_PX / BAR_SVG_PX) * 100} class="hud-bar-reach" />
          <g ref={rotorRef}>
            {/* The bar itself: a crossbar with two grips and a column down
                to the deck, seen from the saddle. */}
            <path d="M 14 48 Q 50 40 86 48" class="hud-bar-tube" />
            <rect x="6" y="43" width="16" height="9" rx="4" class="hud-bar-grip" />
            <rect x="78" y="43" width="16" height="9" rx="4" class="hud-bar-grip" />
            <path d="M 50 46 L 50 66" class="hud-bar-tube" />
            <rect x="42" y="64" width="16" height="10" rx="3" class="hud-bar-grip" />
          </g>
        </svg>
      </div>
    </div>
  );
}

/** The right thumb: touching anywhere in the zone anchors the LEVER at
 * zero; dragging DOWN the glass pulls it open, full at `LEVER_FULL_PX`,
 * analogue the whole way, held while the finger is down and let go on the
 * lift. Nothing else is on this thumb — there is no brake to reach for. */
export function LeverZone({ touch }: { touch: InputManager["touch"] }) {
  const leverRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<SVGGElement>(null);
  const fillRef = useRef<SVGRectElement>(null);
  const originRef = useRef(0);

  const write = (throttle: number): void => {
    touch.throttle = throttle;
    // The track is drawn LEVER_FULL_PX tall; the knob rides the thumb.
    const px = throttle * LEVER_FULL_PX;
    knobRef.current?.setAttribute("transform", `translate(0 ${px.toFixed(1)})`);
    fillRef.current?.setAttribute("height", px.toFixed(1));
  };
  const letGo = (): void => {
    touch.lever = false;
    write(0);
    if (leverRef.current) leverRef.current.style.display = "none";
  };
  const letGoRef = useRef(letGo);
  letGoRef.current = letGo;
  const guard = useMemo(() => createThumbGuard(() => letGoRef.current(), window), []);
  useEffect(() => () => guard.dispose(), [guard]);

  return (
    <div
      class="hud-zone hud-zone-right"
      data-touch="lever"
      onPointerDown={(e) => {
        capturePointer(e);
        if (!guard.claim(e.pointerId, stillDown(e.currentTarget))) return;
        originRef.current = e.clientY;
        const lever = leverRef.current;
        if (lever) {
          const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
          lever.style.left = `${e.clientX - box.left}px`;
          lever.style.top = `${e.clientY - box.top}px`;
          lever.style.display = "block";
        }
        touch.lever = true;
        write(0);
      }}
      onPointerMove={(e) => {
        if (!guard.owns(e.pointerId)) return;
        write(leverThrottle(e.clientY - originRef.current));
      }}
      onPointerUp={(e) => guard.release(e.pointerId)}
      onPointerCancel={(e) => guard.release(e.pointerId)}
      onLostPointerCapture={(e) => guard.release(e.pointerId)}
    >
      <div ref={leverRef} class="hud-lever" aria-hidden="true">
        <svg
          class="hud-lever-svg"
          width="44"
          height={LEVER_FULL_PX + 44}
          viewBox={`-22 -22 44 ${LEVER_FULL_PX + 44}`}
        >
          <rect class="hud-lever-track" x="-6" y="0" width="12" height={LEVER_FULL_PX} rx="6" />
          <rect ref={fillRef} class="hud-lever-fill" x="-6" y="0" width="12" height="0" rx="6" />
          <g ref={knobRef}>
            <circle class="hud-lever-knob" cx="0" cy="0" r="15" />
          </g>
        </svg>
      </div>
    </div>
  );
}
