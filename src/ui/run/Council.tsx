// THE SHOP (internal: Council). Crew, Boosts and Packs between chapters.
// Inspect, buy, reroll when permitted, reorder or sell Crew, and open Packs without leaving the run.
import { T } from '../terms';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useGame, useSim } from '../../game/store';
import { chronicleTarget, councilBuyError, CRISIS_CHAPTER, doctrineSlotsUsed } from '../../sim/roguelite';
import type { ShopItem } from '../../sim/types';
import { Button } from '../kit';
import { Icon } from '../icons/Icon';
import { RichText } from '../icons/RichText';
import { toast } from '../hud/toast';
import { Card, CardZoom } from './Card';
import { crisisCard, EDITION_LABEL, EDITION_TEXT, shopItemCard, shopItemKey } from './cards';
import { DoctrineBar } from './DoctrineBar';
import { EdictTray } from './EdictTray';
import { floatAt, shake, snapshotEl } from './fx';
import { landPurchase, runBefore } from './landing';
import { PackOpen } from './PackOpen';
import { Hearts, InfluencePill, Ornament, PillarStrip } from './parts';
import { act, chapterName, eraTitle, fmt, haptic, nextChapter, sfx, uiSettings } from './runUtil';
import './council.css';

const SECTION_OF: Record<ShopItem['kind'], 'offer' | 'pack'> = { doctrine: 'offer', edict: 'offer', pack: 'pack' };

