# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# THE UNDERGROWTH MODELLED IN BLENDER: one KIND's four variants — a bush, a
# tuft of grass, a reed or a piece of loose stone — off the very row the
# code's builder reads (`pwa/src/game/undergrowth-variants.ts` and the
# kind's row of `flora-defs.ts`, handed in as one JSON file by
# `scripts/blender.mjs --kind=undergrowth`). Every proportion of the FORM is
# the code's own (`UNDER_SHAPE`), and every number that makes a variant the
# variant it is (its dome, its shoots, its lean, its missing plumes, its
# split) is the row's. What this adds is the MODELLING — which is the whole
# reason a plant is made here rather than drawn by the code:
#
#   a BUSH   a stool of woody shoots fanning out of the ground under a shell
#            of lobed leaf clusters over a shaded core, laid over the mound
#            the code draws as three lumps: a sallow's dome, a juniper's
#            shaggy column, a heather mat's bumpy carpet, the maquis
#   a TUFT   blades with a crease down the middle, rising, twisting and
#            arching over under their own weight, a seed head on some
#   a REED   canes with a leaf or two off each and a feathered plume on the
#            tip, standing level along the bed's top
#   a STONE  a faceted lump — a cobble, a slab, a block, a split pair — its
#            top lit and its underside dark, every face its own tone
#
# THE FRAME is the trees' (`tree.py`): metres at the REFERENCE height, x
# across (the way a wind-laid clump leans), z up from the foot, one mesh a
# variant (`v<i>`), no far sketch — nothing here stands over a rider's head
# and a species' reach closes before one would pay. `tree-models.ts` divides
# the reference height back out into the unit frame the placer scales.
#
# DRESSED BY THE GAME, by ROLE and TONE (`foliage.py`'s header): a stone's
# two greys are its row's `leafLit` and `leafDark`, a cotton grass's white
# seed head its `stemHigh` (the `bark` role blended to its upper colour).
#
# DRAWN TWO-SIDED. A blade of grass has no inside, so every blade and leaf
# here is ONE face; the game's undergrowth material draws both sides
# (`flora.ts`), where a tree's is culled. A cluster is still a closed shell.

import json, math, os, random, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib
from lib import *
from foliage import *

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
role_mats(PAINT)

# A plant under this height (the row's tallest, m) is a handful of pixels
# from the saddle and gets the smaller budget — the code's own line
# (`UNDER_SHAPE.bush.small`), read for every form.
SMALL = LOOK["height"]["max"] < DATA["small"]


def golden(i):
    return i * 2.39996323


def strip(t, rows, role, side_normal, shade=lambda u: 1.0, blend=lambda u: 0.0):
    """ONE-FACED ribbon through `rows` — each a list of points across the
    ribbon at one station, the same count each — with every vertex's
    normal `side_normal(u, across)`. A blade, a leaf, a plume."""
    ix = []
    for k, row in enumerate(rows):
        u = k / max(1, len(rows) - 1)
        ix.append([t.v(p, shade(u), blend(u), side_normal(u, j / max(1, len(row) - 1))) for j, p in enumerate(row)])
    for k in range(len(rows) - 1):
        a, b = ix[k], ix[k + 1]
        for j in range(len(a) - 1):
            quad = (a[j], a[j + 1], b[j + 1], b[j])
            # A station that has closed to a point makes a triangle of it.
            face = tuple(dict.fromkeys(quad))
            if len(face) >= 3:
                t.f(face, role)


