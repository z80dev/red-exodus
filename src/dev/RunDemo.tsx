// UI-Run gallery: every run-phase overlay on a real engine state with handcrafted fixtures.
// Open: /?dev=RunDemo&scene=chronicle (scenes: crisis chapter chronicle council pack victory defeat bars cards)
// Dispatch runs the real sim but never writes the IndexedDB save.
import { EDITION_NAMES, PILLAR_NAMES, YIELD_NAMES } from '../ui/terms';
import { useEffect, useMemo, useState } from 'react';
import { DOCTRINES, EDICTS, SCROLLS } from '../content';
import { bus } from '../game/bus';
import { useGame } from '../game/store';
import { applyAction, createGame } from '../sim/engine';
import { generateCouncil } from '../sim/roguelite/council';
import { chronicleTarget, grantDoctrine } from '../sim/roguelite';
import type { ChronicleResult, ChronicleStep, Edition, GameState, PillarId, Rarity, SimEvent } from '../sim/types';
import { PILLARS } from '../sim/types';
import { Card } from '../ui/run/Card';
import { crisisCard, doctrineCard, edictCard, leaderCard, omenCard, packCard, pillarCard, reformCard, scrollCard } from '../ui/run/cards';
import { DoctrineBar } from '../ui/run/DoctrineBar';
import { EdictTray } from '../ui/run/EdictTray';
import { RunOverlays } from '../ui/run/RunOverlays';
import { primeRunEndUnlocks } from '../ui/run/RunEnd';
import { LEADERS } from '../content';
import { CRISES, OMENS, REFORMS } from '../content';
import { Button } from '../ui/kit';
import '../ui/run/card.css';
import '../ui/run/run.css';

type Scene = 'crisis' | 'chapter' | 'chronicle' | 'chronicleFail' | 'council' | 'pack' | 'victory' | 'defeat' | 'bars' | 'cards';
const SCENES: Scene[] = ['crisis', 'chapter', 'chronicle', 'chronicleFail', 'council', 'pack', 'victory', 'defeat', 'bars', 'cards'];

const noopEmit = (ev: SimEvent) => void ev;

function pickDoctrines(): { id: string; rarity: Rarity }[] {
  const byRarity: Record<Rarity, string[]> = { common: [], uncommon: [], rare: [], legendary: [] };
  for (const d of Object.values(DOCTRINES)) if (!d.noShop) byRarity[d.rarity].push(d.id);
  return [
    { id: byRarity.common[0], rarity: 'common' as Rarity },
    { id: byRarity.uncommon[1] ?? byRarity.uncommon[0], rarity: 'uncommon' as Rarity },
    { id: byRarity.rare[0], rarity: 'rare' as Rarity },
    { id: byRarity.legendary[0], rarity: 'legendary' as Rarity },
    { id: byRarity.uncommon[3] ?? byRarity.uncommon[0], rarity: 'uncommon' as Rarity },
  ].filter((d) => !!d.id);
}

function bump() {
  useGame.setState({ version: useGame.getState().version + 1 });
}

function freshState(): GameState {
  const { state } = createGame({ seed: 'RUNDEMO-7', leaderId: 'usa', ascension: 0, mapSize: 'small', rivals: 2, tutorial: false, daily: false });
  return state;
}

function giveDoctrines(state: GameState, editions: Edition[]) {
  const picks = pickDoctrines();
  state.run.doctrines = [];
  picks.slice(0, editions.length).forEach((d, i) => grantDoctrine(state, d.id, editions[i], noopEmit));
  state.run.doctrineSlots = 5;
}
function giveEdicts(state: GameState) {
  const ids = Object.keys(EDICTS).slice(0, 2);
  state.run.edicts = ids.map((id) => ({ uid: state.run.nextUid++, id }));
  state.run.edictSlots = 3;
}

