// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// SCREENSHOTS — the parts of taking a picture that are arithmetic rather
// than graphics, and can therefore be held to a promise with no canvas
// anywhere near them. Both modules under test are DOM-free on purpose, and
// this file is what that buys.
//
// Three things are load-bearing. The ROLL must stay capped and newest
// first, because a roll that quietly stopped capping is an unbounded pile
// of megabytes in somebody's browser profile, and nothing in a game ever
// prompts a player to prune one. The STAMP must stay a signature at every
// size a window can be, because it is drawn into the corner of a picture
// that leaves the game and nobody sees it before it does. And the PICTURE
// must never be blown UP: a screenshot is worth exactly what the renderer
// drew, and not one interpolated pixel more.
//
// What is NOT here is everything that needs a canvas or a document — the
// grab off the drawing buffer, the HUD rasterized into the frame, the PNG
// encode, the IndexedDB roll behind it. Those are judged by LOOKING, with
// `make screenshots`; these are judged by arithmetic.

import { describe, expect, it } from "vitest";

import {
  HUD_LAYER_ROOT,
  LAYER_STILL_CSS,
  animatedProperties,
  cssPropertyName,
  hudLayerSvg,
  shotFileName,
  shotSize,
  stampFits,
  stampLayout,
  stampLift,
  type HudCover,
} from "../pwa/src/game/shot-plan.ts";
import {
  keysPastCap,
  shotId,
  shotMeta,
  thumbSize,
  withShot,
  withStored,
  type Shot,
} from "../pwa/src/lib/shot-roll.ts";

/** A picture. Node has Blob, and the roll never looks inside one — it is
 * pixels to everything but the browser that encoded them. */
const shotAt = (takenAt: number, label = "seed 38 · dart"): Shot => ({
  id: shotId(takenAt, takenAt),
  takenAt,
  width: 1920,
  height: 1080,
  label,
  blob: new Blob(["png"], { type: "image/png" }),
});

describe("the roll", () => {
  it("puts the newest picture at the head", () => {
    const roll = withShot(withShot([], shotAt(1000, "first"), 5), shotAt(2000, "second"), 5);
    expect(roll.map((entry) => entry.label)).toEqual(["second", "first"]);
  });

  it("drops the oldest past the cap", () => {
    let roll: Shot[] = [];
    for (let n = 1; n <= 5; n++) roll = withShot(roll, shotAt(n * 1000, `shot ${n}`), 3);
    expect(roll.map((entry) => entry.label)).toEqual(["shot 5", "shot 4", "shot 3"]);
  });

  it("keeps at least the picture just taken, whatever the cap says", () => {
    expect(withShot([], shotAt(1000), 0)).toHaveLength(1);
  });

  it("gives ids that sort by age even inside one millisecond", () => {
    expect(shotId(1000, 1) < shotId(1000, 2)).toBe(true);
    expect(shotId(1000, 9) < shotId(2000, 1)).toBe(true);
  });

  it("puts a read off disk under what is already in hand, newest first", () => {
    const captured = shotAt(5000, "just taken");
    const joined = withStored([captured], [shotAt(1000, "old"), shotAt(3000, "newer")], 40);
    expect(joined.map((entry) => entry.label)).toEqual(["just taken", "newer", "old"]);
  });

  // The read is the one path that can put more pictures in hand than the cap
  // allows — three taken this session joined onto a full store — and a roll
  // over its cap is a gallery listing pictures the next prune will delete.
  it("caps what a read off disk joins on, like every other way the roll grows", () => {
    const stored = [3000, 2000, 1000].map((at) => shotAt(at, `stored ${at}`));
    const joined = withStored([shotAt(5000, "just taken")], stored, 2);
    expect(joined.map((entry) => entry.label)).toEqual(["just taken", "stored 3000"]);
  });

  it("never lets a stored copy displace the one already in memory", () => {
    const held = shotAt(1000, "in hand");
    const stale = { ...shotAt(1000, "on disk"), id: held.id };
    expect(withStored([held], [stale], 40).map((entry) => entry.label)).toEqual(["in hand"]);
  });

  // THE PRUNE IS DECIDED FROM THE KEYS, and these are why. The obvious
  // version — delete every stored key the roll in hand does not hold —
  // deletes every picture the player has ever taken on any visit where the
  // gallery was never opened, because nothing reads the store until it is.
  // Keys carry the age (`shotId`), so they answer the question on their own.
  it("deletes what is past the cap, oldest first", () => {
    expect(keysPastCap(["1000-000001", "3000-000001", "2000-000001"], 2)).toEqual(["1000-000001"]);
  });

  it("deletes nothing while the store is inside the cap", () => {
    expect(keysPastCap(["1000-000001", "2000-000001"], 40)).toEqual([]);
  });

  // The case the whole design is for: a visit that has taken ONE picture and
  // never read the roll in still prunes only what is past the cap.
  it("keeps every stored picture the cap has room for, whatever is in hand", () => {
    expect(keysPastCap([shotAt(1000).id, shotAt(2000).id, shotAt(5000).id], 40)).toEqual([]);
  });

  it("leaves the pixels out of a listing", () => {
    expect(shotMeta([shotAt(1000)])[0]).not.toHaveProperty("blob");
  });
});

