// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AUDIO GUARDS — the faults in this subsystem that are invisible without
// a test, because every one of them is a SILENCE rather than a crash.
//
// Five kinds, and each has bitten a game that shipped without the guard:
//
//   * AN EVENT NOTHING ANSWERS. A new `GameEvent` arrives and simply makes no
//     noise; nothing anywhere reports it.
//   * A MIX THAT CREEPS. Every retune nudges one sound up to be heard over
//     the last one, and six months later the whole bank is at full scale and
//     the limiter is doing all the work.
//   * A BED THAT SAYS NOTHING. A spray as loud at rest as at pace, an engine
//     that does not change in the air — a bed whose numbers are constants is
//     the loudest thing in the mix for the whole run.
//   * A BED THAT HOLDS. The pause card up, the tab away, and the engine note
//     playing on behind it — a layer that is not told to stop does not.
//   * A CUTOFF PAST NYQUIST. Fine on a laptop, a torn speaker on the 16 kHz
//     session iOS hands a Bluetooth headset.
//
// No DOM: the synth is replaced with a recorder, which is also the only way
// to assert what a sound actually asked the instrument for.

import { describe, expect, it } from "vitest";

import { TUNING, createGame, placeRun, totalMass, type GameEvent } from "@engine";

import { RUN_BANK } from "../pwa/src/game/audio/bank.ts";
import { createBirdBed } from "../pwa/src/game/audio/bird-bed.ts";
import {
  BIRD_CALLS,
  CRY_SLOT,
  FLUSH_CRIES,
  callRate,
  criesIn,
  cryPan,
  heardAt,
  type Cry,
} from "../pwa/src/game/audio/bird-voice.ts";
import { bubbleBurst, bubbleVoice } from "../pwa/src/game/audio/bubbles.ts";
import {
  ENGINE_LAYERS,
  engineTargets,
  exhaustClear,
  noteHz,
  revOf,
  rpmAt,
  whineHz,
  type EngineLayer,
  type EngineVoice,
} from "../pwa/src/game/audio/engine-voice.ts";
import { LISTENERS, listenerFor } from "../pwa/src/game/audio/listener.ts";
import { DEFAULT_VOLUME, playDef } from "../pwa/src/game/audio/play.ts";
import { createRideBed } from "../pwa/src/game/audio/ride-bed.ts";
import {
  bubblesForEvent,
  heardFrom,
  recordForEvent,
  soundForEvent,
} from "../pwa/src/game/audio/route.ts";
import type { SoundBank } from "../pwa/src/game/audio/types.ts";
import {
  SURF_REACH,
  WATER_LAYERS,
  WIND_FULL,
  shoreReach,
  surfBreath,
  waterTargets,
  type WaterLayer,
  type WaterVoice,
} from "../pwa/src/game/audio/water-voice.ts";
import { BIRD_IDS } from "../pwa/src/game/bird-defs.ts";
import { planBirds } from "../pwa/src/game/bird-plan.ts";
import { SCREEN_TO_ENGINE } from "../pwa/src/game/input-model.ts";
import { SFX_STEP, mergeSettings } from "../pwa/src/game/settings.ts";
import {
  MAX_CUTOFF_RATIO,
  MIN_ATTACK_MS,
  envelopeShape,
  safeCutoff,
  shaperPush,
  shaperSteepness,
  type LayerSpec,
  type LayerTarget,
  type NoiseOptions,
  type Synth,
  type ToneOptions,
} from "../pwa/src/lib/voice.ts";
import { syntheticLevel } from "./support/synthetic.ts";

/** One layer the recorder built: what it was made of, every target it was
 * steered to, and whether it is still standing. */
type RecordedLayer = {
  spec: LayerSpec;
  sets: { target: LayerTarget; glide: number }[];
  stopped: boolean;
  generation: number;
};

/** A synth that plays nothing and remembers everything, with a clock the test
 * drives by hand, a lock it can throw, and a context it can replace. */
function recorder(): Synth & {
  tones: ToneOptions[];
  noises: NoiseOptions[];
  layers: RecordedLayer[];
  clock: number;
  locked: boolean;
  generation: number;
} {
  const rec = {
    tones: [] as ToneOptions[],
    noises: [] as NoiseOptions[],
    layers: [] as RecordedLayer[],
    clock: 0,
    locked: false,
    generation: 0,
    unlock: () => {},
    resume: () => {},
    now: () => (rec.locked ? null : rec.clock),
    tone: (o: ToneOptions) => void rec.tones.push(o),
    noise: (o: NoiseOptions) => void rec.noises.push(o),
    layer(spec: LayerSpec) {
      if (rec.locked) return null;
      const layer: RecordedLayer = { spec, sets: [], stopped: false, generation: rec.generation };
      rec.layers.push(layer);
      return {
        set: (target: LayerTarget, glide: number) => void layer.sets.push({ target, glide }),
        stop: () => {
          layer.stopped = true;
        },
        alive: () => !layer.stopped && layer.generation === rec.generation,
      };
    },
  };
  return rec;
}

/** The rates a context has come back at in the wild: a desktop, a phone on
 * its speaker, a hands-free Bluetooth headset. */
const SAMPLE_RATES = [48000, 44100, 16000];

/** Every authored cutoff in a bank, `frequency` and `to` alike. */
function cutoffsOf(bank: SoundBank): number[] {
  const out: number[] = [];
  for (const def of Object.values(bank)) {
    for (const voice of def.voices) {
      if (!voice.filter) continue;
      out.push(voice.filter.frequency);
      if (voice.filter.to !== undefined) out.push(voice.filter.to);
    }
  }
  return out;
}

/** The loudest a bank's voices go. */
function peakOf(bank: SoundBank): number {
  let peak = 0;
  for (const def of Object.values(bank)) {
    for (const voice of def.voices)
      peak = Math.max(peak, voice.volume ?? DEFAULT_VOLUME[voice.call]);
  }
  return peak;
}

