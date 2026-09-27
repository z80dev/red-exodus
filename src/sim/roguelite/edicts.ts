// Edicts: one-shot consumables (Balatro tarots), usable on the map during play.
import type { HookCtx } from '../defs';
import { makeCtx } from '../effects';
import type { CityId, Emit, GameState, TileIdx, Uid, UnitId } from '../types';
import { HUMAN } from '../types';
import { EDICTS } from '../../content';

export interface EdictTargetArgs { tile?: TileIdx; cityId?: CityId; unitId?: UnitId }

function edictCtx(state: GameState, id: string, emit: Emit): HookCtx {
  return makeCtx(state, HUMAN, { kind: 'edict', id, hooks: {}, counters: {} }, emit);
}

/** null if the edict `uid` can be used on `t` right now */
export function useEdictError(state: GameState, uid: Uid, t: EdictTargetArgs): string | null {
  const run = state.run;
  if (run.phase !== 'playing' || state.gameOver) return 'Edicts can only be issued during play';
  const inst = run.edicts.find((e) => e.uid === uid);
  if (!inst) return 'No such edict';
  const def = EDICTS[inst.id];
  if (!def) return 'Unknown edict';
  const human = state.players.find((p) => p.id === HUMAN)!;
  switch (def.target) {
    case 'none':
      break;
    case 'city': {
      const city = t.cityId != null ? state.cities[t.cityId] : undefined;
      if (!city) return 'Choose a city';
      if (city.owner !== HUMAN) return 'Choose one of your cities';
      break;
    }
    case 'ownedTile': {
      const tile = t.tile != null ? state.map.tiles[t.tile] : undefined;
      if (!tile) return 'Choose a tile';
      if (tile.owner !== HUMAN) return 'Choose a tile inside your borders';
      break;
    }
    case 'tile': {
      const tile = t.tile != null ? state.map.tiles[t.tile] : undefined;
      if (!tile) return 'Choose a tile';
      if (!human.vis[tile.idx]) return 'That land is unexplored';
      break;
    }
    case 'unit': {
      const unit = t.unitId != null ? state.units[t.unitId] : undefined;
      if (!unit) return 'Choose a unit';
      if (unit.owner !== HUMAN) return 'Choose one of your units';
      break;
    }
  }
  return def.canUse ? def.canUse(edictCtx(state, def.id, () => {}), t) : null;
}

export function useEdict(state: GameState, uid: Uid, t: EdictTargetArgs, emit: Emit): string | null {
  const err = useEdictError(state, uid, t);
  if (err) return err;
  const run = state.run;
  const inst = run.edicts.find((e) => e.uid === uid)!;
  const def = EDICTS[inst.id];
  run.edicts.splice(run.edicts.indexOf(inst), 1);
  def.use(edictCtx(state, def.id, emit), t);
  run.totals.extra.edictsUsed = (run.totals.extra.edictsUsed ?? 0) + 1;
  emit({ type: 'edictUsed', uid, id: def.id });
  return null;
}

export function discardEdict(state: GameState, uid: Uid): string | null {
  const run = state.run;
  if (run.phase === 'victory' || run.phase === 'defeat') return 'The run is over';
  const idx = run.edicts.findIndex((e) => e.uid === uid);
  if (idx < 0) return 'No such edict';
  run.edicts.splice(idx, 1);
  return null;
}
