// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A PILE OF COLOURED TRIANGLES that becomes one flat-shaded, vertex-coloured
// geometry — the way everything sculpted in this app is built (the craft's
// body, the rider). Every vertex is its own, so `computeVertexNormals`
// yields one normal a face and a loft reads as panels; a few percent of
// brightness per facet, hashed off the facet's index, keeps one big flat
// colour from reading as plastic under a light with no texture to break it.
//
// Two ways to use it. Build once and take `geometry()`: what a static part
// does. Or keep the builder, `reset()` it, re-emit the same shapes in the
// same order and `refresh()` an existing geometry: what a part that MOVES
// does every frame — the positions and the normals are rewritten in place,
// the colours (the same shapes, the same order, the same hash) are left
// alone, and nothing is allocated on the GPU side. Generic: nothing of this
// game in it.

import * as THREE from "three";

export type P = [number, number, number];

export class Builder {
  private pos: number[] = [];
  private col: number[] = [];
  private readonly c = new THREE.Color();
  private n = 0;

  /** Forget every triangle, so the next emission starts from the first
   * facet's hash again. */
  reset(): void {
    this.pos.length = 0;
    this.col.length = 0;
    this.n = 0;
  }

  /** How many vertices have been emitted. */
  get vertexCount(): number {
    return this.pos.length / 3;
  }

  tri(a: P, b: P, c: P, color: number): void {
    const jitter = 1 + (((this.n++ * 2654435761) >>> 0) / 4294967296 - 0.5) * 0.08;
    this.c.setHex(color).multiplyScalar(jitter);
    for (const p of [a, b, c]) {
      this.pos.push(p[0], p[1], p[2]);
      this.col.push(this.c.r, this.c.g, this.c.b);
    }
  }

  /** Two triangles, wound a→b→c→d seen from the outside. */
  quad(a: P, b: P, c: P, d: P, color: number): void {
    this.tri(a, b, c, color);
    this.tri(a, c, d, color);
  }

  /** An axis-aligned box from its two corners. */
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: number): void {
    const a: P = [x0, y0, z0];
    const b: P = [x1, y0, z0];
    const c: P = [x1, y1, z0];
    const d: P = [x0, y1, z0];
    const e: P = [x0, y0, z1];
    const f: P = [x1, y0, z1];
    const g: P = [x1, y1, z1];
    const h: P = [x0, y1, z1];
    this.quad(d, c, b, a, color); // back (-z), seen from behind
    this.quad(e, f, g, h, color); // front (+z)
    this.quad(a, b, f, e, color); // bottom
    this.quad(h, g, c, d, color); // top
    this.quad(e, h, d, a, color); // left (-x)
    this.quad(b, c, g, f, color); // right (+x)
  }

  /** A closed tube from `a` to `b`, `sides` facets round. */
  tube(a: P, b: P, r: number, color: number, sides = 6): void {
    const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
    const seed = Math.abs(d.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const u = new THREE.Vector3().crossVectors(seed, d).normalize();
    const v = new THREE.Vector3().crossVectors(d, u);
    const ring = (o: P): P[] => {
      const out: P[] = [];
      for (let k = 0; k < sides; k++) {
        const t = (k / sides) * Math.PI * 2;
        const cx = Math.cos(t) * r;
        const cy = Math.sin(t) * r;
        out.push([
          o[0] + u.x * cx + v.x * cy,
          o[1] + u.y * cx + v.y * cy,
          o[2] + u.z * cx + v.z * cy,
        ]);
      }
      return out;
    };
    const ra = ring(a);
    const rb = ring(b);
    // The ring turns right-handed about the tube's axis, so a→b along the
    // side winds the outside out; the end at `a` fans backward.
    for (let k = 0; k < sides; k++) {
      const k1 = (k + 1) % sides;
      this.quad(ra[k], ra[k1], rb[k1], rb[k], color);
    }
    this.cap(ra, color, true);
    this.cap(rb, color, false);
  }

  /** A fan over a ring from its first point; `reverse` flips the winding
   * for the end that faces the other way. The ring must be star-shaped
   * from that point. */
  cap(ring: P[], color: number, reverse: boolean): void {
    for (let k = 1; k + 1 < ring.length; k++) {
      if (reverse) this.tri(ring[0], ring[k + 1], ring[k], color);
      else this.tri(ring[0], ring[k], ring[k + 1], color);
    }
  }

  /** Panels between consecutive rings of equal length, `paint[k]` for the
   * panel after point k. Rings that turn right-handed about the direction
   * they advance in wind every panel's outside out. `closed` joins the
   * last point back to the first. */
  loft(rings: P[][], paint: readonly number[], closed: boolean): void {
    const n = rings[0].length;
    const segs = closed ? n : n - 1;
    for (let i = 0; i + 1 < rings.length; i++) {
      const r0 = rings[i];
      const r1 = rings[i + 1];
      for (let k = 0; k < segs; k++) {
        const k1 = (k + 1) % n;
        this.quad(r0[k], r0[k1], r1[k1], r1[k], paint[k]);
      }
    }
  }

  geometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 3));
    g.computeVertexNormals();
    return g;
  }

  /** Rewrite a geometry this builder made with the triangles emitted since
   * the last `reset` — the same count, in the same order — and recompute
   * its normals. The colours are kept. */
  refresh(g: THREE.BufferGeometry): void {
    const attr = g.getAttribute("position") as THREE.BufferAttribute;
    if (attr.count !== this.pos.length / 3) {
      throw new Error(`lowpoly: refresh with ${this.pos.length / 3} vertices over ${attr.count}`);
    }
    (attr.array as Float32Array).set(this.pos);
    attr.needsUpdate = true;
    g.computeVertexNormals();
  }
}

/** Mirror a starboard half-ring (its last point on the centreline) into a
 * whole ring that runs starboard → crown → port: counter-clockwise seen
 * from astern, which is the order `loft` and `cap` wind for. A half whose
 * FIRST point is on the centreline too (the keel) shares it; one that
 * starts off-centre (the saddle's base) gets its mirror. */
export function mirror(half: P[], sharedFirst: boolean): P[] {
  const ring = half.slice();
  for (let i = half.length - 2; i >= (sharedFirst ? 1 : 0); i--) {
    const [x, y, z] = half[i];
    ring.push([-x, y, z]);
  }
  return ring;
}

/** The paint for a mirrored ring's panels, from the starboard half's. */
export function mirrorPaint(half: readonly number[]): number[] {
  return [...half, ...half.slice().reverse()];
}
