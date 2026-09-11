// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SEED'S PICTURE — the coast a number makes, drawn under the row that
// picks it.
//
// A seed is an opaque integer, and a row that offers one without showing
// what it means is not a choice at all: it is a lottery with arrows on it.
// So the whole course goes under the row — the shore, the shallows, the
// skerries, the line through the gates — cut from the REAL generated level
// by the same code that cuts the minimap, so the picture and the water are
// never two different opinions about one seed.
//
// THE CARD READS THE SAME ANSWER TWICE. What comes back is a chart AND the
// day the seed deals (`SeedDeal`) — which hour, which wind, which sky — so
// the rows above the picture can mark the answer the level already gives
// instead of offering a chip that means "whatever this turns out to be".
// That is why the worker is driven by a HOOK the start card holds
// (`useSeedPreview`) rather than by this component: one seed, one level, one
// answer, read by the picture and by the rows beside it.
//
// THE WORK IS THE WORKER'S (`seed-preview-worker.ts`): generating a level
// costs hundreds of milliseconds and the sea behind this card must not miss
// a frame for it. What is left here is the DOM, and three rules about how
// the picture behaves while the worker is busy:
//
//   - THE LAST PICTURE STAYS UP while the next is being drawn, dimmed. A
//     box that emptied on every press would strobe through a walk down the
//     seeds, and the thing being compared would be gone at the moment of
//     comparison.
//   - A SEED IS ASKED FOR ONCE. Answers are kept, so walking back up the
//     seeds is instant and a step that overshoots costs nothing to undo.
//   - ONLY THE SEED ON SCREEN IS DRAWN. Replies for a seed that has since
//     been stepped past are dropped, because a worker that fell behind a
//     held arrow key would otherwise repaint its way through the backlog.

import { useEffect, useRef, useState } from "preact/hooks";

import { VIEW } from "./minimap-scene.ts";
import type { PreviewReply } from "./seed-preview-worker.ts";
import { STRINGS } from "./strings.ts";

/** How long the arrows have to be still before a level is built, ms. A press
 * is ~200 ms apart when somebody is walking the seeds, so this asks for the
 * one they stopped on rather than for every one they passed over. */
const SETTLE_MS = 220;

/** How many answers are kept. A seed's schematic is a few kilobytes of path
 * and a player walks tens of them, not thousands. */
const KEPT = 60;

/** The chart as the card holds it: the last answer that arrived, and whether
 * it is the answer for the seed on screen. A stale one still draws — dimmed,
 * and its deal marked as provisional — because a box that emptied on every
 * press would strobe through a walk down the seeds. */
export type SeedChart = { shown: PreviewReply | null; fresh: boolean };

export function useSeedPreview(seed: number): SeedChart {
  const [shown, setShown] = useState<PreviewReply | null>(null);
  const cache = useRef(new Map<number, PreviewReply>());
  const worker = useRef<Worker | null>(null);
  /** The seed the card is on RIGHT NOW, for the reply handler to check
   * itself against — a ref, because the handler outlives the render it was
   * created in and would otherwise be testing a stale number. */
  const wanted = useRef(seed);
  wanted.current = seed;

  useEffect(() => {
    const w = new Worker(new URL("./seed-preview-worker.ts", import.meta.url), {
      type: "module",
    });
    w.onmessage = (e: MessageEvent<PreviewReply>) => {
      const reply = e.data;
      const kept = cache.current;
      // Oldest out first. `Map` iterates in insertion order, so the first
      // key is the least recently ASKED FOR, which for a walk down the
      // seeds is the one furthest behind the cursor.
      if (kept.size >= KEPT) kept.delete(kept.keys().next().value as number);
      kept.set(reply.seed, reply);
      if (reply.seed === wanted.current) setShown(reply);
    };
    worker.current = w;
    return () => {
      w.terminate();
      worker.current = null;
    };
  }, []);

  useEffect(() => {
    const kept = cache.current.get(seed);
    if (kept) {
      setShown(kept);
      return;
    }
    const timer = window.setTimeout(() => worker.current?.postMessage({ seed }), SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [seed]);

  return { shown, fresh: shown !== null && shown.seed === seed };
}

export function SeedPreview({ chart }: { chart: SeedChart }) {
  const { shown, fresh } = chart;
  return (
    <div class={`seed-preview${fresh ? "" : " seed-preview-waiting"}`}>
      {shown === null || !shown.ok ? (
        <p class="seed-preview-word">
          {shown === null ? STRINGS.seedReading : STRINGS.seedRefused}
        </p>
      ) : (
        <>
          <svg
            class="seed-preview-map"
            viewBox={`0 0 ${VIEW} ${VIEW}`}
            role="img"
            aria-label={STRINGS.seedChart(shown.seed, shown.gates, shown.length)}
          >
            {/* The deepest water is the plate's own ground; everything else
                is painted over it, shallowest last. The layer order IS the
                depth order — see minimap-scene.ts's cartoon. The surf under
                the land is the same trick the map plays: a wide pale stroke
                on the shoreline, half of it covered by the land, leaves the
                half that belongs in the water. */}
            <path class="seed-preview-shelf" d={shown.schematic.shelf} />
            <path class="seed-preview-shallows" d={shown.schematic.shallows} />
            <path class="seed-preview-surf" d={shown.schematic.shore} fill="none" />
            <path class="seed-preview-land" d={shown.schematic.land} />
            <path class="seed-preview-highland" d={shown.schematic.highland} />
            <path class="seed-preview-shore" d={shown.schematic.shore} fill="none" />
            <path class="seed-preview-reefs" d={shown.schematic.reefs} />
            <path class="seed-preview-rocks" d={shown.schematic.rocks} />
            <path class="seed-preview-route" d={shown.schematic.route} fill="none" />
            {shown.schematic.gates.map((g, i) => (
              <circle key={i} class="seed-preview-gate" cx={g[0]} cy={g[1]} r={1.1} />
            ))}
            <circle
              class="seed-preview-start"
              cx={shown.schematic.start[0]}
              cy={shown.schematic.start[1]}
              r={2.2}
            />
          </svg>
          <p class="seed-preview-read">{STRINGS.seedRead(shown.gates, shown.length)}</p>
        </>
      )}
    </div>
  );
}