/** Handcrafted ceremony: every step source, a ×mult, cities, a crisis penalty. */
function fixtureChronicle(state: GameState, passed: boolean): ChronicleResult {
  const run = state.run;
  const steps: ChronicleStep[] = [];
  let r = 0;
  let s = 0;
  const push = (st: Omit<ChronicleStep, 'renown' | 'splendor'>) => {
    r += st.renownAdd ?? 0;
    s += st.splendorAdd ?? 0;
    if (st.splendorMul != null) s *= st.splendorMul;
    steps.push({ ...st, renown: r, splendor: Math.round(s * 100) / 100 });
  };
  const k = passed ? 0.05 : 0.015;
  const artsTotal = Math.round(312 * k);
  const lines: Record<PillarId, [string, number][]> = {
    arts: [[`${Math.round(312 * k)} ${YIELD_NAMES.cul}`, 312 * k]],
    discovery: [['13 Data', 150 * k], ['1 breakthrough', 30]],
    commerce: [['8 Credits', 96 * k]],
    conquest: [['3 ferals cleared', 75 * k]],
    prosperity: [['6 colonists', 90 * k], ['2 installations', 20]],
    glory: [['1 megaproject', 200 * k], ['1 building', 20]],
  };
  for (const p of PILLARS) for (const [label, amt] of lines[p]) push({ source: 'pillar', label: `${PILLAR_NAMES[p]} · ${label}`, ref: p, renownAdd: Math.round(amt) });
  push({ source: 'focus', label: 'Priority: Heritage ×2', ref: 'arts', renownAdd: artsTotal });
  push({ source: 'focus', label: 'Heritage Hope', ref: 'arts', splendorAdd: 3 });
  push({ source: 'city', label: 'Ares Hab', ref: '1', splendorAdd: 2 });
  push({ source: 'city', label: 'Dawn Colony', ref: '2', splendorAdd: 1 });
  push({ source: 'city', label: 'Hellas Colony', ref: '3', splendorAdd: 1, renownAdd: 30 });
  const docs = run.doctrines;
  if (docs[0]) push({ source: 'doctrine', label: doctrineCard(docs[0].id).title, ref: String(docs[0].uid), renownAdd: 40 });
  if (docs[1]) push({ source: 'doctrine', label: doctrineCard(docs[1].id).title, ref: String(docs[1].uid), splendorAdd: 3 });
  if (docs[1] && docs[1].edition !== 'base') push({ source: 'edition', label: `${EDITION_NAMES[docs[1].edition]} edition`, ref: String(docs[1].uid), renownAdd: 50 });
  if (docs[2]) push({ source: 'doctrine', label: doctrineCard(docs[2].id).title, ref: String(docs[2].uid), splendorMul: 1.5 });
  if (docs[3]) push({ source: 'doctrine', label: doctrineCard(docs[3].id).title, ref: String(docs[3].uid), splendorAdd: 4, renownAdd: 60 });
  if (docs[3] && docs[3].edition === 'prismatic') push({ source: 'edition', label: 'Legendary Tale', ref: String(docs[3].uid), splendorMul: 1.5 });
  push({ source: 'omen', label: 'Directive fulfilled: Signal from Earth', renownAdd: 80 });
  if (!passed) push({ source: 'darkAge', label: 'Blackout', splendorMul: 0.85 });
  else push({ source: 'crisis', label: 'The Long Winter', splendorMul: 0.9 });
  push({ source: 'final', label: 'Viability' });
  const score = Math.floor(r * s);
  // the failing fixture keeps the real formula but falls ~30% short of its target
  const target = passed ? chronicleTarget(state, run.era, run.chapter) : Math.round(score * 1.45);
  const ok = score >= target;
  return {
    era: run.era, chapter: run.chapter, target, steps, renown: r, splendor: s, score, passed: ok,
    triumph: score >= target * 2, mandateLost: ok ? 0 : run.chapter === 2 ? 2 : 1,
    influenceEarned: [
      { label: 'Chapter stipend', amount: 3 },
      { label: `Chapter ${run.chapter + 1} bonus`, amount: run.chapter + 1 },
      { label: 'Ark interest', amount: 2 },
      ...(score >= target * 2 ? [{ label: 'Triumph', amount: 3 }] : []),
    ],
  };
}

