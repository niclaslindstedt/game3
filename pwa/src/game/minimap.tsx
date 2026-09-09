// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The minimap, drawn: a square of sea seen from above with the craft in the
// middle of it, the gates on the water around it, and the run's progress read
// off the FRAME ITSELF — the border is the gauge, filling clockwise from the
// top as the gates go by.
//
// The two halves it draws are owned elsewhere: minimap-scene.ts cuts the
// coast into paths, minimap-view.ts places everything that moves. This file
// is the DOM and the glyphs.
//
// The schematic travels: it is cut around an anchor and translated to the
// craft every frame, which is what makes a map that scrolls smoothly while
// its geometry is rebuilt a couple of times a second. The transform is on the
// group, so one attribute moves the whole coast.

import { useRef } from "preact/hooks";

import { VIEW } from "./minimap-scene.ts";
import type { GateMark, HudMinimap } from "./minimap-view.ts";

/** The gauge ring's corner radius and stroke width, in the same space.
 * `.hud-minimap` derives its own border-radius from R + SW/2 so the chassis
 * and the gauge share one corner at every screen scale. */
const RING_R = 15;
const RING_SW = 5;

/** The gauge ring's path: a rounded rect that starts at top-centre and runs
 * clockwise, so the fill grows away from twelve o'clock like a gate counter.
 * Inset by half the stroke so the border is not clipped by the viewBox. */
function ringPath(): string {
  const a = RING_SW / 2;
  const b = VIEW - RING_SW / 2;
  const r = RING_R;
  return [
    `M ${VIEW / 2} ${a}`,
    `H ${b - r}`,
    `A ${r} ${r} 0 0 1 ${b} ${a + r}`,
    `V ${b - r}`,
    `A ${r} ${r} 0 0 1 ${b - r} ${b}`,
    `H ${a + r}`,
    `A ${r} ${r} 0 0 1 ${a} ${b - r}`,
    `V ${a + r}`,
    `A ${r} ${r} 0 0 1 ${a + r} ${a}`,
    "Z",
  ].join(" ");
}

const RING_PATH = ringPath();

/** ...and how long that path is, in its own user units: four straight runs
 * plus the four quarter-turns that join them. The gauge's dash is measured
 * against THIS rather than against SVG's `pathLength`, which the renderer
 * hands to the DOM as a lower-cased attribute the spec does not know — a
 * gauge that quietly reads its dash in user units instead of in shares is a
 * ring that is full on the start line.
 *
 * The same trap is why every SVG presentation attribute written here is
 * DASHED: Preact hands an unknown prop straight to `setAttribute` under the
 * name it was written with, and SVG attribute names are case-sensitive — a
 * `strokeDasharray` reaches the DOM as `strokedasharray`, which is not an
 * attribute at all and is dropped without a word. */
const RING_LEN = 4 * (VIEW - RING_SW - 2 * RING_R) + 2 * Math.PI * RING_R;

/** THE CRAFT, from above: a hull with a pointed bow and a square transom, the
 * seat inside it, and the two sponsons standing proud of the sides.
 *
 * It is drawn bow-up around the origin, so the whole thing is one translate
 * and one rotate — and it is drawn at a size nothing on the map shares. A
 * three-metre ski at this framing is a dot; the icon is five times that,
 * because what it has to say is WHICH WAY THE BOW IS POINTED and a dot cannot
 * say it. */
const CRAFT_HULL = "M 0 -7.6 L 2.9 -3.4 L 3.2 3.4 L 2.4 6.4 L -2.4 6.4 L -3.2 3.4 L -2.9 -3.4 Z";
const CRAFT_SEAT = "M -1.9 -1.4 L 1.9 -1.4 L 2.1 3.2 L -2.1 3.2 Z";
const CRAFT_SPONSONS = ["M -4.7 0.6 h 1.6 v 4 h -1.6 Z", "M 3.1 0.6 h 1.6 v 4 h -1.6 Z"].join(" ");

/** The next gate's halo — a ring breathing out of whatever glyph the gate
 * itself is, so the mark that says WHICH ONE is one shape rather than a
 * different gate drawing. */
const HALO_R = 8.4;

/** ...and the chevron the run's own gate becomes once it is off the window: a
 * wedge on the rim, pointing the way the gate is. The window is a few hundred
 * metres across and a leg between gates is over a hundred, so this is the
 * state the mark is in whenever the rider has been knocked off the line —
 * which is the whole reason it survives a map that no longer shows the course
 * end to end. */
const CHEVRON = "M 0 -4.6 L 3.4 1.6 L 0 0.1 L -3.4 1.6 Z";

/** The run's two ends: a flag on a staff, drawn from its foot so the foot is
 * the place. Squared off for the finish, swallow-tailed for the start, so the
 * two read apart with no colour at all. */
const END_START = "M 0 0 V -9 L 7 -7.4 L 3.6 -5.6 L 7 -3.8 L 0 -2.2 Z";
const END_FINISH = "M 0 0 V -9 L 7 -9 L 7 -3 L 0 -3 Z";

/** A water gate's buoy, in view units. Small: two of them and the line
 * between them are the glyph, and a buoy drawn big enough to be a landmark
 * would swallow the gap that is the thing to aim at. */
const BUOY_R = 1.5;

