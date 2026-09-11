// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// OPTIONS ▸ KEYBOARD — every action the craft and the run can be given, and
// the key on each. One page behind one row rather than ten rows on the
// options card: a binding is the one setting a player goes looking for
// deliberately, and ten of them would be longer than everything else on
// that card put together.
//
// THE ROW IS THE PRESS. Pressing one arms a capture-phase listener on the
// window; the next key becomes the whole binding for that action and the
// capture ends. There is no confirm step and nothing to drag: the shortest
// path from "I want the brake on B" to the brake being on B is pressing the
// row and then pressing B.
//
// ESCAPE BACKS OUT WITHOUT CHANGING ANYTHING, which is the one key this
// page cannot bind — and deliberately: it is the way out of every surface
// in the game, and a page that could take it away is a page that could
// leave a rider holding a run they cannot pause. Every other key on the
// keyboard is offered, the arrows included.
//
// WHICH IS WHY THE CURSOR'S OWN KEYS ARE HANDED OVER while a row listens
// (`holdNav` in menu-nav.ts): App.tsx's menu listener sits in the capture
// phase and was registered before this card existed, so it would otherwise
// eat the arrows and Escape on their way here — and the arrows are the
// handlebar, which is exactly what somebody on this page is most likely to
// be rebinding.
//
// A KEY MAY SERVE TWO ACTIONS. Nothing stops a rider putting the brake and
// the reset under one finger, and the manager applies every action a code
// carries — but a key quietly doing two jobs is the one thing this page
// must not hide, so the row says ALSO ON and the caption says what it
// means.

import { useEffect, useState } from "preact/hooks";

import { MenuHead } from "./menu.tsx";
import { BindRow, Caption } from "./menu-knobs.tsx";
import { holdNav } from "./menu-nav.ts";
import { STRINGS } from "./strings.ts";
import type { Settings } from "./settings.ts";
import {
  KEY_ACTIONS,
  bindKey,
  boundLabel,
  clashesWith,
  freshKeys,
  type KeyAction,
} from "./settings-input.ts";

/** What each action is called, for the note on a row that shares its key. */
const LABELS = new Map(KEY_ACTIONS.map((entry) => [entry.id, entry.label]));

export function KeysPage({
  settings,
  onSettings,
  onBack,
}: {
  settings: Settings;
  onSettings: (settings: Settings) => void;
  onBack: () => void;
}) {
  const [listening, setListening] = useState<KeyAction | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    if (!listening) return;
    holdNav(true);
    const onKey = (e: KeyboardEvent): void => {
      // Capture phase, and the propagation stops here: the input manager
      // listens on this same window and would otherwise ride the craft
      // behind the card with the very key being bound.
      e.preventDefault();
      e.stopPropagation();
      setListening(null);
      if (e.code === "Escape") return;
      onSettings({ ...settings, keys: bindKey(settings.keys, listening, e.code) });
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      holdNav(false);
    };
  }, [listening, settings, onSettings]);

  return (
    <div class="menu-card menu-card-keys" onPointerLeave={() => setHint(null)}>
      <MenuHead back={onBack} backLabel={STRINGS.menuOptions} title={STRINGS.keysTitle} />
      {/* Two abreast where the card is wide enough, one column on a phone:
          an action and a key are a row with a rem to spare, and ten of them
          in one column would be a page that scrolls on a laptop. */}
      <div class="knob-binds">
        {KEY_ACTIONS.map((entry) => {
          const clash = clashesWith(settings.keys, entry.id);
          const others = clash.map((id) => LABELS.get(id) ?? id).join(", ");
          return (
            <BindRow
              key={entry.id}
              label={entry.label}
              bound={boundLabel(settings.keys[entry.id])}
              listening={listening === entry.id}
              clash={clash.length > 0 ? `${STRINGS.keysClash} ${others}` : null}
              hint={
                clash.length > 0
                  ? STRINGS.keysClashHint(entry.label, others)
                  : STRINGS.keysRowHint(entry.label)
              }
              // A second press on a row that is already listening is how a
              // player who changed their mind says so, with no key bound.
              onListen={() => setListening(listening === entry.id ? null : entry.id)}
              onHint={setHint}
            />
          );
        })}
      </div>
      <Caption text={hint} fallback={STRINGS.keysCaption} />
      {/* The page's own restore, not the card's: a rider who has made a mess
          of the keys wants the keys back, and having to walk out to OPTIONS
          and throw away their picture to get them would be the page charging
          for the mistake. */}
      <button
        type="button"
        class="opt-reset"
        onClick={() => onSettings({ ...settings, keys: freshKeys() })}
      >
        {STRINGS.keysRestore}
      </button>
    </div>
  );
}
