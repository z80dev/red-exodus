"""AEONS city kit — building landmarks `bld_<id>` (≤ 1500 tris).

Footprint within ±0.25 (harbor pier reaches -0.3 toward its water side = front, -Y),
height 0.18–0.45, front faces -Y. TEAM accents on every building so ownership reads.
"""

import math

import city_lib as L
from city_lib import Model


def _ellipse(rx, ry, n, phase=0.0):
    return [(rx * math.cos(phase + 2 * math.pi * i / n), ry * math.sin(phase + 2 * math.pi * i / n)) for i in range(n)]


def _ellipse_normal_deg(rx, ry, a):
    """Outward normal angle (deg) of an ellipse at parametric angle a (rad)."""
    return math.degrees(math.atan2(math.sin(a) / ry, math.cos(a) / rx))


# --- temple: round tholos with eternal flames ---------------------------------------------------

def bld_temple(m: Model):
    m.lathe([(0.22, 0.0), (0.22, 0.02), (0.195, 0.02), (0.195, 0.04), (0.17, 0.04), (0.17, 0.058),
             (0.0, 0.058)], (0, 0, 0), "marble", seg=12)
    g = 0.058
    m.cyl(0.1, 0.17, (0, 0, g), "plaster", seg=12)
    n = 10
    for i in range(n):
        a = 2 * math.pi * (i + 0.5) / n
        m.column(0.011, 0.17, (0.148 * math.cos(a), 0.148 * math.sin(a), g), "marble")
    m.cyl(0.164, 0.026, (0, 0, g + 0.17), "marble", seg=12)
    m.cyl(0.168, 0.008, (0, 0, g + 0.19), "gold", seg=12)
    m.lathe([(0.175, 0.0), (0.175, 0.01), (0.07, 0.085), (0.0, 0.1)], (0, 0, g + 0.196), "TEAM", seg=12)
    m.cyl(0.012, 0.04, (0, 0, g + 0.29), "gold", seg=6, r2=0.0)
    m.arch_panel(0.05, 0.1, (0, -0.1, g), "timber_dark", depth=0.012)
    L.stairs(m, 0.0, -0.25, -0.17, 0.0, g, 0.09, 4, "marble")
    for sx in (-1, 1):
        L.brazier(m, (sx * 0.085, -0.225, 0.0), h=0.06)
        m.banner(0.04, 0.09, (sx * 0.05, -0.106, g + 0.16), "TEAM")
    L.cypress(m, (0.2, 0.17, 0.0), h=0.15)
    L.cypress(m, (-0.21, 0.15, 0.0), h=0.12)


# --- library: colonnaded hall with a copper reading-room dome -----------------------------------

def bld_library(m: Model):
    m.box(0.46, 0.34, 0.022, (0, 0.02, 0), "stone", bevel=0.005)
    g = 0.022
    m.box(0.4, 0.24, 0.15, (0, 0.05, g), "sandstone", bevel=0.005)
    m.box(0.41, 0.25, 0.016, (0, 0.05, g + 0.15), "marble", bevel=0.003)
    m.box(0.39, 0.23, 0.02, (0, 0.05, g + 0.164), "sandstone", bevel=0.003)
    fy = 0.05 - 0.12
    for i in range(6):
        x = -0.15 + i * 0.06
        m.column(0.011, 0.14, (x, fy - 0.03, g), "marble")
    m.box(0.36, 0.05, 0.014, (0, fy - 0.022, g + 0.14), "marble", bevel=0.002)
    m.box(0.37, 0.056, 0.006, (0, fy - 0.022, g + 0.154), "gold")
    for i in range(5):
        x = -0.12 + i * 0.06
        m.arch_panel(0.03, 0.08, (x, fy - 0.001, g + 0.02), "window" if i != 2 else "timber_dark")
    m.box(0.36, 0.004, 0.012, (0, fy - 0.047, g + 0.124), "TEAM")
    # dome over the reading room
    dz = g + 0.184
    m.cyl(0.095, 0.05, (0, 0.07, dz), "marble", seg=12)
    for i in range(12):
        a = 2 * math.pi * (i + 0.5) / 12
        m.box(0.012, 0.006, 0.05, (0.096 * math.cos(a), 0.07 + 0.096 * math.sin(a), dz), "sandstone",
              rz=math.degrees(a) + 90)
    m.dome(0.1, 0.1, (0, 0.07, dz + 0.05), "roof_copper", seg=12, rings=3)
    m.cyl(0.02, 0.03, (0, 0.07, dz + 0.146), "marble", seg=8)
    m.cone(0.024, 0.028, (0, 0.07, dz + 0.176), "gold", seg=8)
    L.stairs(m, 0.0, -0.2, fy - 0.03, 0.0, g, 0.16, 2, "stone")
    for sx in (-1, 1):
        L.statue(m, (sx * 0.2, -0.17, 0.0), h=0.1, mat="bronze", pedestal="marble", rz=sx * 20, raised=sx > 0)
        m.flag(0.05, 0.03, (sx * 0.17, 0.14, g + 0.184), "TEAM", pole_h=0.08, rz=0 if sx > 0 else 180)


# --- market: striped stalls around a fountain ----------------------------------------------------

def _stall(m, at, rz, cloth_a, cloth_b):
    with m.xf(at, rz):
        m.box(0.1, 0.06, 0.03, (0, 0.005, 0), "timber", bevel=0.004)
        for sx in (-1, 1):
            m.cyl(0.004, 0.08, (sx * 0.046, -0.03, 0), "timber_dark", seg=4)
            m.cyl(0.004, 0.1, (sx * 0.046, 0.03, 0), "timber_dark", seg=4)
        for i in range(4):
            m.box(0.026, 0.08, 0.005, (-0.039 + i * 0.026, 0.0, 0.086), cloth_a if i % 2 == 0 else cloth_b,
                  rx=-14)
        m.box(0.022, 0.022, 0.014, (-0.025, -0.01, 0.03), "cloth_red")
        m.box(0.022, 0.022, 0.012, (0.0, -0.01, 0.03), "foliage_light")
        m.box(0.022, 0.022, 0.014, (0.025, -0.01, 0.03), "cloth_yellow")


