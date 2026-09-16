// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE EDGE NET — the edge of the world, drawn.
//
// The sea has no far side. A rider who turns his back on the course and holds
// the throttle open rides out through a storm that builds the whole way
// (`ocean.ts`), and at `tornadoEdge` he meets the tornado (`tornado.ts`) and
// is turned back or thrown. That hazard was always there and it was always
// INVISIBLE: a rider went from open water to being picked off it by an empty
// horizon, with nothing in the frame that said the world had ended. This
// module is the thing in the frame.
//
// IT STANDS EXACTLY WHERE THE TORNADO STARTS, and that is the whole contract:
// `tornadoNetPlan` is the one statement of the shape and both sides read it,
// so what a rider can see IS what takes him. It is a rounded rectangle rather
// than a rectangle because the engine measures a corner as a hypotenuse of
// both axes — the engine's comment has the arithmetic — and a lattice drawn
// square would stand nearly two kilometres beyond its own tornado where two
// sides meet.
//
// WHAT IT LOOKS LIKE. A diamond weave of light standing off the sea, cold and
// faint where nothing is touching it: this is a boundary rather than a threat
// until it is met, and a wall bright enough to read at four kilometres is a
// wall that has taken the horizon away from the game. Two strand families at
// opposing angles rather than a square grid, because a square grid reads as a
// FENCE — a flat thing with a near side and a far side — and a weave reads as
// a surface with tension in it. The strands are cut in the shader off a
// distance along the net and a height up it, so the weave holds its size in
// METRES however the panels are cut and never swims when the camera moves.
//
// WHAT IT DOES WHEN THE RIDER IS IN IT. The charge is `tornadoAt` — how much
// of the tornado stands where the hull is, the same number the physics works
// the throw from — so the net cannot light without the tornado taking him,
// and cannot take him without lighting. It blooms from the hull's own
// position, falling off over `REACH`, and what blooms is the strands going
// hot: cold blue through white to violet, the weave crackling on a fast
// flicker, the whole patch several times its resting brightness. Away from
// the contact the net is as cold as it ever was, so what a rider reads is a
// PLACE — that is where I hit it — and not a wall that turned on.
//
// It lingers. The charge falls off over `COOL` seconds rather than with the
// hull, because a contact at forty metres a second is over in a frame and a
// mark that vanished with it would never be seen by the person who made it.
//
// HOW IT IS BLENDED, AND WHY THE FOG IS HALVED. Additive, with no depth
// write: it is light rather than a surface, so it brightens what is behind it
// and nothing behind it is hidden. Fog toward BLACK and not toward the fog
// colour — adding a haze colour to an additive pass brightens the thing the
// haze is meant to bury — and at `HAZE` of full strength, because the net is
// a source and a source carries through air that a diffuse surface does not.
// Left at full the net is invisible at every range a rider could turn back
// from, which is every range that matters.

import * as THREE from "three";

import { oceanOut, tornadoAt, tornadoNetPlan, type GameState, type Level } from "@engine";

/** The weave's mesh, m — one diamond across. Big: the net is read at
 * kilometres far more often than at metres, and a fine mesh at that range is
 * a flat wash with no weave left in it. At arm's length it is a strand about
 * every craft length, which is what makes a hull passing into it read against
 * something its own size. */
const CELL = 15;
/** How far the net stands over the datum and how far under it, m.
 *
 * The FOOT is the sea's: out here it swings a storm's whole height, so it has
 * to reach below the deepest trough or the net hangs in the air over one.
 *
 * The HEAD is the EYE's, and it is why this is hundreds of metres and not the
 * thirty a rider is thrown. It has to clear the throw, but mostly it has to
 * be legible from a long way off: the whole point of drawing the net is that
 * a rider sees the edge of the world in time to turn round, and the run-in is
 * a couple of kilometres of open ocean. A wall a hundred metres tall subtends
 * four degrees at two kilometres — a bright thread on the horizon, easily
 * taken for a line of whitecaps — where this subtends twelve and reads as a
 * wall. Nothing stands on it and nothing is measured off it. */
const RISE = 420;
const FOOT = -45;
/** How wide a panel is cut along the net, m. The weave is drawn in the
 * shader, so this only has to be fine enough that a straight run of panels
 * follows the corner arcs — a quarter circle of 4 km at this step is some
 * 150 panels, which is smooth at any range the net is legible at. */
