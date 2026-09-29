"""AEONS wonders — Medieval: great_wall, hagia_sophia, angkor_wat, taj_mahal, leaning_tower, himeji.

Blender Z-up, front faces -Y. Every builder receives a wonders_lib.Builder `b`.
"""
import math
import random

import bmesh
from mathutils import Vector

from wonders_lib import PALETTE, R, T, place, polar

PALETTE.setdefault('med_lacquer', ('#b3372b', .8, 0))       # Chinese / Japanese red columns
PALETTE.setdefault('med_wallbrick', ('#9d9a92', .88, 0))    # Great Wall grey brick
PALETTE.setdefault('med_wallbrick_dk', ('#7f7b73', .9, 0))
PALETTE.setdefault('med_roof_glaze', ('#434b5a', .78, 0))   # dark glazed roof tiles
PALETTE.setdefault('med_inset', ('#3a3a44', .9, 0))         # deep arch recesses / windows
PALETTE.setdefault('med_khmer', ('#9a927e', .9, 0))         # weathered Khmer sandstone
PALETTE.setdefault('med_khmer_dk', ('#7a7465', .9, 0))
PALETTE.setdefault('med_arcade', ('#bdb5a5', .8, 0))         # shaded marble behind loggia columns
PALETTE.setdefault('med_kawara', ('#59616e', .8, 0))         # Japanese grey roof tiles
PALETTE.setdefault('med_hill', ('#b5552b', .9, 0))          # wind-scoured regolith
PALETTE.setdefault('med_hill_dark', ('#6e3219', .9, 0))


# ---------------------------------------------------------------------------------------------- geometry helpers

def _sgn(v):
    return 1.0 if v >= 0 else -1.0


def _loft(b, rings, mat, cap_bottom=True, cap_top=True, smooth=False, closed=True):
    """Skin consecutive rings (lists of xyz, CCW seen from +Z) into a shell; caps make it solid."""
    tb = bmesh.new()
    vr = [[tb.verts.new(p) for p in ring] for ring in rings]
    n = len(rings[0])
    for a, c in zip(vr, vr[1:]):
        for k in range(n if closed else n - 1):
            k2 = (k + 1) % n
            tb.faces.new((a[k], a[k2], c[k2], c[k]))
    if cap_bottom:
        tb.faces.new(list(reversed(vr[0])))
    if cap_top:
        tb.faces.new(vr[-1])
    b._add(tb, place(), mat, smooth=smooth)


def _eave_ring(hw, hd, z, curl=0.0, flare=0.0, m=4):
    """Rectangle outline (CCW from above, starting front-left) whose corners sweep up and out."""
    corners = ((-hw, -hd), (hw, -hd), (hw, hd), (-hw, hd))
    pts = []
    for s in range(4):
        (x0, y0), (x1, y1) = corners[s], corners[(s + 1) % 4]
        for i in range(m):
            t = i / m
            x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
            k = abs(2 * t - 1) ** 3
            pts.append((x + _sgn(x) * flare * k, y + _sgn(y) * flare * k, z + curl * k))
    return pts


def _asian_roof(b, w, d, h, at=(0, 0, 0), mat='med_roof_glaze', curl=.02, flare=.012, ridge=None, thick=.012,
                ridge_mat=None, ornament='gold', rot=0.0, bells=True):
    """Hip roof with concave slopes and upturned, flared corners (Chinese / Japanese). `at` = eave level
    centre (underside of the eaves sits `thick` below). Ridge runs along X."""
    ridge = w - d if ridge is None else ridge
    ridge = max(ridge, .004)
    with b.xform(place(at, (0, 0, rot))):
        hw, hd = w / 2, d / 2
        rings = [_eave_ring(hw, hd, -thick, curl, flare),
                 _eave_ring(hw, hd, 0, curl, flare),
                 _eave_ring(hw * .6 + ridge * .2, hd * .5, h * .36, curl * .15, flare * .1),
                 _eave_ring(ridge / 2, .006, h, 0, 0)]
        _loft(b, rings, mat)
        rm = ridge_mat or mat
        b.box((ridge + .012, .014, .012), (0, 0, h - .004), rm)
        if ornament:
            for sx in (-1, 1):
                x = sx * (ridge / 2 + .004)
                b.tube([(x, 0, h), (x + sx * .006, 0, h + .018), (x - sx * .004, 0, h + .026)],
                       [.0065, .0055, .003], ornament, segs=4)
            for sx in (-1, 1):
                for sy in (-1, 1) if bells else ():
                    b.cone(.005, .014, (sx * (hw + flare), sy * (hd + flare), curl - .002), ornament, segs=4)


def _arch_shape(b, w, h, at, mat='med_inset', t=.004, rot=0.0, pointed=0.0, segs=6):
    """Round/pointed arch silhouette (one-sided decal) standing in XZ, `t` in front (-Y) of `at` (bottom centre)."""
    ow = w / 2
    spring = h - ow * (1 + pointed)
    pts = [(ow, 0)]
    for k in range(segs + 1):
        a = math.pi * k / segs
        x = ow * math.cos(a)
        y = spring + ow * math.sin(a) * (1 + pointed * (1 - abs(math.cos(a))))
        pts.append((x, y))
    pts.append((-ow, 0))
    with b.xform(place(at, (0, 0, rot))):
        b.decal(pts, (0, -t, 0), mat, rot=(90, 0, 0))


def _merlon(b, size, at, mat, heading=0.0):
    """Bottomless box (10 tris) for crenellations / small blocks sitting on something."""
    sx, sy, sz = size[0] / 2, size[1] / 2, size[2]
    tb = bmesh.new()
    lo = [tb.verts.new(p) for p in ((-sx, -sy, 0), (sx, -sy, 0), (sx, sy, 0), (-sx, sy, 0))]
    hi = [tb.verts.new((v.co.x, v.co.y, sz)) for v in lo]
    for k in range(4):
        k2 = (k + 1) % 4
        tb.faces.new((lo[k], lo[k2], hi[k2], hi[k]))
    tb.faces.new(hi)
    b._add(tb, place(at, (0, 0, heading)), mat)


def _ribbon(b, pts, width, hfn, mat, lift=.003):
    """Flat up-facing strip (paths, roads) draped over the heightfield hfn."""
    tb = bmesh.new()
    rows = []
    for i, p in enumerate(pts):
        a, c = Vector(pts[max(i - 1, 0)]), Vector(pts[min(i + 1, len(pts) - 1)])
        t = (c - a)
        t.z = 0
        t.normalize()
        n = Vector((-t.y, t.x, 0)) * width / 2
        rows.append([tb.verts.new((q.x, q.y, hfn(q.x, q.y) + lift)) for q in (Vector(p) - n, Vector(p) + n)])
    for a, c in zip(rows, rows[1:]):
        tb.faces.new((a[0], c[0], c[1], a[1]))
    tb.normal_update()
    if sum(f.normal.z for f in tb.faces) < 0:
        bmesh.ops.reverse_faces(tb, faces=tb.faces)
    b._add(tb, place(), mat)


def _catmull(ctrl, n):
    pts = [Vector((p[0], p[1], p[2] if len(p) > 2 else 0.0)) for p in ctrl]
    pts = [pts[0] * 2 - pts[1]] + pts + [pts[-1] * 2 - pts[-2]]
    out = []
    segs = len(pts) - 3
    for i in range(n + 1):
        u = i / n * segs
        j = min(int(u), segs - 1)
        t = u - j
        p0, p1, p2, p3 = pts[j:j + 4]
        out.append(.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
                         + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t))
    return out


