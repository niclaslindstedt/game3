// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CHROME EVERY MENU PAGE IS HUNG ON: the head with its way back, and the
// body under it.
//
// It is here rather than in each page for the reason the strings table exists:
// two surfaces wording the same question differently are two questions as far
// as the player is concerned, and two surfaces DRAWING the way out differently
// are two programs. A page under the front door opens with this head or it
// does not look like part of the game.
//
// THE ROWS THEMSELVES ARE `menu-knobs.tsx` — one silhouette for every setting
// on every surface: the name, the value between two arrows, the pips under it.
// They used to live here as four different shapes (chips, a fader, a stepper,
// a switch with its cost written underneath), which is four things a player
// had to learn before they could read a page; the knobs are one.
//
// A choice whose answers CANNOT BE SAID IN WORDS is still not a row at all:
// four hulls are four shapes, so the craft takes a card of its own
// (`menu-craft.tsx`) rather than a ladder nobody can picture.
//
// THE HEAD IS ALSO WHERE A PAGE'S WAY ON MAY STAND. Back on the left, on to
// the right: a page whose body is a column of settings reads top to bottom,
// and a way on parked under the last of them is a row the card has to be tall
// enough for — on a phone, the row that pushes the card past the viewport and
// scrolls the answer the player just picked off the screen. In the head it
// costs the card no height at all and sits where the eye already goes when it
// is done with a page. It stays OPTIONAL: a page that ends in a press of its
// own (the craft card's RIDE, standing under the hull it rides) keeps it there.

import type { ComponentChildren } from "preact";

export function MenuHead({
  back,
  backLabel,
  title,
  sub,
  action,
}: {
  back: () => void;
  backLabel: string;
  title: string;
  /** The page's one line of billing. Omitted on pages whose title says it
   * all — the head then holds the title alone, still on one row. */
  sub?: string;
  /** The page's way ON, standing opposite its way back. */
  action?: ComponentChildren;
}) {
  // A head carrying a subtitle is two rows tall and the way out stands level
  // with the TITLE, not floating between the two; a head that is only a
  // title is one row, and the button centres on it. The difference is marked
  // here rather than guessed at in the stylesheet, because it is a fact
  // about the content and there is exactly one place that knows it.
  return (
    <div class={`menu-head${sub === undefined ? " menu-head-solo" : ""}`}>
      {/* `data-nav-back` is what the cursor's way out presses — see
          menu-nav.ts. Marked rather than guessed at: every surface has a way
          out, and no two of them look alike in the markup. */}
      <button type="button" class="menu-back" data-nav-back onClick={back}>
        ‹ {backLabel}
      </button>
      <div class="menu-head-text">
        <div class="menu-title">{title}</div>
        {sub !== undefined && <div class="menu-sub">{sub}</div>}
      </div>
      {action}
    </div>
  );
}
