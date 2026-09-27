"""AEONS wonders — Ancient & Classical: pyramids, stonehenge, hanging_gardens, colossus, great_library, oracle.

Blender Z-up, front faces -Y. Every builder receives a wonders_lib.Builder `b`.
"""
import math
import random

from wonders_lib import PALETTE, place, polar

PALETTE.setdefault('anc_olive', ('#94a66b', .88, 0))
PALETTE.setdefault('anc_olive_dark', ('#6f8250', .9, 0))


def b_place(at, s):
    return place(at, (0, 0, 0), s)


def _pyramid(b, cx, cy, half, h, body='sandstone', cap='limestone', tip='gold', cap_from=.78):
    """Giza-style pyramid: sandstone core, surviving polished casing near the top, gilded pyramidion."""
    zc = h * cap_from
    hc = half * (1 - cap_from)
    b.cyl(half * math.sqrt(2), zc, (cx, cy, 0), body, segs=4, r2=hc * math.sqrt(2) + .004, start=45)
    b.cyl(hc * math.sqrt(2) + .006, h * .9 - zc, (cx, cy, zc), cap, segs=4, r2=half * .1 * math.sqrt(2), start=45)
    b.cyl(half * .1 * math.sqrt(2) + .002, h * .1, (cx, cy, h * .9), tip, segs=4, r2=0, start=45)
    # rubble skirt where the casing has fallen
    if half < .12:
        return
    rnd = random.Random(int(cx * 1000 + cy * 100))
    for k in range(3):
        side = rnd.choice((-1, 1))
        along = rnd.uniform(-half * .8, half * .8)
        x, y = (cx + along, cy + side * (half + .015)) if k % 2 else (cx + side * (half + .015), cy + along)
        b.rock((x, y, .03), .35 + rnd.random() * .25, seed=k + 3, mat='sandstone_dark')


def _sphinx(b, at, s=1.0):
    """Recumbent lion with a nemes headdress, facing -Y."""
    body, head = 'sandstone_dark', 'sandstone'
    with b.xform(b_place(at, s)):
        b.box((.075, .19, .05), (0, .03, 0), body, bevel=.012)
        b.ico(.05, (0, .09, .05), body, 1, 0, 0, scale=(.8, 1.1, .62))
        b.box((.07, .06, .07), (0, -.055, 0), body, bevel=.014)
        for dx in (-.022, .022):
            b.box((.02, .1, .018), (dx, -.12, 0), body, bevel=.006)
        b.box((.074, .05, .062), (0, -.062, .06), 'limestone', bevel=.008, taper=.62)
        b.box((.036, .034, .044), (0, -.085, .07), head, bevel=.006)
        b.cone(.012, .018, (0, -.08, .116), 'limestone', segs=4, start=45)
        b.tube([(.03, .12, .025), (.045, .06, .012), (.035, .0, .01)], .006, body, segs=4)


def _obelisk(b, x, y, h=.2, mat='granite'):
    b.box((.05, .05, .02), (x, y, .03), 'sandstone_dark', bevel=.004)
    b.box((.032, .032, h), (x, y, .05), mat, taper=.62)
    b.cone(.0145, .03, (x, y, .05 + h), 'gold', segs=4, start=45)


def _camel(b, at, facing=0.0, s=1.0):
    """Dromedary facing +X (rotated by `facing`), with a team-coloured saddle blanket."""
    with b.xform(place(at, (0, 0, facing), s)):
        m = 'clay'
        b.ico(.034, (0, 0, .052), m, 1, .04, 1, scale=(1.5, .8, .68))
        b.ico(.024, (-.004, 0, .074), m, 1, .04, 2, scale=(1.15, .85, 1))
        b.tube([(.04, 0, .05), (.062, 0, .048), (.07, 0, .078)], [.01, .0085, .0075], m, segs=5)
        b.box((.03, .016, .016), (.078, 0, .074), m, bevel=.004)
        for lx in (-.03, .032):
            for ly in (-.012, .012):
                b.cyl(.0065, .036, (lx, ly, 0), m, segs=4, r2=.005)
        b.box((.04, .056, .006), (-.004, 0, .08), 'TEAM', bevel=.002)


