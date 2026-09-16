// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHICH GENERATOR BUILT THIS SHORE — the level generator's versions, and
// the contract that lets a campaign level outlive a change to the rules.
//
// The problem this exists for: a level is generated fresh from its seed, so
// the rules ARE the level. Move a gate spacing, a rock's berth, a draw in
// the seeded stream, and seed 38 stops being the shore that was rated,
// timed and named — silently, everywhere, at once. The campaign is the one
// part of the game where that is not acceptable: its twelve shores were
// CURATED, and a ladder that re-rolls under its own levels is a ladder
// nobody chose — and every best time and every medal on it is a result on
// a shore that no longer exists.
//
// So a campaign level names the version it was curated under, and that
// version keeps building it. Nothing else does: the start card, every lab,
// every sweep and every test take `CURRENT_GENERATOR_VERSION` and move
// with the rules, which is the whole point of having a generator.
//
// THE CONTRACT, in four lines:
//
//   1. A change that moves what a seed builds gets a NEW version — a row
//      here, with a note saying what moved.
//   2. The old row keeps the old behaviour, through a TRAIT read at the one
//      place the behaviour differs (see `GeneratorTraits` below).
//   3. A campaign level moves to the new version DELIBERATELY: re-rated,
//      re-timed, re-named if the shore no longer earns its name — the
//      `campaign-levels.ts` header says how. Bumping every level in one
//      commit because the suite went red is the exact move this exists to
//      prevent.
//   4. A version no campaign level names any more is DELETED — the row,
//      and every trait branch that only existed for it.
//      `tests/generator_version_test.ts` refuses to let one linger.
//
// Rule 4 is the half people forget, and it is what keeps this from becoming
// a museum of every generator the game ever had. Backward compatibility is
// owed to the committed shores and to nothing else.
//
// HOW A RE-ROLL IS NOTICED. The generator has no way to know its output
// moved, so the campaign carries a DIGEST of every level it pins
// (`levelDigest`, `digest.ts`) and the suite recompiles each one and
// compares. A red `generator_version_test` is then one of two things with
// opposite fixes: a level deliberately moved (a new seed, a new sea — the
// digest was meant to change: re-curate and write the new one down), or
// the RULES moving under a level that did not (add a version here, keep
// the old behaviour on the old row, and leave the level's digest alone).

/** A generator version — a whole number that only ever counts up. */
export type GeneratorVersion = number;

/** One version of the generator: what it is, and every way it differs from
 * the current rules.
 *
 * `version` and `note` are the whole row today, because there is one
 * version and it has nothing to be different from. A LEGACY trait is added
 * here as an OPTIONAL field the moment a change first re-rolls a pinned
 * shore — `{ narrowRunUp?: boolean }`, `{ gateSpacing?: Band }` — set on
 * the old rows and absent from the current one, so the code reads
 *
 *     const traits = generatorTraits(opts.version);
 *     const runUp = traits.narrowRunUp ? OLD : R.ramp.runUp;
 *
 * at the ONE place the behaviour differs and nowhere else. Absent means
 * "build it the way the rules say", which is what makes the current row's
 * branch the one the reader sees first.
 *
 * A trait is never a dial. Dials are `GenerateOptions` and a player turns
 * them on a FREE ride; a trait is a fossil kept alive for as long as a
 * curated shore stands on it, and it goes in the ground with its version. */
export type GeneratorTraits = {
  version: GeneratorVersion;
  /** One line on what this version of the generator is. On a legacy row,
   * what the version AFTER it changed — which is what tells the next
   * session whether the row is still earning its keep. */
  note: string;
};

/** Every version the generator can still build, oldest first.
 *
 * The last row is the rules as they stand in this tree; everything above it
 * is a fossil, alive only because a campaign level still names it. */
export const GENERATOR_VERSIONS: readonly GeneratorTraits[] = [
  {
    version: 1,
    note: "The generator as the campaign's twelve shores were curated on it.",
  },
];

/** What a level is built by unless something pins it to an older set of
 * rules. Every entry point that is not a campaign level lands here. */
export const CURRENT_GENERATOR_VERSION: GeneratorVersion =
  GENERATOR_VERSIONS[GENERATOR_VERSIONS.length - 1].version;

/** The versions this build can still be asked for, as a list — the check
 * `generateLevel` makes, and the one a test walks. */
export const GENERATOR_VERSION_IDS: readonly GeneratorVersion[] = GENERATOR_VERSIONS.map(
  (row) => row.version,
);

export function isGeneratorVersion(value: unknown): value is GeneratorVersion {
  return typeof value === "number" && GENERATOR_VERSION_IDS.includes(value);
}

/** The rules a version builds by. A version this build has never heard of —
 * a stale link, a save from a tree where the row still existed — is the
 * CURRENT one rather than an error: the shore will not be the one that
 * save remembers, and there is no version of this code that could make it
 * be. */
export function generatorTraits(version: GeneratorVersion | undefined): GeneratorTraits {
  return (
    GENERATOR_VERSIONS.find((row) => row.version === version) ??
    GENERATOR_VERSIONS[GENERATOR_VERSIONS.length - 1]
  );
}
