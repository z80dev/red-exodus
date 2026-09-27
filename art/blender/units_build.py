"""Build and preview every AEONS unit, including the era-neutral embark boat.

Usage: /Applications/Blender.app/Contents/MacOS/Blender -b --python art/blender/units_build.py
Optional arguments after --: --only warrior,knight --no-preview
Outputs: public/models/u_*.glb, manifest.units.json, art/previews/units_{azure,coral}.png.
The manifest always describes every GLB on disk; partial builds preserve other entries.
"""
import argparse
import json
import math
from pathlib import Path
import sys
import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from units_lib import (MATERIALS, banner, body, bow, box, color, finish, gem,
                       horse, materials, prism, rifle, rod, shield, spear, sword, wheel)

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/models'
PREVIEWS = ROOT / 'art/previews'
IDS = ('settler scout warrior archer spearman horseman swordsman catapult chariot '
       'man_at_arms crossbowman pikeman knight trebuchet musketman cannon lancer '
       'rifleman field_gun cavalry artillery infantry machine_gun at_gun tank '
       'rocket_artillery boat').split()


def cart():
    body(hat='straw', origin=(-6, -4, 0), scale=.94)
    box('Supply wagon bed', (7, 8, 8), (14, 17, 3), 'Timber', .6)
    for x in (0, 14):
        box('Cart side rail', (x, 8, 12), (1.3, 18, 6), 'WoodLight', .3)
        wheel(x, 9, 5, 5)
    for x in (3, 11):
        rod('Cart handle', (x, 4, 8), (x, -12, 11), .65, 'Timber', 6)
    box('Packed trunk', (7, 10, 14), (11, 9, 7), 'TEAM', 1)
    box('Trunk strap', (7, 10, 14), (2, 9.4, 7.4), 'TEAM_DARK', .2)
    gem('Linen provisions sack', (5, 3, 14), (5, 4, 5), 'Linen')
    rod('Rolled blanket', (2, 10, 19), (12, 10, 19), 2.8, 'Linen', 8)
    box('Blanket binding', (7, 10, 19), (1.3, 5.8, 5.8), 'Leather', .3)


def scout():
    body(hat='hood', origin=(-3, 0, 0))
    box('Explorer backpack', (-3, 5, 18), (8, 5, 10), 'Leather', 1)
    rod('Bedroll', (-8, 7, 24), (2, 7, 24), 2, 'Linen', 8)
    rod('Brass spyglass', (5, -3, 24), (5, -12, 28), 1.5, 'Gold', 8, 2)
    rod('Spyglass lens', (5, -12, 28), (5, -12.5, 28.2), 1.7, 'Ink', 8)
    rod('Raised forearm', (5, -2, 16), (5, -5, 25), 1.8, 'TEAM', 6)
    box('Spyglass hand', (5, -5, 25), (3, 3, 3), 'Skin', .4)
    box('Faithful dog body', (12, 0, 7), (6, 11, 5.5), 'Horse', 1)
    for x in (10, 14):
        for y in (-3.5, 3.5):
            box('Dog paw', (x, y, 3), (1.8, 2.2, 5), 'Horse', .3)
    box('Dog head', (12, -5.5, 11), (6, 6, 6), 'Horse', 1)
    box('Dog muzzle', (12, -9, 10), (4, 3, 3), 'Linen', .5)
    box('Dog nose', (12, -10.6, 10.5), (1.7, .6, 1), 'Ink', .2)
    for x in (9.8, 14.2):
        gem('Dog ear', (x, -4.5, 14.5), (1.5, 1.6, 3), 'Mane')
        box('Dog eye', (x, -8.1, 12), (.7, .4, .8), 'Ink')
    rod('Happy dog tail', (12, 5, 8), (12, 9, 13), 1, 'Linen', 5, .6)
    box('Dog team collar', (12, -3, 9), (6.3, 1.4, 5.8), 'TEAM', .4)


def mounted(kind):
    armored = kind == 'knight'
    horse(armor=armored)
    hat = {'horseman': 'hair', 'knight': 'visor', 'lancer': 'shako', 'cavalry': 'cap'}[kind]
    body('plate' if armored else 'coat' if kind in ('lancer', 'cavalry') else 'cloth',
         hat, origin=(0, 2, 15), scale=.75, seated=True)
    if kind in ('horseman', 'lancer'):
        spear(8, 0, 12, 48 if kind == 'lancer' else 42, pennant=True)
    else:
        sword(8, 27, length=14)
    if armored:
        shield(-7, 28)
    if kind == 'cavalry':
        rod('Carbine in scabbard', (-7, 4, 15), (-7, 4, 34), 1.1, 'Timber', 6)


