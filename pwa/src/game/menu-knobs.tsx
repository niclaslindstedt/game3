// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE KNOBS EVERY SETTINGS SURFACE IS BUILT FROM — the options page, the
// start card, the developer page and the pause card's strip alike — as ONE
// silhouette: the setting's name on the left, its value on the right between
// two arrows, and under the value a row of pips saying where on its ladder
// the value stands.
//
// One shape for every setting is the whole reason a player can read a page of
// them WITHOUT reading it: every row answers to the same two presses, sideways
// moves the value, and nothing has to be explained twice. A switch is a
// two-stop ladder, a wind is a ladder drawn as a track, and a seed is a ladder
// too long to draw — so even those are the same row.
//
// THE ROWS CARRY NO SENTENCE OF THEIR OWN. A row that explains itself is
// HEIGHT, and a page of them is a page that scrolls on a phone; the
// explanation goes to ONE caption bar the page owns ({@link Caption}), which
// reads whichever row the pointer or the cursor is on. That is what let the
// options page fold from a column of switches-with-prose into two columns of
// rows that fit a 720-tall window with room over.
//
// Every one of them is a real `<button>` or `<input>`, which is what makes
// `menu-nav.ts` able to walk a page written tomorrow with nothing to register:
// `data-nav-steps` marks the pair of arrows as ONE stop on the cursor's walk,
// and sideways over the row presses them.
//
// The head and the body a page is hung on are still `menu.tsx`'s.

import type { ComponentChildren } from "preact";
import { useRef, useState } from "preact/hooks";

import { STRINGS } from "./strings.ts";

/** One place a ladder can stand, and the sentence that says what standing
 * there buys. A stop with no line of its own says the row's. */
export type Stop<T extends string> = { id: T; label: string; hint?: string };

/** Where a row sends its description when it is looked at. A page with a
 * caption bar passes its setter; the pause card's strip passes nothing. */
export type OnHint = (hint: string | null) => void;

/** The longest ladder still drawn as pips under its value. The five skies fit;
 * the developer page's sixteen scenes do not, and the label carries those on
 * its own. */
const PIPS_AT_MOST = 14;

/** The two stops of a switch, which is the commonest ladder on any of these
 * pages. Stated once so ON and OFF are the same two words everywhere. */
export const ON_OFF: Stop<"off" | "on">[] = [
  { id: "off", label: STRINGS.optOff },
  { id: "on", label: STRINGS.optOn },
];

/** A boolean as a stop id, for a row that asks a switch as a two-stop ladder. */
export const onOff = (on: boolean): "off" | "on" => (on ? "on" : "off");

/** The name a row leads with. In a box of its own so it can be TRUNCATED
 * rather than run under the arrows: a row is sized by its value and its two
 * targets, and the name is the only part of it that may give. */
function KnobLabel({ label }: { label: string }) {
  return (
    <span class="knob-label">
      <span class="knob-name">{label}</span>
    </span>
  );
}

/**
 * A setting with NAMED answers — a camera, a sky, on or off.
 *
 * The arrows WRAP: the camera key wraps the same ladder, and on a pad an arrow
 * that does nothing at the end of a row reads as a row that has stopped
 * working.
 *
 * `dealt` is the start card's mark: the answer the SHORE came with, so a row
 * that defers to the level can say WHICH answer that is rather than offering a
 * stop meaning "whichever of these it turns out to be". The pip under it wears
 * a ring and the value beside it a dot; what a press on the marked stop STORES
 * is the caller's business (on the start card it is null — see menu-start.tsx).
 */
