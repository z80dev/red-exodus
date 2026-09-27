"""AEONS wonders — natural set: sky_arch, ember_peak, crystal_falls, elder_tree, titan_bones, mirror_lake.

Natural wonders are wild terrain: no plinth and no TEAM colours. Each sits on an irregular faceted ground mound
(`_Ground`, radius <= 0.8) whose rim drops to z = 0 so it merges into the host tile. Blender Z-up, front faces -Y,
preview camera at front-right. Builders receive a wonders_lib.Builder `b`.
"""
import math
import random

import bmesh
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

from wonders_lib import PALETTE, place, polar

for _k, _v in {
    # sky arch sandstone strata
    'nat_rust': ('#9c432b', .9, 0), 'nat_redrock': ('#c25d36', .9, 0), 'nat_orange': ('#dc8a4c', .88, 0),
    'nat_cream': ('#efc98f', .88, 0), 'nat_redsand': ('#d49a63', .9, 0), 'nat_sage': ('#8f9c5a', .9, 0),
    'nat_juniper': ('#4b6a3d', .9, 0),
    # volcano
    'nat_basalt': ('#35302e', .9, 0), 'nat_ash': ('#5b5450', .9, 0), 'nat_ash_light': ('#7f7670', .9, 0),
    'nat_smoke': ('#8f8884', .9, 0), 'nat_smoke_light': ('#c3bdb7', .88, 0),
    # crystal falls
    'nat_cliff': ('#7d8899', .88, 0), 'nat_cliff_dark': ('#5c6577', .9, 0), 'nat_foam': ('#eef7fb', .8, 0),
    'nat_amethyst': ('#a78be6', .75, 0),
    # misc
    'nat_moss': ('#6b9139', .9, 0), 'nat_horn': ('#6e5c47', .85, 0), 'nat_cactus': ('#5e8c4a', .88, 0),
    'nat_lily': ('#5d9e45', .85, 0), 'nat_reed': ('#809b47', .88, 0),
}.items():
    PALETTE.setdefault(_k, _v)


# ---------------------------------------------------------------------------------------------- helpers

class _Noise:
    """Deterministic smooth 2D noise from a few random plane waves, roughly in [-1, 1]."""

    def __init__(self, seed, octaves=4, freq=3.0):
        rnd = random.Random(seed)
        self.w = []
        f, a = freq, 1.0
        for _ in range(octaves):
            ang = rnd.uniform(0, 2 * math.pi)
            self.w.append((f * math.cos(ang), f * math.sin(ang), rnd.uniform(0, 2 * math.pi), a))
            f *= 1.93
            a *= .5
        self.norm = sum(w[3] for w in self.w)

    def __call__(self, x, y):
        return sum(a * math.sin(kx * x + ky * y + p) for kx, ky, p, a in self.w) / self.norm


def _smooth(t):
    t = min(1.0, max(0.0, t))
    return t * t * (3 - 2 * t)


def _falloff(x, y, r0=.56, r1=.8):
    return _smooth((r1 - math.hypot(x, y)) / (r1 - r0))


def _seg_dist(p, a, c):
    ax, ay = c[0] - a[0], c[1] - a[1]
    t = max(0.0, min(1.0, ((p[0] - a[0]) * ax + (p[1] - a[1]) * ay) / max(ax * ax + ay * ay, 1e-9)))
    return math.hypot(p[0] - a[0] - ax * t, p[1] - a[1] - ay * t)


def _path_dist(p, path):
    return min(_seg_dist(p, path[i], path[i + 1]) for i in range(len(path) - 1))


def _emit(b, verts, faces, mats, smooth=False):
    """Raw faces straight into the builder mesh, one material per face (for faceted terrain)."""
    m = b.stack[-1]
    vs = [b.bm.verts.new(m @ Vector(v)) for v in verts]
    for f, name in zip(faces, mats):
        try:
            nf = b.bm.faces.new([vs[i] for i in f])
        except ValueError:
            continue
        nf.material_index = b.mi(name)
        nf.smooth = smooth


def _loft(b, rings, mat, local=None, cap_bottom=True, cap_top=True, smooth=False):
    """Skin consecutive rings (equal counts, or single-point poles). Rings wind CCW around the sweep direction."""
    tb = bmesh.new()
    vr = [[tb.verts.new(p) for p in ring] for ring in rings]
    for a, c in zip(vr, vr[1:]):
        n = max(len(a), len(c))
        for k in range(n):
            k2 = (k + 1) % n
            if len(a) == 1:
                tb.faces.new((a[0], c[k], c[k2]))
            elif len(c) == 1:
                tb.faces.new((a[k], a[k2], c[0]))
            else:
                tb.faces.new((a[k], a[k2], c[k2], c[k]))
    if cap_bottom and len(vr[0]) > 2:
        tb.faces.new(list(reversed(vr[0])))
    if cap_top and len(vr[-1]) > 2:
        tb.faces.new(vr[-1])
    b._add(tb, local if local is not None else Matrix.Identity(4), mat, smooth=smooth)


class _Ground:
    """Faceted polar-grid mound. hfn(x, y) -> z; matfn(x, y, z, normal) -> palette name. The outer ring sits at
    z = 0 on a wobbly edge <= rmax. Calling the instance ray-casts the built surface (for prop placement)."""

    def __init__(self, b, hfn, matfn, radii=None, segs=30, rmax=.8, seed=1, edge=.06, jit=.3, rjit=.25):
        rnd = random.Random(seed)
        en = _Noise(seed + 7, 3, 1.3)
        radii = radii or [rmax * i / 8 for i in range(1, 9)]
        verts = [(0.0, 0.0, hfn(0.0, 0.0))]
        rings = []
        prev = 0.0
        for i, r0 in enumerate(radii):
            last = i == len(radii) - 1
            ring = []
            for k in range(segs):
                a = 2 * math.pi * (k + (0 if last else rnd.uniform(-jit, jit))) / segs
                ca, sa = math.cos(a), math.sin(a)
                shrink = 1 - edge * (.5 + .5 * en(ca, sa)) * (r0 / rmax) ** 2
                rr = r0 * shrink + (0 if last else rnd.uniform(-rjit, rjit) * (r0 - prev))
                x, y = rr * ca, rr * sa
                ring.append(len(verts))
                verts.append((x, y, 0.0 if last else hfn(x, y)))
            rings.append(ring)
            prev = r0
        tris = [(0, rings[0][k], rings[0][(k + 1) % segs]) for k in range(segs)]
        for i in range(len(rings) - 1):
            A, B = rings[i], rings[i + 1]
            for k in range(segs):
                k2 = (k + 1) % segs
                if (k + i) % 2:
                    tris += [(A[k], B[k], B[k2]), (A[k], B[k2], A[k2])]
                else:
                    tris += [(A[k], B[k], A[k2]), (A[k2], B[k], B[k2])]
        mats = []
        for t in tris:
            p = [Vector(verts[i]) for i in t]
            nrm = (p[1] - p[0]).cross(p[2] - p[0]).normalized()
            c = (p[0] + p[1] + p[2]) / 3
            mats.append(matfn(c.x, c.y, c.z, nrm))
        _emit(b, verts, tris, mats)
        self.bvh = BVHTree.FromPolygons(verts, tris)

    def __call__(self, x, y):
        hit = self.bvh.ray_cast(Vector((x, y, 5.0)), Vector((0, 0, -1)))
        return hit[0].z if hit[0] is not None else 0.0


