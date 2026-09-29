# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# THE BIRDS MODELLED IN BLENDER: one SPECIES at a time, off the very row the
# code's builder reads (`pwa/src/game/bird-defs.ts` — its span, its length,
# its neck, its wing's chord, taper, sweep and wrist — and `bird-wing.ts`'s
# wing numbers, handed in as one JSON file by `scripts/blender.mjs
# --kind=bird`). The code's bird is a six-sided spindle with two flat wings
# and a tail quad; what this makes is a bird: a chest deep under the
# shoulders tapering to the tail root, the neck curving up to a head with a
# brow and an eye, a bill that tapers to a point, the wing with a rounded
# leading edge and a little camber, notched into primaries at a broad tip,
# a tail fanned into feathers, and legs where the row's silhouette has them.
#
# THE FRAME is the code's, exactly, because THE SHADER FLAPS THE WING: the
# shoulders at the origin, the bill toward +z, the right wing along +x, both
# wings LEVEL in the y = 0 plane, the wrist at `wrist` of the half-span —
# `birds.ts` hinges every wing vertex about those lines per instance, so a
# wing stood anywhere else folds about the wrong line. A vertex's tone
# carries its SHADE in R and, in B, whether it is a WING (1) — the flag the
# game reads back out as `aWing`. Blender is z up with the game's +z laid
# along −y, so glTF's y-up export gives the game's frame back untouched.
#
# DRESSED BY NAME: `back`, `belly`, `tip`, `head`, `bill`, `tail`, `legs`
# (`BIRD_ROLES`), which the game colours off the species' own style.

import json, math, os, random, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib
from lib import *
from foliage import Plant, norm

argv = sys.argv[sys.argv.index("--") + 1:]
DATA = json.load(open(argv[0]))
OUT = argv[1]
SAMPLES = int(argv[2]) if len(argv) > 2 else 64
ID = DATA["id"]
SPEC = DATA["spec"]
WING = DATA["wing"]
LEGS = DATA["legs"]
PAINT = DATA.get("paint") or {}

ROLES = ("back", "belly", "tip", "head", "bill", "tail", "legs")
GREY = (0.5, 0.5, 0.5)
MATS = [mat(r, tuple(PAINT.get(r, GREY)) if not GAME else GREY, rough=0.85) for r in ROLES]


def B(p):
    """The game's frame (x right, y up, z forward) laid in Blender's (z up)."""
    x, y, z = p
    return (x, -z, y)


class Bird(Plant):
    """The plant mesh, in the bird's frame, with a WING flag on a vertex."""

    def __init__(self):
        super().__init__(0.0, roles=ROLES, mats=MATS)

    def bv(self, p, shade=1.0, wing=0.0, n=None):
        """A vertex at `p` in the game's frame, its normal `n` in the same."""
        nn = None if n is None else B(n)
        i = super().v(B(p), shade, 0.0, nn)
        self.tone[i] = (self.tone[i][0], 0.0, wing)
        return i


def edges(s):
    """The wing's plan at a share `s` of the half-span (`wingEdges`)."""
    half = SPEC["span"] / 2
    c0 = SPEC["span"] * SPEC["wing"]["chord"]
    chord = c0 * (1 - (1 - SPEC["wing"]["taper"]) * s)
    lead = c0 * 0.45 - SPEC["wing"]["sweep"] * half * s ** 1.5
    return lead, lead - chord


