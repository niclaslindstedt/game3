// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A RUNNING JET SKI, AS EIGHT LAYERS THAT NEVER STOP.
//
// The engine is not made of events. It is a handful of oscillators and three
// noise sources built once for the run and STEERED — pitch, level, cutoff and
// saturation moved every frame on the audio thread (`Synth.layer`). Nothing
// here is scheduled, tiled or phase-aligned; a frame that arrives late leaves
// the engine holding its last note rather than leaving a hole in it.
//
// WHAT A PERSONAL WATERCRAFT IS MADE OF, in the order the ear finds them:
//
//   HUM      the firing note — the one layer whose pitch says the revs, a
//            detuned triangle pair folded through the saturation curve,
//            harder the more work the engine is doing
//   OCTAVE   the same note an octave up, carrying it at idle where 38 Hz is
//            a thing a phone cannot reproduce, fading as the crank climbs
//   RASP     the exhaust's edge — a thin driven sawtooth in a band that
//            climbs with the revs; the layer that is heard from BEHIND
//   BASS     a sine an octave under the note: the mass of the machine
//   INTAKE   the airbox under the seat — pink noise in a mid band that opens
//            with the throttle; what a rider hears of their own engine
//   WHINE    the PUMP — the impeller's blades passing the stator's vanes, a
//            sine far above the note that climbs with the shaft and is the
//            sound everyone on the beach knows a jet ski by
//   FROTH    cavitation — the pump chopping air and vapour when it is asked
//            for more than the water will give: a bright hiss at the
//            transom on a launch from rest, gone once the hull is running
//   GURGLE   the wet exhaust — the blat of a pipe that exits under the
//            waterline, a brown bubbling at idle that the revs blow clear
//
// This is a pure function of the state: `engineTargets` says where every
// layer should be, and the scheduler (`ride-bed.ts`) steers the real ones
// there. Being a pure function is what makes it testable and what lets the
// audition page drive it from sliders.
//
// AND THE AIR IS PART OF THE ENGINE'S VOICE. Off a wave the pump unloads
// and the crank runs free to the limiter — the physics does that, this only
// hears it: the note climbs, the froth and the gurgle go (no water to chop,
// no water over the pipe), the whine thins to a dry whistle. The silence
// where the water was is what a jump sounds like.

import type { LayerSpec, LayerTarget } from "../../lib/voice.ts";

/**
 * FIRINGS PER REVOLUTION — how the crank becomes a pitch.
 *
 * Every craft in the catalog is a THREE-cylinder four-stroke, the modern
 * marine engine — three fires every two revolutions. So the note it makes is
 * `rpm / 60 × 1.5`, which is this constant and nothing chosen by ear: idle
 * (1500 rpm) is a 38 Hz chug felt more than heard, and the limiter (8000)
 * is 200 Hz of a small engine being asked for everything. A twin would be a
 * lower number here and a rougher idle.
 */
export const FIRINGS_PER_REV = 1.5;

/**
 * WHAT THE PUMP WHINES AT, per revolution of the shaft.
 *
 * An axial-flow waterjet is three impeller blades turning past a ring of six
 * stator vanes, and every blade-vane crossing is a pressure pulse: eighteen a
 * revolution, so the tone is `rpm / 60 × 18` — 450 Hz at idle, 2.4 kHz at the
 * limiter. That is the whine, and it is why a jet ski is heard as a pitch
 * rising across a bay when a boat of the same power is heard as a drone.
 */
export const WHINE_PER_REV = 18;

/** The firing note these revs make, Hz. */
export function noteHz(rpm: number): number {
  return (rpm / 60) * FIRINGS_PER_REV;
}

/** The pump's blade-vane tone at these revs, Hz. */
export function whineHz(rpm: number): number {
  return (rpm / 60) * WHINE_PER_REV;
}

