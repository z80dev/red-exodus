// Legacy meter: live projection of this chapter's Chronicle (Renown × Splendor) against the target.
// The hook of the whole game — it fills, glows when the target is passed and bursts on crossing it.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { audio } from '../../audio';
import { useGame } from '../../game/store';
import { previewChronicle } from '../../sim/roguelite';
import type { ChronicleResult, ChronicleStep } from '../../sim/types';
import { Line, Ornament, Popover, fmt, useAnimatedNumber } from '../kit';
import { Icon } from '../icons/Icon';

const DEBOUNCE_MS = 220;

function useProjection(): ChronicleResult | null {
  const version = useGame((g) => g.version);
  const state = useGame((g) => g.state);
  const [res, setRes] = useState<ChronicleResult | null>(() => (state ? previewChronicle(state) : null));
  useEffect(() => {
    if (!state) return;
    const t = setTimeout(() => setRes(previewChronicle(state)), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [version, state]);
  return res;
}

export function LegacyMeter() {
  const res = useProjection();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [burst, setBurst] = useState(0);
  const [bump, setBump] = useState(0);
  const prev = useRef<{ score: number; chapter: string } | null>(null);
  const crossed = useRef<{ passed: boolean; chapter: string } | null>(null);
  const close = useCallback(() => setAnchor(null), []);

  const score = res?.score ?? 0;
  const target = Math.max(1, res?.target ?? 1);
  const chapter = res ? `${res.era}:${res.chapter}` : '';
  const shown = useAnimatedNumber(score, 700);
  const shownRenown = useAnimatedNumber(res?.renown ?? 0, 600);
  const shownSplendor = useAnimatedNumber(res?.splendor ?? 0, 600);
  // visual state follows the animated number so the celebration lands when the bar actually crosses the target
  const passed = shown >= target;

  useEffect(() => {
    if (!res) return;
    const p = prev.current;
    if (p && p.chapter === chapter && res.score > p.score) setBump((b) => b + 1);
    prev.current = { score: res.score, chapter };
  }, [res, chapter]);

  useEffect(() => {
    const c = crossed.current;
    if (c && c.chapter === chapter && !c.passed && passed) {
      setBurst((b) => b + 1);
      audio.sfx('targetPass');
    }
    crossed.current = { passed, chapter };
  }, [passed, chapter]);

  if (!res) return null;
  const ratio = shown / target;
  const fill = Math.min(1, ratio);
  const triumph = ratio >= 2;
  const tone = triumph ? 'is-triumph' : passed ? 'is-pass' : ratio >= 0.75 ? 'is-close' : '';

  return (
    <>
      <button
        type="button"
        className={`lm ${tone} ${anchor ? 'is-active' : ''}`}
        data-tutorial="legacy"
        aria-label={`Projected Legacy ${fmt(score)} of ${fmt(target)}`}
        onClick={(e) => { audio.sfx('tap'); setAnchor(anchor ? null : e.currentTarget); }}
      >
        <span className="lm__formula">
          <span className="lm__chip lm__chip--renown num">{fmt(shownRenown, true)}</span>
          <span className="lm__x">×</span>
          <span className="lm__chip lm__chip--splendor num">{formatSplendor(shownSplendor)}</span>
        </span>
        <span className="lm__track" key={`bump${bump}`}>
          <span className="lm__fill" style={{ transform: `scaleX(${fill})` } as CSSProperties} />
          <span className="lm__sheen" />
          <span className="lm__label num">
            <b>{fmt(shown, true)}</b>
            <span className="lm__target">/ {fmt(target, true)}</span>
          </span>
        </span>
        {passed && <span className="lm__badge">{triumph ? 'Triumph' : `×${ratio.toFixed(ratio >= 10 ? 0 : 1)}`}</span>}
        {burst > 0 && <span className="lm__burst" key={`burst${burst}`} aria-hidden />}
      </button>
      {anchor && (
        <Popover anchor={anchor} onClose={close} width={330} className="lm-pop">
          <LegacyBreakdown res={res} />
        </Popover>
      )}
    </>
  );
}

function formatSplendor(v: number): string {
  return v >= 100 ? fmt(v, true) : String(Math.round(v * 10) / 10);
}

function stepValue(s: ChronicleStep): { text: string; cls: string } {
  if (s.splendorMul != null && s.splendorMul !== 1) return { text: `×${Math.round(s.splendorMul * 100) / 100}`, cls: 'is-mul' };
  if (s.splendorAdd) return { text: `${s.splendorAdd > 0 ? '+' : '−'}${Math.abs(Math.round(s.splendorAdd * 10) / 10)}`, cls: 'is-splendor' };
  if (s.renownAdd) return { text: `${s.renownAdd > 0 ? '+' : '−'}${fmt(Math.abs(s.renownAdd))}`, cls: 'is-renown' };
  return { text: '', cls: '' };
}

function LegacyBreakdown({ res }: { res: ChronicleResult }) {
  const run = useGame((g) => g.state?.run);
  const left = run ? Math.max(0, run.chapterLength - run.chapterTurn) : 0;
  const steps = res.steps.filter((s) => s.source !== 'final' && (s.renownAdd || s.splendorAdd || (s.splendorMul != null && s.splendorMul !== 1)));
  const passed = res.score >= res.target;
  return (
    <div className="lm-bd">
      <div className="lm-bd__head">
        <div>
          <div className="k-title lm-bd__title">Projected Legacy</div>
          <div className="lm-bd__sub">If the Chronicle were written now · {left} {left === 1 ? 'turn' : 'turns'} left</div>
        </div>
        <Icon name={passed ? 'trophy' : 'hourglass'} size={26} color={passed ? 'var(--gold-300)' : 'var(--text-dim)'} />
      </div>
      <div className="lm-bd__formula">
        <span className="lm__chip lm__chip--renown num">{fmt(res.renown)}</span>
        <span className="lm__x">×</span>
        <span className="lm__chip lm__chip--splendor num">{formatSplendor(res.splendor)}</span>
        <span className="lm__x">=</span>
        <span className={`lm-bd__score num ${passed ? 'is-pass' : ''}`}>{fmt(res.score)}</span>
      </div>
      <Ornament />
      <div className="lm-bd__steps">
        {steps.map((s, i) => {
          const v = stepValue(s);
          return (
            <div key={i} className={`lm-step lm-step--${s.source}`}>
              <span className="lm-step__label">{s.label}</span>
              <span className={`lm-step__val num ${v.cls}`}>{v.text}</span>
            </div>
          );
        })}
        {!steps.length && <p className="pop-note">Nothing recorded yet this chapter — grow, build, discover and conquer.</p>}
      </div>
      <Line label="Chapter target" value={fmt(res.target)} strong />
      <Line label={passed ? 'Surplus' : 'Still needed'} value={fmt(Math.abs(res.score - res.target))} tone={passed ? 'good' : 'bad'} />
      {res.score < res.target * 2 && passed && <Line label="Triumph at 2× target (+3◈)" value={fmt(res.target * 2)} tone="dim" />}
    </div>
  );
}