# ---------------------------------------------------------------- THE BODY
def body(t, rng):
    L = SPEC["length"]
    neck = SPEC["neck"] * L
    back = (1 - SPEC["neck"]) * L
    r = L * 0.11
    SIDES = 8
    # The torso: rings along z from the tail root to the chest, widest at
    # the shoulders, deeper below than above (a keel), rounded off both
    # ends; the back takes the mantle, the belly the belly.
    zs = [-back * 0.9, -back * 0.62, -back * 0.3, 0.0, 0.14 * L, 0.24 * L, 0.3 * L]
    rs = [0.12, 0.42, 0.85, 1.0, 0.98, 0.78, 0.35]
    rings = []
    for k, (z, rr) in enumerate(zip(zs, rs)):
        ring = []
        for j in range(SIDES):
            a = 2 * math.pi * (j + 0.5) / SIDES
            c, s = math.cos(a), math.sin(a)
            keel = 1.0 + 0.25 * max(0.0, -s)            # deeper under the shoulders
            ring.append((c * r * rr, s * r * rr * 0.95 * keel + r * 0.05, z))
        rings.append(ring)
    ix = []
    for k, ring in enumerate(rings):
        row = []
        for j, p in enumerate(ring):
            a = 2 * math.pi * (j + 0.5) / SIDES
            n = (math.cos(a), math.sin(a), 0.0)
            shade = 0.75 + 0.25 * max(0.0, math.sin(a))     # dark under the belly
            row.append(t.bv(p, shade, 0.0, n))
        ix.append(row)
    for k in range(len(rings) - 1):
        for j in range(SIDES):
            j1 = (j + 1) % SIDES
            up = math.sin(2 * math.pi * (j + 1) / SIDES)
            role = "back" if up > 0 else "belly"
            t.f((ix[k][j], ix[k][j1], ix[k + 1][j1], ix[k + 1][j]), role)
    tailc = t.bv((0, r * 0.05, zs[0] - r * 0.15), 0.8, 0.0, (0, 0, -1))
    chest = t.bv((0, r * 0.1, zs[-1] + r * 0.3), 0.95, 0.0, (0, 0.3, 1))
    for j in range(SIDES):
        j1 = (j + 1) % SIDES
        t.f((tailc, ix[0][j1], ix[0][j]), "tail")
        t.f((chest, ix[-1][j], ix[-1][j1]), "back" if math.sin(2 * math.pi * (j + 1) / SIDES) > 0 else "belly")

    # THE NECK: a tube curving up out of the chest to the head, longer on
    # the long-necked rows and held out ahead as a flying bird holds it.
    headZ = neck - L * 0.07
    headR = r * 0.55
    n_seg = 4 if neck > 0.3 * L else 3
    p0 = Vector((0, r * 0.25, 0.22 * L))
    p1 = Vector((0, r * 0.45, headZ - headR * 0.6))
    pts = [p0.lerp(p1, u) + Vector((0, math.sin(math.pi * u) * r * 0.12, 0)) for u in [k / n_seg for k in range(n_seg + 1)]]
    radii = [r * 0.42 * (1 - 0.15 * (k / n_seg)) for k in range(n_seg + 1)]
    tube_frame(t, pts, radii, 6, "back", shade=lambda u: 0.85 + 0.15 * u)

    # THE HEAD: an ellipsoid with a brow, rounder than the code's lump; the
    # bill a four-sided cone off its front, the row's neck buying it length.
    hc = Vector((0, r * 0.45, headZ))
    head_rings = []
    for k, (dz, rr, up) in enumerate(((-headR * 0.95, 0.35, 0.0), (-headR * 0.45, 0.85, 0.05), (0.0, 1.0, 0.08), (headR * 0.5, 0.82, 0.05), (headR * 0.9, 0.4, -0.05))):
        ring = []
        for j in range(6):
            a = 2 * math.pi * j / 6
            ring.append(t.bv((math.cos(a) * headR * rr, hc.y + math.sin(a) * headR * rr * 0.9 + headR * up, headZ + dz),
                             0.85 + 0.15 * max(0.0, math.sin(a)), 0.0, (math.cos(a), math.sin(a), 0)))
        head_rings.append(ring)
    for k in range(len(head_rings) - 1):
        for j in range(6):
            j1 = (j + 1) % 6
            t.f((head_rings[k][j], head_rings[k][j1], head_rings[k + 1][j1], head_rings[k + 1][j]), "head")
    nape = t.bv((0, hc.y, headZ - headR), 0.85, 0.0, (0, 0, -1))
    face = t.bv((0, hc.y - headR * 0.05, headZ + headR), 0.95, 0.0, (0, 0, 1))
    for j in range(6):
        j1 = (j + 1) % 6
        t.f((nape, head_rings[0][j1], head_rings[0][j]), "head")
        t.f((face, head_rings[-1][j], head_rings[-1][j1]), "head")
    bill_len = max(neck - headZ - headR * 0.4, headR * 0.9)
    tube_frame(t, [Vector((0, hc.y - headR * 0.1, headZ + headR * 0.8)), Vector((0, hc.y - headR * 0.35, headZ + headR * 0.8 + bill_len))],
               [headR * 0.42, headR * 0.06], 4, "bill", shade=lambda u: 0.9, cap=True)

    # THE TAIL: a fan of feathers, flat, from the tail root back to the
    # row's own tail — five of them, each its own strip, so the fan reads
    # as feathers and not as a paddle; narrow, because a wide tail reads as
    # a second pair of wings.
    root = -back * 0.62
    tw = SPEC["span"] * 0.06
    n_f = 5
    for i in range(n_f):
        u = (i + 0.5) / n_f - 0.5
        x0, x1 = u * r * 0.6, u * tw * 2.0
        w0, w1 = r * 0.6 / n_f * 0.5, tw * 2.0 / n_f * 0.55
        z1 = -back * (1 - 0.12 * abs(u) * 2)
        for side, sign in ((0.004, 1), (-0.004, -1)):
            role = "tail"
            q = [(x0 - w0, side, root), (x0 + w0, side, root), (x1 + w1, side, z1), (x1 - w1, side, z1)]
            if sign < 0:
                q.reverse()
            t.f([t.bv(p, 0.9 if sign > 0 else 0.8, 0.0, (0, sign, 0)) for p in q], role)

    # LEGS trailing behind, where the row's silhouette has them: a thigh, a
    # shank and the foot out behind.
    if LEGS:
        for side in (-1, 1):
            hip = Vector((side * r * 0.35, -r * 0.4, root))
            knee = Vector((side * r * 0.45, -r * 0.5, -back - L * 0.12))
            foot = Vector((side * r * 0.4, -r * 0.35, -back - L * 0.3))
            tube_frame(t, [hip, knee, foot], [r * 0.12, r * 0.08, r * 0.06], 3, "legs", shade=lambda u: 0.85, cap=True)


