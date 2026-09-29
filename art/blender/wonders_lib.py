"""AEONS wonders toolkit (Blender 5.2). Z-up authoring, model front faces Blender -Y.

Every model is accumulated into ONE bmesh through `Builder` (fast, no operator overhead), then turned into a
single mesh object with one material slot per palette entry, triangulated, AO-baked into a CORNER color
attribute (multiplied into base color by the material, exported as glTF COLOR_0) and exported as GLB.

Conventions
- Units: hex circumradius 1.0, pointy-top (vertices at 30°+60°k). Wonders fit radius <= 0.85, height 0.4-0.95.
- Origin = ground centre of footprint, z = 0 is the terrain surface.
- Material names: palette keys (lower-case) plus the renderer-contract names TEAM, TEAM_DARK, EMISSIVE, WATER.
"""
import bpy
import bmesh
import json
import math
import random
from contextlib import contextmanager
from pathlib import Path
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[2]
MODELS = ROOT / 'public/models'
PREVIEWS = ROOT / 'art/previews'
MANIFEST = MODELS / 'manifest.wonders.json'

MAX_TRIS = 4000
MAX_RADIUS = 0.85
HEIGHT_RANGE = (0.4, 0.95)

# name: (sRGB hex, roughness, emission strength)
PALETTE = {
    # Mars structural stone, regolith and vitrified sinter
    'stone': ('#b5552b', .9, 0), 'stone_dark': ('#783d2b', .92, 0), 'stone_light': ('#d9a066', .84, 0),
    'marble': ('#e7e3dc', .76, 0), 'marble_shade': ('#a99b8e', .82, 0),
    'sandstone': ('#c8693a', .9, 0), 'sandstone_dark': ('#9b4424', .92, 0), 'limestone': ('#d9a066', .9, 0),
    'granite': ('#57463d', .92, 0), 'basalt': ('#3b2f2a', .94, 0), 'plaster': ('#e7e3dc', .88, 0),
    'rose': ('#c8693a', .9, 0), 'rose_dark': ('#9b4424', .92, 0), 'laterite': ('#9b4424', .93, 0),
    'moss_stone': ('#8a8f46', .92, 0), 'brick': ('#b5552b', .9, 0), 'clay': ('#d9a066', .9, 0),
    'rock': ('#9b6044', .94, 0), 'rock_dark': ('#57463d', .95, 0), 'rock_light': ('#c8693a', .9, 0),
    # Dust, basalt and polar ice
    'sand': ('#c8693a', .95, 0), 'sand_dark': ('#6e3219', .96, 0), 'grass': ('#a4552c', .96, 0),
    'grass_dark': ('#6e3219', .96, 0), 'dirt': ('#9b4424', .96, 0), 'paving': ('#57463d', .9, 0),
    'snow': ('#eef3f6', .8, 0),
    # Sparse lichen; old-wood analogues are salvage composites
    'foliage': ('#c77b2c', .88, 0), 'foliage_dark': ('#783d2b', .9, 0), 'foliage_light': ('#d9a066', .86, 0),
    'interior_foliage': ('#8a9a3b', .82, 0),
    'blossom': ('#c77b2c', .85, 0), 'flower_y': ('#d9a066', .85, 0), 'flower_r': ('#b5552b', .85, 0),
    'trunk': ('#57463d', .9, 0), 'bark_old': ('#783d2b', .9, 0), 'vine': ('#9b4424', .9, 0),
    # Hab shells, hulls, solar arrays, hazard trim
    'terracotta': ('#b5552b', .88, 0), 'timber': ('#57463d', .92, 0), 'wood_dark': ('#3b2f2a', .94, 0),
    'gold': ('#d9a066', .56, 0), 'bronze': ('#9b6044', .65, 0), 'patina': ('#3f8f8a', .78, 0),
    'patina_dark': ('#285e60', .84, 0), 'copper': ('#c8693a', .75, 0), 'lead_roof': ('#8d9097', .82, 0),
    'slate': ('#3b2f2a', .88, 0), 'roof_tile_dark': ('#3b2f2a', .88, 0), 'white_plaster': ('#e7e3dc', .82, 0),
    'concrete': ('#8d9097', .88, 0), 'concrete_dark': ('#57463d', .9, 0), 'steel': ('#8d9097', .72, 0),
    'iron': ('#3b2f2a', .78, 0), 'eiffel': ('#9b4424', .8, 0), 'eiffel_dark': ('#57463d', .84, 0),
    'shell_white': ('#e7e3dc', .72, 0), 'shell_tile': ('#8d9097', .78, 0), 'rocket_white': ('#e7e3dc', .74, 0),
    'red': ('#b5552b', .84, 0), 'red_dark': ('#6e3219', .9, 0), 'black': ('#292729', .9, 0),
    'clock': ('#eef3f6', .82, 0), 'jade': ('#8a9a3b', .82, 0), 'lapis': ('#3f8f8a', .78, 0),
    'bone': ('#d9a066', .82, 0), 'bone_shade': ('#9b6044', .88, 0),
    'crystal': ('#5fd4e8', .5, 0), 'crystal_deep': ('#3f8f8a', .54, 0),
    'glass': ('#6fa8c9', .35, 0), 'glass_dark': ('#31556a', .42, 0),
    # renderer-contract materials
    'TEAM': ('#f28c28', .8, 0), 'TEAM_DARK': ('#9b4424', .86, 0),
    'WATER': ('#3f8f8a', .28, 0), 'EMISSIVE': ('#f28c28', .6, 4.0),
    'EMISSIVE_CYAN': ('#5fd4e8', .5, 3.0),
    'hazard': ('#f28c28', .76, 0), 'solar': ('#1d2a44', .46, 0), 'cryo': ('#5fd4e8', .46, 0),
}

