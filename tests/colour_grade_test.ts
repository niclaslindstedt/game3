// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GRADE THE TWO COASTS ARE FINISHED WITH.
//
// `pwa/src/game/colour-grade.ts` carries the table and `gradeTone`, the
// model in TypeScript; `grade-pass.ts` restates the same arithmetic as GLSL
// and is the only one that ever runs in the game. Neither can import the
// other's reason to exist, so the cases below hold the model to the two
// looks it claims — the cold coast cool, flat and lifted; the warm one
// punchy, with gold at one end of the picture and teal at the other — and
// hold the shader to the model, by reading it as TEXT rather than importing
// three into a suite that runs on plain Node.
//
// WHAT NO TEST HERE SAYS IS WHETHER THE PICTURE IS RIGHT. That is judged by
// looking (`make screenshots`, both coasts, two skies). What these hold is
// the half that a look cannot catch: an exposure that has quietly moved, a
// clamp that has gone missing, a shader that no longer says what the table
// says.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BIOME_IDS } from "@engine";

import { luminance, scaleHex, unpackLinear } from "../pwa/src/lib/colour.ts";
import {
  COLOUR_GRADES,
  gradeColour,
  gradeOf,
  gradeTone,
  type ColourGrade,
} from "../pwa/src/game/colour-grade.ts";

/** A packed grey, sRGB. */
const grey = (v: number): number => (v << 16) | (v << 8) | v;

/** The three sRGB bytes of a packed colour. */
function bytes(hex: number): [number, number, number] {
  return [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff];
}

/** HOW WARM A COLOUR IS, in sRGB bytes: red over blue. The one number the
 * whole subject comes down to — a cold grade drives it negative, a warm one
 * positive, and a coast is told from the other by its sign. */
function warmth(hex: number): number {
  const [r, , b] = bytes(hex);
  return r - b;
}

/** How much colour is in a packed hex at all, 0 for any grey — the spread
 * of its linear channels about their own mean. */
function chroma(hex: number): number {
  const c = unpackLinear(hex, [0, 0, 0]);
  const mean = (c[0] + c[1] + c[2]) / 3;
  return Math.abs(c[0] - mean) + Math.abs(c[1] - mean) + Math.abs(c[2] - mean);
}

const taiga = gradeOf("taiga");
const mangrove = gradeOf("mangrove");

