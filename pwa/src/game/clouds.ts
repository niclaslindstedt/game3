// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT IS IN THE SKY — and there are two completely different answers,
// because a fair-weather sky and an overcast one are not the same thing at
// two densities.
//
//   THE RING   cumulus clusters floating in open air, each riding the wind
//              at its own pace and altitude. What a clear or high sky has.
//   THE DECK   a LID: one continuous ceiling a few hundred metres up, whose
//              UNDERSIDE is most of what the rider can see of the sky. What
//              overcast, rain and a squall have instead.
//
// When the deck is up the ring does not go away — it drops under it and
// becomes SCUD: the ragged low fragments that tear along below a cloud base
// in bad weather, darker than the ceiling they hang under and moving
// visibly faster than anything else in the frame. That contrast is most of
// what makes a squall read as violent rather than merely dark, and over
// open water — where there is no ridge, no tree and no roadside to give the
// wind away — it is the ONLY thing in the sky that shows how hard it is
// blowing.
//
// Everything here rides the camera, so none of it has parallax and all of
// it is drawn at a fixed size a kilometre or two out. Three draw calls for
// the whole sky: the lit puffs, their shaded undersides, and the deck.

import * as THREE from "three";

import { SKY_ORDER, drawAsBackdrop } from "./sky-depth.ts";
import { deckToneAt, type Preset } from "./sky.ts";

/** How far out the deck reaches, m. Well past the dome so the ceiling is
 * the outermost thing in the sky, and inside the camera's far plane. */
const DECK_RADIUS = 2400;
/** How the base falls away toward the rim, as a fraction of the overhead
 * height lost at the edge. A real cloud base appears to come down to meet
 * the horizon; a flat lid reads as a painted ceiling. */
const DECK_SAG = 0.72;
const DECK_RINGS = 16;
const DECK_SEGMENTS = 64;

/** How much of the overhead height the relief lumps swing through, at full
 * `relief`. Enough that a squall's ceiling has shape in it, never so much
 * that the underside folds through itself. */
const DECK_LUMP = 0.14;

/** How high the ceiling hangs at `out` — the distance from the eye as a
 * fraction of the deck's rim. The sag is what makes a real cloud base
 * appear to come down and meet the horizon; the mesh and the scud under it
 * both read it here rather than each restating the curve. */
function deckHeightAt(base: number, out: number): number {
  return base * (1 - DECK_SAG * out * out);
}

const CLOUDS = 22;

/** Where the scud rides under the deck, as fractions of the ceiling's own
 * height AT THAT CLUSTER'S DISTANCE — a band rather than a plane, so the
 * fragments read at different depths. Against the LOCAL height rather than
 * the height overhead, because the base sags toward the rim (`DECK_SAG`):
 * a rag hung at a share of the overhead height two kilometres out comes
 * down onto the skyline and reads as a flat white lens sitting on the
 * water rather than as cloud under a ceiling. */
const SCUD_BAND = [0.42, 0.86] as const;
/** How much faster the scud tears along than the same cluster would drift
 * in open air. The wind under a cloud base is the strongest wind in the
 * frame. */
const SCUD_PACE = 2.6;

/** What a cumulus heap becomes when it is torn along under a ceiling:
 * pulled out sideways and squashed flat. A round puff under an overcast
 * deck reads as a boulder hanging in the sky. */
const SCUD_FLATTEN = 0.34;
const SCUD_STRETCH = 1.35;

/** How far up the rim's ramp the light on the scud is read, radians (see
 * `RIM_BAND`). Low, but not at the skyline: a rag hanging a few degrees up
 * is lit by the strip under the base, not by the strip's brightest edge. */
const SCUD_LIT = 0.045;

export type Clouds = {
  group: THREE.Group;
  /** Re-dress the sky for this preset. */
  apply: (p: Preset) => void;
  /** Ride the wind. `speed` is the level's mean wind, m/s; `at` is where
   * the camera-locked group stands, for the cluster cull. */
  update: (speed: number, dt: number, camera: THREE.Camera | null, at: THREE.Vector3) => void;
  dispose: () => void;
};

