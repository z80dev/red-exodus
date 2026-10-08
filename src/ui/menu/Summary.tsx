import { useMemo } from 'react';
import { DOCTRINES, LEADERS } from '../../content';
import { useSim } from '../../game/store';
import { CRISIS_CHAPTER, FINAL_ERA } from '../../sim/roguelite/constants';
import { Icon } from '../icons/Icon';
import { LeaderPortrait } from '../art/LeaderPortrait';
import { artFor } from '../art/artManifest';
import { Card } from '../run/Card';
import { doctrineCard } from '../run/cards';
import { runEndUnlocks } from '../run/RunEnd';
import { chapterLabel } from '../hud/format';
import { T } from '../terms';
import { CopySeed, MenuFrame, number, openNewRun } from './shared';

export function Summary() {
  const state = useSim((s) => s);
  const progression = useMemo(() => state ? runEndUnlocks(state) : null, [state]);
  if (!state) return <MenuFrame eyebrow="Your last run" title="Run summary"><div className="ae-empty"><Icon name="book" size={48} /><h2>No runs yet</h2><p>Finish a run to see your results here.</p><button className="ae-button ae-button-gold" onClick={() => openNewRun()}>New run</button></div></MenuFrame>;
  const leader = LEADERS[state.config.leaderId];
  const won = state.run.phase === 'victory' || state.run.phase === 'endless' || state.run.history.some((h) => h.era >= FINAL_ERA && h.chapter === CRISIS_CHAPTER && h.passed);
  const history = state.run.history;
  const max = Math.max(1, ...history.flatMap((h) => [h.score, h.target]));
  const step = 680 / Math.max(1, history.length);
  const backdrop = artFor('key', won ? 'victory' : 'defeat');
  return <MenuFrame eyebrow="Your last run" title="Run summary" actions={<button className="ae-button ae-button-gold" onClick={() => openNewRun()}>New run <Icon name="chevronRight" size={18} /></button>}>
    <section className={`ae-result-banner ${won ? 'won' : 'lost'}`} style={backdrop ? { backgroundImage: `linear-gradient(90deg,var(--ink-900),transparent),url(${backdrop})` } : undefined}>
      <div><span className="ae-eyebrow">{won ? 'Mars has a future' : 'The colony did not make it'}</span><h2>{won ? 'You won!' : 'Run over'}</h2><p>{won ? 'You survived all six eras, from Landfall to New Earth.' : state.run.defeatReason ?? 'The run is over. Try again with a new plan.'}</p></div><Icon name={won ? 'trophy' : 'hourglass'} size={70} />
    </section>
    <div className="ae-summary-stats"><div><span>BEST {T.score.toUpperCase()}</span><strong>{number(state.run.bestScore)}</strong></div><div><span>CHAPTERS PASSED</span><strong>{history.filter((h) => h.passed).length}<small> / {history.length}</small></strong></div><div><span>TURNS</span><strong>{number(state.turn)}</strong></div><div><span>{T.ascension.toUpperCase()}</span><strong>{state.config.ascension}</strong></div></div>
    <div className="ae-summary-layout">
      <section className="ae-summary-chart ae-settings-panel">
        <div className="ae-chart-heading"><h2>{T.score} by chapter</h2><span><i />{T.score} <i className="target" />Target</span></div>
        {history.length > 0 ? <><svg viewBox="0 0 740 230" role="img" aria-label={`${T.score} and target for each chapter`}>
          {[0, 0.5, 1].map((p) => <g key={p}><line x1="48" y1={184 - p * 154} x2="732" y2={184 - p * 154} className="ae-chart-grid" /><text x="40" y={188 - p * 154} textAnchor="end" className="ae-chart-label">{Intl.NumberFormat(undefined, { notation: 'compact' }).format(max * p)}</text></g>)}
          {history.map((h, i) => <g key={`${h.era}-${h.chapter}`}><title>{chapterLabel(h.era, h.chapter)}: {number(h.score)} {T.score}, target {number(h.target)}</title><rect x={52 + i * step + step * 0.18} y={184 - h.score / max * 154} width={Math.max(3, step * 0.55)} height={Math.max(1, h.score / max * 154)} rx="3" fill={h.passed ? 'var(--gold-500)' : 'var(--mandate)'} /><line x1={52 + i * step + step * 0.06} x2={52 + i * step + step * 0.84} y1={184 - h.target / max * 154} y2={184 - h.target / max * 154} className="ae-chart-target" /><text x={52 + i * step + step * 0.45} y="207" textAnchor="middle" className="ae-chart-label">{i + 1}</text></g>)}
        </svg><p className="ae-small-print">Each bar is one chapter. Gold bars beat the target.</p></> : <p>The run ended before the first {T.report}.</p>}
      </section>
      <aside className="ae-summary-leader ae-settings-panel">{leader && <LeaderPortrait leader={leader} alt={state.config.altCommander === true} size={84} shape="round" />}<div><span className="ae-eyebrow">{leader?.country} · {leader?.civName}</span><h2>{state.players[0]?.name}</h2><p>{chapterLabel(state.run.era, state.run.chapter)}</p></div><div className="ae-summary-seed"><span className="ae-eyebrow">Map seed</span><code tabIndex={0}>{state.config.seed}</code><div><CopySeed seed={state.config.seed} /><CopySeed seed={state.config.seed} share /></div></div></aside>
    </div>
    {progression && progression.unlocks.length > 0 && <section className="ae-unlocks"><h3 className="ae-section-title"><Icon name="unlock" size={22} />New unlocks</h3><div>{progression.unlocks.map((u) => <article key={`${u.kind}-${u.id}`}><Icon name={u.kind === 'leader' ? 'crown' : u.kind === 'edict' ? 'edict' : 'doctrine'} size={27} /><span className="ae-eyebrow">{u.kind === 'leader' ? T.leader : u.kind === 'edict' ? T.edict : T.doctrine} unlocked</span><strong>{u.name}</strong></article>)}</div></section>}
    <h3 className="ae-section-title">Your {T.doctrines}</h3><div className="ae-summary-doctrines">{state.run.doctrines.map((d) => DOCTRINES[d.id] && <Card key={d.uid} card={doctrineCard(d.id, d.edition, d, state)} width={155} />)}{state.run.doctrines.length === 0 && <p>You had no {T.doctrines} in this run.</p>}</div>
  </MenuFrame>;
}
