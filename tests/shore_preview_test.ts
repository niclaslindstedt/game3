// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CARDS' PREVIEWS: the layouts the level boxes stroke, and the banners
// hung behind a shore row.
//
// Both are GENERATED and COMMITTED — `make previews` builds them from the
// game, because deriving one at runtime costs a second or more a shore. That
// is the whole reason this file exists: committed output of a generator goes
// stale the moment the generator's rules move, silently, and a stale layout
// is a picture of water nobody rides any more. The staleness case below
// rebuilds one shore of each coast and holds the committed bytes to it.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { levelDigest } from "@engine";
import { describe, expect, it } from "vitest";

import { COAST_SHOTS } from "../pwa/src/game/coast-shots.ts";
import { SHORES, buildCampaignLevel } from "../pwa/src/game/campaign.ts";
// `routeOf` is the very encoder `make routes` writes the committed bytes
// with, read off the module that also decodes them — a second implementation
// here would test the copy rather than the shipped data.
import { ROUTE_STROKE, coastShot, routeOf, routeShape } from "../pwa/src/game/shore-preview.ts";
import { SHORE_ROUTES } from "../pwa/src/game/shore-routes.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const LEVELS = SHORES.flatMap((shore) => shore.levels);

/** What to run when this file fails, since the fix is never an edit here.
 *
 * With a level naming the generator that built it (`mapgen/versions.ts`), a
 * stale layout is TWO different failures wearing one message, and they have
 * opposite fixes:
 *
 *   * the LEVEL moved — a new seed, a new swell, a different track, or a
 *     deliberate move onto a newer generator version. Regenerate; the
 *     picture was meant to change.
 *   * the RULES moved under a level that did not. The layout is collateral:
 *     the seed is no longer the water that was rated, timed and named.
 *     Regenerating hides it. Add a version in `engine/mapgen/versions.ts`
 *     and keep the old behaviour on the old row, or move the levels onto the
 *     new version as a curation (`level-rating`, `campaign`) — and then
 *     regenerate. */
const REGENERATE = "run `make routes` — but read this file's header first";
/** The banners need a build and a Chromium, so they are worth naming apart. */
const REBANNER = "run `make build && make coasts`";

describe("shore layouts", () => {
  it("ships one for every pinned level", () => {
    const missing = LEVELS.map((level) => level.id).filter((id) => SHORE_ROUTES[id] === undefined);
    expect(missing, `no layout for ${missing.join(", ")} — ${REGENERATE}`).toEqual([]);
  });

  it("carries no layout for a level the campaign no longer has", () => {
    const known = new Set(LEVELS.map((level) => level.id));
    const orphans = Object.keys(SHORE_ROUTES).filter((id) => !known.has(id));
    expect(orphans, `stale layout for ${orphans.join(", ")} — ${REGENERATE}`).toEqual([]);
  });

  it("was drawn from the water each level names TODAY", () => {
    // Every level, not just the two the case below rebuilds: a level's own
    // seed or swell is edited far more often than the generator's rules are,
    // and it re-rolls exactly ONE layout rather than all of them — so the
    // rebuild check would sail past a re-seeded `taiga-3` forever. The stored
    // spec makes that a comparison rather than a build, which is what lets it
    // cover every level for free.
    for (const level of LEVELS) {
      const stored = SHORE_ROUTES[level.id];
      expect(stored, level.id).toBeDefined();
      expect(stored.spec, `${level.id} was drawn from other water — ${REGENERATE}`).toEqual({
        seed: level.seed,
        track: level.track,
        // R35's field is laid at BUILD time, so the same seed asked for ramps
        // is not the same shore — and not the same line.
        tricks: level.mode === "tricks",
        // R36 — the groundswell is part of how the course was drawn.
        swell: level.swell,
        // ...and WHICH GENERATOR built it, with the DIGEST of what came out.
        // This is the cheap half of the staleness check and it covers every
        // level: one MOVED to a newer generator is new water under an old
        // picture, and the rebuild below only looks at one shore of each.
        version: level.version,
        digest: level.digest,
      });
    }
  });

  it("decodes to a path inside the box it declares", () => {
    for (const level of LEVELS) {
      const shape = routeShape(level.id);
      expect(shape, level.id).not.toBeNull();
      if (!shape) continue;
      // Every coordinate in the `d`, against the viewBox it is drawn in. A
      // path that leaves its own box is a shore drawn with a corner cut off,
      // which is exactly the kind of thing that looks deliberate.
      const numbers = shape.d.match(/-?\d+(\.\d+)?/g) ?? [];
      expect(numbers.length, `${level.id} has no points`).toBeGreaterThanOrEqual(4);
      for (let i = 0; i < numbers.length; i += 2) {
        expect(Number(numbers[i]), `${level.id} x`).toBeGreaterThanOrEqual(0);
        expect(Number(numbers[i]), `${level.id} x`).toBeLessThanOrEqual(shape.width);
        expect(Number(numbers[i + 1]), `${level.id} y`).toBeGreaterThanOrEqual(0);
        expect(Number(numbers[i + 1]), `${level.id} y`).toBeLessThanOrEqual(shape.height);
      }
      // The ride keeps its proportions, so one side is the full grid and the
      // other is shorter — never both stretched to a square.
      const longest = Math.max(shape.width, shape.height) - ROUTE_STROKE;
      expect(longest, `${level.id} is not fitted to its box`).toBeGreaterThan(200);
    }
  });

  it("still matches what the generator builds", () => {
    // ONE SHORE OF EACH COAST — the first rung of each, which are the
    // cheapest levels in the campaign. Any change to the generator re-rolls
    // EVERY layout, so checking one a coast catches it as surely as checking
    // all of them and keeps the rest of the builds off the suite's path.
    //
    // THIS IS THE CASE THAT NOTICES A GENERATOR CHANGE REACHING THE CAMPAIGN,
    // and it is the enforcement behind the version scheme: the pin in
    // `campaign-levels.ts` is a label until something builds the shore and
    // compares the bytes. When this goes red, the question is which of the
    // two failures in REGENERATE's note it is.
    //
    // Compared as the ENCODED BYTES, through the very function the tool
    // writes them with. Comparing only the bounding box's aspect would be a
    // check on the ride's PROPORTIONS rather than its shape: a course can be
    // re-drawn corner for corner and keep the box it fits in. The bytes
    // cannot be stale and equal.
    for (const shore of SHORES) {
      const level = shore.levels[0];
      const built = buildCampaignLevel(level);
      const stored = SHORE_ROUTES[level.id];
      expect(stored, level.id).toBeDefined();
      const fresh = routeOf(built);
      expect(stored.d, `${level.id} layout is stale — ${REGENERATE}`).toBe(fresh.d);
      expect(stored.aspect, `${level.id} aspect is stale — ${REGENERATE}`).toBe(fresh.aspect);
      expect(levelDigest(built), `${level.id} no longer builds to its pin`).toBe(level.digest);
    }
  });
});

