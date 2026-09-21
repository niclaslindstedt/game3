#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SURF LAB — how the sea BUILDS coming ashore, as a schematic.
//
// `make waves` draws the sea's machinery: the spectrum it was laid from, the
// transect a dozen moments deep, the fetch law as a curve. That picture is a
// tangle on purpose — it is every component at once — and a tangle cannot
// answer the two questions a rider actually asks:
//
//   HOW FAR APART ARE THE WAVES, and does that change on the way in?
//   WHERE DOES THE SEA GO OVER, and how much white is on it out at sea?
//
// So this is the same sea read the way an oceanographer reads a wave record
// and the way a rider reads the water: ONE LINE PER PICTURE, waves counted by
// ZERO-UP-CROSSING (the textbook wave-by-wave analysis — each upward crossing
// of the still water opens a wave, its height is crest-to-trough inside it and
// its period is the time to the next), and every number that comes out read
// off the engine rather than restated here.
//
//   A  THE WAVE TRAIN — the surface along one line from the shore out to sea
//      at ONE instant, over the bed it stands on, with every crest ticked and
//      the gaps between them measured. This is the spacing question, drawn.
//   B  THE LADDER — one row per station offshore: forty seconds of water at
//      that one point, all rows at one scale. Read down it and the sea builds:
//      the rows grow, the crests spread, and the last few rows are surf.
//   C  HOW IT BUILDS — wave height and crest spacing against metres out, as
//      two clean curves. The shape `make waves` panel B has for Hs, for the
//      two numbers a rider feels instead.
//   D  WHERE IT GOES OVER — the three things that put white on a sea, drawn
//      apart (`pwa/src/game/water-break.ts`, the renderer's own rule): the
//      SURF the bed trips, the CREST spilling in deep water, the WHITECAPS
//      the wind blows off. Offshore foam that is not the storm is this panel
//      standing up where the depth load is still flat.
//
//   npm run surf -- --seed 38                    # previews/surf-38.png
//   npm run surf -- --seed 38 --biome mangrove
//   npm run surf -- --seed 38 --wind 12          # the same shore in a gale
//   npm run surf -- --seed 38 --swell 6          # R36 — a big groundswell on it
//   npm run surf -- --seed 38 --ride 30          # the encounter period at 30 m/s

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { parseArgs } from "./lib/cli.mjs";
import { createDrawing } from "./lib/draw.mjs";
import { aliasEngine } from "./lib/engine-alias.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const {
  generateLevel,
  BIOME_IDS,
  isBiomeId,
  createSea,
  createWind,
  seaSummary,
  seaShares,
  stormSeaAt,
  stormRamp,
  oceanOut,
  oceanWind,
  bedAt,
  heightAt,
  surfaceAt,
  windSpeedAt,
  wavenumber,
  sampleField,
  cumulative,
  TUNING,
  engineVersion,
} = await import(join(root, "engine/index.ts"));
// The renderer's own breaking rule, through the alias — never a second copy
// of it here, or this lab agrees with the water until the day one of them
// moves.
aliasEngine(root);
const { breakBands, breakingParts, depthLoad } = await import(
  join(root, "pwa/src/game/water-break.ts")
);

const args = parseArgs(
  process.argv.slice(2),
  {
    seed: { kind: "number", default: 1, help: "the level's seed" },
    biome: {
      kind: "string",
      default: "taiga",
      help: "which coast the seed is built on (taiga, mangrove, arctic, karst)",
    },
    wind: { kind: "number", help: "override the wind speed, m/s" },
    from: { kind: "number", help: "override the wind's from-direction, degrees" },
    hs: { kind: "number", help: "quote the sea by its significant height, m" },
    tp: { kind: "number", help: "...and its peak period, s (the height's own when left out)" },
    swell: { kind: "number", help: "R36 — the swell standing off the coast, m (1-20)" },
    reach: { kind: "number", default: 600, help: "how far out the lab reads, m" },
    record: { kind: "number", default: 40, help: "seconds of water drawn in each ladder row" },
    stats: {
      kind: "number",
      default: 240,
      help: "seconds of water the wave statistics are counted over",
    },
    ride: {
      kind: "number",
      default: 25,
      help: "the ride speed the encounter period is quoted at, m/s",
    },
    out: { kind: "string", help: "file name under previews/ (no extension)" },
  },
  "usage: npm run surf -- --seed n [--biome taiga|mangrove|arctic|karst] [--wind m/s] [--from deg] [--hs m [--tp s]] [--swell m] [--reach m] [--record s] [--stats s] [--ride m/s] [--out name]",
);

