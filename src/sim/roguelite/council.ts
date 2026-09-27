// The Council: the between-chapter shop (Balatro shop). DESIGN §5. Deterministic via state.rng.
import { collectEffects, makeCtx, runHook } from '../effects';
import type { DoctrineDef, EdictDef } from '../defs';
import { chance, random, randInt, weightedIndex } from '../rng';
import type { CouncilState, Edition, Emit, GameState, PillarId, Rarity, RunState, ShopItem, Uid } from '../types';
import { HUMAN, PILLARS } from '../types';
import { DOCTRINES, EDICTS, PILLAR_DEFS, REFORMS, SCROLLS } from '../../content';
import {
  DOCTRINE_PRICE, EDICT_PRICE_BY_RARITY, EDICT_SLOT_EDICT_CHANCE, EDITION_CHANCE, EDITION_PRICE, PACK_WEIGHTS, PACKS,
  RARITY_WEIGHTS_PACK, RARITY_WEIGHTS_SHOP, REROLL_BASE, REROLL_STEP, SCROLL_PRICE, SHOP_DOCTRINE_SLOTS, SHOP_PACK_SLOTS,
} from './constants';
import { addInfluence, grantDoctrine } from './run';
import { markSeen } from './stats';

const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'legendary'];

/** doctrines occupying a slot (ethereal doctrines are free) */
export function doctrineSlotsUsed(run: RunState): number {
  let n = 0;
  for (const d of run.doctrines) if (d.edition !== 'ethereal') n++;
  return n;
}

export function edictSlotsFree(run: RunState): number {
  return Math.max(0, run.edictSlots - run.edicts.length);
}

/** Council price of a doctrine: rarity price + edition surcharge */
export function doctrinePrice(rarity: Rarity, edition: Edition): number {
  return DOCTRINE_PRICE[rarity] + EDITION_PRICE[edition];
}

/** default sell value for a doctrine bought/granted at `price`: half, min 1 */
export function sellValueFor(price: number): number {
  return Math.max(1, Math.floor(price / 2));
}

function edictPrice(def: EdictDef): number {
  return def.cost > 0 ? def.cost : EDICT_PRICE_BY_RARITY[def.rarity];
}

function isLocked(state: GameState, id: string): boolean {
  return state.config.locked?.includes(id) ?? false;
}

/** rarity-weighted pick from `pool`, only among rarities that have candidates */
function rollByRarity<T extends { rarity: Rarity }>(state: GameState, pool: T[], weights: Record<Rarity, number>): T | null {
  const w = RARITIES.map((r) => (pool.some((d) => d.rarity === r) ? weights[r] : 0));
  if (!w.some((x) => x > 0)) return null;
  const rarity = RARITIES[weightedIndex(state.rng, w)];
  const bucket = pool.filter((d) => d.rarity === rarity);
  return bucket[randInt(state.rng, bucket.length)];
}

function doctrinePool(state: GameState, exclude: Set<string>): DoctrineDef[] {
  const owned = new Set(state.run.doctrines.map((d) => d.id));
  return Object.values(DOCTRINES).filter((d) => !d.noShop && !owned.has(d.id) && !exclude.has(d.id) && !isLocked(state, d.id));
}

export function rollEdition(state: GameState): Edition {
  let r = random(state.rng);
  for (const e of ['ethereal', 'prismatic', 'radiant', 'gilded'] as const) {
    if (r < EDITION_CHANCE[e]) return e;
    r -= EDITION_CHANCE[e];
  }
  return 'base';
}

/** roll a doctrine not owned / not already offered; `exclude` is updated */
export function rollDoctrine(state: GameState, exclude: Set<string>, inPack: boolean, rarity?: Rarity): { id: string; rarity: Rarity } | null {
  let pool = doctrinePool(state, exclude);
  if (rarity) {
    const exact = pool.filter((d) => d.rarity === rarity);
    if (exact.length) pool = exact;
  }
  const def = rollByRarity(state, pool, inPack ? RARITY_WEIGHTS_PACK : RARITY_WEIGHTS_SHOP)
    ?? (inPack ? null : rollByRarity(state, pool, RARITY_WEIGHTS_PACK));
  if (!def) return null;
  exclude.add(def.id);
  return { id: def.id, rarity: def.rarity };
}

function doctrineItem(state: GameState, exclude: Set<string>, inPack: boolean): ShopItem | null {
  const d = rollDoctrine(state, exclude, inPack);
  if (!d) return null;
  const edition = rollEdition(state);
  markSeen(state.run, `doctrine:${d.id}`);
  return { kind: 'doctrine', id: d.id, edition, price: inPack ? 0 : doctrinePrice(d.rarity, edition) };
}

