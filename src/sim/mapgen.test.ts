import { describe, expect, it } from 'vitest';
import { generateMap } from './mapgen';
import { hexDistance, neighbor, neighbors, tilesInRadius } from './hex';
import { ELEVATIONS, FEATURES, NATURAL_WONDERS, RESOURCES, TERRAINS } from '../content';
import type { GameMap, MapSize } from './types';
import { RIVER_GOLD } from './cities';

function reachable(map: GameMap): Set<number> {
  const seen = new Set([map.starts[0]]), queue = [map.starts[0]];
  for (let n = 0; n < queue.length; n++) for (const i of neighbors(map, queue[n])) {
    const t = map.tiles[i];
    if (seen.has(i) || t.terrain === 'ocean' || t.elevation === 'mountain' || t.feature === 'ice'
      || (t.naturalWonder && NATURAL_WONDERS[t.naturalWonder].impassable)) continue;
    seen.add(i); queue.push(i);
  }
  return seen;
}

describe('seeded continental worlds', () => {
  for (const size of ['small', 'standard', 'large'] as MapSize[]) {
    for (let seed = 0; seed < 30; seed++) it(`${size} seed ${seed}: fair, connected, constrained and reproducible`, () => {
      const map = generateMap(`atlas-${seed}`, size, 4);
      expect(generateMap(`atlas-${seed}`, size, 4)).toEqual(map);
      const connected = reachable(map);
      const quality: number[] = [];
      expect(map.starts).toHaveLength(4);
      const land = map.tiles.filter(t => !TERRAINS[t.terrain].water).length / map.tiles.length;
      expect(land).toBeGreaterThan(0.38); expect(land).toBeLessThan(0.49);
      for (const s of map.starts) {
        const t = map.tiles[s];
        expect(['grassland', 'plains']).toContain(t.terrain);
        expect(t.elevation).not.toBe('mountain'); expect(t.naturalWonder).toBeNull();
        expect(connected.has(s)).toBe(true);
        expect(neighbors(map, s).filter(i => !TERRAINS[map.tiles[i].terrain].water).length).toBeGreaterThanOrEqual(3);
        for (const other of map.starts) if (s !== other) expect(hexDistance(map, s, other)).toBeGreaterThanOrEqual(size === 'small' ? 6 : size === 'standard' ? 8 : 10);
        const close = tilesInRadius(map, s, 2).map(i => map.tiles[i]);
        expect(close.filter(t => t.resource && RESOURCES[t.resource].kind === 'bonus').length).toBeGreaterThanOrEqual(2);
        expect(close.filter(t => t.resource && RESOURCES[t.resource].kind === 'luxury').length).toBeGreaterThanOrEqual(1);
        expect(tilesInRadius(map, s, 4).some(i => ['iron', 'horses'].includes(map.tiles[i].resource ?? ''))).toBe(true);
        quality.push(close.reduce((sum, t) => sum + (t.elevation === 'mountain' ? 0 : Math.max(0,
          [TERRAINS[t.terrain].yields, ELEVATIONS[t.elevation].yields,
            t.feature ? FEATURES[t.feature].yields : null, t.resource ? RESOURCES[t.resource].yields : null]
            .reduce((n, y) => n + (y ? y.food + y.prod + y.gold + y.sci + y.cul : 0), t.riverEdges ? RIVER_GOLD : 0))), 0));
      }
      expect(Math.max(...quality) / Math.min(...quality)).toBeLessThanOrEqual(1.15);
      for (const t of map.tiles) {
        expect(t.height).toBeGreaterThanOrEqual(0); expect(t.height).toBeLessThanOrEqual(1);
        if (TERRAINS[t.terrain].water) expect(t.height).toBeLessThan(0.3);
        else expect(t.height).toBeGreaterThanOrEqual(0.35);
        if (t.terrain === 'coast') expect(neighbors(map, t.idx).some(i => !TERRAINS[map.tiles[i].terrain].water)).toBe(true);
        for (let d = 0; d < 6; d++) if (t.riverEdges & (1 << d)) {
          const other = neighbor(map, t.idx, d);
          expect(other).toBeGreaterThanOrEqual(0);
          expect(map.tiles[other].riverEdges & (1 << ((d + 3) % 6))).not.toBe(0);
        }
        if (t.resource) {
          const def = RESOURCES[t.resource];
          expect(def.terrains).toContain(t.terrain);
          if (def.features) expect(def.features).toContain(t.feature);
          else expect(t.feature === null || t.feature === 'floodplains').toBe(true);
          if (def.elevations) expect(def.elevations).toContain(t.elevation);
          expect(t.elevation).not.toBe('mountain'); expect(t.naturalWonder).toBeNull();
        }
        if (t.naturalWonder) expect(NATURAL_WONDERS[t.naturalWonder].terrains).toContain(t.terrain);
        if (t.ruin) for (const s of map.starts) expect(hexDistance(map, t.idx, s)).toBeGreaterThanOrEqual(3);
        if (t.camp) for (const s of map.starts) expect(hexDistance(map, t.idx, s)).toBeGreaterThanOrEqual(6);
      }
      expect(map.tiles.filter(t => t.riverEdges).length).toBeGreaterThanOrEqual(12);
      expect(map.tiles.filter(t => t.naturalWonder).length).toBe(size === 'small' ? 1 : 2);
      expect(map.tiles.filter(t => t.ruin).length).toBeGreaterThanOrEqual(6);
      expect(map.tiles.filter(t => t.ruin).length).toBeLessThanOrEqual(10);
      expect(map.tiles.filter(t => t.camp).length).toBeLessThanOrEqual(1);
    });
  }
  it('generates a large four-player world within the interactive budget', () => {
    generateMap('warmup', 'large', 4);
    const start = performance.now();
    generateMap('x', 'large', 4);
    expect(performance.now() - start).toBeLessThan(80);
  });
  it('supports solo and smaller rival counts', () => {
    for (const players of [1, 2, 3]) expect(generateMap('solo', 'small', players).starts).toHaveLength(players);
  });
});