def pyramids(b):
    b.base_hex(.82, .03, mat='sand', rim='sand_dark')
    # soft dunes rolling in from the desert
    for i, (a, r, s) in enumerate(((100, .62, 1.2), (140, .6, .9), (40, .64, 1.0), (255, .64, .8))):
        x, y, _ = polar(r, a)
        b.sphere(.12 * s, (x, y, .03), 'sand', segs=10, rings=5, scale=(1.5, 1, .32), rot=(0, 0, a + 90))
    # processional causeway + valley temple (pylon gateway)
    tx, ty = .14, -.5
    b.box((.09, .36, .01), (.1, -.2, .03), 'limestone')
    b.box((.2, .1, .06), (tx, ty, .03), 'limestone', bevel=.006)
    b.box((.05, .02, .044), (tx, ty - .05, .03), 'basalt')
    for dx in (-.08, .08):
        b.box((.05, .12, .1), (tx + dx, ty, .03), 'sandstone', bevel=.005, taper=.78)
        b.box((.05, .006, .006), (tx + dx, ty - .058, .115), 'gold')
        b.flag((tx + dx, ty + .03, .13), .1, facing=200)
    b.box((.13, .11, .01), (tx, ty, .09), 'sandstone_dark', bevel=.003)
    b.box((.13, .006, .008), (tx, ty - .058, .092), 'gold')
    # the three pyramids on the Giza diagonal + queens' pyramids
    _pyramid(b, .05, .16, .3, .66)
    _pyramid(b, -.43, .3, .17, .38)
    _pyramid(b, .5, .08, .1, .21, cap='sandstone', cap_from=.9)
    for x, y in ((.46, .48), (.3, .6), (.6, .34)):
        _pyramid(b, x, y, .042, .085, cap='sandstone', cap_from=.9)
    # sphinx guarding the causeway
    _sphinx(b, (.44, -.34, .03), 1.5)
    # obelisks at the causeway mouth
    _obelisk(b, .02, -.68, .2)
    _obelisk(b, .26, -.68, .2)
    # oasis with palms and a camel
    b.cyl(.2, .006, (-.5, -.1, .029), 'grass_dark', segs=10, r2=.19, scale=(1, .8, 1))
    pool = [polar(1 + .12 * math.sin(k * 2.3), k * 36) for k in range(10)]
    b.water([(x * .14 - .5, y * .1 - .1) for x, y, _ in pool], (0, 0, .031))
    for i, (x, y, s) in enumerate(((-.64, -.02, 1.15), (-.42, .02, .95), (-.6, -.24, 1.0), (-.36, -.2, .8))):
        b.tree_palm((x, y, .03), s, seed=i + 4)
    for i, (x, y) in enumerate(((-.5, .06), (-.68, -.14), (-.32, -.1))):
        b.bush((x, y, .03), .7, seed=i, mat='foliage_light')
    _camel(b, (-.3, -.42, .03), facing=200, s=1.25)


def _druid(b, at, facing=0.0, robe='white_plaster'):
    with b.xform(place(at, (0, 0, facing))):
        b.cyl(.017, .05, (0, 0, 0), robe, segs=6, r2=.009)
        b.sphere(.011, (0, 0, .058), 'clay', segs=6, rings=4)
        b.cone(.014, .02, (0, .002, .06), robe, segs=6)
        b.tube([(.012, -.004, .0), (.02, -.01, .04), (.018, -.016, .085)], .003, 'timber', segs=3)


def stonehenge(b):
    rnd = random.Random(11)
    b.base_hex(.82, .028, mat='grass', rim='dirt')
    # henge earthwork: outer bank + ditch
    bank = [(.74, .03), (.72, .05), (.68, .062), (.64, .05), (.62, .036), (.6, .03)]
    b.lathe(bank, mat='grass_dark', segs=18, start=292, arc=316)
    b.lathe([(.6, .03), (.58, .034), (.54, .034), (.52, .03)], mat='dirt', segs=18, start=292, arc=316)
    # chalk avenue towards the front (sunrise) + inner mound
    b.box((.14, .34, .006), (0, -.66, .028), 'limestone')
    b.lathe([(.5, .03), (.46, .045), (.3, .055), (0, .058)], mat='grass', segs=24)
    b.lathe([(.46, .045), (.38, .052), (.3, .055)], mat='sand_dark', segs=24)
    base = .05
    # sarsen circle: 16 uprights, continuous lintel ring with a few gaps
    n, R = 16, .41
    missing = {5, 11}
    fallen = {12}
    tops = {}
    for i in range(n):
        a = 90 + 360 * i / n
        x, y, _ = polar(R, a)
        if i in missing:
            continue
        if i in fallen:
            fx, fy, _ = polar(R + .06, a + 4)
            b.box((.075, .26, .05), (fx, fy, base - .01), 'rock_light', rot=(0, 0, a + 12), bevel=.01)
            continue
        h = .25 + rnd.uniform(-.012, .012)
        tilt = rnd.uniform(-3, 3)
        b.box((.078, .052, h), (x, y, base - .01), 'rock_light', rot=(tilt, 0, a + 90), bevel=.011, taper=.9)
        if rnd.random() < .5:
            b.box((.05, .04, .01), (x, y, base + h - .02), 'moss_stone', rot=(0, 0, a + 90))
        tops[i] = base + h - .01
    for i in range(n):
        j = (i + 1) % n
        if i in tops and j in tops and i not in (8,):
            a0 = 90 + 360 * (i + .5) / n
            x, y, _ = polar(R, a0)
            chord = 2 * R * math.sin(math.pi / n) + .05
            b.box((chord, .05, .04), (x, y, max(tops[i], tops[j])), 'stone_dark', rot=(0, 0, a0 + 90), bevel=.009)
    # bluestone ring
    for i in range(20):
        a = 90 + 360 * i / 20 + rnd.uniform(-3, 3)
        if 250 < (a % 360) < 290:
            continue
        x, y, _ = polar(.3, a)
        b.box((.035, .03, .1 + rnd.uniform(0, .03)), (x, y, base - .005), 'lead_roof', rot=(0, rnd.uniform(-4, 4), a),
              taper=.75)
    # trilithon horseshoe, open to the front, tallest at the back
    for a, h in ((90, .34), (40, .29), (140, .29), (-8, .25), (188, .25)):
        with b.xform(place(polar(.2, a), (0, 0, a + 90))):
            for dx in (-.045, .045):
                b.box((.07, .065, h), (dx, 0, base - .01), 'rock_light', bevel=.012, taper=.88)
            b.box((.2, .07, .048), (0, 0, base + h - .015), 'stone_dark', bevel=.011)
            b.box((.07, .03, .012), (.03, .0, base + h + .03), 'moss_stone')
    # altar stone, solstice fire and druids
    b.box((.16, .06, .025), (0, .02, base), 'basalt', bevel=.006, rot=(0, 0, 8))
    b.cyl(.035, .012, (0, -.1, base), 'granite', segs=7)
    for k in range(5):
        b.box((.05, .01, .01), (0, -.1, base + .012), 'timber', rot=(0, 0, k * 36))
    b.overrides['EMISSIVE'] = {'color': '#ffb13d', 'emit': 5.0}
    b.lathe([(.024, 0), (.02, .03), (.008, .06), (0, .08)], (0, -.1, base + .016), 'EMISSIVE', segs=6)
    b.lathe([(.012, 0), (.006, .045), (0, .1)], (.008, -.104, base + .016), 'EMISSIVE', segs=5, rot=(0, 8, 30))
    for a in (200, 250, 300, 340):
        x, y, _ = polar(.1, a)
        _druid(b, (x, y - .1, base), facing=a + 180)
    # heel stone + team banners along the avenue
    b.box((.07, .06, .16), (.02, -.72, .03), 'rock_light', rot=(0, 7, 20), bevel=.014, taper=.7)
    for x in (-.1, .1):
        b.flag((x, -.56, .03), .17, facing=200)
    # trees and bushes outside the ring
    for i, (a, r, sc) in enumerate(((150, .74, 1.2), (175, .72, 1.0), (30, .74, 1.1), (340, .74, .9), (205, .74, .9))):
        x, y, _ = polar(r, a)
        b.tree_round((x, y, .03), sc, seed=i)
    for i, a in enumerate((120, 60, 230, 310)):
        x, y, _ = polar(.7, a)
        b.bush((x, y, .03), 1.0, seed=i, mat='foliage_dark')
    for i, a in enumerate((70, 250, 20)):
        x, y, _ = polar(.62, a + 5)
        b.rock((x, y, .05), .6, seed=i, mat='rock_light')


