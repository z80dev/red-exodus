"""AEONS wonders — Modern: big_ben, eiffel, liberty, opera_house, cristo, launch_pad.

Blender Z-up, front faces -Y. Every builder receives a wonders_lib.Builder `b`.
"""
import math
import random

import bmesh
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

from wonders_lib import PALETTE, place, polar

PALETTE.setdefault('mod_asphalt', ('#55585f', .88, 0))
PALETTE.setdefault('mod_soapstone', ('#ece7dc', .8, 0))       # Cristo Redentor
PALETTE.setdefault('mod_ferry', ('#2f6b47', .8, 0))           # Sydney ferry green
PALETTE.setdefault('mod_cream', ('#f1e2b8', .8, 0))
PALETTE.setdefault('mod_podium', ('#c49a84', .86, 0))         # Sydney pink granite podium
PALETTE.setdefault('mod_bridge', ('#5f8a6a', .82, 0))         # Westminster Bridge green
PALETTE.setdefault('mod_vapor', ('#f4f7fb', .9, 0))           # LOX venting clouds


# ---------------------------------------------------------------------------------------------- helpers

def _rect(x0, y0, x1, y1):
    return [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]


def _clip(poly, nx, ny, d):
    """Sutherland-Hodgman: keep the part of `poly` with nx*x + ny*y <= d."""
    out = []
    n = len(poly)
    for i in range(n):
        p, q = poly[i], poly[(i + 1) % n]
        fp = nx * p[0] + ny * p[1] - d
        fq = nx * q[0] + ny * q[1] - d
        if fp <= 0:
            out.append(p)
        if (fp < 0 < fq) or (fq < 0 < fp):
            t = fp / (fp - fq)
            out.append((p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t))
    return out


def _hexclip(poly, r):
    """Clip a polygon to the pointy-top hex of circumradius r (edge normals at 0, 60, ... deg)."""
    for k in range(6):
        a = math.radians(60 * k)
        poly = _clip(poly, math.cos(a), math.sin(a), r * math.cos(math.radians(30)))
    return poly


def _hexr(deg):
    """Pointy-top hex radius factor at `deg` (1.0 at vertices, .866 at edge midpoints)."""
    d = ((deg + 30) % 60) - 30
    return math.cos(math.radians(30)) / math.cos(math.radians(d))


def _slab(b, pts, off, mat, smooth=False):
    """Closed slab from a planar 3D polygon extruded by vector `off`."""
    tb = bmesh.new()
    f = [tb.verts.new(p) for p in pts]
    g = [tb.verts.new(Vector(p) + Vector(off)) for p in pts]
    tb.faces.new(f)
    tb.faces.new(list(reversed(g)))
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        tb.faces.new((f[j], f[i], g[i], g[j]))
    bmesh.ops.recalc_face_normals(tb, faces=tb.faces)
    b._add(tb, Matrix.Identity(4), mat, smooth=smooth)


def _mesh(b, verts, faces, mats, smooth=False):
    """Add an indexed mesh, one palette material per face."""
    groups = {}
    for f, m in zip(faces, mats):
        groups.setdefault(m, []).append(f)
    for m, fs in groups.items():
        tb = bmesh.new()
        vm = {}
        for f in fs:
            vs = []
            for i in f:
                if i not in vm:
                    vm[i] = tb.verts.new(verts[i])
                vs.append(vm[i])
            try:
                tb.faces.new(vs)
            except ValueError:
                pass
        b._add(tb, Matrix.Identity(4), m, smooth=smooth)


def _lancet(cx, z0, w, h):
    """Gothic pointed window outline in the (x, z) plane, CCW seen from the front."""
    s = min(w * .9, h * .4)
    return [(cx - w / 2, z0), (cx + w / 2, z0), (cx + w / 2, z0 + h - s), (cx, z0 + h), (cx - w / 2, z0 + h - s)]


def _front_decals(b, polys, y, mat):
    """One-sided (x, z) polygons on the plane y (facing -Y) in the current transform."""
    for p in polys:
        b.decal(p, (0, y, 0), mat, rot=(90, 0, 0))


def _lattice(b, rings, rail_r, brace_r, mat, rail_mat=None, xbrace=(0, 1, 2, 3), single=(), girts=(),
             straight=False):
    """Lattice column through `rings` (lists of 4 corner points, bottom to top): corner rails plus X braces on
    faces `xbrace`, a single diagonal on faces `single`, horizontal girts on faces `girts` at each ring."""
    for k in range(4):
        path = [rings[0][k], rings[-1][k]] if straight else [rg[k] for rg in rings]
        b.tube(path, rail_r, rail_mat or mat, segs=4)
    for i in range(len(rings) - 1):
        lo, hi = rings[i], rings[i + 1]
        for k in range(4):
            k2 = (k + 1) % 4
            if k in xbrace or k in single:
                b.tube([lo[k], hi[k2]], brace_r, mat, segs=3)
            if k in xbrace:
                b.tube([lo[k2], hi[k]], brace_r, mat, segs=3)
            if k in girts:
                b.tube([hi[k], hi[k2]], brace_r, mat, segs=3)


def _tree(b, x, y, z, s=1.0, seed=0, mat='foliage'):
    """Cheap chunky broadleaf (36 tris)."""
    b.cyl(.011 * s, .045 * s, (x, y, z), 'trunk', segs=4)
    b.ico(.042 * s, (x, y, z + .075 * s), mat, 0, .14, seed, scale=(1, 1, 1.05))


def _sailboat(b, at, rot, sail='TEAM', s=1.0):
    with b.xform(place(at, (0, 0, rot), s)):
        hull = [(-.05, -.014), (.03, -.014), (.06, 0), (.03, .014), (-.05, .014)]
        b.prism(hull, .014, (0, 0, 0), 'white_plaster', top_scale=1.0)
        b.prism(hull, .003, (0, 0, .014), 'timber', top_scale=.9)
        b.cyl(.003, .1, (.005, 0, .016), 'wood_dark', segs=4)
        b.prism([(-.045, 0), (.0, 0), (.0, .085)], .003, (.004, .0015, .022), sail, rot=(90, 0, 0))
        b.prism([(.008, 0), (.052, 0), (.008, .07)], .003, (.004, .0015, .022), 'white_plaster', rot=(90, 0, 0))


# ---------------------------------------------------------------------------------------------- Big Ben

