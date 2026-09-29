# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# THE RIDER MODELLED IN BLENDER off the game's own data: his body (`BODY`,
# `RIDER_SCALE`), the pose he is bound in and every bone's frame in it
# (`rider-rig.ts`'s `RIDING` and `riderBones`), the kit's paint
# (`rider.ts`'s `PAINT`), the pieces the game draws him of in that pose
# (`figureParts` — where the vest's straps run, the helmet's measured
# rings and its livery), and every clip sampled off the game's own
# `poseRider` — handed in as one JSON file by `scripts/blender.mjs
# --kind=rider`, the driver and the only way this runs.
#
# The frame: the craft's body frame (x right, y up, z forward, the origin
# at the centre of gravity) laid as Blender's (-x, z, y) — a turn, not a
# mirror — so he faces +y as a modelled craft does, and the loader's one
# half turn about y sets both in the game's frame. His sides are the
# ENGINE's (`_l` is the body frame's x negative, the pose's index 0).
#
# He is one SKIN that bends — a man of the survey's measure (ANSUR II,
# below) in a jet-ski racer's kit, lofted a piece a bone and remeshed into
# one surface, weighted across each joint between the bones that meet
# there — and what does not bend rides one bone wholly: the helmet (the
# head), the boots (the boot; the cuff the shin), the knee pads (the shin),
# the gloves (the hand), the vest's straps (the spine).
#
# Every material is named for the kit's paint it is dressed in
# (`PAINT`'s keys: `skin`, `suit`, `suitLight`, `vest`, `vestBack`,
# `orange`, `glove`, `boot`, `shellLow`, `helmet`, `visor`) — the game
# dresses them by name (`dressOf`, `craft-models.ts`).

import json, math, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib
from lib import *

argv = sys.argv[sys.argv.index("--") + 1:]
DATA = json.load(open(argv[0]))
OUT = argv[1]
SAMPLES = int(argv[2]) if len(argv) > 2 else 64
PAINT, POSE, FRAMES = DATA["paint"], DATA["rest"]["pose"], DATA["rest"]["bones"]
K, BODY = DATA["scale"], DATA["body"]


def B(p):
    """A point or direction of the body frame, in Blender's."""
    return Vector((-p[0], p[2], p[1]))


def colour(hexa):
    """A paint's sRGB colour as linear (the stills only: the game dresses
    every material by its name)."""
    return tuple(((c / 255 + 0.055) / 1.055) ** 2.4 for c in ((hexa >> 16) & 255, (hexa >> 8) & 255, hexa & 255))


# ---------------------------------------------------------------- materials
# No sheen on anything: Blender's goes into the glTF as an extension three
# draws as a pale bloom.
FINISH = {"skin": (0.45, 0.0), "suit": (0.42, 0.1), "suitLight": (0.42, 0.1), "vest": (0.75, 0.0),
          "vestBack": (0.75, 0.0), "orange": (0.5, 0.1), "glove": (0.7, 0.0), "boot": (0.6, 0.1),
          "shellLow": (0.2, 1.0), "helmet": (0.2, 1.0), "visor": (0.08, 1.0)}
M = {k: mat(k, colour(PAINT[k]), rough=FINISH[k][0], coat=FINISH[k][1]) for k in FINISH}


# ---------------------------------------------------------------- the RIG
def frame(name):
    f = FRAMES[name]
    return B(f["head"]), B(f["x"]), B(f["y"]), B(f["z"]), f["length"]


for name in FRAMES:
    head, _, y, z, length = frame(name)
    bone(name, head, head + y * length, roll_to=z)

SEGMENTS = {n: (frame(n)[0], frame(n)[0] + frame(n)[2] * frame(n)[4]) for n in FRAMES}
NEAR = {"spine": ["pelvis", "head", "upperarm_l", "upperarm_r"], "head": ["spine"],
        "pelvis": ["spine", "thigh_l", "thigh_r"]}
