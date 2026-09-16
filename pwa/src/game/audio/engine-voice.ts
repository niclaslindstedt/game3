// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A RUNNING JET SKI, AS NINE LAYERS THAT NEVER STOP.
//
// The engine is not made of events. It is a handful of oscillators and three
// noise sources built once for the run and STEERED — pitch, level, cutoff and
// saturation moved every frame on the audio thread (`Synth.layer`). Nothing
// here is scheduled, tiled or phase-aligned; a frame that arrives late leaves
// the engine holding its last note rather than leaving a hole in it.
//
// WHAT A PERSONAL WATERCRAFT IS MADE OF, in the order the ear finds them:
//
//   MOTOR    the BLOCK, heard through the hull — the machine's own hum,
//            under everything, at idle and at the limiter alike
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
//   WHINE    the PUMP — the impeller's blades passing, a thin driven tone
//            that climbs with the shaft and is the sound everyone on the
//            beach knows a jet ski by
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
// hears it: the note climbs, the froth goes (no water to chop), the whine
// thins to a dry whistle.
//
// THE EXHAUST EXITS UNDER THE WATERLINE, and that is the loudest fact about
// what a jet ski sounds like. A runabout's pipe comes out below the boot, so
// for nearly the whole of a run the engine is being heard THROUGH WATER —
// which is a lowpass and an attenuator both, and why a machine that is
// deafening on a trailer is a burble from a beach. What the ear gets while
// the hull is down is the wet blat of a pipe under the surface with the
// firing note dark behind it; the sharp edge of the exhaust is simply not in
// the air to be heard.
//
// The moment the transom comes clear — over a wave, off a ramp, on a hull
// running its stern dry at full plane — the pipe is in AIR, and everything
// the water was holding back arrives at once: the note brightens, the rasp
// comes up, the blat stops. That is the crack every one of those machines
// makes off a wake, and it is one reading, `clear`, doing all of it.
//
// So the engine is not mixed as one loudness with the air as an exception.
// It is mixed as TWO VOICES either side of the waterline, and `clear` is the
// crossfade: the run's ordinary state is the quiet one, and coming out of
// the water is what makes the engine an event.

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
 * WHAT THE PUMP WHINES AT, per revolution of the shaft — the BLADE PASSING
 * frequency, and nothing else.
 *
 * An axial-flow waterjet is three impeller blades on a shaft driven straight
 * off the crank, and what a pump radiates is a pressure pulse every time a
 * blade goes by: three a revolution, so the tone is `rpm / 60 × 3` — 75 Hz at
 * idle, 400 Hz at the limiter. The stator's vane count decides which
 * circumferential MODES of that tone get out of the tunnel, not what
 * frequency it is; multiplying the two together (eighteen a revolution, a
 * 2.4 kHz sine at the limiter) named a frequency the pump has never made, and
 * a sine up there over a bed of spray is not a jet ski, it is a hair dryer.
 *
 * The brightness a real pump is known for is the blade tone's own HARMONIC
 * STACK, so the layer is a driven sawtooth with a band parked `WHINE_HARMONIC`
 * up its series: the pitch the ear tracks across a bay is the low one, and the
 * glitter that carries it over the water comes off the harmonics.
 */
export const WHINE_PER_REV = 3;

/** Which harmonic of the blade tone the whine's band sits on. High enough
 * that the layer reads as a whistle rather than as a second hum, low enough
 * that it stays under the spray instead of on top of it. */
const WHINE_HARMONIC = 4;

/** The firing note these revs make, Hz. */
export function noteHz(rpm: number): number {
  return (rpm / 60) * FIRINGS_PER_REV;
}

/** The pump's blade-passing tone at these revs, Hz. */
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

/** A quarter of the bottom wet is a pump with water to draw on — past that
 * the intake is fed and more water buys nothing. */
export const INTAKE_WETTED = 0.25;

/** How sharply the exhaust comes out of the water as the bottom dries, as a
 * power on the dry share. The pipe sits LOW and aft, so it is the last thing
 * to clear: a hull with a third of its bottom out of the water has not lifted
 * its pipe out of anything. Cubed is what keeps the ordinary riding band —
 * where the measured dry share runs from about 0.05 at rest to 0.6 at full
 * plane — down at the quiet end, while leaving the whole of the reading for
 * the hull that is actually out. */
const CLEAR_POWER = 3;

