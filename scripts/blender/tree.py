# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# THE TREES MODELLED IN BLENDER: one KIND's six variants, off the very rows
# the code's builder reads (`pwa/src/game/tree-variants.ts` and the kind's
# row of `flora-defs.ts`, handed in as one JSON file by `scripts/blender.mjs
# --kind=tree` — the driver, and the only way this runs). Every number that
# makes a variant the variant it is (its whorls and boughs, its pads, its
# limbs and leaf clusters, its fronds, its prop roots; its lean, its flag,
# its twin leader) is the row's, and every proportion of its FORM is the
# code's own (`TREE_SHAPE`), with the silhouette the code draws sampled off
# `crownAt` (`profile`). What this adds is the MODELLING: a spire's boughs as
# real drooping limbs over a dark core, a pine's needle pads as lobed
# cushions on branches off a flared stem with the copper reach above, a
# broadleaf in leaf as limbs forking into clusters of leaves over a shaded
# core, a feather palm's leaflets and a fan palm's pleats, a mangrove's
# arching prop roots.
#
# THE FRAME. Metres, at the REFERENCE height (`TREE_REFERENCE`): Blender x
# across (the side a leaning or flagged tree leans and grows to, as the
# code's +x), y across, z up from the foot. glTF turns z up to y up;
# `tree-models.ts` divides the reference height back out of all three into
# the unit frame the code's builder draws in (a metre tall, its plan in the
# same unit), which the placer scales by each plant's own height. The root
# carries the height as an extra.
#
# EACH VARIANT IS TWO MESHES: `v<i>` (the tree as a rider sees it close) and
# `v<i>_far` (the far band's hand-built sketch — the same tree at a fraction
# of the triangles, never a decimation, which shreds a crown of separate
# pieces). One glTF a kind, all twelve meshes in it.
#
# DRESSED BY THE GAME. A model carries no colour of its own: every face is
# one ROLE (its material's name — `leaf`, `bark`, `twig`, `mark`) and every
# vertex two numbers in its colour attribute:
#   R  its SHADE, 0..1 — the dark inside a crown, the foot of a trunk
#   G  how far it goes from the role's first colour to its second — the
#      foliage lit to the kind's dark, the bark to its upper reach (a Scots
#      pine's copper), a twig from the bark to the leaf's dark
# `tree-models.ts` turns that into the kind's own colours off its row. The
# foliage carries VOLUME normals (out of the crown and up), so a crown is lit
# as a mass rather than as a pile of lumps.

import json, math, os, random, sys
# WINDING: Blender's frame is z up, so a ring laid round anticlockwise seen
# from above, walked bottom ring to top ring, faces OUT. The game culls the
# back of every face (the Cycles still does not), so a face wound the other
# way is a hole in the game and not in the still — judge in the game's lab.

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib
from lib import *

argv = sys.argv[sys.argv.index("--") + 1:]
DATA = json.load(open(argv[0]))
OUT = argv[1]
SAMPLES = int(argv[2]) if len(argv) > 2 else 64
KIND = DATA["kind"]
H = DATA["reference"]
LOOK = DATA["look"]
FORM = DATA["form"]
SHAPE = DATA["shape"]
PAINT = DATA.get("paint")
# A pale bark with dark marks (a birch's), drawn in the `mark` role.
PAINT_MARKS = 0.3 if LOOK.get("marks") else 0.0

ROLES = ("leaf", "bark", "twig", "mark")

# ---------------------------------------------------------------- materials
# The stills are painted with the kind's own colours through the same
# arithmetic the game dresses a model with; the glTF gets neutral
# materials, as the game reads only their names.
def role_mat(name, first, second, rough=0.9):
    m = mat(name, tuple(first) if not GAME else (0.5, 0.5, 0.5), rough=rough)
    if GAME:
        return m
    nt = m.node_tree
    p = nt.nodes.get("Principled BSDF")
    attr = nt.nodes.new("ShaderNodeAttribute")
    attr.attribute_name = "tone"
    sep = nt.nodes.new("ShaderNodeSeparateColor")
    nt.links.new(attr.outputs["Color"], sep.inputs[0])
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.inputs[6].default_value = (*first, 1)
    mix.inputs[7].default_value = (*second, 1)
    nt.links.new(sep.outputs[1], mix.inputs[0])
    shade = nt.nodes.new("ShaderNodeMix")
    shade.data_type = "RGBA"
    shade.blend_type = "MULTIPLY"
    shade.inputs[0].default_value = 1.0
    nt.links.new(mix.outputs[2], shade.inputs[6])
    nt.links.new(sep.outputs[0], shade.inputs[7])
    nt.links.new(shade.outputs[2], p.inputs["Base Color"])
    return m

GREY = (0.5, 0.5, 0.5)
P_ = PAINT or {}
MATS = [
    role_mat("leaf", P_.get("leafLit", GREY), P_.get("leafDark", GREY), rough=0.8),
    role_mat("bark", P_.get("stem", GREY), P_.get("stemHigh", GREY)),
    role_mat("twig", P_.get("stem", GREY), P_.get("leafDark", GREY)),
    role_mat("mark", P_.get("stemMark", GREY), P_.get("stemMark", GREY)),
]

# ---------------------------------------------------------------- the MESH being built
def norm(v):
    l = math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) or 1.0
    return (v[0] / l, v[1] / l, v[2] / l)

class Tree:
    """A mesh under construction: every vertex with its tone (shade, blend)
    and — for foliage — its own normal; every face its role. The variant's
    LEAN shears every point over by its height, to +x."""

    def __init__(self, lean):
        self.lean = math.tan(lean)
        self.co, self.tone, self.nrm, self.faces, self.roles = [], [], [], [], []

    def v(self, p, shade=1.0, blend=0.0, n=None):
        x, y, z = p
        self.co.append((x + max(0.0, z) * self.lean, y, z))
        self.tone.append((max(0.0, min(1.0, shade)), max(0.0, min(1.0, blend)), 0.0))
        self.nrm.append(n)
        return len(self.co) - 1

    def f(self, idx, role):
        self.faces.append(tuple(idx))
        self.roles.append(ROLES.index(role))

    def object(self, name):
        me = bpy.data.meshes.new(name)
        me.from_pydata(self.co, [], self.faces)
        me.validate(clean_customdata=False)
        for m in MATS:
            me.materials.append(m)
        me.polygons.foreach_set("material_index", self.roles)
        me.polygons.foreach_set("use_smooth", [True] * len(me.polygons))
        tone = me.color_attributes.new("tone", "FLOAT_COLOR", "POINT")
        for i, (r, g, b) in enumerate(self.tone):
            tone.data[i].color = (r, g, b, 1.0)
        me.color_attributes.active_color = tone
        me.color_attributes.render_color_index = 0
        me.update()
        # A vertex with no normal of its own takes the surface's.
        smooth = [tuple(v.normal) for v in me.vertices]
        me.normals_split_custom_set_from_vertices(
            [n if n is not None else smooth[i] for i, n in enumerate(self.nrm)])
        ob = bpy.data.objects.new(name, me)
        COL.objects.link(ob)
        return ob

