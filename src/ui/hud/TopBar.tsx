// Top bar: chapter clock, Credits, Coins, Pods (and Happiness when low) on one row; Lives and the Score meter below.
// Every pill opens a short popover that explains it.
import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import { audio } from '../../audio';
import { CRISES } from '../../content';
import { HUMAN } from '../../sim/types';
import { T, YIELD_NAMES } from '../terms';
import { useGame, useSim } from '../../game/store';
import { startOrbitalDrop } from '../../game/interaction';
import {
  CRISIS_CHAPTER, DARK_AGE_TARGET_MUL, INCOME_BASE, INCOME_CHAPTER_BONUS, INTEREST_CAP, INTEREST_PER, LIFELINE_INFLUENCE,
  MANDATE_LOSS_CRISIS_FAIL, MANDATE_LOSS_FAIL, OVERDRIVE_INFLUENCE_CAP, TRIUMPH_INFLUENCE, TRIUMPH_RATIO,
} from '../../sim/roguelite';
import { empireYields, goldBreakdown, happinessBreakdown } from '../../sim/selectors';
import { Icon } from '../icons/Icon';
import { RichText } from '../icons/RichText';
import { Hearts, IconButton, Line, Ornament, Popover, fmt, signed } from '../kit';
import { CHAPTER_NAMES, chapterLabel, eraName } from './format';
import { ScoreMeter } from './ScoreMeter';

type PopKind = 'gold' | 'happy' | 'influence' | 'mandate' | 'clock';

export function TopBar() {
  const y = useSim((s) => empireYields(s));
  const run = useSim((s) => ({
    era: s.run.era, chapter: s.run.chapter, chapterTurn: s.run.chapterTurn, chapterLength: s.run.chapterLength,
    mandate: s.run.mandate, maxMandate: s.run.maxMandate, influence: s.run.influence,
  }));
  const cryo = useSim((s) => s.players[HUMAN].cryo);
  const [pop, setPop] = useState<{ kind: PopKind; el: HTMLElement } | null>(null);
  const close = useCallback(() => setPop(null), []);
  if (!y || !run) return null;

  const open = (kind: PopKind) => (e: React.MouseEvent<HTMLElement>) => {
    const el = e.currentTarget;
    audio.sfx('tap');
    setPop((p) => (p?.kind === kind ? null : { kind, el }));
  };
  const left = Math.max(0, run.chapterLength - run.chapterTurn);
  const crisisChapter = run.chapter === CRISIS_CHAPTER;

  return (
    <div className="tb">
      <div className="tb__row tb__row--main">
        <IconButton icon="pause" label="Menu" size="sm" onClick={() => { audio.sfx('open'); useGame.getState().setPanel('pause'); }} className="tb__pause" />
        <button type="button" className={`tb-clock ${crisisChapter ? 'is-crisis' : ''} ${pop?.kind === 'clock' ? 'is-active' : ''}`} onClick={open('clock')}
          aria-label={`${chapterLabel(run.era, run.chapter)}, ${left} ${left === 1 ? 'turn' : 'turns'} left`}>
          <span className="tb-clock__ch display">{chapterLabel(run.era, run.chapter)}</span>
          <span className={`tb-clock__left ${left <= 1 ? 'is-last' : ''}`}>{left} {left === 1 ? 'turn' : 'turns'} left</span>
        </button>
        <Pill icon="gold" color="var(--y-gold)" value={fmt(y.treasury, true)} sub={signed(y.gold)} subBad={y.gold < 0} onClick={open('gold')} active={pop?.kind === 'gold'} label={YIELD_NAMES.gold} warn={y.treasury + y.gold < 0} />
        <Pill icon="influence" color="var(--influence)" value={String(run.influence)} onClick={open('influence')} active={pop?.kind === 'influence'} label={T.influence} />
        <button type="button" className="tb-pill tb-pill--cryo" data-tutorial="drop" aria-label={`${T.drop}: ${cryo ?? 0} ${T.cryo}`} title={T.drop}
          onClick={() => { audio.sfx('tap'); startOrbitalDrop(); }}>
          <Icon name="cryo" size={18} color="var(--y-sci)" />
          <span className="tb-pill__val num">{cryo ?? 0}</span>
        </button>
        {y.happiness < 0 && (
          <Pill icon="unhappy" color="var(--unhappy)" value={String(y.happiness)} onClick={open('happy')} active={pop?.kind === 'happy'} label={T.happiness} warn />
        )}
      </div>
      <div className="tb__row tb__row--run">
        <button type="button" className={`tb-mandate ${pop?.kind === 'mandate' ? 'is-active' : ''}`} onClick={open('mandate')} aria-label={`${T.mandate}: ${run.mandate} of ${run.maxMandate}`}>
          <Hearts value={run.mandate} max={run.maxMandate} size={13} />
        </button>
        <ScoreMeter />
      </div>

      {pop && (
        <Popover anchor={pop.el} onClose={close} width={300}>
          <PopBody kind={pop.kind} />
        </Popover>
      )}
    </div>
  );
}

