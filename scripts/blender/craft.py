# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# A CRAFT MODELLED IN BLENDER off the game's own data: the spec
# (engine/game/defs/craft.ts), its style (pwa/src/game/craft-styles.ts) and
# the lines the code's builder lofts it on (`craftLines` in
# pwa/src/game/craft-body.ts — every station's cross-section off the
# physics' own station tables, the saddle, every fitting, the cockpit and
# the opening the sea is cut out of), handed in as one JSON file by
# `scripts/blender.mjs --kind=craft`, the driver and the only way this runs.
#
# The frame is the craft's BODY frame (x right, y up, z forward, the origin
# at the centre of gravity) laid as Blender's (-x, z, y) — a turn, not a
# mirror — so it faces +y, and glTF's own turn and the loader's half turn
# about y put it back on the engine's frame exactly (`craft-models.ts`).
# Everything below is written in body coordinates and turned at the last
# moment (`B`), so a number here reads as the builder's does.
#
# THE HULL is two subdivided cages that meet at the rail's top: the SHELL
# from the keel over two strakes, a creased chine and its flat, a topside
# flared a little outside the code's straight one (so the sea's cut, which
# is ruled on that line, never shows beside the hull), to the SPLIT — a
# stepped rubber lip where the deck's moulding comes down over the flank —
# and on up to the sheer and the rail; and the DECK from the rail, rolled
# over into a rounded gunwale, down into the footwells, across their mats
# to the pedestal and over the hood to the crown, the pedestal's back wall
# stepping up off the matted boarding platform where the code's does. The
# bow's last station is pinched to a stem; the transom is closed in the
# flanks' two colours with the lip carried across it. The saddle, the grab
# handle, the pod, the column and the bars, the mirrors, the sponsons, the
# pump, the ride plate, the grate, the nozzle and the reverse gate are
# modelled on the code's own fittings.
#
# THE RIG (lib.py's): the hull rides `body`; the DRIVERS are what the game
# turns off the engine (`craft-rig.ts`) — `bars` (the column, the bars, the
# grips, the pad), `nozzle` (its steer and its trim) and, on a craft that
# has one, `bucket` (the reverse gate) — each carrying in its extras the
# axis it turns about, in the BODY frame, signed as the engine's reading is.
# The clips play the game's own travel: `steer`, `trim`, `reverse`.
#
# Every material is named for what the game dresses it as (`dressOf`,
# `craft-models.ts`): the style's `hull`, `topside`, `rail`, `deck`, `seat`,
# `seatTop`, `tray`, `bar` and `grip`; `trim` and `moulding` (the rail's
# colour and the grip's, moulded); and `glass`.

import json, math, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib
from lib import *

argv = sys.argv[sys.argv.index("--") + 1:]
DATA = json.load(open(argv[0]))
OUT = argv[1]
SAMPLES = int(argv[2]) if len(argv) > 2 else 64
SPEC, STYLE, LINES, GEAR = DATA["spec"], DATA["style"], DATA["lines"], DATA["gear"]
D, F = LINES["dims"], LINES["fittings"]


def B(p):
    """A point or direction of the body frame, in Blender's."""
    return Vector((-p[0], p[2], p[1]))


def colour(hexa):
    """A style's sRGB colour as linear (the stills only: the game dresses
    every material by its name)."""
    return tuple(((c / 255 + 0.055) / 1.055) ** 2.4 for c in ((hexa >> 16) & 255, (hexa >> 8) & 255, hexa & 255))


def lerp(a, b, t):
    return a + (b - a) * t


# ---------------------------------------------------------------- materials
HULL = mat("hull", colour(STYLE["hull"]), rough=0.18, coat=1.0)
TOPSIDE = mat("topside", colour(STYLE["topside"]), rough=0.2, coat=1.0)
RAIL = mat("rail", colour(STYLE["rail"]), rough=0.8)
TRIM = mat("trim", colour(STYLE["rail"]), rough=0.45, coat=0.2)
DECK = mat("deck", colour(STYLE["deck"]), rough=0.4, coat=0.5)
SEAT = mat("seat", colour(STYLE["seat"]), rough=0.55)
SEAT_TOP = mat("seatTop", colour(STYLE["seatTop"]), rough=0.6)
TRAY = mat("tray", colour(STYLE["tray"]), rough=0.9)
BAR = mat("bar", colour(STYLE["bar"]), metal=1.0, rough=0.25)
GRIP = mat("grip", colour(STYLE["grip"]), rough=0.85)
MOULD = mat("moulding", colour(STYLE["grip"]), rough=0.45, coat=0.2)
GLASS = mat("glass", (0.25, 0.3, 0.34), metal=0.6, rough=0.05)