def frame(d):
    """Two unit vectors across a direction `d`."""
    d = Vector(d).normalized()
    a = Vector((0, 0, 1)) if abs(d.z) < 0.9 else Vector((1, 0, 0))
    u = d.cross(a).normalized()
    return u, d.cross(u).normalized()

def tube(t, pts, radii, sides, role, tone=lambda k: (1.0, 0.0), cap=False, mark=None, shade_ring=None):
    """A tapering tube through `pts` (Vectors), `radii` at each; `tone(k)`
    the shade and blend of ring k; `mark(k, j)` true for a face in the
    `mark` role (a birch's dark bark)."""
    rings = []
    prev_u = None
    for k, p in enumerate(pts):
        d = (pts[min(k + 1, len(pts) - 1)] - pts[max(k - 1, 0)])
        u, w = frame(d)
        if prev_u is not None:
            # Parallel transport: keep the seam from twisting.
            u = (prev_u - d.normalized() * prev_u.dot(d.normalized())).normalized()
            w = d.normalized().cross(u)
        prev_u = u
        s, b = tone(k)
        ring = []
        for j in range(sides):
            a = 2 * math.pi * j / sides
            off = u * math.cos(a) + w * math.sin(a)
            ring.append(t.v(p + off * radii[k], s, b))
        rings.append(ring)
    for k in range(len(rings) - 1):
        for j in range(sides):
            j1 = (j + 1) % sides
            r = "mark" if mark and mark(k, j) else role
            t.f((rings[k][j], rings[k][j1], rings[k + 1][j1], rings[k + 1][j]), r)
    if cap:
        s, b = tone(len(pts) - 1)
        c = t.v(pts[-1] + (pts[-1] - pts[-2]).normalized() * radii[-1] * 0.5, s, b)
        for j in range(sides):
            t.f((rings[-1][j], rings[-1][(j + 1) % sides], c), role)

def sheet(t, strip_a, strip_b, role, up_bias=0.8):
    """A two-faced strip between two rows of points (each a list of
    (point, shade, blend)): its own vertices a face, so it reads from either
    side. The face that looks UP is lit out along the strip and up; the one
    that looks down only out, a little up — never down, or a crown seen from
    under it goes black."""
    for side in (0, 1):
        ra, rb = [], []
        for (pa, sa, ba), (pb, sb, bb) in zip(strip_a, strip_b):
            ra.append((pa, sa, ba))
            rb.append((pb, sb, bb))
        for k in range(len(ra) - 1):
            q = [ra[k], rb[k], rb[k + 1], ra[k + 1]]
            if side == 1:
                q.reverse()
            g = (q[1][0] - q[0][0]).cross(q[2][0] - q[0][0])
            if g.length < 1e-9:
                g = (q[2][0] - q[0][0]).cross(q[3][0] - q[0][0])
            flat = Vector((sum(p[0].x for p in q), sum(p[0].y for p in q), 0))
            out = flat.normalized() if flat.length > 1e-6 else Vector((0, 0, 0))
            up = g.z >= 0
            n = norm((out.x * 0.6, out.y * 0.6, up_bias if up else 0.2))
            dim = 1.0 if up else 0.85
            ix = [t.v(p, sh * dim, bl, n) for p, sh, bl in q]
            t.f(ix, role)

def blob(t, at, r, role, shade=0.8, blend=0.5):
    """A little octahedron: a nut, a bud."""
    at = Vector(at)
    ps = [at + Vector(o) * r for o in ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1))]
    ix = [t.v(p, shade + 0.2 * (p.z > at.z), blend, norm(tuple(p - at))) for p in ps]
    for a, b in ((0, 2), (2, 1), (1, 3), (3, 0)):
        t.f((ix[a], ix[b], ix[4]), role)
        t.f((ix[b], ix[a], ix[5]), role)

def smoothstep(a, b, x):
    u = max(0.0, min(1.0, (x - a) / (b - a)))
    return u * u * (3 - 2 * u)

def flare(r, z):
    """A stem's radius at height z: a root flare at its foot."""
    return r * (1 + 0.45 * math.exp(-max(0.0, z) / 0.35))

def profile_at(v, f):
    """The code's silhouette at a share `f` of the height (`crownAt`), m."""
    p = v["profile"]
    x = max(0.0, min(1.0, f)) * (len(p) - 1)
    i = min(len(p) - 2, int(x))
    return (p[i] + (p[i + 1] - p[i]) * (x - i)) * H

def envelope(v, f):
    """The outline over the silhouette: the widest it reaches at or above `f`
    — a stack of tiers read as the spire they make."""
    p = v["profile"]
    i = max(0, min(len(p) - 1, int(round(f * (len(p) - 1)))))
    return max(p[i:]) * H if i < len(p) else 0.0

def widest(v):
    return max(v["profile"]) * H