def _ribbon(b, pts, widths, mat, thick=.012):
    """Flat strip (streams, paths) along [(x, y, z_top), ...]."""
    if isinstance(widths, (int, float)):
        widths = [widths] * len(pts)
    secs = []
    n = len(pts)
    for i, (x, y, z) in enumerate(pts):
        a, c = pts[max(i - 1, 0)], pts[min(i + 1, n - 1)]
        dx, dy = c[0] - a[0], c[1] - a[1]
        ln = math.hypot(dx, dy) or 1.0
        lx, ly = -dy / ln * widths[i] / 2, dx / ln * widths[i] / 2
        secs.append([(x - lx, y - ly, z - thick), (x + lx, y + ly, z - thick), (x + lx, y + ly, z),
                     (x - lx, y - ly, z)])
    _loft(b, secs, mat)


def _crystal(b, at, h, r, rot=(0, 0, 0), mat='EMISSIVE', spin=0.0, sides=6):
    """Pointy hexagonal crystal prism standing on `at` (bottom sunk slightly below)."""
    rings = [[polar(r * .9, spin + 360 / sides * k, -h * .12) for k in range(sides)],
             [polar(r, spin + 360 / sides * k, h * .62) for k in range(sides)], [(0, 0, h)]]
    _loft(b, rings, mat, place(at, rot))


def _cluster(b, at, s, seed, mats=('EMISSIVE', 'crystal', 'crystal_deep'), n=5, lean=0.0, lean_dir=0.0):
    """Crystal cluster: one tall hero spire plus shorter satellites splaying outward."""
    rnd = random.Random(seed)
    x, y, z = at
    _crystal(b, (x, y, z), .3 * s, .05 * s, rot=(0, lean, lean_dir), mat=mats[0], spin=rnd.uniform(0, 60))
    for i in range(n):
        a = 360 * i / n + rnd.uniform(-20, 20)
        ox, oy, _ = polar(.035 * s, a)
        h = rnd.uniform(.11, .2) * s
        _crystal(b, (x + ox, y + oy, z), h, rnd.uniform(.022, .034) * s, rot=(0, rnd.uniform(24, 44) + lean * .5, a),
                 mat=mats[1 + i % (len(mats) - 1)], spin=rnd.uniform(0, 60))


def _dot(b, at, r, mat):
    """Tiny 8-tri octahedron (flowers, berries, fireflies)."""
    b.sphere(r, at, mat, segs=4, rings=2, smooth=False)


def _stone(b, at, r, mat, seed, scale=(1.2, 1, .7), subdiv=1, jitter=.2):
    b.ico(r, at, mat, subdiv, jitter, seed, scale=scale, rot=(0, 0, random.Random(seed).uniform(0, 360)))


# ---------------------------------------------------------------------------------------------- sky arch

_STRATA = ['nat_rust', 'nat_redrock', 'nat_redrock', 'nat_orange', 'nat_redrock', 'nat_rust', 'nat_cream',
           'nat_orange', 'nat_redrock', 'nat_redrock', 'nat_rust', 'nat_orange', 'nat_redrock', 'nat_orange',
           'nat_redrock', 'nat_cream', 'nat_orange', 'nat_orange', 'nat_cream']


def _oct(xa, xb, t, yc, z):
    cw = min((xb - xa) * .3, t * .55, .045)
    return [(xa + cw, yc - t, z), (xb - cw, yc - t, z), (xb, yc - t + cw, z), (xb, yc + t - cw, z),
            (xb - cw, yc + t, z), (xa + cw, yc + t, z), (xa, yc + t - cw, z), (xa, yc - t + cw, z)]


def _hoodoo(b, at, h, s, seed):
    rnd = random.Random(seed)
    x, y, z = at
    zs = [z - .01]
    while zs[-1] < z + h:
        zs.append(zs[-1] + rnd.uniform(.03, .05) * s)
    zs[-1] = z + h
    for i in range(len(zs) - 1):
        t0, t1 = (zs[i] - z) / h, (zs[i + 1] - z) / h
        w = lambda t: s * (.055 - .02 * math.sin(t * math.pi * 1.2) + .01 * (1 - t))  # noqa: E731
        k = rnd.uniform(0, 60)
        rings = [[polar(w(t0) * (1 + .12 * math.cos(3 * math.radians(60 * j + k))), 60 * j + k, zs[i])
                  for j in range(6)],
                 [polar(w(t1) * .93, 60 * j + k, zs[i + 1]) for j in range(6)]]
        _loft(b, rings, _STRATA[(i + seed) % len(_STRATA)], place((x, y, 0)))
    _stone(b, (x, y, z + h + .012 * s), .05 * s, 'nat_rust', seed, scale=(1.3, 1.1, .5), subdiv=1, jitter=.15)


