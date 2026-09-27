// City sheet: growth, yields with breakdown, focus, production (current, queue, picker), buildings, strike, improve.
import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { audio } from '../../audio';
import { BUILDINGS, WONDERS } from '../../content';
import { act, selectCity, startCityStrike, startImprove } from '../../game/interaction';
import { useGame, useSim } from '../../game/store';
import { cityStrength, cityStrikeTargets } from '../../sim/combat';
import { cityBreakdown, humanCities, productionOptions } from '../../sim/selectors';
import type { CityBreakdown, ProductionCategory, ProductionOption, YieldLine } from '../../sim/selectors';
import { HUMAN, YIELD_KEYS } from '../../sim/types';
import type { City, ProductionItem, YieldKey } from '../../sim/types';
import { Icon } from '../icons/Icon';
import { RichText } from '../icons/RichText';
import { Bar, Button, Chip, IconButton, Sheet, SheetHeader, Tabs, fmt, signed } from '../kit';
import { FOCUS_META, FOCUS_ORDER, YIELD_META, itemIcon, itemName, sameItem, turnsLabel } from './format';
import { toast } from './toast';

const CATS: { id: ProductionCategory; label: string; icon: string }[] = [
  { id: 'unit', label: 'Units', icon: 'sword' },
  { id: 'building', label: 'Buildings', icon: 'city' },
  { id: 'wonder', label: 'Wonders', icon: 'wonder' },
  { id: 'project', label: 'Projects', icon: 'star' },
];

export function CitySheet() {
  const sel = useGame((g) => g.selection);
  const panel = useGame((g) => g.panel);
  const data = useSim((s) => {
    const city = sel?.kind === 'city' ? s.cities[sel.id] : undefined;
    if (!city || city.owner !== HUMAN) return null;
    const cities = humanCities(s);
    return {
      city,
      bd: cityBreakdown(s, city),
      options: productionOptions(s, city),
      canStrike: !city.hasStruck && cityStrikeTargets(s, city).length > 0,
      strength: cityStrength(s, city),
      gold: s.players[HUMAN].gold,
      siblings: cities.map((c) => c.id),
    };
  });
  const [openYield, setOpenYield] = useState<YieldKey | null>(null);
  const [picker, setPicker] = useState<boolean | null>(null);
  if (!data) return null;
  const { city, bd, options } = data;
  const close = () => { audio.sfx('close'); useGame.getState().setPanel('none'); };
  const showPicker = picker ?? (panel === 'production' || city.queue.length === 0);
  const idx = data.siblings.indexOf(city.id);
  const cycle = (d: number) => {
    const n = data.siblings[(idx + d + data.siblings.length) % data.siblings.length];
    setOpenYield(null);
    setPicker(null);
    selectCity(n, { focus: true });
  };

  return (
    <Sheet onClose={close} className="cs">
      <div data-tutorial="city-sheet">
        <SheetHeader
          icon={city.isCapital ? 'crown' : 'city'}
          title={city.name}
          subtitle={<>Population {city.pop} · <Icon name="shield" size={12} /> {Math.round(data.strength)} strength</>}
          onClose={close}
        >
          {data.siblings.length > 1 && (
            <span className="cs__cycle">
              <IconButton icon="chevronLeft" label="Previous city" size="sm" onClick={() => cycle(-1)} />
              <IconButton icon="chevronRight" label="Next city" size="sm" onClick={() => cycle(1)} />
            </span>
          )}
        </SheetHeader>

        <Growth city={city} bd={bd} />

        <div className="cs-yields">
          {YIELD_KEYS.map((k) => (
            <button key={k} type="button" className={`cs-yield ${openYield === k ? 'is-open' : ''}`} style={{ '--yc': YIELD_META[k].color } as CSSProperties}
              onClick={() => { audio.sfx('tap'); setOpenYield(openYield === k ? null : k); }} aria-label={`${YIELD_META[k].label} breakdown`}>
              <Icon name={YIELD_META[k].icon} size={22} />
              <b className="num">{k === 'food' ? signed(bd.total[k]) : fmt(bd.total[k])}</b>
              <small>{YIELD_META[k].label}</small>
            </button>
          ))}
        </div>
        {openYield && <YieldBreakdown bd={bd} k={openYield} />}

        <div className="cs-sec">
          <div className="cs-sec__title">City Focus</div>
          <div className="cs-focus">
            {FOCUS_ORDER.map((f) => (
              <Chip key={f} active={city.focus === f} color={FOCUS_META[f].color} title={FOCUS_META[f].hint}
                onClick={() => { if (city.focus !== f) act({ type: 'setFocus', cityId: city.id, focus: f }, 'click'); }}>
                <Icon name={FOCUS_META[f].icon} size={15} /> {FOCUS_META[f].label}
              </Chip>
            ))}
          </div>
        </div>

        <div className="cs-sec" data-tutorial="production">
          <div className="cs-sec__title">
            Production
            <span className="cs-sec__aside"><Icon name="prod" size={14} /> {fmt(bd.total.prod)}/turn</span>
          </div>
          <Current city={city} bd={bd} options={options} gold={data.gold} onChange={() => setPicker(!showPicker)} pickerOpen={showPicker} />
          {city.queue.length > 1 && (
            <ol className="cs-queue">
              {city.queue.slice(1).map((it, i) => (
                <li key={`${it.kind}:${it.id}:${i}`} className="cs-queue__item">
                  <span className="cs-queue__n num">{i + 2}</span>
                  <Icon name={itemIcon(it)} size={20} />
                  <span className="cs-queue__name">{itemName(it)}</span>
                  <IconButton icon="close" label={`Remove ${itemName(it)}`} size="sm" onClick={() => act({ type: 'dequeue', cityId: city.id, index: i + 1 }, 'click')} />
                </li>
              ))}
            </ol>
          )}
          {showPicker && <Picker city={city} options={options} gold={data.gold} onPicked={() => setPicker(false)} />}
        </div>

        <div className="cs-actions">
          <Button onClick={() => startImprove(city.id)} data-tutorial="improve"><Icon name="improve" size={18} /> Improve Tiles</Button>
          {data.canStrike && <Button variant="danger" onClick={() => startCityStrike(city.id)}><Icon name="ranged" size={18} /> City Strike</Button>}
        </div>

        <Buildings city={city} />
      </div>
    </Sheet>
  );
}

