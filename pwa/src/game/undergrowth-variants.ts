// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE UNDERGROWTH, AS DATA — every row of the cover roster that is NOT a
// tree: the bushes (a willow's dome, a juniper's column, the maquis, the
// arctic's cushions and mats), the tufts of grass, the reeds and the loose
// stone (the shingle, the shell, the pebbles, the stranded ice, the snow),
// the numbers the code's builder (`flora-shapes.ts`) draws each FORM with,
// and FOUR VARIANTS of every kind, which is what the Blender builder models
// (`scripts/blender/undergrowth.py`, handed all of it as one JSON file by
// `make blender KIND=undergrowth`) and what `flora.ts` stands a coast's
// scrub out of when the models are drawn (`tree-models.ts`, which carries
// the undergrowth's models beside the trees'). The trees' own table is
// `tree-variants.ts`; this is its opposite number, three-free for the same
// reason: the suite, the driver and the stamp read every row.
//
// WHY FOUR, AND NOT SIX. A shore plants thousands of these to a few hundred
// trees, and every variant of a kind is a mesh of its own and so a draw
// call a pass (`flora.ts`): four shapes is what keeps a heath from reading
// as one mat stamped without doubling the shore's draws again. There is no
// far band either — nothing here stands over a rider's head, so a species'
// reach (`coverReach`) closes long before a sketch would pay.
//
// THE NUMBERS ARE THE CODE'S. `UNDER_SHAPE` is every proportion the code's
// builder draws a bush, a tuft, a reed or a stone with — lifted out of
// `flora-shapes.ts`, which reads it from here, so the model and the code
// cannot disagree about what a heather mat is. A variant row is a DEPARTURE
// from its species' own look, never a restatement: its spread and its
// height are shares of the row's, its stems the row's unless it says. And
// the departures are the FORM's rather than the kind's: a bush is a bush
// whether it is a sallow or a sage, and what makes one variant differ from
// the next — squatter, sparser, wind-laid, split — is the same on every row
// of the form. Variant 0 is always the row's own plant.

import { FLORA, type FloraForm, type FloraSpec } from "./flora-defs.ts";

/** The forms that are undergrowth — modelled, and drawn off the models. */
export const UNDER_FORMS = ["bush", "tuft", "reed", "stone"] as const;
export type UnderForm = (typeof UNDER_FORMS)[number];

export function isUnderForm(form: FloraForm): form is UnderForm {
  return (UNDER_FORMS as readonly string[]).includes(form);
}

/** Every row of the roster that is undergrowth, in roster order — a KIND
 * each, one modelled glTF each (`pwa/models/undergrowth/<kind>.glb`). */
export const UNDER_KINDS: readonly string[] = FLORA.filter((s) => isUnderForm(s.look.form)).map(
  (s) => s.id,
);

/** A kind's row of the roster. */
export function underSpec(kind: string): FloraSpec {
  const spec = FLORA.find((s) => s.id === kind);
  if (!spec || !isUnderForm(spec.look.form)) throw new Error(`no undergrowth kind "${kind}"`);
  return spec;
}

/** How many variants every kind has, and how many of them the shore draws. */
export const UNDER_VARIANTS = 4;

/**
 * EVERY PROPORTION THE CODE'S BUILDER DRAWS THE UNDERGROWTH WITH, in the
 * unit frame (shares of the height; a plan distance is a share of the
 * height times the row's `spread`). `flora-shapes.ts` builds from these and
 * the Blender builder models from them; the wobble the code adds to one
 * plant of a species (`wob`) is the code's own and stays there.
 */