for s in "lr":
    NEAR |= {f"thigh_{s}": ["pelvis", f"shin_{s}"], f"shin_{s}": [f"thigh_{s}"],
             f"upperarm_{s}": ["spine", f"forearm_{s}"], f"forearm_{s}": [f"upperarm_{s}"]}


def along(co, seg):
    """How far along a segment the point is (0..1), and how far off it, m."""
    a, b = seg
    d = b - a
    t = max(0.0, min(1.0, (co - a).dot(d) / d.length_squared))
    return t, (co - (a + d * t)).length


def nearest(co, among=None):
    return min(among or SEGMENTS, key=lambda n: along(co, SEGMENTS[n])[1])


SKINNED = [n for n in SEGMENTS if not n.startswith(("boot", "hand"))]


def skin_weights(co):
    """Across a joint, shared between the bones that meet there by how much
    nearer each is — 4 cm makes the difference between half and a third."""
    b0 = nearest(co, SKINNED)
    d0 = along(co, SEGMENTS[b0])[1]
    w = {n: math.exp(-(along(co, SEGMENTS[n])[1] - d0) / 0.04) for n in [b0] + NEAR[b0]}
    top = sorted(w.items(), key=lambda kv: -kv[1])[:3]
    total = sum(v for _, v in top)
    return {n: v / total for n, v in top}


# ---------------------------------------------------------------- the BODY
# THE MAN UNDER THE KIT is the ANSUR II survey's (US Army, 2012: 4,082 men,
# the means below, mm) — every breadth, depth and circumference, and where
# on the trunk each level falls (its height between the hip joint,
# `trochanterion`, and the base of the neck, `cervicale`, laid onto the
# game's spine) — carried by the game's own `RIDER_SCALE`, as every girth
# of its drawn figure is.
ANSUR = {
    "trochanterion": 901, "crotch": 846, "waist_h": 1056, "tenth_rib_h": 1121, "chest_h": 1291,
    "axilla_h": 1329, "acromion_h": 1441, "cervicale": 1517,
    "hip_breadth": 346, "buttock_depth": 246, "waist_breadth": 326, "waist_depth": 238,
    "chest_breadth": 289, "chest_depth": 254, "biacromial": 416, "bideltoid": 510,
    "neck_base": 435, "thigh": 625, "lower_thigh": 409, "calf": 392, "ankle": 229,
    "biceps": 358, "forearm": 310, "wrist": 176, "forearm_length": 268,
}
MM = 0.001 * K


def level(h):
    """A survey height as a share of the game's spine, hips 0 to neck 1."""
    return (h - ANSUR["trochanterion"]) / (ANSUR["cervicale"] - ANSUR["trochanterion"])


def r_of(circ):
    return circ * MM / (2 * math.pi)


# THE KIT OVER HIM, after what a closed-course runabout racer wears: a
# full-length wetsuit (a few millimetres of neoprene), a buoyancy vest over
# it — the foam its standard asks for, squaring the trunk from the waist to
# the shoulders — bare arms out of the vest's caps, knee pads, water boots,
# gloves and a full-face helmet with a peak. What the kit ADDS over the
# body, m a side:
EASE = {"suit": 0.004, "vest_front": 0.034, "vest_back": 0.03, "vest_side": 0.024, "cap": 0.018}

P = POSE
UPv, RIGHT, FWD = B(P["torsoUp"]), B(P["torsoRight"]), B(P["torsoFwd"])
PELVIS, PELVIS_UP, NECK = B(P["pelvis"]), B(P["pelvisUp"]), B(P["neck"])
SPINE_LEN = BODY["torso"] + BODY["neck"]
knees, ankles = [B(k) for k in P["knees"]], [B(a) for a in P["ankles"]]
shoulders, elbows, wrists = ([B(k) for k in P[j]] for j in ("shoulders", "elbows", "wrists"))
SEG = 16 if GAME else 28


