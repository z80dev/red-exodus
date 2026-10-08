// Colony sheet, mobile-first: what it builds now (buy / change), suggested builds, Wake Colonists, growth, yields,
// colony goal, actions and finished buildings.
import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { audio } from '../../audio';
import { BUILDINGS, UNITS, WONDERS } from '../../content';
import { act, selectCity, startCityStrike, startImprove } from '../../game/interaction';
import { useGame, useSim } from '../../game/store';
import { cityStrength, cityStrikeTargets } from '../../sim/combat';
import { canThaw, THAW_POP } from '../../sim/mars';
import { cityBreakdown, humanCities, productionOptions } from '../../sim/selectors';
import type { CityBreakdown, ProductionCategory, ProductionOption, YieldLine } from '../../sim/selectors';
import { HUMAN, YIELD_KEYS } from '../../sim/types';
import type { City, PillarId, ProductionItem, YieldKey } from '../../sim/types';
import { Icon } from '../icons/Icon';
import { RichText } from '../icons/RichText';
import { Bar, Button, Chip, IconButton, Sheet, SheetHeader, Tabs, fmt, signed } from '../kit';
import { PILLAR_NAMES, T, YIELD_NAMES } from '../terms';
import { FOCUS_META, FOCUS_ORDER, YIELD_META, itemIcon, itemName, sameItem, turnsLabel } from './format';
import { toast } from './toast';

const CATS: { id: ProductionCategory; label: string; icon: string }[] = [
  { id: 'building', label: 'Buildings', icon: 'city' },
  { id: 'unit', label: 'Units', icon: 'sword' },
  { id: 'wonder', label: T.wonders, icon: 'wonder' },
  { id: 'project', label: 'Projects', icon: 'star' },
];
const SUGGEST_COUNT = 3;

/** does this build feed the run's Focus? */
function helpsFocus(o: ProductionOption, focus: PillarId): boolean {
  if (o.category === 'building') return BUILDINGS[o.item.id]?.pillar === focus;
  if (o.category === 'wonder') return focus === 'glory';
  if (o.category === 'unit') return focus === 'conquest' && (UNITS[o.item.id]?.strength ?? 0) > 0;
  return false;
}

/** Up to three builds to try first: ones that feed the Focus, then buildings, then the quickest. */
function suggestions(options: ProductionOption[], current: ProductionItem | undefined, focus: PillarId): ProductionOption[] {
  const kindRank: Record<ProductionCategory, number> = { building: 0, wonder: 1, unit: 2, project: 3 };
  const rank = (o: ProductionOption) => (helpsFocus(o, focus) ? 0 : 10) + kindRank[o.category];
  return options
    .filter((o) => !o.lockedReason && o.category !== 'project' && !sameItem(o.item, current))
    .sort((a, b) => rank(a) - rank(b) || (a.turns ?? 999) - (b.turns ?? 999))
    .slice(0, SUGGEST_COUNT);
}

