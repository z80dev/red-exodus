"""Validate shipped unit GLBs using only Python's standard library.

Run: python3 art/blender/units_validate.py
Checks real binary vertex/index buffers, every required key, team recoloring slots,
ground placement, bounds, triangle budget, finite unit normals, and texture-free PBR.
"""
import json
import math
from pathlib import Path
import struct

ROOT = Path(__file__).resolve().parents[2]
EXPECTED = set(('settler scout warrior archer spearman horseman swordsman catapult chariot '
                'man_at_arms crossbowman pikeman knight trebuchet musketman cannon lancer '
                'rifleman field_gun cavalry artillery infantry machine_gun at_gun tank '
                'rocket_artillery boat').split())
FORMATS = {5120: 'b', 5121: 'B', 5122: 'h', 5123: 'H', 5125: 'I', 5126: 'f'}
COMPONENTS = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


def load(path):
    raw = path.read_bytes()
    magic, version, length = struct.unpack_from('<4sII', raw)
    assert magic == b'glTF' and version == 2 and length == len(raw), path
    chunks = {}
    pos = 12
    while pos < len(raw):
        size, kind = struct.unpack_from('<I4s', raw, pos)
        chunks[kind] = raw[pos + 8:pos + 8 + size]
        pos += size + 8
    return json.loads(chunks[b'JSON']), chunks[b'BIN\x00'], len(raw)


def values(doc, binary, index):
    accessor = doc['accessors'][index]
    view = doc['bufferViews'][accessor['bufferView']]
    fmt = '<' + FORMATS[accessor['componentType']] * COMPONENTS[accessor['type']]
    stride = view.get('byteStride', struct.calcsize(fmt))
    offset = accessor.get('byteOffset', 0) + view.get('byteOffset', 0)
    return [struct.unpack_from(fmt, binary, offset + i * stride) for i in range(accessor['count'])]


def main():
    manifest = json.loads((ROOT / 'public/models/manifest.units.json').read_text())
    assert len(manifest) == len(EXPECTED) == 27
    assert {entry['key'] for entry in manifest} == {'u_' + key for key in EXPECTED}
    total_bytes = 0
    total_tris = 0
    for entry in manifest:
        key = entry['key']
        doc, binary, size = load(ROOT / 'public' / entry['file'].lstrip('/'))
        assert not doc.get('cameras') and not doc.get('animations')
        assert not doc.get('textures') and not doc.get('images')
        assert 'KHR_lights_punctual' not in doc.get('extensions', {})
        assert len(doc['meshes']) == 1, key
        assert len(doc['nodes']) == 1, key
        node = doc['nodes'][0]
        assert node.get('translation', [0, 0, 0]) == [0, 0, 0], key
        assert node.get('scale', [1, 1, 1]) == [1, 1, 1], key
        assert node.get('rotation', [0, 0, 0, 1]) == [0, 0, 0, 1], key
        mats = doc['materials']
        assert {'TEAM', 'TEAM_DARK'} <= {mat['name'] for mat in mats}, key
        assert all(.7 <= mat['pbrMetallicRoughness']['roughnessFactor'] <= .9 for mat in mats)
        points = []
        tris = 0
        used_materials = set()
        for primitive in doc['meshes'][0]['primitives']:
            assert primitive.get('mode', 4) == 4, key
            used_materials.add(mats[primitive['material']]['name'])
            vertices = values(doc, binary, primitive['attributes']['POSITION'])
            normals = values(doc, binary, primitive['attributes']['NORMAL'])
            indices = [v[0] for v in values(doc, binary, primitive['indices'])]
            assert len(indices) % 3 == 0 and max(indices) < len(vertices), key
            assert all(all(math.isfinite(c) for c in point) for point in vertices), key
            assert all(abs(sum(c * c for c in normal) - 1) < 1e-4 for normal in normals), key
            points.extend(vertices)
            tris += len(indices) // 3
        assert {'TEAM', 'TEAM_DARK'} <= used_materials, key
        assert tris == entry['tris'] and tris <= 1500, (key, tris)
        bounds = {'min': [min(p[i] for p in points) for i in range(3)],
                  'max': [max(p[i] for p in points) for i in range(3)]}
        for side in ('min', 'max'):
            assert all(abs(a - b) < 1e-6 for a, b in zip(bounds[side], entry['bbox'][side])), key
        assert abs(bounds['min'][1]) < 1e-6, (key, 'not ground aligned')
        assert bounds['max'][1] <= .55, key
        total_bytes += size
        total_tris += tris
        print(f"PASS {key:20s} {tris:4d} tris  {size:6d} bytes  height={bounds['max'][1]:.3f}m")
    print(f'PASS all {len(manifest)} unit GLBs: {total_tris:,} triangles, {total_bytes:,} bytes')


if __name__ == '__main__':
    main()