const STEP = 45;
/** How far the contact's bloom reaches along the net, m, and how long it
 * takes to cool, s. The reach is a few cells: what a rider has to read is
 * WHERE he hit it, and a bloom the size of the horizon says nothing. */
const REACH = 90;
const COOL = 2.4;
/** How close the hull has to be for the net to feel it, m. `tornadoAt` is
 * nought AT the net and comes up over the band past it, so the charge alone
 * would light nothing until the rider was already through — this is the
 * hull's own reach, so the strands answer to a hull arriving rather than to
 * one that has already gone by. */
const TOUCH = 70;
/** How much of the scene's fog the net takes. */
const HAZE = 0.3;
/** Where the net starts fading out of the picture and where it is gone, m.
 *
 * IT HAS TO BE GONE BEFORE THE LENS STOPS DRAWING. The net is a ring some
 * thirty kilometres round, so a rider standing anywhere near it is looking
 * ALONG it, and the far plane (`renderer.ts`, 4200 m — set by the sky's
 * outermost shell and not by this) cuts that run off mid-strand: a wall of
 * light that simply stops, in a vertical line, in clear air. Faded out first
 * it runs off into haze the way everything else at that range does.
 *
 * What is left is still a long look: nearly three kilometres of warning at
 * full strength, against a band a rider crosses in a second and a half. */
const DIM_FROM = 2600;
const DIM_TO = 4050;

/** The net's resting colour, what a charged strand goes to, and the violet
 * the hottest core carries. Cold enough at rest to sit under a night sky
 * without lighting the sea, and the violet is what keeps a charged patch from
 * reading as a white blowout. */
const COLD = new THREE.Color("#1a6fc0");
const HOT = new THREE.Color("#eaf8ff");
const CORE = new THREE.Color("#b06bff");

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** The net's plan as a closed run of points with the distance along it,
 * walked once at load: four straight sides offset outward by the radius, and
 * a quarter circle of that radius about each of the box's corners
 * (`tornadoNetPlan` says why the corners are round). */
function perimeter(level: Level): { x: number[]; z: number[]; along: number[]; cell: number } {
  const { box, radius } = tornadoNetPlan(level.bounds, level.pace);
  const x: number[] = [];
  const z: number[] = [];
  const along: number[] = [];
  let run = 0;
  const push = (px: number, pz: number): void => {
    const n = x.length;
    if (n > 0) run += Math.hypot(px - x[n - 1], pz - z[n - 1]);
    x.push(px);
    z.push(pz);
    along.push(run);
  };
  /** A straight side, walked at `STEP` and always landing on its end. */
  const side = (ax: number, az: number, bx: number, bz: number): void => {
    const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / STEP));
    for (let i = 1; i <= steps; i++)
      push(ax + ((bx - ax) * i) / steps, az + ((bz - az) * i) / steps);
  };
  /** A corner, as a quarter circle of `radius` about the box's own corner,
   * swept from `from` in the direction the ring is being walked. */
  const corner = (cx: number, cz: number, from: number): void => {
    const steps = Math.max(1, Math.ceil((radius * Math.PI * 0.5) / STEP));
    for (let i = 1; i <= steps; i++) {
      const a = from - (Math.PI * 0.5 * i) / steps;
      push(cx + Math.cos(a) * radius, cz + Math.sin(a) * radius);
    }
  };
  // Once round, starting at the seaward side's −x end. Plan angles here are
  // the plain atan2 of (x, z), so the walk runs +z → +x → −z → −x and every
  // corner sweeps a quarter turn DOWN in angle. Each leg begins where the
  // last one ended and `side`/`corner` both skip their first point, so the
  // ring carries one unbroken distance and closes on the point it opened at.
  push(box.minX, box.maxZ + radius);
  side(box.minX, box.maxZ + radius, box.maxX, box.maxZ + radius);
  corner(box.maxX, box.maxZ, Math.PI * 0.5);
  side(box.maxX + radius, box.maxZ, box.maxX + radius, box.minZ);
  corner(box.maxX, box.minZ, 0);
  side(box.maxX, box.minZ - radius, box.minX, box.minZ - radius);
  corner(box.minX, box.minZ, -Math.PI * 0.5);
  side(box.minX - radius, box.minZ, box.minX - radius, box.maxZ);
  corner(box.minX, box.maxZ, Math.PI);
  // THE WEAVE HAS TO CLOSE. The strands are cut off the distance along the
  // ring, so unless the ring is a whole number of diamonds round the mesh
  // meets itself mismatched at the seam — one ragged seam on a
  // thirty-kilometre ring, in a place the level's own corner decides. `CELL`
  // is the size it is ASKED for; this is the nearest size that divides.
  const total = along[along.length - 1];
  const cells = Math.max(8, Math.round(total / CELL));
  return { x, z, along, cell: total / cells };
}