export function CitySheet() {
  const sel = useGame((g) => g.selection);
  const panel = useGame((g) => g.panel);
  const data = useSim((s) => {
    const city = sel?.kind === 'city' ? s.cities[sel.id] : undefined;
    if (!city || city.owner !== HUMAN) return null;
    return {
      city,
      bd: cityBreakdown(s, city),
      options: productionOptions(s, city),
      canStrike: !city.hasStruck && cityStrikeTargets(s, city).length > 0,
      strength: cityStrength(s, city),
      gold: s.players[HUMAN].gold,
      siblings: humanCities(s).map((c) => c.id),
      cryo: s.players[HUMAN].cryo,
      thawError: canThaw(s, HUMAN, city.id),
      focus: s.run.focus,
    };
  });
  const [openYield, setOpenYield] = useState<YieldKey | null>(null);
  const [picker, setPicker] = useState<boolean | null>(null);
  if (!data) return null;
  const { city, bd, options, cryo, thawError } = data;
  const thaw = () => {
    const result = act({ type: 'thawColonists', cityId: city.id }, 'thaw');
    if (result.ok) toast(`${T.thaw}: +${THAW_POP} colonists in ${city.name}.`, 'good', 'cryo');
  };
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
          subtitle={<>{city.isCapital ? `${T.capital} · ` : ''}{city.pop} {city.pop === 1 ? 'colonist' : 'colonists'} · <Icon name="shield" size={12} /> {Math.round(data.strength)} defense</>}
          onClose={close}
        >
          {data.siblings.length > 1 && (
            <span className="cs__cycle">
              <IconButton icon="chevronLeft" label={`Previous ${T.city.toLowerCase()}`} size="sm" onClick={() => cycle(-1)} />
              <IconButton icon="chevronRight" label={`Next ${T.city.toLowerCase()}`} size="sm" onClick={() => cycle(1)} />
            </span>
          )}
        </SheetHeader>

        <div className="cs-sec cs-sec--first" data-tutorial="production">
          <div className="cs-sec__title">
            Building now
            <span className="cs-sec__aside"><Icon name="prod" size={14} /> {fmt(bd.total.prod)} per turn</span>
          </div>
          <Current city={city} bd={bd} options={options} gold={data.gold} onChange={() => setPicker(!showPicker)} pickerOpen={showPicker} />
          {city.queue.length > 1 && (
            <ol className="cs-queue" aria-label="Next in line">
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
          {showPicker && <Picker city={city} options={options} gold={data.gold} focus={data.focus} onPicked={() => setPicker(false)} />}
        </div>

        <div className="cs-thaw">
          <Button disabled={!!thawError} onClick={thaw}><Icon name="cryo" size={18} /> {T.thaw}</Button>
          <span className="cs-thaw__note">{cryo < 1 ? `No ${T.cryo} left.` : `Use 1 of your ${cryo} ${T.cryo}: +${THAW_POP} colonists here.`}</span>
        </div>

        <Growth city={city} bd={bd} />

        <div className="cs-yields">
          {YIELD_KEYS.map((k) => (
            <button key={k} type="button" className={`cs-yield ${openYield === k ? 'is-open' : ''}`} style={{ '--yc': YIELD_META[k].color } as CSSProperties}
              onClick={() => { audio.sfx('tap'); setOpenYield(openYield === k ? null : k); }} aria-label={`${YIELD_META[k].label}: show details`}>
              <Icon name={YIELD_META[k].icon} size={22} />
              <b className="num">{k === 'food' ? signed(bd.total[k]) : fmt(bd.total[k])}</b>
              <small>{YIELD_META[k].label}</small>
            </button>
          ))}
        </div>
        {openYield && <YieldBreakdown bd={bd} k={openYield} />}

        <div className="cs-sec">
          <div className="cs-sec__title">{T.city} goal</div>
          <div className="cs-focus">
            {FOCUS_ORDER.map((f) => (
              <Chip key={f} active={city.focus === f} color={FOCUS_META[f].color} title={FOCUS_META[f].hint}
                onClick={() => { if (city.focus !== f) act({ type: 'setFocus', cityId: city.id, focus: f }, 'click'); }}>
                <Icon name={FOCUS_META[f].icon} size={15} /> {FOCUS_META[f].label}
              </Chip>
            ))}
          </div>
          <p className="cs-hint">{FOCUS_META[city.focus].hint}.</p>
        </div>

        <div className="cs-actions">
          <Button onClick={() => startImprove(city.id)} data-tutorial="improve"><Icon name="improve" size={18} /> Improve tiles</Button>
          {data.canStrike && <Button variant="danger" onClick={() => startCityStrike(city.id)}><Icon name="ranged" size={18} /> Fire at enemy</Button>}
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
      <div className="cs-bar">
        <span className="cs-bar__label"><Icon name="food" size={14} /> Grows in</span>
        <Bar value={g.stored} max={g.threshold} preview={g.stored + Math.max(0, bd.total.food)} color={g.starving ? 'var(--bad)' : 'var(--y-food)'} height={7} />
        <span className={`cs-bar__meta num ${g.starving || g.halted ? 'is-bad' : ''}`}>
          {g.starving ? 'Starving!' : g.halted ? 'Stopped' : turnsLabel(g.turns)}
        </span>
      </div>
      <div className="cs-bar">
        <span className="cs-bar__label"><Icon name="cul" size={14} /> Borders in</span>
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
        <span className="cs-bd__label">{k === 'food' ? 'Extra food' : 'Total'}{bd.pct[k] ? ` (${signed(bd.pct[k])}%)` : ''}</span>
        <b className="num">{k === 'food' ? signed(bd.total[k], 1) : fmt(bd.total[k])}</b>
      </div>
    </div>
  );
}

function buy(city: City, item: ProductionItem, cost: number) {
  const res = act({ type: 'buyItem', cityId: city.id, item }, 'buy');
  if (res.ok) toast(`Bought ${itemName(item)} for ${cost} ${YIELD_NAMES.gold}.`, 'gold', 'gold');
}

function Current({ city, bd, options, gold, onChange, pickerOpen }: { city: City; bd: CityBreakdown; options: ProductionOption[]; gold: number; onChange: () => void; pickerOpen: boolean }) {
  const item = city.queue[0];
  if (!item) {
    return (
      <div className="cs-cur cs-cur--empty">
        <Icon name="hourglass" size={24} />
        <span>Nothing to build. Pick something below.</span>
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
          <div className="cs-cur__meta">{opt?.description ?? 'Runs until you change it.'}</div>
        ) : (
          <>
            <Bar value={p.stored} max={p.cost || 1} preview={p.stored + bd.total.prod} color="var(--y-prod)" height={7} />
            <div className="cs-cur__meta num">Ready in {turnsLabel(p.turns)}</div>
          </>
        )}
      </div>
      <div className="cs-cur__btns">
        {opt?.buyCost != null && (
          <Button small variant="gold" disabled={gold < opt.buyCost} onClick={() => buy(city, item, opt.buyCost!)}
            aria-label={`Buy now for ${opt.buyCost} ${YIELD_NAMES.gold}`} title={gold < opt.buyCost ? `You need ${opt.buyCost} ${YIELD_NAMES.gold}` : undefined}>
            Buy <Icon name="gold" size={15} /> {fmt(opt.buyCost)}
          </Button>
        )}
        <Button small onClick={() => { audio.sfx('tap'); onChange(); }}>{pickerOpen ? 'Done' : 'Change'}</Button>
      </div>
    </div>
  );
}

