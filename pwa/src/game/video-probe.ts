// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FIRST-VISIT PROBE: does this machine have headroom over the design
// point, and if so, give it the HIGH picture before the rider ever opens
// OPTIONS.
//
// Every stop above MEDIUM is "a choice somebody makes after finding out their
// machine can hold it" (`settings-video.ts`), and on a phone nobody finds
// that out: the game opens at the design point, looks fine, and a machine
// with twice the headroom rides the same picture as one with none. This
// module is the finding-out, done once, on the attract card, where a couple
// of seconds of measuring cost the rider nothing.
//
// IT MEASURES, IT NEVER LOOKS UP. A browser on a phone reports every GPU as
// the same string and no model at all, so there is no table of devices to
// consult — the only honest answer is to draw the design point for a while
// and time it. What is timed is the whole frame DRAINED: the water's CPU
// bill, the submission, AND the GPU's own execution, which the renderer
// waits for (`renderer.drain`) so a machine whose processor is idle while its
// GPU is flat out cannot read as a fast one. Draining serialises what a
// frame normally pipelines, so the number is a pessimist's: the real frame
// is shorter, and a promotion the probe grants is one the machine can hold
// with room over the measurement.
//
// THE RULE IS AGAINST THE DISPLAY'S OWN FRAME. A promotion may not cost a
// frame the machine is currently drawing: the HIGH picture has to fit inside
// the period the display is delivering at MEDIUM, with `PROBE_HEADROOM`
// standing for how much dearer HIGH is. So a display at a hundred and twenty
// asks twice as much of the machine as one at sixty, and a phone keeping its
// fast refresh at the design point is left keeping it rather than handed a
// prettier picture that drops it.
//
// DOM-free: `judgeHeadroom` takes samples and returns a verdict, and
// `tests/video_test.ts` holds the whole rule without a browser. `App.tsx`
// feeds the probe one frame at a time from the loop and applies the verdict.

import { FPS_STALL_MS } from "./frame-rate.ts";
import {
  DEFAULT_VIDEO,
  DETAIL_PRESETS,
  WATER_PRESETS,
  type VideoSettings,
} from "./settings-video.ts";

/** Frames drawn before the first one is measured. The first seconds of a
 * visit are the shore's shaders compiling and the browser's own tier-up,
 * neither of which says anything about the frames that follow. */
export const PROBE_WARMUP = 30;

/** Frames measured before a verdict. A second and a half at sixty — enough
 * for the bot to have taken a wave or two and the spray to be in the air,
 * so the sample is a ridden sea and not a hull idling at the start line. */
export const PROBE_SAMPLES = 90;

/** How much dearer the HIGH picture is than the design point, as a ratio of
 * drained frame time — the margin the probe asks for over the period before
 * it will promote. The water ladder's own top stop is about one and three
 * quarters of MEDIUM's `surfaceAt` calls (`tests/video_test.ts` holds this
 * number above that ratio), the mirror at SHARP is two and a quarter times
 * SOFT's pixels, and the shore is planted half again as thick; two and a
 * half over the whole drained frame covers the dearest of them with a
 * margin for the half of the frame the drain does not serialise. */
export const PROBE_HEADROOM = 2.5;

/** A frame this many display periods long is a MISSED frame — the machine
 * did not have the next one ready when the display asked. */
export const PROBE_MISSED = 1.5;

/** The share of measured frames that may be missed before the design point
 * itself is judged to be at the machine's limit. A few are the browser's —
 * a garbage collection, a tab in the next window painting — and mean
 * nothing; more than one in thirty is a machine that is already dropping
 * frames, and it gets nothing dearer. */
export const PROBE_MISS_SHARE = 1 / 30;

/** The longest display period, ms, that still counts as keeping a frame
 * rate at all. A sixty-hertz display delivers a frame every sixteen and
 * two thirds; a median much past that is not a slower display, it is a
 * machine drawing every other frame of one, and the display's period is
 * not a budget it has met. */
export const PROBE_KEEPS_MS = 21;

/** How many STALLS the probe sits through before giving up on the visit
 * with a verdict of no. A stall is not a frame and is never counted as
 * one, but a machine that stalls this often at the design point — a
 * software rasterizer, a phone with the tab throttled — is not one with
 * headroom, and a probe that waited for its ninety clean frames would
 * drain every one of its frames under every card, on every visit, for
 * nothing. */
export const PROBE_STALLS = 30;