def _vine_curtain(b, x0, x1, y, z_top, drop, seed, face=-1):
    """Ragged foliage curtain hanging down a wall face lying in the XZ plane at `y` (faces -Y when face=-1)."""
    rnd = random.Random(seed)
    n = max(2, int((x1 - x0) / .035))
    pts = [(x0, 0.0)]
    for k in range(n + 1):
        x = x0 + (x1 - x0) * k / n
        pts.append((x, -drop * rnd.uniform(.35, 1.0)))
    pts += [(x1, 0.0)]
    b.prism([(p[0], p[1]) for p in pts], .012, (0, y + (.012 if face < 0 else 0) * 0, z_top), 'vine',
            rot=(90 if face < 0 else -90, 0, 0))


def _fall(b, front, z, h, w):
    """Curved water sheet spilling over a terrace lip at y=front, from z+h down to z."""
    prof = [(front + .012, z + h + .006), (front - .004, z + h + .006), (front - .02, z + h * .7),
            (front - .034, z + h * .3), (front - .04, z), (front - .024, z), (front - .016, z + h * .4),
            (front - .004, z + h * .75), (front + .012, z + h - .004)]
    b.prism([(y, zz) for y, zz in prof], w, (-w / 2, 0, 0), 'WATER', rot=(90, 0, 90))


def arch_outline(w, h, segs=4):
    """Round-headed arch outline in XZ-ready (x, z) coordinates, base at z=0."""
    r = w / 2
    spring = h - r
    pts = [(-r, 0.0), (r, 0.0), (r, spring)]
    for k in range(1, segs):
        a = math.pi * k / segs
        pts.append((r * math.cos(a), spring + r * math.sin(a)))
    pts.append((-r, spring))
    return pts


def _terrace_arcade(b, w, y, z, h, n, mat='wood_dark'):
    """Row of dark arch recesses on a facade in the XZ plane at y (facing -Y)."""
    for i in range(n):
        x = -w / 2 + w * (i + .5) / n
        ow = w / n * .5
        b.decal(arch_outline(ow, h * .62), (x, y - .002, z + h * .12), mat, rot=(90, 0, 0))


