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
// AND WITH `--profile`, THE SURFACE ITSELF, IN SECTION. A plan view answers
// where the white is and nothing at all about whether the water BENDS: the
// crest and the hollow channels are two grey washes there, and a trough two
// metres wide reads identically to one the grid can actually stand on. So
// the profile rows probe the map the way the WATER does — through
// `water-shader.ts`'s own `wakeRelief`/`wakeGrad`, compiled here from the
// same exported GLSL, at the same blurred level, with the same sideways
// push — and plot the resulting surface in metres: one row along the
// craft's axis astern, one row across the trail at four distances back.
// The raw map is drawn under each as a faint line, so a relief the map
// holds and the grid never sees is visible as the gap between the two.
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
import { WAKE_GLSL, WAKE_PUSH } from "../game/water-shader.ts";

/** One cell, px — the map is square, so the cell is. */
const CELL = 300;
/** The gutter round a cell and the strip of label over it. */
const PAD = 8;
const LABEL = 22;
/** The rows a `--channels` sheet carries under the composite, in the order
 * the map's texels store them. */
const CHANNELS = ["foam", "churn", "crest", "hollow"] as const;
/** THE PROFILE PROBE: how many points a section is sampled at, how far
 * astern of the centre of gravity the along-section runs, m, and how far
 * either side of the axis a cross-section reaches, m. */
const PROBE = 256;
const ALONG_REACH = 52;
const ACROSS_REACH = 22;
/** Where the cross-sections are cut, m astern of the centre of gravity: at
 * the transom, where the sides close, and twice more far enough back to
 * show the arms marching outward. Spread over the whole section, because
 * four cuts bunched near the hull say nothing about a triangle. */
const CUTS = [2, 8, 22, 44];
const CUT_INK = ["#ffd166", "#ff8a3d", "#6fd1e8", "#9aa7b0"];

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
    profile: q.get("profile") === "1",
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
    col += vec3(0.45, 0.33, 0.0) * clamp(m.b, 0.0, 1.0);
    col -= vec3(0.0, 0.20, 0.36) * clamp(m.a, 0.0, 1.0);
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

/** THE PROBE: the wake's relief along a line in plan, read with the WATER'S
 * OWN functions — `WAKE_GLSL` is compiled in, so `wakeUv`, `wakeEdge`,
 * `wakeRelief` and `wakeGrad` here are the very code the sea is displaced
 * by, at the same blurred level and with the same decode. A probe that
 * restated any of it would be answering for a surface nothing ever gets.
 *
 * Four channels: the relief the GRID gets (blurred), the relief the MAP
 * holds (sharp), and the two components of the sideways push. Eight bits
 * each, over the ranges below rather than floats — a float target wants
 * EXT_color_buffer_float, and this lab's whole reason for existing is to
 * run under the software rasterizer. A step is 2.7 mm of relief, finer than
 * anything the plot can draw. */
const PUSH_RANGE = 2 * WAKE_PUSH;
const PROBE_GLSL = /* glsl */ `
  uniform vec2 uFrom;
  uniform vec2 uTo;
  varying vec2 vUv;
${WAKE_GLSL}
  void main() {
    vec2 uv = wakeUv(mix(uFrom, uTo, vUv.x));
    float edge = wakeEdge(uv);
    vec4 m = texture2D(uWake, uv);
    float sharp = (m.b - m.a) * ${WAKE_HEIGHT.toFixed(3)} * edge;
    vec2 push = wakeGrad(uv, edge) * ${WAKE_PUSH.toFixed(2)};
    gl_FragColor = vec4(
      wakeRelief(uv) * edge / ${(2 * WAKE_HEIGHT).toFixed(3)} + 0.5,
      sharp / ${(2 * WAKE_HEIGHT).toFixed(3)} + 0.5,
      push.x / ${(2 * PUSH_RANGE).toFixed(3)} + 0.5,
      push.y / ${(2 * PUSH_RANGE).toFixed(3)} + 0.5);
  }`;

/** One section: where each point ended up along the cut, m (the sample's own
 * station plus the push along it), the relief the grid gets there and the
 * relief the map holds. */
type Section = { at: Float32Array; h: Float32Array; raw: Float32Array };

