// Composes static props from GameState: biome decoration, mountains, resources, improvements, camps,
// ruins, natural wonders, and assembled cities (era center, houses by pop, walls, landmarks, wonders).
import { Color, Euler, Matrix4, Quaternion, Vector3 } from 'three';
import { BUILDINGS, IMPROVEMENTS, NATURAL_WONDERS, RESOURCES, TECHS, WONDERS } from '../content';
import type { City, GameState, Player, Tile, TileIdx } from '../sim/types';
import { HUMAN } from '../sim/types';
import { MODEL_KEYS } from './assets/manifest';
import { neighbor } from '../sim/hex';
import { APOTHEM, CORNER_VEC, DIR_VEC, WATER_TERRAIN, colX, hash01, rowZ } from './hexgeo';
import { BARBARIAN_COLORS } from './palette';
import type { PropLayer } from './props';
import { type RiverSeg, segDist } from './rivers';
import { type TerrainField, groundAt } from './terrain';

const CITY_KEYS: Record<string, true> = Object.fromEntries(MODEL_KEYS.city.map((k) => [k, true]));

const _m = new Matrix4();
const _q = new Quaternion();
const _e = new Euler();
const _p = new Vector3();
const _s = new Vector3();

export interface TeamColors {
  a: Color;
  b: Color;
}

const teamCache = new Map<string, TeamColors>();
export function teamColors(p: Player | undefined): TeamColors {
  const primary = p?.colors.primary ?? BARBARIAN_COLORS.primary;
  const secondary = p?.colors.secondary ?? BARBARIAN_COLORS.secondary;
  const k = `${primary}|${secondary}`;
  let t = teamCache.get(k);
  if (!t) {
    t = { a: new Color(primary), b: new Color(secondary) };
    teamCache.set(k, t);
  }
  return t;
}

export function playerById(state: GameState, id: number): Player | undefined {
  return state.players.find((p) => p.id === id);
}

/** visual era of a player's cities: the highest era among researched techs (run era for the human) */
export function playerEra(state: GameState, p: Player | undefined): number {
  if (!p) return 0;
  let era = 0;
  for (const t of p.techs) era = Math.max(era, TECHS[t]?.era ?? 0);
  if (p.id === HUMAN) era = Math.max(era, Math.min(5, state.run?.era ?? 0));
  return Math.min(5, era);
}

function place(layer: PropLayer, key: string, x: number, y: number, z: number, rotY: number, scale: number, team?: TeamColors, tiltX = 0, tiltZ = 0): void {
  _e.set(tiltX, rotY, tiltZ);
  _q.setFromEuler(_e);
  _p.set(x, y, z);
  _s.set(scale, scale, scale);
  _m.compose(_p, _q, _s);
  layer.add(key, _m, team?.a, team?.b);
}

function placeScaled(layer: PropLayer, key: string, x: number, y: number, z: number, rotY: number, sxz: number, sy: number): void {
  _e.set(0, rotY, 0);
  _q.setFromEuler(_e);
  _p.set(x, y, z);
  _s.set(sxz, sy, sxz);
  _m.compose(_p, _q, _s);
  layer.add(key, _m);
}

/** tiles reserved by cities (center, house spill, wonders) — nature props skip these */
export interface CityPlan {
  reserved: Set<TileIdx>;
  wonderTiles: Map<TileIdx, string>;
  spill: Map<TileIdx, City>;
}

function isBuildable(t: Tile | undefined): boolean {
  return !!t && !WATER_TERRAIN[t.terrain] && t.elevation !== 'mountain' && !t.naturalWonder;
}

