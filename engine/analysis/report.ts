// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FINDINGS a level analysis makes, and the little report object the
// checks push them onto. Its own module because both halves of the
// analysis — the course (`index.ts`) and the coast (`coast.ts`) — write to
// one report and neither owns it.

import type { Band } from "../mapgen/rules.ts";

/** `error` is a defect — a rule broken, a level the generator must not
 * ship. `warn` is a smell worth reading. */
export type Severity = "error" | "warn";

export type Finding = {
  /** The rule it is about, `R1`…`R17`. */
  rule: string;
  /** `<rule>.<check>` — stable, so a fix can be pointed at one string. */
  code: string;
  severity: Severity;
  message: string;
  /** Where on the map it is, when it has a place. */
  at?: { x: number; z: number };
  /** How bad, in the check's own units. */
  value?: number;
};

export type Report = {
  findings: Finding[];
  fail(
    rule: string,
    check: string,
    message: string,
    extra?: { at?: { x: number; z: number }; value?: number },
  ): void;
  smell(
    rule: string,
    check: string,
    message: string,
    extra?: { at?: { x: number; z: number }; value?: number },
  ): void;
};

export function createReport(): Report {
  const findings: Finding[] = [];
  const push =
    (severity: Severity) =>
    (rule: string, check: string, message: string, extra = {}) => {
      findings.push({ rule, code: `${rule}.${check}`, severity, message, ...extra });
    };
  return { findings, fail: push("error"), smell: push("warn") };
}

/** Two decimals, and no trailing zeroes: a finding is read by a person. */
export const fmt = (v: number): string => (Math.round(v * 100) / 100).toString();

/** A band as a reader sees it: `1.5–2.5`. */
export function bandText(band: Band): string {
  return `${fmt(band.min)}–${fmt(band.max)}`;
}