/** One event of every kind the engine can emit, at a middling size. */
const EVERY_EVENT: GameEvent[] = [
  { kind: "gate", t: 1, gate: 0, split: 12 },
  { kind: "airGate", t: 1, gate: 1, split: 20, height: 3 },
  { kind: "missedGate", t: 1, gate: 2, penalty: 5 },
  { kind: "launch", t: 1, vy: 4, speed: 20 },
  { kind: "land", t: 1, vy: -4, airTime: 0.8, pitch: 0.1, speed: 18, record: false },
  { kind: "dive", t: 1, depth: 0.8, speed: 15 },
  { kind: "hit", t: 1, solid: "skerry", speed: 9 },
  { kind: "ground", t: 1, speed: 4 },
  { kind: "capsize", t: 1, speed: 2 },
  { kind: "reset", t: 1, gate: 3 },
  { kind: "finish", t: 1, time: 88 },
];

const STRIP = syntheticLevel({ windSpeed: 8, noSolids: true, seaward: 1200 });

describe("the instrument's arithmetic (lib/voice.ts)", () => {
  it("holds every cutoff under Nyquist at every rate a context comes back at", () => {
    for (const rate of SAMPLE_RATES) {
      expect(safeCutoff(20000, rate)).toBeLessThanOrEqual(rate * MAX_CUTOFF_RATIO);
      expect(safeCutoff(5, rate)).toBe(20);
      expect(safeCutoff(1000, rate)).toBe(1000);
    }
  });

  it("never lets a voice step onto full scale", () => {
    const steps = envelopeShape(0.05, 10, 10.2, 0, 0, "lin");
    expect(steps[0]).toEqual({ at: 10, value: 0, ramp: "set" });
    expect(steps[1].at - 10).toBeCloseTo(MIN_ATTACK_MS / 1000, 6);
    expect(steps[1].value).toBe(0.05);
    // A hold is its own point, so the decay starts from the top of it.
    const held = envelopeShape(0.05, 0, 1, 20, 300, "exp");
    expect(held.map((s) => s.ramp)).toEqual(["set", "exp", "set", "exp"]);
    expect(held[2].at).toBeCloseTo(0.32, 6);
    // An exponential ramp may not touch zero.
    expect(held[0].value).toBeGreaterThan(0);
    expect(held[held.length - 1].value).toBeGreaterThan(0);
  });

  it("saturates softly: the curve's steepness and push are bounded", () => {
    expect(shaperSteepness(0)).toBe(1);
    expect(shaperSteepness(1)).toBe(10);
    expect(shaperSteepness(4)).toBe(10);
    expect(shaperPush(1)).toBe(4);
  });
});

describe("the bank (audio/bank.ts)", () => {
  it("describes every sound, in a sentence the next retune is checked against", () => {
    for (const [id, def] of Object.entries(RUN_BANK)) {
      expect(def.description.length, `${id} has no description`).toBeGreaterThan(60);
      expect(def.voices.length, `${id} has no voices`).toBeGreaterThan(0);
    }
  });

  it("keeps every voice under the mixing ceiling", () => {
    expect(peakOf(RUN_BANK)).toBeLessThanOrEqual(0.1);
    // The chimes are quieter than the water: the course is heard OVER a
    // run, never instead of one.
    for (const id of ["gate", "air_gate", "missed", "finish", "air_record"]) {
      for (const voice of RUN_BANK[id].voices)
        expect(voice.volume ?? 1, id).toBeLessThanOrEqual(0.04);
    }
  });

  it("authors every cutoff where the clamp can still give it back", () => {
    for (const hz of cutoffsOf(RUN_BANK)) {
      expect(hz).toBeGreaterThanOrEqual(20);
      // Under 7 kHz: on the 16 kHz Bluetooth session the clamp stops the
      // fault but cannot give back a hiss authored above the ceiling.
      expect(hz).toBeLessThanOrEqual(7000);
      for (const rate of SAMPLE_RATES) expect(safeCutoff(hz, rate)).toBeLessThan(rate / 2);
    }
  });

  it("gives water no transient: every splash opens over an attack", () => {
    for (const id of ["land_soft", "dive", "capsize", "launch", "reset"]) {
      for (const voice of RUN_BANK[id].voices) {
        if (voice.call === "noise") expect(voice.attackMs ?? 0, `${id}`).toBeGreaterThan(0);
      }
    }
    // ...and the one thing that is not water does have one.
    const crack = RUN_BANK.hit_rock.voices[0];
    expect(crack.call).toBe("noise");
    expect(crack.attackMs ?? 0).toBe(0);
  });
});

