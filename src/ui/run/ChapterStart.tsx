// Chapter start: one decision — pick the Focus pillar — then Start. The Dawn chapter also previews the era's Crisis.
import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { CRISES } from '../../content';
import { useGame, useSim } from '../../game/store';
import { chronicleTarget, CHAPTERS_PER_ERA, CRISIS_CHAPTER, DARK_AGE_TARGET_MUL, projectPillars } from '../../sim/roguelite';
import { PILLARS } from '../../sim/types';
import type { PillarId } from '../../sim/types';
import { Button } from '../kit';
import { Icon } from '../icons/Icon';
import { RichText } from '../icons/RichText';
import { CardArt } from '../art/CardArt';
import { T } from '../terms';
import { CardZoom } from './Card';
import { crisisCard } from './cards';
import { useTweened } from './fx';
import { Hearts } from './parts';
import { act, chapterName, eraTitle, fmt, haptic, pillarInfo, sfx } from './runUtil';
import './run.css';

export function ChapterStart() {
  const run = useSim((s) => s.run);
  const state = useGame.getState().state;
  const [focus, setFocus] = useState<PillarId>(() => run?.focus ?? 'arts');
  const [zoomCrisis, setZoomCrisis] = useState(false);

  const target = useMemo(() => {
    if (!state || !run) return 0;
    try { return chronicleTarget(state, run.era, run.chapter); } catch { return 0; }
  }, [state, run]);
  const projections = useMemo(() => {
    if (!state) return null;
    try { return projectPillars(state); } catch { return null; }
  }, [state]);
  const shownTarget = useTweened(target, 1400);

  if (!run || !state) return null;
  const crisisChapter = run.chapter === CRISIS_CHAPTER;
  const crisis = run.crisis ? CRISES[run.crisis] : undefined;

  const pick = (p: PillarId) => {
    if (p === focus) return;
    setFocus(p);
    sfx('select', { pitch: 0.9 + PILLARS.indexOf(p) * 0.05 });
    haptic(8);
  };
  const begin = () => {
    sfx('click');
    const res = act({ type: 'chooseChapterStart', focus });
    if (res.ok) haptic([10, 30, 10]);
  };

  return (
    <div data-tutorial="chapter-start" className={`ro-overlay rcs ${crisisChapter ? 'rcs--crisis' : ''}`}>
      <div className="ro-backdrop" />
      <div className="rcs-body">
        <header className="rcs-head">
          <div className="rcs-era display">{eraTitle(run.era)}</div>
          <h1 className="rcs-chapter display">
            <span className="rcs-ch-num">Chapter {run.chapter + 1} of {CHAPTERS_PER_ERA}</span>
            <span className="rcs-ch-name">{chapterName(run.chapter)}</span>
          </h1>
        </header>

        {crisis && run.crisis && (
          <button
            type="button"
            className={`rcs-crisis ${crisisChapter ? 'is-active' : ''}`}
            onClick={() => { sfx('open'); setZoomCrisis(true); }}
            aria-label={`${T.crisis}: ${crisis.name}`}
          >
            <div className="rcs-crisis-art">
              <CardArt hue={crisis.art.hue} motif={crisis.art.motif} kind="crises" id={crisis.id} aspect="square" seed={crisis.id} />
            </div>
            <div className="rcs-crisis-text">
              <div className="rcs-crisis-top">
                <span className="rcs-crisis-tag"><Icon name="crisis" size={12} /> {T.crisis}</span>
                <span className="rcs-crisis-when">{crisisChapter ? 'Active now' : 'Arrives in chapter 2'}</span>
              </div>
              <div className="rcs-crisis-name display">{crisis.name}</div>
              <RichText className="rcs-crisis-desc" text={crisis.description} />
            </div>
          </button>
        )}

        <div className="rcs-target">
          <div className="rcs-target-label">{T.score} target</div>
          <div className="rcs-target-num num display">{fmt(shownTarget)}</div>
          <div className="rcs-target-eq">
            <span className="rcs-eq-r"><Icon name="renown" size={14} /> {T.renown}</span>
            <span className="rcs-eq-x">×</span>
            <span className="rcs-eq-s"><Icon name="splendor" size={14} /> {T.splendor}</span>
          </div>
          <div className="rcs-status">
            <Hearts total={run.maxMandate} filled={run.mandate} size={16} />
            <span className="rcs-turns"><Icon name="hourglass" size={14} /> {run.chapterLength} turns</span>
            {run.darkAge && (
              <span className="rcs-warn rcs-warn--lifeline">
                <Icon name="mandate" size={14} /> {T.darkAge}: target −{Math.round((1 - DARK_AGE_TARGET_MUL) * 100)}%
              </span>
            )}
          </div>
        </div>

        <section className="rcs-focus">
          <h2 className="rcs-h2 display">Choose your {T.focus}</h2>
          <p className="rcs-help">Your {T.focus} pillar gives double {T.renown}.</p>
          <div className="rcs-pillars" role="radiogroup" aria-label={T.focus}>
            {PILLARS.map((p, i) => {
              const info = pillarInfo(p);
              const level = run.pillarLevels[p] ?? 1;
              const proj = projections?.[p];
              const selected = p === focus;
              return (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  data-pillar={p}
                  className={`rcs-pillar ${selected ? 'is-selected' : ''}`}
                  style={{ '--pc': info.color, animationDelay: `${80 + i * 50}ms` } as CSSProperties}
                  onClick={() => pick(p)}
                >
                  <Icon name={info.icon} size={26} className="rcs-pillar-icon" />
                  <div className="rcs-pillar-name display">{info.name}</div>
                  <div className="rcs-pillar-lv">Level {level}</div>
                  <RichText className="rcs-pillar-hint" text={`Points from: ${info.description.replace(/^(\{renown\}|Points)\s+from\s+/i, '')}`} iconSize={10} />
                  <div className="rcs-pillar-stats num">
                    <span className="rcs-proj-r" title={`Expected ${T.renown} this chapter`}>
                      <Icon name="renown" size={12} />{proj && proj.renown > 0 ? `≈${fmt(proj.renown * (selected ? 2 : 1))}` : '—'}
                    </span>
                    <span className="rcs-proj-s" title={`${T.splendor} if this is your ${T.focus}`}>
                      <Icon name="splendor" size={12} />{proj ? fmt(proj.splendor) : level + 1}
                    </span>
                  </div>
                  {selected && <div className="rcs-pillar-ribbon display">{T.focus} ×2</div>}
                </button>
              );
            })}
          </div>
        </section>
      </div>

      <footer className="rcs-foot">
        <div className="rcs-foot-summary" style={{ color: pillarInfo(focus).color }}>
          <Icon name={pillarInfo(focus).icon} size={16} /> {pillarInfo(focus).name}
        </div>
        <Button variant="gold" className="rcs-go" onClick={begin}>
          Start <Icon name="chevronRight" size={16} />
        </Button>
      </footer>

      {zoomCrisis && run.crisis && <CardZoom card={crisisCard(run.crisis)} onClose={() => setZoomCrisis(false)} />}
    </div>
  );
}
