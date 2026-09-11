#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WAVES LAB — the sea on its own, with nothing riding it.
//
// A wave model is judged by the SEA it makes, and a screenshot shows one
// wave. So this asks the engine's own `surfaceAt` for the whole picture,
// and draws it, pure Node, no browser:
//
//   A  a TRANSECT from the shore straight out to sea, through the middle
//      of the course, at several moments a second apart — the surface as
//      the hull will meet it, with the depth a wave breaks at marked;
//      under it the sea bed the same stations stand over
//   B  Hs and Tp against the offshore distance — the fetch law made
//      visible — beside the height the field actually delivers at each
//      station (the envelope over one period, shoaling and the breaking
//      cap included)
//   C  the SPECTRUM the sea is built from: each component's amplitude
//      against its deep-water wavelength
//
// and prints a table of the same numbers. Required before and after any
// change to engine/game/water.ts; nothing in here restates the physics —
// every number is read off the engine.
//
//   npm run waves -- --seed 38                 # previews/waves-38.png
//   npm run waves -- --seed 38 --wind 12       # the same shore in a gale
//   npm run waves -- --seed 38 --from 90       # ...with the wind from the east
//   npm run waves -- --seed 38 --hs 20         # a twenty-metre storm sea sent in
//   npm run waves -- --seed 38 --reach 400 --times 8

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { parseArgs } from "./lib/cli.mjs";
import { createDrawing } from "./lib/draw.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const {
  generateLevel,
  createSea,
  createWind,
  seaShares,
  seaSummary,
  stormAt,
  oceanOut,
  bedAt,
  surfaceAt,
  windSpeedAt,
  heightAt,
  wavenumber,
  shoaling,
  sampleField,
  cumulative,
  TUNING,
  engineVersion,
} = await import(join(root, "engine/index.ts"));

const args = parseArgs(
  process.argv.slice(2),
  {
    seed: { kind: "number", default: 1, help: "the level's seed" },
    wind: { kind: "number", help: "override the wind speed, m/s" },
    from: { kind: "number", help: "override the wind's from-direction, degrees" },
    hs: {
      kind: "number",
      help: "quote the sea by its significant height, m, instead of growing it from the wind",
    },
    tp: { kind: "number", help: "...and its peak period, s (the height's own when left out)" },
    reach: { kind: "number", default: 600, help: "how far out the transect runs, m" },
    times: { kind: "number", default: 5, help: "moments drawn on the transect, a second apart" },
    out: { kind: "string", help: "file name under previews/ (no extension)" },
  },
  "usage: npm run waves -- --seed n [--wind m/s] [--from deg] [--hs m [--tp s]] [--reach m] [--times n] [--out name]",
);

// ── The sea ─────────────────────────────────────────────────────────────
const level = generateLevel(args.seed);
const wind = {
  from: args.from !== undefined ? (args.from * Math.PI) / 180 : level.wind.from,
  speed: args.wind ?? level.wind.speed,
};
const override = args.hs !== undefined ? { hs: args.hs, tp: args.tp } : undefined;
const sea = createSea(level, args.seed, wind, override);
const air = createWind(level, wind, sea.shelter);
const deg = (rad) => ((rad * 180) / Math.PI + 360) % 360;
// `bedAt`, not the field: past the level's rim the bed keeps falling to the
// open ocean's floor, and that is the depth the sea's breaking clip is
// measured against (`ocean.ts`).
const depthAt = (x, z) => Math.max(0, -bedAt(level, x, z));
const offshoreAt = (x, z) => sampleField(level.offshore, x, z);

