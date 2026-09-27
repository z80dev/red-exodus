// Model key registry (the Blender → Renderer asset contract, docs/ARCHITECTURE.md §3D asset contract)
// plus runtime manifest loading from public/models/manifest.<group>.json.

export type ModelGroup = 'nature' | 'city' | 'wonders' | 'units';
export const MODEL_GROUPS: readonly ModelGroup[] = ['nature', 'city', 'wonders', 'units'];

export interface ManifestEntry {
  key: string;
  file: string;
  tris: number;
  bbox: { min: [number, number, number]; max: [number, number, number] };
}

const RESOURCES = [
  'wheat', 'rice', 'cattle', 'sheep', 'deer', 'fish', 'stone', 'bananas',
  'gold', 'gems', 'silk', 'spices', 'wine', 'incense', 'furs', 'pearls', 'marble', 'ivory', 'dyes', 'cotton', 'sugar', 'whales',
  'horses', 'iron', 'niter', 'coal', 'oil',
];
const IMPROVEMENTS = ['farm', 'mine', 'pasture', 'plantation', 'lumbermill', 'quarry', 'fishing_boats', 'camp', 'trading_post', 'oil_well'];
const LANDMARKS = [
  'temple', 'library', 'market', 'barracks', 'harbor', 'granary', 'workshop', 'university', 'amphitheater', 'bank',
  'factory', 'observatory', 'castle', 'aqueduct', 'cathedral', 'powerplant', 'stadium', 'lighthouse',
];
export const WONDER_IDS = [
  'pyramids', 'stonehenge', 'hanging_gardens', 'colossus', 'great_library', 'oracle',
  'great_wall', 'hagia_sophia', 'angkor_wat', 'taj_mahal', 'leaning_tower', 'himeji',
  'big_ben', 'eiffel', 'liberty', 'opera_house', 'cristo', 'launch_pad',
];
export const NATURAL_WONDER_IDS = ['sky_arch', 'ember_peak', 'crystal_falls', 'elder_tree', 'titan_bones', 'mirror_lake'];
export const UNIT_IDS = [
  'settler', 'scout', 'warrior', 'archer', 'spearman', 'horseman', 'swordsman', 'catapult', 'chariot',
  'man_at_arms', 'crossbowman', 'pikeman', 'knight', 'trebuchet', 'musketman', 'cannon', 'lancer',
  'rifleman', 'field_gun', 'cavalry', 'artillery', 'infantry', 'machine_gun', 'at_gun', 'tank', 'rocket_artillery',
];

/** every model key the renderer may request, by group */
export const MODEL_KEYS: Record<ModelGroup, string[]> = {
  nature: [
    'tree_pine', 'tree_broadleaf', 'tree_palm', 'tree_jungle', 'tree_snowpine', 'bush', 'reeds', 'cactus', 'rock_small',
    'rock_large', 'mountain_a', 'mountain_b', 'mountain_c', 'mountain_snow', 'hill_rocks', 'ice_floe', 'reef_coral', 'flowers',
    'camp_barbarian', 'ruin_ancient', 'road_marker',
    ...RESOURCES.map((r) => `res_${r}`),
    ...IMPROVEMENTS.map((i) => `imp_${i}`),
  ],
  city: [
    ...[0, 1, 2, 3, 4, 5].map((e) => `city_center_${e}`),
    ...[0, 1, 2, 3, 4, 5].flatMap((e) => [`house_${e}_a`, `house_${e}_b`]),
    ...[0, 1, 2].flatMap((w) => [`wall_seg_${w}`, `wall_tower_${w}`]),
    ...LANDMARKS.map((b) => `bld_${b}`),
  ],
  wonders: [...WONDER_IDS.map((w) => `w_${w}`), ...NATURAL_WONDER_IDS.map((n) => `nw_${n}`)],
  units: [...UNIT_IDS.map((u) => `u_${u}`), 'u_boat'],
};

export const ALL_MODEL_KEYS: string[] = MODEL_GROUPS.flatMap((g) => MODEL_KEYS[g]);

export function modelUrl(file: string): string {
  if (/^(https?:)?\//.test(file)) return file;
  return `/models/${file.replace(/^\.?\/?(models\/)?/, '')}`;
}

/** fetch all group manifests; missing/invalid manifests are skipped (models then fall back to stand-ins) */
export async function loadManifests(): Promise<Map<string, ManifestEntry>> {
  const out = new Map<string, ManifestEntry>();
  await Promise.all(
    MODEL_GROUPS.map(async (g) => {
      try {
        const res = await fetch(`/models/manifest.${g}.json`, { cache: 'no-cache' });
        if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) return;
        const list = (await res.json()) as ManifestEntry[];
        if (!Array.isArray(list)) return;
        for (const e of list) if (e && typeof e.key === 'string' && typeof e.file === 'string') out.set(e.key, e);
      } catch {
        // manifest not produced yet
      }
    }),
  );
  return out;
}