export function StepRow<T extends string>({
  label,
  stops,
  value,
  dealt = null,
  pending = false,
  hint,
  onPick,
  onHint,
}: {
  label: string;
  stops: readonly Stop<T>[];
  /** The answer in force — null while there is none, which on the start card
   * is the moment before the seed's own day has been read. */
  value: T | null;
  /** The answer the shore comes with, marked. Null on every row nothing
   * deals: OPTIONS, the developer page, the pause strip. */
  dealt?: T | null;
  /** The mark belongs to a seed, and the seed on screen may have moved on:
   * true dims the row rather than asserting a deal still being worked out. */
  pending?: boolean;
  /** The row's own sentence, for stops that have none. */
  hint?: string;
  onPick: (id: T) => void;
  onHint?: OnHint;
}) {
  const at = stops.findIndex((stop) => stop.id === value);
  const current = at < 0 ? null : stops[at];
  const describe = (): void => onHint?.(current?.hint ?? hint ?? null);
  const step = (dir: 1 | -1): void => {
    // Off the ladder entirely — the row has no answer yet — the first press
    // lands on an END of it rather than on whatever index arithmetic on −1
    // happens to produce.
    const to = at < 0 ? (dir > 0 ? 0 : stops.length - 1) : (at + dir + stops.length) % stops.length;
    onPick(stops[to].id);
    onHint?.(stops[to].hint ?? hint ?? null);
  };
  return (
    <div
      class={`knob${pending ? " knob-waiting" : ""}`}
      data-nav-steps
      onPointerEnter={describe}
      onFocusCapture={describe}
    >
      <KnobLabel label={label} />
      <div class="knob-ctl">
        <button
          type="button"
          class="knob-arrow"
          data-nav-step="left"
          aria-label={`${label}: ${STRINGS.optPrev}`}
          onClick={() => step(-1)}
        >
          ‹
        </button>
        <span class="knob-value">
          <span class="knob-word">
            {current?.label ?? STRINGS.optUnset}
            {current !== null && current.id === dealt && (
              // The mark's meaning in words, for the pointer that hovers it
              // and the reader that cannot see the dot.
              <span class="knob-mark" title={STRINGS.startDealt} />
            )}
          </span>
          {/* The pips say where on a SHORT ladder the value stands. A list of
              sixteen scenes is not a ladder anyone reads by counting dots,
              and sixteen of them are wider than the value they sit under. */}
          {stops.length <= PIPS_AT_MOST && (
            <span class="knob-pips" aria-hidden="true">
              {stops.map((stop, i) => (
                <i
                  key={stop.id}
                  class={`knob-pip${i === at ? " knob-pip-on" : ""}${
                    stop.id === dealt ? " knob-pip-dealt" : ""
                  }`}
                />
              ))}
            </span>
          )}
        </span>
        <button
          type="button"
          class="knob-arrow"
          data-nav-step="right"
          aria-label={`${label}: ${STRINGS.optNext}`}
          onClick={() => step(1)}
        >
          ›
        </button>
      </div>
    </div>
  );
}

/**
 * A CONTINUOUS setting — a wind, a sea — drawn as the thing it is: a track
 * with the level filled along it and its reading beside it. The arrows step it
 * one notch, which is what a pad presses; the track itself is a real range
 * input, so a press anywhere along it puts the thumb where the finger landed
 * and carries straight on into the drag — `.knob-range` gives it the BAND to
 * be pressed on, which a bare 8 px line is not.
 *
 * The readout doubles as the way back to meaning NOTHING AT ALL: a wind of
 * zero and "the wind this shore was generated with" are different answers, and
 * a fader whose bottom stop had to serve as both would make one of them
 * unreachable.
 */
export function FadeRow({
  label,
  value,
  min,
  max,
  step,
  autoLabel,
  read,
  hint,
  onChange,
  onHint,
}: {
  label: string;
  /** Where the thumb stands — null is the row's own idea of nothing, which is
   * what `autoLabel` reads as. */
  value: number | null;
  min: number;
  max: number;
  /** The travel's grid, and what one press of an arrow moves. */
  step: number;
  autoLabel: string;
  read: (value: number) => string;
  hint?: string;
  onChange: (value: number | null) => void;
  onHint?: OnHint;
}) {
  const auto = value === null;
  // A fader has to stand somewhere while the row reads AUTO, and the bottom of
  // its travel is the honest place: the first press then moves UP off it,
  // rather than jumping from wherever a remembered value happened to be.
  const shown = auto ? min : value;
  const describe = (): void => onHint?.(hint ?? null);
  const clamp = (next: number): number => Math.min(max, Math.max(min, next));
  const fill = max > min ? (shown - min) / (max - min) : 0;
  return (
    <div class="knob" data-nav-steps onPointerEnter={describe} onFocusCapture={describe}>
      <KnobLabel label={label} />
      <div class="knob-ctl">
        <button
          type="button"
          class="knob-arrow"
          data-nav-step="left"
          aria-label={`${label}: ${STRINGS.optLess}`}
          onClick={() => onChange(clamp(shown - step))}
        >
          ‹
        </button>
        <span class="knob-value knob-fade">
          <input
            class="knob-range"
            type="range"
            min={min}
            max={max}
            step={step}
            value={shown}
            aria-label={label}
            style={`--fill: ${Math.round(fill * 100)}%`}
            onInput={(e) => onChange(clamp(Number((e.target as HTMLInputElement).value)))}
          />
          <button
            type="button"
            class={`knob-word knob-read${auto ? " knob-read-auto" : ""}`}
            aria-pressed={auto}
            aria-label={`${label}: ${autoLabel}`}
            onClick={() => onChange(auto ? min : null)}
          >
            {auto ? autoLabel : read(shown)}
          </button>
        </span>
        <button
          type="button"
          class="knob-arrow"
          data-nav-step="right"
          aria-label={`${label}: ${STRINGS.optMore}`}
          onClick={() => onChange(clamp(shown + step))}
        >
          ›
        </button>
      </div>
    </div>
  );
}

