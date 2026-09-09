// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DEPENDENCY DIRECTION, walked — OSS_GAME_SPEC §23.7's "enforce
// direction with a test, not with discipline". The arrows AGENTS.md states
// are read off the REAL import graph here: every `import`/`export … from`
// in engine/, pwa/src/, scripts/ and tests/, resolved to the role it lands
// in, and held to the four rules:
//
//   1. the core (engine/) imports nothing from any shell or any tool — and
//      nothing from any package at all: it is framework-free, so a `three`
//      or a `preact` or a `node:` under it is the browser bundle or the
//      headless sim losing a host;
//   2. a shell (pwa/) imports the core through its ONE entry surface,
//      `@engine`, never a deep path, and never another shell or a tool;
//   3. tooling (scripts/) may import anything; nothing imports it;
//   4. the suite reaches the engine the way a host does — `@engine` — so a
//      test cannot pin an internal a host could never see.
//
// Beside the graph, the §25 hygiene the same walk can check for free: no
// wall clock, no global random source and no console in the engine's code
// (the analyzer's report timer is the one recorded exception — dev-time,
// never stepping a run — and it is named here rather than waved through).
// `tests/determinism_test.ts` proves a run replays; this file is why it
// keeps doing so after the next merge.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

type Role = "engine" | "pwa" | "scripts" | "tests" | "shell" | "other";

/** Which role a repo-relative path belongs to. */
function roleOf(rel: string): Role {
  const top = rel.split("/")[0];
  if (top === "engine") return "engine";
  if (top === "pwa") return "pwa";
  if (top === "scripts") return "scripts";
  if (top === "tests") return "tests";
  if (top === "tauri" || top === "native") return "shell";
  return "other";
}

function walk(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist") continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(ts|tsx|mjs|js)$/.test(name) && !name.endsWith(".d.ts")) out.push(path);
  }
}

/** Source with the comments stripped, so prose may name what code may not. */
function code(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !/^\s*\/\//.test(line))
    .join("\n");
}

/** Every module specifier a file names: static imports and re-exports,
 * side-effect imports, and dynamic imports of a literal string. */
function specifiers(text: string): string[] {
  const src = code(text);
  const out: string[] = [];
  for (const m of src.matchAll(/(?:^|\n)\s*(?:import|export)\s[^;]*?\sfrom\s*["']([^"']+)["']/g)) {
    out.push(m[1]);
  }
  for (const m of src.matchAll(/(?:^|\n)\s*import\s*["']([^"']+)["']/g)) out.push(m[1]);
  for (const m of src.matchAll(/import\(\s*["']([^"']+)["']\s*\)/g)) out.push(m[1]);
  return out;
}

type Edge = { from: string; spec: string; to: string | null; bare: boolean };

/** Where a specifier lands: a repo-relative path for a relative import or
 * the `@engine` alias, `null` (and `bare`) for a package. */
function edgesOf(file: string): Edge[] {
  const from = relative(ROOT, file).split(sep).join("/");
  return specifiers(readFileSync(file, "utf8")).map((spec) => {
    if (spec === "@engine") return { from, spec, to: "engine/index.ts", bare: false };
    if (spec.startsWith(".") || spec.startsWith("/")) {
      const abs = spec.startsWith("/") ? spec : resolve(dirname(file), spec);
      return { from, spec, to: relative(ROOT, abs).split(sep).join("/"), bare: false };
    }
    return { from, spec, to: null, bare: true };
  });
}

function filesUnder(...dirs: string[]): string[] {
  const out: string[] = [];
  for (const dir of dirs) walk(join(ROOT, dir), out);
  return out;
}

const ENGINE = filesUnder("engine");
const PWA = filesUnder("pwa/src");
const TESTS = filesUnder("tests");
const SCRIPTS = filesUnder("scripts");