def _dial(b, c, facing, r):
    """Big Ben clock: gilded square frame, dark numeral ring, opal dial, ticks and 10:10 hands (dial faces -Y
    before `facing` rotation)."""
    with b.xform(place(c, (0, 0, facing))):
        b.box((2.25 * r, .012, 2.25 * r), (0, .004, -1.125 * r), 'gold', bevel=.003)
        b.cyl(r * 1.1, .009, (0, -.001, 0), 'black', segs=16, rot=(90, 0, 0))
        b.cyl(r * .96, .012, (0, -.002, 0), 'clock', segs=16, rot=(90, 0, 0))
        for i in range(12):
            th = math.radians(30 * i)
            d = (math.sin(th), math.cos(th))
            p = (math.cos(th), -math.sin(th))
            cx, cz = d[0] * r * .8, d[1] * r * .8
            L, W = r * (.11 if i % 3 else .15), r * (.045 if i % 3 else .08)
            pts = [(cx - d[0] * L - p[0] * W, cz - d[1] * L - p[1] * W),
                   (cx - d[0] * L + p[0] * W, cz - d[1] * L + p[1] * W),
                   (cx + d[0] * L + p[0] * W, cz + d[1] * L + p[1] * W),
                   (cx + d[0] * L - p[0] * W, cz + d[1] * L - p[1] * W)]
            b.decal(pts, (0, -.0145, 0), 'black', rot=(90, 0, 0))
        b.box((r * .11, .004, r * .55), (0, -.0165, 0), 'black', rot=(0, -58, 0))
        b.box((r * .08, .004, r * .82), (0, -.0175, 0), 'black', rot=(0, 62, 0))
        b.cyl(r * .1, .008, (0, -.013, 0), 'gold', segs=6, rot=(90, 0, 0))


def _pinnacle(b, x, y, z, w, h, tip, mat='limestone', tip_mat='gold'):
    b.box((w, w, h), (x, y, z), mat)
    b.cone(w * .75, tip, (x, y, z + h), tip_mat, segs=4, start=45)


def big_ben(b):
    # ground: embankment + the Thames along the back edge
    b.hexa(.8, .03, (0, 0, 0), 'stone_dark', bevel=.008)
    riv = .3
    b.prism(_hexclip(_rect(-1, riv, 1, 1), .77), .036, (0, 0, 0), 'WATER')
    b.prism(_hexclip(_rect(-1, -1, 1, riv), .765), .05, (0, 0, 0), 'paving')
    z0 = .05
    b.box((1.3, .018, .056), (0, riv - .009, 0), 'stone')

    # --- Elizabeth Tower
    tx, ty, hw = .21, -.08, .068
    b.box((.2, .2, .03), (tx, ty, z0), 'sandstone_dark', bevel=.005)
    b.box((2 * hw, 2 * hw, .41), (tx, ty, .08), 'limestone')
    for sx in (-1, 1):
        for sy in (-1, 1):
            b.box((.026, .026, .405), (tx + sx * (hw - .006), ty + sy * (hw - .006), .08), 'sandstone', bevel=.003)
    for z in (.2, .34):
        b.box((2 * hw + .01, 2 * hw + .01, .012), (tx, ty, z), 'sandstone')
    for k in range(4):
        with b.xform(place((tx, ty, 0), (0, 0, 90 * k))):
            polys = []
            for zz, h in ((.1, .085), (.225, .1), (.36, .105)):
                for cx in (-.024, .024):
                    polys.append(_lancet(cx, zz, .018, h))
            _front_decals(b, polys, -hw - .0015, 'roof_tile_dark')
    # clock stage
    cs = .084
    b.box((2 * cs + .01, 2 * cs + .01, .012), (tx, ty, .475), 'sandstone', bevel=.003)
    b.box((2 * cs, 2 * cs, .145), (tx, ty, .485), 'limestone')
    for sx in (-1, 1):
        for sy in (-1, 1):
            _pinnacle(b, tx + sx * (cs - .004), ty + sy * (cs - .004), .485, .026, .16, .03, 'sandstone')
    b.box((2 * cs + .012, 2 * cs + .012, .014), (tx, ty, .628), 'gold')
    for k, (dx, dy) in enumerate(((0, -1), (1, 0), (0, 1), (-1, 0))):
        _dial(b, (tx + dx * cs, ty + dy * cs, .557), 90 * k, .058)
    # belfry
    bh = .074
    b.box((2 * bh, 2 * bh, .08), (tx, ty, .642), 'limestone')
    for k in range(4):
        with b.xform(place((tx, ty, 0), (0, 0, 90 * k))):
            _front_decals(b, [_lancet(cx, .652, .026, .058) for cx in (-.036, 0, .036)], -bh - .0015, 'black')
    b.box((2 * bh + .012, 2 * bh + .012, .01), (tx, ty, .722), 'sandstone')
    for sx in (-1, 1):
        for sy in (-1, 1):
            _pinnacle(b, tx + sx * bh, ty + sy * bh, .642, .022, .1, .055)
    # spire
    sq = math.sqrt(2)
    b.cyl(.074 * sq, .16, (tx, ty, .732), 'slate', segs=4, r2=.011 * sq, start=45)
    b.cyl(.0565 * sq, .012, (tx, ty, .78), 'gold', segs=4, r2=.054 * sq, start=45)
    for k in range(4):
        with b.xform(place((tx, ty, 0), (0, 0, 90 * k))):
            b.box((.034, .03, .026), (0, -.064, .735), 'slate')
            b.gable(.03, .036, .026, (0, -.064, .761), 'slate', rot=(0, 0, 90))
            b.cone(.006, .03, (0, -.08, .75), 'gold', segs=4)
    b.cone(.012, .045, (tx, ty, .89), 'gold', segs=6)
    b.sphere(.008, (tx, ty, .937), 'gold', segs=6, rings=4)

    # --- Palace of Westminster
    px0, px1, py0, py1 = -.62, .14, .02, .26
    pcx, pcy = (px0 + px1) / 2, (py0 + py1) / 2
    b.box((px1 - px0, py1 - py0, .14), (pcx, pcy, z0), 'limestone')
    b.box((px1 - px0 + .012, py1 - py0 + .012, .012), (pcx, pcy, .19), 'sandstone')
    b.hip(px1 - px0 - .03, py1 - py0 - .04, .07, (pcx, pcy, .202), 'lead_roof', ridge=.5)
    xs = [px0 + .03 + i * .066 for i in range(11)]
    polys = []
    for x in xs:
        _pinnacle(b, x, py0 - .004, z0, .016, .2, .035, 'sandstone')
    for i in range(len(xs) - 1):
        cx = (xs[i] + xs[i + 1]) / 2
        polys += [_lancet(cx, .075, .024, .045), _lancet(cx, .135, .024, .04)]
    _front_decals(b, polys, py0 - .0015, 'roof_tile_dark')
    # central lobby spire
    b.cyl(.045, .11, (-.19, .14, .19), 'limestone', segs=8)
    b.cone(.05, .13, (-.19, .14, .3), 'lead_roof', segs=8)
    b.cone(.008, .03, (-.19, .14, .425), 'gold', segs=4)
    # Victoria Tower
    vx, vy, vh = -.47, .15, .085
    b.box((2 * vh, 2 * vh, .4), (vx, vy, z0), 'limestone')
    b.box((2 * vh + .01, 2 * vh + .01, .014), (vx, vy, .45), 'sandstone')
    for sx in (-1, 1):
        for sy in (-1, 1):
            _pinnacle(b, vx + sx * vh, vy + sy * vh, z0, .032, .45, .06, 'sandstone')
    for k in (0, 1):
        with b.xform(place((vx, vy, 0), (0, 0, 90 * k))):
            _front_decals(b, [_lancet(cx, z, .024, .07) for cx in (-.03, .03) for z in (.14, .26, .36)] +
                          [_lancet(0, .06, .05, .07)], -vh - .0015, 'roof_tile_dark')
    b.flag((vx, vy, .464), .13, pole='steel', facing=-20)

    # --- Westminster Bridge over the Thames
    bx = .45
    b.box((.1, .34, .016), (bx, .43, .058), 'mod_bridge', bevel=.003)
    b.box((.1, .34, .008), (bx, .43, .05), 'stone')
    for y in (.37, .47, .57):
        b.box((.09, .03, .03), (bx, y, .028), 'stone', bevel=.004)
    for sx in (-1, 1):
        for y in (.33, .45, .57):
            b.cyl(.003, .045, (bx + sx * .046, y, .074), 'black', segs=4)
            b.sphere(.007, (bx + sx * .046, y, .121), 'gold', segs=5, rings=3, smooth=False)
    b.flag((bx - .046, .51, .074), .12, pole='steel', facing=160)

    # --- Parliament Square, street, red bus, phone box
    b.prism(_hexclip(_rect(-.9, -.9, .9, -.46), .72), .007, (0, 0, z0), 'grass')
    b.prism(_hexclip([(-.05, -.9), (.05, -.9), (.3, -.46), (.2, -.46)], .72), .008, (0, 0, z0), 'paving')
    for i, (x, y) in enumerate(((-.5, -.52), (-.32, -.6), (-.12, -.54), (.36, -.54), (.48, -.5), (-.2, -.66))):
        _tree(b, x, y, z0 + .006, 1.1, i, 'foliage' if i % 2 else 'foliage_dark')
    b.box((.03, .03, .03), (.06, -.62, z0 + .007), 'stone_light')
    b.box((.016, .014, .03), (.06, -.62, z0 + .037), 'bronze')
    b.prism(_hexclip(_rect(-.66, -.22, .1, -.03), .74), .006, (0, 0, z0), 'grass')
    for x in (-.56, -.4, -.24, -.08):
        b.box((.12, .03, .024), (x + .07, -.16, z0 + .006), 'foliage_dark', bevel=.008)
        b.ico(.02, (x, -.08, z0 + .02), 'blossom', 0, .1, int(x * 100), scale=(1, 1, .8))
    b.prism(_hexclip(_rect(-.9, -.4, .9, -.28), .765), .004, (0, 0, z0), 'mod_asphalt')
    with b.xform(place((-.12, -.34, z0 + .004), (0, 0, 0))):
        b.box((.13, .044, .062), (0, 0, .008), 'red', bevel=.006)
        b.box((.122, .047, .013), (0, 0, .03), 'glass_dark')
        b.box((.122, .047, .013), (0, 0, .052), 'glass_dark')
        b.box((.1, .036, .01), (0, 0, 0), 'black')
    b.box((.026, .026, .058), (.04, -.2, z0), 'red', bevel=.003)
    b.box((.03, .03, .008), (.04, -.2, z0 + .058), 'red', bevel=.002)
    for x in (-.52, -.3, -.06, .38, .58):
        b.cyl(.003, .05, (x, -.25, z0), 'black', segs=4)
        b.sphere(.007, (x, -.25, z0 + .055), 'gold', segs=5, rings=3, smooth=False)
    _tree(b, .5, -.12, z0, 1.0, 7)
    _tree(b, .55, .06, z0, .9, 8)