function setup(scene: Scene, era: number): GameState {
  const state = freshState();
  const run = state.run;
  run.era = era;
  switch (scene) {
    case 'crisis':
      run.phase = 'crisisReveal';
      break;
    case 'chapter':
      run.phase = 'crisisReveal';
      run.chapter = 0;
      applyAction(state, { type: 'ackCrisis' });
      run.pillarLevels = { arts: 3, discovery: 2, commerce: 1, conquest: 1, prosperity: 2, glory: 1 };
      break;
    case 'chronicle':
    case 'chronicleFail': {
      giveDoctrines(state, ['base', 'radiant', 'gilded', 'prismatic', 'ethereal']);
      run.chapter = 1;
      const res = fixtureChronicle(state, scene === 'chronicle');
      run.mandate = Math.max(0, run.maxMandate - res.mandateLost);
      run.influence = 14;
      run.lastChronicle = res;
      run.phase = 'chronicle';
      break;
    }
    case 'council':
    case 'pack': {
      giveDoctrines(state, ['base', 'gilded', 'prismatic']);
      giveEdicts(state);
      run.chapter = 1;
      run.influence = 24;
      run.pillarLevels = { arts: 3, discovery: 2, commerce: 1, conquest: 1, prosperity: 2, glory: 1 };
      run.phase = 'council';
      run.chapter = 0;
      generateCouncil(state, noopEmit);
      run.chapter = 1;
      if (scene === 'pack') {
        const ids = pickDoctrines().map((d) => d.id).reverse();
        run.council!.pack = {
          picks: 1,
          options: ids.slice(0, 3).map((id, i) => ({ kind: 'doctrine' as const, id, edition: (['base', 'radiant', 'base'] as Edition[])[i], price: 0 })),
        };
      }
      break;
    }
    case 'victory':
    case 'defeat': {
      giveDoctrines(state, ['base', 'gilded', 'prismatic', 'base']);
      run.history = Array.from({ length: scene === 'victory' ? 18 : 10 }, (_, i) => {
        const e = Math.floor(i / 3);
        const target = chronicleTarget(state, e, i % 3);
        return { era: e, chapter: i % 3, score: Math.round(target * (1.2 + (i % 4) * 0.35)), target, passed: i !== 7 };
      });
      run.totals = { ...run.totals, wonders: 5, techs: 29, kills: 41, buildings: 38, citiesFounded: 7 };
      state.turn = scene === 'victory' ? 121 : 67;
      if (scene === 'victory') { run.era = 5; run.chapter = 2; run.phase = 'victory'; }
      else { run.era = 3; run.chapter = 1; run.phase = 'defeat'; run.defeatReason = 'Charter exhausted — the Ark cut the line. Mars kept the lights.'; run.mandate = 0; }
      // fixture unlocks: never touch the real profile from the gallery
      const leaderIds = Object.keys(LEADERS).filter((id) => id !== state.config.leaderId);
      primeRunEndUnlocks(state, {
        unlocks: [
          ...leaderIds.slice(0, 2).map((id) => ({ kind: 'leader', id, name: LEADERS[id].name })),
          { kind: 'doctrine', id: pickDoctrines()[3]?.id ?? '', name: 'Crew' },
          { kind: 'ascension', id: '1', name: 'Hazard 1' },
          ...(scene === 'victory' ? leaderIds.slice(2, 7).map((id) => ({ kind: 'leader', id, name: LEADERS[id].name })) : []),
        ],
      });
      break;
    }
    case 'bars':
      giveDoctrines(state, ['base', 'gilded', 'prismatic', 'radiant']);
      giveEdicts(state);
      run.phase = 'playing';
      break;
    case 'cards':
      run.phase = 'playing';
      break;
  }
  return state;
}

function installHarnessDispatch() {
  useGame.setState({
    dispatch(action) {
      const state = useGame.getState().state;
      if (!state) return { ok: false, error: 'No game', events: [] };
      const res = applyAction(state, action);
      if (res.ok) {
        bump();
        bus.publish(res.events);
      }
      return res;
    },
  });
}

