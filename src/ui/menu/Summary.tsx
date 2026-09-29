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
  if (!state) return <MenuFrame eyebrow="Mission archives" title="Sol Report"><div className="ae-empty"><Icon name="book" size={48} /><h2>No landing report yet</h2><p>Finish a run to see what survived, what was lost, and what Mars learned.</p><button className="ae-button ae-button-gold" onClick={() => openNewRun()}>Choose an Ark</button></div></MenuFrame>;
  const leader = LEADERS[state.config.leaderId];
  const won = state.run.phase === 'victory' || state.run.phase === 'endless' || state.run.history.some((h) => h.era >= 5 && h.chapter === 2 && h.passed);
  const history = state.run.history;
  const max = Math.max(1, ...history.flatMap((h) => [h.score, h.target]));
  const step = 680 / Math.max(1, history.length);
  const backdrop = artFor('key', won ? 'victory' : 'defeat');
  return <MenuFrame eyebrow="Filed from Mars" title="Sol Report" actions={<button className="ae-button ae-button-gold" onClick={() => openNewRun()}>New Landfall <Icon name="chevronRight" size={18} /></button>}>
    <section className={`ae-result-banner ${won ? 'won' : 'lost'}`} style={backdrop ? { backgroundImage: `linear-gradient(90deg,var(--ink-900),transparent),url(${backdrop})` } : undefined}>
      <div><span className="ae-eyebrow">{won ? 'Humanity gets another morning' : 'Mars remains unimpressed'}</span><h2>{won ? 'Viable. Somehow.' : 'The Colony Went Quiet'}</h2><p>{won ? 'Six eras survived, from Landfall through New Earth. The old planet finally has some company.' : state.run.defeatReason ?? 'The run ended. The data remains. Someone else will try.'}</p></div><Icon name={won ? 'trophy' : 'hourglass'} size={70} />
    </section>
    <div className="ae-summary-stats"><div><span>BEST VIABILITY</span><strong>{number(state.run.bestScore)}</strong></div><div><span>CHAPTERS PASSED</span><strong>{history.filter((h) => h.passed).length}<small> / {history.length}</small></strong></div><div><span>SOLS ON MARS</span><strong>{number(state.turn)}<small> sols</small></strong></div><div><span>HAZARD</span><strong>{state.config.ascension}</strong></div></div>
    <div className="ae-summary-layout">
      <section className="ae-summary-chart ae-settings-panel">
        <div className="ae-chart-heading"><h2>Viability by chapter</h2><span><i />Viability <i className="target" />Target</span></div>
        {history.length > 0 ? <><svg viewBox="0 0 740 230" role="img" aria-label="Viability scores and targets by chapter">
          {[0, 0.5, 1].map((p) => <g key={p}><line x1="48" y1={184 - p * 154} x2="732" y2={184 - p * 154} className="ae-chart-grid" /><text x="40" y={188 - p * 154} textAnchor="end" className="ae-chart-label">{Intl.NumberFormat(undefined, { notation: 'compact' }).format(max * p)}</text></g>)}
          {history.map((h, i) => <g key={`${h.era}-${h.chapter}`}><title>{ERA_NAMES[h.era] ?? 'Beyond'} · {['Dawn', 'Dusk', 'Crisis'][h.chapter]}: {number(h.score)} Viability; {number(h.target)} target</title><rect x={52 + i * step + step * 0.18} y={184 - h.score / max * 154} width={Math.max(3, step * 0.55)} height={Math.max(1, h.score / max * 154)} rx="3" fill={h.passed ? 'var(--gold-500)' : 'var(--mandate)'} /><line x1={52 + i * step + step * 0.06} x2={52 + i * step + step * 0.84} y1={184 - h.target / max * 154} y2={184 - h.target / max * 154} className="ae-chart-target" /><text x={52 + i * step + step * 0.45} y="207" textAnchor="middle" className="ae-chart-label">{i + 1}</text></g>)}
        </svg><p className="ae-small-print">Chapters of your run · Gold marks a target surpassed.</p></> : <p>Your run ended before its first Sol Report was scored.</p>}
      </section>
      <aside className="ae-summary-leader ae-settings-panel">{leader && <LeaderPortrait leader={leader} size={84} shape="round" />}<div><span className="ae-eyebrow">{leader?.country} · {leader?.civName}</span><h2>{leader?.name ?? state.players[0]?.name}</h2><p>{ERA_NAMES[state.run.era] ?? 'Beyond'} · {['Dawn', 'Dusk', 'Crisis'][state.run.chapter] ?? ''}</p></div><div className="ae-summary-seed"><span className="ae-eyebrow">Landing seed</span><code tabIndex={0}>{state.config.seed}</code><div><CopySeed seed={state.config.seed} /><CopySeed seed={state.config.seed} share /></div></div></aside>
    </div>
    {progression && progression.unlocks.length > 0 && <section className="ae-unlocks"><h3 className="ae-section-title"><Icon name="unlock" size={22} />New possibilities</h3><div>{progression.unlocks.map((u) => <article key={`${u.kind}-${u.id}`}><Icon name={u.kind === 'leader' ? 'crown' : u.kind === 'edict' ? 'edict' : 'doctrine'} size={27} /><span className="ae-eyebrow">{u.kind === 'leader' ? 'Nation' : u.kind === 'edict' ? 'Salvage' : 'Crew'} unlocked</span><strong>{u.name}</strong></article>)}</div></section>}
    <h3 className="ae-section-title">Crew that made it count</h3><div className="ae-summary-doctrines">{state.run.doctrines.map((d) => DOCTRINES[d.id] && <Card key={d.uid} card={doctrineCard(d.id, d.edition, d, state)} width={155} />)}{state.run.doctrines.length === 0 && <p>No Crew was recruited this run. Mars is a terrible reference.</p>}</div>
  </MenuFrame>;
}