def crease(ob, pick):
    """Crease every edge `pick(a, b)` names (vertex indices), by its value."""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    layer = bm.edges.layers.float.get("crease_edge") or bm.edges.layers.float.new("crease_edge")
    for e in bm.edges:
        a, b = sorted(v.index for v in e.verts)
        w = pick(a, b)
        if w:
            e[layer] = w
    bm.to_mesh(ob.data)
    bm.free()


def subsurf(ob, game=1, render=2):
    sub = ob.modifiers.new("smooth", "SUBSURF")
    sub.levels = game if GAME else render
    sub.render_levels = game if GAME else render
    return ob


def rbox(name, bx, m, bevel=0.012):
    """The code's box (two corners, body frame), rounded."""
    x0, y0, z0, x1, y1, z1 = bx
    c = B(((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2))
    return box(name, c, (abs(x1 - x0), abs(z1 - z0), abs(y1 - y0)), m, bevel=bevel)


def tubeb(name, points, r, m, smooth_n=0):
    return tube(name, [B(p) for p in points], r, m, smooth_n=smooth_n)


def cylb(name, a, b, r, m, seg=24, r2=None):
    return cyl(name, B(a), B(b), r, m, seg=seg, r2=r2)


# ---------------------------------------------------------------- the STATIONS
# The code's own stations (the pedestal's back wall steps between two of
# them) and an even run between, halved for the game's budget.
EVERY = 24 if GAME else 48
SECTIONS = [c for c in LINES["sections"]
            if abs(c["s"] * EVERY - round(c["s"] * EVERY)) < 1e-6 or c["s"] in (0.1, 0.105)]
PLATFORM = D["platform"]


# THE SPLIT: where the deck's moulding comes down over the hull's flank to
# meet the hull — a share of the way from the chine to the sheer — and how
# far the deck's gunwale stands proud over the rail at the cockpit. The
# physics' lines are the hull's (the keel, the chine, the sheer, the
# footwell's floor and walls, the pedestal); these two only say where the
# moulding's paint stops and how round its edge is.
SPLIT = 0.7
BOLSTER = 0.034


def shell_half(c):
    """Half the shell's section, keel to the rail's top, body frame: the
    keel, two strakes on the V, the chine and its flat, the topside flared
    a little out past the code's straight line, the SPLIT (a stepped lip
    where the deck's moulding meets the hull), the sheer and the rail."""
    z, r = c["z"], c["rake"]
    kx, ky = 0.0, c["keelY"]
    cx, cy = c["chineX"], c["chineY"]
    h, sh = c["half"], c["sheer"]
    at = lambda share: z + r * share
    top = lambda u: (lerp(cx, h, 1 - (1 - u) ** 1.7), lerp(cy, sh, u))
    sx, sy = top(SPLIT)
    return [
        (kx, ky, at(0)),
        (0.33 * cx, ky + 0.3 * (cy - ky), at(0.16)),
        (0.66 * cx, ky + 0.63 * (cy - ky), at(0.33)),
        (cx, cy, at(0.5)),
        (cx + 0.05 * h, cy + 0.006, at(0.55)),
        (*top(0.4), at(0.75)),
        (sx, sy - 0.004, at(0.9)),
        (sx + 0.007, sy + 0.006, at(0.9)),
        (h, sh, at(1)),
        (h * 1.004, c["railTop"], at(1)),
    ]


# The shell's bands: the bottom to the chine's flat, the topside to the
# split, the lip in the rail's rubber, the deck's moulding over the flank.
SHELL_BANDS = [HULL, HULL, HULL, HULL, TOPSIDE, TOPSIDE, TRIM, DECK, DECK]
SHELL_CREASE = {0: 1.0, 1: 0.9, 2: 0.9, 3: 1.0, 4: 1.0, 6: 0.9, 7: 0.9, 9: 0.3}


def deck_half(c):
    """Half the deck's section, the rail to the crown: the gunwale rolled
    over the rail in a rounded BOLSTER, down the footwell's outer wall, its
    mat to the pedestal, up the pedestal's wall, over its shoulder to the
    crown. Over the boarding platform the bolster flattens and the floor
    runs flat to the middle; where the hood has closed over the wells the
    points it would stack spread up its side."""
    z = c["z"] + c["rake"]
    h, fo, rt = c["half"], c["footOuter"], c["railTop"]
    g = BOLSTER * min(1.0, max(0.0, (c["s"] - (PLATFORM - 0.02)) / 0.06))
    start = (h * 1.004, rt, z)
    rim = [(h * 0.99, rt + 0.7 * g, z), (h * 0.95, rt + g, z), (lerp(fo, h * 0.95, 0.35), rt + 0.8 * g, z)]
    if c["s"] < PLATFORM - 1e-6:
        y = c["wellY"]
        return [start] + rim + [(fo, y, z), (0.55 * fo, y, z), (0.3 * fo, y, z), (0.15 * fo, y, z), (0, y, z)]
    wall = (fo, c["wellY"], z)
    inner = (c["pedHalf"], c["wellY"], z)
    ped = (c["pedHalf"] * 0.92, c["pedY"], z)
    closed = 1 - c["open"]
    lift = lambda p, u: tuple(lerp(p[i], lerp(rim[2][i], ped[i], u), closed) for i in range(3))
    return [start] + rim + [lift(wall, 0.3), lift(inner, 0.62), ped,
                            (c["pedHalf"] * 0.5, c["pedY"] + c["crown"] * 0.75, z), (0, c["pedY"] + c["crown"], z)]


DECK_BANDS = [DECK, DECK, DECK, DECK, TRAY, DECK, DECK, DECK]
DECK_CREASE = {2: 0.25, 3: 0.5, 4: 0.9, 5: 0.9, 6: 0.6}


def ring(half, closed_top):
    """A right half mirrored into the full section: left from the far end
    round to the right. The shell's is open at its top (the coaming both
    sides); the deck's runs coaming to coaming over the crown."""
    right = [Vector(p) for p in half]
    left = [Vector((-p.x, p.y, p.z)) for p in right]
    if closed_top:   # shell: left coaming … keel … right coaming
        return list(reversed(left[1:])) + right
    return left + list(reversed(right[:-1]))   # deck: left coaming … crown … right coaming


def panel(name, halves, bands, creases, closed_top, flip=False, override=None):
    """A cage lofted through the stations' sections, every face in the
    material of its band. Wound outward by construction (`flip` for a
    section that runs over the top): an open panel cannot be trusted to a
    recalculation. `override(i, k)` may name another material for band `k`
    between stations `i` and `i + 1`."""
    rings = [ring(h, closed_top) for h in halves]
    n = len(halves[0])
    M = len(rings[0])
    verts = [B(p) for r in rings for p in r]
    faces, fm = [], []
    for i in range(len(rings) - 1):
        a, b = i * M, (i + 1) * M
        for j in range(M - 1):
            faces.append([a + j, b + j, b + j + 1, a + j + 1] if flip else [a + j, a + j + 1, b + j + 1, b + j])
            # Which band of the half this column is, counted from the
            # half's own first point, mirrored onto the left.
            if closed_top:
                k = j - (n - 1) if j >= n - 1 else (n - 2) - j
            else:
                k = j if j < n - 1 else (M - 2) - j
            fm.append((i, k))
    mats = list(dict.fromkeys(bands))
    pick = lambda i, k: (override(i, k) if override else None) or bands[k]
    ob = mesh_obj(name, verts, faces, mats, [mats.index(pick(i, k)) for i, k in fm], recalc=False)
    return ob, rings, M, n


# ---------------------------------------------------------------- the SHELL
rides("body")
# THE STEM: the bow's last station pinched to its centreline a couple of
# centimetres on — the code's hull ends in a flat face a hand wide, and a
# moulded bow comes to an edge.
STEM = 0.07
pinch = lambda half: [(0.0, y, z + STEM) for _, y, z in half]
shells = [shell_half(c) for c in SECTIONS]
shells.append(pinch(shells[-1]))
shell, shell_rings, SM, SN = panel("shell", shells, SHELL_BANDS, SHELL_CREASE, True)
decks = [deck_half(c) for c in SECTIONS]
decks.append(pinch(decks[-1]))
# The boarding platform's floor is matted from rail to rail, the tray's
# colour — the code's builder mats it the same.
deck, deck_rings, DM, DN = panel("deck", decks, DECK_BANDS, DECK_CREASE, False, flip=True,
                                 override=lambda i, k: TRAY if i + 1 < len(SECTIONS) and SECTIONS[i + 1]["s"] <= PLATFORM + 1e-6 and k >= 3 else None)

# The transom closes the two panels (the bow is closed by its stem). It is
# three faces: the
# hull's face below the split, the deck's moulding over it, and the split's
# rubber lip carried across between them — so the transom reads in the same
# two colours the flanks do.
def close(bm, loop, m, aft):
    f = bm.faces.new(loop)
    f.normal_update()
    if (f.normal.y < 0) != aft:
        f.normal_flip()
    f.smooth = True
    if m.name not in shell.data.materials:
        shell.data.materials.append(m)
    f.material_index = list(shell.data.materials).index(m)


bm = bmesh.new()
bm.from_mesh(shell.data)
bm.verts.ensure_lookup_table()
transom = [bm.verts[j] for j in range(SM)]
at = lambda side, hk: transom[(SN - 1) + side * hk]   # the transom's ring: side −1 the left
close(bm, transom[SN - 1 - 6:SN - 1 + 7], TOPSIDE, True)
close(bm, [at(-1, 6), at(1, 6), at(1, 7), at(-1, 7)], TRIM, True)
# …the strip kept a strip under the subdivision: its two long edges creased.
lip = bm.edges.layers.float.get("crease_edge") or bm.edges.layers.float.new("crease_edge")
for e in bm.edges:
    if set(e.verts) in ({at(-1, 6), at(1, 6)}, {at(-1, 7), at(1, 7)}):
        e[lip] = 1.0
top = [at(-1, 7), at(-1, 8), at(-1, 9)] + [bm.verts.new(B(p)) for p in deck_rings[0][1:-1]] + [at(1, 9), at(1, 8), at(1, 7)]
close(bm, top, DECK, True)
bm.to_mesh(shell.data)
bm.free()


def shell_pick(a, b):
    """Along the stations, the keel, strakes, chine and sheer; round the
    transom its rim."""
    if b - a == SM and a % SM == b % SM:
        j = a % SM
        k = abs(j - (SN - 1))
        return SHELL_CREASE.get(k, 0.0)
    if b - a == 1 and a // SM in (0,):
        return 1.0
    return 0.0


def deck_pick(a, b):
    if b - a == DM:
        j = a % DM
        k = j if j < DN - 1 else (DM - 1) - j
        return DECK_CREASE.get(k, 0.0)
    ri = a // DM
    if b - a == 1 and ri < len(SECTIONS) and SECTIONS[ri]["s"] in (0.1, 0.105):
        return 1.0
    return 0.0


crease(shell, shell_pick)
crease(deck, deck_pick)
subsurf(shell)
subsurf(deck)

# The rubber rail: a D-section bumper along the sheer, proud of the shell.
rail_pts = [(p[0] + 0.012, p[1] + 0.001, p[2]) for p in (shell_half(c)[7] for c in SECTIONS if 0.01 <= c["s"] <= 0.97)]
tubeb("rail_l", [(-x, y, z) for x, y, z in rail_pts], D["railH"] * 0.55, RAIL, smooth_n=2)
tubeb("rail_r", rail_pts, D["railH"] * 0.55, RAIL, smooth_n=2)

# ---------------------------------------------------------------- the SADDLE
S = LINES["seat"]
prof = [tuple(k) for k in S["profile"]]


def seat_h(t):
    return S["height"] * interp(prof, t)


def seat_w(t):
    w = S["width"] / 2
    return w * (lerp(0.9, 1, t / 0.08) if t < 0.08 else lerp(1, 0.7, (t - 0.86) / 0.14) if t > 0.86 else 1)


SEAT_KEYS = [(0.0, -0.01), (0.9, -0.01), (1.0, 0.08), (0.99, 0.55), (0.93, 0.8), (0.78, 0.95),
             (0.62, 1.0), (0.3, 1.03), (0.0, 1.04)]
INSERT = 6
halves = []
TS = [i / (10 if GAME else 20) for i in range((10 if GAME else 20) + 1)]
for t in TS:
    z = S["z0"] + t * S["length"]
    h, w = seat_h(t), seat_w(t)
    halves.append([(x * w, S["base"] + v * h, z) for x, v in SEAT_KEYS])
seat_bands = [SEAT, SEAT, SEAT, SEAT, SEAT, SEAT, SEAT_TOP, SEAT_TOP]
saddle, seat_rings, QM, QN = panel("saddle", halves, seat_bands, {}, False, flip=True)
# ...its ends closed, its insert piped.
bm = bmesh.new()
bm.from_mesh(saddle.data)
bm.verts.ensure_lookup_table()
for ri in (0, len(TS) - 1):
    loop = [bm.verts[ri * QM + j] for j in range(QM)]
    bm.faces.new(loop if ri else list(reversed(loop)))
layer = bm.edges.layers.float.new("crease_edge")
for e in bm.edges:
    a, b = sorted(v.index for v in e.verts)
    if b - a == QM:
        j = a % QM
        k = j if j < QN - 1 else (QM - 1) - j
        e[layer] = {INSERT: 0.8, 1: 0.7}.get(k, 0.0)
bm.to_mesh(saddle.data)
bm.free()
for p in saddle.data.polygons:
    p.use_smooth = True
subsurf(saddle)

if F["handle"]:
    (p0, p1), bar = [(q["a"], q["b"]) for q in F["handle"]["posts"]], F["handle"]["bar"]
    tubeb("handle", [p0[0], p0[1], bar["b"], p1[0]], 0.013, BAR, smooth_n=4)
    a, b = Vector(bar["a"]), Vector(bar["b"])
    cylb("handle_grip", tuple(a.lerp(b, 0.2)), tuple(a.lerp(b, 0.8)), 0.02, GRIP)

# ---------------------------------------------------------------- the TRANSOM
rbox("bumper", F["bumper"], RAIL, bevel=0.02)
rbox("step", F["step"], RAIL, bevel=0.015)


def blade(name, bx, m, bows=0.25):
    """A sponson: a blade off the chine, its outer edge easing in toward the
    bow and rounded, thinning to its edge."""
    x0, y0, z0, x1, y1, z1 = bx
    inner, outer = (x0, x1) if abs(x0) < abs(x1) else (x1, x0)
    rings = []
    N = 7
    for i in range(N):
        t = i / (N - 1)
        z = lerp(z0, z1, t)
        reach = lerp(inner, outer, 1 - max(0.0, (t - (1 - bows)) / bows) ** 1.5)
        mid, thick = (y0 + y1) / 2, (y1 - y0) / 2 * (1 - 0.55 * t)
        rings.append([B((inner, mid - thick, z)), B((reach, mid - thick * 0.35, z)),
                      B((reach, mid + thick * 0.35, z)), B((inner, mid + thick, z))])
    ob = loft(name, rings, [m], smooth=False)
    bev = ob.modifiers.new("bevel", "BEVEL")
    bev.width, bev.segments = 0.008, 2
    return ob


for s in F["sponsons"]:
    blade("sponson", s, TRIM)

# THE PUMP: its housing out of the transom, the ride plate under it, the
# grate over the intake.
px0, py0, pz0, px1, py1, pz1 = F["pump"]
rings = []
for i in range(9):
    t = i / 8
    z = lerp(pz0, pz1, t)
    w, hh = (px1 - px0) / 2 * (1 - 0.15 * t), (py1 - py0) / 2 * (0.9 + 0.1 * t)
    cy = lerp(py0, py1, 0.5)
    rings.append([B((x, cy + v, z)) for x, v in superellipse(0, 0, w, hh, 3.0, 12 if GAME else 24)])
loft("pump", rings, [MOULD])
kx0, ky0, kz0, kx1, ky1, kz1 = F["grate"]
rbox("ride_plate", (kx0 * 1.3, D["keelY"] - 0.012, pz0 - 0.02, kx1 * 1.3, D["keelY"] + 0.004, kz0 + 0.02), MOULD, bevel=0.004)
for i in range(5):
    x = lerp(kx0, kx1, (i + 0.5) / 5)
    rbox("grate_bar", (x - 0.008, ky0, kz0, x + 0.008, ky1, kz1), TRAY, bevel=0.003)

# ---------------------------------------------------------------- the NOZZLE and the GATE
na, nb, nr = F["nozzle"]["a"], F["nozzle"]["b"], F["nozzle"]["r"]
bore = LINES["pump"]["nozzleDiameter"] / 2
pivot = na
rides(bone("nozzle", B(pivot), B(nb), extras={"steerAxis": [0, -1, 0], "trimAxis": [1, 0, 0]}))
cylb("nozzle", na, nb, nr, TRIM, r2=bore + 0.012, seg=24)
tip = Vector(nb) + (Vector(nb) - Vector(na)).normalized() * 0.004
cylb("nozzle_bore", tuple(Vector(nb) - (Vector(nb) - Vector(na)).normalized() * 0.03), tuple(tip), bore, GRIP)
cylb("nozzle_ring", tuple(Vector(na).lerp(Vector(nb), 0.15)), tuple(Vector(na).lerp(Vector(nb), 0.3)), nr * 1.08, MOULD)
rides("body")


def turn_body(p, at, axis, angle):
    """`p` turned `angle` about the body-frame `axis` through `at`."""
    v = Vector(p) - Vector(at)
    return tuple(Vector(at) + Matrix.Rotation(angle, 3, Vector(axis)) @ v)


if LINES["pump"]["bucket"]:
    # THE REVERSE GATE: a cup that drops behind the nozzle's mouth on two
    # arms hinged over the housing. Modelled DOWN, then swung up into its
    # stowed place (the rest pose): the game swings it back by `bucket`.
    hinge = (0, nb[1] + nr + 0.03, na[2] + 0.01)
    up = GEAR["bucketSwing"]
    stow = lambda p: B(turn_body(p, hinge, (-1, 0, 0), -up))
    rides(bone("bucket", B(hinge), B((0, hinge[1], nb[2] - 0.1)), extras={"axis": [-1, 0, 0]}))
    cz = nb[2] - 0.045
    cup = []
    for i in range(7):
        t = i / 6
        z = cz - 0.05 * math.sin(math.pi * t / 2)
        rr = (nr + 0.035) * math.cos(math.pi * t / 2.4)
        cup.append([stow((math.cos(a) * rr, nb[1] + math.sin(a) * rr * 0.95, z))
                    for a in (math.pi * (-0.15 + 1.3 * k / 12) for k in range(13))])
    g = loft("bucket", cup, [TRIM], closed=False, cap=False)
    g.modifiers.new("thick", "SOLIDIFY").thickness = 0.008
    for sx in (-1, 1):
        x = sx * (nr + 0.04)
        tube("bucket_arm", [stow((x, hinge[1], hinge[2])), stow((x, nb[1] + 0.02, cz + 0.01))], 0.009, TRIM)
    rides("body")

# ---------------------------------------------------------------- the STEERING
# The pod on the hood, and on the `bars` bone everything that turns: the
# column, the bars, the grips and the pad.
ox0, oy0, oz0, ox1, oy1, oz1 = F["pod"]
rings = []
for i in range(9):
    t = i / 8
    z = lerp(oz0, oz1, t)
    rise = math.sin(math.pi * min(1.0, 0.15 + t)) ** 0.5
    w = (ox1 - ox0) / 2 * (0.7 + 0.3 * math.sin(math.pi * t) ** 0.4)
    hh = (oy1 - oy0) * (0.6 + 0.4 * rise) + 0.02
    base = oy0 - 0.03
    rings.append([B((x, base + (v + 1) * hh / 2, z)) for x, v in superellipse(0, 0, w, 1.0, 3.2, 14 if GAME else 28, taper_top=0.25)])
subsurf(loft("pod", rings, [DECK]), 1, 1)
cb, ct = F["column"]["a"], F["column"]["b"]
face = (Vector(ct) - Vector(cb)).normalized()
# The instrument panel on the pod's back, tipped up toward the rider.
box("display", B((0, oy1 + 0.012, oz0 + 0.035)), (0.13, 0.07, 0.012), GLASS, rot=(math.radians(40), 0, 0),
    bevel=0.004)
axis = [face.x, face.y, face.z]
rides(bone("bars", B(cb), B(ct), extras={"axis": axis}))
cylb("column", cb, ct, F["column"]["r"], MOULD, r2=F["column"]["r"] * 0.8)
ends = [bb["bar"]["b"] for bb in F["bars"]]
grip_in = [bb["grip"]["a"] for bb in F["bars"]]
mid = lambda a, b, t: tuple(Vector(a).lerp(Vector(b), t))
bar_path = [ends[0], grip_in[0], mid(grip_in[0], ct, 0.55), (0, ct[1] + 0.012, ct[2]),
            mid(grip_in[1], ct, 0.55), grip_in[1], ends[1]]
tubeb("handlebar", bar_path, 0.013, BAR, smooth_n=4)
for bb in F["bars"]:
    a, b = Vector(bb["grip"]["a"]), Vector(bb["grip"]["b"])
    d = (b - a).normalized()
    cylb("grip", tuple(a), tuple(b + d * 0.01), 0.021, GRIP, seg=20)
    cylb("grip_flange", tuple(a - d * 0.006), tuple(a + d * 0.006), 0.03, GRIP, seg=20)
    cylb("bar_end", tuple(b + d * 0.01), tuple(b + d * 0.025), 0.019, MOULD, seg=16)
rbox("bar_pad", F["pad"], GRIP, bevel=0.02)
rbox("throttle", (ends[1][0] - 0.16, ends[1][1] - 0.005, ends[1][2] + 0.04,
                  ends[1][0] - 0.06, ends[1][1] + 0.01, ends[1][2] + 0.06), MOULD, bevel=0.004)
rides("body")

for m in F["mirrors"]:
    tubeb("mirror_stalk", [m["stalk"]["a"], m["stalk"]["b"]], 0.011, BAR)
    x0, y0, z0, x1, y1, z1 = m["head"]
    c = ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
    ellipsoid("mirror", B(c), (0.06, 0.035, 0.032), DECK)
    box("mirror_glass", B((c[0], c[1], c[2] - 0.035)), (0.1, 0.004, 0.05), GLASS, bevel=0.002)

# ---------------------------------------------------------------- the CLIPS
# The game's own travel: the bars to its lock each way with the nozzle, the
# trim through its range, the gate down and back.
lock, bars_turn = LINES["pump"]["nozzleAngle"], GEAR["barTurn"]
steer_axis, trim_axis = B((0, -1, 0)), B((1, 0, 0))
clip("steer", 2.0, lambda t: {"bars": {"turns": [(B(axis), bars_turn * math.sin(math.pi * t))]},
                              "nozzle": {"turns": [(steer_axis, lock * math.sin(math.pi * t))]}})
if LINES["pump"]["trimRange"] > 0:
    clip("trim", 2.0, lambda t: {"nozzle": {"turns": [(trim_axis, LINES["pump"]["trimRange"] * math.sin(math.pi * t))]}})
if LINES["pump"]["bucket"]:
    gate = B((-1, 0, 0))
    clip("reverse", 2.0, lambda t: {"bucket": {"turns": [(gate, GEAR["bucketSwing"] * math.sin(math.pi * t / 2) ** 2
                                                          if t < 1 else GEAR["bucketSwing"] * math.cos(math.pi * (t - 1) / 2) ** 2)]}})

# ---------------------------------------------------------------- the STUDIO
# Photographed floating at its rest draft: the sea at the waterline.
finish(SPEC["id"], OUT, SAMPLES, centre=(0, 0.1, 0.15), size=D["L"] * 1.35, floor=-DATA["rest"],
       extras={"frame": "body"})
