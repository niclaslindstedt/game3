// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT THE WATER MIRRORS BESIDES THE SKY — the shore and the wood on it,
// the rocks, the buoys and the ramps, the craft and the rider on it. The sky
// the sea reflects is a function (`skyAlong`, sky-glsl.ts) and costs nothing
// to ask per pixel; a tree line is geometry, and the only way to see it in
// the water is to draw it again from under the water. So once a frame,
// before the picture, the scene is drawn from the lens's own MIRROR IMAGE in
// the still-water plane into a texture a fraction of the frame's size, and
// the water shader reads that texture where a flat mirror would show it,
// wobbled by the wave slope and blurred by the ripples, under the analytic
// sky wherever nothing was drawn.
//
// The mirrored lens is the real one reflected in y = 0 — position, aim and
// up — with the same projection, and its near plane is then leaned onto the
// water plane itself (Lengyel's oblique clipping, as three's own Reflector
// does it) so nothing UNDER the water is drawn into the mirror: the sea bed,
// a rock's foot, the hull's wetted half all lie on the wrong side of the
// glass. No clipping planes, so it works on every material in the scene
// without any of them knowing.
//
// What is NOT drawn into it is what sits ON the surface or is the sky:
// both water grids, the horizon ring, the wake, the spray, the rain and the
// dome. The dome because the water reflects the sky analytically and
// BLURRED — a dome drawn sharp into the mirror would put its cloud edges
// back on the crests as foam — and the surface things because a mirror
// does not reflect itself. The renderer hands those over as `hidden`.
//
// How big the texture is — and whether there is one — is the DETAIL row's
// (`REFLECTION_LOOK`, settings-video.ts): a second pass over the whole
// shore is the dearest thing a stop can buy, and OFF draws nothing at all.

import * as THREE from "three";

export type Reflection = {
  /** The mirror's picture, linear light, alpha 0 where nothing was drawn.
   * The same object for the life of the reflection: the water's material
   * holds it and is not told when the texture is resized. */
  texture: THREE.Texture;
  /** World → mirror texture, `(u, v)` in 0..1 after the perspective divide.
   * Written in place every frame; the water's material holds this object. */
  matrix: THREE.Matrix4;
  /** The mirrored lens's own right, and its forward laid flat on the water,
   * world space, for the wobble: a face tilting across the view moves what
   * it reflects across the mirror's frame, one tilting along it moves it up
   * and down the shore. */
  right: THREE.Vector3;
  forward: THREE.Vector3;
  /** The mirrored lens's frustum this frame, so whatever culls itself against
   * the real lens can cull against this one as well — a stand of pines
   * behind the rider is off screen and in the water at once. */
  frustum: THREE.Frustum;
  /** How big the texture is, as a share of the frame's own pixels; 0 is
   * off, and nothing is drawn. */
  setScale: (share: number) => void;
  /** ONE FRAME IN HOW MANY the pass is drawn — the REFLECTIONS row's `every`.
   * 1 redraws the mirror with every picture; 2 leaves last frame's standing
   * on the frames between, which halves the dearest pass in the renderer. */
  setRate: (every: number) => void;
  /** Whether THIS frame is one of them. `aim` decides it, so everything that
   * culls against the mirrored lens can ask before it does the work — a
   * frame that is not redrawing the mirror should not be laying out a cover
   * for it either. */
  due: () => boolean;
  /** …and what it was last set to, so a caller culling against `frustum` can
   * ask how much of its detail this picture could resolve. */
  scale: () => number;
  /** Whether the mirror has a picture this frame — off, or the lens under
   * the water, where a mirror in the surface faces the wrong way. */
  live: () => boolean;
  /** Pose the mirrored lens for this frame's real one, and settle whether
   * this frame redraws the mirror at all. Before anything culls against
   * `frustum` — on a frame that is not `due`, the lens, its matrix and its
   * frustum are LEFT WHERE THEY WERE, so the picture the water is still
   * reading and the matrix that maps it are the same frame's. Posing the
   * lens afresh over a stale texture is the one way to get this wrong: the
   * reflection then slides across the sea by whatever the camera did. */
  aim: (camera: THREE.PerspectiveCamera) => void;
  /** Draw the scene into the texture, with `hidden` left out. Returns the
   * pass's draw calls and triangles, for the frame's own bill. */
  render: (
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    hidden: readonly THREE.Object3D[],
  ) => { calls: number; triangles: number };
  dispose: () => void;
};

/** The mirror plane: still water, y = 0, facing up. */
const PLANE_POINT = new THREE.Vector3(0, 0, 0);
const PLANE_NORMAL = new THREE.Vector3(0, 1, 0);

/** Clip → texture: `(x, y) / w` in −1..1 to 0..1. */
const BIAS = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);