function Growth({ city, bd }: { city: City; bd: CityBreakdown }) {
  const g = bd.growth;
  const b = bd.borders;
  return (
    <div className="cs-growth">
      <div className="cs-pop">
        <span className="cs-pop__n num">{city.pop}</span>
        <small>pop</small>
      </div>
      <div className="cs-growth__bars">
        <div className="cs-bar">
          <span className="cs-bar__label"><Icon name="food" size={14} /> Growth</span>
          <Bar value={g.stored} max={g.threshold} preview={g.stored + Math.max(0, bd.total.food)} color={g.starving ? 'var(--bad)' : 'var(--y-food)'} height={7} />
          <span className={`cs-bar__meta num ${g.starving || g.halted ? 'is-bad' : ''}`}>
            {g.starving ? 'Starving!' : g.halted ? 'Halted' : turnsLabel(g.turns)}
          </span>
        </div>
        <div className="cs-bar">
          <span className="cs-bar__label"><Icon name="cul" size={14} /> Borders</span>
          <Bar value={b.stored} max={b.threshold} preview={b.stored + bd.total.cul} color="var(--y-cul)" height={7} />
          <span className="cs-bar__meta num">{turnsLabel(b.turns)}</span>
        </div>
        {city.hp < city.maxHp && (
          <div className="cs-bar">
            <span className="cs-bar__label"><Icon name="hp" size={14} /> Walls</span>
            <Bar value={city.hp} max={city.maxHp} color={city.hp / city.maxHp > 0.5 ? 'var(--good)' : 'var(--bad)'} height={7} />
            <span className="cs-bar__meta num">{city.hp}/{city.maxHp}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function YieldBreakdown({ bd, k }: { bd: CityBreakdown; k: YieldKey }) {
  const lines = bd.lines.filter((l) => (l.yields[k] ?? 0) !== 0 || (l.pct?.[k] ?? 0) !== 0);
  const kindIcon: Record<YieldLine['kind'], string> = {
    center: 'city', tiles: 'map', specialists: 'star', base: 'star', population: 'plus', building: 'building',
    wonder: 'wonder', effect: 'doctrine', happiness: 'happy', consumption: 'minus',
  };
  return (
    <div className="cs-bd" style={{ '--yc': YIELD_META[k].color } as CSSProperties}>
      {lines.map((l, i) => (
        <div key={i} className="cs-bd__line">
          <Icon name={kindIcon[l.kind]} size={14} />
          <span className="cs-bd__label">{l.label}</span>
          {(l.yields[k] ?? 0) !== 0 && <b className={`num ${(l.yields[k] ?? 0) < 0 ? 'is-neg' : ''}`}>{signed(l.yields[k] ?? 0, 1)}</b>}
          {(l.pct?.[k] ?? 0) !== 0 && <b className={`num cs-bd__pct ${(l.pct?.[k] ?? 0) < 0 ? 'is-neg' : ''}`}>{signed(l.pct?.[k] ?? 0)}%</b>}
        </div>
      ))}
      <div className="cs-bd__line cs-bd__line--total">
        <span className="cs-bd__label">{k === 'food' ? 'Surplus' : 'Total'}{bd.pct[k] ? ` (${signed(bd.pct[k])}%)` : ''}</span>
        <b className="num">{k === 'food' ? signed(bd.total[k], 1) : fmt(bd.total[k])}</b>
      </div>
    </div>
  );
}

function buy(city: City, item: ProductionItem, cost: number) {
  const res = act({ type: 'buyItem', cityId: city.id, item }, 'buy');
  if (res.ok) toast(`Purchased ${itemName(item)} for ${cost} gold.`, 'gold', 'gold');
}

function Current({ city, bd, options, gold, onChange, pickerOpen }: { city: City; bd: CityBreakdown; options: ProductionOption[]; gold: number; onChange: () => void; pickerOpen: boolean }) {
  const item = city.queue[0];
  if (!item) {
    return (
      <div className="cs-cur cs-cur--empty">
        <Icon name="hourglass" size={24} />
        <span>Nothing in production — choose below.</span>
      </div>
    );
  }
  const opt = options.find((o) => sameItem(o.item, item));
  const p = bd.production;
  const isProject = item.kind === 'project';
  return (
    <div className="cs-cur">
      <span className="cs-cur__icon"><Icon name={itemIcon(item)} size={34} /></span>
      <div className="cs-cur__body">
        <div className="cs-cur__name display">{itemName(item)}</div>
        {isProject ? (
          <div className="cs-cur__meta">{opt?.description ?? 'Ongoing project'}</div>
        ) : (
          <>
            <Bar value={p.stored} max={p.cost || 1} preview={p.stored + bd.total.prod} color="var(--y-prod)" height={7} />
            <div className="cs-cur__meta num">{fmt(p.stored)}/{fmt(p.cost)} · {turnsLabel(p.turns)}</div>
          </>
        )}
      </div>
      <div className="cs-cur__btns">
        {opt?.buyCost != null && (
          <Button small variant="gold" disabled={gold < opt.buyCost} onClick={() => buy(city, item, opt.buyCost!)} aria-label={`Buy for ${opt.buyCost} gold`}>
            <Icon name="gold" size={15} /> {fmt(opt.buyCost)}
          </Button>
        )}
        <Button small onClick={() => { audio.sfx('tap'); onChange(); }}>{pickerOpen ? 'Done' : 'Change'}</Button>
      </div>
    </div>
  );
}

function Picker({ city, options, gold, onPicked }: { city: City; options: ProductionOption[]; gold: number; onPicked: () => void }) {
  const counts = useMemo(() => {
    const c: Record<ProductionCategory, number> = { unit: 0, building: 0, wonder: 0, project: 0 };
    for (const o of options) if (!o.lockedReason) c[o.category]++;
    return c;
  }, [options]);
  const [cat, setCat] = useState<ProductionCategory>(() => (city.queue[0]?.kind as ProductionCategory | undefined) ?? (counts.building > 0 ? 'building' : 'unit'));
  const [showLocked, setShowLocked] = useState(false);
  const list = options.filter((o) => o.category === cat);
  const avail = list.filter((o) => !o.lockedReason);
  const locked = list.filter((o) => o.lockedReason);

  const choose = (o: ProductionOption) => {
    if (o.lockedReason) { toast(o.lockedReason, 'bad'); audio.sfx('error'); return; }
    const res = act({ type: 'setProduction', cityId: city.id, item: o.item }, 'build');
    if (res.ok) onPicked();
  };
  const enqueue = (o: ProductionOption) => {
    if (o.lockedReason) { toast(o.lockedReason, 'bad'); audio.sfx('error'); return; }
    const res = act({ type: city.queue.length ? 'enqueue' : 'setProduction', cityId: city.id, item: o.item }, 'click');
    if (res.ok) toast(`${o.name} added to the queue.`, 'info', 'plus');
  };

  return (
    <div className="cs-picker">
      <Tabs tabs={CATS.map((c) => ({ ...c, badge: counts[c.id] || undefined }))} value={cat} onChange={(c) => { audio.sfx('tap'); setCat(c); }} />
      <div className="cs-opts">
        {avail.map((o) => <OptionRow key={`${o.item.kind}:${o.item.id}`} o={o} current={sameItem(city.queue[0], o.item)} gold={gold} onChoose={() => choose(o)} onQueue={() => enqueue(o)} onBuy={() => buy(city, o.item, o.buyCost!)} />)}
        {!avail.length && <div className="cs-opts__empty">Nothing available yet — research more technology.</div>}
      </div>
      {locked.length > 0 && (
        <>
          <button type="button" className="cs-locked-toggle" onClick={() => setShowLocked(!showLocked)}>
            <Icon name={showLocked ? 'chevronLeft' : 'lock'} size={14} /> {showLocked ? 'Hide' : 'Show'} {locked.length} locked
          </button>
          {showLocked && <div className="cs-opts">{locked.map((o) => <OptionRow key={`${o.item.kind}:${o.item.id}`} o={o} current={false} gold={gold} onChoose={() => choose(o)} />)}</div>}
        </>
      )}
    </div>
  );
}

function OptionRow({ o, current, gold, onChoose, onQueue, onBuy }: { o: ProductionOption; current: boolean; gold: number; onChoose: () => void; onQueue?: () => void; onBuy?: () => void }) {
  return (
    <div className={`cs-opt ${o.lockedReason ? 'is-locked' : ''} ${current ? 'is-current' : ''} cs-opt--${o.category}`}>
      <button type="button" className="cs-opt__main" onClick={onChoose}>
        <span className="cs-opt__icon"><Icon name={o.icon} size={28} /></span>
        <span className="cs-opt__text">
          <span className="cs-opt__name">{o.name}{o.queued && !current && <em> · queued</em>}</span>
          {o.lockedReason ? <span className="cs-opt__lock"><Icon name="lock" size={12} /> {o.lockedReason}</span>
            : <span className="cs-opt__desc"><RichText text={o.description} iconSize={13} /></span>}
        </span>
        <span className="cs-opt__cost">
          {o.category !== 'project' ? <><b className="num"><Icon name="prod" size={13} />{fmt(o.cost)}</b><small className="num">{turnsLabel(o.turns)}</small></> : <small>per turn</small>}
        </span>
      </button>
      {!o.lockedReason && (onQueue || onBuy) && (
        <span className="cs-opt__side">
          {onBuy && o.buyCost != null && (
            <button type="button" className="cs-opt__buy num" disabled={gold < o.buyCost} onClick={onBuy} aria-label={`Buy ${o.name} for ${o.buyCost} gold`}>
              <Icon name="gold" size={13} />{fmt(o.buyCost)}
            </button>
          )}
          {onQueue && <IconButton icon="plus" label={`Queue ${o.name}`} size="sm" onClick={onQueue} />}
        </span>
      )}
    </div>
  );
}

function Buildings({ city }: { city: City }) {
  const list = city.buildings.filter((b) => BUILDINGS[b]);
  if (!list.length && !city.wonders.length) return null;
  return (
    <div className="cs-sec">
      <div className="cs-sec__title">Buildings <span className="cs-sec__aside">{list.length + city.wonders.length}</span></div>
      <div className="cs-blds">
        {city.wonders.map((w) => (
          <span key={w} className="cs-bld cs-bld--wonder" title={WONDERS[w]?.description}>
            <Icon name={WONDERS[w]?.icon ?? w} size={20} /> {WONDERS[w]?.name ?? w}
          </span>
        ))}
        {list.map((b) => (
          <span key={b} className="cs-bld" title={BUILDINGS[b]?.description} style={BUILDINGS[b]?.pillar ? ({ '--bc': `var(--p-${BUILDINGS[b].pillar})` } as CSSProperties) : undefined}>
            <Icon name={BUILDINGS[b]?.icon ?? b} size={20} /> {BUILDINGS[b]?.name ?? b}
          </span>
        ))}
      </div>
    </div>
  );
}