def bld_market(m: Model):
    m.cyl(0.25, 0.012, (0, 0, 0), "stone", seg=12, bevel=0.004)
    m.cyl(0.21, 0.004, (0, 0, 0.012), "sandstone", seg=12)
    # central fountain
    m.lathe([(0.06, 0.0), (0.06, 0.028), (0.05, 0.028), (0.05, 0.012), (0.0, 0.012)], (0, 0, 0.012), "marble",
            seg=10)
    m.cyl(0.05, 0.004, (0, 0, 0.034), "water", seg=10)
    m.cyl(0.01, 0.06, (0, 0, 0.012), "marble", seg=6)
    m.lathe([(0.0, 0.0), (0.03, 0.006), (0.024, 0.014), (0.0, 0.012)], (0, 0, 0.07), "marble", seg=8)
    m.cyl(0.02, 0.004, (0, 0, 0.08), "water", seg=8)
    stalls = [(-90, "TEAM", "cloth_white"), (-30, "cloth_red", "cloth_yellow"), (30, "TEAM", "cloth_white"),
              (90, "cloth_green", "cloth_white"), (150, "TEAM", "cloth_yellow"), (210, "cloth_red", "cloth_white")]
    for ang, a, b in stalls:
        r = math.radians(ang)
        _stall(m, (0.16 * math.cos(r), 0.16 * math.sin(r), 0.012), ang - 90 + 180, a, b)
    L.crate(m, (0.06, -0.13, 0.012), 0.026, rz=12)
    L.crate(m, (0.08, -0.105, 0.012), 0.022, rz=-8)
    L.barrel(m, (-0.07, -0.12, 0.012))
    L.barrel(m, (-0.09, -0.1, 0.012))
    for x, y in ((0.12, 0.02), (-0.12, 0.03)):
        m.lathe([(0.012, 0.0), (0.016, 0.012), (0.01, 0.024), (0.0, 0.026)], (x, y, 0.012), "cloth_white", seg=5)
    m.flag(0.05, 0.03, (0.0, 0.07, 0.012), "TEAM", pole_h=0.2, rz=0)


# --- barracks: longhouse + training yard -----------------------------------------------------------

def bld_barracks(m: Model):
    m.box(0.48, 0.4, 0.012, (0, 0.0, 0), "earth", bevel=0.004)
    # longhouse at the back
    m.box(0.38, 0.14, 0.03, (0, 0.11, 0.012), "stone_dark", bevel=0.004)
    m.box(0.36, 0.12, 0.08, (0, 0.11, 0.04), "plaster", bevel=0.004)
    for x in (-0.18, -0.09, 0.0, 0.09, 0.18):
        m.box(0.012, 0.126, 0.08, (x, 0.11, 0.04), "timber_dark")
    m.gable(0.36, 0.12, 0.08, (0, 0.11, 0.12), "TEAM", over=0.018, eave=0.014)
    m.box(0.37, 0.012, 0.012, (0, 0.11, 0.195), "TEAM_DARK", bevel=0.003)
    for x in (-0.135, 0.045, 0.135):
        m.box(0.024, 0.006, 0.028, (x, 0.047, 0.07), "window")
    m.box(0.036, 0.006, 0.06, (-0.045, 0.047, 0.04), "timber_dark")
    m.box(0.03, 0.03, 0.08, (0.14, 0.14, 0.17), "stone", bevel=0.004)
    # training yard fence
    for sx in (-1, 1):
        m.box(0.008, 0.2, 0.012, (sx * 0.22, -0.07, 0.04), "timber", bevel=0.002)
        for y in (-0.16, -0.07, 0.02):
            m.box(0.012, 0.012, 0.05, (sx * 0.22, y, 0.012), "timber_dark")
    m.box(0.16, 0.008, 0.012, (-0.15, -0.17, 0.04), "timber", bevel=0.002)
    m.box(0.16, 0.008, 0.012, (0.15, -0.17, 0.04), "timber", bevel=0.002)
    for x in (-0.22, -0.08, 0.08, 0.22):
        m.box(0.012, 0.012, 0.05, (x, -0.17, 0.012), "timber_dark")
    # archery target, training dummy, weapon rack
    with m.xf((0.13, -0.02, 0.012), rz=-20):
        m.cyl(0.006, 0.06, (-0.016, 0.01, 0), "timber", seg=4, rx=-15)
        m.cyl(0.006, 0.06, (0.016, 0.01, 0), "timber", seg=4, rx=-15)
        m.cyl(0.036, 0.012, (0, 0.0, 0.066), "cloth_white", seg=10, rx=90)
        m.cyl(0.024, 0.014, (0, -0.001, 0.066), "red", seg=10, rx=90)
        m.cyl(0.011, 0.016, (0, -0.002, 0.066), "cloth_yellow", seg=8, rx=90)
    with m.xf((-0.12, -0.05, 0.012)):
        m.cyl(0.006, 0.09, (0, 0, 0), "timber_dark", seg=4)
        m.box(0.07, 0.01, 0.01, (0, 0, 0.062), "timber_dark")
        m.lathe([(0.014, 0.0), (0.02, 0.02), (0.014, 0.04), (0.0, 0.042)], (0, 0, 0.034), "thatch", seg=6)
        m.lathe([(0.0, 0.0), (0.012, 0.006), (0.0, 0.022)], (0, 0, 0.076), "thatch", seg=6)
    with m.xf((0.0, -0.12, 0.012)):
        m.box(0.1, 0.012, 0.008, (0, 0, 0.05), "timber", bevel=0.002)
        m.box(0.1, 0.012, 0.008, (0, 0, 0.012), "timber", bevel=0.002)
        for i in range(5):
            m.cyl(0.003, 0.1, (-0.04 + i * 0.02, -0.006, 0), "timber_dark", seg=4)
            m.cyl(0.006, 0.014, (-0.04 + i * 0.02, -0.006, 0.1), "iron", seg=4, r2=0.0)
        m.cyl(0.018, 0.006, (0.065, -0.004, 0.03), "TEAM", seg=8, rx=90)
    for sx in (-1, 1):
        m.flag(0.06, 0.036, (sx * 0.2, 0.04, 0.012), "TEAM", pole_h=0.22, rz=0 if sx > 0 else 180)


# --- harbor: pier, warehouse, crane and a moored boat ----------------------------------------------

