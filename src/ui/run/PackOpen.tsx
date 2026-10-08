// Pack opening: the sealed pack shivers, tears open with a flash, cards fan out face-down and flip;
// pick N (Take) or Skip. The relevant owned row (Crew / Boosts) is shown so the pick can
// fly home and Crew can be sold to make room.
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useGame, useSim } from '../../game/store';
import { packPickError } from '../../sim/roguelite';
import type { PackKind } from '../../sim/roguelite';
import { Button } from '../kit';
import { Icon } from '../icons/Icon';
import { RichText } from '../icons/RichText';
import { Card } from './Card';
import { EDITION_LABEL, EDITION_TEXT, packCard, shopItemCard, shopItemKey } from './cards';
import { DoctrineBar } from './DoctrineBar';
import { EdictTray } from './EdictTray';
import { shake, snapshotEl, useParticles } from './fx';
import { landPurchase, runBefore } from './landing';
import { act, haptic, sfx, uiSettings } from './runUtil';
import './council.css';

type Stage = 'sealed' | 'torn' | 'fanned';

export function PackOpen() {
  const run = useSim((s) => s.run);
  const pack = run?.council?.pack ?? null;
  const [stage, setStage] = useState<Stage>('sealed');
  const [revealed, setRevealed] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [setHost, particles] = useParticles();
  const rootRef = useRef<HTMLDivElement>(null);
  const packRef = useRef<HTMLDivElement>(null);
  const fast = uiSettings().fastAnimations;
  const [kind] = useState<PackKind>(() => (pack?.options[0]?.kind === 'edict' ? 'edict' : 'doctrine'));
  const [size] = useState<'normal' | 'jumbo'>(() => ((pack?.options.length ?? 3) > 3 ? 'jumbo' : 'normal'));
  const count = pack?.options.length ?? 0;

  useEffect(() => {
    const k = fast ? 0.5 : 1;
    const t: number[] = [];
    t.push(window.setTimeout(() => {
      shake(packRef.current, 6, 420);
      haptic([8, 20, 8, 20, 8]);
    }, 260 * k));
    t.push(window.setTimeout(() => {
      setStage('torn');
      sfx('packOpen');
      haptic(30);
      const r = packRef.current?.getBoundingClientRect();
      if (r) {
        particles.current?.burst(r.left + r.width / 2, r.top + r.height * 0.3, { colors: ['#fff4c9', '#f6dd8f', '#ffffff'], count: 60, speed: 10, kind: 'spark', life: 900 });
        particles.current?.burst(r.left + r.width / 2, r.top + r.height * 0.3, { colors: ['#efe3c4', '#cbbd99'], count: 18, speed: 6, kind: 'shard', life: 900 });
      }
    }, 760 * k));
    t.push(window.setTimeout(() => setStage('fanned'), 1100 * k));
    return () => t.forEach(clearTimeout);
  }, [fast, particles]);

  useEffect(() => {
    if (stage !== 'fanned') return;
    const step = fast ? 90 : 170;
    const t: number[] = [];
    for (let i = 0; i < count; i++) {
      t.push(window.setTimeout(() => sfx('cardDeal', { pitch: 1 + i * 0.05 }), i * step * 0.5));
      t.push(window.setTimeout(() => {
        setRevealed(i + 1);
        sfx('cardFlip', { pitch: 1 + i * 0.06 });
      }, 380 + i * step));
    }
    return () => t.forEach(clearTimeout);
    // count only matters at first fan-out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, fast]);

  const state = useGame.getState().state;
  if (!run || !pack || !state) return null;
  const opts = pack.options;
  const errorOf = (i: number): string | null => {
    try { return packPickError(state, i); } catch { return null; }
  };
  const sel = selected != null ? opts[selected] ?? null : null;
  const selCard = sel ? shopItemCard(sel) : null;
  const selErr = selected != null ? errorOf(selected) : null;

  const take = () => {
    if (selected == null || !sel) return;
    const el = rootRef.current?.querySelector<HTMLElement>(`[data-opt="${selected}"] .rc`) ?? null;
    if (selErr) {
      sfx('error');
      shake(el, 5, 300);
      return;
    }
    const snap = el ? snapshotEl(el) : null;
    const before = runBefore(run);
    const res = act({ type: 'packPick', index: selected });
    if (!res.ok) return;
    sfx('buy', { pitch: 1.1 });
    haptic([10, 30, 15]);
    setSelected(null);
    const live = useGame.getState().state;
    // more picks left → land inside this overlay's owned row; otherwise the Council's (pack closes)
    const scope = live?.run.council?.pack ? rootRef.current : rootRef.current?.closest('.rco');
    if (live && scope) void landPurchase(snap, sel, before, live.run, res.events, scope);
  };

  const skip = () => {
    sfx('close');
    act({ type: 'packPick', index: null });
  };

  const model = packCard(kind, size);
  const fanned = stage === 'fanned';

  return (
    <div className={`rpk rpk--${stage}`} ref={rootRef} style={{ '--n': count } as CSSProperties}>
      <div className="rpk-backdrop" />
      <div className="ro-particles" ref={setHost} />
      <header className="rpk-head">
        <div className="rpk-title display">{model.title}</div>
        <div className="rpk-sub">
          {fanned ? <>Keep <b>{pack.picks}</b> of {opts.length}</> : 'Opening…'}
        </div>
      </header>

      <div className="rpk-center">
        {!fanned && (
          <div className="rpk-pack" ref={packRef}>
            <div className="rpk-pack-top"><Card card={model} width="var(--rpk-pack-w)" tilt={false} zoomable={false} /></div>
            <div className="rpk-pack-bottom"><Card card={model} width="var(--rpk-pack-w)" tilt={false} zoomable={false} /></div>
            {stage === 'torn' && <div className="rpk-flash" />}
          </div>
        )}
        {fanned && (
          <div className="rpk-fan">
            {opts.map((o, i) => {
              const isSel = selected === i;
              const mid = (opts.length - 1) / 2;
              return (
                <div
                  key={`${shopItemKey(o)}:${i}`}
                  className={`rpk-opt ${isSel ? 'is-selected' : ''}`}
                  data-opt={i}
                  style={{ '--i': i, '--off': i - mid } as CSSProperties}
                >
                  <Card
                    card={{ ...shopItemCard(o), price: undefined }}
                    width="var(--rpk-card-w)"
                    faceDown={i >= revealed}
                    selected={isSel}
                    onTap={() => {
                      if (i >= revealed) return;
                      setSelected(isSel ? null : i);
                      sfx(isSel ? 'tap' : 'select');
                      haptic(6);
                    }}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rpk-info">
        {selCard ? (
          <>
            <div className="rpk-info-title display">{selCard.title} <span>{selCard.typeLabel}</span></div>
            <RichText className="rpk-info-desc" text={selCard.description} />
            {selCard.edition && selCard.edition !== 'base' && (
              <div className="rpk-info-ed"><b>{EDITION_LABEL[selCard.edition]}</b> <RichText text={EDITION_TEXT[selCard.edition]} /></div>
            )}
          </>
        ) : (
          <div className="rpk-info-hint">{fanned ? 'Tap a card to see what it does' : ''}</div>
        )}
      </div>

      <div className="rpk-owned">
        {kind === 'doctrine' && <DoctrineBar compact={false} sellable cardWidth="var(--rpk-owned-w)" />}
        {kind === 'edict' && <EdictTray compact={false} cardWidth="var(--rpk-owned-w)" />}
      </div>

      <footer className="rpk-foot">
        <Button variant="ghost" onClick={skip}>Skip</Button>
        <Button variant="gold" disabled={!fanned || selected == null || !!selErr} onClick={take}>
          {selErr ?? 'Take'} {!selErr && <Icon name="check" size={16} />}
        </Button>
      </footer>
    </div>
  );
}
