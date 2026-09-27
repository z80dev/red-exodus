"""AEONS city kit — walls.

wall_seg_<s>   one hex edge: length exactly 1.0 along X (x ∈ [-0.5, 0.5]), origin at the edge midpoint
               on the ground, outside face toward Blender -Y (glTF +Z). Thickness stays within
               |y| ≤ 0.09 so segments meeting at 120° are hidden inside the tower at the vertex.
wall_tower_<s> sits on a hex vertex, origin at its ground centre; its front (glTF +Z) should face
               away from the city centre (the bastion's salient points that way).
Styles: 0 palisade · 1 stone crenellated · 2 star-fort bastion.
"""

import math

import city_lib as L
from city_lib import Model

HALF = 0.5


# --- 0 · palisade ------------------------------------------------------------------------------

def wall_seg_0(m: Model):
    m.box(1.0, 0.07, 0.012, (0, 0.004, 0), "earth")
    n = 16
    for i in range(n):
        x = -HALF + (i + 0.5) * (1.0 / n)
        h = 0.118 + 0.018 * math.sin(i * 2.3) + 0.01 * ((i * 7) % 3 - 1)
        r = 0.026 + 0.003 * math.cos(i * 1.7)
        m.lathe([(r, 0.0), (r, h), (r * 0.25, h + 0.032), (0.0, h + 0.036)], (x, 0, 0.004),
                "timber" if i % 3 else "timber_dark", seg=5, phase=0.3 * i, cap_bottom=False)
    for z in (0.034, 0.09):
        m.box(1.0, 0.018, 0.016, (0, 0.03, z), "timber_dark")
    for x in (-0.3, 0.02, 0.32):
        m.box(0.016, 0.014, 0.1, (x, 0.058, 0.0), "timber_dark", rx=-22)
    # painted TEAM shields hung on the stakes
    for x in (-0.265, 0.0, 0.265):
        m.cyl(0.03, 0.008, (x, -0.028, 0.075), "TEAM", seg=7, rx=90)
        m.cyl(0.012, 0.006, (x, -0.036, 0.075), "gold", seg=5, rx=90)
    m.miter_ends()


def wall_tower_0(m: Model):
    """Timber watchtower on splayed posts, thatched pyramid roof, TEAM pennant."""
    m.cyl(0.1, 0.012, (0, 0, 0), "earth", seg=8, bevel=0.004)
    for sx in (-1, 1):
        for sy in (-1, 1):
            m.cyl(0.012, 0.14, (sx * 0.062, sy * 0.062, 0), "timber_dark", seg=5, ry=-sx * 5, rx=sy * 5)
    for rz in (0, 90):
        m.box(0.15, 0.012, 0.012, (0, 0, 0.05), "timber", rz=rz + 45, bevel=0.002)
    m.box(0.16, 0.16, 0.016, (0, 0, 0.12), "timber", bevel=0.004)
    for rz in (0, 90, 180, 270):
        with m.xf((0, 0, 0), rz=rz):
            m.box(0.15, 0.012, 0.046, (0, -0.07, 0.136), "timber", bevel=0.003)
            for i in range(5):
                m.cyl(0.006, 0.054, (-0.06 + i * 0.03, -0.078, 0.13), "timber_dark", seg=4)
    for sx in (-1, 1):
        for sy in (-1, 1):
            m.cyl(0.006, 0.05, (sx * 0.064, sy * 0.064, 0.182), "timber_dark", seg=4)
    m.hip(0.14, 0.14, 0.1, (0, 0, 0.23), "thatch", over=0.024, eave=0.014, ridge=0.0)
    m.cyl(0.012, 0.018, (0, 0, 0.32), "thatch_dark", seg=5, r2=0.004)
    m.flag(0.06, 0.036, (0.0, 0.0, 0.32), "TEAM", pole_h=0.075, rz=-90)
    m.box(0.05, 0.004, 0.044, (0, -0.079, 0.138), "TEAM")


# --- 1 · stone curtain wall --------------------------------------------------------------------