def hanging_gardens(b):
    b.overrides['EMISSIVE'] = {'color': '#ffc460', 'emit': 3.0}
    b.base_hex(.82, .03, mat='sand', rim='clay')
    # front garden: reflecting pool fed by the cascade, lapis-tiled rim
    b.box((.36, .16, .018), (0, -.6, .03), 'lapis', bevel=.004)
    b.box((.33, .13, .012), (0, -.6, .036), 'WATER')
    tiers = [(.98, .78, .12, 0.0), (.74, .58, .11, .06), (.52, .4, .1, .1), (.32, .24, .09, .13)]
    z = .03
    for ti, (w, d, h, yo) in enumerate(tiers):
        cy = .06 + yo
        b.box((w, d, h), (0, cy, z), 'clay', bevel=.006)
        b.box((w + .012, d + .012, .018), (0, cy, z + h - .03), 'lapis')
        b.box((w + .016, d + .016, .006), (0, cy, z + h - .012), 'gold')
        b.box((w - .02, d - .02, .01), (0, cy, z + h), 'grass_dark')
        front = cy - d / 2
        _terrace_arcade(b, w * .86, front, z, h - .03, max(3, int(w / .11)))
        # foliage draping over the front and sides
        for sx0, sx1 in ((-w / 2 + .01, -.07), (.07, w / 2 - .01)):
            _vine_curtain(b, sx0, sx1, front - .004, z + h + .006, h * .7, seed=ti * 10 + int(sx0 * 100))
        rnd = random.Random(ti)
        # hedges and blossoms along the terrace lip
        for k in range(int(w / .1)):
            x = -w / 2 + .05 + k * .1
            if abs(x) < .08:
                continue
            b.ico(.028, (x, front + .02, z + h + .022), 'foliage' if k % 2 else 'foliage_light', 0, .2, ti * 31 + k,
                  scale=(1.2, 1, .8))
            if rnd.random() < .45:
                b.ico(.011, (x + .01, front + .012, z + h + .045), rnd.choice(('blossom', 'flower_y', 'flower_r')), 0,
                      .1, k)
        for side in (-1, 1):
            b.box((.04, d - .06, .03), (side * (w / 2 - .022), cy + .02, z + h), 'foliage', bevel=.01, taper=.8)
        b.box((w - .06, .04, .03), (0, cy + d / 2 - .022, z + h), 'foliage', bevel=.01, taper=.8)
        z += h
    # trees on the terraces
    b.tree_palm((-.36, .3, .15), 1.0, seed=1)
    b.tree_palm((.38, .28, .15), .95, seed=2)
    b.tree_cypress((-.28, .02, .26), 1.0)
    b.tree_cypress((.28, .02, .26), 1.0)
    b.tree_round((-.2, .3, .26), .9, seed=3, leaf2='blossom')
    b.tree_round((.2, .32, .26), .85, seed=4)
    # central cascade with flanking stairs, foam at every landing
    zc = .03
    for ti, (w, d, h, yo) in enumerate(tiers):
        front = .06 + yo - d / 2
        _fall(b, front, zc, h, .09)
        b.box((.12, .014, h), (0, front - .001, zc), 'lapis')
        b.ico(.03, (0, front - .045, zc + .006), 'white_plaster', 0, .2, ti, scale=(1.6, 1, .45))
        for sx in (-1, 1):
            b.stairs(.05, .05, h, 3, (sx * .1, front - .05, zc), 'sandstone')
        zc += h
    b.box((.12, .14, .008), (0, -.44, .03), 'lapis')
    b.box((.09, .15, .01), (0, -.44, .032), 'WATER')
    # summit shrine: gilded pavilion
    top = zc
    b.box((.22, .16, .02), (0, .19, top), 'sandstone', bevel=.004)
    for x in (-.085, .085):
        for yy in (.13, .25):
            b.cyl(.012, .1, (x, yy, top + .02), 'lapis', segs=6)
            b.cyl(.016, .01, (x, yy, top + .115), 'gold', segs=6)
    b.box((.24, .18, .02), (0, .19, top + .12), 'clay', bevel=.004)
    b.box((.25, .19, .006), (0, .19, top + .14), 'gold')
    b.hip(.2, .14, .06, (0, .19, top + .146), 'lapis')
    b.sphere(.012, (0, .19, top + .215), 'gold', segs=6, rings=4)
    b.cyl(.02, .03, (0, .19, top + .02), 'gold', segs=8, r2=.012)
    b.sphere(.012, (0, .19, top + .06), 'EMISSIVE', segs=6, rings=4)
    for x in (-.14, .14):
        b.flag((x, .1, top), .13, facing=200)
    # palms and bushes on the plaza
    for i, (x, y, sc) in enumerate(((-.56, -.2, 1.0), (.55, -.24, 1.05), (-.44, -.44, .8))):
        b.tree_palm((x, y, .03), sc, seed=10 + i)
    for i, (x, y) in enumerate(((-.3, -.62), (.3, -.62), (-.42, -.56), (.42, -.56))):
        b.bush((x, y, .03), .9, seed=i, mat='foliage_light')
        b.ico(.012, (x + .01, y, .07), 'flower_r' if i % 2 else 'blossom', 0, .1, i)


def _trireme(b, at, heading=90.0, s=1.0, sail='TEAM'):
    """Small galley sailing along +X (rotated by `heading`)."""
    with b.xform(place(at, (0, 0, heading), s)):
        hull = [(-.1, 0), (-.085, .028), (.07, .03), (.11, .012), (.13, 0), (.11, -.012), (.07, -.03), (-.085, -.028)]
        b.prism(hull, .03, (0, 0, -.004), 'timber', top_scale=1.0)
        b.prism([(x * .9, y * .8) for x, y in hull], .006, (0, 0, .026), 'wood_dark')
        b.tube([(.1, 0, .024), (.13, 0, .03), (.15, 0, .05), (.145, 0, .062)], .007, 'timber', segs=4)
        b.box((.04, .004, .004), (.02, .031, .018), 'gold')
        b.box((.04, .004, .004), (.02, -.031, .018), 'gold')
        for k in range(6):
            x = -.06 + k * .024
            for side in (-1, 1):
                b.box((.004, .05, .003), (x, side * .045, .01), 'timber', rot=(side * 18, 0, 0))
        b.cyl(.0045, .16, (0, 0, .03), 'wood_dark', segs=4)
        b.box((.004, .12, .004), (0, 0, .175), 'wood_dark')
        pts = [(-.058, .17), (.058, .17), (.064, .07), (0, .062), (-.064, .07)]
        b.prism([(p[0], p[1]) for p in pts], .006, (0, .006, 0), sail, rot=(90, 0, 90))
        b.box((.004, .006, .06), (-.004, 0, .085), 'gold')