# ---------------------------------------------------------------------------------------------- Eiffel Tower

def _ew(z):
    """Half-width of the Eiffel Tower's outer envelope at height z."""
    return .006 + .255 * math.exp(-z / .3)


def eiffel(b):
    b.overrides['EMISSIVE'] = {'color': '#ffd27a', 'emit': 5.0}
    b.base_hex(.8, .03, mat='sand', rim='stone_dark')
    z0 = .036
    cy = .07
    Z1, Z2, Z3 = .2, .37, .8
    s0 = .1
    w2 = _ew(Z2)

    def leg_size(z):
        return s0 + (w2 - s0) * (z - z0) / (Z2 - z0)

    # --- Champ de Mars: lawns, gravel allees, tree rows, fountain; the Seine behind
    for x0, x1 in ((-.62, -.07), (.07, .62)):
        b.prism(_hexclip(_rect(x0, -.8, x1, -.26), .72), .007, (0, 0, z0), 'grass')
        b.prism(_hexclip(_rect(x0 + .05, -.8, x1 - .05, -.32), .66), .004, (0, 0, z0 + .007), 'grass_dark')
    b.prism(_hexclip(_rect(-.7, .42, .7, .9), .77), .01, (0, 0, .03), 'WATER')
    b.box((1.1, .02, .016), (0, .42, z0), 'stone')
    for sx in (-1, 1):
        for i, y in enumerate((-.56, -.44, -.32, -.2)):
            if abs(y) * .866 + abs(.5 * sx * .47) < .64:
                _tree(b, sx * .47, y, z0, 1.0, i + (5 if sx > 0 else 0), 'foliage_dark' if i % 2 else 'foliage')
        for i, y in enumerate((-.08, .06, .2)):
            _tree(b, sx * .56, y, z0, .95, 20 + i, 'foliage')
    b.cyl(.075, .016, (0, -.55, z0), 'stone_light', segs=10)
    b.water(.064, (0, -.55, z0 + .012), depth=.006, segs=10)
    b.cyl(.01, .03, (0, -.55, z0), 'stone_light', segs=6)
    # plaza under the tower
    b.box((.54, .54, .006), (0, cy, z0), 'paving')

    # --- four curved lattice legs
    zs = [z0, .11, Z1, Z2]
    for sx in (-1, 1):
        for sy in (-1, 1):
            rings = []
            for z in zs:
                w, s = _ew(z), leg_size(z)
                rings.append([Vector((sx * w, cy + sy * w, z)), Vector((sx * (w - s), cy + sy * w, z)),
                              Vector((sx * (w - s), cy + sy * (w - s), z)), Vector((sx * w, cy + sy * (w - s), z))])
            _lattice(b, rings, .0085, .0042, 'eiffel', 'eiffel_dark', xbrace=(0, 3), single=(1, 2))
            w, s = _ew(z0), leg_size(z0)
            b.box((s + .024, s + .024, .018), (sx * (w - s / 2), cy + sy * (w - s / 2), z0), 'stone')

    # --- the decorative arches between the legs (double arc with spokes, proud of the lattice)
    for k in range(4):
        with b.xform(place((0, cy, 0), (0, 0, 90 * k))):
            arcs = []
            for inset, top in ((0.0, Z1 - .014), (.03, Z1 - .04)):
                pts = []
                for i in range(13):
                    th = math.pi * i / 12
                    z = z0 + .05 + (top - z0 - .05) * math.sin(th)
                    x = (_ew(z) - leg_size(z) + .01 - inset * (1 - abs(math.cos(th)))) * math.cos(th)
                    pts.append((x, -_ew(z) - .008, z))
                arcs.append(pts)
            b.tube(arcs[0], .0095, 'eiffel', segs=4)
            b.tube(arcs[1][1:-1], .005, 'eiffel', segs=4)
            for i in (3, 5, 7, 9):
                b.tube([arcs[0][i], arcs[1][i]], .003, 'eiffel', segs=3)

    # --- first platform (ring deck with gilded rail and pavilions)
    p1 = _ew(Z1) + .024
    band = .046
    for k in range(4):
        with b.xform(place((0, cy, 0), (0, 0, 90 * k))):
            b.box((2 * p1, band, .03), (0, -p1 + band / 2, Z1 - .016), 'eiffel_dark')
            b.box((2 * p1 + .004, .006, .008), (0, -p1 - .001, Z1 + .014), 'gold')
            b.box((.07, .03, .022), (-.05, -p1 + .02, Z1 + .014), 'eiffel')
    b.flag((-.11, -.47, z0), .12, pole='iron', facing=200)
    b.flag((.11, -.47, z0), .12, pole='iron', facing=200)

    # --- second platform
    p2 = w2 + .026
    b.box((2 * p2, 2 * p2, .026), (0, cy, Z2 - .012), 'eiffel_dark')
    b.box((2 * p2 + .006, 2 * p2 + .006, .006), (0, cy, Z2 + .014), 'gold')
    for sx, sy in ((1, 1), (-1, 1), (-1, -1), (1, -1)):
        b.box((.03, .03, .016), (sx * (p2 - .018), cy + sy * (p2 - .018), Z2 + .014), 'eiffel')

    # --- the slender upper shaft
    zs = [Z2, .46, .56, .67, Z3]
    rings = [[Vector((sx * _ew(z), cy + sy * _ew(z), z)) for sx, sy in ((1, 1), (-1, 1), (-1, -1), (1, -1))]
             for z in zs]
    _lattice(b, rings, .0075, .0036, 'eiffel', 'eiffel_dark')
    b.box((2 * _ew(.56) + .014, 2 * _ew(.56) + .014, .008), (0, cy, .556), 'eiffel_dark')

    # --- summit: gallery, lit lantern, gilded antenna
    b.box((.074, .074, .016), (0, cy, Z3 - .004), 'eiffel_dark')
    b.box((.078, .078, .004), (0, cy, Z3 + .012), 'gold')
    b.box((.046, .046, .03), (0, cy, Z3 + .012), 'eiffel', bevel=.004)
    b.cyl(.017, .02, (0, cy, Z3 + .042), 'eiffel_dark', segs=8)
    b.sphere(.019, (0, cy, Z3 + .078), 'EMISSIVE', segs=8, rings=5)
    b.cyl(.005, .065, (0, cy, Z3 + .06), 'eiffel_dark', segs=5, r2=.003)
    b.sphere(.006, (0, cy, Z3 + .128), 'gold', segs=5, rings=3, smooth=False)


