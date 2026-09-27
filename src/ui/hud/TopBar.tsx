// Top bar: empire yields (tap → breakdown popover), Mandate, chapter clock and the Legacy meter.
import { useCallback, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { audio } from '../../audio';
import { CRISES } from '../../content';
import { useGame, useSim } from '../../game/store';
import { empireYields, goldBreakdown, happinessBreakdown, humanCities } from '../../sim/selectors';
import type { EmpireYields } from '../../sim/selectors';
import { Icon } from '../icons/Icon';
import { Bar, Button, Hearts, IconButton, Line, Ornament, Popover, fmt, signed } from '../kit';
import { CHAPTER_NAMES, ROMAN, eraName } from './format';
import { LegacyMeter } from './LegacyMeter';

type PopKind = 'gold' | 'sci' | 'cul' | 'happy' | 'influence' | 'mandate' | 'clock';

export function TopBar() {
  const y = useSim((s) => empireYields(s));
  const run = useSim((s) => ({
    era: s.run.era, chapter: s.run.chapter, chapterTurn: s.run.chapterTurn, chapterLength: s.run.chapterLength,
    mandate: s.run.mandate, maxMandate: s.run.maxMandate, influence: s.run.influence, crisisActive: s.run.crisisActive,
    crisis: s.run.crisis, darkAge: s.run.darkAge, turn: s.turn,
  }));
  const [pop, setPop] = useState<{ kind: PopKind; el: HTMLElement } | null>(null);
  const close = useCallback(() => setPop(null), []);
  if (!y || !run) return null;

  const open = (kind: PopKind) => (e: React.MouseEvent<HTMLElement>) => {
    const el = e.currentTarget;
    audio.sfx('tap');
    setPop((p) => (p?.kind === kind ? null : { kind, el }));
  };
  const research = y.research;
  const ringPct = research && research.cost > 0 ? Math.min(1, research.progress / research.cost) : 0;
  const crisisChapter = run.chapter === 2;

  return (
    <div className="tb">
      <div className="tb__row tb__row--main">
        <IconButton icon="pause" label="Menu" size="sm" onClick={() => { audio.sfx('open'); useGame.getState().setPanel('pause'); }} className="tb__pause" />
        <div className="tb__yields">
          <YieldPill icon="gold" color="var(--y-gold)" value={fmt(y.treasury, true)} delta={y.gold} onClick={open('gold')} active={pop?.kind === 'gold'} label="Gold" warn={y.treasury + y.gold < 0} />
          <button type="button" className={`tb-pill tb-pill--sci ${pop?.kind === 'sci' ? 'is-active' : ''} ${!research ? 'is-alert' : ''}`} onClick={open('sci')} data-tutorial="research" aria-label="Science and research">
            <span className="tb-ring" style={{ '--ring': ringPct } as CSSProperties}>
              <svg viewBox="0 0 36 36" aria-hidden>
                <circle cx="18" cy="18" r="15.5" className="tb-ring__track" />
                <circle cx="18" cy="18" r="15.5" className="tb-ring__fill" pathLength={1} />
              </svg>
              <Icon name={research ? research.tech : 'sci'} size={16} />
            </span>
            <span className="tb-pill__text">
              <span className="tb-pill__val num" style={{ color: 'var(--y-sci)' }}>{signed(y.sci)}</span>
              <span className="tb-pill__sub num">{research ? (research.turns != null ? `${research.turns}t` : '—') : 'Pick!'}</span>
            </span>
          </button>
          <YieldPill icon="cul" color="var(--y-cul)" value={signed(y.cul)} onClick={open('cul')} active={pop?.kind === 'cul'} label="Culture" />
          <YieldPill icon={y.happiness < 0 ? 'unhappy' : 'happy'} color={y.happiness < 0 ? 'var(--unhappy)' : 'var(--happy)'} value={String(y.happiness)} onClick={open('happy')} active={pop?.kind === 'happy'} label="Happiness" warn={y.happiness < 0} />
          <YieldPill icon="influence" color="var(--influence)" value={String(run.influence)} onClick={open('influence')} active={pop?.kind === 'influence'} label="Influence" />
        </div>
      </div>
      <div className="tb__row tb__row--run">
        <button type="button" className={`tb-clock ${crisisChapter ? 'is-crisis' : ''} ${pop?.kind === 'clock' ? 'is-active' : ''}`} onClick={open('clock')} aria-label="Chapter clock">
          <span className="tb-clock__era display">{eraName(run.era)}</span>
          <span className="tb-clock__sep">·</span>
          <span className="tb-clock__ch display">{ROMAN[run.chapter]} {CHAPTER_NAMES[run.chapter]}</span>
          <span className="tb-clock__pips" aria-label={`Turn ${run.chapterTurn} of ${run.chapterLength}`}>
            {Array.from({ length: run.chapterLength }, (_, i) => (
              <i key={i} className={i < run.chapterTurn ? 'is-done' : i === run.chapterTurn ? 'is-now' : ''} />
            ))}
          </span>
          <span className="tb-clock__count num">{Math.min(run.chapterTurn + 1, run.chapterLength)}/{run.chapterLength}</span>
        </button>
        <button type="button" className={`tb-mandate ${pop?.kind === 'mandate' ? 'is-active' : ''}`} onClick={open('mandate')} aria-label="Mandate">
          <Hearts value={run.mandate} max={run.maxMandate} size={15} />
        </button>
        <LegacyMeter />
      </div>

      {pop && (
        <Popover anchor={pop.el} onClose={close} width={pop.kind === 'clock' ? 320 : 290}>
          <PopBody kind={pop.kind} y={y} onClose={close} />
        </Popover>
      )}
    </div>
  );
}

function YieldPill({ icon, color, value, delta, onClick, active, label, warn }: {
  icon: string; color: string; value: string; delta?: number; onClick: (e: React.MouseEvent<HTMLElement>) => void; active: boolean; label: string; warn?: boolean;
}) {
  return (
    <button type="button" className={`tb-pill ${active ? 'is-active' : ''} ${warn ? 'is-warn' : ''}`} onClick={onClick} aria-label={label}>
      <Icon name={icon} size={18} color={color} />
      <span className="tb-pill__text">
        <span className="tb-pill__val num" style={{ color }}>{value}</span>
        {delta != null && <span className={`tb-pill__sub num ${delta < 0 ? 'is-neg' : ''}`}>{signed(delta)}</span>}
      </span>
    </button>
  );
}

function PopTitle({ icon, color, children, value }: { icon: string; color: string; children: ReactNode; value?: ReactNode }) {
  return (
    <div className="pop-title">
      <Icon name={icon} size={22} color={color} />
      <span className="pop-title__text display">{children}</span>
      {value != null && <span className="pop-title__val num" style={{ color }}>{value}</span>}
    </div>
  );
}

function PopBody({ kind, y, onClose }: { kind: PopKind; y: EmpireYields; onClose: () => void }) {
  const data = useSim((s) => {
    switch (kind) {
      case 'gold': return { gold: goldBreakdown(s) };
      case 'happy': return { happy: happinessBreakdown(s) };
      case 'sci':
      case 'cul': return { cities: humanCities(s).map((c) => ({ id: c.id, name: c.name, v: kind === 'sci' ? c.yields.sci : c.yields.cul })) };
      default: return {};
    }
  });
  const run = useSim((s) => s.run);
  if (!data || !run) return null;

  switch (kind) {
    case 'gold': {
      const g = data.gold!;
      return (
        <>
          <PopTitle icon="gold" color="var(--y-gold)" value={fmt(g.treasury)}>Treasury</PopTitle>
          <Ornament />
          {g.income.map((l, i) => <Line key={`i${i}`} label={l.label} value={signed(l.amount)} tone="good" />)}
          {g.expenses.map((l, i) => <Line key={`e${i}`} label={l.label} value={signed(-Math.abs(l.amount))} tone="bad" />)}
          <Line label="Net per turn" value={signed(g.net)} strong tone={g.net < 0 ? 'bad' : 'good'} />
          <p className="pop-note">Units: {g.units} ({g.freeUnits} free of upkeep). Spend gold to buy production and improve tiles.</p>
          {g.treasury + g.net < 0 && <p className="pop-note pop-note--bad">Bankrupt next turn — a unit will be disbanded.</p>}
        </>
      );
    }
    case 'sci': {
      const r = y.research;
      return (
        <>
          <PopTitle icon="sci" color="var(--y-sci)" value={signed(y.sci)}>Science</PopTitle>
          <Ornament />
          {r ? (
            <div className="pop-research">
              <Icon name={r.tech} size={30} />
              <div className="pop-research__body">
                <div className="pop-research__name display">{r.name}</div>
                <Bar value={r.progress} max={r.cost} preview={r.progress + y.sci} color="var(--y-sci)" height={7} />
                <div className="pop-research__meta num">{fmt(r.progress)}/{fmt(r.cost)} · {r.turns != null ? `${r.turns} turns` : 'stalled'}</div>
              </div>
            </div>
          ) : <p className="pop-note pop-note--bad">No research selected — science is being wasted.</p>}
          {data.cities!.map((c) => <Line key={c.id} label={c.name} value={signed(c.v)} icon="city" />)}
          <Button variant="gold" small className="pop-cta" onClick={() => { onClose(); audio.sfx('open'); useGame.getState().setPanel('tech'); }}>
            <Icon name="tech" size={16} /> Tech Tree
          </Button>
        </>
      );
    }
    case 'cul':
      return (
        <>
          <PopTitle icon="cul" color="var(--y-cul)" value={signed(y.cul)}>Culture</PopTitle>
          <Ornament />
          {data.cities!.map((c) => <Line key={c.id} label={c.name} value={signed(c.v)} icon="city" />)}
          <p className="pop-note">Culture expands city borders and feeds the <b>Arts</b> pillar of the Chronicle.</p>
        </>
      );
    case 'happy': {
      const h = data.happy!;
      return (
        <>
          <PopTitle icon={h.value < 0 ? 'unhappy' : 'happy'} color={h.value < 0 ? 'var(--unhappy)' : 'var(--happy)'} value={h.value}>Happiness</PopTitle>
          <Ornament />
          {h.lines.map((l, i) => <Line key={i} label={l.label} value={signed(l.amount)} tone={l.amount < 0 ? 'bad' : 'good'} />)}
          <Line label="Total" value={signed(h.value)} strong tone={h.value < 0 ? 'bad' : 'good'} />
          {h.value <= -10 ? <p className="pop-note pop-note--bad">Revolt looms: all yields −20% and rebels may rise.</p>
            : h.value < 0 ? <p className="pop-note pop-note--bad">Unhappy: cities have stopped growing.</p>
            : <p className="pop-note">Luxuries, temples and wonders keep the people content. Each city and citizen costs happiness.</p>}
        </>
      );
    }
    case 'influence':
      return (
        <>
          <PopTitle icon="influence" color="var(--influence)" value={`${run.influence}◈`}>Influence</PopTitle>
          <Ornament />
          <p className="pop-note">Spent at the <b>Council</b> after each Chronicle on Doctrines, Edicts, Scrolls, Packs and Reforms.</p>
          <Line label="Chapter income" value={`+${3 + run.chapter + 1}◈`} />
          <Line label="Interest (1 per 5 unspent, max 5)" value={`+${Math.min(5, Math.floor(run.influence / 5))}◈`} />
          <Line label="Triumph (score ≥ 2× target)" value="+3◈" tone="dim" />
        </>
      );
    case 'mandate':
      return (
        <>
          <PopTitle icon="mandate" color="var(--mandate)" value={`${run.mandate}/${run.maxMandate}`}>Mandate</PopTitle>
          <Ornament />
          <div className="pop-hearts"><Hearts value={run.mandate} max={run.maxMandate} size={26} /></div>
          <p className="pop-note">Missing a chapter's Legacy target costs <b>1 Mandate</b> (2 in a Crisis chapter) and brings a Dark Age. At 0 your civilization collapses.</p>
          {run.darkAge && <p className="pop-note pop-note--bad">Dark Age: all yields −15% this chapter.</p>}
        </>
      );
    case 'clock': {
      const crisis = run.crisis ? CRISES[run.crisis] : undefined;
      const left = Math.max(0, run.chapterLength - run.chapterTurn);
      return (
        <>
          <PopTitle icon="hourglass" color="var(--gold-300)">{eraName(run.era)} Era</PopTitle>
          <Ornament />
          <div className="pop-chapters">
            {CHAPTER_NAMES.map((n, i) => (
              <div key={n} className={`pop-chapter ${i === run.chapter ? 'is-now' : i < run.chapter ? 'is-done' : ''} ${i === 2 ? 'is-crisis' : ''}`}>
                <span className="display">{ROMAN[i]}</span>
                <small>{n}</small>
              </div>
            ))}
          </div>
          <Line label="Turns until the Chronicle" value={left} strong />
          {crisis && (
            <div className={`pop-crisis ${run.crisisActive ? 'is-active' : ''}`}>
              <Icon name={crisis.icon || 'crisis'} size={22} color="var(--bad)" />
              <div>
                <div className="pop-crisis__name display">{run.crisisActive ? 'Crisis: ' : 'Coming crisis: '}{crisis.name}</div>
                <div className="pop-note">{crisis.description}</div>
              </div>
            </div>
          )}
        </>
      );
    }
  }
}
