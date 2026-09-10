// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MAIN MENU — the front door the app opens onto once the attract card
// has been pressed away, painted over a LIVE SEA: the engine is stepping a
// bot-ridden run behind this card the whole time it is up. A menu that
// stopped the water would be a menu that announces the game is not running.
//
// THREE ROWS, AND THE MIDDLE ONE IS THE POINT.
//
//   START      → the start card (menu-start.tsx): the craft, the shore, the
//                hour and the day, then the press that rides. Its CRAFT row
//                opens a card of its own (menu-craft.tsx), because four
//                hulls are four shapes and a row of names cannot show one.
//                The only way into a run there is: this is
//                a vertical slice, and a front door offering four modes that
//                all lead to the same shore would be a door telling four
//                lies. Campaign, Time Trial and the rest arrive as rows here
//                on the day `campaign.ts` stops being a placeholder.
//   OPTIONS    → the knobs the game actually has (menu-options.tsx).
//   DEVELOPER  → hidden until START has been HELD for seven seconds
//                (menu-hold.ts, `DEV_HOLD_MS`), and out for good once found.
//
// The hold is on START and not on the wordmark or a corner because a secret
// nobody can be told about is a secret nobody finds. "Hold the button you
// already press" is one sentence long, needs no diagram, and — since the row
// fills and SAYS SO while it is being held — cannot be stumbled into without
// the player seeing exactly what they are about to open.
//
// The pages are a plain tagged union rather than a router: there is no URL
// to keep in step, and the whole menu is one component tree over one canvas.

import { useEffect, useRef, useState } from "preact/hooks";

import { APP_NAME, REPO_URL } from "../identity.ts";
import { MarkWave } from "./mark-wave.tsx";
import { DEV_HOLD_MS, type Settings } from "./settings.ts";
import {
  NO_HOLD,
  holdProgress,
  releaseHold,
  takePress,
  tickHold,
  type HoldState,
} from "./menu-hold.ts";
import { CraftPage } from "./menu-craft.tsx";
import { DeveloperPage } from "./menu-dev.tsx";
import { OptionsPage } from "./menu-options.tsx";
import { StartPage } from "./menu-start.tsx";
import { STRINGS } from "./strings.ts";

export type MenuPage =
  | { page: "root" }
  | { page: "start" }
  | { page: "craft" }
  | { page: "options" }
  | { page: "developer" };

/** How often the held row redraws its fill, ms. Ten a second is a fill that
 * reads as continuous and a hundredth of the work a frame loop would do —
 * and the main thread is idle during a hold, so there is nothing here for a
 * compositor animation to buy. The bar the LOADING card draws is the other
 * case, and it is a transform for exactly that reason. */
const HOLD_TICK_MS = 100;

/** How far into the hold the row starts saying what is about to happen. Late
 * enough that an ordinary press never sees it, early enough that nobody
 * reaches seven seconds without having been told where they are going. */
const HOLD_SAYS_AT = 0.15;

/** The build, bottom right, linking to the exact commit it was cut from. A
 * build with no commit behind it (a working tree, `git` unavailable) says so
 * and links nowhere — a dead link is worse than an honest label. */
function VersionStamp() {
  const label = `v${__APP_VERSION__}`;
  const sha = __COMMIT_SHA__;
  if (!sha || sha === "dev") {
    return <span class="menu-version menu-version-dev">{label} · dev</span>;
  }
  return (
    <a
      class="menu-version"
      href={`${REPO_URL}/commit/${sha}`}
      target="_blank"
      rel="noreferrer noopener"
      title="Open this build's commit on GitHub"
    >
      {label} · {sha}
    </a>
  );
}

