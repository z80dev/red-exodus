"""Mars unit geometry kit. Blender 5.2; coordinates are centimeters until finish().

Flat-shaded, texture-free meshes face Blender -Y (glTF +Z); team material names are runtime contracts.
"""
import bmesh
import bpy
from mathutils import Vector

PALETTE = {
    'TEAM': 'c65c3c', 'TEAM_DARK': '713625', 'Suit': 'e7e3dc',
    'Hull': '8d9097', 'Basalt': '3b2f2a', 'Hazard': 'f28c28',
    'Cryo': '5fd4e8', 'Solar': '1d2a44',
}
MATERIALS = {}


def linear(v):
    return v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4


def color(hex_value):
    return tuple(linear(int(hex_value[i:i + 2], 16) / 255) for i in (0, 2, 4)) + (1,)


def materials():
    for name, value in PALETTE.items():
        mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
        mat.diffuse_color = color(value)
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get('Principled BSDF')
        bsdf.inputs['Base Color'].default_value = color(value)
        bsdf.inputs['Roughness'].default_value = .8
        MATERIALS[name] = mat


def paint(obj, name):
    obj.data.materials.append(MATERIALS[name])
    return obj


def box(name, loc, size, mat, bevel=0, rotation=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if rotation:
        obj.rotation_euler = rotation
    # Reserve bevels for silhouette-bearing forms, not subpixel details.
    if bevel >= .6:
        mod = obj.modifiers.new('Hand carved corners', 'BEVEL')
        mod.width = bevel
        mod.segments = 1
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return paint(obj, mat)


def rod(name, a, b, radius, mat, vertices=8, end_radius=None):
    delta = Vector(b) - Vector(a)
    midpoint = (Vector(a) + Vector(b)) / 2
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius,
        radius2=radius if end_radius is None else end_radius,
        depth=delta.length, location=midpoint)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = delta.to_track_quat('Z', 'Y').to_euler()
    return paint(obj, mat)


def gem(name, loc, scale, mat):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    return paint(obj, mat)