export function planCities(state: GameState): CityPlan {
  const map = state.map;
  const reserved = new Set<TileIdx>();
  const wonderTiles = new Map<TileIdx, string>();
  const spill = new Map<TileIdx, City>();
  const cities = Object.values(state.cities).sort((a, b) => a.id - b.id);
  for (const c of cities) reserved.add(c.tile);
  for (const c of cities) {
    const around: TileIdx[] = [];
    for (let d = 0; d < 6; d++) {
      const n = neighbor(map, c.tile, d);
      if (n >= 0 && !reserved.has(n) && map.tiles[n].owner === c.owner && isBuildable(map.tiles[n])) around.push(n);
    }
    around.sort((a, b) => hash01(c.id, a) - hash01(c.id, b));
    for (const w of c.wonders) {
      // prefer tiles without improvements
      const pick = around.find((t) => !map.tiles[t].improvement && !map.tiles[t].resource) ?? around[0];
      if (pick === undefined) continue;
      around.splice(around.indexOf(pick), 1);
      reserved.add(pick);
      wonderTiles.set(pick, WONDERS[w]?.model ?? `w_${w}`);
    }
    const spillCount = Math.min(around.length, Math.max(0, Math.floor((c.pop - 5) / 3)));
    for (let i = 0; i < spillCount; i++) {
      const t = around.find((x) => !map.tiles[x].improvement);
      if (t === undefined) break;
      around.splice(around.indexOf(t), 1);
      reserved.add(t);
      spill.set(t, c);
    }
  }
  return { reserved, wonderTiles, spill };
}

function explored(state: GameState, idx: TileIdx, reveal: boolean): boolean {
  return reveal || (state.players[HUMAN]?.vis[idx] ?? 0) > 0;
}

/** scatter points in a hex avoiding the center (where units stand) */
function scatter(seed: number, count: number, minR: number, maxR: number, minDist: number): { x: number; z: number }[] {
  const pts: { x: number; z: number }[] = [];
  for (let tries = 0; tries < count * 12 && pts.length < count; tries++) {
    const a = hash01(seed, tries, 1) * Math.PI * 2;
    const r = minR + Math.sqrt(hash01(seed, tries, 2)) * (maxR - minR);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    // keep inside the hex (pointy-top): |z| limited and |x| by apothem
    if (Math.abs(x) > APOTHEM * 0.92 || Math.abs(x) * 0.5 + Math.abs(z) * APOTHEM > APOTHEM * 0.92) continue;
    if (pts.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < minDist * minDist)) continue;
    pts.push({ x, z });
  }
  return pts;
}

function pick<T>(arr: readonly T[], h: number): T {
  return arr[Math.floor(h * arr.length) % arr.length];
}

