// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PLANING SURFACE — what lifts the hull out of the water once it is
// going fast enough, and why the drag drops through the hump. Savitsky's
// (1964) prismatic planing hull method: the lift coefficient of a flat
// plate at trim τ (degrees) and mean wetted length-to-beam ratio λ at
// speed coefficient C_v = V/√(g·B),
//
//   C_L0 = τ^1.1 · (0.0120·λ^0.5 + 0.0055·λ^2.5 / C_v²)
//
// corrected for a deadrise β (degrees) by C_Lβ = C_L0 − 0.0065·β·C_L0^0.6,
// the lift being L = ½·ρ·V²·B²·C_Lβ normal to the bottom. The second term
// of C_L0 is the buoyant part of a planing plate's lift; the hull's own
// probes already carry its hydrostatics, so it is left in the formula as
// Savitsky wrote it and the whole lift is faded out below the speed his
// data starts at (`TUNING.planing.fadeLow..fadeHigh`), where the hull is
// in displacement mode and the probes are the whole story. The lift acts
// along the hull's up, so its tilt by the trim IS the induced drag W·tan τ
// of the method; the friction over the wetted length is `hull.ts`'s.
//
// The wetted length is read off the keel's immersion at the transom and the
// bow stations (where the keel crosses the surface), continuous in the
// hull's pose, so that the trim equilibrium settles rather than hunts.

import { clamp, lerp } from "../lib/math.ts";
import type { CraftSpec } from "./defs/craft.ts";
import { TUNING } from "./defs/tuning.ts";

const P = TUNING.planing;
const G = TUNING.g;

export type PlaningResult = {
  /** Lift along the hull's up, N. */
  lift: number;
  /** The lift coefficient used. */
  cl: number;
  /** How far into the planing regime the speed puts the hull, 0..1. */
  fade: number;
  /** Wetted keel length, m. */
  wettedLength: number;
};

/** Smoothstep between two edges. */
function smooth(v: number, lo: number, hi: number): number {
  const t = clamp((v - lo) / (hi - lo), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Wetted keel length, m, from the keel's depth below the surface at the
 * transom and the bow stations (negative when clear): the keel crosses
 * the surface between them where the depth interpolates to zero. */
export function wettedLength(spec: CraftSpec, transomDepth: number, bowDepth: number): number {
  const span = spec.length * (TUNING.hull.stations[TUNING.hull.stations.length - 1] - TUNING.hull.stations[0]);
  if (transomDepth <= 0) return 0;
  if (bowDepth >= 0) return spec.length;
  const f = transomDepth / (transomDepth - bowDepth);
  return clamp(f * span + spec.length * TUNING.hull.stations[0], 0, spec.length);
}

/** Savitsky lift for a hull moving at `speed` m/s through the water at
 * trim `trimRad` (nose up positive, relative to the flow) with `wetted`
 * metres of keel in it. */
export function planingLift(
  spec: CraftSpec,
  density: number,
  speed: number,
  trimRad: number,
  wetted: number,
): PlaningResult {
  const beam = spec.beam;
  const cv = speed / Math.sqrt(G * beam);
  const fade = smooth(cv, P.fadeLow, P.fadeHigh);
  const trimDeg = (trimRad * 180) / Math.PI;
  if (fade <= 0 || trimDeg <= 0 || wetted <= 0) {
    return { lift: 0, cl: 0, fade, wettedLength: wetted };
  }
  // Below Savitsky's trim floor the lift is scaled linearly to zero rather
  // than evaluated: τ^1.1 is fine there but the data is not.
  const under = trimDeg < P.trimMin ? trimDeg / P.trimMin : 1;
  const tau = clamp(trimDeg, P.trimMin, P.trimMax);
  const lambda = clamp(wetted / beam, P.lambdaMin, P.lambdaMax);
  const cv2 = Math.max(cv * cv, 0.25);
  const cl0 = Math.pow(tau, 1.1) * (0.012 * Math.sqrt(lambda) + (0.0055 * Math.pow(lambda, 2.5)) / cv2);
  const clBeta = cl0 - 0.0065 * spec.deadrise * Math.pow(cl0, 0.6);
  const cl = clamp(clBeta, 0, P.clMax);
  const lift = 0.5 * density * speed * speed * beam * beam * cl * fade * under;
  return { lift, cl, fade, wettedLength: wetted };
}

/** Where the lift's pressure centre sits ahead of the transom, m, as a
 * fraction of the wetted length: Savitsky's l_p/(λ·B) = 0.75 −
 * 1/(5.21·C_v²/λ² + 2.39), which tends to three quarters of the wetted
 * length at speed and to `cpAft` where the formula has no data. */
export function pressureCentre(spec: CraftSpec, speed: number, wetted: number): number {
  const beam = spec.beam;
  const cv = speed / Math.sqrt(G * beam);
  const lambda = clamp(wetted / beam, P.lambdaMin, P.lambdaMax);
  const ratio = (cv * cv) / (lambda * lambda);
  const lp = 0.75 - 1 / (5.21 * ratio + 2.39);
  return wetted * lerp(P.cpAft, lp, smooth(cv, P.fadeLow, P.fadeHigh));
}