def lofted(name, a, axis, side, front, sections, n=2.4):
    """A piece along `axis` from `a`: rings at `t` m, each `(t, half
    across, ahead, behind)` — across is along `side`, ahead along `front`
    (both squared off the axis). Capped, always: the remesh fills VOLUMES,
    and drops an open tube."""
    axis = axis.normalized()
    side = (side - axis * side.dot(axis)).normalized()
    front = axis.cross(side) if axis.cross(side).dot(front) > 0 else side.cross(axis)
    rings = []
    for t, hx, ahead, behind in sections:
        c = a + axis * t
        ring = []
        for k in range(SEG):
            ang = 2 * math.pi * k / SEG
            ca, sa = math.cos(ang), math.sin(ang)
            u = math.copysign(abs(ca) ** (2 / n), ca) * hx
            v = math.copysign(abs(sa) ** (2 / n), sa) * (ahead if sa > 0 else behind)
            ring.append(c + side * u + front * v)
        rings.append(ring)
    return loft(name, rings, [M["suit"]])


rides("spine")
pieces = []
E = EASE
w = E["suit"]
bh = ANSUR["hip_breadth"] / 2 * MM
bd = ANSUR["buttock_depth"] * MM
wb, wd = ANSUR["waist_breadth"] / 2 * MM, ANSUR["waist_depth"] * MM
cb, cd = ANSUR["chest_breadth"] / 2 * MM, ANSUR["chest_depth"] * MM
vf, vb, vs = E["vest_front"], E["vest_back"], E["vest_side"]
L = SPINE_LEN
# The seat: the hips and buttocks as a mass sat on the cushion, along the
# pelvis's own up (the pelvis does not pitch with the torso), the bulk of
# it behind the spine's line.
pieces.append(lofted("seat", PELVIS, PELVIS_UP, RIGHT, FWD, [
    (-BODY["pelvis"] * 0.98, bh * 0.62, bd * 0.18, bd * 0.3),
    (-BODY["pelvis"] * 0.8, bh * 0.9 + w, bd * 0.3 + w, bd * 0.5 + w),
    (-BODY["pelvis"] * 0.35, bh + w, bd * 0.4 + w, bd * 0.58 + w),
    (0.03, bh + w, bd * 0.4 + w, bd * 0.55 + w),
    (0.1, bh * 0.95 + w, bd * 0.4 + w, bd * 0.5 + w)], n=2.6))