# ---------------------------------------------------------------------------------------------- Statue of Liberty

def _star(n, ro, ri, rot=90.0):
    return [polar(ro if i % 2 == 0 else ri, rot + i * 180.0 / n)[:2] for i in range(2 * n)]


def liberty(b):
    b.overrides['EMISSIVE'] = {'color': '#ffc640', 'emit': 5.5}
    b.hexa(.8, .02, (0, 0, 0), 'stone_dark', bevel=.006)
    b.hexa(.775, .03, (0, 0, 0), 'WATER')
    # island: seawall, promenade, lawn
    rnd = random.Random(4)
    isl = [(math.cos(math.radians(a)) * .5 * (1.12 + rnd.uniform(-.03, .03)),
            math.sin(math.radians(a)) * .5 * (.92 + rnd.uniform(-.03, .03)) + .03) for a in range(0, 360, 20)]
    b.prism(isl, .048, (0, 0, 0), 'granite')
    b.prism([(x * .96, y * .96) for x, y in isl], .053, (0, 0, 0), 'paving')
    b.prism([(x * .86, y * .86) for x, y in isl], .058, (0, 0, 0), 'grass')
    zi = .058
    for i, a in enumerate((20, 60, 110, 150, 205, 235, 330)):
        x, y, _ = polar(1, a)
        _tree(b, x * .43, y * .35 + .03, zi, 1.0 + (i % 3) * .1, i, 'foliage' if i % 2 else 'foliage_dark')
    # dock + ferry, path up to the fort
    b.prism([(.2, -.2), (.28, -.24), (.4, -.32), (.36, -.34), (.24, -.27), (.16, -.23)], .004, (0, 0, zi), 'paving')
    b.box((.045, .22, .012), (.37, -.42, .024), 'timber')
    for y in (-.33, -.43, -.52):
        b.cyl(.006, .03, (.37 + .026, y, .0), 'wood_dark', segs=4)
    with b.xform(place((.44, -.44, .022), (0, 0, 95))):
        hull = [(-.08, -.026), (.06, -.026), (.095, 0), (.06, .026), (-.08, .026)]
        b.prism(hull, .022, (0, 0, 0), 'white_plaster')
        b.prism(hull, .005, (0, 0, .02), 'TEAM_DARK', top_scale=.96)
        b.box((.1, .04, .024), (-.01, 0, .025), 'shell_white', bevel=.003)
        b.box((.102, .042, .008), (-.01, 0, .035), 'glass_dark')
        b.box((.06, .034, .016), (-.02, 0, .049), 'shell_white', bevel=.003)
    _sailboat(b, (-.55, -.28, .028), 30)
    b.flag((-.28, -.26, zi), .11, pole='steel', facing=200)
    b.flag((.26, -.27, zi), .11, pole='steel', facing=200)

    # Fort Wood: 11-point star
    b.prism(_star(11, .3, .215), .062, (0, .04, zi), 'granite', top_scale=.97)
    b.prism(_star(11, .27, .195), .066, (0, .04, zi), 'stone_light')
    zf = zi + .066
    b.box((.1, .06, .004), (0, -.16, zf), 'paving')

    # pedestal
    cx, cy = 0, .04
    b.box((.2, .2, .03), (cx, cy, zf), 'stone_light', bevel=.004)
    b.box((.17, .17, .11), (cx, cy, zf + .03), 'stone', taper=.9)
    for k in range(4):
        with b.xform(place((cx, cy, 0), (0, 0, 90 * k))):
            _front_decals(b, [_rect(-.035, zf + .045, .035, zf + .1)], -.0835, 'stone_dark')
            _front_decals(b, [_lancet(x, zf + .055, .012, .036) for x in (-.02, 0, .02)], -.0845, 'basalt')
    b.box((.18, .18, .014), (cx, cy, zf + .14), 'stone_light', bevel=.003)
    b.box((.14, .14, .036), (cx, cy, zf + .154), 'stone')
    for k in range(4):
        with b.xform(place((cx, cy, 0), (0, 0, 90 * k))):
            _front_decals(b, [_rect(-.05 + i * .027, zf + .162, -.036 + i * .027, zf + .184) for i in range(4)],
                          -.0705, 'basalt')
    b.box((.15, .15, .01), (cx, cy, zf + .19), 'stone_light', bevel=.003)
    Z = zf + .2

    # the statue
    with b.xform(place((cx, cy, Z), (0, 0, 0), (1.25, 1.25, 1.1))):
        b.box((.1, .08, .012), (0, 0, 0), 'patina_dark', bevel=.003)

        def robe(u, v):
            th = 2 * math.pi * u
            prof = [(.0, .055), (.15, .05), (.4, .043), (.65, .041), (.82, .045), (.93, .037), (1.0, .012)]
            for (v0, r0), (v1, r1) in zip(prof, prof[1:]):
                if v <= v1:
                    t = (v - v0) / (v1 - v0) if v1 > v0 else 0
                    r = r0 + (r1 - r0) * t
                    break
            amp = .1 * (1 - v) ** 1.5 + .015
            r *= 1 + amp * math.sin(9 * th + 2.2 * v)
            return (r * math.cos(th), r * math.sin(th) * .82 + .012 * (1 - v) ** 2, .012 + v * .245)
        b.surface(robe, 22, 7, 'patina', smooth=True, close_u=True)
        # stola sash across the chest
        b.tube([(.036, -.02, .215), (0, -.04, .17), (-.04, -.03, .12)], [.012, .013, .011], 'patina_dark', segs=5,
               flat=.5)
        b.cyl(.015, .03, (0, 0, .245), 'patina', segs=6)
        b.sphere(.033, (0, -.003, .292), 'patina', segs=10, rings=6)
        b.torus(.03, .006, (0, -.002, .305), 'patina_dark', segs=10, rsegs=4)
        for a in (-72, -48, -24, 0, 24, 48, 72):
            az = math.radians(270 + a)
            el = math.radians(22)
            d = Vector((math.cos(az) * math.cos(el), math.sin(az) * math.cos(el), math.sin(el)))
            c = Vector((0, -.002, .305))
            b.tube([c + d * .028, c + d * .088], [.0095, .0012], 'patina', segs=4)
        # raised right arm (statue's right = -X) with torch
        b.tube([(-.04, .0, .225), (-.058, -.006, .31), (-.066, -.012, .39)], [.018, .015, .012], 'patina', segs=6)
        b.tube([(-.035, .004, .215), (-.05, .002, .27), (-.062, -.004, .33)], [.016, .022, .01], 'patina_dark',
               segs=5, flat=.6)
        b.sphere(.014, (-.066, -.012, .39), 'patina', segs=6, rings=4)
        b.cyl(.009, .05, (-.066, -.012, .39), 'patina_dark', segs=6, r2=.012)
        b.lathe([(0, 0), (.013, 0), (.022, .016), (.028, .026), (0, .026)], (-.066, -.012, .44), 'gold', segs=10)
        b.torus(.029, .003, (-.066, -.012, .455), 'gold', segs=10, rsegs=3)
        b.lathe([(0, 0), (.02, .004), (.022, .018), (.014, .038), (.004, .054), (0, .06)], (-.066, -.012, .462),
                'EMISSIVE', segs=8, smooth=True)
        # left arm cradling the tablet
        b.tube([(.042, 0, .22), (.062, -.012, .15), (.05, -.042, .165)], [.017, .014, .012], 'patina', segs=6)
        b.box((.05, .014, .09), (.056, -.03, .1), 'patina_dark', rot=(8, -12, -12), bevel=.003)


