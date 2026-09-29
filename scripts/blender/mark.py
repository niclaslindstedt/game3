# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# THE COURSE'S MARKS MODELLED IN BLENDER: the GATE MARK (the moulded
# navigation float a water gate's pair are) and the ROUNDING BUOY (the
# moored steel can a circuit's lap is ridden round), off the very numbers
# the code lathes them from (`pwa/src/game/mark-shapes.ts`, handed in as one
# JSON file by `scripts/blender.mjs --kind=mark`). The code's mark is a
# sixteen-sided lathe with three boxes for ribs; the code's buoy a stack of
# twelve-sided cylinders and four box legs. What this makes is the thing
# they stand for: a smooth moulded float with a bead round its shoulder, a
# mooring eye under it and a grab bar, its ribs true strakes; a can with a
# rolled rim and a welded seam, a shoulder with a lifting lug, a lattice
# tower with its braces and a platform, a lantern in its cage with a
# ridged lens and a cap.
#
# THE FRAME is the code's: metres, about each mark's own waterline (y = 0 the
# sea; Blender z up, which glTF turns to y up), the gate mark at its one
# size, the buoy at a REFERENCE can radius and lantern height (`reference`)
# in two meshes — `can`, which `buoys.ts` scales across by the solid's
# radius, and `tower`, built with its foot at 0, which it stands on the
# shoulder and stretches to the solid's own lantern height. The gate mark
# is one mesh, `mark`, whose primitives the game instances a material each.
#
# DRESSED BY NAME: `hull` (the paint the game colours per gate and per
# side), `band` (the black waist), `fitting` and `tower` (the ironmongery),
# `lens` (the glass the lamp lights). No colour in the file; a vertex's
# tone carries a SHADE alone (the dark under a collar and a rim).

import json, math, os, random, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib
from lib import *
from foliage import Plant, norm

argv = sys.argv[sys.argv.index("--") + 1:]
DATA = json.load(open(argv[0]))
OUT = argv[1]
SAMPLES = int(argv[2]) if len(argv) > 2 else 64
KIND = DATA["kind"]
MARK = DATA["mark"]
BUOY = DATA["buoy"]
REF = DATA["reference"]

ROLES = ("hull", "band", "fitting", "tower", "lens")
PAINT = {
    "hull": (0.88, 0.45, 0.05),
    "band": (0.02, 0.02, 0.02),
    "fitting": (0.03, 0.035, 0.04),
    "tower": (0.32, 0.36, 0.38),
    "lens": (0.6, 0.45, 0.1),
}
MATS = [mat(r, PAINT[r] if not GAME else (0.5, 0.5, 0.5), rough=0.35 if r in ("hull", "lens") else 0.7,
            metal=0.6 if r == "tower" else 0.0) for r in ROLES]
SEG = 12 if GAME else 48


def new():
    return Plant(0.0, roles=ROLES, mats=MATS)


def lathe(t, profile, role, seg=SEG, shade=lambda r, z: 1.0, cap_top=True, cap_bottom=True, seam=0.0):
    """A solid of revolution about z from `profile` (`[radius, height]`
    pairs, foot first), smooth, its rings sharing vertices — a crease is a
    doubled point in the profile. `shade(r, z)` darkens a ring."""
    rings = []
    for k, (r, z) in enumerate(profile):
        ring = []
        for j in range(seg):
            a = 2 * math.pi * j / seg
            # A welded seam: the plate a hair proud along one meridian.
            rr = r * (1 + seam * (0.4 if j == 0 else 0.0))
            ring.append(t.v((rr * math.cos(a), rr * math.sin(a), z), shade(r, z), 0.0))
        rings.append(ring)
    for k in range(len(rings) - 1):
        lo, hi = rings[k], rings[k + 1]
        if profile[k][0] < 1e-6 and profile[k + 1][0] < 1e-6:
            continue
        for j in range(seg):
            j1 = (j + 1) % seg
            quad = tuple(dict.fromkeys((lo[j], lo[j1], hi[j1], hi[j])))
            if len(quad) >= 3:
                t.f(quad, role)
    return rings