describe("the route (audio/route.ts)", () => {
  it("answers every event the engine can emit with a sound the bank has", () => {
    for (const event of EVERY_EVENT) {
      const hit = soundForEvent(event);
      expect(hit, `${event.kind} is silent`).not.toBeNull();
      expect(RUN_BANK[hit!.id], `${event.kind} → ${hit!.id}, which the bank lacks`).toBeDefined();
    }
  });

  it("sizes a landing by its descent and picks the slammed one by descent or attitude", () => {
    const soft = soundForEvent({
      kind: "land",
      t: 0,
      vy: -2,
      airTime: 0.4,
      pitch: 0,
      speed: 15,
      record: false,
    })!;
    const hard = soundForEvent({
      kind: "land",
      t: 0,
      vy: -9,
      airTime: 1.5,
      pitch: 0,
      speed: 20,
      record: false,
    })!;
    const nose = soundForEvent({
      kind: "land",
      t: 0,
      vy: -2,
      airTime: 0.4,
      pitch: -0.5,
      speed: 15,
      record: false,
    })!;
    expect(soft.id).toBe("land_soft");
    expect(hard.id).toBe("land_hard");
    expect(nose.id).toBe("land_hard");
    expect(hard.shape!.gain!).toBeGreaterThan(soft.shape!.gain!);
    expect(hard.shape!.pitch!).toBeLessThan(soft.shape!.pitch!);
    expect(hard.shape!.stretch!).toBeGreaterThan(soft.shape!.stretch!);
    // A floor under the gentlest landing: a hull is heavy.
    expect(soft.shape!.gain!).toBeGreaterThan(0.6);
  });

  it("makes a harder hit louder, lower and longer — one sound, scaled", () => {
    const nudge = soundForEvent({ kind: "hit", t: 0, solid: "skerry", speed: 3 })!;
    const wreck = soundForEvent({ kind: "hit", t: 0, solid: "skerry", speed: 20 })!;
    expect(nudge.id).toBe(wreck.id);
    expect(wreck.shape!.gain!).toBeGreaterThan(nudge.shape!.gain!);
    expect(wreck.shape!.pitch!).toBeLessThan(nudge.shape!.pitch!);
  });

  it("leaves bubbles after the water closes, more and deeper the more went under", () => {
    const land = bubblesForEvent({
      kind: "land",
      t: 0,
      vy: -3,
      airTime: 0.5,
      pitch: 0,
      speed: 15,
      record: false,
    })!;
    const dive = bubblesForEvent({ kind: "dive", t: 0, depth: 1, speed: 15 })!;
    const over = bubblesForEvent({ kind: "capsize", t: 0, speed: 1 })!;
    expect(dive.count).toBeGreaterThan(land.count);
    expect(dive.big).toBeGreaterThan(land.big);
    expect(over.count).toBeGreaterThan(dive.count);
    expect(bubblesForEvent({ kind: "gate", t: 0, gate: 0, split: 1 })).toBeNull();
    expect(bubblesForEvent({ kind: "hit", t: 0, solid: "skerry", speed: 9 })).toBeNull();
  });

  it("lays the record's own chime over the landing that took it, and nothing else", () => {
    const landing = {
      kind: "land",
      t: 1,
      vy: -4,
      airTime: 2.4,
      pitch: 0.1,
      speed: 18,
    } as const;
    const best = recordForEvent({ ...landing, record: true })!;
    expect(best.id).toBe("air_record");
    expect(RUN_BANK[best.id]).toBeDefined();
    // The landing is still a landing: the news is a SECOND voice over it,
    // not a different splash.
    expect(soundForEvent({ ...landing, record: true })!.id).toBe(
      soundForEvent({ ...landing, record: false })!.id,
    );
    expect(recordForEvent({ ...landing, record: false })).toBeNull();
    for (const event of EVERY_EVENT)
      if (event.kind !== "land") expect(recordForEvent(event)).toBeNull();
  });

  it("hears a play from the seat: the listener's gain and its muffle", () => {
    const heard = heardFrom({ gain: 2, pitch: 0.5 }, { events: 0.5, muffle: 0.9 });
    expect(heard.gain).toBeCloseTo(1, 9);
    expect(heard.pitch).toBeCloseTo(0.45, 9);
    expect(heardFrom(undefined, LISTENERS.heli).gain).toBe(LISTENERS.heli.events);
  });
});

describe("playing a def through a shape (audio/play.ts)", () => {
  it("scales the pitch, the filters and the length together, and a glide-less voice stays put", () => {
    const rec = recorder();
    playDef(rec, RUN_BANK.gate, { pitch: 2, gain: 0.5, stretch: 1.5 });
    const first = RUN_BANK.gate.voices[0];
    expect(first.call).toBe("tone");
    const played = rec.tones[0];
    expect(played.from).toBeCloseTo((first as { from: number }).from * 2, 9);
    expect(played.to).toBeUndefined();
    expect(played.durationMs).toBeCloseTo(first.durationMs * 1.5, 9);
    expect(played.volume).toBeCloseTo((first.volume ?? DEFAULT_VOLUME.tone) * 0.5, 9);
    const body = rec.tones[1];
    expect(body.filter!.frequency).toBe(3600);
  });

  it("plays an unshaped def verbatim, tone and noise alike", () => {
    const rec = recorder();
    playDef(rec, RUN_BANK.land_soft);
    expect(rec.noises.length).toBe(3);
    expect(rec.tones.length).toBe(0);
    expect(rec.noises[0]).toEqual({ ...RUN_BANK.land_soft.voices[0], call: undefined });
  });
});

describe("the bubbles (audio/bubbles.ts)", () => {
  const random = () => 0.5;

  it("rings at Minnaert's frequency and chirps upward", () => {
    const mm = bubbleVoice(0.001, 1, random);
    expect(mm.from).toBeCloseTo(3260, 0);
    expect(mm.to!).toBeGreaterThan(mm.from);
    const cm = bubbleVoice(0.01, 1, random);
    expect(cm.from).toBeCloseTo(326, 0);
    expect(cm.durationMs).toBeGreaterThan(mm.durationMs);
    expect(mm.type).toBe("sine");
  });

  it("is a gloss layer, never a hit: quiet, spread over a second, one tone each", () => {
    const rec = recorder();
    bubbleBurst(rec, 12, 0.5, 1, random);
    expect(rec.tones.length).toBe(12);
    for (const tone of rec.tones) {
      expect(tone.volume!).toBeLessThanOrEqual(0.012);
      expect(tone.delayMs!).toBeLessThanOrEqual(1100);
      expect(tone.at).toBeUndefined();
    }
  });
});

