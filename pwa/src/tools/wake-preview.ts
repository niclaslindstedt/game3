// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WAKE PREVIEW HARNESS — the page `scripts/wake-preview.mjs` drives.
//
// IT EXISTS BECAUSE THE GAME HAS NO VIEW OF ITS OWN TRAIL. Every camera on
// the ladder is a chase camera, so the trail is only ever seen end-on, down
// its own length, foreshortened to a stripe — while every reference
// photograph of a wake ever taken is from straight above. Judging the plan
// shape from a chase shot is guessing: a V that stops opening, a road that
// is twice as wide as it should be and a scallop that crawls with the craft
// instead of standing still in the water all look much the same from behind.
//
// So this draws the MAP — `wake.ts`'s render target, the trail rasterised
// from directly overhead, which IS the plan view and is the very data the
// water shader reads. One column a moment along a scripted run, so the sheet
// reads left to right as the trail being laid: the jet blasting astern off a
// standing start, the road catching up as the hull begins to move, the fan
// opening behind it. With `--channels`, one row per channel underneath —
// foam, churn, crest, hollow, separately — which is the diagnostic that says
// whether a mark is missing from the map or merely invisible in it.
//
// It runs the REAL engine at the real step rate and the REAL wake module;
// nothing about the trail is restated here. What this file owns is only the
// palette the four channels are composited with and the furniture over the
// top: the craft's plan, a metre rule, and what each cell is.
//
// Sets `window.__done` when the sheet is on screen, which is what the
// driving script waits for.

import * as THREE from "three";
import { createGame, NEUTRAL_INPUT, step, type CraftInput, type GameState } from "@engine";

import { createSpray } from "../game/spray.ts";
import { createWake } from "../game/wake.ts";
import { WAKE_HEIGHT } from "../game/wake-profile.ts";

/** One cell, px — the map is square, so the cell is. */
const CELL = 300;
/** The gutter round a cell and the strip of label over it. */
const PAD = 8;
const LABEL = 22;
/** The rows a `--channels` sheet carries under the composite, in the order
 * the map's texels store them. */
const CHANNELS = ["foam", "churn", "crest", "hollow"] as const;

type Drive = "start" | "carve" | "brake";

/** What the page was asked for, off its own query string. */
function asked() {
  const q = new URLSearchParams(location.search);
  const list = (name: string, fallback: number[]) => {
    const raw = q.get(name);
    if (!raw) return fallback;
    const ns = raw
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n >= 0);
    return ns.length > 0 ? ns : fallback;
  };
  return {
    seed: Number(q.get("seed") ?? 38),
    craft: q.get("craft") ?? "skiff",
    drive: (q.get("drive") ?? "start") as Drive,
    times: list("times", [0.15, 0.4, 0.8, 1.6, 3, 5]).sort((a, b) => a - b),
    channels: q.get("channels") === "1",
  };
}

/** THE INPUT a moment of the scripted run wants. Each drive is a story the
 * trail has to tell: `start` is the one this lab was built for — a hull at
 * rest with the throttle opened, where the jet is the whole effect before
 * the craft has moved far enough to lay anything. */
function inputAt(drive: Drive, t: number): CraftInput {
  // Off the engine's own neutral, never a literal: a field this lab forgets
  // arrives as `undefined` and comes out the far end of the physics as NaN,
  // which reads on the sheet as a craft that simply never moved.
  if (drive === "start") return { ...NEUTRAL_INPUT, throttle: 1 };
  if (drive === "carve") return { ...NEUTRAL_INPUT, throttle: 1, steer: t > 2.5 ? 1 : 0 };
  // The brake: up to pace, then the bucket down and the throttle shut.
  return t < 4 ? { ...NEUTRAL_INPUT, throttle: 1 } : { ...NEUTRAL_INPUT, throttle: 0, reverse: 1 };
}