def sky_arch(b):
    rnd = random.Random(3)
    rot = 14.0
    ca, sa = math.cos(math.radians(rot)), math.sin(math.radians(rot))
    legs = [(-.56 * ca, -.56 * sa), (.52 * ca, .52 * sa)]
    stream = [(.1, .6), (.04, .36), (-.04, .12), (.02, -.1), (-.06, -.3), (-.2, -.46)]
    n = _Noise(5, 4, 3.0)

    def hfn(x, y):
        z = .024 + .012 * n(x, y)
        for lx, ly in legs:
            z += .075 * max(0.0, 1 - math.hypot(x - lx, y - ly) / .34) ** 1.5
        d = _path_dist((x, y), stream)
        if d < .12:
            z = z + (.012 - z) * _smooth((.12 - d) / .06)
        return z * _falloff(x, y)

    def mat(x, y, z, nrm):
        if nrm.z < .82:
            return 'nat_redrock' if n(x * 1.5, y * 1.5) > -.2 else 'nat_rust'
        v = n(x * 1.3 + 4, y * 1.3)
        return 'nat_sage' if v > .42 else ('nat_orange' if v < -.6 else 'nat_redsand')

    g = _Ground(b, hfn, mat, segs=34, seed=5)
    # --- the arch: horizontal strata slabs following an elliptical ring (outer) minus an elliptical opening
    AoL, AoR, Bo, AiL, AiR, Bi = .66, .62, .87, .35, .33, .6
    zs = [0, .06, .1, .17, .22, .26, .32, .38, .42, .48, .53, .57, .6, .66, .71, .75, .8, .84, .87]

    def xo(z, A):
        return max(.075, A * math.sqrt(max(0.0, 1 - (z / Bo) ** 2))) + .06 * max(0.0, 1 - z / .18)

    def xi(z, A):
        return A * math.sqrt(max(0.0, 1 - (z / Bi) ** 2)) - .03 * max(0.0, 1 - z / .15)

    def depth(z):
        return .15 - .055 * min(1.0, z / .6)

    def wob(z):
        return .02 * math.sin(z * 8 + 1)

    with b.xform(place((0, .02, 0), (0, 0, rot))):
        jit = [(rnd.uniform(-.012, .012), rnd.uniform(-.01, .01), rnd.uniform(-.018, .018), rnd.uniform(-.018, .018))
               for _ in zs]
        for i in range(len(zs) - 1):
            z0, z1 = zs[i], zs[i + 1]
            m = _STRATA[i]
            dt0, dy0, eL, eR = jit[i]
            ins = .007
            if z1 <= Bi + 1e-6:
                for side in (-1, 1):
                    Ao, Ai = (AoL, AiL) if side < 0 else (AoR, AiR)
                    a0 = xi(z0, Ai)
                    a1 = xi(z1, Ai) if z1 < Bi - 1e-6 else 0.0
                    b0, b1 = xo(z0, Ao), xo(z1, Ao) - ins
                    t0, t1 = depth(z0) + dt0, depth(z1) + dt0 - ins
                    if side < 0:
                        r0 = _oct(-b0 + wob(z0) - eL, -a0 + wob(z0), t0, dy0, z0 - (.02 if i == 0 else 0))
                        r1 = _oct(-b1 + wob(z1) - eL, -(a1 + (ins if a1 else 0)) + wob(z1), t1, dy0, z1)
                    else:
                        r0 = _oct(a0 + wob(z0), b0 + wob(z0) + eR, t0, dy0, z0 - (.02 if i == 0 else 0))
                        r1 = _oct(a1 + (ins if a1 else 0) + wob(z1), b1 + wob(z1) + eR, t1, dy0, z1)
                    _loft(b, [r0, r1], m)
            else:
                r0 = _oct(-xo(z0, AoL) + wob(z0) - eL, xo(z0, AoR) + wob(z0) + eR, depth(z0) + dt0, dy0, z0)
                r1 = _oct(-xo(z1, AoL) + ins + wob(z1) - eL, xo(z1, AoR) - ins + wob(z1) + eR,
                          depth(z1) + dt0 - ins, dy0, z1)
                _loft(b, [r0, r1], m)
        # scrub + tiny juniper clinging to the crown
        b.bush((-.06 + wob(.87), .0, .865), .8, seed=2, mat='nat_sage')
        b.tree_round((.05 + wob(.87), .01, .86), .42, seed=4, leaf='nat_juniper', leaf2='nat_sage')
    # talus rocks at the feet
    for li, (lx, ly) in enumerate(legs):
        for k in range(6):
            a = rnd.uniform(0, 360)
            rr = rnd.uniform(.18, .3)
            x, y = lx + math.cos(math.radians(a)) * rr, ly + math.sin(math.radians(a)) * rr * .8
            if math.hypot(x, y) > .72:
                continue
            _stone(b, (x, y, g(x, y) + .01), rnd.uniform(.03, .055), rnd.choice(('nat_rust', 'nat_redrock', 'rock')),
                   li * 10 + k, subdiv=1)
    # hoodoos
    for i, (x, y, h, s) in enumerate(((-.42, .42, .26, 1.1), (-.6, .2, .16, .85), (.5, -.38, .19, .95),
                                      (.3, .58, .13, .8), (.64, -.12, .1, .7))):
        _hoodoo(b, (x, y, g(x, y)), h, s, i + 2)
    # the stream: spring pool at the back, under the arch, pooling at the front
    _ribbon(b, [(x, y, .02) for x, y in stream], [.05, .07, .08, .08, .09, .1], 'WATER', thick=.014)
    b.water(.085, (.11, .62, .008), depth=.014, segs=9)
    b.water(.11, (-.22, -.48, .008), depth=.014, segs=10)
    for i, (x, y) in enumerate(((.2, .63), (.02, .66), (-.1, -.55), (-.33, -.42), (-.12, -.36))):
        _stone(b, (x, y, g(x, y) + .008), .028, 'rock_light', 40 + i, subdiv=1)
    # vegetation
    for i, (x, y, s) in enumerate(((-.22, .5, 1.0), (.62, .22, .9), (-.66, -.14, .85), (.2, -.62, .8))):
        b.tree_round((x, y, g(x, y) - .005), s * .9, seed=i + 1, leaf='nat_juniper', leaf2='nat_sage')
    for i, (x, y, s) in enumerate(((.1, .72, 1.0), (.44, .44, 1.1), (-.34, .66, .9))):
        b.tree_pine((x, y, g(x, y) - .005), s, leaf='nat_juniper')
    for i in range(12):
        a = rnd.uniform(0, 360)
        rr = rnd.uniform(.25, .72)
        x, y, _ = polar(rr, a)
        if _path_dist((x, y), stream) < .1:
            continue
        b.bush((x, y, g(x, y) - .006), rnd.uniform(.5, .85), seed=i, mat='nat_sage' if i % 3 else 'foliage')
    for i, (x, y) in enumerate(((.1, -.18), (-.14, .22), (.16, .08))):
        b.bush((x, y, g(x, y) - .004), .45, seed=i + 30, mat='foliage_light')


# ---------------------------------------------------------------------------------------------- ember peak

