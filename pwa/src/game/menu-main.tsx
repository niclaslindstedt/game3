// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MAIN MENU — the front door the app opens onto once the attract card
// has been pressed away, painted over a LIVE SEA: the engine is stepping a
// bot-ridden run behind this card the whole time it is up. A menu that
// stopped the water would be a menu that announces the game is not running.
//
// THREE TIERS, AND THE COLOUR IS THE TIER. That is the whole rule, and it is
// one sentence because a door a player has to be taught is a door that has
// failed: **how close is this press to water?**
//
//   THE ORANGE ONE  is the way IN — the campaign, and nothing else on the
//                   card is orange. The lit colour means one thing here, so
//                   a rider who has just arrived is looking at the tile to
//                   press before they have read a word. (Two lit tiles is
//                   the same as none: the eye is given a choice where it
//                   wanted an answer.)
//   THE SEA BLUE    are the four ways onto water WITHOUT a ladder. Four,
//                   equal, and deliberately not ranked against each other:
//                   they are four games, not four rungs.
//   THE FOOT STRIP  is everything that is not water. It is not tile-shaped
//                   at all, because a thing that does not start a run should
//                   not wear the shape of one.
//
// The tiles, in the order they stand:
//
//   CAMPAIGN   → the ladder (menu-campaign.tsx). THE HERO: twice the width
//                of the rest, the largest mark on the card, and a line of
//                its own saying how far up the twelve the player has got
//                (`campaignStanding`). It is the only tile with something to
//                ride FOR, and the only one whose face changes between
//                visits — which is what makes it worth looking at on the
//                second visit as well as the first.
//   RACE       → the LEVEL card (menu-levels.tsx), set up for that game:
//   TRICKS       eleven others on the grid, or the shore with its course
//   TIME TRIAL   taken off it, or the course against the clock alone. TILES
//                RATHER THAN A ROW ON THE CARD BEHIND THEM, because the mode
//                is not a setting on a run — it is which game is being
//                played. A door that opens onto a card and then asks which
//                game you meant is a door that has not answered anything.
//                Each writes `settings.ride.mode` on the way through, so the
//                card that follows is titled with the game it is setting up
//                and its LENGTH row appears for the one mode that has one.
//   FREE RIDE  → the START card (menu-start.tsx) instead, and it is the only
//                tile that opens it: a seed of your own, a wind off any
//                quarter and a sea of any size are the knobs of the one mode
//                where nothing is being measured. The other three ride the
//                campaign's pinned shores, so that two times down the same
//                level are two times down the same water.
//   GALLERY    → the pictures the player took (menu-gallery.tsx), and the
//                only place one is ever shown. On the strip because nothing
//                gets into it without a run first.
//   OPTIONS    → the knobs the game actually has (menu-options.tsx), and
//                behind one of its rows the keyboard's bindings
//                (menu-keys.tsx).
//   DEVELOPER  → hidden until RACE has been HELD for seven seconds
//                (menu-hold.ts, `DEV_HOLD_MS`), and out for good once found.
//
// THE DOOR LAYS ITSELF OUT ALONG WHICHEVER AXIS HAS ROOM. A phone held
// UPRIGHT has height and no width, so the hero takes a row of its own and
// the four modes pair off beneath it. A phone held SIDEWAYS — which is how
// this game is actually held — has the opposite, so the card widens, the
// hero stands beside the four rather than above them, and the whole door
// comes to two rows. The stylesheet owns the arithmetic; what matters here
// is that the DOM is one order and one markup either way, so there is no
// second door to keep in step.
//
// The hold is on RACE and not on the wordmark or a corner because a secret
// nobody can be told about is a secret nobody finds: "hold the button you
// already press" is one sentence long and needs no diagram. THE TILE SAYS
// NOTHING WHILE IT IS HELD — no fill, no change of word. A door meant to stay
// hidden cannot advertise itself to everybody who rests a thumb on START, so
// the only way through it is knowing where to press; the DEVELOPER chip
// appearing is the whole of the answer, and `menu-said` below is the moment's
// one.
//
// WHICH page is up is a plain tagged union, and it lives next door
// (`menu-page.ts`) so the URL reader can name one without reaching a `.tsx`;
// this file re-exports it, so `MenuPage` still has one spelling.