def _hex_dist(x, y, r):
    """0 at centre, 1 on the pointy-top hex outline of circumradius r."""
    ap = r * math.cos(math.radians(30))
    return max(abs(x * math.cos(math.radians(a)) + y * math.sin(math.radians(a))) for a in (0, 60, 120)) / ap


def _terrain(b, r, rings, hfn, mat_fn, skirt='dirt'):
    """Hex heightfield (pointy-top, circumradius r) with a vertical skirt down to z=0. mat_fn(x, y, z, slope)
    picks each facet's material."""
    corners = [polar(r, 30 + 60 * k) for k in range(6)]
    groups = {}
    for s in range(6):
        a = Vector((0, 0, 0))
        bb, cc = Vector(corners[s]), Vector(corners[(s + 1) % 6])

        def P(i, j):
            p = a + (bb - a) * (i / rings) + (cc - bb) * (j / rings)
            return Vector((p.x, p.y, hfn(p.x, p.y)))

        for i in range(rings):
            for j in range(i + 1):
                tris = [(P(i, j), P(i + 1, j), P(i + 1, j + 1))]
                if j < i:
                    tris.append((P(i, j), P(i + 1, j + 1), P(i, j + 1)))
                for tri in tris:
                    n = (tri[1] - tri[0]).cross(tri[2] - tri[0])
                    if n.z < 0:
                        tri = (tri[0], tri[2], tri[1])
                        n = -n
                    c = (tri[0] + tri[1] + tri[2]) / 3
                    slope = 1 - n.normalized().z
                    groups.setdefault(mat_fn(c.x, c.y, c.z, slope), []).append(tri)
        # skirt along the outer edge of this sector
        edge = [P(rings, j) for j in range(rings + 1)]
        for p0, p1 in zip(edge, edge[1:]):
            groups.setdefault(skirt, []).append((p0, Vector((p0.x, p0.y, 0)), Vector((p1.x, p1.y, 0))))
            groups.setdefault(skirt, []).append((p0, Vector((p1.x, p1.y, 0)), p1))
    for mat, tris in groups.items():
        tb = bmesh.new()
        cache = {}

        def V(p):
            key = (round(p.x, 6), round(p.y, 6), round(p.z, 6))
            if key not in cache:
                cache[key] = tb.verts.new(p)
            return cache[key]

        for tri in tris:
            try:
                tb.faces.new([V(p) for p in tri])
            except ValueError:
                pass
        b._add(tb, place(), mat)


# ---------------------------------------------------------------------------------------------- Great Wall

_GW_U = (math.cos(math.radians(32)), math.sin(math.radians(32)))   # screen-horizontal from the hero camera
_GW_V = (-_GW_U[1], _GW_U[0])                                          # screen-depth


def _gw_xy(s, w):
    """(along the screen diagonal, depth) -> xy."""
    return (s * .74 * _GW_U[0] + w * _GW_V[0], s * .74 * _GW_U[1] + w * _GW_V[1])


_GW_HILLS = [(_gw_xy(-.5, .36), .3, .27), (_gw_xy(.46, -.24), .17, .22), (_gw_xy(.12, .56), .13, .22),
             (_gw_xy(-.35, -.45), .05, .2), (_gw_xy(.8, .3), .06, .18)]


def _gw_height(x, y):
    hills = sum(a * math.exp(-((x - c[0]) ** 2 + (y - c[1]) ** 2) / (r * r)) for c, a, r in _GW_HILLS)
    hills += .012 * math.sin(x * 9 + y * 4) * math.cos(y * 7 - x * 3)
    d = _hex_dist(x, y, .82)
    e = min(max((1 - d) / .28, 0), 1)
    e = e * e * (3 - 2 * e)
    return .034 + max(hills, 0) * e


def _gw_tower(b, p, heading, z, s=1.0, roof=False):
    """Square brick watchtower straddling the wall with crenellated top."""
    x, y = p
    with b.xform(place((x, y, z), (0, 0, heading), s)):
        b.box((.1, .1, .19), (0, 0, -.05), 'med_wallbrick', bevel=.004, taper=.88)
        b.box((.1, .1, .012), (0, 0, .14), 'med_wallbrick_dk')
        for sx in (-1, 1):
            for sy in (-1, 1):
                _merlon(b, (.022, .022, .02), (sx * .039, sy * .039, .152), 'med_wallbrick')
            _merlon(b, (.02, .014, .018), (0, sx * .044, .152), 'med_wallbrick')
            _merlon(b, (.014, .02, .018), (sx * .044, 0, .152), 'med_wallbrick')
        for sx in (-1, 1):
            b.box((.012, .004, .022), (sx * .02, -.048, .075), 'med_inset')
        if roof:
            for sx in (-1, 1):
                for sy in (-1, 1):
                    b.cyl(.005, .045, (sx * .026, sy * .026, .152), 'med_lacquer', segs=4)
            _asian_roof(b, .085, .085, .035, (0, 0, .2), curl=.012, flare=.008, ridge=.004, thick=.008, bells=False)


def _gw_gate(b, x, y, z, s=1.0):
    """Chinese gate tower: brick bastion with an arched passage, double-eaved red pavilion on top."""
    with b.xform(place((x, y, z), scale=s)):
        # bastion
        b.box((.32, .17, .03), (0, 0, -.03), 'med_wallbrick_dk', bevel=.004)
        b.box((.3, .155, .15), (0, 0, 0), 'med_wallbrick', bevel=.005, taper=.93)
        b.box((.3, .155, .012), (0, 0, .145), 'med_wallbrick_dk')
        _arch_shape(b, .07, .1, (0, -.074, 0), 'med_inset', t=.004)
        _arch_shape(b, .086, .114, (0, -.072, 0), 'med_wallbrick_dk', t=.002)
        b.box((.06, .004, .012), (0, -.078, .125), 'stone_light')  # name plaque frame
        b.box((.046, .005, .008), (0, -.079, .127), 'gold')
        # parapet merlons around the top
        for k in range(7):
            t = -.13 + k * .0433
            for sy in (-1, 1):
                _merlon(b, (.019, .012, .02), (t, sy * .071, .157), 'med_wallbrick')
        for k in range(2):
            t = -.025 + k * .05
            for sx in (-1, 1):
                _merlon(b, (.012, .018, .02), (sx * .143, t, .157), 'med_wallbrick')
        # pavilion
        zt = .157
        b.box((.23, .11, .012), (0, 0, zt), 'stone_light')
        for i in range(5):
            for sy in (-1, 1):
                b.cyl(.0065, .062, (-.1 + i * .05, sy * .047, zt + .012), 'med_lacquer', segs=4, start=45)
        b.box((.17, .07, .06), (0, 0, zt + .012), 'med_lacquer')
        for i in range(3):
            b.box((.03, .004, .03), (-.05 + i * .05, -.036, zt + .03), 'wood_dark')
        b.box((.22, .1, .008), (0, 0, zt + .074), 'gold')
        _asian_roof(b, .28, .15, .03, (0, 0, zt + .088), curl=.022, flare=.014, ridge=.18, thick=.01)
        b.box((.14, .06, .045), (0, 0, zt + .1), 'med_lacquer')
        for i in range(3):
            b.box((.024, .004, .026), (-.036 + i * .036, -.031, zt + .108), 'wood_dark')
        _asian_roof(b, .22, .115, .075, (0, 0, zt + .155), curl=.026, flare=.016, ridge=.1, thick=.012)
        # lanterns
        for sx in (-1, 1):
            b.cyl(.001, .012, (sx * .06, -.066, zt + .062), 'wood_dark', segs=3)
            b.lathe([(0, 0), (.007, .003), (.009, .01), (.007, .017), (0, .02)], (sx * .06, -.066, zt + .042),
                    'EMISSIVE', segs=6)