export function composeNature(state: GameState, f: TerrainField, layer: PropLayer, plan: CityPlan, reveal: boolean): void {
  const map = state.map;
  const human = state.players[HUMAN];
  const riverSegs = new Map<TileIdx, RiverSeg[]>();
  for (const sg of f.rivers) {
    for (const ti of [sg.t0, sg.t1]) {
      if (ti < 0) continue;
      const list = riverSegs.get(ti);
      if (list) list.push(sg);
      else riverSegs.set(ti, [sg]);
    }
  }
  layer.begin();
  for (const t of map.tiles) {
    if (!explored(state, t.idx, reveal)) continue;
    const cx = colX(t.col, t.row);
    const cz = rowZ(t.row);
    const seed = t.idx * 7 + 3;
    const g = (x: number, z: number) => groundAt(f, cx + x, cz + z);
    const water = !!WATER_TERRAIN[t.terrain];
    // natural wonder dominates the tile
    if (t.naturalWonder) {
      const key = NATURAL_WONDERS[t.naturalWonder]?.model ?? `nw_${t.naturalWonder}`;
      place(layer, key, cx, water ? 0 : g(0, 0) - 0.02, cz, Math.floor(hash01(seed, 9) * 6) * (Math.PI / 3), 1.0);
      continue;
    }
    if (t.elevation === 'mountain') {
      const snowy = t.terrain === 'snow' || t.terrain === 'tundra' || t.height > 0.78;
      const key = snowy ? 'mountain_snow' : pick(['mountain_a', 'mountain_b', 'mountain_c'] as const, hash01(seed, 1));
      const ms = 0.98 + hash01(seed, 3) * 0.14;
      placeScaled(layer, key, cx, g(0, 0) - 0.08, cz, hash01(seed, 2) * Math.PI * 2, ms, ms * 1.35);
      if (hash01(seed, 4) > 0.5) {
        const a = hash01(seed, 5) * Math.PI * 2;
        place(layer, 'rock_large', cx + Math.cos(a) * 0.7, g(Math.cos(a) * 0.7, Math.sin(a) * 0.7) - 0.02, cz + Math.sin(a) * 0.55, a, 0.8);
      }
      continue;
    }
    const reservedTile = plan.reserved.has(t.idx);
    // resource marker (strategic ones only once the tech reveals them)
    if (t.resource) {
      const def = RESOURCES[t.resource];
      const visibleRes = reveal || !def?.revealTech || !!human?.techs.includes(def.revealTech);
      if (visibleRes) {
        const a = (Math.floor(hash01(seed, 11) * 6) + 0.5) * (Math.PI / 3);
        const r = reservedTile ? 0.62 : 0.42;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        place(layer, def?.model ?? `res_${t.resource}`, cx + x, water ? 0 : g(x, z), cz + z, hash01(seed, 12) * Math.PI * 2, 1.1);
      }
    }
    if (t.improvement) {
      const key = IMPROVEMENTS[t.improvement]?.model ?? `imp_${t.improvement}`;
      if (t.pillaged) {
        for (const p of scatter(seed + 91, 3, 0.1, 0.5, 0.2)) place(layer, 'rock_small', cx + p.x, g(p.x, p.z), cz + p.z, hash01(seed, p.x * 100) * 6, 0.9);
      } else {
        const rot = Math.floor(hash01(seed, 13) * 6) * (Math.PI / 3);
        place(layer, key, cx, water ? 0 : g(0, 0), cz, rot, 1.0);
      }
    }
    if (t.camp) place(layer, 'camp_barbarian', cx, g(0, 0), cz, hash01(seed, 14) * Math.PI * 2, 1.15);
    if (t.ruin) place(layer, 'ruin_ancient', cx, g(0, 0), cz, hash01(seed, 15) * Math.PI * 2, 1.1);
    if (reservedTile) continue;
    const busy = !!t.improvement || t.camp || t.ruin;
    // features
    const feat = t.feature;
    if (feat === 'ice') {
      for (const p of scatter(seed, 2, 0.0, 0.55, 0.45)) place(layer, 'ice_floe', cx + p.x, 0.0, cz + p.z, hash01(seed, p.z * 50) * 6, 0.6 + hash01(seed, p.x * 50) * 0.35);
      continue;
    }
    if (feat === 'reef') {
      for (const p of scatter(seed, 3, 0.1, 0.6, 0.3)) place(layer, 'reef_coral', cx + p.x, -0.04, cz + p.z, hash01(seed, p.z * 50) * 6, 1.0 + hash01(seed, p.x * 50) * 0.4);
      continue;
    }
    if (water) continue;
    const segs = riverSegs.get(t.idx);
    const trees = (keys: readonly string[], n: number, minR: number, scale: number) => {
      for (const [i, p] of scatter(seed, n, minR, 0.82, 0.2).entries()) {
        if (segs?.some((sg) => segDist(cx + p.x, cz + p.z, sg) < 0.2)) continue;
        const k = pick(keys, hash01(seed, i, 21));
        const s = scale * (0.85 + hash01(seed, i, 22) * 0.4);
        place(layer, k, cx + p.x, g(p.x, p.z) - 0.01, cz + p.z, hash01(seed, i, 23) * Math.PI * 2, s, undefined, (hash01(seed, i, 24) - 0.5) * 0.12, (hash01(seed, i, 25) - 0.5) * 0.12);
      }
    };
    const minR = busy ? 0.42 : 0.24;
    if (feat === 'forest') {
      const keys = t.terrain === 'snow' ? ['tree_snowpine'] : t.terrain === 'tundra' ? ['tree_pine', 'tree_snowpine', 'tree_pine'] : t.terrain === 'desert' ? ['tree_palm'] : t.elevation === 'hills' ? ['tree_pine', 'tree_pine', 'tree_broadleaf'] : ['tree_broadleaf', 'tree_broadleaf', 'tree_pine'];
      trees(keys, busy ? 4 : 7, minR, 1.0);
      trees(['bush'], 2, minR, 1.0);
    } else if (feat === 'jungle') {
      trees(['tree_jungle', 'tree_jungle', 'tree_palm'], busy ? 5 : 8, minR, 1.05);
      trees(['bush', 'bush', 'flowers'], 3, minR, 1.0);
    } else if (feat === 'marsh') {
      trees(['reeds'], 6, 0.15, 1.1);
      trees(['bush', 'tree_broadleaf'], 2, minR, 0.85);
    } else if (feat === 'oasis') {
      trees(['tree_palm'], 4, 0.3, 1.0);
      trees(['bush', 'flowers'], 3, 0.3, 1.0);
    } else if (feat === 'floodplains') {
      trees(['reeds', 'flowers'], 4, minR, 1.0);
    } else {
      // sparse biome decoration on open terrain
      const r = hash01(seed, 31);
      if (t.elevation === 'hills') {
        // rocky outcrops on hills; the grassy knoll model only on green hills
        const knoll = t.terrain === 'grassland' && r > 0.6;
        const a = hash01(seed, 32) * Math.PI * 2;
        const rx = Math.cos(a) * 0.5;
        const rz = Math.sin(a) * 0.5;
        if (knoll) place(layer, 'hill_rocks', cx + rx, g(rx, rz) - 0.03, cz + rz, a, 0.6);
        else if (r > 0.45) trees(['rock_small', 'rock_small', 'rock_large'], 1, 0.4, 0.9);
      }
      const decor: Record<string, readonly string[]> = {
        grassland: ['flowers', 'bush', 'flowers', 'rock_small'],
        plains: ['bush', 'flowers', 'bush', 'rock_small'],
        desert: ['cactus', 'rock_small', 'cactus'],
        tundra: ['rock_small', 'bush', 'tree_pine'],
        snow: ['rock_small', 'tree_snowpine'],
      };
      const list = decor[t.terrain];
      if (list && r < 0.5 && t.elevation !== 'hills') trees(list, 1 + Math.floor(hash01(seed, 33) * 3), 0.38, 1.0);
    }
  }
  layer.commit();
}

