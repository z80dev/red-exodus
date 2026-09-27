"""Validate the exported city kit by re-importing every GLB.

  Blender -b --python art/blender/city_validate.py

Checks: every contract key exported and listed once in manifest.city.json; GLB re-imports as a
single triangulated mesh; no cameras / lights / images; materials are TEAM / TEAM_DARK / city_*
with roughness 0.7–0.9; tris within budget and equal to the manifest; manifest bbox matches the
re-imported geometry; origin on the ground; per-kind size envelopes from the asset contract.
Exits 1 on any failure.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402

import city_lib as L  # noqa: E402

LANDMARK_IDS = ["temple", "library", "market", "barracks", "harbor", "granary", "workshop", "university",
                "amphitheater", "bank", "factory", "observatory", "castle", "aqueduct", "cathedral",
                "powerplant", "stadium", "lighthouse"]

EXPECTED = ([f"city_center_{e}" for e in range(6)] + [f"house_{e}_{v}" for e in range(6) for v in "ab"] +
            [f"wall_seg_{i}" for i in range(3)] + [f"wall_tower_{i}" for i in range(3)] +
            ["bld_" + i for i in LANDMARK_IDS])

# kind: (min height, max height, max |x| or |z| half-extent)
ENVELOPE = {
    "center": (0.3, 0.55, 0.33),
    "house": (0.12, 0.25, 0.14),
    "wall_tower": (0.2, 0.45, 0.28),  # bastion salient reaches 0.26
    "landmark": (0.15, 0.55, 0.3),
}


def kind_of(key):
    for prefix, kind in (("city_center_", "center"), ("house_", "house"), ("wall_seg_", "wall_seg"),
                         ("wall_tower_", "wall_tower")):
        if key.startswith(prefix):
            return kind
    return "landmark"


def main():
    manifest = L.read_manifest()
    by_key = {}
    errors = []
    for e in manifest:
        if e["key"] in by_key:
            errors.append(f"manifest: duplicate key {e['key']}")
        by_key[e["key"]] = e
    for key in EXPECTED:
        if key not in by_key:
            errors.append(f"manifest: missing {key}")
    for key in by_key:
        if key not in EXPECTED:
            errors.append(f"manifest: unexpected key {key}")

    for key in EXPECTED:
        entry = by_key.get(key)
        path = os.path.join(L.MODELS_DIR, key + ".glb")
        if not os.path.exists(path):
            errors.append(f"{key}: GLB missing")
            continue
        if entry and entry["file"] != "/models/" + key + ".glb":
            errors.append(f"{key}: manifest file {entry['file']}")
        L.reset_scene()
        bpy.ops.import_scene.gltf(filepath=path)
        objs = list(bpy.data.objects)
        meshes = [o for o in objs if o.type == "MESH"]
        others = [o.type for o in objs if o.type not in ("MESH", "EMPTY")]
        if len(meshes) != 1:
            errors.append(f"{key}: expected 1 mesh, got {len(meshes)}")
            continue
        if others:
            errors.append(f"{key}: extra objects {others}")
        if len(bpy.data.images):
            errors.append(f"{key}: contains images")
        obj = meshes[0]
        bpy.context.view_layer.update()
        if any(len(p.vertices) != 3 for p in obj.data.polygons):
            errors.append(f"{key}: not triangulated")
        tris = L.tri_count(obj)
        kind = kind_of(key)
        if tris > L.BUDGETS[kind]:
            errors.append(f"{key}: {tris} tris > budget {L.BUDGETS[kind]}")
        has_team = False
        for slot in obj.material_slots:
            mat = slot.material
            name = mat.name if mat else "<none>"
            if name in ("TEAM", "TEAM_DARK"):
                has_team = True
            elif not name.startswith("city_"):
                errors.append(f"{key}: foreign material {name}")
            if mat and mat.node_tree:
                bsdf = next((n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
                if bsdf is not None:
                    r = bsdf.inputs["Roughness"].default_value
                    if not 0.69 <= r <= 0.91:
                        errors.append(f"{key}: {name} roughness {r:.2f}")
        if kind != "house" and not has_team:
            errors.append(f"{key}: no TEAM material")
        mn, mx = L.gltf_bbox(obj)
        if entry:
            if entry["tris"] != tris:
                errors.append(f"{key}: manifest tris {entry['tris']} != {tris}")
            for a, b in zip(entry["bbox"]["min"] + entry["bbox"]["max"], mn + mx):
                if abs(a - b) > 1e-3:
                    errors.append(f"{key}: manifest bbox {entry['bbox']} != {mn},{mx}")
                    break
        if abs(mn[1]) > 0.005:
            errors.append(f"{key}: not grounded (min y {mn[1]})")
        h = mx[1]
        if kind == "wall_seg":
            if mn[0] > -0.5 + 1e-3 or mx[0] < 0.5 - 1e-3 or mx[0] > 0.62 or mn[0] < -0.62:
                errors.append(f"{key}: segment span x {mn[0]}..{mx[0]}")
            if max(abs(mn[2]), abs(mx[2])) > 0.12:
                errors.append(f"{key}: segment too thick {mn[2]}..{mx[2]}")
        else:
            lo, hi, half = ENVELOPE[kind]
            if not lo <= h <= hi:
                errors.append(f"{key}: height {h} outside [{lo}, {hi}]")
            ext = max(abs(mn[0]), abs(mx[0]), abs(mn[2]), abs(mx[2]))
            if ext > half:
                errors.append(f"{key}: footprint half-extent {ext:.3f} > {half}")
        print(f"[validate] {key:22s} tris={tris:5d} h={h:.3f} mats={len(obj.material_slots)}")

    if errors:
        print("[validate] FAIL")
        for e in errors:
            print("  -", e)
        sys.exit(1)
    print(f"[validate] OK — {len(EXPECTED)} models")


main()
