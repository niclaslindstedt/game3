# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# THE SEA LIFE MODELLED IN BLENDER: one SPECIES at a time, off the very
# numbers the code's builder reads (`engine/game/defs/fauna.ts` — its kind,
# its beam; `fauna-styles.ts` — its height, its dorsal, its pectorals, its
# tail, its markings; `fauna-body.ts` — the girth along the body and where
# the fins sit; handed in as one JSON file by `scripts/blender.mjs
# --kind=fauna`). The code's animal is a six-sided tube with a triangle for
# a dorsal, two quads for pectorals and two for a tail; what this makes is
# an animal: a smooth body lofted through the code's own girth with a
# lateral keel and a snout that comes to a point, a mouth line, an eye each
# side, a dorsal with a curved trailing edge, pectorals with a rounded
# planform, a fish's second dorsal and anal fin, a shark's tall upright
# lobe, a whale's flukes notched at the middle, a ray's whole body a wing.
#
# THE FRAME is the code's, exactly, because THE SHADER BEATS THE TAIL: one
# unit-length body, z from −0.5 at the tail to +0.5 at the nose, x the
# animal's right, y up — the game scales it by the catalog's length and
# bends every vertex off z. Blender is z up with the game's +z laid along
# −y, so the y-up export gives the frame back untouched.
#
# DRESSED BY THE GAME: a face is a ROLE (`hide`, `fin`, `band`) and every
# hide vertex says WHERE ON THE BODY it is — its station along the body in
# its tone's R (0 tail, 1 nose) and how far up it in G (0 keel, 1 spine) —
# so `fauna-models.ts` paints it with the very `hide` the code paints its
# own body with. No colour in the file.

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
KIND = DATA["kind"]
BEAM = DATA["beam"]
STYLE = DATA["style"]
BODY = DATA["body"]
GIRTH = DATA["girth"]
PAINT = DATA.get("paint") or {}

ROLES = ("hide", "fin", "band")
GREY = (0.5, 0.5, 0.5)
MATS = [mat(r, tuple(PAINT.get(r, GREY)) if not GAME else GREY, rough=0.5) for r in ROLES]
SIDES = 10
STATIONS = 15


def B(p):
    x, y, z = p
    return (x, -z, y)


class Animal(Plant):
    def __init__(self):
        super().__init__(0.0, roles=ROLES, mats=MATS)

    def av(self, p, s=0.0, up=0.0, n=None):
        """A vertex in the game's frame carrying its station `s` and `up`
        (−1 keel … 1 spine) for the game's own hide paint."""
        i = super().v(B(p), s, 0.0, None if n is None else B(n))
        self.tone[i] = (max(0.0, min(1.0, s)), max(0.0, min(1.0, up * 0.5 + 0.5)), 0.0)
        return i


def girth(s):
    k = GIRTH
    if s <= k[0][0]:
        return k[0][1]
    for i in range(1, len(k)):
        if s <= k[i][0]:
            x0, y0 = k[i - 1]
            x1, y1 = k[i]
            return y0 + (y1 - y0) * (s - x0) / (x1 - x0)
    return k[-1][1]


def sheet(t, rows, role, s_of, up_of, two_sided=True):
    """A fin: a strip through `rows` (points across the fin at each
    station along it), one face each way, its normal off the face."""
    faces = []
    for k in range(len(rows) - 1):
        a, b = rows[k], rows[k + 1]
        for j in range(len(a) - 1):
            q = [a[j], a[j + 1], b[j + 1], b[j]]
            faces.append(q)
    for q in faces:
        ps = [Vector(p) for p in q]
        n = (ps[1] - ps[0]).cross(ps[2] - ps[0])
        if n.length < 1e-9:
            n = (ps[2] - ps[0]).cross(ps[3] - ps[0])
        if n.length < 1e-9:
            continue
        n.normalize()
        for flip in ((1, -1) if two_sided else (1,)):
            qq = q if flip > 0 else list(reversed(q))
            idx = [t.av(p, s_of(p), up_of(p), tuple(n * flip)) for p in qq]
            face = tuple(dict.fromkeys(idx))
            if len(face) >= 3:
                t.f(face, role)