def bld_harbor(m: Model):
    # quay (land side, +Y)
    m.box(0.48, 0.2, 0.03, (0, 0.14, 0), "stone", bevel=0.005)
    m.box(0.48, 0.014, 0.036, (0, 0.04, 0), "stone_dark", bevel=0.003)
    # warehouse
    m.box(0.2, 0.12, 0.09, (0.1, 0.15, 0.03), "timber", bevel=0.004)
    m.box(0.2, 0.124, 0.03, (0.1, 0.15, 0.03), "stone_dark", bevel=0.003)
    m.gable(0.2, 0.12, 0.07, (0.1, 0.15, 0.12), "roof_terracotta", over=0.014)
    m.box(0.05, 0.006, 0.06, (0.1, 0.088, 0.03), "timber_dark")
    m.box(0.21, 0.004, 0.01, (0.1, 0.086, 0.105), "TEAM")
    # pier toward the water (-Y)
    m.box(0.12, 0.3, 0.014, (-0.1, -0.1, 0.028), "timber", bevel=0.003)
    for i in range(7):
        m.box(0.124, 0.004, 0.015, (-0.1, -0.235 + i * 0.04, 0.028), "timber_dark")
    for sx in (-1, 1):
        for y in (-0.23, -0.14, -0.05):
            m.cyl(0.008, 0.045, (-0.1 + sx * 0.058, y, 0.0), "timber_dark", seg=5)
    for y in (-0.21, -0.1):
        m.cyl(0.007, 0.018, (-0.155, y, 0.042), "iron", seg=6)
    # crane
    with m.xf((-0.02, -0.02, 0.03)):
        m.box(0.05, 0.05, 0.012, (0, 0, 0), "timber_dark", bevel=0.003)
        m.box(0.014, 0.014, 0.2, (0, 0, 0.012), "timber", bevel=0.002)
        m.box(0.14, 0.012, 0.012, (-0.05, 0, 0.19), "timber", bevel=0.002)
        m.box(0.01, 0.01, 0.1, (-0.03, 0, 0.1), "timber_dark", ry=-45)
        m.cyl(0.002, 0.08, (-0.11, 0, 0.11), "iron", seg=3)
        L.crate(m, (-0.11, 0, 0.085), 0.026)
    # crates & barrels on the quay
    L.crate(m, (-0.18, 0.12, 0.03), 0.028, rz=10)
    L.crate(m, (-0.18, 0.12, 0.058), 0.022, rz=-15)
    L.crate(m, (-0.14, 0.15, 0.03), 0.026, rz=30)
    L.barrel(m, (-0.2, 0.18, 0.03))
    L.barrel(m, (-0.21, 0.07, 0.03))
    # moored sailboat with TEAM sail
    with m.xf((0.08, -0.17, 0.0), rz=90):
        m.lathe([(0.0, 0.0), (0.026, 0.004), (0.036, 0.026), (0.0, 0.026)], (0, 0, 0), "TEAM_DARK", seg=8,
                sx=2.6, sy=1.2)
        m.box(0.14, 0.05, 0.004, (0, 0, 0.024), "timber")
        m.cyl(0.004, 0.16, (0.01, 0, 0.02), "timber_dark", seg=4)
        m.prism([(0.0, 0.0), (0.075, 0.0), (0.0, 0.12)], 0.004, (0.014, 0.0, 0.05), "TEAM")
        m.prism([(0.0, 0.0), (-0.05, 0.0), (0.0, 0.1)], 0.004, (0.006, 0.0, 0.05), "cloth_white")
    m.flag(0.05, 0.03, (0.21, 0.21, 0.03), "TEAM", pole_h=0.17, rz=180)


# --- granary: beehive silos and a raised storehouse ------------------------------------------------

def bld_granary(m: Model):
    m.cyl(0.25, 0.012, (0, 0, 0), "earth", seg=12, bevel=0.004)
    silos = [(-0.12, 0.08, 0.075, 0.16), (0.02, 0.13, 0.068, 0.14), (-0.14, -0.08, 0.06, 0.12)]
    for x, y, r, h in silos:
        m.cyl(r, 0.018, (x, y, 0.012), "stone_dark", seg=10, bevel=0.003)
        m.cyl(r * 0.94, h, (x, y, 0.03), "mudbrick", seg=10, r2=r * 0.86)
        m.cyl(r * 0.9, 0.01, (x, y, 0.03 + h * 0.6), "mudbrick_dark", seg=10)
        m.lathe([(r * 1.1, 0.0), (r * 1.1, 0.008), (r * 0.5, h * 0.4), (0.0, h * 0.55)], (x, y, 0.03 + h),
                "thatch", seg=10)
        m.box(0.02, 0.008, 0.026, (x, y - r * 0.9, 0.03 + h * 0.3), "timber_dark")
    m.box(0.06, 0.02, 0.004, (-0.14, -0.08 - 0.056, 0.03 + 0.12 * 0.3 + 0.028), "TEAM")
    # raised storehouse on stilts
    with m.xf((0.13, -0.04, 0.012)):
        for sx in (-1, 1):
            for sy in (-1, 1):
                m.cyl(0.008, 0.05, (sx * 0.055, sy * 0.045, 0), "timber_dark", seg=5)
                m.cyl(0.016, 0.006, (sx * 0.055, sy * 0.045, 0.048), "stone", seg=6)
        m.box(0.14, 0.12, 0.08, (0, 0, 0.054), "timber", bevel=0.004)
        for x in (-0.068, 0.0, 0.068):
            m.box(0.008, 0.124, 0.08, (x, 0, 0.054), "timber_dark")
        m.gable(0.14, 0.12, 0.08, (0, 0, 0.134), "TEAM", over=0.016, eave=0.012)
        m.box(0.03, 0.004, 0.04, (0.034, -0.062, 0.07), "timber_dark")
        m.box(0.012, 0.07, 0.006, (0.034, -0.1, 0.03), "timber", rx=-40)
    # sacks and wheat sheaves
    for x, y in ((0.03, -0.17), (0.06, -0.19), (0.045, -0.2)):
        m.lathe([(0.013, 0.0), (0.017, 0.012), (0.011, 0.024), (0.0, 0.026)], (x, y, 0.012), "cloth_white",
                seg=5)
    for x, y in ((-0.04, -0.17), (-0.02, -0.2), (0.2, 0.12)):
        m.lathe([(0.004, 0.0), (0.01, 0.03), (0.016, 0.048), (0.0, 0.058)], (x, y, 0.012), "gold", seg=5)
        m.cyl(0.011, 0.005, (x, y, 0.03), "thatch_dark", seg=5)


# --- workshop: timber shed, forge chimney and waterwheel ------------------------------------------

