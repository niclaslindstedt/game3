// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The minimap, drawn: a square of sea seen from above with the craft in the
// middle of it, the gates on the water around it, and the run's progress read
// off the FRAME ITSELF — the border is the gauge, filling clockwise from the
// top as the gates go by.
//
// The two halves it draws are owned elsewhere: minimap-scene.ts cuts the
// coast into paths, minimap-view.ts places everything that moves. This file
// is the DOM and the glyphs — and the PRESS: the whole plate is a button,
// and it is how a run is paused (see below, and menu-pause.tsx).
//
// The schematic travels: it is cut around an anchor and translated to the
// craft every frame, which is what makes a map that scrolls smoothly while
// its geometry is rebuilt a couple of times a second. The transform is on the
// group, so one attribute moves the whole coast.

import { useRef } from "preact/hooks";

import { VIEW } from "./minimap-scene.ts";
import type { GateMark, HudMinimap } from "./minimap-view.ts";
import { STRINGS } from "./strings.ts";

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
 * say it.
 *
 * FOUR THINGS CARRY IT, and each is answering a different failure. The
 * PLINTH — a soft dark disc under the lot — is what stops the icon
 * disappearing into whatever it happens to be over: the map's ground runs
 * from a near-black deep to a pale beach, so no single hull colour survives
 * all of it and the answer is to stop asking one to. The light OUTLINE is
 * the same argument at the glyph's own edge. The BOW WEDGE is what makes the
 * icon directional at a glance rather than on inspection — a hull this small
 * is nearly symmetric fore and aft, and the rider needs the heading in the
 * corner of his eye while he is looking at the water. And the RAY thrown
 * forward of the bow is the heading read at arm's length: the one mark on
 * the plate that can be seen without looking at the plate. */
const CRAFT_HULL = "M 0 -8.4 L 3 -3.6 L 3.3 3.2 L 2.5 6.6 L -2.5 6.6 L -3.3 3.2 L -3 -3.6 Z";
const CRAFT_BOW = "M 0 -7.4 L 2.1 -3.6 L 0 -4.6 L -2.1 -3.6 Z";
const CRAFT_SEAT = "M -1.6 0.4 L 1.6 0.4 L 1.8 3.6 L -1.8 3.6 Z";
const CRAFT_SPONSONS = ["M -4.9 0.4 h 1.7 v 4.2 h -1.7 Z", "M 3.2 0.4 h 1.7 v 4.2 h -1.7 Z"].join(
  " ",
);
const CRAFT_RAY = "M -2.1 -8 L 2.1 -8 L 0.8 -27 L -0.8 -27 Z";

/** The plinth's radius — a little wider than the sponsons, so the disc reads
 * as the glyph's own ground rather than as a ring around it. */
const CRAFT_PLINTH = 8.6;

/** How far past the box the water's texture is drawn, view units. The sheet
 * rides INSIDE the world group so the ripples slide and open out with the
 * coast — which is most of what makes the map read as a sea being crossed
 * rather than a diagram being panned — so it has to cover the box at the
 * furthest the group is ever translated and the least it is ever scaled. */
const SHEET = 60;

/** Where the scale rule stands, view units: inside the gauge ring on the
 * left, clear above the word that says what it is worth.
 *
 * The clearance is generous because the two are measured in DIFFERENT
 * units and always will be: the rule is drawn in the face's own space and
 * scales with the plate, while the word is set in rem and does not. So the
 * smaller the map, the more of it the word takes — and the gap that looked
 * ample on a desktop plate was the phone's rule struck through its own
 * label. This is the height of the word at the smallest plate the clamp on
 * `--hud-map` allows, with room over it. */
const RULE_X = 9;
const RULE_Y = 79;

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