def great_wall(b):
    b.overrides['EMISSIVE'] = {'color': '#ff9a3c', 'emit': 3.0}
    hf = _gw_height

    def mat_fn(x, y, z, slope):
        if slope > .36:
            return 'rock'
        return 'med_hill_dark' if (math.sin(x * 23 + y * 7) + math.cos(y * 19 - x * 5)) > .7 or z > .17 \
            else 'med_hill'

    _terrain(b, .82, 8, hf, mat_fn, skirt='dirt')

    # wall centreline: S-curve across the screen diagonal, up the left hill, down to the gate, over the right hill
    ctrl = [(-1, -.1), (-.74, .16), (-.46, .32), (-.2, .09), (0, 0), (.2, -.09), (.46, -.3), (.74, -.2), (1, .06)]
    path = _catmull([_gw_xy(*c) for c in ctrl], 34)
    W, H = .07, .068
    gate_i = 17
    rows = []
    for i, p in enumerate(path):
        a = path[max(i - 1, 0)]
        c = path[min(i + 1, len(path) - 1)]
        t = (c - a).normalized()
        n = Vector((-t.y, t.x, 0))
        g = min(hf(p.x + n.x * W * .5, p.y + n.y * W * .5), hf(p.x - n.x * W * .5, p.y - n.y * W * .5), hf(p.x, p.y))
        rows.append((p, t, n, g))
    # smooth the walkway height a little so it doesn't jitter
    gz = [r[3] for r in rows]
    gz = [(gz[max(i - 1, 0)] + 2 * gz[i] + gz[min(i + 1, len(gz) - 1)]) / 4 for i in range(len(gz))]
    # wall cross-section (offset along n, height above walkway base): battered outer face, parapets, walkway
    prof = [(W / 2 + .006, -.035), (W / 2, H + .014), (W / 2 - .012, H + .014), (W / 2 - .012, H),
            (-W / 2 + .009, H), (-W / 2 + .009, H + .008), (-W / 2, H + .008), (-W / 2 - .006, -.035)]

    def wall(i0, i1):
        tb = bmesh.new()
        vr = []
        for i in range(i0, i1 + 1):
            p, t, n, _ = rows[i]
            vr.append([tb.verts.new(p + n * o + Vector((0, 0, gz[i] + z))) for o, z in prof])
        m = len(prof)
        for a, c in zip(vr, vr[1:]):
            for k in range(m - 1):  # bottom face stays open: it is buried in the hill
                k2 = k + 1
                tb.faces.new((a[k], a[k2], c[k2], c[k]))
        tb.faces.new(vr[0])
        tb.faces.new(list(reversed(vr[-1])))
        bmesh.ops.recalc_face_normals(tb, faces=tb.faces)
        b._add(tb, place(), 'med_wallbrick')

    segs = [(0, gate_i - 3), (gate_i + 3, len(rows) - 1)]
    for i0, i1 in segs:
        wall(i0, i1)
        # merlons on the outer (+n) parapet
        for i in range(i0 + 1, i1):
            p, t, n, _ = rows[i]
            q = p + n * (W / 2 - .005)
            ang = math.degrees(math.atan2(t.y, t.x))
            _merlon(b, (.02, .014, .018), (q.x, q.y, gz[i] + H + .01), 'med_wallbrick', ang)

    # gate tower in the valley, wall runs along X there
    gp, gt, gn, _ = rows[gate_i]
    gate_z = gz[gate_i] - .01
    with b.xform(place((gp.x, gp.y, 0), (0, 0, math.degrees(math.atan2(gt.y, gt.x)) + 8))):
        _gw_gate(b, 0, 0, gate_z, 1.2)
    # dirt road winding from the tile edge up to the gate
    fwd = Vector((gn.x, gn.y, 0)) * -1
    road = [gp + fwd * .09, gp + fwd * .2 + gt * .03, gp + fwd * .34 - gt * .06, gp + fwd * .5 + gt * .01,
            gp + fwd * .64 + gt * .08]
    _ribbon(b, _catmull([tuple(q) for q in road], 14), .055, hf, 'dirt', lift=.009)
    # watchtowers
    for i, s, roof in ((1, .95, False), (8, 1.15, True), (27, 1.05, False)):
        p, t, n, _ = rows[i]
        _gw_tower(b, (p.x, p.y), math.degrees(math.atan2(t.y, t.x)), gz[i] + .01, s, roof)
    # team banners along the wall
    for i in (4, 23, 31):
        p, t, n, _ = rows[i]
        q = p - n * (W / 2 - .006)
        b.flag((q.x, q.y, gz[i] + H), .09, facing=math.degrees(math.atan2(t.y, t.x)) + 180)
    # pines on the slopes, rocks, a road winding up to the gate
    rnd = random.Random(4)
    spots = [_gw_xy(s_, w_) for s_, w_ in ((-.7, .45), (-.3, .55), (-.1, .38), (.35, .55), (.6, .38), (-.42, -.34),
                                          (-.6, -.25), (.72, -.45), (-.9, .3))]
    for k, (x, y) in enumerate(spots):
        s = .7 + rnd.random() * .35
        b.tree_pine((x, y, hf(x, y) - .005), s, leaf='foliage_dark' if k % 3 else 'foliage')
    for k, (x, y) in enumerate((_gw_xy(-.25, -.15), _gw_xy(.15, -.35), _gw_xy(-.45, .12))):
        b.rock((x, y, hf(x, y) - .01), .5 + rnd.random() * .4, seed=k, mat='rock_light')
    for k, (x, y) in enumerate((_gw_xy(-.1, -.2), _gw_xy(.12, -.22), _gw_xy(-.45, -.55), _gw_xy(.5, .12))):
        b.bush((x, y, hf(x, y) - .004), .8, seed=k, mat='foliage')




# ---------------------------------------------------------------------------------------------- Hagia Sophia

def _pencil_minaret(b, x, y, h=.62, r=.022, body='stone_light', cap='lead_roof', base_mat='rose_dark'):
    """Ottoman pencil minaret: square plinth, slender shaft, two sherefe balconies, tall lead cone."""
    b.box((.07, .07, .06), (x, y, .03), base_mat)
    b.cyl(r * 1.1, h * .88, (x, y, .09), body, segs=6, r2=r * .9)
    for zz in (h * .5, h * .74):
        b.cyl(r * 1.1, .016, (x, y, .09 + zz), 'marble_shade', segs=6, r2=r * 1.9)
    zt = .09 + h * .88
    b.cyl(r * 1.15, .012, (x, y, zt), body, segs=6)
    b.cone(r * 1.2, h * .2, (x, y, zt + .012), cap, segs=6)
    b.cone(.006, .04, (x, y, zt + .012 + h * .2 - .006), 'gold', segs=4)


def _fountain(b, x, y, z, s=1.0):
    """Octagonal ablution fountain: basin with water, columns and a little lead dome."""
    with b.xform(place((x, y, z), scale=s)):
        b.cyl(.075, .025, (0, 0, 0), 'marble_shade', segs=8)
        b.water(.066, (0, 0, .014), depth=.012, segs=8)
        b.cyl(.03, .05, (0, 0, .02), 'marble', segs=8)
        for k in range(4):
            px, py, _ = polar(.042, 45 + 90 * k)
            b.cyl(.005, .06, (px, py, .02), 'marble', segs=4)
        b.cyl(.058, .012, (0, 0, .08), 'marble', segs=8, r2=.052)
        b.dome(.05, .035, (0, 0, .092), 'lead_roof', segs=8, rings=2, smooth=False)
        b.cone(.006, .03, (0, 0, .125), 'gold', segs=4)