def ember_peak(b):
    b.overrides['EMISSIVE'] = {'color': '#b84a08', 'emit': 4.0}
    rnd = random.Random(11)
    RIM, HR, FLOOR, R0 = .17, .66, .56, .8
    n = _Noise(12, 4, 3.0)
    jag = _Noise(13, 3, 2.0)
    sun = Vector((-.47, -.6, .64)).normalized()

    def hfn(x, y):
        r = math.hypot(x, y)
        th = math.atan2(y, x)
        if r <= RIM * .75:
            return FLOOR
        if r <= RIM * 1.02:
            t = (r - RIM * .75) / (RIM * .27)
            return FLOOR + (HR - FLOOR) * t ** 1.5 + .05 * max(0.0, math.sin(5 * th + 1)) * t + .015 * jag(x * 9, y * 9)
        t = min(1.0, (r - RIM) / (R0 - RIM))
        z = HR * (1 - t) ** 1.6
        ridge = 1 - abs(math.sin(3.5 * th + .8 * n(x, y)))
        z += .06 * (ridge - .55) * math.sin(math.pi * min(1.0, t * 1.15))
        z += .01 * n(x * 2, y * 2) * (1 - t)
        return max(.004, z) * _falloff(x, y, .64, .82)

    def mat(x, y, z, nrm):
        r = math.hypot(x, y)
        if r < RIM * 1.1:
            return 'nat_basalt'
        v = n(x * 1.4, y * 1.4 + 2)
        lit = nrm.dot(sun) > .72
        if r > .66 and nrm.z > .8:
            return 'grass_dark' if v > -.3 else 'nat_moss'
        if z > .22:
            return 'nat_ash' if lit else ('nat_basalt' if v > -.3 else 'black')
        return 'nat_ash_light' if lit else 'nat_ash'

    radii = [.06, .1, RIM * .8, RIM, RIM * 1.25, .27, .34, .42, .5, .58, .65, .72, R0]
    g = _Ground(b, hfn, mat, radii=radii, segs=30, seed=12, rjit=.1, jit=.2, edge=.05)
    # molten crater pool + jagged teeth on the rim
    b.cyl(RIM * .86, .02, (0, 0, FLOOR - .004), 'EMISSIVE', segs=12)
    for i in range(9):
        a = i * 40 + rnd.uniform(-12, 12)
        x, y, _ = polar(RIM * 1.02, a)
        h = rnd.uniform(.045, .09)
        b.cyl(.04, h, (x, y, g(x, y) - .02), 'nat_basalt', segs=4, r2=.004, start=rnd.uniform(0, 90),
              rot=(0, rnd.uniform(8, 22), a))
    # lava rivers down the flanks in dark crusted beds (front-right faces the camera)
    for ci, (a0, w, reach) in enumerate(((-62, 1.0, .66), (-104, .8, .58), (-26, .75, .5), (160, .9, .6),
                                         (68, .7, .52))):
        ph = rnd.uniform(0, 6)
        path = []
        r = RIM * .95
        while r < reach:
            a = math.radians(a0 + 10 * math.sin(r * 10 + ph))
            x, y = r * math.cos(a), r * math.sin(a)
            path.append((x, y, g(x, y) + .006))
            r += .04
        k_n = len(path)
        b.tube([(x, y, z - .006) for x, y, z in path], [(.046 - .016 * k / k_n) * w for k in range(k_n)], 'black',
               segs=6, flat=.3)
        b.tube(path, [(.037 - .015 * k / k_n) * w for k in range(k_n)], 'EMISSIVE', segs=6, flat=.35)
        ex, ey, _ = path[-1]
        b.ico(.066 * w, (ex, ey, g(ex, ey) - .004), 'black', 1, .15, ci + 40, scale=(1.3, 1.1, .2))
        b.ico(.056 * w, (ex, ey, g(ex, ey) + .004), 'EMISSIVE', 1, .15, ci, scale=(1.3, 1.1, .18))
        for k in range(2):
            ox, oy = rnd.uniform(-.04, .04), rnd.uniform(-.04, .04)
            _stone(b, (ex + ox, ey + oy, g(ex + ox, ey + oy) + .012), .02, 'black', ci * 5 + k, subdiv=1)
    # cooled black lava boulders at the foot
    for i in range(18):
        a = rnd.uniform(0, 360)
        rr = rnd.uniform(.5, .72)
        x, y, _ = polar(rr, a)
        _stone(b, (x, y, g(x, y) + .008), rnd.uniform(.028, .055), 'black' if i % 3 else 'nat_basalt', 60 + i,
               scale=(1.3, 1, .65), subdiv=1)
    # life creeping back at the rim of the tile: shrubs + charred snags
    for i in range(9):
        a = rnd.uniform(0, 360)
        x, y, _ = polar(rnd.uniform(.66, .74), a)
        b.bush((x, y, g(x, y) - .006), rnd.uniform(.55, .8), seed=i, mat='foliage_dark' if i % 2 else 'nat_sage')
    for i, (x, y) in enumerate(((.62, .2), (-.55, -.4), (.35, -.62))):
        z = g(x, y) - .005
        b.tube([(x, y, z), (x + .01, y, z + .08), (x + .005, y + .01, z + .15)], [.012, .008, .004], 'wood_dark', 4)
        b.tube([(x + .01, y, z + .08), (x + .05, y - .01, z + .12)], [.005, .002], 'wood_dark', 4)
    # billowing ash column drifting back-right: dark at the vent, paler as it rises
    puffs = [(.0, .0, .7, .07, 'nat_smoke'), (.04, .05, .76, .075, 'nat_smoke'),
             (-.04, .05, .8, .065, 'nat_smoke_light'), (.1, .1, .82, .075, 'nat_smoke_light'),
             (.18, .15, .85, .065, 'nat_smoke_light'), (.06, .15, .86, .055, 'nat_smoke_light'),
             (.25, .22, .84, .06, 'nat_smoke_light')]
    for i, (x, y, z, r, m) in enumerate(puffs):
        b.ico(r, (x, y, z), m, 2, .08, i + 3, scale=(1.15, 1.1, .85))


# ---------------------------------------------------------------------------------------------- crystal falls

def crystal_falls(b):
    b.overrides['EMISSIVE'] = {'color': '#0a9fc4', 'emit': 3.2}
    rnd = random.Random(21)
    n = _Noise(22, 4, 3.0)
    XW = .02                       # waterfall centre x
    POOL = (.02, -.15)
    TOP = .52

    def yfront(x):
        return .08 - .24 * (x / .74) ** 2

    def hfn(x, y):
        d = math.hypot(x - POOL[0], (y - POOL[1]) * 1.1)
        z = .03 + .012 * n(x, y)
        if d < .34:
            z = z + (.006 - z) * _smooth((.34 - d) / .1)
        return z * _falloff(x, y)

    def gmat(x, y, z, nrm):
        v = n(x * 4, y * 4 + 3)
        if nrm.z < .85:
            return 'grass_dark'
        return 'grass' if v > -.25 else 'nat_moss'

    g = _Ground(b, hfn, gmat, segs=30, seed=22)
    # --- tiered cliff plateau (amphitheatre around the pool)
    tiers = ((0.0, .18, 0.0, 'nat_cliff_dark'), (.18, .36, .045, 'nat_cliff'), (.36, TOP, .08, 'nat_cliff_dark'))
    xs = [-.72 + 1.44 * k / 21 for k in range(22)]
    fj = [rnd.uniform(-.014, .014) + (.02 if k % 2 else -.012) for k in range(len(xs))]

    def footprint(inset, z, j=1.0, phase=0):
        pts = []
        for k, (x, f) in enumerate(zip(xs, fj)):
            notch = abs(x - XW) < .1
            f = fj[(k + phase) % len(fj)]
            y = yfront(x) + (.07 if notch else inset + f * j)
            xx = x * (1 - inset * .6)
            pts.append((xx, y, z))
        # back arc from the right end round to the left end
        ar = math.degrees(math.atan2(pts[-1][1], pts[-1][0]))
        al = math.degrees(math.atan2(pts[0][1], pts[0][0])) + 360
        for k in range(1, 8):
            a = ar + (al - ar) * k / 8
            pts.append(polar(.77 - inset * .5, a, z))
        return pts

    for ti, (z0, z1, ins, m) in enumerate(tiers):
        _loft(b, [footprint(ins, z0 - (.01 if z0 == 0 else 0), 1.0, ti),
                  footprint(ins + .012, z1, .7, ti)], m)
    # grass cap on the plateau
    _loft(b, [footprint(.075, TOP - .004, .6, 2), footprint(.09, TOP + .014, .5, 2)], 'grass')
    # river on top -> lip
    lip = yfront(XW) + .07
    _ribbon(b, [(XW + .08, .64, TOP + .022), (XW + .03, .4, TOP + .022), (XW, .2, TOP + .022), (XW, lip - .01, TOP + .022)],
            [.1, .12, .13, .15], 'WATER', thick=.014)

    # --- waterfall sheet
    def fall(u, v, off=0.0, w0=.15, w1=.2):
        w = w0 + (w1 - w0) * v
        if v < .22:
            t = v / .22
            y = lip - .045 * math.sin(t * math.pi / 2)
            z = TOP + .022 - .04 * (1 - math.cos(t * math.pi / 2))
        else:
            t = (v - .22) / .78
            y = lip - .045 - .03 * t
            z = TOP - .018 - (TOP - .03) * t
        return (XW + (u - .5) * w, y - off, z)

    b.surface(lambda u, v: fall(u, v), 4, 7, 'WATER', thickness=.012)
    for k, (cx, v0, v1) in enumerate(((-.045, .08, .9), (.012, .2, .97), (.05, .1, .75))):
        b.surface(lambda u, v, cx=cx, v0=v0, v1=v1: (lambda p: (XW + cx + (u - .5) * .014, p[1], p[2]))(
            fall(.5, v0 + (v1 - v0) * v, .02)), 1, 5, 'nat_foam', thickness=.004)
    # plunge pool, foam and mist
    b.water([(POOL[0] + math.cos(math.radians(a)) * .27 * (1 + .08 * math.sin(a * .07)),
              POOL[1] + math.sin(math.radians(a)) * .23) for a in range(0, 360, 30)], (0, 0, .012), depth=.016)
    fy = lip - .075
    for i in range(6):
        x = XW + (i - 2.5) * .04
        b.ico(.028 + .01 * (i % 2), (x, fy - rnd.uniform(0, .03), .035), 'nat_foam', 1, .15, i, scale=(1.2, 1, .6))
    for i, (x, y, z, r) in enumerate(((XW - .06, fy - .06, .09, .045), (XW + .07, fy - .05, .11, .04),
                                      (XW, fy - .1, .07, .04))):
        b.ico(r, (x, y, z), 'nat_foam', 1, .12, i + 10, scale=(1.2, 1, .8))
    # hanging moss down the cliff
    for x in (-.4, -.18, .24, .46):
        y0 = yfront(x) + .08
        b.surface(lambda u, v, x=x, y0=y0: (x + (u - .5) * .05 * (1 - v * .6), y0 - .006 - .004 * v, TOP + .01 - .16 * v),
                  1, 3, 'vine', thickness=.006)
    # crystal clusters: towering on top, jutting from ledges, spilling by the pool
    _cluster(b, (-.4, .34, TOP), 1.25, 1, ('EMISSIVE', 'crystal_deep', 'nat_amethyst', 'crystal_deep'), n=6)
    _cluster(b, (.42, .32, TOP), .95, 2, ('EMISSIVE', 'crystal_deep', 'nat_amethyst'), n=5)
    _cluster(b, (-.1, .5, TOP), .6, 3, ('crystal_deep', 'EMISSIVE', 'nat_amethyst'), n=3)
    for i, (x, tier_z, ins, s) in enumerate(((-.38, .18, .05, .75), (.36, .18, .05, .7), (.22, .36, .09, .55),
                                             (-.24, .36, .09, .5))):
        _cluster(b, (x, yfront(x) + ins - .02, tier_z - .01), s, 10 + i, ('EMISSIVE', 'crystal_deep', 'nat_amethyst'),
                 n=4, lean=-30, lean_dir=-90)
    # a great crystal vein bursting out of the cliff beside the falls
    _cluster(b, (-.17, yfront(-.17) - .01, .06), .85, 15, ('EMISSIVE', 'crystal_deep', 'nat_amethyst'),
             n=5, lean=-42, lean_dir=-80)
    for i, (x, y, s) in enumerate(((.38, -.4, .6), (-.36, -.44, .45), (.52, -.22, .35))):
        _cluster(b, (x, y, g(x, y) - .01), s, 20 + i, ('EMISSIVE', 'crystal_deep', 'nat_amethyst'), n=4)
    # mossy boulders ringing the pool
    for i in range(9):
        a = -170 + i * 20 + rnd.uniform(-6, 6)
        x, y = POOL[0] + math.cos(math.radians(a)) * .3, POOL[1] + math.sin(math.radians(a)) * .26
        _stone(b, (x, y, g(x, y) + .012), rnd.uniform(.03, .05), 'moss_stone' if i % 2 else 'rock', 30 + i)
    # trees
    for i, (x, y, s) in enumerate(((.1, .64, 1.0), (-.26, .62, 1.15), (.26, .56, .85))):
        b.tree_pine((x, y, TOP + .01), s)
    for i, (x, y, s) in enumerate(((-.6, -.3, 1.0), (.64, -.3, .9), (-.24, -.64, .8))):
        b.tree_round((x, y, g(x, y) - .005), s, seed=i + 4)
    for i, (x, y) in enumerate(((.15, -.58), (-.5, -.5), (.58, -.44))):
        b.bush((x, y, g(x, y) - .004), .8, seed=i + 7, mat='foliage_light')