export function Minimap({ map, onOpen }: { map: HudMinimap; onOpen: () => void }) {
  const { scene } = map;
  // The one frame a re-cut lands on is the one frame the coast must NOT be
  // tweened onto: the offset, the zoom and the paths all change together and
  // compose back to the same picture, so the transform has to arrive with
  // them. Every other frame is a few view units of drift and is tweened.
  const drawn = useRef(-1);
  const recut = drawn.current !== scene.cut;
  drawn.current = scene.cut;
  return (
    // THE MAP IS THE WAY INTO THE PAUSE CARD, which is what makes the card
    // reachable on a phone at all: there is no Escape key there, and a
    // dedicated button in this corner would be a fourth thing in a top bar
    // that already carries three. The map is the biggest, calmest target on
    // the screen and the one nothing is riding on — pressing it says "let me
    // look at where I am", which is the same sentence as pausing.
    <button
      type="button"
      class="hud-minimap"
      title={STRINGS.pauseOpen}
      aria-label={STRINGS.pauseOpen}
      onClick={onOpen}
      // A button that keeps the focus keeps the next Enter, and the next
      // Enter is the restart — the same trap the RESET button dodges.
      onMouseUp={(e) => (e.currentTarget as HTMLButtonElement).blur()}
    >
      <svg class="hud-minimap-face" viewBox={`0 0 ${VIEW} ${VIEW}`} aria-hidden="true">
        <defs>
          {/* THE TWO SURFACES, AS TEXTURES. A plan drawn in flat fills asks
              the rider to REMEMBER which tone was water; a plan drawn in
              grain and ripple tells him. Both are patterns rather than a
              second path over the fill, so the texture and the colour are
              one paint and the land's own path is written once. */}
          {/* The tile carries FOUR crests rather than one, at three
              amplitudes and off each other's phase, because a single crest
              tiled is a corrugation: the eye finds the repeat immediately
              and what it reads is a knitted sheet rather than water. */}
          <pattern
            id="hud-map-swell"
            width="9"
            height="13"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(-11)"
          >
            <path class="hud-minimap-swell" d="M 0 2.2 q 2.25 -1.7 4.5 0 t 4.5 0" />
            <path class="hud-minimap-swell" d="M -4.5 5.4 q 2.25 -1.1 4.5 0 t 4.5 0" />
            <path class="hud-minimap-swell" d="M 4.5 5.4 q 2.25 -1.1 4.5 0 t 4.5 0" />
            <path class="hud-minimap-swell" d="M -2.2 9 q 2.25 -1.9 4.5 0 t 4.5 0" />
            <path class="hud-minimap-swell" d="M 6.8 9 q 2.25 -1.9 4.5 0 t 4.5 0" />
            <path class="hud-minimap-swell" d="M 2.6 12.2 q 2.25 -1.3 4.5 0 t 4.5 0" />
            <path class="hud-minimap-swell" d="M -6.4 12.2 q 2.25 -1.3 4.5 0 t 4.5 0" />
          </pattern>
          {/* The wooded ground, as canopy: the stipple IS the wood, which is
              why it is coarser than a sand grain would be and why the
              headland above the tree line does not get it. */}
          <pattern id="hud-map-grain" width="3.6" height="3.6" patternUnits="userSpaceOnUse">
            <rect class="hud-minimap-ground" width="3.6" height="3.6" />
            <circle class="hud-minimap-grain" cx="0.9" cy="0.8" r="0.44" />
            <circle class="hud-minimap-grain" cx="2.6" cy="2.4" r="0.36" />
            <circle class="hud-minimap-grain" cx="1.7" cy="3.1" r="0.24" />
          </pattern>
        </defs>
        {/* The coast, cut around its anchor and slid to where the craft now
            stands. The plate's own ground is the deepest water, so what is
            painted here is everything that is NOT that: the sea's own
            texture, the two depth bands over it, the land over them, the
            shoreline between, the rocks, the line. */}
        <g
          class="hud-minimap-world"
          style={{ transform: worldPose(scene), transition: recut ? "none" : undefined }}
        >
          <rect
            class="hud-minimap-sea"
            x={-SHEET}
            y={-SHEET}
            width={VIEW + 2 * SHEET}
            height={VIEW + 2 * SHEET}
          />
          <path class="hud-minimap-shelf" d={scene.shelf} />
          <path class="hud-minimap-shallows" d={scene.shallows} />
          {/* The surf goes UNDER the land on purpose: a wide pale stroke
              centred on the shoreline, with the land painted over its
              landward half, leaves exactly the half that belongs in the
              water. */}
          <path class="hud-minimap-surf" d={scene.shore} />
          <path class="hud-minimap-land" d={scene.land} />
          <path class="hud-minimap-highland" d={scene.highland} />
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
          <path class="hud-minimap-craft-ray" d={CRAFT_RAY} />
          <circle class="hud-minimap-craft-plinth" cx="0" cy="0" r={CRAFT_PLINTH} />
          <path class="hud-minimap-craft-sponsons" d={CRAFT_SPONSONS} />
          <path class="hud-minimap-craft-hull" d={CRAFT_HULL} />
          <path class="hud-minimap-craft-seat" d={CRAFT_SEAT} />
          <path class="hud-minimap-craft-bow" d={CRAFT_BOW} />
        </g>
        {/* The scale rule, in the face's own units so the bar it draws IS
            the distance it claims. Ticked at both ends, so what is being
            measured is the span between them rather than a smear. */}
        <path
          class="hud-minimap-rule"
          d={`M ${RULE_X} ${RULE_Y - 2.2} V ${RULE_Y} H ${(RULE_X + map.scale.length).toFixed(2)} V ${RULE_Y - 2.2}`}
        />
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
      {/* THE FOOT: what the picture is worth on the left, what the run owes
          on the right. The rule itself is drawn in the face's own units
          above, because a bar measuring the map has to be measured in the
          map's units and nothing else; these are only its word and the
          readout beside it. */}
      <div class="hud-minimap-foot">
        <span class="hud-minimap-scale">{map.scale.label}</span>
        {map.label !== "" && <span class="hud-minimap-read">{map.label}</span>}
      </div>
    </button>
  );
}