# ---------------------------------------------------------------- a BUSH
def mound(v, f, z):
    """The mound's half-width at height `z` (m), off the code's masses: the
    lumps stand `low` to `low + span` of the height up, `radius` of the
    spread across, so the outline is a dome over that band — pulled into a
    column or flattened into a mat by the variant's `dome`."""
    B = SHAPE
    s = LOOK["spread"] * v["spread"]
    top = v["top"] * H
    W = s * (B["radius"] * (B["vary"][0] + B["vary"][1] * 0.5) + B["drift"] * 0.5) * H
    # Where the mound is widest: the code's lower masses are the biggest.
    zc = (B["low"] + B["span"] * 0.35) * top
    if z < 0 or z > top:
        return 0.0
    # Above the waist a dome, below it a straight skirt down to the foot.
    if z >= zc:
        k = (z - zc) / max(top - zc, 1e-6)
        p = 0.5 - 0.35 * f["dome"]          # a mat keeps its width to the top
        return W * max(0.0, 1 - k * k) ** p
    k = (zc - z) / max(zc, 1e-6)
    skirt = 0.75 + 0.2 * f["dome"]
    return W * (1 - (1 - skirt) * k * k)


def bush(v, f, rng):
    t = Plant(0.0)
    B = SHAPE
    top = v["top"] * H
    zbot = max(0.0, v["bare"]) * top
    zc = (B["low"] + B["span"] * 0.35) * top
    W = mound(v, f, zc)
    rise = (top - zbot) / 2
    core_z = zbot + rise
    column = f["dome"] < -0.3
    mat_ = f["dome"] > 0.3
    # THE SHOOTS: a stool of woody stems fanning out of one foot up into the
    # foliage — what a shrub is under its leaves, and what shows at the foot
    # of one where the code shows a lump on the ground. A mat has none
    # worth drawing; a row that stands a bare stem gets a proper one.
    shoots = 0 if mat_ else round((3 if SMALL else 7) * (1 + 0.6 * f["rough"]))
    for i in range(shoots):
        a = golden(i) + v["index"] * 0.7 + rng.random() * 0.4
        lee = 1 + f["flag"] * math.cos(a) * 0.8
        reach = W * (0.2 + 0.45 * rng.random()) * max(0.2, lee)
        zt = zbot + (top - zbot) * (0.4 + 0.35 * rng.random())
        c, sn = math.cos(a), math.sin(a)
        foot = Vector((c * W * 0.05, sn * W * 0.05, -0.015 * H))
        knee = Vector((c * reach * 0.45, sn * reach * 0.45, zt * 0.5))
        tip = Vector((c * reach, sn * reach, zt))
        r = 0.011 * H * (0.8 + 0.4 * rng.random()) * (0.6 if SMALL else 1)
        tube(t, [foot, knee, tip], [r * 1.3, r, r * 0.5], 3, "twig",
             lambda k: (0.65 + 0.15 * k, 0.1 * k), cap=True)
    if v["bare"] > B["stem"]["gate"]:
        r0, r1 = B["stem"]["r"][0] * H, B["stem"]["r"][1] * H
        stem_top = v["bare"] * B["stem"]["tall"] * top
        tube(t, [Vector((0, 0, -0.02 * H)), Vector((0, 0, stem_top * 0.6)), Vector((0.03 * H, 0, stem_top))],
             [flare(r0, 0), (r0 + r1) / 2, r1], 5, "bark", lambda k: (0.7 + 0.1 * k, 0.0), cap=True)
    # THE CORE: a shaded mass filling the mound, so the gaps between the
    # clusters read as leaves deeper in rather than as ground — nearly the
    # whole outline on a mat and a column, where the shell is a shag on it.
    core_w = W * (0.92 if (mat_ or column) else 0.8) * (1 - 0.25 * f["open"])
    cluster(t, (0, 0, core_z), core_w, rise * (0.92 if mat_ else 0.85), (0, 0, zbot - rise * 0.5), rng,
            sides=6 if SMALL else 8, rings=3, dark=0.75)
    # THE SHELL: a skin of lobed leaf clusters laid over the mound on a
    # spiral — even over its surface, never in rings, which read as a stack
    # of hedges — each embedded to its middle in the outline so the skin
    # closes: a shrub's crown is many small masses that touch, not three big
    # ones that float. Sized so a bush costs about what a tree does.
    want = round((10 if SMALL else 24) * f["masses"] * (1 - 0.3 * f["open"]) * (1.3 if column else 1))
    area = 2 * math.pi * W * (top - zbot) * (0.55 if column else 0.8)
    size0 = min(math.sqrt(max(area, 1e-6) / (want * math.pi)) * 1.3, W * 0.6)
    # A mat is as much top as side: half its clusters go over the crown, and
    # the side's are laid where its skirt would otherwise show the core.
    side_share = 0.55 if mat_ else 0.8
    n_side = max(3, round(want * side_share))
    for i in range(n_side):
        # Even by surface area: lower down the mound is wider.
        u = (i + 0.5) / n_side
        fz = zbot + (top - zbot) * (0.06 + 0.88 * (1 - math.sqrt(1 - u * 0.999) if not mat_ else u))
        a = golden(i) + v["index"] * 1.3 + (rng.random() - 0.5) * 0.3
        lee = 1 + f["flag"] * (math.cos(a) * 0.9 - 0.25)
        if lee < 0.15:
            continue
        room = mound(v, f, fz)
        size = size0 * (0.7 + 0.6 * rng.random()) * (0.85 if column else 1)
        rr = max(0.0, room - size * 0.45) * min(1.0, lee) * (1 + f["rough"] * (rng.random() - 0.35) * 0.5)
        rz = size * (0.5 + 0.3 * max(0.0, -f["dome"]))
        cluster(t, (math.cos(a) * rr, math.sin(a) * rr, fz), size, min(rz, rise), (0, 0, core_z - rise * 0.6), rng,
                sides=4 if SMALL else 5, rings=2, dark=0.1)
    if not column:
        # The crown: bumps over the top of the mound on a spiral of their
        # own — most of a mat, a few on a dome.
        room = mound(v, f, top - size0 * 0.4)
        n = max(1, round(want * (1 - side_share) * (1.6 if mat_ else 0.8)))
        for i in range(n):
            a = golden(i) + v["index"] * 2.1
            rr = math.sqrt((i + 0.5) / n) * max(0.0, room - size0 * 0.4)
            size = size0 * (0.7 + 0.5 * rng.random())
            cluster(t, (math.cos(a) * rr, math.sin(a) * rr, top - size * 0.6), size, size * 0.5, (0, 0, core_z - rise * 0.6), rng,
                    sides=4 if SMALL else 5, rings=2, dark=0.0)
    if f["rough"] > 0.5:
        # Stragglers: a few shoots standing out past the outline with a
        # small tuft on the end, which is what an unclipped shrub does.
        for i in range(3 if SMALL else 5):
            a = golden(i + 11) + rng.random()
            c, sn = math.cos(a), math.sin(a)
            reach = W * (1.05 + 0.3 * rng.random())
            zt = zbot + (top - zbot) * (0.7 + 0.35 * rng.random())
            tube(t, [Vector((c * W * 0.2, sn * W * 0.2, zbot + rise * 0.5)), Vector((c * reach, sn * reach, zt))],
                 [0.01 * H, 0.004 * H], 3, "twig", lambda k: (0.7, 0.2))
            cluster(t, (c * reach, sn * reach, zt), size0 * 0.4, size0 * 0.28, (0, 0, core_z), rng, sides=4, rings=1)
    return t