# ---------------------------------------------------------------------------------------------- elder tree

def _lantern(b, at, s=1.0):
    x, y, z = at
    b.cyl(.03 * s, .02 * s, (x, y, z), 'stone_dark', segs=6)
    b.cyl(.012 * s, .05 * s, (x, y, z + .02 * s), 'stone', segs=6)
    b.box((.04 * s, .04 * s, .008 * s), (x, y, z + .07 * s), 'stone_dark')
    b.box((.026 * s, .026 * s, .03 * s), (x, y, z + .078 * s), 'EMISSIVE')
    for dx, dy in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
        b.box((.008 * s, .008 * s, .03 * s), (x + dx * .015 * s, y + dy * .015 * s, z + .078 * s), 'stone')
    b.cyl(.04 * s, .025 * s, (x, y, z + .108 * s), 'stone_dark', segs=6, r2=.008 * s)
    b.sphere(.008 * s, (x, y, z + .138 * s), 'stone', segs=5, rings=3, smooth=False)


def elder_tree(b):
    b.overrides['EMISSIVE'] = {'color': '#b8700f', 'emit': 4.0}
    rnd = random.Random(31)
    n = _Noise(32, 4, 3.0)
    CX, CY = .0, .05

    def hfn(x, y):
        d = math.hypot(x - CX, y - CY)
        return (.03 + .03 * max(0.0, 1 - d / .45) + .01 * n(x, y)) * _falloff(x, y)

    def gmat(x, y, z, nrm):
        v = n(x * 1.4 + 1, y * 1.4)
        if nrm.z < .86:
            return 'grass_dark'
        return 'nat_moss' if v > .4 else ('grass_dark' if v < -.45 else 'grass')

    g = _Ground(b, hfn, gmat, segs=28, seed=32)
    # --- gnarled twisting trunk (5 lobes spiralling up)
    lv = [(-.02, .23), (.04, .17), (.1, .14), (.18, .12), (.26, .112), (.34, .11), (.42, .115), (.5, .128),
          (.57, .14)]
    rings = []
    for z, r in lv:
        cx = CX + .025 * math.sin(z * 7)
        cy = CY + .015 * math.cos(z * 6)
        tw = z * 150
        rings.append([(cx + r * (1 + .17 * math.cos(math.radians(5 * (a - tw)))) * math.cos(math.radians(a)),
                       cy + r * (1 + .17 * math.cos(math.radians(5 * (a - tw)))) * math.sin(math.radians(a)), z)
                      for a in range(0, 360, 30)])
    _loft(b, rings, 'bark_old')
    # a glowing spirit hollow in the trunk above the root flare, facing the viewer
    arch = [(-.04, 0), (.04, 0), (.04, .075), (.024, .11), (0, .125), (-.024, .11), (-.04, .075)]
    hz = .24
    hcx, hcy = CX + .025 * math.sin(hz * 7), CY + .015 * math.cos(hz * 6)
    hx, hy, _ = polar(.142, -50)
    b.decal(arch, (hcx + hx, hcy + hy, hz), 'wood_dark', rot=(90, 0, 40))
    hx, hy, _ = polar(.147, -50)
    b.decal([(x * .6, y * .62 + .014) for x, y in arch], (hcx + hx, hcy + hy, hz), 'EMISSIVE', rot=(90, 0, 40))
    tx, ty = CX + .025 * math.sin(.57 * 7), CY + .015 * math.cos(.57 * 6)
    # buttress roots (tall thin fins), some arching over boulders
    for i in range(8):
        a = i * 45 + 20 + rnd.uniform(-10, 10)
        ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
        over = i in (1, 4, 6)
        L = rnd.uniform(.38, .46) if not over else .5
        prof = [(.1, .2), (.18, .13), (.27, .07), (L * .82, .035), (L, .0)]
        if over:
            prof = [(.1, .2), (.18, .13), (.27, .1), (.36, .105), (.45, .06), (.52, .0)]
            rx, ry = CX + ca * .38, CY + sa * .38
            _stone(b, (rx, ry, g(rx, ry) + .01), .06, 'moss_stone', 70 + i, scale=(1.1, 1, .8))
        path = []
        for rr, zz in prof:
            x, y = CX + ca * rr, CY + sa * rr
            path.append((x, y, zz + (g(x, y) if zz < .05 else 0)))
        b.tube(path, [.055, .045, .034, .024, .014][:len(path)] + [.011] * (len(path) - 5), 'bark_old', segs=4,
               flat=1.9)
    # boughs into the canopy
    tiers = []
    for i in range(7):
        a = i * 360 / 7 + 15 + rnd.uniform(-10, 10)
        rr = rnd.uniform(.4, .45)
        tiers.append((a, rr, .67 + rnd.uniform(-.02, .02), .2, 'foliage_dark'))
        ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
        path = [(tx + ca * .03, ty + sa * .03, .5), (tx + ca * .15, ty + sa * .15, .59),
                (tx + ca * .27, ty + sa * .27, .635), (tx + ca * rr * .88, ty + sa * rr * .88, .65)]
        b.tube(path, [.065, .045, .03, .02], 'bark_old', segs=6)
    for i in range(4):
        a = i * 90 + 50 + rnd.uniform(-10, 10)
        tiers.append((a, rnd.uniform(.2, .24), .77, .19, 'foliage'))
    for i in range(2):
        tiers.append((i * 180 + 100, .07, .845, .15, 'foliage_light'))
    for i, (a, rr, z, r, m) in enumerate(tiers):
        x, y = tx + math.cos(math.radians(a)) * rr, ty + math.sin(math.radians(a)) * rr
        b.ico(r, (x, y, z), m, 2, .14, i, scale=(1.3, 1.3, .52))
    # hanging vines from the lower canopy
    for i in range(14):
        a = i * 360 / 14 + rnd.uniform(-10, 10)
        rr = rnd.uniform(.38, .55)
        x, y = tx + math.cos(math.radians(a)) * rr, ty + math.sin(math.radians(a)) * rr
        top = .61
        L = rnd.uniform(.12, .28)
        b.tube([(x, y, top), (x + .006, y, top - L * .5), (x, y + .004, top - L)], [.008, .007, .005], 'vine', segs=3)
        _dot(b, (x, y + .004, top - L), .016, 'foliage_light')
    # shrine + torii + stone lanterns on the path at the front roots
    sx, sy = .1, -.36
    zs = g(sx, sy)
    b.box((.13, .1, .03), (sx, sy, zs - .01), 'stone', bevel=.004)
    b.box((.07, .055, .06), (sx, sy, zs + .02), 'timber')
    b.box((.03, .006, .03), (sx, sy - .03, zs + .03), 'EMISSIVE')
    b.gable(.1, .09, .045, (sx, sy, zs + .08), 'roof_tile_dark', overhang=.01)
    b.box((.12, .012, .006), (sx, sy, zs + .125), 'gold')
    # torii
    tx0, ty0 = .02, -.58
    zt = g(tx0, ty0)
    for dx in (-.055, .055):
        b.cyl(.009, .13, (tx0 + dx, ty0, zt - .01), 'red', segs=6)
    b.box((.16, .018, .014), (tx0, ty0, zt + .118), 'wood_dark', taper=1.0)
    b.box((.13, .012, .01), (tx0, ty0, zt + .09), 'red')
    # stepping stones
    for i, (x, y) in enumerate(((.03, -.66), (.045, -.5), (.07, -.44))):
        b.cyl(.025, .01, (x, y, g(x, y) - .004), 'stone_light', segs=6, start=i * 13)
    _lantern(b, (-.08, -.47, g(-.08, -.47) - .006), .95)
    _lantern(b, (.24, -.44, g(.24, -.44) - .006), .85)
    # paper lanterns hanging from the boughs + fireflies
    for i, (a, rr) in enumerate(((-70, .3), (-120, .34), (-20, .36))):
        x, y = tx + math.cos(math.radians(a)) * rr, ty + math.sin(math.radians(a)) * rr
        b.tube([(x, y, .61), (x, y, .5)], .002, 'wood_dark', segs=3)
        b.sphere(.022, (x, y, .485), 'EMISSIVE', segs=6, rings=4, smooth=False, scale=(1, 1, 1.2))
    for i in range(10):
        a = rnd.uniform(0, 360)
        rr = rnd.uniform(.25, .6)
        x, y = tx + math.cos(math.radians(a)) * rr, ty + math.sin(math.radians(a)) * rr
        b.sphere(.007, (x, y, rnd.uniform(.12, .45)), 'EMISSIVE', segs=4, rings=2, smooth=False)
    # forest floor: ferns, flowers, mushrooms, mossy rocks
    for i in range(10):
        a = rnd.uniform(0, 360)
        rr = rnd.uniform(.45, .72)
        x, y, _ = polar(rr, a)
        b.bush((x, y, g(x, y) - .006), rnd.uniform(.6, 1.0), seed=i, mat='foliage' if i % 2 else 'foliage_light')
    for i in range(14):
        a = rnd.uniform(0, 360)
        rr = rnd.uniform(.3, .74)
        x, y, _ = polar(rr, a)
        _dot(b, (x, y, g(x, y) + .006), .011, ('flower_y', 'blossom', 'shell_white')[i % 3])
    for i, (x, y) in enumerate(((-.3, -.3), (-.26, -.36), (.34, -.2))):
        z = g(x, y)
        b.cyl(.005, .02, (x, y, z - .004), 'bone', segs=4)
        b.dome(.016, .012, (x, y, z + .014), 'flower_r', segs=6, rings=2, smooth=False)
    for i, (x, y) in enumerate(((-.5, .3), (.55, .2), (-.6, -.15), (.45, -.52))):
        _stone(b, (x, y, g(x, y) + .01), .045, 'moss_stone', 90 + i)