describe("the engine bed (audio/engine-voice.ts)", () => {
  const voice = (over: Partial<EngineVoice>): EngineVoice => ({
    rpm: 5000,
    rev: revOf(5000, 1500, 7600),
    throttle: 0.8,
    load: 0.8,
    wet: 1,
    slip: 0.3,
    // The default is a craft AT PACE with its pipe still in the water —
    // which is the ordinary state of a run, and the one the mix is judged
    // against. `exhaustClear` reads about this off a hull on full plane.
    clear: 0.24,
    ...over,
  });
  const mix = { engine: 1, exhaust: 1, pump: 1, tone: 1 };

  it("makes its note from the crank: three cylinders, four strokes, eighteen blade-vane crossings", () => {
    expect(noteHz(1500)).toBeCloseTo(37.5, 9);
    expect(noteHz(8000)).toBeCloseTo(200, 9);
    expect(whineHz(8000)).toBeCloseTo(2400, 9);
    expect(rpmAt(revOf(4200, 1500, 7600), 1500, 7600)).toBeCloseTo(4200, 6);
    const t = engineTargets(voice({}), mix);
    expect(t.hum.hz).toBeCloseTo(noteHz(5000), 9);
    expect(t.octave.hz).toBeCloseTo(noteHz(5000) * 2, 9);
    expect(t.whine.hz).toBeCloseTo(whineHz(5000), 9);
    expect(t.bass.hz).toBeGreaterThanOrEqual(44);
  });

  it("works harder with the load and runs free in the air", () => {
    const idle = engineTargets(
      voice({ rpm: 1500, rev: 0, throttle: 0, load: 0, slip: 1, clear: 0 }),
      mix,
    );
    const pulling = engineTargets(voice({}), mix);
    const flying = engineTargets(voice({ load: 0, wet: 0, slip: 1, clear: 1 }), mix);
    expect(pulling.hum.level).toBeGreaterThan(idle.hum.level);
    expect(pulling.hum.grit!).toBeGreaterThan(idle.hum.grit!);
    // The air: the same throttle, nothing to push against.
    expect(flying.hum.level).toBeLessThan(pulling.hum.level);
    expect(flying.froth.level).toBe(0);
    expect(flying.gurgle.level).toBe(0);
    expect(flying.whine.level).toBeLessThan(pulling.whine.level);
    // Idle, afloat: the pipe gurgles and the pump does not froth.
    expect(idle.gurgle.level).toBeGreaterThan(0);
    expect(idle.froth.level).toBe(0);
    expect(idle.octave.level).toBeGreaterThan(pulling.octave.level);
  });

  it("is heard THROUGH the water until the exhaust clears it", () => {
    // `exhaustClear` off the hull's own measured dry share: at rest almost
    // nothing is out of the water, at full plane the stern is running dry,
    // and in the air all of it is.
    const rest = exhaustClear(0.95, false, false);
    const plane = exhaustClear(0.38, false, false);
    expect(rest).toBeLessThan(0.01);
    expect(plane).toBeGreaterThan(rest);
    expect(plane).toBeLessThan(0.4);
    expect(exhaustClear(0, true, false)).toBe(1);
    // A hull on its back has its bottom in the air and its PIPE under the
    // surface, so the raw dry share says exactly the wrong thing.
    expect(exhaustClear(0, false, true)).toBe(0);

    const under = engineTargets(voice({ clear: 0 }), mix);
    const air = engineTargets(voice({ clear: 1 }), mix);
    // Out of the water the engine is louder AND brighter — the same revs,
    // the same throttle, the water simply no longer in the way.
    expect(air.hum.level).toBeGreaterThan(under.hum.level * 1.5);
    expect(air.hum.cutoff!).toBeGreaterThan(under.hum.cutoff! * 1.5);
    // The exhaust's EDGE is the layer the waterline owns outright.
    expect(air.rasp.level).toBeGreaterThan(under.rasp.level * 4);
    // ...and the wet blat is the other way round: it IS the engine while the
    // pipe is under, and it is gone the moment the pipe is out.
    expect(under.gurgle.level).toBeGreaterThan(0);
    expect(air.gurgle.level).toBe(0);
    // The note still comes through the hull's structure with the pipe under
    // — a submerged engine goes quiet, never silent.
    expect(under.hum.level).toBeGreaterThan(0);
    expect(under.bass.level).toBeGreaterThan(air.bass.level * 0.7);
  });

  it("carries the wet blat right up the rev band, not just at idle", () => {
    // A pipe exhausting under water does not stop blatting because the revs
    // came up: it goes from a knock to a hard wet tearing. The layer that
    // vanished by mid-band left the engine with nothing to be while the
    // water was holding its note down.
    const idle = engineTargets(voice({ rev: 0, clear: 0 }), mix);
    const hard = engineTargets(voice({ rev: 1, clear: 0 }), mix);
    expect(hard.gurgle.level).toBeGreaterThan(idle.gurgle.level * 0.3);
    expect(hard.gurgle.cutoff!).toBeGreaterThan(idle.gurgle.cutoff!);
  });

  it("froths on a launch from rest and not at pace", () => {
    const launch = engineTargets(voice({ rpm: 6000, throttle: 1, load: 1, slip: 1 }), mix);
    const cruise = engineTargets(voice({ rpm: 6000, throttle: 1, load: 1, slip: 0.32 }), mix);
    expect(launch.froth.level).toBeGreaterThan(0.01);
    expect(cruise.froth.level).toBe(0);
  });

  it("goes dark from a seat with the block in the way, and the exhaust is heard from behind", () => {
    const bright = engineTargets(voice({}), mix);
    const dark = engineTargets(voice({}), { ...mix, tone: 0.5, exhaust: 0.4 });
    expect(dark.hum.cutoff!).toBeLessThan(bright.hum.cutoff!);
    expect(dark.rasp.level).toBeLessThan(bright.rasp.level);
  });

  it("keeps every computed cutoff under the headset's Nyquist across the whole range", () => {
    const ceiling = safeCutoff(1e9, 16000);
    for (let rev = 0; rev <= 1.06; rev += 0.106) {
      for (const throttle of [0, 0.5, 1]) {
        for (const wet of [0, 1]) {
          for (const clear of [0, 0.5, 1]) {
            const t = engineTargets(
              voice({
                rpm: rpmAt(rev, 1600, 8000),
                rev,
                throttle,
                load: throttle * wet,
                wet,
                slip: 1,
                clear,
              }),
              { ...mix, tone: 1 },
            );
            for (const name of Object.keys(t) as EngineLayer[]) {
              const cutoff = t[name].cutoff;
              if (cutoff !== undefined) expect(cutoff, name).toBeLessThanOrEqual(ceiling);
              expect(t[name].level, name).toBeGreaterThanOrEqual(0);
            }
          }
        }
      }
    }
    expect(Object.keys(ENGINE_LAYERS).sort()).toEqual(
      Object.keys(engineTargets(voice({}), mix)).sort(),
    );
  });
});