def colossus(b):
    b.overrides['EMISSIVE'] = {'color': '#ff7a12', 'emit': 1.4}
    # harbour: rim, water, two quays with a channel between the statue's feet
    b.hexa(.82, .022, (0, 0, 0), 'stone_dark', bevel=.006)
    b.hexa(.78, .012, (0, 0, .012), 'WATER')
    qz, qh = .0, .05
    left = [(-.13, -.2), (-.13, .67), (-.58, .41), (-.66, .2), (-.66, -.2)]
    right = [(.13, -.2), (.13, .67), (.58, .41), (.66, .2), (.66, -.2)]
    for poly, sx in ((left, -1), (right, 1)):
        b.prism(poly, qh, (0, 0, qz), 'stone', bevel=.006)
        b.prism([(x * .96, y * .96 + .01) for x, y in poly], .006, (0, 0, qz + qh), 'paving')
    # breakwater arms enclosing the outer harbour
    for sx in (-1, 1):
        b.box((.09, .3, .04), (sx * .5, -.38, 0), 'stone_dark', rot=(0, 0, sx * -22), bevel=.006)
        b.cyl(.04, .09, (sx * .44, -.54, 0), 'stone', segs=8, bevel=.004)
        b.cyl(.03, .02, (sx * .44, -.54, .09), 'bronze', segs=8)
        b.cone(.02, .03, (sx * .44, -.54, .11), 'EMISSIVE', segs=6)
    # stairs down to the water + mooring posts
    for sx in (-1, 1):
        b.stairs(.1, .06, qh, 4, (sx * .3, -.26, 0), 'stone_light', rot=(0, 0, 0))
        for y in (.1, .3, .5):
            b.cyl(.008, .03, (sx * .145, y, qh), 'bronze', segs=5)
    # harbour-front buildings with terracotta roofs
    for i, (x, y, w, d, h) in enumerate(((-.42, .3, .14, .12, .09), (-.3, .48, .12, .1, .08), (.44, .28, .13, .12, .1),
                                          (.3, .48, .12, .1, .07), (-.5, .08, .1, .1, .07))):
        b.box((w, d, h), (x, y, qh), 'white_plaster', bevel=.004)
        b.hip(w, d, .045, (x, y, qh + h), 'terracotta', overhang=.01, ridge=w * .3)
        b.decal([(-.012, 0), (.012, 0), (.012, .03), (-.012, .03)], (x, y - d / 2 - .001, qh + .005), 'wood_dark',
                rot=(90, 0, 0))
    b.tree_cypress((-.56, -.08, qh), 1.0)
    b.tree_cypress((.5, .06, qh), .9)
    b.tree_round((.56, -.1, qh), .8, seed=4, leaf='foliage_dark', leaf2='foliage')
    b.flag((-.22, -.16, qh), .15, facing=200)
    b.flag((.22, -.16, qh), .15, facing=200)

    # --- the Colossus: bronze giant straddling the channel, torch raised
    br, gd = 'bronze', 'gold'
    ped = .1
    for sx in (-1, 1):
        b.box((.14, .14, ped - qh), (sx * .21, .05, qh), 'marble', bevel=.008)
        b.box((.15, .15, .012), (sx * .21, .05, ped - .012), 'gold')
        b.box((.12, .12, .014), (sx * .21, .05, ped), 'marble_shade', bevel=.003)
    zf = ped + .014
    hip_z, hip_x = .43, .052
    for sx in (-1, 1):
        foot = (sx * .2, .04, zf)
        knee = (sx * .135, .03, .275)
        hip = (sx * hip_x, .045, hip_z)
        b.box((.05, .085, .03), (foot[0], foot[1] - .015, zf), br, bevel=.008)
        b.tube([(foot[0], foot[1], zf + .02), (sx * .17, .035, .2), knee, (sx * .1, .04, .35), hip],
               [.028, .032, .036, .046, .054], br, segs=7, smooth=True)
        b.sphere(.034, knee, br, segs=7, rings=4)
        b.cyl(.034, .018, (sx * .2, .04, zf + .045), gd, segs=7, r2=.03)
    # kilt (pteryges) with gold belt
    b.lathe([(.078, .39), (.09, .44), (.084, .47), (0, .47)], mat='bronze', segs=10, rot=(0, 0, 0))
    for k in range(10):
        a = k * 36
        x, y, _ = polar(.084, a)
        b.box((.024, .012, .07), (x, y + .045, .375), 'bronze', rot=(0, 0, a + 90))
    b.torus(.084, .011, (0, .045, .47), gd, segs=12, rsegs=4)
    # torso and chest
    with b.xform(place((0, .045, 0))):
        b.lathe([(0, .47), (.078, .47), (.086, .52), (.1, .59), (.11, .63), (.07, .66), (0, .665)], mat=br,
                segs=10, smooth=True, scale=(1, .72, 1))
        for sx in (-1, 1):
            b.sphere(.05, (sx * .1, 0, .625), br, segs=8, rings=5)
        b.cyl(.03, .04, (0, 0, .655), br, segs=7)
        # head with the radiant crown of Helios
        b.sphere(.052, (0, -.006, .735), br, segs=10, rings=6, scale=(.9, 1, 1.08))
        b.box((.03, .02, .03), (0, -.05, .71), br, bevel=.006)
        b.torus(.053, .008, (0, -.004, .76), gd, segs=12, rsegs=4)
        for k in range(7):
            a = -70 + k * 23.3
            d = math.radians(a)
            px, pz = .05 * math.sin(d), .76 + .05 * math.cos(d)
            b.cone(.011, .06, (px, 0, pz), gd, segs=4, rot=(0, a, 0), start=45)
        # right arm raised (figure's right = -X), torch aloft
        sh = (-.12, 0, .63)
        b.tube([sh, (-.15, -.01, .7), (-.155, -.012, .77), (-.135, -.01, .83)], [.036, .03, .026, .024], br,
               segs=7, smooth=True)
        b.sphere(.027, (-.135, -.01, .84), br, segs=7, rings=4)
        b.cyl(.012, .06, (-.135, -.01, .83), gd, segs=6, r2=.018)
        b.cyl(.024, .012, (-.135, -.01, .885), gd, segs=8, r2=.03)
        b.lathe([(.024, 0), (.028, .016), (.016, .034), (0, .046)], (-.135, -.01, .895), 'EMISSIVE', segs=7)
        # left arm lowered, cloak draped over it, spear planted
        b.tube([(.12, 0, .63), (.15, -.02, .55), (.16, -.06, .5)], [.034, .029, .026], br, segs=7, smooth=True)
        b.sphere(.026, (.162, -.068, .495), br, segs=7, rings=4)
        cloak = [(0, 0), (.035, -.01), (.05, -.26), (.02, -.3), (-.02, -.28), (-.012, -.02)]
        b.prism(cloak, .016, (.14, -.03, .63), 'TEAM_DARK', rot=(90, 0, 10))
        b.cyl(.007, .5, (.175, -.075, .22), 'wood_dark', segs=5)
        b.cone(.014, .045, (.175, -.075, .72), gd, segs=4)
    # galley passing between the colossus' legs
    _trireme(b, (0, -.32, .02), heading=90, s=1.0)
    with b.xform(place((-.3, -.5, .022), (0, 0, 35))):  # fishing skiff
        b.prism([(-.045, 0), (-.035, .014), (.035, .014), (.05, 0), (.035, -.014), (-.035, -.014)], .014,
                (0, 0, 0), 'timber')
        b.box((.05, .018, .004), (0, 0, .012), 'wood_dark')
        b.box((.03, .004, .003), (.02, .01, .016), 'TEAM')