# ---------------------------------------------------------------------------------------------- Sydney Opera House

def _arch(s):
    return max(0.0, 1 - abs(s)) ** .68


def _shell(b, at, rot, W, H, D, L, nu=8, nv=6, t=.009, glass=True):
    """One interlocking sail: a pointed hood whose glazed mouth faces local -Y and whose ridge sweeps back and
    down to the podium."""
    def fn(u, v):
        s = 2 * u - 1
        a = _arch(s)
        phi = v * math.pi / 2 * .95
        sp, cp = math.sin(phi), math.cos(phi)
        return (W * s * cp ** .3, -L * a * (1 - sp) + D * sp, H * cp * a)
    with b.xform(place(at, rot)):
        b.surface(fn, nu, nv, 'shell_white', thickness=t, smooth=True)
        if glass:
            pts = []
            for i in range(9):
                s = -1 + 2 * i / 8
                a = _arch(s)
                pts.append((W * s * .86, -L * a * .9 + .014, H * a * .9))
            _slab(b, pts, (0, .006, 0), 'glass_dark')


def _ferry(b, at, rot):
    with b.xform(place(at, (0, 0, rot))):
        hull = [(-.075, -.024), (.055, -.024), (.085, 0), (.055, .024), (-.075, .024)]
        b.prism(hull, .02, (0, 0, 0), 'mod_ferry')
        b.prism(hull, .004, (0, 0, .02), 'flower_y', top_scale=.97)
        b.box((.1, .036, .022), (-.005, 0, .024), 'mod_cream', bevel=.003)
        b.box((.102, .038, .008), (-.005, 0, .033), 'glass_dark')
        b.box((.06, .03, .012), (-.01, 0, .046), 'mod_ferry', bevel=.002)
        b.cyl(.007, .022, (-.025, 0, .054), 'flower_y', segs=6)