describe("a filmstrip thumbnail's size", () => {
  it("covers the tile without blowing the box out", () => {
    const size = thumbSize(1920, 1080, 160, 90);
    expect(size).toEqual({ width: 160, height: 90 });
  });

  it("keeps the picture's own shape, so the tile's crop is the tile's job", () => {
    // A portrait phone's shot in a landscape tile: it has to be wide enough
    // to cover, which makes it taller than the box, and `object-fit: cover`
    // takes the middle of it.
    const size = thumbSize(1080, 1920, 160, 90);
    expect(size.width).toBe(160);
    expect(size.height).toBe(Math.round((160 * 1920) / 1080));
  });

  it("never scales a small picture UP", () => {
    const size = thumbSize(64, 36, 160, 90);
    expect(size).toEqual({ width: 64, height: 36 });
  });

  it("is a real size for a record that has lost its own", () => {
    expect(thumbSize(0, 0, 160, 90)).toEqual({ width: 160, height: 90 });
  });

  it("is a thumbnail rather than a screenshot — the whole point of it", () => {
    const full = 1920 * 1080;
    const size = thumbSize(1920, 1080, 160, 90);
    // Two orders of magnitude fewer pixels to decode and to hold, per tile,
    // times a roll of forty.
    expect(size.width * size.height).toBeLessThan(full / 100);
  });
});

describe("the file name", () => {
  it("is sortable, lowercase and has no spaces in it", () => {
    const name = shotFileName("SeaHaven", "SEED 38 · DART", Date.UTC(2026, 1, 3, 14, 5, 9));
    expect(name).toBe("seahaven-seed-38-dart-2026-02-03-14-05-09.png");
  });

  it("drops an apostrophe rather than breaking a word on it", () => {
    expect(shotFileName("SeaHaven", "Devil's Reach", 0)).toContain("devils-reach");
  });

  it("still names a picture taken somewhere with no name", () => {
    expect(shotFileName("SeaHaven", "", 0)).toMatch(/^seahaven-shot-/);
  });
});

describe("the picture's size", () => {
  it("keeps a frame under the cap exactly as it was drawn", () => {
    expect(shotSize(1688, 780)).toEqual({ width: 1688, height: 780 });
  });

  it("never blows a small frame up", () => {
    expect(shotSize(640, 360)).toEqual({ width: 640, height: 360 });
  });

  it("brings a huge frame down without changing its shape", () => {
    const size = shotSize(7680, 4320);
    expect(Math.max(size.width, size.height)).toBe(2560);
    expect(size.width / size.height).toBeCloseTo(16 / 9, 2);
  });

  it("measures the cap against the LONG side, whichever way up the frame is", () => {
    const upright = shotSize(4320, 7680);
    const sideways = shotSize(7680, 4320);
    expect(upright).toEqual({ width: sideways.height, height: sideways.width });
  });
});