describe("the water bed (audio/water-voice.ts)", () => {
  const voice = (over: Partial<WaterVoice>): WaterVoice => ({
    speed: 20,
    pace: 0.7,
    planing: 1,
    wetted: 0.4,
    airborne: false,
    capsized: false,
    hs: 0.8,
    wind: 22,
    surf: 1.2,
    shore: 120,
    shorePan: 0.5,
    tp: 6,
    t: 3,
    ...over,
  });
  const mix = { hull: 1, wind: 1, sea: 1 };

  it("is silent at rest on a flat calm in still air, far from any shore", () => {
    const t = waterTargets(
      voice({ speed: 0, pace: 0, planing: 0, wetted: 0.3, hs: 0, wind: 0, surf: 0, shore: 900 }),
      mix,
    );
    for (const name of Object.keys(t) as WaterLayer[]) expect(t[name].level, name).toBe(0);
  });

  it("sells speed with the spray: nothing until the hull planes, then steeply with the pace", () => {
    const wash = waterTargets(voice({ speed: 4, pace: 0.15, planing: 0 }), mix);
    const slow = waterTargets(voice({ pace: 0.4 }), mix);
    const fast = waterTargets(voice({ pace: 1 }), mix);
    expect(wash.spray.level).toBe(0);
    expect(wash.wash.level).toBeGreaterThan(0);
    expect(fast.spray.level).toBeGreaterThan(slow.spray.level * 2);
    expect(fast.spray.cutoff!).toBeGreaterThan(slow.spray.cutoff!);
    // ...and the wash hands over as the bottom lifts out.
    expect(fast.wash.level).toBeLessThan(wash.wash.level);
  });

  it("leaves only the wind in the air, and only the sea on a capsized hull", () => {
    const afloat = waterTargets(voice({}), mix);
    const flying = waterTargets(voice({ airborne: true }), mix);
    const over = waterTargets(voice({ capsized: true, speed: 0, pace: 0, planing: 0 }), mix);
    for (const name of ["wash", "spray", "chop"] as const) {
      expect(afloat[name].level, name).toBeGreaterThan(0);
      expect(flying[name].level, name).toBe(0);
      expect(over[name].level, name).toBe(0);
    }
    expect(flying.wind.level).toBeCloseTo(afloat.wind.level, 9);
    expect(over.sea.level).toBeGreaterThan(0);
  });

  it("hears the wind on the square of the apparent wind", () => {
    const calm = waterTargets(voice({ wind: 5 }), mix);
    const half = waterTargets(voice({ wind: WIND_FULL / 2 }), mix);
    const full = waterTargets(voice({ wind: WIND_FULL }), mix);
    expect(full.wind.level).toBeCloseTo(half.wind.level * 4, 9);
    expect(calm.wind.level).toBeGreaterThan(0);
    expect(full.wind.cutoff!).toBeGreaterThan(half.wind.cutoff!);
  });

  it("slaps through a chop and not on flat water", () => {
    const flat = waterTargets(voice({ hs: 0 }), mix);
    const chop = waterTargets(voice({ hs: 1.2 }), mix);
    expect(flat.chop.level).toBe(0);
    expect(chop.chop.level).toBeGreaterThan(0);
  });

  it("hears the surf from the shore, breathing on the sea's period, panned to the beach", () => {
    const beach = waterTargets(voice({ shore: 0 }), mix);
    const off = waterTargets(voice({ shore: SURF_REACH * 0.5 }), mix);
    const gone = waterTargets(voice({ shore: SURF_REACH + 10 }), mix);
    expect(beach.surf.level).toBeGreaterThan(off.surf.level);
    expect(off.surf.level).toBeGreaterThan(0);
    expect(gone.surf.level).toBe(0);
    expect(gone.foam.level).toBe(0);
    expect(shoreReach(-50)).toBe(1);
    expect(beach.surf.pan).toBeCloseTo(0.3, 9);
    expect(beach.foam.pan).toBeCloseTo(0.3, 9);
    // The breath never reaches silence and never exceeds a set.
    let lo = 1;
    let hi = 0;
    for (let t = 0; t < 60; t += 0.1) {
      const b = surfBreath(t, 6);
      lo = Math.min(lo, b);
      hi = Math.max(hi, b);
    }
    expect(lo).toBeGreaterThanOrEqual(0.25);
    expect(hi).toBeLessThanOrEqual(1);
    expect(hi - lo).toBeGreaterThan(0.4);
    // A flat sea breaks nothing.
    expect(waterTargets(voice({ shore: 0, surf: 0 }), mix).surf.level).toBe(0);
  });

  it("keeps every computed cutoff under the headset's Nyquist across the whole range", () => {
    const ceiling = safeCutoff(1e9, 16000);
    for (const pace of [0, 0.5, 1]) {
      for (const hs of [0, 1.5, 4]) {
        for (const wind of [0, 20, 40]) {
          for (const shore of [0, 100, 300]) {
            const t = waterTargets(
              voice({ pace, speed: pace * 30, hs, wind, shore, surf: hs }),
              mix,
            );
            for (const name of Object.keys(t) as WaterLayer[]) {
              expect(t[name].cutoff!, name).toBeLessThanOrEqual(ceiling);
              expect(t[name].level, name).toBeGreaterThanOrEqual(0);
              expect(t[name].level, name).toBeLessThanOrEqual(0.05);
            }
          }
        }
      }
    }
    expect(Object.keys(WATER_LAYERS).sort()).toEqual(
      Object.keys(waterTargets(voice({}), mix)).sort(),
    );
  });
});

