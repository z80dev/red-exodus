// HUD harness: a real game (createGame + autoplay to a lived-in turn) under the full GameScreen, drawn on a lightweight
// 2D SVG debug map that implements the Renderer bridge (highlights, screenPos, focus, taps) so every interaction can be
// exercised without the 3D renderer. URL: ?dev=HudDemo[&seed=X][&turns=14][&panel=city|tech|empire|journal|pause]
import { useEffect, useMemo, useRef } from 'react';
import type { PointerEvent as RPointerEvent } from 'react';
import { create } from 'zustand';
import { DOCTRINES, EDICTS, FEATURES, LEADERS, TECHS, TERRAINS } from '../content';
import { EMPTY_HIGHLIGHTS, setRenderer } from '../game/bridge';
import type { Highlights, Renderer } from '../game/bridge';
import * as interaction from '../game/interaction';
import { useGame } from '../game/store';
import { loadProfile, saveProfile, updateSettings } from '../meta/profile';
import type { Panel } from '../game/store';
import { autoplayNextAction } from '../sim/ai';
import { refreshAllCities } from '../sim/cities';
import { availableTechs, grantTech } from '../sim/economy';
import { applyAction, createGame } from '../sim/engine';
import { hexToWorld } from '../sim/hex';
import { grantDoctrine } from '../sim/roguelite';
import { BARBARIAN, HUMAN } from '../sim/types';
import type { GameState, TileIdx } from '../sim/types';
import { GameCanvas } from '../render/GameCanvas';
import { GameScreen } from '../ui/hud/GameScreen';
import { toast } from '../ui/hud/toast';

const SCALE = 30;
const HEX = Array.from({ length: 6 }, (_, i) => {
  const a = (Math.PI / 180) * (60 * i - 30);
  return `${(Math.cos(a) * SCALE * 0.98).toFixed(2)},${(Math.sin(a) * SCALE * 0.98).toFixed(2)}`;
}).join(' ');

// ───────────────────────────── fixture ─────────────────────────────
function buildFixture(seed: string, turns: number): GameState {
  const leaderId = Object.keys(LEADERS)[0];
  const { state } = createGame({ seed, leaderId, ascension: 1, mapSize: 'small', rivals: 3, tutorial: false, daily: false });
  let guard = 0;
  while (guard++ < 6000) {
    if (state.run.phase === 'playing' && state.turn >= turns) break;
    const a = autoplayNextAction(state) ?? (state.run.phase === 'playing' ? ({ type: 'endTurn' } as const) : null);
    if (!a) break;
    const res = applyAction(state, a);
    if (!res.ok && a.type !== 'endTurn') applyAction(state, { type: 'endTurn' });
    if (state.gameOver) break;
  }
  // give the roguelite bars something to show
  const noop = () => {};
  for (const id of Object.keys(DOCTRINES).filter((d) => !DOCTRINES[d].noShop).slice(0, 3)) {
    if (state.run.doctrines.length < state.run.doctrineSlots) grantDoctrine(state, id, 'base', noop);
  }
  const edicts = Object.keys(EDICTS);
  const want = [edicts.find((e) => EDICTS[e].target === 'city'), edicts.find((e) => EDICTS[e].target === 'none')].filter(Boolean) as string[];
  for (const id of want) if (state.run.edicts.length < state.run.edictSlots) state.run.edicts.push({ uid: state.run.nextUid++, id });
  // a few era-0 techs so the tree, production picker and improvements have content
  for (const id of Object.values(TECHS).filter((t) => t.era === 0 && !t.prereqs.length).map((t) => t.id).slice(0, 3)) {
    if (!state.players[HUMAN].techs.includes(id)) grantTech(state, HUMAN, id, noop);
  }
  const me = state.players[HUMAN];
  if (!me.researching) me.researching = availableTechs(state, HUMAN)[0] ?? null;
  me.researchOffer = availableTechs(state, HUMAN).slice(0, 3);
  me.cryo = Math.max(me.cryo, 2);
  me.gold = Math.max(me.gold, 180);
  refreshAllCities(state, HUMAN);
  return state;
}