def wall_seg_1(m: Model):
    t = 0.07
    m.box(1.0, t + 0.03, 0.03, (0, 0, 0), "stone_dark", bevel=0.006, top=(1.0, 0.78))
    m.box(1.0, t, 0.12, (0, 0, 0.02), "stone", bevel=0.005, top=(1.0, 0.92))
    m.box(1.0, t + 0.016, 0.014, (0, 0, 0.136), "stone_dark", bevel=0.004)
    m.box(1.0, t - 0.01, 0.006, (0, 0, 0.15), "stone_deep")
    n = 7
    for i in range(n):
        x = -HALF + (i + 0.5) / n
        m.box(0.084, 0.026, 0.044, (x, -t / 2 + 0.003, 0.148), "stone", bevel=0.005)
        m.box(0.012, 0.004, 0.022, (x, -t / 2 - 0.011, 0.156), "stone_deep")
    for i in range(10):
        x = -HALF + (i + 0.5) / 10
        m.box(0.07, 0.014, 0.024, (x, t / 2 - 0.004, 0.148), "stone", bevel=0.004)
    for x in (-0.34, 0.0, 0.34):
        m.box(0.05, 0.02, 0.13, (x, -t / 2 - 0.004, 0.012), "stone_dark", bevel=0.004, top=(0.8, 0.5))
    for x, z, w in ((-0.42, 0.06, 0.07), (-0.2, 0.1, 0.05), (0.1, 0.05, 0.08), (0.24, 0.1, 0.06),
                    (0.44, 0.07, 0.04), (-0.12, 0.045, 0.05)):
        m.box(w, 0.006, 0.022, (x, -t / 2 + 0.001, z), "stone_dark", bevel=0.002)
    m.banner(0.052, 0.08, (-0.17, -t / 2 - 0.008, 0.14), "TEAM")
    m.banner(0.052, 0.08, (0.17, -t / 2 - 0.008, 0.14), "TEAM")
    m.miter_ends()


def wall_tower_1(m: Model):
    """Round stone tower: battered base, corbelled crenellated top, TEAM spire."""
    m.cyl(0.118, 0.036, (0, 0, 0), "stone_dark", seg=10, r2=0.104, bevel=0.004)
    m.cyl(0.1, 0.14, (0, 0, 0.03), "stone", seg=10, r2=0.095)
    m.cyl(0.096, 0.018, (0, 0, 0.17), "stone_dark", seg=10, r2=0.116)
    m.cyl(0.116, 0.032, (0, 0, 0.188), "stone", seg=10)
    m.merlons_ring(0.108, 0.22, 10, 0.036, 0.022, 0.03, "stone", phase=math.pi / 10)
    m.cyl(0.09, 0.02, (0, 0, 0.21), "stone", seg=10)
    m.cone(0.098, 0.14, (0, 0, 0.228), "TEAM", seg=10, eave=0.012)
    m.cyl(0.006, 0.026, (0, 0, 0.366), "gold", seg=4)
    m.flag(0.06, 0.034, (0.0, 0.0, 0.36), "TEAM", pole_h=0.05, rz=-90, finial="gold")
    for a in (-90, -30, -150):
        r = math.radians(a)
        with m.xf((0.097 * math.cos(r), 0.097 * math.sin(r), 0), rz=a + 90):
            m.arch_panel(0.018, 0.04, (0, 0, 0.1), "window", depth=0.012)
    m.box(0.04, 0.014, 0.014, (0, -0.108, 0.19), "stone_dark")


# --- 2 · star-fort bastion ---------------------------------------------------------------------