function makeProbe() {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uWake: { value: null },
      uWakeBox: { value: null },
      uWakeMode: { value: 2 },
      uFrom: { value: new THREE.Vector2() },
      uTo: { value: new THREE.Vector2() },
    },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: PROBE_GLSL,
    depthTest: false,
    depthWrite: false,
  });
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));
  const lens = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const target = new THREE.WebGLRenderTarget(PROBE, 1, {
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: false,
  });
  const bytes = new Uint8Array(PROBE * 4);
  const out: Section = {
    at: new Float32Array(PROBE),
    h: new Float32Array(PROBE),
    raw: new Float32Array(PROBE),
  };
  /** The section from `(x0, z0)` to `(x1, z1)`, with stations measured from
   * `base` m along the cut. */
  return (x0: number, z0: number, x1: number, z1: number, base: number): Section => {
    material.uniforms.uWake.value = wake.map.texture;
    material.uniforms.uWakeBox.value = wake.map.box;
    material.uniforms.uFrom.value.set(x0, z0);
    material.uniforms.uTo.value.set(x1, z1);
    renderer.setRenderTarget(target);
    renderer.render(scene, lens);
    renderer.readRenderTargetPixels(target, 0, 0, PROBE, 1, bytes);
    renderer.setRenderTarget(null);
    const span = Math.hypot(x1 - x0, z1 - z0);
    const ux = (x1 - x0) / span;
    const uz = (z1 - z0) / span;
    for (let i = 0; i < PROBE; i++) {
      const u = i / (PROBE - 1);
      const pushX = (bytes[i * 4 + 2] / 255 - 0.5) * 2 * PUSH_RANGE;
      const pushZ = (bytes[i * 4 + 3] / 255 - 0.5) * 2 * PUSH_RANGE;
      // The water is shoved SIDEWAYS as well as up, so a station is drawn
      // where the surface it carries actually ended up — the component of
      // the push along this cut. Draw it at its unpushed station and a
      // trough that has thrown the water out of it looks like one that has
      // not moved the water at all.
      out.at[i] = base + u * span + (pushX * ux + pushZ * uz);
      out.h[i] = (bytes[i * 4] / 255 - 0.5) * 2 * WAKE_HEIGHT;
      out.raw[i] = (bytes[i * 4 + 1] / 255 - 0.5) * 2 * WAKE_HEIGHT;
    }
    return out;
  };
}

const opts = asked();
const rows = (opts.channels ? 1 + CHANNELS.length : 1) + (opts.profile ? 2 : 0);
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
const probe = makeProbe();
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

/** A section plot's frame: metres across the bottom, metres of relief up the
 * side at a FIXED full scale (±`WAKE_HEIGHT`, the most a channel can carry),
 * so two columns of the sheet can be compared by eye. The still water line
 * runs through the middle. */
function plotFrame(ox: number, oy: number, from: number, to: number): void {
  ink.fillStyle = "#0f1a21";
  ink.fillRect(ox, oy, CELL, CELL);
  ink.strokeStyle = "#233039";
  ink.lineWidth = 1;
  ink.font = "10px monospace";
  ink.fillStyle = "#5d6f7a";
  for (let m = Math.ceil(from / 5) * 5; m <= to; m += 5) {
    const px = ox + ((m - from) / (to - from)) * CELL;
    ink.beginPath();
    ink.moveTo(px, oy);
    ink.lineTo(px, oy + CELL);
    ink.stroke();
    ink.fillText(`${m}`, px + 2, oy + CELL - 4);
  }
  // A tenth of a metre a line, so the depth of a trough can be counted off.
  for (let h = -WAKE_HEIGHT; h <= WAKE_HEIGHT + 1e-6; h += 0.1) {
    const py = oy + CELL / 2 - (h / (2 * WAKE_HEIGHT)) * CELL;
    ink.beginPath();
    ink.moveTo(ox, py);
    ink.lineTo(ox + CELL, py);
    ink.stroke();
  }
  ink.strokeStyle = "#4a6572";
  ink.lineWidth = 1.5;
  ink.beginPath();
  ink.moveTo(ox, oy + CELL / 2);
  ink.lineTo(ox + CELL, oy + CELL / 2);
  ink.stroke();
  ink.fillText(`+${WAKE_HEIGHT} M`, ox + 4, oy + 11);
  ink.fillText(`-${WAKE_HEIGHT} M`, ox + 4, oy + CELL - 16);
}

/** One section on a frame: the relief the GRID gets as a solid line, and the
 * relief the MAP holds under it as a faint one. Where the two part company
 * is a mark narrower than the blur — held by the map and never seen by the
 * water. */
