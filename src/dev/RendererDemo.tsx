// Renderer harness: `?dev=RendererDemo` — the real sim driving the map renderer in isolation.
// Params: reveal=1, era=0..5, showcase=1 (grown empire fixture), q=low|high, attract=1, seed=<s>, size=small|standard|large.
// Tap your unit → move/attack highlights; tap a highlighted tile to act; buttons trigger showcase fx.
import { useEffect, useRef, useState } from 'react';
import { BUILDINGS, IMPROVEMENTS, LEADERS, RESOURCES, WONDERS } from '../content';
import type { Highlights } from '../game/bridge';
import { EMPTY_HIGHLIGHTS } from '../game/bridge';
import { applyAction, createGame } from '../sim/engine';
import { findPath, reachableTiles } from '../sim/pathfinding';
import type { GameState, MapSize, SimEvent, TileIdx } from '../sim/types';
import { HUMAN } from '../sim/types';
import { AeonsRenderer } from '../render/AeonsRenderer';
import { ALL_MODEL_KEYS } from '../render/assets/manifest';
import { neighborsOf, hexDist } from '../render/hexgeo';
import { Overlay } from '../render/OverlayLayer';
import '../render/overlay.css';

const params = new URLSearchParams(location.search);

function newState(): GameState {
  const seed = params.get('seed') ?? 'AEONS-MENU';
  const size = (params.get('size') ?? 'small') as MapSize;
  const { state } = createGame({ seed, leaderId: Object.keys(LEADERS)[0], ascension: 0, mapSize: size, rivals: 3, tutorial: false, daily: false });
  applyAction(state, { type: 'ackCrisis' });
  applyAction(state, { type: 'chooseChapterStart', focus: 'arts', omen: null });
  return state;
}

/** grow every civ so cities, walls, landmarks, wonders, improvements and many units are on screen */
function showcase(state: GameState): void {
  const map = state.map;
  // found a capital for each civ with its settler
  for (const u of Object.values(state.units)) if (u.type === 'settler') applyAction(state, { type: 'foundCity', unitId: u.id });
  for (const p of state.players) {
    if (p.id === 99) continue;
    const era = Number(params.get('era') ?? 3);
    p.techs = Object.values(BUILDINGS).filter((b) => b.era <= era && b.tech).map((b) => b.tech!).filter((t, i, a) => a.indexOf(t) === i);
  }
  const allLandmarks = Object.values(BUILDINGS).filter((b) => b.model).map((b) => b.id);
  const wonders = Object.keys(WONDERS);
  let wi = 0;
  for (const c of Object.values(state.cities)) {
    c.pop = c.owner === HUMAN ? 13 : 6 + (c.id % 5);
    c.buildings = ['walls', ...allLandmarks.slice((c.id * 3) % 6, (c.id * 3) % 6 + (c.owner === HUMAN ? 6 : 3))];
    if (c.owner === HUMAN) c.buildings.push('castle');
    c.wonders = wonders.slice(wi, wi + (c.owner === HUMAN ? 3 : 1));
    wi += c.wonders.length;
    for (const w of c.wonders) state.wonderOwners[w] = c.id;
    // territory ring 2 + improvements on it
    for (const t of map.tiles) {
      if (hexDist(map, t.idx, c.tile) <= 2 && t.owner === null) {
        t.owner = c.owner;
        t.cityId = c.id;
      }
    }
    for (const n of neighborsOf(map, c.tile)) {
      const t = map.tiles[n];
      if (t.elevation === 'mountain' || t.improvement) continue;
      const res = t.resource ? RESOURCES[t.resource] : null;
      const imp = res?.improvement ?? (t.terrain === 'coast' ? 'fishing_boats' : t.elevation === 'hills' ? 'mine' : t.feature === 'forest' ? 'lumbermill' : ['grassland', 'plains'].includes(t.terrain) ? 'farm' : null);
      if (imp && IMPROVEMENTS[imp]) t.improvement = imp;
    }
  }
  // spread some units around the human capital
  const cap = Object.values(state.cities).find((c) => c.owner === HUMAN);
  if (cap) {
    const types = ['swordsman', 'archer', 'knight', 'catapult', 'musketman', 'cannon', 'tank', 'infantry'];
    let k = 0;
    for (const t of map.tiles) {
      if (k >= types.length) break;
      if (hexDist(map, t.idx, cap.tile) !== 2 || t.terrain === 'ocean' || t.elevation === 'mountain') continue;
      if (Object.values(state.units).some((u) => u.tile === t.idx)) continue;
      const id = state.nextId++;
      state.units[id] = { id, owner: k % 3 === 2 ? 1 : HUMAN, type: types[k], tile: t.idx, hp: k % 2 ? 100 : 55, moves: 2, hasAttacked: false, xp: 0, level: 1, promotions: [], promotionChoices: k === 1 ? ['a', 'b'] : null, order: null, fortifyTurns: 0, age: 0 };
      k++;
    }
  }
}