_MATS = {}


def srgb_to_linear(c):
    return c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4


def hex_rgb(h, linear=True):
    h = h.lstrip('#')
    rgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [srgb_to_linear(c) for c in rgb] if linear else rgb


def material(name, overrides=None):
    """Palette material with a Color Attribute (AO) multiplied into Base Color. `overrides` lets a model
    retint e.g. EMISSIVE: {'color': '#hex', 'emit': 5.0}."""
    if name in _MATS:
        return _MATS[name]
    col, rough, emit = PALETTE[name]
    if overrides:
        col = overrides.get('color', col)
        rough = overrides.get('rough', rough)
        emit = overrides.get('emit', emit)
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    m.use_backface_culling = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    p = nt.nodes.new('ShaderNodeBsdfPrincipled')
    lin = hex_rgb(col)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = 0.0
    if emit:
        p.inputs['Emission Color'].default_value = (*lin, 1)
        p.inputs['Emission Strength'].default_value = emit
    ao = nt.nodes.new('ShaderNodeVertexColor')
    ao.layer_name = 'AO'
    mix = nt.nodes.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    mix.blend_type = 'MULTIPLY'
    mix.inputs['Factor'].default_value = 1.0
    mix.inputs[6].default_value = (*lin, 1)
    nt.links.new(ao.outputs['Color'], mix.inputs[7])
    nt.links.new(mix.outputs[2], p.inputs['Base Color'])
    nt.links.new(p.outputs['BSDF'], out.inputs['Surface'])
    m.diffuse_color = (*lin, 1)
    _MATS[name] = m
    return m


# ---------------------------------------------------------------------------------------------- transforms

def T(x=0.0, y=0.0, z=0.0):
    return Matrix.Translation((x, y, z))


def R(x=0.0, y=0.0, z=0.0):
    """Rotation in degrees, applied X then Y then Z."""
    return (Matrix.Rotation(math.radians(z), 4, 'Z') @ Matrix.Rotation(math.radians(y), 4, 'Y')
            @ Matrix.Rotation(math.radians(x), 4, 'X'))


def S(x=1.0, y=None, z=None):
    y = x if y is None else y
    z = x if z is None else z
    return Matrix.Diagonal((x, y, z, 1.0))


def place(at=(0, 0, 0), rot=(0, 0, 0), scale=None):
    m = T(*at) @ R(*rot)
    if scale is not None:
        m = m @ (S(scale) if isinstance(scale, (int, float)) else S(*scale))
    return m


def polar(r, deg, z=0.0):
    a = math.radians(deg)
    return (r * math.cos(a), r * math.sin(a), z)


def hex_points(r, z=0.0):
    """Pointy-top hex (vertex towards +/-Y, i.e. glTF -/+Z)."""
    return [polar(r, 30 + 60 * k, z) for k in range(6)]


# ---------------------------------------------------------------------------------------------- temp meshes

def _tb_box(sx, sy, sz, taper=1.0):
    tb = bmesh.new()
    bmesh.ops.create_cube(tb, size=1.0)
    for v in tb.verts:
        v.co.z += .5
        f = taper if v.co.z > .5 else 1.0
        v.co.x *= sx * f
        v.co.y *= sy * f
        v.co.z *= sz
    return tb


def _tb_lathe(profile, segs, start=0.0, cap_bottom=True, cap_top=True, arc=360.0):
    """Revolve [(r, z), ...] (bottom to top) around Z. r == 0 points become poles."""
    tb = bmesh.new()
    full = abs(arc - 360.0) < 1e-6
    n_ang = segs if full else segs + 1
    rings = []
    for r, z in profile:
        if r <= 1e-6:
            rings.append([tb.verts.new((0, 0, z))])
        else:
            ring = []
            for k in range(n_ang):
                a = math.radians(start + arc * k / segs)
                ring.append(tb.verts.new((r * math.cos(a), r * math.sin(a), z)))
            rings.append(ring)
    for i in range(len(rings) - 1):
        a, b = rings[i], rings[i + 1]
        steps = segs
        for k in range(steps):
            k2 = (k + 1) % n_ang if full else k + 1
            if len(a) == 1 and len(b) == 1:
                continue
            if len(a) == 1:
                tb.faces.new((a[0], b[k], b[k2]))
            elif len(b) == 1:
                tb.faces.new((a[k], a[k2], b[0]))
            else:
                tb.faces.new((a[k], a[k2], b[k2], b[k]))
    if full:
        if cap_bottom and len(rings[0]) > 1:
            tb.faces.new(list(reversed(rings[0])))
        if cap_top and len(rings[-1]) > 1:
            tb.faces.new(rings[-1])
    return tb


def _tb_prism(pts, h, top_scale=1.0, top_offset=(0, 0)):
    """Extrude polygon [(x, y), ...] (either winding) from z=0 to z=h."""
    area = sum(pts[i][0] * pts[(i + 1) % len(pts)][1] - pts[(i + 1) % len(pts)][0] * pts[i][1]
               for i in range(len(pts)))
    if area < 0:
        pts = list(reversed(pts))
    tb = bmesh.new()
    bot = [tb.verts.new((x, y, 0)) for x, y in pts]
    cx = sum(p[0] for p in pts) / len(pts)
    cy = sum(p[1] for p in pts) / len(pts)
    top = [tb.verts.new((cx + (x - cx) * top_scale + top_offset[0], cy + (y - cy) * top_scale + top_offset[1], h))
           for x, y in pts]
    n = len(pts)
    tb.faces.new(list(reversed(bot)))
    tb.faces.new(top)
    for i in range(n):
        j = (i + 1) % n
        tb.faces.new((bot[i], bot[j], top[j], top[i]))
    return tb