if (!isBiomeId(args.biome)) {
  console.error(`unknown biome "${args.biome}" (${BIOME_IDS.join(", ")})`);
  process.exit(2);
}

const level = generateLevel(args.seed, { biome: args.biome, swell: args.swell });
const wind = {
  from: args.from !== undefined ? (args.from * Math.PI) / 180 : level.wind.from,
  speed: args.wind ?? level.wind.speed,
};
const override = args.hs !== undefined ? { hs: args.hs, tp: args.tp } : undefined;
const sea = createSea(level, args.seed, wind, override);
const air = createWind(level, wind, sea.shelter);
const deg = (rad) => ((rad * 180) / Math.PI + 360) % 360;
// `bedAt`, not the field: past the rim the bed keeps falling to the open
// ocean's floor, and that is the depth the breaking clip is measured against.
const depthAt = (x, z) => Math.max(0, -bedAt(level, x, z));
const offshoreAt = (x, z) => sampleField(level.offshore, x, z);

// ── The line out to sea ─────────────────────────────────────────────────
// From the waterline at the middle of the course, straight into the wind
// (R12 blows it off the sea) — checked against the offshore field rather
// than trusted, so a `--from` off the land still reads seaward.
const path = level.course.path;
const cum = cumulative(path);
const half = cum[cum.length - 1] / 2;
let mid = path[0];
for (let i = 0; i + 1 < path.length; i++) {
  if (cum[i + 1] >= half) {
    const f = (half - cum[i]) / (cum[i + 1] - cum[i] || 1);
    mid = {
      x: path[i].x + (path[i + 1].x - path[i].x) * f,
      z: path[i].z + (path[i + 1].z - path[i].z) * f,
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
const at = (s) => ({ x: sx + dx * s, z: sz + dz * s });

// ── Counting waves: the zero-up-crossing record ─────────────────────────
/** The standard wave-by-wave analysis of a record of the surface, MEAN
 * REMOVED: every upward crossing of the mean opens a wave, which runs to the
 * next one. Its HEIGHT is crest minus trough inside it and its PERIOD is how
 * long it lasted. Out of the set come the two numbers a sea is quoted by —
 * H1/3, the mean height of the highest third (which is what "significant
 * height" MEANS, before a spectrum was ever fitted to one), and Tz, the mean
 * zero-crossing period.
 *
 * A record and not a formula because that is the point of the lab: the field
 * is eight to sixteen components summed, and what a rider meets is the waves
 * that sum MAKES, not the components it was laid from. */
function waveRecord(x, z, seconds, dt = 0.05) {
  const n = Math.max(8, Math.round(seconds / dt));
  const eta = new Float64Array(n);
  let mean = 0;
  for (let i = 0; i < n; i++) {
    eta[i] = heightAt(sea, level, x, z, i * dt);
    mean += eta[i];
  }
  mean /= n;
  const waves = [];
  let open = -1;
  let hi = -Infinity;
  let lo = Infinity;
  for (let i = 1; i < n; i++) {
    const a = eta[i - 1] - mean;
    const b = eta[i] - mean;
    if (a <= 0 && b > 0) {
      // A crossing closes the wave that was running and opens the next.
      if (open >= 0 && hi > lo) waves.push({ height: hi - lo, period: (i - open) * dt });
      open = i;
      hi = -Infinity;
      lo = Infinity;
    }
    if (open >= 0) {
      if (b > hi) hi = b;
      if (b < lo) lo = b;
    }
  }
  if (waves.length === 0) return { h13: 0, hMean: 0, tz: 0, count: 0, eta, mean, dt };
  const byHeight = [...waves].sort((p, q) => q.height - p.height);
  const third = Math.max(1, Math.round(waves.length / 3));
  const h13 = byHeight.slice(0, third).reduce((sum, w) => sum + w.height, 0) / third;
  const hMean = waves.reduce((sum, w) => sum + w.height, 0) / waves.length;
  const tz = waves.reduce((sum, w) => sum + w.period, 0) / waves.length;
  return { h13, hMean, tz, count: waves.length, eta, mean, dt };
}

/** One station: everything the panels and the table read. */
function station(s) {
  const { x, z } = at(s);
  const depth = depthAt(x, z);
  // THE STATISTICS TAKE A LONG RECORD and the ladder's picture a short one.
  // H1/3 is the mean of the highest THIRD of the waves counted, so a
  // forty-second record decides it on three waves and the curve in panel C
  // comes out as noise with a trend somewhere inside it. Four minutes is
  // some forty waves, which is what a wave record is normally quoted over.
  const record = waveRecord(x, z, args.stats);
  const { Hs, Tp } = seaSummary(sea, x, z);
  // HOW FAR APART THE CRESTS STAND, m: the zero-crossing period carried at
  // the celerity the DEPTH HERE gives it (the engine's own dispersion
  // relation, ω² = g·k·tanh(k·d) — never the deep-water form, which is the
  // whole thing this lab is watching change).
  const d = Math.max(depth, TUNING.sea.minDepth);
  const omega = record.tz > 0 ? (2 * Math.PI) / record.tz : 0;
  const k = omega > 0 ? wavenumber(omega, d) : 0;
  const celerity = k > 0 ? omega / k : 0;
  const spacing = k > 0 ? (2 * Math.PI) / k : 0;
  // THE ENCOUNTER PERIOD, s: how often a crest meets the bow of a hull
  // running INTO the sea at `--ride`. The waves are coming at him, so the
  // closing speed is his plus theirs — which is why a sea a rider can sit
  // between the crests of is one he lands on the face of at speed.
  const encounter = spacing > 0 ? spacing / (args.ride + celerity) : 0;
  const wind2 = windSpeedAt(air, 2, x, z);
  // WHAT THE RENDERER READS AT THIS POINT, taken the way `water-mesh.ts`
  // takes it: the sea the two wind bands leave standing here plus the storm
  // over them, the bands that sea breaks at, and the mean wind this water
  // feels — which freshens toward the storm's as the coast falls astern.
  const shares = seaShares(sea, x, z);
  const storm = stormSeaAt(sea, x, z, { Hs: 0, Tp: 0 });
  const hsHere = Math.hypot(sea.hsRef * shares.ocean, sea.localHs * shares.local, storm.Hs);
  const past = stormRamp(oceanOut(sea.bounds, x, z));
  return {
    hsHere,
    bands: breakBands(sea.hsRef, sea.tp, storm.Hs, storm.Tp),
    seaWind: oceanWind(
      sea.windSpeed,
      Math.min(1, Math.max(0, sampleField(sea.shelter.shelter, x, z))),
      past,
    ),
    past,
    s,
    x,
    z,
    depth,
    offshore: offshoreAt(x, z),
    Hs,
    Tp,
    h13: record.h13,
    tz: record.tz,
    spacing,
    celerity,
    encounter,
    steepness: spacing > 0 ? record.h13 / spacing : 0,
    load: depthLoad(Hs, depth),
    wind: wind2,
    record,
  };
}

// ── What is breaking along the line ─────────────────────────────────────
// The renderer's own rule (`water-break.ts`), asked of the same water.
//
// MEASURE WHAT IS DRAWN. The water mesh carries this rule's answer straight
// into a vertex's alpha, for this instant and for that point alone — so a
// station's share over a record IS what the rider is shown, and the columns
// below are the sea's own coverage rather than a model of one. A memory of
// foam used to stand between the two, and modelling it here let a sea that
// drew as a snowfield report four parts in a thousand: the lab agreed with a
// model of the renderer while the renderer did something else. If a memory
// comes back, it belongs in the mesh AND in this loop on the same day.
const parts = { crest: 0, shoal: 0, cap: 0 };
/** A share this big is white water a rider can see — under it the shader's
 * lace reaches only the brightest lines of the foam tile and reads as aerated
 * water rather than as foam (`water-foam.ts`). What `covered` counts. */
const VISIBLE = 0.15;
function breakingAlong(st, seconds = 90, dt = 0.2) {
  const n = Math.round(seconds / dt);
  const sum = { crest: 0, shoal: 0, cap: 0 };
  let all = 0;
  let covered = 0;
  let peak = 0;
  const sample = { height: 0, nx: 0, ny: 1, nz: 0, vx: 0, vy: 0, vz: 0 };
  for (let i = 0; i < n; i++) {
    surfaceAt(sea, level, st.x, st.z, i * dt, sample);
    breakingParts(st.bands, 1 - sample.ny, sample.height, st.hsHere, st.depth, st.seaWind, parts);
    let here = 0;
    for (const key of ["crest", "shoal", "cap"]) {
      sum[key] += parts[key];
      here += parts[key];
    }
    here = Math.min(1, here);
    all += here;
    if (here >= VISIBLE) covered++;
    if (here > peak) peak = here;
  }
  return {
    crest: sum.crest / n,
    shoal: sum.shoal / n,
    cap: sum.cap / n,
    all: all / n,
    covered: covered / n,
    peak,
  };
}

// ── The stations ────────────────────────────────────────────────────────
/** The ladder's rows — fine where the bed does the most in the least
 * distance, coarse out where nothing changes, and carried on out to
 * `--reach` when it is asked to leave the level, so the same sheet shows the
 * storm past the rim. That is the one water foam SHOULD be heavy on, and a
 * rule tuned only on the coast is a rule nobody checked out there. */
const ROWS = [10, 25, 50, 100, 175, 300, 450, 600].filter((s) => s <= args.reach);
for (let i = 1; i <= 4 && args.reach > 600; i++) {
  ROWS.push(Math.round((600 + ((args.reach - 600) * i) / 4) / 10) * 10);
}
/** ...and the curve's stations, every `STEP` m, which is what panels C and D
 * are drawn from. */
const STEP = 10;
const stations = [];
for (let s = 0; s <= args.reach; s += STEP) stations.push(station(s));
for (const st of stations) st.foam = breakingAlong(st);
const rows = ROWS.map((s) => {
  const known = stations.find((st) => st.s === s);
  if (known) return known;
  const fresh = station(s);
  fresh.foam = breakingAlong(fresh);
  return fresh;
});
// ...and the short record each ladder row is DRAWN from.
for (const st of rows) st.trace = waveRecord(st.x, st.z, args.record);

// ── The wave train in SPACE, at one instant ─────────────────────────────
// The same event the zero-crossing record counts, read along the line instead
// of at a point: a local maximum standing above the still water. COUNTING
// them is the plainest reading of "how many waves there are", and it is the
// one a mean spacing can hide — a sea whose big waves have three little ones
// riding between them reads as too many waves while its Tz barely moves.
const fine = [];
for (let s = 0; s <= args.reach; s += 0.5) {
  const p = at(s);
  fine.push({ s, h: heightAt(sea, level, p.x, p.z, 0) });
}
let peak = 0.2;
for (const f of fine) peak = Math.max(peak, Math.abs(f.h));
const crests = [];
for (let i = 1; i + 1 < fine.length; i++) {
  if (fine[i].h > fine[i - 1].h && fine[i].h >= fine[i + 1].h && fine[i].h > 0.08 * peak) {
    crests.push(fine[i]);
  }
}
/** ...over the water a course is actually ridden on. */
const RIDDEN = { from: 30, to: 300 };
const crestsPer100 =
  (100 * crests.filter((c) => c.s >= RIDDEN.from && c.s <= RIDDEN.to).length) /
  (RIDDEN.to - RIDDEN.from);

// ── Say it ──────────────────────────────────────────────────────────────
const pad = (v, n) => String(v).padStart(n);
console.log(
  `surf — engine ${engineVersion} · seed ${args.seed} (${level.biome}) · wind ${wind.speed.toFixed(1)} m/s from ${deg(wind.from).toFixed(0)}°` +
    `${override ? ` · sea quoted at Hs ${override.hs} m` : ""}` +
    ` · wind sea Hs ${sea.hsRef.toFixed(2)} m / Tp ${sea.tp.toFixed(2)} s` +
    ` · swell Hs ${sea.swellHs.toFixed(2)} m / Tp ${sea.swellTp.toFixed(2)} s` +
    ` · chop Hs ${sea.localHs.toFixed(2)} m / Tp ${sea.localTp.toFixed(2)} s`,
);
console.log(
  `dials — height ×${TUNING.sea.heightScale} · period ×${TUNING.sea.periodScale}` +
    ` · band ${TUNING.sea.bandLow}-${TUNING.sea.bandHigh} f_p, shortest ${TUNING.sea.minPeriod} s` +
    ` · quoted steepness ${TUNING.sea.steepness} · swell steepness ${TUNING.sea.swell.steepness}` +
    ` · breaking Hs/d ${TUNING.sea.breakingHs}`,
);
console.log(
  `line from (${sx.toFixed(0)}, ${sz.toFixed(0)}) on the waterline, heading ${deg(Math.atan2(dx, dz)).toFixed(0)}°,` +
    ` ${args.reach} m out · waves counted by zero-up-crossing over ${args.stats} s · encounter quoted at ${args.ride} m/s into the sea`,
);
console.log(
  [
    pad("out m", 6),
    pad("depth", 7),
    pad("Hs", 6),
    pad("H1/3", 6),
    pad("Tz", 5),
    pad("gap m", 7),
    pad("c m/s", 6),
    pad("meets", 6),
    pad("H/L", 6),
    pad("d/L", 6),
    pad("load", 6),
    pad("surf", 6),
    pad("crest", 6),
    pad("cap", 6),
    pad("white", 6),
    pad("seen", 6),
  ].join(" "),
);
for (const st of rows) {
  console.log(
    [
      pad(st.s, 6),
      pad(st.depth.toFixed(2), 7),
      pad(st.Hs.toFixed(2), 6),
      pad(st.h13.toFixed(2), 6),
      pad(st.tz.toFixed(1), 5),
      pad(st.spacing.toFixed(1), 7),
      pad(st.celerity.toFixed(1), 6),
      pad(`${st.encounter.toFixed(1)}s`, 6),
      pad(st.steepness.toFixed(3), 6),
      pad((st.spacing > 0 ? st.depth / st.spacing : 0).toFixed(3), 6),
      pad(st.load.toFixed(2), 6),
      pad(st.foam.shoal.toFixed(3), 6),
      pad(st.foam.crest.toFixed(3), 6),
      pad(st.foam.cap.toFixed(3), 6),
      pad(st.foam.all.toFixed(3), 6),
      pad(st.foam.covered.toFixed(2), 6),
    ].join(" "),
  );
}
{
  // THE HEADLINE: the water a course is actually ridden over. Everything
  // above is a line out to sea; this is the band the gates stand in.
  const ridden = stations.filter((st) => st.s >= RIDDEN.from && st.s <= RIDDEN.to && st.depth > 1);
  const mean = (get) => ridden.reduce((sum, st) => sum + get(st), 0) / Math.max(1, ridden.length);
  console.log(
    `\nover the water a course is ridden on (${RIDDEN.from}-${RIDDEN.to} m out): ${crestsPer100.toFixed(1)} crests per 100 m,` +
      ` ${mean((st) => st.spacing).toFixed(0)} m between them,` +
      ` H1/3 ${mean((st) => st.h13).toFixed(2)} m, steepness ${mean((st) => st.steepness).toFixed(3)},` +
      ` a wave meets the bow every ${mean((st) => st.encounter).toFixed(1)} s at ${args.ride} m/s,` +
      ` ${(100 * mean((st) => st.foam.all)).toFixed(1)} % of it white,` +
      ` ${(100 * mean((st) => st.foam.covered)).toFixed(0)} % of the time visibly so` +
      ` (surf ${(100 * mean((st) => st.foam.shoal)).toFixed(1)} · crest ${(100 * mean((st) => st.foam.crest)).toFixed(1)} · caps ${(100 * mean((st) => st.foam.cap)).toFixed(1)})`,
  );
  const storm = stations.filter((st) => st.past > 0.6);
  if (storm.length > 0) {
    const smean = (get) => storm.reduce((sum, st) => sum + get(st), 0) / storm.length;
    console.log(
      `out in the storm past the rim (${smean((st) => st.Hs).toFixed(0)} m of sea at steepness ${smean((st) => st.steepness).toFixed(3)}):` +
        ` ${(100 * smean((st) => st.foam.all)).toFixed(1)} % white, ${(100 * smean((st) => st.foam.covered)).toFixed(0)} % of the time visibly so` +
        ` (surf ${(100 * smean((st) => st.foam.shoal)).toFixed(1)} · crest ${(100 * smean((st) => st.foam.crest)).toFixed(1)} · caps ${(100 * smean((st) => st.foam.cap)).toFixed(1)})` +
        ` — a gale should be white, and this is the water that says so`,
    );
  }
  const deep = stations.filter((st) => st.load < 0.25);
  if (deep.length > 0) {
    const dmean = (get) => deep.reduce((sum, st) => sum + get(st), 0) / deep.length;
    console.log(
      `out where the bed does nothing (depth load under 0.25): ${(100 * dmean((st) => st.foam.all)).toFixed(1)} % white,` +
        ` ${(100 * dmean((st) => st.foam.covered)).toFixed(0)} % of the time visibly so` +
        ` — this is the offshore foam, and only the caps and the crests are in it`,
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
  sea: [126, 196, 240],
  crest: [250, 206, 84],
  still: [64, 72, 84],
  height: [96, 214, 158],
  gap: [126, 176, 240],
  surf: [240, 240, 246],
  spill: [250, 176, 96],
  caps: [150, 200, 255],
  load: [232, 96, 72],
};
const W = 1280;
const A = { x: 62, y: 44, w: W - 84, h: 150 };
const BED = { x: A.x, y: A.y + A.h + 26, w: A.w, h: 64 };
const B = { x: A.x, y: BED.y + BED.h + 44, w: 596, h: 8 + rows.length * 44 };
const C = { x: B.x + B.w + 58, y: B.y, w: W - (B.x + B.w + 58) - 22, h: 168 };
const D = { x: C.x, y: C.y + C.h + 40, w: C.w, h: B.y + B.h - (C.y + C.h + 40) };
const canvas = createDrawing(W, B.y + B.h + 40, INK.paper);
const panel = (box, title) => {
  canvas.fillRect(box.x, box.y, box.w, box.h, INK.panel);
  canvas.rect(box.x, box.y, box.w, box.h, INK.rule);
  canvas.text(title, box.x, box.y - 10, INK.label, 1);
};
canvas.text(
  `SURF  SEED ${args.seed}  ${level.biome.toUpperCase()}  WIND ${wind.speed.toFixed(1)} M/S` +
    `  SEA ${sea.hsRef.toFixed(2)} M / ${sea.tp.toFixed(1)} S  SWELL ${sea.swellHs.toFixed(2)} M / ${sea.swellTp.toFixed(1)} S`,
  A.x,
  12,
  INK.label,
  2,
);

/** The pitch the metres-out axes are labelled at. */
const tickStep = [50, 100, 250, 500, 1000, 2000].find((m) => args.reach / m <= 12) ?? 5000;

// A — one instant, one line, every crest ticked.
panel(A, "A  THE WAVE TRAIN: ONE INSTANT, SHORE (LEFT) OUT TO SEA — EVERY CREST TICKED, GAPS IN M");
const ax = (s) => A.x + (s / args.reach) * A.w;
const aScale = (A.h / 2 - 16) / peak;
const aZero = A.y + A.h / 2;
canvas.line(A.x, aZero, A.x + A.w, aZero, INK.still);
canvas.polyline(
  fine.map((f) => [ax(f.s), aZero - f.h * aScale]),
  INK.sea,
  1,
);
for (const c of crests) {
  canvas.line(ax(c.s), aZero - c.h * aScale - 4, ax(c.s), aZero - c.h * aScale - 10, INK.crest);
}
// ...and the gap to the next one, on every crest the label has room for.
let lastLabel = -Infinity;
for (let i = 0; i + 1 < crests.length; i++) {
  const x0 = ax(crests[i].s);
  const x1 = ax(crests[i + 1].s);
  if (x0 - lastLabel < 46) continue;
  lastLabel = x0;
  canvas.text(
    `${Math.round(crests[i + 1].s - crests[i].s)}`,
    (x0 + x1) / 2 - 6,
    A.y + 4,
    INK.crest,
    1,
  );
}
const bar = [2, 1, 0.5, 0.25].find((m) => m * aScale <= A.h / 2 - 18) ?? 0.25;
canvas.line(A.x + 8, aZero - bar * aScale, A.x + 8, aZero, INK.dim, 2);
canvas.text(`${bar} M`, A.x + 12, aZero - bar * aScale, INK.dim, 1);
canvas.text(
  `${crests.length} CRESTS IN ${args.reach} M`,
  A.x + A.w - 152,
  A.y + A.h - 10,
  INK.dim,
  1,
);

// The bed under the same line.
panel(BED, "THE BED UNDER IT (M) — WHERE IT COMES UP IS WHERE THE SEA GOES OVER");
let deepest = 1;
for (const st of stations) deepest = Math.max(deepest, st.depth);
const bedY = (d) => BED.y + 3 + (d / deepest) * (BED.h - 6);
const bedLine = [];
for (let s = 0; s <= args.reach; s += 2) bedLine.push([ax(s), bedY(depthAt(at(s).x, at(s).z))]);
for (const [px, py] of bedLine) canvas.line(px, py, px, BED.y + BED.h - 1, INK.bedFill);
canvas.polyline(bedLine, INK.bed, 1);
for (const d of [5, 10, 20, 30, 50]) {
  if (d > deepest) break;
  canvas.line(BED.x, bedY(d), BED.x + 6, bedY(d), INK.dim);
  canvas.text(`${d}`, BED.x + 8, bedY(d) - 3, INK.dim, 1);
}
for (let s = 0; s <= args.reach - 2 * tickStep; s += tickStep) {
  canvas.text(`${s}`, ax(s) - 6, BED.y + BED.h + 3, INK.dim, 1);
}
canvas.text(`${args.reach} M OUT`, A.x + A.w - 52, BED.y + BED.h + 3, INK.dim, 1);

// B — the ladder: one row per station, all at one scale.
panel(B, `B  THE LADDER: ${args.record} S OF WATER AT EACH STATION, ALL ROWS AT ONE SCALE`);
let rowPeak = 0.15;
for (const st of rows) {
  for (let i = 0; i < st.trace.eta.length; i++) {
    rowPeak = Math.max(rowPeak, Math.abs(st.trace.eta[i] - st.trace.mean));
  }
}
const rowH = (B.h - 8) / rows.length;
const rScale = (rowH / 2 - 7) / rowPeak;
rows.forEach((st, i) => {
  const mid = B.y + 4 + rowH * (i + 0.5);
  const plotX = B.x + 96;
  const plotW = B.w - 104;
  canvas.line(plotX, mid, plotX + plotW, mid, INK.still);
  const pts = [];
  for (let j = 0; j < st.trace.eta.length; j++) {
    pts.push([
      plotX + (j / (st.trace.eta.length - 1)) * plotW,
      mid - (st.trace.eta[j] - st.trace.mean) * rScale,
    ]);
  }
  canvas.polyline(pts, INK.sea, 1);
  canvas.text(`${st.s} M OUT`, B.x + 4, mid - 8, INK.label, 1);
  canvas.text(
    `${st.depth.toFixed(1)} M DEEP`,
    B.x + 4,
    mid + 1,
    st.load > 0.4 ? INK.surf : INK.dim,
    1,
  );
  canvas.text(
    `${st.h13.toFixed(2)} M / ${st.spacing.toFixed(0)} M`,
    B.x + 4,
    mid + 10,
    INK.crest,
    1,
  );
  if (i + 1 < rows.length) {
    canvas.line(
      B.x + 1,
      B.y + 4 + rowH * (i + 1),
      B.x + B.w - 1,
      B.y + 4 + rowH * (i + 1),
      INK.rule,
    );
  }
});
canvas.line(B.x + 90, B.y + 6, B.x + 90, B.y + 6 + rowPeak * rScale, INK.dim, 2);
canvas.text(`${rowPeak.toFixed(1)} M`, B.x + 40, B.y + 6, INK.dim, 1);
canvas.text(`0 S`, B.x + 96, B.y + B.h - 9, INK.dim, 1);
canvas.text(`${args.record} S`, B.x + B.w - 30, B.y + B.h - 9, INK.dim, 1);

// C — the two numbers a rider feels, against metres out.
panel(C, "C  HOW IT BUILDS: H1/3 (GREEN, LEFT) AND CREST SPACING (BLUE, RIGHT) VS METRES OUT");
const cx = (s) => C.x + (s / args.reach) * (C.w - 8) + 4;
let maxH13 = 0.2;
let maxGap = 10;
for (const st of stations) {
  maxH13 = Math.max(maxH13, st.h13);
  maxGap = Math.max(maxGap, st.spacing);
}
const cyH = (h) => C.y + C.h - 12 - (h / maxH13) * (C.h - 26);
const cyG = (g) => C.y + C.h - 12 - (g / maxGap) * (C.h - 26);
canvas.polyline(
  stations.map((st) => [cx(st.s), cyG(st.spacing)]),
  INK.gap,
  2,
);
canvas.polyline(
  stations.map((st) => [cx(st.s), cyH(st.h13)]),
  INK.height,
  2,
);
canvas.text(`${maxGap.toFixed(0)} M`, C.x + C.w - 40, cyG(maxGap) + 2, INK.gap, 1);
canvas.text(`${maxH13.toFixed(1)} M`, C.x + 6, cyH(maxH13) + 2, INK.height, 1);
for (let s = 0; s <= args.reach - tickStep; s += tickStep) {
  canvas.text(`${s}`, cx(s) - 6, C.y + C.h - 9, INK.dim, 1);
}

// D — the three things that put white on a sea, drawn apart.
panel(D, "D  WHERE IT GOES OVER: SURF (WHITE), CREST (ORANGE), CAPS (PALE), DEPTH LOAD (RED)");
const dx2 = (s) => D.x + (s / args.reach) * (D.w - 8) + 4;
const dy = (v) => D.y + D.h - 12 - Math.min(1, v) * (D.h - 26);
canvas.line(D.x + 4, dy(1), D.x + D.w - 4, dy(1), INK.rule);
canvas.text("1", D.x + 6, dy(1) - 8, INK.dim, 1);
for (const [get, ink, width] of [
  [(st) => st.load, INK.load, 1],
  [(st) => st.foam.cap, INK.caps, 1],
  [(st) => st.foam.crest, INK.spill, 1],
  [(st) => st.foam.shoal, INK.surf, 2],
]) {
  canvas.polyline(
    stations.map((st) => [dx2(st.s), dy(get(st))]),
    ink,
    width,
  );
}
for (let s = 0; s <= args.reach - 2 * tickStep; s += tickStep) {
  canvas.text(`${s}`, dx2(s) - 6, D.y + D.h - 9, INK.dim, 1);
}
canvas.text(`${args.reach} M OUT`, D.x + D.w - 58, D.y + D.h - 9, INK.dim, 1);

const outDir = join(root, "previews");
mkdirSync(outDir, { recursive: true });
const name =
  args.out ??
  `surf-${args.biome === "taiga" ? "" : `${args.biome}-`}${args.seed}${args.wind !== undefined ? `-w${args.wind}` : ""}`;
const file = join(outDir, `${name}.png`);
writeFileSync(file, canvas.toPng());
console.log(`\nwrote ${file}`);