# ---------------------------------------------------------------- a TUFT of grass
def blade(t, foot, yaw, h, half, bend, twist, role, lit_to, tip_from, sheath=0.0, stations=(0.0, 0.32, 0.64, 0.86, 1.0)):
    """One blade: a midrib rising from `foot`, arching over to `bend` of its
    height, CREASED — its two halves fall away from the rib, so a light
    catches one side and not the other — twisting a little as it goes,
    narrowing to a point. Painted the kind's dark at the foot and its lit
    toward the tip, the way the code paints it."""
    dx, dy = math.sin(yaw), math.cos(yaw)
    ax, ay = math.cos(yaw), -math.sin(yaw)
    rows = []
    for u in stations:
        out = bend * h * u * u
        z = foot.z + h * u * (1 - 0.25 * bend * u * u)
        w = half * (1 - u) ** 0.55 * (1 - sheath * 0.5)
        tw = twist * u
        c = Vector((foot.x + dx * out, foot.y + dy * out, z))
        side = Vector((ax * math.cos(tw) - dx * math.sin(tw) * 0.5, ay * math.cos(tw) - dy * math.sin(tw) * 0.5, math.sin(tw) * 0.4)).normalized()
        # The crease deepens up the blade; the foot stands flat on the ground.
        drop = Vector((0, 0, -w * 0.45 * min(1.0, u * 3)))
        if u >= 1:
            rows.append([c, c, c])
        else:
            rows.append([c - side * w + drop, c, c + side * w + drop])

    def normal(u, across):
        # The crease: each half leans its normal its own way, up and out.
        lean = (across - 0.5) * 1.3
        n = Vector((ax * lean + dx * 0.3 * u, ay * lean + dy * 0.3 * u, 1.0)).normalized()
        return tuple(n)

    strip(t, rows, role, normal,
          shade=lambda u: 0.55 + 0.45 * u,
          blend=lambda u: 1.0 - (lit_to if u >= tip_from else lit_to * u))