def bld_workshop(m: Model):
    m.box(0.46, 0.4, 0.012, (0, 0, 0), "stone_dark", bevel=0.004)
    g = 0.012
    m.box(0.28, 0.2, 0.03, (-0.03, 0.06, g), "stone", bevel=0.004)
    m.box(0.28, 0.2, 0.1, (-0.03, 0.06, g + 0.03), "timber", bevel=0.004)
    for x in (-0.16, -0.03, 0.1):
        m.box(0.014, 0.206, 0.1, (x, 0.06, g + 0.03), "timber_dark")
    m.box(0.12, 0.006, 0.07, (-0.07, -0.042, g + 0.03), "window")
    m.gable(0.28, 0.2, 0.1, (-0.03, 0.06, g + 0.13), "TEAM", over=0.02, eave=0.014)
    m.box(0.29, 0.012, 0.012, (-0.03, 0.06, g + 0.226), "TEAM_DARK", bevel=0.003)
    # lean-to awning over the work bench
    m.box(0.16, 0.07, 0.006, (-0.07, -0.08, g + 0.1), "timber", rx=16)
    for sx in (-1, 1):
        m.cyl(0.005, 0.1, (-0.07 + sx * 0.07, -0.11, g), "timber_dark", seg=4)
    m.box(0.1, 0.03, 0.03, (-0.07, -0.08, g), "timber_dark", bevel=0.003)
    # forge chimney with glow
    m.box(0.05, 0.05, 0.3, (-0.14, 0.12, g), "stone", bevel=0.005, top=(0.8, 0.8))
    m.box(0.052, 0.052, 0.014, (-0.14, 0.12, g + 0.29), "stone_dark", bevel=0.003)
    m.box(0.03, 0.006, 0.024, (-0.14, 0.094, g + 0.02), "fire")
    # waterwheel on the right with a little race
    wx, wy = 0.175, 0.05
    m.box(0.06, 0.34, 0.012, (wx, wy - 0.05, g - 0.004), "water")
    with m.xf((wx, wy, g + 0.1), ry=90):
        m.cyl(0.1, 0.012, (0, 0, -0.03), "timber_dark", seg=12, cap_top=True)
        m.cyl(0.1, 0.012, (0, 0, 0.018), "timber_dark", seg=12)
        m.cyl(0.07, 0.036, (0, 0, -0.018), "timber", seg=12)
        for i in range(8):
            a = 360.0 * i / 8
            with m.xf((0, 0, 0), rz=a):
                m.box(0.035, 0.012, 0.05, (0.085, 0, -0.025), "timber")
        m.cyl(0.012, 0.09, (0, 0, -0.07), "iron", seg=6)
    m.box(0.07, 0.018, 0.018, (wx - 0.05, wy, g + 0.091), "timber_dark")
    # anvil, logs
    m.box(0.03, 0.016, 0.012, (0.02, -0.12, g), "stone_dark")
    m.box(0.04, 0.014, 0.012, (0.02, -0.12, g + 0.012), "iron", bevel=0.002)
    for i in range(3):
        m.cyl(0.01, 0.08, (-0.18, -0.15 + i * 0.022, g + 0.01), "timber", seg=6, ry=90)
    m.cyl(0.01, 0.08, (-0.18, -0.139, g + 0.028), "timber", seg=6, ry=90)
    m.flag(0.05, 0.03, (0.19, -0.16, g), "TEAM", pole_h=0.16, rz=0)


# --- university: collegiate quad with clock tower and spire ---------------------------------------

def bld_university(m: Model):
    m.box(0.48, 0.42, 0.014, (0, 0, 0), "stone", bevel=0.004)
    g = 0.014
    m.box(0.26, 0.16, 0.004, (0, -0.07, g), "grass")
    # back range
    m.box(0.44, 0.1, 0.14, (0, 0.14, g), "sandstone", bevel=0.004)
    m.gable(0.44, 0.1, 0.07, (0, 0.14, g + 0.14), "roof_slate", over=0.012)
    for i in range(7):
        x = -0.18 + i * 0.06
        if abs(x) < 0.04:
            continue
        L.lancet(m, 0.024, 0.06, (x, 0.089, g + 0.05))
    # side wings
    for sx in (-1, 1):
        m.box(0.1, 0.22, 0.12, (sx * 0.17, -0.03, g), "sandstone", bevel=0.004)
        m.gable(0.22, 0.1, 0.06, (sx * 0.17, -0.03, g + 0.12), "roof_slate", over=0.012, rz=90)
        for y in (-0.1, -0.03, 0.04):
            with m.xf((sx * 0.17, y, 0), rz=90 * -sx):
                L.lancet(m, 0.022, 0.05, (0, -0.051, g + 0.04))
        m.box(0.1, 0.006, 0.07, (sx * 0.17, -0.141, g + 0.02), "sandstone")
        L.lancet(m, 0.03, 0.07, (sx * 0.17, -0.143, g + 0.03), "window")
        m.banner(0.034, 0.07, (sx * 0.17, -0.146, g + 0.118), "TEAM")
    # central tower with clock and spire
    T = 0.1
    m.box(T, T, 0.28, (0, 0.12, g), "sandstone", bevel=0.004)
    for z in (0.14, 0.22):
        m.box(T + 0.01, T + 0.01, 0.01, (0, 0.12, g + z), "stone", bevel=0.002)
    L.lancet(m, 0.04, 0.09, (0, 0.069, g), "TEAM_DARK", depth=0.006)
    m.cyl(0.03, 0.01, (0, 0.066, g + 0.18), "clock", seg=10, rx=90)
    m.cyl(0.033, 0.006, (0, 0.068, g + 0.18), "gold", seg=10, rx=90)
    m.box(0.004, 0.004, 0.02, (0, 0.06, g + 0.178), "iron")
    for sx in (-1, 1):
        for sy in (-1, 1):
            m.cyl(0.012, 0.05, (sx * 0.046, 0.12 + sy * 0.046, g + 0.28), "sandstone", seg=6, r2=0.0)
    m.hip(T - 0.01, T - 0.01, 0.16, (0, 0.12, g + 0.28), "roof_slate", over=0.004, ridge=0.0)
    m.flag(0.05, 0.03, (0, 0.12, g + 0.42), "TEAM", pole_h=0.03, rz=0)
    L.round_tree(m, (0.06, -0.08, g), r=0.034, mat="foliage")
    L.round_tree(m, (-0.07, -0.05, g), r=0.03, mat="foliage_light")


# --- amphitheater: arcaded oval with TEAM velarium -------------------------------------------------

def bld_amphitheater(m: Model):
    rx, ry = 0.19, 0.16
    n = 16
    path = _ellipse(rx, ry, n, math.pi / n)
    H = 0.15
    prof = [(-0.09, 0.02), (0.035, 0.0), (0.035, H), (0.018, H), (0.018, H - 0.02), (-0.01, H - 0.035),
            (-0.01, H - 0.05), (-0.04, H - 0.065), (-0.04, H - 0.08), (-0.07, H - 0.095),
            (-0.07, H - 0.105), (-0.09, 0.045)]
    m.sweep(prof, path, True, (0, 0, 0), "stone")
    m.lathe([(1.0, 0.0), (1.0, 0.03), (0.0, 0.03)], (0, 0, 0), "sandstone", seg=n,
            sx=rx - 0.08, sy=ry - 0.08, phase=math.pi / n)
    m.lathe([(rx + 0.05, 0.0), (rx + 0.05, 0.012), (0.0, 0.012)], (0, 0, 0), "stone_dark", seg=n,
            sx=1.0, sy=ry / rx, phase=math.pi / n)
    # arcaded ground storey, windowed upper storey, cornice bands
    for i in range(n):
        a = 2 * math.pi * i / n
        x, y = (rx + 0.036) * math.cos(a), (ry + 0.036) * math.sin(a)
        nd = _ellipse_normal_deg(rx, ry, a)
        with m.xf((x, y, 0), rz=nd + 90):
            if math.sin(a) < 0.3:
                m.arch_panel(0.03, 0.05, (0, 0, 0.018), "window", depth=0.006, seg=3)
            m.box(0.02, 0.006, 0.026, (0, 0, 0.09), "stone_deep")
    k = (ry + 0.04) / (rx + 0.04)
    m.cyl(rx + 0.04, 0.01, (0, 0, 0.072), "sandstone", seg=n, sy=k, phase=math.pi / n, cap_top=False,
          cap_bottom=False)
    m.cyl(rx + 0.04, 0.022, (0, 0, H - 0.024), "TEAM", seg=n, sy=k, phase=math.pi / n, cap_top=False,
          cap_bottom=False)
    for i in range(0, n, 4):
        a = 2 * math.pi * (i + 1) / n
        x, y = (rx + 0.03) * math.cos(a), (ry + 0.03) * math.sin(a)
        m.flag(0.04, 0.024, (x, y, H), "TEAM", pole_h=0.07, rz=math.degrees(a) - 90, finial=None)
    m.arch_panel(0.05, 0.08, (0, -(ry + 0.04), 0.012), "timber_dark", depth=0.012)
    m.banner(0.04, 0.06, (0, -(ry + 0.046), H - 0.01), "TEAM")