/**
 * START — a press that opens the start card, and a seven-second hold that
 * opens the developer menu (see this module's header for why it is this row).
 *
 * THE PRESS IS TAKEN ON `click`, NOT ON `pointerup`, and that is what makes
 * the row reachable three ways at once. A pointer, a key and `menu-nav.ts`'s
 * cursor all end in a click; only the first of them has pointer events at
 * all. So the pointer and key handlers do nothing but run the HOLD, and the
 * click is where the card actually opens — with `holdRelease` deciding
 * whether this particular click is one, because a hold that has already
 * unlocked something must not also walk off the page it just unlocked.
 */
function StartRow({
  unlocked,
  onStart,
  onUnlock,
}: {
  unlocked: boolean;
  onStart: () => void;
  onUnlock: () => void;
}) {
  const [hold, setHold] = useState<HoldState>(NO_HOLD);
  const [at, setAt] = useState(0);
  // The hold as the CLICK will read it. `hold` is state, and a click arrives
  // in the same task as the release that ended it — before the render that
  // would have shown it — so the decision is taken off a ref written
  // synchronously beside every `setHold`.
  const holdRef = useRef<HoldState>(NO_HOLD);
  const put = (next: HoldState): void => {
    holdRef.current = next;
    setHold(next);
  };

  useEffect(() => {
    if (hold.from === null || hold.armed) return;
    const timer = window.setInterval(() => {
      const now = performance.now();
      setAt(holdProgress(hold, now, DEV_HOLD_MS));
      const next = tickHold(hold, now, DEV_HOLD_MS);
      if (next === hold) return;
      put(next);
      setAt(1);
      onUnlock();
    }, HOLD_TICK_MS);
    return () => window.clearInterval(timer);
    // `onUnlock` is a fresh closure each render and would restart the
    // interval; the hold itself is the only thing this should answer to.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hold]);

  const begin = (): void => {
    if (hold.from !== null) return;
    setAt(0);
    put({ from: performance.now(), armed: false });
  };
  // Letting go — including dragging the finger off the row, which is how a
  // player who changed their mind about the hold says so. A hold that FIRED
  // stays armed across this: the click it is about to produce is the one it
  // has to swallow, and `press` below is where it is spent.
  const end = (): void => {
    const released = releaseHold(holdRef.current);
    put(released);
    setAt(0);
    // ...AND IF NO CLICK EVER COMES FOR IT, IT IS SPENT ANYWAY, one task
    // later. This is not belt and braces; it is the case that actually
    // happens. A browser only raises `click` when the press and the release
    // land on the same element, and the release that ARMS this hold is the
    // one release guaranteed to change the card under the finger — the
    // DEVELOPER row appears and the receipt with it. Measured in Chromium:
    // that release raises no click at all. An `armed` left standing then
    // waits for the NEXT press and eats that instead, which is a START
    // button that unlocks the developer menu once and never rides again.
    //
    // A timeout of zero is strictly after the click, because a click is
    // dispatched synchronously with the release that causes it — so whichever
    // of the two arrives, the flag is spent exactly once.
    if (released.armed) {
      window.setTimeout(() => {
        if (holdRef.current.armed && holdRef.current.from === null) put(NO_HOLD);
      }, 0);
    }
  };
  /** The click, or the key coming back up: an ordinary press unless a
   * completed hold is standing there to be spent on it. */
  const press = (): void => {
    const taken = takePress(holdRef.current);
    put(taken.hold);
    if (taken.press) onStart();
  };

  // Already unlocked: the hold has nothing left to open, so START is a plain
  // button again. Leaving it armed would mean every long press on the way
  // into a run re-running a thing that has already happened.
  const holds = !unlocked;
  const saying = at >= HOLD_SAYS_AT;
  return (
    <button
      type="button"
      class={`menu-item menu-item-start${saying ? " menu-item-holding" : ""}`}
      data-menu="start"
      data-nav-next
      // Only BEGINNING is gated on there being something left to unlock.
      // The enders are always bound: a hold that armed on the last press has
      // to be let go of even though the row has stopped holding.
      onPointerDown={holds ? begin : undefined}
      onPointerUp={end}
      onPointerLeave={end}
      onPointerCancel={end}
      // A key held down repeats, and the browser turns each repeat into a
      // click — so the key path takes the press itself on the way UP and
      // swallows the synthesised clicks, rather than starting a run on the
      // first repeat of a hold that had six seconds left to run.
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        if (!e.repeat && holds) begin();
      }}
      onKeyUp={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        press();
      }}
      onClick={press}
    >
      {/* The fill, behind the label: the row itself is the progress bar, so
          what is filling and what is being held are the same object. */}
      <span class="menu-item-hold" style={{ transform: `scaleX(${at})` }} aria-hidden="true" />
      <span class="menu-item-name">{saying ? STRINGS.menuHolding : STRINGS.menuStart}</span>
    </button>
  );
}

