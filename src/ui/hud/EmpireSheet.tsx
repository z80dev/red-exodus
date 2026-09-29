// Empire overview: cities, rivals (war / peace), treasury & happiness breakdowns.
import { useState } from 'react';
import type { CSSProperties } from 'react';
import { audio } from '../../audio';
import { LEADERS } from '../../content';
import { act, selectCity } from '../../game/interaction';
import { useGame, useSim } from '../../game/store';
import { empireYields, goldBreakdown, happinessBreakdown, humanCities, militaryStrength, rivalsSummary } from '../../sim/selectors';
import type { RivalSummary } from '../../sim/selectors';
import { HUMAN, YIELD_KEYS } from '../../sim/types';
import { Icon } from '../icons/Icon';
import { Button, ConfirmDialog, Line, Sheet, SheetHeader, Tabs, fmt, signed } from '../kit';
import { YIELD_META, itemIcon, itemName, turnsLabel } from './format';
import { toast } from './toast';
import { Crest as MarsCrest } from '../art/Crest';

type Tab = 'cities' | 'rivals' | 'economy';

export function EmpireSheet() {
  const [tab, setTab] = useState<Tab>('cities');
  const me = useSim((s) => ({ name: s.players[HUMAN].civName, leader: s.players[HUMAN].name, y: empireYields(s) }));
  const close = () => { audio.sfx('close'); useGame.getState().setPanel('none'); };
  if (!me) return null;
  return (
    <Sheet onClose={close} className="es">
      <SheetHeader icon="crown" title={me.name} subtitle={<>{me.leader} · {me.y.cities} {me.y.cities === 1 ? 'city' : 'cities'} · {me.y.pop} {me.y.pop === 1 ? 'citizen' : 'citizens'}</>} onClose={close} />
      <Tabs<Tab>
        tabs={[{ id: 'cities', label: 'Cities', icon: 'city' }, { id: 'rivals', label: 'Rivals', icon: 'war' }, { id: 'economy', label: 'Economy', icon: 'gold' }]}
        value={tab}
        onChange={(t) => { audio.sfx('tap'); setTab(t); }}
      />
      {tab === 'cities' && <Cities />}
      {tab === 'rivals' && <Rivals />}
      {tab === 'economy' && <Economy />}
    </Sheet>
  );
}

function Cities() {
  const rows = useSim((s) => humanCities(s));
  if (!rows) return null;
  if (!rows.length) return <p className="es-empty">You have no cities yet. Found one with your Settler.</p>;
  return (
    <div className="es-cities">
      {rows.map((c) => (
        <button key={c.id} type="button" className="es-city" onClick={() => selectCity(c.id, { focus: true })}>
          <span className="es-city__pop num">{c.pop}</span>
          <span className="es-city__main">
            <span className="es-city__name display">{c.isCapital && <Icon name="crown" size={13} />} {c.name}</span>
            <span className="es-city__yields">
              {YIELD_KEYS.map((k) => (
                <span key={k} style={{ color: YIELD_META[k].color }} className="num"><Icon name={YIELD_META[k].icon} size={12} />{k === 'food' ? signed(c.yields[k]) : fmt(c.yields[k])}</span>
              ))}
            </span>
          </span>
          <span className="es-city__prod">
            {c.queue[0] ? <><Icon name={itemIcon(c.queue[0])} size={20} /><small>{itemName(c.queue[0])}</small></> : <small className="is-bad">Idle!</small>}
          </span>
        </button>
      ))}
    </div>
  );
}


