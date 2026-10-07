// Chapter start: chapter title, Legacy target, Focus Pillar picker, Omen choice → chooseChapterStart.
import { useMemo, useState } from 'react';
import { T } from '../terms';
import type { CSSProperties } from 'react';
import { OMENS } from '../../content';
import { useGame, useSim } from '../../game/store';
import { chronicleTarget, DARK_AGE_TARGET_MUL, projectPillars } from '../../sim/roguelite';
import { PILLARS } from '../../sim/types';
import type { OmenId, PillarId } from '../../sim/types';
import { Button } from '../kit';
import { Icon } from '../icons/Icon';
import { RichText } from '../icons/RichText';
import { CardArt } from '../art/CardArt';
import { CardZoom } from './Card';
import { crisisCard, omenCard } from './cards';
import { useTweened } from './fx';
import { Hearts, Ornament } from './parts';
import { act, chapterName, eraTitle, fmt, haptic, pillarInfo, PILLAR_HUE, PILLAR_MOTIF, roman, sfx } from './runUtil';
import './run.css';

export function ChapterStart() {
  const run = useSim((s) => s.run);
  const state = useGame.getState().state;
  const [focus, setFocus] = useState<PillarId>(() => run?.focus ?? 'arts');
  const [omen, setOmen] = useState<OmenId | null>(null);
  const [zoomCrisis, setZoomCrisis] = useState(false);
  const [zoomOmen, setZoomOmen] = useState<OmenId | null>(null);

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
  const crisisChapter = run.chapter === 2;
  const player = state.players[0];
  const stormPressure = state.storms.reduce((power, storm) => power + storm.power, 0);

  const pick = (p: PillarId) => {
    if (p === focus) return;
    setFocus(p);
    sfx('select', { pitch: 0.9 + PILLARS.indexOf(p) * 0.05 });
    haptic(8);
  };
  const begin = () => {
    sfx('click');
    const res = act({ type: 'chooseChapterStart', focus, omen });
    if (res.ok) haptic([10, 30, 10]);
  };

  return (
    <div data-tutorial="chapter-start" className={`ro-overlay rcs ${crisisChapter ? 'rcs--crisis' : ''}`}>
      <div className="ro-backdrop" />
      <div className="rcs-scroll">
        <header className="rcs-head">
          <div className="rcs-era display">{eraTitle(run.era)}</div>
          <h1 className="rcs-chapter display">
            <span className="rcs-ch-num">Chapter {roman(run.chapter + 1)}</span>
            <span className="rcs-ch-name">{chapterName(run.chapter)}</span>
          </h1>
          <Ornament draw />
          <div className="rcs-target">
            <div className="rcs-target-label">{T.score} target</div>
            <div className="rcs-target-num num display">{fmt(shownTarget)}</div>
            <div className="rcs-target-eq">
              <span className="rcs-eq-r"><Icon name="renown" size={14} /> {T.renown}</span>
              <span className="rcs-eq-x">×</span>
              <span className="rcs-eq-s"><Icon name="splendor" size={14} /> {T.splendor}</span>
            </div>
          </div>
          <div className="rcs-status">
            <Hearts total={run.maxMandate} filled={run.mandate} size={18} />
            <span className="rcs-turns"><Icon name="hourglass" size={14} /> {run.chapterLength} sols</span>
            <span className="rcs-warn rcs-warn--cryo"><Icon name="cryo" size={14} /> {player.cryo} {T.cryo}</span>
            {stormPressure > 0 && <span className="rcs-warn rcs-warn--storm"><Icon name="storm" size={14} /> {T.storm} pressure {stormPressure}</span>}
            {run.darkAge && <span className="rcs-warn rcs-warn--lifeline"><Icon name="mandate" size={14} /> {T.darkAge}: target −{Math.round((1 - DARK_AGE_TARGET_MUL) * 100)}%</span>}
            {crisisChapter && run.crisis && (
              <button type="button" className="rcs-warn rcs-warn--crisis" onClick={() => { sfx('open'); setZoomCrisis(true); }}>
                <Icon name="crisis" size={14} /> {crisisCard(run.crisis).title}
              </button>
            )}
          </div>
        </header>

        <section className="rcs-section rcs-focus">
          <h2 className="rcs-h2 display">{`Choose your ${T.focus}`} <span>{T.focus} {T.renown} ×2 · sets base {T.splendor}</span></h2>
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
                  className={`rcs-pillar ${selected ? 'is-selected' : ''}`}
                  style={{ '--pc': info.color, animationDelay: `${120 + i * 60}ms` } as CSSProperties}
                  onClick={() => pick(p)}
                >
                  <div className="rcs-pillar-art">
                    <CardArt hue={PILLAR_HUE[p]} motif={PILLAR_MOTIF[p]} aspect="square" seed={p} />
                    <div className="rcs-pillar-icon"><Icon name={info.icon} size={30} /></div>
                  </div>
                  <div className="rcs-pillar-name display">{info.name}</div>
                  <div className="rcs-pillar-lv" aria-label={`Level ${level}`}>
                    {Array.from({ length: Math.min(level, 8) }, (_, k) => <i key={k} />)}
                    <span>Lv {level}</span>
                  </div>
                  <div className="rcs-pillar-stats num">
                    <span className="rcs-proj-r" title={`Projected ${T.renown} this chapter`}>
                      <Icon name="renown" size={12} />{proj && proj.renown > 0 ? `≈${fmt(proj.renown * (selected ? 2 : 1))}` : '—'}
                    </span>
                    <span className="rcs-proj-s" title={`Base ${T.splendor} if focused`}>
                      <Icon name="splendor" size={12} />{proj ? fmt(proj.splendor) : level + 1}
                    </span>
                  </div>
                  {selected && <div className="rcs-pillar-ribbon display">Priority ×2</div>}
                </button>
              );
            })}
          </div>
        </section>

        <section className="rcs-section rcs-omens">
          <h2 className="rcs-h2 display">Directives <span>Optional objective for this chapter</span></h2>
          <div className="rcs-omen-list" role="radiogroup" aria-label="Directive">
            {run.omenOffer.map((id, i) => {
              const def = OMENS[id];
              const model = omenCard(id);
              const selected = omen === id;
              return (
                <div
                  key={id}
                  role="radio"
                  aria-checked={selected}
                  tabIndex={0}
                  className={`rcs-omen ${selected ? 'is-selected' : ''}`}
                  style={{ animationDelay: `${420 + i * 90}ms` }}
                  onClick={() => { setOmen(selected ? null : id); sfx(selected ? 'tap' : 'select'); haptic(8); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') setOmen(selected ? null : id); }}
                >
                  <div className="rcs-omen-art" onClick={(e) => { e.stopPropagation(); sfx('open'); setZoomOmen(id); }}>
                    <CardArt hue={model.art?.hue ?? 270} motif={model.art?.motif ?? 'eye'} kind="omens" id={id} aspect="square" seed={id} />
                  </div>
                  <div className="rcs-omen-text">
                    <div className="rcs-omen-name display">{model.title}</div>
                    <RichText className="rcs-omen-desc" text={def?.description ?? ''} />
                    {def && <RichText className="rcs-omen-reward" text={`Reward: ${def.rewardText}`} />}
                  </div>
                  <div className="rcs-omen-check">{selected ? <Icon name="check" size={16} /> : null}</div>
                </div>
              );
            })}
            <button
              type="button"
              role="radio"
              aria-checked={omen === null}
              className={`rcs-omen rcs-omen--decline ${omen === null ? 'is-selected' : ''}`}
              onClick={() => { setOmen(null); sfx('tap'); }}
            >
              <div className="rcs-omen-text">
                <div className="rcs-omen-name display">Decline</div>
                <div className="rcs-omen-desc">Walk your own path this chapter.</div>
              </div>
              <div className="rcs-omen-check">{omen === null ? <Icon name="check" size={16} /> : null}</div>
            </button>
          </div>
        </section>
      </div>

      <footer className="rcs-foot">
        <div className="rcs-foot-summary">
          <span style={{ color: pillarInfo(focus).color }}><Icon name={pillarInfo(focus).icon} size={16} /> {pillarInfo(focus).name}</span>
          {omen && <span className="rcs-foot-omen"><Icon name="omen" size={14} /> {omenCard(omen).title}</span>}
        </div>
        <Button variant="gold" className="rcs-go" onClick={begin}>
          Begin Chapter <Icon name="chevronRight" size={16} />
        </Button>
      </footer>

      {zoomCrisis && run.crisis && <CardZoom card={crisisCard(run.crisis)} onClose={() => setZoomCrisis(false)} />}
      {zoomOmen && <CardZoom card={omenCard(zoomOmen)} onClose={() => setZoomOmen(null)} />}
    </div>
  );
}
