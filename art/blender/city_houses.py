"""AEONS city kit — dwellings `house_<era>_a` / `house_<era>_b` (era 0..5).

Height 0.12–0.25, footprint ≈ 0.12–0.17, ≤ 400 tris, front faces -Y (Blender).
"""

from city_lib import Model


# --- era 0 · Ancient ---------------------------------------------------------------------------

def house_0_a(m: Model):
    """Round mud-brick hut, fat thatch cone, clay pot and TEAM pennant stick."""
    m.cyl(0.078, 0.014, (0, 0, 0), "mudbrick_dark", seg=8, bevel=0.004)
    m.cyl(0.066, 0.066, (0, 0, 0.012), "mudbrick", seg=8, r2=0.062)
    m.lathe([(0.09, 0.066), (0.092, 0.078), (0.05, 0.128), (0.012, 0.16), (0.0, 0.164)],
            (0, 0, 0), "thatch", seg=8)
    m.cyl(0.02, 0.018, (0, 0, 0.152), "thatch_dark", seg=6, r2=0.008)
    m.arch_panel(0.032, 0.046, (0, -0.064, 0.012), "timber_dark", depth=0.014)
    m.lathe([(0.012, 0), (0.02, 0.012), (0.016, 0.026), (0.01, 0.03), (0.012, 0.036)],
            (0.07, -0.05, 0), "roof_terracotta", seg=6)
    m.flag(0.034, 0.022, (-0.058, -0.038, 0.0), "TEAM", pole_h=0.1, rz=200, swallow=True)


def house_0_b(m: Model):
    """Flat-roofed mud-brick house: upper room, protruding roof beams, TEAM awning."""
    m.box(0.16, 0.13, 0.078, (0, 0, 0), "mudbrick", bevel=0.007, top=(0.97, 0.97))
    m.box(0.168, 0.138, 0.012, (0, 0, 0.074), "mudbrick_dark", bevel=0.004)
    m.box(0.072, 0.07, 0.05, (0.035, 0.025, 0.084), "mudbrick", bevel=0.006, top=(0.96, 0.96))
    m.box(0.078, 0.076, 0.009, (0.035, 0.025, 0.132), "mudbrick_dark", bevel=0.003)
    for i in range(4):
        m.cyl(0.0055, 0.03, (-0.06 + i * 0.04, -0.056, 0.064), "timber", seg=5, rx=90)
    m.arch_panel(0.032, 0.05, (-0.028, -0.066, 0), "timber_dark", depth=0.008)
    m.box(0.022, 0.006, 0.02, (0.04, -0.066, 0.036), "window")
    # awning on two poles
    m.cyl(0.004, 0.06, (-0.062, -0.1, 0), "timber", seg=4)
    m.cyl(0.004, 0.06, (0.006, -0.1, 0), "timber", seg=4)
    m.box(0.082, 0.05, 0.005, (-0.028, -0.084, 0.058), "TEAM", rx=-14)
    m.lathe([(0.012, 0), (0.019, 0.012), (0.014, 0.026), (0.009, 0.028), (0.011, 0.034)],
            (0.064, -0.086, 0), "roof_terracotta", seg=6)


# --- era 1 · Classical -------------------------------------------------------------------------

def house_1_a(m: Model):
    """Mediterranean villa: L-plan whitewashed blocks, terracotta hip roofs, cypress."""
    m.box(0.15, 0.11, 0.07, (0, 0.01, 0), "plaster", bevel=0.005)
    m.hip(0.15, 0.11, 0.045, (0, 0.01, 0.07), "roof_terracotta", over=0.014)
    m.box(0.07, 0.07, 0.05, (0.045, -0.07, 0), "plaster", bevel=0.005)
    m.hip(0.07, 0.07, 0.032, (0.045, -0.07, 0.05), "roof_terracotta", over=0.012, ridge=0.0)
    m.arch_panel(0.026, 0.044, (-0.035, -0.046, 0), "TEAM_DARK", depth=0.006)
    m.box(0.02, 0.006, 0.02, (0.045, -0.106, 0.022), "window")
    m.box(0.018, 0.006, 0.018, (-0.035, -0.046, 0.05), "window")
    # cypress
    m.cyl(0.006, 0.02, (-0.075, -0.07, 0), "timber", seg=4)
    m.lathe([(0.018, 0.012), (0.024, 0.04), (0.016, 0.1), (0.0, 0.13)],
            (-0.075, -0.07, 0), "foliage_dark", seg=6)


