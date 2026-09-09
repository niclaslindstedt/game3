#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Structural SEO assertions (OSS_GAME_SPEC §11.3) over the built site in
// pwa/dist/. Errors exit 1 and block CI; run with `npm run check:seo` after
// a build. The shape is the sibling rally repo's, widened to what §11.3.9
// lists: a prerendered body, one h1, the robots meta, the share image's
// dimensions and alt, every JSON-LD block parsing, the sitemap covering every
// page and the crawler files agreeing with it.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join, relative } from "node:path";

const dist = join(process.cwd(), "pwa", "dist");
const failures = [];

function assert(cond, message) {
  if (!cond) failures.push(message);
}

assert(existsSync(dist), "pwa/dist/ missing — run `npm run build` first");

const indexPath = join(dist, "index.html");
assert(existsSync(indexPath), "dist/index.html missing");
const html = existsSync(indexPath) ? readFileSync(indexPath, "utf8") : "";

const attr = (re) => re.exec(html)?.[1];
const meta = (name) =>
  attr(new RegExp(`<meta\\s+(?:name|property)="${name}"\\s+content="([^"]*)"`)) ??
  attr(new RegExp(`<meta\\s+content="([^"]*)"\\s+(?:name|property)="${name}"`));

// Head signals (§11.3.2).
const title = attr(/<title>([^<]*)<\/title>/) ?? "";
assert(title.length >= 5, "missing or empty <title>");
assert(title.length <= 70, `<title> is ${title.length} chars (max 70)`);
const description = meta("description") ?? "";
assert(description.length > 0, "missing meta description");
assert(description.length <= 160, `meta description is ${description.length} chars (max 160)`);
assert(/<html[^>]*\slang="/.test(html), "missing lang on <html>");
assert(
  /<link rel="canonical" href="https:\/\/[^"]+"/.test(html),
  "missing absolute canonical link",
);
assert(/index,\s*follow/.test(meta("robots") ?? ""), "robots meta must index,follow the game page");
assert(meta("referrer") === "strict-origin-when-cross-origin", "missing referrer meta");
assert(html.includes('rel="sitemap"'), "missing <link rel=sitemap>");
assert(meta("og:type") === "website", "og:type must be website");
for (const key of [
  "og:title",
  "og:description",
  "og:url",
  "og:image",
  "og:site_name",
  "og:locale",
]) {
  assert(meta(key), `missing ${key}`);
}
assert(meta("og:image:width") === "1200", "og:image:width must be 1200");
assert(meta("og:image:height") === "630", "og:image:height must be 630");
assert(meta("og:image:alt"), "missing og:image:alt");
assert(meta("twitter:card") === "summary_large_image", "twitter:card must be summary_large_image");
for (const key of ["twitter:title", "twitter:description", "twitter:image", "twitter:image:alt"]) {
  assert(meta(key), `missing ${key}`);
}
assert(
  /<meta name="theme-color"[^>]*media="\(prefers-color-scheme: light\)"/.test(html) &&
    /<meta name="theme-color"[^>]*media="\(prefers-color-scheme: dark\)"/.test(html),
  "theme-color must carry light and dark media variants",
);
assert(html.includes('rel="manifest"'), "missing manifest link (PWA)");
assert(html.includes("apple-touch-icon"), "missing apple-touch-icon link");
assert(
  html.includes('name="apple-mobile-web-app-capable"'),
  "missing apple-mobile-web-app-capable",
);

// The prerendered body (§11.3.1): real words, one h1, no skipped levels.
const body = /<body[^>]*>([\s\S]*)<\/body>/.exec(html)?.[1] ?? "";
const words = body
  .replace(/<script[\s\S]*?<\/script>/g, "")
  .replace(/<[^>]+>/g, " ")
  .trim()
  .split(/\s+/)
  .filter(Boolean);
