// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE REV BAR — the one instrument on the HUD that is DRAWN rather than
// printed. A jet ski has no gearbox, so there is nothing to shift on and no
// dial to sweep a needle round: the revs are a BAR, idle at its left end,
// the limiter at its right, the last stretch red. Nothing here reads the
// game — the bar is handed a share of the redline and paints it.

/** The bar's box, in its own hundred-unit space. */
const BAR_W = 100;
const BAR_H = 14;
/** Where the red band starts, as a share of the redline. */
const RED_FROM = 0.88;

/** `rpm` and `idle` are shares of the redline, 0..1: the fill runs from
 * idle to the reading, so an engine ticking over shows nothing and the
 * bar is all headroom. */
export function RevBar({ rpm, idle }: { rpm: number; idle: number }) {
  const span = Math.max(0.01, 1 - idle);
  const fill = Math.max(0, Math.min(1, (rpm - idle) / span));
  const redX = Math.max(0, (RED_FROM - idle) / span) * BAR_W;
  const hot = rpm >= RED_FROM;
  return (
    <svg
      class={`hud-revs ${hot ? "hud-revs-hot" : ""}`}
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
