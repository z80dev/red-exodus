// Map interaction layer (OWNER: UI-HUD). The renderer forwards tile taps / long-presses / hovers here; this module
// turns them into selections, previews (path, combat, tile info, improvement picker) and dispatched actions, and
// keeps the renderer's highlights in sync with the current selection & mode.
import { create } from 'zustand';
import { audio } from '../audio';
import type { SfxName } from '../audio';
import { EDICTS } from '../content';
import { cityTerritory, improvementOptions } from '../sim/cities';
import { attackTargets, cityStrikeTargets, previewAttack, previewCityStrike } from '../sim/combat';
import type { CombatPreview } from '../sim/combat';
import { makeCtx } from '../sim/effects';
import { neighbors } from '../sim/hex';
import { findPath, reachableTiles, turnsToReach } from '../sim/pathfinding';
import { nextAttention } from '../sim/selectors';
import { isCivilian } from '../sim/units';
import { HUMAN } from '../sim/types';
import type { Action, ActionResult, City, CityId, GameState, SimEvent, TileIdx, Unit, UnitId } from '../sim/types';
import { toast } from '../ui/hud/toast';
import { EMPTY_HIGHLIGHTS, getRenderer } from './bridge';
import type { Highlights } from './bridge';
import { useGame } from './store';

// ───────────────────────────── interaction state ─────────────────────────────
export type Preview =
  | { kind: 'tile'; idx: TileIdx }
  | { kind: 'path'; unitId: UnitId; target: TileIdx; path: TileIdx[]; turns: number }
  | { kind: 'combat'; unitId: UnitId; target: TileIdx; preview: CombatPreview }
  | { kind: 'strike'; cityId: CityId; target: TileIdx; preview: CombatPreview }
  | { kind: 'improve'; idx: TileIdx };

export interface TurnBanner { key: number; turn: number; era: number | null }

export interface InteractionState {
  preview: Preview | null;
  /** city whose ranged strike is being aimed */
  strikeCity: CityId | null;
  /** desktop hover path for the selected unit */
  hoverPath: TileIdx[];
  /** end-turn processing (AI turns + playback) in progress */
  endingTurn: boolean;
  turnBanner: TurnBanner | null;
}

export const useInteraction = create<InteractionState>(() => ({
  preview: null,
  strikeCity: null,
  hoverPath: [],
  endingTurn: false,
  turnBanner: null,
}));

const setUi = (p: Partial<InteractionState>) => useInteraction.setState(p);

function game(): GameState | null {
  return useGame.getState().state;
}

function inputBlocked(): boolean {
  const g = useGame.getState();
  const s = g.state;
  return !s || g.busy || useInteraction.getState().endingTurn || s.run.phase !== 'playing' || s.gameOver;
}

// ───────────────────────────── helpers ─────────────────────────────
export function unitsOnTile(s: GameState, idx: TileIdx): Unit[] {
  const out: Unit[] = [];
  for (const k in s.units) if (s.units[k].tile === idx) out.push(s.units[k]);
  return out;
}

export function cityOnTile(s: GameState, idx: TileIdx): City | null {
  for (const k in s.cities) if (s.cities[k].tile === idx) return s.cities[k];
  return null;
}

function isVisible(s: GameState, idx: TileIdx): boolean {
  return (s.players[HUMAN]?.vis[idx] ?? 0) === 2;
}

/** does the unit still need orders this turn? (for picking which of two stacked units to select) */
function needsOrders(u: Unit): boolean {
  return !!u.promotionChoices?.length || (u.moves > 0 && !u.order);
}

/** Run a player action; every failure surfaces as a toast. */
export function act(action: Action, okSfx?: SfxName): ActionResult {
  const res = useGame.getState().dispatch(action);
  if (!res.ok) {
    toast(res.error ?? 'That cannot be done right now.', 'bad');
    audio.sfx('error');
  } else if (okSfx) audio.sfx(okSfx);
  return res;
}

// ───────────────────────────── selection ─────────────────────────────
export function selectUnit(id: UnitId, opts: { focus?: boolean; quiet?: boolean } = {}): void {
  const s = game();
  const u = s?.units[id];
  if (!s || !u) return;
  const g = useGame.getState();
  g.select({ kind: 'unit', id });
  if (g.panel === 'city') g.setPanel('none');
  setUi({ preview: null, strikeCity: null, hoverPath: [] });
  if (!opts.quiet) audio.sfx('select');
  if (opts.focus) getRenderer()?.focusTile(u.tile, { animate: true });
}