# ---------------------------------------------------------------- FOLIAGE
def cluster(t, c, rx, rz, centre, rng, sides=6, rings=2, dark=0.0, droop=0.0):
    """A CLUSTER OF LEAVES: a lobed, flattened ellipsoid round `c`, `rx`
    across and `rz` tall, its vertices' normals leaning out of the crown's
    `centre` as much as out of its own — so a crown of them is lit as ONE
    mass. Its underside is shaded toward the kind's dark, and `dark` more
    for one deep inside the crown."""
    c = Vector(c)
    lat = [(-0.62 + 1.24 * (k + 0.5) / rings) for k in range(rings)]
    out_c = c - Vector(centre)
    out_c = Vector((out_c.x, out_c.y, out_c.z * 0.6))
    oc = out_c.normalized() if out_c.length > 1e-6 else Vector((0, 0, 1))

    turn = Matrix.Rotation(rng.random() * 2 * math.pi, 3, "Z") @ Matrix.Rotation((rng.random() - 0.5) * 0.7, 3, "X")

    def vert(dx, dy, dz):
        dx, dy, dz = turn @ Vector((dx, dy, dz))
        local = Vector((dx, dy, dz)).normalized()
        n = (local * 0.4 + oc * 0.45 + Vector((0, 0, 0.35))).normalized()
        lit = 0.5 + 0.5 * max(0.0, local.z * 0.6 + local.dot(oc) * 0.4)
        shade = (0.62 + 0.38 * lit) * (1 - 0.35 * dark)
        blend = 0.95 - 0.8 * lit + 0.3 * dark
        # A weeping cluster hangs its outer rim.
        sag = droop * max(0.0, Vector((dx, dy, 0)).length / max(rx, 1e-6)) * rz * 0.6
        return t.v(c + Vector((dx, dy, dz - sag)), shade, blend, tuple(n))

    ringsv = []
    for k, l in enumerate(lat):
        ring = []
        cz, sz = math.cos(l * math.pi / 2), math.sin(l * math.pi / 2)
        for j in range(sides):
            a = 2 * math.pi * (j + 0.5 * k) / sides
            w = 0.78 + 0.44 * rng.random()
            ring.append(vert(math.cos(a) * rx * cz * w, math.sin(a) * rx * cz * w, sz * rz * (0.9 + 0.2 * rng.random())))
        ringsv.append(ring)
    bottom = vert(0, 0, -rz)
    top = vert(0, 0, rz * (0.95 + 0.2 * rng.random()))
    for k in range(len(ringsv) - 1):
        lo, hi = ringsv[k], ringsv[k + 1]
        for j in range(sides):
            j1 = (j + 1) % sides
            # The upper ring is turned half a step: a lobe sits in the gap.
            t.f((lo[j], lo[j1], hi[j]), "leaf")
            t.f((lo[j1], hi[j1], hi[j]), "leaf")
    for j in range(sides):
        j1 = (j + 1) % sides
        t.f((bottom, ringsv[0][j1], ringsv[0][j]), "leaf")
        t.f((top, ringsv[-1][j], ringsv[-1][j1]), "leaf")

# ---------------------------------------------------------------- a SPIRE (the spruce, the cypress)
# The most boughs a spire's whorls share (about 16 triangles each).
BOUGHS = 34

def tiers_of(count, base, top):
    """Tier bottoms up the crown, each overlapping the next."""
    out, span = [], top - base
    for i in range(count):
        u = i / count
        bottom = base + span * u * 0.92
        out.append(dict(bottom=bottom, top=min(top, bottom + span * (1.9 / count))))
    return out

def spire(v, f, far, rng):
    t = Tree(v["lean"])
    base, top = v["bare"] * H, v["top"] * H
    count = 3 if far else f["tiers"]
    tiers = tiers_of(count, v["bare"], v["top"])
    for tr in tiers:
        tr["radius"] = max(0.05, envelope(v, tr["bottom"]))
        tr["bottom"] *= H
        tr["top"] *= H
    widest_r = max(tr["radius"] for tr in tiers) or 1.0
    # The stem, up through the crown to the leader.
    r0 = SHAPE["stem"][0] * H
    n = 1 if far else 7
    pts = [Vector((0, 0, -0.3 + (top + 0.3) * k / n)) for k in range(n + 1)]
    tube(t, pts, [flare(r0, p.z) * max(0.08, 1 - p.z / (top * 1.05)) for p in pts], 3 if far else 6,
         "bark", lambda k: (0.7 + 0.3 * k / n, 0.0), cap=True)

    if far:
        # THE SKETCH: three skirts of needles.
        for i, tr in enumerate(tiers):
            sides = 5
            apex = t.v((0, 0, tr["top"]), 1.0, 0.1, (0, 0, 1))
            rim, mid = [], []
            for k in range(sides):
                a = 2 * math.pi * k / sides + i * 0.9
                rr = tr["radius"] * (1 + f["flag"] * math.cos(a) * 0.9 - f["flag"] * 0.25)
                droop = (tr["top"] - tr["bottom"]) * 0.18 * f["droop"]
                c, s = math.cos(a), math.sin(a)
                rim.append((c * rr, s * rr, tr["bottom"] - droop, c, s))
                mid.append((c * rr * 0.55, s * rr * 0.55, (tr["bottom"] + tr["top"]) / 2, c, s))
            for k in range(sides):
                j = (k + 1) % sides
                m1 = [t.v(p[:3], 1.0, 0.15, norm((p[3] * 0.65, p[4] * 0.65, 0.9))) for p in (mid[k], mid[j])]
                t.f((apex, m1[0], m1[1]), "leaf")
                b1 = [t.v(p[:3], 0.85, 0.3 + (k % 2) * 0.4, norm((p[3] * 0.65, p[4] * 0.65, 0.35))) for p in (rim[k], rim[j])]
                t.f((m1[0], b1[0], b1[1], m1[1]), "leaf")
                u0 = t.v((0, 0, tr["bottom"] + (tr["top"] - tr["bottom"]) * 0.15), 0.5, 1.0, (0, 0, -1))
                ub = [t.v(p[:3], 0.6, 1.0, norm((p[3] * 0.65, p[4] * 0.65, -0.1))) for p in (rim[k], rim[j])]
                t.f((u0, ub[1], ub[0]), "leaf")
        return t

    # THE CORE: a dark cone of needles inside the crown, so a wood reads as
    # needles between the boughs rather than as a lattice of them.
    core_n = 6
    solid = 0.45 + 0.45 * max(0.0, 1.0 - f["taper"]) * 2
    solid = min(0.85, solid)
    rings = []
    for k, tr in enumerate(tiers):
        z = tr["bottom"]
        # A column (a cypress) is mostly core: its boughs are a shag on it.
        rr = tr["radius"] * solid * (0.0 if k in f["missing"] else 1.0) + 0.05
        ring = []
        for j in range(core_n):
            a = 2 * math.pi * j / core_n + k
            c, s = math.cos(a), math.sin(a)
            ring.append(t.v((c * rr, s * rr, z), 0.45, 1.0, norm((c, s, 0.2))))
        rings.append(ring)
    tip = t.v((0, 0, top), 0.6, 0.8, (0, 0, 1))
    for k in range(len(rings) - 1):
        for j in range(core_n):
            j1 = (j + 1) % core_n
            t.f((rings[k][j], rings[k][j1], rings[k + 1][j1], rings[k + 1][j]), "leaf")
    for j in range(core_n):
        t.f((rings[-1][j], rings[-1][(j + 1) % core_n], tip), "leaf")

    # THE BOUGHS: every tier a whorl of drooping limbs, flattened and ridged.
    # A tall many-tiered crown shares BOUGHS boughs out rather than growing
    # past them — its upper whorls are small.
    want = [0 if ti in f["missing"] else max(4, round(f["sides"] * (0.45 + 0.55 * tr["radius"] / widest_r)))
            for ti, tr in enumerate(tiers)]
    share = min(1.0, BOUGHS / max(1, sum(want)))
    for ti, tr in enumerate(tiers):
        if ti in f["missing"]:
            continue
        n = max(3, round(want[ti] * share))
        twist = ti * 0.9 + rng.random() * 0.5
        span = tr["top"] - tr["bottom"]
        for k in range(n):
            a = 2 * math.pi * (k + (rng.random() - 0.5) * 0.5) / n + twist
            jag = 1.0 if k % 2 == 0 else 0.78 + rng.random() * 0.12
            lee = 1 + f["flag"] * math.cos(a) * 0.9 - f["flag"] * 0.25
            ragged = 1 + f["rough"] * (rng.random() - 0.5) * 0.9
            L = tr["radius"] * jag * (0.9 + rng.random() * 0.2) * max(0.15, lee) * ragged
            if L < 0.08:
                continue
            droop = span * (0.12 + 0.1 * rng.random()) * jag * f["droop"]
            bough(t, a, L, tr["bottom"] + span * 0.78, tr["bottom"] - droop, math.pi * L / n, f, rng)

    if f["twin"]:
        # A second leader off the top whorl, a little lower and to one side.
        z0 = base + (top - base) * 0.72
        off = 0.25 * widest_r
        for tr in tiers_of(3, z0 / H, v["top"] * 0.95):
            rr = max(0.12, envelope(v, tr["bottom"]) * 0.45)
            for k in range(4):
                a = 2 * math.pi * k / 4 + rng.random()
                bough(t, a, rr, tr["top"] * H, tr["bottom"] * H, math.pi * rr / 4 * 1.3, f, rng,
                      root=0.02, at=off)
        tube(t, [Vector((0, 0, z0)), Vector((off, 0, v["top"] * 0.95 * H))], [0.05, 0.01], 4, "bark",
             lambda k: (0.8, 0.0))
    if f["spire"] > 0:
        # The dead spike a broken top leaves: bare wood over the last whorl.
        tube(t, [Vector((0, 0, top - 0.3)), Vector((0.03 * H, 0, top + f["spire"] * H))],
             [0.05, 0.01], 4, "bark", lambda k: (0.8, 0.0))
    return t