function Crest({ r }: { r: RivalSummary }) {
  const leader = LEADERS[r.leaderId];
  const colors = r.met ? r.colors : { primary: '#536168', secondary: '#7f7a6e' };
  return (
    <span className="es-crest">
      <MarsCrest
        motif={r.met ? leader?.portrait.crest ?? 'shield' : 'shield'}
        colors={colors}
        code={r.met ? leader?.code : undefined}
        flagColors={r.met ? leader?.flagColors : undefined}
        size={40}
        title={r.met ? `${r.civName} · ${leader?.code ?? ''}` : 'Unknown Ark'}
      />
    </span>
  );
}
function Rivals() {
  const data = useSim((s) => ({ rivals: rivalsSummary(s), me: empireYields(s), myTechs: s.players[HUMAN].techs.length, myMil: militaryStrength(s, HUMAN) }));
  const [confirm, setConfirm] = useState<RivalSummary | null>(null);
  if (!data) return null;
  const { rivals } = data;
  const maxOf = (f: (r: { cities: number; techs: number; military: number }) => number) =>
    Math.max(1, f({ cities: data.me.cities, techs: data.myTechs, military: data.myMil }), ...rivals.map(f));
  const maxes = { cities: maxOf((r) => r.cities), techs: maxOf((r) => r.techs), military: maxOf((r) => r.military) };
  return (
    <div className="es-rivals">
      {rivals.map((r) => (
        <div key={r.id} className={`es-rival ${!r.alive ? 'is-dead' : ''} ${r.relation === 'war' && r.alive ? 'is-war' : ''}`}>
          <div className="es-rival__head">
            <Crest r={r} />
            <div className="es-rival__names">
              <div className="es-rival__civ display">{r.met ? r.civName : 'Unknown Civilization'}</div>
              <div className="es-rival__leader">{r.met ? `${r.name}${r.personality ? ` · ${r.personality[0].toUpperCase()}${r.personality.slice(1)}` : ''}` : 'Not yet met'}</div>
            </div>
            {!r.met ? null : r.alive ? (
              <span className={`es-rel ${r.relation === 'war' ? 'is-war' : 'is-peace'}`}>
                <Icon name={r.relation === 'war' ? 'war' : 'peace'} size={14} /> {r.relation === 'war' ? 'War' : 'Peace'}
              </span>
            ) : <span className="es-rel is-dead"><Icon name="skull" size={14} /> Fallen</span>}
          </div>
          {r.met && r.alive && (
            <>
              <div className="es-rival__bars">
                <Strength label="Military" icon="sword" v={r.military} max={maxes.military} mine={data.myMil} />
                <Strength label="Cities" icon="city" v={r.cities} max={maxes.cities} mine={data.me.cities} />
                <Strength label="Techs" icon="tech" v={r.techs} max={maxes.techs} mine={data.myTechs} />
              </div>
              <div className="es-rival__foot">
                <span className="es-rival__stat"><Icon name="wonder" size={14} /> {r.wonders} wonders</span>
                <span className="es-rival__stat"><Icon name="plus" size={14} /> {r.pop} pop</span>
                {r.capital && <span className="es-rival__stat"><Icon name="crown" size={14} /> {r.capital.name}</span>}
                <span className="es-rival__btn">
                  {r.relation === 'war' ? (
                    <Button small variant="gold" onClick={() => {
                      const res = act({ type: 'offerPeace', target: r.id }, 'click');
                      if (res.ok) toast(`${r.civName} accepts peace.`, 'good', 'peace');
                    }}><Icon name="peace" size={15} /> Offer Peace</Button>
                  ) : (
                    <Button small variant="danger" onClick={() => { audio.sfx('open'); setConfirm(r); }}><Icon name="war" size={15} /> Declare War</Button>
                  )}
                </span>
              </div>
            </>
          )}
        </div>
      ))}
      {!rivals.length && <p className="es-empty">No rivals share this world.</p>}
      {confirm && (
        <ConfirmDialog
          title={`Declare war on ${confirm.civName}?`}
          body={<>Their armies will march on your borders. Some Doctrines reward war — others punish breaking the peace.</>}
          icon="war"
          danger
          confirmLabel="Declare War"
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            const r = confirm;
            setConfirm(null);
            act({ type: 'declareWar', target: r.id }, 'attack');
          }}
        />
      )}
    </div>
  );
}

function Strength({ label, icon, v, max, mine }: { label: string; icon: string; v: number; max: number; mine: number }) {
  const tone = v > mine * 1.25 ? 'is-ahead' : v < mine * 0.8 ? 'is-behind' : '';
  return (
    <div className={`es-str ${tone}`}>
      <span className="es-str__label"><Icon name={icon} size={12} /> {label}</span>
      <span className="es-str__track">
        <span className="es-str__mine" style={{ transform: `scaleX(${mine / max})` }} />
        <span className="es-str__fill" style={{ transform: `scaleX(${v / max})` }} />
      </span>
      <span className="es-str__v num">{fmt(v)}</span>
    </div>
  );
}

function Economy() {
  const d = useSim((s) => ({ gold: goldBreakdown(s), happy: happinessBreakdown(s), y: empireYields(s) }));
  if (!d) return null;
  return (
    <div className="es-econ">
      <div className="es-econ__totals">
        {YIELD_KEYS.map((k) => (
          <div key={k} className="es-total" style={{ '--yc': YIELD_META[k].color } as CSSProperties}>
            <Icon name={YIELD_META[k].icon} size={20} />
            <b className="num">{signed(d.y[k])}</b>
            <small>{YIELD_META[k].label}</small>
          </div>
        ))}
      </div>
      <section className="es-card">
        <h3 className="es-card__title"><Icon name="gold" size={18} /> Treasury <span className="num">{fmt(d.gold.treasury)}</span></h3>
        {d.gold.income.map((l, i) => <Line key={`i${i}`} label={l.label} value={signed(l.amount)} tone="good" />)}
        {d.gold.expenses.map((l, i) => <Line key={`e${i}`} label={l.label} value={signed(-Math.abs(l.amount))} tone="bad" />)}
        <Line label="Net per turn" value={signed(d.gold.net)} strong tone={d.gold.net < 0 ? 'bad' : 'good'} />
      </section>
      <section className="es-card">
        <h3 className="es-card__title"><Icon name={d.happy.value < 0 ? 'unhappy' : 'happy'} size={18} /> Happiness <span className="num">{signed(d.happy.value)}</span></h3>
        {d.happy.lines.map((l, i) => <Line key={i} label={l.label} value={signed(l.amount)} tone={l.amount < 0 ? 'bad' : 'good'} />)}
        <Line label="Total" value={signed(d.happy.value)} strong tone={d.happy.value < 0 ? 'bad' : 'good'} />
      </section>
      {d.y.research && (
        <section className="es-card">
          <h3 className="es-card__title"><Icon name="sci" size={18} /> Research</h3>
          <Line label={d.y.research.name} value={turnsLabel(d.y.research.turns)} />
        </section>
      )}
    </div>
  );
}
