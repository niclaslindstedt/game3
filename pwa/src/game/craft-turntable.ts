// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CRAFT CARD'S TURNTABLE: the real in-game hull, with the real rider on
// the saddle, floating on its own little canvas and turning.
//
// IT FLOATS, and that is the whole difference between this and a showroom
// stand. The disc under the craft is at the WATERLINE and the hull sits at
// the draft the engine says it rests at (`restY` against the taiga's own
// water), so what the card shows is a craft in the water rather than a
// model on a plinth — and the difference between the heavy touring hull sat
// deep and the stand-up perched on top of the water is visible before a
// single bar beside it has been read. The disc is translucent for the same
// reason the near water is (`SEE_THROUGH` in water-mesh.ts): the V under
// the chine is half the sculpture, and a hull sliced off at the waterline
// is a hull with its argument hidden.
//
// The eye line is a person standing beside the craft — a little above it,
// looking slightly DOWN — because that is the angle a hull is actually
// admired from, and the one that shows the sheer and the deck at the same
// time.
//
// This module owns three.js, so it is loaded as its own chunk
// (`craft-picker.tsx` imports it dynamically). Keep it out of any static
// import chain the app shell is on — the entry script has a critical-path
// budget the render stack would blow on its own.

import * as THREE from "three";
import { biomeOf, restY, type CraftSpec } from "@engine";

import { buildCraft, cockpitOf } from "./craft-body.ts";
import { CRAFT_STYLES } from "./craft-styles.ts";
import { createRider, type Rider } from "./rider.ts";

/** WHERE THE VIEWER STANDS, as a direction rather than a place: the eye is
 * this high for every metre it is back. How FAR back it ends up is not
 * authored — `frameCraft` works it out from the hull and the shape of the
 * canvas, so the same stand fills a phone's tall pane and a laptop's wide
 * one with the same craft rather than with the same empty scrim. */
const EYE_RISE = 0.3;
/** How much of the frame is left as air around the craft, as a multiple of
 * the distance the hull alone would need. Barely over one: this stand is
 * the whole reason the craft card exists, and a picture framed like a
 * catalogue photograph is a picture with the craft in it. */
const FRAME_MARGIN = 1.18;
/* THE CRAFT SITS IN THE MIDDLE OF THE FRAME, which is not what the sibling
 * rally game's stand does — its card writes the car's name across the head
 * of the picture and nothing across the foot, so it spends the air the
 * margin buys UNDER the car and keeps the plate off the roofline. This card
 * writes a plate at BOTH ends (the name over the water, the craft's billing
 * across it), so there is no free end to push the hull toward: an offset
 * either way trades one overlap for the other. The margin is what keeps the
 * bow and the stern clear of both. */
/** One revolution every this many seconds. Slow enough to read a chine. */
const SPIN_PERIOD = 18;
/** The water the hull is floated on. One shore, one water — the same
 * density `make crafts` draws its waterline against, so the card and the
 * contact sheet sit the craft at the same depth. */
const DENSITY = biomeOf("taiga").water.density;

export type CraftTurntable = {
  /** Swap the craft on the water; the spin carries on from where it was.
   * The hull is built on the next frame, not inside this call. */
  setCraft: (spec: CraftSpec) => void;
  /** Match the canvas to its box after a layout change. */
  resize: () => void;
  dispose: () => void;
};

