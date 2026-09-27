import { describe, expect, it } from 'vitest';
import type { GameMap } from './types';
import {
  HEX_WIDTH, dirBetween, hexDistance, hexToWorld, neighbor, neighbors, ring, tileAt, tileWorld,
  tilesInRadius, worldToTile,
} from './hex';

function makeMap(width: number, height: number): GameMap {
  return { width, height, tiles: Array.from({ length: width * height }, (_, idx) => ({ idx } as GameMap['tiles'][number])), starts: [] };
}

describe('odd-r pointy-top hex geometry', () => {
  it('indexes only coordinates inside the rectangular map', () => {
    const map = makeMap(4, 3);
    expect(tileAt(map, 0, 0)).toBe(0);
    expect(tileAt(map, 3, 2)).toBe(11);
    for (const [col, row] of [[-1, 0], [4, 0], [0, -1], [0, 3], [1.5, 1], [0, NaN]]) {
      expect(tileAt(map, col!, row!)).toBe(-1);
    }
    expect(tileAt({ ...map, tiles: map.tiles.slice(0, 5) }, 2, 1)).toBe(-1);
  });

  it('uses E, SE, SW, W, NW, NE ordering with odd-row shifts and no wrap', () => {
    const map = makeMap(5, 4);
    const even = tileAt(map, 2, 2);
    const odd = tileAt(map, 2, 1);
    expect(Array.from({ length: 6 }, (_, dir) => neighbor(map, even, dir))).toEqual([13, 17, 16, 11, 6, 7]);
    expect(Array.from({ length: 6 }, (_, dir) => neighbor(map, odd, dir))).toEqual([8, 13, 12, 6, 2, 3]);
    expect(neighbor(map, tileAt(map, 4, 3), 0)).toBe(-1);
    expect(neighbor(map, even, -1)).toBe(-1);
    expect(neighbor(map, even, 6)).toBe(-1);
    expect(neighbor(map, -1, 0)).toBe(-1);
    expect(neighbors(map, -1)).toEqual([]);
  });

  it('keeps direction, adjacency, and distance mutually consistent', () => {
    const map = makeMap(7, 6);
    for (let idx = 0; idx < map.tiles.length; idx++) {
      const adjacent = neighbors(map, idx);
      expect(new Set(adjacent).size).toBe(adjacent.length);
      for (const next of adjacent) {
        const dir = dirBetween(map, idx, next);
        expect(dir).toBeGreaterThanOrEqual(0);
        expect(neighbor(map, idx, dir)).toBe(next);
        expect(dirBetween(map, next, idx)).toBe((dir + 3) % 6);
        expect(hexDistance(map, idx, next)).toBe(1);
      }
      expect(hexDistance(map, idx, idx)).toBe(0);
    }
    expect(dirBetween(map, 0, 2)).toBe(-1);
    expect(hexDistance(map, 0, map.tiles.length)).toBe(-1);
  });

  it('returns each in-map tile in a radius or exact ring once', () => {
    const map = makeMap(11, 11);
    const center = tileAt(map, 5, 5);
    expect(tilesInRadius(map, center, 0)).toEqual([center]);
    expect(ring(map, center, 0)).toEqual([center]);
    for (let radius = 1; radius <= 3; radius++) {
      const within = tilesInRadius(map, center, radius);
      const edge = ring(map, center, radius);
      expect(within.length).toBe(1 + 3 * radius * (radius + 1));
      expect(edge.length).toBe(6 * radius);
      expect(new Set(within).size).toBe(within.length);
      expect(new Set(edge).size).toBe(edge.length);
      expect(edge.every((idx) => hexDistance(map, center, idx) === radius)).toBe(true);
      expect(within.every((idx) => hexDistance(map, center, idx) <= radius)).toBe(true);
    }
    expect(tilesInRadius(map, 0, 1)).toEqual([0, 1, 11]);
    expect(ring(map, 0, 1)).toEqual([1, 11]);
    expect(tilesInRadius(map, center, -1)).toEqual([]);
    expect(ring(map, center, Number.POSITIVE_INFINITY)).toEqual([]);
    expect(tilesInRadius(map, -1, 2)).toEqual([]);
  });

  it('clips discs and rings to map edges without dropping hexes', () => {
    const map = makeMap(8, 7);
    for (let center = 0; center < map.tiles.length; center++) {
      const distances = new Map([[center, 0]]), queue = [center];
      for (let n = 0; n < queue.length; n++) for (const next of neighbors(map, queue[n])) {
        if (distances.has(next)) continue;
        distances.set(next, distances.get(queue[n])! + 1); queue.push(next);
      }
      for (let radius = 0; radius < 10; radius++) {
        expect(tilesInRadius(map, center, radius)).toEqual([...distances].filter(([, d]) => d <= radius).map(([i]) => i).sort((a, b) => a - b));
        expect(ring(map, center, radius)).toEqual([...distances].filter(([, d]) => d === radius).map(([i]) => i).sort((a, b) => a - b));
      }
    }
  });

  it('maps odd and even row centers between grid and pointy-top world space', () => {
    expect(hexToWorld(0, 0)).toEqual({ x: 0, z: 0 });
    expect(hexToWorld(0, 1)).toEqual({ x: HEX_WIDTH / 2, z: 1.5 });
    expect(hexToWorld(3, 2)).toEqual({ x: 3 * HEX_WIDTH, z: 3 });
    const map = makeMap(8, 7);
    for (let idx = 0; idx < map.tiles.length; idx++) {
      const { x, z } = tileWorld(map, idx);
      expect(worldToTile(map, x, z)).toBe(idx);
    }
    expect(tileWorld(map, -1)).toEqual({ x: NaN, z: NaN });
  });

  it('picks the nearest hex at shared edges and rejects positions resolving off-map', () => {
    const map = makeMap(4, 4);
    const epsilon = 1e-6;
    expect(worldToTile(map, HEX_WIDTH / 2 - epsilon, 0)).toBe(tileAt(map, 0, 0));
    expect(worldToTile(map, HEX_WIDTH / 2 + epsilon, 0)).toBe(tileAt(map, 1, 0));
    expect(worldToTile(map, Number.NaN, 0)).toBe(-1);
    expect(worldToTile(map, 0, Number.POSITIVE_INFINITY)).toBe(-1);
    expect(worldToTile(map, -HEX_WIDTH, 0)).toBe(-1);
    expect(worldToTile(map, 0, -1.5)).toBe(-1);
  });
});
