// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The app's single audio surface: ONE underlying synth (one AudioContext),
// wrapped into a volume-scaled view the options page's fader moves.
// Unlocking on any user gesture unlocks everything, because there is only
// ever one context to unlock.
//
// One synth rather than one per subsystem is not a saving, it is the
// requirement: a browser gives a page one usable AudioContext's worth of
// goodwill, and the echo bus and the master limiter only do their jobs if
// every voice in the game — a spray layer, a landing, a chime — passes
// through the same pair. The day a score arrives (`soundtrack`) it is a
// second VIEW of this synth with its own fader, never a second synth.

import { createSynth } from "@niclaslindstedt/oss-game-framework/audio/synth";
import { clamp01, scaledView } from "@niclaslindstedt/oss-game-framework/audio/view";
import type { Synth } from "@niclaslindstedt/oss-game-framework/audio/voice";

// The synth's own room (a short, damped echo off a shore a couple of hundred
// metres away) is this game's room too, so it is built with the defaults.
const raw = createSynth();

let sfxVolume = 1;

/** Set the 0–1 effects volume (called by the options page). */
export function setAudioVolumes(v: { sfx: number }): void {
  sfxVolume = clamp01(v.sfx);
}

/** Every sound effect routes through this view. */
export const sfx: Synth = scaledView(raw, () => sfxVolume);

/** Start (or revive) audio from a real user gesture. Safe to call on every
 * pointer down — it is a no-op once the context is running. */
export function unlockAudio(): void {
  raw.unlock();
}