/** How much of the engine's own voice reaches the air with the pipe fully
 * UNDER it, 0..1 — what is left after the water has had it. Not zero, and not
 * small: a hull is a drum, and the block is bolted to it, so the note comes
 * through the structure whatever the pipe is doing. What the water mostly
 * takes is the TOP of that note, and the cutoff crossfade below is already
 * where that is said — holding the level down here as well was the engine
 * losing its body underwater while the spray and the intake kept every bit of
 * theirs, which is the whole mix reading as hiss. */
const SUBMERGED = 0.6;

/**
 * HOW FAR THE EXHAUST HAS COME OUT OF THE WATER, 0..1 — 0 with the pipe
 * under, 1 with the whole hull in the air. The one reading the engine's two
 * voices are crossfaded on.
 *
 * Read off the share of the bottom that is DRY, which is the same number the
 * hull's own probes wrote. Capsized is 0 rather than 1: a hull on its back
 * has its bottom in the air and its pipe, its block and its airbox all under
 * the surface, so the raw share says exactly the wrong thing.
 */
export function exhaustClear(wetted: number, airborne: boolean, capsized: boolean): number {
  if (capsized) return 0;
  if (airborne) return 1;
  return Math.pow(Math.min(1, Math.max(0, 1 - wetted)), CLEAR_POWER);
}

/** How much of the engine's voice is in the AIR to be heard, 0..1 — the
 * crossfade `clear` drives, floored at what comes through the hull. */
function openness(clear: number): number {
  return SUBMERGED + (1 - SUBMERGED) * clear;
}

/** How low the BASS may go, Hz. Below about here a phone gives you nothing
 * and a desktop gives you cabinet noise, so the layer holding the whole sound
 * up would stop existing exactly where it is doing the most work — at idle. */
const BASS_FLOOR_HZ = 44;

/**
 * THE BAND THE BLOCK HUMS IN, Hz — where the motor layer's lowpass sits at
 * idle, and how far it opens by the limiter.
 *
 * The motor is a SQUARE at the firing note, and that is the whole trick: a
 * square's odd harmonics land at 3, 5 and 7 times the note, so an idle whose
 * fundamental is a 38 Hz chug nothing can reproduce still puts energy at 112,
 * 187 and 262 Hz — where a phone, a laptop and a pair of earbuds all live.
 * The lowpass then keeps it a HUM: past a few hundred Hertz a square stops
 * being the machine in the background and starts being a buzz in the front.
 */
const MOTOR_BAND_HZ = 190;
const MOTOR_BAND_OPENS_HZ = 170;

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
  /** How far the EXHAUST has come out of the water, 0..1 — `exhaustClear`.
   * 0 is the pipe under the surface, which is nearly the whole of a run and
   * is the quiet, dark, burbling voice; 1 is the hull in the air, which is
   * the sharp one. Everything either side of the waterline hangs off it. */
  clear: number;
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
  "motor" | "hum" | "octave" | "rasp" | "bass" | "intake" | "whine" | "froth" | "gurgle";

/** What each layer is BUILT from — decided once. */
export const ENGINE_LAYERS: Record<EngineLayer, LayerSpec> = {
  motor: {
    kind: "tone",
    type: "square",
    detuneCents: 7,
    drive: 1,
    filter: { type: "lowpass", q: 0.8 },
  },
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
  whine: {
    kind: "tone",
    type: "sawtooth",
    detuneCents: 4,
    drive: 1,
    filter: { type: "bandpass", q: 3.5 },
  },
  froth: { kind: "noise", color: "white", filter: { type: "highpass", q: 0.7 } },
  gurgle: { kind: "noise", color: "brown", filter: { type: "lowpass", q: 1 } },
};

/** How fast each layer follows, s — the time constant its parameters move
 * on. Pitch layers move quickly (a rev that lags the needle reads as a slow
 * engine); the froth and the gurgle take a moment, the way water does. */