# --- bank: heavy neoclassical vault with gold coin pediment ----------------------------------------

def bld_bank(m: Model):
    m.box(0.46, 0.38, 0.02, (0, 0.02, 0), "stone_dark", bevel=0.005)
    g = 0.02
    m.box(0.38, 0.26, 0.04, (0, 0.06, g), "stone_dark", bevel=0.005)
    m.box(0.36, 0.24, 0.16, (0, 0.06, g + 0.04), "stone", bevel=0.005)
    m.box(0.37, 0.25, 0.02, (0, 0.06, g + 0.2), "marble", bevel=0.003)
    m.box(0.374, 0.254, 0.006, (0, 0.06, g + 0.196), "gold")
    m.box(0.33, 0.21, 0.04, (0, 0.06, g + 0.22), "stone", bevel=0.004)
    m.box(0.31, 0.19, 0.006, (0, 0.06, g + 0.26), "stone_dark")
    fy = 0.06 - 0.12
    # giant portico
    for x in (-0.12, -0.04, 0.04, 0.12):
        m.column(0.017, 0.19, (x, fy - 0.05, g + 0.02), "marble", seg=8)
    m.box(0.3, 0.07, 0.024, (0, fy - 0.035, g + 0.21), "marble", bevel=0.003)
    m.prism([(-0.155, 0.0), (0.155, 0.0), (0.0, 0.07)], 0.07, (0, fy - 0.035, g + 0.234), "marble",
            bevel=0.003)
    m.cyl(0.026, 0.01, (0, fy - 0.072, g + 0.262), "gold", seg=12, rx=90)
    m.cyl(0.016, 0.012, (0, fy - 0.073, g + 0.262), "gold", seg=6, rx=90)
    m.box(0.3, 0.07, 0.02, (0, fy - 0.035, g), "marble", bevel=0.003)
    L.stairs(m, 0.0, -0.2, fy - 0.07, 0.0, g + 0.02, 0.26, 3, "stone")
    m.box(0.07, 0.008, 0.1, (0, fy - 0.002, g + 0.04), "iron", bevel=0.002)
    m.cyl(0.018, 0.01, (0, fy - 0.008, g + 0.09), "gold", seg=10, rx=90)
    for sx in (-1, 1):
        m.box(0.03, 0.006, 0.05, (sx * 0.08, fy - 0.001, g + 0.08), "window")
        m.banner(0.034, 0.1, (sx * 0.08, fy - 0.004, g + 0.19), "TEAM")
        L.pole_lamp(m, (sx * 0.17, -0.2, 0.0), h=0.08)
        m.flag(0.05, 0.03, (sx * 0.15, 0.15, g + 0.26), "TEAM", pole_h=0.08, rz=0 if sx > 0 else 180)
    m.box(0.16, 0.12, 0.04, (0, 0.1, g + 0.26), "stone", bevel=0.004)
    m.dome(0.05, 0.04, (0, 0.1, g + 0.3), "gold", seg=10, rings=2)


# --- factory: sawtooth hall, stacks and water tower -----------------------------------------------

def bld_factory(m: Model):
    m.box(0.48, 0.42, 0.014, (0, 0, 0), "asphalt", bevel=0.004)
    g = 0.014
    W, D = 0.34, 0.24
    m.box(W, D, 0.12, (-0.02, 0.05, g), "brick", bevel=0.004)
    m.box(W + 0.006, D + 0.006, 0.014, (-0.02, 0.05, g), "brick_dark")
    fy = 0.05 - D / 2
    for i in range(6):
        x = -0.02 - W / 2 + 0.03 + i * 0.056
        m.arch_panel(0.03, 0.06, (x, fy - 0.001, g + 0.03), "window")
    m.box(0.07, 0.006, 0.08, (-0.02, fy - 0.002, g), "TEAM_DARK")
    m.box(0.16, 0.008, 0.024, (-0.02, fy - 0.004, g + 0.1), "TEAM")
    # sawtooth roof
    for i in range(4):
        y = 0.05 - D / 2 + (i + 0.5) * D / 4
        pts = [(-D / 8, 0.0), (D / 8, 0.0), (D / 8, 0.05), (D / 8 - 0.008, 0.05)]
        m.prism(pts, W, (-0.02, y, g + 0.12), "roof_slate", plane="YZ")
        m.prism([(D / 8 - 0.008, 0.0), (D / 8, 0.0), (D / 8, 0.05), (D / 8 - 0.008, 0.05)], W - 0.02,
                (-0.02, y + 0.002, g + 0.12), "glass", plane="YZ")
    # chimneys with smoke
    for cx, cy, h in ((0.19, 0.14, 0.33), (0.19, 0.03, 0.27)):
        m.cyl(0.032, 0.03, (cx, cy, g), "brick_dark", seg=8)
        m.cyl(0.026, h, (cx, cy, g + 0.03), "brick", seg=8, r2=0.02)
        m.cyl(0.024, 0.012, (cx, cy, g + 0.03 + h - 0.012), "iron", seg=8)
        for r, dz, dx in ((0.026, 0.03, 0.0), (0.032, 0.07, 0.02), (0.022, 0.11, 0.045)):
            m.lathe([(r * 0.6, 0.0), (r, r * 0.6), (r * 0.7, r * 1.3), (0.0, r * 1.5)],
                    (cx + dx, cy, g + 0.03 + h + dz - 0.02), "concrete_light", seg=7)
    # water tower
    with m.xf((-0.17, -0.12, g)):
        for sx in (-1, 1):
            for sy in (-1, 1):
                m.cyl(0.004, 0.12, (sx * 0.022, sy * 0.022, 0), "iron", seg=4)
        m.cyl(0.036, 0.05, (0, 0, 0.12), "timber", seg=8)
        m.cone(0.04, 0.03, (0, 0, 0.17), "TEAM", seg=8)
    # pipes and crates
    m.cyl(0.008, 0.2, (0.15, 0.13, g + 0.07), "iron", seg=6, rx=90)
    L.crate(m, (0.08, -0.14, g), 0.03, rz=15)
    L.barrel(m, (0.12, -0.16, g), r=0.014, h=0.032)
    L.barrel(m, (0.14, -0.13, g), r=0.014, h=0.032)