function Pill({ icon, color, value, sub, subBad, onClick, active, label, warn }: {
  icon: string; color: string; value: string; sub?: string; subBad?: boolean; onClick: (e: React.MouseEvent<HTMLElement>) => void; active: boolean; label: string; warn?: boolean;
}) {
  return (
    <button type="button" className={`tb-pill ${active ? 'is-active' : ''} ${warn ? 'is-warn' : ''}`} onClick={onClick} aria-label={label}>
      <Icon name={icon} size={18} color={color} />
      <span className="tb-pill__text">
        <span className="tb-pill__val num" style={{ color }}>{value}</span>
        {sub != null && <span className={`tb-pill__sub num ${subBad ? 'is-neg' : ''}`}>{sub}</span>}
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

function PopBody({ kind }: { kind: PopKind }) {
  const data = useSim((s) => {
    switch (kind) {
      case 'gold': return { gold: goldBreakdown(s) };
      case 'happy': return { happy: happinessBreakdown(s) };
      default: return {};
    }
  });
  const run = useSim((s) => s.run);
  if (!data || !run) return null;
  const lessPct = Math.round((1 - DARK_AGE_TARGET_MUL) * 100);

  switch (kind) {
    case 'gold': {
      const g = data.gold!;
      return (
        <>
          <PopTitle icon="gold" color="var(--y-gold)" value={fmt(g.treasury)}>{YIELD_NAMES.gold}</PopTitle>
          <Ornament />
          {g.income.map((l, i) => <Line key={`i${i}`} label={l.label} value={signed(l.amount)} tone="good" />)}
          {g.expenses.map((l, i) => <Line key={`e${i}`} label={l.label} value={signed(-Math.abs(l.amount))} tone="bad" />)}
          <Line label="Each turn" value={signed(g.net)} strong tone={g.net < 0 ? 'bad' : 'good'} />
          <p className="pop-note">Use {YIELD_NAMES.gold} to buy builds in a colony and to improve tiles. Units: {g.units} ({g.freeUnits} are free).</p>
          {g.treasury + g.net < 0 && <p className="pop-note pop-note--bad">You will run out next turn. You will lose a unit.</p>}
        </>
      );
    }
    case 'happy': {
      const h = data.happy!;
      return (
        <>
          <PopTitle icon={h.value < 0 ? 'unhappy' : 'happy'} color={h.value < 0 ? 'var(--unhappy)' : 'var(--happy)'} value={h.value}>{T.happiness}</PopTitle>
          <Ornament />
          {h.lines.map((l, i) => <Line key={i} label={l.label} value={signed(l.amount)} tone={l.amount < 0 ? 'bad' : 'good'} />)}
          <Line label="Total" value={signed(h.value)} strong tone={h.value < 0 ? 'bad' : 'good'} />
          {h.value <= -10 ? <p className="pop-note pop-note--bad">Very unhappy: colonies make less and rebels may appear.</p>
            : h.value < 0 ? <p className="pop-note pop-note--bad">Unhappy: your colonies stop growing.</p>
            : <p className="pop-note">Your people are happy again.</p>}
          <p className="pop-note">Each colony and colonist lowers {T.happiness}. Luxuries, some buildings and {T.wonders} raise it.</p>
        </>
      );
    }
    case 'influence':
      return (
        <>
          <PopTitle icon="influence" color="var(--influence)" value={run.influence}>{T.influence}</PopTitle>
          <Ornament />
          <p className="pop-note">Spend {T.influence} in the {T.council} between chapters. You get more {T.influence} for big scores.</p>
          <Line label="Each chapter" value={`+${INCOME_BASE + (INCOME_CHAPTER_BONUS[run.chapter] ?? 0)}`} />
          <Line label="Savings bonus" value={`+${Math.min(INTEREST_CAP, Math.floor(run.influence / INTEREST_PER))}`} />
          <Line label={`${T.triumph}: ${T.score} ${TRIUMPH_RATIO}× the target`} value={`+${TRIUMPH_INFLUENCE}`} tone="dim" />
          <Line label={`Bonus Coins: +1 for each extra target (max ${OVERDRIVE_INFLUENCE_CAP})`} value="+1" tone="dim" />
          <p className="pop-note">Savings: +1 for every {INTEREST_PER} {T.influence} you keep (max {INTEREST_CAP}).</p>
        </>
      );
    case 'mandate':
      return (
        <>
          <PopTitle icon="mandate" color="var(--mandate)" value={`${run.mandate}/${run.maxMandate}`}>{T.mandate}</PopTitle>
          <Ornament />
          <div className="pop-hearts"><Hearts value={run.mandate} max={run.maxMandate} size={26} /></div>
          <p className="pop-note">If your {T.score} misses the target, you lose {MANDATE_LOSS_FAIL} life ({MANDATE_LOSS_CRISIS_FAIL} in a {T.crisis} chapter). At 0 lives the run ends.</p>
          <p className="pop-note">After a miss you get a {T.darkAge}: +{LIFELINE_INFLUENCE} {T.influence} and a {lessPct}% lower target next chapter.</p>
          {run.darkAge && <p className="pop-note">{T.darkAge} is on: this target is {lessPct}% lower.</p>}
        </>
      );
    case 'clock': {
      const crisis = run.crisis ? CRISES[run.crisis] : undefined;
      const left = Math.max(0, run.chapterLength - run.chapterTurn);
      return (
        <>
          <PopTitle icon="hourglass" color="var(--gold-300)">{eraName(run.era)}</PopTitle>
          <Ornament />
          <div className="pop-chapters">
            {CHAPTER_NAMES.map((n, i) => (
              <div key={n} className={`pop-chapter ${i === run.chapter ? 'is-now' : i < run.chapter ? 'is-done' : ''} ${i === CRISIS_CHAPTER ? 'is-crisis' : ''}`}>
                <small>{n}</small>
              </div>
            ))}
          </div>
          <Line label={`${left === 1 ? 'Turn' : 'Turns'} left in this chapter`} value={left} strong />
          <p className="pop-note">At the end of the chapter you get your {T.report}.</p>
          {crisis && (
            <div className={`pop-crisis ${run.crisisActive ? 'is-active' : ''}`}>
              <Icon name={crisis.icon || 'crisis'} size={22} color="var(--bad)" />
              <div>
                <div className="pop-crisis__name display">{run.crisisActive ? `${T.crisis} now: ` : `Next ${T.crisis}: `}{crisis.name}</div>
                <div className="pop-note"><RichText text={crisis.description} iconSize={13} /></div>
              </div>
            </div>
          )}
        </>
      );
    }
  }
}