export function selectCity(id: CityId, opts: { focus?: boolean; open?: boolean } = {}): void {
  const s = game();
  const c = s?.cities[id];
  if (!s || !c) return;
  const g = useGame.getState();
  g.select({ kind: 'city', id });
  if (opts.open !== false && c.owner === HUMAN) g.setPanel('city');
  setUi({ preview: null, strikeCity: null, hoverPath: [] });
  audio.sfx('open');
  if (opts.focus) getRenderer()?.focusTile(c.tile, { animate: true });
}

export function deselect(): void {
  const g = useGame.getState();
  if (g.selection) g.select(null);
  if (g.panel === 'city') g.setPanel('none');
  setUi({ preview: null, strikeCity: null, hoverPath: [] });
}

export function cancelPreview(): void {
  setUi({ preview: null });
}

/** leave edict targeting / improve mode / strike aiming */
export function cancelMode(): void {
  const g = useGame.getState();
  if (g.mode.kind !== 'normal') g.setMode({ kind: 'normal' });
  setUi({ strikeCity: null, preview: null });
  audio.sfx('close');
}

function showTile(idx: TileIdx, keepSelection: boolean): void {
  if (!keepSelection) useGame.getState().select({ kind: 'tile', idx });
  setUi({ preview: { kind: 'tile', idx }, hoverPath: [] });
}

// ───────────────────────────── taps ─────────────────────────────
export function onTileTap(idx: TileIdx): void {
  const s = game();
  if (!s || inputBlocked()) return;
  if (idx < 0 || idx >= s.map.tiles.length) {
    const g = useGame.getState();
    if (g.mode.kind !== 'normal' || useInteraction.getState().strikeCity != null) cancelMode();
    else deselect();
    return;
  }
  const g = useGame.getState();
  if (g.mode.kind === 'edictTarget') return tapEdict(s, g.mode.uid, idx);
  if (g.mode.kind === 'improve') return tapImprove(s, idx);
  const strike = useInteraction.getState().strikeCity;
  if (strike != null) return tapStrike(s, strike, idx);

  const sel = g.selection;
  const unit = sel?.kind === 'unit' ? s.units[sel.id] : undefined;
  if (unit && unit.owner === HUMAN && tapWithUnit(s, unit, idx)) return;
  tapFresh(s, idx);
}

export function onTileLongPress(idx: TileIdx): void {
  const s = game();
  if (!s || idx < 0 || idx >= s.map.tiles.length) return;
  if ((s.players[HUMAN]?.vis[idx] ?? 0) === 0) return;
  const hasSel = useGame.getState().selection != null;
  showTile(idx, hasSel);
  audio.sfx('open');
}

/** Desktop hover: preview the multi-turn path of the selected unit. */
export function onTileHover(idx: TileIdx | null): void {
  const s = game();
  const ui = useInteraction.getState();
  const g = useGame.getState();
  if (!s || ui.preview?.kind === 'path' || g.mode.kind !== 'normal' || ui.strikeCity != null) return;
  const sel = g.selection;
  const unit = sel?.kind === 'unit' ? s.units[sel.id] : undefined;
  if (idx == null || !unit || unit.owner !== HUMAN || idx === unit.tile || inputBlocked()) {
    if (ui.hoverPath.length) setUi({ hoverPath: [] });
    return;
  }
  if ((s.players[HUMAN]?.vis[idx] ?? 0) === 0 && !isAdjacentExplored(s, idx)) {
    if (ui.hoverPath.length) setUi({ hoverPath: [] });
    return;
  }
  const path = findPath(s, unit, idx);
  setUi({ hoverPath: path ?? [] });
}

/** unexplored tiles are valid goto targets only at the fog's edge (pathfinding assumes cost 1 there) */
function isAdjacentExplored(s: GameState, idx: TileIdx): boolean {
  const vis = s.players[HUMAN]?.vis ?? [];
  return neighbors(s.map, idx).some((n) => (vis[n] ?? 0) > 0);
}