def _tb_ico(subdiv, jitter=0.0, seed=0):
    tb = bmesh.new()
    bmesh.ops.create_icosphere(tb, subdivisions=subdiv, radius=1.0)
    if jitter:
        rnd = random.Random(seed)
        for v in tb.verts:
            v.co *= 1.0 + rnd.uniform(-jitter, jitter)
    return tb


def _frames(pts):
    """Parallel-transport frames along a polyline."""
    tans = []
    for i in range(len(pts)):
        a = pts[max(i - 1, 0)]
        b = pts[min(i + 1, len(pts) - 1)]
        tans.append((b - a).normalized())
    up = Vector((0, 0, 1)) if abs(tans[0].z) < .9 else Vector((1, 0, 0))
    n = tans[0].cross(up).normalized()
    frames = []
    for t in tans:
        n = (n - t * n.dot(t)).normalized()
        frames.append((n, t.cross(n).normalized()))
    return frames


def _tb_tube(path, radii, segs=6, cap=True, flat=1.0):
    pts = [Vector(p) for p in path]
    if isinstance(radii, (int, float)):
        radii = [radii] * len(pts)
    tb = bmesh.new()
    rings = []
    for p, (n, b), r in zip(pts, _frames(pts), radii):
        ring = []
        for k in range(segs):
            a = 2 * math.pi * k / segs
            ring.append(tb.verts.new(p + n * (math.cos(a) * r) + b * (math.sin(a) * r * flat)))
        rings.append(ring)
    for i in range(len(rings) - 1):
        for k in range(segs):
            k2 = (k + 1) % segs
            tb.faces.new((rings[i][k], rings[i][k2], rings[i + 1][k2], rings[i + 1][k]))
    if cap:
        tb.faces.new(list(reversed(rings[0])))
        tb.faces.new(rings[-1])
    return tb


# ---------------------------------------------------------------------------------------------- builder