def flat_faces(t, quads, role, shade=1.0):
    """Faces with their own vertices, each carrying its own normal — the
    ironmongery, where a crease is a crease."""
    for pts in quads:
        ps = [Vector(p) for p in pts]
        n = (ps[1] - ps[0]).cross(ps[2] - ps[0])
        if n.length < 1e-9:
            continue
        n.normalize()
        t.f([t.v(p, shade, 0.0, tuple(n)) for p in ps], role)


def bar(t, a, b, w, role, shade=1.0, sides=4, rot=0.0):
    """A straight prism from `a` to `b`, `w` across, `sides` round, flat-faced."""
    a, b = Vector(a), Vector(b)
    d = (b - a).normalized()
    u = Vector((0, 0, 1)) if abs(d.z) < 0.9 else Vector((1, 0, 0))
    u = d.cross(u).normalized()
    v = d.cross(u)
    ra, rb = [], []
    for j in range(sides):
        th = 2 * math.pi * (j + 0.5) / sides + rot
        off = (u * math.cos(th) + v * math.sin(th)) * (w / 2) / math.cos(math.pi / sides)
        ra.append(a + off)
        rb.append(b + off)
    quads = []
    for j in range(sides):
        j1 = (j + 1) % sides
        quads.append((ra[j], ra[j1], rb[j1], rb[j]))
    quads.append(tuple(reversed(ra)))
    quads.append(tuple(rb))
    flat_faces(t, quads, role, shade)


def torus(t, centre, R, r, role, seg=None, ring=6, axis="z", shade=1.0):
    seg = seg or SEG
    c = Vector(centre)
    rings = []
    for j in range(seg):
        a = 2 * math.pi * j / seg
        out = Vector((math.cos(a), math.sin(a), 0)) if axis == "z" else Vector((math.cos(a), 0, math.sin(a)))
        up = Vector((0, 0, 1)) if axis == "z" else Vector((0, 1, 0))
        rg = []
        for k in range(ring):
            b = 2 * math.pi * k / ring
            p = c + out * (R + r * math.cos(b)) + up * (r * math.sin(b))
            rg.append(t.v(tuple(p), shade, 0.0))
        rings.append(rg)
    for j in range(seg):
        j1 = (j + 1) % seg
        for k in range(ring):
            k1 = (k + 1) % ring
            t.f((rings[j][k], rings[j1][k], rings[j1][k1], rings[j][k1]), role)


# ---------------------------------------------------------------- THE GATE MARK
def gatemark():
    t = new()
    # THE FLOAT AND THE CONE: the code's own profile, with a rolled bead
    # round the collar's shoulder and a moulding line where the cone leaves
    # the rim, dark in the hollow under the collar.
    prof = [tuple(p) for p in MARK["body"]]
    body = []
    for i, (r, z) in enumerate(prof):
        body.append((r, z))
        if i == 4:      # the shoulder: a bead over the collar's top edge
            body += [(r * 1.02, z + 0.05), (r * 1.035, z + 0.1), (r * 1.02, z + 0.15), (r, z + 0.2)]
    lathe(t, body, "hull", shade=lambda r, z: 0.55 + 0.45 * min(1.0, max(0.0, (z + 0.62) / 0.5)) if z < -0.1 else 1.0)
    # THE RIBS as strakes: tapered, following the cone's flank, three of
    # them — and a flat moulded seam between each pair.
    R = MARK["ribs"]
    for i in range(R["count"]):
        a = 2 * math.pi * i / R["count"]
        c, s = math.cos(a), math.sin(a)
        # The strake's inner face is sunk INTO the flank, so it grows out of
        # the cone rather than floating a hair off it.
        foot = Vector((c * (R["r0"] - R["proud"] * 0.6), s * (R["r0"] - R["proud"] * 0.6), R["y0"]))
        head = Vector((c * (R["r1"] - R["proud"] * 0.6), s * (R["r1"] - R["proud"] * 0.6), R["y1"]))
        side = Vector((-s, c, 0))
        out = Vector((c, s, 0))
        w0, w1 = R["across"] * 0.5, R["across"] * 0.3
        d = R["deep"] + R["proud"] * 0.6
        quads = [
            (foot + side * w0, foot + side * w0 + out * d, head + side * w1 + out * d * 0.7, head + side * w1),
            (foot - side * w0 + out * d, foot - side * w0, head - side * w1, head - side * w1 + out * d * 0.7),
            (foot + side * w0 + out * d, foot - side * w0 + out * d, head - side * w1 + out * d * 0.7, head + side * w1 + out * d * 0.7),
            (foot - side * w0, foot + side * w0, foot + side * w0 + out * d, foot - side * w0 + out * d),
        ]
        flat_faces(t, quads, "hull")
    # THE LANTERN: the frame the code lathes (a flange, the post, the cap),
    # the ridged lens sleeved over the post, and a cage of four thin bars
    # round the glass, which every real lantern carries.
    lathe(t, [tuple(p) for p in MARK["frame"]], "fitting")
    lathe(t, [tuple(p) for p in MARK["lens"]], "lens", seg=SEG, cap_top=False, cap_bottom=False)
    lens = MARK["lens"]
    z0, z1 = lens[0][1], lens[-1][1]
    for i in range(4):
        a = 2 * math.pi * i / 4 + math.pi / 4
        c, s = math.cos(a), math.sin(a)
        bar(t, (c * 0.185, s * 0.185, z0 - 0.01), (c * 0.185, s * 0.185, z1 + 0.01), 0.018, "fitting")
    # A GRAB BAR across the flange and a MOORING EYE under the foot: what a
    # float is handled by and what holds it to the sea bed.
    fl = MARK["frame"][0][1]
    bar(t, (-0.3, 0, fl - 0.02), (0.3, 0, fl - 0.02), 0.03, "fitting", rot=math.pi / 4)
    for x in (-0.28, 0.28):
        bar(t, (x, 0, fl - 0.1), (x, 0, fl), 0.03, "fitting")
    foot = MARK["body"][0][1]
    torus(t, (0, 0, foot - 0.05), 0.09, 0.02, "fitting", seg=10, ring=5, axis="x", shade=0.6)
    return t