export function rollEdict(state: GameState, exclude: Set<string>, inPack: boolean): EdictDef | null {
  const pool = Object.values(EDICTS).filter((e) => !exclude.has(e.id) && !isLocked(state, e.id));
  const def = rollByRarity(state, pool, inPack ? RARITY_WEIGHTS_PACK : RARITY_WEIGHTS_SHOP) ?? rollByRarity(state, pool, RARITY_WEIGHTS_PACK);
  if (def) exclude.add(def.id);
  return def;
}

function edictItem(state: GameState, exclude: Set<string>, inPack: boolean): ShopItem | null {
  const def = rollEdict(state, exclude, inPack);
  if (!def) return null;
  markSeen(state.run, `edict:${def.id}`);
  return { kind: 'edict', id: def.id, price: inPack ? 0 : edictPrice(def) };
}

export function rollScroll(state: GameState, exclude: Set<string>): string | null {
  const pool = Object.values(SCROLLS).filter((s) => !exclude.has(s.id));
  const weights = pool.map((s) => Math.max(0, s.weight ?? 1));
  if (!weights.some((w) => w > 0)) return null;
  const s = pool[weightedIndex(state.rng, weights)];
  exclude.add(s.id);
  return s.id;
}

function scrollItem(state: GameState, exclude: Set<string>, inPack: boolean): ShopItem | null {
  const id = rollScroll(state, exclude);
  if (!id) return null;
  const def = SCROLLS[id];
  return { kind: 'scroll', id, price: inPack ? 0 : def.cost > 0 ? def.cost : SCROLL_PRICE };
}

function edictOrScrollItem(state: GameState, exclude: Set<string>): ShopItem | null {
  const edictFirst = chance(state.rng, EDICT_SLOT_EDICT_CHANCE);
  return edictFirst
    ? edictItem(state, exclude, false) ?? scrollItem(state, exclude, false)
    : scrollItem(state, exclude, false) ?? edictItem(state, exclude, false);
}

/** can a pack of this kind produce at least one option right now? */
function packAvailable(state: GameState, pack: 'doctrine' | 'archive' | 'edict'): boolean {
  if (pack === 'doctrine') return doctrinePool(state, new Set()).length > 0;
  if (pack === 'edict') return Object.values(EDICTS).some((e) => !isLocked(state, e.id));
  return Object.values(SCROLLS).some((sc) => (sc.weight ?? 1) > 0);
}

function packItem(state: GameState): ShopItem | null {
  const choices = PACK_WEIGHTS.filter((p) => packAvailable(state, p.pack));
  if (!choices.length) return null;
  const p = choices[weightedIndex(state.rng, choices.map((x) => x.weight))];
  return { kind: 'pack', pack: p.pack, size: p.size, price: PACKS[p.pack][p.size].price };
}

function reformItem(state: GameState): ShopItem | null {
  const owned = new Set(state.run.reforms);
  const pool = Object.values(REFORMS).filter((r) => !owned.has(r.id) && (r.tier === 1 || !r.requires || owned.has(r.requires)));
  if (!pool.length) return null;
  const r = pool[randInt(state.rng, pool.length)];
  markSeen(state.run, `reform:${r.id}`);
  return { kind: 'reform', id: r.id, price: r.cost };
}

/** ids already on offer (avoid duplicates across slots) */
function offeredIds(c: CouncilState): Set<string> {
  const s = new Set<string>();
  for (const it of c.items) if (it && it.kind !== 'pack') s.add(it.id);
  return s;
}

/** layout: [doctrine, doctrine, edict|scroll, pack, pack, reform?] (reform only in the first council of an era) */
export function generateCouncil(state: GameState, emit: Emit): void {
  const run = state.run;
  const exclude = new Set<string>();
  const items: (ShopItem | null)[] = [];
  for (let i = 0; i < SHOP_DOCTRINE_SLOTS; i++) items.push(doctrineItem(state, exclude, false));
  items.push(edictOrScrollItem(state, exclude));
  for (let i = 0; i < SHOP_PACK_SLOTS; i++) items.push(packItem(state));
  if (run.chapter === 0) {
    const reform = reformItem(state);
    if (reform) items.push(reform);
  }
  run.council = { items, rerollCost: REROLL_BASE, rerolls: 0, pack: null };
  runHook(state, HUMAN, 'council', emit, null, { council: run.council, reroll: false });
}