class Builder:
    def __init__(self, key):
        self.key = key
        self.bm = bmesh.new()
        self.mat_names = []
        self.stack = [Matrix.Identity(4)]
        self.overrides = {}

    # ----- infra
    def mi(self, name):
        if name not in self.mat_names:
            self.mat_names.append(name)
        return self.mat_names.index(name)

    @contextmanager
    def xform(self, m):
        self.stack.append(self.stack[-1] @ m)
        try:
            yield
        finally:
            self.stack.pop()

    def _add(self, tb, local, mat, smooth=False, bevel=0.0, bevel_angle=25.0, bevel_segs=1):
        m = self.stack[-1] @ local
        bmesh.ops.remove_doubles(tb, verts=tb.verts, dist=1e-6)
        bmesh.ops.transform(tb, matrix=m, verts=tb.verts)
        if tb.edges and all(e.is_manifold for e in tb.edges):
            bmesh.ops.recalc_face_normals(tb, faces=tb.faces)  # closed solids: guarantee outward normals
        elif m.to_3x3().determinant() < 0:
            bmesh.ops.reverse_faces(tb, faces=tb.faces)
        if bevel > 0:
            tb.normal_update()
            edges = [e for e in tb.edges if e.is_manifold and e.calc_face_angle(0) > math.radians(bevel_angle)]
            if edges:
                bmesh.ops.bevel(tb, geom=edges, offset=bevel, offset_type='OFFSET', segments=bevel_segs,
                                profile=.5, affect='EDGES', clamp_overlap=True)
        idx = self.mi(mat)
        vmap = {}
        for v in tb.verts:
            vmap[v] = self.bm.verts.new(v.co)
        for f in tb.faces:
            try:
                nf = self.bm.faces.new([vmap[v] for v in f.verts])
            except ValueError:
                continue
            nf.material_index = idx
            nf.smooth = smooth
        tb.free()

    # ----- primitives (all `at` positions are the BOTTOM centre unless noted)
    def box(self, size, at=(0, 0, 0), mat='stone', rot=(0, 0, 0), bevel=0.0, taper=1.0):
        sx, sy, sz = size
        self._add(_tb_box(sx, sy, sz, taper), place(at, rot), mat, bevel=bevel)

    def cyl(self, r, h, at=(0, 0, 0), mat='stone', segs=12, r2=None, rot=(0, 0, 0), bevel=0.0, smooth=False,
            start=None, scale=None):
        r2 = r if r2 is None else r2
        start = (180.0 / segs) if start is None else start
        prof = [(0, 0), (r, 0), (r2, h), (0, h)] if r2 > 1e-6 else [(0, 0), (r, 0), (0, h)]
        self._add(_tb_lathe(prof, segs, start), place(at, rot, scale), mat, smooth=smooth, bevel=bevel)

    def cone(self, r, h, at=(0, 0, 0), mat='stone', segs=12, rot=(0, 0, 0), smooth=False, start=None, scale=None):
        self.cyl(r, h, at, mat, segs, 0.0, rot, smooth=smooth, start=start, scale=scale)

    def hexa(self, r, h, at=(0, 0, 0), mat='stone', bevel=0.0, r2=None):
        """Pointy-top hex prism."""
        self.cyl(r, h, at, mat, segs=6, r2=r2, start=30.0, bevel=bevel)

    def lathe(self, profile, at=(0, 0, 0), mat='stone', segs=16, rot=(0, 0, 0), smooth=False, start=None,
              scale=None, bevel=0.0, arc=360.0):
        start = (180.0 / segs) if start is None else start
        self._add(_tb_lathe(profile, segs, start, arc=arc), place(at, rot, scale), mat, smooth=smooth, bevel=bevel)

    def sphere(self, r, at=(0, 0, 0), mat='stone', segs=12, rings=6, scale=None, rot=(0, 0, 0), smooth=True,
               center=True):
        """UV sphere; `at` is the centre when center=True."""
        prof = [(r * math.sin(math.pi * i / rings), -r * math.cos(math.pi * i / rings)) for i in range(rings + 1)]
        prof[0] = (0, -r)
        prof[-1] = (0, r)
        m = place(at, rot, scale)
        if not center:
            m = m @ T(0, 0, r)
        self._add(_tb_lathe(prof, segs), m, mat, smooth=smooth)

    def dome(self, r, h, at=(0, 0, 0), mat='stone', segs=16, rings=4, rot=(0, 0, 0), smooth=True, onion=0.0,
             tip=0.0):
        """Hemispherical (h == r) / flattened / onion dome sitting on `at`. `tip` adds a finial point height."""
        prof = []
        for i in range(rings + 1):
            t = i / rings
            a = t * math.pi / 2
            rr = r * math.cos(a) * (1 + onion * math.sin(a * 2) * 1.2)
            prof.append((rr, h * math.sin(a)))
        prof[-1] = (0, h + tip)
        if tip:
            prof.insert(-1, (r * .08, h * .98))
        self._add(_tb_lathe([(0, 0)] + prof, segs), place(at, rot), mat, smooth=smooth)

    def prism(self, pts, h, at=(0, 0, 0), mat='stone', rot=(0, 0, 0), bevel=0.0, top_scale=1.0, scale=None):
        self._add(_tb_prism(pts, h, top_scale), place(at, rot, scale), mat, bevel=bevel)

    def decal(self, pts, at=(0, 0, 0), mat='wood_dark', rot=(0, 0, 0), scale=None):
        """Single one-sided polygon [(x, y), ...] in the local XY plane facing +Z (5 tris for a 7-gon) — use for
        window/door/arch recesses and clock faces laid just proud of a wall (rot=(90,0,0) faces -Y)."""
        area = sum(pts[i][0] * pts[(i + 1) % len(pts)][1] - pts[(i + 1) % len(pts)][0] * pts[i][1]
                   for i in range(len(pts)))
        if area < 0:
            pts = list(reversed(pts))
        tb = bmesh.new()
        tb.faces.new([tb.verts.new((x, y, 0)) for x, y in pts])
        self._add(tb, place(at, rot, scale), mat)

    def ico(self, r, at=(0, 0, 0), mat='foliage', subdiv=1, jitter=0.0, seed=0, scale=None, rot=(0, 0, 0),
            smooth=False):
        """Icosphere blob; `at` is the centre."""
        sc = (r, r, r) if scale is None else (r * scale[0], r * scale[1], r * scale[2])
        self._add(_tb_ico(subdiv, jitter, seed), place(at, rot, sc), mat, smooth=smooth)

    def torus(self, R, r, at=(0, 0, 0), mat='gold', segs=16, rsegs=5, rot=(0, 0, 0), smooth=False):
        """Ring in the XY plane centred on `at` (major radius R, tube radius r)."""
        tb = bmesh.new()
        rings = []
        for i in range(segs):
            a = 2 * math.pi * i / segs
            ring = []
            for j in range(rsegs):
                t = 2 * math.pi * j / rsegs
                rr = R + r * math.cos(t)
                ring.append(tb.verts.new((rr * math.cos(a), rr * math.sin(a), r * math.sin(t))))
            rings.append(ring)
        for i in range(segs):
            a, b2 = rings[i], rings[(i + 1) % segs]
            for j in range(rsegs):
                j2 = (j + 1) % rsegs
                tb.faces.new((a[j], b2[j], b2[j2], a[j2]))
        bmesh.ops.recalc_face_normals(tb, faces=tb.faces)
        self._add(tb, place(at, rot), mat, smooth=smooth)

    def tube(self, path, radii, mat='stone', segs=6, cap=True, smooth=False, flat=1.0):
        self._add(_tb_tube(path, radii, segs, cap, flat), Matrix.Identity(4), mat, smooth=smooth)

    def gable(self, w, d, h, at=(0, 0, 0), mat='terracotta', rot=(0, 0, 0), overhang=0.0):
        """Gable roof: ridge runs along X, width w (X) depth d (Y), apex height h above `at`."""
        w2, d2 = w / 2 + overhang, d / 2 + overhang
        pts = [(-d2, 0), (d2, 0), (0, h)]
        tb = _tb_prism(pts, w2 * 2)
        # prism is built in XY and extruded along Z: rotate so extrusion runs along X, section in YZ
        bmesh.ops.transform(tb, matrix=R(0, 90, 0) @ R(0, 0, 90), verts=tb.verts)
        bmesh.ops.translate(tb, vec=(-w2, 0, 0), verts=tb.verts)
        self._add(tb, place(at, rot), mat)

    def hip(self, w, d, h, at=(0, 0, 0), mat='terracotta', rot=(0, 0, 0), ridge=0.0, overhang=0.0):
        """Hip roof (pyramid frustum to a ridge of length `ridge` along X)."""
        w2, d2 = w / 2 + overhang, d / 2 + overhang
        tb = bmesh.new()
        b = [tb.verts.new(p) for p in ((-w2, -d2, 0), (w2, -d2, 0), (w2, d2, 0), (-w2, d2, 0))]
        if ridge > 1e-6:
            t = [tb.verts.new((-ridge / 2, 0, h)), tb.verts.new((ridge / 2, 0, h))]
            tb.faces.new((b[0], b[1], t[1], t[0]))
            tb.faces.new((b[1], b[2], t[1]))
            tb.faces.new((b[2], b[3], t[0], t[1]))
            tb.faces.new((b[3], b[0], t[0]))
        else:
            t = tb.verts.new((0, 0, h))
            for i in range(4):
                tb.faces.new((b[i], b[(i + 1) % 4], t))
        tb.faces.new(list(reversed(b)))
        self._add(tb, place(at, rot), mat)

    def arch_wall(self, w, h, t, opening_w, opening_h, at=(0, 0, 0), mat='stone', rot=(0, 0, 0), segs=6,
                  bevel=0.0):
        """Wall slab in the XZ plane (thickness t along Y) with a round-headed arch opening at the bottom
        centre. Built from pier boxes + a curved crown so it triangulates cleanly."""
        ow = opening_w / 2
        spring = opening_h - ow
        pts = [(-w / 2, 0), (-ow, 0), (-ow, spring)]
        for k in range(1, segs):
            a = math.pi - math.pi * k / segs
            pts.append((ow * math.cos(a), spring + ow * math.sin(a)))
        pts += [(ow, spring), (ow, 0), (w / 2, 0), (w / 2, h), (-w / 2, h)]
        tb = _tb_prism(pts, t)
        bmesh.ops.transform(tb, matrix=R(90, 0, 0), verts=tb.verts)
        bmesh.ops.translate(tb, vec=(0, t / 2, 0), verts=tb.verts)
        self._add(tb, place(at, rot), mat, bevel=bevel)

    def stairs(self, w, d, h, steps, at=(0, 0, 0), mat='stone', rot=(0, 0, 0)):
        """Flight of `steps` rising towards +Y; `at` is the bottom front edge centre, total run d, rise h."""
        with self.xform(place(at, rot)):
            for i in range(steps):
                run = d * (steps - i) / steps
                self.box((w, run, h / steps), (0, d - run / 2, h * i / steps), mat)

    def surface(self, fn, nu, nv, mat='stone', thickness=0.0, smooth=False, close_u=False):
        """Grid surface from fn(u, v) -> (x, y, z) with u, v in [0, 1]. thickness > 0 offsets a back sheet
        along the averaged normals (towards -normal) and stitches the borders into a closed solid."""
        tb = bmesh.new()
        cols = nu if close_u else nu + 1
        grid = [[tb.verts.new(fn((i % nu) / nu if close_u else i / nu, j / nv)) for j in range(nv + 1)]
                for i in range(cols)]
        faces = []
        for i in range(nu):
            i2 = (i + 1) % cols
            for j in range(nv):
                faces.append(tb.faces.new((grid[i][j], grid[i2][j], grid[i2][j + 1], grid[i][j + 1])))
        if thickness > 0:
            tb.normal_update()
            back = {}
            for col in grid:
                for v in col:
                    back[v] = tb.verts.new(v.co - v.normal * thickness)
            for f in faces:
                tb.faces.new([back[v] for v in reversed(f.verts)])
            border = []
            for i in range(nu):
                i2 = (i + 1) % cols
                border.append((grid[i2][0], grid[i][0]))
                border.append((grid[i][nv], grid[i2][nv]))
            if not close_u:
                for j in range(nv):
                    border.append((grid[0][j + 1], grid[0][j]))
                    border.append((grid[nu][j], grid[nu][j + 1]))
            for a, b in border:
                tb.faces.new((a, b, back[b], back[a]))
            bmesh.ops.recalc_face_normals(tb, faces=tb.faces)
        self._add(tb, Matrix.Identity(4), mat, smooth=smooth)

    # ----- props
    def tree_round(self, at, s=1.0, seed=0, leaf='foliage', leaf2='foliage_light'):
        x, y, z = at
        rnd = random.Random(seed)
        self.cyl(.018 * s, .08 * s, (x, y, z), 'trunk', segs=5, r2=.013 * s)
        self.ico(.07 * s, (x, y, z + .11 * s), leaf, 1, .18, seed, scale=(1, 1, .9))
        self.ico(.045 * s, (x + rnd.uniform(-.03, .03) * s, y + rnd.uniform(-.03, .03) * s, z + .16 * s), leaf2, 0,
                 .1, seed + 1)

    def tree_cypress(self, at, s=1.0, leaf='foliage_dark'):
        x, y, z = at
        self.cyl(.012 * s, .03 * s, (x, y, z), 'trunk', segs=4)
        self.lathe([(0, 0), (.035 * s, .03 * s), (.042 * s, .08 * s), (.03 * s, .15 * s), (0, .22 * s)],
                   (x, y, z + .02 * s), leaf, segs=6)

    def tree_pine(self, at, s=1.0, leaf='foliage_dark'):
        x, y, z = at
        self.cyl(.014 * s, .05 * s, (x, y, z), 'trunk', segs=4)
        self.cone(.065 * s, .12 * s, (x, y, z + .04 * s), leaf, segs=6)
        self.cone(.05 * s, .1 * s, (x, y, z + .1 * s), leaf, segs=6, start=0)

    def tree_palm(self, at, s=1.0, seed=0, lean=12.0, fronds=7):
        x, y, z = at
        rnd = random.Random(seed)
        dirn = rnd.uniform(0, 360)
        lx, ly = math.cos(math.radians(dirn)), math.sin(math.radians(dirn))
        k = math.tan(math.radians(lean))
        path = [(x + lx * k * t * t * .26 * s, y + ly * k * t * t * .26 * s, z + t * .26 * s)
                for t in (0, .35, .7, 1)]
        self.tube(path, [.016 * s, .013 * s, .011 * s, .01 * s], 'trunk', segs=5)
        top = Vector(path[-1])
        self.ico(.016 * s, (top.x, top.y, top.z - .008 * s), 'wood_dark', 0, .1, seed)
        up = Vector((0, 0, 1))
        for i in range(fronds):
            a = math.radians(i * 360 / fronds + rnd.uniform(-14, 14))
            d = Vector((math.cos(a), math.sin(a), 0))
            side = Vector((-d.y, d.x, 0))
            L = rnd.uniform(.9, 1.1) * s
            spine = [top, top + d * .06 * L + up * .03 * s, top + d * .12 * L + up * .018 * s,
                     top + d * .17 * L - up * .025 * s]
            widths = [0, .03 * s, .026 * s, 0]
            tb = bmesh.new()
            c = [tb.verts.new(p) for p in spine]
            lft = [tb.verts.new(p + side * w - up * w * .45) for p, w in zip(spine[1:3], widths[1:3])]
            rgt = [tb.verts.new(p - side * w - up * w * .45) for p, w in zip(spine[1:3], widths[1:3])]
            for f in ((c[0], lft[0], c[1]), (c[0], c[1], rgt[0]), (c[1], lft[0], lft[1], c[2]),
                      (c[1], c[2], rgt[1], rgt[0]), (c[2], lft[1], c[3]), (c[2], c[3], rgt[1])):
                face = tb.faces.new(f)
                face.normal_update()
                if face.normal.z < 0:
                    face.normal_flip()
            self._add(tb, Matrix.Identity(4), 'foliage' if i % 2 else 'foliage_light')

    def bush(self, at, s=1.0, seed=0, mat='foliage'):
        x, y, z = at
        self.ico(.04 * s, (x, y, z + .02 * s), mat, 0, .15, seed, scale=(1.2, 1, .75))

    def rock(self, at, s=1.0, seed=0, mat='rock', flat=.7):
        x, y, z = at
        rnd = random.Random(seed)
        self.ico(.05 * s, (x, y, z + .012 * s), mat, 0, .25, seed, scale=(1 + rnd.uniform(0, .4), 1, flat),
                 rot=(0, 0, rnd.uniform(0, 360)))

    def flag(self, at, h=.16, mat='TEAM', pole='wood_dark', wave=1.0, facing=0.0):
        """Pole with a swallow-tail pennant in team colours, flying towards +X (rotated by `facing`)."""
        x, y, z = at
        with self.xform(place((x, y, z), (0, 0, facing))):
            self.cyl(.006, h, (0, 0, 0), pole, segs=4)
            self.sphere(.01, (0, 0, h + .006), 'gold', segs=5, rings=3, smooth=False)
            L, H = .085, .05
            pts = [(0, 0), (L * .45, .006 * wave), (L, -.004 * wave), (L * .78, -H / 2), (L, -H - .004 * wave),
                   (L * .45, -H + .008 * wave), (0, -H)]
            tb = _tb_prism([(p[0], p[1]) for p in pts], .004)
            bmesh.ops.transform(tb, matrix=R(90, 0, 0), verts=tb.verts)
            for v in tb.verts:
                v.co.y += math.sin(v.co.x / L * math.pi * 1.4) * .012 * wave
            self._add(tb, T(.004, 0, h - .004), mat)

    def water(self, pts_or_r, at=(0, 0, 0), depth=.012, segs=18):
        """Flat water surface just above `at` (z)."""
        if isinstance(pts_or_r, (int, float)):
            self.cyl(pts_or_r, depth, at, 'WATER', segs=segs)
        else:
            self.prism(pts_or_r, depth, at, 'WATER')

    def base_hex(self, r=.8, h=.035, mat='paving', rim='stone_dark', rim_w=.04, bevel=.008, inner_h=None):
        """Standard wonder plinth: bevelled rim hex + inset plaza hex."""
        self.hexa(r, h, (0, 0, 0), rim, bevel=bevel)
        self.hexa(r - rim_w, (inner_h or h) + .006, (0, 0, 0), mat)

    def ring(self, n, r, fn, start=0.0, z=0.0):
        """Call fn(x, y, z, angle_deg, i) for n points around a circle."""
        for i in range(n):
            a = start + 360.0 * i / n
            x, y, _ = polar(r, a)
            fn(x, y, z, a, i)

    # ----- finalize
    def to_object(self):
        bm = self.bm
        # clip everything buried below the terrain (half-sunk rocks, roots): saves tris, never visible
        geom = list(bm.verts) + list(bm.edges) + list(bm.faces)
        bmesh.ops.bisect_plane(bm, geom=geom, dist=1e-6, plane_co=(0, 0, -.004), plane_no=(0, 0, 1),
                               clear_inner=True)
        bmesh.ops.dissolve_degenerate(bm, edges=bm.edges, dist=1e-7)
        bmesh.ops.triangulate(bm, faces=bm.faces, quad_method='BEAUTY', ngon_method='BEAUTY')
        me = bpy.data.meshes.new(self.key)
        bm.to_mesh(me)
        bm.free()
        for n in self.mat_names:
            me.materials.append(material(n, self.overrides.get(n)))
        me.set_sharp_from_angle(angle=math.radians(40))
        ob = bpy.data.objects.new(self.key, me)
        bpy.context.scene.collection.objects.link(ob)
        return ob


