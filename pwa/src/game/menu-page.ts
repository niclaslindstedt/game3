// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHICH PAGE THE FRONT DOOR IS ON — the menu's own tagged union, and
// nothing else.
//
// It is a type and not a component, so it lives away from the card that
// renders it (`menu-main.tsx`, which re-exports it): the URL reader has to
// name a page (`?menu=`, `url-params.ts`) and the root suite has to be able
// to read the URL reader, and a module that reaches a `.tsx` drags the DOM
// and the JSX transform into a suite that runs on plain Node.
//
// A plain union rather than a router: there is no URL to keep in step, and
// the whole menu is one component tree over one canvas.

export type MenuPage =
  | { page: "root" }
  /** The campaign's ladder (`menu-campaign.tsx`). */
  | { page: "campaign" }
  /** Which pinned shore a race, a tricks run or a time trial is ridden on
   * (`menu-levels.tsx`) — the measured modes' own first card. */
  | { page: "levels" }
  /** The seed, the day and the sea, FREE's alone (`menu-start.tsx`). */
  | { page: "start" }
  /** The craft card — the last card before the water on every way on. It
   * carries the campaign level it is choosing a hull FOR when it was
   * reached from the ladder, so BACK returns there and RIDE stands THAT
   * level up rather than the card before it. Off the ladder, BACK is read
   * off the MODE (`cardBefore`): the start card is FREE's and the level
   * card is everybody else's. */
  | { page: "craft"; campaign?: string }
  | { page: "gallery" }
  | { page: "options" }
  | { page: "keys" }
  | { page: "developer" }
  /** Behind the developer page: every benchmark this machine has scored
   * (`menu-bench.tsx`). A page rather than a card over the run, because it is
   * read without one — the comparison is between runs, not inside one. */
  | { page: "benchHistory" };