// ───────────────────────────── 2D debug renderer ─────────────────────────────
interface View { x: number; y: number; zoom: number }
interface MapStore { hl: Highlights; view: View; tick: number }
const useMap = create<MapStore>(() => ({ hl: EMPTY_HIGHLIGHTS, view: { x: 0, y: 0, zoom: 1 }, tick: 0 }));

function tileXY(s: GameState, idx: TileIdx): { x: number; y: number } {
  const t = s.map.tiles[idx];
  const w = hexToWorld(t.col, t.row);
  return { x: w.x * SCALE, y: w.z * SCALE };
}

function makeRenderer(svg: () => SVGSVGElement | null): Renderer {
  const center = (s: GameState, idx: TileIdx) => {
    const el = svg();
    const p = tileXY(s, idx);
    const { zoom } = useMap.getState().view;
    const w = el?.clientWidth ?? innerWidth;
    const h = el?.clientHeight ?? innerHeight;
    useMap.setState({ view: { zoom, x: w / 2 - p.x * zoom, y: h * 0.45 - p.y * zoom } });
  };
  return {
    sync: () => useMap.setState((m) => ({ tick: m.tick + 1 })),
    play: () => { useMap.setState((m) => ({ tick: m.tick + 1 })); return Promise.resolve(); },
    setHighlights: (hl) => useMap.setState({ hl }),
    focusTile: (idx) => { const s = useGame.getState().state; if (s) center(s, idx); },
    screenPos: (idx) => {
      const s = useGame.getState().state;
      const el = svg();
      if (!s || !el) return null;
      const p = tileXY(s, idx);
      const v = useMap.getState().view;
      const r = el.getBoundingClientRect();
      const x = r.left + v.x + p.x * v.zoom;
      const y = r.top + v.y + p.y * v.zoom;
      return x < -40 || y < -40 || x > innerWidth + 40 || y > innerHeight + 40 ? null : { x, y };
    },
    setQuality: () => {},
    setAttractMode: () => {},
    resize: () => {},
    dispose: () => {},
  };
}