def _column(b, x, y, z, h, r=.017, mat='marble', cap='marble_shade', segs=8, gold_ring=False):
    b.box((r * 2.6, r * 2.6, .01), (x, y, z), cap)
    b.cyl(r, h - .02, (x, y, z + .01), mat, segs=segs, r2=r * .86)
    b.box((r * 2.7, r * 2.7, .012), (x, y, z + h - .012), cap, taper=1.0)
    if gold_ring:
        b.cyl(r * 1.05, .006, (x, y, z + h - .02), 'gold', segs=segs)


def _statue(b, at, facing=0.0, mat='gold', plinth='marble_shade', s=1.0):
    """Small robed statue with raised arm on a plinth."""
    with b.xform(place(at, (0, 0, facing), s)):
        b.box((.05, .05, .05), (0, 0, 0), plinth, bevel=.004)
        b.cyl(.018, .06, (0, 0, .05), mat, segs=6, r2=.013)
        b.sphere(.011, (0, 0, .12), mat, segs=6, rings=4)
        b.tube([(.012, 0, .1), (.022, -.004, .125), (.02, -.006, .15)], .004, mat, segs=4)


def _armillary(b, at, s=1.0):
    with b.xform(place(at, (0, 0, 0), s)):
        b.cyl(.035, .04, (0, 0, 0), 'marble_shade', segs=8, bevel=.003)
        b.cyl(.01, .03, (0, 0, .04), 'bronze', segs=6)
        c = (0, 0, .12)
        b.torus(.05, .004, c, 'gold', segs=12, rsegs=3, rot=(90, 0, 0))
        b.torus(.05, .004, c, 'gold', segs=12, rsegs=3, rot=(90, 0, 90))
        b.torus(.052, .004, c, 'gold', segs=12, rsegs=3, rot=(23, 0, 0))
        b.sphere(.018, c, 'lapis', segs=8, rings=5)
        b.cyl(.003, .12, (0, 0, .06), 'gold', segs=4, rot=(23, 0, 0))


def _scroll_rack(b, at, facing=0.0):
    with b.xform(place(at, (0, 0, facing))):
        b.box((.12, .04, .1), (0, 0, 0), 'timber', bevel=.003)
        for row in range(3):
            for k in range(4):
                b.cyl(.008, .012, (-.042 + k * .028, -.019, .012 + row * .03), 'limestone' if (k + row) % 2 else
                      'clay', segs=5, rot=(90, 0, 0))
        b.box((.13, .05, .01), (0, 0, .1), 'wood_dark')


