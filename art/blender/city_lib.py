"""AEONS city kit — shared modelling / export library (Blender 5.2, run headless).

Everything is authored procedurally with bmesh so the whole kit is reproducible:
  Model      accumulates bevelled, flat-shaded parts into one mesh with named materials.
  export()   writes one GLB per model (Y-up, transforms applied, triangulated, no cams/lights).
  manifest   public/models/manifest.city.json  [{key, file, tris, bbox:{min,max}}]  (glTF Y-up coords)

Conventions (docs/ARCHITECTURE.md §3D asset contract): Blender Z-up, fronts face Blender -Y
(glTF +Z), origin = ground centre of the footprint, hex circumradius 1.0.
"""

import json
import math
import os
from contextlib import contextmanager

import bmesh
import bpy
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
MODELS_DIR = os.path.join(ROOT, "public", "models")
PREVIEW_DIR = os.path.join(ROOT, "art", "previews")
MANIFEST_PATH = os.path.join(MODELS_DIR, "manifest.city.json")

# ---------------------------------------------------------------------------------------------
# Palette — anchored on the ARCHITECTURE palette, extended for the city kit. Materials are
# prefixed `city_` so they never collide with other kits; TEAM / TEAM_DARK are exact contract names.
# name: (hex, roughness, emissive_strength)
# ---------------------------------------------------------------------------------------------
PALETTE = {
    "TEAM": ("#3d7be0", 0.75, 0.0),
    "TEAM_DARK": ("#244a94", 0.8, 0.0),
    "mudbrick": ("#d3a46c", 0.9, 0.0),
    "mudbrick_dark": ("#ad7a4b", 0.9, 0.0),
    "sandstone": ("#e8d3a0", 0.85, 0.0),
    "stone": ("#c9bfae", 0.85, 0.0),
    "stone_dark": ("#9d9384", 0.85, 0.0),
    "stone_deep": ("#7a7168", 0.9, 0.0),
    "marble": ("#f1ece1", 0.75, 0.0),
    "plaster": ("#f0e3c8", 0.85, 0.0),
    "plaster_ochre": ("#e6b977", 0.85, 0.0),
    "plaster_rose": ("#e3a38a", 0.85, 0.0),
    "timber": ("#7a5534", 0.85, 0.0),
    "timber_dark": ("#4f3522", 0.9, 0.0),
    "thatch": ("#d6ac5c", 0.9, 0.0),
    "thatch_dark": ("#a9823f", 0.9, 0.0),
    "roof_terracotta": ("#b5523b", 0.8, 0.0),
    "roof_terracotta_dark": ("#8f3d2c", 0.8, 0.0),
    "roof_slate": ("#57616f", 0.8, 0.0),
    "roof_copper": ("#5fa892", 0.75, 0.0),
    "brick": ("#ad5a40", 0.9, 0.0),
    "brick_dark": ("#7b3d2d", 0.9, 0.0),
    "iron": ("#454a53", 0.7, 0.0),
    "gold": ("#e0b84a", 0.7, 0.0),
    "bronze": ("#b27a3e", 0.7, 0.0),
    "concrete": ("#b8bcc2", 0.85, 0.0),
    "concrete_light": ("#dde0e4", 0.85, 0.0),
    "concrete_dark": ("#878d95", 0.85, 0.0),
    "asphalt": ("#4b4f56", 0.9, 0.0),
    "glass": ("#6fa8c9", 0.7, 0.0),
    "glass_dark": ("#3f6f91", 0.7, 0.0),
    "window": ("#2e3947", 0.8, 0.0),
    "foliage": ("#5b8c3a", 0.9, 0.0),
    "foliage_light": ("#86b04a", 0.9, 0.0),
    "foliage_dark": ("#3f6e2a", 0.9, 0.0),
    "grass": ("#7fae45", 0.9, 0.0),
    "earth": ("#9a7650", 0.9, 0.0),
    "water": ("#4f9cc4", 0.7, 0.0),
    "cloth_red": ("#c9463d", 0.85, 0.0),
    "cloth_yellow": ("#ebc55e", 0.85, 0.0),
    "cloth_white": ("#f3eee2", 0.85, 0.0),
    "cloth_green": ("#5c9b57", 0.85, 0.0),
    "rock": ("#8a8177", 0.9, 0.0),
    "fire": ("#ffac3d", 0.8, 3.0),
    "lamp": ("#ffe9a8", 0.7, 2.5),
    "clock": ("#f4efe2", 0.75, 0.0),
    "hab_white": ("#e7e3dc", 0.82, 0.0),
    "solar": ("#1d2a44", 0.82, 0.0),
    "regolith": ("#b5552b", 0.9, 0.0),
    "regolith_dark": ("#6e3219", 0.9, 0.0),
    "hazard": ("#f28c28", 0.78, 0.0),
    "cryo": ("#5fd4e8", 0.72, 0.25),
    "lichen": ("#8a9a3b", 0.88, 0.0),
    "white": ("#f5f5f2", 0.8, 0.0),
    "red": ("#c8392f", 0.8, 0.0),
}