def chariot():
    horse(origin=(0, -13, 0))
    box('Chariot floor', (0, 11, 8), (18, 14, 2.5), 'Timber', .6)
    for x in (-9, 9):
        wheel(x, 12, 6, 6)
        rod('Chariot shaft', (x * .5, 8, 8), (x * .5, -15, 13), .8, 'Timber', 6)
    box('Chariot front', (0, 4, 14), (18, 3, 11), 'TEAM', .9)
    box('Chariot gold rail', (0, 3.7, 20), (19, 3.2, 1.5), 'Gold', .4)
    body(hat='crest', origin=(0, 12, 9), scale=.66)
    spear(8, 12, 10, 39, pennant=True)


def siege(kind):
    trebuchet = kind == 'trebuchet'
    box('Siege carriage', (0, 0, 6), (19, 23, 3), 'Timber', .6)
    for x in (-10, 10):
        for y in (-8, 8):
            wheel(x, y, 4, 4)
    for x in (-6, 6):
        rod('A frame front', (x, -9, 8), (x, 0, 23 if trebuchet else 17), 1.5, 'WoodLight', 4)
        rod('A frame rear', (x, 9, 8), (x, 0, 23 if trebuchet else 17), 1.5, 'WoodLight', 4)
    pivot = 23 if trebuchet else 17
    rod('Pivot axle', (-9, 0, pivot), (9, 0, pivot), 1.4, 'Iron', 8)
    if trebuchet:
        rod('Throwing arm', (0, -8, 13), (0, 13, 38), 1.2, 'Timber', 4)
        box('Counterweight', (0, -8, 12), (8, 6, 7), 'TEAM_DARK', .7)
        rod('Sling rope', (0, 13, 38), (0, 18, 24), .35, 'Linen', 4)
        gem('Sling stone', (0, 18, 23), (3, 3, 3), 'Iron')
        banner(-10, 2, 29, True)
    else:
        rod('Catapult arm', (0, -7, 8), (0, 11, 27), 1.5, 'Timber', 4)
        box('Catapult spoon', (0, 11, 27), (8, 7, 2.5), 'WoodLight', .6)
        gem('Loaded stone', (0, 11, 30), (3.5, 3.5, 3.5), 'Iron')
        rod('Torsion bundle', (-7, -6, 9), (7, -6, 9), 2.4, 'Linen', 10)
        banner(-10, 4, 20, True)
    box('Team carriage cloth', (0, -10, 7), (13, 1, 4), 'TEAM', .3)
    box('Team carriage hem', (0, -10.6, 5.5), (13, .5, 1), 'TEAM_DARK')


def gun(kind):
    early = kind == 'cannon'
    machine = kind == 'machine_gun'
    if machine:
        body(hat='modern', origin=(-6, 5, 0), scale=.78)
        for x, y in ((-4, -8), (6, -8), (1, 5)):
            rod('Tripod', (1, -2, 12), (x, y, .8), .8, 'Iron', 6)
        rod('Machine gun jacket', (1, -1, 15), (1, -15, 15), 1.8, 'Iron', 8)
        rod('Machine gun muzzle', (1, -15, 15), (1, -18, 15), .9, 'Ink', 8)
        box('Receiver', (1, 0, 15), (5, 6, 4), 'Iron', .5)
        box('Ammunition box', (6, -1, 11), (5, 5, 7), 'TEAM_DARK', .5)
        for x in (3, 4.3, 5.6):
            rod('Feed belt cartridge', (x, -1, 15), (x, 1.5, 15), .45, 'Gold', 6)
        return
    for x in (-10, 10):
        wheel(x, 2, 6, 6, not early)
        rod('Split carriage trail', (x * .5, 0, 7), (x * .8, 15, 2), 1.3, 'Timber' if early else 'Olive', 4)
    rod('Gun axle', (-11, 2, 6), (11, 2, 6), 1.3, 'Iron', 8)
    box('Gun cradle', (0, 1, 10), (12, 10, 6), 'TEAM_DARK', .9)
    z = 14
    tip_z = 29 if kind == 'artillery' else 15
    length = 29 if kind == 'at_gun' else 20 if kind == 'artillery' else 17
    heavy = early or kind == 'artillery'
    rod('Oversized barrel', (0, 5, z), (0, -length, tip_z), 3 if heavy else 2, 'Iron', 10, 2 if heavy else 1.4)
    axis = (Vector((0, -length, tip_z)) - Vector((0, 5, z))).normalized()
    muzzle = Vector((0, -length, tip_z))
    rod('Muzzle rim', muzzle - axis, muzzle + axis, 2.5 if heavy else 1.9, 'Gold' if early else 'Iron', 10)
    rod('Dark muzzle bore', muzzle + axis * 1.03, muzzle + axis * 1.13, 1.7 if heavy else 1.2, 'Ink', 10)
    if early:
        banner(-8, 8, 21, True)
        for x in (7, 10):
            gem('Cannonball', (x, 10, 3), (2, 2, 2), 'Iron')
    else:
        if kind == 'at_gun':
            prism('Angular antitank shield', [(-11, 5), (11, 5), (11, 16), (7, 22),
                  (-7, 22), (-11, 16)], 1.8, 'TEAM', -3)
            box('Gunner vision slit', (-5, -4, 19), (4, .4, 1.2), 'Ink')
        else:
            box('Team gun shield', (0, -3, 12), (18, 1.8, 7 if kind == 'artillery' else 9), 'TEAM', .9)
        box('Shield central stripe', (0, -4, 16), (2.3, .4, 4), 'TEAM_DARK')
        if kind == 'artillery':
            box('Breech block', (0, 6, 15), (7, 5, 6), 'Iron', .7)
            rod('Hydraulic recoil cylinder', (4, 4, 12), (4, -15, 23), 1.2, 'Steel', 8)
        rod('Elevation handwheel', (5, 4, 12), (7, 4, 12), 2, 'Gold', 8)