export function Council() {
  const run = useSim((s) => s.run);
  const state = useGame.getState().state;
  const council = run?.council ?? null;
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(0);
  const [sweeping, setSweeping] = useState(false);
  const [zoomCrisis, setZoomCrisis] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const shopRef = useRef<HTMLDivElement>(null);
  const fast = uiSettings().fastAnimations;
  const dealKey = council ? council.rerolls : 0;
  const itemCount = council?.items.length ?? 0;

  // deal: flip items in one by one with rising card sounds
  useEffect(() => {
    setRevealed(0);
    setSelected(null);
    const step = fast ? 70 : 130;
    const timers: number[] = [];
    for (let i = 0; i < itemCount; i++) {
      timers.push(window.setTimeout(() => sfx('cardDeal', { pitch: 0.95 + i * 0.05, volume: 0.8 }), 60 + i * step));
      timers.push(window.setTimeout(() => {
        setRevealed(i + 1);
        sfx('cardFlip', { pitch: 1 + i * 0.04, volume: 0.6 });
      }, 340 + i * step));
    }
    return () => timers.forEach(clearTimeout);
  }, [dealKey, itemCount, fast]);

  useEffect(() => { sfx('open'); }, []);

  const next = run ? nextChapter(run.era, run.chapter) : null;
  const nextTarget = useMemo(() => {
    if (!state || !next) return 0;
    try { return chronicleTarget(state, next.era, next.chapter); } catch { return 0; }
  }, [state, next?.era, next?.chapter]);

  if (!run || !council || !state || !next) return null;
  const items = council.items;
  const errors = items.map((it, i) => {
    if (!it) return null;
    try { return councilBuyError(state, i); } catch { return run.influence < it.price ? `You need ${it.price - run.influence} more ${T.influence}` : null; }
  });
  const sel = selected != null ? items[selected] ?? null : null;
  const selCard = sel ? shopItemCard(sel) : null;
  const selError = selected != null ? errors[selected] : null;
  const canReroll = !council.rerollLocked && run.influence >= council.rerollCost;
  const nextIsCrisis = next.chapter === CRISIS_CHAPTER && next.era === run.era && !!run.crisis;

  const buy = (slot: number) => {
    const item = items[slot];
    if (!item) return;
    const wrap = shopRef.current?.querySelector<HTMLElement>(`[data-slot="${slot}"]`);
    const cardEl = wrap?.querySelector<HTMLElement>('.rc') ?? null;
    const err = errors[slot];
    if (err) {
      sfx('error');
      haptic(30);
      shake(cardEl, 5, 300);
      toast(err, 'bad');
      return;
    }
    const snap = cardEl && item.kind !== 'pack' ? snapshotEl(cardEl) : null;
    const before = runBefore(run);
    const res = act({ type: 'councilBuy', slot });
    if (!res.ok) return;
    sfx('buy');
    haptic([10, 25, 15]);
    floatAt(rootRef.current?.querySelector('.rco-head .ro-influence') ?? null, `−${item.price} ◈`, { tone: 'influence', size: 18, rise: 30, dy: 30 });
    setSelected(null);
    const live = useGame.getState().state;
    if (live && item.kind !== 'pack' && rootRef.current) void landPurchase(snap, item, before, live.run, res.events, rootRef.current);
    if (item.kind === 'pack') sfx('packOpen', { volume: 0.5 });
  };

  const reroll = () => {
    if (!canReroll) {
      sfx('error');
      toast(`New items cost ${council.rerollCost} ${T.influence}.`, 'bad');
      return;
    }
    setSweeping(true);
    sfx('reroll');
    haptic(12);
    window.setTimeout(() => {
      act({ type: 'councilReroll' });
      setSweeping(false);
    }, fast ? 120 : 260);
  };

  const leave = () => {
    sfx('click');
    act({ type: 'leaveCouncil' });
  };

  const renderItem = (it: ShopItem | null, i: number) => {
    const key = it ? `${dealKey}:${i}:${shopItemKey(it)}` : `${dealKey}:${i}:sold`;
    if (!it) {
      return (
        <div key={key} className="rco-slot rco-slot--sold" data-slot={i}>
          <div className="rco-sold display">Sold</div>
        </div>
      );
    }
    const card = shopItemCard(it);
    const err = errors[i];
    const isSel = selected === i;
    return (
      <div key={key} className={`rco-slot ${isSel ? 'is-selected' : ''}`} data-slot={i} style={{ '--i': i } as CSSProperties}>
        <Card
          card={card}
          width="var(--rco-card-w)"
          faceDown={i >= revealed}
          selected={isSel}
          disabled={!!err && i < revealed}
          onTap={() => {
            if (i >= revealed) return;
            setSelected(isSel ? null : i);
            sfx(isSel ? 'tap' : 'select');
            haptic(6);
          }}
          zoomActions={
            <Button small variant="gold" disabled={!!err} onClick={() => buy(i)}>
              {err ?? <>Buy · {it.price} <Icon name="influence" size={14} /></>}
            </Button>
          }
        />
        {isSel && (
          <button type="button" className={`rco-buy ${err ? 'is-blocked' : ''}`} onClick={() => buy(i)}>
            {it.kind === 'pack' ? 'Open' : 'Buy'}
          </button>
        )}
      </div>
    );
  };

  const offers = items.map((it, i) => ({ it, i })).filter(({ it, i }) => (it ? SECTION_OF[it.kind] === 'offer' : i < 3));
  const packs = items.map((it, i) => ({ it, i })).filter(({ it, i }) => (it ? SECTION_OF[it.kind] === 'pack' : i >= 3));

  return (
    <div className="ro-overlay rco" ref={rootRef} data-tutorial="council">
      <div className="rco-backdrop" />
      <header className="rco-head">
        <div className="rco-titles">
          <h1 className="rco-title display">{T.council}</h1>
          <div className="rco-sub">{eraTitle(run.era)} · after {chapterName(run.chapter)}</div>
        </div>
        <div className="rco-head-right">
          <Hearts total={run.maxMandate} filled={run.mandate} size={16} />
          <InfluencePill value={run.influence} big />
        </div>
      </header>

      <button type="button" className={`rco-next ${nextIsCrisis ? 'is-crisis' : ''}`} onClick={() => { if (nextIsCrisis) { sfx('open'); setZoomCrisis(true); } }}>
        <span className="rco-next-label">Next</span>
        <span className="rco-next-ch display">
          {next.era !== run.era ? `${eraTitle(next.era)} · ` : ''}{chapterName(next.chapter)}
        </span>
        <span className="rco-next-target num"><Icon name="trophy" size={13} /> {T.score} {fmt(nextTarget)}</span>
        {nextIsCrisis && run.crisis && <span className="rco-next-crisis"><Icon name="crisis" size={13} /> {crisisCard(run.crisis).title}</span>}
        {next.era !== run.era && <span className="rco-next-era"><Icon name="star" size={13} /> New era · +Pods</span>}
      </button>

      <section className={`rco-shop ${sweeping ? 'is-sweeping' : ''}`} ref={shopRef}>
        <div className="rco-group">
          <div className="rco-group-label display">For sale</div>
          <div className="rco-row">{offers.map(({ it, i }) => renderItem(it, i))}</div>
        </div>
        <div className="rco-group">
          <div className="rco-group-label display">{T.pack}s</div>
          <div className="rco-row">{packs.map(({ it, i }) => renderItem(it, i))}</div>
        </div>
      </section>

      <section className="rco-owned">
        <div className="rco-owned-docs" data-tutorial="crew-slots">
          <div className="rco-owned-label display">
            {T.doctrines} <span className="num">{doctrineSlotsUsed(run)}/{run.doctrineSlots}</span> <small>drag to move, tap to sell</small>
          </div>
          <DoctrineBar compact={false} sellable slotsBadge={false} cardWidth="var(--rco-doc-w)" />
        </div>
        <div className="rco-owned-edicts">
          <div className="rco-owned-label display">{T.edicts}</div>
          <EdictTray compact={false} cardWidth="var(--rco-edict-w)" />
        </div>
      </section>

      <section className="rco-pillarbox">
        <span className="rco-pillarbox-label">Focus levels</span>
        <PillarStrip levels={run.pillarLevels} focus={run.focus} />
      </section>

      <section className={`rco-info ${selCard ? 'is-on' : ''}`}>
        {selCard && sel ? (
          <>
            <div className="rco-info-head">
              <span className="rco-info-title display">{selCard.title}</span>
              <span className="rco-info-type">{selCard.typeLabel}</span>
            </div>
            <RichText className="rco-info-desc" text={selCard.description} />
            {selCard.edition && selCard.edition !== 'base' && (
              <div className="rco-info-edition"><b>{EDITION_LABEL[selCard.edition]}</b> <RichText text={EDITION_TEXT[selCard.edition]} /></div>
            )}
            {selCard.footer && selCard.edition === undefined && <RichText className="rco-info-foot" text={selCard.footer} />}
            <Button variant="gold" className="rco-info-buy" disabled={!!selError} onClick={() => selected != null && buy(selected)}>
              {selError ? selError : <>{sel.kind === 'pack' ? 'Open' : 'Buy'} · {sel.price} <Icon name="influence" size={15} /></>}
            </Button>
          </>
        ) : (
          <div className="rco-info-hint">
            <Ornament />
            <p>Tap a card to see what it does. Hold it to zoom in.</p>
          </div>
        )}
      </section>

      <footer className="rco-foot">
        <Button className={`rco-reroll ${council.rerollLocked ? 'is-locked' : ''}`} onClick={reroll} disabled={council.rerollLocked || !canReroll || sweeping} title={council.rerollLocked ? 'You cannot refresh this Shop' : undefined}>
          {council.rerollLocked ? <Icon name="lock" size={16} /> : <Icon name="reroll" size={16} />} {council.rerollLocked ? 'No refresh' : 'New items'} {!council.rerollLocked && <span className="rco-cost num">{council.rerollCost}<Icon name="influence" size={12} /></span>}
        </Button>
        <Button variant="gold" className="rco-leave" onClick={leave}>
          Next Chapter <Icon name="chevronRight" size={16} />
        </Button>
      </footer>

      {council.pack && <PackOpen />}
      {zoomCrisis && run.crisis && <CardZoom card={crisisCard(run.crisis)} onClose={() => setZoomCrisis(false)} />}
    </div>
  );
}