assert(words.length >= 20, `prerendered body has ${words.length} words (min 20)`);
const h1s = body.match(/<h1[\s>]/g) ?? [];
assert(h1s.length === 1, `expected exactly one <h1>, found ${h1s.length}`);
let lastLevel = 0;
for (const m of body.matchAll(/<h([1-6])[\s>]/g)) {
  const level = Number(m[1]);
  assert(level <= lastLevel + 1, `heading level skips from h${lastLevel} to h${level}`);
  lastLevel = level;
}
for (const img of body.matchAll(/<img\b[^>]*>/g)) {
  for (const need of ["alt", "width", "height", "loading"]) {
    assert(new RegExp(`\\s${need}=`).test(img[0]), `<img> lacks ${need}: ${img[0].slice(0, 60)}`);
  }
}
assert(/<a href="https:\/\/github\.com\//.test(body), "body must link the repository");

// The og:image the meta points at must actually ship.
const og = meta("og:image");
if (og) {
  const file = og.split("/").pop();
  assert(existsSync(join(dist, file)), `og:image points at ${file}, which is not in dist/`);
}

// JSON-LD (§11.3.3): every block parses and names a type; the game's image
// agrees with og:image, and the site is in the graph.
const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
assert(blocks.length > 0, "missing JSON-LD block");
let game = null;
let site = null;
for (const [, ld] of blocks) {
  try {
    const doc = JSON.parse(ld);
    assert(typeof doc["@type"] === "string", "a JSON-LD block sets no @type");
    if (doc["@type"] === "VideoGame") game = doc;
    if (doc["@type"] === "WebSite") site = doc;
  } catch {
    failures.push("a JSON-LD block does not parse as JSON");
  }
}
assert(game, "JSON-LD lost its VideoGame block");
assert(site, "JSON-LD lacks a WebSite block");
if (game) {
  assert(
    game.image && og && game.image.endsWith(og.split("/").pop()),
    "JSON-LD image drifted from og:image",
  );
  assert(game.offers?.price === "0", "JSON-LD offers must state the price (0)");
  assert(
    Array.isArray(game.sameAs) && game.sameAs.some((u) => u.includes("github.com/")),
    "JSON-LD sameAs must name the repository",
  );
}

// Crawler files (§11.3.6).
for (const f of ["robots.txt", "sitemap.xml", "llms.txt"]) {
  assert(existsSync(join(dist, f)), `${f} missing from dist/`);
}
const read = (f) => (existsSync(join(dist, f)) ? readFileSync(join(dist, f), "utf8") : "");
const llms = read("llms.txt");
assert(/^# /.test(llms), "llms.txt must start with `# Site title`");
assert(/^> /m.test(llms), "llms.txt must carry a `> description` line");
const robots = read("robots.txt");
assert(/^Sitemap: https:\/\//m.test(robots), "robots.txt must advertise the sitemap");
assert(!/^Disallow: \/\s*$/m.test(robots), "robots.txt must not Disallow: /");
const sitemap = read("sitemap.xml");
const listed = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const canonical = attr(/<link rel="canonical" href="([^"]+)"/) ?? "";
assert(listed.includes(canonical), `sitemap.xml does not list the canonical ${canonical}`);
const lastmods = sitemap.match(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/g) ?? [];
assert(lastmods.length === listed.length, "every sitemap entry needs a dated <lastmod>");
// Every indexable HTML page in the build is in the sitemap, by its route.
function htmlFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...htmlFiles(full));
    else if (entry.name.endsWith(".html")) out.push(full);
  }
  return out;
}
if (existsSync(dist)) {
  for (const file of htmlFiles(dist)) {
    const rel = relative(dist, file).split("\\").join("/");
    if (rel === "404.html") continue;
    const page = readFileSync(file, "utf8");
    if (/<meta name="robots" content="[^"]*noindex/.test(page)) continue;
    const route = rel === "index.html" ? "" : rel.replace(/index\.html$/, "");
    const url = new URL(route, canonical).href;
    assert(listed.includes(url), `sitemap.xml does not list ${url} (${rel})`);
    assert(/<title>[^<]{3,}<\/title>/.test(page), `${rel} has no <title>`);
    assert(page.includes('rel="canonical"'), `${rel} has no canonical link`);
  }
}