export const UNDER_SHAPE = {
  bush: {
    /** A stem under the foliage where the row's `bare` is over `gate`: to
     * `tall` times the bare share, at these radii. */
    stem: { gate: 0.02, tall: 1.6, r: [0.022, 0.014] },
    /** The masses, on a disc `drift` of the spread across: stacked from
     * `low` over `span` of the height (jogged by `jog` either way), each
     * `radius` of the spread across (times `vary[0]` and up to `vary[1]`
     * more), narrower by `narrow` at the top; `tall` times as high as wide,
     * to a cap of `cap`; `depth` as deep as wide. */
    drift: 0.3,
    low: 0.26,
    span: 0.54,
    jog: 0.12,
    radius: 0.34,
    vary: [0.78, 0.44],
    narrow: 0.3,
    tall: 1.4,
    cap: 0.3,
    depth: 0.94,
    /** How many facets a row is worth: a plant under `small` metres gets
     * the first set, anything taller the second. */
    small: 1.5,
    facets: [
      { sides: 5, stacks: 2, masses: 3 },
      { sides: 6, stacks: 3, masses: 4 },
    ],
  },
  tuft: {
    /** The blades stand on a disc `disc` of the spread's radius, each
     * `height[0]` (and up to `height[1]` more) tall, bent over by `bend[0]`
     * (and up to `bend[1]` more) of its height, `half` of the spread wide at
     * the foot, its yaw off its bearing by up to `yaw` either way; painted
     * from the dark to `lit` of the way to the lit, the tip from `tipFrom`. */
    disc: 0.92,
    height: [0.5, 0.5],
    bend: [0.16, 0.42],
    half: 0.062,
    yaw: 1.2,
    lit: 0.85,
    tipFrom: 0.99,
  },
  reed: {
    /** The stems, straighter and more even than a tuft's: `height[0]` (and
     * up to `height[1]` more) tall — stopping short so the plume tops out
     * at the unit — bent by `bend[0]` (and up to `bend[1]`), `half` of the
     * spread wide; the colour turning at `tipFrom`. */
    disc: 0.92,
    height: [0.54, 0.23],
    bend: [0.04, 0.06],
    half: 0.042,
    yaw: 1.2,
    tipFrom: 0.7,
    /** THE PLUME on every stem's tip: `tall` of the stem again, `half` of
     * the spread wide, bent `bend` times as far. */
    plume: { tall: 0.3, half: 0.038, bend: 1.6 },
  },
  stone: {
    /** One squashed lump: its centre `at` up, `rx` and `rz` of the spread
     * across, `ry` tall, at these facets. The placer buries it to its waist. */
    at: 0.5,
    rx: 0.5,
    ry: 0.5,
    rz: 0.44,
    sides: 5,
    stacks: 3,
  },
} as const;

/** A bush: a mound of foliage on a disc, a stem under it where the row
 * stands one. */
export type BushShape = {
  readonly form: "bush";
  /** The mound's outline: −1 a column (a juniper) … 0 the code's masses … 1
   * a flat mat (a heath). */
  readonly dome: number;
  /** How many masses make the mound, 1 the code's count. */
  readonly masses: number;
  /** How much of the mound is air between the masses, 0 dense … 1 open. */
  readonly open: number;
  /** How ragged the outline is, 0 even … 1 a straggle of shoots. */
  readonly rough: number;
  /** The masses pushed to the lee, 0 round … 1 all on one side. */
  readonly flag: number;
};

/** A tuft: a clump of blades. */
export type TuftShape = {
  readonly form: "tuft";
  /** Every blade laid over to +x by the wind, rad. */
  readonly lean: number;
  /** How much of the clump is missing, 0 the row's stems … 1 a few blades. */
  readonly sparse: number;
  /** A seed head on the tip of a blade, this share of them — drawn in the
   * row's upper colour (a cotton grass's white). */
  readonly heads: number;
};

/** A reed: straight stems under plumes. */
export type ReedShape = {
  readonly form: "reed";
  readonly lean: number;
  readonly sparse: number;
  /** This share of the stems have lost their plume — a bed after a storm. */
  readonly broken: number;
};

/** A stone: a lump the placer half-buries. */
export type StoneShape = {
  readonly form: "stone";
  /** 0 the code's lump … 1 a flat slab. */
  readonly flat: number;
  /** 0 rounded … 1 an angular block. */
  readonly angular: number;
  /** Two lumps out of one foot. */
  readonly split: boolean;
};