export type EdgeNet = {
  readonly group: THREE.Group;
  /** Read the hull's place in the net and carry the charge on. */
  update: (state: GameState, dt: number) => void;
  dispose: () => void;
};

/** Stand the net this level's tornado is the far side of. */
export function createEdgeNet(level: Level): EdgeNet {
  const { x, z, along, cell } = perimeter(level);
  const panels = x.length - 1;
  const position = new Float32Array(panels * 4 * 3);
  const run = new Float32Array(panels * 4);
  const up = new Float32Array(panels * 4);
  const index = new Uint32Array(panels * 6);
  for (let p = 0; p < panels; p++) {
    // Four corners a panel: foot and head at each end of the run.
    const ends = [p, p, p + 1, p + 1];
    const heads = [0, 1, 1, 0];
    for (let k = 0; k < 4; k++) {
      const v = p * 4 + k;
      const e = ends[k];
      position[v * 3] = x[e];
      position[v * 3 + 1] = heads[k] ? RISE : FOOT;
      position[v * 3 + 2] = z[e];
      run[v] = along[e];
      up[v] = heads[k];
    }
    const base = p * 4;
    index.set([base, base + 1, base + 2, base, base + 2, base + 3], p * 6);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
  geometry.setAttribute("aRun", new THREE.BufferAttribute(run, 1));
  geometry.setAttribute("aUp", new THREE.BufferAttribute(up, 1));
  geometry.setIndex(new THREE.BufferAttribute(index, 1));
  // The net wraps the whole world, so no bound three could compute for it
  // would ever cull it usefully — and a bound it gets WRONG is a net that
  // blinks out when the camera turns. Say so once instead.
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      ...THREE.UniformsLib.fog,
      uTime: { value: 0 },
      uCell: { value: cell },
      uContact: { value: new THREE.Vector3() },
      uCharge: { value: 0 },
      uCold: { value: COLD.clone() },
      uHot: { value: HOT.clone() },
      uCore: { value: CORE.clone() },
    },
    vertexShader: `
      attribute float aRun;
      attribute float aUp;
      varying float vRun;
      varying float vUp;
      varying vec3 vWorld;
      varying float vDepth;
      void main() {
        vRun = aRun;
        vUp = aUp;
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        vec4 mv = viewMatrix * world;
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 fogColor;
      uniform float fogNear;
      uniform float fogFar;
      uniform float uTime;
      uniform float uCell;
      uniform vec3 uContact;
      uniform float uCharge;
      uniform vec3 uCold;
      uniform vec3 uHot;
      uniform vec3 uCore;
      varying float vRun;
      varying float vUp;
      varying vec3 vWorld;
      varying float vDepth;

      // ONE STRAND. The band around every whole number of \`v\`, widened to
      // whatever a pixel covers (\`fwidth\`) so a strand seen at four
      // kilometres is a dim continuous line rather than the aliased dashes a
      // fixed width gives once the mesh is finer than the screen.
      float strand(float v) {
        float d = abs(fract(v) - 0.5) * 2.0;
        float w = clamp(fwidth(v) * 2.0, 0.012, 1.0);
        return smoothstep(1.0 - w, 1.0, d);
      }

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(41.7, 289.1))) * 43758.5453);
      }

      void main() {
        float hgt = mix(${FOOT.toFixed(1)}, ${RISE.toFixed(1)}, vUp);
        // The weave: two strand families at opposing angles through the same
        // mesh, so the crossings make diamonds rather than squares.
        float a = (vRun + hgt) / uCell;
        float b = (vRun - hgt) / uCell;
        float mesh = max(strand(a), strand(b));
        if (mesh <= 0.001) discard;

        // It thins out as it rises and has no lid: a net with a hard top edge
        // is a box, and the world does not end at a ceiling.
        float standing = smoothstep(1.0, 0.72, vUp);
        // …and it is densest at the waterline, where a rider meets it.
        standing *= mix(1.0, 1.45, smoothstep(0.4, 0.2, vUp));

        // THE CONTACT. Distance from the hull in the world, so the bloom sits
        // where the craft is however the panels happened to be cut.
        float near = exp(-distance(vWorld, uContact) / ${REACH.toFixed(1)});
        float hot = clamp(uCharge * near, 0.0, 1.0);
        // The crackle: the strands under the contact flicker off a cell hash
        // rather than smoothly, so a charged patch reads as arcing and not as
        // a lamp being turned up.
        float cell = hash(floor(vec2(a, b)) + floor(uTime * 11.0));
        float arc = hot * hot * (0.45 + 0.55 * cell);

        // A slow travelling pulse, so the net is alive before anything hits
        // it — but only just: this is a boundary, not a threat.
        float pulse = 0.88 + 0.12 * sin(vRun * 0.02 - uTime * 1.6);

        vec3 tone = mix(uCold, uHot, hot);
        tone = mix(tone, uCore, arc * 0.6);
        // WHAT THE RESTING WEAVE IS WORTH, and why it is not one number. A
        // boundary a rider cannot see is not a boundary, and the same strand
        // asks for opposite things at the two ranges this net is looked at:
        // at arm's length it fills the frame, and anything bright enough to
        // read at two kilometres has taken the sea away; at two kilometres a
        // thirty-kilometre ring has collapsed toward a line on the horizon,
        // where an honest lattice — mostly gap, and many strands to a pixel —
        // averages away to nothing at all. So the rest brightens with
        // distance, and what is held constant is how much of the picture the
        // net is allowed to be rather than how much light it gives off.
        float rest = mix(0.1, 0.62, smoothstep(200.0, 1600.0, vDepth));
        float glow = mesh * standing * pulse * (rest + 0.85 * hot + 0.6 * arc);

        // FOG TOWARD BLACK, at part strength: this pass ADDS light, so haze
        // has to take light away rather than add its own colour, and a source
        // carries through air a surface does not.
        float fog = smoothstep(fogNear, fogFar, vDepth) * ${HAZE.toFixed(2)};
        glow *= 1.0 - fog;
        glow *= 1.0 - smoothstep(${DIM_FROM.toFixed(1)}, ${DIM_TO.toFixed(1)}, vDepth);
        if (glow <= 0.002) discard;
        gl_FragColor = vec4(tone * glow, 1.0);
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: true,
  });
  // `fogColor` is authored sRGB and the renderer hands it over as three set
  // it; nothing else here is a texture, so there is no other conversion to
  // keep straight.
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  // After the water, before the spray: it is light over the sea rather than
  // something floating in it.
  mesh.renderOrder = 2;
  const group = new THREE.Group();
  group.add(mesh);

  let charge = 0;
  const contact = material.uniforms.uContact.value as THREE.Vector3;
  // The level's own, read once: neither the bounds nor the speed class moves
  // for the life of a level, and this is asked every frame.
  const bounds = level.bounds;
  const pace = level.pace;
  const radius = tornadoNetPlan(bounds, pace).radius;

  return {
    group,
    update: (state, dt) => {
      const c = state.craft;
      material.uniforms.uTime.value = state.t;
      // HOW MUCH OF THE NET HAS HIM — the engine's own reading, so the net
      // cannot light without the tornado working on him — and, short of it,
      // how close the hull has come: `tornadoAt` is nought AT the net, and a
      // rider crossing it at forty metres a second would otherwise be past
      // the strands before they answered.
      const inside = tornadoAt(bounds, pace, c.x, c.z);
      const short = radius - oceanOut(bounds, c.x, c.z);
      const reached = Math.max(inside, 1 - clamp01(short / TOUCH));
      if (reached >= charge) {
        charge = reached;
        contact.set(c.x, c.y, c.z);
      } else {
        charge = Math.max(0, charge - dt / COOL);
      }
      material.uniforms.uCharge.value = charge;
    },
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
}