# --- observatory: domed drum with telescope -------------------------------------------------------

def bld_observatory(m: Model):
    m.cyl(0.24, 0.016, (0, 0, 0), "stone", seg=12, bevel=0.004)
    g = 0.016
    m.box(0.3, 0.12, 0.09, (0.02, 0.1, g), "plaster", bevel=0.004)
    m.hip(0.3, 0.12, 0.05, (0.02, 0.1, g + 0.09), "roof_terracotta", over=0.012)
    m.windows_row(-0.1, 0.14, 0.039, g + 0.04, 4, 0.02, 0.03)
    m.cyl(0.11, 0.16, (-0.02, -0.02, g), "concrete_light", seg=12)
    m.cyl(0.116, 0.014, (-0.02, -0.02, g + 0.16), "TEAM", seg=12)
    m.dome(0.112, 0.1, (-0.02, -0.02, g + 0.174), "white", seg=12, rings=3)
    # shutter slit + telescope
    with m.xf((-0.02, -0.02, g + 0.174), rz=-50):
        R, Hd = 0.114, 0.102
        for a_deg in (8, 30, 52, 74):
            a = math.radians(a_deg)
            py, pz = -R * math.cos(a), Hd * math.sin(a)
            ty, tz = R * math.sin(a), Hd * math.cos(a)
            tl = math.hypot(ty, tz)
            ln = 0.036
            m.box(0.034, 0.008, ln, (0, py - ty / tl * ln / 2, pz - tz / tl * ln / 2), "window",
                  rx=-math.degrees(math.atan2(ty, tz)))
        m.cyl(0.02, 0.17, (0, -0.02, 0.03), "bronze", seg=8, rx=48, r2=0.016)
        m.cyl(0.023, 0.014, (0, -0.14, 0.14), "gold", seg=8, rx=48)
    m.arch_panel(0.04, 0.07, (-0.02, -0.129, g), "TEAM_DARK", depth=0.01)
    L.stairs(m, -0.02, -0.21, -0.13, 0.0, g, 0.06, 3, "stone")
    # armillary sphere
    with m.xf((0.16, -0.12, g)):
        m.box(0.036, 0.036, 0.03, (0, 0, 0), "marble", bevel=0.003)
        m.cyl(0.004, 0.02, (0, 0, 0.03), "bronze", seg=4)
        for rz in (0, 60, 120):
            m.lathe([(0.03, -0.002), (0.03, 0.002), (0.026, 0.002), (0.026, -0.002)], (0, 0, 0.05), "gold",
                    seg=10, rx=90, rz=rz)
    m.flag(0.05, 0.03, (0.16, 0.12, g + 0.13), "TEAM", pole_h=0.08, rz=0)


# --- castle: walled compound with gatehouse and keep ------------------------------------------------

def bld_castle(m: Model):
    m.cyl(0.26, 0.02, (0, 0, 0), "grass", seg=12, r2=0.25)
    g = 0.02
    S = 0.2
    # curtain walls
    for rz in (0, 90, 180, 270):
        with m.xf((0, 0, 0), rz=rz):
            m.box(2 * S, 0.04, 0.12, (0, -S, g), "stone", bevel=0.004)
            m.merlons_line(-S + 0.03, S - 0.03, -S - 0.012, g + 0.12, 5, 0.03, 0.018, 0.024, "stone")
    # corner towers
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, y = sx * S, sy * S
            m.cyl(0.05, 0.18, (x, y, g), "stone", seg=8)
            m.cyl(0.058, 0.02, (x, y, g + 0.17), "stone_dark", seg=8)
            m.cone(0.062, 0.11, (x, y, g + 0.19), "TEAM", seg=8, eave=0.008)
            m.box(0.01, 0.006, 0.03, (x, y - 0.05, g + 0.1), "window")
    # gatehouse
    with m.xf((0, -S, g)):
        m.box(0.12, 0.07, 0.17, (0, 0, 0), "stone", bevel=0.004)
        m.merlons_line(-0.05, 0.05, -0.03, 0.17, 3, 0.026, 0.016, 0.022, "stone")
        m.arch_panel(0.05, 0.08, (0, -0.036, 0), "timber_dark", depth=0.006)
        for i in range(4):
            m.box(0.004, 0.004, 0.05, (-0.018 + i * 0.012, -0.041, 0.03), "iron")
        m.banner(0.034, 0.06, (0, -0.037, 0.15), "TEAM")
    # keep
    m.box(0.16, 0.14, 0.26, (0.02, 0.05, g), "stone", bevel=0.005)
    m.box(0.172, 0.152, 0.012, (0.02, 0.05, g + 0.26), "stone_dark", bevel=0.003)
    for rz in (0, 90, 180, 270):
        with m.xf((0.02, 0.05, 0), rz=rz):
            m.merlons_line(-0.055, 0.055, -0.07 if rz % 180 == 0 else -0.078, g + 0.272, 3, 0.03, 0.018, 0.026,
                           "stone")
    m.arch_panel(0.024, 0.04, (0.02, -0.021, g + 0.16), "window")
    m.flag(0.07, 0.04, (0.02, 0.05, g + 0.26), "TEAM", pole_h=0.16, rz=0)
    m.box(0.26, 0.26, 0.004, (0, 0.0, g), "earth")
    m.box(0.07, 0.05, 0.004, (0, -0.25, 0.0), "timber", bevel=0.001)


# --- aqueduct: two-tier arcade carrying a water channel --------------------------------------------

def bld_aqueduct(m: Model):
    L_ = 0.5
    m.box(L_, 0.07, 0.012, (0, 0, 0), "stone_dark", bevel=0.003)
    m.arcade(L_, 0.18, 0.05, 3, (0, 0, 0.012), "stone", pier=0.26, seg=5, spring=0.5)
    m.box(L_, 0.064, 0.014, (0, 0, 0.192), "sandstone", bevel=0.003)
    m.arcade(L_, 0.09, 0.044, 6, (0, 0, 0.206), "stone", pier=0.28, seg=4, spring=0.4)
    m.box(L_, 0.064, 0.016, (0, 0, 0.296), "sandstone", bevel=0.003)
    for sy in (-1, 1):
        m.box(L_, 0.012, 0.022, (0, sy * 0.026, 0.312), "stone", bevel=0.002)
    m.box(L_, 0.04, 0.012, (0, 0, 0.312), "water")
    # water spilling into a basin at the right end
    m.box(0.008, 0.024, 0.3, (0.252, 0, 0.02), "water")
    m.lathe([(0.05, 0.0), (0.05, 0.024), (0.042, 0.024), (0.042, 0.008), (0.0, 0.008)], (0.2, -0.07, 0.0),
            "marble", seg=10)
    m.cyl(0.042, 0.004, (0.2, -0.07, 0.016), "water", seg=10)
    for x in (-0.2, 0.0, 0.2):
        m.banner(0.036, 0.07, (x - 0.0, -0.028, 0.29), "TEAM")
    L.cypress(m, (-0.2, -0.09, 0.0), h=0.14)
    L.bush(m, (-0.12, -0.08, 0.0), 0.022)