# The trunk: the survey's levels, each the body's half breadth and depth
# ahead of and behind the spine's line, with what the kit adds there — the
# suit over the hips, the vest from the waist up.
TRUNK = [
    (0.08, bh + w, bd * 0.42 + w, bd * 0.5 + w),
    (level(ANSUR["waist_h"]), wb + vs, wd * 0.55 + vf, wd * 0.45 + vb),
    (level(ANSUR["tenth_rib_h"]), wb * 0.97 + vs, wd * 0.55 + vf, wd * 0.46 + vb),
    (0.52, cb * 1.02 + vs, cd * 0.51 + vf, cd * 0.48 + vb),
    (level(ANSUR["chest_h"]), cb * 1.08 + vs, cd * 0.5 + vf, cd * 0.5 + vb),
    (level(ANSUR["axilla_h"]), cb * 1.12 + vs, cd * 0.47 + vf, cd * 0.5 + vb),
    (level(ANSUR["acromion_h"]) - 0.04, ANSUR["biacromial"] / 2 * MM * 0.88, cd * 0.4 + vf * 0.8,
     cd * 0.44 + vb * 0.8),
    (0.92, r_of(ANSUR["neck_base"]) * 1.5, r_of(ANSUR["neck_base"]) * 1.3, r_of(ANSUR["neck_base"]) * 1.35),
    (0.95, r_of(ANSUR["neck_base"]) * 1.35, r_of(ANSUR["neck_base"]) * 1.2, r_of(ANSUR["neck_base"]) * 1.25),
]
pieces.append(lofted("trunk", PELVIS, UPv, RIGHT, FWD, [(t * L, a, f, b) for t, a, f, b in TRUNK], n=2.7))
for i, s in enumerate("lr"):
    side = RIGHT * (1 if i else -1)
    # The shoulder: the deltoid (the survey's bideltoid breadth) under the
    # vest's cap.
    reach = ANSUR["bideltoid"] / 2 * MM - ANSUR["biacromial"] / 2 * MM
    arm = (elbows[i] - shoulders[i]).normalized()
    pieces.append(ellipsoid("shoulder", shoulders[i] + UPv * 0.012 + arm * 0.012,
                            (reach + E["cap"] + 0.01,) * 3, M["suit"]))
    # The arm, bare: the survey's biceps, forearm and wrist.
    b = r_of(ANSUR["biceps"])
    ua = BODY["upperArm"]
    pieces.append(lofted("arm", shoulders[i], arm, side, UPv, [
        (-0.03, b * 1.15, b * 1.1, b * 1.1), (0.4 * ua, b, b * 1.02, b * 1.02),
        (0.75 * ua, b * 0.88, b * 0.86, b * 0.9), (1.02 * ua, b * 0.76, b * 0.74, b * 0.74)], n=2.2))
    f, wr = r_of(ANSUR["forearm"]), r_of(ANSUR["wrist"])
    fore = wrists[i] - elbows[i]
    fl = fore.length
    pieces.append(lofted("arm", elbows[i], fore, side, UPv, [
        (-0.02, b * 0.8, b * 0.78, b * 0.8), (0.25 * fl, f * 1.02, f, f),
        (0.62 * fl, (f + wr) / 2, (f + wr) / 2 * 0.9, (f + wr) / 2 * 0.9),
        (1.0 * fl + 0.01, wr, wr * 0.85, wr * 0.85)], n=2.2))
    pieces.append(ellipsoid("elbow", elbows[i], (b * 0.78,) * 3, M["suit"]))
    # The leg: the survey's thigh and lower thigh, calf and ankle, the
    # suit close over them.
    th, lt = r_of(ANSUR["thigh"]), r_of(ANSUR["lower_thigh"])
    hip = B(P["hips"][i])
    thigh = knees[i] - hip
    tl = thigh.length
    pieces.append(lofted("leg", hip, thigh, side, UPv, [
        (-0.05, th * 1.02 + w, th + w, th + w), (0.2 * tl, th + w, th + w, th + w),
        (0.62 * tl, (th + lt) / 2 + w, (th + lt) / 2 + w, (th + lt) / 2 + w),
        (0.98 * tl, lt + w, lt + w, lt + w)], n=2.1))
    ca, an = r_of(ANSUR["calf"]), r_of(ANSUR["ankle"])
    shin = ankles[i] - knees[i]
    sl = shin.length
    back = -(thigh.normalized() - shin.normalized() * thigh.normalized().dot(shin.normalized()))
    pieces.append(lofted("leg", knees[i], shin, side, -back, [
        (-0.02, lt + w, lt + w, lt + w), (0.3 * sl, ca * 0.88 + w, ca * 0.8 + w, ca * 1.12 + w),
        (0.65 * sl, (ca + an) / 2 + w, (ca + an) / 2 + w, (ca + an) / 2 * 1.05 + w),
        (1.0 * sl, an + w, an + w, an + w)], n=2.1))
    pieces.append(ellipsoid("knee", knees[i], (lt + w + 0.004,) * 3, M["suit"]))

# One surface: the pieces joined and REMESHED into a single skin, so a
# shoulder flows into its arm and a seat into its thighs, then eased.
bpy.context.view_layer.objects.active = pieces[0]
for o in bpy.context.view_layer.objects:
    o.select_set(o in pieces)
bpy.ops.object.convert(target="MESH")
bpy.ops.object.join()
body = bpy.context.view_layer.objects.active
body.name = body.data.name = "body"
remesh = body.modifiers.new("one", "REMESH")
remesh.mode, remesh.voxel_size = "VOXEL", 0.015 if GAME else 0.006
ease = body.modifiers.new("ease", "SMOOTH")
ease.factor, ease.iterations = 0.6, 2 if GAME else 4
bpy.ops.object.convert(target="MESH")
if GAME:
    thin = body.modifiers.new("budget", "DECIMATE")
    thin.ratio = 3600 / max(1, len(body.data.polygons) * 2)
    bpy.ops.object.convert(target="MESH")

