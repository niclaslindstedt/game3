// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT THE MACHINE IS — the three things about a device that change how its
// benchmark report is READ, rather than merely describing it.
//
// A breakdown of a frame is not actionable on its own: eight milliseconds of
// simulation means one thing on a phone and another on a desktop, a phase
// that reads as 0 ms may be a phase the clock cannot see, and "move it off
// the main thread" is not an answer on a machine with one core to move it
// to. So a report carries a core count, the clock's own resolution and the
// driver's name, and the rest of it is read against those.
//
// NONE OF IT IS IDENTIFYING. A core count, a timer's granularity and a
// string the browser has already decided to publish — no model, no serial,
// nothing that is a person. What a browser withholds comes back as 0 or ""
// and the report simply leaves that bit out; nothing here asks twice or
// falls back to sniffing a user agent.
//
// IT IS READ ONCE, at the end of a run, because none of it can change during
// one. The clock probe SPINS, which is the only way to measure a clock's
// resolution, so it is bounded twice over and never runs inside a frame
// being timed.
//
// WHY IT DOES NOT ASK THE RENDERER FOR ITS CONTEXT. The driver's name is
// debug plumbing with one caller, and the renderer's public surface is what
// the app draws THROUGH; a throwaway 1×1 context answers the same question
// from the same driver and is thrown away in the same breath, which keeps a
// reporting concern out of the module that owns the picture.

import { GPU_NAME_CAP, type Machine, noMachine } from "./benchmark-report.ts";

/** How many times the clock probe waits for the clock to move. Several
 * rather than one because the first wait can land just before a tick and
 * report a step shorter than the clock really has; the answer is the
 * SMALLEST step seen, and a handful of tries is enough to find it. */
const CLOCK_TRIES = 8;

/** The spin's fuse, in reads of the clock. A timer that never moves — a
 * browser with timing disabled entirely, an engine under a debugger — would
 * otherwise hang the page on a debug report. At a millisecond's resolution a
 * wait ends within a few thousand reads; a million is a fuse that cannot be
 * reached by a working clock and cannot cost more than a few milliseconds
 * on a broken one. */
const CLOCK_FUSE = 1e6;

/** THE FINEST STEP `performance.now()` ACTUALLY RESOLVES here, ms, or 0 if
 * the clock never moved.
 *
 * Measured rather than assumed, because the answer is a property of the
 * browser AND of how the page was served: engines clamp the clock against
 * timing attacks — a millisecond in Safari, coarser again on a page that is
 * not cross-origin isolated — and the figure decides how much of the
 * per-frame half of a report can be believed at all. A phase costing a third
 * of the clock's step is never read as itself, which is why a report's
 * breakdown is a run TOTAL rather than a median of readings. */
export function clockResolution(): number {
  let finest = Infinity;
  for (let i = 0; i < CLOCK_TRIES; i++) {
    const from = performance.now();
    let now = from;
    let reads = 0;
    while (now === from && reads < CLOCK_FUSE) {
      now = performance.now();
      reads += 1;
    }
    const step = now - from;
    if (step > 0 && step < finest) finest = step;
  }
  return Number.isFinite(finest) ? finest : 0;
}

/** What the driver calls itself, or "" where the browser withholds it.
 *
 * `WEBGL_debug_renderer_info` is the extension that gives a real name
 * ("Apple GPU", "Adreno (TM) 730"); browsers that treat it as a
 * fingerprinting surface do not expose it, and Safari may hand back a masked
 * name through it. Where it is missing the plain `RENDERER` parameter is
 * asked instead, which is generic ("WebKit WebGL") but still separates one
 * engine's answer from another's. */
function gpuName(gl: WebGLRenderingContext | WebGL2RenderingContext): string {
  const debug = gl.getExtension("WEBGL_debug_renderer_info");
  const unmasked = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null;
  const plain = gl.getParameter(gl.RENDERER);
  const name = typeof unmasked === "string" && unmasked !== "" ? unmasked : plain;
  // Capped HERE as well as on the way back out of the store, so a run reads
  // the same on the card as it does out of the history. Measured: a driver
  // through ANGLE runs to ninety-odd characters, which is why the cap is
  // where it is rather than at a tidier number (`GPU_NAME_CAP`).
  return typeof name === "string" ? name.slice(0, GPU_NAME_CAP) : "";
}

/** …asked of a context of its own, then given back. A 1×1 canvas is enough:
 * the strings are the driver's and have nothing to do with what was drawn.
 * `WEBGL_lose_context` releases it at once rather than leaving it for a
 * collection, because a browser caps how many contexts a page may hold and
 * the one that matters is the game's. */
function readGpu(): string {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
  if (!gl) return "";
  try {
    return gpuName(gl);
  } finally {
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}

/** Everything the report says about the machine. Anything that throws — a
 * context refused, an extension that misbehaves — costs the line it would
 * have written and nothing else: a debug report is never the thing that
 * breaks a run. */
export function readMachine(): Machine {
  const machine = noMachine();
  try {
    const cores = navigator.hardwareConcurrency;
    if (typeof cores === "number" && Number.isFinite(cores) && cores > 0) machine.cores = cores;
  } catch {
    // The browser withholds it; the report leaves the figure out.
  }
  try {
    machine.clockMs = clockResolution();
  } catch {
    // As above — an unmeasurable clock is reported as no measurement.
  }
  try {
    machine.gpu = readGpu();
  } catch {
    // As above.
  }
  return machine;
}
