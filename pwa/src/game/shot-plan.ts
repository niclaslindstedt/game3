// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// EVERYTHING DECIDED ABOUT A SCREENSHOT BEFORE A PIXEL IS TOUCHED: how big
// the picture is, what it is called, where the app's mark goes on it, and
// the HUD's own layer as a document. The canvas work that acts on all of it
// is next door in screenshots.ts and shot-hud.ts.
//
// DOM-FREE, deliberately and load-bearingly. These are the parts of taking
// a picture that are arithmetic rather than graphics, and keeping them out
// of reach of a canvas is what lets the test suite hold them to a promise —
// a stamp is drawn into the corner of a picture that leaves the game, and
// nobody ever sees it before it does.
//
// THE MARK GOES BOTTOM RIGHT, and not by coin toss. The craft sits
// middle-bottom of the frame on every rung of the camera ladder, the sky
// and the run clock own the top, and the bottom-left is where the wake runs
// out of frame on the inside of a turn — which is the half of the picture a
// riding screenshot is usually about. What the bottom-right corner has
// instead is the news column, which is HUD rather than water: `stampLift`
// below is what walks the badge up past it.

/** The longest side a picture is allowed. A 4K screen at HIGH resolution —
 * every pixel the device has — has a drawing buffer nobody wants to send
 * anywhere, and a screenshot of a run is going into a chat window, not onto
 * a wall. The cap is a DOWNSCALE only: a smaller frame is kept at its own
 * size rather than blown up into pixels the renderer never drew. */
const MAX_SIDE = 2560;

/** The picture's size for a drawing buffer this big — the frame itself, or
 * as much of it as `MAX_SIDE` allows, with the aspect kept. */
export function shotSize(width: number, height: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= MAX_SIDE || longest < 1) {
    return { width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)) };
  }
  const scale = MAX_SIDE / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** The picture's file name, on disk and in a share sheet: the game, where
 * the picture was taken, and when — sortable, lowercase, no spaces. */
export function shotFileName(app: string, label: string, takenAt: number): string {
  const stamp = new Date(takenAt).toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return `${slug(app)}-${slug(label) || "shot"}-${stamp}.png`;
}

function slug(text: string): string {
  return (
    text
      .toLowerCase()
      // Apostrophes are DROPPED rather than separated on: a coast called
      // Devil's Reach is not "devil-s-reach" to anybody.
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40)
  );
}

/** Where the stamp's parts go, in picture pixels. */
export type StampLayout = {
  /** The app-icon square's side. */
  mark: number;
  /** The margin from the picture's right and bottom edges. */
  pad: number;
  /** The size the name is set at. */
  font: number;
  /** Between the mark and the first letter of the name. */
  gap: number;
};

/** How much of the SHORT side the mark takes, and the ceiling and floor on
 * the result. Short side rather than width, because a mark scaled off the
 * width would be a postage stamp on a phone held sideways and a billboard
 * on one held upright. The bounds are what keep the signature a signature:
 * a mark that scaled forever would be a logo across the corner of a 4K
 * frame, and one that scaled all the way down would be a smudge. */
const MARK_OF_SHORT_SIDE = 0.075;
const MARK_MIN = 26;
const MARK_MAX = 84;

/** The rest of the stamp's proportions, all off the mark: it is one badge,
 * and a badge whose parts scale against different things comes apart at
 * some size nobody tested. */
const PAD_OF_MARK = 0.5;
const FONT_OF_MARK = 0.42;
const GAP_OF_MARK = 0.3;

export function stampLayout(width: number, height: number): StampLayout {
  const short = Math.max(1, Math.min(width, height));
  const mark = Math.round(Math.min(MARK_MAX, Math.max(MARK_MIN, short * MARK_OF_SHORT_SIDE)));
  return {
    mark,
    pad: Math.round(mark * PAD_OF_MARK),
    font: Math.round(mark * FONT_OF_MARK),
    gap: Math.round(mark * GAP_OF_MARK),
  };
}

/** Whether a picture is big enough to be worth signing. Below this the
 * stamp would be most of the frame — which happens to nothing the game
 * captures today, but a thumbnail that reused this would find out the hard
 * way, and an unsigned picture is better than a defaced one. */
export function stampFits(width: number, height: number): boolean {
  const layout = stampLayout(width, height);
  return width >= layout.mark * 6 && height >= layout.mark * 3;
}

/** A coarse yes/no map of where the HUD put ink over a picture: `cols` by
 * `rows` cells, row 0 at the top, 1 where an instrument covers the cell.
 * Read off the rasterized layer rather than off the DOM (shot-hud.ts),
 * because what matters is where the pixels LANDED — an instrument is a chip
 * with a shadow under a shape with a shadow under it, and no bounding box
 * anybody could walk says where that comes to. */