# --- cathedral: gothic nave, twin spires, rose window ---------------------------------------------

def bld_cathedral(m: Model):
    m.box(0.36, 0.48, 0.016, (0, 0.0, 0), "stone", bevel=0.004)
    g = 0.016
    NW, NL = 0.12, 0.32
    ny = 0.04
    m.box(NW, NL, 0.17, (0, ny, g), "stone", bevel=0.004)
    m.gable(NL, NW, 0.1, (0, ny, g + 0.17), "roof_slate", over=0.01, rz=90)
    # aisles + buttresses
    for sx in (-1, 1):
        m.box(0.05, NL - 0.04, 0.1, (sx * 0.085, ny + 0.02, g), "stone", bevel=0.003)
        m.box(0.05, NL - 0.04, 0.006, (sx * 0.085, ny + 0.02, g + 0.1), "roof_slate", bevel=0.001,
              top=(0.6, 1.0), top_off=(-sx * 0.012, 0))
        for i in range(4):
            y = ny - 0.08 + i * 0.07
            m.box(0.018, 0.018, 0.13, (sx * 0.118, y, g), "stone_dark", bevel=0.002, top=(0.6, 1.0))
            m.box(0.05, 0.01, 0.01, (sx * 0.085, y, g + 0.14), "stone_dark", ry=sx * 30)
            with m.xf((sx * 0.111, y + 0.035, 0), rz=90 * sx):
                L.lancet(m, 0.02, 0.06, (0, 0, g + 0.025), "TEAM_DARK", depth=0.004)
    # transept
    m.box(0.3, 0.08, 0.15, (0, ny + 0.06, g), "stone", bevel=0.004)
    m.gable(0.3, 0.08, 0.09, (0, ny + 0.06, g + 0.15), "roof_slate", over=0.01)
    # apse
    m.cyl(0.06, 0.14, (0, ny + NL / 2, g), "stone", seg=8)
    m.cone(0.066, 0.08, (0, ny + NL / 2, g + 0.14), "roof_slate", seg=8)
    # west front: twin towers with TEAM spires
    fy = ny - NL / 2
    m.box(0.12, 0.04, 0.2, (0, fy - 0.01, g), "stone", bevel=0.003)
    m.prism([(-0.06, 0.0), (0.06, 0.0), (0.0, 0.07)], 0.03, (0, fy - 0.012, g + 0.2), "stone")
    m.cyl(0.032, 0.01, (0, fy - 0.034, g + 0.14), "gold", seg=10, rx=90)
    m.cyl(0.026, 0.012, (0, fy - 0.036, g + 0.14), "TEAM", seg=10, rx=90)
    L.lancet(m, 0.05, 0.1, (0, fy - 0.032, g), "timber_dark", depth=0.006)
    for sx in (-1, 1):
        tx = sx * 0.085
        m.box(0.07, 0.07, 0.28, (tx, fy, g), "stone", bevel=0.004)
        m.box(0.076, 0.076, 0.012, (tx, fy, g + 0.2), "stone_dark", bevel=0.002)
        L.lancet(m, 0.024, 0.06, (tx, fy - 0.036, g + 0.21), "window", depth=0.004)
        L.lancet(m, 0.02, 0.05, (tx, fy - 0.036, g + 0.08), "window", depth=0.004)
        for px in (-1, 1):
            for py in (-1, 1):
                m.cyl(0.008, 0.03, (tx + px * 0.03, fy + py * 0.03, g + 0.28), "stone", seg=4, r2=0.0)
        m.lathe([(0.036, 0.0), (0.03, 0.02), (0.0, 0.16)], (tx, fy, g + 0.28), "TEAM", seg=8,
                phase=math.pi / 8)
        m.cyl(0.004, 0.02, (tx, fy, g + 0.44), "gold", seg=4)
    m.cyl(0.004, 0.06, (0, ny + 0.06, g + 0.24), "gold", seg=4)
    m.box(0.03, 0.004, 0.004, (0, ny + 0.06, g + 0.285), "gold")


# --- power plant: cooling towers, turbine hall, striped stack --------------------------------------

def bld_powerplant(m: Model):
    m.box(0.48, 0.44, 0.014, (0, 0, 0), "concrete_dark", bevel=0.004)
    g = 0.014
    hyper = [(0.085, 0.0), (0.07, 0.07), (0.058, 0.15), (0.062, 0.2), (0.066, 0.22)]
    for tx, ty, s in ((-0.12, 0.1, 1.0), (0.1, 0.12, 0.88)):
        prof = [(r * s, z * s) for r, z in hyper]
        m.lathe(prof, (tx, ty, g), "concrete_light", seg=12, cap_top=False)
        inner = [(r * s - 0.006, z * s) for r, z in reversed(hyper)]
        m.lathe(inner, (tx, ty, g), "concrete_dark", seg=12, cap_top=False, cap_bottom=False)
        m.cyl(0.066 * s + 0.002, 0.012, (tx, ty, g + 0.19 * s), "TEAM", seg=12)
        for r, dz, dx in ((0.05, 0.0, 0.0), (0.042, 0.05, 0.02), (0.03, 0.09, 0.04)):
            m.lathe([(r * 0.7, 0.0), (r, r * 0.5), (r * 0.8, r * 1.1), (0.0, r * 1.4)],
                    (tx + dx * s, ty, g + 0.2 * s + dz * s), "white", seg=8)
    # turbine hall
    m.box(0.3, 0.12, 0.1, (0.02, -0.1, g), "concrete", bevel=0.004)
    m.box(0.304, 0.124, 0.024, (0.02, -0.1, g + 0.06), "glass_dark")
    m.box(0.31, 0.13, 0.01, (0.02, -0.1, g + 0.1), "concrete_light", bevel=0.002)
    m.box(0.12, 0.006, 0.03, (-0.03, -0.163, g + 0.02), "TEAM")
    m.box(0.04, 0.006, 0.05, (0.1, -0.163, g), "iron")
    # stack
    for i in range(5):
        m.cyl(0.024 - i * 0.002, 0.07, (0.2, -0.05, g + i * 0.07), "red" if i % 2 else "white", seg=8,
              r2=0.022 - i * 0.002)
    # pylon
    with m.xf((-0.2, -0.16, g)):
        m.prism([(-0.03, 0.0), (0.03, 0.0), (0.008, 0.18), (-0.008, 0.18)], 0.012, (0, 0, 0), "iron")
        m.box(0.08, 0.008, 0.008, (0, 0, 0.14), "iron")
        m.box(0.06, 0.008, 0.008, (0, 0, 0.17), "iron")


