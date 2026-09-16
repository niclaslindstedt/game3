// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MAIN MENU — the front door the app opens onto once the attract card
// has been pressed away, painted over a LIVE SEA: the engine is stepping a
// bot-ridden run behind this card the whole time it is up. A menu that
// stopped the water would be a menu that announces the game is not running.
//
// FIVE TILES, AND THE FIRST THREE ARE THE GAME.
//
// Each is a MARK and a NAME (menu-glyphs.tsx), two abreast. The mark is what
// the eye lands on, the word is what confirms it, and a player learns each
// one once.
//
//   RACE       → the start card, set up for a race: eleven others on the
//   TRICKS       grid, or the shore with its course taken off it, or the
//   TIME TRIAL   course against the clock alone. THREE TILES RATHER THAN A
//                ROW ON THE CARD BEHIND THEM, because the mode is not a
//                setting on a run — it is which game is being played, and
//                the three are what this game IS. A door that opens onto a
//                card and then asks which game you meant is a door that has
//                not answered anything. RACE keeps the orange the one way
//                on always had, so a rider who came here to ride is looking
//                at the tile to press before they have read a word.
//                Each writes `settings.ride.mode` on the way through, so the
//                card that follows is titled with the game it is setting up
//                and its LENGTH row appears for the one mode that has one.
//                The CAMPAIGN arrives as a tile here on the day
//                `campaign.ts` stops being a placeholder.
//   GALLERY    → the pictures the player took (menu-gallery.tsx), and the
//                only place one is ever shown. It stands under the three
//                because nothing gets into it without a run first.
//   OPTIONS    → the knobs the game actually has (menu-options.tsx), and
//                behind one of its rows the keyboard's bindings
//                (menu-keys.tsx).
//   DEVELOPER  → hidden until RACE has been HELD for seven seconds
//                (menu-hold.ts, `DEV_HOLD_MS`), and out for good once found.
//
// GALLERY and OPTIONS are QUIET (`menu-tile-quiet`): they are not ways onto
// the water, and a front door where five tiles shout equally is a front door
// with no way on.
//
// The hold is on RACE and not on the wordmark or a corner because a secret
// nobody can be told about is a secret nobody finds. "Hold the button you
// already press" is one sentence long, needs no diagram, and — since the tile
// fills and SAYS SO while it is being held — cannot be stumbled into without
// the player seeing exactly what they are about to open.
//
// The pages are a plain tagged union rather than a router: there is no URL
// to keep in step, and the whole menu is one component tree over one canvas.

import { useEffect, useRef, useState } from "preact/hooks";
import { GAME_MODES, type GameMode, type TrackKind } from "@engine";

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
import { BenchmarkHistoryPage } from "./menu-bench.tsx";
import { DeveloperPage } from "./menu-dev.tsx";
import { GalleryPage } from "./menu-gallery.tsx";
import { Glyph, type GlyphName } from "./menu-glyphs.tsx";
import { KeysPage } from "./menu-keys.tsx";
import { OptionsPage } from "./menu-options.tsx";
import { StartPage } from "./menu-start.tsx";
import type { RecordBook } from "./records.ts";
import { STRINGS } from "./strings.ts";

export type MenuPage =
  | { page: "root" }
  | { page: "start" }
  | { page: "craft" }
  | { page: "gallery" }
  | { page: "options" }
  | { page: "keys" }
  | { page: "developer" }
  /** Behind the developer page: every benchmark this machine has scored
   * (`menu-bench.tsx`). A page rather than a card over the run, because it is
   * read without one — the comparison is between runs, not inside one. */
  | { page: "benchHistory" };

/** How often the held tile redraws its fill, ms. Ten a second is a fill that
 * reads as continuous and a hundredth of the work a frame loop would do —
 * and the main thread is idle during a hold, so there is nothing here for a
 * compositor animation to buy. The bar the LOADING card draws is the other
 * case, and it is a transform for exactly that reason. */
const HOLD_TICK_MS = 100;

/** How far into the hold the tile starts saying what is about to happen. Late
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

/** The mark each way onto the water is read by, in `GAME_MODES` order. The
 * words are the strings table's (`STRINGS.modeName`); nothing here restates
 * one. */
const MODE_GLYPHS: Record<GameMode, GlyphName> = {
  race: "flag",
  tricks: "air",
  timeTrial: "stopwatch",
};

/**
 * RACE — a press that opens the start card set up for a race, and a
 * seven-second hold that opens the developer menu (see this module's header
 * for why it is this tile).
 *
 * THE PRESS IS TAKEN ON `click`, NOT ON `pointerup`, and that is what makes
 * the tile reachable three ways at once. A pointer, a key and `menu-nav.ts`'s
 * cursor all end in a click; only the first of them has pointer events at
 * all. So the pointer and key handlers do nothing but run the HOLD, and the
 * click is where the card actually opens — with `holdRelease` deciding
 * whether this particular click is one, because a hold that has already
 * unlocked something must not also walk off the page it just unlocked.
 */
function HoldTile({
  glyph,
  label,
  unlocked,
  onStart,
  onUnlock,
}: {
  glyph: GlyphName;
  /** The tile's word, already in the strings table's casing. */
  label: string;
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
  // Letting go — including dragging the finger off the tile, which is how a
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
    // DEVELOPER tile appears and the receipt with it. Measured in Chromium:
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
      class={`menu-tile menu-tile-start${saying ? " menu-tile-holding" : ""}`}
      data-menu="race"
      data-nav-next
      // Only BEGINNING is gated on there being something left to unlock.
      // The enders are always bound: a hold that armed on the last press has
      // to be let go of even though the tile has stopped holding.
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
      {/* The fill, behind the mark and the label: the tile itself is the
          progress bar, so what is filling and what is being held are the
          same object. */}
      <span class="menu-tile-hold" style={{ transform: `scaleX(${at})` }} aria-hidden="true" />
      <Glyph name={glyph} />
      <span class="menu-tile-name">{saying ? STRINGS.menuHolding : label}</span>
    </button>
  );
}