describe("the listener (audio/listener.ts)", () => {
  it("has a row per rung of the ladder, every column a sane multiplier", () => {
    expect(Object.keys(LISTENERS).sort()).toEqual([
      "bow",
      "chase",
      "close",
      "drone",
      "far",
      "heli",
      "nose",
    ]);
    for (const [view, ear] of Object.entries(LISTENERS)) {
      for (const [k, v] of Object.entries(ear)) {
        expect(v, `${view}.${k}`).toBeGreaterThan(0);
        expect(v, `${view}.${k}`).toBeLessThanOrEqual(2);
      }
      expect(ear.tone).toBeLessThanOrEqual(1);
      expect(ear.muffle).toBeLessThanOrEqual(1);
    }
  });

  it("moves the mix with the camera: the water up close, the sea from the air", () => {
    expect(LISTENERS.bow.hull).toBeGreaterThan(LISTENERS.heli.hull);
    expect(LISTENERS.bow.wind).toBeGreaterThan(LISTENERS.heli.wind);
    expect(LISTENERS.heli.sea).toBeGreaterThan(LISTENERS.nose.sea);
    // …and the seat straight overhead is the helicopter's twice as far off:
    // the craft thinner in every band, and the sea — the one thing that is
    // not coming from the craft — the widest it ever is.
    expect(LISTENERS.drone.engine).toBeLessThan(LISTENERS.heli.engine);
    expect(LISTENERS.drone.wind).toBeLessThan(LISTENERS.heli.wind);
    expect(LISTENERS.drone.sea).toBeGreaterThan(LISTENERS.heli.sea);
    expect(LISTENERS.close.pump).toBeGreaterThan(LISTENERS.bow.pump);
    expect(LISTENERS.nose.engine).toBeGreaterThan(LISTENERS.far.engine);
    expect(listenerFor("anything else")).toBe(LISTENERS.chase);
    expect(listenerFor(null)).toBe(LISTENERS.chase);
  });
});

describe("the ride bed (audio/ride-bed.ts)", () => {
  const LAYER_COUNT = Object.keys(ENGINE_LAYERS).length + Object.keys(WATER_LAYERS).length;

  const runAt = (speed: number) => {
    const state = createGame({ seed: 1, craft: "skiff", level: STRIP, quiet: true });
    placeRun(state, { x: 0, z: 400, heading: Math.PI / 2, speed });
    return state;
  };

  it("builds its layers once and steers them every frame, booking nothing ahead", () => {
    const rec = recorder();
    const bed = createRideBed(rec);
    const state = runAt(15);
    for (let i = 0; i < 40; i++) {
      bed.update(state, 1 / 60);
      rec.clock += 1 / 60;
    }
    expect(rec.layers.length).toBe(LAYER_COUNT);
    expect(bed.live()).toBe(LAYER_COUNT);
    for (const layer of rec.layers) expect(layer.sets.length).toBe(40);
    for (const tone of rec.tones) expect(tone.at).toBeUndefined();
    for (const noise of rec.noises) expect(noise.at).toBeUndefined();
  });

  it("is silent while the context is locked and builds the moment it is back", () => {
    const rec = recorder();
    const bed = createRideBed(rec);
    const state = runAt(10);
    rec.locked = true;
    bed.update(state, 1 / 60);
    expect(rec.layers.length).toBe(0);
    rec.locked = false;
    bed.update(state, 1 / 60);
    expect(bed.live()).toBe(LAYER_COUNT);
  });

  it("says its silence: the layers come down and come back on the next frame", () => {
    const rec = recorder();
    const bed = createRideBed(rec);
    const state = runAt(10);
    bed.update(state, 1 / 60);
    bed.silence();
    expect(bed.live()).toBe(0);
    expect(rec.layers.every((l) => l.stopped)).toBe(true);
    bed.update(state, 1 / 60);
    expect(bed.live()).toBe(LAYER_COUNT);
    expect(rec.layers.length).toBe(LAYER_COUNT * 2);
  });

  it("rebuilds a layer whose context died under it", () => {
    const rec = recorder();
    const bed = createRideBed(rec);
    const state = runAt(10);
    bed.update(state, 1 / 60);
    rec.generation++;
    bed.update(state, 1 / 60);
    expect(rec.layers.length).toBe(LAYER_COUNT * 2);
    expect(bed.live()).toBe(LAYER_COUNT);
  });

  it("follows the seat: the same frame is louder in the water from the bow than from the air", () => {
    const state = runAt(20);
    const at = (view: string) => {
      const rec = recorder();
      const bed = createRideBed(rec);
      bed.setView(view);
      bed.update(state, 1 / 60);
      const spray = rec.layers.find((l) => l.spec === WATER_LAYERS.spray)!;
      return spray.sets[0].target.level;
    };
    expect(at("bow")).toBeGreaterThan(at("heli"));
  });

  it("ducks the whole bed under a card", () => {
    const state = runAt(20);
    const rec = recorder();
    const bed = createRideBed(rec);
    bed.update(state, 1 / 60, 0.5);
    bed.update(state, 1 / 60, 1);
    const hum = rec.layers.find((l) => l.spec === ENGINE_LAYERS.hum)!;
    expect(hum.sets[0].target.level).toBeCloseTo(hum.sets[1].target.level * 0.5, 9);
  });

  it("raises a slap off the hull's own slam, once per gap, and never inside a landing", () => {
    const rec = recorder();
    const bed = createRideBed(rec);
    const state = runAt(15);
    const c = state.craft;
    const g = totalMass(c.spec) * TUNING.g;
    c.landing = 5;
    c.slam = 0;
    bed.update(state, 1 / 60);
    expect(rec.noises.length).toBe(0);
    c.slam = 2 * g;
    bed.update(state, 1 / 60);
    const voices = RUN_BANK.slap.voices.length;
    expect(rec.tones.length + rec.noises.length).toBe(voices);
    // The same slam on the next frame is the same slap, still sounding.
    rec.clock += 1 / 60;
    bed.update(state, 1 / 60);
    expect(rec.tones.length + rec.noises.length).toBe(voices);
    // Past the gap it may sound again — but not while a landing owns it.
    rec.clock += 0.5;
    c.landing = 0.1;
    bed.update(state, 1 / 60);
    expect(rec.tones.length + rec.noises.length).toBe(voices);
    c.landing = 5;
    bed.update(state, 1 / 60);
    expect(rec.tones.length + rec.noises.length).toBe(voices * 2);
    // A harder slam is a bigger slap.
    const soft = rec.tones[0];
    c.slam = 6 * g;
    rec.clock += 0.5;
    bed.update(state, 1 / 60);
    const hard = rec.tones[2];
    expect(hard.volume!).toBeGreaterThan(soft.volume!);
    expect(hard.from).toBeLessThan(soft.from);
  });

  it("hears the sea under the hull and the surf on the shore off the level itself", () => {
    const rec = recorder();
    const bed = createRideBed(rec);
    const state = runAt(0);
    for (let i = 0; i < 120; i++) bed.update(state, 1 / 60);
    const surf = rec.layers.find((l) => l.spec === WATER_LAYERS.surf)!;
    const chop = rec.layers.find((l) => l.spec === WATER_LAYERS.chop)!;
    const last = surf.sets[surf.sets.length - 1].target;
    // 400 m out on the strip is beyond the surf's reach; the wind is 8 m/s,
    // so the sea under the hull is not nothing — and a hull at rest slaps
    // only a little.
    expect(last.level).toBe(0);
    expect(chop.sets[chop.sets.length - 1].target.level).toBeGreaterThanOrEqual(0);
    const wind = rec.layers.find((l) => l.spec === WATER_LAYERS.wind)!;
    expect(wind.sets[wind.sets.length - 1].target.level).toBeGreaterThan(0);
  });
});

