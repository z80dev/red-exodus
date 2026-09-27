// Victory / Defeat. Records meta progression exactly once per run end and reveals unlocks.
import { useEffect, useMemo, useRef, useState } from 'react';
import { LEADERS } from '../../content';
import { useGame, useSim } from '../../game/store';
import { recordRunEnd } from '../../meta/profile';
import type { GameState } from '../../sim/types';
import { HUMAN } from '../../sim/types';
import { backdropFor } from '../art/artManifest';
import { Button } from '../kit';
import { Icon } from '../icons/Icon';
import { Card } from './Card';
import { doctrineCard, edictCard, leaderCard } from './cards';
import type { CardModel } from './cards';
import { useParticles, useTweened } from './fx';
import { Ornament, usePortrait } from './parts';
import { act, chapterTitle, eraTitle, fmt, haptic, roman, sfx } from './runUtil';
import './runend.css';

export interface RunEndUnlock { kind: string; id: string; name: string }
export interface RunEndUnlocks { unlocks: RunEndUnlock[] }

const recorded = new Map<string, RunEndUnlocks>();

/**
 * Memoized meta-progression for the current run end. Calls `recordRunEnd` at most once per
 * (run, outcome) — victory and a later endless-mode collapse are separate outcomes. Summary uses this too.
 */
export function runEndUnlocks(state: GameState): RunEndUnlocks {
  const outcome = state.run.phase === 'victory' ? 'victory' : 'end';
  const key = `${state.config.seed}|${state.config.leaderId}|${state.config.ascension}|${state.config.daily ? 'd' : ''}|${outcome}`;
  const hit = recorded.get(key);
  if (hit) return hit;
  let res: RunEndUnlocks;
  try {
    res = recordRunEnd(state);
  } catch {
    res = { unlocks: [] };
  }
  recorded.set(key, res);
  return res;
}

function unlockCard(u: RunEndUnlock): CardModel | null {
  if (u.kind === 'leader' || u.kind === 'leaders') return leaderCard(u.id);
  if (u.kind === 'doctrine' || u.kind === 'doctrines') return doctrineCard(u.id);
  if (u.kind === 'edict' || u.kind === 'edicts') return edictCard(u.id);
  return null;
}