def hagia_sophia(b):
    b.base_hex(.8, .03, mat='paving', rim='stone_dark')
    z0 = .036
    cy = .06           # centre of the great dome
    # lawn beds + cypress alleys on the plaza
    for sx in (-1, 1):
        b.box((.16, .34, .008), (sx * .54, -.12, z0), 'grass', bevel=.003)
        for k in range(3):
            b.tree_cypress((sx * .54, -.24 + k * .12, z0 + .006), 1.0 + .1 * (k % 2))
    for sx in (-1, 1):
        b.bush((sx * .46, .44, z0), 1.1, seed=3 + sx, mat='foliage')
        b.tree_cypress((sx * .2, .56, z0), .9)
    # lower aisles / galleries
    b.box((.56, .52, .13), (0, cy + .02, z0), 'rose')
    b.box((.58, .54, .012), (0, cy + .02, z0 + .125), 'rose_dark')
    b.hip(.54, .5, .05, (0, cy + .02, z0 + .137), 'lead_roof', ridge=.1)
    # narthex across the front with a lead roof and three doors
    b.box((.46, .08, .1), (0, cy - .29, z0), 'rose', bevel=.004)
    b.hip(.48, .1, .04, (0, cy - .29, z0 + .1), 'lead_roof', ridge=.36)
    for dx in (-.12, 0, .12):
        _arch_shape(b, .045 if dx else .055, .07 if dx else .08, (dx, cy - .33, z0), 'med_inset', t=.003, segs=4)
    # buttress piers flanking the central square
    for sx in (-1, 1):
        for dy in (-.13, .13):
            b.box((.07, .09, .27), (sx * .205, cy + dy, z0), 'rose_dark', taper=.86)
            b.hip(.07, .09, .03, (sx * .205, cy + dy, z0 + .27), 'lead_roof', ridge=.02)
    # central square tower with tympanum walls (window grids) on the sides
    zt = z0 + .3
    b.box((.34, .34, .3), (0, cy, z0), 'rose')
    b.box((.36, .36, .014), (0, cy, zt - .014), 'rose_dark')
    for sx in (-1, 1):
        with b.xform(place((sx * .171, cy, z0 + .17), (0, 0, 90 if sx > 0 else -90))):
            for k in range(4):
                _arch_shape(b, .026, .05, (-.075 + k * .05, 0, 0), 'med_inset', t=.004, segs=2)
            for k in range(3):
                _arch_shape(b, .02, .034, (-.05 + k * .05, 0, .07), 'med_inset', t=.004, segs=2)
    # semi-domes cascading front and back
    for side, start in ((-1, 180), (1, 0)):
        yy = cy + side * .17
        b.lathe([(0, 0), (.15, 0), (.15, .15), (0, .15)], (0, yy, z0), 'rose', segs=10, start=start, arc=180)
        b.lathe([(.157, 0), (.157, .012), (0, .012)], (0, yy, z0 + .15), 'rose_dark', segs=10, start=start,
                arc=180)
        b.lathe([(.15, 0), (.136, .036), (.1, .062), (.05, .076), (0, .08)], (0, yy, z0 + .162), 'lead_roof',
                segs=10, start=start, arc=180)
        # window arcade in the semi-dome wall
        for k in range(5):
            a = start + 18 + 36 * k
            px, py, _ = polar(.15, a)
            _arch_shape(b, .024, .042, (px, yy + py, z0 + .095), 'med_inset', t=.004, rot=a + 90, segs=2)
        # exedrae: smaller domed half-drums on the diagonals
        for sx in (-1, 1):
            ex, ey = sx * .1, yy + side * .085
            b.cyl(.07, .12, (ex, ey, z0), 'rose', segs=8)
            b.dome(.073, .045, (ex, ey, z0 + .12), 'lead_roof', segs=8, rings=2, smooth=False)
    # great dome: window drum between buttress ribs, shallow ribbed lead dome, gold crescent finial
    b.cyl(.19, .034, (0, cy, zt), 'med_inset', segs=20, start=0)
    for k in range(20):
        px, py, _ = polar(.187, 9 + 18 * k)
        _merlon(b, (.024, .018, .038), (px, cy + py, zt), 'rose', 9 + 18 * k)
    b.cyl(.2, .012, (0, cy, zt + .034), 'rose_dark', segs=20)
    b.lathe([(.195, 0), (.186, .036), (.16, .072), (.114, .1), (.06, .116), (0, .121)],
            (0, cy, zt + .046), 'lead_roof', segs=20, start=0)
    b.cyl(.013, .014, (0, cy, zt + .163), 'lead_roof', segs=6)
    b.cyl(.0035, .03, (0, cy, zt + .175), 'gold', segs=4)
    b.tube([(.015, cy, zt + .225), (.02, cy, zt + .208), (.013, cy, zt + .195), (0, cy, zt + .192),
            (-.013, cy, zt + .197)], [.0035, .005, .006, .005, .003], 'gold', segs=4)
    # four pencil minarets
    for sx, yy, h in ((-1, -.3, .58), (1, -.3, .58), (-1, .42, .62), (1, .42, .62)):
        _pencil_minaret(b, sx * .38, yy, h)
    # plaza: processional walk, flower beds, ablution fountain, banners
    b.box((.14, .42, .006), (0, -.5, z0), 'stone_light')
    for sx in (-1, 1):
        b.box((.1, .16, .01), (sx * .14, -.56, z0), 'grass', bevel=.003)
        for k in range(3):
            b.bush((sx * .14, -.62 + k * .06, z0 + .004), .42, seed=k + (sx > 0) * 3,
                   mat='flower_r' if (k + (sx > 0)) % 2 else 'flower_y')
    _fountain(b, .34, -.48, z0, 1.1)
    b.flag((-.08, -.36, z0), .17, facing=200)
    b.flag((.08, -.36, z0), .17, facing=200)
    for k, (x, y) in enumerate(((-.36, -.54), (-.6, .2), (.62, .22))):
        b.bush((x, y, z0), .9, seed=k, mat='foliage_light')



# ---------------------------------------------------------------------------------------------- Angkor Wat

def _lotus_tower(b, x, y, z, h, r, mat='med_khmer', tip='moss_stone', tiers=5, segs=8):
    """Khmer prasat: square plinth, sanctuary body with doors, stacked tiers swelling then tapering to a bud."""
    b.cyl(r * 1.45, h * .08, (x, y, z), 'med_khmer_dk', segs=4, start=45)
    zb = z + h * .08
    body = h * .26
    b.cyl(r * 1.2, body, (x, y, zb), mat, segs=4, start=45, r2=r * 1.12)
    for k in range(4):
        a = 90 * k - 90
        px, py, _ = polar(r * .86, a)
        _arch_shape(b, r * .55, body * .7, (x + px, y + py, zb), 'med_inset', t=.002, rot=a + 90, segs=2,
                    pointed=.4)
    z1 = zb + body
    hb = h - (z1 - z)
    env = lambda t: r * (1 - t) ** .6 * (1 + .95 * t)  # noqa: E731
    prof = [(0, 0), (r * 1.25, 0), (r * 1.25, hb * .03)]
    for i in range(tiers):
        t0, t1 = i / tiers * .86, (i + 1) / tiers * .86
        z0_, z1_ = hb * (.03 + t0), hb * (.03 + t1)
        prof += [(env(t0) * 1.14, z0_ + hb * .012), (env(t0) * 1.1, z0_ + hb * .05), (env(t1) * .93, z1_)]
    prof += [(env(.9) * .85, hb * .9)]
    b.lathe(prof, (x, y, z1), mat, segs=segs, start=180 / segs)
    b.cone(env(.9) * .86, hb * .2, (x, y, z1 + hb * .9), tip, segs=segs, start=180 / segs)