# ---------------------------------------------------------------------------------------------- scene / AO

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _MATS.clear()


def _hemisphere(n, seed=7):
    rnd = random.Random(seed)
    dirs = []
    for i in range(n):
        u = (i + rnd.random()) / n
        v = rnd.random()
        r = math.sqrt(u)
        a = 2 * math.pi * v
        dirs.append(Vector((r * math.cos(a), r * math.sin(a), math.sqrt(max(0.0, 1 - u)))))
    return dirs


def bake_ao(ob, rays=40, dist=.22, floor=.42, gamma=1.0, ground=True):
    """Ray-traced ambient occlusion baked into a CORNER float color attribute 'AO'."""
    me = ob.data
    bm = bmesh.new()
    bm.from_mesh(me)
    if ground:
        g = [bm.verts.new(p) for p in ((-3, -3, -.0005), (3, -3, -.0005), (3, 3, -.0005), (-3, 3, -.0005))]
        bm.faces.new(g)
    bvh = BVHTree.FromBMesh(bm)
    bm.free()
    dirs = _hemisphere(rays)
    ca = me.color_attributes.get('AO') or me.color_attributes.new('AO', 'BYTE_COLOR', 'CORNER')
    me.color_attributes.active_color = ca
    cache = {}
    verts = me.vertices
    for poly in me.polygons:
        n = poly.normal.copy()
        c = poly.center
        t = n.orthogonal().normalized()
        b = n.cross(t)
        for li in poly.loop_indices:
            vi = me.loops[li].vertex_index
            key = (vi, round(n.x, 3), round(n.y, 3), round(n.z, 3))
            if key in cache:
                val = cache[key]
            else:
                p = verts[vi].co
                o = p + (c - p) * .04 + n * .0015
                hits = 0.0
                for d in dirs:
                    w = t * d.x + b * d.y + n * d.z
                    hit = bvh.ray_cast(o, w, dist)
                    if hit[0] is not None:
                        hits += 1.0 - (hit[3] / dist) * .5
                occ = 1.0 - hits / len(dirs)
                val = floor + (1 - floor) * (occ ** gamma)
                cache[key] = val
            ca.data[li].color = (val, val, val, 1.0)