/** How far up the band the crank is, 0..1 (a shade over 1 on the limiter),
 * measured against the craft's OWN idle and redline — the timbre follows
 * how far up the band the engine is, not how fast the hull is going. */
export function revOf(rpm: number, idleRpm: number, maxRpm: number): number {
  return Math.min(1.06, Math.max(0, (rpm - idleRpm) / Math.max(1, maxRpm - idleRpm)));
}

/** Revs from a share of the band — the audition page's slider, inverted. */
export function rpmAt(rev: number, idleRpm: number, maxRpm: number): number {
  return idleRpm + Math.min(1.06, Math.max(0, rev)) * (maxRpm - idleRpm);
}

/** How low the BASS may go, Hz. Below about here a phone gives you nothing
 * and a desktop gives you cabinet noise, so the layer holding the whole sound
 * up would stop existing exactly where it is doing the most work — at idle. */
const BASS_FLOOR_HZ = 44;

/** Above this share of the band the rasp starts to be heard at all: a craft
 * nosing out of a bay never reaches it. */
const RASP_FROM = 0.3;

/** How much of the jet's speed the hull has to be short of before the pump
 * starts to cavitate, and the share of the band the froth covers. A hull at
 * pace is always a third slower than its own jet — that is where the thrust
 * comes from — so the froth begins past that and is fullest at a standstill
 * with the throttle open. */
const SLIP_FROM = 0.35;

/** One engine at one instant — everything the layers need, and nothing
 * about which craft it belongs to. */
export type EngineVoice = {
  /** What the crank is turning at. */
  rpm: number;
  /** How far up the band the crank is, 0..1 — the rasp's edge and the
   * hum's brightness. */
  rev: number;
  /** The throttle as the engine sees it, 0..1 — the intake's roar and the
   * pump's whine. */
  throttle: number;
  /** How hard the engine is actually WORKING, 0..1: the throttle with water
   * under the pump to push against. Zero in the air however wide the
   * throttle is, which is what makes a free-revving jump sound thin rather
   * than loud. */
  load: number;
  /** How much the intake is fed, 0..1 — 0 in the air and capsized. */
  wet: number;
  /** How far the jet is outrunning the hull, 0..1 of the jet's own speed:
   * 1 at a standstill, a third at pace. The cavitation's signal. */
  slip: number;
};

/** What the seat does to the engine — four of the listener's numbers. */
export type EngineMix = {
  engine: number;
  exhaust: number;
  pump: number;
  /** 0..1, how bright: the hum's cutoff is scaled by it. */
  tone: number;
};

export type EngineLayer =
  "hum" | "octave" | "rasp" | "bass" | "intake" | "whine" | "froth" | "gurgle";

/** What each layer is BUILT from — decided once. */
export const ENGINE_LAYERS: Record<EngineLayer, LayerSpec> = {
  hum: {
    kind: "tone",
    type: "triangle",
    detuneCents: 12,
    drive: 1,
    filter: { type: "lowpass", q: 0.9 },
  },
  octave: { kind: "tone", type: "triangle", detuneCents: 8, drive: 1 },
  rasp: {
    kind: "tone",
    type: "sawtooth",
    detuneCents: 18,
    drive: 1,
    filter: { type: "bandpass", q: 1.1 },
  },
  bass: { kind: "tone", type: "sine", detuneCents: 5 },
  intake: { kind: "noise", color: "pink", filter: { type: "bandpass", q: 0.9 } },
  whine: { kind: "tone", type: "sine", filter: { type: "bandpass", q: 3 } },
  froth: { kind: "noise", color: "white", filter: { type: "highpass", q: 0.7 } },
  gurgle: { kind: "noise", color: "brown", filter: { type: "lowpass", q: 1 } },
};

/** How fast each layer follows, s — the time constant its parameters move
 * on. Pitch layers move quickly (a rev that lags the needle reads as a slow
 * engine); the froth and the gurgle take a moment, the way water does. */