function tapWithUnit(s: GameState, unit: Unit, idx: TileIdx): boolean {
  const ui = useInteraction.getState();
  if (idx === unit.tile) {
    const others = unitsOnTile(s, idx).filter((u) => u.owner === HUMAN && u.id !== unit.id);
    if (others.length) { selectUnit(others[0].id); return true; }
    const city = cityOnTile(s, idx);
    if (city && city.owner === HUMAN) { selectCity(city.id); return true; }
    deselect();
    audio.sfx('close');
    return true;
  }

  if (unit.moves > 0 && !unit.hasAttacked && attackTargets(s, unit).includes(idx)) {
    if (ui.preview?.kind === 'combat' && ui.preview.target === idx && ui.preview.unitId === unit.id) {
      confirmPreview();
      return true;
    }
    const preview = previewAttack(s, unit, idx);
    if (!preview) { toast('No valid target there.', 'bad'); audio.sfx('error'); return true; }
    setUi({ preview: { kind: 'combat', unitId: unit.id, target: idx, preview }, hoverPath: [] });
    audio.sfx('tap');
    return true;
  }

  if (unit.moves > 0 && reachableTiles(s, unit).some((r) => r.tile === idx)) {
    setUi({ preview: null, hoverPath: [] });
    act({ type: 'moveUnit', unitId: unit.id, to: idx }, 'move');
    return true;
  }

  const ownUnitThere = unitsOnTile(s, idx).some((u) => u.owner === HUMAN);
  const ownCityThere = cityOnTile(s, idx)?.owner === HUMAN;
  if (ownUnitThere || ownCityThere) return false;

  if (ui.preview?.kind === 'path' && ui.preview.target === idx && ui.preview.unitId === unit.id) {
    confirmPreview();
    return true;
  }
  const explored = (s.players[HUMAN]?.vis[idx] ?? 0) > 0 || isAdjacentExplored(s, idx);
  const path = explored ? findPath(s, unit, idx) : null;
  if (path && path.length) {
    const turns = turnsToReach(s, unit, idx);
    setUi({ preview: { kind: 'path', unitId: unit.id, target: idx, path, turns: Number.isFinite(turns) ? turns : path.length }, hoverPath: [] });
    audio.sfx('tap');
    return true;
  }
  return false;
}

function tapFresh(s: GameState, idx: TileIdx): void {
  const own = unitsOnTile(s, idx).filter((u) => u.owner === HUMAN);
  if (own.length) {
    const pick = own.find((u) => needsOrders(u) && !isCivilian(u.type)) ?? own.find(needsOrders) ?? own.find((u) => !isCivilian(u.type)) ?? own[0];
    selectUnit(pick.id);
    return;
  }
  const city = cityOnTile(s, idx);
  if (city && city.owner === HUMAN) { selectCity(city.id); return; }
  if ((s.players[HUMAN]?.vis[idx] ?? 0) === 0) { deselect(); return; }
  const ui = useInteraction.getState();
  if (ui.preview?.kind === 'tile' && ui.preview.idx === idx) { deselect(); audio.sfx('close'); return; }
  showTile(idx, false);
  audio.sfx('tap');
}

/** Confirm the pending path / combat / strike preview (second tap or the card's confirm button). */
export function confirmPreview(): void {
  const s = game();
  const p = useInteraction.getState().preview;
  if (!s || !p || inputBlocked()) return;
  if (p.kind === 'path') {
    setUi({ preview: null });
    act({ type: 'moveUnit', unitId: p.unitId, to: p.target }, 'move');
  } else if (p.kind === 'combat') {
    setUi({ preview: null });
    act({ type: 'attack', unitId: p.unitId, target: p.target }, 'attack');
  } else if (p.kind === 'strike') {
    setUi({ preview: null, strikeCity: null });
    act({ type: 'cityStrike', cityId: p.cityId, target: p.target }, 'attack');
  }
}

// ───────────────────────────── city strike ─────────────────────────────
export function startCityStrike(cityId: CityId): void {
  const s = game();
  const c = s?.cities[cityId];
  if (!s || !c || inputBlocked()) return;
  if (c.hasStruck) { toast(`${c.name} has already struck this turn.`, 'bad'); audio.sfx('error'); return; }
  const targets = cityStrikeTargets(s, c);
  if (!targets.length) { toast('No enemies within range of the walls.', 'info'); audio.sfx('error'); return; }
  const g = useGame.getState();
  g.setPanel('none');
  g.select({ kind: 'city', id: cityId });
  setUi({ strikeCity: cityId, preview: null });
  audio.sfx('select');
}

