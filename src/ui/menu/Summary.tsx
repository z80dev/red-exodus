import { useMemo } from 'react';
import { DOCTRINES, LEADERS } from '../../content';
import { useSim } from '../../game/store';
import { Icon } from '../icons/Icon';
import { LeaderPortrait } from '../art/LeaderPortrait';
import { artFor } from '../art/artManifest';
import { Card } from '../run/Card';
import { doctrineCard } from '../run/cards';
import { runEndUnlocks } from '../run/RunEnd';
import { CopySeed, ERA_NAMES, MenuFrame, number, openNewRun } from './shared';

export function Summary() {
  const state = useSim((s) => s);
  const progression = useMemo(() => state ? runEndUnlocks(state) : null, [state]);
  if (!state) return <MenuFrame eyebrow="The imperial archives" title="Your Chronicle"><div className="ae-empty"><Icon name="book" size={48} /><h2>A story yet to be written</h2><p>Complete a chronicle to see its place in history.</p><button className="ae-button ae-button-gold" onClick={() => openNewRun()}>Begin a new Chronicle</button></div></MenuFrame>;
  const leader = LEADERS[state.config.leaderId];
  const won = state.run.phase === 'victory' || state.run.phase === 'endless' || state.run.history.some((h) => h.era >= 5 && h.chapter === 2 && h.passed);
  const history = state.run.history;
  const max = Math.max(1, ...history.flatMap((h) => [h.score, h.target]));
  const step = 680 / Math.max(1, history.length);
  const backdrop = artFor('key', won ? 'victory' : 'defeat');
  return <MenuFrame eyebrow="A story for the ages" title="Your Chronicle" actions={<button className="ae-button ae-button-gold" onClick={() => openNewRun()}>New Run <Icon name="chevronRight" size={18} /></button>}>
    <section className={`ae-result-banner ${won ? 'won' : 'lost'}`} style={backdrop ? { backgroundImage: `linear-gradient(90deg,var(--ink-900),transparent),url(${backdrop})` } : undefined}><div><span className="ae-eyebrow">{won ? 'History will remember your name' : 'Even fallen empires leave a legacy'}</span><h2>{won ? 'An empire eternal' : 'The final chapter'}</h2><p>{won ? 'Through six ages of triumph and turmoil, your civilization has become immortal.' : state.run.defeatReason ?? 'Your reign has ended. Its lessons will shape the next.'}</p></div><Icon name={won ? 'trophy' : 'hourglass'} size={70} /></section>
    <div className="ae-summary-stats"><div><span>BEST LEGACY</span><strong>{number(state.run.bestScore)}</strong></div><div><span>CHAPTERS PASSED</span><strong>{history.filter((h) => h.passed).length}<small> / {history.length}</small></strong></div><div><span>REIGN</span><strong>{number(state.turn)}<small> turns</small></strong></div><div><span>ASCENSION</span><strong>{state.config.ascension}</strong></div></div>
    <div className="ae-summary-layout"><section className="ae-summary-chart ae-settings-panel"><div className="ae-chart-heading"><h2>Rise of a civilization</h2><span><i />Legacy <i className="target" />Target</span></div>{history.length > 0 ? <><svg viewBox="0 0 740 230" role="img" aria-label="Legacy scores and targets by chapter">{[0, 0.5, 1].map((p) => <g key={p}><line x1="48" y1={184 - p * 154} x2="732" y2={184 - p * 154} className="ae-chart-grid" /><text x="40" y={188 - p * 154} textAnchor="end" className="ae-chart-label">{Intl.NumberFormat(undefined, { notation: 'compact' }).format(max * p)}</text></g>)}{history.map((h, i) => <g key={`${h.era}-${h.chapter}`}><title>{ERA_NAMES[h.era] ?? 'Endless'} chapter {h.chapter + 1}: {number(h.score)} Legacy; {number(h.target)} target</title><rect x={52 + i * step + step * 0.18} y={184 - h.score / max * 154} width={Math.max(3, step * 0.55)} height={Math.max(1, h.score / max * 154)} rx="3" fill={h.passed ? 'var(--gold-500)' : 'var(--mandate)'} /><line x1={52 + i * step + step * 0.06} x2={52 + i * step + step * 0.84} y1={184 - h.target / max * 154} y2={184 - h.target / max * 154} className="ae-chart-target" /><text x={52 + i * step + step * 0.45} y="207" textAnchor="middle" className="ae-chart-label">{i + 1}</text></g>)}</svg><p className="ae-small-print">Chapters of your reign · Gold marks a target surpassed.</p></> : <p>Your reign ended before its first Chronicle was scored.</p>}</section>
    <aside className="ae-summary-leader ae-settings-panel">{leader && <LeaderPortrait leader={leader} size={84} shape="round" />}<div><span className="ae-eyebrow">{leader?.civName}</span><h2>{leader?.name ?? state.players[0]?.name}</h2><p>{ERA_NAMES[state.run.era] ?? 'Endless'} era · Chapter {state.run.chapter + 1}</p></div><div className="ae-summary-seed"><span className="ae-eyebrow">A world worth sharing</span><code tabIndex={0}>{state.config.seed}</code><div><CopySeed seed={state.config.seed} /><CopySeed seed={state.config.seed} share /></div></div></aside></div>
    {progression && progression.unlocks.length > 0 && <section className="ae-unlocks"><h3 className="ae-section-title"><Icon name="unlock" size={22} />New possibilities</h3><div>{progression.unlocks.map((u) => <article key={`${u.kind}-${u.id}`}><Icon name={u.kind === 'leader' ? 'crown' : u.kind === 'edict' ? 'edict' : 'doctrine'} size={27} /><span className="ae-eyebrow">{u.kind} unlocked</span><strong>{u.name}</strong></article>)}</div></section>}
    <h3 className="ae-section-title">The ideas that shaped your empire</h3><div className="ae-summary-doctrines">{state.run.doctrines.map((d) => DOCTRINES[d.id] && <Card key={d.uid} card={doctrineCard(d.id, d.edition, d, state)} width={155} />)}{state.run.doctrines.length === 0 && <p>No Doctrines were acquired in this reign.</p>}</div>
  </MenuFrame>;
}