# ---------------------------------------------------------------------------------------------- validation / export

def stats(ob):
    me = ob.data
    tris = sum(len(p.vertices) - 2 for p in me.polygons)
    xs = [v.co for v in me.vertices]
    lo = Vector((min(v.x for v in xs), min(v.y for v in xs), min(v.z for v in xs)))
    hi = Vector((max(v.x for v in xs), max(v.y for v in xs), max(v.z for v in xs)))
    rad = max(math.hypot(v.x, v.y) for v in xs)
    return tris, lo, hi, rad


def validate(ob, key, max_radius=MAX_RADIUS, height=HEIGHT_RANGE):
    tris, lo, hi, rad = stats(ob)
    errs = []
    if tris > MAX_TRIS:
        errs.append(f'tris {tris} > {MAX_TRIS}')
    if rad > max_radius + 1e-4:
        errs.append(f'radius {rad:.3f} > {max_radius}')
    if not (height[0] <= hi.z <= height[1]):
        errs.append(f'height {hi.z:.3f} outside {height}')
    if lo.z < -.03:
        errs.append(f'sinks {lo.z:.3f} below ground')
    for m in ob.data.materials:
        if any(n.type == 'TEX_IMAGE' for n in m.node_tree.nodes):
            errs.append(f'material {m.name} uses an image texture')
    if any(p.area < 1e-9 for p in ob.data.polygons):
        errs.append('degenerate faces')
    return tris, lo, hi, rad, errs


