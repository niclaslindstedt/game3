// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// TRICKS — a placeholder. The scoring of what a rider does in the air (a
// backflip, a barrel roll, a held wheelie) will live here, reading the
// orientation history the craft state already carries. Nothing is scored
// yet: a backflip is REACHABLE (flight_test holds it there) and worth
// nothing.

export type TrickScore = { readonly points: number };

export const NO_TRICKS: TrickScore = { points: 0 };
