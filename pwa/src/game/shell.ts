// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHICH SURFACE IS UP, and everything that follows from it. Seven surfaces
// over ONE canvas and ONE engine state — the shell never tears a run down,
// it only decides who rides it and what is drawn over the top:
//
//   splash   the attract card (`splash-screen.tsx`).
//   menu     the front door (`menu-main.tsx`), over a bot-ridden sea.
//   loading  a run being stood up (`loading-screen.tsx`).
//   pause    the run HELD for the player to read (`menu-pause.tsx`).
//   run      the player's hands on it, with the HUD over the top.
//   bench    a race being TIMED (`benchmark.ts`), behind the developer
//            page's benchmark card.
//   replay   a run that already happened, being WATCHED (`replay.ts`): the
//            same engine over the same shore, ridden off the controls the
//            run was ridden on, with nobody's hands on it.
//
// A REPLAY IS A RUN THAT NOBODY IS RIDING, which is why it is a surface of
// its own and not a flag on `run`. The engine steps, the app draws and the
// HUD is over it — the clock, the dial and the map read the recording exactly
// as they read the run, because it IS the run — but the input manager is not
// asked for a thing, the tape is; the books are not written, because the
// figure was booked when the run happened; and the pause card is not offered,
// because a recording has nothing to lose by being left.
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
// THE BENCH IS THE ONE SURFACE THE APP'S OWN LOOP DOES NOT DRAW EITHER, and
// for a reason that has nothing to do with the sea: the benchmark PUMPS ITS
// OWN FRAMES, as fast as the machine will draw them (`benchmark.ts`), and a
// frame drawn alongside them by `requestAnimationFrame` is time the
// measurement is charged for and did not spend. So the water does not stop
// under it either — somebody else is simply turning it.
//
// DOM-free, so `tests/menu_system_test.ts` holds the five rules below
// without a browser. `App.tsx` is the one module that decides WHEN the
// surface changes; these say what each one means once it has.

export const SHELLS = ["splash", "menu", "loading", "pause", "run", "bench", "replay"] as const;

export type Shell = (typeof SHELLS)[number];

/** Whether the player's hands are on the craft. Everywhere else the BOT
 * rides it, which is what keeps the water moving under a card — except a
 * REPLAY, where a tape rides it (`watching`). */
export function playerRides(shell: Shell): boolean {
  return shell === "run";
}

/** Whether what is on screen is a RECORDING rather than a run being ridden.
 * Stated apart from `playerRides` because the two answers are not opposites:
 * nobody is riding a replay, and yet everything a player would hear and read
 * is still on — it is the run, an hour later. */
export function watching(shell: Shell): boolean {
  return shell === "replay";
}

/** Whether the sound is the FULL mix rather than a bed ducked under a card.
 * A run being ridden and a run being watched are both somebody listening to
 * the sea; every card is the game talking over it. */
export function soundsLive(shell: Shell): boolean {
  return playerRides(shell) || watching(shell);
}

/** Whether the engine takes steps at all — see this module's header for the
 * two surfaces that say no, and for why they are two different noes. */
export function simulates(shell: Shell): boolean {
  return shell !== "pause" && shell !== "bench";
}

/** Whether the app's own frame loop DRAWS. Everywhere but the benchmark,
 * which owns the canvas while one is up — see this module's header. Stated
 * apart from `simulates` because they are two different noes: the pause card
 * stops the clock and keeps drawing, and the bench stops neither, it simply
 * is not the app's to draw. */
export function appDraws(shell: Shell): boolean {
  return shell !== "bench";
}

/** Whether the HUD is drawn. The pause card stands OVER the readouts rather
 * than in place of them: the frozen frame the player is looking at is still
 * the run, and its clock, its gate count and its speed are part of what they
 * stopped to read. A REPLAY carries it for the same reason from the other
 * side: the readouts are reading the recording, and the recording is the
 * run. */
export function hudOver(shell: Shell): boolean {
  return shell === "run" || shell === "pause" || shell === "replay";
}

/** Whether the pause card can be reached from here. Only out of a run: a
 * card that could be opened over the front door would be offering to freeze
 * an attract demo, and one opened over the loading card would freeze a run
 * being built — and one over a REPLAY would be holding a recording that can
 * simply be watched again. */
export function canPause(shell: Shell): boolean {
  return shell === "run";
}
