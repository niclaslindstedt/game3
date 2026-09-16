// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SCENARIO CATALOG — the one vocabulary shared by the staged moments,
// URL parser, developer menu, tests and screenshot tooling. The descriptions
// themselves live in scenarios.ts; this small leaf keeps callers from making
// that already substantial module own its catalog as well.

export const SCENARIO_NAMES = [
  "rest",
  "jet",
  "cruise",
  "coast",
  "tuck",
  "stand",
  "carve",
  "brake",
  "brakeTurn",
  "chop",
  "swell",
  "following",
  "launch",
  "apex",
  "landing",
  "dive",
  "capsize",
  "offshore",
  "storm",
  "ocean",
  "net",
  "backflip",
  "sidespin",
  "wildlife",
  "breach",
  "birds",
  "mark",
  "gate",
  "missed",
  "river",
] as const;

export type ScenarioName = (typeof SCENARIO_NAMES)[number];

export function isScenarioName(name: string): name is ScenarioName {
  return (SCENARIO_NAMES as readonly string[]).includes(name);
}