def tube_frame(t, pts, radii, sides, role, shade=lambda u: 1.0, cap=False, wing=0.0):
    """A tube in the game's frame through `pts` (Vectors), parallel-transported."""
    rings = []
    prev_u = None
    for k, p in enumerate(pts):
        d = (pts[min(k + 1, len(pts) - 1)] - pts[max(k - 1, 0)]).normalized()
        a = Vector((0, 1, 0)) if abs(d.y) < 0.9 else Vector((1, 0, 0))
        u = d.cross(a).normalized()
        if prev_u is not None:
            u = (prev_u - d * prev_u.dot(d)).normalized()
        w = d.cross(u)
        prev_u = u
        ring = []
        for j in range(sides):
            an = 2 * math.pi * j / sides
            off = u * math.cos(an) + w * math.sin(an)
            ring.append(t.bv(tuple(p + off * radii[k]), shade(k / max(1, len(pts) - 1)), wing, tuple(off)))
        rings.append(ring)
    for k in range(len(rings) - 1):
        for j in range(sides):
            j1 = (j + 1) % sides
            t.f((rings[k][j], rings[k][j1], rings[k + 1][j1], rings[k + 1][j]), role)
    if cap:
        d = (pts[-1] - pts[-2]).normalized()
        c = t.bv(tuple(pts[-1] + d * radii[-1] * 0.6), shade(1.0), wing, tuple(d))
        for j in range(sides):
            t.f((rings[-1][j], rings[-1][(j + 1) % sides], c), role)