# Where one colour meets the next is a PLANE, and the skin is cut along
# each before it is coloured, so every colour stops on a clean line rather
# than on the stair of the faces it was laid in: the vest's hem and its
# orange band square to the spine, the collar, the arm's cap square to
# each upper arm, the lap square to each thigh, and — through the spine's
# own line — where the vest's back panel starts either side.
HEM = (PELVIS + UPv * (0.24 * L), UPv)
BAND = (PELVIS + UPv * (0.24 * L + 0.06 * K), UPv)
CAPS = [(shoulders[i] + (elbows[i] - shoulders[i]) * 0.24, (elbows[i] - shoulders[i]).normalized()) for i in (0, 1)]
LAPS = [(B(P["hips"][i]).lerp(knees[i], 0.25), (knees[i] - B(P["hips"][i])).normalized()) for i in (0, 1)]
BACK = -FWD
# The back panel's edges: half-planes through the spine at 30° past each
# side toward the back (the code's third of the circle).
PANEL = [(PELVIS, (BACK * math.cos(math.pi / 6) - RIGHT * sx * math.sin(math.pi / 6)).normalized())
         for sx in (-1, 1)]
bm = bmesh.new()
bm.from_mesh(body.data)
for co, no in [HEM, BAND] + CAPS + LAPS + PANEL:
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=co, plane_no=no)
bm.to_mesh(body.data)
bm.free()


def above(co, plane):
    return (co - plane[0]).dot(plane[1]) > 0


def outward(co, bone_name, sx):
    """How far round from dead outboard a point on a leg is, as a cosine."""
    a, b = SEGMENTS[bone_name]
    d = (b - a).normalized()
    r = co - a
    r = r - d * r.dot(d)
    out = RIGHT * sx
    out = out - d * out.dot(d)
    return r.normalized().dot(out.normalized()) if r.length > 1e-6 and out.length > 1e-6 else 0.0


KIT = ["skin", "suit", "suitLight", "vest", "vestBack", "orange"]


def kit_of(co):
    """What the skin is where, the code's figure's paint: the suit below
    the vest's hem, its lighter print down the outside of each leg and the
    orange stripe down each shin; the vest from the hem to the collar —
    its back panel lighter, its hem banded orange — over the shoulders to
    each arm's cap; bare skin on the arms and the neck."""
    b = nearest(co)
    if b.startswith(("thigh", "shin")) or (b == "pelvis" and not above(co, HEM)):
        i = 0 if b.endswith("_l") else 1
        # The print starts past the lap line, square across the thigh,
        # rather than wherever the pelvis's region gives way to the thigh's.
        lap = b.startswith("shin") or (b.startswith("thigh") and above(co, LAPS[i]))
        c = outward(co, b, -1 if i == 0 else 1) if lap else 0.0
        if b.startswith("shin") and c > 0.9:
            return "orange"
        return "suitLight" if c > 0.35 else "suit"
    if b.startswith("forearm"):
        return "skin"
    if b.startswith("upperarm"):
        i = 0 if b.endswith("_l") else 1
        # Past the cap's line and ON the arm — a point on the chest or the
        # flank can lie beyond an arm's plane, nearer the arm than the spine.
        t, off = along(co, SEGMENTS[b])
        if above(co, CAPS[i]) and t > 0.15 and off < r_of(ANSUR["biceps"]) * 1.4:
            return "skin"
    if not above(co, HEM):
        return "suit"
    if not above(co, BAND):
        return "orange"
    return "vestBack" if all(above(co, pl) for pl in PANEL) else "vest"


body.data.materials.clear()
for k in KIT:
    body.data.materials.append(M[k])
body.data.polygons.foreach_set("material_index", [KIT.index(kit_of(p.center)) for p in body.data.polygons])
for p in body.data.polygons:
    p.use_smooth = True
weights(body, skin_weights)