export type HudCover = { cols: number; rows: number; on: Uint8Array };

/** A rectangle of the picture, in picture pixels. */
export type Box = { left: number; right: number; top: number; bottom: number };

/**
 * HOW FAR THE STAMP HAS TO BE LIFTED to stand clear of the instruments.
 *
 * The bottom-right corner is the quietest rectangle the WATER has, and it
 * stays the right corner now that the HUD is in the picture too — but it is
 * not always the last pixel of one. The news column lives down there on a
 * window held sideways, and the whole thumb cluster stands along the foot of
 * one held upright; a signature dropped on either takes an instrument with
 * it. So the badge slides UP the corner until it finds room.
 *
 * Returns pixels, and zero when there is nowhere better to be — a picture
 * covered corner to corner gets the signature it would have had anyway,
 * rather than one floating in its middle.
 */
export function stampLift(cover: HudCover | null, box: Box, width: number, height: number): number {
  if (!cover || cover.cols < 1 || cover.rows < 1 || width < 1 || height < 1) return 0;
  const rowHeight = height / cover.rows;
  const from = clamp(Math.floor((box.left / width) * cover.cols), cover.cols);
  const to = clamp(Math.ceil((box.right / width) * cover.cols) - 1, cover.cols);
  const tall = Math.max(1, Math.ceil((box.bottom - box.top) / rowHeight));
  // Down from the foot, because the corner the badge wants is the one it
  // already has: the first band deep enough to hold it wins, and the lift is
  // how far that band's floor is off the picture's.
  for (let floor = cover.rows - 1; floor >= tall - 1; floor--) {
    if (clearBand(cover, from, to, floor - tall + 1, floor)) {
      return Math.round((cover.rows - 1 - floor) * rowHeight);
    }
  }
  return 0;
}

/** Whether every cell of a band of rows, over a range of columns, is free of
 * instruments. */
function clearBand(
  cover: HudCover,
  from: number,
  to: number,
  top: number,
  bottom: number,
): boolean {
  for (let row = top; row <= bottom; row++) {
    for (let col = from; col <= to; col++) {
      if (cover.on[row * cover.cols + col]) return false;
    }
  }
  return true;
}

function clamp(value: number, count: number): number {
  return Math.max(0, Math.min(count - 1, value));
}

/** The name's typeface, the same condensed stack the HUD is set in
 * (styles.css) so a picture is signed in the game's own hand. Restated
 * rather than read off the document: a canvas font is a string, not a
 * computed style, and asking the DOM for one mid-capture is a layout flush
 * inside a frame. */
export const STAMP_FONT_STACK =
  '"Avenir Next Condensed", "Arial Narrow", "Roboto Condensed", system-ui';

// ── The HUD layer ─────────────────────────────────────────────────────────
//
// THE HUD IS IN THE PICTURE. It is what the rider was looking at — the clock
// they were chasing, the gate they were counting, the wind they were reading
// — and a screenshot with none of that in it is a photo of some water. The
// player who wants the frame on its own already has the way to it: OPTIONS'
// HUD switch takes the instruments down for good. That is not the shutter's
// business to guess at.
//
// The HUD is DOM over the canvas, so it is not in the drawing buffer a
// picture is lifted from and has to be RASTERIZED into it: the live subtree
// and the page's own stylesheet, wrapped in a `<foreignObject>` so the
// browser lays out and paints its own HUD rather than this file drawing a
// second one in Canvas2D. A redrawn HUD would be a copy to keep in step with
// every instrument that ever moves, and it would be wrong the first time
// somebody changed a stylesheet.
//
// Same arithmetic-not-graphics split as the stamp above: the document is
// ASSEMBLED here, where a test can read it, and the serializing, decoding
// and compositing are next door (shot-hud.ts).

/** The class the layer's wrapper wears, and what `:root` is rewritten to on
 * the way in. Inside an SVG the document's root element is the `<svg>`, so a
 * `:root` rule — which is where the HUD's ink, its shadow, `--hud-dark` and
 * every other colour it is drawn in are declared — would match nothing at
 * all and the whole HUD would come out in the browser's default black. */
export const HUD_LAYER_ROOT = "shot-hud-root";

/** Everything the HUD layer is built from. `markup` is the screen's chrome
 * serialized as XML, `css` the page's own stylesheet, and `inherited` the
 * declarations the HUD gets from the ancestors that are NOT coming with it
 * (the font off `body`, most of all) — read from the live page rather than
 * restated, so nothing here has to know what the app is set in. */