def mat_name(key):
    return key if key in ("TEAM", "TEAM_DARK") else "city_" + key


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4))


def get_material(key):
    name = mat_name(key)
    mat = bpy.data.materials.get(name)
    if mat is not None:
        return mat
    hexcol, rough, emis = PALETTE[key]
    lin = tuple(srgb_to_linear(c) for c in hex_rgb(hexcol))
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*lin, 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = 0.0
    if emis > 0:
        bsdf.inputs["Emission Color"].default_value = (*lin, 1.0)
        bsdf.inputs["Emission Strength"].default_value = emis
    mat.diffuse_color = (*lin, 1.0)
    return mat


# ---------------------------------------------------------------------------------------------
# bmesh part builders (all return a fresh closed bmesh in local space)
# ---------------------------------------------------------------------------------------------

def _bm_box(w, d, h, top=(1.0, 1.0), top_off=(0.0, 0.0)):
    bm = bmesh.new()
    x, y = w / 2, d / 2
    tx, ty = x * top[0], y * top[1]
    ox, oy = top_off
    bot = [bm.verts.new(p) for p in ((-x, -y, 0), (x, -y, 0), (x, y, 0), (-x, y, 0))]
    tp = [bm.verts.new(p) for p in ((-tx + ox, -ty + oy, h), (tx + ox, -ty + oy, h), (tx + ox, ty + oy, h), (-tx + ox, ty + oy, h))]
    bm.faces.new(list(reversed(bot)))
    bm.faces.new(tp)
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new((bot[i], bot[j], tp[j], tp[i]))
    return bm


def _bm_lathe(profile, seg, phase=0.0, cap_bottom=True, cap_top=True, sx=1.0, sy=1.0):
    """Revolve [(r, z), ...] (bottom → top) around Z. r == 0 collapses to an apex."""
    bm = bmesh.new()
    angs = [phase + 2 * math.pi * k / seg for k in range(seg)]
    rings = []
    for r, z in profile:
        if r <= 1e-7:
            rings.append([bm.verts.new((0.0, 0.0, z))])
        else:
            rings.append([bm.verts.new((r * math.cos(a) * sx, r * math.sin(a) * sy, z)) for a in angs])
    for i in range(len(rings) - 1):
        A, B = rings[i], rings[i + 1]
        if len(A) == 1 and len(B) == 1:
            continue
        for k in range(seg):
            k2 = (k + 1) % seg
            if len(A) == 1:
                bm.faces.new((A[0], B[k2], B[k]))
            elif len(B) == 1:
                bm.faces.new((A[k], A[k2], B[0]))
            else:
                bm.faces.new((A[k], A[k2], B[k2], B[k]))
    if cap_bottom and len(rings[0]) > 1:
        bm.faces.new(list(reversed(rings[0])))
    if cap_top and len(rings[-1]) > 1:
        bm.faces.new(rings[-1])
    return bm


