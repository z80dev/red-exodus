"""Render review previews of the exported city kit (imports the shipped GLBs).

  Blender -b --python art/blender/city_preview.py -- [sheets] [eras] [--keys k1,k2 --out name]

  sheets → art/previews/city_sheet_{centers,houses,walls,landmarks}.png (labelled contact sheets)
  eras   → art/previews/city_era_<0..5>.png + city_eras.png (composed hex: centre + houses + walls)
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

import city_lib as L  # noqa: E402

LANDMARK_IDS = ["temple", "library", "market", "barracks", "harbor", "granary", "workshop",
                "university", "amphitheater", "bank", "factory", "observatory", "castle",
                "aqueduct", "cathedral", "powerplant", "stadium", "lighthouse"]

# preview team colours (the renderer swaps TEAM / TEAM_DARK per owner)
TEAMS = [("#3d7be0", "#244a94"), ("#d8433b", "#8e2621"), ("#e3b53a", "#9a6f16"), ("#8a52c9", "#4f2a80")]


def lin(hexcol):
    return tuple(L.srgb_to_linear(c) for c in L.hex_rgb(hexcol)) + (1.0,)


def flat_mat(name, hexcol, rough=0.9):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = lin(hexcol)
    b.inputs["Roughness"].default_value = rough
    return m


_team_cache = {}


def setup(res_x, res_y):
    L.reset_scene()
    _team_cache.clear()
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_EEVEE"
    sc.render.resolution_x = res_x
    sc.render.resolution_y = res_y
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = False
    sc.eevee.taa_render_samples = 48
    for attr, val in (("use_raytracing", True), ("use_shadows", True), ("use_fast_gi", True)):
        if hasattr(sc.eevee, attr):
            setattr(sc.eevee, attr, val)
    sc.view_settings.view_transform = "AgX"
    for look in ("AgX - Medium High Contrast", "Medium High Contrast"):
        try:
            sc.view_settings.look = look
            break
        except TypeError:
            continue
    world = bpy.data.worlds.new("W")
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = lin("#b9cfe0")
    bg.inputs["Strength"].default_value = 0.9
    sc.world = world
    sun_d = bpy.data.lights.new("Sun", "SUN")
    sun_d.energy = 4.2
    sun_d.angle = math.radians(4)
    sun_d.color = (1.0, 0.95, 0.86)
    sun = bpy.data.objects.new("Sun", sun_d)
    sun.rotation_euler = (math.radians(48), 0, math.radians(-38))
    sc.collection.objects.link(sun)
    fill_d = bpy.data.lights.new("Fill", "SUN")
    fill_d.energy = 0.8
    fill_d.color = (0.75, 0.85, 1.0)
    fill = bpy.data.objects.new("Fill", fill_d)
    fill.rotation_euler = (math.radians(60), 0, math.radians(150))
    sc.collection.objects.link(fill)
    return sc


def set_team(idx):
    p, d = TEAMS[idx % len(TEAMS)]
    for name, col in (("TEAM", p), ("TEAM_DARK", d)):
        m = bpy.data.materials.get(name)
        if m and m.use_nodes:
            m.node_tree.nodes.get("Principled BSDF").inputs["Base Color"].default_value = lin(col)


def import_model(key, loc=(0, 0, 0), rz=0.0, team=None):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(L.MODELS_DIR, key + ".glb"))
    new = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in new if o.type == "MESH"]
    for o in new:
        if o.type != "MESH":
            bpy.data.objects.remove(o)
    obj = meshes[0]
    obj.parent = None
    obj.matrix_world = Matrix.Translation(Vector(loc)) @ Matrix.Rotation(math.radians(rz), 4, "Z")
    if team is not None:
        remap_team(obj, team)
    return obj


def remap_team(obj, team):
    p, d = TEAMS[team % len(TEAMS)]
    for i, slot in enumerate(obj.material_slots):
        if slot.material and slot.material.name.split(".")[0] in ("TEAM", "TEAM_DARK"):
            base = slot.material.name.split(".")[0]
            key = (base, team)
            if key not in _team_cache:
                _team_cache[key] = flat_mat(f"{base}_{team}", p if base == "TEAM" else d, 0.75)
            obj.material_slots[i].link = "OBJECT"
            obj.material_slots[i].material = _team_cache[key]


def ground(size, hexcol="#cfc7b2", z=0.0, at=(0, 0)):
    me = bpy.data.meshes.new("ground")
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=size / 2)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new("ground", me)
    o.location = (at[0], at[1], z)
    me.materials.append(flat_mat("ground_" + hexcol, hexcol))
    bpy.context.scene.collection.objects.link(o)
    return o


def label(text, loc, size=0.07, hexcol="#3a3530"):
    cu = bpy.data.curves.new("lbl", "FONT")
    cu.body = text
    cu.size = size
    cu.align_x = "CENTER"
    cu.align_y = "CENTER"
    o = bpy.data.objects.new("lbl_" + text, cu)
    o.location = loc
    cu.materials.append(flat_mat("label", hexcol, 1.0))
    bpy.context.scene.collection.objects.link(o)
    return o


def camera(target, ortho, el=40.0, az=-18.0, persp=None):
    cd = bpy.data.cameras.new("Cam")
    if persp:
        cd.type = "PERSP"
        cd.lens = persp
    else:
        cd.type = "ORTHO"
        cd.ortho_scale = ortho
    cam = bpy.data.objects.new("Cam", cd)
    rot = Matrix.Rotation(math.radians(az), 4, "Z") @ Matrix.Rotation(math.radians(90 - el), 4, "X")
    fwd = (rot.to_3x3() @ Vector((0, 0, -1))).normalized()
    dist = 20.0 if not persp else ortho
    cam.matrix_world = Matrix.Translation(Vector(target) - fwd * dist) @ rot
    cd.clip_end = 200
    bpy.context.scene.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    return cam


def render(path):
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print("[preview] wrote", path)


# ---------------------------------------------------------------------------------------------

def hex_tile(radius=1.0, h=0.06, at=(0, 0, 0), top="#86b04a", side="#8c6b48", name="hex"):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    angs = [math.radians(30 + 60 * k) for k in range(6)]
    bot = [bm.verts.new((radius * math.cos(a), radius * math.sin(a), -h)) for a in angs]
    tp = [bm.verts.new((radius * 0.985 * math.cos(a), radius * 0.985 * math.sin(a), 0)) for a in angs]
    bm.faces.new(tp)
    bm.faces.new(list(reversed(bot)))
    for i in range(6):
        j = (i + 1) % 6
        f = bm.faces.new((bot[i], bot[j], tp[j], tp[i]))
        f.material_index = 1
    bm.to_mesh(me)
    bm.free()
    me.materials.append(flat_mat("hex_top_" + top, top))
    me.materials.append(flat_mat("hex_side_" + side, side))
    o = bpy.data.objects.new(name, me)
    o.location = at
    bpy.context.scene.collection.objects.link(o)
    return o


SHEET_AZ = -20.0
SHEET_EL = 42.0


def sheet(name, keys, cols, cell, width=2000, team_cycle=False):
    """Labelled grid; the grid is rotated with the camera azimuth so rows stay horizontal
    while every model is still seen from its 3/4 front. Image height is derived from content."""
    rows = math.ceil(len(keys) / cols)
    row = cell * 1.25
    W, H = cols * cell, rows * row
    view_w = W * 1.02
    view_h = (H - row) * math.sin(math.radians(SHEET_EL)) + cell * 1.05
    setup(width, int(width * view_h / view_w))
    ground(max(W, H) * 3, "#d9a066")
    ca, sa = math.cos(math.radians(SHEET_AZ)), math.sin(math.radians(SHEET_AZ))

    def rot(x, y):
        return (x * ca - y * sa, x * sa + y * ca)

    for i, key in enumerate(keys):
        c, r = i % cols, i // cols
        x = (c - (cols - 1) / 2) * cell
        y = ((rows - 1) / 2 - r) * row
        px, py = rot(x, y)
        import_model(key, (px, py, 0), team=(i % len(TEAMS)) if team_cycle else 0)
        lx, ly = rot(x, y - cell * 0.45)
        lb = label(key, (lx, ly, 0.002), size=cell * 0.07)
        lb.rotation_euler = (0, 0, math.radians(SHEET_AZ))
    camera(rot(0, -cell * 0.1) + (cell * 0.26,), view_w, el=SHEET_EL, az=SHEET_AZ)
    render(os.path.join(L.PREVIEW_DIR, f"city_sheet_{name}.png"))


# era → wall style used in the composed scenes (renderer may choose differently)
ERA_WALL = [0, 1, 1, 2, 2, 2]
HOUSE_RING = [  # (angle deg, radius, variant, rot)
    (-100, 0.6, "a", 10), (-60, 0.64, "b", -20), (-140, 0.62, "b", 25), (-20, 0.6, "a", -40),
    (180, 0.6, "a", 80), (20, 0.62, "b", 60), (140, 0.62, "a", 110), (60, 0.6, "b", 150),
    (100, 0.64, "a", 190),
]


def compose_city(era, at=(0, 0, 0), team=0):
    ox, oy, oz = at
    hex_tile(1.0, 0.08, (ox, oy, oz), top="#b5552b", side="#3b2f2a", name=f"hex{era}")
    import_model(f"city_center_{era}", (ox, oy, oz), team=team)
    for a, r, v, rot in HOUSE_RING:
        x, y = ox + r * math.cos(math.radians(a)), oy + r * math.sin(math.radians(a))
        import_model(f"house_{era}_{v}", (x, y, oz), rz=rot, team=team)
    ws = ERA_WALL[era]
    for k in range(6):
        th = math.radians(60 * k)  # edge midpoint angle (pointy-top hex)
        mx, my = ox + 0.866 * math.cos(th) * 0.97, oy + 0.866 * math.sin(th) * 0.97
        import_model(f"wall_seg_{ws}", (mx, my, oz), rz=math.degrees(th) + 90, team=team)
        va = math.radians(30 + 60 * k)
        tx, ty = ox + math.cos(va) * 0.97, oy + math.sin(va) * 0.97
        import_model(f"wall_tower_{ws}", (tx, ty, oz), rz=math.degrees(va) + 90, team=team)


def neighbours(at, era):
    """Surrounding plain tiles so the diorama reads like the map."""
    ox, oy, oz = at
    for k in range(6):
        a = math.radians(60 * k)
        d = 1.732
        hex_tile(1.0, 0.08, (ox + d * math.cos(a), oy + d * math.sin(a), oz - 0.01),
                 top="#c8693a" if k % 2 else "#9b4424", side="#3b2f2a", name=f"n{era}{k}")


def era_scenes():
    for era in range(6):
        setup(1400, 1100)
        ground(40, "#d9a066", z=-0.12)
        compose_city(era, (0, 0, 0))
        neighbours((0, 0, 0), era)
        camera((0, 0.05, 0.12), 2.9, el=42, az=-22)
        render(os.path.join(L.PREVIEW_DIR, f"city_era_{era}.png"))
    setup(2400, 1450)
    ground(60, "#d9a066", z=-0.12)
    names = ["Landfall", "Foothold", "Frontier", "Industry", "Terraform", "New Earth"]
    for era in range(6):
        c, r = era % 3, era // 3
        at = (c * 2.4 - 2.4, (0.5 - r) * 2.95, 0)
        compose_city(era, at, team=era % len(TEAMS))
        label(names[era], (at[0], at[1] - 1.22, 0.002), size=0.2, hexcol="#f4ecd8")
    camera((0, -0.25, 0.1), 8.1, el=48, az=-12)
    render(os.path.join(L.PREVIEW_DIR, "city_eras.png"))


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else ["sheets", "eras"]
    os.makedirs(L.PREVIEW_DIR, exist_ok=True)
    global SHEET_AZ, SHEET_EL
    if "--az" in argv:
        SHEET_AZ = float(argv[argv.index("--az") + 1])
    if "--el" in argv:
        SHEET_EL = float(argv[argv.index("--el") + 1])
    if "--keys" in argv:
        keys = argv[argv.index("--keys") + 1].split(",")
        out = argv[argv.index("--out") + 1] if "--out" in argv else "custom"
        cols = int(argv[argv.index("--cols") + 1]) if "--cols" in argv else min(len(keys), 4)
        cell = 0.75 if any(not k.startswith("house_") for k in keys) else 0.3
        sheet(out, keys, cols, cell, team_cycle=True)
        return
    if "sheets" in argv:
        sheet("centers", [f"city_center_{e}" for e in range(6)], 3, 1.0, 1800)
        sheet("houses", [f"house_{e}_{v}" for e in range(6) for v in "ab"], 6, 0.36, 2200)
        sheet("walls", [f"wall_seg_{i}" for i in range(3)] + [f"wall_tower_{i}" for i in range(3)], 3, 1.2,
              1800, team_cycle=True)
        sheet("landmarks", ["bld_" + i for i in LANDMARK_IDS], 6, 0.8, 2400)
    if "eras" in argv:
        era_scenes()


main()
