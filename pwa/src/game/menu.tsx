// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE VOCABULARY EVERY MENU PAGE IS BUILT OUT OF: the head with its way
// back, and the four kinds of row a setting can be asked as.
//
// It is here rather than in each page for the reason the strings table
// exists: two surfaces wording the same question differently are two
// questions as far as the player is concerned. A camera picked on the
// options page and a camera picked on the developer page must be one row
// with one look, or the second one reads as a different setting.
//
// FOUR ROWS, AND WHICH ONE TO REACH FOR IS NOT A STYLE CHOICE:
//
//   OptionRow  — a choice whose answers have NAMES (chase or nose, one of
//                four craft). Chips, all of them on screen, so the answer
//                and its alternatives are read in one look.
//   SliderRow  — a choice whose answer is A BIT MORE THAN THAT (a wind, a
//                sea). A fader with the figure beside it, because chips at
//                five stops are five places a continuous value is allowed
//                to stand.
//   StepRow    — a choice with too many answers to draw and an ORDER to
//                them (a seed). An arrow either side of the figure.
//   ToggleRow  — on or off, with the cost of taking it written underneath.
//
// Every one of them is a real `<button>` or `<input>`, which is what makes
// `menu-nav.ts` able to walk a page written tomorrow with nothing to
// register: the cursor reads the layout that is on screen.

import type { ComponentChildren } from "preact";

export function MenuHead({
  back,
  backLabel,
  title,
  sub,
}: {
  back: () => void;
  backLabel: string;
  title: string;
  /** The page's one line of billing. Omitted on pages whose title says it
   * all — the head then holds the title alone, still on one row. */
  sub?: string;
}) {
  // A head carrying a subtitle is two rows tall and the way out stands level
  // with the TITLE, not floating between the two; a head that is only a
  // title is one row, and the button centres on it. The difference is marked
  // here rather than guessed at in the stylesheet, because it is a fact
  // about the content and there is exactly one place that knows it.
  return (
    <div class={`menu-head${sub === undefined ? " menu-head-solo" : ""}`}>
      {/* `data-nav-back` is what the cursor's way out presses — see
          menu-nav.ts. Marked rather than guessed at: every surface has a way
          out, and no two of them look alike in the markup. */}
      <button type="button" class="menu-back" data-nav-back onClick={back}>
        ‹ {backLabel}
      </button>
      <div class="menu-head-text">
        <div class="menu-title">{title}</div>
        {sub !== undefined && <div class="menu-sub">{sub}</div>}
      </div>
    </div>
  );
}

export function OptionRow<T extends string>({
  label,
  options,
  value,
  onPick,
}: {
  label: string;
  options: readonly { id: T; label: string }[];
  value: T;
  onPick: (id: T) => void;
}) {
  return (
    <div class="menu-row">
      <span class="menu-label">{label}</span>
      <div class="menu-opts">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            class={`menu-opt${opt.id === value ? " menu-opt-active" : ""}`}
            aria-pressed={opt.id === value}
            onClick={() => onPick(opt.id)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * A CONTINUOUS setting, drawn as the thing it is, with a way to mean NOTHING
 * AT ALL beside it.
 *
 * The readout is what a bare slider lacks: a figure to come back to. The
 * `auto` press is what a fader lacks entirely — a wind of zero and "the wind
 * this shore was generated with" are different answers, and a slider whose
 * bottom stop had to serve as both would make one of them unreachable.
 *
 * A controller reaches the fader too: `menu-nav.ts` walks range inputs and
 * steps them sideways.
 */
export function SliderRow({
  label,
  value,
  min,
  max,
  step,
  autoLabel,
  format,
  onChange,
}: {
  label: string;
  /** Null is the row's OWN idea of nothing — what `autoLabel` reads as. */
  value: number | null;
  min: number;
  max: number;
  step: number;
  /** What null means here, in words: AUTO on the developer page. */
  autoLabel: string;
  format: (value: number) => string;
  onChange: (value: number | null) => void;
}) {
  const auto = value === null;
  return (
    <div class="menu-row">
      <span class="menu-label">{label}</span>
      <div class="menu-slide">
        <input
          class="menu-slider"
          type="range"
          min={min}
          max={max}
          step={step}
          // A fader has to stand somewhere while the row reads AUTO, and the
          // bottom of its travel is the honest place: the first drag then
          // moves UP off it, rather than jumping from wherever a remembered
          // value happened to be.
          value={auto ? min : value}
          aria-label={label}
          onInput={(e) => onChange(Number((e.target as HTMLInputElement).value))}
        />
        <button
          type="button"
          class={`menu-slide-read${auto ? " menu-slide-auto" : ""}`}
          aria-pressed={auto}
          onClick={() => onChange(auto ? min : null)}
        >
          {auto ? autoLabel : format(value)}
        </button>
      </div>
    </div>
  );
}

/**
 * A value STEPPED IN PLACE — an arrow either side of the figure.
 *
 * For a choice with more answers than a row could ever draw and an order to
 * them, which in this game is the seed. `data-nav-steps` marks the pair as
 * ONE stop on the cursor's walk, so left and right over it are the previous
 * and the next value rather than a walk onto whatever is beside it.
 */
export function StepRow({
  label,
  read,
  onStep,
  onClear,
  clearLabel,
}: {
  label: string;
  read: string;
  onStep: (by: number) => void;
  /** The way back to nothing, where the row has one — the same idea as the
   * fader's AUTO press, and pressed the same way: on the readout itself. */
  onClear?: () => void;
  clearLabel?: string;
}) {
  return (
    <div class="menu-row">
      <span class="menu-label">{label}</span>
      <div class="menu-step" data-nav-steps>
        <button
          type="button"
          class="menu-step-arrow"
          data-nav-step="left"
          aria-label={`${label} down`}
          onClick={() => onStep(-1)}
        >
          ‹
        </button>
        {onClear ? (
          <button type="button" class="menu-step-read" aria-label={clearLabel} onClick={onClear}>
            {read}
          </button>
        ) : (
          <span class="menu-step-read">{read}</span>
        )}
        <button
          type="button"
          class="menu-step-arrow"
          data-nav-step="right"
          aria-label={`${label} up`}
          onClick={() => onStep(1)}
        >
          ›
        </button>
      </div>
    </div>
  );
}

/** A switch with its cost written under it. Shared by OPTIONS and the
 * developer page, which both ask the same question — on or off, and what
 * does that buy me. */
export function ToggleRow({
  label,
  hint,
  on,
  onToggle,
}: {
  label: string;
  hint: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      class={`opt-toggle${on ? " opt-toggle-on" : ""}`}
      onClick={onToggle}
      aria-pressed={on}
    >
      <span class="opt-toggle-text">
        <b>{label}</b>
        <span class="opt-toggle-hint">{hint}</span>
      </span>
      <span class="opt-switch" aria-hidden="true">
        <span class="opt-switch-knob" />
      </span>
    </button>
  );
}

/** A page's rows, under its head. Every page under the front door is this
 * shape; the scrolling is the CARD's, so a page too long for the screen
 * takes its head up with it rather than sitting a scrollbar's width out of
 * line with it (see `.menu-card` in styles.css). */
export function MenuBody({ children }: { children: ComponentChildren }) {
  return <div class="menu-body">{children}</div>;
}