def opera_house(b):
    b.hexa(.8, .02, (0, 0, 0), 'stone_dark', bevel=.006)
    b.hexa(.775, .03, (0, 0, 0), 'WATER')
    # Bennelong Point: promenade peninsula reaching in from the back
    land = [(-.4, -.42), (.4, -.42), (.48, -.26), (.5, .2), (.9, .6), (0, 1), (-.9, .6), (-.5, .2), (-.48, -.26)]
    b.prism(_hexclip(land, .77), .042, (0, 0, 0), 'granite')
    b.prism(_hexclip([(x * .97, y * .97 - .005) for x, y in land], .75), .046, (0, 0, 0), 'paving')
    zl = .046
    # podium + monumental steps
    px0, px1, py0, py1 = -.35, .37, -.2, .42
    b.prism(_hexclip(_rect(px0, py0, px1, py1), .74), .09, (0, 0, zl), 'mod_podium')
    b.prism(_hexclip(_rect(px0 + .01, py0 + .01, px1 - .01, py1 - .01), .73), .094, (0, 0, zl), 'paving')
    zp = zl + .094
    b.stairs(.5, .12, .09, 7, (.02, py0 - .12, zl), 'stone_light')
    for sx in (-1, 1):
        b.box((.03, .12, .094), (.02 + sx * .265, py0 - .06, zl), 'mod_podium')
    for k in range(8):
        x = px0 + .05 + k * .09
        if abs(x - .02) > .3:
            b.decal(_rect(-.028, .02, .028, .06), (x, py0 - .0015, zl), 'basalt', rot=(90, 0, 0))

    # shells: Concert Hall (left) and Joan Sutherland Theatre (right), rising from the harbour tip backwards
    rows = (((-.14, .02, 7.0), 1.0), ((.17, .05, -7.0), .88))
    for (rx, ry, rz), k in rows:
        with b.xform(place((rx, ry, zp), (0, 0, rz))):
            _shell(b, (0, -.2 * k, 0), (0, 0, 0), .08 * k, .21 * k, .14 * k, .07 * k)
            _shell(b, (0, -.1 * k, 0), (0, 0, 0), .1 * k, .33 * k, .19 * k, .11 * k)
            _shell(b, (0, .02 * k, 0), (0, 0, 0), .115 * k, .47 * k, .23 * k, .15 * k)
            _shell(b, (0, .33 * k, 0), (0, 0, 180), .105 * k, .36 * k, .14 * k, .1 * k, glass=False)
    # Bennelong restaurant shells
    _shell(b, (-.29, -.1, zp), (0, 0, -12), .045, .12, .08, .04)
    _shell(b, (-.3, .07, zp), (0, 0, 168), .04, .1, .07, .035, glass=False)

    # harbour life
    _ferry(b, (.26, -.5, .02), 25)
    _sailboat(b, (-.42, -.48, .028), -25, s=1.4)
    for sx in (-1, 1):
        b.flag((.02 + sx * .3, py0 - .09, zl), .12, pole='steel', facing=200)
    for i, (x, y) in enumerate(((.47, .12), (.5, .3), (-.46, .3), (-.44, .12))):
        _tree(b, x, y, zl, 1.0, i, 'foliage')


# ---------------------------------------------------------------------------------------------- Christ the Redeemer

def _mountain(b, levels, n=28, seed=3, shape=None, rock_from=3):
    """Jittered stacked rings (z, R, hexness, jitter, z_jitter, y_shift) skinned into a peak; faces coloured by
    slope (rock cliffs, jungle slopes, grassy skirt). `shape(deg, level) -> radius factor` carves coves.
    Returns a BVH for draping props."""
    rnd = random.Random(seed)
    verts, rings = [], []
    for li, (z, R, hx, jit, zj, dy) in enumerate(levels):
        ring = []
        for k in range(n):
            deg = 360.0 * k / n + (rnd.uniform(-4, 4) if 0 < li < len(levels) - 1 else 0)
            f = (hx * _hexr(deg) + (1 - hx)) * (shape(deg, li) if shape else 1.0)
            r = R * f * (1 + rnd.uniform(-jit, jit))
            x, y, _ = polar(r, deg)
            ring.append(len(verts))
            verts.append((x, y + dy, z + rnd.uniform(-zj, zj)))
        rings.append(ring)
    faces, mats = [], []
    frnd = random.Random(seed + 1)
    for li in range(len(rings) - 1):
        a, c = rings[li], rings[li + 1]
        for k in range(n):
            k2 = (k + 1) % n
            f = (a[k], a[k2], c[k2], c[k])
            p = [Vector(verts[i]) for i in f]
            nz = (p[1] - p[0]).cross(p[3] - p[0]).normalized().z
            if li == 0:
                m = 'grass_dark'
            elif nz < .42 or li >= len(rings) - rock_from:
                m = 'rock' if frnd.random() < .55 else ('rock_dark' if frnd.random() < .5 else 'rock_light')
            else:
                m = 'foliage_dark' if frnd.random() < .55 else 'foliage'
            faces.append(f)
            mats.append(m)
    faces.append(tuple(rings[-1]))
    mats.append('rock_light')
    faces.append(tuple(reversed(rings[0])))
    mats.append('grass_dark')
    _mesh(b, verts, faces, mats)
    return BVHTree.FromPolygons(verts, faces)


def _drop(bvh, x, y):
    hit = bvh.ray_cast(Vector((x, y, 3)), Vector((0, 0, -1)), 5)
    return hit[0], hit[1]