export type UnderShape = BushShape | TuftShape | ReedShape | StoneShape;

export type UnderVariant = {
  readonly kind: string;
  readonly index: number;
  /** What the sheet calls it. */
  readonly name: string;
  /** Its plan spread and its height, shares of the row's. */
  readonly spread: number;
  readonly top: number;
  /** How many stems (blades, or masses' worth), the row's own unless the
   * variant says; and how much of the height stands bare under a bush. */
  readonly stems: number;
  readonly bare: number;
  readonly shape: UnderShape;
};

type Departure = {
  readonly name: string;
  readonly spread?: number;
  readonly top?: number;
  readonly stems?: number;
  readonly bare?: number;
};

const bu = (o: Partial<BushShape> = {}): BushShape => ({
  form: "bush",
  dome: 0,
  masses: 1,
  open: 0.2,
  rough: 0.3,
  flag: 0,
  ...o,
});
const tu = (o: Partial<TuftShape> = {}): TuftShape => ({
  form: "tuft",
  lean: 0,
  sparse: 0,
  heads: 0,
  ...o,
});
const re = (o: Partial<ReedShape> = {}): ReedShape => ({
  form: "reed",
  lean: 0,
  sparse: 0,
  broken: 0,
  ...o,
});
const st = (o: Partial<StoneShape> = {}): StoneShape => ({
  form: "stone",
  flat: 0,
  angular: 0,
  split: false,
  ...o,
});

/** Each FORM's four: the row's own first, then three departures every kind
 * of the form shares. */
const ROWS: Readonly<Record<UnderForm, readonly (readonly [Departure, UnderShape])[]>> = {
  bush: [
    [{ name: "the row's own" }, bu()],
    [
      { name: "squat and wide", spread: 1.25, top: 0.85 },
      bu({ dome: 0.6, masses: 1.3, open: 0.1 }),
    ],
    [
      { name: "straggling", spread: 0.9, top: 1.05 },
      bu({ dome: -0.4, masses: 1.2, open: 0.45, rough: 0.8 }),
    ],
    [{ name: "wind-cut", top: 0.9 }, bu({ dome: 0.2, flag: 0.7, rough: 0.5 })],
  ],
  tuft: [
    [{ name: "the row's own" }, tu()],
    [{ name: "wind-laid", top: 0.95 }, tu({ lean: 0.55 })],
    [{ name: "thin clump", spread: 0.85, top: 0.9 }, tu({ sparse: 0.45 })],
    [{ name: "in seed", top: 1.05 }, tu({ heads: 0.6, lean: 0.15 })],
  ],
  reed: [
    [{ name: "the row's own" }, re()],
    [{ name: "leaning bed", top: 0.95 }, re({ lean: 0.35 })],
    [{ name: "thin stand", spread: 0.85, top: 0.92 }, re({ sparse: 0.4 })],
    [{ name: "storm-broken", top: 0.9 }, re({ broken: 0.5, lean: 0.15 })],
  ],
  stone: [
    [{ name: "the row's own" }, st()],
    [{ name: "flat slab", spread: 1.3, top: 0.7 }, st({ flat: 0.8 })],
    [{ name: "angular block", spread: 0.9, top: 1.1 }, st({ angular: 0.9 })],
    [{ name: "split pair", spread: 1.2, top: 0.85 }, st({ split: true, angular: 0.3 })],
  ],
};

/** Every kind's four, the row's look filled in. */
export const UNDER_ROWS: Readonly<Record<string, readonly UnderVariant[]>> = (() => {
  const out: Record<string, readonly UnderVariant[]> = {};
  for (const kind of UNDER_KINDS) {
    const look = underSpec(kind).look;
    out[kind] = ROWS[look.form as UnderForm].map(([d, shape], index): UnderVariant => ({
      kind,
      index,
      name: d.name,
      spread: d.spread ?? 1,
      top: d.top ?? 1,
      stems: d.stems ?? look.stems,
      bare: d.bare ?? look.bare,
      shape,
    }));
  }
  return out;
})();