import { useEffect, useRef, useState } from "preact/hooks";
import { GAME_MODES, type GameMode } from "@engine";

import { APP_NAME, REPO_URL } from "../identity.ts";
import { MarkWave } from "./mark-wave.tsx";
import { DEV_HOLD_MS, type Settings } from "./settings.ts";
import { NO_HOLD, releaseHold, takePress, tickHold, type HoldState } from "./menu-hold.ts";
import {
  campaignStanding,
  findLevel,
  type CampaignLevel,
  type CampaignProgress,
} from "./campaign.ts";
import { CampaignPage } from "./menu-campaign.tsx";
import { CraftPage } from "./menu-craft.tsx";
import { BenchmarkHistoryPage } from "./menu-bench.tsx";
import { DeveloperPage } from "./menu-dev.tsx";
import { GalleryPage } from "./menu-gallery.tsx";
import { Glyph, type GlyphName } from "./menu-glyphs.tsx";
import { KeysPage } from "./menu-keys.tsx";
import { OptionsPage } from "./menu-options.tsx";
import { StartPage } from "./menu-start.tsx";
import type { RecordBook } from "./records.ts";
import { LevelsPage } from "./menu-levels.tsx";
import type { MenuPage } from "./menu-page.ts";
import { STRINGS } from "./strings.ts";

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

/** WHICH CARD STANDS BETWEEN A TILE AND THE CRAFT CARD: the pinned shores
 * for the three modes that measure something, the seed and the day for the
 * one that does not. It is `freeRides`' question asked about a mode rather
 * than about the settings, and it is stated once because BACK out of the
 * craft card has to give the same answer the tile did. */
function cardBefore(mode: GameMode): "levels" | "start" {
  return mode === "free" ? "start" : "levels";
}

/** The mark each way onto the water is read by, in `GAME_MODES` order. The
 * words are the strings table's (`STRINGS.modeName`); nothing here restates
 * one. */