def tuft(v, f, rng):
    t = Plant(f["lean"])
    T = SHAPE
    s = LOOK["spread"] * v["spread"]
    top = v["top"]
    n = max(3, round(v["stems"] * (1 - 0.6 * f["sparse"])))
    r = s * 0.5 * H
    for i in range(n):
        a = rng.random() * 2 * math.pi
        d = math.sqrt(rng.random()) * r * T["disc"]
        h = (T["height"][0] + rng.random() * T["height"][1]) * top * H
        yaw = a + (rng.random() - 0.5) * T["yaw"]
        bend = T["bend"][0] + rng.random() * T["bend"][1]
        foot = Vector((math.sin(a) * d, math.cos(a) * d, -0.02 * H))
        # Narrower than the code's flat blade: a crease reads as width.
        blade(t, foot, yaw, h, s * T["half"] * H * 0.7, bend, (rng.random() - 0.5) * 1.2, "leaf", T["lit"], T["tipFrom"])
        if rng.random() < f["heads"]:
            # A seed head: a stiff straight stalk over the clump with a
            # spike on the end, in the row's upper colour.
            sa = a + (rng.random() - 0.5) * 0.4
            sl = h * (0.9 + 0.3 * rng.random())
            base = Vector((foot.x, foot.y, foot.z))
            tip = base + Vector((math.sin(sa) * bend * sl * 0.5, math.cos(sa) * bend * sl * 0.5, sl))
            r = s * T["half"] * H * 0.08
            tube(t, [base, tip], [r, r * 0.7], 3, "twig", lambda k: (0.8, 0.3))
            head = tip + (tip - base).normalized() * sl * 0.14
            tube(t, [tip, head], [r * 2.6, r * 0.8], 3, "bark", lambda k: (0.95, 1.0), cap=True)
    # A few dead blades lying flat round the foot: a tussock is never all
    # green, and the litter is what sits it on the ground.
    for i in range(0 if SMALL else 4):
        a = golden(i) + v["index"]
        foot = Vector((math.sin(a) * r * 0.5, math.cos(a) * r * 0.5, -0.01 * H))
        blade(t, foot, a, T["height"][0] * 0.6 * top * H, s * T["half"] * H * 0.8, 0.9, 0.3, "twig", 0.2, 0.99)
    return t


