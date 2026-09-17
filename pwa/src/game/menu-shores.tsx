// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TWO PICTURES THE CAMPAIGN'S CARDS ARE READ BY — the coast behind a
// shore row, and the layout behind a level box.
//
// They live in one module because they are two halves of one answer
// (`shore-preview.ts` states it: a coast is photographed, a level is
// stroked) and because BOTH CARDS DRAW BOTH. The campaign's ladder and the
// level card ask the same two questions in the same order — which coast, then
// which water on it — and a shore that looked like itself on one card and
// like something else on the other would be two games. So the row and the
// line are here, the GATE is passed in, and each card decides only what is
// open and what a shut one asks for.
//
// THE SHORE STEP IS A STEP rather than a strip of tabs, which is the sibling
// rally game's shape and the reason for the change: two coasts is a row of
// two, six is a row nobody can read, and the tabs were already spending the
// top of every card on a question asked once a visit. Asked on its own page
// the coast gets the whole width — which is what makes a PICTURE of it worth
// having — and the boxes under it get the height the tabs were taking.

import { useState } from "preact/hooks";

import { SHORES, type CampaignShore } from "./campaign.ts";
import { Glyph } from "./menu-glyphs.tsx";
import { ROUTE_STROKE, coastShot, routeShape } from "./shore-preview.ts";
import { STRINGS } from "./strings.ts";

/** THE LEVEL'S OWN WATER, as the shape it is — the whole racing line in the
 * corner of its own box, so six boxes read as six different rides before a
 * word on any of them has been read.
 *
 * It sits BEHIND the text rather than beside it. A level box is already as
 * short as its contents allow (a phone fits six of them only just), so a
 * picture given a column of its own would cost the grid the layout it was
 * cut down to get. Behind, at low contrast, it costs nothing and the name
 * still reads over it.
 *
 * Stroked in `currentColor`, so the box's own state paints it: the buoy's
 * yellow on an open level, grey on a shut one, and no second palette to keep
 * in step. Aria-hidden — it says nothing the box does not already say in
 * words. */
export function CourseMap({ levelId }: { levelId: string }) {
  const shape = routeShape(levelId);
  if (shape === null) return null;
  return (
    <svg
      class="menu-level-route"
      viewBox={`0 0 ${shape.width} ${shape.height}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={shape.d}
        fill="none"
        stroke="currentColor"
        stroke-width={ROUTE_STROKE}
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}

/** THE COAST behind a shore row — a real render taken by the game at a
 * staged moment on the shore's first level (`make coasts`), not a layout of
 * any one of them: a shore is six rides, and a picture of one of them would
 * be advertising the wrong water.
 *
 * It fills the row and the text sits on it, which is the only layout that
 * does not cost the card height it has not got. Decorative, so it is hidden
 * from a reader — the row already says the coast's name and what it is like
 * in words.
 *
 * A missing file takes itself off the card rather than leaving a broken
 * image in the menu: the banners are generated, and a shore added to
 * `campaign-levels.ts` before `make coasts` is next run has none. */
function CoastShot({ shore }: { shore: CampaignShore }) {
  const [gone, setGone] = useState(false);
  if (gone) return null;
  return (
    <img
      class="menu-shore-shot"
      src={coastShot(shore.id, import.meta.env.BASE_URL)}
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
      onError={() => setGone(true)}
    />
  );
}

/** THE SHORES, as the step before the levels — the campaign's own first
 * page, and the same page in front of the level card's grid.
 *
 * A shut shore is still SHOWN, dimmed: what is on the other side of the
 * padlock is the reason to go through it, and a grey box is a reason to
 * stop looking. */
export function ShoreList({
  open,
  hint,
  line,
  next,
  onPick,
}: {
  /** Whether this shore's levels can be reached from the card asking. */
  open: (shore: CampaignShore) => boolean;
  /** What a shut row asks for. A padlock with no reason on it is a wall. */
  hint: (shore: CampaignShore) => string;
  /** The row's third line — what has been got out of the shore so far, or
   * how much of it there is. */
  line: (shore: CampaignShore) => string;
  /** The shore the card would pick for you: where the cursor lands and what
   * the way on presses. */
  next: CampaignShore | null;
  onPick: (shore: CampaignShore) => void;
}) {
  return (
    <div class="menu-shores">
      {SHORES.map((shore) => {
        const unlocked = open(shore);
        const why = hint(shore);
        if (!unlocked) {
          return (
            <div
              key={shore.id}
              class="menu-shore menu-shore-locked"
              title={why}
              aria-label={`${STRINGS.coastName(shore.id)} — ${why}`}
            >
              <CoastShot shore={shore} />
              <span class="menu-shore-name">
                <Glyph name="lock" />
                {STRINGS.coastName(shore.id)}
              </span>
              <span class="menu-shore-line">{why}</span>
            </div>
          );
        }
        return (
          <button
            key={shore.id}
            type="button"
            class="menu-shore"
            data-nav-next={shore === next ? "" : undefined}
            data-nav-focus={shore === next ? "" : undefined}
            onClick={() => onPick(shore)}
          >
            <CoastShot shore={shore} />
            <span class="menu-shore-name">{STRINGS.coastName(shore.id)}</span>
            <span class="menu-shore-blurb-row">{shore.blurb}</span>
            <span class="menu-shore-line">{line(shore)}</span>
          </button>
        );
      })}
    </div>
  );
}
