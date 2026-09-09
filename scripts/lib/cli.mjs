// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE COMMAND LINE, once. Every tool in `scripts/` owes the same three
// things (OSS_GAME_SPEC §12): `--help` that prints its flags with their
// defaults, a non-zero exit on a flag it does not know — a measurement
// tool that ignores a mistyped flag reports a confident wrong number — and
// its inputs printed beside its outputs. This is the parser that gives
// them all three from one table of flags.
//
// A flag is written `--name=value` or `--name value`; a boolean flag is
// `--name` alone. The Makefile spells them the second way and a hand the
// first, and both have to work. Words that are not flags are collected as
// positionals for the tools that take a bare scenario name.

import process from "node:process";

/**
 * Parse `argv` against `spec`: `{ name: { kind, default, help } }` where
 * `kind` is `"string"`, `"number"`, `"list"` (comma-separated numbers or
 * words) or `"flag"`. Returns the values with `_` holding the positionals.
 * Prints usage and exits 0 on `--help`; exits 2 on an unknown flag or a
 * value that does not parse.
 */
export function parseArgs(argv, spec, usage) {
  const out = { _: [] };
  for (const [name, def] of Object.entries(spec)) out[name] = def.default;
  const list = (v) =>
    String(v)
      .split(",")
      .filter((s) => s.length > 0)
      .map((s) => (Number.isNaN(Number(s)) ? s : Number(s)));
  const fail = (message) => {
    console.error(`${message}\n`);
    console.error(usageText(spec, usage));
    process.exit(2);
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      console.log(usageText(spec, usage));
      process.exit(0);
    }
    if (!arg.startsWith("--")) {
      out._.push(arg);
      continue;
    }
    const eq = arg.indexOf("=");
    const name = eq >= 0 ? arg.slice(2, eq) : arg.slice(2);
    const def = spec[name];
    if (!def) fail(`unknown flag --${name}`);
    if (def.kind === "flag") {
      out[name] = eq >= 0 ? arg.slice(eq + 1) !== "0" && arg.slice(eq + 1) !== "false" : true;
      continue;
    }
    let value;
    if (eq >= 0) value = arg.slice(eq + 1);
    else if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) value = argv[++i];
    else fail(`--${name} needs a value`);
    if (def.kind === "number") {
      const n = Number(value);
      if (Number.isNaN(n)) fail(`--${name} wants a number, got "${value}"`);
      out[name] = n;
    } else if (def.kind === "list") {
      out[name] = list(value);
    } else {
      out[name] = value;
    }
  }
  return out;
}

/** The usage block: the header, then one line per flag with its default. */
export function usageText(spec, usage) {
  const lines = [usage.trimEnd(), "", "flags:"];
  const width = Math.max(...Object.keys(spec).map((n) => n.length)) + 4;
  for (const [name, def] of Object.entries(spec)) {
    const fallback =
      def.default === undefined || def.default === false
        ? ""
        : ` (default ${Array.isArray(def.default) ? def.default.join(",") : def.default})`;
    lines.push(`  --${name.padEnd(width)}${def.help}${fallback}`);
  }
  lines.push(`  --${"help".padEnd(width)}this text`);
  return lines.join("\n");
}

/** The `--craft` value checked against the catalog, or every id. */
export function craftList(value, ids) {
  if (value === undefined || value === "all") return [...ids];
  const wanted = String(value).split(",");
  for (const id of wanted) {
    if (!ids.includes(id)) {
      console.error(`unknown craft "${id}" (${ids.join(", ")})`);
      process.exit(2);
    }
  }
  return wanted;
}