function tapStrike(s: GameState, cityId: CityId, idx: TileIdx): void {
  const c = s.cities[cityId];
  if (!c) { cancelMode(); return; }
  if (!cityStrikeTargets(s, c).includes(idx)) { cancelMode(); return; }
  const p = useInteraction.getState().preview;
  if (p?.kind === 'strike' && p.target === idx) { confirmPreview(); return; }
  const preview = previewCityStrike(s, c, idx);
  if (!preview) { toast('No valid target there.', 'bad'); audio.sfx('error'); return; }
  setUi({ preview: { kind: 'strike', cityId, target: idx, preview } });
  audio.sfx('tap');
}

// ───────────────────────────── improve mode ─────────────────────────────
let improveCache: { version: number; key: string; tiles: TileIdx[] } | null = null;

/** tiles where at least one improvement can be placed now (affordability is shown in the picker) */
export function improveTiles(s: GameState, cityId: CityId | null): TileIdx[] {
  const version = useGame.getState().version;
  const key = String(cityId);
  if (improveCache && improveCache.version === version && improveCache.key === key) return improveCache.tiles;
  const city = cityId != null ? s.cities[cityId] : null;
  const candidates = city ? cityTerritory(s, city) : s.map.tiles.filter((t) => t.owner === HUMAN).map((t) => t.idx);
  const tiles = candidates.filter((t) => {
    const tile = s.map.tiles[t];
    if (tile.owner !== HUMAN || cityOnTile(s, t)) return false;
    return improvementOptions(s, HUMAN, t).some((o) => o.placeable);
  });
  improveCache = { version, key, tiles };
  return tiles;
}

export function startImprove(cityId: CityId | null): void {
  const s = game();
  if (!s || inputBlocked()) return;
  const tiles = improveTiles(s, cityId);
  if (!tiles.length) { toast('No tiles here can be improved yet.', 'info'); audio.sfx('error'); return; }
  const g = useGame.getState();
  g.setPanel('none');
  g.setMode({ kind: 'improve', cityId });
  setUi({ preview: null, strikeCity: null });
  audio.sfx('open');
}

function tapImprove(s: GameState, idx: TileIdx): void {
  const g = useGame.getState();
  const cityId = g.mode.kind === 'improve' ? g.mode.cityId : null;
  if (improveTiles(s, cityId).includes(idx)) {
    setUi({ preview: { kind: 'improve', idx } });
    audio.sfx('tap');
    return;
  }
  cancelMode();
}

/** open the improvement picker for one owned tile (tile card / long-press shortcut) */
export function improveTile(idx: TileIdx): void {
  const s = game();
  if (!s || inputBlocked()) return;
  const t = s.map.tiles[idx];
  if (!t || t.owner !== HUMAN) return;
  const g = useGame.getState();
  g.setMode({ kind: 'improve', cityId: t.cityId });
  setUi({ preview: { kind: 'improve', idx }, strikeCity: null });
  audio.sfx('open');
}

export function buyImprovement(idx: TileIdx, improvement: string): void {
  const res = act({ type: 'buildImprovement', tile: idx, improvement }, 'build');
  if (res.ok) setUi({ preview: null });
}

// ───────────────────────────── edict targeting ─────────────────────────────
/** tiles that are valid targets for the edict instance `uid` */
export function edictTargets(s: GameState, uid: number): TileIdx[] {
  const inst = s.run.edicts.find((e) => e.uid === uid);
  const def = inst ? EDICTS[inst.id] : undefined;
  if (!inst || !def) return [];
  const vis = s.players[HUMAN]?.vis ?? [];
  let cands: { tile: TileIdx; cityId?: CityId; unitId?: UnitId }[] = [];
  switch (def.target) {
    case 'none':
      return [];
    case 'city':
      cands = Object.values(s.cities).filter((c) => c.owner === HUMAN).map((c) => ({ tile: c.tile, cityId: c.id }));
      break;
    case 'ownedTile':
      cands = s.map.tiles.filter((t) => t.owner === HUMAN).map((t) => ({ tile: t.idx }));
      break;
    case 'tile':
      cands = s.map.tiles.filter((t) => (vis[t.idx] ?? 0) > 0).map((t) => ({ tile: t.idx }));
      break;
    case 'unit':
      cands = Object.values(s.units).filter((u) => u.owner === HUMAN).map((u) => ({ tile: u.tile, unitId: u.id }));
      break;
  }
  if (!def.canUse) return [...new Set(cands.map((c) => c.tile))];
  const ctx = makeCtx(s, HUMAN, { kind: 'doctrine', id: def.id, hooks: {}, counters: {} }, () => {});
  const out = new Set<TileIdx>();
  for (const c of cands) if (!out.has(c.tile) && def.canUse(ctx, c) == null) out.add(c.tile);
  return [...out];
}

