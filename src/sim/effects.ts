// Unified effect pipeline. Collects every active EffectHooks source for a player in a stable order and
// invokes hooks. Rule modules call these; content never calls rule modules through here.
//
// Order (matters for the Chronicle): leader → ascension → reforms → natural wonders → wonders →
// buildings → doctrines (left→right, disabled skipped) → crisis (if active) → dark age.
import type { EffectHooks, EffectKind, HookCtx } from './defs';
import type { CityId, GameState, PlayerId, SimEvent, Uid } from './types';
import { HUMAN } from './types';
import {
  ASCENSIONS, BUILDINGS, CRISES, DOCTRINES, LEADERS, NATURAL_WONDERS, REFORMS, WONDERS,
} from '../content';
import { DARK_AGE_EFFECTS } from './roguelite/darkAge';

export interface ActiveEffect {
  kind: EffectKind;
  id: string;
  uid?: Uid;
  cityId?: CityId;
  hooks: EffectHooks;
  counters: Record<string, number>;
}

function counterBag(state: GameState, pid: PlayerId, key: string): Record<string, number> {
  const p = state.players.find((pl) => pl.id === pid)!;
  return (p.effectCounters[key] ??= {});
}

export function collectEffects(state: GameState, pid: PlayerId): ActiveEffect[] {
  const player = state.players.find((p) => p.id === pid);
  if (!player || !player.alive) return [];
  const out: ActiveEffect[] = [];
  const push = (kind: EffectKind, id: string, hooks: EffectHooks | undefined, extra?: Partial<ActiveEffect>) => {
    if (!hooks) return;
    const counters = extra?.counters ?? counterBag(state, pid, `${kind}:${id}${extra?.cityId != null ? `@${extra.cityId}` : ''}`);
    out.push({ kind, id, hooks, counters, ...extra });
  };

  const leader = LEADERS[player.leaderId];
  if (leader) push('leader', leader.id, leader.effects);

  const run = state.run;
  if (pid === HUMAN) {
    for (const a of ASCENSIONS) if (a.level <= run.ascension) push('ascension', String(a.level), a.effects);
    for (const r of run.reforms) push('reform', r, REFORMS[r]?.effects);
  }

  const seen = state.naturalWondersSeen[pid] ?? [];
  for (const nw of seen) {
    push('naturalWonder', nw, NATURAL_WONDERS[nw]?.effects);
  }

  const cities = Object.values(state.cities).filter((c) => c.owner === pid).sort((a, b) => a.order - b.order);
  for (const c of cities) for (const w of c.wonders) push('wonder', w, WONDERS[w]?.effects, { cityId: c.id });
  for (const c of cities) for (const b of c.buildings) push('building', b, BUILDINGS[b]?.effects, { cityId: c.id });

  if (pid === HUMAN) {
    for (const d of run.doctrines) {
      if (d.disabled) continue;
      push('doctrine', d.id, DOCTRINES[d.id]?.effects, { uid: d.uid, counters: d.counters });
    }
  }

  if (run.crisisActive && run.crisis) {
    const crisis = CRISES[run.crisis];
    if (crisis && (pid === HUMAN || crisis.affectsAll)) push('crisis', crisis.id, crisis.effects);
  }
  if (pid === HUMAN && run.darkAge) push('darkAge', 'darkAge', DARK_AGE_EFFECTS);
  return out;
}

export function makeCtx(state: GameState, pid: PlayerId, fx: ActiveEffect, emit: (ev: SimEvent) => void): HookCtx {
  const player = state.players.find((p) => p.id === pid)!;
  return {
    state,
    player,
    kind: fx.kind,
    id: fx.id,
    uid: fx.uid,
    cityId: fx.cityId,
    counters: fx.counters,
    emit,
    flash(text, tile) {
      if (fx.uid != null) emit({ type: 'doctrineTriggered', uid: fx.uid, text, tile });
    },
  };
}

type HookArgs<K extends keyof EffectHooks> = NonNullable<EffectHooks[K]> extends (ctx: HookCtx, ...rest: infer R) => void ? R : never;

/**
 * Invoke hook K on every active effect of `pid`, in order. Pass a precollected `effects` array when calling
 * in hot loops (e.g. tile yields for every tile) to avoid recollecting.
 */
export function runHook<K extends keyof EffectHooks>(
  state: GameState,
  pid: PlayerId,
  hook: K,
  emit: (ev: SimEvent) => void,
  effects: ActiveEffect[] | null,
  ...args: HookArgs<K>
): void {
  const list = effects ?? collectEffects(state, pid);
  for (const fx of list) {
    const fn = fx.hooks[hook] as ((ctx: HookCtx, ...a: HookArgs<K>) => void) | undefined;
    if (fn) fn(makeCtx(state, pid, fx, emit), ...args);
  }
}

/**
 * Per-state cache of effect lists for broadcastEvent (it runs for every event of every dispatch, and AI turns emit
 * hundreds). Invalidated when an event changes which effects exist, and by the engine at the start of each dispatch
 * (`invalidateEffectCache`) so non-event mutations (doctrine reorder, reform purchase) are always picked up.
 * Counters are shared references, so cached entries never hold stale counter values.
 */
const effectCache = new WeakMap<GameState, Map<PlayerId, ActiveEffect[]>>();
const STRUCTURAL_EVENTS: Partial<Record<SimEvent['type'], true>> = {
  cityFounded: true, cityCaptured: true, cityRazed: true, buildingBuilt: true, wonderBuilt: true, naturalWonderFound: true,
  playerEliminated: true, doctrineGained: true, doctrineLost: true, crisisBegan: true, crisisEnded: true, eraStarted: true,
  influenceChanged: true, chronicle: true,
};

export function invalidateEffectCache(state: GameState): void {
  effectCache.delete(state);
}

/** Broadcast a sim event to every living player's onEvent hooks. Called by the engine's emit pipeline. */
export function broadcastEvent(state: GameState, ev: SimEvent, emit: (ev: SimEvent) => void): void {
  if (STRUCTURAL_EVENTS[ev.type]) effectCache.delete(state);
  let byPlayer = effectCache.get(state);
  if (!byPlayer) effectCache.set(state, (byPlayer = new Map()));
  for (const p of state.players) {
    if (!p.alive) continue;
    let list = byPlayer.get(p.id);
    if (!list) byPlayer.set(p.id, (list = collectEffects(state, p.id).filter((fx) => fx.hooks.onEvent)));
    for (const fx of list) fx.hooks.onEvent!(makeCtx(state, p.id, fx, emit), ev);
  }
}
