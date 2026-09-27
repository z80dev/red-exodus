"""AEONS city kit — era landmarks `city_center_<0..5>` (≤ 0.55 tall, ≤ 1500 tris).

Footprint stays inside ±0.26 so the renderer can ring houses around it inside the hex.
Every centre carries TEAM banners / roofs so ownership reads at a glance.
"""

import math

import city_lib as L
from city_lib import Model


# --- 0 · Ancient: mud-brick palace ziggurat ---------------------------------------------------

def center_0(m: Model):
    m.box(0.5, 0.46, 0.022, (0, 0.01, 0), "mudbrick_dark", bevel=0.006)
    tiers = [(0.42, 0.36, 0.08, "mudbrick"), (0.31, 0.27, 0.072, "sandstone"), (0.2, 0.18, 0.066, "mudbrick")]
    z = 0.022
    for w, d, h, mat in tiers:
        m.box(w, d, h, (0, 0.03, z), mat, bevel=0.007, top=(0.93, 0.93))
        m.box(w * 0.93 + 0.008, d * 0.93 + 0.008, 0.01, (0, 0.03, z + h - 0.004), "mudbrick_dark", bevel=0.003)
        z += h
    top = z + 0.006
    # buttress ribs on tier 1 (Mesopotamian niche-and-buttress rhythm)
    for x in (-0.17, -0.11, 0.11, 0.17):
        m.box(0.022, 0.012, 0.07, (x, -0.146, 0.022), "mudbrick_dark", top=(1.0, 0.6))
    # grand stair up the front
    L.stairs(m, 0.0, -0.245, -0.06, 0.0, top - 0.004, 0.075, 9, "sandstone", "mudbrick_dark")
    # shrine on the summit
    m.box(0.12, 0.1, 0.07, (0, 0.04, top - 0.004), "sandstone", bevel=0.006)
    m.box(0.14, 0.12, 0.016, (0, 0.04, top + 0.066), "TEAM", bevel=0.004)
    m.box(0.12, 0.1, 0.012, (0, 0.04, top + 0.082), "TEAM_DARK", bevel=0.003)
    m.arch_panel(0.036, 0.052, (0, -0.012, top - 0.004), "timber_dark", depth=0.006)
    m.box(0.13, 0.11, 0.008, (0, 0.04, top + 0.026), "gold")
    for sx in (-1, 1):
        m.cyl(0.012, 0.02, (sx * 0.056, 0.0, top + 0.094), "gold", seg=6, r2=0.0)
        m.flag(0.07, 0.042, (sx * 0.085, 0.1, top - 0.004), "TEAM", pole_h=0.19,
               rz=0 if sx > 0 else 180)
        m.banner(0.05, 0.062, (sx * 0.115, -0.148, 0.098), "TEAM")
        L.brazier(m, (sx * 0.075, -0.235, 0.022), h=0.036)
        L.palm(m, (sx * 0.2, -0.19, 0.022), h=0.15, lean=12, rz=90 - sx * 70)
    L.palm(m, (0.195, 0.2, 0.022), h=0.13, lean=8, rz=-40)
    L.palm(m, (-0.19, 0.2, 0.022), h=0.17, lean=10, rz=210)


# --- 1 · Classical: peripteral temple + forum ---------------------------------------------------