function tapEdict(s: GameState, uid: number, idx: TileIdx): void {
  const inst = s.run.edicts.find((e) => e.uid === uid);
  const def = inst ? EDICTS[inst.id] : undefined;
  if (!inst || !def) { cancelMode(); return; }
  if (!edictTargets(s, uid).includes(idx)) {
    toast(`Choose a highlighted target for ${def.name}.`, 'info');
    audio.sfx('error');
    return;
  }
  const action: Action = { type: 'useEdict', uid, target: idx };
  if (def.target === 'city') action.cityId = cityOnTile(s, idx)?.id;
  if (def.target === 'unit') {
    const own = unitsOnTile(s, idx).filter((u) => u.owner === HUMAN);
    action.unitId = (own.find((u) => !isCivilian(u.type)) ?? own[0])?.id;
  }
  const res = act(action, 'cardFlip');
  if (res.ok) useGame.getState().setMode({ kind: 'normal' });
}

// ───────────────────────────── attention / Next ─────────────────────────────
/** Next button: cycle to the attention item after the current selection. Returns false if nothing needs input. */
export function focusNext(): boolean {
  const s = game();
  if (!s || inputBlocked()) return false;
  const sel = useGame.getState().selection;
  const next = nextAttention(s, sel?.kind === 'unit' ? sel.id : undefined);
  if (!next) return false;
  if (next.kind === 'unit') selectUnit(next.id, { focus: true });
  else if (next.kind === 'city') selectCity(next.id, { focus: true });
  else {
    useGame.getState().setPanel('tech');
    audio.sfx('open');
  }
  return true;
}

// ───────────────────────────── end turn ─────────────────────────────
const MIN_ENDING_MS = 700;
const MAX_WAIT_MS = 9000;

// (tsconfig lib is ES2023: Promise.withResolvers is unavailable, hence executor-form promises below)
function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** resolves once the renderer finished playing back the batch (store.busy false) or after `timeout` */
function waitIdle(timeout: number): Promise<void> {
  if (!useGame.getState().busy) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => { clearTimeout(t); unsub(); resolve(); };
    const t = setTimeout(done, timeout);
    const unsub = useGame.subscribe((g) => { if (!g.busy) done(); });
  });
}

let bannerKey = 0;
export async function requestEndTurn(): Promise<void> {
  if (inputBlocked()) return;
  const start = performance.now();
  deselect();
  useGame.getState().setMode({ kind: 'normal' });
  setUi({ endingTurn: true });
  audio.sfx('endTurn');
  await nextFrame();
  const res = act({ type: 'endTurn' });
  await delay(Math.max(0, MIN_ENDING_MS - (performance.now() - start)));
  await nextFrame();
  await waitIdle(MAX_WAIT_MS);
  setUi({ endingTurn: false });
  const s = game();
  if (!res.ok || !s || s.gameOver) return;
  const era = res.events.find((e): e is Extract<SimEvent, { type: 'eraStarted' }> => e.type === 'eraStarted');
  setUi({ turnBanner: { key: ++bannerKey, turn: s.turn, era: era ? era.era : null } });
  if (s.run.phase === 'playing') {
    const first = nextAttention(s);
    if (first?.kind === 'unit') selectUnit(first.id, { focus: true, quiet: true });
  }
}