def body(t):
    halfW = BEAM / 2
    halfH = STYLE["height"] / 2
    ray = BEAM > 0.9
    rings = []
    for i in range(STATIONS):
        s = i / (STATIONS - 1)
        g = girth(s)
        ring = []
        for k in range(SIDES):
            a = 2 * math.pi * (k + 0.5) / SIDES
            c, sn = math.cos(a), math.sin(a)
            # A lateral keel: the section fuller at the sides than a circle,
            # deeper at the belly ahead of the vent; a ray a flat wing with
            # its body in the middle.
            keel = 1 + 0.12 * c * c
            if ray:
                w = halfW * g * (abs(c) ** 0.45) * (1 if c >= 0 else 1) * keel
                h = halfH * g * (0.35 + 0.65 * math.exp(-(c * c) * 6))
                x, y = math.copysign(w, c), sn * h
            else:
                belly = 1 + 0.18 * max(0.0, -sn) * (1 - abs(s - 0.65) * 2)
                x, y = c * halfW * g * keel, sn * halfH * g * belly
            ring.append(((x, y, s - 0.5), s, sn))
        rings.append(ring)
    ix = []
    for ring in rings:
        row = []
        for (p, s, up) in ring:
            row.append(t.av(p, s, up))
        ix.append(row)
    for i in range(STATIONS - 1):
        for k in range(SIDES):
            k1 = (k + 1) % SIDES
            t.f((ix[i][k], ix[i][k1], ix[i + 1][k1], ix[i + 1][k]), "hide")
    tail = t.av((0, 0, -0.5 - 0.01), 0.0, 0.0, (0, 0, -1))
    nose = t.av((0, -halfH * 0.05, 0.5 + 0.012), 1.0, 0.0, (0, 0, 1))
    for k in range(SIDES):
        k1 = (k + 1) % SIDES
        t.f((tail, ix[0][k1], ix[0][k]), "hide")
        t.f((nose, ix[-1][k], ix[-1][k1]), "hide")
    # THE EYES: a bump each side of the head, in the hide's own paint.
    if not ray:
        for side in (-1, 1):
            s = 0.88
            g = girth(s)
            ex = side * halfW * g * 0.95
            ey = halfH * g * 0.35
            r = min(halfW, halfH) * 0.11
            rings_e = []
            for kk in range(1, 3):
                phi = math.pi * kk / 3
                ring = []
                for j in range(5):
                    a = 2 * math.pi * j / 5
                    ring.append(t.av((ex + side * math.cos(phi) * r * 0.6, ey + math.cos(a) * math.sin(phi) * r,
                                      s - 0.5 + math.sin(a) * math.sin(phi) * r), s, 0.4, (side, 0, 0)))
                rings_e.append(ring)
            apex = t.av((ex + side * r * 0.7, ey, s - 0.5), s, 0.4, (side, 0, 0))
            for kk in range(len(rings_e) - 1):
                for j in range(5):
                    j1 = (j + 1) % 5
                    q = (rings_e[kk][j], rings_e[kk][j1], rings_e[kk + 1][j1], rings_e[kk + 1][j])
                    t.f(q if side > 0 else tuple(reversed(q)), "hide")
            for j in range(5):
                j1 = (j + 1) % 5
                q = (apex, rings_e[-1][j1], rings_e[-1][j])
                t.f(q if side > 0 else tuple(reversed(q)), "hide")
    return halfW, halfH, ray


