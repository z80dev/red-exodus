"""AEONS nature asset toolkit. Blender 5.2, meter-sized Z-up authoring.

Run nature_build.py with Blender to regenerate the complete delivery, GLB
round-trip validation and Eevee contact sheets. All exported bounds are glTF
Y-up coordinates; presentation pedestals and labels never enter shipped meshes.
"""
import bpy
import math
import json
import random
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
MODELS = ROOT / 'public/models'
PREVIEWS = ROOT / 'art/previews'
PALETTE = {
    'leaf': '5b8c3a', 'leaf_dark': '3f6e2a', 'leaf_light': '86b04a',
    'trunk': '6b4a2f', 'rock': '8a8177', 'rock_dark': '6e665e',
    'snow': 'f2f4f7', 'sand': 'e3cf9a', 'roof': 'b5523b',
    'stone': 'c9bfae', 'timber': '7a5534', 'gold': 'e0b84a',
    'steel': 'b8bcc2', 'water': '6fa8c9', 'earth': '9b754e',
    'cream': 'f3dfb0', 'ink': '293c44', 'berry': '885a97',
    'coral': 'db846a', 'pink': 'eea8a0', 'teal': '55a89c',
    'coal': '3c444c', 'iron': 'ad6e50', 'red': 'af5442',
}
MATS = {}

def linear(v):
    return v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4

def mat(name):
    if name in MATS:
        return MATS[name]
    color = PALETTE.get(name, name)
    rgba = tuple(linear(int(color[i:i+2], 16) / 255) for i in (0, 2, 4)) + (1,)
    m = bpy.data.materials.new(name)
    m.diffuse_color = rgba
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = rgba
    bsdf.inputs['Roughness'].default_value = .82
    MATS[name] = m
    return m

def clear():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

def finish(obj, material, name=None):
    obj.data.materials.append(mat(material))
    if name:
        obj.name = name
    return obj

def mesh(name, verts, faces, material):
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    return finish(obj, material)

def cube(pos, size, material, bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
    obj = bpy.context.object
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    finish(obj, material)
    if bevel:
        mod = obj.modifiers.new('Soft carved edges', 'BEVEL')
        mod.width = bevel
        mod.segments = 1
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj

def cone(pos, radius, height, material, vertices=7, top=0):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius, radius2=top, depth=height, location=pos)
    return finish(bpy.context.object, material)

def ico(pos, scale, material, subdivisions=1):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, radius=1, location=pos)
    obj = bpy.context.object
    obj.scale = scale
    return finish(obj, material)

def beam(a, b, width, material, vertices=6, end=None):
    a, b = Vector(a), Vector(b)
    obj = cone((a+b)/2, width, (b-a).length, material, vertices, width if end is None else end)
    obj.rotation_euler = (b-a).to_track_quat('Z', 'Y').to_euler()
    return obj

def blade(a, tip, width, material, bend=.025):
    a, tip = Vector(a), Vector(tip)
    side = (tip-a).cross(Vector((0, 0, 1))).normalized() * width
    mid = a.lerp(tip, .5) + Vector((0, 0, bend))
    return mesh('Broad folded leaf', [a, mid+side, tip, mid-side, mid+Vector((0,0,.018))], [(0,1,4),(1,2,4),(2,3,4),(3,0,4),(3,2,1,0)], material)

def torus(pos, major, minor, material):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=10, minor_segments=4, location=pos)
    return finish(bpy.context.object, material)

def ring_mesh(name, rings, material, n=7):
    verts = []
    for z, radius, dx, dy, twist in rings:
        verts.extend([(dx+radius*math.cos(i*2*math.pi/n+twist),dy+radius*math.sin(i*2*math.pi/n+twist),z) for i in range(n)])
    faces = [tuple(range(n-1,-1,-1))]
    for row in range(len(rings)-1):
        for i in range(n):
            a=row*n+i; b=row*n+(i+1)%n
            faces.append((a,b,b+n,a+n))
    faces.append(tuple((len(rings)-1)*n+i for i in range(n)))
    return mesh(name,verts,faces,material)

def transform_all(scale=1, offset=(0,0,0)):
    for obj in list(bpy.context.scene.objects):
        if obj.type == 'MESH':
            obj.location = obj.location*scale + Vector(offset)
            obj.scale *= scale

def bounds(objects):
    points = [obj.matrix_world @ Vector(corner) for obj in objects for corner in obj.bound_box]
    return [min(p[i] for p in points) for i in range(3)], [max(p[i] for p in points) for i in range(3)]