describe("every coast is graded", () => {
  it("has a row, and no row is for a coast nobody built", () => {
    expect(Object.keys(COLOUR_GRADES).sort()).toEqual([...BIOME_IDS].sort());
    for (const id of BIOME_IDS) expect(() => gradeOf(id)).not.toThrow();
    expect(() => gradeOf("atoll")).toThrow(/atoll/);
  });

  it("states every dial in a band a grade can be argued about in", () => {
    for (const id of BIOME_IDS) {
      const g = gradeOf(id);
      // A contrast or a saturation outside this is not a grade, it is a
      // different game; a lift past a tenth is fog, which the sky owns.
      expect(g.contrast, `${id} contrast`).toBeGreaterThan(0.75);
      expect(g.contrast, `${id} contrast`).toBeLessThan(1.35);
      expect(g.saturation, `${id} saturation`).toBeGreaterThan(0.6);
      expect(g.saturation, `${id} saturation`).toBeLessThan(1.4);
      expect(g.lift, `${id} lift`).toBeGreaterThanOrEqual(0);
      expect(g.lift, `${id} lift`).toBeLessThan(0.1);
      for (const [end, k] of [...g.split.entries()]) {
        expect(k, `${id} split ${end}`).toBeGreaterThanOrEqual(0);
        // Past half, the tone stops being a tone and becomes the picture.
        expect(k, `${id} split ${end}`).toBeLessThanOrEqual(0.5);
      }
      for (const hex of [g.tint, g.shade, g.glow]) expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe("a grade's colours carry a hue and no exposure", () => {
  it("are normalised by their own luminance, whatever hex was typed", () => {
    const out: [number, number, number] = [0, 0, 0];
    for (const id of BIOME_IDS) {
      const g = gradeOf(id);
      for (const hex of [g.tint, g.shade, g.glow]) {
        gradeColour(hex, out);
        expect(0.2126 * out[0] + 0.7152 * out[1] + 0.0722 * out[2], hex).toBeCloseTo(1, 6);
      }
    }
    // The same hue at two brightnesses is the same grade — which is what
    // makes the table authorable by hue alone. The dim one is the bright
    // one with half the light in it, scaled where light scales; they agree
    // to about a percent, because the trip back through a hex quantises the
    // weakest channel of a dark colour coarsely.
    const dim: [number, number, number] = [0, 0, 0];
    gradeColour(taiga.shade, out);
    gradeColour(
      `#${scaleHex(Number.parseInt(taiga.shade.slice(1), 16), 0.5)
        .toString(16)
        .padStart(6, "0")}`,
      dim,
    );
    for (let i = 0; i < 3; i++) expect(dim[i]).toBeCloseTo(out[i], 1);
  });

  it("hands back the identity for a colour that cannot be normalised", () => {
    const out: [number, number, number] = [0, 0, 0];
    expect(gradeColour("#000000", out)).toEqual([1, 1, 1]);
  });
});

describe("the cold coast arrives cold, not dark", () => {
  it("cools the picture at every level of a grey ramp", () => {
    for (const v of [0x20, 0x40, 0x80, 0xb0, 0xff]) {
      expect(warmth(gradeTone(taiga, grey(v))), `grey ${v}`).toBeLessThan(-5);
    }
  });

  it("keeps mid grey's exposure — a cast is not a dimmer", () => {
    const was = luminance(grey(0x80));
    const now = luminance(gradeTone(taiga, grey(0x80)));
    expect(Math.abs(now / was - 1)).toBeLessThan(0.15);
  });

  it("lifts the blacks off the floor, where the warm coast crushes them", () => {
    // A relative claim on purpose: how FAR off the floor is a number tuned
    // by looking at a dusk shot, and an absolute threshold here would go
    // red on every retune without saying anything was wrong.
    expect(luminance(gradeTone(taiga, 0x000000))).toBeGreaterThan(0);
    expect(luminance(gradeTone(mangrove, 0x000000))).toBe(0);
    // …and it is a haze in the shadows, not a second sky: whatever the lift
    // is, the darkest thing in the picture stays darker than mid grey.
    expect(luminance(gradeTone(taiga, 0x000000))).toBeLessThan(0.18);
  });

  it("drains the colour it does not need, and keeps what the rider reads by", () => {
    // A buoy's orange is how a course is read. Drained is the look; gone is
    // a bug, so the chroma comes down and stays well clear of grey.
    const buoy = 0xff7a1a;
    const drained = gradeTone(taiga, buoy);
    expect(chroma(drained)).toBeLessThan(chroma(buoy));
    expect(chroma(drained)).toBeGreaterThan(chroma(buoy) * 0.4);
    expect(warmth(drained)).toBeGreaterThan(80);
  });

  it("is the flatter of the two coasts", () => {
    expect(taiga.contrast).toBeLessThan(1);
    expect(taiga.contrast).toBeLessThan(mangrove.contrast);
    expect(taiga.saturation).toBeLessThan(1);
    expect(taiga.lift).toBeGreaterThan(mangrove.lift);
  });
});

describe("the warm coast splits the picture", () => {
  it("runs cool in the darks and warm in the lights, crossing in between", () => {
    const dark = warmth(gradeTone(mangrove, grey(0x20)));
    const mid = warmth(gradeTone(mangrove, grey(0x80)));
    const bright = warmth(gradeTone(mangrove, grey(0xd0)));
    expect(dark).toBeLessThan(0);
    expect(bright).toBeGreaterThan(10);
    expect(mid).toBeGreaterThan(dark);
    expect(bright).toBeGreaterThan(mid);
  });

  it("puts gold on what the sun is on", () => {
    // Lit sand, which is most of what this coast's shore is.
    const sand = gradeTone(mangrove, 0xf2e2c0);
    expect(warmth(sand)).toBeGreaterThan(warmth(0xf2e2c0));
  });

  it("saturates without turning the sea another colour", () => {
    const sea = 0x2aa6b8;
    const graded = gradeTone(mangrove, sea);
    expect(chroma(graded)).toBeGreaterThan(chroma(sea));
    // Still turquoise: blue over green over red, the order it went in as.
    const [r, g, b] = bytes(graded);
    expect(b).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(r);
  });

  it("is the punchier of the two coasts", () => {
    expect(mangrove.contrast).toBeGreaterThan(1);
    expect(mangrove.saturation).toBeGreaterThan(1);
    expect(mangrove.split[0] + mangrove.split[1]).toBeGreaterThan(taiga.split[0] + taiga.split[1]);
  });
});

describe("no grade breaks the picture it is laid over", () => {
  it("leaves a ramp a ramp — a grade never inverts a brightness", () => {
    for (const id of BIOME_IDS) {
      const g = gradeOf(id);
      let last = -1;
      for (let v = 0; v <= 0xff; v += 3) {
        const now = luminance(gradeTone(g, grey(v)));
        expect(now, `${id} at ${v}`).toBeGreaterThanOrEqual(last);
        last = now;
      }
    }
  });

  it("clamps rather than reflecting: a contrast over 1 crushes the darks", () => {
    // Squaring the perceptual coordinate without clamping it first turns a
    // negative back into a positive, and a crushed black comes out LIGHTER
    // than the grey above it. `gradeTone` is monotonic above, which is the
    // test that fails first; this is the value the fault was found at.
    const punchy: ColourGrade = { ...mangrove, contrast: 1.2, lift: 0 };
    expect(luminance(gradeTone(punchy, grey(0x00)))).toBe(0);
    expect(luminance(gradeTone(punchy, grey(0x08)))).toBe(0);
  });

  it("holds a neutral grade to the identity", () => {
    const none: ColourGrade = {
      contrast: 1,
      lift: 0,
      saturation: 1,
      tint: "#808080",
      shade: "#808080",
      glow: "#808080",
      split: [0.4, 0.4],
    };
    for (const v of [0x00, 0x33, 0x80, 0xcc, 0xff]) {
      const [r, g, b] = bytes(gradeTone(none, grey(v)));
      for (const ch of [r, g, b]) expect(Math.abs(ch - v), `grey ${v}`).toBeLessThanOrEqual(1);
    }
  });
});

describe("the shader says what the model says", () => {
  const source = readFileSync(join(process.cwd(), "pwa/src/game/grade-pass.ts"), "utf8");
  /** THE SHADER ALONE. The module's header explains the pass at length and
   * names several of the things these cases look for, so a search over the
   * whole file finds the prose rather than the code. */
  const glsl = source.slice(source.indexOf("const FRAGMENT"));

  it("carries a uniform for every dial, and reads every one", () => {
    const declared = [...glsl.matchAll(/uniform\s+\w+\s+(\w+)\s*(?:\[\d+\])?\s*;/g)].map(
      (m) => m[1],
    );
    expect(declared.sort()).toEqual([
      "uContrast",
      "uGlow",
      "uLift",
      "uPicture",
      "uSaturation",
      "uShade",
      "uSplit",
      "uTint",
    ]);
    // Every one of them is used in the body, not merely declared and
    // uploaded — the trap `tests/water_shader_test.ts` was written for.
    const body = glsl.slice(glsl.indexOf("void main()"));
    for (const name of declared) expect(body, name).toContain(name);
  });

  it("pivots on the same mid grey the model does", () => {
    // Stated ONCE, as a TypeScript constant the shader interpolates, so
    // the pivot cannot drift between the two halves of one file.
    const mid = /const MID_P = "([\d.]+)";/.exec(source);
    expect(mid).not.toBeNull();
    expect(Number(mid![1])).toBeCloseTo(Math.sqrt(0.18), 6);
    expect(glsl).toContain("const float MID_P = ${MID_P};");
    expect(/vec3 LUMA = vec3\( 0\.2126, 0\.7152, 0\.0722 \)/.test(glsl)).toBe(true);
  });

  it("applies the five steps in the model's order, and clamps both times", () => {
    const at = (needle: string): number => {
      const i = glsl.indexOf(needle);
      expect(i, needle).toBeGreaterThan(-1);
      return i;
    };
    const contrast = at("* uContrast");
    const lift = at("uLift * ( 1.0 - s )");
    const saturation = at("* uSaturation");
    const tint = at("c *= uTint");
    const split = at("uSplit.x");
    expect(contrast).toBeLessThan(lift);
    expect(lift).toBeLessThan(saturation);
    expect(saturation).toBeLessThan(tint);
    expect(tint).toBeLessThan(split);
    // The two clamps the model's own cases above are written for.
    expect(glsl).toContain("s = max( s + uLift * ( 1.0 - s ), 0.0 );");
    expect(glsl).toContain("c = max( l + ( c - l ) * uSaturation, 0.0 );");
  });

  it("converts to the output's colour space on the way out", () => {
    // Every hand-written shader here does, and a pass that is the LAST
    // thing to touch the frame is the one where skipping it halves the
    // brightness of the whole picture.
    expect(glsl).toContain("#include <colorspace_fragment>");
    expect(glsl.indexOf("gl_FragColor")).toBeLessThan(
      glsl.indexOf("#include <colorspace_fragment>"),
    );
  });

  it("draws the picture at its own samples, since the canvas has none", () => {
    // The count is the device's, not a constant here (`pictureSamples` in
    // `settings-video.ts`, which `tests/video_test.ts` holds the ladder of).
    expect(source).toContain("samples: pictureSamples()");
    const renderer = readFileSync(join(process.cwd(), "pwa/src/game/renderer.ts"), "utf8");
    expect(renderer).toContain("antialias: false");
    // …and the frame goes through the pass rather than onto the canvas.
    expect(renderer).toContain("renderer.setRenderTarget(grade.target);");
  });
});