# ---------------------------------------------------------------- a REED bed
def reed(v, f, rng):
    t = Plant(f["lean"])
    R = SHAPE
    s = LOOK["spread"] * v["spread"]
    top = v["top"]
    n = max(3, round(v["stems"] * (1 - 0.6 * f["sparse"])))
    r = s * 0.5 * H
    # A cane is a tenth of the code's flat stem across: the width the code
    # drew was for a blade seen at range, and a tube has a side.
    cane_r = s * R["half"] * H * 0.11
    for i in range(n):
        a = rng.random() * 2 * math.pi
        d = math.sqrt(rng.random()) * r * R["disc"]
        broken = rng.random() < f["broken"]
        h = (R["height"][0] + rng.random() * R["height"][1]) * top * H * (0.55 + 0.25 * rng.random() if broken else 1)
        yaw = a + (rng.random() - 0.5) * R["yaw"]
        bend = (R["bend"][0] + rng.random() * R["bend"][1]) * (2.5 if broken else 1)
        dx, dy = math.sin(yaw), math.cos(yaw)
        foot = Vector((math.sin(a) * d, math.cos(a) * d, -0.02 * H))
        # THE CANE: three-sided, straight, kinked over where it is broken.
        pts = [foot + Vector((dx * bend * h * u * u, dy * bend * h * u * u, h * u)) for u in (0, 0.5, 1)]
        tube(t, pts, [cane_r * 1.1, cane_r, cane_r * 0.7], 3, "leaf",
             lambda k: (0.6 + 0.2 * k, 1.0 - (0.0 if k / 2 < R["tipFrom"] else 1.0) - 0.5 * (k == 1)), cap=broken)
        tip = pts[-1]
        # A LEAF or two off the cane, angled up and out, hanging at the tip.
        for j in range(1):
            u = 0.35 + 0.3 * rng.random()
            at = foot + Vector((dx * bend * h * u * u, dy * bend * h * u * u, h * u))
            la = yaw + (1.2 if j == 0 else -1.2) + (rng.random() - 0.5) * 0.6
            lh = h * (0.22 + 0.1 * rng.random())
            blade(t, at, la, lh, s * R["half"] * H * 0.45, 0.9 + 0.4 * rng.random(), 0.4, "leaf", 1.0, 0.8, sheath=0.3,
                  stations=(0.0, 0.5, 1.0))
        if broken:
            continue
        # THE PLUME: a feathered panicle on the tip — three narrow strips
        # fanned a little apart and drooping, in the row's upper colour.
        ph = h * R["plume"]["tall"]
        pw = s * R["plume"]["half"] * H * 0.5
        pb = bend * R["plume"]["bend"]
        for j in range(2):
            # Two feathery sprays fanned a little apart, nodding with the
            # cane, narrow and tall rather than a blob on a stick.
            pa = yaw + (j - 0.5) * 0.7 + (rng.random() - 0.5) * 0.3
            px, py = math.sin(pa), math.cos(pa)
            rows = []
            for u in (0.0, 0.4, 0.75, 1.0):
                out = pb * ph * u * u + 0.4 * pw * u
                c = Vector((tip.x + px * out, tip.y + py * out, tip.z + ph * u * (1 - 0.2 * u)))
                w = pw * (0.25 + 0.75 * math.sin(math.pi * min(1.0, u * 1.05)))
                side = Vector((math.cos(pa), -math.sin(pa), 0)) * w
                rows.append([c, c, c] if u >= 1 else [c - side, c, c + side])
            strip(t, rows, "bark", lambda u, across, px=px, py=py: (px * 0.3, py * 0.3, 0.95),
                  shade=lambda u: 0.9 + 0.1 * u, blend=lambda u: 1.0)
    return t


