"""Build + export the AEONS city kit.

  Blender -b --python art/blender/city_build.py [-- --only key_prefix[,key_prefix...]]

Writes public/models/<key>.glb for every model and (re)writes public/models/manifest.city.json
(partial --only runs merge into the existing manifest). Run city_validate.py afterwards.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402

import city_lib as L  # noqa: E402
from city_centers import CENTERS  # noqa: E402
from city_houses import HOUSES  # noqa: E402
from city_landmarks import LANDMARKS  # noqa: E402
from city_walls import WALLS  # noqa: E402


def kind_of(key):
    if key.startswith("city_center_"):
        return "center"
    if key.startswith("house_"):
        return "house"
    if key.startswith("wall_seg_"):
        return "wall_seg"
    if key.startswith("wall_tower_"):
        return "wall_tower"
    return "landmark"


def all_models():
    reg = {}
    for group in (CENTERS, HOUSES, WALLS, LANDMARKS):
        reg.update(group)
    return reg


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    only = None
    if "--only" in argv:
        only = argv[argv.index("--only") + 1].split(",")
    os.makedirs(L.MODELS_DIR, exist_ok=True)
    L.reset_scene()
    reg = all_models()
    entries = {e["key"]: e for e in L.read_manifest()} if only else {}
    failures = []
    for key, fn in reg.items():
        if only and not any(key.startswith(p) for p in only):
            continue
        kind = kind_of(key)
        m = L.Model(key, kind)
        fn(m)
        obj = m.finish()
        L.export_glb(obj, os.path.join(L.MODELS_DIR, key + ".glb"))
        tris = L.tri_count(obj)
        mn, mx = L.gltf_bbox(obj)
        entries[key] = {"key": key, "file": "/models/" + key + ".glb", "tris": tris, "bbox": {"min": mn, "max": mx}}
        budget = L.BUDGETS[kind]
        flag = "" if tris <= budget else f"  !! OVER BUDGET ({budget})"
        if flag:
            failures.append(key)
        size = [round(mx[i] - mn[i], 3) for i in range(3)]
        print(f"[city] {key:22s} tris={tris:5d} size(x,y,z)={size} mats={len(m.mats)}{flag}")
        me = obj.data
        bpy.data.objects.remove(obj)
        bpy.data.meshes.remove(me)
    L.write_manifest(list(entries.values()))
    print(f"[city] exported {len(entries)} entries → {L.MANIFEST_PATH}")
    if failures:
        print("[city] OVER BUDGET:", failures)
        sys.exit(1)


main()
