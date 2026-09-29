// Era transition: title card over the era backdrop, then the era's Crisis card flips in. "Prepare" → ackCrisis.
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { CRISES } from '../../content';
import { useGame, useSim } from '../../game/store';
import { backdropFor } from '../art/artManifest';
import { Button } from '../kit';
import { Icon } from '../icons/Icon';
import { RichText } from '../icons/RichText';
import { Card } from './Card';
import { crisisCard } from './cards';
import { useParticles } from './fx';
import { Ornament, usePortrait } from './parts';
import { act, eraTagline, eraTitle, haptic, roman, sfx, uiSettings } from './runUtil';
import './run.css';
import { T } from '../terms';

type Stage = 'era' | 'crisis';

export function CrisisReveal() {
  const run = useSim((s) => s.run);
  const portrait = usePortrait();
  const [stage, setStage] = useState<Stage>('era');
  const [flipped, setFlipped] = useState(false);
  const [setHost, particles] = useParticles();
  const cardRef = useRef<HTMLDivElement>(null);
  const era = run?.era ?? 0;
  const crisisId = run?.crisis ?? null;
  const fast = uiSettings().fastAnimations;

  useEffect(() => {
    sfx('eraFanfare');
    haptic(20);
    particles.current?.emit('ember', ['#ffcf7a', '#ffb35b', '#fff0c0'], 10);
    const t = window.setTimeout(() => setStage('crisis'), fast ? 1500 : 3400);
    return () => clearTimeout(t);
  }, [fast, particles]);

  useEffect(() => {
    if (stage !== 'crisis') return;
    const t1 = window.setTimeout(() => sfx('cardDeal'), 120);
    const t2 = window.setTimeout(() => {
      setFlipped(true);
      sfx('crisisReveal');
      sfx('cardFlip');
      haptic([10, 40, 25]);
      const r = cardRef.current?.getBoundingClientRect();
      if (r) particles.current?.burst(r.left + r.width / 2, r.top + r.height / 2, { colors: ['#ff5a4f', '#ff9a6b', '#ffd0a0'], count: 40, speed: 7, kind: 'spark', life: 1000 });
    }, fast ? 380 : 820);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [stage, fast, particles]);

  const state = useGame((s) => s.state);
  if (!run) return null;
  const bg = backdropFor('eras', String(Math.min(era, 5)), portrait);
  const def = crisisId ? CRISES[crisisId] : undefined;
  const title = eraTitle(era);
  const player = state?.players[0];
  const stormPressure = state?.storms.reduce((power, storm) => power + storm.power, 0) ?? 0;

  return (
    <div
      data-tutorial="crisis-reveal"
      className={`ro-overlay rcr rcr--${stage}`}
      style={{ '--era-hue': `${[36, 200, 350, 28, 18, 210][Math.min(era, 5)]}` } as CSSProperties}
      onPointerDown={() => { if (stage === 'era') setStage('crisis'); }}
    >
      <div className="rcr-bg" style={bg ? { backgroundImage: `url(${bg})` } : undefined} />
      <div className="rcr-vignette" />
      <div className="ro-particles" ref={setHost} />

      <div className="rcr-stage">
        <header className="rcr-title">
          <div className="rcr-era-num display">ARK ERA {roman(era + 1)}</div>
          <h1 className="rcr-era-name display" aria-label={title}>
            {title.split('').map((ch, i) => (
              <span key={i} style={{ animationDelay: `${180 + i * 45}ms` }}>{ch === ' ' ? '\u00a0' : ch}</span>
            ))}
          </h1>
          <Ornament draw className="rcr-orn" />
          <p className="rcr-tagline">{eraTagline(era)}</p>
        </header>

        {stage === 'crisis' && (
          <section className="rcr-crisis">
            <div className="rcr-omen display">
              {crisisId ? <>Chapter III: <em>Dust and consequence</em></> : 'This era holds no crisis'}
            </div>
            {crisisId && (
              <div className="rcr-cardwrap" ref={cardRef}>
                <div className="rcr-cardglow" />
                <Card card={crisisCard(crisisId)} width="var(--rcr-card-w)" faceDown={!flipped} className="rcr-card" />
              </div>
            )}
            <div className={`rcr-info ${flipped || !crisisId ? 'is-in' : ''}`}>
              {def && (
                <>
                  <RichText className="rcr-desc" text={def.description} />
                  <p className="rcr-flavor">“{def.flavor}”</p>
                  <div className="rcr-chips">
                    {def.targetMul && def.targetMul !== 1 && <span className="rcr-chip rcr-chip--bad">Target ×{def.targetMul}</span>}
                    {def.reward > 0 && <span className="rcr-chip">Survive: +{def.reward} {T.influence}</span>}
                    <span className="rcr-chip">Two chapters to prepare</span>
                    {player && <span className="rcr-chip rcr-chip--cryo"><Icon name="cryo" size={14} /> {player.cryo} {T.cryo} aboard</span>}
                    {stormPressure > 0 && <span className="rcr-chip rcr-chip--storm"><Icon name="storm" size={14} /> Storm pressure {stormPressure}</span>}
                  </div>
                </>
              )}
              <Button
                variant="gold"
                className="rcr-go"
                onClick={() => {
                  sfx('click');
                  act({ type: 'ackCrisis' });
                }}
              >
                {crisisId ? 'Prepare the Ark' : 'Begin Landfall'} <Icon name="chevronRight" size={16} />
              </Button>
            </div>
          </section>
        )}
      </div>
      {stage === 'era' && <div className="ro-hint">Tap to continue</div>}
    </div>
  );
}