def center_1(m: Model):
    W, D = 0.36, 0.3
    for i, (w, d) in enumerate(((0.44, 0.38), (0.41, 0.35), (0.38, 0.32))):
        m.box(w, d, 0.02, (0, 0.03, i * 0.02), "marble" if i % 2 == 0 else "stone", bevel=0.004)
    base = 0.06
    ch = 0.19
    m.box(0.24, 0.2, ch, (0, 0.05, base), "plaster", bevel=0.004)
    m.arch_panel(0.05, 0.1, (0, -0.051, base), "timber_dark", depth=0.006)
    cols_x = [(-W / 2 + 0.02) + i * ((W - 0.04) / 5) for i in range(6)]
    for x in cols_x:
        m.column(0.013, ch, (x, -0.1, base), "marble")
    for y in (-0.03, 0.05, 0.13):
        for x in (-W / 2 + 0.02, W / 2 - 0.02):
            m.column(0.013, ch, (x, y, base), "marble")
    m.box(W + 0.02, D + 0.02, 0.028, (0, 0.03, base + ch), "marble", bevel=0.004)
    m.box(W + 0.03, D + 0.03, 0.01, (0, 0.03, base + ch + 0.024), "gold")
    rz0 = base + ch + 0.034
    m.gable(D + 0.02, W + 0.02, 0.085, (0, 0.03, rz0), "TEAM", over=0.012, rz=90, eave=0.014)
    # tympanum + acroteria
    hw = W / 2 + 0.01
    m.prism([(-hw + 0.016, 0.014), (hw - 0.016, 0.014), (0.0, 0.07)], 0.008, (0, -0.146, rz0), "marble")
    # ridge cap + tile ribs so the big TEAM roof reads as tiles, not a plane
    m.box(0.016, D + 0.06, 0.012, (0, 0.03, rz0 + 0.078), "TEAM_DARK", bevel=0.003)
    slope = math.degrees(math.atan2(0.085 - 0.014, hw + 0.012))
    for sx in (-1, 1):
        for i in range(4):
            y = 0.03 + (i - 1.5) * 0.085
            m.box(0.2, 0.012, 0.008, (sx * 0.1, y, rz0 + 0.049), "TEAM_DARK", ry=sx * slope)
    m.cyl(0.012, 0.024, (0, -0.13, rz0 + 0.085), "gold", seg=5, r2=0.0)
    for sx in (-1, 1):
        m.cyl(0.009, 0.018, (sx * (hw + 0.004), -0.13, rz0 + 0.012), "gold", seg=5, r2=0.0)
        m.banner(0.042, 0.1, (sx * 0.075, -0.106, base + ch - 0.004), "TEAM")
        L.brazier(m, (sx * 0.19, -0.19, 0.0), h=0.05)
    m.box(0.12, 0.05, 0.004, (0, -0.19, 0.0), "marble")
    # victory column with golden eagle (forum landmark)
    vx, vy = -0.225, -0.2
    m.box(0.06, 0.06, 0.03, (vx, vy, 0), "marble", bevel=0.004)
    m.cyl(0.018, 0.34, (vx, vy, 0.03), "marble", seg=8, r2=0.015)
    for z in (0.12, 0.22, 0.31):
        m.cyl(0.02, 0.008, (vx, vy, z), "stone", seg=8)
    m.box(0.042, 0.042, 0.014, (vx, vy, 0.37), "marble", bevel=0.002)
    with m.xf((vx, vy, 0.384)):
        m.lathe([(0.0, 0.0), (0.012, 0.01), (0.01, 0.04), (0.0, 0.05)], (0, 0, 0), "gold", seg=5)
        for sx in (-1, 1):
            m.prism([(0.0, 0.0), (0.05, 0.035), (0.046, 0.012)], 0.004, (sx * 0.004, 0, 0.024), "gold",
                    rz=0 if sx > 0 else 180)
    L.statue(m, (0.215, -0.2, 0.0), h=0.13, mat="bronze", rz=-20)
    L.cypress(m, (0.225, 0.2, 0.0), h=0.16)
    L.cypress(m, (-0.225, 0.2, 0.0), h=0.13)
    m.flag(0.06, 0.036, (0.0, 0.18, rz0 + 0.07), "TEAM", pole_h=0.1, rz=0)


# --- 2 · Medieval: keep with corner turrets ----------------------------------------------------

