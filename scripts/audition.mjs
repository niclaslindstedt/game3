#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE EAR — the review surface for everything the game makes a noise with.
//
// A sound cannot be judged from a diff, so this builds a single
// self-contained page that plays the ACTUAL shipped audio: the same synth,
// the same bank, the same beds. Three sections:
//
//   THE CRAFT  the engine and the pump under sliders — revs, throttle, how
//              far the jet is outrunning the hull — and a switch for the
//              air, because a free-revving jump is the engine's own sound.
//   THE WATER  the hull, the wind and the sea under sliders — the pace, how
//              far onto the plane, the sea under the hull, the apparent
//              wind, the surf on the shore and how far off it is — and a
//              row of SEATS, because the mix moves with the camera. Every
//              layer is a function of those numbers and there is no other
//              honest way to hear them than to move them.
//   THE BANK   every discrete sound in the game, one button each, with the
//              description it was written against printed beside it — and
//              the bubbles, in the two sizes the router asks for.
//
// The page carries no scripts of its own beyond the wiring: the audio code
// is the repo's own TypeScript, compiled by `tsc` and inlined, so this can
// never drift from what ships. If it sounds right here it sounds right in
// the game.
//
// And because a session cannot listen, `--meter` drives the page it just
// wrote in a headless Chromium, taps what reaches the destination with an
// analyser, and prints a LEVEL for every bed preset and every sound in the
// bank, dBFS. That is not a judgement — a mix is judged by ears — but it is
// the honest half of one: a sound that is twice as loud as its neighbours,
// a bed that does not move between idle and flat out, a layer that goes
// missing in the air, all show up as numbers before anybody has to listen.
//
//   make audition                       # previews/audition.html
//   make audition CRAFT=marlin          # the rev band of another catalog row
//   make audition ARGS=--meter          # ...and the level table (Chromium)
//   make audition ARGS="--meter --seat heli"
//   npm run audition -- --out other.html

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { parseArgs } from "./lib/cli.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const args = parseArgs(
  process.argv.slice(2),
  {
    out: {
      kind: "string",
      default: join("previews", "audition.html"),
      help: "where to write the page",
    },
    craft: { kind: "string", default: "skiff", help: "whose rev band the REVS slider spans" },
    meter: {
      kind: "flag",
      default: false,
      help: "drive the page in a headless Chromium and print every level, dBFS",
    },
    seat: { kind: "string", default: "chase", help: "which camera the meter listens from" },
  },
  "usage: npm run audition -- [--craft skiff] [--out previews/audition.html] [--meter [--seat chase]]",
);
const out = join(root, args.out);

// The modules the page needs at RUNTIME, in dependency order — and the order
// is load-bearing: concatenation is all the linking there is, so a module has
// to be listed BEFORE the ones that call into it.
//
// `voice.ts` is mostly types, which is exactly the trap: it also holds
// `envelopeShape`, `safeCutoff` and the shaper's arithmetic, which every
// voice the synth plays goes through. Leave it out and `tsc` erases the
// import, the page builds clean, and the first button anyone presses throws.
// `ride-bed.ts` is NOT here: it reads a `GameState`, and the page has none —
// the sliders stand in for it, which is the point of the page.
const RUNTIME = [
  "pwa/src/lib/voice.ts",
  "pwa/src/lib/synth.ts",
  "pwa/src/game/audio/play.ts",
  "pwa/src/game/audio/rack.ts",
  "pwa/src/game/audio/listener.ts",
  "pwa/src/game/audio/engine-voice.ts",
  "pwa/src/game/audio/water-voice.ts",
  "pwa/src/game/audio/bubbles.ts",
];

