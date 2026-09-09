// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ATTRACT SCREEN the app opens on, played like an arcade cabinet's.
//
// Beat one, while the game loads: the publisher's name and PRESENTS, drawn in
// the menu's own type over the same water the game is painted in, so the card
// lifting reads as the menu arriving rather than as a screen change.
//
// Beat two, the moment the game is standing: the app's own wave draws itself,
// SEA HAVEN fades in under it, and the card asks for a press. Then it waits.
// Nothing lifts it on a timer — see `splash.ts` for why the press is worth
// waiting for.
//
// It is a COVER, not a stage. The whole app mounts underneath it and does its
// entire arrival behind it — the renderer, the generator, a whole shore and
// the water beside it, and the bot getting up to speed on it. That is what
// beat one is buying.
//
// Presses are swallowed for exactly that reason: the menu is LIVE under
// there, and a press meant for the card must never reach the row the finger
// happens to land on.
//
// The timing rules it obeys live in `splash.ts` and are tested there.

import { useCallback, useEffect, useRef, useState } from "preact/hooks";

import { APP_NAME, PUBLISHER } from "../identity.ts";
import { MarkWave } from "./mark-wave.tsx";
import { SPLASH_MIN_MS, SPLASH_STUCK_MS, splashReady } from "./splash.ts";
import { STRINGS } from "./strings.ts";

/** How long the card takes to fade out of the way. Must match the
 * `.splash.leaving` transition in styles.css. */
const FADE_MS = 340;

/** Keys that are not "a key" to a player holding one down to reach another. */
const MODIFIER_KEYS = new Set(["Shift", "Control", "Alt", "Meta", "OS"]);

/** Where the card is in its life: `loading` is beat one, `ready` is beat two
 * with the title up and the prompt blinking, `done` is it leaving. */
type CardPhase = "loading" | "ready" | "done";

/** What the card asks for, in the words of the device it is being read on. A
 * phone has no key to press, and telling it to press one is the kind of
 * detail that makes a game feel ported rather than made. */
function startPrompt(): string {
  return window.matchMedia?.("(pointer: coarse)").matches ? STRINGS.splashTap : STRINGS.splashPress;
}

export function SplashScreen({ warm, onDone }: { warm: boolean; onDone: () => void }) {
  const [phase, setPhase] = useState<CardPhase>("loading");
  const [prompt] = useState(startPrompt);

  // The card's own age, stamped on mount. A ref rather than state: nothing
  // re-renders on it, and it has to survive the re-render `warm` causes.
  const startedAt = useRef(0);
  useEffect(() => {
    startedAt.current = performance.now();
  }, []);

  // `onDone` is a fresh closure every parent render; hold it in a ref so the
  // fade-out timer is armed once instead of restarted on each one.
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  // BEAT ONE → BEAT TWO. Readiness answers to the clock AND to the load, so
  // this re-checks on each `warm` change and at each of the two moments the
  // clock alone could change the answer: the minimum, and the dead man's
  // handle that opens the card up on a boot that never reported in.
  useEffect(() => {
    if (phase !== "loading") return;
    let timer = 0;
    const check = (): void => {
      const elapsed = performance.now() - startedAt.current;
      if (splashReady(elapsed, warm)) {
        setPhase("ready");
        return;
      }
      const next = elapsed < SPLASH_MIN_MS ? SPLASH_MIN_MS : SPLASH_STUCK_MS;
      timer = window.setTimeout(check, Math.max(0, next - elapsed));
    };
    check();
    return () => window.clearTimeout(timer);
  }, [phase, warm]);

  // Cleared: fade, then let the parent unmount us.
  useEffect(() => {
    if (phase !== "done") return;
    const timer = window.setTimeout(() => doneRef.current(), FADE_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  // MAY THIS PRESS CLEAR THE CARD — asked of the CLOCK, never of `phase`.
  // The two agree only on an idle main thread, and the card exists for the
  // launch where the main thread is anything but: a whole shore's geometry is
  // being built. Both the timer that promotes `loading` → `ready` and the
  // press itself are macrotasks queued behind that work, so they arrive
  // together when it lets go — and a `dismiss` closing over `phase` would
  // read the render BEFORE the timer's state update landed and drop the press
  // on the floor, on exactly the device the card was added for. `startedAt`
  // is a ref and `performance.now()` owes nothing to the renderer.
  const dismiss = useCallback(() => {
    if (!splashReady(performance.now() - startedAt.current, warm)) return;
    setPhase("done");
  }, [warm]);

  // EVERY KEY IS EATEN WHILE THE CARD IS UP, on `window` in the CAPTURE phase
  // because that is the only place upstream of the input manager the live
  // game underneath has already installed. Without it, the key that clears
  // the card also rides the craft behind it.
  //
  // It keeps eating them through the fade-out too, so a second impatient
  // press cannot land on the menu coming up underneath.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      event.stopPropagation();
      if (MODIFIER_KEYS.has(event.key)) return;
      // A browser shortcut on its way past (reload, devtools, tab switch) is
      // not a press on the card.
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      event.preventDefault();
      dismiss();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [dismiss]);

  const revealed = phase !== "loading";
  return (
    <div
      class={`splash${phase === "done" ? " leaving" : ""}`}
      // A pointer press lands here rather than on the menu: the card covers
      // the screen, so nothing has to be swallowed for it.
      onPointerDown={dismiss}
      // ...and a CLICK, which is the only press a controller can synthesise
      // (menu-nav.ts). `dismiss` is idempotent, so a real pointer arriving as
      // both costs nothing.
      onClick={dismiss}
      role="presentation"
    >
      <div class="splash-card">
        <span class="splash-publisher">{PUBLISHER.toUpperCase()}</span>
        <span class="splash-presents">{STRINGS.splashPresents}</span>
      </div>
      {/* Beat two, mounted when it arrives rather than held invisible above
          the fold. Reserving its space would keep the house's name still, and
          buy that with a hole in the middle of beat one — where the whole
          screen is the house's name and the word LOADING adrift at the bottom
          of it. The card lifting the publisher to make room for its own title
          is what an attract screen does. */}
      {revealed && (
        <div class="splash-title">
          <MarkWave lay="once" className="splash-mark" />
          <span class="splash-game">{APP_NAME.toUpperCase()}</span>
        </div>
      )}
      <span class={`splash-prompt${revealed ? " ready" : ""}`}>
        {revealed ? prompt : STRINGS.loading}
      </span>
    </div>
  );
}