// ── The transect: from the shore, into the wind, through the course's middle ─
// The wind blows off the sea (R12), so heading toward where it comes FROM
// is heading out; checked against the offshore field rather than trusted,
// so a `--from` blowing off the land still draws a transect that goes to
// sea.
const path = level.course.path;
const cum = cumulative(path);
const half = cum[cum.length - 1] / 2;
let mid = path[0];
for (let i = 0; i + 1 < path.length; i++) {
  if (cum[i + 1] >= half) {
    const t = (half - cum[i]) / (cum[i + 1] - cum[i] || 1);
    mid = {
      x: path[i].x + (path[i + 1].x - path[i].x) * t,
      z: path[i].z + (path[i + 1].z - path[i].z) * t,
    };
    break;
  }
}
let dx = Math.sin(wind.from);
let dz = Math.cos(wind.from);
if (offshoreAt(mid.x + dx * 50, mid.z + dz * 50) < offshoreAt(mid.x - dx * 50, mid.z - dz * 50)) {
  dx = -dx;
  dz = -dz;
}
let sx = mid.x;
let sz = mid.z;
for (let s = 0; s < 400; s += 1) {
  if (sampleField(level.ground, sx - dx, sz - dz) >= 0) break;
  sx -= dx;
  sz -= dz;
}

/** One station of the transect, every number read off the engine. */
function station(s) {
  const x = sx + dx * s;
  const z = sz + dz * s;
  const depth = depthAt(x, z);
  const offshore = offshoreAt(x, z);
  const { Hs, Tp } = seaSummary(sea, x, z);
  const shares = seaShares(sea, x, z);
  const surface = surfaceAt(sea, level, x, z, 0);
  const current = Math.hypot(surface.vx, surface.vz);
  const storm = stormAt(level.bounds, x, z);
  // The envelope the field delivers here: the surface over one peak period.
  let lo = Infinity;
  let hi = -Infinity;
  const n = 48;
  for (let i = 0; i < n; i++) {
    const h = heightAt(sea, level, x, z, (i / n) * Tp);
    if (h < lo) lo = h;
    if (h > hi) hi = h;
  }
  const H = hi - lo;
  // The dominant component at this depth: the one shoaling leaves biggest.
  // ...at the share its own BAND stands at here, or the open band's
  // four-hundred-metre storm swell would be the answer over every beach.
  let best = 0;
  let wavelength = 0;
  const d = Math.max(depth, TUNING.sea.minDepth);
  for (const c of sea.components) {
    const k = wavenumber(c.omega, d);
    const a = c.amp * shoaling(c.omega, k, d) * shares[c.band];
    if (a > best) {
      best = a;
      wavelength = (2 * Math.PI) / k;
    }
  }
  const breaking = depth > 0.05 && H >= TUNING.sea.breakingRatio * depth * 0.95;
  // The derived characteristics — what the four numbers above MEAN.
  // Steepness H/λ is what the eye reads (Michell breaks a wave at 1/7);
  // celerity λ/T is how fast the crest travels; d/λ says which of the
  // three regimes the wave is in, which is what decides whether the bed
  // is doing anything to it at all.
  const steepness = wavelength > 0 ? H / wavelength : 0;
  const celerity = Tp > 0 ? wavelength / Tp : 0;
  const ratio = wavelength > 0 ? depth / wavelength : 0;
  const regime = ratio > 0.5 ? "deep" : ratio < 0.05 ? "shallow" : "inter";
  return {
    s,
    x,
    z,
    depth,
    offshore,
    ocean: shares.ocean,
    local: shares.local,
    open: shares.open,
    storm,
    wind: windSpeedAt(air, 2, x, z),
    current,
    Hs,
    Tp,
    H,
    wavelength,
    breaking,
    steepness,
    celerity,
    ratio,
    regime,
  };
}
/** How many components one band was laid with. */
function bandCount(band) {
  return sea.components.filter((c) => c.band === band).length;
}

const stations = [];
for (let s = 0; s <= args.reach; s += 1) stations.push(station(s));
const outermostBreak = [...stations].reverse().find((st) => st.breaking) ?? null;