describe("coast banners", () => {
  it("ships one for every shore the campaign runs", () => {
    for (const shore of SHORES) {
      const file = join(root, `pwa/public/previews/coast-${shore.id}.jpg`);
      expect(existsSync(file), `no banner for ${shore.id} — ${REBANNER}`).toBe(true);
      // Big enough that the shutter did not open on an empty frame, and
      // small enough to be worth a card: both are fetched before either row
      // is pressed.
      const bytes = readFileSync(file).length;
      expect(bytes, `${shore.id} banner is suspiciously small`).toBeGreaterThan(4_000);
      expect(bytes, `${shore.id} banner is too heavy for a menu row`).toBeLessThan(120_000);
    }
  });

  it("is a picture of the level that shore STILL opens on", () => {
    // The one check that catches a level edit reaching the banners. A banner
    // is a render of the shore's FIRST level under that level's own day, so
    // re-seeding it — or moving it to another hour, season, sky, wind or
    // swell — makes the picture wrong: water nobody rides, lit for a day the
    // level is no longer set in. There is no recomputing a JPEG to notice,
    // so the shot's own receipt is what notices.
    for (const shore of SHORES) {
      const level = shore.levels[0];
      const shot = COAST_SHOTS[shore.id];
      expect(shot, `no shot recorded for ${shore.id} — ${REBANNER}`).toBeDefined();
      const { scene, camera, ...ofTheLevel } = shot;
      expect(ofTheLevel, `${shore.id}'s banner is of another level — ${REBANNER}`).toEqual({
        level: level.id,
        seed: level.seed,
        hour: level.hour,
        season: level.season,
        weather: level.weather,
        wind: level.wind,
        swell: level.swell,
      });
      // The lab's own two dials are recorded rather than checked — they are
      // the shot's framing and nothing in the tree decides them. Held only to
      // being SAID, so a banner reshot from another seat leaves a receipt.
      expect(scene.length, `${shore.id} records no scene — ${REBANNER}`).toBeGreaterThan(0);
      expect(camera.length, `${shore.id} records no camera — ${REBANNER}`).toBeGreaterThan(0);
    }
  });

  it("carries no shot for a shore the campaign no longer runs", () => {
    const run = new Set<string>(SHORES.map((shore) => shore.id));
    const orphans = Object.keys(COAST_SHOTS).filter((id) => !run.has(id));
    expect(orphans, `stale banner for ${orphans.join(", ")} — ${REBANNER}`).toEqual([]);
  });

  it("is named under whichever base the site is deployed on", () => {
    // The preview slot is a nested deploy, and the desktop and store shells
    // serve the site off a scheme of their own. A banner addressed from the
    // root would 404 on all three.
    for (const base of ["/", "/preview/", "game://localhost/"]) {
      expect(coastShot("arctic", base)).toBe(`${base}previews/coast-arctic.jpg`);
    }
  });

  it("names a file that is actually there", () => {
    for (const shore of SHORES) {
      const url = coastShot(shore.id, "/");
      expect(existsSync(join(root, "pwa/public", url)), url).toBe(true);
    }
  });
});
