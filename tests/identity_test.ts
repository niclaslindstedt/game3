// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// ONE IDENTITY MANIFEST (OSS_GAME_SPEC §35.6): the name, the URLs and the
// colours live in `pwa/src/identity.ts`, and every surface that cannot
// import it — the static HTML head, the SEO files under `pwa/public/`, the
// icon generator, the package manifests, the README's play link — restates
// them. This holds every restatement to the manifest, so a rename or a
// domain move is one edit and a failing test naming the copies, not an
// archaeology expedition.
//
// The other half is the sibling: this repository was bootstrapped from a
// rally game with the same shape, and the surest way for its name to leak
// in is a copied file nobody re-read. So the other game's name is refused
// wherever a player or a store could read it.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  APP_DESCRIPTION,
  APP_NAME,
  APP_SHORT_NAME,
  APP_TITLE,
  PALETTE,
  PUBLISHER,
  REPO_URL,
  SITE_URL,
} from "../pwa/src/identity.ts";
import { cacheIdForBase } from "../pwa/src/app-pwa.ts";

const ROOT = process.cwd();
const read = (rel: string): string => readFileSync(join(ROOT, rel), "utf8");

const html = read("pwa/index.html");
const readme = read("README.md");

/** The content of every `<meta … name|property="key" content="…">`. */
function metas(key: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<meta\s+[^>]*>/g)) {
    const tag = m[0];
    const k = /(?:name|property)="([^"]+)"/.exec(tag)?.[1];
    const v = /content="([^"]*)"/.exec(tag)?.[1];
    if (k === key && v !== undefined) out.push(v);
  }
  return out;
}

describe("the manifest itself", () => {
  it("is well-formed", () => {
    expect(APP_NAME.trim()).toBe(APP_NAME);
    expect(APP_NAME.length).toBeGreaterThan(2);
    expect(APP_TITLE).toContain(APP_NAME);
    // A launcher cuts a home-screen name at about twelve characters.
    expect(APP_SHORT_NAME.length).toBeLessThanOrEqual(12);
    expect(APP_SHORT_NAME).not.toMatch(/\s/);
    expect(PUBLISHER.length).toBeGreaterThan(0);
    expect(APP_DESCRIPTION.length).toBeGreaterThan(40);
    expect(SITE_URL).toMatch(/^https:\/\/[^/]+$/);
    expect(REPO_URL).toMatch(/^https:\/\/github\.com\/[^/]+\/[^/]+$/);
    for (const [name, hex] of Object.entries(PALETTE)) {
      expect(hex, `PALETTE.${name}`).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe("the static head and the prerendered copy (pwa/index.html)", () => {
  it("names the app and the site", () => {
    expect(/<title>([^<]*)<\/title>/.exec(html)?.[1]).toContain(APP_NAME);
    expect(html).toContain(`<link rel="canonical" href="${SITE_URL}/" />`);
    expect(metas("og:site_name")).toEqual([APP_NAME]);
    expect(metas("og:url")).toEqual([`${SITE_URL}/`]);
    for (const key of ["og:image", "twitter:image"]) {
      for (const v of metas(key)) expect(v, key).toMatch(new RegExp(`^${SITE_URL}/`));
    }
    expect(metas("description").length).toBe(1);
    expect(html).toContain(`<h1>${APP_NAME}</h1>`);
    expect(html).toContain(`href="${SITE_URL}/"`);
    expect(html).toContain(`href="${REPO_URL}"`);
  });

  it("carries the brand colour the manifest states", () => {
    for (const v of metas("theme-color")) expect(v).toBe(PALETTE.sea);
  });

  it("says the same thing in JSON-LD", () => {
    const blocks = [
      ...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g),
    ].map((m) => JSON.parse(m[1]) as Record<string, unknown>);
    expect(blocks.length).toBeGreaterThanOrEqual(2);
    for (const block of blocks) {
      expect(block.name).toBe(APP_NAME);
      expect(block.url).toBe(`${SITE_URL}/`);
      expect(block.sameAs).toEqual([REPO_URL]);
    }
    const game = blocks.find((b) => b["@type"] === "VideoGame")!;
    expect(game).toBeDefined();
    expect((game.publisher as { name: string }).name).toBe(PUBLISHER);
    expect(game.image).toBe(`${SITE_URL}/og.png`);
  });
});

describe("the discovery files (pwa/public)", () => {
  it("CNAME is the site's host", () => {
    expect(read("pwa/public/CNAME").trim()).toBe(new URL(SITE_URL).host);
  });

  it("robots.txt points at the site's sitemap", () => {
    expect(read("pwa/public/robots.txt")).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`);
  });

  it("every sitemap entry is on the site, and the root is one of them", () => {
    const locs = [...read("pwa/public/sitemap.xml").matchAll(/<loc>([^<]+)<\/loc>/g)].map(
      (m) => m[1],
    );
    expect(locs).toContain(`${SITE_URL}/`);
    for (const loc of locs) expect(loc).toMatch(new RegExp(`^${SITE_URL}/`));
  });

  it("llms.txt opens with the name and links the site and the source", () => {
    const llms = read("pwa/public/llms.txt");
    expect(llms.split("\n")[0]).toBe(`# ${APP_NAME}`);
    expect(llms).toContain(`${SITE_URL}/`);
    expect(llms).toContain(REPO_URL);
  });
});

describe("the restatements that cannot import the manifest", () => {
  it("the README's title and play link are the manifest's", () => {
    expect(readme.split("\n")[0]).toBe(`# ${APP_NAME}`);
    expect(readme).toContain(`[Play it now](${SITE_URL}/)`);
    expect(readme).toContain(REPO_URL);
  });

  it("both package manifests describe this app", () => {
    for (const rel of ["package.json", "pwa/package.json"]) {
      const pkg = JSON.parse(read(rel)) as { description?: string };
      expect(pkg.description, rel).toContain(APP_NAME);
    }
  });

  it("the icon generator paints the manifest's palette", () => {
    // It draws in plain Node with no bundler and restates the hexes it
    // needs; a palette change that skips it ships icons in the old colours.
    const gen = read("scripts/generate-icons.mjs");
    for (const name of ["sea", "seaDeep", "seaShallow", "foam", "buoy", "hudShadow"] as const) {
      expect(gen, `PALETTE.${name} (${PALETTE[name]})`).toContain(PALETTE[name]);
    }
  });

  it("the service worker's cache id is this app's, per slot", () => {
    expect(cacheIdForBase("/")).toMatch(/^sea-haven/);
    expect(cacheIdForBase("/preview/")).not.toBe(cacheIdForBase("/"));
    expect(cacheIdForBase("/branch/")).not.toBe(cacheIdForBase("/preview/"));
  });
});

describe("the sibling game's name stays in the sibling game", () => {
  const surfaces = [
    "pwa/index.html",
    "pwa/public/llms.txt",
    "pwa/public/robots.txt",
    "pwa/public/sitemap.xml",
    "pwa/src/identity.ts",
    "pwa/src/app-pwa.ts",
    "package.json",
    "pwa/package.json",
    "README.md",
  ];
  for (const rel of surfaces) {
    it(`${rel} never names it`, () => {
      const text = read(rel);
      expect(text).not.toMatch(/Scandinavian Flick/i);
      expect(text).not.toMatch(/scandi-flick/i);
      expect(text).not.toMatch(/\bgame2\b/);
    });
  }
});