export function createReflection(): Reflection {
  const target = new THREE.WebGLRenderTarget(4, 4, {
    // Mipmapped, so the shader can read it BLURRED: a sea is a rough mirror,
    // and what it shows of a tree line is its mass, not its needles.
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: true,
    stencilBuffer: false,
  });
  target.texture.wrapS = target.texture.wrapT = THREE.ClampToEdgeWrapping;
  const virtual = new THREE.PerspectiveCamera();
  const matrix = new THREE.Matrix4();
  const frustum = new THREE.Frustum();
  const right = new THREE.Vector3(1, 0, 0);
  const forward = new THREE.Vector3(0, 0, 1);
  const size = new THREE.Vector2();
  const view = new THREE.Vector3();
  const aimAt = new THREE.Vector3();
  const rotation = new THREE.Matrix4();
  const plane = new THREE.Plane();
  const clip = new THREE.Vector4();
  const q = new THREE.Vector4();
  const clearColor = new THREE.Color();
  let scale = 0;
  let live = false;
  let every = 1;
  /** Frames since the mirror was last drawn; the first frame is always one. */
  let since = Number.MAX_SAFE_INTEGER;
  let due = false;

  const aim = (camera: THREE.PerspectiveCamera): void => {
    const on = scale > 0 && camera.position.y > 0;
    // A lens that has gone under the water has no mirror to keep: the
    // surface faces the wrong way and the last picture is not a stale
    // version of the right answer, it is the wrong answer.
    if (!on) {
      live = false;
      due = false;
      since = Number.MAX_SAFE_INTEGER;
      return;
    }
    due = ++since >= every;
    if (!due) return;
    since = 0;
    live = true;
    // The lens reflected in the plane: where it stands, where it looks, and
    // which way is up — each mirrored, so the virtual lens is a proper
    // rotation rather than a flipped one and the scene's faces stay front.
    view.subVectors(camera.position, PLANE_POINT).reflect(PLANE_NORMAL).add(PLANE_POINT);
    rotation.extractRotation(camera.matrixWorld);
    aimAt.set(0, 0, -1).applyMatrix4(rotation).add(camera.position);
    aimAt.sub(PLANE_POINT).reflect(PLANE_NORMAL).add(PLANE_POINT);
    virtual.position.copy(view);
    virtual.up.set(0, 1, 0).applyMatrix4(rotation).reflect(PLANE_NORMAL);
    virtual.lookAt(aimAt);
    virtual.near = camera.near;
    virtual.far = camera.far;
    virtual.updateMatrixWorld();
    virtual.projectionMatrix.copy(camera.projectionMatrix);
    // The near plane leaned onto the water (Lengyel, "Oblique View Frustum
    // Depth Projection and Clipping"): everything under the surface is
    // behind it and never drawn.
    plane.setFromNormalAndCoplanarPoint(PLANE_NORMAL, PLANE_POINT);
    plane.applyMatrix4(virtual.matrixWorldInverse);
    clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
    const e = virtual.projectionMatrix.elements;
    q.x = (Math.sign(clip.x) + e[8]) / e[0];
    q.y = (Math.sign(clip.y) + e[9]) / e[5];
    q.z = -1;
    q.w = (1 + e[10]) / e[14];
    clip.multiplyScalar(2 / clip.dot(q));
    e[2] = clip.x;
    e[6] = clip.y;
    e[10] = clip.z + 1;
    e[14] = clip.w;
    matrix.copy(virtual.projectionMatrix).multiply(virtual.matrixWorldInverse);
    frustum.setFromProjectionMatrix(matrix);
    matrix.premultiply(BIAS);
    right.setFromMatrixColumn(virtual.matrixWorld, 0).normalize();
    // The real lens's line of sight, flat: the mirrored one looks up.
    forward.setFromMatrixColumn(camera.matrixWorld, 2).negate();
    forward.y = 0;
    forward.normalize();
  };

  const render: Reflection["render"] = (renderer, scene, hidden) => {
    if (!live || !due) return { calls: 0, triangles: 0 };
    renderer.getDrawingBufferSize(size);
    const w = Math.max(4, Math.round(size.x * scale));
    const h = Math.max(4, Math.round(size.y * scale));
    if (target.width !== w || target.height !== h) target.setSize(w, h);
    const shown = hidden.map((o) => o.visible);
    for (const o of hidden) o.visible = false;
    // Cleared to NOTHING rather than to the sky: alpha is what tells the
    // water where the mirror has a picture and where the sky shows.
    const background = scene.background;
    scene.background = null;
    renderer.getClearColor(clearColor);
    const clearAlpha = renderer.getClearAlpha();
    renderer.setClearColor(0x000000, 0);
    renderer.setRenderTarget(target);
    renderer.clear();
    renderer.render(scene, virtual);
    const cost = { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
    renderer.setRenderTarget(null);
    renderer.setClearColor(clearColor, clearAlpha);
    scene.background = background;
    hidden.forEach((o, i) => (o.visible = shown[i]));
    return cost;
  };

  return {
    texture: target.texture,
    matrix,
    right,
    forward,
    frustum,
    setScale: (share) => {
      scale = share;
      if (share <= 0) live = false;
      // A row pressed mid-run redraws the mirror on the very next frame
      // rather than at the end of whatever cadence was running.
      since = Number.MAX_SAFE_INTEGER;
    },
    setRate: (n) => {
      every = Math.max(1, Math.round(n));
      since = Number.MAX_SAFE_INTEGER;
    },
    due: () => due,
    live: () => live,
    scale: () => scale,
    aim,
    render,
    dispose: () => target.dispose(),
  };
}