# ---------------------------------------------------------------- a STONE
def lump(t, centre, rx, ry, rz, sides, stacks, jag, angular, rng, seed):
    """A faceted lump round `centre`: rings of vertices cut in and out by
    their own hash, flat-shaded (every face its own vertices and normal),
    its top toward the row's lit grey and its underside the dark, every
    face a little lighter or darker than the next — stone is patchy."""
    rings = []
    for k in range(1, stacks):
        phi = math.pi * k / stacks
        cz, sr = -math.cos(phi), math.sin(phi)
        ring = []
        for j in range(sides):
            a = 2 * math.pi * (j + 0.5 * (k % 2)) / sides
            w = 1 - jag * rng.random()
            # An angular block: the rings squared toward a box.
            sq = 1 + angular * 0.35 * (abs(math.cos(a)) + abs(math.sin(a)) - 1)
            ring.append(Vector((centre[0] + math.cos(a) * sr * rx * w * sq, centre[1] + math.sin(a) * sr * rz * w * sq,
                                centre[2] + cz * ry * (1 - jag * 0.4 * rng.random()))))
        rings.append(ring)
    foot = Vector((centre[0], centre[1], centre[2] - ry))
    crown = Vector((centre[0] + rx * 0.15 * (rng.random() - 0.5), centre[1] + rz * 0.15 * (rng.random() - 0.5), centre[2] + ry * (0.8 + 0.3 * rng.random())))

    def face(pts):
        n = (pts[1] - pts[0]).cross(pts[2] - pts[0])
        if n.length < 1e-9:
            return
        n.normalize()
        up = 0.5 + 0.5 * n.z
        mottle = 0.86 + 0.28 * rng.random()
        ix = [t.v(p, up * mottle, 1 - up, tuple(n)) for p in pts]
        t.f(ix, "leaf")

    for k in range(len(rings) - 1):
        lo, hi = rings[k], rings[k + 1]
        for j in range(sides):
            j1 = (j + 1) % sides
            face([lo[j], lo[j1], hi[j]])
            face([lo[j1], hi[j1], hi[j]])
    for j in range(sides):
        j1 = (j + 1) % sides
        face([foot, rings[0][j1], rings[0][j]])
        face([crown, rings[-1][j], rings[-1][j1]])


def stone(v, f, rng):
    t = Plant(0.0)
    S = SHAPE
    s = LOOK["spread"] * v["spread"]
    top = v["top"]
    rx, ry, rz = s * S["rx"] * H, S["ry"] * top * H, s * S["rz"] * H
    flat = f["flat"]
    sides = 5 if f["angular"] > 0.5 else 7
    stacks = 3 if f["angular"] > 0.5 else 5
    jag = 0.22 - 0.1 * f["angular"]
    # Every lump's foot on the ground (the placer buries it to its waist
    # from there), whatever its height: a slab flattened about the code's
    # centre would float above its own foot.
    if f["split"]:
        for i, (ox, oy, k) in enumerate(((-0.45, 0.1, 0.62), (0.4, -0.15, 0.5))):
            lump(t, (ox * rx, oy * rz, ry * k), rx * k * 1.1, ry * k, rz * k * 1.1, sides, stacks, jag,
                 f["angular"], rng, i)
        return t
    ry_ = ry * (1 - 0.55 * flat)
    lump(t, (0, 0, ry_), rx * (1 + 0.35 * flat), ry_, rz * (1 + 0.3 * flat), sides, stacks, jag,
         f["angular"], rng, 0)
    return t


# ---------------------------------------------------------------- the KIND: four variants
def build(v, rng):
    f = v["shape"]
    if FORM == "bush":
        return bush(v, f, rng)
    if FORM == "tuft":
        return tuft(v, f, rng)
    if FORM == "reed":
        return reed(v, f, rng)
    if FORM == "stone":
        return stone(v, f, rng)
    raise ValueError(FORM)


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
root["height"], root["frame"] = H, "undergrowth"
for ob in made:
    ob.parent = root
full = [tris[f"v{i}"] for i in range(len(DATA["variants"]))]
print("TRIANGLES", KIND, "full", min(full), "-", max(full), "total", sum(full))

if GAME:
    lib._select_only([root] + made)
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, f"{KIND}.glb"), use_selection=True, export_extras=True,
                              export_normals=True, export_vertex_color="ACTIVE", export_all_vertex_colors=False,
                              export_animations=False, export_skins=False, export_morph=False,
                              export_materials="EXPORT")

# ---------------------------------------------------------------- the STUDIO: the four in a row, on the shore
row_studio(made, KIND, OUT, SAMPLES, H, max(2.4 * LOOK["spread"] * H * max(v["spread"] for v in DATA["variants"]) * 0.6, 0.35 * H))