def cristo(b):
    b.hexa(.82, .02, (0, 0, 0), 'sand_dark')
    # Guanabara cove with a beach carved into the front-left foot of the mountain
    cove = [polar(r, a)[:2] for r, a in ((.42, 190), (.9, 185), (.9, 262), (.44, 258), (.36, 225))]
    b.prism(_hexclip(cove, .79), .012, (0, 0, .02), 'WATER')
    b.prism(_hexclip([polar(r, a)[:2] for r, a in ((.38, 186), (.62, 184), (.6, 262), (.4, 262), (.3, 224))], .8),
            .014, (0, 0, .02), 'sand')

    def shape(deg, li):
        d = abs(((deg - 224 + 180) % 360) - 180)
        if d > 42 or li > 2:
            return 1.0
        k = (1 - d / 42) ** .7
        return 1 - k * (.5, .42, .2)[li]

    top = .55
    levels = [(0.0, .83, 1.0, 0, 0, 0), (.03, .78, .9, .03, .004, 0), (.09, .68, .65, .07, .012, .01),
              (.15, .58, .4, .1, .02, .015), (.22, .46, .2, .12, .02, .02), (.29, .33, .05, .14, .02, .03),
              (.38, .255, 0, .15, .02, .045), (.46, .195, 0, .12, .015, .055), (.52, .15, 0, .08, .01, .06),
              (top, .125, 0, 0, 0, .06)]
    bvh = _mountain(b, levels, seed=11, shape=shape, rock_from=5)
    # jungle canopy draped over the gentler slopes
    rnd = random.Random(21)
    placed = 0
    for _ in range(1200):
        if placed >= 84:
            break
        a = rnd.uniform(0, 360)
        r = rnd.uniform(.2, .78)
        x, y, _z = polar(r * _hexr(a), a)
        loc, nrm = _drop(bvh, x, y)
        if loc is None or nrm.z < .5 or loc.z > .36 or loc.z < .025:
            continue
        s = rnd.uniform(.9, 1.3) * (1.2 - loc.z)
        b.ico(.055 * s, (loc.x, loc.y, loc.z + .016 * s),
              ('foliage_dark', 'foliage', 'foliage_dark', 'foliage_light')[placed % 4], 0, .2, placed,
              scale=(1, 1, .72))
        placed += 1
    for i, (r, a) in enumerate(((.5, 200), (.52, 238), (.47, 252), (.6, 214))):
        x, y, _z = polar(r, a)
        b.tree_palm((x, y, .03), .7, seed=i)
    # Sugarloaf islet in the cove
    b.lathe([(0, 0), (.075, 0), (.08, .05), (.066, .12), (.04, .165), (0, .178)], (-.6, -.36, .02), 'rock_light',
            segs=9, scale=(1, .8, 1))
    b.ico(.05, (-.64, -.34, .03), 'foliage_dark', 0, .15, 6, scale=(1.4, 1, .6))
    for a in (212, 246):
        x, y, _z = polar(.58, a)
        b.flag((x, y, .034), .11, pole='steel', facing=200)

    # summit terrace, chapel pedestal
    sy = .055
    b.cyl(.125, .02, (0, sy, top - .006), 'stone_light', segs=10)
    b.torus(.122, .004, (0, sy, top + .022), 'white_plaster', segs=10, rsegs=3)
    b.box((.08, .08, .05), (0, sy, top + .014), 'mod_soapstone', taper=.9, bevel=.004)
    b.decal(_lancet(0, .0, .022, .034), (0, sy - .0385, top + .016), 'basalt', rot=(90, 0, 0))
    Z = top + .064

    # the Redeemer: column-like robe, outstretched arms with hanging sleeves
    with b.xform(place((0, sy, Z), (0, 0, 0), 1.08)):
        m = 'mod_soapstone'
        b.lathe([(0, 0), (.032, 0), (.029, .06), (.031, .13), (.037, .19), (.041, .222), (.036, .238), (.013, .25),
                 (0, .25)], (0, 0, 0), m, segs=12, scale=(1, .72, 1), smooth=True)
        b.box((.36, .028, .027), (0, 0, .212), m, bevel=.005)
        for sx in (-1, 1):
            b.prism([(0, .03), (.085, .078), (.085, .092), (0, .092)], .022, (sx * .03, .011, .122), m,
                    rot=(90, 0, 0), scale=(sx, 1, 1))
            b.box((.02, .024, .03), (sx * .176, 0, .206), m, bevel=.004)
        b.cyl(.012, .02, (0, 0, .245), m, segs=6)
        b.sphere(.023, (0, -.002, .276), m, segs=8, rings=6)
        b.tube([(-.02, -.021, .2), (0, -.024, .12), (.012, -.022, .03)], .005, 'stone_light', segs=4)


# ---------------------------------------------------------------------------------------------- Launch pad

def _quads(b, z0, z1, r, mats, segs=4, r2=None):
    """Cylinder band split into 4 quadrants alternating `mats` (Saturn V roll pattern)."""
    r2 = r if r2 is None else r2
    for q in range(4):
        prof = [(0, z0), (r, z0), (r2, z1), (0, z1)]
        b.lathe(prof, (0, 0, 0), mats[q % len(mats)], segs=segs, start=45 + 90 * q, arc=90)


