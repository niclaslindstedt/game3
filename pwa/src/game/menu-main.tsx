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
//                its own saying how far up the ladder the player has got
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
//   DEVELOPER  → hidden until the craft card's turntable has been HELD for
//                seven seconds (menu-hold.ts, `DEV_HOLD_MS`), and out for
//                good once found. Nothing on THIS card opens it; the chip
//                simply appears here once it has been.
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
// NO TILE ON THIS CARD IS HELD. The hold that lets the developer menu out
// used to sit on RACE, which meant a tile whose ordinary job is to start a
// run had to decide whether a lifted finger was a press — and it fired
// silently, on a card with nothing on it that could answer. It is on the
// CRAFT CARD's turntable now (craft-picker.tsx): a picture a press does
// nothing to, which can therefore say YES by whipping the hull round twice.
// All that is left here is the chip appearing in the foot strip.
//
// WHICH page is up is a plain tagged union, and it lives next door
// (`menu-page.ts`) so the URL reader can name one without reaching a `.tsx`;
// this file re-exports it, so `MenuPage` still has one spelling.

import { GAME_MODES, type GameMode } from "@engine";

import { APP_NAME, REPO_URL } from "../identity.ts";
import { MarkWave } from "./mark-wave.tsx";
import type { Settings } from "./settings.ts";
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
import { UnlocksPage } from "./menu-unlocks.tsx";
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

function RootPage({
  settings,
  progress,
  onNavigate,
  onMode,
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
}) {
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
        {GAME_MODES.map((mode) => (
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
  onProgress,
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
  /** Set the board outright — the UNLOCKS page's press, and the only place
   * anything but a finished run writes it (`menu-unlocks.tsx`). */
  onProgress: (progress: CampaignProgress) => void;
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
          progress={progress}
          onSettings={onSettings}
          onBack={() => onNavigate({ page: "root" })}
          onUnlocks={() => onNavigate({ page: "unlocks" })}
          onBenchmark={onBenchmark}
          onBenchmarkHistory={() => onNavigate({ page: "benchHistory" })}
        />
      )}
      {page.page === "unlocks" && (
        <UnlocksPage
          progress={progress}
          onProgress={onProgress}
          onBack={() => onNavigate({ page: "developer" })}
        />
      )}
      {page.page === "benchHistory" && (
        <BenchmarkHistoryPage onBack={() => onNavigate({ page: "developer" })} />
      )}
    </div>
  );
}