# THE NECK, bare out of the vest's collar and up into the helmet: a piece
# of its own rather than of the skin, so the collar is an edge where two
# surfaces meet and not a stair of faces coloured either side of a line.
nr = r_of(ANSUR["neck_base"])
neck = lofted("neck", PELVIS, UPv, RIGHT, FWD, [(t * L, nr * a, nr * f, nr * b) for t, a, f, b in (
    (0.86, 1.0, 0.95, 1.05), (0.97, 0.95, 0.9, 1.0), (1.06, 0.92, 0.88, 0.98), (1.14, 0.9, 0.85, 0.95))], n=2.2)
neck.data.materials.clear()
neck.data.materials.append(M["skin"])
for p in neck.data.polygons:
    p.use_smooth = True
weights(neck, skin_weights)

# THE VEST'S STRAPS, where the game runs them — over each shoulder and
# down the back to the hem (`figureParts`' two straps) — laid ON the vest:
# every point of a ribbon put on the skin's nearest point, stood off it
# along the skin's own normal, and given its thickness outward.
straps = [q for q in DATA["parts"] if q["kind"] == "segment" and q["n"] == 6]


def onto(p, off):
    ok, at, no, _ = body.closest_point_on_mesh(p)
    return at + no * off


for q in straps:
    a, b = B(q["a"]), B(q["to"])
    top = a + UPv * 0.05 * K
    path = catmull([top + FWD * 0.06 * K, top + UPv * 0.01, a] + [a.lerp(b, u) for u in (0.35, 0.7, 1.0)], n=4)
    rows = []
    for i, p in enumerate(path):
        d = (path[min(i + 1, len(path) - 1)] - path[max(i - 1, 0)]).normalized()
        ok, at, no, _ = body.closest_point_on_mesh(p)
        across = d.cross(no).normalized() * (0.021 * K)
        rows.append([onto(p + across * u, 0.004) for u in (-1, -0.5, 0, 0.5, 1)])
    rib = loft("strap", rows, [M["orange"]], closed=False, cap=False)
    thick = rib.modifiers.new("thick", "SOLIDIFY")
    thick.thickness, thick.offset = 0.006, 0.0
    for p in rib.data.polygons:
        p.use_smooth = True

# ---------------------------------------------------------------- the HELMET
# The game's shell (`figureParts`' helmet: its rings, the head's frame, its
# livery a band between two rings and three arcs round — the back, the
# sides, the dark front), lofted smooth through those rings; the chin bar
# jutting under the port and the peak over it, where the game juts them.
rides("head")
H = next(q for q in DATA["parts"] if q["kind"] == "helmet")
hb, hc, hu, hv = B(H["base"]), B(H["crown"]), B(H["u"]), B(H["v"])
head_up = (hc - hb).normalized()
head_fwd = -hv
AROUND = 20 if GAME else 48
STEPS = 2 if GAME else 5
rings_t = [r["t"] for r in H["rings"]]


def shell_ring(r0, r1, u):
    """A ring between two of the game's, eased."""
    e = u * u * (3 - 2 * u)
    t = r0["t"] + (r1["t"] - r0["t"]) * u
    wv = (r0["w"] + (r1["w"] - r0["w"]) * e) * K
    dv = (r0["d"] + (r1["d"] - r0["d"]) * e) * K
    o = hb.lerp(hc, t)
    return t, [o + hu * (math.cos(a) * wv) + hv * (math.sin(a) * dv)
               for a in (2 * math.pi * (j + 0.5) / AROUND for j in range(AROUND))]


shell_rings, shell_ts = [], []
R = H["rings"]
for i in range(len(R) - 1):
    for s_ in range(STEPS if i < len(R) - 2 else STEPS + 1):
        t, ring = shell_ring(R[i], R[i + 1], s_ / STEPS)
        shell_rings.append(ring)
        shell_ts.append(t)
LIVERY = [["shellLow", "visor", "shellLow"]] * 2 + [["orange", "visor", "orange"], ["orange", "helmet", "orange"]] + \
         [["helmet"] * 3] * 2