def vehicle(kind):
    rocket = kind == 'rocket_artillery'
    box('Armored lower hull', (0, 0, 8), (21, 28, 8), 'TEAM_DARK', 2)
    if rocket:
        for x in (-11, 11):
            for y in (-9, 0, 9):
                wheel(x, y, 5, 4.3, True)
        box('Truck cab', (0, -8, 15), (20, 11, 12), 'TEAM', 1.4)
        box('Split windshield', (0, -13.8, 17), (15, .5, 4.5), 'Ink', .4)
        box('Windshield mullion', (0, -14.1, 17), (1, .4, 5), 'TEAM_DARK')
        box('Truck grille', (0, -14, 10.5), (9, .8, 3), 'Iron', .3)
        box('Launcher rack', (0, 4, 19), (21, 16, 3), 'TEAM_DARK', .7)
        for x in (-7, 0, 7):
            for z in (22, 27):
                rod('Rocket tube', (x, 11, z - 3), (x, -5, z + 3), 2.5, 'Olive', 8)
                rod('Rocket nose', (x, -5, z + 3), (x, -9, z + 4.5), 1.8, 'Linen', 8, 0)
    else:
        for x in (-11, 11):
            box('Continuous track', (x, 0, 5.5), (5, 31, 10), 'Ink', 2)
            for y in (-10, -3.3, 3.3, 10):
                rod('Track road wheel', (x - 2.6, y, 5.5), (x + 2.6, y, 5.5), 3.4, 'Iron', 8)
            for y in (-12, -6, 0, 6, 12):
                box('Track tread', (x, y, 10.5), (5.2, 1, .6), 'Iron')
        box('Sloped upper hull', (0, -1, 12), (22, 27, 8), 'TEAM', 2)
        rod('Turret ring', (0, 1, 15), (0, 1, 17), 8, 'TEAM_DARK', 10)
        box('Tank turret', (0, 0, 20), (15, 15, 8), 'TEAM', 2)
        rod('Long main gun', (0, -6, 20), (0, -29, 21), 1.6, 'Iron', 8)
        box('Muzzle brake', (0, -28.5, 21), (4, 4, 3), 'TEAM_DARK', .6)
        box('Commander hatch', (0, 2, 24), (7, 7, 1.5), 'TEAM_DARK', .5)
        rod('Radio aerial', (6, 5, 23), (6, 5, 36), .2, 'Ink', 4)
    for x in (-7, 7):
        box('Headlamp', (x, -14.5, 11), (2.5, 1.2, 2.5), 'Linen', .5)


