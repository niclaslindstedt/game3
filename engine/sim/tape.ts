// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RUN TAPE — a placeholder. A whole run written down as the inputs
// that rode it, so a run can be replayed against the same seed and
// compared (the §25.3 replay guard, and later the ghost). The recorder and
// the reader will live here; `simulate.ts` already carries the digest a
// replay is compared by.

export type TapeSample = {
  readonly tick: number;
  readonly steer: number;
  readonly throttle: number;
  readonly lean: number;
};

export type RunTape = {
  readonly seed: number;
  readonly craft: string;
  readonly samples: readonly TapeSample[];
};