SHELL_MATS = ["shellLow", "orange", "helmet", "visor"]
verts = [p for r in shell_rings for p in r]
faces, fm = [], []
for i in range(len(shell_rings) - 1):
    tm = (shell_ts[i] + shell_ts[i + 1]) / 2
    band = max(k for k in range(len(R) - 1) if rings_t[k] <= tm + 1e-9)
    for j in range(AROUND):
        j1 = (j + 1) % AROUND
        aft = math.sin(2 * math.pi * (j + 1) / AROUND)
        back, front, side = LIVERY[band]
        paint = back if aft > 0.5 else front if aft < -0.5 else side
        faces.append([i * AROUND + j, i * AROUND + j1, (i + 1) * AROUND + j1, (i + 1) * AROUND + j])
        fm.append(SHELL_MATS.index(paint))
crown = len(verts)
verts.append(hc + head_up * 0.004)
for j in range(AROUND):
    faces.append([(len(shell_rings) - 1) * AROUND + j, (len(shell_rings) - 1) * AROUND + (j + 1) % AROUND, crown])
    fm.append(SHELL_MATS.index("helmet"))
shell = mesh_obj("helmet", verts, faces, [M[k] for k in SHELL_MATS], fm)
if not GAME:
    shell.modifiers.new("thick", "SOLIDIFY").thickness = -0.008
# The inside of the port and the neck's opening, dark.
lining = [hb.lerp(hc, 0.02) + hu * (math.cos(a) * R[0]["w"] * K * 0.96) + hv * (math.sin(a) * R[0]["d"] * K * 0.96)
          for a in (2 * math.pi * j / AROUND for j in range(AROUND))]
mesh_obj("lining", lining + [hb.lerp(hc, 0.3)], [[j, (j + 1) % AROUND, AROUND] for j in range(AROUND)], [M["visor"]])


def jut(name, a, b, rings, paint_of, n=2.6):
    """A piece jutting off the shell along `a` → `b` (the game's own), its
    rings the game's (`w` across the head, `d` up it)."""
    axis = (b - a)
    side = hu
    up = axis.normalized().cross(side).normalized()
    if up.dot(head_up) < 0:
        up = -up
    out = []
    for r in rings:
        c = a + axis * r["t"]
        ring = []
        for k in range(SEG):
            ang = 2 * math.pi * k / SEG
            ca, sa = math.cos(ang), math.sin(ang)
            ring.append(c + side * (math.copysign(abs(ca) ** (2 / n), ca) * r["w"] * K)
                        + up * (math.copysign(abs(sa) ** (2 / n), sa) * r["d"] * K))
        out.append(ring)
    mats = sorted(set(paint_of(math.sin(2 * math.pi * (k + 0.5) / SEG)) for k in range(SEG)))
    return loft(name, out, [M[m] for m in mats],
                face_mat=lambda c: mats.index(paint_of((c - a).dot(up))))


segs = [q for q in DATA["parts"] if q["kind"] == "segment" and q["bone"] == "head"]
chin, peak = segs[0], segs[1]
jut("chin_bar", B(chin["a"]), B(chin["to"]), chin["rings"], lambda up: "visor")
pk = jut("peak", B(peak["a"]), B(peak["to"]), peak["rings"], lambda up: "helmet" if up >= 0 else "shellLow", n=8)