# ---------------------------------------------------------------------------------------------- titan bones

def _femur(b, p0, p1, r, mat='bone'):
    b.tube([p0, p1], [r, r], mat, segs=5)
    for p in (p0, p1):
        b.ico(r * 1.9, p, mat, 1, .1, int(p[0] * 100), scale=(1, 1, .8))


def titan_bones(b):
    rnd = random.Random(41)
    n = _Noise(42, 4, 3.0)
    SUN = Vector((-.47, -.6, .64)).normalized()
    spine = [(-.1, -.2), (-.03, -.06), (.03, .08), (.1, .22), (.2, .36), (.33, .48), (.46, .55)]
    skull_at = (-.1, -.38)

    def hfn(x, y):
        ph = (x * .6 + y * .8) * 8 + 1.2 * n(x, y) * 2
        ph += .6 * math.sin(ph)
        dune = 1 - abs(math.sin(ph / 2))
        z = .03 + .05 * dune ** 1.5 + .008 * n(x * 2, y * 2)
        z += .03 * max(0.0, 1 - _path_dist((x, y), spine) / .16)
        z += .05 * max(0.0, 1 - math.hypot(x - skull_at[0], y - skull_at[1]) / .25)
        return z * _falloff(x, y, .5, .8)

    def gmat(x, y, z, nrm):
        return 'sand_dark' if nrm.dot(SUN) < .6 else 'sand'

    g = _Ground(b, hfn, gmat, segs=34, seed=42)
    # --- spine: vertebrae half-sunk along an S-curve
    pts = []
    for i in range(len(spine) - 1):
        for k in range(3):
            t = k / 3
            pts.append((spine[i][0] + (spine[i + 1][0] - spine[i][0]) * t,
                        spine[i][1] + (spine[i + 1][1] - spine[i][1]) * t))
    pts.append(spine[-1])
    N = len(pts)
    for i, (x, y) in enumerate(pts):
        a, c = pts[max(i - 1, 0)], pts[min(i + 1, N - 1)]
        ang = math.degrees(math.atan2(c[1] - a[1], c[0] - a[0]))
        s = 1.0 - .55 * i / N
        z = g(x, y)
        b.ico(.034 * s, (x, y, z + .004), 'bone', 1, .08, i, scale=(.8, 1.3, .8), rot=(0, 0, ang))
        b.box((.012 * s, .1 * s, .012 * s), (x, y, z - .004), 'bone_shade', rot=(0, 0, ang))
        b.cone(.014 * s, .05 * s, (x, y, z + .01), 'bone', segs=4, rot=(0, 0, ang))
    # --- ribcage: pairs of great arching ribs curling up and inward
    for pi_, (idx, f) in enumerate(((3, .78), (5, .95), (7, 1.0), (9, .95), (11, .8), (13, .6))):
        x, y = pts[idx]
        a, c = pts[idx - 1], pts[idx + 1]
        tx_, ty_ = c[0] - a[0], c[1] - a[1]
        ln = math.hypot(tx_, ty_)
        tx_, ty_ = tx_ / ln, ty_ / ln
        nx, ny = -ty_, tx_
        z0 = g(x, y)
        for side in (-1, 1):
            if pi_ == 5 and side > 0:
                prof = [(.03, .01), (.12, .08), (.18, .17)]            # snapped rib
            else:
                prof = [(.03, .01), (.13, .07), (.22, .17), (.26, .29), (.24, .4), (.17, .48), (.08, .52), (.03, .51)]
            path = []
            for k, (L, Z) in enumerate(prof):
                back = -.05 * k / 6 * f
                path.append((x + side * nx * L * f + tx_ * back, y + side * ny * L * f + ty_ * back,
                             z0 - .01 + Z * f))
            radii = [.034 * f - .02 * f * k / (len(prof) - 1) for k in range(len(prof))]
            b.tube(path, radii, 'bone' if pi_ % 2 == 0 or side < 0 else 'bone_shade', segs=6)
    # --- the skull, snout towards the camera, jaw sunk in the dune
    zsk = g(*skull_at) - .02
    with b.xform(place((skull_at[0], skull_at[1], zsk), (0, 0, -75), 1.2)):
        b.ico(.12, (-.03, 0, .1), 'bone', 2, .05, 3, scale=(1.25, 1.0, .85))
        b.ico(.05, (.04, 0, .175), 'bone_shade', 1, .1, 4, scale=(1.4, 2.2, .5))          # brow ridge
        # snout lofted along +X
        snout = []
        for sx_, w, h, zc in ((.03, .085, .07, .1), (.14, .07, .055, .085), (.24, .05, .04, .07), (.3, .035, .028, .062)):
            snout.append([(sx_, w * math.cos(math.radians(a)), zc + h * math.sin(math.radians(a)))
                          for a in range(0, 360, 45)])
        _loft(b, snout, 'bone')
        for sy in (-1, 1):
            b.ico(.035, (.07, sy * .075, .135), 'black', 1, .05, 5, scale=(.7, .6, .8))     # eye sockets
            b.ico(.012, (.29, sy * .016, .09), 'black', 0)                              # nostrils
            for k in range(4):
                b.cone(.012, .045, (.1 + k * .055, sy * (.058 - k * .008), .05), 'bone_shade', segs=4, rot=(180, 0, 0))
            # horns: sweep back, out, up, then hook forward
            hp = [(-.06, sy * .07, .16), (-.14, sy * .13, .22), (-.18, sy * .19, .33), (-.14, sy * .23, .44),
                  (-.05, sy * .24, .5), (.02, sy * .22, .5)]
            b.tube(hp, [.042, .036, .028, .02, .012, .004], 'nat_horn', segs=7)
            # lower jaw
            b.tube([(-.02, sy * .07, .02), (.14, sy * .06, .02), (.26, sy * .03, .03)], [.024, .02, .016], 'bone_shade',
                   segs=5)
            for k in range(3):
                b.cone(.011, .035, (.1 + k * .06, sy * (.055 - k * .01), .03), 'bone', segs=4)
    # scattered bones, rocks, cacti, dead shrubs
    _femur(b, (.42, -.14, g(.42, -.14) + .02), (.6, -.04, g(.6, -.04) + .015), .017)
    _femur(b, (-.58, .16, g(-.58, .16) + .015), (-.46, .3, g(-.46, .3) + .01), .013, 'bone_shade')
    b.tube([(.28, -.46, g(.28, -.46) - .01), (.32, -.48, .1), (.4, -.46, .16), (.46, -.42, .17)],
           [.03, .024, .014, .004], 'bone', segs=6)                                  # tusk/claw out of the sand
    for i, (x, y) in enumerate(((-.12, .5), (.62, .1), (-.62, -.2), (.28, -.66), (-.3, .62))):
        b.ico(.02, (x, y, g(x, y) + .008), 'bone_shade', 1, .1, i, scale=(1.4, .9, .8))
    for i, (x, y, s) in enumerate(((.55, -.46, 1.0), (-.36, -.56, .8), (.1, .66, 1.1), (-.66, -.02, .9),
                                   (.66, .3, .7), (-.46, -.3, .6))):
        _stone(b, (x, y, g(x, y) + .012), .05 * s, 'sandstone_dark' if i % 2 else 'nat_redrock', 50 + i)
    for i, (x, y, s) in enumerate(((.62, .2, 1.0), (-.52, .42, .8), (.16, -.64, .7))):
        z = g(x, y) - .01
        b.tube([(x, y, z), (x, y, z + .2 * s)], [.022 * s, .02 * s], 'nat_cactus', segs=7)
        b.sphere(.02 * s, (x, y, z + .2 * s), 'nat_cactus', segs=7, rings=3, smooth=False)
        for side, h in ((-1, .08), (1, .12)):
            arm = [(x, y, z + h * s), (x + side * .045 * s, y, z + (h + .01) * s), (x + side * .05 * s, y, z + (h + .07) * s)]
            b.tube(arm, [.014 * s, .013 * s, .012 * s], 'nat_cactus', segs=6)
    for i, (x, y) in enumerate(((-.38, .3), (.42, .66), (-.56, -.44), (.62, -.3))):
        z = g(x, y) - .005
        for k in range(4):
            a = k * 90 + rnd.uniform(-30, 30)
            ox, oy, _ = polar(.05, a)
            b.tube([(x, y, z), (x + ox * .5, y + oy * .5, z + .04), (x + ox, y + oy, z + .07)], [.005, .004, .002],
                   'wood_dark', segs=3)