function RootPage({
  settings,
  onNavigate,
  onUnlock,
}: {
  settings: Settings;
  onNavigate: (page: MenuPage) => void;
  onUnlock: () => void;
}) {
  const [said, setSaid] = useState(false);
  return (
    <div class="menu-card menu-card-root">
      <div class="menu-brand">
        {/* The mark rides with the NAME, not with the name and its billing:
            paired with the whole block it sits visibly low, because the
            tagline under it drags the centre it is aligned to down a line. */}
        <div class="menu-brand-line">
          <MarkWave lay="once" className="menu-brand-mark" />
          <span class="menu-brand-name">{APP_NAME.toUpperCase()}</span>
        </div>
        <span class="menu-brand-tag">{STRINGS.menuTag}</span>
      </div>
      <div class="menu-items">
        <StartRow
          unlocked={settings.developer}
          onStart={() => onNavigate({ page: "start" })}
          onUnlock={() => {
            setSaid(true);
            onUnlock();
          }}
        />
        <button
          type="button"
          class="menu-item"
          data-menu="options"
          onClick={() => onNavigate({ page: "options" })}
        >
          <span class="menu-item-name">{STRINGS.menuOptions}</span>
        </button>
        {settings.developer && (
          <button
            type="button"
            class="menu-item menu-item-dev"
            data-menu="developer"
            onClick={() => onNavigate({ page: "developer" })}
          >
            <span class="menu-item-name">{STRINGS.menuDeveloper}</span>
          </button>
        )}
      </div>
      {/* Said once, on the visit where the hold actually landed. The row
          appearing is the lasting answer; this is the moment's one, so
          nobody has to wonder whether the seven seconds did anything. */}
      {said && <p class="menu-said">{STRINGS.menuUnlocked}</p>}
      <VersionStamp />
    </div>
  );
}

export function MainMenu({
  page,
  settings,
  onSettings,
  onNavigate,
  onStart,
}: {
  page: MenuPage;
  settings: Settings;
  onSettings: (settings: Settings) => void;
  onNavigate: (page: MenuPage) => void;
  onStart: () => void;
}) {
  return (
    <div class="menu">
      {page.page === "root" && (
        <RootPage
          settings={settings}
          onNavigate={onNavigate}
          onUnlock={() => onSettings({ ...settings, developer: true })}
        />
      )}
      {page.page === "start" && (
        <StartPage
          settings={settings}
          onSettings={onSettings}
          onBack={() => onNavigate({ page: "root" })}
          onCraft={() => onNavigate({ page: "craft" })}
          onRide={onStart}
        />
      )}
      {/* The craft card's only way out is BACK to the start card: it was a
          row there, and a rider who has just chosen a hull is still in the
          middle of answering what this run is. */}
      {page.page === "craft" && (
        <CraftPage
          settings={settings}
          onSettings={onSettings}
          onBack={() => onNavigate({ page: "start" })}
        />
      )}
      {page.page === "options" && (
        <OptionsPage
          settings={settings}
          onSettings={onSettings}
          onBack={() => onNavigate({ page: "root" })}
        />
      )}
      {page.page === "developer" && (
        <DeveloperPage
          settings={settings}
          onSettings={onSettings}
          onBack={() => onNavigate({ page: "root" })}
        />
      )}
    </div>
  );
}