def bough(t, a, L, z0, z1, hw, f, rng, root=0.06, at=0.0):
    """One drooping limb of a whorl: out along azimuth `a`, `L` long, from
    `z0` at the stem to `z1` at the tip, `hw` wide a side at its widest —
    ridged across its top and flat under, its tip a blunt spray."""
    c, s = math.cos(a), math.sin(a)
    side = Vector((-s, c, 0))
    hw = min(hw * 1.2, L * 0.55)
    sag = 1.2 + 0.4 * f["droop"]
    thick = 0.05 + 0.05 * L
    stations = (0.06, 0.45, 0.8)
    def pos(u):
        z = z0 + (z1 - z0) * u ** sag
        return Vector((at + c * (root + L * u), s * (root + L * u), z))
    def width(u):
        return hw * (0.3 + 0.7 * math.sin(math.pi * (0.12 + 0.72 * u)))
    tipc = rng.random() * 0.35
    tops, unders = [], []
    for u in stations:
        p = pos(u)
        w = width(u)
        up = 0.95 - 0.7 * u
        left = t.v(p + side * w - Vector((0, 0, w * 0.35)), 0.55 + 0.4 * u, 0.35 + tipc,
                   norm((c * 0.65 - s * 0.3, s * 0.65 + c * 0.3, up * 0.7)))
        ridge = t.v(p + Vector((0, 0, thick)), 0.6 + 0.4 * u, tipc * 0.5, norm((c * 0.65, s * 0.65, up)))
        right = t.v(p - side * w - Vector((0, 0, w * 0.35)), 0.55 + 0.4 * u, 0.35 + tipc,
                    norm((c * 0.65 + s * 0.3, s * 0.65 - c * 0.3, up * 0.7)))
        tops.append((left, ridge, right))
        ul = t.v(p + side * w - Vector((0, 0, w * 0.35)), 0.5, 1.0, norm((c * 0.5, s * 0.5, -0.3)))
        ur = t.v(p - side * w - Vector((0, 0, w * 0.35)), 0.5, 1.0, norm((c * 0.5, s * 0.5, -0.3)))
        unders.append((ul, ur))
    tp = pos(1.0)
    tw = width(1.0) * 0.55
    tl = t.v(tp + side * tw - Vector((0, 0, tw * 0.4)), 0.95, tipc + 0.2,
             norm((c * 0.65 - s * 0.3, s * 0.65 + c * 0.3, 0.25)))
    tr_ = t.v(tp - side * tw - Vector((0, 0, tw * 0.4)), 0.95, tipc + 0.2,
              norm((c * 0.65 + s * 0.3, s * 0.65 - c * 0.3, 0.25)))
    tip = t.v(tp + Vector((0, 0, thick * 0.4)), 0.95, tipc, norm((c * 0.65, s * 0.65, 0.4)))
    ul_ = t.v(tp + side * tw - Vector((0, 0, tw * 0.4)), 0.5, 1.0, norm((c * 0.5, s * 0.5, -0.3)))
    ur_ = t.v(tp - side * tw - Vector((0, 0, tw * 0.4)), 0.5, 1.0, norm((c * 0.5, s * 0.5, -0.3)))
    for i in range(len(stations) - 1):
        l0, g0, r0_ = tops[i]
        l1, g1, r1_ = tops[i + 1]
        t.f((r0_, r1_, g1, g0), "leaf")
        t.f((g0, g1, l1, l0), "leaf")
        t.f((unders[i + 1][0], unders[i + 1][1], unders[i][1], unders[i][0]), "leaf")
    l, g, r = tops[-1]
    t.f((r, tr_, tip, g), "leaf")
    t.f((g, tip, tl, l), "leaf")
    t.f((ul_, ur_, unders[-1][1], unders[-1][0]), "leaf")

