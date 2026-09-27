// Deterministic continental worlds. Terrain, drainage and start balancing use independent spatial fields.
import type { GameMap, MapSize, RngState, Tile, TerrainId } from './types';
import type { ResourceDef } from './defs';
import { ELEVATIONS, FEATURES, NATURAL_WONDERS, RESOURCES, TERRAINS } from '../content';
import { deriveRng, random, shuffle, weightedIndex } from './rng';
import { hexDistance, neighbor, neighbors, tilesInRadius } from './hex';
import { RIVER_GOLD } from './cities';

export const MAP_DIMS: Record<MapSize, { width: number; height: number }> = {
  small: { width: 22, height: 16 },
  standard: { width: 28, height: 20 },
  large: { width: 34, height: 24 },
};

const water = (t: Tile) => t.terrain === 'ocean' || t.terrain === 'coast' || t.terrain === 'lake';
const clamp = (n: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));

/** Seeded value noise with quintic interpolation; coordinates, not traversal order, determine the field. */
function noiseField(rng: RngState): (x: number, y: number) => number {
  const salt = (random(rng) * 0xffffffff) | 0;
  const lattice = (x: number, y: number) => {
    let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ salt;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  return (x, y) => {
    const ix = Math.floor(x), iy = Math.floor(y);
    let u = x - ix, v = y - iy;
    u = u * u * u * (u * (u * 6 - 15) + 10);
    v = v * v * v * (v * (v * 6 - 15) + 10);
    const a = lattice(ix, iy), b = lattice(ix + 1, iy);
    const c = lattice(ix, iy + 1), d = lattice(ix + 1, iy + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

function fbm(noise: (x: number, y: number) => number, x: number, y: number): number {
  return noise(x, y) * 0.57 + noise(x * 2.03 + 17, y * 2.03 + 9) * 0.28
    + noise(x * 4.09 + 31, y * 4.09 + 23) * 0.15;
}

function coastlines(map: GameMap): void {
  for (const t of map.tiles) {
    if (!water(t) || t.terrain === 'lake') continue;
    t.terrain = neighbors(map, t.idx).some(i => !water(map.tiles[i])) ? 'coast' : 'ocean';
    t.height = t.terrain === 'coast' ? 0.24 : Math.min(t.height, 0.19);
  }
}

function resourceFits(t: Tile, r: ResourceDef): boolean {
  return t.elevation !== 'mountain' && !t.naturalWonder && t.feature !== 'ice'
    && r.terrains.includes(t.terrain) && (r.features ? t.feature !== null && r.features.includes(t.feature)
      : t.feature === null || t.feature === 'floodplains')
    && (!r.elevations || r.elevations.includes(t.elevation));
}

function baseQuality(t: Tile): number {
  let total = t.riverEdges ? RIVER_GOLD : 0;
  for (const y of [TERRAINS[t.terrain]?.yields, ELEVATIONS[t.elevation]?.yields,
    t.feature ? FEATURES[t.feature]?.yields : undefined, t.resource ? RESOURCES[t.resource]?.yields : undefined]) {
    if (y) total += y.food + y.prod + y.gold + y.sci + y.cul;
  }
  return t.elevation === 'mountain' ? 0 : Math.max(0, total);
}

function placeStarts(map: GameMap, players: number, rng: RngState): void {
  const candidates = map.tiles.filter(t => !water(t) && t.row > 2 && t.row < map.height - 3
    && t.col > 1 && t.col < map.width - 2 && t.elevation !== 'mountain'
    && neighbors(map, t.idx).filter(i => !water(map.tiles[i])).length >= 4
    && tilesInRadius(map, t.idx, 2).filter(i => !water(map.tiles[i])).length >= 13).map(t => t.idx);
  if (candidates.length < players) throw new Error('World has insufficient habitable land');
  shuffle(rng, candidates);
  let best: number[] = [], bestScore = -Infinity;
  // Farthest-point sampling with multiple anchors avoids a privileged central capital.
  for (let trial = 0; trial < Math.min(24, candidates.length); trial++) {
    const starts = [candidates[trial]];
    while (starts.length < players) {
      let selected = -1, score = -Infinity;
      for (const i of candidates) {
        if (starts.includes(i)) continue;
        const distance = Math.min(...starts.map(s => hexDistance(map, s, i)));
        const interior = neighbors(map, i).filter(j => !water(map.tiles[j])).length;
        const value = distance + interior * 0.08;
        if (value > score) { score = value; selected = i; }
      }
      starts.push(selected);
    }
    let separation = map.width;
    for (let a = 0; a < players; a++) for (let b = a + 1; b < players; b++) {
      separation = Math.min(separation, hexDistance(map, starts[a], starts[b]));
    }
    if (separation > bestScore) { bestScore = separation; best = starts; }
  }
  map.starts = best;
  for (const start of best) {
    const center = map.tiles[start];
    center.terrain = random(rng) < 0.5 ? 'grassland' : 'plains';
    center.elevation = 'flat'; center.feature = null; center.height = 0.46;
    for (const idx of tilesInRadius(map, start, 2)) {
      const t = map.tiles[idx];
      if (water(t)) continue;
      if (t.elevation === 'mountain') { t.elevation = 'hills'; t.height = 0.62; }
      if (t.terrain === 'snow' || t.terrain === 'tundra' || t.terrain === 'desert') {
        t.terrain = random(rng) < 0.55 ? 'grassland' : 'plains'; t.feature = null;
      }
    }
  }
}

/** Link separated shelves by small stepping-stone islands, never by mislabeled deep ocean. */
function connectShelves(map: GameMap): void {
  const seen = new Uint8Array(map.tiles.length);
  const flood = () => {
    seen.fill(0);
    const queue = [map.starts[0]]; seen[queue[0]] = 1;
    for (let n = 0; n < queue.length; n++) for (const i of neighbors(map, queue[n])) {
      const t = map.tiles[i];
      if (!seen[i] && t.terrain !== 'ocean' && t.feature !== 'ice' && t.elevation !== 'mountain') {
        seen[i] = 1; queue.push(i);
      }
    }
  };
  flood();
  for (const target of map.starts) {
    if (seen[target]) continue;
    // A breadth-first route minimizes sea crossings and preserves the continental silhouettes.
    const previous = new Int32Array(map.tiles.length).fill(-1);
    const queue: number[] = [];
    for (let i = 0; i < seen.length; i++) if (seen[i]) { previous[i] = i; queue.push(i); }
    for (let n = 0; n < queue.length && previous[target] < 0; n++) {
      for (const j of neighbors(map, queue[n])) if (previous[j] < 0) { previous[j] = queue[n]; queue.push(j); }
    }
    let i = target;
    while (!seen[i]) {
      const t = map.tiles[i];
      if (t.terrain === 'ocean') {
        t.terrain = 'plains'; t.height = 0.38; t.feature = null;
        coastlines(map);
      }
      if (t.elevation === 'mountain') { t.elevation = 'hills'; t.height = 0.64; }
      if (t.feature === 'ice') t.feature = null;
      i = previous[i];
    }
    flood();
  }
}

interface RiverVertex { tiles: number[]; links: { vertex: number; a: number; b: number; dir: number }[]; height: number }

/** Drainage lives on hex corners: consecutive river segments share endpoints, not tile centers. */
function rivers(map: GameMap, rng: RngState): void {
  const vertices: RiverVertex[] = [], keys = new Map<string, number>();
  const corners = [[0, -2], [1, -1], [1, 1], [0, 2], [-1, 1], [-1, -1]];
  const tileVertices: number[][] = [];
  for (const t of map.tiles) {
    const ids: number[] = [];
    for (const [dx, dy] of corners) {
      const key = `${2 * t.col + (t.row & 1) + dx},${3 * t.row + dy}`;
      let id = keys.get(key);
      if (id === undefined) { id = vertices.length; keys.set(key, id); vertices.push({ tiles: [], links: [], height: 0 }); }
      vertices[id].tiles.push(t.idx); ids.push(id);
    }
    tileVertices.push(ids);
  }
  for (const t of map.tiles) for (let dir = 0; dir < 6; dir++) {
    const b = neighbor(map, t.idx, dir);
    if (b < t.idx) continue;
    const u = tileVertices[t.idx][(dir + 1) % 6], v = tileVertices[t.idx][(dir + 2) % 6];
    vertices[u].links.push({ vertex: v, a: t.idx, b, dir });
    vertices[v].links.push({ vertex: u, a: t.idx, b, dir });
  }
  // Priority-flood fills tiny noise depressions; strict epsilon gives every inland corner a downhill outlet.
  const level = new Float64Array(vertices.length).fill(Infinity);
  const parent = new Int32Array(vertices.length).fill(-1);
  const settled = new Uint8Array(vertices.length);
  const heap: number[] = [];
  const push = (id: number) => {
    let k = heap.length; heap.push(id);
    while (k > 0) { const p = (k - 1) >> 1; if (level[heap[p]] <= level[id]) break; heap[k] = heap[p]; k = p; }
    heap[k] = id;
  };
  const pop = () => {
    const result = heap[0], last = heap.pop()!;
    if (heap.length) {
      let k = 0;
      while (k * 2 + 1 < heap.length) {
        let c = k * 2 + 1;
        if (c + 1 < heap.length && level[heap[c + 1]] < level[heap[c]]) c++;
        if (level[last] <= level[heap[c]]) break;
        heap[k] = heap[c]; k = c;
      }
      heap[k] = last;
    }
    return result;
  };
  vertices.forEach((v, i) => {
    v.height = v.tiles.reduce((s, t) => s + map.tiles[t].height, 0) / v.tiles.length;
    if (v.tiles.some(t => water(map.tiles[t]))) { level[i] = v.height; push(i); }
  });
  while (heap.length) {
    const u = pop(); if (settled[u]) continue; settled[u] = 1;
    for (const link of vertices[u].links) {
      const v = link.vertex, next = Math.max(vertices[v].height, level[u] + 0.0001);
      if (next < level[v]) { level[v] = next; parent[v] = u; push(v); }
    }
  }
  const candidates = shuffle(rng, vertices.map((_, i) => i).filter(i => vertices[i].height > 0.51 && parent[i] >= 0));
  candidates.sort((a, b) => vertices[b].height - vertices[a].height);
  const used = new Uint8Array(vertices.length), sources: number[] = [];
  const count = 6 + Math.floor(random(rng) * 7);
  for (const source of candidates) {
    if (sources.length >= count) break;
    const home = vertices[source].tiles[0];
    if (sources.some(s => hexDistance(map, home, vertices[s].tiles[0]) < 3)) continue;
    const path: number[] = [];
    let u = source;
    while (parent[u] >= 0 && !used[u]) { path.push(u); u = parent[u]; }
    if (path.length < 3) continue;
    sources.push(source);
    for (const v of path) {
      used[v] = 1;
      const link = vertices[v].links.find(l => l.vertex === parent[v])!;
      if (link.b < 0) continue;
      const a = map.tiles[link.a], b = map.tiles[link.b];
      if (water(a) && water(b)) continue;
      a.riverEdges |= 1 << link.dir;
      b.riverEdges |= 1 << ((link.dir + 3) % 6);
    }
  }
  for (const t of map.tiles) if (t.terrain === 'desert' && t.riverEdges && t.elevation === 'flat') t.feature = 'floodplains';
}

function resourcesAndBalance(map: GameMap, rng: RngState): void {
  const resources = Object.values(RESOURCES);
  const place = (t: Tile, pool = resources): boolean => {
    const choices = pool.filter(r => resourceFits(t, r) && r.weight > 0);
    if (!choices.length) return false;
    t.resource = choices[weightedIndex(rng, choices.map(r => r.weight))].id;
    return true;
  };
  for (const t of map.tiles) if (random(rng) < (water(t) ? 0.17 : 0.3)) place(t);
  for (const start of map.starts) {
    const near = shuffle(rng, tilesInRadius(map, start, 2).filter(i => i !== start));
    for (const kind of ['bonus', 'luxury', 'strategic'] as const) {
      const pool = resources.filter(r => r.kind === kind && (kind !== 'strategic' || r.id === 'horses' || r.id === 'iron'));
      const area = kind === 'strategic' ? shuffle(rng, tilesInRadius(map, start, 4).filter(i => i !== start)) : near;
      const required = kind === 'bonus' ? 2 : 1;
      let count = area.filter(i => pool.some(r => r.id === map.tiles[i].resource)).length;
      for (const i of area) {
        if (count >= required) break;
        if (!map.tiles[i].resource && place(map.tiles[i], pool)) count++;
      }
      // Natural terrain normally provides candidates. Adapt one unclaimed land tile if a biome lacks a luxury.
      for (const i of near) {
        if (count >= required) break;
        const t = map.tiles[i];
        if (water(t) || t.resource || !pool.length) continue;
        const r = pool.find(r => r.terrains.some(id => id === 'grassland' || id === 'plains')) ?? pool[0];
        t.terrain = r.terrains.find(id => id === 'grassland' || id === 'plains') ?? r.terrains[0];
        t.elevation = r.elevations?.[0] ?? 'flat'; t.feature = r.features?.[0] ?? null;
        t.height = t.elevation === 'hills' ? 0.62 : 0.44;
        if (place(t, [r])) count++;
      }
    }
  }
  const regions = map.starts.map(s => tilesInRadius(map, s, 2));
  const quality = (area: number[]) => area.reduce((sum, i) => sum + baseQuality(map.tiles[i]), 0);
  const target = Math.max(...regions.map(quality));
  for (const region of regions) {
    const options = shuffle(rng, region.filter(i => !map.starts.includes(i)));
    for (let pass = 0; pass < 3 && quality(region) < target / 1.14; pass++) for (const i of options) {
      if (quality(region) >= target / 1.14) break;
      const t = map.tiles[i], before = baseQuality(t);
      if (pass === 0 && !t.resource) { place(t, resources.filter(r => r.kind === 'bonus')); continue; }
      if (water(t) || t.elevation === 'mountain') continue;
      const terrain = t.terrain, feature = t.feature, elevation = t.elevation;
      if (pass === 1 && !t.feature) t.feature = 'forest';
      else if (pass === 2 && t.elevation === 'flat' && (t.feature === null || t.feature === 'forest' || t.feature === 'jungle')) t.elevation = 'hills';
      if (baseQuality(t) <= before || (t.resource && !resourceFits(t, RESOURCES[t.resource]))) {
        t.terrain = terrain; t.feature = feature; t.elevation = elevation;
      }
      else if (t.elevation === 'hills') t.height = Math.max(t.height, 0.6);
    }
  }
}

/** Deterministic from seed. `players` = number of civs (human + rivals); fills map.starts[0..players-1]. */
export function generateMap(seed: string, size: MapSize, players: number): GameMap {
  if (!Number.isInteger(players) || players < 1 || players > 4) throw new RangeError('Worlds support one to four civilizations');
  const rng = deriveRng(seed, 'map');
  const { width, height } = MAP_DIMS[size];
  const map: GameMap = { width, height, tiles: [], starts: [] };
  const shape = noiseField(rng), moisture = noiseField(rng), ridges = noiseField(rng);
  const continental: number[] = [];
  const tilt = (random(rng) - 0.5) * 0.55;
  const angle = random(rng) * Math.PI, cos = Math.cos(angle), sin = Math.sin(angle);
  const lobes = Array.from({ length: 4 }, (_, i) => ({
    x: 0.23 + (i % 2) * 0.49 + (random(rng) - 0.5) * 0.12,
    y: 0.31 + Math.floor(i / 2) * 0.36 + (random(rng) - 0.5) * 0.14,
    rx: 0.23 + random(rng) * 0.07, ry: 0.23 + random(rng) * 0.1,
  }));
  for (let row = 0; row < height; row++) for (let col = 0; col < width; col++) {
    const x = (col + 0.5 * (row & 1)) / width, y = row / (height - 1);
    const warp = fbm(shape, x * 5 + 11, y * 5 + 19) - 0.5;
    const continentalX = 0.5 + (x - 0.5) * cos - (y - 0.5) * sin;
    const continentalY = 0.5 + (x - 0.5) * sin + (y - 0.5) * cos;
    const continent = Math.max(...lobes.map(l => 1 - Math.hypot((continentalX + (continentalY - 0.5) * tilt - l.x) / l.rx, (continentalY - l.y) / l.ry)));
    continental.push(continent + warp * 1.05 + fbm(shape, x * 13, y * 11) * 0.19);
  }
  const sorted = [...continental].sort((a, b) => b - a), seaLevel = sorted[Math.floor(width * height * 0.42)];
  for (let idx = 0; idx < width * height; idx++) {
    const col = idx % width, row = Math.floor(idx / width), x = col / width, y = row / (height - 1);
    const land = continental[idx] > seaLevel;
    const wet = fbm(moisture, x * 5, y * 5);
    const latitude = Math.abs(y - 0.5) * 2 + (fbm(shape, x * 7 + 53, y * 7) - 0.5) * 0.18;
    const terrain: TerrainId = !land ? 'ocean' : latitude > 0.88 ? 'snow' : latitude > 0.71 ? 'tundra'
      : wet < 0.4 && latitude < 0.57 ? 'desert' : wet > 0.51 ? 'grassland' : 'plains';
    const ridge = 1 - Math.abs(fbm(ridges, x * 5.5, y * 5.5) * 2 - 1);
    const elevation = !land ? 'flat' : ridge > 0.87 && continental[idx] > seaLevel + 0.18 ? 'mountain'
      : ridge > 0.79 ? 'hills' : 'flat';
    const t: Tile = { idx, col, row, terrain, elevation, feature: null, riverEdges: 0, resource: null,
      improvement: null, pillaged: false, road: false, naturalWonder: null, owner: null, cityId: null,
      height: !land ? clamp(0.23 + (continental[idx] - seaLevel) * 0.2, 0.06, 0.27)
        : elevation === 'mountain' ? 0.84 + ridge * 0.15 : clamp(0.37 + (continental[idx] - seaLevel) * 0.2 + (elevation === 'hills' ? 0.15 : 0), 0.35, 0.78),
      camp: false, ruin: false };
    if (!land) { if (latitude > 0.92 && random(rng) < 0.6) t.feature = 'ice'; }
    else if (elevation !== 'mountain') {
      const chance = random(rng);
      if (terrain === 'desert' && elevation === 'flat' && chance < 0.07) t.feature = 'oasis';
      else if ((terrain === 'grassland' || terrain === 'plains') && latitude < 0.3 && wet > 0.58 && chance < 0.72) t.feature = 'jungle';
      else if ((terrain === 'grassland' || terrain === 'plains' || terrain === 'tundra') && wet > 0.43 && chance < 0.48) t.feature = 'forest';
      else if (terrain === 'grassland' && elevation === 'flat' && wet > 0.61 && chance < 0.64) t.feature = 'marsh';
    }
    map.tiles.push(t);
  }
  // Classify enclosed water components as lakes; coast only ever borders land.
  const seen = new Uint8Array(map.tiles.length);
  for (const t of map.tiles) if (water(t) && !seen[t.idx]) {
    const queue = [t.idx]; seen[t.idx] = 1;
    for (let n = 0; n < queue.length; n++) for (const i of neighbors(map, queue[n])) if (water(map.tiles[i]) && !seen[i]) { seen[i] = 1; queue.push(i); }
    if (queue.length <= 7 && queue.every(i => map.tiles[i].row > 0 && map.tiles[i].row < height - 1 && map.tiles[i].col > 0 && map.tiles[i].col < width - 1)) {
      for (const i of queue) { map.tiles[i].terrain = 'lake'; map.tiles[i].height = 0.26; map.tiles[i].feature = null; }
    }
  }
  coastlines(map);
  // Offshore islets remain within sailing range, rewarding early exploration without isolating a capital.
  const islands: number[] = [];
  for (const t of shuffle(rng, map.tiles.filter(t => t.terrain === 'ocean' && t.row > 2 && t.row < height - 3
    && t.col > 0 && t.col < width - 1 && neighbors(map, t.idx).some(i => map.tiles[i].terrain === 'coast')))) {
    if (islands.length === 2) break;
    if (islands.some(i => hexDistance(map, i, t.idx) < 6)) continue;
    t.terrain = 'plains'; t.height = 0.39; t.feature = 'forest'; islands.push(t.idx);
  }
  coastlines(map);
  placeStarts(map, players, rng);
  const lakeSites = shuffle(rng, map.tiles.filter(t => !water(t) && t.elevation !== 'mountain'
    && neighbors(map, t.idx).length === 6 && neighbors(map, t.idx).every(i => !water(map.tiles[i]))
    && map.starts.every(s => hexDistance(map, s, t.idx) >= 3)));
  const lakes: number[] = [];
  for (const t of lakeSites) {
    if (lakes.length >= (size === 'large' ? 2 : 1)) break;
    if (lakes.some(i => hexDistance(map, i, t.idx) < 5)) continue;
    t.terrain = 'lake'; t.elevation = 'flat'; t.feature = null; t.height = 0.26; lakes.push(t.idx);
  }
  connectShelves(map);
  rivers(map, rng);
  for (const t of map.tiles) if (t.terrain === 'coast' && !t.feature && t.row > height * 0.25 && t.row < height * 0.75 && random(rng) < 0.13) t.feature = 'reef';
  const wonders = shuffle(rng, Object.values(NATURAL_WONDERS));
  const placed: number[] = [];
  for (const def of wonders) {
    if (placed.length >= (size === 'small' ? 1 : 2)) break;
    const choices = map.tiles.filter(t => def.terrains.includes(t.terrain) && t.feature !== 'ice'
      && map.starts.every(s => hexDistance(map, s, t.idx) > 3) && placed.every(i => hexDistance(map, i, t.idx) > 5));
    for (const t of shuffle(rng, choices)) {
      t.naturalWonder = def.id;
      if (def.impassable) {
        // A landmark must never close the sole pass between civilizations.
        const reached = new Uint8Array(map.tiles.length), queue = [map.starts[0]];
        reached[queue[0]] = 1;
        for (let n = 0; n < queue.length; n++) for (const i of neighbors(map, queue[n])) {
          const tile = map.tiles[i];
          if (reached[i] || tile.terrain === 'ocean' || tile.feature === 'ice' || tile.elevation === 'mountain'
            || (tile.naturalWonder && NATURAL_WONDERS[tile.naturalWonder].impassable)) continue;
          reached[i] = 1; queue.push(i);
        }
        if (map.starts.some(i => !reached[i])) { t.naturalWonder = null; continue; }
      }
      t.feature = null; placed.push(t.idx); break;
    }
  }
  resourcesAndBalance(map, rng);
  const sites = shuffle(rng, map.tiles.filter(t => !water(t) && t.elevation !== 'mountain' && !t.naturalWonder
    && map.starts.every(s => hexDistance(map, s, t.idx) >= 3)));
  const ruins: number[] = [], ruinCount = 6 + Math.floor(random(rng) * 5);
  for (const t of sites) if (ruins.length < ruinCount && ruins.every(i => hexDistance(map, i, t.idx) >= 3)) { t.ruin = true; ruins.push(t.idx); }
  if (random(rng) < 0.75) {
    const camp = sites.find(t => !t.ruin && map.starts.every(s => hexDistance(map, s, t.idx) >= 6));
    if (camp) camp.camp = true;
  }
  return map;
}
