#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE INSTALL ICONS AND THE FAVICON: the app mark — a wave standing up
// against a low sun, with the sun burning through the hollow of the barrel —
// composited over the sea's own gradient at every size a browser or a store
// asks for. Pure Node (`lib/mark-raster.mjs` inks the mark, `lib/png.mjs`
// encodes it), so the pipeline needs no native image dependency and runs
// anywhere the tests do.
//
// IT RESTATES NO GEOMETRY: `pwa/src/game/app-mark.ts` states the curves once
// and the rasterizer reads them, so the tile, the loading card's crest and
// the icon SVG cannot drift into three different waves. What it does restate
// is the PALETTE — six hexes out of `pwa/src/identity.ts`, which a
// plain-Node script has no bundler to resolve; `tests/identity_test.ts`
// holds them.
//
// THE SHARE CARD IS NOT HERE. og.png is a photograph of the game rather than
// a drawing of it — `npm run hero -- --og` writes it from a real frame.
//
//   npm run icons              # every icon, the favicon
//   npm run icons -- --sheet   # ...and a contact strip of all of them at
//                              # 1:1 in previews/, which is the only way to
//                              # LOOK at a 32-pixel favicon
//
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parseArgs } from "./lib/cli.mjs";
import { renderTile } from "./lib/mark-raster.mjs";
import { encodePng } from "./lib/png.mjs";

const args = parseArgs(
  process.argv.slice(2),
  { sheet: { kind: "flag", help: "also write previews/icon-sheet.png — every tile at 1:1" } },
  "generate-icons — the install icons and the favicon, drawn from the app mark",
);

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const iconsDir = join(root, "pwa", "public", "icons");
mkdirSync(iconsDir, { recursive: true });

// Palette — mirrors PALETTE in pwa/src/identity.ts and the SVG's stops.
const SEA_TOP = [27, 111, 138]; // #1b6f8a sea
const SEA_BOT = [11, 61, 79]; // #0b3d4f seaDeep
const FACE = [63, 167, 184]; // #3fa7b8 seaShallow
const FOAM = [242, 247, 248]; // #f2f7f8 foam
const BODY = [8, 42, 56]; // #082a38 hudShadow
const SUN = [242, 140, 40]; // #f28c28 buoy

/** One RGB triple per MARK_PARTS entry, in its order. */
const COLORS = [FACE, FOAM, BODY, SUN];

/**
 * One tile: the mark inked at `size` and laid over the sea's gradient.
 * `inset` shrinks the MARK toward the centre without touching the water
 * behind it — a maskable icon crops the tile, not the sea.
 */
function renderIcon(size, inset = 1) {
  const tile = renderTile(size, { colors: COLORS, sea: [SEA_TOP, SEA_BOT], inset });
  const rgb = Buffer.alloc(size * size * 3);
  for (let i = 0; i < size * size; i++) {
    rgb[i * 3] = tile[i * 4];
    rgb[i * 3 + 1] = tile[i * 4 + 1];
    rgb[i * 3 + 2] = tile[i * 4 + 2];
  }
  return { size, rgb, png: encodePng(size, size, rgb) };
}

/** Wrap one PNG in an ICO container (valid since Vista). */
function pngToIco(png, size) {
  const header = Buffer.alloc(6 + 16);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // count
  header[6] = size < 256 ? size : 0;
  header[7] = size < 256 ? size : 0;
  header.writeUInt16LE(1, 10); // planes
  header.writeUInt16LE(32, 12); // bpp
  header.writeUInt32LE(png.length, 14);
  header.writeUInt32LE(header.length, 18);
  return Buffer.concat([header, png]);
}

// THE MASTER RASTER — the mark at the largest size any store asks for, and
// the one file the SHELLS derive their own icon sets from (a shell imports
// the core, never another shell, so the full-resolution mark lives here, in
// the website's own icon directory, where both of them look). Not in the
// manifest: nothing serves it to a browser, and an install icon above 512
// buys nothing.
const tiles = {
  "icons/icon-1024.png": renderIcon(1024),
  "icons/pwa-192.png": renderIcon(192),
  "icons/pwa-512.png": renderIcon(512),
  "icons/pwa-512-maskable.png": renderIcon(512, 0.78),
  "icons/apple-touch-icon-180.png": renderIcon(180),
};
for (const [rel, tile] of Object.entries(tiles)) {
  writeFileSync(join(root, "pwa", "public", rel), tile.png);
}

const favicon = renderIcon(32);
writeFileSync(join(root, "pwa", "public", "favicon.ico"), pngToIco(favicon.png, 32));

console.log(`icons: ${Object.keys(tiles).join(", ")}, favicon.ico`);

/**
 * THE CONTACT STRIP — every tile at 1:1, laid out left to right on the sea's
 * own colour, so a session can look at the 32-pixel favicon beside the
 * 512-pixel tile and see which details survive the shrink. A mark judged
 * only at 512 is a mark that becomes a grey smudge in a browser tab.
 */
function writeSheet() {
  const strip = [
    favicon,
    renderIcon(64),
    renderIcon(128),
    tiles["icons/pwa-192.png"],
    renderIcon(256),
    tiles["icons/pwa-512.png"],
    tiles["icons/pwa-512-maskable.png"],
  ];
  const pad = 16;
  const width = strip.reduce((w, t) => w + t.size + pad, pad);
  const height = 512 + pad * 2;
  const rgb = Buffer.alloc(width * height * 3);
  for (let i = 0; i < width * height; i++) {
    rgb[i * 3] = 24;
    rgb[i * 3 + 1] = 28;
    rgb[i * 3 + 2] = 32;
  }
  let x0 = pad;
  for (const tile of strip) {
    const y0 = pad + (512 - tile.size);
    for (let y = 0; y < tile.size; y++) {
      for (let x = 0; x < tile.size; x++) {
        const from = (y * tile.size + x) * 3;
        const to = ((y0 + y) * width + x0 + x) * 3;
        rgb[to] = tile.rgb[from];
        rgb[to + 1] = tile.rgb[from + 1];
        rgb[to + 2] = tile.rgb[from + 2];
      }
    }
    x0 += tile.size + pad;
  }
  const out = join(root, "previews", "icon-sheet.png");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, encodePng(width, height, rgb));
  console.log(`sheet: ${out}`);
}

if (args.sheet) writeSheet();