def center_2(m: Model):
    m.lathe([(0.27, 0.0), (0.25, 0.03), (0.23, 0.04), (0.0, 0.04)], (0, 0.01, 0), "grass", seg=8,
            phase=math.pi / 8)
    m.box(0.3, 0.28, 0.03, (0, 0.02, 0.03), "stone_dark", bevel=0.006, top=(0.95, 0.95))
    K = 0.22
    kb = 0.058
    m.box(K + 0.02, K + 0.02, 0.04, (0, 0.02, kb), "stone_dark", bevel=0.006, top=(0.93, 0.93))
    m.box(K, K, 0.25, (0, 0.02, kb), "stone", bevel=0.006)
    kt = kb + 0.25
    m.box(K + 0.018, K + 0.018, 0.012, (0, 0.02, kt - 0.012), "stone_dark", bevel=0.003)
    for s in range(4):
        with m.xf((0, 0.02, 0), rz=90 * s):
            m.merlons_line(-0.08, 0.08, -K / 2 - 0.004, kt, 4, 0.026, 0.02, 0.026, "stone")
    # corner turrets with TEAM cone roofs
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, y = sx * K / 2, 0.02 + sy * K / 2
            m.cyl(0.042, 0.31, (x, y, kb), "stone", seg=8)
            m.cyl(0.052, 0.022, (x, y, kb + 0.29), "stone_dark", seg=8, r2=0.052)
            m.cone(0.058, 0.13, (x, y, kb + 0.312), "TEAM", seg=8, eave=0.01)
            m.cyl(0.004, 0.022, (x, y, kb + 0.44), "gold", seg=4)
            m.box(0.01, 0.006, 0.03, (x + sx * 0.0, y - 0.042, kb + 0.2), "window")
    # central donjon
    m.box(0.1, 0.1, 0.1, (0, 0.03, kt), "stone", bevel=0.005)
    m.merlons_ring(0.072, kt + 0.1, 8, 0.02, 0.018, 0.018, "stone_dark", (0, 0.03, 0))
    m.hip(0.1, 0.1, 0.08, (0, 0.03, kt + 0.1), "TEAM_DARK", over=0.006, ridge=0.0)
    m.flag(0.07, 0.042, (0.0, 0.03, kt + 0.15), "TEAM", pole_h=0.07, rz=0)
    # gate, banners, windows
    m.arch_panel(0.06, 0.085, (0, -0.093, kb), "timber_dark", depth=0.008)
    m.box(0.07, 0.01, 0.01, (0, -0.094, kb + 0.085), "stone_dark")
    for sx in (-1, 1):
        m.banner(0.042, 0.1, (sx * 0.06, -0.093, kt - 0.03), "TEAM")
        m.arch_panel(0.016, 0.032, (sx * 0.06, -0.094, kb + 0.1), "window")
    m.arch_panel(0.02, 0.04, (0, -0.094, kb + 0.14), "window")
    L.stairs(m, 0.0, -0.2, -0.1, 0.0, kb, 0.07, 4, "stone_dark")
    L.bush(m, (-0.16, -0.2, 0.0), 0.028, "foliage")
    L.bush(m, (0.17, -0.18, 0.0), 0.024, "foliage_light")


# --- 3 · Renaissance: domed palazzo ------------------------------------------------------------