# ---------------------------------------------------------------- a PINE
def pine(v, f, far, rng):
    t = Tree(v["lean"])
    seed = v["index"] * 3 + 1
    stems = 2 if f["splay"] > 0 else 1
    C = widest(v)
    bare = v["bare"]
    top = v["top"]

    def kink_x(y):
        return min(1.0, (y - f["kink"]) / 0.12) * f["kinkBy"] if f["kink"] > 0 and y > f["kink"] else 0.0

    def stem_at(st, y):
        """Where stem `st` is at a share `y` of the height, m across."""
        if stems == 1:
            return kink_x(y) * C, 0.0
        a = st * 2.4 + seed
        tilt = f["splay"] * (0.3 if st == 0 else 1) * 1.6 * max(0.0, y - bare * 0.6)
        return (kink_x(y) + math.cos(a) * tilt) * C, math.sin(a) * tilt * C

    r0 = SHAPE["stem"][0] * H * (0.8 if stems > 1 else 1)
    for st in range(stems):
        reach = SHAPE["leader"] * top if st == 0 else (0.82 + 0.08 * rng.random()) * top
        joints = [0, 0.5, reach] if far else [0, 0.15, 0.3, 0.45, bare, (bare + reach) / 2, reach]
        ys = sorted(set(y for y in joints if y <= reach))
        pts = [Vector((*stem_at(st, y), y * H)) for y in ys]
        pts[0].z = -0.3
        # The bark goes to its upper colour above the crown's shade — a
        # Scots pine's copper — through the band the code's two stems meet at.
        tube(t, pts, [flare(r0, p.z) * (1 - 0.72 * max(0, p.z) / H) for p in pts], 3 if far else 6, "bark",
             lambda k: (0.7 + 0.3 * k / (len(pts) - 1), smoothstep(bare * 0.7, bare * 1.05, ys[k])), cap=True)

    pads = min(3 + stems, f["pads"]) if far else f["pads"]
    pad_sides = 5 if far else 8
    for i in range(pads):
        st = i % stems
        u = 0.5 if pads == 1 else i / (pads - 1)
        y = bare + (top - bare - f["thick"]) * (0.08 + 0.92 * u)
        a = i * 2.39996 + seed
        top_pad = i == pads - 1
        j = rng.random()
        room = profile_at(v, y) / max(C, 1e-6)
        reach = 0.05 if top_pad else f["reach"] * (0.35 + 0.65 * j) * max(0.35, room) * (1 - f["young"] * u * 0.8)
        if f["layers"] > 0 and not top_pad:
            per = max(1, math.ceil((pads - 1) / f["layers"]))
            layer = i // per
            lu = 0.5 if f["layers"] == 1 else layer / (f["layers"] - 1)
            y = bare + (top - bare - f["thick"]) * (0.05 + 0.8 * lu)
            a = (i % per) / per * 2 * math.pi + layer * 1.1 + seed
            reach = f["reach"] * (0.95 - 0.55 * lu) * (0.85 + 0.3 * rng.random())
        sx, sy = stem_at(st, y)
        cx, cy = sx + math.cos(a) * reach * C, sy + math.sin(a) * reach * C
        pr = (0.42 + 0.22 * rng.random()) * (1 - f["young"] * (u * 0.7 - 0.25)) * (0.8 if stems > 1 else 1) * C
        # A pad is a cushion, domed a quarter again as thick as the row says: the
        # row's figure is the code's flat plate.
        zc, th = y * H, f["thick"] * H * 1.25
        if not top_pad and not far:
            # The branch out to the pad, bowed up under it.
            b0 = Vector((sx, sy, zc - th * 0.6))
            b1 = Vector((cx, cy, zc))
            tube(t, [b0, b0.lerp(b1, 0.5) + Vector((0, 0, th * 0.12)), b1], [0.06, 0.04, 0.022], 4, "bark",
                 lambda k: (0.8, 1.0))
        pad(t, cx, cy, zc, pr, th, pad_sides, rng)
    return t

def pad(t, cx, cy, z, r, th, n, rng):
    """A PAD of needles: a lobed cushion, its rim drooping, its top domed and
    lit, a dark belly under it."""
    rim, inner = [], []
    for j in range(n):
        a = 2 * math.pi * j / n + rng.random() * 0.4
        lobe = 1.0 if j % 2 == 0 else 0.78
        rr = r * lobe * (0.8 + 0.3 * rng.random())
        c, s = math.cos(a), math.sin(a)
        rim.append((cx + c * rr, cy + s * rr, z + th * 0.2 * rng.random() - th * 0.15, c, s))
        inner.append((cx + c * rr * 0.6, cy + s * rr * 0.6, z + th * 0.8, c, s))
    crown = t.v((cx, cy, z + th), 1.0, 0.0, (0, 0, 1))
    belly = t.v((cx, cy, z - th * 0.35), 0.5, 1.0, (0, 0, -1))
    iv = [t.v(p[:3], 1.0, 0.05, norm((p[3] * 0.5, p[4] * 0.5, 1))) for p in inner]
    rv = [t.v(p[:3], 0.9, 0.15 + 0.35 * (j % 2), norm((p[3], p[4], 0.35))) for j, p in enumerate(rim)]
    ru = [t.v(p[:3], 0.6, 1.0, norm((p[3], p[4], -0.4))) for p in rim]
    for j in range(n):
        k = (j + 1) % n
        t.f((crown, iv[j], iv[k]), "leaf")
        t.f((iv[j], rv[j], rv[k], iv[k]), "leaf")
        t.f((belly, ru[k], ru[j]), "leaf")