describe("the stamp", () => {
  it("stays a signature rather than a logo on a huge picture", () => {
    // A twentieth of the short side is what "in the corner" has to mean.
    expect(stampLayout(3840, 2160).mark / 2160).toBeLessThan(0.05);
  });

  it("stays legible on a small one", () => {
    expect(stampLayout(640, 360).mark).toBeGreaterThanOrEqual(26);
  });

  it("is measured off the SHORT side, so a wide window does not enlarge it", () => {
    expect(stampLayout(3840, 1080).mark).toBe(stampLayout(1920, 1080).mark);
  });

  it("keeps its proportions at every size", () => {
    for (const [width, height] of [
      [640, 360],
      [1920, 1080],
      [1080, 1920],
      [3840, 2160],
    ]) {
      const layout = stampLayout(width, height);
      expect(layout.font).toBeLessThan(layout.mark);
      expect(layout.gap).toBeLessThan(layout.mark);
      expect(layout.pad).toBeGreaterThan(0);
      // The badge and its margins have to leave the picture room to still
      // be a picture, on the short side as well as the long one.
      expect(layout.mark * 2 + layout.pad * 2).toBeLessThan(Math.min(width, height));
    }
  });

  it("stands aside on a picture too small to sign", () => {
    expect(stampFits(1920, 1080)).toBe(true);
    expect(stampFits(120, 68)).toBe(false);
  });
});

