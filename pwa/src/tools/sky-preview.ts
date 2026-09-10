// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKY PREVIEW HARNESS — the page `scripts/sky-preview.mjs` drives.
// Adapted from the sibling rally game's, which sheets a country of roads;
// this one sheets a coast.
//
// IT EXISTS BECAUSE THE SKY IS THE ONE PART OF THIS GAME A SCREENSHOT OF A
// RUN CANNOT REVIEW. A seed is dealt ONE sky (R19) and ridden at ONE hour
// (R13), so a `make screenshots` of a run says whether that single sky is
// wrong and nothing at all about the ladder it sits on. And the ladder is
// the whole design: you have to see the squall beside the overcast to know
// either is heavy enough, and the sunrise beside the noon beside the sunset
// to know the day actually turns. This sheet puts them side by side.
//
// It is the start card's proof, too. That card lets a player ask for a time
// and a weather outright (`menu-start.tsx`), so the combinations it offers
// are combinations that have to LOOK right — including the ones no seed
// would ever deal, like a squall at sunrise.
//
// WHAT IS DRAWN IS THE REAL GAME. Every cell is `createRenderer` over a real
// `createGame`, so the sea, the shore, the craft, the two lights, the fog,
// the dome and the cloud deck are the ones a player gets — not a diorama
// that can drift from them. The level is generated ONCE and each cell
// overrides its hour and its weather, which is both honest (one coast, so
// the sky is the only thing changing across the sheet) and the difference
// between a sheet that builds in seconds and one that builds in a minute.
//
// Sets `window.__done` when the sheet is on screen, which is what the
// driving script waits for.

import * as THREE from "three";

import {
  SEASONS,
  WEATHER_IDS,
  createGame,
  generateLevel,
  step,
  type Season,
  type Weather,
} from "@engine";

import { createRenderer } from "../game/renderer.ts";

/** The sheet's own seed. One coast for every cell: the sky is what is being
 * compared, so the shore under it must not move. */
const SEED = 38;

/** The hours the columns stand at, in solar time: every three hours round
 * the clock, so the sheet is the whole day AND the whole night. Which of
 * them are dark is the season's: in July the 21:00 column is a sunset and
 * the 00:00 one a blue twilight, in October both are black under the moon
 * and the 06:00 one is a dawn. The `--season` flag picks which. */
const HOURS = [0, 3, 6, 9, 12, 15, 18, 21];

/** One cell, px. Wide enough that the horizon is a horizon rather than a
 * line, and small enough that five columns fit a sheet a person can look at
 * without scrolling. */
const CELL_W = 384;
const CELL_H = 240;

/** How long each cell is ridden before it is photographed, s. The sea has
 * to have somewhere to be — a wave field at t=0 is flat — and the camera
 * rig has to have eased onto the craft. Two seconds at 120 Hz is 240 steps
 * and costs nothing next to the draw. */
const WARM_S = 2;

/** Which of a list this run wants, off the page's own query string, or all
 * of them. `--rows=squall,rain`, `--hours=0,12` and `--season=autumn` on
 * the script become `?rows=…&hours=…&season=…` here, and THIS file owns
 * what they mean. A season that is not one of the four is every season,
 * of which the sheet draws the first: one coast, one season, one sheet. */
function chosen<T>(all: readonly T[], param: string, key: (item: T) => string): T[] {
  const asked = new URLSearchParams(location.search).get(param);
  if (!asked) return [...all];
  const want = new Set(asked.split(",").map((s) => s.trim().toLowerCase()));
  const kept = all.filter((item) => want.has(key(item).toLowerCase()));
  return kept.length > 0 ? kept : [...all];
}

async function main(): Promise<void> {
  const rows = chosen(WEATHER_IDS, "rows", (w) => w);
  const hours = chosen(HOURS, "hours", (h) => String(h));
  const asked = new URLSearchParams(location.search).get("season");
  const season: Season = SEASONS.find((s) => s === asked) ?? "summer";

  const sheetCanvas = document.getElementById("stage") as HTMLCanvasElement;
  sheetCanvas.width = CELL_W * hours.length;
  sheetCanvas.height = CELL_H * rows.length;
  const sheet = sheetCanvas.getContext("2d") as CanvasRenderingContext2D;

  // ONE CELL IS ONE FRAME, AND THE SHEET IS PASTED TOGETHER OUT OF THEM.
  //
  // The obvious harness renders every cell into one tall canvas behind a
  // scissor, and for a sky drawn per view ray it makes no difference. It is
  // wrong for anything sized in PIXELS: three hands a points material a
  // `scale` off the DRAWING BUFFER's height, so the spray and the wake on a
  // five-row sheet come out five times the size they are in the game — and
  // a different size again on a two-row one, which is the same sheet
  // disagreeing with itself. Rendering at the cell's own size and blitting
  // the result puts every per-pixel thing at the size a player would see.
  const cell = document.createElement("canvas");
  cell.width = CELL_W;
  cell.height = CELL_H;
  // The renderer measures its own canvas box, which for a detached element
  // is zero — so the box is given to it explicitly before it is built.
  cell.style.width = `${CELL_W}px`;
  cell.style.height = `${CELL_H}px`;
  document.body.appendChild(cell);
  cell.style.position = "absolute";
  cell.style.left = "-10000px";

  const renderer = createRenderer(cell);

  const labels = document.getElementById("labels") as HTMLDivElement;
  const addLabel = (text: string, col: number, row: number, dy = 0): void => {
    const div = document.createElement("div");
    div.className = "label";
    div.textContent = text;
    div.style.left = `${col * CELL_W}px`;
    div.style.top = `${row * CELL_H + dy}px`;
    labels.appendChild(div);
  };

  // The coast, once. Every cell rides this same shore under a different sky.
  const dealt = generateLevel(SEED);

  for (let r = 0; r < rows.length; r++) {
    const weather: Weather = rows[r];
    for (let c = 0; c < hours.length; c++) {
      const hour = hours[c];
      const state = createGame({ seed: SEED, level: dealt, hour, season, weather, quiet: true });
      renderer.load(state);
      renderer.camera.restand();
      const steps = Math.round(WARM_S * 120);
      for (let i = 0; i < steps; i++) {
        step(state, { steer: 0, throttle: 0, reverse: 0, lean: 0, reset: false });
        renderer.observe(state);
      }
      renderer.render(state, 1 / 60);
      sheet.drawImage(cell, c * CELL_W, r * CELL_H);
      addLabel(`${weather.toUpperCase()}  ${season.toUpperCase()}  ${clock(hour)}`, c, r);
    }
  }

  renderer.dispose();
  cell.remove();
  (window as unknown as { __done: boolean }).__done = true;
}

/** An hour as a rider would read it off a clock. */
function clock(hour: number): string {
  const h = Math.floor(hour);
  const m = Math.round((hour - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

void main();

// Keep the three import from being tree-shaken out of a harness that only
// reaches it through the renderer — and make the version obvious in the
// console when a cell comes back black.
console.log(`three r${THREE.REVISION}`);
