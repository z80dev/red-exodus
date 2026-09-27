import { hexDistance, tilesInRadius } from './hex';
import { visionOf } from './units';
import type { Emit, GameState, PlayerId, TileIdx } from './types';

function blocksVision(state: GameState, tile: TileIdx): boolean {
  const cell = state.map.tiles[tile];
  return cell.elevation === 'hills' || cell.elevation === 'mountain' || cell.feature === 'forest' || cell.feature === 'jungle';
}

function hasLineOfSight(state: GameState, source: TileIdx, target: TileIdx, elevated: boolean): boolean {
  if (elevated || source === target) return true;
  const map = state.map;
  const start = map.tiles[source];
  const end = map.tiles[target];
  const sourceQ = start.col - ((start.row - (start.row & 1)) >> 1);
  const endQ = end.col - ((end.row - (end.row & 1)) >> 1);
  const sourceR = start.row;
  const endR = end.row;
  const distance = hexDistance(map, source, target);
  for (let step = 1; step < distance; step++) {
    const t = step / distance;
    const x = sourceQ + (endQ - sourceQ) * t;
    const z = sourceR + (endR - sourceR) * t;
    const y = -x - z;
    let rx = Math.round(x);
    let ry = Math.round(y);
    let rz = Math.round(z);
    const dx = Math.abs(rx - x);
    const dy = Math.abs(ry - y);
    const dz = Math.abs(rz - z);
    if (dx > dy && dx > dz) rx = -ry - rz;
    else if (dy > dz) ry = -rx - rz;
    else rz = -rx - ry;
    const row = rz;
    const col = rx + ((row - (row & 1)) >> 1);
    const between = row * map.width + col;
    if (between >= 0 && between < map.tiles.length && blocksVision(state, between)) return false;
  }
  return true;
}

function reveal(state: GameState, pid: PlayerId, tiles: TileIdx[], emit: Emit): void {
  const player = state.players.find((candidate) => candidate.id === pid);
  if (!player) return;
  if (!player.vis || player.vis.length === 0) player.vis = Array(state.map.tiles.length).fill(0);
  const newlyExplored: TileIdx[] = [];
  const discovered = state.naturalWondersSeen[pid] ?? (state.naturalWondersSeen[pid] = []);
  for (const tileIdx of tiles) {
    const tile = state.map.tiles[tileIdx];
    if (!tile) continue;
    if ((player.vis[tileIdx] ?? 0) === 0) newlyExplored.push(tileIdx);
    player.vis[tileIdx] = 2;
    if (tile.naturalWonder && !discovered.includes(tile.naturalWonder)) {
      discovered.push(tile.naturalWonder);
      emit({ type: 'naturalWonderFound', player: pid, tile: tileIdx, id: tile.naturalWonder });
    }
  }
  if (newlyExplored.length) emit({ type: 'tilesRevealed', player: pid, tiles: newlyExplored });
}

/** Recompute visibility from owned territory, cities, and unit vision, applying hex LOS blockers. */
export function recomputeVisibility(state: GameState, pid: PlayerId, emit: Emit): void {
  const player = state.players.find((candidate) => candidate.id === pid);
  if (!player) return;
  if (!player.vis || player.vis.length === 0) player.vis = Array(state.map.tiles.length).fill(0);
  for (let i = 0; i < player.vis.length; i++) if (player.vis[i] === 2) player.vis[i] = 1;
  const visible = Array(state.map.tiles.length).fill(false) as boolean[];
  const sources: { tile: TileIdx; radius: number; elevated: boolean }[] = [];
  for (const unit of Object.values(state.units)) {
    if (unit.owner !== pid || !state.map.tiles[unit.tile]) continue;
    const elevation = state.map.tiles[unit.tile].elevation;
    sources.push({
      tile: unit.tile,
      radius: visionOf(state, unit) + (elevation === 'hills' || elevation === 'mountain' ? 1 : 0),
      elevated: elevation === 'hills' || elevation === 'mountain',
    });
  }
  for (const city of Object.values(state.cities)) {
    if (city.owner !== pid || !state.map.tiles[city.tile]) continue;
    const elevation = state.map.tiles[city.tile].elevation;
    sources.push({
      tile: city.tile,
      radius: 2 + Math.max(0, state.run.era - 2) + (elevation === 'hills' || elevation === 'mountain' ? 1 : 0),
      elevated: elevation === 'hills' || elevation === 'mountain',
    });
  }
  for (const source of sources) {
    for (const tile of tilesInRadius(state.map, source.tile, source.radius)) {
      if (hasLineOfSight(state, source.tile, tile, source.elevated)) visible[tile] = true;
    }
  }
  for (const tile of state.map.tiles) if (tile.owner === pid) visible[tile.idx] = true;
  const newlyVisible: TileIdx[] = [];
  for (let idx = 0; idx < visible.length; idx++) if (visible[idx]) newlyVisible.push(idx);
  reveal(state, pid, newlyVisible, emit);
}

/** Reveal an unobstructed radius, used for one-off scouting effects. */
export function revealArea(state: GameState, pid: PlayerId, center: TileIdx, radius: number, emit: Emit): void {
  reveal(state, pid, tilesInRadius(state.map, center, radius), emit);
}