/** THE COMPOSITE: the four channels as one picture. Foam is the white it
 * draws as; the churn tints the water it has aerated; the crest and the
 * hollow are the relief, warm up and cool down, so a ring wave or a
 * transom's trough reads as shape rather than as more foam. */
const COMPOSITE = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uChannel;
  varying vec2 vUv;
  void main() {
    vec4 m = texture2D(uMap, vUv);
    if (uChannel >= 0.0) {
      // One channel alone, as a grey ramp: is the mark in the map at all?
      float v = uChannel < 0.5 ? m.r : uChannel < 1.5 ? m.g : uChannel < 2.5 ? m.b : m.a;
      gl_FragColor = vec4(vec3(v), 1.0);
      return;
    }
    vec3 sea = vec3(0.043, 0.09, 0.125);
    vec3 col = mix(sea, vec3(0.16, 0.34, 0.42), clamp(m.g, 0.0, 1.0));
    col = mix(col, vec3(0.96, 0.98, 1.0), clamp(m.r, 0.0, 1.0));
    // The relief, as a wash over the top — it is centimetres of water, so
    // it must not be able to drown the foam it sits under.
    col += vec3(0.22, 0.16, 0.0) * clamp(m.b, 0.0, 1.0);
    col -= vec3(0.0, 0.10, 0.18) * clamp(m.a, 0.0, 1.0);
    gl_FragColor = vec4(col, 1.0);
  }`;

function mapView(): { scene: THREE.Scene; lens: THREE.Camera; material: THREE.ShaderMaterial } {
  const material = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: null }, uChannel: { value: -1 } },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: COMPOSITE,
    depthTest: false,
    depthWrite: false,
  });
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));
  return { scene, lens: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), material };
}

const opts = asked();
const rows = opts.channels ? 1 + CHANNELS.length : 1;
const cols = opts.times.length;
const sheetW = PAD + cols * (CELL + PAD);
const sheetH = PAD + rows * (CELL + LABEL + PAD);

const stage = document.getElementById("stage") as HTMLCanvasElement;
stage.width = sheetW;
stage.height = sheetH;
const ink = stage.getContext("2d")!;
ink.fillStyle = "#0b1116";
ink.fillRect(0, 0, sheetW, sheetH);

// The map is rasterised by a real WebGL renderer on a canvas of its own, and
// the cells are copied off it — the sheet itself is 2D, because the
// furniture (the rule, the craft's plan, the captions) is text and lines.
const gl = document.createElement("canvas");
gl.width = gl.height = CELL;
const renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: false });
renderer.setPixelRatio(1);
renderer.setSize(CELL, CELL, false);
const view = mapView();

const game: GameState = createGame({ seed: opts.seed, craft: opts.craft as never });
const wake = createWake();
const spray = createSpray(wake.stamp);
view.material.uniforms.uMap.value = wake.map.texture;

/** Where a plan point falls in a cell, px — through the map's own box, which
 * is how the water shader reads it.
 *
 * THE Z AXIS IS FLIPPED HERE AND IT MATTERS. The mark material puts a vertex
 * at clip `(plan - box.xy) / box.z`, and clip +y is the TOP of a render
 * target, which is the FIRST row of the canvas it is copied off. So world +z
 * is UP in a cell while canvas +y is down. Get it wrong and the overlay is
 * mirrored about the cell's centre: the craft lands a map-offset the wrong
 * side of where it is, and every mark astern of it reads as detached — which
 * is exactly how a working jet looked like a broken one. */
function place(x: number, z: number): [number, number] {
  const box = wake.map.box;
  return [((x - box.x) / (2 * box.z) + 0.5) * CELL, (0.5 - (z - box.y) / (2 * box.z)) * CELL];
}

/** The craft on the cell: its plan outline and a nose, so the trail can be
 * read against the thing that laid it. */
function drawCraft(ox: number, oy: number): void {
  const c = game.craft;
  const [cx, cy] = place(c.x, c.z);
  const scale = CELL / (2 * wake.map.box.z);
  const fx = Math.sin(c.heading);
  const fz = Math.cos(c.heading);
  const half = (c.spec.length / 2) * scale;
  const beam = (c.spec.beam / 2) * scale;
  ink.save();
  ink.translate(ox + cx, oy + cy);
  // The cell reads world +z as UP (see `place`), so the heading on screen is
  // (fx, -fz) and the rotation that puts the nose on it is atan2(fx, fz).
  ink.rotate(Math.atan2(fx, fz));
  ink.strokeStyle = "#ff8a3d";
  ink.lineWidth = 1.5;
  ink.beginPath();
  ink.moveTo(0, -half);
  ink.lineTo(beam, -half * 0.2);
  ink.lineTo(beam, half);
  ink.lineTo(-beam, half);
  ink.lineTo(-beam, -half * 0.2);
  ink.closePath();
  ink.stroke();
  // …and the axis astern, twenty metres of it, so a mark that is supposed to
  // come out of the nozzle can be seen to be ON it.
  ink.strokeStyle = "rgb(255 138 61 / 45%)";
  ink.lineWidth = 1;
  ink.setLineDash([4, 5]);
  ink.beginPath();
  ink.moveTo(0, half);
  ink.lineTo(0, half + 20 * scale);
  ink.stroke();
  ink.setLineDash([]);
  ink.restore();
}

/** A ten-metre rule in the cell's corner: the map's reach changes with
 * nothing, but a reader should not have to know that. */
function drawRule(ox: number, oy: number): void {
  const metres = 10;
  const px = (metres / (2 * wake.map.box.z)) * CELL;
  ink.strokeStyle = "#8fa3ad";
  ink.lineWidth = 2;
  ink.beginPath();
  ink.moveTo(ox + 10, oy + CELL - 12);
  ink.lineTo(ox + 10 + px, oy + CELL - 12);
  ink.stroke();
  ink.fillStyle = "#8fa3ad";
  ink.font = "11px monospace";
  ink.fillText(`${metres} M`, ox + 12 + px, oy + CELL - 8);
}

function caption(ox: number, oy: number, text: string, tone = "#dfe8ee"): void {
  ink.fillStyle = tone;
  ink.font = "12px monospace";
  ink.fillText(text, ox, oy + 14);
}

/** Draw one column: the composite, and under it each channel alone. */
function column(col: number, t: number): void {
  const ox = PAD + col * (CELL + PAD);
  const c = game.craft;
  for (let row = 0; row < rows; row++) {
    const oy = PAD + row * (CELL + LABEL + PAD);
    view.material.uniforms.uChannel.value = row === 0 ? -1 : row - 1;
    renderer.render(view.scene, view.lens);
    ink.drawImage(gl, ox, oy + LABEL);
    if (row === 0) {
      caption(
        ox,
        oy,
        `${t.toFixed(2)}S  ${(c.speed * 3.6).toFixed(0)}KM/H  THR ${c.throttleEff.toFixed(2)}`,
      );
      drawCraft(ox, oy + LABEL);
      drawRule(ox, oy + LABEL);
    } else {
      const name = CHANNELS[row - 1];
      const unit = row > 2 ? ` (0..${WAKE_HEIGHT} M)` : "";
      caption(ox, oy, `${name.toUpperCase()}${unit}`, "#8fa3ad");
    }
  }
}

// Run it. The engine steps at its own rate and the wake observes every step
// — the same cadence the app uses, so what the sheet shows is what a rider
// would have laid.
const DT = 1 / 120;
let next = 0;
const last = opts.times[opts.times.length - 1];
for (let t = 0; t <= last + DT; t += DT) {
  if (next < opts.times.length && t >= opts.times[next]) {
    wake.render(renderer, game);
    column(next, opts.times[next]);
    next++;
  }
  step(game, inputAt(opts.drive, t));
  wake.observe(game);
  spray.observe(game);
}

(window as unknown as { __done: boolean }).__done = true;
