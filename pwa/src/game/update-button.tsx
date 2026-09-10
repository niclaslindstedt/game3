// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE NEW-BUILD BUTTON: the only thing the app says on its own initiative,
// and it says it as quietly as a thing can and still be there.
//
// A BUTTON, NOT A CARD. An update that arrives is never urgent — the build
// in the tab keeps riding, and the new one installs whenever the player
// feels like it — so it gets a mark in the top bar and nothing else: no
// heading, no version line, no plate lying across the water. Being this
// small is also why there is no way to dismiss it: ignoring it costs less
// than the press that would have hidden it.
//
// WHY THE TOP BAR, when the sibling game puts the same mark in a bottom
// corner: on this screen neither bottom corner is free. The left is the
// instrument panel with the build stamp under it, and the right is the air
// time and the news column — and on a phone the lower three fifths is the
// two thumb zones, the throttle lever's being exactly the right-hand one.
// The top-right cluster is above both zones and already holds a button
// (RESET), so the mark stands at the end of that row. In portrait this mark
// hangs UNDER the cluster, which is the part that has to clear the lever
// zone — styles.css argues that clearance where it sets the zone's top.
//
// TWO PRESSES, because the press throws the run away: the page reloads onto
// the new build and the ride in progress goes with it, and this mark stands
// one gap from the RESET button. The first press arms it and the mark
// becomes the word; the second reloads. It disarms itself after a few
// seconds, so a mis-tap decays back to a corner mark rather than sitting
// there loaded. The word is RELOAD rather than RESTART because Enter
// already restarts the RUN, and one screen may not spell two things alike.
//
// The state it renders comes from `lib/pwa-update.ts`; only the look, the
// arming and the words are ours.

import { useEffect, useMemo, useState } from "preact/hooks";

import { cacheIdForBase } from "../app-pwa.ts";
import { usePwaUpdate } from "../lib/pwa-update.ts";
import { shellHost } from "../shell-host.ts";
import { STRINGS } from "./strings.ts";

/** How long an armed button waits for its second press before going quiet, ms. */
const ARM_MS = 4000;

/** ?update=1 (tooling): show the new-build button as if a worker were
 * waiting. A real one only appears after a deploy has actually landed on a
 * device that already had the app, which is not a state a screenshot pass
 * can reach — and an interface nobody can look at is an interface nobody
 * maintains. The second press still reloads the page, so the escape hatch
 * is honest. */
function updateForced(): boolean {
  return new URLSearchParams(location.search).get("update") === "1";
}

/** The mark: an arrow coming down onto a line — a build arriving, which is
 * what has happened. Deliberately not a circular arrow: the HUD's RESET is
 * the other thing in this row, and a reset and a reload must not read as
 * two spellings of the same press. */
function UpdateGlyph() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" class="update-nudge-mark">
      <path d="M 50 11 V 49" />
      <polygon points="26,43 74,43 50,77" />
      <path d="M 24 89 H 76" />
    </svg>
  );
}

export function UpdateButton() {
  // Off in dev, and off inside a shell: there the bundle on disk IS the
  // build, so a worker precaching it could only ever prompt about itself.
  const pwa = usePwaUpdate({
    base: import.meta.env.BASE_URL,
    cacheId: cacheIdForBase(import.meta.env.BASE_URL),
    enabled: !import.meta.env.DEV && shellHost() === null,
  });
  const forced = useMemo(updateForced, []);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), ARM_MS);
    return () => clearTimeout(timer);
  }, [armed]);

  if (!pwa.needRefresh && !forced) return null;

  // The whole message, spent on the one thing a corner mark cannot show:
  // WHICH build is waiting. It is a tooltip on a pointer and the label a
  // screen reader reads; on a phone the mark alone is the message.
  const version = pwa.incomingVersion ?? (forced ? __APP_VERSION__ : null);
  const label = armed ? STRINGS.updateArmed : STRINGS.updateReady(version);

  return (
    <button
      type="button"
      class="update-nudge"
      data-armed={armed ? "" : undefined}
      title={label}
      aria-label={label}
      onClick={() => {
        if (!armed) {
          setArmed(true);
          return;
        }
        // A waiting worker is handed the page, which reloads it onto the new
        // build; forced, there is no worker to hand it to and a plain reload
        // is what the button promised.
        if (pwa.needRefresh) pwa.reload();
        else location.reload();
      }}
    >
      <UpdateGlyph />
      <span class="update-nudge-word" aria-hidden="true">
        {STRINGS.updateWord}
      </span>
    </button>
  );
}