# --- stadium: oval bowl, pitch, floodlights ---------------------------------------------------------

def bld_stadium(m: Model):
    rx, ry = 0.23, 0.17
    n = 20
    path = _ellipse(rx, ry, n, math.pi / n)
    H = 0.12
    prof = [(-0.1, 0.012), (0.02, 0.0), (0.02, H), (0.004, H), (-0.02, H - 0.02), (-0.02, H - 0.03),
            (-0.045, H - 0.045), (-0.045, H - 0.055), (-0.07, H - 0.07), (-0.07, H - 0.08), (-0.1, H - 0.095)]
    m.sweep(prof, path, True, (0, 0, 0), "concrete_light")
    seats = [(0.0, H - 0.001), (-0.02, H - 0.017), (-0.02, H - 0.027), (-0.045, H - 0.042),
             (-0.045, H - 0.052), (-0.07, H - 0.067), (-0.07, H - 0.077), (-0.1, H - 0.092),
             (-0.1, H - 0.1), (0.0, H - 0.03)]
    m.sweep(seats, path, True, (0, 0, 0), "TEAM")
    k = (ry + 0.024) / (rx + 0.024)
    m.cyl(rx + 0.024, 0.03, (0, 0, 0.05), "TEAM", seg=n, sy=k, phase=math.pi / n, cap_top=False,
          cap_bottom=False)
    m.cyl(rx + 0.026, 0.008, (0, 0, 0.09), "TEAM_DARK", seg=n, sy=(ry + 0.026) / (rx + 0.026),
          phase=math.pi / n, cap_top=False, cap_bottom=False)
    # pitch
    m.lathe([(1.0, 0.0), (1.0, 0.016), (0.0, 0.016)], (0, 0, 0), "grass", seg=n, sx=rx - 0.1, sy=ry - 0.1,
            phase=math.pi / n)
    m.box(0.004, 0.14, 0.002, (0, 0, 0.016), "white")
    m.lathe([(0.024, 0.0), (0.024, 0.002), (0.018, 0.002), (0.018, 0.0)], (0, 0, 0.016), "white", seg=10)
    for sx in (-1, 1):
        m.box(0.03, 0.06, 0.002, (sx * 0.1, 0, 0.016), "white")
    # floodlights
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, y = sx * (rx - 0.01), sy * (ry - 0.01)
            m.cyl(0.006, 0.22, (x, y, H - 0.02), "iron", seg=5)
            with m.xf((x, y, H + 0.2), rz=math.degrees(math.atan2(-y, -x)) + 90):
                m.box(0.05, 0.012, 0.03, (0, 0, 0), "iron", rx=20)
                m.box(0.044, 0.004, 0.024, (0, -0.008, 0.003), "lamp", rx=20)
    m.arch_panel(0.05, 0.05, (0, -(ry + 0.02), 0.0), "glass_dark", depth=0.012)


# --- lighthouse: striped TEAM tower on a rocky head ------------------------------------------------

def bld_lighthouse(m: Model):
    m.lathe([(0.2, 0.0), (0.21, 0.02), (0.17, 0.05), (0.11, 0.07), (0.0, 0.075)], (0, 0, 0), "rock", seg=9,
            phase=0.3)
    m.lathe([(0.1, 0.0), (0.12, 0.02), (0.07, 0.045), (0.0, 0.05)], (-0.14, -0.1, 0.0), "rock", seg=7)
    m.lathe([(0.07, 0.0), (0.08, 0.02), (0.04, 0.04), (0.0, 0.045)], (0.15, -0.12, 0.0), "rock", seg=6)
    b = 0.07
    m.cyl(0.08, 0.02, (0, 0.02, b), "stone", seg=10)
    zs = [0.02, 0.1, 0.18, 0.26]
    r0, r1 = 0.064, 0.045
    tot = 0.32
    for i, z in enumerate(zs):
        ra = r0 + (r1 - r0) * (z - 0.02) / (tot - 0.02)
        rb = r0 + (r1 - r0) * (min(z + 0.08, tot) - 0.02) / (tot - 0.02)
        m.cyl(ra, min(0.08, tot - z), (0, 0.02, b + z), "TEAM" if i % 2 else "white", seg=10, r2=rb)
    top = b + tot
    m.cyl(0.066, 0.012, (0, 0.02, top), "iron", seg=10)
    for i in range(10):
        a = 2 * math.pi * i / 10
        m.cyl(0.0025, 0.022, (0.062 * math.cos(a), 0.02 + 0.062 * math.sin(a), top + 0.012), "iron", seg=3)
    m.cyl(0.066, 0.004, (0, 0.02, top + 0.032), "iron", seg=10, cap_bottom=False)
    m.cyl(0.036, 0.05, (0, 0.02, top + 0.012), "lamp", seg=8)
    for i in range(8):
        a = 2 * math.pi * (i + 0.5) / 8
        m.box(0.004, 0.004, 0.05, (0.037 * math.cos(a), 0.02 + 0.037 * math.sin(a), top + 0.012), "iron")
    m.dome(0.044, 0.04, (0, 0.02, top + 0.062), "TEAM_DARK", seg=8, rings=2)
    m.cyl(0.004, 0.02, (0, 0.02, top + 0.1), "gold", seg=4)
    m.arch_panel(0.024, 0.04, (0, 0.02 - 0.064, b + 0.02), "timber_dark", depth=0.01)
    for z in (0.12, 0.2):
        m.box(0.012, 0.01, 0.018, (0, 0.02 - 0.058 + z * 0.02, b + z), "window")
    # keeper's cottage
    with m.xf((0.11, 0.1, 0.05), rz=-20):
        m.box(0.09, 0.07, 0.05, (0, 0, 0), "white", bevel=0.004)
        m.gable(0.09, 0.07, 0.04, (0, 0, 0.05), "TEAM_DARK", over=0.008)
        m.box(0.018, 0.004, 0.03, (-0.02, -0.036, 0.0), "timber_dark")
        m.box(0.016, 0.004, 0.016, (0.02, -0.036, 0.02), "window")


LANDMARKS = {
    "bld_" + fn.__name__[4:]: fn for fn in (
        bld_temple, bld_library, bld_market, bld_barracks, bld_harbor, bld_granary, bld_workshop,
        bld_university, bld_amphitheater, bld_bank, bld_factory, bld_observatory, bld_castle,
        bld_aqueduct, bld_cathedral, bld_powerplant, bld_stadium, bld_lighthouse,
    )
}