def export(ob, key):
    MODELS.mkdir(parents=True, exist_ok=True)
    for o in bpy.context.scene.objects:
        o.select_set(o == ob)
    bpy.context.view_layer.objects.active = ob
    path = MODELS / f'{key}.glb'
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True, export_yup=True,
                              export_apply=True, export_materials='EXPORT', export_vertex_color='MATERIAL',
                              export_normals=True, export_cameras=False, export_lights=False,
                              export_extras=False)
    tris, lo, hi, _ = stats(ob)
    r6 = lambda v: round(v, 6)  # noqa: E731
    # Blender Z-up -> glTF Y-up: (x, y, z) -> (x, z, -y)
    return {'key': key, 'file': f'/models/{key}.glb', 'tris': tris,
            'bbox': {'min': [r6(lo.x), r6(lo.z), r6(-hi.y)], 'max': [r6(hi.x), r6(hi.z), r6(-lo.y)]}}


def write_manifest(entries):
    import fcntl
    MODELS.mkdir(parents=True, exist_ok=True)
    with open('/tmp/aeons_manifest_wonders.lock', 'w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        return _write_manifest(entries)


def _write_manifest(entries):
    old = []
    if MANIFEST.exists():
        try:
            old = json.loads(MANIFEST.read_text())
        except json.JSONDecodeError:
            old = []
    merged = {e['key']: e for e in old}
    for e in entries:
        merged[e['key']] = e
    order = lambda k: (0 if k.startswith('w_') else 1, k)  # noqa: E731
    out = [merged[k] for k in sorted(merged, key=order)]
    MANIFEST.write_text(json.dumps(out, indent=2) + '\n')
    return out


# ---------------------------------------------------------------------------------------------- preview rendering

def _look_at(obj, target):
    d = Vector(target) - obj.location
    obj.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()


def setup_stage(label=None, elevation=30.0, azimuth=28.0, res=1024, tile=True, dist=3.55, target_z=.34,
                lens=50):
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE'
    sc.render.resolution_x = res
    sc.render.resolution_y = res
    sc.render.film_transparent = False
    sc.render.image_settings.file_format = 'PNG'
    sc.eevee.taa_render_samples = 48
    try:
        sc.eevee.use_raytracing = True
        sc.eevee.use_shadows = True
    except AttributeError:
        pass
    try:
        sc.view_settings.view_transform = 'Khronos PBR Neutral'
    except TypeError:
        sc.view_settings.view_transform = 'Standard'
    sc.view_settings.exposure = 0.0

    world = bpy.data.worlds.new('stage')
    sc.world = world
    world.use_nodes = True
    nt = world.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputWorld')
    amb = nt.nodes.new('ShaderNodeBackground')
    amb.inputs['Color'].default_value = (.62, .7, .86, 1)
    amb.inputs['Strength'].default_value = .9
    bg = nt.nodes.new('ShaderNodeBackground')
    bg.inputs['Color'].default_value = (*hex_rgb('#1b2436'), 1)
    bg.inputs['Strength'].default_value = 1.0
    lp = nt.nodes.new('ShaderNodeLightPath')
    mix = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(lp.outputs['Is Camera Ray'], mix.inputs['Fac'])
    nt.links.new(amb.outputs[0], mix.inputs[1])
    nt.links.new(bg.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs['Surface'])

    sun_d = bpy.data.lights.new('sun', 'SUN')
    sun_d.energy = 3.6
    sun_d.angle = math.radians(4)
    sun_d.color = (1.0, .93, .82)
    sun = bpy.data.objects.new('sun', sun_d)
    sc.collection.objects.link(sun)
    sun.rotation_euler = (math.radians(50), 0, math.radians(-38))

    rim_d = bpy.data.lights.new('rim', 'SUN')
    rim_d.energy = 1.2
    rim_d.color = (.7, .8, 1.0)
    rim = bpy.data.objects.new('rim', rim_d)
    sc.collection.objects.link(rim)
    rim.rotation_euler = (math.radians(-60), 0, math.radians(20))

    if tile:
        tb = bmesh.new()
        top = [tb.verts.new(p) for p in hex_points(1.0, 0.0)]
        bot = [tb.verts.new(p) for p in hex_points(1.0, -.14)]
        tb.faces.new(top)
        tb.faces.new(list(reversed(bot)))
        for i in range(6):
            j = (i + 1) % 6
            tb.faces.new((bot[i], bot[j], top[j], top[i]))
        me = bpy.data.meshes.new('tile')
        tb.to_mesh(me)
        tb.free()
        g = bpy.data.materials.new('tile_regolith')
        g.use_nodes = True
        g.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (*hex_rgb('#b5552b'), 1)
        g.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = .96
        d = bpy.data.materials.new('tile_basalt')
        d.use_nodes = True
        d.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (*hex_rgb('#6e3219'), 1)
        d.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = .96
        me.materials.append(g)
        me.materials.append(d)
        for p in me.polygons:
            p.material_index = 0 if p.normal.z > .5 else 1
        ob = bpy.data.objects.new('tile', me)
        sc.collection.objects.link(ob)

    cam_d = bpy.data.cameras.new('cam')
    cam_d.lens = lens
    cam = bpy.data.objects.new('cam', cam_d)
    sc.collection.objects.link(cam)
    el, az = math.radians(elevation), math.radians(azimuth)
    cam.location = (dist * math.cos(el) * math.sin(az), -dist * math.cos(el) * math.cos(az),
                    dist * math.sin(el) + target_z)
    _look_at(cam, (0, 0, target_z))
    sc.camera = cam

    if label:
        cu = bpy.data.curves.new('label', 'FONT')
        cu.body = label
        cu.align_x = 'CENTER'
        cu.size = .042
        lab = bpy.data.objects.new('label', cu)
        sc.collection.objects.link(lab)
        lab.parent = cam
        lab.location = (0, -.315, -1)
        lm = bpy.data.materials.new('label')
        lm.use_nodes = True
        p = lm.node_tree.nodes['Principled BSDF']
        p.inputs['Base Color'].default_value = (0, 0, 0, 1)
        p.inputs['Emission Color'].default_value = (*hex_rgb('#f3e3b3'), 1)
        p.inputs['Emission Strength'].default_value = 1.0
        cu.materials.append(lm)
    return cam


def render_to(path):
    sc = bpy.context.scene
    sc.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def contact_sheet(paths, out_path, columns=6):
    """Compose equally-sized PNG tiles into one sheet (numpy, no PIL)."""
    import numpy as np
    imgs = []
    for p in paths:
        im = bpy.data.images.load(str(p), check_existing=False)
        w, h = im.size
        arr = np.empty(w * h * 4, dtype=np.float32)
        im.pixels.foreach_get(arr)
        imgs.append(arr.reshape(h, w, 4))
        bpy.data.images.remove(im)
    if not imgs:
        return
    th, tw = imgs[0].shape[:2]
    rows = (len(imgs) + columns - 1) // columns
    sheet = np.zeros((rows * th, columns * tw, 4), dtype=np.float32)
    sheet[...] = imgs[0][-2, 1]  # match the rendered background (top-left pixel after view transform)
    for i, a in enumerate(imgs):
        r, c = divmod(i, columns)
        y0 = (rows - 1 - r) * th
        sheet[y0:y0 + th, c * tw:(c + 1) * tw] = a
    out = bpy.data.images.new('sheet', columns * tw, rows * th, alpha=False)
    out.pixels.foreach_set(sheet.ravel())
    out.filepath_raw = str(out_path)
    out.file_format = 'PNG'
    out.save()