export type HudLayerSource = {
  markup: string;
  css: string;
  /** The app-root's box in CSS pixels — the same rectangle the canvas
   * fills, which is what lets the layer be drawn over the picture with no
   * arithmetic beyond a scale. */
  width: number;
  height: number;
  inherited: string;
};

/** A RASTERIZED DOCUMENT HAS NO CLOCK. An SVG image is painted at time
 * zero, so every CSS animation in the layer starts over from its first
 * keyframe rather than standing where the screen had it — and the HUD's
 * entrances all begin at `opacity: 0`, which is a news column and a set of
 * thumb zones that are on screen and not in the picture. Turning them off
 * is half the fix; the other half is inlining where each animated property
 * had actually got to (shot-hud.ts). Transitions go the same way and for
 * the same reason: left running they render at their DESTINATION, so a bar
 * sweeping to the revs arrives before the shutter does. */
export const LAYER_STILL_CSS = `.${HUD_LAYER_ROOT},.${HUD_LAYER_ROOT} *{animation:none !important;transition:none !important}`;

/** The keys a keyframe carries that are timing bookkeeping rather than
 * properties — the Web Animations API puts them in beside the real ones. */
const KEYFRAME_TIMING = new Set(["offset", "computedOffset", "easing", "composite"]);

/** One keyframe key as the CSS property it names: the API hands them over
 * in the IDL spelling (`backgroundColor`), and a custom property arrives as
 * itself and must be left alone. */
export function cssPropertyName(key: string): string {
  if (key.startsWith("--")) return key;
  return key.replace(/[A-Z]/g, (upper) => `-${upper.toLowerCase()}`);
}

/**
 * Which CSS properties a set of keyframes moves, as CSS names, in the order
 * they were first seen and with no repeats.
 *
 * A keyframe list is not a property list: the first and last frames of a
 * `from`/`to` rule carry the same property, a stepped rule carries it four
 * times, and every frame carries the timing keys above. What the freeze
 * needs is the SET, because each one is read off the live element once.
 */
export function animatedProperties(frames: readonly Record<string, unknown>[]): string[] {
  const seen = new Set<string>();
  for (const frame of frames) {
    for (const key of Object.keys(frame)) {
      if (KEYFRAME_TIMING.has(key)) continue;
      seen.add(cssPropertyName(key));
    }
  }
  return [...seen];
}

/**
 * The HUD as a standalone SVG document, ready to be decoded as an image.
 *
 * The viewport is the app-root's CSS box and the viewBox matches it, so
 * `vw`, `vh` and `vmin` — which the HUD sizes its minimap, its chips and its
 * thumb zones in — resolve to exactly what they resolved to on screen. The
 * picture is usually bigger than that (a drawing buffer is CSS pixels times
 * the device ratio), and the scaling is left to the draw: an SVG is
 * rasterized at the size it is painted, so the HUD comes out at the
 * picture's resolution rather than upscaled from the window's.
 */
export function hudLayerSvg(source: HudLayerSource): string {
  const width = Math.max(1, Math.round(source.width));
  const height = Math.max(1, Math.round(source.height));
  // The wrapper stands in for `.app-root`: the HUD's instruments are pinned
  // with `position: absolute`, and without a positioned box of the window's
  // own size around them they would pin themselves to the SVG and pile up in
  // the corner.
  const style = `position:relative;width:${width}px;height:${height}px;overflow:hidden;${source.inherited}`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<foreignObject x="0" y="0" width="${width}" height="${height}">`,
    `<div xmlns="http://www.w3.org/1999/xhtml" class="${HUD_LAYER_ROOT}" style="${escapeAttr(style)}">`,
    `<style>${cdata(`${rootedCss(source.css)}\n${LAYER_STILL_CSS}`)}</style>`,
    source.markup,
    "</div></foreignObject></svg>",
  ].join("");
}

/** The page's stylesheet with every `:root` pointed at the layer's wrapper —
 * see `HUD_LAYER_ROOT`. A plain replace is enough because `:root` is only
 * ever a selector: it takes no arguments and cannot appear inside a value. */
function rootedCss(css: string): string {
  return css.split(":root").join(`.${HUD_LAYER_ROOT}`);
}

/** A stylesheet is dropped into the document verbatim rather than escaped,
 * because CSS is full of `&` and `>` and a nesting selector that came back
 * as `&amp;` would style nothing. The one sequence CDATA cannot carry is its
 * own terminator, which is split across two sections instead. */
function cdata(text: string): string {
  return `<![CDATA[${text.split("]]>").join("]]]]><![CDATA[>")}]]>`;
}

function escapeAttr(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}