# ---------------------------------------------------------------- BOOTS, PADS and GLOVES
# The boots: a water boot's sole the game's foot long and its upper, the
# cuff over the ankle on the shin. The knee pads: a moulded cup over each
# kneecap, proud of the suit, in the kit's orange. The gloves: a fist round
# the grip, the cuff over the wrist.
lt = r_of(ANSUR["lower_thigh"])
for i, s in enumerate("lr"):
    f0, bx, by, bz, _ = frame(f"boot_{s}")
    floor = P["floors"][i]
    rides(f"boot_{s}")
    ank = B(P["ankles"][i])
    sole_z = floor
    fl = BODY["foot"]
    toe = ank + Vector((0, fl - 0.08 * K, 0))
    heel = ank + Vector((0, -0.08 * K, 0))
    box("sole", Vector((ank.x, (heel.y + toe.y) / 2, sole_z + 0.014 * K)),
        (0.105 * K, fl, 0.028 * K), M["boot"], bevel=0.008)
    FOOT = [(-0.075, 0.048, 0.085), (-0.03, 0.052, 0.09), (0.05, 0.054, 0.07), (0.12, 0.05, 0.05),
            (0.17, 0.042, 0.032), (0.19, 0.03, 0.02)]
    loft("boot", [[Vector((ank.x, ank.y + y * K, sole_z + 0.026 * K)) + Vector((hw * K * math.cos(a), 0,
                   hh * K * (1 + math.sin(a)) / 2)) for a in (2 * math.pi * k / 16 for k in range(16))]
                  for y, hw, hh in FOOT], [M["boot"]])
    rides(f"shin_{s}")
    sh0, sx_, sy_, sz_, sl_ = frame(f"shin_{s}")
    an = r_of(ANSUR["ankle"])
    cuff = [(sl_ - 0.12 * K, an + 0.012), (sl_ - 0.02 * K, an + 0.016), (sl_ + 0.03 * K, an + 0.02)]
    loft("boot_cuff", [[sh0 + sy_ * t + sx_ * (r * math.cos(a)) + sz_ * (r * math.sin(a))
                        for a in (2 * math.pi * k / 16 for k in range(16))] for t, r in cuff], [M["boot"]])
    # The pad, round the front of the knee (the bone's +z is the knee's
    # front: the bones are rolled to the bend).
    k0 = sh0
    guard = []
    pr = lt + 0.012
    for t in (-0.07, -0.03, 0.02, 0.07, 0.11):
        swell = 1.0 + 0.22 * math.exp(-((t + 0.01) / 0.05) ** 2)
        guard.append([k0 + sy_ * (t * K) + sx_ * (pr * 0.95 * swell * math.cos(a)) + sz_ * (pr * swell * math.sin(a))
                      for a in (math.pi * (0.12 + 0.76 * j / 10) for j in range(11))])
    cup = loft("knee_pad", guard, [M["orange"]], closed=False, cap=False)
    cup.modifiers.new("shell", "SOLIDIFY").thickness = 0.012
    rides(f"hand_{s}")
    h0, hx_, hy_, hz_, _ = frame(f"hand_{s}")
    turn = Matrix((hx_, hy_, hz_)).transposed().to_euler()
    ellipsoid("fist", h0, (0.05 * K, 0.052 * K, 0.042 * K), M["glove"], rot=turn)
    ellipsoid("knuckles", h0 + hz_ * 0.0 - hx_ * 0.0 + (B(P["wrists"][i]) - h0).normalized() * -0.01,
              (0.046 * K, 0.035 * K, 0.034 * K), M["glove"], rot=turn)
    rides(f"forearm_{s}")
    e0, ex_, ey_, ez_, el_ = frame(f"forearm_{s}")
    cr = r_of(ANSUR["wrist"]) + 0.012
    cyl("glove_cuff", e0 + ey_ * (el_ - 0.03 * K), e0 + ey_ * (el_ + 0.03 * K), cr, M["glove"], r2=cr + 0.004)


# ---------------------------------------------------------------- the CLIPS
# Every clip is the game's pose sampled: each frame every bone's frame,
# set as its matrix and keyed.
def keyed(frames):
    def at(t):
        f = frames[min(len(frames) - 1, round(t * lib.FPS))]
        out = {}
        for name, fr in f.items():
            head, x, y, z = B(fr["head"]), B(fr["x"]), B(fr["y"]), B(fr["z"])
            m = Matrix((x, y, z)).transposed().to_4x4()
            m.translation = head
            out[name] = {"matrix": m}
        return out
    return at


for c in DATA["clips"]:
    clip(c["name"], c["seconds"], keyed(c["frames"]))

# ---------------------------------------------------------------- the STUDIO
floor = DATA["rest"]["floor"]
finish("rider", OUT, SAMPLES, centre=(0, PELVIS.y + 0.15, PELVIS.z + 0.2), size=2.4, floor=floor,
       extras={"frame": "body"})