// ── Say it ──────────────────────────────────────────────────────────────
const pad = (v, n) => String(v).padStart(n);
console.log(
  `waves — engine ${engineVersion} · seed ${args.seed} (${level.biome}) · wind ${wind.speed.toFixed(1)} m/s from ${deg(wind.from).toFixed(0)}°` +
    `${args.wind !== undefined || args.from !== undefined ? ` (level's own ${level.wind.speed.toFixed(1)} m/s from ${deg(level.wind.from).toFixed(0)}°)` : ""}` +
    `${override ? ` · sea quoted at Hs ${override.hs} m` : ""}` +
    ` · ocean band ${bandCount("ocean")} components · Hs ${sea.hsRef.toFixed(2)} m at the reference fetch ${(sea.fetchRef / 1000).toFixed(1)} km · Tp ${sea.tp.toFixed(2)} s` +
    ` · local band ${bandCount("local")} · Hs ${sea.localHs.toFixed(2)} m · Tp ${sea.localTp.toFixed(2)} s` +
    ` · open band ${bandCount("open")} · Hs ${sea.openHs.toFixed(2)} m · Tp ${sea.openTp.toFixed(2)} s`,
);
console.log(
  `dials — height ×${TUNING.sea.heightScale} · period ×${TUNING.sea.periodScale} · γ ${TUNING.sea.peakEnhancement}` +
    ` · quoted steepness ${TUNING.sea.steepness} · crest ×${TUNING.sea.crestSharpness}` +
    ` · breaking Hs/d ${TUNING.sea.breakingHs} · spread ±${deg(TUNING.sea.spread).toFixed(0)}°`,
);
console.log(
  `transect from (${sx.toFixed(0)}, ${sz.toFixed(0)}) on the shore, heading ${deg(Math.atan2(dx, dz)).toFixed(0)}°, ${args.reach} m out` +
    (outermostBreak
      ? ` · waves break inside ${outermostBreak.s} m of the shore (${outermostBreak.depth.toFixed(2)} m of water)`
      : " · nothing breaks on this transect"),
);
console.log(
  [
    pad("out m", 6),
    pad("offshore", 9),
    pad("depth", 7),
    pad("ocean", 6),
    pad("local", 6),
    pad("open", 6),
    pad("U m/s", 6),
    pad("Hs", 6),
    pad("Tp", 5),
    pad("H here", 7),
    pad("λ dom", 7),
    pad("H/λ", 6),
    pad("c m/s", 6),
    pad("d/λ", 6),
    pad("regime", 7),
    "  breaking",
  ].join(" "),
);
// The near ladder is fine-grained because the shallows are where the model
// does the most in the least distance; past it, ten even steps however far
// out `--reach` was asked to run.
const rows = [0, 5, 10, 15, 20, 30, 40, 50, 75, 100, 150, 200, 300, 400, 500, 600].filter(
  (s) => s <= args.reach,
);
for (let i = 1; i <= 10; i++) {
  const s = Math.round((600 + ((args.reach - 600) * i) / 10) / 5) * 5;
  if (s > 600 && s <= args.reach && !rows.includes(s)) rows.push(s);
}
for (const s of rows) {
  const st = stations[s];
  console.log(
    [
      pad(st.s, 6),
      pad(st.offshore.toFixed(0), 9),
      pad(st.depth.toFixed(2), 7),
      pad(st.ocean.toFixed(2), 6),
      pad(st.local.toFixed(2), 6),
      pad(st.open.toFixed(2), 6),
      pad(st.wind.toFixed(1), 6),
      pad(st.Hs.toFixed(2), 6),
      pad(st.Tp.toFixed(1), 5),
      pad(st.H.toFixed(2), 7),
      pad(st.wavelength.toFixed(1), 7),
      pad(st.steepness.toFixed(3), 6),
      pad(st.celerity.toFixed(1), 6),
      pad(st.ratio.toFixed(3), 6),
      pad(st.regime, 7),
      st.breaking ? "  yes" : "  -",
    ].join(" "),
  );
}
console.log("\nspectrum (deep water), longest first, each component's band beside it:");
for (const c of sea.components) {
  const rel = ((deg(Math.atan2(c.dirX, c.dirZ)) - deg(wind.from + Math.PI) + 540) % 360) - 180;
  console.log(
    `  ${c.band.padEnd(5)}  T ${((2 * Math.PI) / c.omega).toFixed(2).padStart(5)} s  λ ${((2 * Math.PI) / c.k0).toFixed(1).padStart(6)} m  ` +
      `a ${c.amp.toFixed(3)} m  ak ${(c.amp * c.k0).toFixed(3)}  ` +
      `${rel >= 0 ? "+" : ""}${rel.toFixed(0)}° off the wind`,
  );
}

// ── Out into the open ocean ─────────────────────────────────────────────
// The transect CONTINUED, straight on past the edge of the built level
// (`ocean.ts`). The whole claim is in this table: the sea builds every
// metre of the way out, the wind freshens with it, the bed keeps falling so
// that nothing clips the sea on the way up, and both stop at the storm
// rather than running away. A dip anywhere in the Hs column is the handover
// between the coast's spectrum and the storm's going wrong.
{
  const rim = (() => {
    for (let s = 0; s < 20_000; s += 4) {
      const st = station(s);
      if (oceanOut(level.bounds, st.x, st.z) > 0) return s;
    }
    return null;
  })();
  if (rim === null) {
    console.log("\nthe transect never leaves the level: no open ocean on this heading");
  } else {
    console.log("\nout into the open ocean — past the rim, where the coast stops sheltering:");
    console.log(
      [
        pad("out m", 6),
        pad("past m", 7),
        pad("storm", 6),
        pad("depth", 7),
        pad("ocean", 6),
        pad("open", 6),
        pad("U m/s", 6),
        pad("Hs", 6),
        pad("Tp", 5),
        pad("H here", 7),
        pad("λ dom", 7),
        pad("H/λ", 6),
      ].join(" "),
    );
    const full = TUNING.sea.open.reach;
    for (let i = 0; i <= 12; i++) {
      const st = station(rim + Math.round((full * 1.2 * i) / 12));
      console.log(
        [
          pad(st.s, 6),
          pad(oceanOut(level.bounds, st.x, st.z).toFixed(0), 7),
          pad(st.storm.toFixed(2), 6),
          pad(st.depth.toFixed(1), 7),
          pad(st.ocean.toFixed(2), 6),
          pad(st.open.toFixed(2), 6),
          pad(st.wind.toFixed(1), 6),
          pad(st.Hs.toFixed(2), 6),
          pad(st.Tp.toFixed(1), 5),
          pad(st.H.toFixed(2), 7),
          pad(st.wavelength.toFixed(1), 7),
          pad(st.steepness.toFixed(3), 6),
        ].join(" "),
      );
    }
  }
}

// ── R27, R28 — up the river ─────────────────────────────────────────────
// The other kind of water this level holds. The ocean band should be gone
// within a few hundred metres of the mouth, the local band should be all
// that is left, and the current should be quickening the whole way up as
// the channel closes on it.
if (level.river.length > 1) {
  console.log("\nup the river (R26) — the water the ocean's sea does not reach:");
  console.log(
    [
      pad("up m", 6),
      pad("wide m", 7),
      pad("depth", 7),
      pad("ocean", 6),
      pad("local", 6),
      pad("U m/s", 6),
      pad("Hs", 6),
      pad("Tp", 5),
      pad("flow", 6),
    ].join(" "),
  );
  const river = level.river;
  let walked = 0;
  let next = 0;
  for (let i = 0; i < river.length; i++) {
    if (i > 0) {
      walked += Math.hypot(river[i].x - river[i - 1].x, river[i].z - river[i - 1].z);
    }
    if (walked < next && i > 0 && i < river.length - 1) continue;
    next = walked + 200;
    const { x, z } = river[i];
    const shares = seaShares(sea, x, z);
    const { Hs, Tp } = seaSummary(sea, x, z);
    const surface = surfaceAt(sea, level, x, z, 0);
    console.log(
      [
        pad(walked.toFixed(0), 6),
        pad((2 * offshoreAt(x, z)).toFixed(1), 7),
        pad(depthAt(x, z).toFixed(2), 7),
        pad(shares.ocean.toFixed(2), 6),
        pad(shares.local.toFixed(2), 6),
        pad(windSpeedAt(air, 2, x, z).toFixed(1), 6),
        pad(Hs.toFixed(2), 6),
        pad(Tp.toFixed(1), 5),
        pad(Math.hypot(surface.vx, surface.vz).toFixed(2), 6),
      ].join(" "),
    );
  }
}

// ── Draw it ─────────────────────────────────────────────────────────────
const INK = {
  paper: [16, 18, 22],
  panel: [22, 25, 31],
  rule: [46, 50, 58],
  label: [206, 212, 222],
  dim: [124, 130, 142],
  bed: [120, 104, 80],
  bedFill: [58, 50, 40],
  early: [92, 160, 220],
  late: [230, 236, 250],
  hs: [96, 214, 158],
  h: [250, 206, 84],
  tp: [232, 96, 72],
  breaking: [244, 132, 96],
  bar: [92, 160, 220],
};
const W = 1280;
const A = { x: 60, y: 40, w: W - 80, h: 220 };
const BED = { x: 60, y: A.y + A.h + 30, w: W - 80, h: 90 };
const B = { x: 60, y: BED.y + BED.h + 40, w: 760, h: 200 };
const C = { x: B.x + B.w + 60, y: B.y, w: W - (B.x + B.w + 60) - 20, h: 200 };
const canvas = createDrawing(W, C.y + C.h + 40, INK.paper);
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const panel = (box, title) => {
  canvas.fillRect(box.x, box.y, box.w, box.h, INK.panel);
  canvas.rect(box.x, box.y, box.w, box.h, INK.rule);
  canvas.text(title, box.x, box.y - 10, INK.label, 1);
};
canvas.text(
  `WAVES  SEED ${args.seed}  WIND ${wind.speed.toFixed(1)} M/S FROM ${deg(wind.from).toFixed(0)}°  HS ${sea.hsRef.toFixed(2)} M  TP ${sea.tp.toFixed(1)} S`,
  A.x,
  10,
  INK.label,
  2,
);

// A — the surface, `times` moments deep, at a vertical scale that fits the
// biggest crest on the transect.
panel(A, "A  THE TRANSECT: SHORE (LEFT) OUT TO SEA, ONE MOMENT PER SECOND, DARK = EARLY");
const sxp = (s) => A.x + (s / args.reach) * A.w;
let peak = 0.2;
for (const st of stations) peak = Math.max(peak, st.H / 2);
const vScale = (A.h / 2 - 12) / peak;
const zeroY = A.y + A.h / 2;
canvas.line(A.x, zeroY, A.x + A.w, zeroY, INK.rule);
for (let k = 0; k < args.times; k++) {
  const t = k;
  const ink = mix(INK.early, INK.late, args.times > 1 ? k / (args.times - 1) : 1);
  const pts = stations.map((st) => [
    sxp(st.s),
    zeroY - heightAt(sea, level, st.x, st.z, t) * vScale,
  ]);
  canvas.polyline(pts, ink, 1);
}
if (outermostBreak) {
  const bx = sxp(outermostBreak.s);
  canvas.line(bx, A.y + 2, bx, A.y + A.h - 2, INK.breaking);
  canvas.text(
    `BREAKS INSIDE ${outermostBreak.s} M (${outermostBreak.depth.toFixed(1)} M DEEP)`,
    bx + 4,
    A.y + 4,
    INK.breaking,
    1,
  );
}
/** The pitch the metres-out axes are labelled at: the coarsest round step
 * that leaves at most a dozen labels, so a transect run out into the open
 * ocean does not print its axis as one smear of digits. */
const tickStep = [100, 250, 500, 1000, 2000, 5000].find((m) => args.reach / m <= 12) ?? 10_000;

// A reference bar that fits the panel: the largest of 1, 0.5, 0.25 m that does.
const bar = [1, 0.5, 0.25, 0.1].find((m) => m * vScale <= A.h / 2 - 14) ?? 0.1;
canvas.line(A.x + 8, zeroY - bar * vScale, A.x + 8, zeroY, INK.dim, 2);
canvas.text(`${bar} M`, A.x + 12, zeroY - bar * vScale, INK.dim, 1);
for (let s = 0; s <= args.reach; s += tickStep)
  canvas.text(`${s}`, sxp(s) - 6, A.y + A.h + 3, INK.dim, 1);
canvas.text("M OUT", A.x + A.w - 30, A.y + A.h + 3, INK.dim, 1);

// The bed under the same stations, at its own scale.
panel(BED, "THE BED UNDER IT (M)");
let deepest = 1;
for (const st of stations) deepest = Math.max(deepest, st.depth);
const bedY = (d) => BED.y + 4 + (d / deepest) * (BED.h - 8);
const bed = stations.map((st) => [sxp(st.s), bedY(st.depth)]);
for (let i = 0; i + 1 < bed.length; i++) {
  canvas.line(bed[i][0], bed[i][1], bed[i][0], BED.y + BED.h - 1, INK.bedFill);
}
canvas.polyline(bed, INK.bed, 1);
for (const d of [5, 10, 15, 20, 25]) {
  if (d > deepest) break;
  canvas.line(BED.x, bedY(d), BED.x + 6, bedY(d), INK.dim);
  canvas.text(`${d}`, BED.x + 8, bedY(d) - 3, INK.dim, 1);
}
if (outermostBreak)
  canvas.line(sxp(outermostBreak.s), BED.y, sxp(outermostBreak.s), BED.y + BED.h, INK.breaking);

// B — Hs by the fetch law, the delivered H, both against offshore distance.
panel(
  B,
  "B  HS BY THE FETCH LAW (GREEN), H DELIVERED HERE (YELLOW), TP (RED, RIGHT AXIS) VS METRES OUT",
);
let maxH = 0.1;
for (const st of stations) maxH = Math.max(maxH, st.Hs, st.H);
const hy = (h) => B.y + B.h - 6 - (h / maxH) * (B.h - 24);
const bxp = (s) => B.x + (s / args.reach) * B.w;
canvas.polyline(
  stations.map((st) => [bxp(st.s), hy(st.Hs)]),
  INK.hs,
  2,
);
canvas.polyline(
  stations.map((st) => [bxp(st.s), hy(st.H)]),
  INK.h,
  1,
);
const maxTp = Math.max(1, sea.tp * 1.5);
const ty = (tp) => B.y + B.h - 6 - (tp / maxTp) * (B.h - 24);
canvas.polyline(
  stations.map((st) => [bxp(st.s), ty(st.Tp)]),
  INK.tp,
  1,
);
for (const h of [0.25, 0.5, 1, 1.5, 2]) {
  if (h > maxH) break;
  canvas.line(B.x, hy(h), B.x + B.w, hy(h), INK.rule);
  canvas.text(`${h} M`, B.x + 3, hy(h) - 9, INK.dim, 1);
}
canvas.text(`TP ${sea.tp.toFixed(1)} S`, B.x + B.w - 60, ty(sea.tp) - 9, INK.tp, 1);
for (let s = 0; s <= args.reach; s += tickStep)
  canvas.text(`${s}`, bxp(s) - 6, B.y + B.h + 3, INK.dim, 1);

// C — the spectrum: one bar per component, amplitude against wavelength.
panel(C, "C  SPECTRUM: AMPLITUDE (M) VS DEEP-WATER WAVELENGTH (M)");
const comps = [...sea.components].sort((a, b) => a.k0 - b.k0);
const maxAmp = Math.max(0.01, ...comps.map((c) => c.amp));
const maxL = Math.max(...comps.map((c) => (2 * Math.PI) / c.k0)) * 1.15;
const barW = Math.max(6, (C.w / comps.length) * 0.5);
for (const c of comps) {
  const lambda = (2 * Math.PI) / c.k0;
  const x = C.x + (lambda / maxL) * (C.w - 10);
  const h = (c.amp / maxAmp) * (C.h - 30);
  canvas.fillRect(x - barW / 2, C.y + C.h - 6 - h, barW, h, INK.bar);
  canvas.text(`${lambda.toFixed(0)}`, x - 6, C.y + C.h + 3, INK.dim, 1);
  canvas.text(`${c.amp.toFixed(2)}`, x - 10, C.y + C.h - 14 - h, INK.label, 1);
}
canvas.text("M", C.x + C.w - 8, C.y + C.h + 3, INK.dim, 1);

const outDir = join(root, "previews");
mkdirSync(outDir, { recursive: true });
const name = args.out ?? `waves-${args.seed}${args.wind !== undefined ? `-w${args.wind}` : ""}`;
const file = join(outDir, `${name}.png`);
writeFileSync(file, canvas.toPng());
console.log(`\nwrote ${file}`);