def _naga(b, x, y0, y1, z, side):
    """Naga serpent balustrade along a causeway with a fanned multi-headed hood rearing at the front."""
    b.tube([(x, y1, z), (x, y0 + .03, z), (x, y0 + .008, z + .01), (x, y0, z + .03)],
           [.0065, .0065, .0065, .007], 'stone', segs=5)
    for k in range(2):
        b.box((.008, .008, .025), (x, y0 + .06 + k * (y1 - y0 - .08), z - .025), 'stone_dark')
    fan = [(0, 0)] + [(math.cos(math.radians(a)) * .028, math.sin(math.radians(a)) * .032 + .01)
                      for a in range(10, 171, 32)]
    with b.xform(place((x, y0 - .002, z + .022), (0, 0, 0))):
        b.prism([(px, pz) for px, pz in fan], .008, (0, .004, 0), 'stone', rot=(90, 0, 0))


def angkor_wat(b):
    b.base_hex(.8, .03, mat='grass', rim='laterite')
    z0 = .036
    # moat across the front with a laterite coping and the causeway + naga balustrades crossing it
    moat = [(-.52, -.36), (-.32, -.52), (0, -.585), (.32, -.52), (.52, -.36)]
    b.prism([(-.55, -.34), (-.34, -.545), (0, -.615), (.34, -.545), (.55, -.34)], .006, (0, 0, z0 - .004),
            'stone_dark')
    b.water(moat, (0, 0, z0 - .002), depth=.01)
    for k, (x, y) in enumerate(((-.3, -.45), (.25, -.47), (-.1, -.52))):
        b.cyl(.018, .004, (x, y, z0 + .008), 'foliage_light', segs=6)  # lily pads
    b.box((.08, .44, .02), (0, -.5, z0), 'stone', bevel=.003)
    for sx in (-1, 1):
        _naga(b, sx * .045, -.68, -.3, z0 + .03, sx)
    # outer gallery enclosure with a gopura gate
    ex, ey0, ey1 = .44, -.29, .42
    gw = .05

    def gallery(x0, y0, x1, y1):
        cx, cy, L = (x0 + x1) / 2, (y0 + y1) / 2, math.hypot(x1 - x0, y1 - y0)
        rot = 0 if abs(y1 - y0) < 1e-6 else 90
        b.box((L, gw, .05), (cx, cy, z0), 'laterite', rot=(0, 0, rot))
        b.box((L + .006, gw + .01, .006), (cx, cy, z0 + .05), 'moss_stone', rot=(0, 0, rot))
        b.gable(L + .004, gw + .004, .03, (cx, cy, z0 + .056), 'stone_dark', rot=(0, 0, rot), overhang=.004)

    gallery(-ex, ey0, -.08, ey0)
    gallery(.08, ey0, ex, ey0)
    gallery(-ex, ey1, ex, ey1)
    gallery(-ex, ey0 + gw / 2, -ex, ey1 - gw / 2)
    gallery(ex, ey0 + gw / 2, ex, ey1 - gw / 2)
    for sx in (-1, 1):
        for yy in (ey0, ey1):
            b.box((.07, .07, .07), (sx * ex, yy, z0), 'laterite')
            b.hip(.08, .08, .04, (sx * ex, yy, z0 + .07), 'stone_dark')
    b.box((.16, .08, .08), (0, ey0, z0), 'laterite')
    _arch_shape(b, .04, .06, (0, ey0 - .04, z0), 'med_inset', t=.002, segs=2, pointed=.4)
    _lotus_tower(b, 0, ey0, z0 + .08, .16, .036, tiers=3, segs=6)
    # stepped terraces
    cy = .08
    tiers = [(.62, .5, .05), (.44, .38, .06), (.22, .22, .08)]
    z = z0
    for i, (w, d, h) in enumerate(tiers):
        b.box((w, d, h), (0, cy, z), 'laterite', taper=.94)
        b.box((w + .01, d + .01, .008), (0, cy, z + h - .004), 'moss_stone')
        b.stairs(.06 - i * .01, .05, h, 4, (0, cy - d / 2 - .045, z), 'stone')
        z += h
    z2 = z0 + tiers[0][2] + tiers[1][2]
    # galleries around the second terrace linking the corner towers
    w2, d2 = tiers[1][0] / 2 - .02, tiers[1][1] / 2 - .02
    for (x0, y0, x1, y1) in ((-w2, -d2, w2, -d2), (-w2, d2, w2, d2), (-w2, -d2, -w2, d2), (w2, -d2, w2, d2)):
        cx, cyy, L = (x0 + x1) / 2, cy + (y0 + y1) / 2, math.hypot(x1 - x0, y1 - y0)
        rot = 0 if abs(y1 - y0) < 1e-6 else 90
        if rot == 0 and y0 < 0:
            for sx in (-1, 1):
                b.box((L / 2 - .04, .035, .04), (sx * (L / 4 + .02), cyy, z2), 'laterite')
                b.gable(L / 2 - .036, .04, .022, (sx * (L / 4 + .02), cyy, z2 + .04), 'stone_dark')
            continue
        b.box((L, .035, .04), (cx, cyy, z2), 'laterite', rot=(0, 0, rot))
        b.gable(L + .004, .04, .022, (cx, cyy, z2 + .04), 'stone_dark', rot=(0, 0, rot))
    # five lotus-bud towers in quincunx
    for sx in (-1, 1):
        for dy in (-1, 1):
            _lotus_tower(b, sx * w2, cy + dy * d2, z2, .3, .05, tiers=4)
    _lotus_tower(b, 0, cy, z2 + tiers[2][2], .5, .075)
    # jungle
    rnd = random.Random(11)
    for k, (x, y) in enumerate(((-.58, -.2), (-.6, .06), (-.55, .3), (.58, -.18), (.6, .1), (.56, .32),
                                (-.3, .52), (.28, .52))):
        if k % 3 == 1:
            b.tree_round((x, y, z0), 1.1 + rnd.random() * .3, seed=k, leaf='foliage_dark', leaf2='foliage')
        else:
            b.tree_palm((x, y, z0), .8 + rnd.random() * .25, seed=k)
    for k, (x, y) in enumerate(((-.62, -.3), (.62, -.28), (-.5, .42), (.1, .6), (-.12, .6))):
        b.bush((x, y, z0), 1.2, seed=k, mat='foliage' if k % 2 else 'foliage_light')
    # team banners at the causeway head
    for sx in (-1, 1):
        b.flag((sx * .09, -.7, z0), .15, facing=200 if sx < 0 else 340)



# ---------------------------------------------------------------------------------------------- Taj Mahal

def _chamfer_pts(w, d, c):
    """CCW rectangle w x d with chamfered corners of size c."""
    hw, hd = w / 2, d / 2
    return [(-hw + c, -hd), (hw - c, -hd), (hw, -hd + c), (hw, hd - c), (hw - c, hd), (-hw + c, hd), (-hw, hd - c),
            (-hw, -hd + c)]


def _chhatri(b, x, y, z, r=.03, h=.04, mat='marble', dome='marble', segs=6):
    """Mughal kiosk: base, four slender posts, overhanging chajja slab, little onion dome, gold finial."""
    for k in range(4):
        px, py, _ = polar(r * .75, 45 + 90 * k)
        _merlon(b, (r * .2, r * .2, h * .56), (x + px, y + py, z + h * .15), mat)
    b.cyl(r * 1.25, h * .1, (x, y, z + h * .7), mat, segs=segs, r2=r * 1.05)
    b.lathe([(r * .95, 0), (r * 1.08, h * .3), (r * .8, h * .6), (r * .2, h * .85), (0, h * .95)], (x, y, z + h * .8),
            dome, segs=segs, smooth=True)
    b.cone(r * .12, h * .35, (x, y, z + h * 1.7), 'gold', segs=4)