export const ENGINE_GLIDE: Record<EngineLayer, number> = {
  motor: 0.05,
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
 * the bank: the motor and the hum at full load are an ordinary slap's size
 * between them, the bass under them a little less, and everything else is
 * texture — the whine most of all, because a thin tone with a band up its
 * harmonics is heard at a fraction of the level a rumble needs.
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
  // EITHER SIDE OF THE WATERLINE. `open` is how much of the engine is in the
  // air to be heard at all; `under` is its complement, which is what the wet
  // pipe is blatting into. Every level below is one or the other.
  const clear = Math.min(1, Math.max(0, voice.clear));
  const open = openness(clear);
  const under = 1 - clear;
  return {
    // THE MACHINE IN THE BACKGROUND, and the one layer the waterline does not
    // touch. Everything else here is the engine heard through its PIPE, which
    // is under the surface for nearly the whole of a run; this is the block
    // itself, bolted to a fibreglass box that radiates whatever it is given —
    // so it is as present at idle on a still bay as it is at the limiter in
    // the air, and it is what a jet ski sounds like when it is not doing
    // anything in particular. A square, for its odd harmonics: see
    // `MOTOR_BAND_HZ` — it is the only reason an idle is audible at all on a
    // speaker that gives you nothing under 100 Hz.
    motor: {
      level: (0.016 + 0.012 * load + 0.005 * rev) * mix.engine,
      hz,
      cutoff: (MOTOR_BAND_HZ + MOTOR_BAND_OPENS_HZ * rev) * (0.7 + 0.3 * mix.tone),
      grit: 0.2 + 0.4 * load,
    },
    // The body of the note, brighter with the revs and darker from a seat
    // with the block in the way, pushed harder into the curve the more work
    // it is doing — which is why the craft sounds like it is WORKING into a
    // head sea and free off a lip at the same revs.
    hum: {
      level: (0.018 + 0.03 * load + 0.008 * throttle) * open * mix.engine,
      hz,
      // Water is a lowpass as well as an attenuator, so a pipe under the
      // surface is not merely a quieter engine, it is a DARKER one — which
      // is most of why the same note reads as a burble from a beach and as
      // a crack off a wake.
      cutoff: (600 + 2800 * rev) * (0.45 + 0.55 * clear) * (0.45 + 0.55 * mix.tone),
      grit: 0.25 + 0.5 * load + 0.15 * throttle,
    },
    // Carries the note at the bottom of the band and gets out of the way as
    // the fundamental comes into its own — the same way a real engine stops
    // sounding boomy and starts sounding sharp.
    octave: {
      level: (0.015 - 0.011 * rev) * open * mix.engine,
      hz: hz * 2,
      grit: 0.3 + 0.2 * load,
    },
    // THE EDGE OF THE EXHAUST, and the layer the waterline owns outright: a
    // pipe under the surface has no edge in the air at all, so this is
    // scaled harder by `clear` than anything else here. It is what makes a
    // craft coming off a wave CRACK where the same revs afloat only burble.
    rasp: {
      level: rasp * (0.005 + 0.02 * throttle) * (0.15 + 0.85 * clear) * mix.exhaust,
      hz,
      cutoff: 900 + 2400 * rev,
      grit: 0.6 + 0.3 * throttle,
    },
    // FLOORED, AND THAT IS THE POINT. Half of a 38 Hz idle is 19 Hz, which
    // is not a note, it is a speaker excursion — nothing reproduces it and
    // the hum is left standing on nothing.
    bass: {
      level: (0.02 + 0.016 * load) * (0.75 + 0.25 * clear) * mix.engine,
      hz: Math.max(BASS_FLOOR_HZ, hz * 0.5),
    },
    // The airbox: a pink roar that opens with the throttle and climbs a
    // little with the crank. Brighter from a seat that can see it.
    intake: {
      level: (0.003 + 0.01 * throttle) * (0.6 + 0.4 * mix.tone) * mix.engine,
      cutoff: 260 + 480 * rev,
    },
    // The blade tone, with its band up its own harmonic series: the pitch the
    // ear follows is the low one the pump actually makes, and the glitter is
    // the harmonics the band lets through. Loud with water to push, a dry
    // whistle without.
    whine: {
      level: (0.002 + 0.007 * throttle * wet) * mix.pump,
      hz: whine,
      cutoff: whine * WHINE_HARMONIC,
      grit: 0.2 + 0.3 * throttle,
    },
    // Cavitation: nothing at pace, everything on the throttle from rest.
    froth: {
      level: 0.016 * froth * mix.pump,
      cutoff: 1800 + 2500 * throttle,
    },
    // THE BLAT AT THE PIPE — and while the hull is down this is the engine,
    // not a garnish on it. A pipe exhausting under water does not stop
    // blatting because the revs came up: it goes from a slow idle knock to a
    // hard wet tearing, which is the sound of a runabout heard from a beach.
    // What silences it is the pipe LEAVING the water, so it is `under` that
    // owns the level and the revs only shape it — the opposite of every
    // layer above, and the reason the engine has something to be while the
    // water is holding its note down.
    gurgle: {
      level: 0.016 * under * wet * (0.4 + 0.6 * (1 - rev) * (1 - rev)) * mix.exhaust,
      cutoff: 180 + 220 * rev,
    },
  };
}
