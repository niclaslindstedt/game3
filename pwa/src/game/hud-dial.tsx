// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE INSTRUMENTS THAT ARE DRAWN rather than printed, both of them in the
// corner the speed is read from. Nothing here reads the game: each is handed
// a share and paints it.
//
// THE REV BAR — a jet ski has no gearbox, so there is nothing to shift on
// and no dial to sweep a needle round: the revs are a BAR, idle at its left
// end, the limiter at its right, the last stretch red.
//
// THE ALTITUDE TAPE — a climb is a vertical thing and reads as one, so the
// altimeter is a vertical track with the still-water line drawn across it
// and a marker that RIDES: it sinks into a trough, rises up a face, and runs
// away up the tape on a jump. The figure travels with the marker rather than
// sitting in a fixed corner, so the reading and how high it is are the one
// glance — which is the whole reason this is a tape and not a chip.

import { ALT_ZERO } from "./snapshot.ts";

/** The bar's box, in its own hundred-unit space. */
const BAR_W = 100;
const BAR_H = 14;
/** Where the red band starts, as a share of the redline. */
const RED_FROM = 0.88;

/** `rpm` and `idle` are shares of the redline, 0..1: the fill runs from
 * idle to the reading, so an engine ticking over shows nothing and the
 * bar is all headroom. `braking` is the reverse bucket down over the jet:
 * the revs the bar shows are then the brake's own — the lever opens the
 * throttle to feed the gate — and the fill is painted in the brake's
 * colour, the one the touch lever's upward throw fills with. */
export function RevBar({ rpm, idle, braking }: { rpm: number; idle: number; braking: boolean }) {
  const span = Math.max(0.01, 1 - idle);
  const fill = Math.max(0, Math.min(1, (rpm - idle) / span));
  const redX = Math.max(0, (RED_FROM - idle) / span) * BAR_W;
  const hot = rpm >= RED_FROM;
  return (
    <svg
      class={`hud-revs ${hot ? "hud-revs-hot" : ""} ${braking ? "hud-revs-brake" : ""}`}
      viewBox={`0 0 ${BAR_W} ${BAR_H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <rect class="hud-revs-track" x="0" y="0" width={BAR_W} height={BAR_H} rx="2" />
      <rect class="hud-revs-red" x={redX} y="0" width={BAR_W - redX} height={BAR_H} rx="2" />
      {/* The fill is scaled rather than re-sized so the browser can tween it
          between HUD snapshots and the bar reads smooth at 12 Hz. */}
      <rect
        class="hud-revs-fill"
        x="0"
        y="1.5"
        width={BAR_W}
        height={BAR_H - 3}
        rx="1.5"
        style={{ transform: `scaleX(${fill.toFixed(3)})` }}
      />
      {[0.25, 0.5, 0.75].map((tick) => (
        <path
          key={tick}
          class="hud-revs-tick"
          d={`M ${tick * BAR_W} 0 L ${tick * BAR_W} ${BAR_H}`}
        />
      ))}
    </svg>
  );
}

/** THE ALTITUDE TAPE. `share` is where the reading sits on the track, 0 at
 * the foot and 1 at the top (`snapshot.ts`'s `altitudeShare` owns the scale
 * and the still-water line's place on it); `peak` is the run's high-water
 * mark on the same scale, or negative with nothing to mark yet. `reading`
 * is the figure, already worded (§39.1).
 *
 * The FILL runs from the still-water line to the marker rather than from
 * the foot, because the thing being read is the DEPARTURE from the water:
 * a bar growing downward into a trough and upward off a crest says the sea
 * is working at a glance, where a bar filling from the bottom would just
 * look low. Both ends of it are handed to the browser as percentages so it
 * can tween them between the HUD's 12 Hz snapshots, the way the rev bar's
 * fill is scaled rather than re-sized. */
export function AltitudeTape({
  share,
  peak,
  reading,
}: {
  share: number;
  peak: number;
  reading: string;
}) {
  const at = Math.max(0, Math.min(1, share));
  const lo = Math.min(ALT_ZERO, at);
  const hi = Math.max(ALT_ZERO, at);
  return (
    <div class="hud-tape">
      <span class="hud-tape-zero" style={{ bottom: `${(ALT_ZERO * 100).toFixed(2)}%` }} />
      <span
        class="hud-tape-fill"
        style={{ bottom: `${(lo * 100).toFixed(2)}%`, height: `${((hi - lo) * 100).toFixed(2)}%` }}
      />
      {peak >= 0 && (
        <span
          class="hud-tape-peak"
          style={{ bottom: `${(Math.min(1, peak) * 100).toFixed(2)}%` }}
        />
      )}
      <span class="hud-tape-mark" style={{ bottom: `${(at * 100).toFixed(2)}%` }}>
        <span class="hud-tape-num">{reading}</span>
      </span>
    </div>
  );
}