export default function RunDemo() {
  const params = new URLSearchParams(location.search);
  const [scene, setScene] = useState<Scene>(() => (SCENES.includes(params.get('scene') as Scene) ? (params.get('scene') as Scene) : 'chronicle'));
  const [era, setEra] = useState(() => Number(params.get('era') ?? 1));
  const [nonce, setNonce] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const chrome = params.get('chrome') !== '0';

  useEffect(() => {
    installHarnessDispatch();
    try {
      const state = setup(scene, era);
      useGame.setState({ state, version: useGame.getState().version + 1, screen: 'game', mode: { kind: 'normal' } });
      setError(null);
    } catch (e) {
      setError(String((e as Error).stack ?? e));
    }
    const url = new URL(location.href);
    url.searchParams.set('scene', scene);
    url.searchParams.set('era', String(era));
    history.replaceState(null, '', url);
  }, [scene, era, nonce]);

  // dev HMR of sim/content modules re-instantiates the store (state → null): rebuild the fixture
  useEffect(() => {
    const iv = window.setInterval(() => {
      if (!useGame.getState().state) setNonce((n) => n + 1);
    }, 400);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="rdemo">
      <style>{DEMO_CSS}</style>
      <div className="rdemo-map" />
      {error && <pre className="rdemo-err">{error}</pre>}
      {!error && (scene === 'bars' ? <BarsScene /> : scene === 'cards' ? <CardsScene /> : <RunOverlays key={`${scene}:${nonce}`} />)}
      {chrome && (
        <div className="rdemo-nav">
          {SCENES.map((s) => (
            <button key={s} type="button" className={s === scene ? 'on' : ''} onClick={() => { setScene(s); setNonce((n) => n + 1); }}>{s}</button>
          ))}
          <select value={era} onChange={(e) => setEra(Number(e.target.value))}>
            {[0, 1, 2, 3, 4, 5, 6].map((e) => <option key={e} value={e}>era {e}</option>)}
          </select>
          <button type="button" onClick={() => setNonce((n) => n + 1)}>↻</button>
        </div>
      )}
    </div>
  );
}

function BarsScene() {
  const fire = () => {
    const d = useGame.getState().state?.run.doctrines ?? [];
    const pick = d[Math.floor(Math.random() * d.length)];
    if (pick) bus.publish([{ type: 'doctrineTriggered', uid: pick.uid, text: ['+1 Food', '+2 Hope', '+15 Output', '×1.5 Hope'][Math.floor(Math.random() * 4)] }]);
  };
  return (
    <div className="rdemo-bars">
      <div className="rdemo-hud-top"><DoctrineBar /></div>
      <div className="rdemo-hud-bottom"><EdictTray /></div>
      <div className="rdemo-full">
        <DoctrineBar compact={false} sellable />
      </div>
      <Button onClick={fire}>Fire Crew triggered</Button>
    </div>
  );
}

function CardsScene() {
  const docs = useMemo(() => pickDoctrines(), []);
  const editions: Edition[] = ['base', 'gilded', 'radiant', 'prismatic', 'ethereal'];
  const others = [
    edictCard(Object.keys(EDICTS)[0] ?? 'x'),
    scrollCard(Object.keys(SCROLLS)[0] ?? 'x', 2),
    crisisCard(Object.keys(CRISES)[0] ?? 'x'),
    omenCard(Object.keys(OMENS)[0] ?? 'x'),
    reformCard(Object.keys(REFORMS)[0] ?? 'x'),
    packCard('doctrine', 'normal'),
    packCard('archive', 'jumbo'),
    pillarCard('arts', 3, { projected: 420, splendor: 4 }),
    leaderCard('usa'),
  ];
  const [down, setDown] = useState(false);
  return (
    <div className="rdemo-cards">
      <h3>Rarities × editions (hold to zoom, move pointer for foil)</h3>
      <div className="rdemo-grid">
        {docs.map((d, i) => (
          <Card key={d.id} card={doctrineCard(d.id, editions[i % editions.length])} width={170} onTap={() => {}} />
        ))}
      </div>
      <div className="rdemo-grid">
        {editions.map((e) => <Card key={e} card={doctrineCard(docs[2]?.id ?? 'x', e)} width={130} />)}
      </div>
      <h3>Kinds</h3>
      <div className="rdemo-grid">
        {others.map((c) => <Card key={c.kind + c.id} card={{ ...c, price: c.kind === 'pack' ? 6 : undefined }} width={150} />)}
      </div>
      <h3>Sizes & flip <button type="button" onClick={() => setDown((v) => !v)}>flip</button></h3>
      <div className="rdemo-grid" style={{ alignItems: 'flex-end' }}>
        {[44, 64, 96, 130, 200, 260].map((w) => <Card key={w} card={doctrineCard(docs[3]?.id ?? 'x', 'prismatic')} width={w} faceDown={down} />)}
        <Card card={doctrineCard(docs[0]?.id ?? 'x')} width={130} locked />
      </div>
    </div>
  );
}

const DEMO_CSS = `
.rdemo { position: fixed; inset: 0; background: #0b1016; }
.rdemo-map { position: absolute; inset: 0; background:
  radial-gradient(circle at 30% 40%, #9a4724 0 12%, transparent 13%), radial-gradient(circle at 70% 60%, #c06837 0 16%, transparent 17%),
  radial-gradient(circle at 50% 20%, #e27a39 0 9%, transparent 10%), linear-gradient(180deg, #263746, #1a2028); filter: saturate(0.8); }
.rdemo-err { position: absolute; inset: 40px; color: #ff8080; white-space: pre-wrap; font-size: 12px; z-index: 100; overflow: auto; }
.rdemo-nav { position: fixed; left: 50%; top: 2px; transform: translateX(-50%); z-index: 90; display: flex; gap: 2px; flex-wrap: wrap; justify-content: center; opacity: 0.35; transition: opacity 200ms; max-width: 100vw; }
.rdemo-nav:hover { opacity: 1; }
.rdemo-nav button, .rdemo-nav select { font-size: 10px; padding: 2px 5px; background: #000a; color: #ddd; border: 1px solid #555; border-radius: 4px; }
.rdemo-nav button.on { background: #b3862a; color: #000; }
.rdemo-bars { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 30px; }
.rdemo-hud-top { position: absolute; top: 40px; left: 50%; transform: translateX(-50%); padding: 4px 10px; background: var(--glass); border-radius: 14px; border: 1px solid var(--glass-border); }
.rdemo-hud-bottom { position: absolute; bottom: 20px; left: 12px; padding: 4px 10px; background: var(--glass); border-radius: 14px; border: 1px solid var(--glass-border); }
.rdemo-full { padding: 12px; background: var(--glass); border-radius: 14px; }
.rdemo-cards { position: absolute; inset: 0; overflow: auto; padding: 30px 16px; touch-action: pan-y; }
.rdemo-cards h3 { font-family: var(--font-display); color: var(--gold-300); font-size: 14px; }
.rdemo-grid { display: flex; flex-wrap: wrap; gap: 22px 18px; padding: 14px 6px; }
`;