def _taj_minaret(b, x, y, z, h=.42, r=.024):
    b.cyl(r * 1.5, .02, (x, y, z), 'marble_shade', segs=6)
    zz = z + .02
    for k, (seg, rr) in enumerate(((.36, 1.0), (.32, .92), (.32, .86))):
        hh = h * .8 * seg
        b.cyl(r * rr, hh, (x, y, zz), 'marble', segs=6, r2=r * rr * .96)
        zz += hh
        b.cyl(r * rr, .012, (x, y, zz), 'marble_shade', segs=6, r2=r * rr * 1.75)
        zz += .012
    _chhatri(b, x, y, zz, r * 1.35, h * .13)


def taj_mahal(b):
    b.base_hex(.8, .03, mat='grass', rim='sandstone_dark')
    z0 = .036
    cy = .2
    # charbagh: marble walks, a long reflecting pool, lotus fountain basin, cypress alleys, flower beds
    b.box((.24, .6, .008), (0, -.36, z0), 'marble_shade')
    b.box((.13, .56, .004), (0, -.36, z0 + .008), 'marble')
    b.water([(-.048, -.62), (.048, -.62), (.048, -.1), (-.048, -.1)], (0, 0, z0 + .006), depth=.008)
    b.box((.7, .07, .008), (0, -.36, z0), 'marble_shade')
    b.cyl(.068, .02, (0, -.36, z0), 'marble', segs=8)
    b.water(.056, (0, -.36, z0 + .012), depth=.01, segs=8)
    b.cyl(.012, .03, (0, -.36, z0 + .02), 'marble', segs=6)
    for sx in (-1, 1):
        for k in range(5):
            yy = -.6 + k * .12
            if abs(yy + .36) < .05:
                continue
            b.tree_cypress((sx * .096, yy, z0 + .008), .7)
        for yy in (-.52, -.2):
            b.box((.2, .1, .006), (sx * .22, yy, z0), 'grass_dark')
            for dx in (-.05, .05):
                b.bush((sx * .22 + dx, yy, z0 + .004), .45, seed=int(yy * 10) + sx,
                       mat='blossom' if (sx < 0) == (dx < 0) else 'flower_y')
    # shade trees framing the terrace
    for k, (x, y) in enumerate(((-.48, .1), (-.44, .36), (.48, .1), (.44, .36))):
        b.tree_round((x, y, z0), 1.05 + .1 * (k % 2), seed=k + 5, leaf='foliage', leaf2='foliage_light')
    # white marble plinth with blind arcade
    ps = .52
    b.box((ps + .02, ps + .02, .012), (0, cy, z0), 'marble_shade')
    b.box((ps, ps, .05), (0, cy, z0 + .012), 'marble', bevel=.003)
    for k in range(7):
        _arch_shape(b, .03, .034, (-.18 + k * .06, cy - ps / 2, z0 + .014), 'marble_shade', t=.002, segs=2,
                    pointed=.5)
    b.stairs(.08, .06, .06, 5, (0, cy - ps / 2 - .06, z0), 'marble')
    zp = z0 + .062
    # mausoleum: chamfered block, pishtaq iwans, parapet
    mw, mh = .3, .2
    b.prism(_chamfer_pts(mw, mw, .06), mh, (0, cy, zp), 'marble')
    b.prism(_chamfer_pts(mw + .012, mw + .012, .064), .012, (0, cy, zp + mh), 'marble_shade')
    for a in (0, 90, 180, 270):
        with b.xform(place((0, cy, zp), (0, 0, a))):
            b.box((.15, .02, mh + .045), (0, -mw / 2, 0), 'marble')
            b.box((.16, .026, .01), (0, -mw / 2, mh + .045), 'marble_shade')
            _arch_shape(b, .104, .19, (0, -mw / 2 - .01, 0), 'marble_shade', t=.002, segs=5, pointed=.5)
            _arch_shape(b, .08, .165, (0, -mw / 2 - .01, 0), 'med_inset', t=.003, segs=5, pointed=.5)
            for sx in (-1, 1):
                x = sx * .1
                for zz, hh in ((.01, .08), (.105, .07)):
                    _arch_shape(b, .028, hh, (x, -mw / 2 + .0, zz), 'med_inset', t=.002, segs=2, pointed=.5)
            # chamfered-corner bays
            with b.xform(place((mw / 2 - .03, -mw / 2 + .03, 0), (0, 0, 45))):
                for zz, hh in ((.01, .08), (.105, .07)):
                    _arch_shape(b, .03, hh, (0, -.0005, zz), 'med_inset', t=.002, segs=2, pointed=.5)
    zr = zp + mh + .012
    # drum + great onion dome + finial
    b.cyl(.095, .06, (0, cy, zr), 'marble', segs=16)
    b.cyl(.1, .01, (0, cy, zr + .055), 'marble_shade', segs=16)
    dome = [(.095, 0), (.122, .03), (.142, .075), (.138, .12), (.11, .165), (.068, .2), (.03, .225), (.012, .24),
            (0, .245)]
    b.lathe(dome, (0, cy, zr + .065), 'marble', segs=18, smooth=True)
    b.cyl(.012, .012, (0, cy, zr + .304), 'gold', segs=6)
    b.lathe([(0, 0), (.011, .006), (.004, .016), (.009, .026), (.003, .036), (.0035, .06), (0, .075)],
            (0, cy, zr + .316), 'gold', segs=6)
    # four chhatris around the dome
    for sx in (-1, 1):
        for sy in (-1, 1):
            _chhatri(b, sx * .105, cy + sy * .105, zr, .036, .075)
    # minarets at the plinth corners, leaning very slightly outward like the real ones
    for sx in (-1, 1):
        for sy in (-1, 1):
            _taj_minaret(b, sx * (ps / 2 - .03), cy + sy * (ps / 2 - .03), zp, .44)
    # team banners at the garden entrance
    for sx in (-1, 1):
        b.flag((sx * .13, -.64, z0), .14, facing=200 if sx < 0 else 340)



# ---------------------------------------------------------------------------------------------- Leaning Tower of Pisa

def _post(b, x, y, z, w, h, mat, heading=0.0):
    """Capless square column (8 tris) standing between a floor and a cornice."""
    tb = bmesh.new()
    lo = [tb.verts.new(p) for p in ((-w / 2, -w / 2, 0), (w / 2, -w / 2, 0), (w / 2, w / 2, 0), (-w / 2, w / 2, 0))]
    hi = [tb.verts.new((v.co.x, v.co.y, h)) for v in lo]
    for k in range(4):
        k2 = (k + 1) % 4
        tb.faces.new((lo[k], lo[k2], hi[k2], hi[k]))
    b._add(tb, place((x, y, z), (0, 0, heading)), mat)


