"""Build AEONS wonder models: export GLBs, merge manifest, render previews.

/Applications/Blender.app/Contents/MacOS/Blender -b --python art/blender/wonders_build.py -- [options]
  --only w_pyramids,nw_sky_arch   build a subset (default: all 24)
  --no-render                     skip hero + contact-sheet tile renders
  --sheet                         (re)compose art/previews/wonders_contact_sheet.png from cached tiles
  --fast                          low-sample renders for quick iteration

Outputs: public/models/<key>.glb, public/models/manifest.wonders.json,
         art/previews/wonders_<key>.png (hero, low 3/4 angle), art/previews/wonders_contact_sheet.png
         (game camera angle; tiles cached in /tmp/aeons_wonder_tiles).
"""
import sys
import time
from pathlib import Path

import bpy

sys.dont_write_bytecode = True  # keep art/blender free of __pycache__
sys.path.insert(0, str(Path(__file__).resolve().parent))

import wonders_lib as L  # noqa: E402

GROUPS = {
    'wonders_ancient': ['w_pyramids', 'w_stonehenge', 'w_hanging_gardens', 'w_colossus', 'w_great_library',
                        'w_oracle'],
    'wonders_medieval': ['w_great_wall', 'w_hagia_sophia', 'w_angkor_wat', 'w_taj_mahal', 'w_leaning_tower',
                         'w_himeji'],
    'wonders_modern': ['w_big_ben', 'w_eiffel', 'w_liberty', 'w_opera_house', 'w_cristo', 'w_launch_pad'],
    'wonders_natural': ['nw_sky_arch', 'nw_ember_peak', 'nw_crystal_falls', 'nw_elder_tree', 'nw_titan_bones',
                        'nw_mirror_lake'],
}
ORDER = [k for keys in GROUPS.values() for k in keys]
MODULE_OF = {k: mod for mod, keys in GROUPS.items() for k in keys}


def builder_for(key):
    """Import only the module that owns `key` (sibling modules may be mid-edit)."""
    import importlib
    return importlib.import_module(MODULE_OF[key]).MODELS[key]


TITLES = {k: k.split('_', 1)[1].replace('_', ' ').title() for k in ORDER}
TITLES.update({'w_hagia_sophia': 'Hagia Sophia', 'w_taj_mahal': 'Taj Mahal', 'w_big_ben': 'Big Ben',
               'w_launch_pad': 'Launch Pad', 'w_opera_house': 'Opera House'})

TILES = Path('/tmp/aeons_wonder_tiles')


def parse(argv):
    args = argv[argv.index('--') + 1:] if '--' in argv else []
    opts = {'only': None, 'render': True, 'sheet': False, 'fast': False}
    i = 0
    while i < len(args):
        a = args[i]
        if a == '--only':
            opts['only'] = [k.strip() for k in args[i + 1].split(',') if k.strip()]
            i += 1
        elif a == '--no-render':
            opts['render'] = False
        elif a == '--sheet':
            opts['sheet'] = True
        elif a == '--fast':
            opts['fast'] = True
        i += 1
    return opts


def build(key, opts):
    t0 = time.time()
    L.reset()
    spec = builder_for(key)
    b = L.Builder(key)
    fn, limits = spec if isinstance(spec, tuple) else (spec, {})
    fn(b)
    ob = b.to_object()
    L.bake_ao(ob)
    tris, lo, hi, rad, errs = L.validate(ob, key, **limits)
    entry = L.export(ob, key)
    status = 'OK ' if not errs else 'ERR'
    print(f'[wonders] {status} {key:22s} tris={tris:5d} r={rad:.3f} h={hi.z:.3f} '
          f'mats={len(ob.data.materials)} {time.time() - t0:.1f}s {"; ".join(errs)}', flush=True)
    if tris > L.MAX_TRIS * .9:
        per = {}
        for poly in ob.data.polygons:
            name = ob.data.materials[poly.material_index].name
            per[name] = per.get(name, 0) + 1
        top = sorted(per.items(), key=lambda kv: -kv[1])[:8]
        print('[wonders]     tris by material: ' + ', '.join(f'{k}={v}' for k, v in top), flush=True)
    if opts['render']:
        samples = 12 if opts['fast'] else 64
        L.setup_stage(elevation=24, azimuth=32, res=1024, dist=2.75, target_z=.26)
        bpy_scene().eevee.taa_render_samples = samples
        L.render_to(L.PREVIEWS / f'wonders_{key}.png')
        for o in list(bpy_scene().objects):
            if o != ob:
                bpy_data().objects.remove(o)
        L.setup_stage(label=TITLES[key], elevation=46, azimuth=24, res=384, dist=3.2, target_z=.12)
        bpy_scene().eevee.taa_render_samples = max(8, samples // 2)
        TILES.mkdir(parents=True, exist_ok=True)
        L.render_to(TILES / f'{key}.png')
    return entry, errs


def bpy_scene():
    return bpy.context.scene


def bpy_data():
    return bpy.data


def main():
    opts = parse(sys.argv)
    keys = opts['only'] or ORDER
    unknown = [k for k in keys if k not in MODULE_OF]
    if unknown:
        raise SystemExit(f'[wonders] unknown keys: {unknown}')
    L.PREVIEWS.mkdir(parents=True, exist_ok=True)
    entries, failed = [], []
    for key in keys:
        entry, errs = build(key, opts)
        entries.append(entry)
        if errs:
            failed.append(key)
    if entries:
        L.write_manifest(entries)
    if opts['sheet'] or (opts['render'] and opts['only'] is None):
        tiles = [TILES / f'{k}.png' for k in ORDER if (TILES / f'{k}.png').exists()]
        L.contact_sheet(tiles, L.PREVIEWS / 'wonders_contact_sheet.png', columns=6)
        print(f'[wonders] contact sheet: {len(tiles)} tiles', flush=True)
    if failed:
        print(f'[wonders] VALIDATION FAILED: {failed}', flush=True)
        sys.exit(1)


main()