function DebugMap() {
  const state = useGame((g) => g.state);
  const version = useGame((g) => g.version);
  const { hl, view } = useMap();
  const ref = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean; timer: ReturnType<typeof setTimeout> | null; tile: TileIdx; long: boolean } | null>(null);

  useEffect(() => {
    const r = makeRenderer(() => ref.current);
    setRenderer(r);
    const s = useGame.getState().state;
    const cap = s && Object.values(s.cities).find((c) => c.owner === HUMAN);
    const u = s && Object.values(s.units).find((x) => x.owner === HUMAN);
    if (s) r.focusTile(cap?.tile ?? u?.tile ?? s.map.starts[HUMAN]);
    return () => setRenderer(null);
  }, []);

  const tileSets = useMemo(() => ({
    move: new Set(hl.move), attack: new Set(hl.attack), path: new Set(hl.path), city: new Set(hl.cityTiles), improve: new Set(hl.improve), target: new Set(hl.target),
  }), [hl]);

  if (!state) return null;
  void version;
  const vis = state.players[HUMAN].vis;
  const unitsByTile = new Map<number, typeof state.units[number][]>();
  for (const k in state.units) {
    const u = state.units[k];
    if (vis[u.tile] !== 2 && u.owner !== HUMAN) continue;
    const arr = unitsByTile.get(u.tile) ?? [];
    arr.push(u);
    unitsByTile.set(u.tile, arr);
  }
  const colorOf = (pid: number) => (pid === BARBARIAN ? '#7a1616' : state.players.find((p) => p.id === pid)?.colors.primary ?? '#999');

  const tileFromEvent = (e: RPointerEvent): TileIdx => {
    const el = ref.current!;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left - view.x) / view.zoom;
    const y = (e.clientY - r.top - view.y) / view.zoom;
    let best = -1;
    let bd = Infinity;
    for (const t of state.map.tiles) {
      const p = tileXY(state, t.idx);
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bd) { bd = d; best = t.idx; }
    }
    return bd < (SCALE * 1.05) ** 2 ? best : -1;
  };

  return (
    <svg ref={ref} className="hd-map" style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', background: 'radial-gradient(circle at 50% 40%, #173a5c, #07111d)', touchAction: 'none' }}
      onPointerDown={(e) => {
        (e.target as Element).setPointerCapture?.(e.pointerId);
        const tile = tileFromEvent(e);
        const d = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false, timer: null as ReturnType<typeof setTimeout> | null, tile, long: false };
        d.timer = setTimeout(() => { if (!d.moved) { d.long = true; interaction.onTileLongPress(tile); } }, 480);
        drag.current = d;
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) {
          interaction.onTileHover(tileFromEvent(e));
          return;
        }
        const dx = e.clientX - d.x;
        const dy = e.clientY - d.y;
        if (!d.moved && Math.hypot(dx, dy) > 8) { d.moved = true; clearTimeout(d.timer ?? undefined); }
        if (d.moved) useMap.setState({ view: { ...view, x: d.vx + dx, y: d.vy + dy } });
      }}
      onPointerUp={() => {
        const d = drag.current;
        drag.current = null;
        if (!d) return;
        clearTimeout(d.timer ?? undefined);
        if (!d.moved && !d.long) interaction.onTileTap(d.tile);
      }}
      onWheel={(e) => {
        const z = Math.max(0.5, Math.min(2.2, view.zoom * (e.deltaY < 0 ? 1.1 : 0.9)));
        const r = ref.current!.getBoundingClientRect();
        const mx = e.clientX - r.left;
        const my = e.clientY - r.top;
        useMap.setState({ view: { zoom: z, x: mx - ((mx - view.x) / view.zoom) * z, y: my - ((my - view.y) / view.zoom) * z } });
      }}>
      <g transform={`translate(${view.x} ${view.y}) scale(${view.zoom})`}>
        {state.map.tiles.map((t) => {
          const p = tileXY(state, t.idx);
          const v = vis[t.idx] ?? 0;
          if (v === 0) return <polygon key={t.idx} points={HEX} transform={`translate(${p.x} ${p.y})`} fill="#1a1712" stroke="#2a251c" strokeWidth={1} />;
          const base = TERRAINS[t.terrain]?.color ?? '#555';
          const feat = t.feature ? FEATURES[t.feature]?.color : null;
          return (
            <g key={t.idx} transform={`translate(${p.x} ${p.y})`} opacity={v === 1 ? 0.55 : 1}>
              <polygon points={HEX} fill={base} stroke="rgba(0,0,0,0.25)" strokeWidth={1} />
              {feat && <circle r={SCALE * 0.5} fill={feat} opacity={0.85} />}
              {t.elevation === 'hills' && <path d={`M${-SCALE * 0.55} ${SCALE * 0.3} Q0 ${-SCALE * 0.35} ${SCALE * 0.55} ${SCALE * 0.3}`} fill="rgba(0,0,0,0.18)" />}
              {t.elevation === 'mountain' && <path d={`M${-SCALE * 0.6} ${SCALE * 0.45} L0 ${-SCALE * 0.6} L${SCALE * 0.6} ${SCALE * 0.45} Z`} fill="#6e665e" stroke="#f2f4f7" strokeWidth={1.5} />}
              {t.owner != null && <polygon points={HEX} fill="none" stroke={colorOf(t.owner)} strokeWidth={3} opacity={0.75} transform="scale(0.9)" />}
              {t.resource && <circle cx={SCALE * 0.42} cy={-SCALE * 0.4} r={4} fill="#ffe28a" stroke="#000" strokeWidth={0.8} />}
              {t.improvement && <rect x={-SCALE * 0.55} y={SCALE * 0.25} width={9} height={9} fill="#e0b84a" stroke="#000" strokeWidth={0.8} />}
              {t.camp && <text y={6} textAnchor="middle" fontSize={18}>☠</text>}
              {tileSets.city.has(t.idx) && <polygon points={HEX} fill="rgba(234,199,102,0.14)" />}
              {tileSets.move.has(t.idx) && <polygon points={HEX} fill="rgba(255,255,255,0.28)" stroke="rgba(255,255,255,0.8)" strokeWidth={1.5} transform="scale(0.86)" />}
              {tileSets.improve.has(t.idx) && <polygon points={HEX} fill="rgba(234,199,102,0.3)" stroke="#f6dd8f" strokeWidth={2} transform="scale(0.86)" />}
              {tileSets.target.has(t.idx) && <polygon points={HEX} fill="rgba(178,141,255,0.3)" stroke="#b28dff" strokeWidth={2} transform="scale(0.86)" />}
              {tileSets.attack.has(t.idx) && <polygon points={HEX} fill="rgba(255,60,60,0.25)" stroke="#ff5050" strokeWidth={3} transform="scale(0.86)" />}
              {tileSets.path.has(t.idx) && <circle r={5} fill="#fff" stroke="#000" strokeWidth={1} />}
              {hl.selected === t.idx && <polygon points={HEX} fill="none" stroke="#f6dd8f" strokeWidth={3.5} />}
            </g>
          );
        })}
        {Object.values(state.cities).filter((c) => (vis[c.tile] ?? 0) > 0).map((c) => {
          const p = tileXY(state, c.tile);
          return (
            <g key={`c${c.id}`} transform={`translate(${p.x} ${p.y})`} pointerEvents="none">
              <rect x={-14} y={-14} width={28} height={28} rx={5} fill={colorOf(c.owner)} stroke="#f6dd8f" strokeWidth={2} />
              <text y={5} textAnchor="middle" fontSize={13} fontWeight={800} fill="#fff">{c.pop}</text>
              <text y={-20} textAnchor="middle" fontSize={11} fontWeight={700} fill="#fff" stroke="#000" strokeWidth={3} paintOrder="stroke">{c.name}</text>
            </g>
          );
        })}
        {[...unitsByTile.entries()].map(([tile, us]) => {
          const p = tileXY(state, tile);
          return us.map((u, i) => (
            <g key={`u${u.id}`} transform={`translate(${p.x + (i ? 10 : 0)} ${p.y + (i ? 10 : 4)})`} pointerEvents="none">
              <circle r={10} fill={colorOf(u.owner)} stroke="#fff" strokeWidth={1.5} />
              <text y={4} textAnchor="middle" fontSize={11} fontWeight={800} fill="#fff">{u.type[0].toUpperCase()}</text>
              <rect x={-10} y={12} width={20 * (u.hp / 100)} height={3} fill={u.hp > 50 ? '#7fd67a' : '#ff6060'} />
            </g>
          ));
        })}
      </g>
    </svg>
  );
}