def _bm_prism(points, depth, plane="XZ", top_scale=1.0):
    """Extrude a simple 2D polygon (may be concave). XZ: extrude along Y (centred);
    YZ: along X (centred); XY: along +Z from 0 (top face scaled by `top_scale` → battered walls)."""
    bm = bmesh.new()

    def P(a, b, t):
        if plane == "XZ":
            return (a, t, b)
        if plane == "YZ":
            return (t, a, b)
        return (a, b, t)

    if plane == "XY":
        t0, t1 = 0.0, depth
    else:
        t0, t1 = -depth / 2, depth / 2
    f = [bm.verts.new(P(a, b, t0)) for a, b in points]
    ts = top_scale if plane == "XY" else 1.0
    g = [bm.verts.new(P(a * ts, b * ts, t1)) for a, b in points]
    n = len(points)
    bm.faces.new(f)
    bm.faces.new(list(reversed(g)))
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((f[i], f[j], g[j], g[i]))
    return bm


def _bm_sweep(profile, path, closed):
    """Sweep a closed cross-section [(u, z)] along a 2D path [(x, y)] in the XY plane.
    u is the offset along the path's left-hand normal (outward for a CCW loop is -left, so
    pass negative u for 'outward' when the loop is CCW — callers use `outward` helper)."""
    bm = bmesh.new()
    n = len(path)
    rings = []
    for i in range(n):
        if closed:
            p0, p1 = path[(i - 1) % n], path[(i + 1) % n]
        else:
            p0, p1 = path[max(i - 1, 0)], path[min(i + 1, n - 1)]
        tx, ty = p1[0] - p0[0], p1[1] - p0[1]
        L = math.hypot(tx, ty) or 1.0
        nx, ny = ty / L, -tx / L  # right-hand normal (outward for CCW loops)
        px, py = path[i]
        rings.append([bm.verts.new((px + nx * u, py + ny * u, z)) for u, z in profile])
    m = len(profile)
    segs = n if closed else n - 1
    for i in range(segs):
        A, B = rings[i], rings[(i + 1) % n]
        for k in range(m):
            k2 = (k + 1) % m
            bm.faces.new((A[k], A[k2], B[k2], B[k]))
    if not closed:
        bm.faces.new(rings[0])
        bm.faces.new(list(reversed(rings[-1])))
    return bm


def _bevel(bm, offset, angle_deg=40.0):
    if offset <= 0:
        return
    lim = math.radians(angle_deg)
    edges = [e for e in bm.edges if len(e.link_faces) == 2 and e.calc_face_angle(0.0) > lim]
    if edges:
        bmesh.ops.bevel(bm, geom=edges, offset=offset, offset_type="OFFSET", segments=1,
                        profile=0.5, affect="EDGES", clamp_overlap=True)


def _matrix(at=(0, 0, 0), rz=0.0, rx=0.0, ry=0.0, s=None):
    M = Matrix.Translation(Vector(at))
    if rz:
        M = M @ Matrix.Rotation(math.radians(rz), 4, "Z")
    if ry:
        M = M @ Matrix.Rotation(math.radians(ry), 4, "Y")
    if rx:
        M = M @ Matrix.Rotation(math.radians(rx), 4, "X")
    if s is not None:
        if isinstance(s, (int, float)):
            s = (s, s, s)
        M = M @ Matrix.Diagonal((s[0], s[1], s[2], 1.0))
    return M


# ---------------------------------------------------------------------------------------------
# Model
# ---------------------------------------------------------------------------------------------

