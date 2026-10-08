import { lazy, Suspense, useEffect, useState } from 'react';
import { LEADERS, DOCTRINES, EDICTS, CRISES, TECHS, WONDERS } from '../content';
import { createGame } from '../sim/engine';
import { CHAPTER_TARGET_MUL, CHAPTERS_PER_ERA, CRISIS_CHAPTER, ERA_TARGETS, FINAL_ERA } from '../sim/roguelite/constants';
import { useGame } from '../game/store';
import type { Screen } from '../game/store';
import { defaultProfile, loadProfile, saveProfile } from '../meta/profile';
import { MainMenu } from '../ui/menu/MainMenu';
import { NewRun } from '../ui/menu/NewRun';
import { Codex } from '../ui/menu/Codex';
import { Settings } from '../ui/menu/Settings';
import { Summary } from '../ui/menu/Summary';
import { Tutorial } from '../ui/menu/tutorial/Tutorial';
import { openNewRun } from '../ui/menu/shared';
const LiveCanvas = lazy(() => import('../render/GameCanvas').then((module) => ({ default: module.GameCanvas })));
const liveBackdrop = new URLSearchParams(location.search).has('live');

const SCREENS: Screen[] = ['menu', 'newRun', 'codex', 'settings', 'summary', 'game'];
function showSummary() {
  const leader = Object.values(LEADERS)[0];
  const { state } = createGame({ seed: 'RED-EXODUS-MENU-DEMO', leaderId: leader.id, ascension: 2, mapSize: 'small', rivals: 1, tutorial: false, daily: false });
  state.turn = 54;
  state.run.era = FINAL_ERA; state.run.chapter = CRISIS_CHAPTER; state.run.phase = 'victory';
  state.run.history = Array.from({ length: (FINAL_ERA + 1) * CHAPTERS_PER_ERA }, (_, i) => { const era = Math.floor(i / CHAPTERS_PER_ERA); const chapter = i % CHAPTERS_PER_ERA; const target = ERA_TARGETS[era] * CHAPTER_TARGET_MUL[chapter]; return { era, chapter, score: Math.floor(target * (i === 4 ? .87 : 1.25 + (i % 4) * .3)), target, passed: i !== 4 }; });
  state.run.bestScore = Math.max(...state.run.history.map((h) => h.score));
  state.run.doctrines = Object.values(DOCTRINES).slice(0, 5).map((d, i) => ({ uid: i + 1, id: d.id, edition: i === 2 ? 'gilded' : 'base', counters: {}, disabled: false, sellValue: 3 }));
  useGame.setState({ state, screen: 'summary', version: useGame.getState().version + 1 });
}
export default function MenuDemo() {
  const screen = useGame((g) => g.screen);
  useGame((g) => g.version);
  const state = useGame((g) => g.state);
  const city = state && Object.values(state.cities).find((c) => c.owner === 0);
  const research = state && Object.values(TECHS).find((tech) => !state.players[0].techs.includes(tech.id) && tech.prereqs.every((id) => state.players[0].techs.includes(id)));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('fixture') === 'collection') {
      const p = defaultProfile();
      p.unlocked.leaders = Object.keys(LEADERS).slice(0, 4);
      p.discovered.doctrines = Object.keys(DOCTRINES).filter((_, i) => i % 4 !== 3);
      p.discovered.edicts = Object.keys(EDICTS).slice(0, 12);
      p.discovered.crises = Object.keys(CRISES).slice(0, 8);
      p.discovered.wonders = Object.keys(WONDERS).slice(0, 7);
      p.ascension[Object.keys(LEADERS)[0]] = 2;
      p.stats = { ...p.stats, bestScore: 315800, runs: 12, wins: 3, doctrineWins: Object.fromEntries(p.discovered.doctrines.slice(0, 8).map((id, i) => [id, (i % 3) + 1])) };
      saveProfile(p);
    }
    const requested = params.get('screen') as Screen;
    if (requested === 'summary') showSummary();
    else useGame.getState().setScreen(SCREENS.includes(requested) ? requested : 'menu');
    setReady(true);
  }, []);
  if (!ready) return null;
  function navigate(next: Screen) {
    if (next === 'newRun') openNewRun();
    else if (next === 'summary') showSummary();
    else if (next === 'game') {
      const p = loadProfile(); p.settings.tutorialDone = false; p.tutorialProgress = []; saveProfile(p);
      useGame.getState().newGame({ seed: 'GALLERY-TUTORIAL', leaderId: Object.keys(LEADERS)[0], ascension: 0, mapSize: 'small', rivals: 1, tutorial: true, daily: false });
    } else useGame.getState().setScreen(next);
  }
  return <>
    {liveBackdrop && <Suspense fallback={null}><LiveCanvas /></Suspense>}
    {(screen === 'menu' || screen === 'boot') && <MainMenu />}
    {screen === 'newRun' && <NewRun />}
    {screen === 'codex' && <Codex />}
    {screen === 'settings' && <Settings />}
    {screen === 'summary' && <Summary />}
    {screen === 'game' && <>
      <div className="ae-demo-game">
        <h2>Run started</h2>
        <p>{state?.config.seed}</p>
        <p>Real colony sim. Add &amp;live for the 3D backdrop.</p>
        {state?.run.phase === 'chapterStart' && <button className="ae-button" data-tutorial="chapter-start" onClick={() => useGame.getState().dispatch({ type: 'chooseChapterStart', focus: 'prosperity' })}>Choose Growth</button>}
        {state?.run.phase === 'playing' && <div className="ae-demo-game-controls">
          {city && <button className="ae-button ae-button-small" data-tutorial="production" onClick={() => useGame.getState().dispatch({ type: 'setProduction', cityId: city.id, item: { kind: 'unit', id: 'warrior' } })}>Build warrior</button>}
          {research && <button className="ae-button ae-button-small" data-tutorial="research" onClick={() => useGame.getState().dispatch({ type: 'setResearch', tech: research.id })}>Research {research.name}</button>}
          <button className="ae-button ae-button-small" data-tutorial="end-turn" onClick={() => useGame.getState().dispatch({ type: 'endTurn' })}>End turn</button>
          <p data-tutorial="score">Score = Points × Multiplier</p>
        </div>}
      </div>
      <Tutorial />
    </>}
    <nav className="ae-demo-nav" aria-label="Gallery screens">{SCREENS.map((s) => <button key={s} onClick={() => navigate(s)}>{s === 'game' ? 'tutorial' : s}</button>)}</nav>
  </>;
}
