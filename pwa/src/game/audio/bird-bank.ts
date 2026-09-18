// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT THE BIRDS SOUND LIKE — the cries of both coasts' rosters, as data,
// spread into `RUN_BANK` by `bank.ts` so everything downstream still reads
// one bank. Split out of it because two rosters of voices took that file
// past the §20.5 cap, and a bird's cry is the one kind of sound in the bank
// that is neither the craft's nor the water's.
//
// Which bird makes which of these, how often and how far off it is heard is
// `bird-voice.ts`'s table; this is only what each one IS. The same rules as
// the rest of the bank: every voice is the synth's own vocabulary
// (`lib/voice.ts`), a def without a description fails the test, and every
// bird is quieter than the water's smallest splash — the sky is heard
// BETWEEN things.

import type { SoundBank } from "./types.ts";

export const BIRD_BANK: SoundBank = {
  gull_cry: {
    description:
      "A herring gull's long call: a driven sawtooth 'kyow' gliding down " +
      "through a nasal band with the throat's wobble on it, and a shorter " +
      "second note a beat behind. The everyday bird, heard off the skerries " +
      "and over the shallows; sat on the echo bus so it comes off the rock.",
    voices: [
      {
        call: "tone",
        type: "sawtooth",
        from: 1480,
        to: 940,
        durationMs: 420,
        volume: 0.026,
        drive: 0.35,
        attackMs: 18,
        holdMs: 90,
        vibrato: { rateHz: 9, depthCents: 70, delayMs: 60 },
        filter: { type: "bandpass", frequency: 1900, to: 1300, q: 2.2 },
        echo: 0.18,
      },
      {
        call: "tone",
        type: "sawtooth",
        from: 1250,
        to: 980,
        durationMs: 200,
        volume: 0.02,
        drive: 0.35,
        attackMs: 14,
        delayMs: 470,
        filter: { type: "bandpass", frequency: 1700, q: 2.2 },
        echo: 0.14,
      },
    ],
  },

  tern_cry: {
    description:
      "An arctic tern's 'kee-arr': a hard high sawtooth that drops through " +
      "a narrow band, with a rasp of white noise on the tear — the harshest " +
      "voice on the coast, and the smallest. Over the shallows in spring and " +
      "summer, and never from a rock.",
    voices: [
      {
        call: "tone",
        type: "sawtooth",
        from: 2700,
        to: 1900,
        durationMs: 210,
        volume: 0.02,
        drive: 0.55,
        attackMs: 8,
        holdMs: 40,
        filter: { type: "bandpass", frequency: 3200, to: 2300, q: 3 },
        echo: 0.08,
      },
      {
        call: "noise",
        durationMs: 150,
        volume: 0.01,
        attackMs: 6,
        delayMs: 40,
        filter: { type: "bandpass", frequency: 3400, to: 2600, q: 2.5 },
      },
    ],
  },

  swift_scream: {
    description:
      "A swift's scream: a thin, high, driven sawtooth held nearly level " +
      "and then dropping a little at the end, with a rasp of noise on it " +
      "— the shrillest, quickest voice in the bank, and a party of them " +
      "round a cliff on a summer evening is the karst coast's own sound.",
    voices: [
      {
        call: "tone",
        type: "sawtooth",
        from: 3600,
        to: 3100,
        durationMs: 260,
        volume: 0.014,
        drive: 0.5,
        attackMs: 10,
        holdMs: 120,
        vibrato: { rateHz: 14, depthCents: 40, delayMs: 30 },
        filter: { type: "bandpass", frequency: 4000, to: 3300, q: 3 },
        echo: 0.1,
      },
      {
        call: "noise",
        durationMs: 180,
        volume: 0.006,
        attackMs: 8,
        delayMs: 30,
        filter: { type: "bandpass", frequency: 4200, to: 3400, q: 2.5 },
      },
    ],
  },

  crow_caw: {
    description:
      "A hooded crow's 'kraa': a hoarse, low, driven sawtooth through a " +
      "nasal band with a burst of noise on the front of it for the rasp, " +
      "twice — the one voice on any coast that is not a sea bird's, off " +
      "the tideline and the rocks; on the echo bus so it comes off the " +
      "cliff.",
    voices: [
      {
        call: "tone",
        type: "sawtooth",
        from: 720,
        to: 560,
        durationMs: 300,
        volume: 0.022,
        drive: 0.6,
        attackMs: 12,
        holdMs: 120,
        vibrato: { rateHz: 24, depthCents: 60, delayMs: 0 },
        filter: { type: "bandpass", frequency: 1300, to: 1000, q: 1.8 },
        echo: 0.16,
      },
      {
        call: "noise",
        durationMs: 120,
        volume: 0.008,
        attackMs: 6,
        filter: { type: "bandpass", frequency: 1600, q: 1.6 },
      },
      {
        call: "tone",
        type: "sawtooth",
        from: 700,
        to: 540,
        durationMs: 280,
        volume: 0.02,
        drive: 0.6,
        attackMs: 12,
        holdMs: 100,
        delayMs: 420,
        vibrato: { rateHz: 24, depthCents: 60, delayMs: 0 },
        filter: { type: "bandpass", frequency: 1250, to: 950, q: 1.8 },
        echo: 0.14,
      },
    ],
  },

  eider_coo: {
    description:
      "A drake eider's 'ah-OOO' off a raft: a soft low sine swelling and " +
      "falling with a quieter partial over it for the throat, through a dark " +
      "lowpass. The quietest voice in the bank on purpose — a raft is heard " +
      "only with the engine at idle beside it.",
    voices: [
      {
        call: "tone",
        type: "sine",
        from: 540,
        to: 390,
        durationMs: 560,
        volume: 0.018,
        attackMs: 70,
        holdMs: 130,
        filter: { type: "lowpass", frequency: 1200 },
      },
      {
        call: "tone",
        type: "triangle",
        from: 800,
        to: 580,
        durationMs: 480,
        volume: 0.008,
        attackMs: 60,
        delayMs: 40,
        filter: { type: "lowpass", frequency: 1500 },
      },
    ],
  },

  eider_whirr: {
    description:
      "A raft getting up off the water: the whirr of a dozen pairs of " +
      "wings — pink bursts at a wingbeat's cadence through a mid band, each " +
      "softer than the last as the birds clear the surface — over a wash of " +
      "the water they threw. The one bird sound the craft causes.",
    voices: [
      {
        call: "noise",
        durationMs: 150,
        volume: 0.03,
        color: "pink",
        attackMs: 14,
        filter: { type: "bandpass", frequency: 640, q: 1.4 },
      },
      {
        call: "noise",
        durationMs: 150,
        volume: 0.027,
        color: "pink",
        attackMs: 14,
        delayMs: 135,
        filter: { type: "bandpass", frequency: 700, q: 1.4 },
      },
      {
        call: "noise",
        durationMs: 150,
        volume: 0.023,
        color: "pink",
        attackMs: 14,
        delayMs: 270,
        filter: { type: "bandpass", frequency: 760, q: 1.4 },
      },
      {
        call: "noise",
        durationMs: 150,
        volume: 0.018,
        color: "pink",
        attackMs: 14,
        delayMs: 405,
        filter: { type: "bandpass", frequency: 820, q: 1.4 },
      },
      {
        call: "noise",
        durationMs: 150,
        volume: 0.013,
        color: "pink",
        attackMs: 14,
        delayMs: 540,
        filter: { type: "bandpass", frequency: 880, q: 1.4 },
      },
      {
        call: "noise",
        durationMs: 700,
        volume: 0.02,
        color: "pink",
        attackMs: 30,
        holdMs: 80,
        filter: { type: "lowpass", frequency: 1100, to: 500 },
      },
    ],
  },

  goose_honk: {
    description:
      "A greylag's 'ahng-ahng': two driven squares through a nasal band, " +
      "the second a shade lower and a beat behind, both dark under a " +
      "lowpass. Heard off a skein going over, faint and high, and off the " +
      "water in summer.",
    voices: [
      {
        call: "tone",
        type: "square",
        from: 470,
        to: 420,
        durationMs: 170,
        volume: 0.026,
        drive: 0.6,
        attackMs: 12,
        holdMs: 60,
        filter: { type: "bandpass", frequency: 950, q: 1.6 },
        echo: 0.12,
      },
      {
        call: "tone",
        type: "square",
        from: 440,
        to: 390,
        durationMs: 190,
        volume: 0.022,
        drive: 0.6,
        attackMs: 12,
        holdMs: 60,
        delayMs: 200,
        filter: { type: "bandpass", frequency: 900, q: 1.6 },
        echo: 0.12,
      },
    ],
  },

  swan_whoop: {
    description:
      "A whooper swan's bugle: a triangle RISING through a fifth with a " +
      "little drive, a second note answering a shade lower, both long and " +
      "on the echo bus — the one call that carries across a whole bay, and " +
      "the reason a skein of swans is heard before it is seen.",
    voices: [
      {
        call: "tone",
        type: "triangle",
        from: 620,
        to: 900,
        durationMs: 400,
        volume: 0.017,
        drive: 0.3,
        attackMs: 30,
        holdMs: 120,
        vibrato: { rateHz: 6, depthCents: 25, delayMs: 120 },
        filter: { type: "lowpass", frequency: 2400 },
        echo: 0.22,
      },
      {
        call: "tone",
        type: "triangle",
        from: 860,
        to: 780,
        durationMs: 360,
        volume: 0.014,
        drive: 0.3,
        attackMs: 30,
        holdMs: 100,
        delayMs: 330,
        filter: { type: "lowpass", frequency: 2400 },
        echo: 0.22,
      },
    ],
  },

  osprey_whistle: {
    description:
      "An osprey's whistle over the flats: a clear high sine sliding down " +
      "a fourth and repeated a beat later, thin and carrying — the one " +
      "raptor in the roster that says anything, and it says it from a " +
      "height.",
    voices: [
      {
        call: "tone",
        type: "sine",
        from: 2600,
        to: 1900,
        durationMs: 260,
        volume: 0.018,
        attackMs: 20,
        holdMs: 80,
        vibrato: { rateHz: 7, depthCents: 40, delayMs: 80 },
        filter: { type: "bandpass", frequency: 2600, to: 2000, q: 2.5 },
        echo: 0.12,
      },
      {
        call: "tone",
        type: "sine",
        from: 2500,
        to: 1800,
        durationMs: 240,
        volume: 0.014,
        attackMs: 20,
        delayMs: 380,
        filter: { type: "bandpass", frequency: 2500, to: 1900, q: 2.5 },
        echo: 0.12,
      },
    ],
  },

  egret_croak: {
    description:
      "A great egret getting up off the mud: one low, harsh, driven " +
      "sawtooth croak through a nasal band with a rasp of noise on it — " +
      "a frog's voice in a bird a metre long, and heard only when the " +
      "craft has put it up.",
    voices: [
      {
        call: "tone",
        type: "sawtooth",
        from: 520,
        to: 380,
        durationMs: 300,
        volume: 0.02,
        drive: 0.5,
        attackMs: 15,
        holdMs: 120,
        vibrato: { rateHz: 18, depthCents: 90, delayMs: 20 },
        filter: { type: "bandpass", frequency: 900, to: 650, q: 1.8 },
        echo: 0.1,
      },
      {
        call: "noise",
        durationMs: 200,
        volume: 0.007,
        attackMs: 10,
        delayMs: 30,
        filter: { type: "bandpass", frequency: 1400, to: 900, q: 1.6 },
      },
    ],
  },

  ibis_grunt: {
    description:
      "A white ibis along its line: a soft nasal 'hunk', a low triangle " +
      "through a narrow band with a quieter partial over it, repeated " +
      "twice — the murmur a flock keeps up to hold together, and never " +
      "loud.",
    voices: [
      {
        call: "tone",
        type: "triangle",
        from: 440,
        to: 380,
        durationMs: 170,
        volume: 0.014,
        drive: 0.2,
        attackMs: 15,
        holdMs: 60,
        filter: { type: "bandpass", frequency: 800, to: 700, q: 2 },
        echo: 0.08,
      },
      {
        call: "tone",
        type: "triangle",
        from: 430,
        to: 370,
        durationMs: 160,
        volume: 0.011,
        drive: 0.2,
        attackMs: 15,
        delayMs: 260,
        filter: { type: "bandpass", frequency: 800, to: 700, q: 2 },
        echo: 0.08,
      },
    ],
  },

  crane_bugle: {
    description:
      "A common crane's rolling 'krroo': a driven sawtooth with a fast deep " +
      "vibrato — the trumpet's rattle — through a band a coiled windpipe " +
      "resonates in, over a low sine for the body of it. The furthest-" +
      "carrying voice in the roster, and the rarest.",
    voices: [
      {
        call: "tone",
        type: "sawtooth",
        from: 820,
        to: 700,
        durationMs: 520,
        volume: 0.022,
        drive: 0.4,
        attackMs: 25,
        holdMs: 160,
        vibrato: { rateHz: 21, depthCents: 170, delayMs: 30 },
        filter: { type: "bandpass", frequency: 1300, to: 1100, q: 1.5 },
        echo: 0.24,
      },
      {
        call: "tone",
        type: "sine",
        from: 410,
        to: 350,
        durationMs: 480,
        volume: 0.011,
        attackMs: 30,
        holdMs: 140,
        echo: 0.18,
      },
    ],
  },
};