def center_3(m: Model):
    m.box(0.5, 0.38, 0.02, (0, 0.02, 0), "stone", bevel=0.005)
    BW, BD = 0.42, 0.26
    g = 0.02
    m.box(BW, BD, 0.06, (0, 0.04, g), "stone", bevel=0.005)
    m.box(BW, BD, 0.1, (0, 0.04, g + 0.06), "plaster_ochre", bevel=0.004)
    top = g + 0.16
    m.box(BW + 0.016, BD + 0.016, 0.014, (0, 0.04, top), "marble", bevel=0.003)
    m.hip(BW, BD, 0.05, (0, 0.04, top + 0.012), "roof_terracotta", over=0.004)
    fy = 0.04 - BD / 2
    for i in range(7):
        x = -0.18 + i * 0.06
        if abs(x) < 0.05:
            continue
        m.arch_panel(0.022, 0.036, (x, fy - 0.001, g + 0.012), "window")
        m.arch_panel(0.022, 0.04, (x, fy - 0.001, g + 0.08), "window")
        m.box(0.03, 0.006, 0.006, (x, fy - 0.003, g + 0.076), "marble")
    # central portico with pediment and giant order
    m.box(0.13, 0.03, 0.16, (0, fy - 0.012, g), "marble", bevel=0.003)
    for x in (-0.05, -0.017, 0.017, 0.05):
        m.column(0.009, 0.15, (x, fy - 0.036, g), "marble")
    m.box(0.13, 0.04, 0.016, (0, fy - 0.022, g + 0.15), "marble", bevel=0.002)
    m.prism([(-0.072, 0.0), (0.072, 0.0), (0.0, 0.044)], 0.036, (0, fy - 0.022, g + 0.166), "marble",
            bevel=0.002)
    m.prism([(-0.05, 0.008), (0.05, 0.008), (0.0, 0.032)], 0.004, (0, fy - 0.041, g + 0.166), "TEAM")
    m.arch_panel(0.036, 0.07, (0, fy - 0.028, g), "timber_dark", depth=0.004)
    # drum, dome and lantern
    dz = top + 0.03
    m.cyl(0.1, 0.07, (0, 0.06, dz), "marble", seg=12)
    m.cyl(0.108, 0.012, (0, 0.06, dz + 0.066), "stone", seg=12)
    for i in range(6):
        a = math.radians(-90 + (i - 2.5) * 22)
        m.arch_panel(0.018, 0.034, (0.101 * math.cos(a), 0.06 + 0.101 * math.sin(a), dz + 0.016),
                     "window", depth=0.006)
    m.dome(0.1, 0.12, (0, 0.06, dz + 0.078), "TEAM", seg=12, rings=3)
    for i in range(6):
        a = math.radians(30 + 60 * i)
        m.box(0.008, 0.008, 0.004, (0.1 * math.cos(a), 0.06 + 0.1 * math.sin(a), dz + 0.078), "gold")
    m.cyl(0.024, 0.04, (0, 0.06, dz + 0.19), "marble", seg=8)
    m.cone(0.03, 0.024, (0, 0.06, dz + 0.23), "gold", seg=8)
    m.cyl(0.004, 0.03, (0, 0.06, dz + 0.25), "gold", seg=4)
    # belvedere towers
    for sx in (-1, 1):
        x = sx * 0.2
        m.box(0.07, 0.07, 0.29, (x, 0.12, g), "plaster_ochre", bevel=0.004)
        m.box(0.078, 0.078, 0.01, (x, 0.12, g + 0.29), "marble")
        m.arch_panel(0.024, 0.04, (x, 0.084, g + 0.22), "window", depth=0.004)
        m.hip(0.074, 0.074, 0.05, (x, 0.12, g + 0.3), "roof_terracotta", over=0.008, ridge=0.0)
        m.banner(0.036, 0.08, (x, 0.083, g + 0.2), "TEAM")
    L.cypress(m, (-0.225, -0.14, 0.02), h=0.15)
    L.cypress(m, (0.225, -0.14, 0.02), h=0.15)
    m.lathe([(0.05, 0.0), (0.05, 0.016), (0.042, 0.016), (0.042, 0.006), (0.0, 0.006)], (0.14, -0.17, 0.02),
            "marble", seg=8)
    m.cyl(0.036, 0.004, (0.14, -0.17, 0.028), "water", seg=8)
    m.cyl(0.006, 0.04, (0.14, -0.17, 0.02), "marble", seg=5)


# --- 4 · Industrial: town hall with clock tower & chimneys -------------------------------------

