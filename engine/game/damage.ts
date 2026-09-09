// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// DAMAGE — a placeholder. What a hard landing, a rock or a grounding costs
// the hull (a cracked hull that takes water, a bent nozzle that pulls to
// one side, a pump that swallows sand) will live here, read by `craft.ts`
// the way the propulsion is. Nothing is charged yet: the events are
// emitted (`hit`, `ground`, `land`, `dive`) and this module ignores them.

export type CraftDamage = Record<string, never>;

export function freshDamage(): CraftDamage {
  return {};
}