def export(key, budget):
    objects = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        mod = obj.modifiers.new('Shipping triangles', 'TRIANGULATE')
        bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.context.view_layer.objects.active = objects[0]
    if len(objects)>1:
        bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = key
    tris = len(obj.data.polygons)
    if tris > budget:
        raise RuntimeError(f'{key}: {tris} triangles exceeds {budget}')
    lo, hi = bounds([obj])
    if abs(lo[2]) > .000001:
        for vertex in obj.data.vertices:
            vertex.co.z -= lo[2]
        obj.data.update()
        bpy.context.view_layer.update()
        lo, hi = bounds([obj])
    MODELS.mkdir(parents=True, exist_ok=True)
    path = MODELS / f'{key}.glb'
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True, export_yup=True, export_materials='EXPORT', export_cameras=False, export_lights=False, export_extras=False)
    entry = {'key':key, 'file':f'/models/{key}.glb', 'tris':tris, 'bbox':{'min':[round(lo[0],6),round(lo[2],6),round(-hi[1],6)],'max':[round(hi[0],6),round(hi[2],6),round(-lo[1],6)]}}
    clear()
    bpy.ops.import_scene.gltf(filepath=str(path))
    imported = [o for o in bpy.context.scene.objects if o.type=='MESH']
    actual = sum(len(p.vertices)-2 for o in imported for p in o.data.polygons)
    if actual != tris:
        raise RuntimeError(f'{key}: round-trip triangle mismatch {actual} != {tris}')
    if any(len(p.vertices)!=3 for o in imported for p in o.data.polygons):
        raise RuntimeError(f'{key}: non-triangulated round-trip')
    bpy.context.view_layer.update()
    after_lo, after_hi = bounds(imported)
    if max(abs(a-b) for a,b in zip(lo+hi,after_lo+after_hi)) > .0001:
        raise RuntimeError(f'{key}: round-trip bounds mismatch')
    print(f'VALIDATED {key}: {tris}/{budget} tris, {path.stat().st_size} bytes', flush=True)
    return entry

def write_manifest(entries):
    (MODELS/'manifest.nature.json').write_text(json.dumps(entries, indent=2)+'\n')

def contact_sheet(keys, name, columns=5, camera_height=15):
    clear()
    rows = math.ceil(len(keys)/columns)
    step = 2.05
    for i,key in enumerate(keys):
        x = (i%columns-(columns-1)/2)*step
        y = (rows-1-i//columns)*2.15
        before=set(bpy.context.scene.objects)
        bpy.ops.import_scene.gltf(filepath=str(MODELS/f'{key}.glb'))
        imported=[o for o in bpy.context.scene.objects if o not in before]
        meshes=[o for o in imported if o.type=='MESH']
        bpy.context.view_layer.update()
        lo,hi=bounds(meshes)
        scale=min(1.12/max(hi[0]-lo[0],hi[1]-lo[1],.01), .92/max(hi[2],.01))
        for obj in imported:
            if obj.parent is None:
                obj.location = obj.location*scale+Vector((x,y,.095))
                obj.scale *= scale
                obj.rotation_mode='XYZ'
                obj.rotation_euler.z += math.radians(-25)
        cone((x,y,.035), .76,.09,'314a50',6,top=.76)
        bpy.ops.object.text_add(location=(x,y-.94,.025))
        txt=bpy.context.object
        txt.name='Preview label'
        txt.data.body=key.replace('tree_','').replace('res_','').replace('imp_','').replace('_',' ').upper()
        txt.data.align_x='CENTER'
        txt.data.size=.112
        txt.data.extrude=0
        txt.data.materials.append(mat('cream'))
    cube((0,(rows-1)*2.15/2,-.065),(200,200,.08),'23353c')
    scene=bpy.context.scene
    # Blender 5.2 uses the unified Eevee engine identifier.
    try:
        scene.render.engine='BLENDER_EEVEE'
    except TypeError:
        scene.render.engine='BLENDER_EEVEE_NEXT'
    scene.render.resolution_x=columns*360
    scene.render.resolution_y=rows*340
    scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG'
    scene.render.film_transparent=False
    scene.world.color=(.23,.23,.23)
    scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.28,.35,.42,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value=.6
    center=Vector((0,(rows-1)*2.15/2,0))
    bpy.ops.object.camera_add(location=center+Vector((0,-10,camera_height)))
    camera=bpy.context.object
    camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type='ORTHO'
    camera.data.ortho_scale=max(columns*step+.45,rows*2.15*scene.render.resolution_x/scene.render.resolution_y)
    scene.camera=camera
    for pos,energy,size,color in [((-4,-5,10),1700,8,(1,.84,.64)),((5,3,8),1200,7,(.68,.83,1))]:
        bpy.ops.object.light_add(type='AREA',location=center+Vector(pos))
        light=bpy.context.object
        light.data.energy=energy
        light.data.shape='DISK'
        light.data.size=size
        light.data.color=color
        light.rotation_euler=(center-light.location).to_track_quat('-Z','Y').to_euler()
    scene.view_settings.view_transform='AgX'
    PREVIEWS.mkdir(parents=True,exist_ok=True)
    scene.render.filepath=str(PREVIEWS/f'nature_{name}.png')
    bpy.ops.render.render(write_still=True)