const RING6 = [0, 1, 2, 3, 4, 5].map((k) => ({ x: CORNER_VEC[k].x, z: CORNER_VEC[k].z }));

export function composeCities(state: GameState, f: TerrainField, layer: PropLayer, plan: CityPlan, reveal: boolean): void {
  const map = state.map;
  layer.begin();
  for (const c of Object.values(state.cities)) {
    if (!explored(state, c.tile, reveal)) continue;
    const owner = playerById(state, c.owner);
    const team = teamColors(owner);
    const era = playerEra(state, owner);
    const t = map.tiles[c.tile];
    const cx = colX(t.col, t.row);
    const cz = rowZ(t.row);
    const g = (x: number, z: number) => groundAt(f, cx + x, cz + z);
    const seed = c.id * 131 + 7;
    place(layer, `city_center_${era}`, cx, g(0, 0) - 0.01, cz, 0, 1.25, team);
    // landmark slots around the center (corners), houses fill the rest
    const landmarks = c.buildings
      .map((b) => BUILDINGS[b]?.model ?? (CITY_KEYS[`bld_${b}`] ? `bld_${b}` : null))
      .filter((k): k is string => !!k && CITY_KEYS[k] === true);
    const slots = RING6.map((p, i) => ({ x: p.x * 0.5, z: p.z * 0.5, a: (i * Math.PI) / 3 }));
    slots.sort((a, b) => hash01(seed, a.a * 10) - hash01(seed, b.a * 10));
    const lmHere = landmarks.slice(0, 4);
    lmHere.forEach((k, i) => {
      const s = slots[i];
      place(layer, k, cx + s.x, g(s.x, s.z) - 0.01, cz + s.z, Math.atan2(s.x, s.z) + Math.PI, 1.05, team);
    });
    const houses = Math.min(14, 3 + Math.round(c.pop * 1.4));
    const hkeys = [`house_${era}_a`, `house_${era}_b`];
    const pts = scatter(seed, houses, 0.33, 0.8, 0.17).filter((p) => !lmHere.some((_, i) => (slots[i].x - p.x) ** 2 + (slots[i].z - p.z) ** 2 < 0.07));
    pts.forEach((p, i) => {
      const rot = Math.atan2(p.x, p.z) + (hash01(seed, i, 41) > 0.5 ? 0 : Math.PI / 2);
      place(layer, pick(hkeys, hash01(seed, i, 42)), cx + p.x, g(p.x, p.z) - 0.01, cz + p.z, rot, 1.15 + hash01(seed, i, 43) * 0.2, team);
    });
    // walls around the city hex
    const hasCastle = c.buildings.includes('castle');
    if (c.buildings.includes('walls') || hasCastle) {
      const lvl = hasCastle || era >= 3 ? 2 : era >= 1 ? 1 : 0;
      const inset = 0.9;
      for (let d = 0; d < 6; d++) {
        const a = CORNER_VEC[(d + 5) % 6];
        const b = CORNER_VEC[d];
        const mx = ((a.x + b.x) / 2) * inset;
        const mz = ((a.z + b.z) / 2) * inset;
        // local +Z = outward face: point it along the edge normal (neighbor direction d)
        place(layer, `wall_seg_${lvl}`, cx + mx, g(mx, mz) - 0.01, cz + mz, Math.atan2(DIR_VEC[d].x, DIR_VEC[d].z), inset, team);
        place(layer, `wall_tower_${lvl}`, cx + b.x * inset, g(b.x * inset, b.z * inset) - 0.01, cz + b.z * inset, Math.atan2(b.x, b.z), 1.0, team);
      }
    }
    // extra landmarks spill to the ring around the city
    landmarks.slice(4).forEach((k, i) => {
      const d = DIR_VEC[(i * 2 + 1) % 6];
      const x = d.x * 1.15;
      const z = d.z * 1.15;
      place(layer, k, cx + x, g(x, z), cz + z, Math.atan2(x, z) + Math.PI, 1.0, team);
    });
  }
  // house spill onto neighboring tiles for big cities
  for (const [tile, c] of plan.spill) {
    if (!explored(state, tile, reveal)) continue;
    const owner = playerById(state, c.owner);
    const team = teamColors(owner);
    const era = playerEra(state, owner);
    const t = map.tiles[tile];
    const cx = colX(t.col, t.row);
    const cz = rowZ(t.row);
    const seed = tile * 17 + c.id;
    const n = 3 + Math.floor(hash01(seed, 1) * 3);
    scatter(seed, n, 0.2, 0.72, 0.2).forEach((p, i) => {
      place(layer, `house_${era}_${hash01(seed, i, 2) > 0.5 ? 'a' : 'b'}`, cx + p.x, groundAt(f, cx + p.x, cz + p.z) - 0.01, cz + p.z, hash01(seed, i, 3) * Math.PI * 2, 1.1, team);
    });
  }
  for (const [tile, key] of plan.wonderTiles) {
    if (!explored(state, tile, reveal)) continue;
    const t = map.tiles[tile];
    const city = state.cities[t.cityId ?? -1];
    const team = teamColors(playerById(state, city?.owner ?? t.owner ?? -1));
    const cx = colX(t.col, t.row);
    const cz = rowZ(t.row);
    place(layer, key, cx, groundAt(f, cx, cz) - 0.02, cz, 0, 1.0, team);
  }
  layer.commit();
}