def house_1_b(m: Model):
    """Two-storey insula: ochre plaster, shop front with TEAM awning, tiled gable roof."""
    m.box(0.14, 0.12, 0.052, (0, 0, 0), "stone", bevel=0.005)
    m.box(0.146, 0.126, 0.058, (0, 0, 0.052), "plaster_ochre", bevel=0.005)
    m.box(0.152, 0.132, 0.008, (0, 0, 0.05), "marble", bevel=0.002)
    m.gable(0.146, 0.126, 0.05, (0, 0, 0.11), "roof_terracotta", over=0.013)
    m.box(0.07, 0.006, 0.036, (-0.02, -0.06, 0), "timber_dark")
    m.box(0.02, 0.006, 0.03, (0.045, -0.06, 0), "timber_dark")
    m.box(0.1, 0.04, 0.005, (-0.02, -0.078, 0.042), "TEAM", rx=-18)
    m.windows_row(-0.05, 0.05, -0.064, 0.068, 3, 0.018, 0.026)
    m.box(0.08, 0.02, 0.006, (0.0, -0.07, 0.06), "timber")


# --- era 2 · Medieval --------------------------------------------------------------------------

def house_2_a(m: Model):
    """Half-timbered cottage with steep thatch and a stone chimney."""
    w, d, h = 0.14, 0.1, 0.064
    m.box(w, d, 0.012, (0, 0, 0), "stone_dark", bevel=0.003)
    m.box(w, d, h, (0, 0, 0.01), "plaster", bevel=0.004)
    for x in (-0.066, -0.022, 0.022, 0.066):
        m.box(0.008, d + 0.006, h, (x, 0, 0.01), "timber_dark")
    m.box(w + 0.004, d + 0.006, 0.008, (0, 0, 0.066), "timber_dark")
    m.prism([(-0.044, 0.016), (-0.036, 0.016), (-0.004, 0.066), (-0.012, 0.066)], 0.006,
            (0, -0.052, 0), "timber_dark")
    m.gable(w, d, 0.09, (0, 0, 0.074), "thatch", over=0.018, eave=0.016)
    m.box(0.024, 0.006, 0.042, (0.0, -0.052, 0.01), "timber")
    m.box(0.018, 0.006, 0.018, (0.044, -0.052, 0.036), "window")
    m.box(0.026, 0.026, 0.13, (-0.05, 0.03, 0.03), "stone", bevel=0.004, top=(0.9, 0.9))
    m.box(0.03, 0.03, 0.01, (-0.05, 0.03, 0.158), "stone_dark", bevel=0.002)


def house_2_b(m: Model):
    """Tall jettied townhouse: stone ground floor, timbered upper, steep TEAM roof, dormer."""
    m.box(0.11, 0.11, 0.06, (0, 0, 0), "stone", bevel=0.005)
    m.box(0.124, 0.122, 0.062, (0, -0.004, 0.06), "plaster", bevel=0.003)
    for x in (-0.058, -0.02, 0.02, 0.058):
        m.box(0.008, 0.128, 0.062, (x, -0.004, 0.06), "timber_dark")
    m.box(0.13, 0.128, 0.008, (0, -0.004, 0.058), "timber_dark")
    m.prism([(-0.052, 0.066), (-0.044, 0.066), (-0.024, 0.118), (-0.032, 0.118)], 0.006,
            (0, -0.066, 0), "timber_dark")
    m.prism([(0.052, 0.066), (0.044, 0.066), (0.024, 0.118), (0.032, 0.118)], 0.006,
            (0, -0.066, 0), "timber_dark")
    m.gable(0.124, 0.122, 0.1, (0, -0.004, 0.122), "TEAM", over=0.014, rz=90)
    m.box(0.03, 0.006, 0.044, (-0.018, -0.056, 0), "timber")
    m.box(0.018, 0.006, 0.018, (0.03, -0.056, 0.026), "window")
    m.windows_row(-0.02, 0.02, -0.068, 0.078, 1, 0.022, 0.026)
    m.box(0.022, 0.006, 0.026, (0, -0.068, 0.134), "window")
    m.box(0.022, 0.022, 0.05, (0.03, 0.03, 0.18), "stone", bevel=0.003)


# --- era 3 · Renaissance -----------------------------------------------------------------------