class Model:
    """Accumulates parts. Every primitive takes `at` (bottom-centre anchor), optional
    rotations in degrees and a material key, and is transformed by the current `xf` stack."""

    def __init__(self, key, kind):
        self.key = key
        self.kind = kind
        self.bm = bmesh.new()
        self.mats = []
        self.stack = [Matrix.Identity(4)]

    # -- plumbing ------------------------------------------------------------------------------
    def _mi(self, mat):
        if mat not in PALETTE:
            raise KeyError(f"{self.key}: unknown material {mat}")
        if mat not in self.mats:
            self.mats.append(mat)
        return self.mats.index(mat)

    @contextmanager
    def xf(self, at=(0, 0, 0), rz=0.0, rx=0.0, ry=0.0, s=None):
        self.stack.append(self.stack[-1] @ _matrix(at, rz, rx, ry, s))
        try:
            yield self
        finally:
            self.stack.pop()

    def _add(self, part, mat, M, bevel=0.0, bevel_angle=40.0, closed=True):
        _bevel(part, bevel, bevel_angle)
        full = self.stack[-1] @ M
        bmesh.ops.transform(part, matrix=full, verts=part.verts)
        if closed:
            bmesh.ops.recalc_face_normals(part, faces=part.faces)
        elif full.to_3x3().determinant() < 0:
            bmesh.ops.reverse_faces(part, faces=part.faces)
        mi = self._mi(mat)
        part.verts.index_update()
        vmap = [self.bm.verts.new(v.co) for v in part.verts]
        for f in part.faces:
            nf = self.bm.faces.new([vmap[v.index] for v in f.verts])
            nf.material_index = mi
            nf.smooth = False
        part.free()

    # -- primitives ----------------------------------------------------------------------------
    def box(self, w, d, h, at=(0, 0, 0), mat="stone", bevel=0.0, rz=0.0, rx=0.0, ry=0.0,
            top=(1.0, 1.0), top_off=(0.0, 0.0)):
        """Axis box (optionally tapered via `top` scale) standing on `at`."""
        b = min(bevel, w * 0.3, d * 0.3, h * 0.3) if bevel else 0.0
        self._add(_bm_box(w, d, h, top, top_off), mat, _matrix(at, rz, rx, ry), b)

    def cyl(self, r, h, at=(0, 0, 0), mat="stone", seg=8, r2=None, bevel=0.0, phase=None,
            rz=0.0, rx=0.0, ry=0.0, sx=1.0, sy=1.0, cap_top=True, cap_bottom=True):
        """Cylinder / frustum / cone (r2 == 0) standing on `at`."""
        r2 = r if r2 is None else r2
        ph = (math.pi / seg) if phase is None else phase
        prof = [(r, 0.0), (r2, h)]
        part = _bm_lathe(prof, seg, ph, cap_bottom, cap_top, sx, sy)
        b = min(bevel, r * 0.3, h * 0.3) if bevel else 0.0
        closed = cap_top or r2 <= 1e-7
        self._add(part, mat, _matrix(at, rz, rx, ry), b, 50.0, closed and cap_bottom)

    def lathe(self, profile, at=(0, 0, 0), mat="stone", seg=8, phase=None, rz=0.0, rx=0.0,
              ry=0.0, sx=1.0, sy=1.0, cap_bottom=True, cap_top=True, bevel=0.0):
        ph = (math.pi / seg) if phase is None else phase
        part = _bm_lathe(profile, seg, ph, cap_bottom, cap_top, sx, sy)
        closed = (cap_bottom or profile[0][0] <= 1e-7) and (cap_top or profile[-1][0] <= 1e-7)
        self._add(part, mat, _matrix(at, rz, rx, ry), bevel, 50.0, closed)

    def dome(self, r, h=None, at=(0, 0, 0), mat="roof_copper", seg=10, rings=3, base=0.0,
             rz=0.0, sx=1.0, sy=1.0, cap_bottom=True, phase=None):
        """Hemispherical (or squashed via h) dome; optional vertical `base` band."""
        h = r if h is None else h
        prof = [(r, 0.0)]
        if base:
            prof.append((r, base))
        for i in range(1, rings + 1):
            a = (math.pi / 2) * i / (rings + 1)
            prof.append((r * math.cos(a), base + h * math.sin(a)))
        prof.append((0.0, base + h))
        self.lathe(prof, at, mat, seg, phase, rz, sx=sx, sy=sy, cap_bottom=cap_bottom)

    def prism(self, points, depth, at=(0, 0, 0), mat="stone", plane="XZ", bevel=0.0, rz=0.0,
              rx=0.0, ry=0.0, bevel_angle=40.0, top_scale=1.0):
        self._add(_bm_prism(points, depth, plane, top_scale), mat, _matrix(at, rz, rx, ry), bevel,
                  bevel_angle)

    def sweep(self, profile, path, closed=True, at=(0, 0, 0), mat="stone", rz=0.0):
        self._add(_bm_sweep(profile, path, closed), mat, _matrix(at, rz))

    def gable(self, w, d, h, at=(0, 0, 0), mat="roof_terracotta", over=0.015, eave=0.012,
              rz=0.0, bevel=0.004, ridge_off=0.0):
        """Gable roof, ridge along X; footprint w×d (walls), eaves overhang `over`."""
        D = d / 2 + over
        pts = [(-D, 0.0), (D, 0.0), (D, eave), (ridge_off, h), (-D, eave)]
        self._add(_bm_prism(pts, w + 2 * over, "YZ"), mat, _matrix(at, rz), bevel)

    def hip(self, w, d, h, at=(0, 0, 0), mat="roof_terracotta", over=0.015, eave=0.012,
            ridge=None, rz=0.0, bevel=0.003):
        """Hip roof (ridge along X, length `ridge`, default w-d); ridge=0 → pyramid."""
        W, Dd = w / 2 + over, d / 2 + over
        rl = max(0.0, (w - d)) if ridge is None else ridge
        bm = bmesh.new()
        b = [bm.verts.new(p) for p in ((-W, -Dd, 0), (W, -Dd, 0), (W, Dd, 0), (-W, Dd, 0))]
        e = [bm.verts.new(p) for p in ((-W, -Dd, eave), (W, -Dd, eave), (W, Dd, eave), (-W, Dd, eave))]
        bm.faces.new(list(reversed(b)))
        for i in range(4):
            j = (i + 1) % 4
            bm.faces.new((b[i], b[j], e[j], e[i]))
        if rl <= 1e-6:
            apex = bm.verts.new((0, 0, h))
            for i in range(4):
                bm.faces.new((e[i], e[(i + 1) % 4], apex))
        else:
            r0 = bm.verts.new((-rl / 2, 0, h))
            r1 = bm.verts.new((rl / 2, 0, h))
            bm.faces.new((e[0], e[1], r1, r0))
            bm.faces.new((e[1], e[2], r1))
            bm.faces.new((e[2], e[3], r0, r1))
            bm.faces.new((e[3], e[0], r0))
        self._add(bm, mat, _matrix(at, rz), bevel)

    def cone(self, r, h, at=(0, 0, 0), mat="roof_slate", seg=8, rz=0.0, phase=None, eave=0.0):
        prof = [(r, 0.0)]
        if eave:
            prof.append((r, eave))
        prof.append((0.0, h))
        self.lathe(prof, at, mat, seg, phase, rz)

    # -- composite helpers ---------------------------------------------------------------------
    def column(self, r, h, at=(0, 0, 0), mat="marble", seg=6, cap_mat=None):
        x, y, z = at
        cm = cap_mat or mat
        self.box(r * 2.6, r * 2.6, r * 0.9, (x, y, z), cm)
        self.cyl(r, h - r * 1.8, (x, y, z + r * 0.9), mat, seg=seg)
        self.box(r * 2.8, r * 2.8, r * 0.9, (x, y, z + h - r * 0.9), cm)

    def flag(self, w, h, at=(0, 0, 0), mat="TEAM", pole_h=None, pole_mat="timber_dark", rz=0.0,
             swallow=True, pole_r=0.006, finial="gold"):
        """Pole + pennant. Cloth extends along +X (local) from the pole top."""
        ph = pole_h if pole_h is not None else h * 2.4
        with self.xf(at, rz):
            self.cyl(pole_r, ph, (0, 0, 0), pole_mat, seg=5)
            if finial:
                self.cyl(pole_r * 1.9, pole_r * 3.2, (0, 0, ph), finial, seg=5, r2=0.0)
            top = ph - pole_r
            notch = w * 0.28 if swallow else 0.0
            pts = [(0.0, top - h), (w, top - h - h * 0.08), (w - notch, top - h * 0.5 - h * 0.04), (w, top), (0.0, top)]
            if not swallow:
                pts = [(0.0, top - h), (w, top - h * 0.55), (0.0, top)]
            self.prism(pts, 0.006, (pole_r, 0, 0), mat)

    def banner(self, w, h, at=(0, 0, 0), mat="TEAM", rz=0.0, trim="gold", tail=True):
        """Hanging wall banner (hangs down from `at`, facing -Y), with a gold rod."""
        with self.xf(at, rz):
            v = h * 0.22 if tail else 0.0
            pts = [(-w / 2, 0.0), (w / 2, 0.0), (w / 2, -h), (0.0, -h + v), (-w / 2, -h)]
            self.prism(pts, 0.006, (0, 0, 0), mat)
            if trim:
                self.cyl(0.004, w * 1.25, (-w * 0.625, 0, 0.002), trim, seg=4, ry=90)

    def merlons_line(self, x0, x1, y, z, n, mw, md, mh, mat="stone", rz=0.0):
        with self.xf((0, 0, 0), rz):
            for i in range(n):
                t = (i + 0.5) / n
                self.box(mw, md, mh, (x0 + (x1 - x0) * t, y, z), mat, bevel=0.002)

    def merlons_ring(self, r, z, n, mw, md, mh, mat="stone", at=(0, 0, 0), phase=0.0):
        x, y, _ = at
        for i in range(n):
            a = phase + 2 * math.pi * i / n
            self.box(mw, md, mh, (x + r * math.cos(a), y + r * math.sin(a), z), mat,
                     rz=math.degrees(a) + 90, bevel=0.002)

    def windows_row(self, x0, x1, y, z, n, w, h, mat="window", depth=0.006, rz=0.0, arch=False):
        """Row of window insets on a wall facing -Y at plane y (protrude slightly)."""
        with self.xf((0, 0, 0), rz):
            for i in range(n):
                t = (i + 0.5) / n
                cx = x0 + (x1 - x0) * t
                if arch:
                    self.arch_panel(w, h, (cx, y, z), mat, depth)
                else:
                    self.box(w, depth, h, (cx, y, z), mat)

    def arch_panel(self, w, h, at, mat="window", depth=0.006, seg=4):
        x, y, z = at
        rr = w / 2
        # bottom-left, bottom-right, right spring, arc over the top, left spring
        pts = [(-rr, 0.0), (rr, 0.0), (rr, h - rr)]
        for i in range(1, seg):
            a = math.pi * i / seg
            pts.append((rr * math.cos(a), h - rr + rr * math.sin(a)))
        pts.append((-rr, h - rr))
        self.prism(pts, depth, (x, y, z), mat)

    def arcade(self, length, h, depth, n, at=(0, 0, 0), mat="stone", pier=0.25, seg=4, rz=0.0,
               spring=0.55):
        """A wall of `n` round arches (open), built from solid spandrels + piers. Along X."""
        bay = length / n
        pw = bay * pier
        rr = (bay - pw) / 2
        sp = h * spring
        with self.xf(at, rz):
            for i in range(n + 1):
                cx = -length / 2 + i * bay
                w = pw if 0 < i < n else pw / 2
                ox = cx + (w / 2 if i == 0 else (-w / 2 if i == n else 0))
                self.box(w, depth, sp, (ox, 0, 0), mat)
            for i in range(n):
                cx = -length / 2 + (i + 0.5) * bay
                pts = [(cx - bay / 2, h), (cx - bay / 2, sp), (cx - rr, sp)]
                for k in range(1, seg):
                    a = math.pi - math.pi * k / seg
                    pts.append((cx + rr * math.cos(a), sp + rr * math.sin(a)))
                pts += [(cx + rr, sp), (cx + bay / 2, sp), (cx + bay / 2, h)]
                self.prism(list(reversed(pts)), depth, (0, 0, 0), mat)

    def miter_ends(self, half=0.5, k=math.tan(math.radians(30))):
        """Shear the end caps of full-length wall bodies (|x| == half) onto the hex's radial
        miter planes (x_end = ±(half - k·y), inside = +Y) so 120° corners close seamlessly."""
        zone = 0.03  # bevel rings near the cap follow the shear proportionally
        for v in self.bm.verts:
            ax = abs(v.co.x)
            if ax > half - zone:
                t = min(1.0, (ax - (half - zone)) / zone)
                v.co.x = math.copysign(ax - k * v.co.y * t, v.co.x)

    # -- finish --------------------------------------------------------------------------------
    def finish(self):
        bmesh.ops.triangulate(self.bm, faces=self.bm.faces[:], quad_method="BEAUTY", ngon_method="BEAUTY")
        me = bpy.data.meshes.new(self.key)
        self.bm.to_mesh(me)
        self.bm.free()
        for p in me.polygons:
            p.use_smooth = False
        for m in self.mats:
            me.materials.append(get_material(m))
        obj = bpy.data.objects.new(self.key, me)
        return obj