function plotSection(
  ox: number,
  oy: number,
  from: number,
  to: number,
  s: Section,
  tone: string,
): void {
  const px = (at: number) => ox + ((at - from) / (to - from)) * CELL;
  const py = (h: number) => oy + CELL / 2 - (h / (2 * WAKE_HEIGHT)) * CELL;
  for (const [values, width, alpha] of [
    [s.raw, 1, 0.35],
    [s.h, 2, 1],
  ] as const) {
    ink.strokeStyle = tone;
    ink.globalAlpha = alpha;
    ink.lineWidth = width;
    ink.beginPath();
    for (let i = 0; i < PROBE; i++) {
      const x = px(s.at[i]);
      const y = py(values[i]);
      if (i === 0) ink.moveTo(x, y);
      else ink.lineTo(x, y);
    }
    ink.stroke();
  }
  ink.globalAlpha = 1;
}

/** The two section rows. ALONG is the craft's own axis running astern, so it
 * is the trail's centreline on a hull going straight and a chord across it
 * on one carving — read the turn's sections off ACROSS instead. */
function drawProfiles(ox: number, oy: number): void {
  const c = game.craft;
  const fx = Math.sin(c.heading);
  const fz = Math.cos(c.heading);
  // The hull's own stern, so the sections can be read against the thing
  // that made them rather than against the centre of gravity.
  const stern = c.spec.length / 2;
  const along = oy + LABEL;
  plotFrame(ox, along, 0, ALONG_REACH);
  ink.strokeStyle = "#ff8a3d";
  ink.globalAlpha = 0.5;
  ink.beginPath();
  ink.moveTo(ox + (stern / ALONG_REACH) * CELL, along);
  ink.lineTo(ox + (stern / ALONG_REACH) * CELL, along + CELL);
  ink.stroke();
  ink.globalAlpha = 1;
  plotSection(
    ox,
    along,
    0,
    ALONG_REACH,
    probe(c.x, c.z, c.x - fx * ALONG_REACH, c.z - fz * ALONG_REACH, 0),
    "#7fe3b0",
  );
  // …and where each cross-section is cut, ticked on the along plot in its
  // own colour, so the two rows read as one picture.
  CUTS.forEach((d, k) => {
    if (d > ALONG_REACH) return;
    ink.fillStyle = CUT_INK[k];
    ink.fillRect(ox + (d / ALONG_REACH) * CELL - 1, along + CELL - 8, 3, 8);
  });

  const across = oy + (CELL + LABEL + PAD) + LABEL;
  plotFrame(ox, across, -ACROSS_REACH, ACROSS_REACH);
  const rx = Math.cos(c.heading);
  const rz = -Math.sin(c.heading);
  CUTS.forEach((d, k) => {
    const bx = c.x - fx * d;
    const bz = c.z - fz * d;
    plotSection(
      ox,
      across,
      -ACROSS_REACH,
      ACROSS_REACH,
      probe(
        bx - rx * ACROSS_REACH,
        bz - rz * ACROSS_REACH,
        bx + rx * ACROSS_REACH,
        bz + rz * ACROSS_REACH,
        -ACROSS_REACH,
      ),
      CUT_INK[k],
    );
  });
}

function caption(ox: number, oy: number, text: string, tone = "#dfe8ee"): void {
  ink.fillStyle = tone;
  ink.font = "12px monospace";
  ink.fillText(text, ox, oy + 14);
}

/** Draw one column: the composite, under it each channel alone, and under
 * those the two sections. */
function column(col: number, t: number): void {
  const ox = PAD + col * (CELL + PAD);
  const c = game.craft;
  const maps = opts.channels ? 1 + CHANNELS.length : 1;
  for (let row = 0; row < maps; row++) {
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
  if (!opts.profile) return;
  const oy = PAD + maps * (CELL + LABEL + PAD);
  drawProfiles(ox, oy);
  caption(ox, oy, "ALONG THE AXIS — M ASTERN", "#7fe3b0");
  // The cross-sections are keyed by colour rather than named in a sentence:
  // four distances spelled out overflow a cell and print over the next
  // column's caption.
  caption(ox, oy + CELL + LABEL + PAD, "ACROSS AT", "#8fa3ad");
  CUTS.forEach((d, k) => {
    caption(ox + 72 + k * 46, oy + CELL + LABEL + PAD, `${d}M`, CUT_INK[k]);
  });
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
