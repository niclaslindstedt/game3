// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CRAFT CARD — which hull, on a screen of its own, and the last thing
// between the rider and the water.
//
// A ROW OF NAMES CANNOT ASK THIS QUESTION. A shore is a seed with a chart
// drawn under it and an hour is a word that means an hour; a craft is a
// SHAPE, and "SKIFF / MARLIN / OTTER / DART" asks a rider to choose between
// four hulls they have never seen by picking one of four words. So it takes
// a card, the way the sibling rally game's pre-race card gives the car one:
// the craft turning on the water it will ride, at the draft it actually
// floats at, with the numbers beside it.
//
// IT IS THE SECOND CARD, AND RIDE IS ON IT. The start card asks where and
// when; this one asks what with, and then goes. That order is the one thing
// this card's position is for: the last picture a rider sees before the
// loading card is the hull they are about to be sitting on.
//
// TWO THINGS ARE ON IT, and the layout says so: THE CRAFT, which is the
// decision, and FOUR SHORT READINGS beside it — two figures and four bars
// (craft-stats.ts). Everything else the start card already asked. Nothing
// here carries a footnote of its own: a sentence under every control is
// height on a phone, and height on a phone is the craft getting smaller,
// so the card's ONE line of prose is the craft's own billing, standing in
// the picture under it.
//
// The card is built the way OPTIONS is — the way back and the title on one
// head row, the content under it in a column, or two on a screen wide
// enough — and it WRITES `settings.ride.craft`. A run stood up from here and
// a run stood up from a `?craft=` link are the same run read the same way.

import { useEffect, useRef, useState } from "preact/hooks";
import { craftById, type CraftId } from "@engine";

import { COUNT_SECONDS, countAt } from "../lib/count.ts";
import { CraftPicker } from "./craft-picker.tsx";
import { craftBars, craftFacts, type CraftFact } from "./craft-stats.ts";
import { MenuHead } from "./menu.tsx";
import type { Settings } from "./settings.ts";
import { STRINGS } from "./strings.ts";

/** ONE FIGURE, WHICH COUNTS. A number that swaps between two frames is a
 * number the rider has to notice changed; one that rolls to its new value
 * is one they watch change — and that is the whole difference between the
 * arrows reading as a way to see four hulls and reading as a choice with a
 * consequence. Rowing through the roster winds the top speed up and down
 * rather than cutting between four unrelated numbers.
 *
 * It is its own component so the frames it asks for repaint a number and
 * not the card: a rerender of the page walks the whole picker, and this one
 * runs sixty times in the half-second after every press.
 *
 * The maths is `lib/count.ts`; the clock is here, because the clock is the
 * only part of it that needs a browser. */
function Figure({ fact }: { fact: CraftFact }) {
  // The value on screen, and the run currently carrying it somewhere. Refs,
  // because the frame loop owns them — `tick` exists only to ask for the
  // repaint, and reading state inside the loop would read the value the
  // effect closed over rather than the one being drawn.
  const shown = useRef(fact.value);
  const [, tick] = useState(0);
  useEffect(() => {
    const from = shown.current;
    if (from === fact.value) return;
    const start = performance.now();
    let raf = 0;
    const frame = (now: number): void => {
      const at = (now - start) / 1000;
      shown.current = countAt(from, fact.value, at);
      tick((n) => n + 1);
      if (at < COUNT_SECONDS) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [fact.value]);
  return (
    <div class="craft-figure">
      <span class="craft-figure-label">{fact.label}</span>
      <span class="craft-figure-value">
        {shown.current.toFixed(fact.places)}
        <span class="craft-figure-unit">{fact.unit}</span>
      </span>
    </div>
  );
}

/** The readings, beside the craft: two FIGURES saying what this hull IS,
 * and four BARS saying what it is against the other three.
 *
 * The bars compare with the rest of the roster (craft-stats.ts) rather than
 * with zero, because four craft within a few percent of each other on an
 * absolute scale are four identical full bars, which is a picture of
 * nothing. */
function CraftReadings({ craft }: { craft: CraftId }) {
  const spec = craftById(craft);
  return (
    <div class="craft-spec">
      <div class="craft-figures">
        {craftFacts(spec).map((fact) => (
          <Figure key={fact.key} fact={fact} />
        ))}
      </div>
      <div class="craft-bars">
        {craftBars(spec).map((bar) => (
          <div key={bar.key} class="craft-bar">
            <span class="craft-bar-label">{bar.label}</span>
            <span class="craft-bar-track">
              <span class="craft-bar-fill" style={{ width: `${(bar.value * 100).toFixed(1)}%` }} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CraftPage({
  settings,
  onSettings,
  onBack,
  onRide,
}: {
  settings: Settings;
  onSettings: (settings: Settings) => void;
  /** Back to the start card, which is the way in. */
  onBack: () => void;
  /** The press that stands the run up — this card is the end of the flow. */
  onRide: () => void;
}) {
  const craft = settings.ride.craft;
  const spec = craftById(craft);
  return (
    <div class="menu-card menu-card-craft">
      <MenuHead back={onBack} backLabel={STRINGS.startTitle} title={STRINGS.craftTitle} />
      <div class="craft-pick-body">
        {/* THE CRAFT takes the room. It is the only thing on this card that
            cannot be said in words, and the one the whole screen exists to
            choose — so it is the column that grows when there is more
            screen, and the readings beside it stay the size they need to be
            read at. */}
        <div class="craft-stage-col">
          <CraftPicker
            craft={craft}
            cursor
            onPick={(pick) => onSettings({ ...settings, ride: { ...settings.ride, craft: pick } })}
          />
          {/* The card's ONE sentence, standing in the picture under the
              craft the way the name stands over it — the catalog's own
              blurb, which is what the card would say if it could only say
              one thing. Inside the frame rather than under it because a
              line of prose on a row of its own is a row of the card's
              height, and the water below a floating hull is space the shot
              is not using. */}
          <p class="craft-blurb">{spec.blurb}</p>
        </div>
        <CraftReadings craft={craft} />
      </div>
      {/* The press that rides, wearing the front door's own START weight and
          marked as this surface's `next` — so a controller that walked in
          here gets on the water without hunting for it. */}
      <button
        type="button"
        class="menu-item menu-item-start craft-done"
        data-menu="ride"
        data-nav-next
        onClick={onRide}
      >
        <span class="menu-item-name">{STRINGS.startGo}</span>
      </button>
    </div>
  );
}