/**
 * A setting that is A NUMBER and nothing else — the seed. Same silhouette as
 * every other row, so the shore reads as one more setting rather than as a
 * form dropped into the middle of one, and it answers to both things a person
 * wants to do with a seed: the ARROWS walk it, one at a time, which is how you
 * look at the coast next door; and the FIELD is TYPED into, because a seed is
 * passed between people and stepping to 481,205 one press at a time is not a
 * control.
 *
 * The field keeps a DRAFT while it is being typed into and commits on blur or
 * on Enter. Rewriting the seed on every keystroke would build a whole level
 * for "4", "42" and "421" on the way to 4218 — three coasts nobody asked for,
 * each of them a search — and would fight the caret while it did it.
 */
export function NumberRow({
  label,
  value,
  min,
  max,
  hint,
  onValue,
  onHint,
}: {
  label: string;
  value: number;
  /** The travel, inclusive. The arrows stop at either end and a typed number
   * is clamped into it — a seed ladder has no top worth wrapping round to. */
  min: number;
  max: number;
  hint?: string;
  onValue: (value: number) => void;
  onHint?: OnHint;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  // Two ways out of one edit can both fire before the row renders again, so
  // the draft is read from a ref in the handlers: a stale one in the second of
  // them would commit the same number twice and rebuild the chart for it.
  const draftRef = useRef<string | null>(null);
  const describe = (): void => onHint?.(hint ?? null);
  const clamp = (next: number): number => Math.min(max, Math.max(min, next));
  const step = (dir: 1 | -1): void => {
    setDraft(null);
    draftRef.current = null;
    onValue(clamp(value + dir));
    describe();
  };
  const commit = (text: string): void => {
    setDraft(null);
    draftRef.current = null;
    const digits = text.replace(/[^0-9]/g, "");
    // An emptied field is a CANCEL, not a zero: somebody clearing it to type a
    // new seed and then thinking better of it gets their coast back rather
    // than seed 1.
    if (digits === "") return;
    const next = clamp(Number(digits));
    if (next !== value) onValue(next);
  };
  return (
    <div class="knob" data-nav-steps onPointerEnter={describe} onFocusCapture={describe}>
      <KnobLabel label={label} />
      <div class="knob-ctl">
        <button
          type="button"
          class="knob-arrow"
          data-nav-step="left"
          aria-label={`${label}: ${STRINGS.optPrev}`}
          onClick={() => step(-1)}
        >
          ‹
        </button>
        <span class="knob-value">
          <input
            class="knob-word knob-field"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            spellcheck={false}
            aria-label={label}
            value={draft ?? String(value)}
            onInput={(e) => {
              const text = (e.target as HTMLInputElement).value;
              draftRef.current = text;
              setDraft(text);
            }}
            onBlur={(e) => commit((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              // The way OUT of a field is the way out of everything else on
              // the card, so Escape hands the keyboard back to the menu rather
              // than walking off the page mid-number.
              if (e.key === "Escape") {
                setDraft(null);
                draftRef.current = null;
                (e.target as HTMLInputElement).blur();
                e.stopPropagation();
              }
            }}
          />
        </span>
        <button
          type="button"
          class="knob-arrow"
          data-nav-step="right"
          aria-label={`${label}: ${STRINGS.optNext}`}
          onClick={() => step(1)}
        >
          ›
        </button>
      </div>
    </div>
  );
}

/** A handful of rows under one word. */
export function KnobGroup({ title, children }: { title: string; children: ComponentChildren }) {
  return (
    <section class="knob-group">
      <h3 class="knob-group-title">{title}</h3>
      <div class="knob-rows">{children}</div>
    </section>
  );
}

/** The page's ONE sentence — whichever row is being looked at, or the page's
 * own line while none is. Always rendered, even empty, so the card does not
 * change height as the pointer crosses it. */
export function Caption({ text, fallback }: { text: string | null; fallback: string }) {
  return (
    <div class={`knob-caption${text ? " knob-caption-on" : ""}`} aria-live="polite">
      {text ?? fallback}
    </div>
  );
}
