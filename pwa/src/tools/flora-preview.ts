// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FLORA PREVIEW HARNESS — the page `scripts/flora-preview.mjs` drives.
// The sibling rally game's per-subject preview labs, pointed at a shore.
//
// IT EXISTS BECAUSE A SCREENSHOT OF A RUN CANNOT REVIEW A ROSTER. What the
// chase camera gives back is whichever species that stretch of coast
// happened to grow, at whatever range the craft happened to be, against a
// wood of everything else — so a reed that is too pale and a rowan that is
// the wrong shape both come back as "the shore looks fine". The roster is a
// LADDER exactly as the sky is: a birch has to read as lighter than a pine
// and a sallow as softer than an alder, and a ladder is judged side by side
// or not at all.
//
// One cell a species, each drawn TWICE — at the shortest and the tallest of
// its own height band — over a metre rule, so the cell answers both "is the
// shape right" and "is it the size I said". The lighting is the game's:
// hemisphere plus key, at the angles `environment.ts` stands them at under
// a clear sky, because a canopy painted lit-over-dark is only honest under
// a light that comes from above.
//
// Sets `window.__done` when the sheet is on screen, which is what the
// driving script waits for.

import * as THREE from "three";

import { FLORA } from "../game/flora-defs.ts";
import { buildFlora, floraMaterial } from "../game/flora-shapes.ts";
import { PALETTE } from "../identity.ts";

/** One cell, px. Tall, because so is a spruce. */
const CELL_W = 300;
const CELL_H = 380;
/** How many cells a row before the sheet wraps. */
const COLS = 5;
/** How much air is left over the tallest plant in a cell, as a share of its
 * height. */
const HEADROOM = 0.16;

/** Which of the roster this run wants, off the page's own query string. */
function chosen(): typeof FLORA {
  const asked = new URLSearchParams(location.search).get("rows");
  if (!asked) return FLORA;
  const want = new Set(asked.split(",").map((s) => s.trim().toLowerCase()));
  const kept = FLORA.filter((s) => want.has(s.id.toLowerCase()));
  return kept.length > 0 ? kept : FLORA;
}

/** The ground the cell stands on: a slab of the shore's own granite, big
 * enough that the plant never overhangs it. */
function groundPlane(reach: number): THREE.Mesh {
  const g = new THREE.PlaneGeometry(reach * 4, reach * 4);
  g.rotateX(-Math.PI / 2);
  return new THREE.Mesh(
    g,
    new THREE.MeshLambertMaterial({ color: new THREE.Color(PALETTE.granite) }),
  );
}

/** The metre rule: a stack of alternating bands a metre tall standing
 * beside the plant, so a height claim can be read off the picture. */
function rule(height: number): THREE.Group {
  const group = new THREE.Group();
  const dark = new THREE.MeshBasicMaterial({ color: 0x11181d });
  const pale = new THREE.MeshBasicMaterial({ color: 0xe8eef2 });
  for (let m = 0; m < Math.ceil(height); m++) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1, 0.09), m % 2 ? pale : dark);
    band.position.set(0, m + 0.5, 0);
    group.add(band);
  }
  return group;
}

function main(): void {
  const roster = chosen();
  const rows = Math.ceil(roster.length / COLS);
  const sheetCanvas = document.getElementById("stage") as HTMLCanvasElement;
  sheetCanvas.width = CELL_W * Math.min(COLS, roster.length);
  sheetCanvas.height = CELL_H * rows;
  const sheet = sheetCanvas.getContext("2d") as CanvasRenderingContext2D;

  // One cell rendered at its own size and blitted, for the same reason the
  // sky lab does it: anything three sizes off the drawing buffer comes out
  // wrong on a sheet rendered as one tall frame.
  const cell = document.createElement("canvas");
  const renderer = new THREE.WebGLRenderer({ canvas: cell, antialias: true });
  renderer.setSize(CELL_W, CELL_H, false);
  renderer.setClearColor(0x10171d);

  const labels = document.getElementById("labels") as HTMLDivElement;
  const addLabel = (text: string, col: number, row: number, dy: number, cls = ""): void => {
    const div = document.createElement("div");
    div.className = `label ${cls}`.trim();
    div.textContent = text;
    div.style.left = `${col * CELL_W}px`;
    div.style.top = `${row * CELL_H + dy}px`;
    labels.appendChild(div);
  };

  const material = floraMaterial();
  roster.forEach((spec, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const { min, max } = spec.look.height;
    const scene = new THREE.Scene();
    // The game's two lights, at the angles a clear sky stands them at.
    scene.add(new THREE.HemisphereLight(0xdfeef6, 0x6b6f66, 1.5));
    const key = new THREE.DirectionalLight(0xfff2dc, 1.9);
    key.position.set(-0.55, 0.72, 0.42);
    scene.add(key);

    const geometry = buildFlora(spec.look, i * 7919 + 13);
    // The pair stand either side of centre, far enough apart that the wide
    // ones do not grow into each other, with the rule outboard of the tall
    // one.
    const half = max * spec.look.spread * 0.5;
    const gap = half + Math.max(half * 0.35, max * 0.1);
    for (const [k, h] of [min, max].entries()) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.scale.setScalar(h);
      mesh.position.set((k * 2 - 1) * gap, spec.look.form === "stone" ? -h * 0.42 : 0, 0);
      mesh.rotation.y = k * 1.1;
      scene.add(mesh);
    }
    scene.add(groundPlane(Math.max(max * 40, 120)));
    const barAt = -(gap + half + Math.max(max * 0.12, 0.25));
    const bar = rule(max);
    bar.position.set(barAt, 0, 0);
    scene.add(bar);

    // THE FRAME IS WHICHEVER OF THE TWO IS BINDING. A spruce needs the
    // height and a heather mat needs the width, and a cell framed on the
    // height alone puts the mat off the side of its own picture.
    const needH = max * (1 + HEADROOM * 2);
    const needW = 2 * (-barAt + 0.35);
    const frameH = Math.max(needH, (needW * CELL_H) / CELL_W);
    const frameW = (frameH * CELL_W) / CELL_H;
    // An orthographic frustum is centred on the CAMERA, so the camera is
    // swung around the subject rather than parked off to one side of it:
    // an offset position would slide the whole cell sideways instead of
    // turning it.
    const eye = Math.max(max * 0.52, frameH * 0.34);
    const yaw = 0.36;
    const dist = max * 12 + 20;
    const camera = new THREE.OrthographicCamera(
      -frameW / 2,
      frameW / 2,
      frameH / 2,
      -frameH / 2,
      0.1,
      dist * 3,
    );
    camera.position.set(Math.sin(yaw) * dist, eye + dist * 0.18, Math.cos(yaw) * dist);
    camera.lookAt(0, eye, 0);
    renderer.render(scene, camera);
    sheet.drawImage(cell, col * CELL_W, row * CELL_H);

    addLabel(spec.name, col, row, 6);
    addLabel(
      `${spec.look.form} · ${min}–${max} m · share ${spec.habitat.share}` +
        (spec.habitat.riverside ? ` → ${spec.habitat.riverside.share} on the bank` : ""),
      col,
      row,
      CELL_H - 26,
      "foot",
    );
    geometry.dispose();
  });

  renderer.dispose();
  cell.remove();
  (window as unknown as { __done: boolean }).__done = true;
}

main();

console.log(`three r${THREE.REVISION}`);