describe("the birds' voices (audio/bird-voice.ts)", () => {
  it("names a sound the bank has for every bird that speaks, and keeps two quiet", () => {
    for (const id of BIRD_IDS) {
      const call = BIRD_CALLS[id];
      if (!call) continue;
      expect(RUN_BANK[call.sound], `${id}'s ${call.sound}`).toBeDefined();
      if (call.flush) expect(RUN_BANK[call.flush], `${id}'s ${call.flush}`).toBeDefined();
      expect(call.reach).toBeGreaterThan(call.ref);
    }
    expect(BIRD_CALLS.cormorant).toBeNull();
    expect(BIRD_CALLS.eagle).toBeNull();
    // The sky is heard BETWEEN things: every bird under the water's
    // smallest splash.
    const quietest = Math.max(...RUN_BANK.reset.voices.map((v) => v.volume ?? 1));
    for (const id of BIRD_IDS) {
      const call = BIRD_CALLS[id];
      if (!call) continue;
      for (const voice of RUN_BANK[call.sound].voices)
        expect(voice.volume ?? 1, call.sound).toBeLessThanOrEqual(quietest);
    }
  });

  it("deals the same cries twice, about as many as the rate says, and never two in a slot", () => {
    const a: Cry[] = [];
    const b: Cry[] = [];
    // Twelve gulls at four a minute: forty-eight a minute, which the slot
    // cap and the Poisson curve pull down but not to nothing.
    const n = criesIn(1234, 12, 4, 0, 60, (cry) => a.push(cry));
    criesIn(1234, 12, 4, 0, 60, (cry) => b.push(cry));
    expect(b).toEqual(a);
    expect(n).toBe(a.length);
    expect(n).toBeGreaterThan(20);
    expect(n).toBeLessThan(60 / CRY_SLOT);
    for (let i = 1; i < a.length; i++)
      expect(a[i].at - a[i - 1].at).toBeGreaterThanOrEqual(CRY_SLOT);
    for (const cry of a) expect(cry.at).toBeGreaterThan(0);
    // A window is exclusive at its start: two windows that meet deal each
    // slot once.
    const split: Cry[] = [];
    criesIn(1234, 12, 4, 0, 20.1, (cry) => split.push(cry));
    criesIn(1234, 12, 4, 20.1, 60, (cry) => split.push(cry));
    expect(split).toEqual(a);
    expect(criesIn(1234, 12, 0, 0, 60, () => {})).toBe(0);
    expect(criesIn(1234, 0, 4, 0, 60, () => {})).toBe(0);
  });

  it("calls more on the wing than on the rock, and a roost goes nearly quiet at night", () => {
    const gull = BIRD_CALLS.gull!;
    expect(callRate(gull, 1, 1)).toBe(gull.airborne);
    expect(callRate(gull, 0, 1)).toBe(gull.perched);
    expect(callRate(gull, 0, 0)).toBeLessThan(gull.perched * 0.2);
    expect(callRate(gull, 0, 0)).toBeGreaterThan(0);
  });

  it("is heard at its level close to, falls on the inverse square, and is gone at its reach", () => {
    const gull = BIRD_CALLS.gull!;
    expect(heardAt(0, gull)).toBe(1);
    expect(heardAt(gull.ref, gull)).toBe(1);
    expect(heardAt(gull.ref * 2, gull)).toBeCloseTo(0.25, 6);
    expect(heardAt(gull.ref * 4, gull)).toBeLessThan(heardAt(gull.ref * 2, gull));
    expect(heardAt(gull.reach - 1, gull)).toBeGreaterThan(0);
    expect(heardAt(gull.reach, gull)).toBe(0);
    expect(heardAt(gull.reach * 3, gull)).toBe(0);
  });

  it("pans a cry to the side it comes from, through the input model's one screen flip", () => {
    expect(cryPan(Math.PI / 2, 0)).toBeCloseTo(SCREEN_TO_ENGINE, 9);
    expect(cryPan(0, 0)).toBeCloseTo(0, 9);
  });
});