def center_4(m: Model):
    m.box(0.5, 0.4, 0.018, (0, 0.02, 0), "stone", bevel=0.005)
    g = 0.018
    BW, BD = 0.42, 0.22
    m.box(BW, BD, 0.15, (0, 0.06, g), "brick", bevel=0.004)
    m.box(BW + 0.006, BD + 0.006, 0.02, (0, 0.06, g), "stone", bevel=0.003)
    m.box(BW + 0.01, BD + 0.01, 0.012, (0, 0.06, g + 0.07), "stone")
    m.box(BW + 0.014, BD + 0.014, 0.014, (0, 0.06, g + 0.148), "stone", bevel=0.003)
    for sx in (-1, 1):
        m.box(0.02, BD + 0.012, 0.15, (sx * (BW / 2 - 0.006), 0.06, g), "stone")
    m.box(BW + 0.004, BD + 0.004, 0.06, (0, 0.06, g + 0.162), "roof_slate", bevel=0.003, top=(0.82, 0.62))
    m.box(BW * 0.82, BD * 0.62, 0.008, (0, 0.06, g + 0.222), "iron", bevel=0.002)
    fy = 0.06 - BD / 2
    for i in range(8):
        x = -0.175 + i * 0.05
        if abs(x) < 0.07:
            continue
        for z in (0.026, 0.09):
            m.box(0.026, 0.006, 0.042, (x, fy - 0.002, g + z), "white")
            m.box(0.018, 0.008, 0.034, (x, fy - 0.003, g + z + 0.004), "window")
        m.box(0.022, 0.03, 0.026, (x, fy + 0.02, g + 0.172), "roof_slate")
        m.box(0.014, 0.006, 0.016, (x, fy + 0.004, g + 0.176), "window")
    # central clock tower
    T = 0.11
    ty = fy + 0.03
    m.box(T, T, 0.34, (0, ty, g), "brick", bevel=0.004)
    for z in (0.07, 0.148, 0.24):
        m.box(T + 0.01, T + 0.01, 0.012, (0, ty, g + z), "stone")
    for sx in (-1, 1):
        m.box(0.014, T + 0.008, 0.34, (sx * (T / 2 - 0.004), ty, g), "stone")
    m.arch_panel(0.05, 0.075, (0, ty - T / 2 - 0.003, g), "TEAM_DARK", depth=0.006)
    m.arch_panel(0.03, 0.05, (0, ty - T / 2 - 0.002, g + 0.09), "window")
    m.arch_panel(0.03, 0.06, (0, ty - T / 2 - 0.002, g + 0.166), "window")
    cz = g + 0.285
    for rz in (0, 90, 270):
        with m.xf((0, ty, 0), rz=rz):
            m.cyl(0.036, 0.012, (0, -T / 2 - 0.004, cz), "gold", seg=10, rx=90)
            m.cyl(0.03, 0.014, (0, -T / 2 - 0.006, cz), "clock", seg=10, rx=90)
            m.box(0.004, 0.004, 0.022, (0, -T / 2 - 0.02, cz - 0.002), "iron")
            m.box(0.016, 0.004, 0.004, (0.006, -T / 2 - 0.02, cz - 0.002), "iron")
    m.box(T + 0.02, T + 0.02, 0.014, (0, ty, g + 0.34), "stone", bevel=0.003)
    m.box(T - 0.014, T - 0.014, 0.05, (0, ty, g + 0.354), "stone", bevel=0.003)
    for rz in (0, 90, 180, 270):
        with m.xf((0, ty, 0), rz=rz):
            m.arch_panel(0.03, 0.04, (0, -(T - 0.014) / 2 - 0.002, g + 0.36), "window")
    m.hip(T - 0.014, T - 0.014, 0.1, (0, ty, g + 0.404), "roof_slate", over=0.008, ridge=0.0)
    m.flag(0.07, 0.04, (0, ty, g + 0.44), "TEAM", pole_h=0.065, pole_mat="iron")
    for sx in (-1, 1):
        m.banner(0.036, 0.09, (sx * 0.088, fy - 0.004, g + 0.14), "TEAM")
        cx, cy = sx * 0.155, 0.16
        m.prism([(-0.024, -0.024), (0.024, -0.024), (0.024, 0.024), (-0.024, 0.024)], 0.34, (cx, cy, 0.0),
                "brick_dark", plane="XY", top_scale=0.7)
        m.box(0.042, 0.042, 0.018, (cx, cy, 0.325), "stone", bevel=0.003)
        m.box(0.03, 0.03, 0.012, (cx, cy, 0.343), "iron")
    L.stairs(m, 0.0, -0.2, fy - 0.004, 0.0, g + 0.012, 0.12, 3, "stone")
    for sx in (-1, 1):
        L.pole_lamp(m, (sx * 0.08, -0.19, 0.0), h=0.07)
        L.round_tree(m, (sx * 0.2, -0.16, 0.018), r=0.038, mat="foliage")