def house_3_a(m: Model):
    """Italian palazzetto: ochre stucco, cornice, arched windows, balcony, TEAM shutters."""
    w, d, h = 0.15, 0.12, 0.12
    m.box(w, d, 0.04, (0, 0, 0), "stone", bevel=0.004)
    m.box(w, d, h - 0.04, (0, 0, 0.04), "plaster_ochre", bevel=0.004)
    m.box(w + 0.01, d + 0.01, 0.008, (0, 0, h), "stone", bevel=0.002)
    m.hip(w, d, 0.04, (0, 0, h + 0.006), "roof_terracotta", over=0.008)
    m.arch_panel(0.03, 0.036, (0, -0.061, 0), "timber_dark", depth=0.006)
    for x in (-0.045, 0.045):
        m.arch_panel(0.018, 0.024, (x, -0.061, 0.01), "window")
    for x in (-0.045, 0.0, 0.045):
        m.arch_panel(0.018, 0.03, (x, -0.061, 0.066), "window")
        m.box(0.007, 0.004, 0.028, (x - 0.014, -0.063, 0.066), "TEAM")
        m.box(0.007, 0.004, 0.028, (x + 0.014, -0.063, 0.066), "TEAM")
    m.box(0.05, 0.022, 0.005, (0, -0.07, 0.058), "stone", bevel=0.001)
    m.box(0.05, 0.003, 0.012, (0, -0.08, 0.063), "iron")
    m.box(0.02, 0.02, 0.028, (0.05, 0.03, 0.15), "plaster_ochre", bevel=0.003)


def house_3_b(m: Model):
    """Northern merchant house: tall brick, stepped gable, white trim, TEAM door."""
    w, d = 0.11, 0.13
    m.box(w, d, 0.14, (0, 0, 0), "brick", bevel=0.004)
    m.gable(w - 0.004, d, 0.07, (0, 0.004, 0.14), "roof_slate", over=0.004, rz=90)
    steps = [(-0.055, 0.0), (0.055, 0.0), (0.055, 0.155), (0.04, 0.155), (0.04, 0.175),
             (0.024, 0.175), (0.024, 0.196), (0.008, 0.196), (0.008, 0.216), (-0.008, 0.216),
             (-0.008, 0.196), (-0.024, 0.196), (-0.024, 0.175), (-0.04, 0.175), (-0.04, 0.155),
             (-0.055, 0.155)]
    m.prism(steps, 0.014, (0, -0.061, 0), "brick", bevel=0.002)
    m.box(0.02, 0.012, 0.004, (0, -0.061, 0.216), "white")
    m.box(0.028, 0.008, 0.046, (-0.02, -0.068, 0), "TEAM")
    m.box(0.034, 0.01, 0.004, (-0.02, -0.068, 0.046), "white")
    m.box(0.022, 0.008, 0.024, (0.026, -0.068, 0.018), "window")
    for x in (-0.026, 0.026):
        for z in (0.07, 0.108):
            m.box(0.026, 0.008, 0.028, (x, -0.068, z), "white")
            m.box(0.018, 0.01, 0.02, (x, -0.069, z + 0.004), "window")
    m.box(0.018, 0.008, 0.02, (0, -0.07, 0.16), "white")
    m.box(0.012, 0.01, 0.013, (0, -0.071, 0.163), "window")


# --- era 4 · Industrial ------------------------------------------------------------------------

def house_4_a(m: Model):
    """Brick terrace house: bay window, slate roof, twin chimney stacks."""
    w, d = 0.15, 0.11
    m.box(w, d, 0.11, (0, 0, 0), "brick", bevel=0.004)
    m.box(w + 0.006, d + 0.006, 0.008, (0, 0, 0.106), "stone", bevel=0.002)
    m.gable(w, d, 0.06, (0, 0, 0.112), "roof_slate", over=0.01)
    for x in (-0.06, 0.06):
        m.box(0.024, 0.03, 0.06, (x, 0.0, 0.132), "brick_dark", bevel=0.003)
        m.box(0.028, 0.034, 0.008, (x, 0.0, 0.19), "stone", bevel=0.002)
        m.cyl(0.006, 0.012, (x - 0.005, 0.0, 0.198), "roof_terracotta", seg=5)
    # bay window
    m.box(0.06, 0.03, 0.05, (0.03, -0.066, 0.01), "stone", bevel=0.004, top=(1.0, 1.0))
    m.box(0.05, 0.006, 0.03, (0.03, -0.082, 0.024), "window")
    m.box(0.066, 0.036, 0.008, (0.03, -0.066, 0.06), "roof_slate", bevel=0.002)
    m.box(0.026, 0.008, 0.046, (-0.035, -0.058, 0), "TEAM_DARK")
    m.box(0.034, 0.012, 0.006, (-0.035, -0.058, 0.046), "stone")
    m.box(0.036, 0.018, 0.008, (-0.035, -0.06, 0), "stone")
    for x in (-0.035, 0.03):
        m.box(0.026, 0.008, 0.028, (x, -0.058, 0.07), "white")
        m.box(0.018, 0.01, 0.02, (x, -0.059, 0.074), "window")


