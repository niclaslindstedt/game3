// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BIRDS PREVIEW HARNESS — the page `scripts/birds-preview.mjs` drives.
// The flora lab's page, pointed at the sky.
//
// IT EXISTS BECAUSE A SCREENSHOT OF A RUN CANNOT REVIEW A ROSTER. A bird in
// a run is a dozen pixels a hundred metres up, and it is whichever bird that
// stretch of coast happened to fly at whatever point of its beat the frame
// caught — so a gull whose tail is too wide and a cormorant whose neck is
// too short both come back as "there are birds". The roster is a LADDER of
// silhouettes (a tern is a swept sliver, an eagle a plank, a swan is neck)
// and a ladder is judged side by side or not at all.
//
// One cell a species, each drawn THREE times: gliding on held wings, mid
// downstroke, and FOLDED — sitting as it sits on a rock — over a metre
// rule, all through the same wing graft the game flies, so the wing on the
// sheet is the wing in the air. Seen from below and a little ahead, because
// that is where a chase camera on the water sees a bird from.
//
// Sets `window.__done` when the sheet is on screen, which is what the
// driving script waits for.

import * as THREE from "three";

import { BIRDS, type BirdSpec } from "../game/bird-defs.ts";
import { BIRD_STYLES, birdMaterial, buildBird } from "../game/bird-shapes.ts";
import { PALETTE } from "../identity.ts";

/** One cell, px. */
const CELL_W = 340;
const CELL_H = 300;
/** How many cells a row before the sheet wraps. */
const COLS = 4;

/** The three poses a cell shows: the wings' flap and fold for each. */
const POSES: readonly { label: string; flap: (spec: BirdSpec) => number; fold: number }[] = [
  { label: "glide", flap: (spec) => spec.dihedral, fold: 0 },
  { label: "beat", flap: (spec) => -spec.stroke * 0.8, fold: 0 },
  { label: "perched", flap: () => -0.3, fold: 1 },
];

/** Which of the roster this run wants, off the page's own query string. */
function chosen(): typeof BIRDS {
  const asked = new URLSearchParams(location.search).get("rows");
  if (!asked) return BIRDS;
  const want = new Set(asked.split(",").map((s) => s.trim().toLowerCase()));
  const kept = BIRDS.filter((s) => want.has(s.id.toLowerCase()));
  return kept.length > 0 ? kept : BIRDS;
}

/** The metre rule: alternating bands a metre long lying along the cell,
 * so a span claim can be read off the picture. */
function rule(length: number): THREE.Group {
  const group = new THREE.Group();
  const dark = new THREE.MeshBasicMaterial({ color: 0x11181d });
  const pale = new THREE.MeshBasicMaterial({ color: 0xe8eef2 });
  for (let m = 0; m < Math.ceil(length); m++) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(1, 0.03, 0.03), m % 2 ? pale : dark);
    band.position.set(m + 0.5 - length / 2, 0, 0);
    group.add(band);
  }
  return group;
}

/** One bird as an instanced mesh of one, so the wing hinges run through the
 * same attributes the game writes. */
function posed(spec: BirdSpec, flap: number, fold: number): THREE.InstancedMesh {
  const geometry = buildBird(spec, BIRD_STYLES[spec.id]);
  geometry.setAttribute("aFlap", new THREE.InstancedBufferAttribute(new Float32Array([flap]), 1));
  geometry.setAttribute("aFold", new THREE.InstancedBufferAttribute(new Float32Array([fold]), 1));
  const mesh = new THREE.InstancedMesh(geometry, birdMaterial(spec), 1);
  mesh.setMatrixAt(0, new THREE.Matrix4());
  return mesh;
}

function main(): void {
  const roster = chosen();
  const rows = Math.ceil(roster.length / COLS);
  const sheetCanvas = document.getElementById("stage") as HTMLCanvasElement;
  sheetCanvas.width = CELL_W * Math.min(COLS, roster.length);
  sheetCanvas.height = CELL_H * rows;
  const sheet = sheetCanvas.getContext("2d") as CanvasRenderingContext2D;

  const cell = document.createElement("canvas");
  const renderer = new THREE.WebGLRenderer({ canvas: cell, antialias: true });
  renderer.setSize(CELL_W, CELL_H, false);
  renderer.setClearColor(new THREE.Color(PALETTE.sea));

  const labels = document.getElementById("labels") as HTMLDivElement;
  const addLabel = (text: string, col: number, row: number, dy: number, cls = ""): void => {
    const div = document.createElement("div");
    div.className = `label ${cls}`.trim();
    div.textContent = text;
    div.style.left = `${col * CELL_W}px`;
    div.style.top = `${row * CELL_H + dy}px`;
    labels.appendChild(div);
  };

  roster.forEach((spec, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const scene = new THREE.Scene();
    // The game's two lights, at the angles a clear sky stands them at.
    scene.add(new THREE.HemisphereLight(0xdfeef6, 0x6b6f66, 1.5));
    const key = new THREE.DirectionalLight(0xfff2dc, 1.9);
    key.position.set(-0.55, 0.72, 0.42);
    scene.add(key);

    // Three of the bird across the cell, the perched one stood on the
    // rule, the flying pair over it, all pointed a little toward the lens
    // so the neck and the tail both show.
    const gap = Math.max(spec.span * 0.62, 0.7);
    POSES.forEach((p, k) => {
      const mesh = posed(spec, p.flap(spec), p.fold);
      mesh.position.set((k - 1) * gap, k === 2 ? spec.length * 0.16 : spec.span * 0.55, 0);
      mesh.rotation.y = -0.55;
      scene.add(mesh);
    });
    scene.add(rule(Math.max(2, Math.ceil(gap * 2 + spec.span))));

    // Framed on the widest thing in the cell — three spans across.
    const frameW = gap * 2 + spec.span * 1.3;
    const frameH = (frameW * CELL_H) / CELL_W;
    const dist = frameW * 4;
    const camera = new THREE.OrthographicCamera(
      -frameW / 2,
      frameW / 2,
      frameH / 2,
      -frameH / 2,
      0.1,
      dist * 3,
    );
    // From below and ahead, the water's view of a bird.
    camera.position.set(0, spec.span * 0.3 - dist * 0.42, dist);
    camera.lookAt(0, spec.span * 0.3, 0);
    renderer.render(scene, camera);
    sheet.drawImage(cell, col * CELL_W, row * CELL_H);

    addLabel(spec.name, col, row, 6);
    addLabel(
      `span ${spec.span} m · ${spec.beatHz} Hz · glide ${spec.glide} · ${spec.home ?? "passage"}` +
        (spec.passage ? ` · crosses ${spec.passes.join("/")}` : ""),
      col,
      row,
      CELL_H - 26,
      "foot",
    );
  });

  renderer.dispose();
  cell.remove();
  (window as unknown as { __done: boolean }).__done = true;
}

main();

console.log(`three r${THREE.REVISION}`);
