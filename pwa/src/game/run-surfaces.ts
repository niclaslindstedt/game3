// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SIX WAYS A RUN IS LEFT AND COME BACK TO, in one place.
//
// A surface change is the whole of what five of these are (`shell.ts`): the
// frame loop reads the surface and decides who rides the craft, whether the
// engine steps at all and what is drawn over it, so none of those tears
// anything down. What they own is the bookkeeping AROUND the change — the
// card the front door opens on, the ghost taken off the water, the recording
// cut or dropped — which is the part that used to be five comments deep
// inside the frame loop. RESTART is the odd one out and is here anyway,
// because it is the same question asked of the same run: the rider is done
// with the one he is on.
//
//   PAUSE    the run HELD where it stands, the one surface that freezes.
//   RESUME   back to the water, on the very frame it was left on.
//   WATCH    the run so far, put back on the water with nobody riding it
//            (`replay-run.ts`) — which ENDS the run, the same way the front
//            door does.
//   MENU     out to the front door. Nothing is torn down: the same craft
//            carries on under the bot, which is what keeps the water moving
//            under the menu.
//   RESTART  the run again from the line, on the shore it is already on —
//            the B key's own line, and the finish plate's first press. The
//            one of the six that STANDS something: a fresh state on the same
//            settings, which is the loop's (`restand`).
//   ABANDON  off a load that will not finish.
//
// WHY WATCH AND MENU ARE THE SAME KIND OF THING, and why they share this
// file: both are the run ENDING. Neither loses anything that was not already
// booked — the figure, the record and the campaign's board are all written at
// the finish, long before either press — and both leave the water running
// under the bot. The only difference is what the player is looking at
// afterwards.
//
// A FACTORY over the app's own closures rather than a module that reaches for
// them: the engine state, the clock, the renderer and the cards are
// `App.tsx`'s, built once on mount and outliving every card. The same shape
// `run-settle.ts` and `app-load.ts` are built in, and for the same reason.

import type { GhostRig } from "./ghost-run.ts";
import type { MenuPage } from "./menu-page.ts";
import { freeRides } from "./new-game.ts";
import type { ReplayRun } from "./replay-run.ts";
import type { Settings } from "./settings.ts";
import { canPause, type Shell } from "./shell.ts";

export type RunSurfaceWorld = {
  settings: () => Settings;
  /** Which surface is up, and the one call that changes it. */
  shell: () => Shell;
  setShell: (shell: Shell) => void;
  /** A frame held by `?shot=1` for a tool, released by anything that moves
   * the run on — a still nobody asked for is a still nobody is taking. */
  unfreeze: () => void;
  /** The run clock, resumed by every press that puts a run back in motion. */
  resumeClock: () => void;
  /** A fresh run stood on the settings as they stand — the loop's, because
   * the engine state and the world behind it are `App.tsx`'s. */
  restand: () => void;
  /** Whether the run under the HUD is a campaign rung, and the way to say it
   * no longer is: out of one, the door opens on the ladder rather than the
   * root, and what was ridden stops being the campaign's. */
  onCampaign: () => boolean;
  leaveCampaign: () => void;
  setMenuPage: (page: MenuPage) => void;
  setResult: (result: null) => void;
  /** The load in flight, for the one press that gives up on one. */
  abandon: () => void;
  ghost: GhostRig;
  replays: ReplayRun;
};

export type RunSurfaces = {
  pause: () => void;
  resume: () => void;
  toMenu: () => void;
  restart: () => void;
  abandonLoad: () => void;
  watch: () => void;
};

export function createRunSurfaces(world: RunSurfaceWorld): RunSurfaces {
  /** Out of a run, whichever way: the ghost off the water — a see-through
   * hull riding an attract sea is nobody's best — and the clock and the held
   * frame let go of, so the water is moving whatever comes next. */
  const endRun = (): void => {
    world.unfreeze();
    world.resumeClock();
    world.ghost.clear();
  };

  return {
    pause: () => {
      if (!canPause(world.shell())) return;
      world.setShell("pause");
    },
    resume: () => {
      if (world.shell() !== "pause") return;
      // The clock is not what held the run — the loop simply stopped asking
      // it for steps — so there is no debt to forgive. The next frame is one
      // frame long.
      world.setShell("run");
    },
    // WATCHING THE RUN BACK. The recording is cut where the run stands and
    // stood up in its place; the run itself is over. A press that finds no
    // recording to stand up does nothing at all rather than leaving the
    // player on a surface with no run under it — which is why the surface is
    // changed only once the rig says it has one.
    watch: () => {
      // THE CUT FIRST, and the run ended only once it has one. A rebuild that
      // will not build is a press that does nothing — and a press that had
      // already taken the ghost off the water would have cost the rider
      // something for a recording they never got.
      if (!world.replays.watch()) return;
      endRun();
      world.setResult(null);
      world.setShell("replay");
    },
    toMenu: () => {
      endRun();
      world.setResult(null);
      // Out of a campaign run the door opens on the ladder, where the box
      // just ridden shows what it paid.
      world.setMenuPage(world.onCampaign() ? { page: "campaign" } : { page: "root" });
      world.leaveCampaign();
      // A recording left behind is a recording nobody is watching: the tape
      // is dropped and the camera handed back to the ladder a run is ridden
      // on. Called on every way out rather than only out of a replay, because
      // the one thing that must never be missed is the ladder.
      world.replays.clear();
      world.setShell("menu");
    },
    // THE RUN AGAIN, from the line. The ghost is NOT taken off the water the
    // way it is on the four presses that end a run — the rider is about to
    // ride the same shore again, and `restand` arms it for the run it is
    // standing. Everything else is `endRun`'s: the held frame let go of, and
    // the clock running behind the fresh state.
    restart: () => {
      world.unfreeze();
      world.restand();
      world.resumeClock();
    },
    // The way off a load that will not finish. Back to the card that CHOSE
    // the shore the generator refused rather than to the front door — the
    // level card on a measured run, the start card's seed row on a free one —
    // so the player is one press from the next shore along rather than three.
    abandonLoad: () => {
      world.abandon();
      world.setMenuPage({ page: freeRides(world.settings()) ? "start" : "levels" });
      world.setShell("menu");
    },
  };
}