export function createClouds(): Clouds {
  const group = new THREE.Group();

  // ── The deck ─────────────────────────────────────────────────────────────
  // A fan of rings seen from underneath. Its vertices carry two baked
  // numbers apiece — how far out they are and how the relief lumps them —
  // and `apply` rewrites the colours and the height from those, so a change
  // of sky costs one pass over 800 vertices rather than a rebuild.
  const deckGeo = new THREE.BufferGeometry();
  const deckVerts = DECK_RINGS * DECK_SEGMENTS + 1;
  const deckPos = new Float32Array(deckVerts * 3);
  const deckColors = new Float32Array(deckVerts * 3);
  /** Distance out as a fraction of the rim, per vertex. */
  const deckOut = new Float32Array(deckVerts);
  /** The underside's own lumpiness, −1..1 per vertex. Three sine terms at
   * incommensurate frequencies: cheap, seamless round the ring, and enough
   * shape that a mammatus ceiling does not read as a cone. */
  const deckLump = new Float32Array(deckVerts);
  const deckIndex: number[] = [];
  for (let ring = 0; ring < DECK_RINGS; ring++) {
    // Rings bunched toward the rim: overhead, one ring covers a huge solid
    // angle and needs almost no tessellation, while the last few degrees
    // above the horizon are where all the perspective is.
    const u = Math.pow((ring + 1) / DECK_RINGS, 0.7);
    for (let s = 0; s < DECK_SEGMENTS; s++) {
      const i = ring * DECK_SEGMENTS + s;
      const a = (s / DECK_SEGMENTS) * Math.PI * 2;
      const r = u * DECK_RADIUS;
      deckPos[i * 3] = Math.sin(a) * r;
      deckPos[i * 3 + 2] = Math.cos(a) * r;
      deckOut[i] = u;
      deckLump[i] =
        0.5 * Math.sin(3.1 * a + 5.7 * u * Math.PI) +
        0.3 * Math.sin(7.3 * a - 3.1 * u * Math.PI + 1.7) +
        0.2 * Math.sin(13.1 * a + 9.4 * u * Math.PI + 4.2);
    }
  }
  const deckHub = deckVerts - 1;
  deckOut[deckHub] = 0;
  deckLump[deckHub] = 0.2;
  for (let s = 0; s < DECK_SEGMENTS; s++) {
    const next = (s + 1) % DECK_SEGMENTS;
    deckIndex.push(deckHub, s, next);
    for (let ring = 0; ring < DECK_RINGS - 1; ring++) {
      const a = ring * DECK_SEGMENTS + s;
      const b = ring * DECK_SEGMENTS + next;
      deckIndex.push(a, a + DECK_SEGMENTS, b, b, a + DECK_SEGMENTS, b + DECK_SEGMENTS);
    }
  }
  deckGeo.setAttribute("position", new THREE.BufferAttribute(deckPos, 3));
  deckGeo.setAttribute("color", new THREE.BufferAttribute(deckColors, 3));
  deckGeo.setIndex(deckIndex);
  const deckMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    fog: false,
  });
  drawAsBackdrop(deckMat);
  const deck = new THREE.Mesh(deckGeo, deckMat);
  deck.renderOrder = SKY_ORDER - 2;
  deck.frustumCulled = false;
  deck.visible = false;
  group.add(deck);

  const tone = new THREE.Color();

  const paintDeck = (d: NonNullable<Preset["deck"]>): void => {
    for (let i = 0; i < deckVerts; i++) {
      const u = deckOut[i];
      const y = deckHeightAt(d.base, u) * (1 + DECK_LUMP * d.relief * deckLump[i]);
      deckPos[i * 3 + 1] = y;
      // How high this piece of ceiling sits in the sky, radians: the hub is
      // straight overhead and every ring falls toward the horizon.
      tone.set(deckToneAt(d, Math.atan2(y, Math.max(1, u * DECK_RADIUS))));
      // …and the lumps shade themselves, which is the difference between a
      // ceiling and a painted disc.
      const shade = 1 + 0.22 * d.relief * deckLump[i];
      deckColors[i * 3] = tone.r * shade;
      deckColors[i * 3 + 1] = tone.g * shade;
      deckColors[i * 3 + 2] = tone.b * shade;
    }
    deckGeo.getAttribute("position").needsUpdate = true;
    deckGeo.getAttribute("color").needsUpdate = true;
  };

  // ── The ring: cumulus CLUSTERS, not single blobs ─────────────────────────
  // Each cloud is a handful of overlapping puffs — big lumps in the middle,
  // smaller ones at the ends, undersides in a shaded material — and each
  // cluster rides the wind at its own pace and altitude.
  //
  // The whole ring is TWO draw calls: one instanced mesh for the lit puffs,
  // one for the shaded undersides. A puff is rigid against its cluster, so
  // it carries a fixed shape matrix and the wind ride only rewrites the
  // translation column.
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, fog: false });
  const cloudBaseMat = new THREE.MeshBasicMaterial({
    color: 0xd6e0ec,
    transparent: true,
    fog: false,
  });
  drawAsBackdrop(cloudMat);
  drawAsBackdrop(cloudBaseMat);
  const cloudGeo = new THREE.SphereGeometry(1, 8, 6);
  /** One puff: where it sits inside its cluster (already turned by the
   * cluster's own heading), the shape it holds there, and which instance of
   * which mesh draws it. */
  type Puff = {
    at: THREE.Vector3;
    /** The lump as it flies in open air, and the torn-out flatter version
     * it becomes as scud under a ceiling. A cumulus is a heap; scud is a
     * rag. */
    shape: THREE.Matrix4;
    scud: THREE.Matrix4;
    scudAt: THREE.Vector3;
    shaded: boolean;
  };
  type Cloud = {
    angle: number;
    radius: number;
    speed: number;
    /** Where it flies in open air, m — and where in the scud band it drops
     * to when a deck goes up, 0..1 along that band. */
    sky: number;
    band: number;
    y: number;
    /** The sphere the whole cluster fits inside, m. */
    reach: number;
    puffs: Puff[];
  };
  const cloudList: Cloud[] = [];
  let litCount = 0;
  let shadedCount = 0;
  const scale = new THREE.Vector3();
  const ORIGIN = new THREE.Vector3();
  const SKY_UP = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < CLOUDS; i++) {
    // Where the cluster rides, m out. Inside the deck's rim, so a cluster
    // always has ceiling above it to be scud under; past everything the
    // coast puts in front of it. It is BACKDROP either way (sky-depth.ts),
    // so the distance buys nothing but the angle it is seen at.
    const radius = 900 + Math.random() * 1200;
    // …and its size is a share of that distance, so the apparent size is
    // the one the sky was authored at wherever the cluster happens to sit.
    // A fixed metre size makes the near half of the ring into airships and
    // the far half into specks.
    const size = radius * (0.05 + Math.random() * 0.09);
    const puffCount = 4 + Math.floor(Math.random() * 4);
    const puffs: Puff[] = [];
    const spin = new THREE.Quaternion().setFromAxisAngle(SKY_UP, Math.random() * Math.PI * 2);
    const place = (
      shaded: boolean,
      x: number,
      y: number,
      z: number,
      sx: number,
      sy: number,
      sz: number,
    ): void => {
      const at = new THREE.Vector3(x, y, z).applyQuaternion(spin);
      puffs.push({
        at,
        shape: new THREE.Matrix4().compose(ORIGIN, spin, scale.set(sx, sy, sz)),
        scud: new THREE.Matrix4().compose(
          ORIGIN,
          spin,
          scale.set(sx * SCUD_STRETCH, sy * SCUD_FLATTEN, sz * SCUD_STRETCH),
        ),
        scudAt: at.clone().setY(at.y * SCUD_FLATTEN),
        shaded,
      });
      if (shaded) shadedCount++;
      else litCount++;
    };
    for (let p = 0; p < puffCount; p++) {
      // Lumps along a rough axis: tall near the middle, trailing off at the
      // ends, every puff keeping a flat shared base line — which is what a
      // cumulus has and a cluster of spheres does not.
      const along = (p / (puffCount - 1) - 0.5) * 2;
      const bulk = 0.55 + (1 - Math.abs(along)) * 0.6 + Math.random() * 0.25;
      const px = along * size * (0.8 + Math.random() * 0.25);
      const pz = (Math.random() - 0.5) * size * 0.4;
      const r = bulk * size * 0.52;
      place(false, px, bulk * size * 0.3, pz, r, r * 0.72, r);
      // The shaded underside: a flatter, darker puff tucked below, on the
      // same axis line as the lump it sits under.
      place(
        true,
        px,
        bulk * size * 0.06,
        pz,
        bulk * size * 0.5,
        bulk * size * 0.22,
        bulk * size * 0.5,
      );
    }
    const band = Math.random();
    // Height as a fraction of the distance out — i.e. an elevation ANGLE,
    // about 18° to 39°. Clouds belong in a band ABOVE the skyline: a flat
    // altitude puts the far ones ON it, where over a sea with no relief
    // they read as smudges floating on the water.
    const sky = radius * (0.32 + band * 0.48);
    cloudList.push({
      angle: Math.random() * Math.PI * 2,
      radius,
      speed: 0.6 + Math.random() * 0.9,
      sky,
      band,
      y: sky,
      reach: size * 2,
      puffs,
    });
  }
  // Room for every puff there is; how many are DRAWN is set per frame from
  // what survives the cull. Anything past that count is left alone rather
  // than trusted to be empty — an instance nobody sets keeps the identity
  // matrix, which is a unit sphere sitting on the start line.
  const cloudPuffs = new THREE.InstancedMesh(cloudGeo, cloudMat, litCount);
  const cloudBases = new THREE.InstancedMesh(cloudGeo, cloudBaseMat, shadedCount);
  for (const mesh of [cloudPuffs, cloudBases]) {
    mesh.frustumCulled = false;
    mesh.renderOrder = SKY_ORDER - 1;
  }
  group.add(cloudPuffs, cloudBases);

  /** Slide every puff onto its cluster's place on the ring, and write only
   * the clusters the camera can actually see.
   *
   * Culled HERE rather than left to three, because two instanced meshes are
   * two objects to it and both straddle the camera: the ring is drawn
   * around the camera's own position, so a bounding test on either always
   * answers yes. Compacting the visible clusters into the front of the
   * buffer costs nothing — the matrices are rewritten every frame anyway —
   * and roughly halves the sky's triangles for 22 sphere tests. */
  const frustum = new THREE.Frustum();
  const view = new THREE.Matrix4();
  const where = new THREE.Sphere();
  const placeClouds = (camera: THREE.Camera | null, at: THREE.Vector3): void => {
    if (camera) {
      camera.updateMatrixWorld();
      frustum.setFromProjectionMatrix(
        view.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
      );
    }
    let litAt = 0;
    let shadedAt = 0;
    for (let c = 0; c < shown; c++) {
      const cloud = cloudList[c];
      const x = Math.sin(cloud.angle) * cloud.radius;
      const z = Math.cos(cloud.angle) * cloud.radius;
      if (camera) {
        where.center.set(at.x + x, at.y + cloud.y, at.z + z);
        where.radius = cloud.reach;
        if (!frustum.intersectsSphere(where)) continue;
      }
      for (const puff of cloud.puffs) {
        const m = scudding ? puff.scud : puff.shape;
        const offset = scudding ? puff.scudAt : puff.at;
        m.elements[12] = x + offset.x;
        m.elements[13] = cloud.y + offset.y;
        m.elements[14] = z + offset.z;
        if (puff.shaded) cloudBases.setMatrixAt(shadedAt++, m);
        else cloudPuffs.setMatrixAt(litAt++, m);
      }
    }
    cloudPuffs.count = litAt;
    cloudBases.count = shadedAt;
    cloudPuffs.instanceMatrix.needsUpdate = true;
    cloudBases.instanceMatrix.needsUpdate = true;
  };

  const litTone = new THREE.Color(0xffffff);
  const shadedTone = new THREE.Color(0xd6e0ec);
  let scudding = false;
  /** How many of the ring's clusters this sky flies (`Preset.cloudShare`).
   * The clusters were built in a random order, so the first N of them are a
   * fair sample of sizes and heights rather than a slice of one kind. */
  let shown = CLOUDS;

  const apply = (p: Preset): void => {
    const d = p.deck;
    scudding = d !== null;
    // A sky's share thins the FAIR-WEATHER ring only. Under a deck the same
    // clusters are the scud torn along beneath it, and a lid is a lid.
    shown = d !== null ? CLOUDS : Math.max(1, Math.round(CLOUDS * p.cloudShare));
    deck.visible = d !== null;
    if (d) {
      paintDeck(d);
      // SCUD HANGS UNDER THE BASE, so the only light on it is what comes
      // in at the RIM — which is exactly the ceiling's own tone read low
      // down (`deckToneAt`). Taking it from there rather than from the
      // overhead is what makes it right under both kinds of lid without a
      // special case: under a white rain deck the rags come out darker
      // than the ceiling behind them, and under a black squall they come
      // out lighter, which is what a photograph of each shows.
      litTone.set(deckToneAt(d, SCUD_LIT));
      shadedTone.copy(litTone).multiplyScalar(0.74);
      for (const cloud of cloudList) {
        const under = deckHeightAt(d.base, Math.min(1, cloud.radius / DECK_RADIUS));
        cloud.y = under * (SCUD_BAND[0] + (SCUD_BAND[1] - SCUD_BAND[0]) * cloud.band);
      }
    } else {
      litTone.set(p.cloud);
      shadedTone.set(p.cloudShade);
      for (const cloud of cloudList) cloud.y = cloud.sky;
    }
    cloudMat.color.copy(litTone);
    cloudMat.opacity = p.cloudOpacity;
    cloudBaseMat.color.copy(shadedTone);
    cloudBaseMat.opacity = p.cloudOpacity;
  };

  const update = (
    speed: number,
    dt: number,
    camera: THREE.Camera | null,
    at: THREE.Vector3,
  ): void => {
    const pace = scudding ? SCUD_PACE : 1;
    for (const cloud of cloudList) {
      cloud.angle += (0.0035 + speed * 0.0014) * cloud.speed * pace * dt;
    }
    placeClouds(camera, at);
  };

  const dispose = (): void => {
    deckGeo.dispose();
    deckMat.dispose();
    cloudGeo.dispose();
    cloudMat.dispose();
    cloudBaseMat.dispose();
  };

  placeClouds(null, ORIGIN);
  return { group, apply, update, dispose };
}
