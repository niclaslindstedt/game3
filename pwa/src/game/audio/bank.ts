// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RUN'S SOUND DESIGN — every discrete sound the craft, the water and the
// course make, as data: a description and a list of voices.
//
// WATER HAS NO TRANSIENT. That is the rule every splash here is written to,
// and the thing that separates a splash from a hit: a sheet of water is a
// pink swell that opens through a bandpass and thins out, with the mass of
// it as a brown thump under it, and the only clicks in this bank belong to
// the things that are not water — a hull on a rock, the deck's own boom on
// a hard landing, a buoy's chime. Every splash then gets its tail from
// `bubbles.ts`, which the router sizes and the front door raises.
//
// Every voice is the synth's own vocabulary (`lib/voice.ts`); the id is what
// `route.ts` names, and the description is what the next retune is checked
// against — a def without one fails the test.
//
// COLOUR BEFORE FILTER, always: brown is mass and distance, pink is spray
// and wind and every sheet of water, white is grit and the crack of
// fibreglass. And `drive` on anything with a body behind it — a deck panel
// booming, a hull on stone — a clean sine is a bell.

import type { SoundBank } from "./types.ts";

export const RUN_BANK: SoundBank = {
  slap: {
    description:
      "The bottom meeting a wave at pace: the deck panel booms — a short low " +
      "sine gliding down with a little drive — under a sheet of spray that " +
      "opens and thins in a fifth of a second. The chop bed carries the " +
      "small ones; this is the one the rider feels in their knees.",
    voices: [
      {
        call: "tone",
        type: "sine",
        from: 95,
        to: 52,
        durationMs: 130,
        volume: 0.045,
        drive: 0.3,
        attackMs: 3,
      },
      {
        call: "noise",
        durationMs: 210,
        volume: 0.035,
        color: "pink",
        attackMs: 8,
        filter: { type: "bandpass", frequency: 800, to: 2600, q: 0.8 },
      },
      {
        call: "noise",
        durationMs: 120,
        volume: 0.03,
        color: "brown",
        attackMs: 5,
        filter: { type: "lowpass", frequency: 320, to: 160 },
      },
    ],
  },

  land_soft: {
    description:
      "A clean landing, the hull arriving level: a wide pink sheet that " +
      "opens fast and thins out as it leaves the chines, the mass of it as a " +
      "brown thump, and a bright tail on the echo bus as the spray comes " +
      "down. No hard transient anywhere — water does not click.",
    voices: [
      {
        call: "noise",
        durationMs: 520,
        volume: 0.05,
        color: "pink",
        attackMs: 20,
        holdMs: 60,
        filter: { type: "bandpass", frequency: 700, to: 3200, q: 0.8 },
      },
      {
        call: "noise",
        durationMs: 260,
        volume: 0.038,
        color: "brown",
        attackMs: 8,
        filter: { type: "lowpass", frequency: 340 },
      },
      {
        call: "noise",
        durationMs: 700,
        volume: 0.014,
        color: "pink",
        delayMs: 150,
        attackMs: 40,
        filter: { type: "highpass", frequency: 3200 },
        echo: 0.15,
      },
    ],
  },

  land_hard: {
    description:
      "A slammed landing, the bottom flat or the nose in: the clean landing's " +
      "sheet, heavier and darker, with the deck's own boom under it — a " +
      "driven sine dropping through an octave — and a brown mass that holds " +
      "for a moment before it lets go. The one landing with a hit in it, " +
      "because the hull is the thing being hit.",
    voices: [
      {
        call: "tone",
        type: "sine",
        from: 85,
        to: 42,
        durationMs: 280,
        volume: 0.05,
        drive: 0.5,
        attackMs: 4,
      },
      {
        call: "noise",
        durationMs: 620,
        volume: 0.055,
        color: "pink",
        attackMs: 14,
        holdMs: 90,
        filter: { type: "bandpass", frequency: 500, to: 2600, q: 0.7 },
      },
      {
        call: "noise",
        durationMs: 440,
        volume: 0.05,
        color: "brown",
        attackMs: 6,
        holdMs: 60,
        filter: { type: "lowpass", frequency: 280 },
      },
      {
        call: "noise",
        durationMs: 800,
        volume: 0.016,
        color: "pink",
        delayMs: 180,
        attackMs: 50,
        filter: { type: "highpass", frequency: 2800 },
        echo: 0.2,
      },
    ],
  },

  dive: {
    description:
      "The bow going under: a long brown swallow that closes over the hull, " +
      "a pink gulp sweeping DOWN as the deck goes through the surface, and a " +
      "muffled hum from under the water. The bubbles come after, from " +
      "bubbles.ts — this is the water taking the air in.",
    voices: [
      {
        call: "noise",
        durationMs: 900,
        volume: 0.06,
        color: "brown",
        attackMs: 40,
        holdMs: 200,
        filter: { type: "lowpass", frequency: 520, to: 120 },
      },
      {
        call: "noise",
        durationMs: 520,
        volume: 0.04,
        color: "pink",
        attackMs: 30,
        filter: { type: "bandpass", frequency: 1900, to: 380, q: 0.9 },
      },
      {
        call: "tone",
        type: "sine",
        from: 62,
        to: 46,
        durationMs: 700,
        volume: 0.022,
        attackMs: 60,
        holdMs: 150,
      },
    ],
  },

  hit_rock: {
    description:
      "A hull on a skerry: the crack of fibreglass — a resonant band of white " +
      "noise — over the body of the hit, a driven square bending down, with " +
      "the rock's own answer on the echo bus, and a sheet of water thrown up " +
      "by the stop. The one sound in the bank with a real transient, because " +
      "the thing being hit is not water.",
    voices: [
      {
        call: "noise",
        durationMs: 34,
        volume: 0.06,
        filter: { type: "highpass", frequency: 2400 },
      },
      {
        call: "noise",
        durationMs: 90,
        volume: 0.045,
        filter: { type: "bandpass", frequency: 1400, q: 4 },
      },
      {
        call: "tone",
        type: "square",
        from: 190,
        to: 85,
        durationMs: 230,
        volume: 0.05,
        drive: 0.6,
        filter: { type: "lowpass", frequency: 1600, to: 500 },
        echo: 0.25,
      },
      {
        call: "noise",
        durationMs: 380,
        volume: 0.03,
        color: "pink",
        attackMs: 15,
        delayMs: 30,
        filter: { type: "bandpass", frequency: 900, to: 2800, q: 0.8 },
      },
    ],
  },

  ground: {
    description:
      "The keel on the bottom — a beach, a reef: a low thud as it touches, " +
      "then the drag, a brown bandpass that holds while the hull scrapes and " +
      "white grit over it for the stones. Dull and heavy; nothing splashes " +
      "because the water is a hand deep.",
    voices: [
      {
        call: "tone",
        type: "sine",
        from: 72,
        to: 50,
        durationMs: 160,
        volume: 0.035,
        drive: 0.25,
        attackMs: 3,
      },
      {
        call: "noise",
        durationMs: 520,
        volume: 0.04,
        color: "brown",
        attackMs: 20,
        holdMs: 160,
        filter: { type: "bandpass", frequency: 300, q: 1 },
      },
      {
        call: "noise",
        durationMs: 420,
        volume: 0.02,
        attackMs: 20,
        holdMs: 100,
        filter: { type: "highpass", frequency: 3000 },
      },
    ],
  },

  capsize: {
    description:
      "The hull going over: the biggest water in the game — a brown mass " +
      "that swells and holds for a quarter second, a pink sheet sweeping down " +
      "as the whole side goes through the surface, and a sine falling through " +
      "an octave as the air goes out of it. The bubbles that follow are the " +
      "longest tail the router asks for.",
    voices: [
      {
        call: "noise",
        durationMs: 1200,
        volume: 0.07,
        color: "brown",
        attackMs: 60,
        holdMs: 250,
        filter: { type: "lowpass", frequency: 260 },
      },
      {
        call: "noise",
        durationMs: 900,
        volume: 0.045,
        color: "pink",
        attackMs: 40,
        filter: { type: "bandpass", frequency: 2200, to: 500, q: 0.8 },
      },
      {
        call: "tone",
        type: "sine",
        from: 90,
        to: 40,
        durationMs: 600,
        volume: 0.03,
        attackMs: 30,
      },
    ],
  },

  launch: {
    description:
      "The hull leaving the water off a lip: the sheet leaving the chines " +
      "with nothing under it — a pink band sweeping UP and thinning — and a " +
      "whoosh over it. Quiet; the launch is mostly heard as the engine " +
      "running free and the spray going silent.",
    voices: [
      {
        call: "noise",
        durationMs: 380,
        volume: 0.03,
        color: "pink",
        attackMs: 10,
        filter: { type: "bandpass", frequency: 900, to: 4000, q: 0.7 },
      },
      {
        call: "noise",
        durationMs: 300,
        volume: 0.012,
        attackMs: 20,
        filter: { type: "highpass", frequency: 2500, to: 6000 },
      },
    ],
  },

  gate: {
    description:
      "A buoy taken: the arcade's own note — two sines a fifth apart, the " +
      "second a beat behind the first, over a short triangle body so it " +
      "reads as a bell struck and not a beep. Quiet, and a touch of the " +
      "shore's echo so it sits in the same air as the water.",
    voices: [
      { call: "tone", type: "sine", from: 880, durationMs: 160, volume: 0.03, echo: 0.1 },
      {
        call: "tone",
        type: "triangle",
        from: 440,
        durationMs: 120,
        volume: 0.012,
        filter: { type: "lowpass", frequency: 1800 },
      },
      {
        call: "tone",
        type: "sine",
        from: 1320,
        durationMs: 220,
        volume: 0.028,
        delayMs: 70,
        echo: 0.12,
      },
    ],
  },

  air_gate: {
    description:
      "A ring threaded in the air: the buoy's chime an octave up and " +
      "brighter, under a whoosh — a pink band sweeping up through the ring " +
      "as the hull goes through it. The one course sound that is also a " +
      "movement.",
    voices: [
      {
        call: "noise",
        durationMs: 320,
        volume: 0.025,
        color: "pink",
        attackMs: 20,
        filter: { type: "bandpass", frequency: 600, to: 3600, q: 0.7 },
      },
      { call: "tone", type: "sine", from: 1320, durationMs: 180, volume: 0.028, echo: 0.12 },
      {
        call: "tone",
        type: "sine",
        from: 1760,
        durationMs: 260,
        volume: 0.026,
        delayMs: 80,
        echo: 0.15,
      },
    ],
  },

  missed: {
    description:
      "A gate skipped and charged for: the chime inverted — two driven " +
      "squares FALLING, the second lower and later, through a dark lowpass. " +
      "Dry, flat, and no echo: bad news does not ring.",
    voices: [
      {
        call: "tone",
        type: "square",
        from: 330,
        to: 260,
        durationMs: 180,
        volume: 0.03,
        drive: 0.4,
        filter: { type: "lowpass", frequency: 1200 },
      },
      {
        call: "tone",
        type: "square",
        from: 220,
        to: 175,
        durationMs: 240,
        volume: 0.028,
        drive: 0.4,
        delayMs: 130,
        filter: { type: "lowpass", frequency: 1000 },
      },
    ],
  },

  reset: {
    description:
      "The craft put back on the water at the last gate: a splash-down — a " +
      "brown settle and a pink sheet closing — and nothing else, because the " +
      "engine bed is already there at idle when the picture lands.",
    voices: [
      {
        call: "noise",
        durationMs: 320,
        volume: 0.032,
        color: "brown",
        attackMs: 10,
        filter: { type: "lowpass", frequency: 300 },
      },
      {
        call: "noise",
        durationMs: 260,
        volume: 0.022,
        color: "pink",
        attackMs: 15,
        filter: { type: "bandpass", frequency: 800, to: 2000, q: 0.8 },
      },
    ],
  },

  finish: {
    description:
      "The line: three notes rising — a fifth, then an octave — each a sine " +
      "with a little chorus, on the echo bus, the last one held. The buoy's " +
      "chime made into a phrase.",
    voices: [
      { call: "tone", type: "sine", from: 660, durationMs: 200, volume: 0.032, detuneCents: 6 },
      {
        call: "tone",
        type: "sine",
        from: 880,
        durationMs: 220,
        volume: 0.034,
        delayMs: 140,
        detuneCents: 6,
        echo: 0.15,
      },
      {
        call: "tone",
        type: "sine",
        from: 1320,
        durationMs: 520,
        volume: 0.036,
        delayMs: 280,
        holdMs: 120,
        detuneCents: 6,
        echo: 0.2,
      },
    ],
  },
};
