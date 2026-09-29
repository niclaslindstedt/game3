# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# THE INSTANCED ROCKS MODELLED IN BLENDER: one KIND's four variants — a
# boulder at the waterline, an erratic on the beach, a reef under the
# surface — off the very rows the code reads (`pwa/src/game/rock-variants.ts`,
# handed in as one JSON file by `scripts/blender.mjs --kind=rock`). The
# code's rock was a six-by-four sphere or a twelve-faced die, spun and
# tinted per instance; what this makes is ROCK: a lump whose every ring is
# cut in and out by its own hash so the silhouette is broken going round and
# going up, ice-rounded or angular by the row, a ridge along a crown, a
# cleft the frost opened, a pair out of one foot — every face its own, flat,
# with its own mottle, its top lit and its underside dark.
#
# THE FRAME. A UNIT LUMP: plan within ±1 across (Blender x, y), its foot at
# z = −1 and its crown at or under z = +1 (glTF turns z up to y up).
# `rocks.ts` scales it by the solid's radius across and its half-height up
# and hangs it off the model's own apex, exactly as it hung the code's
# sphere — so nothing here may reach past ±1 across, because the engine
# knows a solid as a cylinder of that radius and a hull that scrapes a face
# the physics has not reached is a rock the rider cannot trust.
#
# NO COLOUR. Every vertex carries a SHADE alone (its colour attribute, grey),
# which the game multiplies into the coast's own stone tint per instance; one
# role, `stone`.

import json, math, os, random, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib
from lib import *
from foliage import Plant, norm, row_studio

argv = sys.argv[sys.argv.index("--") + 1:]
DATA = json.load(open(argv[0]))
OUT = argv[1]
SAMPLES = int(argv[2]) if len(argv) > 2 else 64
KIND = DATA["kind"]

ROLES = ("stone",)
MATS = [mat("stone", (0.5, 0.5, 0.5), rough=0.95)]