describe("the bird bed (audio/bird-bed.ts)", () => {
  // The strip carries one flock: a few geese on the water. Where they are
  // is the plan's business; the bed lays the same plan off the same level.
  const raft = planBirds(STRIP).flocks[0];
  const goose = BIRD_CALLS[raft.species]!;

  const runAt = (x: number, z: number) => {
    const state = createGame({ seed: 1, craft: "skiff", level: STRIP, quiet: true });
    placeRun(state, { x, z, heading: 0, speed: 0 });
    return state;
  };

  /** Run the bed for `seconds` of engine time at thirty frames a second. */
  const ride = (
    bed: ReturnType<typeof createBirdBed>,
    state: ReturnType<typeof createGame>,
    seconds: number,
    duck = 1,
  ): void => {
    const step = 1 / 30;
    for (let i = 0; i < seconds * 30; i++) {
      (state as { t: number }).t += step;
      bed.update(state, step, duck);
    }
  };

  it("raises the flock's own cry within earshot, and nothing out of it", () => {
    expect(raft.home.kind).toBe("water");
    const rec = recorder();
    const bed = createBirdBed(rec);
    ride(bed, runAt(raft.home.x, raft.home.z + goose.reach * 0.3), 240);
    expect(rec.tones.length).toBeGreaterThan(0);
    const voices = RUN_BANK[goose.sound].voices;
    expect(rec.tones.length % voices.length).toBe(0);
    for (const tone of rec.tones) {
      expect(tone.type).toBe(voices[0].call === "tone" ? voices[0].type : undefined);
      expect(tone.at).toBeUndefined();
      expect(tone.pan).toBeDefined();
    }
    const far = recorder();
    ride(createBirdBed(far), runAt(raft.home.x, raft.home.z + goose.reach + 50), 240);
    expect(far.tones.length).toBe(0);
  });

  it("is silent while the context is locked, and only opens its window on the first frame", () => {
    const rec = recorder();
    const bed = createBirdBed(rec);
    const state = runAt(raft.home.x, raft.home.z + 40);
    rec.locked = true;
    ride(bed, state, 60);
    expect(rec.tones.length).toBe(0);
    rec.locked = false;
    // The window opens on the first live frame: the minute that passed is
    // not owed.
    bed.update(state, 1 / 30);
    expect(rec.tones.length).toBe(0);
  });

  it("puts a raft up with a burst of louder cries, once, and forgets it on reset", () => {
    const rec = recorder();
    const bed = createBirdBed(rec);
    const state = runAt(raft.home.x, raft.home.z);
    bed.update(state, 1 / 30);
    (state as { t: number }).t += 1 / 30;
    bed.update(state, 1 / 30);
    ride(bed, state, FLUSH_CRIES.spread + 0.5);
    // A flush's shouts are louder than any ordinary cry off the raft, which
    // varies a fifth either side of its authored level — counted on the
    // call's first voice, the loudest one.
    const shout = (RUN_BANK[goose.sound].voices[0].volume ?? 1) * ((FLUSH_CRIES.gain + 1.2) / 2);
    const shouts = () => rec.tones.filter((t) => t.volume! > shout).length;
    const perFlush = FLUSH_CRIES.count;
    expect(shouts()).toBe(perFlush);
    // Sitting in the raft: not put up again until the flush is over.
    ride(bed, state, 5);
    expect(shouts()).toBe(perFlush);
    // A reset forgets the flush: the same raft goes up again for the same hull.
    bed.reset();
    bed.update(state, 1 / 30);
    (state as { t: number }).t += 1 / 30;
    bed.update(state, 1 / 30);
    ride(bed, state, FLUSH_CRIES.spread + 0.5);
    expect(shouts()).toBe(perFlush * 2);
  });

  it("follows the seat and the duck: the same cries are quieter from the helicopter and under a card", () => {
    const heard = (view: string, duck: number) => {
      const rec = recorder();
      const bed = createBirdBed(rec);
      bed.setView(view);
      const state = runAt(raft.home.x, raft.home.z);
      bed.update(state, 1 / 30);
      (state as { t: number }).t += 1 / 30;
      bed.update(state, 1 / 30, duck);
      return rec.tones[0].volume!;
    };
    expect(heard("heli", 1)).toBeCloseTo(heard("chase", 1) * LISTENERS.heli.events, 9);
    expect(heard("chase", 0.5)).toBeCloseTo(heard("chase", 1) * 0.5, 9);
  });

  it("says its silence: the frame that resumes owes nothing for the pause", () => {
    const rec = recorder();
    const bed = createBirdBed(rec);
    const state = runAt(raft.home.x, raft.home.z + 40);
    ride(bed, state, 2);
    bed.silence();
    const n = rec.tones.length;
    (state as { t: number }).t += 300;
    bed.update(state, 1 / 30);
    expect(rec.tones.length).toBe(n);
  });
});

describe("what the game remembers of the sound (settings.ts)", () => {
  it("keeps a fader inside its travel, on its own ladder, and drops anything else", () => {
    expect(mergeSettings({ audio: { sfx: 0.5 } }).audio.sfx).toBe(0.5);
    expect(mergeSettings({ audio: { sfx: 0 } }).audio.sfx).toBe(0);
    expect(mergeSettings({ audio: { sfx: 0.53 } }).audio.sfx).toBeCloseTo(0.55, 9);
    expect(mergeSettings({ audio: { sfx: 1.5 } }).audio.sfx).toBe(0.8);
    expect(mergeSettings({ audio: { sfx: "loud" } }).audio.sfx).toBe(0.8);
    expect(mergeSettings({ audio: "off" }).audio.sfx).toBe(0.8);
    expect(1 / SFX_STEP).toBe(20);
  });
});