# ---------------------------------------------------------------- a BROADLEAF in leaf
def broadleaf(v, f, far, rng, dome_only=False):
    """Stems out of one stool, limbs off them, and the crown as clusters of
    leaves over a shaded core, all inside the code's silhouette."""
    t = Tree(v["lean"])
    seed = v["index"] * 3 + 1
    stems = min(2, v["stems"]) if far else v["stems"]
    bare, top = v["bare"], v["top"]
    C = widest(v)
    zmid = (bare + top) / 2 * H
    rise = (top - bare) / 2 * H
    # A mangrove's canopy stands on its own short trunk, not a broadleaf's.
    B = SHAPE if FORM == "broadleaf" else dict(stem=SHAPE["trunk"]["r"], thin=0.0)
    thin = max(1, v["stems"]) ** B["thin"]
    marks = PAINT_MARKS
    # THE STEMS: leaned apart out of one stool (the code's splay, or the
    # variant's), twisted where the kind is gnarled.
    tips = []
    for st in range(stems):
        sa = st * 2.4 + seed * 0.7
        tilt = 0 if stems == 1 else f["splay"] * (0.55 if st == 0 else 1)
        height = (1 if st == 0 else 0.85 + 0.1 * rng.random()) * (bare + (top - bare) * 0.55) * H
        r = B["stem"][0] * H / thin * (1.25 if f["twist"] > 0.5 else 1)
        rings = 1 if far else 7
        round_ = 3 if far else 6

        def along(z, sa=sa, tilt=tilt):
            k = max(0.0, z) / max(height, 1e-6)
            wob = f["twist"] * 0.08 * H * math.sin(k * 5.0 + sa * 3) * k
            out = math.tan(tilt) * z
            return Vector((math.cos(sa) * out + wob * math.sin(sa), math.sin(sa) * out - wob * math.cos(sa), z))

        pts = [along(-0.3 + (height + 0.3) * k / rings) for k in range(rings + 1)]
        cells = {(k, j) for k in range(rings) for j in range(round_) if rng.random() < marks}
        tube(t, pts, [flare(r, p.z) * (1 - 0.55 * max(0.0, p.z) / height) for p in pts], round_,
             "bark", lambda k: (0.75 + 0.25 * k / rings, 0.0), cap=True,
             mark=None if far else (lambda k, j: (k, j) in cells and k > 0))
        tips.append(pts[-1])
    centre = Vector((0, 0, zmid))
    if not tips:
        tips.append(centre)
    # THE CORE: a shaded mass inside the crown, so the gaps between the
    # clusters read as leaves deeper in, not as sky.
    core_w = C * (0.6 + 0.15 * f["dome"]) * (1 - 0.3 * f["open"])
    cluster(t, (0, 0, zmid + rise * 0.05), core_w, rise * 0.72, (0, 0, zmid - rise), rng,
            sides=5 if far else 7, rings=2, dark=0.85 if not far else 0.55)
    n = 3 if far else f["clusters"]
    limbs = 0 if far else f["limbs"]
    # THE LIMBS: out of the stems' crowns toward the clusters they carry.
    anchors = []
    for i in range(limbs):
        tipv = tips[i % len(tips)]
        a = i * 2.39996 + seed
        fz = bare + (top - bare) * (0.25 + 0.5 * (i + 0.5) / max(1, limbs))
        reach = profile_at(v, fz) * (0.55 + 0.2 * rng.random())
        root = Vector((tipv.x * 0.8, tipv.y * 0.8, min(tipv.z, fz * H) - 0.2 * rise))
        end = Vector((math.cos(a) * reach, math.sin(a) * reach, fz * H))
        mid = root.lerp(end, 0.5) + Vector((0, 0, 0.12 * rise * (1 - f["weep"])))
        w = B["stem"][1] * H / thin * 0.9
        tube(t, [root, mid, end], [w, w * 0.65, w * 0.35], 4, "twig", lambda k: (0.8 + 0.1 * k, 0.15 * k))
        anchors.append(end)
    # THE CLUSTERS: a shell of leaf clumps laid inside the silhouette, their
    # outsides on it (the inside is the core's), the outer ones hanging
    # where the kind weeps. Sizes vary two to one, and each is turned and
    # tipped its own way: one size of lump in rows is a head of broccoli.
    for i in range(n):
        u = (i + 0.5) / n
        fz = bare + (top - bare) * (0.08 + 0.86 * (0.5 - 0.5 * math.cos(math.pi * u)))
        a = i * 2.39996 + seed + rng.random() * 0.4
        room = profile_at(v, fz)
        size = C * ((0.2 + 0.16 * rng.random()) if not far else 0.5) * (1 - 0.25 * f["open"])
        radial = max(0.0, room - size * (0.55 + 0.35 * rng.random())) if not far else room * 0.5
        cx, cy = math.cos(a) * radial, math.sin(a) * radial
        if anchors and not far:
            near = min(anchors, key=lambda p: (p.x - cx) ** 2 + (p.y - cy) ** 2 + (p.z - fz * H) ** 2)
            cx, cy = (cx * 3 + near.x) / 4, (cy * 3 + near.y) / 4
        share = min(1.0, radial / max(C, 1e-6))
        hang = 1 + 1.4 * f["weep"] * share
        rz = min(size * 0.66 * hang, rise * 0.7)
        drop = f["weep"] * rz * 0.6 * share
        cluster(t, (cx, cy, fz * H - drop), size, rz, (0, 0, zmid - rise * 0.4), rng,
                sides=5, rings=2, dark=max(0.0, 0.45 - share),
                droop=f["weep"] * 0.5)
    return t