/** One measured frame: how long the display waited for it, and how long the
 * whole of it took to draw with the GPU drained. */
export type ProbeSample = { elapsedMs: number; drawMs: number };

/**
 * The verdict over a set of samples: whether this machine has room for the
 * HIGH picture at the rate it is currently keeping.
 *
 * Three questions, any of which says no on its own. Is the display's own
 * period one the machine is meeting (`PROBE_KEEPS_MS`)? Is it meeting it
 * steadily (`PROBE_MISS_SHARE`)? And would a frame `PROBE_HEADROOM` times
 * dearer than the ninth-decile one still fit inside that period? The ninth
 * decile rather than the mean because a picture is judged by its worst
 * ordinary frame — the landing's plume, the wave with the whole shore in
 * the mirror — and a mean would let a machine that is fine most of the
 * time promote itself into one that stutters at every landing.
 */
export function judgeHeadroom(samples: readonly ProbeSample[]): boolean {
  if (samples.length === 0) return false;
  const period = median(samples.map((s) => s.elapsedMs));
  if (period > PROBE_KEEPS_MS) return false;
  const missed = samples.filter((s) => s.elapsedMs > period * PROBE_MISSED).length;
  if (missed / samples.length > PROBE_MISS_SHARE) return false;
  const worst = decile(
    samples.map((s) => s.drawMs),
    0.9,
  );
  return worst * PROBE_HEADROOM <= period;
}

/**
 * True while the rider has expressed no opinion about the picture — every
 * row at the stop it shipped at. A blob with any row moved belongs to
 * somebody who has already been to OPTIONS, and the probe has nothing to
 * tell them; a blob from a build before the probe existed is the same
 * case, which is why an old rider's LOW is never overwritten by a fast
 * afternoon.
 */
export function videoUntouched(video: VideoSettings): boolean {
  return (Object.keys(DEFAULT_VIDEO) as (keyof VideoSettings)[]).every(
    (key) => video[key] === DEFAULT_VIDEO[key],
  );
}

/**
 * The picture a machine with headroom is given: WATER, DETAIL and DISTANCE
 * at their top stops — the three rows whose top stop is "a machine with
 * headroom" by its own description. RESOLUTION already ships at the
 * device's own screen, SEE-THROUGH already ships on, and the FRAME RATE
 * cap is a choice about this machine that no measurement makes.
 *
 * Applied only to an untouched picture; anything else comes back as it
 * was, the same object, so a caller can tell nothing moved.
 */
export function promoteVideo(video: VideoSettings): VideoSettings {
  if (!videoUntouched(video)) return video;
  return {
    ...video,
    water: "high",
    ...WATER_PRESETS.high,
    distance: "high",
    ...DETAIL_PRESETS.high,
  };
}

/** The probe as the loop feeds it: one call a drawn frame, a verdict once. */
export type VideoProbe = {
  /** Hand the probe one frame — the display's wait for it and its drained
   * draw time, both ms. Null while it is still measuring; the verdict on
   * the frame that completes the sample, and null forever after. */
  frame: (elapsedMs: number, drawMs: number) => boolean | null;
  /** True once the verdict has been given. */
  done: () => boolean;
};

export function createVideoProbe(): VideoProbe {
  let warm = 0;
  let stalls = 0;
  const samples: ProbeSample[] = [];
  let done = false;
  return {
    frame: (elapsedMs, drawMs) => {
      if (done) return null;
      // A stall is not a frame — the tab coming back, a level being built,
      // a shader compiling — and neither is a frame stamped before the last
      // one, which is what the first callback after a build carries. Both
      // are dropped from the sample rather than counted against it — until
      // there have been so many that the machine has answered.
      if (!(elapsedMs > 0) || elapsedMs > FPS_STALL_MS) {
        if (++stalls < PROBE_STALLS) return null;
        done = true;
        return false;
      }
      if (warm < PROBE_WARMUP) {
        warm++;
        return null;
      }
      samples.push({ elapsedMs, drawMs });
      if (samples.length < PROBE_SAMPLES) return null;
      done = true;
      return judgeHeadroom(samples);
    },
    done: () => done,
  };
}

function median(values: readonly number[]): number {
  return decile(values, 0.5);
}

/** The value `share` of the way up the sorted list — the nearest rank,
 * never an interpolation, so a decile is a frame that actually happened. */
function decile(values: readonly number[], share: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(share * (sorted.length - 1) + 0.5))];
}