def boat():
    # Pointed bow faces -Y; custom keel keeps the ground/water origin at zero.
    verts = [(-8, 13, 7), (8, 13, 7), (11, -5, 7), (0, -21, 8), (-11, -5, 7),
             (-5, 11, 1), (5, 11, 1), (6, -4, 0), (0, -17, 1), (-6, -4, 0)]
    faces = [(0, 1, 2, 3, 4), (9, 8, 7, 6, 5)]
    faces += [(i, (i + 1) % 5, (i + 1) % 5 + 5, i + 5) for i in range(5)]
    mesh = bpy.data.meshes.new('Boat carved hull')
    mesh.from_pydata(verts, [], faces)
    obj = bpy.data.objects.new('Boat carved hull', mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(MATERIALS['Timber'])
    for x in (-7, 7):
        rod('Gunwale', (x, 12, 8), (x * 1.4, -5, 8), .7, 'WoodLight', 6)
        rod('Bow rail', (x * 1.4, -5, 8), (0, -21, 8), .7, 'WoodLight', 6)
    for y in (-5, 4, 10):
        box('Deck bench', (0, y, 8), (16, 2.2, 1.3), 'WoodLight', .3)
    rod('Mast', (0, 1, 7), (0, 1, 39), .85, 'Timber', 8)
    rod('Sail spar', (-12, 1, 33), (12, 1, 33), .65, 'WoodLight', 6)
    # Faceted billow: visible from either side without runtime doubleSide.
    prism('Team sail', [(-11, 33), (11, 33), (9, 15), (-9, 15), (-12, 24)], .65, 'TEAM', -1)
    prism('Sail heraldic stripe', [(-1.4, 32), (1.4, 32), (1.4, 16), (-1.4, 16)], .2, 'TEAM_DARK', -1.5)
    prism('Mast pennant', [(1, 39), (8, 38), (1, 35)], .4, 'TEAM', 1)
    rod('Rigging port', (-9, 5, 8), (0, 1, 37), .22, 'Linen', 4)
    rod('Rigging starboard', (9, 5, 8), (0, 1, 37), .22, 'Linen', 4)
    box('Travel trunk', (0, 10, 11), (8, 5, 4), 'TEAM_DARK', .5)


def build(kind):
    if kind == 'settler': cart()
    elif kind == 'scout': scout()
    elif kind in ('horseman', 'knight', 'lancer', 'cavalry'): mounted(kind)
    elif kind == 'chariot': chariot()
    elif kind in ('catapult', 'trebuchet'): siege(kind)
    elif kind in ('cannon', 'field_gun', 'artillery', 'machine_gun', 'at_gun'): gun(kind)
    elif kind in ('tank', 'rocket_artillery'): vehicle(kind)
    elif kind == 'boat': boat()
    else:
        settings = {
            'warrior': ('cloth', 'hair'), 'archer': ('cloth', 'hood'),
            'spearman': ('cloth', 'helmet'), 'swordsman': ('mail', 'crest'),
            'man_at_arms': ('plate', 'visor'), 'crossbowman': ('mail', 'helmet'),
            'pikeman': ('mail', 'helmet'), 'musketman': ('coat', 'tricorne'),
            'rifleman': ('coat', 'shako'), 'infantry': ('cloth', 'modern'),
        }
        style, hat = settings[kind]
        body(style, hat)
        if kind == 'warrior':
            rod('Club handle', (8, -2, 12), (8, -2, 30), 1.1, 'Timber', 6)
            gem('Oversized stone axe head', (8, -2, 28), (5, 2.5, 4), 'Iron')
            box('Axe binding', (8, -2, 27), (2, 5.4, 3), 'Linen', .3)
            shield(round_shield=True)
        elif kind in ('archer', 'crossbowman'): bow(crossbow=kind == 'crossbowman')
        elif kind in ('spearman', 'pikeman'):
            spear(top=48 if kind == 'pikeman' else 40)
            shield(round_shield=kind == 'spearman')
        elif kind in ('swordsman', 'man_at_arms'):
            sword(length=19 if kind == 'man_at_arms' else 15)
            shield(round_shield=kind == 'swordsman')
        elif kind in ('musketman', 'rifleman', 'infantry'):
            rifle(modern=kind == 'infantry', long=kind != 'infantry')
            box('Cross body strap', (-2, -4.5, 18), (1.7, .8, 10), 'Linen', .2, (0, -.4, 0))
            box('Ammo pouch', (-6, -3, 12), (4.5, 3.2, 4), 'Leather', .5)
            if kind == 'infantry':
                box('Field pack', (0, 5, 17), (8, 4, 9), 'Olive', .8)
                rod('Bedroll', (-5, 5, 23), (5, 5, 23), 1.7, 'Linen', 8)


def export(kind):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    build(kind)
    key = 'u_' + kind
    obj = finish(key)
    tris = len(obj.data.polygons)
    assert tris <= 1500, f'{key}: {tris} triangles exceeds 1500'
    names = {mat.name for mat in obj.data.materials}
    assert {'TEAM', 'TEAM_DARK'} <= names, f'{key}: missing team materials'
    coords = [v.co for v in obj.data.vertices]
    # Exporter maps Blender (x,y,z) to glTF (x,z,-y).
    points = [(v.x, v.z, -v.y) for v in coords]
    minimum = [round(min(p[i] for p in points), 6) for i in range(3)]
    maximum = [round(max(p[i] for p in points), 6) for i in range(3)]
    assert minimum[1] >= -.00001, f'{key}: below ground: {minimum}'
    assert maximum[1] <= .55, f'{key}: unexpectedly tall: {maximum}'
    bpy.ops.export_scene.gltf(filepath=str(OUT / (key + '.glb')), export_format='GLB',
        use_selection=True, export_yup=True, export_apply=True, export_cameras=False,
        export_lights=False, export_animations=False, export_materials='EXPORT',
        export_texcoords=False, export_normals=True)
    print(f'UNIT_OK {key}: {tris} tris; glTF bounds {minimum} → {maximum}', flush=True)
    return {'key': key, 'file': f'/models/{key}.glb', 'tris': tris,
            'bbox': {'min': minimum, 'max': maximum}}


def contact_sheet(team, dark, suffix):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    # A camera-facing grid of individually rotated miniatures, at consistent scale.
    for i, kind in enumerate(IDS):
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=str(OUT / f'u_{kind}.glb'))
        meshes = [obj for obj in set(bpy.data.objects) - before if obj.type == 'MESH']
        col, row = i % 6, i // 6
        center = Vector(((col - 2.5) * .64, 0, (4 - row) * .70))
        for obj in meshes:
            obj.rotation_mode = 'XYZ'
            obj.rotation_euler = (math.radians(25), 0, math.radians(-24))
            obj.location = center + Vector((0, 0, .10))
            for mat in obj.data.materials:
                if mat.name.split('.')[0] in ('TEAM', 'TEAM_DARK'):
                    value = team if mat.name.split('.')[0] == 'TEAM' else dark
                    mat.diffuse_color = color(value)
                    mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value = color(value)
        # Label lettering sits in the same camera-facing plane as the grid.
        curve = bpy.data.curves.new(kind + ' label', 'FONT')
        curve.body = kind.replace('_', ' ').upper()
        curve.align_x = 'CENTER'
        curve.size = .035
        curve.extrude = 0
        obj = bpy.data.objects.new('Label ' + kind, curve)
        bpy.context.collection.objects.link(obj)
        obj.rotation_euler = (math.pi / 2, 0, 0)
        obj.location = center + Vector((0, -.5, -.09))
        curve.materials.append(MATERIALS['Linen'])
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1800
    scene.render.resolution_y = 1700
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.world.color = (.15, .15, .15)
    scene.view_settings.view_transform = 'AgX'
    bpy.ops.object.camera_add(location=(0, -8, 1.65))
    camera = bpy.context.object
    camera.rotation_euler = (math.pi / 2, 0, 0)
    camera.data.type = 'ORTHO'
    camera.data.ortho_scale = 4.0
    scene.camera = camera
    for location, energy, size in (((-3, -4, 6), 450, 5), ((4, -2, 3), 180, 4)):
        bpy.ops.object.light_add(type='AREA', location=location)
        light = bpy.context.object
        light.data.energy = energy
        light.data.shape = 'DISK'
        light.data.size = size
        light.rotation_euler = (Vector((0, 0, 1.5)) - light.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.film_transparent = False
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value = color('182633')
    scene.world.node_tree.nodes['Background'].inputs[1].default_value = .5
    scene.render.filepath = str(PREVIEWS / f'units_{suffix}.png')
    bpy.ops.render.render(write_still=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--only', help='Comma-separated ids for an incremental build')
    parser.add_argument('--no-preview', action='store_true')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    selected = args.only.split(',') if args.only else IDS
    assert set(selected) <= set(IDS), 'Unknown unit id'
    OUT.mkdir(parents=True, exist_ok=True)
    PREVIEWS.mkdir(parents=True, exist_ok=True)
    materials()
    manifest_path = OUT / 'manifest.units.json'
    previous = json.loads(manifest_path.read_text()) if manifest_path.exists() else []
    entries = {entry['key']: entry for entry in previous}
    for kind in selected:
        entry = export(kind)
        entries[entry['key']] = entry
    manifest_path.write_text(json.dumps([entries['u_' + kind] for kind in IDS if 'u_' + kind in entries], indent=2) + '\n')
    if not args.no_preview:
        assert all((OUT / f'u_{kind}.glb').exists() for kind in IDS), 'Build all units before previewing'
        contact_sheet('438ed0', '254665', 'azure')
        contact_sheet('d86656', '713d54', 'coral')
    print(f'UNITS_COMPLETE {len(entries)} manifest entries', flush=True)


if __name__ == '__main__':
    main()