# ---------------------------------------------------------------- a PALM
def palm(v, f, far, rng):
    t = Tree(v["lean"])
    seed = v["index"] * 3 + 1
    s = LOOK["spread"] * v["spread"]
    crown_z = v["bare"] * v["top"] * H
    # THE TRUNK: bowed off its lean, thinning to the crown, ringed.
    bow = f["curve"] * H * 0.25
    n = 2 if far else 10
    def at(k):
        u = k / n
        return Vector((bow * math.sin(math.pi * u * 0.9) * (1 - 0.3 * u), 0, -0.3 + (crown_z + 0.3) * u))
    pts = [at(k) for k in range(n + 1)]
    R = SHAPE["stem"]
    def radius(k):
        u = k / n
        r = (R[0] + (R[2] - R[0]) * u) * H
        return flare(r, pts[k].z)
    tube(t, pts, [radius(k) for k in range(n + 1)], 4 if far else 7, "bark",
         lambda k: (0.75 + (0.15 if k % 2 else 0) + 0.1 * k / n, 1.0 if k >= n - 1 else 0.0), cap=True)
    head = pts[-1]
    # THE BUD the fronds come out of.
    blob(t, head + Vector((0, 0, SHAPE["bud"] * H * 0.4)), SHAPE["bud"] * H, "leaf", 0.55, 0.9)
    fronds = min(6, v["stems"]) if far else v["stems"]
    for i in range(fronds):
        a = (i / fronds) * 2 * math.pi + (rng.random() - 0.5) * 0.5 + seed
        reach = s * SHAPE["reach"] * (SHAPE["reachVary"][0] + rng.random() * SHAPE["reachVary"][1]) * H
        droop = reach * (SHAPE["droop"][0] + rng.random() * SHAPE["droop"][1]) * f["droop"]
        # The top fronds stand up out of the head, the lowest hang: a fan
        # palm's head is a ball of them, a feather palm's a shock.
        tier = i % 3
        rise = [0.35, 0.1, -0.2][tier]
        if f["fan"]:
            rise = -0.55 + 1.5 * ((i * 0.618034) % 1.0)
        if f["fan"]:
            fan(t, head, a, reach, droop, rise, s, far, rng)
        else:
            feather(t, head, a, reach, droop, rise, s, far, rng)
    for i in range(0 if far else f["skirt"]):
        # A dead frond hanging down the trunk under the head.
        a = i * 2.39996 + seed
        c, sn = math.cos(a), math.sin(a)
        root = head + Vector((c * 0.15, sn * 0.15, -0.2))
        tip = root + Vector((c * 0.5, sn * 0.5, -s * SHAPE["reach"] * H * 0.7))
        w = s * SHAPE["width"] * H
        side = Vector((-sn, c, 0)) * w
        strip_a = [(root.lerp(tip, u) + side * (0.3 + 0.7 * u), 0.7, 0.2) for u in (0, 0.5, 1)]
        strip_b = [(root.lerp(tip, u) - side * (0.3 + 0.7 * u), 0.7, 0.2) for u in (0, 0.5, 1)]
        sheet(t, strip_a, strip_b, "twig", up_bias=0.3)
    if f["nuts"] and not far:
        for k in range(4):
            a = k * 1.7 + seed
            blob(t, head + Vector((math.cos(a) * 0.22, math.sin(a) * 0.22, -0.25 - 0.1 * (k % 2))), 0.13, "twig",
                 0.7, 0.55)
    return t

def rachis(head, a, reach, droop, rise, u):
    """A frond's midrib at a share `u` of its reach: out from the head, up a
    little and then down as the square of the reach — the code's frond."""
    c, s = math.cos(a), math.sin(a)
    out = reach * u
    z = head.z + reach * (0.3 + rise) * u * (1 - u) * 2 - droop * u * u
    return Vector((head.x + c * out, head.y + s * out, z))

def feather(t, head, a, reach, droop, rise, s, far, rng):
    """A FEATHER frond: the rachis with its leaflets down both sides, folded
    into a V hanging under it and cut into a comb at the edge."""
    c, sn = math.cos(a), math.sin(a)
    side = Vector((-sn, c, 0))
    stations = [0, 0.5, 1] if far else [0, 0.12, 0.26, 0.4, 0.54, 0.68, 0.82, 0.93, 1]
    half = s * SHAPE["width"] * H * 2.6
    mid, left, right = [], [], []
    for k, u in enumerate(stations):
        p = rachis(head, a, reach, droop, rise, u)
        w = half * (0.25 + 0.75 * math.sin(math.pi * min(1.0, u * 1.15))) * (1.0 if far or k % 2 else 0.75)
        hang = Vector((0, 0, -w * 0.32))
        mid.append((p, 0.85 + 0.15 * u, 0.6 - 0.5 * u))
        left.append((p + side * w + hang, 0.8 + 0.2 * u, 0.4 - 0.3 * u))
        right.append((p - side * w + hang, 0.8 + 0.2 * u, 0.4 - 0.3 * u))
    if far:
        # The sketch: one strip, edge to edge.
        sheet(t, left, right, "leaf")
    else:
        sheet(t, left, mid, "leaf")
        sheet(t, mid, right, "leaf")

def fan(t, head, a, reach, droop, rise, s, far, rng):
    """A FAN frond: a stalk out of the head, pitched up or down with its tier,
    and a pleated fan opening at its end in the plane of the stalk and the
    side — folded along its middle into a shallow V, its tips drooping."""
    c, sn = math.cos(a), math.sin(a)
    pitch = math.atan2(reach * (0.3 + rise) * 1.4 - droop * 0.5, reach)
    out = Vector((c * math.cos(pitch), sn * math.cos(pitch), math.sin(pitch)))
    side = Vector((-sn, c, 0))
    normal = out.cross(side).normalized()
    stalk = reach * 0.4
    p0 = head + Vector((c, sn, 0)) * 0.1
    p1 = p0 + out * stalk
    if not far:
        tube(t, [p0, p0.lerp(p1, 0.5) + normal * 0.04, p1], [0.05, 0.035, 0.025], 3, "twig",
             lambda k: (0.8, 0.4))
    R = reach * 0.62
    ribs = 3 if far else 9
    spread = math.radians(150)
    centre, edge = [], []
    for k in range(ribs):
        u = k / (ribs - 1)
        b = -spread / 2 + spread * u
        d = out * math.cos(b) + side * math.sin(b)
        # The V along the middle, a pleat a rib, the tips sagging under
        # their own weight.
        fold = (abs(u - 0.5) * 2) * R * 0.28 + (0.05 if k % 2 == 0 else -0.04) * R
        tip = p1 + d * R + normal * fold - Vector((0, 0, droop * 0.25 * (0.5 + abs(u - 0.5))))
        centre.append((p1, 0.8, 0.7))
        edge.append((tip, 0.85 + 0.15 * math.sin(math.pi * u), 0.15 + 0.2 * (k % 2)))
    sheet(t, centre, edge, "leaf", up_bias=0.9)

# ---------------------------------------------------------------- a MANGROVE on its prop roots
# The canopy: the broadleaf's clusters, domed, on the code's short trunk;
# the prop roots are the stool it stands on.
SPREAD_CROWN = dict(form="broadleaf", limbs=0, clusters=16, dome=0.5, weep=0.1, splay=0.0, open=0.1, twist=0.0)

# ---------------------------------------------------------------- the KIND: six variants, two bands each
def build(v, far, rng):
    f = v["shape"]
    if FORM == "spire":
        return spire(v, f, far, rng)
    if FORM == "pine":
        return pine(v, f, far, rng)
    if FORM == "broadleaf":
        return broadleaf(v, f, far, rng)
    if FORM == "palm":
        return palm(v, f, far, rng)
    if FORM == "mangrove":
        # The canopy's clusters on a single short stem (the prop roots are
        # the stool); the trunk inside the crown is the code's.
        crown_v = dict(v, stems=1)
        t = broadleaf(crown_v, dict(SPREAD_CROWN, dome=0.5 * f["dome"]), far, rng)
        return mangrove_roots(t, v, f, far, rng)
    raise ValueError(FORM)