# ---------------------------------------------------------------- THE ROUNDING BUOY
def buoy_can():
    t = new()
    C, B, S = BUOY["can"], BUOY["band"], BUOY["shoulder"]
    r = 1.0
    top, bot = C["over"], -C["under"]
    # THE CAN: the code's tapered drum with a rolled rim top and bottom, a
    # welded seam down one side, dark under the water.
    prof = [
        (0.0, bot), (r * 0.7, bot), (r * 0.96, bot + 0.05), (r, bot + 0.16), (r, B["at"] - B["height"] / 2 - 0.02),
        (r, B["at"] + B["height"] / 2 + 0.02), (r * (1 - (1 - C["taper"]) * 0.6), top - 0.35),
        (r * C["taper"], top - 0.08), (r * C["taper"] * 0.985, top),
    ]
    lathe(t, prof, "hull", shade=lambda rr, z: 0.65 + 0.35 * min(1.0, max(0.0, (z - bot) / 1.2)), seam=0.01)
    # THE BAND round the waist, proud of the plate.
    lathe(t, [(r * B["proud"] * 0.985, B["at"] - B["height"] / 2), (r * B["proud"], B["at"] - B["height"] / 2 + 0.02),
              (r * B["proud"], B["at"] + B["height"] / 2 - 0.02), (r * B["proud"] * 0.985, B["at"] + B["height"] / 2)],
          "band")
    # THE SHOULDER the tower stands on: the code's cone, with a rolled top
    # and four LIFTING LUGS round it.
    st = top + S["height"]
    lathe(t, [(r * C["taper"] * 0.985, top), (r * C["taper"], top + 0.02), (r * S["r"] * 1.05, st - 0.06),
              (r * S["r"], st), (0.0, st)], "hull", shade=lambda rr, z: 1.0)
    for i in range(4):
        a = 2 * math.pi * i / 4
        c, s = math.cos(a), math.sin(a)
        bar(t, (c * r * 0.72, s * r * 0.72, top + 0.05), (c * r * 0.72, s * r * 0.72, top + 0.3), 0.05, "fitting")
    return t