def house_4_b(m: Model):
    """Corner shop: brick, mansard slate roof with dormers, TEAM striped awning."""
    w, d = 0.14, 0.13
    m.box(w, d, 0.1, (0, 0, 0), "plaster", bevel=0.004)
    m.box(w + 0.004, d + 0.004, 0.045, (0, 0, 0), "brick_dark", bevel=0.004)
    m.box(w + 0.01, d + 0.01, 0.008, (0, 0, 0.1), "stone", bevel=0.002)
    m.box(w + 0.006, d + 0.006, 0.05, (0, 0, 0.108), "roof_slate", bevel=0.003, top=(0.8, 0.78))
    m.box(w * 0.8 - 0.004, d * 0.78 - 0.004, 0.008, (0, 0, 0.158), "iron", bevel=0.002)
    for x in (-0.035, 0.035):
        m.box(0.022, 0.02, 0.024, (x, -0.058, 0.112), "plaster", bevel=0.002)
        m.gable(0.022, 0.02, 0.012, (x, -0.058, 0.136), "roof_slate", over=0.003, rz=90)
        m.box(0.014, 0.006, 0.016, (x, -0.069, 0.114), "window")
    m.box(0.09, 0.006, 0.032, (-0.01, -0.068, 0.004), "window")
    m.box(0.024, 0.006, 0.038, (0.05, -0.068, 0), "timber_dark")
    m.box(0.13, 0.04, 0.005, (0, -0.084, 0.044), "TEAM", rx=-20)
    m.box(0.13, 0.004, 0.012, (0, -0.103, 0.034), "white")
    m.box(0.1, 0.006, 0.014, (-0.0, -0.068, 0.07), "TEAM_DARK")
    m.windows_row(-0.04, 0.04, -0.066, 0.058, 2, 0.02, 0.026)


# --- era 5 · Modern ----------------------------------------------------------------------------

def house_5_a(m: Model):
    """Apartment block: concrete frame, glass bands, balconies, TEAM stripe, rooftop plant."""
    w, d, h = 0.14, 0.12, 0.2
    m.box(w, d, h, (0, 0, 0), "concrete_light", bevel=0.004)
    for z in (0.02, 0.066, 0.112, 0.158):
        m.box(w + 0.004, d + 0.004, 0.028, (0, 0, z), "glass", bevel=0.001)
    m.box(0.02, d + 0.01, h + 0.004, (0.055, 0, 0), "TEAM", bevel=0.002)
    for z in (0.06, 0.106, 0.152):
        m.box(0.08, 0.018, 0.006, (-0.02, -0.068, z), "concrete", bevel=0.001)
        m.box(0.08, 0.002, 0.014, (-0.02, -0.077, z + 0.006), "glass_dark")
    m.box(0.05, 0.04, 0.02, (-0.03, 0.02, h), "concrete_dark", bevel=0.003)
    m.cyl(0.004, 0.028, (0.02, 0.03, h), "iron", seg=4)
    m.box(0.04, 0.006, 0.02, (-0.02, -0.063, 0.0), "glass_dark")


def house_5_b(m: Model):
    """Modern villa: white cubes, cantilevered upper storey, glass walls, solar roof, TEAM panel."""
    m.box(0.15, 0.1, 0.06, (0, 0.01, 0), "white", bevel=0.004)
    m.box(0.13, 0.006, 0.04, (-0.005, -0.041, 0.006), "glass")
    m.box(0.11, 0.1, 0.055, (0.03, -0.012, 0.06), "concrete_light", bevel=0.004)
    m.box(0.086, 0.006, 0.036, (0.04, -0.063, 0.068), "glass")
    m.box(0.02, 0.104, 0.055, (-0.025, -0.012, 0.06), "TEAM", bevel=0.002)
    for i in range(2):
        m.box(0.034, 0.05, 0.004, (0.018 + i * 0.04, -0.012, 0.118), "glass_dark", rx=-10)
    m.box(0.016, 0.016, 0.02, (-0.06, 0.03, 0.06), "concrete", bevel=0.002)
    m.cyl(0.004, 0.02, (-0.065, -0.07, 0), "timber", seg=4)
    m.lathe([(0.014, 0.012), (0.024, 0.03), (0.018, 0.05), (0.0, 0.06)],
            (-0.065, -0.07, 0), "foliage_light", seg=6)


HOUSES = {
    f"house_{e}_{v}": fn for e, v, fn in (
        (0, "a", house_0_a), (0, "b", house_0_b),
        (1, "a", house_1_a), (1, "b", house_1_b),
        (2, "a", house_2_a), (2, "b", house_2_b),
        (3, "a", house_3_a), (3, "b", house_3_b),
        (4, "a", house_4_a), (4, "b", house_4_b),
        (5, "a", house_5_a), (5, "b", house_5_b),
    )
}