export function councilRerollError(state: GameState): string | null {
  const c = state.run.council;
  if (state.run.phase !== 'council' || !c) return 'The Council is not in session';
  if (c.pack) return 'Choose from the open pack first';
  if (state.run.influence < c.rerollCost) return 'Not enough Influence';
  return null;
}

export function councilReroll(state: GameState, emit: Emit): string | null {
  const err = councilRerollError(state);
  if (err) return err;
  const c = state.run.council!;
  addInfluence(state, -c.rerollCost, emit);
  c.rerolls++;
  c.rerollCost += REROLL_STEP;
  // hooks re-add their extra cards on every call, so drop all cards (and sold slots) and rebuild the base cards
  const kept = c.items.filter((it): it is ShopItem => it != null && (it.kind === 'pack' || it.kind === 'reform'));
  const exclude = new Set<string>();
  const cards: (ShopItem | null)[] = [];
  for (let i = 0; i < SHOP_DOCTRINE_SLOTS; i++) cards.push(doctrineItem(state, exclude, false));
  cards.push(edictOrScrollItem(state, exclude));
  c.items = [...cards, ...kept];
  runHook(state, HUMAN, 'council', emit, null, { council: c, reroll: true });
  return null;
}

/** why an item can't be taken (buy or pack pick), or null */
function acquireError(state: GameState, item: ShopItem): string | null {
  const run = state.run;
  switch (item.kind) {
    case 'doctrine':
      if (!DOCTRINES[item.id]) return 'Unknown doctrine';
      if (run.doctrines.some((d) => d.id === item.id)) return 'Doctrine already adopted';
      if (item.edition !== 'ethereal' && doctrineSlotsUsed(run) >= run.doctrineSlots) return 'Doctrine slots full — sell one first';
      return null;
    case 'edict':
      if (!EDICTS[item.id]) return 'Unknown edict';
      return edictSlotsFree(run) > 0 ? null : 'Edict slots full — use or discard one first';
    case 'scroll':
      return SCROLLS[item.id] ? null : 'Unknown scroll';
    case 'reform':
      if (!REFORMS[item.id]) return 'Unknown reform';
      return run.reforms.includes(item.id) ? 'Reform already enacted' : null;
    case 'pack':
      return packAvailable(state, item.pack) ? null : 'Nothing left to find in this pack';
  }
}

export function councilBuyError(state: GameState, slot: number): string | null {
  const run = state.run;
  const c = run.council;
  if (run.phase !== 'council' || !c) return 'The Council is not in session';
  if (c.pack) return 'Choose from the open pack first';
  const item = c.items[slot];
  if (!item) return 'Sold out';
  if (run.influence < item.price) return 'Not enough Influence';
  return acquireError(state, item);
}

/** apply a scroll: +1 pillar level */
/** apply a scroll: raise its pillar (or the focus pillar / every pillar) by `levels` */
export function applyScroll(state: GameState, id: string, emit: Emit): void {
  const def = SCROLLS[id];
  if (!def) return;
  const run = state.run;
  const levels = Math.max(1, def.levels ?? 1);
  const targets: PillarId[] = def.scope === 'all' ? [...PILLARS] : def.scope === 'focus' ? [run.focus] : [def.pillar];
  for (const p of targets) run.pillarLevels[p] = (run.pillarLevels[p] ?? 1) + levels;
  markSeen(run, `scroll:${id}`);
  const text = targets.length === 1
    ? `${def.name}: ${PILLAR_DEFS[targets[0]].name} reaches level ${run.pillarLevels[targets[0]]}`
    : `${def.name}: every Pillar rises ${levels} level${levels > 1 ? 's' : ''}`;
  emit({ type: 'notify', text, icon: targets.length === 1 ? targets[0] : 'scroll', tone: 'good' });
}

export function addEdict(state: GameState, id: string): Uid | null {
  const run = state.run;
  if (!EDICTS[id] || edictSlotsFree(run) <= 0) return null;
  const uid = run.nextUid++;
  run.edicts.push({ uid, id });
  markSeen(run, `edict:${id}`);
  return uid;
}

export function enactReform(state: GameState, id: string, emit: Emit): void {
  const run = state.run;
  if (run.reforms.includes(id) || !REFORMS[id]) return;
  run.reforms.push(id);
  markSeen(run, `reform:${id}`);
  const fx = collectEffects(state, HUMAN).find((f) => f.kind === 'reform' && f.id === id);
  if (fx?.hooks.onGain) fx.hooks.onGain(makeCtx(state, HUMAN, fx, emit));
}