def fins(t, halfW, halfH, ray):
    D, P, T = BODY["dorsal"], BODY["pectoral"], BODY["tail"]
    up_fin = lambda p: 1.0
    # THE DORSAL: the code's raked triangle, as a curved sail — the leading
    # edge swept back, the trailing edge hollowed — standing on the back
    # where the code stands it; a shark's tall and upright, a whale's a low
    # hook, a fish's soft and long.
    if STYLE["dorsal"] > 0.005 and not ray:
        dTop = girth(D["station"]) * halfH
        h = STYLE["dorsal"]
        rows = []
        n = 4
        for k in range(n + 1):
            u = k / n
            y = dTop * (1 - u) + (dTop + h) * u - (h * 0.02)
            lead = D["at"] + D["chord"] * (1 - u * 0.75) - D["rake"] * u
            trail = D["at"] - D["chord"] * (1 - 0.45 * math.sin(math.pi * u)) - D["rake"] * u * 1.3
            if u >= 1:
                rows.append([(0, y, lead), (0, y, lead)])
            else:
                rows.append([(0, y, lead), (0, y, trail)])
        sheet(t, rows, "fin", lambda p: p[2] + 0.5, up_fin)
        if KIND == "fish":
            # A soft second dorsal and an anal fin, low and long.
            for sign, at in ((1, -0.18), (-1, -0.2)):
                base = girth(at + 0.5) * halfH * sign
                rows = [[(0, base, at + 0.06), (0, base, at - 0.06)],
                        [(0, base + sign * h * 0.35, at + 0.02), (0, base + sign * h * 0.35, at - 0.09)]]
                sheet(t, rows, "fin", lambda p: p[2] + 0.5, up_fin)
        if KIND == "shark":
            # The shark's second dorsal, small, and its anal fin.
            for sign, at in ((1, -0.25), (-1, -0.22)):
                base = girth(at + 0.5) * halfH * sign
                rows = [[(0, base, at + 0.04), (0, base, at - 0.03)],
                        [(0, base + sign * h * 0.3, at - 0.01), (0, base + sign * h * 0.3, at - 0.06)]]
                sheet(t, rows, "fin", lambda p: p[2] + 0.5, up_fin)
    # THE PECTORALS: the code's swept flipper as a rounded blade in three
    # stations, curving back and a little down, the outer half banded
    # where the style says.
    if STYLE["pectoral"] > 0.005 and not ray:
        pz = P["at"]
        pw = girth(P["station"]) * halfW
        chord = P["chord"]
        reach = STYLE["pectoral"]
        for side in (1, -1):
            rows = []
            for k, (f, drop, sweep, w) in enumerate(((0.0, 0.2, 0.0, 1.0), (P["bandFrom"], 0.3, 0.35, 1.25), (0.78, 0.4, 0.5, 0.8), (1.0, 0.45, 0.55, 0.15))):
                x = side * (pw + reach * f)
                y = -halfH * drop
                z = pz + chord * (1 - f) - reach * sweep * f
                rows.append([(x, y, z + chord * w * 0.55), (x, y, z - chord * w * 0.75)])
            inner = rows[:2]
            outer = rows[1:]
            sheet(t, inner, "fin", lambda p: p[2] + 0.5, lambda p: -0.3)
            sheet(t, outer, "band", lambda p: p[2] + 0.5, lambda p: -0.3)
    # THE TAIL: a fish and a shark carry it upright, a cetacean flat; a
    # crescent notched at the middle, its lobes tapering to points, thicker
    # at the root — a shark's upper lobe the taller.
    span = STYLE["tail"] / 2
    flat = KIND == "cetacean"
    def fin(u, v):
        return (u, 0.0, v) if flat else (0.0, u, v)
    for sign in (1, -1):
        lobe = span * (1.0 if flat or KIND != "shark" else (1.25 if sign > 0 else 0.8))
        rows = [[fin(0, T["root"] + 0.03), fin(0, T["root"] - 0.03)],
                [fin(sign * lobe * 0.45, T["root"] - 0.05), fin(sign * lobe * 0.45, T["notch"] - 0.06)],
                [fin(sign * lobe, T["tip"] + 0.02), fin(sign * lobe, T["tip"] - 0.01)]]
        sheet(t, rows, "fin", lambda p: 0.0, lambda p: 0.0)
    if ray:
        # A ray's tail: a whip out behind the disc.
        rows = [[(-BEAM * 0.02, 0, -0.45), (BEAM * 0.02, 0, -0.45)], [(0, 0, -0.5), (0, 0, -0.5)]]
        sheet(t, rows, "fin", lambda p: 0.0, lambda p: 0.0)


t = Animal()
halfW, halfH, ray = body(t)
fins(t, halfW, halfH, ray)
ob = t.object("body")
tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
print("TRIANGLES", ID, "total", tris)

root = bpy.data.objects.new(ID, None)
COL.objects.link(root)
root["frame"] = "fauna"
ob.parent = root

if GAME:
    lib._select_only([root, ob])
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, f"{ID}.glb"), use_selection=True, export_extras=True,
                              export_normals=True, export_vertex_color="ACTIVE", export_all_vertex_colors=False,
                              export_animations=False, export_skins=False, export_morph=False,
                              export_materials="EXPORT")

# ---------------------------------------------------------------- the STUDIO: at the surface
only = [x for x in os.environ.get("VIEWS", "").split(",") if x]
if not GAME and only != ["none"]:
    L = DATA["length"]
    ob.scale = (L, L, L)
    ob.location.z = STYLE["height"] * L * 0.4
    cams = lib._studio((0, 0, STYLE["height"] * L * 0.4), max(L, 1.0) * 1.1, floor=-L * 0.6)
    lib._cycles(SAMPLES)
    for name, cam in cams.items():
        if only and name not in only:
            continue
        scene.camera = cam
        scene.render.filepath = os.path.join(OUT, f"{ID}-render-{name}.png")
        bpy.ops.render.render(write_still=True)