def _pisa_tower(b):
    """Campanile in local space (upright, origin at its foot): base storey, six loggia galleries, bell chamber."""
    segs = 16
    b.cyl(.105, .02, (0, 0, 0), 'marble_shade', segs=segs)
    z = .02
    # ground storey: blind arcade
    b.cyl(.086, .12, (0, 0, z), 'marble', segs=segs)
    for k in range(8):
        a = 22.5 * (2 * k + 1)
        px, py, _ = polar(.0855, a)
        _arch_shape(b, .026, .085, (px, py, z + .012), 'med_arcade', t=.001, rot=a + 90, segs=2)
    z += .12
    b.cyl(.094, .012, (0, 0, z), 'marble', segs=segs)
    z += .012
    lvl = .08
    for i in range(6):
        b.cyl(.068, lvl, (0, 0, z), 'med_arcade', segs=10)
        for k in range(14):
            a = 360 / 14 * (k + .5 * (i % 2))
            px, py, _ = polar(.083, a)
            _post(b, px, py, z, .0085, lvl - .006, 'marble', heading=a)
        b.cyl(.092, .006, (0, 0, z + lvl - .006), 'marble', segs=segs, r2=.094)
        b.cyl(.094, .006, (0, 0, z + lvl), 'marble_shade', segs=segs)
        z += lvl + .006
    # bell chamber
    b.cyl(.062, .07, (0, 0, z), 'marble', segs=12)
    for k in range(6):
        a = 60 * k + 30
        px, py, _ = polar(.0615, a)
        _arch_shape(b, .022, .045, (px, py, z + .012), 'med_inset', t=.001, rot=a + 90, segs=2)
    z += .07
    b.cyl(.068, .008, (0, 0, z), 'marble_shade', segs=12)
    z += .008
    b.cyl(.03, .012, (0, 0, z), 'marble', segs=8)
    return z + .012


def _pisa_duomo(b, x, y, z):
    """Partial Pisa cathedral: striped nave + aisles, transept, elliptical crossing dome, loggia facade."""
    with b.xform(place((x, y, z))):
        L, W, H = .46, .15, .15
        b.box((W, L, H), (0, L / 2, 0), 'marble')
        b.gable(L, W + .01, .05, (0, L / 2, H), 'lead_roof', rot=(0, 0, 90), overhang=.005)
        for zz in (.04, .09):
            b.box((W + .004, L - .02, .008), (0, L / 2 + .01, zz), 'granite')
        for sx in (-1, 1):
            b.box((.06, L - .04, .095), (sx * (W / 2 + .03), L / 2 + .02, 0), 'marble')
            b.box((.075, L - .03, .008), (sx * (W / 2 + .032), L / 2 + .02, .1), 'lead_roof', rot=(0, 16 * sx, 0))
            for k in range(5):
                _arch_shape(b, .016, .04, (sx * (W / 2 + .061), .08 + k * .075, .03), 'med_inset', t=.001,
                            rot=90 * sx, segs=2)
        # transept + crossing dome
        ty = L * .62
        b.box((.42, .11, .13), (0, ty, 0), 'marble')
        b.gable(.42, .12, .045, (0, ty, .13), 'lead_roof', overhang=.004)
        b.cyl(.058, .05, (0, ty, H + .02), 'marble', segs=12)
        b.cyl(.062, .008, (0, ty, H + .07), 'marble_shade', segs=12)
        b.lathe([(.06, 0), (.056, .025), (.04, .05), (.018, .062), (0, .064)], (0, ty, H + .078), 'lead_roof',
                segs=12, smooth=True)
        b.cyl(.009, .018, (0, ty, H + .14), 'marble', segs=6)
        b.cone(.004, .02, (0, ty, H + .158), 'gold', segs=4)
        # facade: taller screen, four loggia tiers, pediment, gold statue finials
        b.box((W + .13, .025, H + .01), (0, -.005, 0), 'marble')
        b.prism([(-.075, 0), (.075, 0), (0, .05)], .025, (0, .0075, H + .01), 'marble', rot=(90, 0, 0))
        for k in range(5):
            _arch_shape(b, .03, .075, (-.1 + k * .05, -.018, 0), 'med_arcade' if k != 2 else 'med_inset', t=.001,
                        segs=3)
        for row, (zz, n) in enumerate(((.09, 9), (.125, 7))):
            span = W + .1 - row * .06
            for k in range(n):
                _post(b, -span / 2 + span * k / (n - 1), -.02, zz, .006, .028, 'marble_shade')
            b.box((span + .012, .01, .005), (0, -.02, zz + .028), 'marble_shade')
        for px, pz in ((0, H + .06), (-.14, H + .01), (.14, H + .01)):
            b.cone(.006, .03, (px, -.005, pz), 'gold', segs=4)


def leaning_tower(b):
    b.base_hex(.8, .03, mat='grass', rim='stone_light')
    z0 = .036
    # white gravel walks across the Campo dei Miracoli
    b.box((.11, .4, .005), (-.28, -.4, z0), 'paving')
    b.box((.5, .08, .005), (-.05, -.3, z0), 'paving')
    b.cyl(.15, .005, (.24, -.14, z0), 'paving', segs=16)
    b.box((.08, .3, .005), (.24, -.42, z0), 'paving')
    b.box((.07, .3, .005), (.38, .12, z0), 'paving', rot=(0, 0, -25))
    # baptistery at the back-right: round drum, gallery ring, peaked dome
    bx, by = .44, .34
    b.cyl(.1, .016, (bx, by, z0), 'marble_shade', segs=16)
    b.cyl(.09, .07, (bx, by, z0 + .016), 'marble', segs=16)
    for k in range(8):
        a = 22.5 + 45 * k
        px, py, _ = polar(.089, a)
        _arch_shape(b, .02, .05, (bx + px, by + py, z0 + .02), 'med_arcade', t=.001, rot=a + 90, segs=2)
    b.cyl(.094, .008, (bx, by, z0 + .086), 'marble_shade', segs=16)
    b.cyl(.08, .04, (bx, by, z0 + .094), 'marble', segs=16, r2=.076)
    b.lathe([(.07, 0), (.06, .04), (.036, .07), (.014, .094), (0, .1)], (bx, by, z0 + .134), 'lead_roof',
            segs=16, smooth=True)
    b.cyl(.01, .014, (bx, by, z0 + .224), 'marble', segs=6)
    b.cone(.005, .022, (bx, by, z0 + .238), 'gold', segs=4)
    # cathedral in the back-left
    _pisa_duomo(b, -.28, -.12, z0)
    # the tower: hero, leaning ~7 degrees towards screen-right
    tx, ty = .24, -.14
    with b.xform(T(tx, ty, z0) @ R(0, 0, 32) @ R(0, 7, 0) @ R(0, 0, -32)):
        top = _pisa_tower(b)
        b.flag((0, 0, top), .06, facing=-40)
    # cypresses and umbrella pines along the lawn edge, a few tourists' benches
    for k, (x, y) in enumerate(((.62, .06), (.12, .52), (.2, .3))):
        b.tree_round((x, y, z0), 1.0 + .15 * (k % 2), seed=k, leaf='foliage', leaf2='foliage_light')
    for k, (x, y) in enumerate(((.58, -.28), (.5, -.42), (-.6, -.12), (-.62, .12))):
        b.tree_cypress((x, y, z0), .95)
    for k, (x, y) in enumerate(((.06, .12), (.42, .14), (-.06, -.52))):
        b.bush((x, y, z0), .9, seed=k, mat='foliage_light')
    b.flag((-.2, -.62, z0), .14, facing=200)



# ---------------------------------------------------------------------------------------------- Himeji Castle

def _chidori(b, x, y, z, w, h, depth=.07, face=0.0, roof='med_kawara'):
    """Chidori-hafu: triangular gable dormer with a white plaster tympanum, facing `face` degrees from -Y."""
    with b.xform(place((x, y, z), (0, 0, face))):
        b.gable(depth, w, h, (0, depth / 2, 0), roof, rot=(0, 0, 90), overhang=.006)
        b.decal([(-w / 2 + .004, .004), (w / 2 - .004, .004), (0, h - .01)], (0, -.0075, 0), 'white_plaster',
                rot=(90, 0, 0))
        b.box((.006, .004, .008), (0, -.008, h - .004), 'gold')


