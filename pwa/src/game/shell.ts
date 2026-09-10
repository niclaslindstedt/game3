// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHICH SURFACE IS UP, and everything that follows from it. Five surfaces
// over ONE canvas and ONE engine state — the shell never tears a run down,
// it only decides who rides it and what is drawn over the top:
//
//   splash   the attract card (`splash-screen.tsx`).
//   menu     the front door (`menu-main.tsx`), over a bot-ridden sea.
//   loading  a run being stood up (`loading-screen.tsx`).
//   pause    the run HELD for the player to read (`menu-pause.tsx`).
//   run      the player's hands on it, with the HUD over the top.
//
// THE SEA NEVER STOPS BEHIND A CARD — with exactly one exception, and the
// difference between the two is the whole reason this module exists. The
// attract card, the front door and the loading card all stand over a run
// nobody is riding: the bot has it, the water moves, and a menu that stopped
// it would announce that the game is not running. The PAUSE card stands over
// a run the PLAYER is in the middle of, and a run that carried on being
// ridden while its rider read a menu would be a card that costs them the
// gate they stopped at. So the pause card, and only the pause card, freezes.
//
// DOM-free, so `tests/menu_system_test.ts` holds the four rules below
// without a browser. `App.tsx` is the one module that decides WHEN the
// surface changes; these say what each one means once it has.

export const SHELLS = ["splash", "menu", "loading", "pause", "run"] as const;

export type Shell = (typeof SHELLS)[number];

/** Whether the player's hands are on the craft. Everywhere else the BOT
 * rides it, which is what keeps the water moving under a card. */
export function playerRides(shell: Shell): boolean {
  return shell === "run";
}

/** Whether the engine takes steps at all — see this module's header for the
 * one surface that says no. */
export function simulates(shell: Shell): boolean {
  return shell !== "pause";
}

/** Whether the HUD is drawn. The pause card stands OVER the readouts rather
 * than in place of them: the frozen frame the player is looking at is still
 * the run, and its clock, its gate count and its speed are part of what they
 * stopped to read. */
export function hudOver(shell: Shell): boolean {
  return shell === "run" || shell === "pause";
}

/** Whether the pause card can be reached from here. Only out of a run: a
 * card that could be opened over the front door would be offering to freeze
 * an attract demo, and one opened over the loading card would freeze a run
 * being built. */
export function canPause(shell: Shell): boolean {
  return shell === "run";
}