def buoy_tower():
    """The tower with its foot at z = 0, built for the reference can and
    lantern height; the game stretches it to the solid's own."""
    t = new()
    C, S, G, L = BUOY["can"], BUOY["shoulder"], BUOY["cage"], BUOY["lamp"]
    r, top = REF["r"], REF["top"]
    foot_z = C["over"] + G["standOff"]
    head = top - L["height"] / 2 - L["under"] - foot_z
    out_foot, out_head = r * G["foot"], G["waist"] * 0.5
    legs = []
    for i in range(4):
        a = 2 * math.pi * i / 4 + math.pi / 4
        c, s = math.cos(a), math.sin(a)
        f = Vector((c * out_foot, s * out_foot, 0))
        h = Vector((c * out_head, s * out_head, head))
        legs.append((f, h))
        bar(t, f, h, G["leg"], "tower", rot=a)
    # The hoop round the waist, the braces between the legs, the platform.
    mid = head * 0.5
    torus(t, (0, 0, mid), (out_foot + out_head) / 2, G["hoop"], "tower", seg=16, ring=4)
    for i in range(4):
        f0, h0 = legs[i]
        f1, h1 = legs[(i + 1) % 4]
        bar(t, f0.lerp(h0, 0.05), f1.lerp(h1, 0.55), G["leg"] * 0.4, "tower")
        bar(t, f0.lerp(h0, 0.55), f1.lerp(h1, 0.95), G["leg"] * 0.4, "tower")
    plat = out_head + 0.12
    lathe(t, [(plat * 0.9, head - 0.04), (plat, head - 0.04), (plat, head), (plat * 0.9, head), (0.0, head)], "tower")
    # THE LANTERN at the top: a ridged lens over a post, in a cage, capped.
    lz = top - foot_z
    post = [(0.0, head), (0.09, head), (0.09, lz - L["height"] / 2), (0.0, lz - L["height"] / 2)]
    lathe(t, post, "fitting")
    lens = []
    z0, z1 = lz - L["height"] / 2, lz + L["height"] / 2
    n = 6
    for k in range(n + 1):
        z = z0 + (z1 - z0) * k / n
        lens.append((L["radius"] * (1.0 if k % 2 == 0 else 0.86), z))
    lathe(t, lens, "lens")
    for i in range(6):
        a = 2 * math.pi * i / 6
        c, s = math.cos(a), math.sin(a)
        bar(t, (c * L["radius"] * 1.15, s * L["radius"] * 1.15, z0 - 0.02), (c * L["radius"] * 1.15, s * L["radius"] * 1.15, z1 + 0.02), 0.02, "tower")
    cz = z1 + L["capGap"] - L["capHeight"] / 2
    lathe(t, [(0.0, cz), (L["radius"] * L["capOver"], cz), (L["radius"] * L["capOver"] * 0.95, cz + 0.03),
              (L["radius"] * 0.35, cz + L["capHeight"] * 0.8), (0.0, cz + L["capHeight"])], "tower")
    return t


made = []
if KIND == "gatemark":
    made.append(gatemark().object("mark"))
else:
    made.append(buoy_can().object("can"))
    tower = buoy_tower().object("tower")
    tower.location.z = BUOY["can"]["over"] + BUOY["cage"]["standOff"]
    made.append(tower)

root = bpy.data.objects.new(KIND, None)
COL.objects.link(root)
root["frame"] = "mark"
for ob in made:
    ob.parent = root
total = sum(sum(len(p.vertices) - 2 for p in ob.data.polygons) for ob in made)
print("TRIANGLES", KIND, "total", total)

if GAME:
    # The tower's node keeps its place: the game stands it on the shoulder
    # itself, so the mesh is exported with its foot at 0.
    for ob in made:
        ob.location.z = 0.0
    lib._select_only([root] + made)
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, f"{KIND}.glb"), use_selection=True, export_extras=True,
                              export_normals=True, export_vertex_color="ACTIVE", export_all_vertex_colors=False,
                              export_animations=False, export_skins=False, export_morph=False,
                              export_materials="EXPORT")

# ---------------------------------------------------------------- the STUDIO: on the water
only = [x for x in os.environ.get("VIEWS", "").split(",") if x]
if not GAME and only != ["none"]:
    size = 2.6 if KIND == "gatemark" else 6.0
    centre = (0, 0, 0.7 if KIND == "gatemark" else 2.0)
    cams = lib._studio(centre, size, floor=0.0)
    lib._cycles(SAMPLES)
    for name, cam in cams.items():
        if only and name not in only:
            continue
        scene.camera = cam
        scene.render.filepath = os.path.join(OUT, f"{KIND}-render-{name}.png")
        bpy.ops.render.render(write_still=True)