describe("the dependency direction (§23.7)", () => {
  it("has a graph to walk", () => {
    expect(ENGINE.length).toBeGreaterThan(20);
    expect(PWA.length).toBeGreaterThan(0);
    expect(TESTS.length).toBeGreaterThan(10);
    expect(SCRIPTS.length).toBeGreaterThan(5);
  });

  it("the core imports nothing from a shell, a tool, the suite, or any package", () => {
    for (const file of ENGINE) {
      for (const e of edgesOf(file)) {
        expect(
          e.bare,
          `${e.from} imports the package "${e.spec}" — the engine is framework-free`,
        ).toBe(false);
        const role = roleOf(e.to ?? "");
        expect(role, `${e.from} imports ${e.spec}, which is ${role}`).toBe("engine");
      }
    }
  });

  it("the shell reaches the core only through @engine, and never a tool or another shell", () => {
    for (const file of PWA) {
      for (const e of edgesOf(file)) {
        if (e.bare) {
          expect(
            e.spec,
            `${e.from} imports "${e.spec}" — a browser bundle has no Node`,
          ).not.toMatch(/^node:|^(fs|path|url|os|child_process)$/);
          continue;
        }
        const role = roleOf(e.to ?? "");
        expect(role, `${e.from} imports ${e.spec}, which is ${role}`).not.toBe("scripts");
        expect(role, `${e.from} imports ${e.spec}, which is ${role}`).not.toBe("tests");
        expect(role, `${e.from} imports ${e.spec}, which is a shell`).not.toBe("shell");
        if (role === "engine") {
          expect(e.spec, `${e.from} reaches into the engine at ${e.spec}; use @engine`).toBe(
            "@engine",
          );
        }
      }
    }
  });

  it("nothing imports tooling", () => {
    for (const file of [...ENGINE, ...PWA, ...TESTS]) {
      for (const e of edgesOf(file)) {
        expect(roleOf(e.to ?? ""), `${e.from} imports ${e.spec} from scripts/`).not.toBe("scripts");
      }
    }
  });

  it("the suite reaches the engine the way a host does — through @engine", () => {
    for (const file of TESTS) {
      for (const e of edgesOf(file)) {
        if (roleOf(e.to ?? "") === "engine") {
          expect(e.spec, `${e.from} reaches into the engine at ${e.spec}; use @engine`).toBe(
            "@engine",
          );
        }
        expect(roleOf(e.to ?? ""), `${e.from} imports a shell`).not.toBe("shell");
      }
    }
  });

  it("engine/index.ts is the one surface, and it re-exports only its own modules", () => {
    const edges = edgesOf(join(ROOT, "engine", "index.ts"));
    expect(edges.length).toBeGreaterThan(10);
    for (const e of edges) expect(e.to, e.spec).toMatch(/^engine\//);
  });
});

describe("the engine's hygiene (§25)", () => {
  /** The one wall-clock read the engine is allowed: the analyzer stamps its
   * report with how long it took. Dev-time only — `analyzeLevel` never
   * steps a run and the timing never feeds a decision. Anything else is a
   * §25.1 violation and lands here by name. */
  const CLOCK_ALLOWED = new Set(["engine/analysis/index.ts"]);

  for (const file of ENGINE) {
    const rel = relative(ROOT, file).split(sep).join("/");
    const src = code(readFileSync(file, "utf8"));
    it(`${rel} draws no global randomness, reads no clock, prints nothing`, () => {
      expect(src, "Math.random").not.toMatch(/Math\.random/);
      if (!CLOCK_ALLOWED.has(rel)) {
        expect(src, "a wall clock").not.toMatch(/Date\.now|new Date\(|performance\.now/);
      }
      expect(src, "console").not.toMatch(/\bconsole\./);
      // Member access on the DOM's globals, not the bare words: `window` is
      // a perfectly good name for a search window in the shore's code.
      expect(src, "a DOM global").not.toMatch(
        /\b(window|document|navigator|localStorage)\.|\brequestAnimationFrame\(/,
      );
    });
  }
});
