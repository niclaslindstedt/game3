// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SCENE, WALKED, and bucketed by what it belongs to — the half of the
// benchmark's report that says WHERE to look. A frame's draw calls say a
// machine is struggling; this says the cover is four fifths of its triangles.
//
// It lives beside the renderer rather than inside it because it is an
// INSTRUMENT and not part of drawing: nothing in a frame calls it, the report
// asks for it once on the last frame of a run (`benchmark-report.ts`), and
// `renderer.ts` is at the §20.5 cap with the frame itself to carry.
//
// The bucket is the nearest NAMED ancestor, which is why the groups the
// renderer adds to the scene carry names: without one an object would be
// reported against the scene itself and the breakdown would be a single row
// saying "all of it".
//
// Only what would actually be DRAWN: an invisible object, and everything
// under it, is skipped exactly as three's own traversal skips it — a
// breakdown that counted the sea life with SEE-THROUGH off would send
// somebody optimising a thing that was never submitted.
//
// A WALK OF THE WHOLE GRAPH, so it is never called from a frame that is being
// timed for anything but this.

import * as THREE from "three";

import type { SceneShare } from "./benchmark-report.ts";

export function tallyScene(root: THREE.Object3D): SceneShare[] {
  const buckets = new Map<string, SceneShare>();
  const walk = (object: THREE.Object3D, under: string): void => {
    if (!object.visible) return;
    const name = object.name !== "" ? object.name : under;
    const geometry = (object as Partial<THREE.Mesh>).geometry;
    if (geometry !== undefined) {
      const share = buckets.get(name) ?? { name, objects: 0, triangles: 0 };
      share.objects += 1;
      const index = geometry.getIndex();
      const position = geometry.getAttribute("position");
      const verts = index ? index.count : (position?.count ?? 0);
      const instances = (object as Partial<THREE.InstancedMesh>).count ?? 1;
      share.triangles += (verts / 3) * instances;
      buckets.set(name, share);
    }
    for (const child of object.children) walk(child, name);
  };
  walk(root, "scene");
  return [...buckets.values()];
}