function Picker({ city, options, gold, focus, onPicked }: { city: City; options: ProductionOption[]; gold: number; focus: PillarId; onPicked: () => void }) {
  const counts = useMemo(() => {
    const c: Record<ProductionCategory, number> = { unit: 0, building: 0, wonder: 0, project: 0 };
    for (const o of options) if (!o.lockedReason) c[o.category]++;
    return c;
  }, [options]);
  const top = useMemo(() => suggestions(options, city.queue[0], focus), [options, city.queue, focus]);
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
    if (res.ok) toast(`${o.name} is next in line.`, 'info', 'plus');
  };
  const row = (o: ProductionOption, tag?: string) => (
    <OptionRow key={`${o.item.kind}:${o.item.id}`} o={o} tag={tag} current={sameItem(city.queue[0], o.item)} gold={gold}
      onChoose={() => choose(o)} onQueue={() => enqueue(o)} onBuy={() => buy(city, o.item, o.buyCost!)} />
  );

  return (
    <div className="cs-picker">
      {top.length > 0 && (
        <>
          <div className="cs-sub">Suggested</div>
          <div className="cs-opts cs-opts--top">{top.map((o) => row(o, helpsFocus(o, focus) ? `Good for ${PILLAR_NAMES[focus]}` : undefined))}</div>
          <div className="cs-sub">All builds</div>
        </>
      )}
      <Tabs tabs={CATS.map((c) => ({ ...c, badge: counts[c.id] || undefined }))} value={cat} onChange={(c) => { audio.sfx('tap'); setCat(c); }} />
      <div className="cs-opts">
        {avail.map((o) => row(o))}
        {!avail.length && <div className="cs-opts__empty">Nothing here yet. Research more to unlock builds.</div>}
      </div>
      {locked.length > 0 && (
        <>
          <button type="button" className="cs-locked-toggle" onClick={() => setShowLocked(!showLocked)}>
            <Icon name={showLocked ? 'chevronLeft' : 'lock'} size={14} /> {showLocked ? 'Hide locked' : `Show ${locked.length} locked`}
          </button>
          {showLocked && <div className="cs-opts">{locked.map((o) => <OptionRow key={`${o.item.kind}:${o.item.id}`} o={o} current={false} gold={gold} onChoose={() => choose(o)} />)}</div>}
        </>
      )}
    </div>
  );
}

function OptionRow({ o, tag, current, gold, onChoose, onQueue, onBuy }: { o: ProductionOption; tag?: string; current: boolean; gold: number; onChoose: () => void; onQueue?: () => void; onBuy?: () => void }) {
  return (
    <div className={`cs-opt ${o.lockedReason ? 'is-locked' : ''} ${current ? 'is-current' : ''} cs-opt--${o.category}`}>
      <button type="button" className="cs-opt__main" onClick={onChoose}>
        <span className="cs-opt__icon"><Icon name={o.icon} size={28} /></span>
        <span className="cs-opt__text">
          <span className="cs-opt__name">{o.name}{current ? <em> · building now</em> : o.queued ? <em> · in line</em> : null}</span>
          {tag && <span className="cs-opt__tag">{tag}</span>}
          {o.lockedReason ? <span className="cs-opt__lock"><Icon name="lock" size={12} /> {o.lockedReason}</span>
            : <span className="cs-opt__desc"><RichText text={o.description} iconSize={13} /></span>}
        </span>
        <span className="cs-opt__cost">
          {o.category !== 'project' ? <><b className="num">{turnsLabel(o.turns)}</b><small className="num"><Icon name="prod" size={12} />{fmt(o.cost)}</small></> : <small>each turn</small>}
        </span>
      </button>
      {!o.lockedReason && (onQueue || onBuy) && (
        <span className="cs-opt__side">
          {onBuy && o.buyCost != null && (
            <button type="button" className="cs-opt__buy num" disabled={gold < o.buyCost} onClick={onBuy} aria-label={`Buy ${o.name} now for ${o.buyCost} ${YIELD_NAMES.gold}`}>
              <Icon name="gold" size={13} />{fmt(o.buyCost)}
            </button>
          )}
          {onQueue && <IconButton icon="plus" label={`Build ${o.name} next`} size="sm" onClick={onQueue} />}
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
      <div className="cs-sec__title">Built here <span className="cs-sec__aside">{list.length + city.wonders.length}</span></div>
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