# ---------------------------------------------------------------------------------------------
# Scene / export / manifest / validation
# ---------------------------------------------------------------------------------------------

BUDGETS = {"center": 1500, "house": 400, "wall_seg": 600, "wall_tower": 800, "landmark": 1500}


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def gltf_bbox(obj):
    """Bounding box in glTF coordinates (Y-up, +Z front): (x, z, -y)."""
    vs = [obj.matrix_world @ v.co for v in obj.data.vertices]
    g = [(v.x, v.z, -v.y) for v in vs]
    mn = [min(p[i] for p in g) for i in range(3)]
    mx = [max(p[i] for p in g) for i in range(3)]
    return [round(c, 4) for c in mn], [round(c, 4) for c in mx]


def tri_count(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


def export_glb(obj, path):
    scene = bpy.context.scene
    if obj.name not in scene.collection.objects:
        scene.collection.objects.link(obj)
    for o in scene.objects:
        o.select_set(False)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=True,
        export_texcoords=False,
        export_normals=True,
        export_tangents=False,
        export_materials="EXPORT",
        export_vertex_color="NONE",
        export_attributes=False,
        export_cameras=False,
        export_lights=False,
        export_extras=False,
        export_animations=False,
        export_skins=False,
        export_morph=False,
    )


def write_manifest(entries):
    entries = sorted(entries, key=lambda e: e["key"])
    with open(MANIFEST_PATH, "w") as f:
        json.dump(entries, f, indent=1)
        f.write("\n")