export const ENGINE_GLIDE: Record<EngineLayer, number> = {
  hum: 0.03,
  octave: 0.03,
  rasp: 0.04,
  bass: 0.03,
  intake: 0.08,
  whine: 0.05,
  froth: 0.07,
  gurgle: 0.12,
};

/**
 * Where every layer of the engine should be for `voice`, heard from `mix`.
 *
 * The levels are the whole sound's, and they are mixed against the rest of
 * the bank: the hum at full load is an ordinary slap's size, the bass under
 * it a little less, and everything else is texture — the whine most of all,
 * because a sine at two kilohertz is heard at a tenth of the level a rumble
 * needs.
 */
export function engineTargets(
  voice: EngineVoice,
  mix: EngineMix,
): Record<EngineLayer, LayerTarget> {
  const rev = Math.min(1, Math.max(0, voice.rev));
  const throttle = Math.min(1, Math.max(0, voice.throttle));
  const load = Math.min(1, Math.max(0, voice.load));
  const wet = Math.min(1, Math.max(0, voice.wet));
  const hz = noteHz(voice.rpm);
  const rasp = Math.max(0, (rev - RASP_FROM) / (1 - RASP_FROM));
  const froth = Math.max(0, (voice.slip - SLIP_FROM) / (1 - SLIP_FROM)) * throttle * wet;
  const whine = whineHz(voice.rpm);
  return {
    // The body of the note, brighter with the revs and darker from a seat
    // with the block in the way, pushed harder into the curve the more work
    // it is doing — which is why the craft sounds like it is WORKING into a
    // head sea and free off a lip at the same revs.
    hum: {
      level: (0.018 + 0.03 * load + 0.008 * throttle) * mix.engine,
      hz,
      cutoff: (600 + 2800 * rev) * (0.45 + 0.55 * mix.tone),
      grit: 0.25 + 0.5 * load + 0.15 * throttle,
    },
    // Carries the note at the bottom of the band and gets out of the way as
    // the fundamental comes into its own — the same way a real engine stops
    // sounding boomy and starts sounding sharp.
    octave: {
      level: (0.015 - 0.011 * rev) * mix.engine,
      hz: hz * 2,
      grit: 0.3 + 0.2 * load,
    },
    rasp: {
      level: rasp * (0.005 + 0.02 * throttle) * mix.exhaust,
      hz,
      cutoff: 900 + 2400 * rev,
      grit: 0.6 + 0.3 * throttle,
    },
    // FLOORED, AND THAT IS THE POINT. Half of a 38 Hz idle is 19 Hz, which
    // is not a note, it is a speaker excursion — nothing reproduces it and
    // the hum is left standing on nothing.
    bass: {
      level: (0.02 + 0.016 * load) * mix.engine,
      hz: Math.max(BASS_FLOOR_HZ, hz * 0.5),
    },
    // The airbox: a pink roar that opens with the throttle and climbs a
    // little with the crank. Brighter from a seat that can see it.
    intake: {
      level: (0.003 + 0.014 * throttle) * (0.6 + 0.4 * mix.tone) * mix.engine,
      cutoff: 350 + 700 * rev,
    },
    // The blade-vane tone, in a band sat on its own pitch so nothing but the
    // fundamental gets out. Loud with water to push, a dry whistle without.
    whine: {
      level: (0.0025 + 0.008 * throttle * wet) * mix.pump,
      hz: whine,
      cutoff: whine,
    },
    // Cavitation: nothing at pace, everything on the throttle from rest.
    froth: {
      level: 0.016 * froth * mix.pump,
      cutoff: 1800 + 2500 * throttle,
    },
    // The blat at the pipe: loudest at idle with the stern sat in the water,
    // blown clear as the revs come up, gone in the air.
    gurgle: {
      level: 0.014 * (1 - rev) * (1 - rev) * wet * mix.exhaust,
      cutoff: 180 + 220 * rev,
    },
  };
}