# ---------------------------------------------------------------------------------------------- mirror lake

def _pillar(b, at, h=.3, broken=False, seed=0, vine=False):
    rnd = random.Random(seed)
    x, y, z = at
    tilt = (rnd.uniform(-2.5, 2.5), rnd.uniform(-2.5, 2.5), rnd.uniform(0, 45))
    with b.xform(place((x, y, z), tilt)):
        b.box((.12, .12, .035), (0, 0, -.01), 'stone')
        b.box((.1, .1, .012), (0, 0, .025), 'marble_shade')
        sh = h * (.72 if broken else 1)
        drums = (0, .3, .64, 1.0)
        for k in range(3):
            z0, z1 = sh * drums[k], sh * drums[k + 1]
            r0, r1 = .044 - .007 * drums[k], .044 - .007 * drums[k + 1]
            if broken and k == 2:
                break
            b.cyl(r0, z1 - z0 - .003, (0, 0, .04 + z0), 'marble_shade' if k == 0 else 'marble', segs=8, r2=r1,
                  start=rnd.uniform(0, 45))
        if broken:
            sh = sh * drums[2]
            for k in range(4):
                a = k * 90 + rnd.uniform(-10, 10)
                px, py, _ = polar(.016, a)
                b.cone(.018, rnd.uniform(.015, .045), (px, py, .04 + sh - .006), 'marble', segs=4,
                       start=rnd.uniform(0, 90))
        else:
            top = .04 + sh
            b.cyl(.037, .022, (0, 0, top), 'marble_shade', segs=8, r2=.056)
            b.box((.12, .12, .022), (0, 0, top + .022), 'marble')
            b.box((.1, .1, .014), (0, 0, top + .044), 'gold')
            b.cyl(.04, .036, (0, 0, top + .058), 'gold', segs=4, r2=.0, start=45)
        if vine:
            path = [(.047 * math.cos(t * 2.2), .047 * math.sin(t * 2.2), .04 + t * sh * .22) for t in range(5)]
            b.tube(path, .007, 'vine', segs=4)
            for p in path[1::2]:
                _dot(b, p, .014, 'foliage_light')