describe("the HUD layer", () => {
  const layer = (over: Partial<Parameters<typeof hudLayerSvg>[0]> = {}): string =>
    hudLayerSvg({
      markup: '<div xmlns="http://www.w3.org/1999/xhtml" class="hud">120</div>',
      css: ":root { --hud-ink: #fff; }\n.hud { color: var(--hud-ink); }",
      width: 1280,
      height: 720,
      inherited: "font-family:Arial Narrow;font-size:16px",
      ...over,
    });

  it("is one SVG the size of the window, so the picture is only ever scaled", () => {
    const svg = layer();
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg).toContain('width="1280" height="720"');
    expect(svg).toContain('viewBox="0 0 1280 720"');
    expect(svg.endsWith("</svg>")).toBe(true);
  });

  // Every instrument on the HUD is pinned with `position: absolute` against
  // the app-root around it. Without a positioned box of the window's own
  // size standing in for it, the whole panel collapses into the corner.
  it("stands the instruments in a box the shape of the app-root", () => {
    expect(layer()).toContain("position:relative;width:1280px;height:720px");
  });

  // The HUD's ink, its shadow and its steer blue are all declared on
  // `:root`, and inside an SVG the root element is the `<svg>` — so a sheet
  // taken in verbatim would style nothing and the HUD would come out black.
  it("points every :root rule at the wrapper the HUD actually hangs on", () => {
    const svg = layer();
    expect(svg).toContain(`.${HUD_LAYER_ROOT} { --hud-ink: #fff; }`);
    expect(svg).not.toContain(":root");
  });

  // The font is set on `body` (styles.css), which is not coming with the
  // HUD — a layer that lost it would come back in the browser's default
  // serif at the browser's default size.
  it("carries what the HUD was inheriting from above", () => {
    expect(layer()).toContain("font-family:Arial Narrow;font-size:16px");
  });

  // A `<foreignObject>` is parsed as XML, so the stylesheet cannot be
  // escaped (`&` is a nesting selector) and cannot be raw (`>` is a
  // combinator). CDATA is the only door, and its own terminator is the one
  // sequence it cannot carry.
  it("takes a stylesheet in verbatim, combinators and all", () => {
    const svg = layer({ css: ".a > .b { color: red } .c { &:hover { color: blue } }" });
    expect(svg).toContain("<![CDATA[.a > .b { color: red }");
    expect(svg).toContain("&:hover");
  });

  it("splits a CDATA close out of a stylesheet rather than ending the section on it", () => {
    const svg = layer({ css: '.a[x="]]>"] { color: red }' });
    expect(svg).toContain("]]]]><![CDATA[>");
    expect(svg.match(/<!\[CDATA\[/g)).toHaveLength(2);
    expect(svg.endsWith("</svg>")).toBe(true);
  });

  it("never emits a picture with no area to it", () => {
    expect(layer({ width: 0, height: -4 })).toContain('width="1" height="1"');
  });

  // An SVG image is painted at time zero, so a HUD taken in with its
  // animations live replays every entrance from its first keyframe — and
  // the news column, the split board and the touch controls all begin at
  // `opacity: 0`. The layer is STILL, and where each animation had actually
  // got to is inlined on the copy instead (shot-hud.ts).
  it("stops the clock on everything in it", () => {
    const svg = layer();
    expect(svg).toContain(LAYER_STILL_CSS);
    expect(LAYER_STILL_CSS).toContain("animation:none !important");
    expect(LAYER_STILL_CSS).toContain("transition:none !important");
  });

  // ...and it has to come AFTER the page's own sheet, or a rule with the
  // same weight later in the document wins and the entrances play again.
  it("stills the layer after the page's own stylesheet, not before it", () => {
    const svg = layer({ css: ".hud-flash { animation: pop 1s }" });
    expect(svg.indexOf(".hud-flash { animation: pop 1s }")).toBeLessThan(
      svg.indexOf(LAYER_STILL_CSS),
    );
  });
});

// The freeze reads each animated property off the live element and writes it
// onto the copy, so what it needs from a keyframe list is the SET of CSS
// property names — not the keys, which arrive in the IDL spelling with the
// Web Animations API's own timing fields mixed in among them.
describe("the properties an animation is moving", () => {
  it("names them the way CSS does", () => {
    expect(cssPropertyName("opacity")).toBe("opacity");
    expect(cssPropertyName("backgroundColor")).toBe("background-color");
    expect(cssPropertyName("transformOrigin")).toBe("transform-origin");
  });

  // A custom property is already in its CSS spelling and has no camel case
  // to undo — `--pull` must not come back as `- -pull`.
  it("leaves a custom property alone", () => {
    expect(cssPropertyName("--pull")).toBe("--pull");
  });

  it("drops the timing bookkeeping the API puts beside the properties", () => {
    const frames = [
      { offset: 0, computedOffset: 0, easing: "ease-out", composite: "auto", opacity: "0" },
      { offset: 1, computedOffset: 1, easing: "ease-out", composite: "auto", opacity: "1" },
    ];
    expect(animatedProperties(frames)).toEqual(["opacity"]);
  });

  // A `from`/`to` rule carries the same property in both frames and a
  // stepped one carries it in four; each is read off the live element once.
  it("names each property once, in the order it was first seen", () => {
    const frames = [
      { opacity: "0", transform: "scale(0.82)" },
      { transform: "scale(1.06)", opacity: "1" },
      { transform: "scale(1)", opacity: "1" },
    ];
    expect(animatedProperties(frames)).toEqual(["opacity", "transform"]);
  });

  it("has nothing to freeze for an animation that moves nothing", () => {
    expect(animatedProperties([{ offset: 0 }, { offset: 1 }])).toEqual([]);
  });
});

// With the HUD in the picture the bottom-right corner is no longer reliably
// empty: a phone held upright runs the whole thumb cluster along the foot,
// and the news column lives down there on a window held sideways — a
// signature dropped on either takes an instrument with it.
describe("the stamp, over instruments", () => {
  const cols = 32;
  const rows = 64;
  /** A cover with the bottom `band` rows filled right across. */
  const along = (band: number): HudCover => {
    const on = new Uint8Array(cols * rows);
    for (let row = rows - band; row < rows; row++) on.fill(1, row * cols, row * cols + cols);
    return { cols, rows, on };
  };
  const badge = { left: 900, right: 1260, top: 660, bottom: 700 };

  it("stays where it was when the corner is empty", () => {
    expect(stampLift(along(0), badge, 1280, 720)).toBe(0);
    expect(stampLift(null, badge, 1280, 720)).toBe(0);
  });

  it("lifts clear of a cluster along the foot", () => {
    // Four rows of a 64-row map over a 720-tall picture is 45 px of
    // instruments; the badge has to end up above all of them.
    const lift = stampLift(along(4), badge, 1280, 720);
    expect(lift).toBeGreaterThanOrEqual(45);
    expect(badge.bottom - lift).toBeLessThanOrEqual(720 - 45);
  });

  // The cluster is over on the LEFT on a window held sideways, and a badge
  // that climbed anyway would be a signature hovering in the middle of a
  // frame for no reason at all.
  it("ignores instruments outside its own column", () => {
    const on = new Uint8Array(cols * rows);
    for (let row = rows - 6; row < rows; row++) on.fill(1, row * cols, row * cols + 8);
    expect(stampLift({ cols, rows, on }, badge, 1280, 720)).toBe(0);
  });

  // A card standing over the whole frame covers it corner to corner. There
  // is nowhere better to be, and a signature floating in the middle of the
  // picture is worse than one on the card.
  it("stays put when the whole picture is covered", () => {
    expect(stampLift(along(rows), badge, 1280, 720)).toBe(0);
  });
});