# ---------------------------------------------------------------- THE WING
def wing(t, side):
    """One wing, `side` +1 the right: two faces the code's skin apart, the
    columns at the code's stations and the wrist, the leading edge rounded
    with a third row of vertices just behind it and the top face cambered
    over the arm, the hand's trailing edge cut into primaries where the
    plan is broad. Every vertex a WING vertex; the mantle on top, the belly
    under, the tip's dark past `tipFrom` on both faces."""
    half = SPEC["span"] / 2
    stations = sorted(set(list(WING["stations"]) + [SPEC["wing"]["wrist"]]))
    skin = WING["skin"] / 2
    fingers = SPEC["wing"]["taper"] > 0.45 and SPEC["span"] > 1.0
    # The columns: the stations, and — on a broad hand — the outer segment
    # cut into eight so its trailing edge can zigzag into four primaries
    # that stay part of the wing.
    cols = [(s, 0.0) for s in stations]
    if fingers:
        s0, s1 = stations[-2], stations[-1]
        cols = cols[:-1]
        for k in range(1, 9):
            u = k / 8
            notch = 0.0 if k % 2 == 0 or k == 8 else 0.35
            cols.append((s0 + (s1 - s0) * u, notch))
    rows_top, rows_under = [], []
    for s, notch in cols:
        lead, trail = edges(s)
        chord = lead - trail
        x = side * s * half
        # A little camber over the arm, none at the hand, and the leading
        # edge held a hair higher than the trailing.
        camber = chord * 0.06 * max(0.0, 1 - s / max(SPEC["wing"]["wrist"], 1e-6)) * (1 - s)
        pts = [(x, camber * 0.4, lead), (x, camber, lead - chord * 0.3), (x, 0.0, trail + chord * notch)]
        rows_top.append([(p[0], p[1] + skin, p[2]) for p in pts])
        rows_under.append([(p[0], p[1] - skin, p[2]) for p in pts])
    for rows, up in ((rows_top, 1), (rows_under, -1)):
        for k in range(len(cols) - 1):
            s1 = cols[k + 1][0]
            role = "tip" if s1 > WING["tipFrom"] + 1e-6 else ("back" if up > 0 else "belly")
            a, b = rows[k], rows[k + 1]
            last = s1 >= 1
            for c in range(2):
                q = [a[c], a[c + 1], b[c + 1], b[c]]
                if last:
                    q = [a[c], a[c + 1], b[0]]
                # Wound to face the way its normal points: lead→trail along
                # −z then outboard along +x winds a face DOWN, so the top
                # face is the reversed one.
                if up > 0:
                    q.reverse()
                if side < 0:
                    q.reverse()
                nrm = (0, up, 0)
                shade = 1.0 if up > 0 else 0.85
                idx = [t.bv(p, shade, 1.0, nrm) for p in q]
                t.f(tuple(dict.fromkeys(idx)), role)


t = Bird()
rng = random.Random(ID)
body(t, rng)
wing(t, 1)
wing(t, -1)
ob = t.object("bird")
tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
print("TRIANGLES", ID, "total", tris)

root = bpy.data.objects.new(ID, None)
COL.objects.link(root)
root["frame"] = "bird"
ob.parent = root

if GAME:
    lib._select_only([root, ob])
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, f"{ID}.glb"), use_selection=True, export_extras=True,
                              export_normals=True, export_vertex_color="ACTIVE", export_all_vertex_colors=False,
                              export_animations=False, export_skins=False, export_morph=False,
                              export_materials="EXPORT")

# ---------------------------------------------------------------- the STUDIO: in the air over the sea
only = [x for x in os.environ.get("VIEWS", "").split(",") if x]
if not GAME and only != ["none"]:
    ob.location.z = 1.0
    cams = lib._studio((0, 0, 1.0), SPEC["span"] * 1.2, floor=0.0)
    lib._cycles(SAMPLES)
    for name, cam in cams.items():
        if only and name not in only:
            continue
        scene.camera = cam
        scene.render.filepath = os.path.join(OUT, f"{ID}-render-{name}.png")
        bpy.ops.render.render(write_still=True)