def mangrove_roots(t, v, f, far, rng):
    seed = v["index"] * 3 + 1
    s = LOOK["spread"] * v["spread"]
    bare = v["bare"] * H
    ring = s * SHAPE["ring"] * H
    roots = 4 if far else v["stems"]
    for i in range(roots):
        a = (i / roots) * 2 * math.pi + (rng.random() - 0.5) * 0.5 + seed
        d = ring * (SHAPE["spread"][0] + rng.random() * SHAPE["spread"][1])
        c, sn = math.cos(a), math.sin(a)
        foot = Vector((c * d, sn * d, -0.3))
        knee_z = bare * (SHAPE["knee"][0] + rng.random() * SHAPE["knee"][1]) * f["arch"]
        knee = Vector((c * d * SHAPE["inset"][0], sn * d * SHAPE["inset"][0], knee_z))
        top = Vector((c * d * SHAPE["inset"][1], sn * d * SHAPE["inset"][1], bare))
        r = SHAPE["root"][0] * H
        if far:
            pts, radii = [foot, knee, top], [r * 1.2, r, r * 1.2]
        else:
            # The arch: out and up off the mud, then in to the trunk's foot.
            bulge = Vector((c, sn, 0)) * d * 0.12
            pts = [foot, foot.lerp(knee, 0.5) + bulge, knee, knee.lerp(top, 0.5) + Vector((0, 0, bare * 0.05)), top]
            radii = [r * 1.15, r, r * 0.95, r * 1.05, r * 1.25]
        tube(t, pts, radii, 3 if far else 4, "bark", lambda k: (0.62 + 0.1 * k, 0.0))
    tr = SHAPE["trunk"]
    tube(t, [Vector((0, 0, bare * tr["from"])), Vector((0, 0, bare + tr["over"] * H))],
         [tr["r"][0] * H, tr["r"][1] * H], 3 if far else 6, "bark", lambda k: (0.75, 0.0))
    for i in range(0 if far else f["drops"]):
        # An aerial root hanging from the canopy's underside into the water.
        a = i * 2.39996 + seed + 1
        rr = s * SHAPE["dome"] * H * (0.5 + 0.3 * rng.random())
        p0 = Vector((math.cos(a) * rr, math.sin(a) * rr, bare + 0.3))
        tube(t, [p0, p0 + Vector((0.08, 0, -bare * 0.6)), Vector((p0.x * 1.05, p0.y * 1.05, -0.3))],
             [0.035, 0.03, 0.045], 3, "bark", lambda k: (0.7, 0.0))
    return t

made = []
tris = {}
for v in DATA["variants"]:
    for far in (False, True):
        rng = random.Random(f"{KIND}/{v['index']}/{far}")
        name = f"v{v['index']}" + ("_far" if far else "")
        ob = build(v, far, rng).object(name)
        made.append(ob)
        tris[name] = sum(len(p.vertices) - 2 for p in ob.data.polygons)

root = bpy.data.objects.new(KIND, None)
COL.objects.link(root)
root["height"], root["frame"] = H, "tree"
for ob in made:
    ob.parent = root
full = [tris[f"v{i}"] for i in range(len(DATA["variants"]))]
fars = [tris[f"v{i}_far"] for i in range(len(DATA["variants"]))]
print("TRIANGLES", KIND, "full", min(full), "-", max(full), "far", min(fars), "-", max(fars),
      "total", sum(full) + sum(fars))

if GAME:
    lib._select_only([root] + made)
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, f"{KIND}.glb"), use_selection=True, export_extras=True,
                              export_normals=True, export_vertex_color="ACTIVE", export_all_vertex_colors=False,
                              export_animations=False, export_skins=False, export_morph=False,
                              export_materials="EXPORT")

# ---------------------------------------------------------------- the STUDIO: the six in a row, on the shore
only = [x for x in os.environ.get("VIEWS", "").split(",") if x]
views = [x for x in ("row", "far", "close") if (not only or x in only)] if (not GAME or only) else []
if only == ["none"]:
    views = []
if views:
    GAP = max(2.2 * max(widest(v) for v in DATA["variants"]), 0.35 * H)
    for ob in made:
        i = int(ob.name[1:].split("_")[0])
        ob.location = (i * GAP, 0, 0)
    ground = mat("ground", (0.32, 0.3, 0.24), rough=0.9)
    bpy.ops.mesh.primitive_plane_add(size=600, location=(2.5 * GAP, 0, -0.02))
    bpy.context.active_object.data.materials.append(ground)
    world = bpy.data.worlds.new("sky")
    scene.world = world
    try:
        world.use_nodes = True
    except Exception:
        pass
    bg = world.node_tree.nodes.get("Background")
    bg.inputs[0].default_value = (0.5, 0.68, 0.86, 1)
    bg.inputs[1].default_value = 1.0
    sun = bpy.data.lights.new("sun", "SUN")
    sun.energy = 4.5
    sun.angle = math.radians(1.2)
    sun.color = (1.0, 0.96, 0.9)
    so = bpy.data.objects.new("sun", sun)
    COL.objects.link(so)
    so.rotation_euler = (math.radians(50), math.radians(8), math.radians(-35))
    lib._cycles(SAMPLES)
    scene.view_settings.exposure = 0.3
    tag = "game" if GAME else "render"
    for view in views:
        cd = bpy.data.cameras.new(view)
        cam = bpy.data.objects.new(view, cd)
        COL.objects.link(cam)
        if view == "close":
            # Variant 0 as a rider on the water sees it, 18 m off.
            scene.render.resolution_x, scene.render.resolution_y = 900, 1200
            cd.lens = 24
            cam.location = (0, -1.8 * H, 1.3)
            cam.rotation_euler = (math.radians(90 + 16), 0, 0)
        else:
            scene.render.resolution_x, scene.render.resolution_y = 1800, 520
            cd.type = "ORTHO"
            cd.ortho_scale = max(6.2 * GAP, H * 1.2 * 1800 / 520)
            cam.location = (2.5 * GAP, -80, H * 0.56)
            cam.rotation_euler = (math.radians(90), 0, 0)
        for ob in made:
            ob.hide_render = ob.name.endswith("_far") != (view == "far")
        scene.camera = cam
        scene.render.filepath = os.path.join(OUT, f"{KIND}-{tag}-{view}.png")
        bpy.ops.render.render(write_still=True)