const MODE_GLYPHS: Record<GameMode, GlyphName> = {
  race: "flag",
  tricks: "air",
  timeTrial: "stopwatch",
  free: "compass",
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
  // The hold as the CLICK will read it. `hold` is state, and a click arrives
  // in the same task as the release that ended it — before the render that
  // would have shown it — so the decision is taken off a ref written
  // synchronously beside every `setHold`.
  const holdRef = useRef<HoldState>(NO_HOLD);
  const put = (next: HoldState): void => {
    holdRef.current = next;
    setHold(next);
  };

  // ONE TIMER FOR THE WHOLE HOLD, not a tick a tenth of a second. Nothing is
  // drawn while the finger is down, so there is no fraction to redraw and the
  // only moment that matters is the one the hold completes at — which is a
  // known time away. `tickHold` is still what decides it: the rule lives in
  // the DOM-free module the tests read, and this only says when to ask.
  useEffect(() => {
    if (hold.from === null || hold.armed) return;
    const left = DEV_HOLD_MS - (performance.now() - hold.from);
    const timer = window.setTimeout(
      () => {
        const next = tickHold(hold, performance.now(), DEV_HOLD_MS);
        if (next === hold) return;
        put(next);
        onUnlock();
      },
      left > 0 ? left : 0,
    );
    return () => window.clearTimeout(timer);
    // `onUnlock` is a fresh closure each render and would restart the timer;
    // the hold itself is the only thing this should answer to.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hold]);

  const begin = (): void => {
    if (hold.from !== null) return;
    put({ from: performance.now(), armed: false });
  };
  // Letting go — including dragging the finger off the tile, which is how a
  // player who changed their mind about the hold says so. A hold that FIRED
  // stays armed across this: the click it is about to produce is the one it
  // has to swallow, and `press` below is where it is spent.
  const end = (): void => {
    const released = releaseHold(holdRef.current);
    put(released);
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
  return (
    <button
      type="button"
      class="menu-tile menu-tile-mode"
      data-menu="race"
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
      <Glyph name={glyph} />
      <span class="menu-tile-name">{label}</span>
    </button>
  );
}

function RootPage({
  settings,
  progress,
  onNavigate,
  onMode,
  onUnlock,
}: {
  settings: Settings;
  /** The board, for the one live figure on the door: how far up the ladder
   * the hero tile bills itself at. */
  progress: CampaignProgress;
  onNavigate: (page: MenuPage) => void;
  /** Which game the start card behind this door is setting up. Written on
   * the way through rather than read back here: the tiles are a CHOICE, not
   * a ladder showing where the stored setting stands. */
  onMode: (mode: GameMode) => void;
  onUnlock: () => void;
}) {
  const [said, setSaid] = useState(false);
  const standing = campaignStanding(progress);
  return (
    <div class="menu-card menu-card-root">
      {/* THE NAME, AND NOTHING UNDER IT. The billing that stood here named
          the coasts, which is a line that goes stale every time the game
          grows one — and the mark centres properly on a single row, rather
          than sitting visibly low against a block a tagline had dragged down
          a line. */}
      <div class="menu-brand">
        <div class="menu-brand-line">
          <MarkWave lay="once" className="menu-brand-mark" />
          <span class="menu-brand-name">{APP_NAME.toUpperCase()}</span>
        </div>
      </div>
      {/* THE WAYS ONTO THE WATER — the hero first, then the four modes. The
          two tiers are one grid rather than two blocks, so the hero spanning
          a row (upright) or a quadrant (sideways) is a span rather than a
          second layout to keep in step. */}
      <div class="menu-tiles">
        <button
          type="button"
          class="menu-tile menu-tile-hero"
          data-menu="campaign"
          data-nav-next
          data-nav-focus
          onClick={() => onNavigate({ page: "campaign" })}
        >
          {/* The sheen: a slow bar of light travelling the tile, the one
              moving thing on a card that stands over moving water. Purely
              a transform (see the stylesheet), and off under
              `prefers-reduced-motion`. */}
          <span class="menu-tile-sheen" aria-hidden="true" />
          <Glyph name="trophy" />
          <span class="menu-tile-words">
            <span class="menu-tile-name">{STRINGS.campaign}</span>
            <span class="menu-tile-line">
              {STRINGS.menuCampaignLine(standing.cleared, standing.of)}
            </span>
          </span>
        </button>
        <HoldTile
          glyph={MODE_GLYPHS.race}
          label={STRINGS.modeName("race")}
          unlocked={settings.developer}
          onStart={() => {
            onMode("race");
            onNavigate({ page: cardBefore("race") });
          }}
          onUnlock={() => {
            setSaid(true);
            onUnlock();
          }}
        />
        {/* RACE is the held one and is spelled out above; the other three
            are the same press with no secret behind it. */}
        {GAME_MODES.filter((mode) => mode !== "race").map((mode) => (
          <button
            key={mode}
            type="button"
            class="menu-tile menu-tile-mode"
            data-menu={mode}
            onClick={() => {
              onMode(mode);
              onNavigate({ page: cardBefore(mode) });
            }}
          >
            <Glyph name={MODE_GLYPHS[mode]} />
            <span class="menu-tile-name">{STRINGS.modeName(mode)}</span>
          </button>
        ))}
      </div>
      {/* EVERYTHING THAT IS NOT WATER, along the foot: a low strip of mark
          and word, sharing one row whatever the viewport. It is the tier
          that costs the door the least height, which is right — it is the
          tier nobody came here for. */}
      <div class="menu-strip">
        <button
          type="button"
          class="menu-chip"
          data-menu="gallery"
          onClick={() => onNavigate({ page: "gallery" })}
        >
          <Glyph name="camera" />
          <span class="menu-tile-name">{STRINGS.menuGallery}</span>
        </button>
        <button
          type="button"
          class="menu-chip"
          data-menu="options"
          onClick={() => onNavigate({ page: "options" })}
        >
          <Glyph name="sliders" />
          <span class="menu-tile-name">{STRINGS.menuOptions}</span>
        </button>
        {settings.developer && (
          <button
            type="button"
            class="menu-chip menu-chip-dev"
            data-menu="developer"
            onClick={() => onNavigate({ page: "developer" })}
          >
            <Glyph name="terminal" />
            <span class="menu-tile-name">{STRINGS.menuDeveloper}</span>
          </button>
        )}
        <VersionStamp />
      </div>
      {/* Said once, on the visit where the hold actually landed. The tile
          appearing is the lasting answer; this is the moment's one, so
          nobody has to wonder whether the seven seconds did anything. */}
      {said && <p class="menu-said">{STRINGS.menuUnlocked}</p>}
    </div>
  );
}

export type { MenuPage } from "./menu-page.ts";

export function MainMenu({
  page,
  settings,
  records,
  progress,
  onSettings,
  onNavigate,
  onStart,
  onCampaign,
  onBenchmark,
}: {
  page: MenuPage;
  settings: Settings;
  /** The record book, for the figure on each box of the level card. */
  records: RecordBook;
  /** The campaign's board (`campaign.ts`), for the ladder's boxes — and for
   * the level card, whose shores are open exactly where the ladder's are. */
  progress: CampaignProgress;
  onSettings: (settings: Settings) => void;
  onNavigate: (page: MenuPage) => void;
  onStart: () => void;
  /** Stand a CAMPAIGN level up, once the craft card has chosen the hull. */
  onCampaign: (level: CampaignLevel) => void;
  /** Hand the canvas to the benchmark and time a race on it — the developer
   * page's one press that is not a setting (`benchmark.ts`). */
  onBenchmark: () => void;
}) {
  return (
    <div class="menu">
      {page.page === "root" && (
        <RootPage
          settings={settings}
          progress={progress}
          onNavigate={onNavigate}
          onMode={(mode) => onSettings({ ...settings, ride: { ...settings.ride, mode } })}
          onUnlock={() => onSettings({ ...settings, developer: true })}
        />
      )}
      {page.page === "campaign" && (
        <CampaignPage
          progress={progress}
          onBack={() => onNavigate({ page: "root" })}
          onRide={(level) => onNavigate({ page: "craft", campaign: level.id })}
        />
      )}
      {page.page === "levels" && (
        <LevelsPage
          settings={settings}
          records={records}
          progress={progress}
          onSettings={onSettings}
          onBack={() => onNavigate({ page: "root" })}
          onNext={() => onNavigate({ page: "craft" })}
        />
      )}
      {page.page === "start" && (
        <StartPage
          settings={settings}
          onSettings={onSettings}
          onBack={() => onNavigate({ page: "root" })}
          onNext={() => onNavigate({ page: "craft" })}
        />
      )}
      {/* The second half of the same question, and the end of it: BACK is
          the card the rider came through — the ladder, the level card or
          the start card — and RIDE stands the run up from what the two of
          them agreed. */}
      {page.page === "craft" && (
        <CraftPage
          settings={settings}
          onSettings={onSettings}
          campaign={page.campaign !== undefined}
          backLabel={page.campaign === undefined ? undefined : STRINGS.campaign}
          onBack={() =>
            onNavigate(
              page.campaign === undefined
                ? { page: cardBefore(settings.ride.mode) }
                : { page: "campaign" },
            )
          }
          onRide={() => {
            const pinned = page.campaign === undefined ? null : findLevel(page.campaign);
            if (pinned) onCampaign(pinned.level);
            else onStart();
          }}
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