/** Compile the runtime modules to plain JS and return one concatenated blob. */
function compileRuntime() {
  const dir = mkdtempSync(join(tmpdir(), "audition-"));
  try {
    // Run from the temp directory with absolute paths: `tsc` refuses to load a
    // tsconfig.json that sits in the working directory when files are named on
    // the command line (TS5112), and the repo root has one.
    try {
      execFileSync(
        join(root, "node_modules", ".bin", "tsc"),
        [
          ...RUNTIME.map((rel) => join(root, rel)),
          "--outDir",
          dir,
          "--rootDir",
          root,
          "--target",
          "es2022",
          "--module",
          "esnext",
          "--moduleResolution",
          "bundler",
          // The repo writes its imports with explicit `.ts` extensions; this is
          // the emit-time flag that rewrites them, and the only one compatible
          // with actually producing JavaScript.
          "--rewriteRelativeImportExtensions",
          // Emit only. The modules are typechecked by `make lint`; here the
          // `@engine` and `../camera.ts` type imports would fail to resolve
          // without the repo's tsconfig, and they are erased from the emit.
          "--noCheck",
          "--skipLibCheck",
        ],
        { cwd: dir, stdio: ["ignore", "pipe", "pipe"] },
      );
    } catch (err) {
      // tsc writes its diagnostics to stdout, which a thrown ExecFileSync
      // error buries under a hex dump of the buffer.
      process.stderr.write(String(err.stdout ?? "") + String(err.stderr ?? ""));
      throw new Error("tsc failed to compile the audio runtime", { cause: err });
    }
    // EACH MODULE GETS ITS OWN SCOPE, wrapped in an IIFE that returns its
    // exports; those are destructured into the shared scope for the modules
    // that follow. Private names stay private, which is what the module
    // system was doing.
    return RUNTIME.map((rel) => {
      const js = readFileSync(join(dir, rel.replace(/\.ts$/, ".js")), "utf8");
      const names = [
        ...js.matchAll(/^export (?:async )?(?:function|const|let|var|class)\s+([A-Za-z0-9_$]+)/gm),
      ].map((m) => m[1]);
      const body = js
        .split("\n")
        .filter((line) => !/^\s*import[\s{]/.test(line))
        .map((line) => line.replace(/^export (?!default)/, ""))
        .join("\n");
      return `const { ${names.join(", ")} } = (() => {\n${body}\nreturn { ${names.join(", ")} };\n})();`;
    }).join("\n");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const { RUN_BANK } = await import(join(root, "pwa/src/game/audio/bank.ts"));
const { CRAFT, craftById } = await import(join(root, "engine/index.ts"));
const spec = craftById(args.craft);

const runtime = compileRuntime();
const data = JSON.stringify({
  bank: RUN_BANK,
  craft: { id: spec.id, name: spec.name, idleRpm: spec.idleRpm, maxRpm: spec.maxRpm },
  crafts: CRAFT.map((c) => c.id),
});

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Sea Haven — the ear</title>
<style>
  /* ONE LOOK, DELIBERATELY: a boathouse at dusk. Deep sea blue, foam-white
     ink, and the orange of a buoy. It does not follow the viewer's theme
     because the thing it stands in for — the shore this game is about —
     only exists in one light at a time. */
  :root {
    color-scheme: dark;
    --ground: #0d1a24;
    --panel: #132433;
    --panel-2: #1a2f41;
    --line: #27425a;
    --ink: #e9f1f5;
    --dim: #8fa6b6;
    --buoy: #ff8a3d;
    --live: #5fd3a6;
    --display: "Barlow Condensed", "Arial Narrow", system-ui, sans-serif;
    --body: "Barlow", system-ui, -apple-system, sans-serif;
    --mono: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  }
  * { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; }
  body {
    margin: 0;
    background: var(--ground);
    color: var(--ink);
    font: 400 16px/1.6 var(--body);
    padding: 0 20px 72px;
  }
  .wrap { max-width: 1100px; margin: 0 auto; }
  header { padding: 40px 0 22px; border-bottom: 2px solid var(--buoy); }
  h1 {
    font: 700 clamp(30px, 6vw, 52px)/0.98 var(--display);
    letter-spacing: 0.02em; text-transform: uppercase; text-wrap: balance; margin: 0;
  }
  h1 small {
    display: block; font: 600 13px/1.4 var(--display); letter-spacing: 0.34em;
    color: var(--buoy); margin-bottom: 10px;
  }
  header p { color: var(--dim); max-width: 62ch; margin: 14px 0 0; }
  h2 {
    font: 600 13px/1 var(--display); letter-spacing: 0.3em; text-transform: uppercase;
    color: var(--dim); margin: 46px 0 4px;
  }
  h2 + .sub { color: var(--dim); font-size: 14px; margin: 0 0 16px; max-width: 62ch; }
  .transport {
    position: sticky; top: 0; z-index: 5;
    display: flex; gap: 14px; align-items: center; flex-wrap: wrap;
    background: color-mix(in srgb, var(--ground) 92%, transparent);
    backdrop-filter: blur(6px); border-bottom: 1px solid var(--line);
    padding: 12px 0; margin-top: 6px;
  }
  .status {
    font: 500 12px/1 var(--mono); letter-spacing: 0.08em; text-transform: uppercase;
    display: inline-flex; align-items: center; gap: 8px; color: var(--dim);
  }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--dim); }
  .status.live { color: var(--live); }
  .status.live .dot { background: var(--live); box-shadow: 0 0 0 3px color-mix(in srgb, var(--live) 22%, transparent); }
  button {
    font: 600 13px/1 var(--display); letter-spacing: 0.16em; text-transform: uppercase;
    background: var(--panel-2); color: var(--ink); border: 1px solid var(--line);
    border-radius: 3px; padding: 9px 16px; cursor: pointer;
    transition: border-color 120ms, color 120ms, background 120ms;
  }
  button:hover { border-color: var(--buoy); color: var(--buoy); }
  button:focus-visible { outline: 2px solid var(--buoy); outline-offset: 2px; }
  button.on { background: var(--buoy); border-color: var(--buoy); color: #14181d; }
  button.primary { border-color: var(--buoy); color: var(--buoy); }
  button.primary.on { color: #14181d; }
  .grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(310px, 1fr)); }
  .panel { background: var(--panel); border: 1px solid var(--line); border-radius: 4px; padding: 16px; }
  .sound { display: grid; gap: 10px; align-content: start; }
  .sound .top { display: flex; gap: 10px; align-items: center; justify-content: space-between; }
  .id { font: 500 13px/1 var(--mono); letter-spacing: 0.02em; color: var(--ink); }
  .layers { display: flex; gap: 4px; flex-wrap: wrap; }
  .chip {
    font: 500 10px/1 var(--mono); letter-spacing: 0.06em; text-transform: uppercase;
    padding: 4px 7px; border-radius: 2px; border: 1px solid var(--line); color: var(--dim);
  }
  .chip.tone { border-color: color-mix(in srgb, var(--buoy) 45%, var(--line)); color: var(--buoy); }
  .desc { color: var(--dim); font-size: 14px; line-height: 1.55; margin: 0; }
  .sl { display: grid; grid-template-columns: 128px 1fr 64px; gap: 14px; align-items: center; margin: 10px 0; }
  .sl .k { font: 600 11px/1 var(--display); letter-spacing: 0.22em; text-transform: uppercase; color: var(--dim); }
  .sl .v { font: 500 14px/1 var(--mono); font-variant-numeric: tabular-nums; text-align: right; }
  input[type="range"] { width: 100%; accent-color: var(--buoy); }
  input[type="range"]:focus-visible { outline: 2px solid var(--buoy); outline-offset: 3px; }
  .switches { display: flex; gap: 6px; flex-wrap: wrap; margin: 16px 0 4px; align-items: center; }
  .switches .k { font: 600 11px/1 var(--display); letter-spacing: 0.22em; text-transform: uppercase; color: var(--dim); margin-right: 6px; }
  footer { color: var(--dim); font-size: 13px; margin-top: 52px; border-top: 1px solid var(--line); padding-top: 16px; }
  @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1><small>Sea Haven</small>The ear</h1>
    <p>
      Everything the game makes a noise with, played by the game's own code. Nothing here is a
      recording — every layer and every splash is synthesized from a handful of numbers, which is
      why it can all be read as well as heard. A browser will not make a sound until you press
      the button below.
    </p>
  </header>

  <div class="transport">
    <button id="unlock" class="primary" type="button">Start audio</button>
    <span class="status" id="state"><span class="dot"></span><span id="stateText">Waiting for a gesture</span></span>
  </div>

  <h2>The craft</h2>
  <p class="sub">
    The engine and the pump: eight layers built once and STEERED by the numbers below. <b>Revs</b>
    is the crank, <b>throttle</b> what the rider is asking for, <b>slip</b> how far the jet is
    outrunning the hull (1 at a standstill, a third at pace — the cavitation's signal).
    <b>Wetted</b> is the share of the bottom still in the water, and it is the one to sweep:
    the exhaust exits BELOW the waterline, so for most of a run the engine is being heard
    through water — quiet, dark, and carried by the wet blat at the pipe. Dry the hull off and
    the pipe comes into the air and the whole thing cracks open. <b>In the air</b> is the far
    end of that, and takes the water away from the pump as well: the same throttle, nothing to
    push against. And the <b>seat</b> moves the whole mix.
  </p>
  <div class="panel">
    <div class="switches"><button id="craft" class="primary" type="button">Start the engine</button></div>
    <div id="craftSliders"></div>
  </div>

  <h2>The water</h2>
  <p class="sub">
    The hull in the water, the wind over it and the sea around it: seven layers. <b>Pace</b> is
    the share of top speed, <b>planing</b> how far onto the plane, <b>sea</b> the significant
    height under the hull, <b>wind</b> the apparent wind at the rider's head, <b>surf</b> the
    ocean's height and <b>shore</b> how far off the beach is — the break breathes on the sea's
    own period. Put the pace up and the spray is the whole sense of speed; take the hull into
    the air and only the wind is left.
  </p>
  <div class="panel">
    <div class="switches"><button id="water" class="primary" type="button">Start the water</button></div>
    <div id="waterSliders"></div>
  </div>

  <div id="bank"></div>

  <footer>
    Built by <span class="id">make audition</span> from the repository's own synth, bank and beds.
    If it sounds right here, it sounds right in the game.
  </footer>
</div>

<script type="module">
${runtime}

const DATA = ${data};
const synth = createSynth();

const stateEl = document.getElementById("state");
const stateText = document.getElementById("stateText");
function refreshState() {
  const live = synth.now() !== null;
  stateEl.className = live ? "status live" : "status";
  stateText.textContent = live ? "Audio running" : "Still locked — press again";
}
document.getElementById("unlock").addEventListener("click", () => {
  synth.unlock();
  refreshState();
});

/** Build an element in one call — the page is all DOM, no innerHTML. */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** A row of exclusive switches; \`onPick\` gets the chosen value. */
function switchRow(parent, label, choices, initial, onPick) {
  const row = el("div", "switches");
  row.append(el("span", "k", label));
  const buttons = [];
  for (const choice of choices) {
    const b = el("button", choice === initial ? "on" : null, choice);
    b.type = "button";
    b.addEventListener("click", () => {
      for (const other of buttons) other.className = "";
      b.className = "on";
      onPick(choice);
    });
    buttons.push(b);
    row.append(b);
  }
  parent.append(row);
}

/** A slider row bound to \`store[id]\`, over \`min..max\` with a unit. */
function sliderRow(parent, store, id, label, initial, min = 0, max = 1, unit = "") {
  store[id] = initial;
  const row = el("label", "sl");
  const input = document.createElement("input");
  const step = (max - min) / 100;
  Object.assign(input, { type: "range", min, max, step, value: initial });
  const show = (v) => (max - min > 10 ? v.toFixed(0) : v.toFixed(2)) + unit;
  const read = el("span", "v", show(initial));
  input.addEventListener("input", () => {
    store[id] = Number(input.value);
    read.textContent = show(store[id]);
  });
  row.append(el("span", "k", label), input, read);
  parent.append(row);
}

/** A switch that flips \`store[id]\`. */
function toggle(parent, store, id, label) {
  const row = el("div", "switches");
  const b = el("button", store[id] ? "on" : null, label);
  b.type = "button";
  b.addEventListener("click", () => {
    store[id] = !store[id];
    b.className = store[id] ? "on" : "";
  });
  row.append(b);
  parent.append(row);
}

const seat = { view: "chase" };
// THE TOOLING'S HANDLE: the three stores the sliders write, so a headless
// meter (\`--meter\`) can set a preset without finding a slider.
window.__ear = { seat };

// ── The craft ──────────────────────────────────────────────────────────────
const craft = { airborne: false };
window.__ear.craft = craft;
const craftSliders = document.getElementById("craftSliders");
sliderRow(craftSliders, craft, "rev", "Revs", 0.3);
sliderRow(craftSliders, craft, "throttle", "Throttle", 0.5);
sliderRow(craftSliders, craft, "slip", "Slip", 0.3);
sliderRow(craftSliders, craft, "wetted", "Wetted", 0.6);
toggle(craftSliders, craft, "airborne", "In the air");
switchRow(craftSliders, "Seat", Object.keys(LISTENERS), "chase", (s) => (seat.view = s));
craftSliders.append(el("p", "sub", "The rev band is the " + DATA.craft.name + "'s: " +
  DATA.craft.idleRpm + " to " + DATA.craft.maxRpm + " rpm (" + DATA.crafts.join(", ") +
  " — pass CRAFT= for another)."));

let engineRack = null;
const craftBtn = document.getElementById("craft");
craftBtn.addEventListener("click", () => {
  synth.unlock();
  refreshState();
  if (engineRack !== null) {
    clearInterval(engineRack.timer);
    engineRack.rack.stop();
    engineRack = null;
    craftBtn.className = "primary";
    craftBtn.textContent = "Start the engine";
    return;
  }
  craftBtn.className = "primary on";
  craftBtn.textContent = "Stop the engine";
  const rack = createRack(synth, ENGINE_LAYERS, ENGINE_GLIDE);
  // Steered thirty times a second, exactly as the game's frame does it: the
  // layers hold between calls, so nothing here is booked ahead.
  const timer = setInterval(() => {
    if (synth.now() === null) return;
    const ear = listenerFor(seat.view);
    // The two readings the bed takes off one wetted share, derived here
    // exactly as ride-bed.ts derives them — the whole point of the page is
    // that what it plays is what the run plays. (No backticks in here: this
    // whole script is one template literal, and one would end it.)
    const wetted = craft.airborne ? 0 : craft.wetted;
    const wet = craft.airborne ? 0 : Math.min(1, wetted / INTAKE_WETTED);
    rack.apply(
      engineTargets(
        {
          rpm: rpmAt(craft.rev, DATA.craft.idleRpm, DATA.craft.maxRpm),
          rev: craft.rev,
          throttle: craft.throttle,
          load: craft.throttle * wet,
          wet,
          slip: craft.airborne ? 1 : craft.slip,
          clear: exhaustClear(wetted, craft.airborne, false),
        },
        { engine: ear.engine, exhaust: ear.exhaust, pump: ear.pump, tone: ear.tone },
      ),
    );
  }, 33);
  engineRack = { timer, rack };
});

// ── The water ──────────────────────────────────────────────────────────────
const water = { airborne: false, capsized: false };
window.__ear.water = water;
const waterSliders = document.getElementById("waterSliders");
sliderRow(waterSliders, water, "pace", "Pace", 0.5);
sliderRow(waterSliders, water, "planing", "Planing", 0.8);
sliderRow(waterSliders, water, "wetted", "Wetted", 0.5);
sliderRow(waterSliders, water, "hs", "Sea", 0.6, 0, 4, " m");
sliderRow(waterSliders, water, "wind", "Wind", 14, 0, 40, " m/s");
sliderRow(waterSliders, water, "surf", "Surf", 1, 0, 4, " m");
sliderRow(waterSliders, water, "shore", "Shore", 120, 0, 400, " m");
sliderRow(waterSliders, water, "shorePan", "Shore side", 0.5, -1, 1);
sliderRow(waterSliders, water, "tp", "Period", 6, 2, 14, " s");
toggle(waterSliders, water, "airborne", "In the air");
toggle(waterSliders, water, "capsized", "Capsized");

let waterRack = null;
const waterBtn = document.getElementById("water");
const t0 = performance.now();
waterBtn.addEventListener("click", () => {
  synth.unlock();
  refreshState();
  if (waterRack !== null) {
    clearInterval(waterRack.timer);
    waterRack.rack.stop();
    waterRack = null;
    waterBtn.className = "primary";
    waterBtn.textContent = "Start the water";
    return;
  }
  waterBtn.className = "primary on";
  waterBtn.textContent = "Stop the water";
  const rack = createRack(synth, WATER_LAYERS, WATER_GLIDE);
  const timer = setInterval(() => {
    if (synth.now() === null) return;
    const ear = listenerFor(seat.view);
    rack.apply(
      waterTargets(
        {
          speed: water.pace * 28,
          pace: water.pace,
          planing: water.planing,
          wetted: water.wetted,
          airborne: water.airborne,
          capsized: water.capsized,
          hs: water.hs,
          wind: water.wind,
          surf: water.surf,
          shore: water.shore,
          shorePan: water.shorePan,
          tp: water.tp,
          t: (performance.now() - t0) / 1000,
        },
        { hull: ear.hull, wind: ear.wind, sea: ear.sea },
      ),
    );
  }, 33);
  waterRack = { timer, rack };
});

// ── The bank ───────────────────────────────────────────────────────────────
const bank = document.getElementById("bank");
bank.append(el("h2", null, "The bank"));
bank.append(
  el(
    "p",
    "sub",
    "Every voice is listed before you press it: what a sound is MADE of is most of what it is. " +
      "The bubbles are the tail every splash gets, in the two sizes the router asks for.",
  ),
);
const grid = el("div", "grid");
for (const [id, def] of Object.entries(DATA.bank)) {
  const card = el("div", "panel sound");
  const top = el("div", "top");
  const play = el("button", null, "Play");
  play.type = "button";
  play.addEventListener("click", () => {
    synth.unlock();
    refreshState();
    playDef(synth, def);
  });
  top.append(el("span", "id", id), play);
  const layers = el("div", "layers");
  for (const voice of def.voices) {
    const kind = voice.call === "tone" ? voice.type || "square" : (voice.color || "white") + " noise";
    layers.append(el("span", voice.call === "tone" ? "chip tone" : "chip", kind));
  }
  card.append(top, layers, el("p", "desc", def.description));
  grid.append(card);
}
for (const [id, count, big, desc] of [
  ["bubbles (a landing)", 8, 0.25, "A landing's tail: a handful of small quick bubbles as the water closes."],
  ["bubbles (a dive)", 16, 0.7, "A dive's tail: the air out of a hull going under — bigger, deeper, longer."],
]) {
  const card = el("div", "panel sound");
  const top = el("div", "top");
  const play = el("button", null, "Play");
  play.type = "button";
  play.addEventListener("click", () => {
    synth.unlock();
    refreshState();
    bubbleBurst(synth, count, big, 1);
  });
  top.append(el("span", "id", id), play);
  const layers = el("div", "layers");
  layers.append(el("span", "chip tone", "sine × " + count));
  card.append(top, layers, el("p", "desc", desc));
  grid.append(card);
}
bank.append(grid);
</script>
</body>
</html>
`;

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, page);
console.log(
  `wrote ${out} — ${Object.keys(RUN_BANK).length} sounds, ` +
    `${Object.keys(RUN_BANK).length + 2} buttons, the ${spec.name}'s rev band ` +
    `(${spec.idleRpm}–${spec.maxRpm} rpm), the engine's 8 layers and the water's 7 under sliders`,
);

// ── THE METER ───────────────────────────────────────────────────────────────

/* global window, document, AudioNode, AudioDestinationNode -- the functions
   handed to `page.addInitScript` and `page.evaluate` run in the PAGE, not in
   Node; these are the page's globals, named so the linter knows. */

/** The moments the beds are metered at — a ladder from a hull at idle to
 * the whole mix flat out, and the two the ear finds faults at: the launch
 * (the froth) and the air (everything but the wind and the free rev). */
const PRESETS = [
  {
    name: "idle, afloat, a breeze",
    craft: { rev: 0, throttle: 0, slip: 1, wetted: 0.95, airborne: false },
    water: { pace: 0, planing: 0, wetted: 0.3, hs: 0.3, wind: 4, surf: 0.8, shore: 150 },
  },
  {
    name: "launch from rest",
    craft: { rev: 0.8, throttle: 1, slip: 1, wetted: 0.9, airborne: false },
    water: { pace: 0.05, planing: 0.1, wetted: 0.6, hs: 0.3, wind: 5, surf: 0.8, shore: 150 },
  },
  {
    name: "cruise",
    craft: { rev: 0.55, throttle: 0.6, slip: 0.35, wetted: 0.69, airborne: false },
    water: { pace: 0.5, planing: 0.8, wetted: 0.4, hs: 0.5, wind: 18, surf: 0.8, shore: 150 },
  },
  {
    name: "flat out",
    craft: { rev: 1, throttle: 1, slip: 0.32, wetted: 0.38, airborne: false },
    water: { pace: 1, planing: 1, wetted: 0.3, hs: 0.5, wind: 34, surf: 0.8, shore: 150 },
  },
  {
    name: "in the air",
    craft: { rev: 1.06, throttle: 1, slip: 1, wetted: 0, airborne: true },
    water: { pace: 0.9, planing: 1, wetted: 0, airborne: true, hs: 0.5, wind: 30, shore: 150 },
  },
  {
    name: "storm sea at the shore",
    craft: { rev: 0.5, throttle: 0.5, slip: 0.4, airborne: false },
    water: { pace: 0.4, planing: 0.7, wetted: 0.5, hs: 3, wind: 25, surf: 3, shore: 10 },
  },
];

/** How long a bed is given to reach its targets before it is read, ms, and
 * how long it is then read for. The glides run to a third of a second, and
 * the surf breathes on a six-second period — the read spans a whole breath
 * so the surf's figure is a mean and not wherever the set happened to be. */
const SETTLE_MS = 1200;
const READ_MS = 6000;
const READ_STEP_MS = 40;

/** The longest one-shot in the bank plus its bubbles' spread, ms. */
const SOUND_MS = 2200;

const db = (rms) => (20 * Math.log10(Math.max(1e-6, rms))).toFixed(1).padStart(6) + " dBFS";

async function meter() {
  let chromium;
  try {
    ({ chromium } = await import("playwright-core"));
  } catch {
    console.error(
      "playwright-core is not installed (it is deliberately not a dependency): " +
        "`npm install --no-save playwright-core@1` — the page is written; only the meter is skipped",
    );
    return;
  }
  const executablePath = process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";
  if (!existsSync(executablePath)) {
    console.error(`no Chromium at ${executablePath} — set CHROMIUM_PATH; the page is written`);
    return;
  }
  const browser = await chromium.launch({
    executablePath,
    // No gesture in a headless page: the context has to be allowed to start
    // on the button the script presses.
    args: ["--autoplay-policy=no-user-gesture-required"],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  // THE TAP: everything that connects to the destination — which is the
  // master limiter, so this hears what the player hears — also feeds an
  // analyser, and the page reads its RMS on demand.
  await page.addInitScript(() => {
    const connect = AudioNode.prototype.connect;
    const taps = [];
    AudioNode.prototype.connect = function (dest, ...rest) {
      if (dest instanceof AudioDestinationNode) {
        const ctx = dest.context;
        if (!ctx.__tap) {
          ctx.__tap = ctx.createAnalyser();
          ctx.__tap.fftSize = 2048;
          taps.push(ctx.__tap);
        }
        connect.call(this, ctx.__tap);
      }
      return connect.call(this, dest, ...rest);
    };
    window.__rms = () => {
      let peak = 0;
      for (const tap of taps) {
        const buf = new Float32Array(tap.fftSize);
        tap.getFloatTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) sum += v * v;
        peak = Math.max(peak, Math.sqrt(sum / buf.length));
      }
      return peak;
    };
  });
  await page.goto(pathToFileURL(out).href);
  await page.click("#unlock");
  await page.waitForTimeout(300);
  const running = await page.evaluate(() => document.getElementById("stateText").textContent);
  console.log(`\nmeter: ${running}, listening from the ${args.seat} seat`);
  /** Mean and peak RMS over a read window. */
  const read = async (ms) => {
    let sum = 0;
    let n = 0;
    let peak = 0;
    for (let t = 0; t < ms; t += READ_STEP_MS) {
      await page.waitForTimeout(READ_STEP_MS);
      const rms = await page.evaluate(() => window.__rms());
      sum += rms;
      n++;
      peak = Math.max(peak, rms);
    }
    return { mean: sum / n, peak };
  };
  await page.evaluate((seat) => {
    window.__ear.seat.view = seat;
  }, args.seat);

  console.log("\nTHE BEDS (mean over a breath / peak)");
  await page.click("#craft");
  await page.click("#water");
  for (const preset of PRESETS) {
    await page.evaluate((p) => {
      Object.assign(window.__ear.craft, p.craft);
      Object.assign(window.__ear.water, { airborne: false, capsized: false, tp: 6 }, p.water);
    }, preset);
    await page.waitForTimeout(SETTLE_MS);
    const { mean, peak } = await read(READ_MS);
    console.log(`  ${preset.name.padEnd(26)} ${db(mean)}   ${db(peak)}`);
  }
  await page.click("#craft");
  await page.click("#water");
  await page.waitForTimeout(400);

  console.log("\nTHE BANK (peak)");
  for (const button of await page.$$("#bank button")) {
    const id = await button.evaluate((b) => b.parentElement.querySelector(".id").textContent);
    await button.click();
    const { peak } = await read(SOUND_MS);
    console.log(`  ${id.padEnd(26)} ${db(peak)}`);
  }
  await browser.close();
  if (errors.length > 0) {
    console.error(`\nthe page threw:\n  ${errors.join("\n  ")}`);
    process.exitCode = 1;
  } else {
    console.log("\nthe page threw nothing");
  }
}

if (args.meter) await meter();