def lump(t, f, rng, centre=(0.0, 0.0, 0.0), rx=1.0, ry=1.0, rz=1.0):
    """One lump round `centre`, `rx` and `ry` across, `rz` up: rings of
    vertices from foot to crown, each cut in by its own hash; squared toward
    a block where the row is angular, flattened where it is a slab, a ridge
    or a cleft over the top where it says so; every face its own vertices
    and normal (flat), shaded by how much it faces up, mottled."""
    sides, stacks = f["sides"], f["stacks"]
    jag, ang, flat = f["jag"], f["angular"], f["flat"]
    height = rz * (1 - 0.55 * flat)
    plan = 1 + 0.0 * flat   # the plan may never grow past the collider
    rings = []
    for k in range(1, stacks):
        # A block keeps its width to the top and the bottom; a whaleback
        # rounds off.
        u = k / stacks
        phi = math.pi * u
        round_r = math.sin(phi)
        block_r = 0.92 - 0.25 * abs(2 * u - 1) ** 3
        sr = round_r * (1 - ang) + block_r * ang
        z = -math.cos(phi) * (1 - ang) + (2 * u - 1) * 0.9 * ang
        ring = []
        # A block's rings twist a little against each other and its corners
        # are not all one height: a die is what a regular prism reads as.
        twist = ang * (rng.random() - 0.5) * 0.35
        for j in range(sides):
            a = 2 * math.pi * (j + 0.5 * (k % 2) * (1 - ang)) / sides + ang * math.pi / sides + twist
            w = 1 - jag * rng.random()
            # Squared toward a box: the corners pushed out to the collider,
            # the flats pulled in.
            c, s = math.cos(a), math.sin(a)
            sq = (1 - ang) + ang * 0.95 / max(abs(c), abs(s), 0.4)
            sq = min(sq, 1.0 / max(abs(c), abs(s)))
            x = c * sr * w * sq * rx * plan
            y = s * sr * w * sq * ry * plan
            zz = z * height * (1 - 0.15 * jag * rng.random()) + ang * (rng.random() - 0.5) * 0.18 * height
            # A cleft: the top half pinched down along the y ≈ 0 line.
            if f["cleft"] > 0 and zz > 0.1 and abs(s) < 0.28:
                zz -= f["cleft"] * 0.35 * height * (1 - abs(s) / 0.28)
            # A ridge: the crown carried up along x.
            if f["ridge"] > 0 and zz > 0.3:
                zz += f["ridge"] * height * (1 - abs(s)) * (zz / height)
            # Never over the unit: the crown is where the engine's `top` is.
            ring.append(Vector((centre[0] + x, centre[1] + y, min(centre[2] + zz, rz))))
        rings.append(ring)
    foot = Vector((centre[0], centre[1], centre[2] - height * (1 - 0.1 * ang)))
    cz = height * (0.86 + 0.14 * rng.random()) * (1 - 0.12 * ang) * (1 + f["ridge"] * 0.4)
    if f["cleft"] > 0:
        cz -= f["cleft"] * 0.2 * height
    crown = Vector((centre[0] + rx * 0.2 * (rng.random() - 0.5), centre[1] + ry * 0.2 * (rng.random() - 0.5), min(centre[2] + cz, rz)))

    def face(pts):
        n = (pts[1] - pts[0]).cross(pts[2] - pts[0])
        if n.length < 1e-9:
            return
        n.normalize()
        up = 0.5 + 0.5 * n.z
        shade = (0.45 + 0.55 * up) * (0.86 + 0.28 * rng.random())
        ix = [t.v(p, shade, 0.0, tuple(n)) for p in pts]
        t.f(ix, "stone")

    for k in range(len(rings) - 1):
        lo, hi = rings[k], rings[k + 1]
        for j in range(sides):
            j1 = (j + 1) % sides
            if ang > 0.6:
                # A block's faces are quads split the short way.
                face([lo[j], lo[j1], hi[j1]])
                face([lo[j], hi[j1], hi[j]])
            else:
                face([lo[j], lo[j1], hi[j]])
                face([lo[j1], hi[j1], hi[j]])
    for j in range(sides):
        j1 = (j + 1) % sides
        face([foot, rings[0][j1], rings[0][j]])
        face([crown, rings[-1][j], rings[-1][j1]])


def build(v, rng):
    t = Plant(0.0, roles=ROLES, mats=MATS)
    f = v["shape"]
    if f["split"]:
        # Two lumps out of one foot, the bigger one carrying the crown;
        # both inside the unit plan.
        lump(t, f, rng, (-0.38, 0.05, -0.1), 0.6, 0.72, 0.9)
        lump(t, f, rng, (0.42, -0.1, -0.3), 0.55, 0.6, 0.65)
    else:
        lump(t, f, rng)
    # The plan is held inside the collider, whatever the hashes did.
    for i, (x, y, z) in enumerate(t.co):
        r = math.hypot(x, y)
        if r > 1:
            t.co[i] = (x / r, y / r, z)
    return t


made = []
tris = {}
for v in DATA["variants"]:
    rng = random.Random(f"{KIND}/{v['index']}")
    name = f"v{v['index']}"
    ob = build(v, rng).object(name)
    made.append(ob)
    tris[name] = sum(len(p.vertices) - 2 for p in ob.data.polygons)

root = bpy.data.objects.new(KIND, None)
COL.objects.link(root)
root["frame"] = "rock"
for ob in made:
    ob.parent = root
counts = [tris[f"v{i}"] for i in range(len(DATA["variants"]))]
print("TRIANGLES", KIND, "full", min(counts), "-", max(counts), "total", sum(counts))

if GAME:
    lib._select_only([root] + made)
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, f"{KIND}.glb"), use_selection=True, export_extras=True,
                              export_normals=True, export_vertex_color="ACTIVE", export_all_vertex_colors=False,
                              export_animations=False, export_skins=False, export_morph=False,
                              export_materials="EXPORT")

# ---------------------------------------------------------------- the STUDIO: the four in a row
for ob in made:
    ob.location.z = 1.0     # the foot on the ground for the stills
row_studio(made, KIND, OUT, SAMPLES, 2.0, 3.0)