function RootPage({
  settings,
  onNavigate,
  onMode,
  onUnlock,
}: {
  settings: Settings;
  onNavigate: (page: MenuPage) => void;
  /** Which game the start card behind this door is setting up. Written on
   * the way through rather than read back here: the tiles are a CHOICE, not
   * a ladder showing where the stored setting stands. */
  onMode: (mode: GameMode) => void;
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
      {/* THE THREE WAYS ONTO THE WATER FIRST, then the two things that are
          not riding. Five is odd, so OPTIONS takes the whole bottom row
          rather than sitting beside a hole (`.menu-tiles`'s odd rule);
          unlocking the developer tile makes it a block of six and nothing
          else moves. */}
      <div class="menu-tiles">
        <HoldTile
          glyph={MODE_GLYPHS.race}
          label={STRINGS.modeName("race")}
          unlocked={settings.developer}
          onStart={() => {
            onMode("race");
            onNavigate({ page: "start" });
          }}
          onUnlock={() => {
            setSaid(true);
            onUnlock();
          }}
        />
        {/* RACE is the held one and is spelled out above; the other two are
            the same press with no secret behind it. */}
        {GAME_MODES.filter((mode) => mode !== "race").map((mode) => (
          <button
            key={mode}
            type="button"
            class="menu-tile"
            data-menu={mode}
            onClick={() => {
              onMode(mode);
              onNavigate({ page: "start" });
            }}
          >
            <Glyph name={MODE_GLYPHS[mode]} />
            <span class="menu-tile-name">{STRINGS.modeName(mode)}</span>
          </button>
        ))}
        <button
          type="button"
          class="menu-tile menu-tile-quiet"
          data-menu="gallery"
          onClick={() => onNavigate({ page: "gallery" })}
        >
          <Glyph name="camera" />
          <span class="menu-tile-name">{STRINGS.menuGallery}</span>
        </button>
        <button
          type="button"
          class="menu-tile menu-tile-quiet"
          data-menu="options"
          onClick={() => onNavigate({ page: "options" })}
        >
          <Glyph name="sliders" />
          <span class="menu-tile-name">{STRINGS.menuOptions}</span>
        </button>
        {settings.developer && (
          <button
            type="button"
            class="menu-tile menu-tile-dev"
            data-menu="developer"
            onClick={() => onNavigate({ page: "developer" })}
          >
            <Glyph name="terminal" />
            <span class="menu-tile-name">{STRINGS.menuDeveloper}</span>
          </button>
        )}
      </div>
      {/* Said once, on the visit where the hold actually landed. The tile
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
  records,
  track,
  onSettings,
  onNavigate,
  onStart,
  onBenchmark,
}: {
  page: MenuPage;
  settings: Settings;
  /** The record book, for the start card's line under the chart. */
  records: RecordBook;
  /** R29 — the URL's track kind, part of what names a record. */
  track: TrackKind | undefined;
  onSettings: (settings: Settings) => void;
  onNavigate: (page: MenuPage) => void;
  onStart: () => void;
  /** Hand the canvas to the benchmark and time a race on it — the developer
   * page's one press that is not a setting (`benchmark.ts`). */
  onBenchmark: () => void;
}) {
  return (
    <div class="menu">
      {page.page === "root" && (
        <RootPage
          settings={settings}
          onNavigate={onNavigate}
          onMode={(mode) => onSettings({ ...settings, ride: { ...settings.ride, mode } })}
          onUnlock={() => onSettings({ ...settings, developer: true })}
        />
      )}
      {page.page === "start" && (
        <StartPage
          settings={settings}
          records={records}
          track={track}
          onSettings={onSettings}
          onBack={() => onNavigate({ page: "root" })}
          onNext={() => onNavigate({ page: "craft" })}
        />
      )}
      {/* The second half of the same question, and the end of it: BACK is
          the start card the rider came through, and RIDE stands the run up
          from what the two of them agreed. */}
      {page.page === "craft" && (
        <CraftPage
          settings={settings}
          onSettings={onSettings}
          onBack={() => onNavigate({ page: "start" })}
          onRide={onStart}
        />
      )}
      {page.page === "gallery" && <GalleryPage onBack={() => onNavigate({ page: "root" })} />}
      {page.page === "options" && (
        <OptionsPage
          settings={settings}
          onSettings={onSettings}
          onBack={() => onNavigate({ page: "root" })}
          onKeys={() => onNavigate({ page: "keys" })}
        />
      )}
      {/* The one page behind a page: which key does what, reached from the
          row that summarises it and going back to it. */}
      {page.page === "keys" && (
        <KeysPage
          settings={settings}
          onSettings={onSettings}
          onBack={() => onNavigate({ page: "options" })}
        />
      )}
      {page.page === "developer" && (
        <DeveloperPage
          settings={settings}
          onSettings={onSettings}
          onBack={() => onNavigate({ page: "root" })}
          onBenchmark={onBenchmark}
          onBenchmarkHistory={() => onNavigate({ page: "benchHistory" })}
        />
      )}
      {page.page === "benchHistory" && (
        <BenchmarkHistoryPage onBack={() => onNavigate({ page: "developer" })} />
      )}
    </div>
  );
}