// ───────────────────────────── highlights ─────────────────────────────
export function computeHighlights(): Highlights {
  const s = game();
  if (!s) return EMPTY_HIGHLIGHTS;
  const g = useGame.getState();
  const ui = useInteraction.getState();
  if (s.run.phase !== 'playing' || ui.endingTurn) return EMPTY_HIGHLIGHTS;
  const h: Highlights = { selected: null, move: [], attack: [], path: [], cityTiles: [], improve: [], target: [] };

  if (g.mode.kind === 'edictTarget') {
    h.target = edictTargets(s, g.mode.uid);
    return h;
  }
  if (g.mode.kind === 'improve') {
    h.improve = improveTiles(s, g.mode.cityId);
    if (g.mode.cityId != null && s.cities[g.mode.cityId]) h.cityTiles = cityTerritory(s, s.cities[g.mode.cityId]);
    if (ui.preview?.kind === 'improve') h.selected = ui.preview.idx;
    return h;
  }
  if (ui.strikeCity != null && s.cities[ui.strikeCity]) {
    const c = s.cities[ui.strikeCity];
    h.selected = c.tile;
    h.attack = cityStrikeTargets(s, c);
    return h;
  }

  const sel = g.selection;
  if (sel?.kind === 'unit') {
    const u = s.units[sel.id];
    if (u) {
      h.selected = u.tile;
      if (u.owner === HUMAN && u.moves > 0) {
        h.move = reachableTiles(s, u).map((r) => r.tile);
        if (!u.hasAttacked) h.attack = attackTargets(s, u).filter((t) => isVisible(s, t));
      }
    }
  } else if (sel?.kind === 'city') {
    const c = s.cities[sel.id];
    if (c) {
      h.selected = c.tile;
      h.cityTiles = cityTerritory(s, c);
    }
  } else if (sel?.kind === 'tile') {
    h.selected = sel.idx;
  }
  const p = ui.preview;
  if (p?.kind === 'path') h.path = p.path;
  else if (ui.hoverPath.length) h.path = ui.hoverPath;
  if (p?.kind === 'tile' && sel?.kind !== 'unit') h.selected = p.idx;
  return h;
}

export function refreshHighlights(): void {
  getRenderer()?.setHighlights(computeHighlights());
}

/** drop selections/previews that no longer make sense after a state change (unit died, city captured…) */
function validate(): void {
  const s = game();
  if (!s) return;
  const g = useGame.getState();
  const sel = g.selection;
  if (sel?.kind === 'unit' && !s.units[sel.id]) g.select(null);
  if (sel?.kind === 'city' && (!s.cities[sel.id] || s.cities[sel.id].owner !== HUMAN)) {
    g.select(null);
    if (g.panel === 'city') g.setPanel('none');
  }
  const ui = useInteraction.getState();
  const p = ui.preview;
  if (p && ((p.kind === 'combat' || p.kind === 'path') && !s.units[p.unitId])) setUi({ preview: null });
  if (ui.strikeCity != null && (!s.cities[ui.strikeCity] || s.cities[ui.strikeCity].hasStruck)) setUi({ strikeCity: null });
  if (g.mode.kind === 'edictTarget' && !s.run.edicts.some((e) => g.mode.kind === 'edictTarget' && e.uid === g.mode.uid)) g.setMode({ kind: 'normal' });
  if (s.run.phase !== 'playing' && (g.mode.kind !== 'normal' || ui.preview)) {
    g.setMode({ kind: 'normal' });
    setUi({ preview: null, strikeCity: null });
  }
}

/** Wire store changes → validation + renderer highlights. Call once from GameScreen; returns the unsubscribe. */
export function bindInteraction(): () => void {
  let raf = 0;
  const schedule = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      refreshHighlights();
    });
  };
  const unGame = useGame.subscribe((g, prev) => {
    if (g.version !== prev.version || g.state !== prev.state) validate();
    if (g.version !== prev.version || g.selection !== prev.selection || g.mode !== prev.mode || g.state !== prev.state) {
      if (g.mode !== prev.mode && useInteraction.getState().preview?.kind === 'improve' && g.mode.kind !== 'improve') setUi({ preview: null });
      schedule();
    }
  });
  const unUi = useInteraction.subscribe((u, prev) => {
    if (u.preview !== prev.preview || u.strikeCity !== prev.strikeCity || u.hoverPath !== prev.hoverPath || u.endingTurn !== prev.endingTurn) schedule();
  });
  validate();
  schedule();
  return () => {
    cancelAnimationFrame(raf);
    unGame();
    unUi();
    getRenderer()?.setHighlights(EMPTY_HIGHLIGHTS);
    setUi({ preview: null, strikeCity: null, hoverPath: [], endingTurn: false, turnBanner: null });
  };
}