def mirror_lake(b):
    from wonders_lib import _tb_lathe
    b.overrides['EMISSIVE'] = {'color': '#bfeaff', 'emit': 3.2}
    rnd = random.Random(51)
    n = _Noise(52, 4, 3.0)
    LR = .42

    def hfn(x, y):
        r = math.hypot(x, y)
        z = .036 + .01 * n(x, y) + .012 * max(0.0, 1 - abs(r - .64) / .12)
        if r < .52:
            z = z + (.02 - z) * _smooth((.52 - r) / .06)
        return z * _falloff(x, y, .66, .82)

    def gmat(x, y, z, nrm):
        v = n(x * 1.5 + 2, y * 1.5)
        if nrm.z < .88:
            return 'grass_dark'
        return 'grass' if v > -.35 else 'grass_dark'

    radii = [.1, .2, .3, .4, .47, .53, .6, .67, .74, .8]
    g = _Ground(b, hfn, gmat, radii=radii, segs=28, seed=52, rjit=.1)
    # still water + a clean two-tone stone rim with gold inlay markers
    b.cyl(LR + .01, .024, (0, 0, .016), 'WATER', segs=24)
    for prof, m in (([(LR, .012), (LR + .08, .012), (LR + .08, .05), (LR, .05), (LR, .012)], 'stone'),
                    ([(LR - .006, .05), (LR + .086, .05), (LR + .08, .062), (LR, .062), (LR - .006, .05)],
                     'marble_shade')):
        b._add(_tb_lathe(prof, 24, 0, cap_bottom=False, cap_top=False), Matrix.Identity(4), m)
    # pillars
    for i in range(8):
        a = 22.5 + 45 * i
        x, y, _ = polar(.64, a)
        broken = i in (2, 5)
        _pillar(b, (x, y, g(x, y) - .004), .3, broken, seed=i, vine=i in (0, 3, 6))
        gx, gy, _ = polar(LR + .04, a)
        b.cyl(.016, .004, (gx, gy, .06), 'EMISSIVE', segs=4, start=a)
    # fallen drums near the broken pillars
    for i, a in enumerate((22.5 + 90 + 14, 22.5 + 225 - 12)):
        x, y, _ = polar(.71, a)
        b.cyl(.033, .07, (x, y, g(x, y) + .03), 'marble', segs=8, rot=(90, 0, a + 60))
    # islet with the glowing heart-stone
    b.ico(.075, (0, 0, .02), 'rock', 1, .18, 3, scale=(1.2, 1.1, .45))
    b.ico(.06, (0, 0, .042), 'grass', 1, .12, 4, scale=(1.15, 1.05, .25))
    _crystal(b, (.0, .0, .045), .15, .026, rot=(0, 5, 20), mat='EMISSIVE', sides=5)
    _crystal(b, (.03, -.02, .045), .06, .015, rot=(0, 30, -40), mat='EMISSIVE', sides=5)
    b.torus(.06, .005, (0, 0, .13), 'gold', segs=14, rsegs=4, rot=(14, 8, 0))
    # lily pads and reeds
    for i in range(7):
        a = rnd.uniform(0, 360)
        rr = rnd.uniform(.14, .34)
        x, y, _ = polar(rr, a)
        r = rnd.uniform(.02, .032)
        b.cyl(r, .004, (x, y, .039), 'nat_lily', segs=6, start=rnd.uniform(0, 50))
        if i % 3 == 0:
            b.cone(.01, .014, (x, y, .042), 'blossom', segs=5)
    for c, a in enumerate((200, 250, 30, 120)):
        cx_, cy_, _ = polar(LR - .05, a)
        for k in range(5):
            ox, oy = rnd.uniform(-.025, .025), rnd.uniform(-.025, .025)
            h = rnd.uniform(.07, .12)
            b.cone(.006, h, (cx_ + ox, cy_ + oy, .03), 'nat_reed', segs=4, rot=(rnd.uniform(-8, 8), rnd.uniform(-8, 8), 0))
            if k % 2 == 0:
                b.cyl(.006, .02, (cx_ + ox, cy_ + oy, .03 + h * .6), 'trunk', segs=3)
    # stepping-stone path from the front, trees and flowers on the banks
    for i, (x, y) in enumerate(((.02, -.54), (.07, -.62), (.03, -.71))):
        b.cyl(.03, .012, (x, y, g(x, y) - .004), 'stone_light', segs=6, start=i * 17)
    for i, (x, y, s) in enumerate(((-.28, .68, 1.2), (.36, .64, 1.0), (-.72, .1, .9))):
        b.tree_cypress((x, y, g(x, y) - .005), s)
    for i, (x, y, s) in enumerate(((.72, -.06, .9), (-.5, -.56, .8))):
        b.tree_round((x, y, g(x, y) - .005), s, seed=i)
    for i in range(14):
        a = rnd.uniform(0, 360)
        rr = rnd.uniform(.54, .76)
        x, y, _ = polar(rr, a)
        if i % 3 == 0:
            b.bush((x, y, g(x, y) - .004), .6, seed=i, mat='foliage_light')
        else:
            _dot(b, (x, y, g(x, y) + .006), .012, ('flower_y', 'blossom', 'shell_white')[i % 3])
    for i, (x, y) in enumerate(((.5, -.44), (-.62, -.3), (.2, .74))):
        _stone(b, (x, y, g(x, y) + .008), .035, 'moss_stone', 60 + i)


MODELS = {
    'nw_sky_arch': sky_arch,
    'nw_ember_peak': ember_peak,
    'nw_crystal_falls': crystal_falls,
    'nw_elder_tree': elder_tree,
    'nw_titan_bones': titan_bones,
    'nw_mirror_lake': mirror_lake,
}