export function RunEnd() {
  const phase = useSim((s) => s.run.phase);
  const state = useGame.getState().state;
  const portrait = usePortrait();
  const victory = phase === 'victory';
  const [setHost, particles] = useParticles();
  const [revealed, setRevealed] = useState(0);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const unlocks = useMemo(() => (state ? runEndUnlocks(state).unlocks : []), [state]);

  const stats = useMemo(() => {
    if (!state) return null;
    const run = state.run;
    const legacy = run.history.reduce((a, h) => a + h.score, 0);
    const best = run.history.reduce<(typeof run.history)[number] | null>((b, h) => (!b || h.score > b.score ? h : b), null);
    const cities = Object.values(state.cities).filter((c) => c.owner === HUMAN).length;
    const passed = run.history.filter((h) => h.passed).length;
    return { legacy, best, cities, passed, chapters: run.history.length };
  }, [state]);
  const legacyShown = useTweened(stats?.legacy ?? 0, 2200);

  useEffect(() => {
    sfx(victory ? 'victory' : 'defeat');
    haptic(victory ? [30, 40, 30, 40, 80] : [120, 60, 120]);
    const f = particles.current;
    if (victory) {
      f?.emit('dust', ['#f6dd8f', '#eac766', '#fff4c9'], 26);
      const t = window.setTimeout(() => {
        const r = titleRef.current?.getBoundingClientRect();
        const x = r ? r.left + r.width / 2 : window.innerWidth / 2;
        const y = r ? r.top + r.height / 2 : window.innerHeight / 3;
        f?.burst(x, y, { kind: 'confetti', count: 120, speed: 13, colors: ['#f6dd8f', '#eac766', '#ffffff', '#ffb347', '#4fb3ff'], life: 2600 });
        f?.burst(x, y, { kind: 'spark', count: 60, speed: 10, life: 1200 });
      }, 700);
      return () => clearTimeout(t);
    }
    f?.emit('ash', ['#8a8177', '#5e5850', '#b0a898'], 18);
    return undefined;
  }, [victory, particles]);

  // flip unlock cards one by one
  useEffect(() => {
    if (!unlocks.length) return;
    let i = 0;
    const iv = window.setInterval(() => {
      i += 1;
      setRevealed(i);
      sfx('cardFlip', { pitch: 1 + i * 0.05 });
      if (i >= unlocks.length) clearInterval(iv);
    }, 520);
    return () => clearInterval(iv);
  }, [unlocks]);

  if (!state || !stats) return null;
  const run = state.run;
  const leader = LEADERS[state.config.leaderId];
  const bg = backdropFor('key', victory ? 'victory' : 'defeat', portrait);
  const tot = run.totals;
  const grid: { icon: string; label: string; value: string }[] = [
    { icon: 'calendar', label: 'Turns', value: fmt(state.turn) },
    { icon: 'city', label: 'Cities', value: fmt(stats.cities) },
    { icon: 'wonder', label: 'Wonders', value: fmt(tot.wonders) },
    { icon: 'tech', label: 'Techs', value: fmt(tot.techs) },
    { icon: 'sword', label: 'Kills', value: fmt(tot.kills) },
    { icon: 'trophy', label: 'Chapters passed', value: `${stats.passed}/${stats.chapters}` },
  ];

  return (
    <div className={`ro-overlay rre ${victory ? 'rre--victory' : 'rre--defeat'}`}>
      <div className="rre-bg" style={bg ? { backgroundImage: `url(${bg})` } : undefined} />
      <div className="rre-vignette" />
      <div className="ro-particles" ref={setHost} />
      <div className="rre-stage">
        <header className="rre-head">
          <div className="rre-kicker display">{victory ? 'The Chronicle Endures' : 'The Chronicle Ends'}</div>
          <h1 className="rre-title display" ref={titleRef}>{victory ? 'Victory' : 'Collapse'}</h1>
          <Ornament draw />
          <p className="rre-line">
            {victory
              ? `${leader?.civName ?? state.players[HUMAN]?.civName ?? 'Your people'} will be remembered for a thousand ages.`
              : run.defeatReason ?? 'Your civilization has fallen.'}
          </p>
          {!victory && (
            <p className="rre-reached">
              Reached <b>{eraTitle(run.era)}</b> · {chapterTitle(run.chapter)}
            </p>
          )}
        </header>

        <section className="rre-legacy">
          <div className="rre-legacy-label display">Total Legacy</div>
          <div className="rre-legacy-num num display">{fmt(legacyShown)}</div>
          {stats.best && (
            <div className="rre-best">
              Best Chronicle: <b className="num">{fmt(stats.best.score)}</b> · Era {roman(stats.best.era + 1)}, Chapter {roman(stats.best.chapter + 1)}
            </div>
          )}
        </section>

        <section className="rre-stats">
          {grid.map((g) => (
            <div key={g.label} className="rre-stat">
              <Icon name={g.icon} size={18} />
              <span className="rre-stat-v num">{g.value}</span>
              <span className="rre-stat-l">{g.label}</span>
            </div>
          ))}
        </section>

        {unlocks.length > 0 && (
          <section className="rre-unlocks">
            <div className="rre-unlocks-title display"><Icon name="unlock" size={16} /> Unlocked</div>
            <div className="rre-unlock-row">
              {unlocks.map((u, i) => {
                const card = unlockCard(u);
                return card ? (
                  <Card key={`${u.kind}:${u.id}`} card={card} width="var(--rre-card-w)" faceDown={i >= revealed} tilt />
                ) : (
                  <div key={`${u.kind}:${u.id}`} className={`rre-unlock-badge ${i < revealed ? 'is-in' : ''}`}>
                    <Icon name="star" size={16} /> <span>{u.name}</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <footer className="rre-actions">
          {victory ? (
            <>
              <Button variant="gold" onClick={() => { sfx('click'); act({ type: 'continueEndless' }); }}>
                Continue into Endless <Icon name="chevronRight" size={16} />
              </Button>
              <Button onClick={() => { sfx('click'); useGame.getState().setScreen('summary'); }}>Finish</Button>
            </>
          ) : (
            <>
              <Button variant="gold" onClick={() => { sfx('click'); useGame.getState().setScreen('summary'); }}>
                Chronicle Summary <Icon name="journal" size={16} />
              </Button>
              <Button onClick={() => { sfx('click'); useGame.getState().setScreen('menu'); }}>Main Menu</Button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}