def read_manifest():
    if not os.path.exists(MANIFEST_PATH):
        return []
    with open(MANIFEST_PATH) as f:
        return json.load(f)


# ---------------------------------------------------------------------------------------------
# Decor helpers shared by the kit (all anchored at ground, front -Y)
# ---------------------------------------------------------------------------------------------

def palm(m, at, h=0.16, lean=10.0, rz=0.0, fronds=6):
    """Leaning palm: segmented trunk + drooping fronds + coconut cluster."""
    with m.xf(at, rz):
        with m.xf((0, 0, 0), ry=lean):
            m.cyl(0.011, h * 0.5, (0, 0, 0), "timber", seg=5, r2=0.009)
            m.cyl(0.0095, h * 0.5, (0, 0, h * 0.48), "timber", seg=5, r2=0.007)
            for i in range(fronds):
                a = 360.0 * i / fronds + 15
                with m.xf((0, 0, h), rz=a):
                    m.prism([(0.0, 0.0), (0.035, -0.013), (0.075, -0.004), (0.085, 0.0),
                             (0.075, 0.004), (0.035, 0.013)], 0.004, (0, 0, 0),
                            "foliage" if i % 2 else "foliage_light", plane="XY", ry=24)
            m.cyl(0.011, 0.012, (0, 0, h - 0.012), "timber_dark", seg=5)