def great_library(b):
    b.overrides['EMISSIVE'] = {'color': '#ffb85c', 'emit': 3.0}
    b.base_hex(.82, .03, mat='limestone', rim='marble_shade')
    for sx in (-1, 1):  # palm-garden lawns flanking the library
        b.box((.17, .5, .012), (sx * .56, .12, .03), 'grass', bevel=.004)
    cy = .12
    # crepidoma
    z = .03
    for i, (w, d) in enumerate(((.72, .54), (.68, .5), (.64, .46))):
        b.box((w, d, .024), (0, cy, z), 'marble_shade' if i % 2 == 0 else 'marble', bevel=.003)
        z += .024
    zb = z
    # grand stair up to the portico
    b.stairs(.3, .1, zb - .03, 4, (0, cy - .27 - .1, .03), 'marble')
    # cella
    b.box((.5, .34, .2), (0, cy + .02, zb), 'plaster', bevel=.004)
    b.decal([(-.045, 0), (.045, 0), (.045, .13), (-.045, .13)], (0, cy - .151, zb), 'bronze', rot=(90, 0, 0))
    b.decal([(-.04, 0), (.04, 0), (.04, .12), (-.04, .12)], (0, cy - .152, zb + .003), 'wood_dark', rot=(90, 0, 0))
    for x in (-.17, .17):  # hanging team banners on the cella wall
        b.box((.05, .006, .12), (x, cy - .153, zb + .05), 'TEAM')
        b.box((.056, .008, .008), (x, cy - .153, zb + .17), 'gold')
        b.prism([(-.025, 0), (.025, 0), (0, -.02)], .006, (x, cy - .15, zb + .05), 'TEAM', rot=(90, 0, 0))
    # peristyle: 8 columns front, 5 per side
    h = .22
    for i in range(8):
        _column(b, -.28 + i * .08, cy - .205, zb, h)
    for sx in (-1, 1):
        for i in range(1, 5):
            _column(b, sx * .28, cy - .205 + i * .1, zb, h)
    ze = zb + h
    b.box((.64, .48, .035), (0, cy + .02, ze), 'marble', bevel=.003)
    b.box((.65, .49, .01), (0, cy + .02, ze + .012), 'lapis')
    b.box((.655, .495, .004), (0, cy + .02, ze + .024), 'gold')
    zr = ze + .035
    # pediment roof (ridge front-to-back) + marble tympanum
    b.gable(.5, .66, .1, (0, cy + .02, zr), 'terracotta', rot=(0, 0, 90), overhang=.01)
    b.prism([(-.335, 0), (.335, 0), (0, .104)], .016, (0, cy - .236, zr), 'marble', rot=(90, 0, 0))
    b.prism([(-.25, .014), (.25, .014), (0, .08)], .004, (0, cy - .252, zr), 'marble_shade', rot=(90, 0, 0))
    b.sphere(.013, (0, cy - .256, zr + .045), 'gold', segs=6, rings=4)
    for x, zz in ((-.32, 0), (.32, 0), (0, .098)):
        b.cone(.018, .045, (x, cy - .245, zr + zz), 'gold', segs=4)
    # reading-hall dome rising behind the pediment
    b.cyl(.13, .07, (0, cy + .12, zr + .02), 'plaster', segs=14)
    b.cyl(.135, .012, (0, cy + .12, zr + .09), 'gold', segs=14)
    b.dome(.13, .1, (0, cy + .12, zr + .1), 'lead_roof', segs=14, rings=4)
    for k in range(7):
        a = k * 360 / 14 + 90 + 180 / 14 * 3
        x, y, _ = polar(.132, a)
        b.decal([(-.008, 0), (.008, 0), (.008, .035), (0, .045), (-.008, .035)], (x, cy + .12 + y, zr + .035),
                'glass_dark', rot=(90, 0, a + 90))
    b.cyl(.025, .03, (0, cy + .12, zr + .19), 'gold', segs=8, r2=.015)
    b.sphere(.016, (0, cy + .12, zr + .235), 'gold', segs=8, rings=5)
    # forecourt: armillary sphere, scroll racks, braziers, statues, palms
    _armillary(b, (0, -.52, .03), 1.25)
    _scroll_rack(b, (-.36, -.34, .03), facing=-20)
    _scroll_rack(b, (.38, -.3, .03), facing=25)
    for x in (-.2, .2):
        b.cyl(.012, .06, (x, -.44, .03), 'bronze', segs=6)
        b.lathe([(.006, 0), (.026, .015), (.028, .025), (0, .02)], (x, -.44, .09), 'bronze', segs=8)
        b.cone(.018, .03, (x, -.44, .105), 'EMISSIVE', segs=6)
    _statue(b, (-.5, -.12, .03), facing=-30)
    _statue(b, (.5, -.14, .03), facing=30)
    for i, (x, y, sc) in enumerate(((-.56, .08, 1.0), (.56, .06, 1.05), (-.52, .32, .85), (.53, .32, .9))):
        b.tree_palm((x, y, .042), sc, seed=20 + i)
    for i, (x, y) in enumerate(((-.12, -.62), (.12, -.62), (-.56, -.1), (.57, -.1))):
        b.bush((x, y, .03), .8, seed=i, mat='foliage')
    b.flag((-.32, -.52, .03), .15, facing=200)
    b.flag((.32, -.52, .03), .15, facing=200)


def _olive(b, at, s=1.0, seed=0):
    x, y, z = at
    b.tube([(x, y, z), (x + .01 * s, y, z + .04 * s), (x - .004 * s, y + .006 * s, z + .075 * s)],
           [.014 * s, .011 * s, .008 * s], 'bark_old', segs=5)
    b.ico(.055 * s, (x, y, z + .1 * s), 'anc_olive', 1, .22, seed, scale=(1.2, 1.1, .7))
    b.ico(.035 * s, (x + .03 * s, y - .01 * s, z + .125 * s), 'anc_olive_dark', 0, .15, seed + 1)