// PWA shape in the built output (§11.4).
assert(existsSync(join(dist, "manifest.webmanifest")), "manifest.webmanifest missing");
assert(existsSync(join(dist, "sw.js")), "sw.js missing");
assert(existsSync(join(dist, "precache-manifest.json")), "precache-manifest.json missing");
if (existsSync(join(dist, "manifest.webmanifest"))) {
  const manifest = JSON.parse(readFileSync(join(dist, "manifest.webmanifest"), "utf8"));
  assert(manifest.name && manifest.name.length > 3, "manifest name empty");
  assert((manifest.short_name ?? "").length <= 12, "manifest short_name over 12 chars");
  assert(manifest.id && manifest.start_url && manifest.scope, "manifest lacks id/start_url/scope");
  assert(manifest.display !== "browser", "manifest display must not be browser");
  assert(
    (manifest.icons ?? []).some((i) => i.purpose === "maskable"),
    "manifest lacks a maskable icon",
  );
  assert(
    html.includes(`content="${manifest.theme_color}"`),
    "manifest theme_color drifted from the theme-color meta",
  );
  for (const icon of manifest.icons ?? []) {
    const file = icon.src.split("/").slice(-2).join("/");
    assert(existsSync(join(dist, file)), `manifest icon ${icon.src} is not in dist/`);
  }
}

// §11.3.8 — critical-path JS budget: the ENTRY chunk plus every chunk the
// static HTML pulls via `<link rel="modulepreload">` — exactly the scripts
// that gate first render, which is what the spec bounds. Chunks fetched
// later through dynamic import (the three.js render stack) are off the
// critical path on purpose and outside this sum; total transfer is still
// bounded by the precache manifest.
const critical = new Set();
for (const m of html.matchAll(/<script[^>]*type="module"[^>]*src="([^"]+)"/g)) critical.add(m[1]);
for (const m of html.matchAll(/<script[^>]*src="([^"]+)"[^>]*type="module"/g)) critical.add(m[1]);
for (const m of html.matchAll(/<link[^>]*rel="modulepreload"[^>]*href="([^"]+)"/g)) {
  critical.add(m[1]);
}
let rawTotal = 0;
let gzipTotal = 0;
for (const src of critical) {
  // Refs are base-prefixed (`/`, `/preview/`, …) — resolve by their tail.
  const tail = src.includes("/assets/")
    ? join("assets", src.split("/").pop())
    : src.split("/").pop();
  const path = join(dist, tail);
  if (!existsSync(path)) {
    failures.push(`critical script ${src} not found in dist/`);
    continue;
  }
  rawTotal += statSync(path).size;
  gzipTotal += gzipSync(readFileSync(path)).length;
}
assert(rawTotal > 0, "no critical-path JS referenced from index.html");
// The ceiling, not the target: it is here to catch a chunk that has run
// away, not to argue about a kilobyte. The gzip figure is the one a player
// on a phone actually waits for, and it is held proportional to the raw one
// so the two cannot drift into disagreeing about what "too big" means.
const RAW_BUDGET_KB = 1000;
const GZIP_BUDGET_KB = 300;
assert(
  rawTotal <= RAW_BUDGET_KB * 1024,
  `critical-path JS ${(rawTotal / 1024).toFixed(0)} KB exceeds ${RAW_BUDGET_KB} KB`,
);
assert(
  gzipTotal <= GZIP_BUDGET_KB * 1024,
  `critical-path JS ${(gzipTotal / 1024).toFixed(0)} KB gzip exceeds ${GZIP_BUDGET_KB} KB`,
);

if (failures.length > 0) {
  console.error("check-seo: FAILED");
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(
  `check-seo: ok (${words.length} words prerendered, JS ${(rawTotal / 1024).toFixed(0)} KB raw / ${(gzipTotal / 1024).toFixed(0)} KB gzip)`,
);
