# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# THE FOLIAGE SHELF: what every modelled PLANT is built from — the trees
# (`tree.py`) and the undergrowth (`undergrowth.py`) alike: the mesh under
# construction with a tone and a role on every vertex and face, the tubes,
# the two-faced sheets, the leaf clusters, the role materials the stills are
# painted with, and the frame helpers. Split out of `tree.py` the day the
# undergrowth was modelled, so one shelf carries both and the two cannot
# drift apart in what a ROLE or a TONE means.
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
#
# WINDING: Blender's frame is z up, so a ring laid round anticlockwise seen
# from above, walked bottom ring to top ring, faces OUT. The game culls the
# back of every face of a TREE (the Cycles still does not), so a face wound
# the other way is a hole in the game and not in the still — judge in the
# game's lab. The undergrowth is drawn two-sided (a blade of grass has no
# inside), so a sheet there is one face.

import math, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib
from lib import *

ROLES = ("leaf", "bark", "twig", "mark")
MATS = []

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

def role_mats(paint):
    """The four role materials, in ROLES' order, painted for the stills in
    `paint` (a kind's own colours in linear light) — every mesh built here
    carries all four, so a face's material index IS its role."""
    P_ = paint or {}
    MATS[:] = [
        role_mat("leaf", P_.get("leafLit", GREY), P_.get("leafDark", GREY), rough=0.8),
        role_mat("bark", P_.get("stem", GREY), P_.get("stemHigh", GREY)),
        role_mat("twig", P_.get("stem", GREY), P_.get("leafDark", GREY)),
        role_mat("mark", P_.get("stemMark", GREY), P_.get("stemMark", GREY)),
    ]
    return MATS

# ---------------------------------------------------------------- the MESH being built
def norm(v):
    l = math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) or 1.0
    return (v[0] / l, v[1] / l, v[2] / l)

class Plant:
    """A mesh under construction: every vertex with its tone (shade, blend)
    and — for foliage — its own normal; every face its role. The variant's
    LEAN shears every point over by its height, to +x."""

    def __init__(self, lean, roles=None, mats=None):
        self.lean = math.tan(lean)
        # The roles a face may take and the materials they are, in order —
        # the foliage's four unless a builder (the rocks') brings its own.
        self.role_names = roles or ROLES
        self.mats = mats if mats is not None else MATS
        self.co, self.tone, self.nrm, self.faces, self.roles = [], [], [], [], []

    def v(self, p, shade=1.0, blend=0.0, n=None):
        x, y, z = p
        self.co.append((x + max(0.0, z) * self.lean, y, z))
        self.tone.append((max(0.0, min(1.0, shade)), max(0.0, min(1.0, blend)), 0.0))
        self.nrm.append(n)
        return len(self.co) - 1

    def f(self, idx, role):
        self.faces.append(tuple(idx))
        self.roles.append(self.role_names.index(role))

    def object(self, name):
        me = bpy.data.meshes.new(name)
        me.from_pydata(self.co, [], self.faces)
        me.validate(clean_customdata=False)
        for m in self.mats:
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

def profile_at(v, f, H):
    """The code's silhouette at a share `f` of the height (`crownAt`), m."""
    p = v["profile"]
    x = max(0.0, min(1.0, f)) * (len(p) - 1)
    i = min(len(p) - 2, int(x))
    return (p[i] + (p[i + 1] - p[i]) * (x - i)) * H

def envelope(v, f, H):
    """The outline over the silhouette: the widest it reaches at or above `f`
    — a stack of tiers read as the spire they make."""
    p = v["profile"]
    i = max(0, min(len(p) - 1, int(round(f * (len(p) - 1)))))
    return max(p[i:]) * H if i < len(p) else 0.0

def widest(v, H):
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

# ---------------------------------------------------------------- the STUDIO: the variants in a row, on the shore
def row_studio(made, kind, out, samples, H, gap):
    """The stills: every variant of a kind in a row `gap` apart on the ground
    (`row`: the whole plants; `far`: their sketches, when the kind has any)
    and `close`, variant 0 as a rider on the water sees it. Nothing when
    VIEWS says `none`, or in the game quality unless VIEWS asks."""
    only = [x for x in os.environ.get("VIEWS", "").split(",") if x]
    has_far = any(ob.name.endswith("_far") for ob in made)
    views = [x for x in ("row", "far", "close") if (not only or x in only)] if (not GAME or only) else []
    if only == ["none"]:
        views = []
    if not has_far:
        views = [x for x in views if x != "far"]
    if not views:
        return
    for ob in made:
        i = int(ob.name[1:].split("_")[0])
        ob.location = (i * gap, 0, 0)
    ground = mat("ground", (0.32, 0.3, 0.24), rough=0.9)
    bpy.ops.mesh.primitive_plane_add(size=600, location=(2.5 * gap, 0, -0.02))
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
    lib._cycles(samples)
    scene.view_settings.exposure = 0.3
    tag = "game" if GAME else "render"
    n = 1 + max(int(ob.name[1:].split("_")[0]) for ob in made)
    mid = (n - 1) / 2 * gap
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
            cd.ortho_scale = max((n + 0.2) * gap, H * 1.2 * 1800 / 520)
            cam.location = (mid, -80, H * 0.56)
            cam.rotation_euler = (math.radians(90), 0, 0)
        for ob in made:
            ob.hide_render = ob.name.endswith("_far") != (view == "far")
        scene.camera = cam
        scene.render.filepath = os.path.join(out, f"{kind}-{tag}-{view}.png")
        bpy.ops.render.render(write_still=True)