/** take an item (already validated & paid) */
function acquire(state: GameState, item: ShopItem, emit: Emit): void {
  const run = state.run;
  switch (item.kind) {
    case 'doctrine': {
      const err = grantDoctrine(state, item.id, item.edition, emit);
      if (!err && item.price > 0) run.doctrines[run.doctrines.length - 1].sellValue = sellValueFor(item.price);
      break;
    }
    case 'edict':
      addEdict(state, item.id);
      break;
    case 'scroll':
      applyScroll(state, item.id, emit);
      break;
    case 'reform':
      enactReform(state, item.id, emit);
      break;
    case 'pack':
      openPack(state, item);
      break;
  }
}

function packOptions(state: GameState, pack: 'doctrine' | 'archive' | 'edict', count: number, exclude: Set<string>): ShopItem[] {
  const options: ShopItem[] = [];
  for (let i = 0; i < count; i++) {
    const opt = pack === 'doctrine' ? doctrineItem(state, exclude, true)
      : pack === 'edict' ? edictItem(state, exclude, true)
        : scrollItem(state, exclude, true);
    if (opt) options.push(opt);
  }
  return options;
}

function openPack(state: GameState, item: Extract<ShopItem, { kind: 'pack' }>): void {
  const spec = PACKS[item.pack][item.size];
  // prefer cards not already on the shelf; small pools may repeat them
  let options = packOptions(state, item.pack, spec.options, offeredIds(state.run.council!));
  if (options.length < spec.options) {
    const exclude = new Set(options.map((o) => (o.kind === 'pack' ? '' : o.id)));
    options = [...options, ...packOptions(state, item.pack, spec.options - options.length, exclude)];
  }
  state.run.council!.pack = options.length ? { options, picks: spec.picks } : null;
}

export function councilBuy(state: GameState, slot: number, emit: Emit): string | null {
  const err = councilBuyError(state, slot);
  if (err) return err;
  const c = state.run.council!;
  const item = c.items[slot]!;
  if (item.price) addInfluence(state, -item.price, emit);
  c.items[slot] = null;
  acquire(state, item, emit);
  return null;
}

export function packPickError(state: GameState, index: number | null): string | null {
  const c = state.run.council;
  if (state.run.phase !== 'council' || !c?.pack) return 'No pack is open';
  if (index == null) return null;
  const opt = c.pack.options[index];
  if (!opt) return 'Invalid choice';
  return acquireError(state, opt);
}

export function packPick(state: GameState, index: number | null, emit: Emit): string | null {
  const err = packPickError(state, index);
  if (err) return err;
  const c = state.run.council!;
  const pack = c.pack!;
  if (index == null) {
    c.pack = null;
    return null;
  }
  const [opt] = pack.options.splice(index, 1);
  pack.picks--;
  if (pack.picks <= 0 || pack.options.length === 0) c.pack = null;
  acquire(state, opt, emit);
  return null;
}

export function sellDoctrine(state: GameState, uid: Uid, emit: Emit): string | null {
  const run = state.run;
  if (!['council', 'playing', 'chapterStart'].includes(run.phase)) return 'Cannot sell doctrines now';
  const idx = run.doctrines.findIndex((d) => d.uid === uid);
  if (idx < 0) return 'No such doctrine';
  const inst = run.doctrines[idx];
  // disabled (e.g. Iconoclasm) doctrines still undo their onGain when sold
  const hooks = DOCTRINES[inst.id]?.effects;
  if (hooks?.onLose) hooks.onLose(makeCtx(state, HUMAN, { kind: 'doctrine', id: inst.id, uid, hooks, counters: inst.counters }, emit));
  const at = run.doctrines.findIndex((d) => d.uid === uid);
  if (at >= 0) run.doctrines.splice(at, 1);
  emit({ type: 'doctrineLost', uid, id: inst.id });
  addInfluence(state, Math.max(0, Math.floor(inst.sellValue)), emit);
  return null;
}

export function moveDoctrine(state: GameState, uid: Uid, toIndex: number): string | null {
  const run = state.run;
  if (run.phase === 'victory' || run.phase === 'defeat') return 'The run is over';
  const idx = run.doctrines.findIndex((d) => d.uid === uid);
  if (idx < 0) return 'No such doctrine';
  const [inst] = run.doctrines.splice(idx, 1);
  const to = Math.max(0, Math.min(run.doctrines.length, Math.floor(toIndex)));
  run.doctrines.splice(to, 0, inst);
  return null;
}