// ───────────────────────────── harness root ─────────────────────────────
// build the fixture once at module load (the harness module is only imported for ?dev=HudDemo)
{
  const q = new URLSearchParams(location.search);
  // coach marks off unless explicitly requested (?tutorial=1)
  saveProfile(updateSettings(loadProfile(), { tutorialDone: q.get('tutorial') !== '1' }));
  const state = buildFixture(q.get('seed') ?? 'HUD-DEMO', Number(q.get('turns') ?? 14));
  // ?reveal=1: explore the whole map (meets every rival) for Empire/journal screenshots
  if (q.get('reveal') === '1') state.players[HUMAN].vis = state.players[HUMAN].vis.map((v) => Math.max(v, 1));
  const panel = (q.get('panel') as Panel | null) ?? 'none';
  const firstColony = Object.values(state.cities).find((city) => city.owner === HUMAN);
  useGame.setState({
    state, version: useGame.getState().version + 1, screen: 'game',
    selection: panel === 'city' && firstColony ? { kind: 'city', id: firstColony.id } : null,
    panel, mode: { kind: 'normal' },
  });
  Object.assign(window, { hud: { useGame, interaction, toast, useMap } });
}

export default function HudDemo() {
  // ?canvas=1 renders the real 3D GameCanvas instead of the 2D debug map
  const real = new URLSearchParams(location.search).get('canvas') === '1';
  return (
    <>
      {real ? <GameCanvas /> : <DebugMap />}
      <GameScreen />
    </>
  );
}