def round_tree(m, at, r=0.045, h=0.1, mat="foliage", trunk=0.03):
    x, y, z = at
    m.cyl(r * 0.18, trunk + r * 0.3, (x, y, z), "timber", seg=5)
    m.lathe([(r * 0.55, 0.0), (r, r * 0.45), (r * 0.92, r * 1.05), (r * 0.5, r * 1.45), (0.0, r * 1.6)],
            (x, y, z + trunk), mat, seg=7)


def cypress(m, at, h=0.14, r=0.022):
    x, y, z = at
    m.cyl(r * 0.25, h * 0.15, (x, y, z), "timber", seg=4)
    m.lathe([(r * 0.8, 0.0), (r, h * 0.25), (r * 0.7, h * 0.7), (0.0, h)], (x, y, z + h * 0.1),
            "foliage_dark", seg=6)


def bush(m, at, r=0.03, mat="foliage"):
    x, y, z = at
    m.lathe([(r * 0.8, 0.0), (r, r * 0.4), (r * 0.7, r * 0.9), (0.0, r * 1.05)], (x, y, z), mat, seg=6)


def brazier(m, at, h=0.05):
    x, y, z = at
    m.cyl(0.005, h, (x, y, z), "iron", seg=4)
    m.lathe([(0.004, 0.0), (0.016, 0.006), (0.019, 0.014), (0.0, 0.014)], (x, y, z + h), "bronze", seg=6)
    m.lathe([(0.014, 0.0), (0.008, 0.016), (0.0, 0.03)], (x, y, z + h + 0.01), "fire", seg=5)