def _windows(b, cx, cy, z, w, d, n_front, n_side, hw=.014, hh=.016):
    for a, span, n, off in ((0, w, n_front, d / 2), (180, w, n_front, d / 2), (90, d, n_side, w / 2),
                            (270, d, n_side, w / 2)):
        with b.xform(place((cx, cy, z), (0, 0, a))):
            for k in range(n):
                x = -span / 2 + span * (k + .5) / n
                b.decal([(-hw / 2, 0), (hw / 2, 0), (hw / 2, hh), (-hw / 2, hh)], (x, -off - .001, 0), 'black',
                        rot=(90, 0, 0))


def _jp_keep(b, cx, cy, z, tiers, roof='med_kawara', top_orn=True, gables=None):
    """Stack of white plaster storeys, each capped by a flared tile roof. tiers = [(w, d, wall_h, roof_h), ...].
    gables = {tier_index: [(side_deg, offset_along, width, height), ...]}. Returns the top z."""
    gables = gables or {}
    for i, (w, d, wh, rh) in enumerate(tiers):
        last = i == len(tiers) - 1
        b.box((w, d, wh + .01), (cx, cy, z - .01), 'white_plaster')
        b.box((w + .004, d + .004, .005), (cx, cy, z + wh * .3), 'wood_dark')
        _windows(b, cx, cy, z + wh * .45, w, d, 3 if w > .16 else 2, 2)
        ze = z + wh
        ov = .028 if i == 0 else .024
        _asian_roof(b, w + ov * 2, d + ov * 2, rh, (cx, cy, ze), mat=roof, curl=.014, flare=.008,
                    ridge=max(w - d, .0) + (.03 if last else .01), thick=.008, ornament='gold' if last and top_orn
                    else None, bells=False)
        for side, off, gw, gh in gables.get(i, ()):
            ext = (d if side in (0, 180) else w) / 2 + ov
            px, py, _ = polar(ext - .045, side - 90)
            ox, oy, _ = polar(off, side)
            b_z = ze + rh * .12
            _chidori(b, cx + px + ox, cy + py + oy, b_z, gw, gh, depth=.09, face=side, roof=roof)
        z = ze + rh * .5
    return ze + rh


def _battered_base(b, cx, cy, w, d, h, mat='stone_dark'):
    """Curved, outward-flaring stone base (musha-gaeshi)."""
    r = w / 2 * math.sqrt(2)
    prof = [(0, 0), (r * 1.1, 0), (r * 1.045, h * .3), (r * 1.01, h * .65), (r, h), (0, h)]
    b.lathe(prof, (cx, cy, 0), mat, segs=4, start=45, scale=(1, d / w, 1))


def himeji(b):
    PALETTE.setdefault('med_sakura_lt', ('#c77b2c', .85, 0))
    b.base_hex(.8, .03, mat='grass', rim='stone_dark')
    z0 = .036
    # gravel courtyard + stepped approach
    b.prism([(.02, -.7), (.14, -.7), (.14, -.24), (.02, -.24)], .005, (0, 0, z0), 'stone_light')
    b.prism([(-.3, -.26), (.34, -.26), (.3, -.08), (-.26, -.08)], .005, (0, 0, z0), 'stone_light')
    # main keep on its tall battered base
    kx, ky = .04, .14
    _battered_base(b, kx, ky, .37, .31, .16)
    _jp_keep(b, kx, ky, .16, [(.3, .25, .1, .04), (.26, .21, .085, .036), (.22, .18, .078, .033),
                              (.18, .15, .07, .031), (.14, .12, .068, .06)],
             gables={0: [(0, -.08, .09, .045), (0, .08, .09, .045), (90, 0, .1, .05)],
                     1: [(0, 0, .13, .06)],
                     2: [(90, 0, .09, .045), (0, 0, .08, .04)],
                     3: [(0, 0, .1, .05)],
                     4: [(0, 0, .075, .04)]})
    # secondary keeps linked by roofed plaster galleries
    for (sx, sy, s) in ((-.34, .28, .7), (-.3, -.06, .62)):
        k = s / .7
        _battered_base(b, sx, sy, .2 * k, .18 * k, .09)
        _jp_keep(b, sx, sy, z0 + .09, [(.17 * k, .15 * k, .06, .034), (.13 * k, .11 * k, .055, .05)],
                 gables={0: [(0, 0, .07, .035)]})
    for (x0, y0, x1, y1) in ((-.28, .26, -.12, .2), (-.3, .02, -.32, .2), (-.24, -.08, -.12, .06)):
        cx, cy, L = (x0 + x1) / 2, (y0 + y1) / 2, math.hypot(x1 - x0, y1 - y0)
        a = math.degrees(math.atan2(y1 - y0, x1 - x0))
        b.box((L, .07, .08), (cx, cy, z0), 'stone_dark', rot=(0, 0, a), taper=.9)
        b.box((L, .05, .04), (cx, cy, z0 + .08), 'white_plaster', rot=(0, 0, a))
        with b.xform(place((cx, cy, z0 + .12), (0, 0, a))):
            _asian_roof(b, L + .02, .075, .03, (0, 0, 0), mat='med_kawara', curl=.008, flare=.004, ridge=L - .04,
                        thick=.006, ornament=None, bells=False)
    # white dobei walls with dark tile copings zig-zagging across the front, and a gate
    wall = [(-.6, .12), (-.5, -.22), (-.2, -.34), (-.02, -.3)]
    for (x0, y0), (x1, y1) in zip(wall, wall[1:]):
        cx, cy, L = (x0 + x1) / 2, (y0 + y1) / 2, math.hypot(x1 - x0, y1 - y0)
        a = math.degrees(math.atan2(y1 - y0, x1 - x0))
        b.box((L + .02, .022, .045), (cx, cy, z0), 'white_plaster', rot=(0, 0, a))
        b.box((L + .02, .024, .008), (cx, cy, z0), 'stone_dark', rot=(0, 0, a))
        b.gable(L + .03, .04, .016, (cx, cy, z0 + .045), 'med_kawara', rot=(0, 0, a))
    # gate (yagura-mon) at the end of the wall
    gx, gy = .08, -.3
    for sx in (-1, 1):
        b.box((.03, .04, .08), (gx + sx * .05, gy, z0), 'stone_dark')
    b.box((.14, .05, .045), (gx, gy, z0 + .08), 'white_plaster')
    b.box((.07, .01, .06), (gx, gy, z0), 'wood_dark')
    _asian_roof(b, .17, .08, .035, (gx, gy, z0 + .125), mat='med_kawara', curl=.01, flare=.006, ridge=.1, thick=.006,
                ornament='gold', bells=False)
    b.flag((gx - .1, gy - .04, z0), .15, facing=200)
    b.flag((gx + .1, gy - .04, z0), .15, facing=340)
    # cherry blossoms
    rnd = random.Random(8)
    for k, (x, y) in enumerate(((-.16, -.5), (.34, -.46), (.52, -.16), (.56, .16), (-.44, -.36), (.44, .42),
                                (-.12, .54), (-.34, -.56))):
        b.tree_round((x, y, z0), .85 + rnd.random() * .25, seed=k, leaf='blossom', leaf2='med_sakura_lt')
    for k, (x, y) in enumerate(((.4, -.3), (-.56, .3), (.3, .5))):
        b.tree_pine((x, y, z0), .8, leaf='foliage_dark')
    for k, (x, y) in enumerate(((-.2, -.42), (.12, -.44))):
        b.bush((x, y, z0), .8, seed=k, mat='foliage')


MODELS = {
    'w_great_wall': great_wall,
    'w_hagia_sophia': hagia_sophia,
    'w_angkor_wat': angkor_wat,
    'w_taj_mahal': taj_mahal,
    'w_leaning_tower': leaning_tower,
    'w_himeji': himeji,
}