/** The coast's pose: scaled about the middle of the box for the speedo's
 * zoom, then slid to where the craft has got since the paths were cut. The
 * origin is written into the list rather than left to `transform-origin`, so
 * the two halves compose the same way whatever the element's box is. */
function worldPose(scene: HudMinimap["scene"]): string {
  const x = VIEW / 2 + scene.offset.x;
  const y = VIEW / 2 + scene.offset.y;
  return `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(${scene.zoom.toFixed(4)}) translate(${-VIEW / 2}px, ${-VIEW / 2}px)`;
}

function place(x: number, y: number, angle = 0): string {
  const turn = angle === 0 ? "" : ` rotate(${angle.toFixed(1)}deg)`;
  return `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)${turn}`;
}

/** One gate: a pair of buoys with the line to be crossed between them, or —
 * for an air gate — the ring the craft is launched through. The state is a
 * class rather than a shape, so a gate does not change what it IS when it is
 * taken. */
function Gate({ gate }: { gate: GateMark }) {
  return (
    <g class={`hud-minimap-gate hud-minimap-gate-${gate.state}`}>
      {gate.kind === "air" ? (
        <circle class="hud-minimap-gate-ring" cx={gate.x} cy={gate.y} r={gate.radius} />
      ) : (
        <>
          <path
            class="hud-minimap-gate-line"
            d={`M ${gate.buoys[0][0].toFixed(1)} ${gate.buoys[0][1].toFixed(1)} L ${gate.buoys[1][0].toFixed(1)} ${gate.buoys[1][1].toFixed(1)}`}
          />
          {gate.buoys.map((b, i) => (
            <circle key={i} class="hud-minimap-buoy" cx={b[0]} cy={b[1]} r={BUOY_R} />
          ))}
        </>
      )}
      {gate.state === "next" && (
        <circle class="hud-minimap-halo" cx={gate.x} cy={gate.y} r={HALO_R} />
      )}
    </g>
  );
}

export function Minimap({ map }: { map: HudMinimap }) {
  const { scene } = map;
  // The one frame a re-cut lands on is the one frame the coast must NOT be
  // tweened onto: the offset, the zoom and the paths all change together and
  // compose back to the same picture, so the transform has to arrive with
  // them. Every other frame is a few view units of drift and is tweened.
  const drawn = useRef(-1);
  const recut = drawn.current !== scene.cut;
  drawn.current = scene.cut;
  return (
    <div class="hud-minimap">
      <svg class="hud-minimap-face" viewBox={`0 0 ${VIEW} ${VIEW}`} aria-hidden="true">
        {/* The coast, cut around its anchor and slid to where the craft now
            stands. The plate's own ground is the deep water, so what is
            painted here is everything that is NOT that: the shallows, the
            land over them, the shoreline between, the rocks, the line. */}
        <g
          class="hud-minimap-world"
          style={{ transform: worldPose(scene), transition: recut ? "none" : undefined }}
        >
          <path class="hud-minimap-shallows" d={scene.shallows} />
          <path class="hud-minimap-land" d={scene.land} />
          <path class="hud-minimap-shoreline" d={scene.shore} />
          <path class="hud-minimap-reef" d={scene.reefs} />
          <path class="hud-minimap-rock" d={scene.rocks} />
          {/* The line is drawn twice: a dark casing, then the line over it.
              The casing is what separates it from the water and the sand
              under it — a single stroke on this plate has no edge of its
              own at all. */}
          <path class="hud-minimap-route-case" d={scene.route} />
          <path class="hud-minimap-route" d={scene.route} />
        </g>
        {/* The run's ends, where the window holds them. */}
        {map.ends.map((end) => (
          <path
            key={end.kind}
            class={`hud-minimap-end hud-minimap-end-${end.kind}`}
            d={end.kind === "start" ? END_START : END_FINISH}
            style={{ transform: place(end.x, end.y) }}
          />
        ))}
        {/* The gates, over the coast and under the craft. They are places
            rather than the rider, so the one glyph that must never be hidden
            is the one that goes on last. */}
        {map.gates.map((gate) => (
          <Gate key={gate.index} gate={gate} />
        ))}
        {map.chevron !== null && (
          <path
            class="hud-minimap-chevron"
            d={CHEVRON}
            style={{ transform: place(map.chevron.x, map.chevron.y, map.chevron.angle) }}
          />
        )}
        <g class="hud-minimap-craft" style={{ transform: place(VIEW / 2, VIEW / 2, map.heading) }}>
          <path class="hud-minimap-craft-sponsons" d={CRAFT_SPONSONS} />
          <path class="hud-minimap-craft-hull" d={CRAFT_HULL} />
          <path class="hud-minimap-craft-seat" d={CRAFT_SEAT} />
        </g>
      </svg>
      {/* The frame IS the progress gauge — a dim track with the run's share
          of it drawn over the top, clockwise from twelve o'clock. */}
      <svg class="hud-minimap-ring" viewBox={`0 0 ${VIEW} ${VIEW}`} aria-hidden="true">
        <path class="hud-minimap-ring-track" d={RING_PATH} stroke-width={RING_SW} />
        <path
          class="hud-minimap-ring-fill"
          d={RING_PATH}
          stroke-width={RING_SW}
          stroke-dasharray={`${(map.progress * RING_LEN).toFixed(2)} ${RING_LEN.toFixed(2)}`}
        />
      </svg>
      {map.label !== "" && <span class="hud-minimap-read">{map.label}</span>}
    </div>
  );
}