def statue(m, at, h=0.12, mat="gold", pedestal="marble", rz=0.0, raised=True):
    """Pedestal + heroic figure with a raised arm (reads as 'monument' at any size)."""
    with m.xf(at, rz):
        ph = h * 0.4
        m.box(h * 0.36, h * 0.36, ph * 0.18, (0, 0, 0), pedestal, bevel=0.003)
        m.box(h * 0.27, h * 0.27, ph * 0.82, (0, 0, ph * 0.18), pedestal, bevel=0.003)
        fh = h - ph
        m.cyl(fh * 0.16, fh * 0.62, (0, 0, ph), mat, seg=6, r2=fh * 0.11)
        m.lathe([(0.0, 0.0), (fh * 0.09, fh * 0.03), (fh * 0.1, fh * 0.1), (fh * 0.06, fh * 0.17),
                 (0.0, fh * 0.19)], (0, 0, ph + fh * 0.62), mat, seg=6)
        if raised:
            m.cyl(fh * 0.035, fh * 0.42, (fh * 0.12, 0, ph + fh * 0.5), mat, seg=4, ry=25)
            m.cyl(fh * 0.035, fh * 0.35, (-fh * 0.1, 0, ph + fh * 0.2), mat, seg=4, ry=-12)


def crate(m, at, s=0.03, rz=0.0, mat="timber"):
    m.box(s, s, s, at, mat, bevel=s * 0.12, rz=rz)


def barrel(m, at, r=0.013, h=0.03):
    m.lathe([(r * 0.85, 0.0), (r, h * 0.5), (r * 0.85, h)], at, "timber", seg=6)


def pole_lamp(m, at, h=0.08):
    x, y, z = at
    m.cyl(0.003, h, (x, y, z), "iron", seg=4)
    m.box(0.01, 0.01, 0.012, (x, y, z + h), "lamp")


def stairs(m, x, y0, y1, z0, z1, width, steps, mat, rail_mat=None):
    """Straight stair climbing from (y0, z0) to (y1, z1) (y0 < y1 means climbing toward +Y)."""
    pts = [(y0, z0)]
    for i in range(steps):
        ya = y0 + (y1 - y0) * i / steps
        yb = y0 + (y1 - y0) * (i + 1) / steps
        zt = z0 + (z1 - z0) * (i + 1) / steps
        pts += [(ya, zt), (yb, zt)]
    pts += [(y1, z0)]
    m.prism(pts, width, (x, 0, 0), mat, plane="YZ")
    if rail_mat:
        rail = [(y0 - 0.004, z0), (y0 - 0.004, z0 + 0.014), (y1, z1 + 0.014), (y1, z0)]
        for s in (-1, 1):
            m.prism(rail, 0.012, (x + s * (width / 2 + 0.006), 0, 0), rail_mat, plane="YZ")


def lancet(m, w, h, at, mat="window", depth=0.006):
    """Pointed (gothic) window/portal panel standing on `at`, facing -Y."""
    r = w / 2
    sp = h - w * 0.9
    pts = [(-r, 0.0), (r, 0.0), (r, sp), (r * 0.72, sp + w * 0.5), (0.0, h), (-r * 0.72, sp + w * 0.5), (-r, sp)]
    m.prism(pts, depth, at, mat)