def oracle(b):
    b.overrides['EMISSIVE'] = {'color': '#b98cff', 'emit': 3.5}
    rnd = random.Random(5)
    b.base_hex(.82, .03, mat='grass', rim='rock_dark')
    # Mount Parnassus spur behind the sanctuary
    for i, (a, r, sc, hz) in enumerate(((58, .6, 1.6, 1.5), (78, .62, 1.9, 2.2), (100, .62, 2.0, 2.6),
                                        (122, .6, 1.7, 1.9), (145, .62, 1.4, 1.3), (30, .64, 1.2, 1.0),
                                        (165, .66, 1.1, .9))):
        x, y, _ = polar(r, a)
        b.ico(.09 * sc, (x, y, .02), 'rock' if i % 2 else 'rock_light', 1, .22, i + 40, scale=(1.0, .7, hz),
              rot=(0, 0, a + rnd.uniform(-20, 20)))
    for i, a in enumerate((70, 110, 135)):
        x, y, _ = polar(.52, a)
        b.bush((x, y, .03), 1.2, seed=i + 7, mat='anc_olive_dark')
    # sanctuary terrace with polygonal retaining wall
    tz = .15
    terr = [polar(.37, 90 + k * 30) for k in range(12)]
    b.prism([(p[0], p[1] * .82 + .1) for p in terr], tz - .03, (0, 0, .03), 'stone', bevel=.006)
    b.prism([(p[0] * .96, p[1] * .79 + .1) for p in terr], .006, (0, 0, tz), 'paving')
    for k in range(9):
        a = 200 + k * 16
        x, y, _ = polar(.36, a)
        b.decal([(-.03, 0), (.03, 0), (.036, .05), (0, .075), (-.034, .055)], (x * 1.005, y * .82 + .1 + .001, .05),
                'stone_dark', rot=(90, 0, a + 90))
    # sacred way: stairs up the front of the terrace
    b.stairs(.16, .13, tz - .03, 6, (0, -.29, .03), 'stone_light')
    # tholos
    cx, cy = 0, .15
    z = tz
    for r in (.22, .2, .185):
        b.cyl(r, .018, (cx, cy, z), 'marble_shade' if r != .2 else 'marble', segs=16)
        z += .018
    b.cyl(.12, .2, (cx, cy, z), 'marble_shade', segs=12)
    b.decal([(-.028, 0), (.028, 0), (.028, .1), (0, .12), (-.028, .1)], (cx, cy - .121, z), 'wood_dark',
            rot=(90, 0, 0))
    for k in range(12):
        x, y, _ = polar(.165, k * 30 + 15)
        _column(b, cx + x, cy + y, z, .2, r=.013, segs=6)
    ze = z + .2
    b.cyl(.185, .03, (cx, cy, ze), 'marble', segs=16, bevel=.003)
    b.torus(.186, .006, (cx, cy, ze + .01), 'gold', segs=16, rsegs=4)
    b.cyl(.2, .012, (cx, cy, ze + .03), 'marble_shade', segs=16)
    b.cyl(.205, .075, (cx, cy, ze + .042), 'terracotta', segs=16, r2=.1)
    b.cyl(.1, .04, (cx, cy, ze + .117), 'marble', segs=12)
    b.cyl(.105, .045, (cx, cy, ze + .157), 'terracotta', segs=12, r2=.02)
    b.cone(.016, .05, (cx, cy, ze + .195), 'gold', segs=6)
    b.sphere(.01, (cx, cy, ze + .25), 'gold', segs=6, rings=4)
    # the oracle's tripod breathing prophetic vapours
    tx, ty = 0, -.14
    for k in range(3):
        a = math.radians(90 + k * 120)
        b.tube([(tx + .04 * math.cos(a), ty + .04 * math.sin(a), tz), (tx + .018 * math.cos(a),
                ty + .018 * math.sin(a), tz + .07)], .004, 'gold', segs=4, cap=True)
    b.lathe([(0, 0), (.02, .004), (.034, .02), (.03, .026), (0, .018)], (tx, ty, tz + .065), 'gold', segs=10)
    b.lathe([(.026, 0), (.03, .02), (.02, .05), (.008, .075), (0, .09)], (tx, ty, tz + .085), 'EMISSIVE', segs=7)
    for i, (dx, dz, r) in enumerate(((.012, .12, .022), (-.01, .16, .018), (.006, .195, .013))):
        b.ico(r, (tx + dx, ty, tz + dz), 'EMISSIVE', 0, .15, i)
    # Castalian spring, treasury, trees
    b.cyl(.13, .018, (-.44, -.32, .03), 'stone', segs=10, scale=(1.2, .8, 1))
    b.cyl(.11, .01, (-.44, -.32, .04), 'WATER', segs=10, scale=(1.2, .8, 1))
    b.box((.05, .03, .06), (-.44, -.24, .03), 'marble_shade', bevel=.004)
    b.cyl(.006, .02, (-.44, -.255, .07), 'bronze', segs=4, rot=(90, 0, 0))
    with b.xform(place((.46, -.3, .03), (0, 0, 25))):
        b.box((.16, .2, .02), (0, 0, 0), 'marble_shade', bevel=.003)
        b.box((.12, .14, .1), (0, .02, .02), 'marble', bevel=.003)
        for x in (-.035, .035):
            _column(b, x, -.07, .02, .1, r=.01, segs=6)
        b.box((.14, .19, .014), (0, 0, .12), 'marble')
        b.gable(.19, .14, .045, (0, 0, .134), 'terracotta', rot=(0, 0, 90), overhang=.006)
        b.prism([(-.07, 0), (.07, 0), (0, .045)], .01, (0, -.095, .134), 'marble', rot=(90, 0, 0))
        b.box((.14, .004, .006), (0, -.1, .126), 'gold')
    for i, (x, y, sc) in enumerate(((-.52, .08, 1.3), (.52, .06, 1.2), (-.3, .52, 1.1), (.33, .5, 1.0),
                                    (.62, -.08, 1.0))):
        b.tree_cypress((x, y, .03), sc)
    for i, (x, y, sc) in enumerate(((-.62, -.16, 1.0), (.26, -.52, .9), (-.2, -.56, .85))):
        _olive(b, (x, y, .03), sc, seed=i)
    for x in (-.14, .14):
        b.flag((x, -.3, .03), .15, facing=200)


MODELS = {
    'w_pyramids': pyramids,
    'w_stonehenge': stonehenge,
    'w_hanging_gardens': hanging_gardens,
    'w_colossus': colossus,
    'w_great_library': great_library,
    'w_oracle': oracle,
}