def prism(name, polygon, depth, mat, y=0):
    """Extrude a silhouette in X/Z, with front face at negative Y."""
    n = len(polygon)
    vertices = [(x, y - depth / 2, z) for x, z in polygon]
    vertices += [(x, y + depth / 2, z) for x, z in polygon]
    faces = [tuple(range(n - 1, -1, -1)), tuple(range(n, n * 2))]
    faces += [(i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return paint(obj, mat)


def wheel(x, y, z, radius=4, modern=False):
    rod('Wheel rim', (x - 1, y, z), (x + 1, y, z), radius,
        'Ink' if modern else 'Leather', 10)
    rod('Wheel face', (x - 1.06, y, z), (x + 1.06, y, z), radius * .70,
        'Iron' if modern else 'WoodLight', 8)
    rod('Axle cap', (x - 1.25, y, z), (x + 1.25, y, z), radius * .20, 'Gold', 6)
    if not modern:
        box('Wheel cross brace', (x, y, z), (2.2, radius * 1.5, .7), 'Timber')


def banner(x=0, y=4, z=24, small=False):
    rod('Standard pole', (x, y, z - 15), (x, y, z + 11), .55, 'Timber', 6)
    w = 5 if small else 8
    prism('Team pennant', [(x, z + 10), (x + w, z + 9),
          (x + w - 2, z + 6), (x + w, z + 3), (x, z + 4)], .5, 'TEAM', y)
    rod('Gold finial', (x, y, z + 10.5), (x, y, z + 12), .8, 'Gold', 6, 0)


def body(style='cloth', hat='hair', origin=(0, 0, 0), scale=1, seated=False):
    """Reusable large-headed traveler/soldier with tunic, boots, hands and face."""
    before = set(bpy.data.objects)
    boot_z = 3.2 if not seated else 5
    for x in (-3, 3):
        box('Square boot', (x, -.8, boot_z), (4.7, 6.2, 5.5), 'Leather', .6)
        box('Trouser leg', (x, 0, 8), (3.8, 4, 7), 'TEAM_DARK', .4)
    box('Tunic skirt', (0, 0, 12), (11, 7.5, 5), 'TEAM', .9)
    box('Belt', (0, -.1, 14), (11, 7.8, 1.6), 'Leather', .3)
    box('Buckle', (0, -4.1, 14), (2.1, .7, 1.7), 'Gold', .2)
    box('Tunic shoulders', (0, 0, 18), (11, 7.7, 8), 'TEAM', 1.3)
    if style in ('mail', 'plate'):
        box('Breastplate', (0, -4, 18.3), (8.3, 1.7, 6), 'Iron' if style == 'mail' else 'Steel', .7)
        for x in (-6.5, 6.5):
            box('Shoulder armor', (x, 0, 20), (4, 7, 3.8), 'Steel', .7)
    elif style == 'coat':
        box('Coat front', (0, -4, 18), (1.3, .7, 7), 'Linen')
        for z in (16, 18, 20):
            box('Brass button', (2.2, -4.2, z), (.8, .6, .8), 'Gold')
    for x in (-6.8, 6.8):
        rod('Sleeve', (x, 0, 20), (x * 1.14, -1.5, 15), 2.2, 'TEAM', 6)
        box('Mitten hand', (x * 1.14, -2, 14), (3.8, 3.8, 4), 'Skin', .6)
    box('Neck', (0, 0, 22), (4.5, 4.5, 3), 'Skin', .4)
    box('Oversized face', (0, -.3, 26.8), (10.8, 9.3, 9), 'Skin', 1.8)
    box('Button nose', (0, -5.2, 26.3), (2.1, 1.8, 2.1), 'Skin', .4)
    for x in (-2.8, 2.8):
        box('Bright eye', (x, -5, 27.5), (1.0, .5, 1.4), 'Ink', .15)
    if hat == 'hair':
        box('Swept hair', (0, .2, 30.5), (11, 9.2, 3.5), 'Hair', 1)
        box('Hair sweep', (-3, -4.6, 29.8), (5.2, 1, 2.2), 'Hair', .3)
    elif hat == 'hood':
        box('Hood back', (0, 2.5, 28), (12, 6, 10), 'TEAM_DARK', 1.6)
        box('Hood brow', (0, -.3, 31.5), (12, 10, 3), 'TEAM', .8)
    elif hat == 'straw':
        rod('Travel hat brim', (0, 0, 30.3), (0, 0, 31.3), 8, 'Linen', 10)
        rod('Travel hat crown', (0, 0, 31), (0, 0, 34), 5.2, 'WoodLight', 8, 3.4)
    elif hat in ('helmet', 'crest', 'visor', 'modern'):
        box('Helmet dome', (0, 0, 30), (12.1, 10.3, 6.5), 'Olive' if hat == 'modern' else 'Steel', 2)
        box('Helmet brim', (0, -.3, 28.6), (12.7, 11.3, 1.4), 'TEAM_DARK' if hat == 'modern' else 'Iron', .3)
        if hat in ('crest', 'visor'):
            box('Crest ridge', (0, 0, 34), (2.2, 9, 4), 'TEAM', .5)
        if hat == 'visor':
            box('Face guard', (0, -5.5, 26.5), (9.7, 1.5, 4.8), 'Steel', .4)
            box('Visor slit', (0, -6.4, 27.4), (7.4, .3, .9), 'Ink')
    elif hat == 'tricorne':
        rod('Tricorne brim', (0, 0, 30.6), (0, 0, 32), 8.6, 'TEAM_DARK', 3)
        box('Tricorne crown', (0, .2, 32), (8, 7, 4), 'TEAM_DARK', .8)
        box('Hat cockade', (-4.1, -2.8, 32), (1.3, 1.3, 3), 'Gold', .3)
    elif hat == 'shako':
        rod('Shako', (0, 0, 29.5), (0, 0, 36), 5.5, 'TEAM_DARK', 8, 5)
        box('Cap peak', (0, -4, 30), (10, 4, 1.4), 'Ink', .4)
        box('Regimental badge', (0, -5.5, 33), (2, .6, 2.3), 'Gold', .3)
    elif hat == 'cap':
        box('Field cap', (0, 0, 30.7), (11.4, 9.6, 4), 'TEAM_DARK', 1)
        box('Cap peak', (0, -4.5, 29.8), (10, 4, 1.3), 'TEAM_DARK', .4)
    for obj in set(bpy.data.objects) - before:
        obj.location = Vector(origin) + obj.location * scale
        obj.scale *= scale
    return set(bpy.data.objects) - before


def shield(x=-8, z=18, round_shield=False, y=-5):
    if round_shield:
        rod('Round shield rim', (x, y + 1, z), (x, y - 1, z), 6.3, 'Gold', 10)
        rod('Team shield face', (x, y - 1, z), (x, y - 1.5, z), 5.2, 'TEAM', 10)
    else:
        prism('Kite shield rim', [(x - 5, z + 6), (x + 5, z + 6),
            (x + 4, z - 2), (x, z - 7), (x - 4, z - 2)], 1.6, 'Gold', y)
        prism('Kite shield face', [(x - 4, z + 5), (x + 4, z + 5),
            (x + 3, z - 2), (x, z - 5.5), (x - 3, z - 2)], .5, 'TEAM', y - 1)
    box('Shield heraldry', (x, y - 1.8, z + 1), (1.7, .4, 6), 'Linen', .15)


def sword(x=8, z=14, y=-3, length=16):
    rod('Sword grip', (x, y, z - 2), (x, y, z + 3), 1, 'Leather', 6)
    box('Sword guard', (x, y, z + 3), (6, 2, 1.5), 'Gold', .3)
    prism('Broad blade', [(x - 1.7, z + 4), (x + 1.7, z + 4),
        (x + 1.5, z + length - 2), (x, z + length + 1),
        (x - 1.5, z + length - 2)], 1.1, 'Steel', y)
    box('Blade fuller', (x, y - .6, z + length * .60), (.6, .2, length * .6), 'Iron')


def spear(x=8, y=-2, bottom=2, top=42, pennant=False):
    rod('Long shaft', (x, y, bottom), (x, y, top - 6), .75, 'Timber', 6)
    prism('Spear point', [(x - 1.9, top - 6), (x, top + 1), (x + 1.9, top - 6), (x, top - 8)], 1, 'Steel', y)
    if pennant:
        prism('Lance pennant', [(x + 1, top - 8), (x + 8, top - 9), (x + 1, top - 13)], .4, 'TEAM', y)


def bow(x=8, y=-3, z=20, crossbow=False):
    if crossbow:
        box('Crossbow stock', (0, -6, 17), (2.3, 13, 2), 'Timber', .3)
        for side in (-1, 1):
            rod('Crossbow bow', (0, -10, 17), (side * 9, -7.5, 17), .9, 'Iron', 6)
            rod('Crossbow string', (side * 9, -7.5, 17), (0, -4.5, 17), .18, 'Linen', 4)
        rod('Loaded bolt', (0, -14, 18.2), (0, -3, 18.2), .35, 'WoodLight', 5)
    else:
        points = [(x, y, z - 10), (x + 3, y, z - 5), (x + 4, y, z),
                  (x + 3, y, z + 5), (x, y, z + 10)]
        for a, b in zip(points, points[1:]):
            rod('Longbow limb', a, b, .85, 'Timber', 6)
        rod('Bowstring', points[0], points[-1], .18, 'Linen', 4)
        box('Quiver', (0, 5, 19), (4, 4, 12), 'Leather', .5)
        for offset in (-1, 1):
            rod('Arrow', (offset, 5, 20), (offset, 5, 29), .3, 'WoodLight', 5)
            box('Arrow fletching', (offset, 5, 28), (1.3, .5, 2.4), 'Linen')


def rifle(modern=False, long=False):
    box('Gun stock', (6.5, -5, 14), (2.6, 3, 8), 'Timber', .5)
    rod('Gun barrel', (6.5, -5, 17), (6.5, -5, 35 if long else 29), .75, 'Iron', 8)
    box('Lock and receiver', (6.5, -5, 19), (2.8, 3.6, 4), 'Iron', .3)
    if modern:
        box('Magazine', (6.5, -3, 18), (2, 4, 3), 'Iron', .2)
    if long:
        rod('Bayonet', (6.5, -5, 35), (6.5, -5, 40), .65, 'Steel', 4, 0)


def horse(armor=False, origin=(0, 0, 0)):
    before = set(bpy.data.objects)
    box('Pony body', (0, 0, 14), (10, 21, 10), 'Horse', 2.4)
    for x in (-3.6, 3.6):
        for y in (-6.5, 6.5):
            rod('Sturdy pony leg', (x, y, 3), (x, y, 12), 1.6, 'Horse', 5)
            box('Hoof', (x, y - .4, 2), (3.7, 4.2, 3), 'Mane', .5)
    rod('Pony neck', (0, -7, 17), (0, -12, 25), 4, 'Horse', 6, 3.3)
    box('Pony head', (0, -13, 26), (7, 9, 7.5), 'Horse', 1.4)
    box('Cream muzzle', (0, -17, 24.5), (6, 4, 4), 'Linen', .8)
    for x in (-2.3, 2.3):
        rod('Pony ear', (x, -11, 29), (x, -10, 33), 1.3, 'Horse', 4, .3)
        box('Pony eye', (x * 1.48, -14.5, 27), (.5, 1.2, 1.2), 'Ink', .1)
    box('Mane', (0, -7.5, 24), (2.8, 3.8, 10), 'Mane', .7)
    rod('Tail', (0, 9, 17), (0, 15, 7), 2, 'Mane', 6, 1)
    box('Team saddlecloth', (0, 1, 18), (12, 13, 3), 'TEAM', .7)
    box('Saddle', (0, 1, 20), (9, 8, 2), 'Leather', .6)
    box('Bridle', (0, -16.5, 26), (7.3, 1, 5.6), 'TEAM_DARK', .2)
    for x in (-3.6, 3.6):
        rod('Rein', (x, -15, 26), (x, -1, 25), .3, 'Leather', 4)
    if armor:
        box('Pony barding', (0, -8, 18), (12, 5, 8), 'Steel', 1.2)
        box('Pony chamfron', (0, -14, 29.2), (4.5, 7, 2), 'Steel', .6)
    for obj in set(bpy.data.objects) - before:
        obj.location += Vector(origin)


def finish(key):
    """Bake geometry into one origin-centered triangulated mesh in meters."""
    bpy.ops.object.select_all(action='DESELECT')
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = key
    bpy.context.scene.cursor.location = (0, 0, 0)
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    ground = min(vertex.co.z for vertex in obj.data.vertices)
    for vertex in obj.data.vertices:
        vertex.co.z -= ground
        vertex.co *= .01
    mesh = bmesh.new()
    mesh.from_mesh(obj.data)
    bmesh.ops.recalc_face_normals(mesh, faces=list(mesh.faces))
    mesh.to_mesh(obj.data)
    mesh.free()
    mod = obj.modifiers.new('Export triangles', 'TRIANGULATE')
    bpy.ops.object.modifier_apply(modifier=mod.name)
    for face in obj.data.polygons:
        face.use_smooth = False
    return obj