export function createCraftTurntable(canvas: HTMLCanvasElement): CraftTurntable {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  // The card's scene has no sky in it, so the hull needs a rig of its own or
  // it draws black. A key from over one shoulder, and a hemisphere for the
  // floor — not a flat ambient, so an underside stays darker than a deck
  // even on the side the key never reaches.
  const key = new THREE.DirectionalLight(0xfff4e4, 1.3);
  key.position.set(0.4, 1, 0.5).normalize().multiplyScalar(10);
  scene.add(key, key.target);
  scene.add(new THREE.HemisphereLight(0xd7e9f0, 0x0b3d4f, 1.5));

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);

  // THE WATER: a disc at y = 0, which is the still surface `restY` is
  // measured against. Sized to the craft it carries (see `fitCraft`) — a
  // fixed disc is a pond around the stand-up and a puddle under the touring
  // hull. Drawn LAST of the transparent things and without writing depth,
  // so the V below it shows through rather than being cut away.
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(1, 48),
    new THREE.MeshBasicMaterial({
      color: 0x1b6f8a,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    }),
  );
  water.rotation.x = -Math.PI / 2;
  water.renderOrder = 1;
  scene.add(water);

  // The craft turns; the water does not. A hull spinning inside a disc that
  // spun with it would read as the whole sea turning, which is a picture of
  // a bug rather than of a boat.
  const pivot = new THREE.Group();
  scene.add(pivot);

  let hull: THREE.Group | null = null;
  let rider: Rider | null = null;
  let craftId: string | null = null;

  const clearCraft = (): void => {
    rider?.dispose();
    rider = null;
    if (!hull) return;
    pivot.remove(hull);
    hull.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      obj.geometry.dispose();
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const mat of mats) mat.dispose();
    });
    hull = null;
  };

  /** The craft the stand has been asked for but has not built yet. */
  let pending: CraftSpec | null = null;

  /** A pick does not build anything — it names the craft and lets the next
   * frame build it. Two things follow. The press itself paints first (the
   * arrow's own state, the name over the water) instead of waiting behind a
   * hull's worth of geometry, so the card answers the click. And a rider
   * rowing through the arrows builds only the craft they STOP on rather
   * than every one they went past. */
  const setCraft = (spec: CraftSpec): void => {
    pending = craftId === spec.id ? null : spec;
  };

  /** WHAT THE STAND HAS TO FRAME: how far the craft reaches from the spin
   * axis, and how high it stands above the water. Measured off the body
   * that was actually built rather than authored beside the catalog, so a
   * longer hull is simply framed from further back and nobody has to
   * remember a second table exists. The defaults are a mid-sized craft, for
   * the frames before the first hull has arrived. */
  let radius = 2;
  let top = 1.6;

  const box = new THREE.Box3();

  const fitCraft = (spec: CraftSpec): void => {
    craftId = spec.id;
    clearCraft();
    const style = CRAFT_STYLES[spec.id];
    hull = buildCraft(spec, style);
    rider = createRider(cockpitOf(spec, style));
    hull.add(rider.mesh);
    // The ORIGIN IS THE CENTRE OF GRAVITY (craft-body.ts), and `restY` is
    // where that sits above a still surface at rest — so this one line is
    // the whole flotation, and the disc below stays at zero.
    hull.position.y = restY(spec, DENSITY);
    pivot.add(hull);
    box.setFromObject(hull);
    // The craft TURNS, so what has to fit is the circle its plan sweeps out
    // about the axis, not the box: the far corner of the box is the whole
    // constraint, and it is the same one at every angle.
    radius = Math.max(
      Math.hypot(box.min.x, box.min.z),
      Math.hypot(box.min.x, box.max.z),
      Math.hypot(box.max.x, box.min.z),
      Math.hypot(box.max.x, box.max.z),
    );
    top = box.max.y;
    // The water is the craft's own sweep with a little apron round it, so it
    // reads as the sea this hull is sitting in rather than as a pond with a
    // model in the middle of it.
    water.scale.setScalar(radius * 1.16);
    frameCraft();
  };

  /** Stand the eye where the whole craft fills the canvas, whatever shape
   * the canvas is. The pane is a tall slot on a phone and a wide one on a
   * laptop, and a camera parked at an authored distance fills one of them
   * and leaves the other mostly scrim — which on the card whose whole job
   * is showing the craft is the one thing it must not do.
   *
   * Two constraints, and the distance is whichever wants more room.
   * SIDEWAYS it is the plan circle above. VERTICALLY it is the rider's
   * helmet plus what that same circle projects into the frame's height once
   * the eye is looking down at it — at this angle a long hull takes up
   * screen height by being long as well as by being tall, and a fit that
   * only measured the deck would crop the bow off every wide pane. */
  const frameCraft = (): void => {
    const vHalf = (camera.fov * Math.PI) / 360;
    const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
    const pitch = Math.atan(EYE_RISE);
    // Fit about the craft's OWN middle, which is the closest the eye can
    // stand: fitting about an authored eye line instead makes the taller
    // half pay for the shorter one and pushes the shot back.
    const middle = top / 2;
    const vNeed = middle * Math.cos(pitch) + radius * Math.sin(pitch);
    const dist = FRAME_MARGIN * Math.max(vNeed / Math.tan(vHalf), radius / Math.tan(hHalf));
    const back = dist / Math.hypot(1, EYE_RISE);
    camera.position.set(0, middle + back * EYE_RISE, -back);
    camera.lookAt(0, middle, 0);
  };

  /** The box the buffer was last cut to, in CSS pixels. */
  const cut = new THREE.Vector2();

  /** Match the buffer to the canvas box, unless it already is. Checked in
   * DEVICE pixels as well as CSS ones: a backing store a mobile browser
   * reclaimed while the app was away still reads back the size three last
   * asked for, and only the pixels show it. */
  const resize = (): void => {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    const ratio = renderer.getPixelRatio();
    renderer.getSize(cut);
    if (
      cut.x === w &&
      cut.y === h &&
      canvas.width === Math.floor(w * ratio) &&
      canvas.height === Math.floor(h * ratio)
    ) {
      return;
    }
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // The eye stands where the new SHAPE wants it, not merely where the old
    // one did with a stretched frustum: a pane that goes from wide to tall
    // is a different photograph of the same craft, and the distance is part
    // of taking it.
    frameCraft();
    camera.updateProjectionMatrix();
  };

  let raf = 0;
  let last = performance.now();
  let angle = 0;

  const frame = (now: number): void => {
    raf = requestAnimationFrame(frame);
    // Every frame, because a resize EVENT is not the only way a canvas
    // changes size: an iOS PWA comes back from the background into a box it
    // never announced, and a stand that trusted the last event would show
    // the craft stretched across the wrong buffer until something rotated.
    resize();
    if (pending) {
      const spec = pending;
      pending = null;
      fitCraft(spec);
    }
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    angle += dt * ((Math.PI * 2) / SPIN_PERIOD);
    pivot.rotation.y = angle;
    renderer.render(scene, camera);
  };
  resize();
  raf = requestAnimationFrame(frame);

  return {
    setCraft,
    resize,
    dispose: () => {
      cancelAnimationFrame(raf);
      clearCraft();
      water.geometry.dispose();
      (water.material as THREE.Material).dispose();
      renderer.dispose();
    },
  };
}