export default function RendererDemo() {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [r, setR] = useState<AeonsRenderer | null>(null);
  const [info, setInfo] = useState('');
  const [log, setLog] = useState('');
  const stateRef = useRef<GameState | null>(null);
  const hiRef = useRef<Highlights>(EMPTY_HIGHLIGHTS);
  const selRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const host = hostRef.current!;
    const state = newState();
    if (params.get('showcase')) showcase(state);
    stateRef.current = state;
    const run = (events: SimEvent[]) => {
      void renderer.play(events, state).then(() => renderer.sync(state));
    };
    const select = (unitId: number | null) => {
      selRef.current = unitId;
      if (unitId === null) {
        hiRef.current = EMPTY_HIGHLIGHTS;
      } else {
        const u = state.units[unitId];
        const move = reachableTiles(state, u).map((x) => x.tile).filter((t) => t !== u.tile);
        const attack = Object.values(state.units).filter((o) => o.owner !== HUMAN && hexDist(state.map, o.tile, u.tile) <= 1).map((o) => o.tile);
        hiRef.current = { ...EMPTY_HIGHLIGHTS, selected: u.tile, move, attack };
      }
      renderer.setHighlights(hiRef.current);
    };
    const renderer = new AeonsRenderer(
      canvas,
      {
        onTileTap: (idx: TileIdx) => {
          const sel = selRef.current;
          const mine = Object.values(state.units).find((u) => u.tile === idx && u.owner === HUMAN);
          if (sel !== null && hiRef.current.attack.includes(idx)) {
            const res = applyAction(state, { type: 'attack', unitId: sel, target: idx });
            setLog(res.ok ? `attack: ${res.events.map((e) => e.type).join(', ')}` : `attack failed: ${res.error}`);
            select(null);
            if (res.ok) run(res.events);
            return;
          }
          if (sel !== null && idx !== state.units[sel]?.tile && !mine) {
            const res = applyAction(state, { type: 'moveUnit', unitId: sel, to: idx });
            setLog(res.ok ? `move: ${res.events.map((e) => e.type).join(', ')}` : `move failed: ${res.error}`);
            select(null);
            if (res.ok) run(res.events);
            return;
          }
          select(mine ? mine.id : null);
        },
        onTileLongPress: (idx: TileIdx) => {
          const t = state.map.tiles[idx];
          setLog(`long-press #${idx}: ${t.terrain}/${t.elevation}/${t.feature ?? '-'} res=${t.resource ?? '-'} imp=${t.improvement ?? '-'} owner=${t.owner ?? '-'}`);
        },
        onTileHover: (idx: TileIdx | null) => {
          const sel = selRef.current;
          if (sel === null || idx === null) return;
          const u = state.units[sel];
          const path = u ? findPath(state, u, idx) : null;
          hiRef.current = { ...hiRef.current, path: path ?? [] };
          renderer.setHighlights(hiRef.current);
        },
      },
      params.get('q') === 'low' ? 'low' : 'high',
    );
    (window as unknown as { __r: AeonsRenderer; __s: GameState }).__r = renderer;
    (window as unknown as { __r: AeonsRenderer; __s: GameState }).__s = state;
    if (params.get('reveal') || params.get('attract')) renderer.reveal = true;
    renderer.units.reveal = renderer.reveal;
    renderer.sync(state);
    if (params.get('era')) {
      state.run.era = Number(params.get('era'));
      renderer.sync(state);
    }
    if (params.get('attract')) renderer.setAttractMode(true);
    const cap = Object.values(state.cities).find((c) => c.owner === HUMAN);
    const focus = cap?.tile ?? state.map.starts[HUMAN];
    if (!params.get('attract')) renderer.focusTile(focus, { animate: false, zoom: params.get('zoom') as 'near' | 'mid' | 'far' | null ?? 'mid' });
    setR(renderer);
    const ro = new ResizeObserver(() => renderer.resize());
    ro.observe(host);
    const iv = window.setInterval(() => {
      const s = renderer.stats;
      const missing = ALL_MODEL_KEYS.filter((k) => !renderer.lib.hasGlb(k));
      setInfo(`${s.fps} fps · ${s.frameMs.toFixed(1)} ms cpu · ${s.drawCalls} calls · ${(s.triangles / 1000).toFixed(0)}k tris · GLB ${ALL_MODEL_KEYS.length - missing.length}/${ALL_MODEL_KEYS.length}${renderer.lib.errors.length ? ` · ${renderer.lib.errors.length} load errors` : ''}`);
    }, 500);
    return () => {
      window.clearInterval(iv);
      ro.disconnect();
      renderer.dispose();
    };
  }, []);

  const state = stateRef.current;
  const btn = (label: string, fn: () => void) => (
    <button type="button" onClick={fn} style={{ font: '600 12px var(--font-ui)', padding: '6px 9px', borderRadius: 8, border: '1px solid var(--glass-border)', background: 'var(--glass)', color: 'var(--text)' }}>
      {label}
    </button>
  );
  const play = (events: SimEvent[]) => {
    if (!r || !state) return;
    void r.play(events, state).then(() => r.sync(state));
  };
  const humanUnit = () => (state ? Object.values(state.units).find((u) => u.owner === HUMAN && u.type !== 'settler') : undefined);
  const humanCity = () => (state ? Object.values(state.cities).find((c) => c.owner === HUMAN) : undefined);

  return (
    <div ref={hostRef} className="ae-stage">
      <canvas ref={canvasRef} />
      <div className="ae-vignette" />
      {r && <Overlay store={r.overlay} />}
      {!params.get('clean') && (
        <div style={{ position: 'absolute', left: 8, top: 8, right: 8, display: 'flex', flexWrap: 'wrap', gap: 6, zIndex: 10, pointerEvents: 'auto' }}>
          <div style={{ width: '100%', font: '600 12px var(--font-ui)', color: '#fff', textShadow: '0 1px 2px #000' }}>{info}</div>
          {btn('Reveal', () => {
            if (!r || !state) return;
            r.reveal = !r.reveal;
            r.units.reveal = r.reveal;
            r.setAttractMode(false);
            r.sync(state);
          })}
          {btn('Quality', () => r?.setQuality(r.quality === 'high' ? 'low' : 'high'))}
          {btn('Era+', () => {
            if (!r || !state) return;
            state.run.era = (state.run.era + 1) % 6;
            play([{ type: 'eraStarted', era: state.run.era }]);
          })}
          {btn('Attract', () => r?.setAttractMode(!r.rig.attract))}
          {btn('End turn', () => {
            if (!state) return;
            const res = applyAction(state, { type: 'endTurn' });
            setLog(res.ok ? `endTurn: ${res.events.length} events` : `endTurn failed: ${res.error}`);
            if (res.ok) play(res.events);
          })}
          {btn('Found', () => {
            if (!state) return;
            const s = Object.values(state.units).find((u) => u.owner === HUMAN && u.type === 'settler');
            if (!s) return setLog('no settler');
            const res = applyAction(state, { type: 'foundCity', unitId: s.id });
            setLog(res.ok ? 'founded' : `found failed: ${res.error}`);
            if (res.ok) play(res.events);
          })}
          {btn('Wonder', () => {
            const c = humanCity();
            if (c) play([{ type: 'wonderBuilt', cityId: c.id, player: HUMAN, wonder: c.wonders[0] ?? 'pyramids' }]);
          })}
          {btn('Build', () => {
            const c = humanCity();
            if (c) play([{ type: 'buildingBuilt', cityId: c.id, player: HUMAN, building: 'library' }]);
          })}
          {btn('Tech', () => play([{ type: 'techResearched', player: HUMAN, tech: 'writing' }]))}
          {btn('Melee', () => {
            const u = humanUnit();
            if (!u || !state) return;
            const target = Object.values(state.units).find((o) => o.id !== u.id);
            if (!target) return;
            play([{ type: 'combat', attacker: { player: HUMAN, unitId: u.id, tile: u.tile }, defender: { player: target.owner, unitId: target.id, tile: target.tile }, ranged: false, dmgToAttacker: 12, dmgToDefender: 34, attackerKilled: false, defenderKilled: false }]);
          })}
          {btn('Ranged', () => {
            const u = humanUnit();
            if (!u || !state) return;
            const target = Object.values(state.units).find((o) => o.id !== u.id && o.owner !== HUMAN) ?? Object.values(state.units).find((o) => o.id !== u.id);
            if (!target) return;
            play([{ type: 'combat', attacker: { player: HUMAN, unitId: u.id, tile: u.tile }, defender: { player: target.owner, unitId: target.id, tile: target.tile }, ranged: true, dmgToAttacker: 0, dmgToDefender: 28, attackerKilled: false, defenderKilled: false }]);
          })}
          {btn('Level', () => {
            const u = humanUnit();
            if (u) play([{ type: 'unitLevelUp', unitId: u.id, player: HUMAN }]);
          })}
          {btn('Kill', () => {
            if (!state) return;
            const u = Object.values(state.units).find((o) => o.owner !== HUMAN) ?? humanUnit();
            if (!u) return;
            delete state.units[u.id];
            play([{ type: 'unitDied', unitId: u.id, player: u.owner, tile: u.tile, unitType: u.type }]);
          })}
          {btn('Improve', () => {
            const c = humanCity();
            if (!c || !state) return;
            const t = neighborsOf(state.map, c.tile).map((i) => state.map.tiles[i]).find((x) => !x.improvement && ['grassland', 'plains'].includes(x.terrain) && x.elevation === 'flat');
            if (!t) return;
            t.improvement = 'farm';
            t.feature = null;
            play([{ type: 'improvementBuilt', tile: t.idx, player: HUMAN, improvement: 'farm' }]);
          })}
          {btn('Border', () => {
            const c = humanCity();
            if (!c || !state) return;
            const ring = state.map.tiles.filter((t) => t.owner === null && hexDist(state.map, t.idx, c.tile) === 3).slice(0, 4);
            for (const t of ring) {
              t.owner = HUMAN;
              t.cityId = c.id;
            }
            play([{ type: 'borderGrew', cityId: c.id, player: HUMAN, tiles: ring.map((t) => t.idx) }]);
          })}
          {log && <div style={{ width: '100%', font: '500 11px var(--font-ui)', color: '#ffe', textShadow: '0 1px 2px #000' }}>{log}</div>}
        </div>
      )}
    </div>
  );
}