# --- 5 · Modern: glass tower cluster -----------------------------------------------------------

def center_5(m: Model):
    m.box(0.5, 0.42, 0.016, (0, 0.02, 0), "concrete", bevel=0.004)
    g = 0.016
    m.box(0.42, 0.3, 0.05, (0, 0.05, g), "concrete_light", bevel=0.004)
    m.box(0.424, 0.304, 0.03, (0, 0.05, g), "glass_dark")
    m.box(0.18, 0.05, 0.006, (0, -0.12, g + 0.04), "TEAM", bevel=0.002)
    pz = g + 0.05
    # tower A — tallest, square with fins and a TEAM crown
    ax, ay = -0.07, 0.08
    m.box(0.13, 0.13, 0.37, (ax, ay, pz), "glass", bevel=0.003)
    for z in range(1, 9):
        m.box(0.134, 0.134, 0.008, (ax, ay, pz + z * 0.04), "concrete_light")
    for sx in (-1, 1):
        for sy in (-1, 1):
            m.box(0.012, 0.012, 0.38, (ax + sx * 0.062, ay + sy * 0.062, pz), "concrete_light")
    m.box(0.138, 0.138, 0.03, (ax, ay, pz + 0.37), "TEAM", bevel=0.003)
    m.box(0.09, 0.09, 0.02, (ax, ay, pz + 0.4), "concrete", bevel=0.003)
    m.cyl(0.004, 0.06, (ax + 0.02, ay, pz + 0.42), "iron", seg=4)
    m.box(0.008, 0.008, 0.008, (ax + 0.02, ay, pz + 0.475), "red")
    # tower B — octagonal, dark glass, TEAM ring
    bx, by = 0.1, 0.12
    m.cyl(0.07, 0.3, (bx, by, pz), "glass_dark", seg=8)
    for z in (0.06, 0.12, 0.18, 0.24):
        m.cyl(0.073, 0.008, (bx, by, pz + z), "concrete_light", seg=8)
    m.cyl(0.074, 0.025, (bx, by, pz + 0.3), "TEAM", seg=8)
    m.cyl(0.05, 0.03, (bx, by, pz + 0.325), "concrete_light", seg=8, r2=0.035)
    # tower C — sloped crown
    cx, cy = 0.07, -0.05
    m.box(0.1, 0.09, 0.19, (cx, cy, pz), "glass", bevel=0.003)
    for z in (0.05, 0.1, 0.15):
        m.box(0.104, 0.094, 0.008, (cx, cy, pz + z), "white")
    m.prism([(-0.05, 0.0), (0.05, 0.0), (0.05, 0.06), (-0.05, 0.02)], 0.09, (cx, cy, pz + 0.19), "TEAM_DARK")
    m.box(0.012, 0.094, 0.25, (cx - 0.05, cy, pz), "white")
    # plaza details
    m.box(0.08, 0.05, 0.004, (-0.1, -0.15, g), "grass")
    L.round_tree(m, (-0.12, -0.15, g), r=0.026, mat="foliage_light", trunk=0.018)
    L.round_tree(m, (-0.08, -0.16, g), r=0.022, mat="foliage", trunk=0.016)
    for x in (-0.2, -0.17, -0.14):
        m.flag(0.04, 0.024, (x, -0.13, pz), "TEAM", pole_h=0.1, pole_mat="concrete_light",
               swallow=False, finial=None)
    L.round_tree(m, (0.215, -0.17, 0.0), r=0.03, mat="foliage", trunk=0.02)
    L.pole_lamp(m, (0.18, -0.19, 0.0), h=0.06)


CENTERS = {f"city_center_{i}": fn for i, fn in enumerate((center_0, center_1, center_2, center_3, center_4, center_5))}