def launch_pad(b):
    b.overrides['EMISSIVE'] = {'color': '#ffae3b', 'emit': 5.0}
    b.base_hex(.8, .03, mat='grass', rim='concrete_dark')
    z0 = .036
    # hardstand, service road, crawlerway
    b.cyl(.5, .02, (0, .03, z0 - .004), 'concrete', segs=8, start=22.5)
    zs = z0 + .016
    b.prism(_hexclip(_rect(.12, -.9, .24, -.3), .77), .005, (0, 0, z0), 'mod_asphalt')
    # crawlerway: twin gravel lanes out to the front-left
    for off in (-.04, .04):
        ox, oy = math.cos(math.radians(145)) * off, math.sin(math.radians(145)) * off
        p0, p1 = polar(.3, 235), polar(.9, 235)
        d = (math.cos(math.radians(145)) * .025, math.sin(math.radians(145)) * .025)
        lane = [(p0[0] + ox - d[0], p0[1] + oy - d[1]), (p0[0] + ox + d[0], p0[1] + oy + d[1]),
                (p1[0] + ox + d[0], p1[1] + oy + d[1]), (p1[0] + ox - d[0], p1[1] + oy - d[1])]
        b.prism(_hexclip(lane, .77), .006, (0, 0, z0), 'stone')
    # flame trench running out to the left, flame deflector, soot outwash
    b.box((.44, .1, .004), (-.25, -.04, zs), 'black')
    for sy in (-1, 1):
        b.box((.4, .024, .045), (-.24, -.04 + sy * .062, zs), 'concrete_dark', bevel=.004)
    b.prism(_hexclip([(-.44, -.1), (-.44, .02), (-.8, .16), (-.8, -.26)], .76), .003, (0, 0, z0), 'basalt')
    b.prism([(-.03, -.09), (-.03, .01), (-.12, -.04)], .03, (0, 0, zs), 'steel')
    for x0, y0, x1, y1 in ((-.46, -.13, .44, -.12), (-.46, .04, .44, .05), (.3, -.3, .31, .3)):
        b.box((x1 - x0, y1 - y0, .002), ((x0 + x1) / 2, (y0 + y1) / 2, zs), 'flower_y')
    # marsh pond with palms
    b.cyl(.12, .004, (.47, -.38, z0), 'sand', segs=9, scale=(1.25, .85, 1))
    b.cyl(.1, .006, (.47, -.38, z0), 'WATER', segs=9, scale=(1.25, .85, 1))
    for i, (x, y) in enumerate(((.6, -.3), (.36, -.46), (.58, -.46))):
        b.tree_palm((x, y, z0), .55, seed=i + 3)

    # mobile launcher platform on pedestals
    mx, my = .02, .02
    for x in (-.15, .15):
        for y in (-.12, .14):
            b.box((.03, .03, .036), (mx + x, my + y, zs), 'concrete_dark')
    b.box((.4, .32, .05), (mx, my, zs + .036), 'steel', bevel=.004)
    b.box((.402, .322, .012), (mx, my, zs + .06), 'TEAM_DARK')
    zm = zs + .086

    # --- Saturn-style rocket
    rx, ry = -.08, -.04
    with b.xform(place((rx, ry, zm), (0, 0, 0))):
        W, K = 'rocket_white', 'black'
        r1, r3, r4 = .05, .036, .027
        b.cyl(r1 * .8, .012, (0, 0, 0), 'iron', segs=10)
        b.cyl(r1, .05, (0, 0, .012), W, segs=12)
        _quads(b, .062, .2, r1, (K, W))
        b.cyl(r1, .05, (0, 0, .2), W, segs=12)
        b.cyl(r1 + .001, .02, (0, 0, .25), K, segs=12)
        _quads(b, .27, .29, r1, (W, K))
        b.cyl(r1, .19, (0, 0, .29), W, segs=12)
        b.cyl(r1 + .001, .014, (0, 0, .44), 'TEAM', segs=12)
        b.cyl(r1, .025, (0, 0, .48), W, segs=12, r2=r3)
        _quads(b, .505, .545, r3, (K, W))
        b.cyl(r3, .065, (0, 0, .545), W, segs=12)
        b.cyl(r3 + .001, .012, (0, 0, .61), 'gold', segs=12)
        b.cyl(r3, .04, (0, 0, .622), W, segs=12, r2=r4)
        b.cyl(r4, .024, (0, 0, .662), 'concrete', segs=12)
        b.cyl(r4, .036, (0, 0, .686), W, segs=12, r2=.006)
        for i in range(4):
            a = 45 + 90 * i
            with b.xform(place((0, 0, 0), (0, 0, a))):
                b.prism([(r1 - .004, .012), (r1 + .034, .012), (r1 - .004, .075)], .006, (0, .003, 0), K,
                        rot=(90, 0, 0))
                b.cyl(.012, .05, (r1 - .002, 0, .012), W, segs=6)
                b.cone(.012, .018, (r1 - .002, 0, .062), W, segs=6)
        b.cyl(.0035, .045, (0, 0, .718), 'red', segs=4, r2=.0025)
        b.cyl(.006, .022, (0, 0, .76), 'red', segs=6)
        b.cone(.006, .018, (0, 0, .782), 'red', segs=6)
        b.cyl(.0065, .004, (0, 0, .758), 'gold', segs=6)
        # LOX vapour hugging the base
        b.torus(r1 * .95, .012, (0, 0, .006), 'mod_vapor', segs=12, rsegs=4, smooth=True)

    # --- red launch umbilical tower with swing arms and hammerhead crane
    gx, gy, gh = .14, .1, .05
    lv = [zm + i * (.82 - zm) / 8 for i in range(9)]
    rings = [[Vector((gx + sx * gh, gy + sy * gh, z)) for sx, sy in ((1, 1), (-1, 1), (-1, -1), (1, -1))]
             for z in lv]
    _lattice(b, rings, .0075, .0038, 'red', 'red_dark', straight=True)
    for z in lv[1::2]:
        b.box((2 * gh, 2 * gh, .006), (gx, gy, z - .003), 'red_dark')
    b.box((.12, .12, .016), (gx, gy, .82), 'red_dark')
    ang = math.degrees(math.atan2(ry - gy, rx - gx))
    dist = math.hypot(rx - gx, ry - gy)
    with b.xform(place((gx, gy, 0), (0, 0, ang))):
        for z, rr in ((zm + .2, .05), (zm + .32, .05), (zm + .45, .05), (zm + .56, .036), (zm + .66, .027)):
            L = dist - rr - .002
            b.box((L - .02, .024, .014), ((L + .02) / 2, 0, z), 'red', bevel=.002)
            b.box((.022, .03, .02), (L - .011, 0, z - .003), 'rocket_white')
        b.box((.26, .026, .02), (.02, 0, .836), 'red', bevel=.003)
        b.box((.04, .04, .03), (.13, 0, .8), 'red_dark')
        b.sphere(.008, (-.11, 0, .862), 'EMISSIVE', segs=6, rings=3)
        b.sphere(.008, (.15, 0, .862), 'EMISSIVE', segs=6, rings=3)
    b.cyl(.004, .06, (gx, gy, .836), 'steel', segs=4)
    b.sphere(.009, (gx, gy, .9), 'EMISSIVE', segs=6, rings=3)
    b.flag((gx + gh, gy - gh, .836), .09, pole='steel', facing=200)

    # --- spherical propellant tanks
    for i, (x, y) in enumerate(((-.44, .32), (.46, .3))):
        for k in range(4):
            lx, ly, _ = polar(.05, 45 + 90 * k)
            b.cyl(.006, .06, (x + lx, y + ly, z0), 'steel', segs=4)
        b.sphere(.075, (x, y, z0 + .115), 'rocket_white', segs=12, rings=6)
        b.torus(.076, .004, (x, y, z0 + .115), 'TEAM' if i else 'gold', segs=12, rsegs=3)
        b.sphere(.008, (x, y, z0 + .195), 'EMISSIVE', segs=6, rings=3)
    # blockhouse, floodlights, vans, flags
    b.dome(.1, .07, (-.4, -.36, z0), 'concrete', segs=10, rings=3)
    b.box((.07, .01, .012), (-.4, -.455, z0 + .03), 'glass_dark', rot=(0, 0, 0))
    for x, y in ((-.34, .36), (.42, -.08), (-.12, -.4)):
        b.cyl(.005, .2, (x, y, z0), 'steel', segs=4)
        b.box((.035, .012, .02), (x, y, z0 + .2), 'iron')
        b.box((.03, .004, .014), (x, y - .007, z0 + .203), 'EMISSIVE')
    with b.xform(place((.18, -.52, z0 + .005), (0, 0, 90))):
        b.box((.06, .032, .03), (0, 0, .004), 'rocket_white', bevel=.004)
        b.box((.062, .034, .01), (0, 0, .02), 'glass_dark')
    b.flag((.3, -.44, z0), .13, pole='steel', facing=200)
    b.flag((.06, -.44, z0), .13, pole='steel', facing=200)


MODELS = {
    'w_big_ben': big_ben,
    'w_eiffel': eiffel,
    'w_liberty': liberty,
    'w_opera_house': opera_house,
    'w_cristo': cristo,
    'w_launch_pad': launch_pad,
}