def wall_seg_2(m: Model):
    """Low, thick artillery rampart: sloped stone scarp outside, turfed bank inside, brick parapet."""
    m.prism([(-0.094, 0.0), (-0.01, 0.0), (-0.01, 0.016), (-0.088, 0.016)], 1.0, (0, 0, 0), "stone_dark",
            plane="YZ")
    m.prism([(-0.09, 0.0), (-0.01, 0.0), (-0.01, 0.1), (-0.056, 0.1)], 1.0, (0, 0, 0.0), "stone", plane="YZ")
    m.prism([(-0.01, 0.0), (0.098, 0.0), (0.03, 0.1), (-0.01, 0.1)], 1.0, (0, 0, 0.0), "grass", plane="YZ")
    m.prism([(-0.058, 0.0), (0.03, 0.0), (0.03, 0.008), (-0.058, 0.008)], 1.0, (0, 0, 0.1), "grass",
            plane="YZ")
    m.prism([(-0.06, 0.0), (-0.026, 0.0), (-0.026, 0.034), (-0.054, 0.034)], 1.0, (0, 0, 0.1), "brick",
            plane="YZ")
    m.prism([(-0.058, 0.0), (-0.052, 0.0), (-0.052, 0.012), (-0.058, 0.012)], 1.0, (0, 0, 0.134), "stone",
            plane="YZ")
    m.prism([(-0.093, 0.0), (-0.086, 0.0), (-0.083, 0.012), (-0.09, 0.012)], 1.0, (0, 0, 0.07), "stone_dark",
            plane="YZ")
    for x in (-0.25, 0.25):
        m.cyl(0.009, 0.06, (x, -0.02, 0.124), "iron", seg=6, rx=90)
        m.box(0.03, 0.036, 0.016, (x, 0.004, 0.108), "timber_dark", bevel=0.002)
    m.flag(0.05, 0.03, (0.0, 0.01, 0.108), "TEAM", pole_h=0.1, rz=-90)
    m.miter_ends()


def wall_tower_2(m: Model):
    """Arrowhead bastion (salient toward -Y) with a domed TEAM sentry box and a cannon."""
    outline = [(0.0, -0.26), (0.17, -0.07), (0.15, 0.08), (-0.15, 0.08), (-0.17, -0.07)]
    m.prism(outline, 0.022, (0, 0, 0), "stone_dark", plane="XY", top_scale=0.98)
    m.prism([(x * 0.98, y * 0.98) for x, y in outline], 0.1, (0, 0, 0.018), "stone", plane="XY",
            top_scale=0.9)
    inner = [(x * 0.88, y * 0.88) for x, y in outline]
    m.prism(inner, 0.01, (0, 0, 0.118), "grass", plane="XY")
    top = [(x * 0.9, y * 0.9) for x, y in outline]
    for i in range(len(top)):
        a, b = top[i], top[(i + 1) % len(top)]
        if i == 2:
            continue
        mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
        ln = math.hypot(b[0] - a[0], b[1] - a[1])
        ang = math.degrees(math.atan2(b[1] - a[1], b[0] - a[0]))
        m.box(ln, 0.02, 0.03, (mx, my, 0.118), "brick", rz=ang, bevel=0.003)
    m.box(0.27, 0.012, 0.012, (0, 0.08 * 0.9, 0.118), "stone")
    # sentry box (guérite) at the salient
    gx, gy = 0.0, -0.215
    m.cyl(0.024, 0.012, (gx, gy, 0.1), "stone", seg=8, r2=0.03)
    m.cyl(0.024, 0.05, (gx, gy, 0.112), "stone", seg=8)
    m.box(0.012, 0.006, 0.02, (gx, gy - 0.024, 0.126), "window")
    m.dome(0.028, 0.026, (gx, gy, 0.162), "TEAM", seg=8, rings=2)
    m.cyl(0.004, 0.014, (gx, gy, 0.188), "gold", seg=4)
    # cannon on carriage
    m.box(0.036, 0.05, 0.02, (0.05, -0.04, 0.128), "timber_dark", bevel=0.003)
    for sx in (-1, 1):
        m.cyl(0.013, 0.008, (0.05 + sx * 0.022, -0.04, 0.132), "timber", seg=8, ry=90)
    m.cyl(0.011, 0.075, (0.05, -0.02, 0.15), "iron", seg=8, rx=80, r2=0.009)
    L.barrel(m, (-0.06, -0.02, 0.128), r=0.012, h=0.026)
    m.lathe([(0.0, 0.0), (0.012, 0.0), (0.012, 0.012), (0.0, 0.024)], (-0.04, -0.04, 0.128), "iron", seg=6)
    m.flag(0.08, 0.048, (-0.04, 0.03, 0.128), "TEAM", pole_h=0.19, rz=-90)


WALLS = {
    "wall_seg_0": wall_seg_0, "wall_tower_0": wall_tower_0,
    "wall_seg_1": wall_seg_1, "wall_tower_1": wall_tower_1,
    "wall_seg_2": wall_seg_2, "wall_tower_2": wall_tower_2,
}
