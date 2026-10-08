// Bottom unit card: portrait, plain stats, a few actions (Found Colony, Fortify, Explore, Skip) and Remove behind "⋯".
import { useState } from 'react';
import type { CSSProperties } from 'react';
import { audio } from '../../audio';
import { PROMOTIONS, UNITS } from '../../content';
import { act, cityOnTile, deselect, focusNextUnit, selectCity } from '../../game/interaction';
import { useGame, useSim } from '../../game/store';
import { canFoundCity } from '../../sim/cities';
import { hexDistance } from '../../sim/hex';
import { stormPowerAt } from '../../sim/mars';
import { isCivilian, maxMoves } from '../../sim/units';
import { HUMAN } from '../../sim/types';
import type { GameState, Unit, UnitOrder } from '../../sim/types';
import { Icon } from '../icons/Icon';
import { Bar, ConfirmDialog, IconButton } from '../kit';
import { T } from '../terms';
import { playerColor } from './format';
import { toast } from './toast';

const CLASS_LABEL: Record<string, string> = {
  civilian: 'Civilian', recon: 'Scout', melee: 'Melee', antiCavalry: 'Spear', ranged: 'Ranged', mounted: 'Fast',
  siege: 'Siege', naval: 'Boat', armor: 'Armor',
};

const ORDER_LABEL: Record<UnitOrder['kind'], string> = { goto: 'Moving', explore: 'Exploring', fortify: 'Fortified', heal: 'Healing' };

interface UnitActionDef {
  id: string;
  icon: string;
  label: string;
  /** null = available; string = why not (shown as toast on tap) */
  blocked: string | null;
  run: () => void;
  active?: boolean;
  gold?: boolean;
  tutorial?: string;
}

function buildActions(s: GameState, u: Unit): UnitActionDef[] {
  const def = UNITS[u.type];
  const out: UnitActionDef[] = [];
  const noMoves = u.moves <= 0 ? 'This unit cannot move again this turn.' : null;
  // toggle an order: tap once to start it (and jump to the next idle unit), tap again to stop it
  const toggle = (kind: 'fortify' | 'explore') => () => {
    const on = u.order?.kind === kind;
    const res = act({ type: 'unitOrder', unitId: u.id, order: on ? null : { kind } }, 'click');
    if (res.ok && !on) focusNextUnit();
  };

  if (def?.abilities?.includes('foundCity')) {
    out.push({
      id: 'found', icon: 'found', label: `Found ${T.city}`, gold: true, tutorial: 'found-city',
      blocked: canFoundCity(s, HUMAN, u.tile) ?? noMoves,
      run: () => {
        const tile = u.tile;
        if (!act({ type: 'foundCity', unitId: u.id }, 'found').ok) return;
        // straight into the new colony's sheet: the first build order is the next decision
        const city = cityOnTile(s, tile);
        if (city) selectCity(city.id);
      },
    });
  }
  if (!isCivilian(u.type)) {
    out.push({ id: 'fortify', icon: 'fortify', label: 'Fortify', blocked: null, run: toggle('fortify'), active: u.order?.kind === 'fortify' });
  }
  if (def?.class === 'recon') {
    out.push({ id: 'explore', icon: 'explore', label: 'Explore', blocked: null, run: toggle('explore'), active: u.order?.kind === 'explore' });
  }
  out.push({
    id: 'skip', icon: 'skip', label: 'Skip', blocked: noMoves,
    run: () => { if (act({ type: 'skipUnit', unitId: u.id }, 'click').ok && !focusNextUnit()) deselect(); },
  });
  return out;
}

export function UnitPanel() {
  const sel = useGame((g) => g.selection);
  const unit = useSim((s) => (sel?.kind === 'unit' ? s.units[sel.id] ?? null : null));
  const s = useGame((g) => g.state);
  const [confirm, setConfirm] = useState(false);

  const stormReadout = useSim((state) => {
    if (!unit) return null;
    const power = stormPowerAt(state, unit.tile);
    if (power) return { power, forecast: false };
    const forecast = state.storms.some((storm) => storm.path.slice(storm.step + 1, storm.step + 3)
      .some((eye) => eye != null && hexDistance(state.map, eye, unit.tile) <= storm.radius));
    return forecast ? { power: 0, forecast: true } : null;
  });
  if (!s || !unit || unit.owner !== HUMAN) return null;
  const def = UNITS[unit.type];
  const name = def?.name ?? unit.type;
  const mm = maxMoves(s, unit);
  const actions = buildActions(s, unit);
  const hpColor = unit.hp > 60 ? 'var(--good)' : unit.hp > 30 ? 'var(--gold-400)' : 'var(--bad)';
  const color = playerColor(s, HUMAN);

  return (
    <div className="k-panel up" data-tutorial="unit-panel" key={unit.id}>
      <div className="up__head">
        <div className="up__portrait" style={{ '--team': color } as CSSProperties}>
          <Icon name={def?.icon ?? def?.class ?? 'melee'} size={34} />
        </div>
        <div className="up__info">
          <div className="up__name display">{name}</div>
          <div className="up__class">
            <Icon name={def?.class ?? 'melee'} size={13} />
            {CLASS_LABEL[def?.class ?? ''] ?? def?.class}
            {unit.level > 0 && <span className="up__level">Level {unit.level}</span>}
            {unit.order && <span className="up__order">· {ORDER_LABEL[unit.order.kind]}</span>}
            {unit.promotions.length > 0 && (
              <span className="up__promos">
                {unit.promotions.map((p) => <Icon key={p} name={PROMOTIONS[p]?.icon ?? 'star'} size={14} title={PROMOTIONS[p]?.name} />)}
              </span>
            )}
          </div>
        </div>
        <div className="up__tools">
          <IconButton icon="more" label="Remove unit" size="sm" onClick={() => { audio.sfx('open'); setConfirm(true); }} />
          <IconButton icon="close" label="Close" size="sm" onClick={() => { audio.sfx('close'); deselect(); }} />
        </div>
      </div>
      {stormReadout && <div className={`up__storm ${stormReadout.forecast ? 'is-forecast' : 'is-active'}`} role="status">
        <Icon name="storm" size={14} /> {stormReadout.forecast
          ? `${T.storm} coming. This unit is in its path.`
          : `${T.storm} here. Power ${stormReadout.power}.`}
      </div>}
      <div className="up__stats">
        {def && def.strength > 0 && <Stat icon="strength" label="Strength" value={def.strength} />}
        {def?.rangedStrength ? <Stat icon="ranged" label="Ranged" value={def.rangedStrength} sub={def.range ? `range ${def.range}` : undefined} /> : null}
        <Stat icon="moves" label="Moves" value={`${fmtMoves(unit.moves)}/${mm}`} dim={unit.moves <= 0} />
      </div>
      <div className="up__hp">
        <span className="up__hp-label"><Icon name="hp" size={13} /> Health</span>
        <Bar value={unit.hp} max={100} color={hpColor} height={7} />
        <span className="num">{unit.hp}/100</span>
      </div>
      <div className="up__actions">
        {actions.map((a) => (
          <button
            key={a.id}
            type="button"
            className={`up-act ${a.gold ? 'up-act--gold' : ''} ${a.blocked ? 'is-blocked' : ''} ${a.active ? 'is-active' : ''}`}
            data-tutorial={a.tutorial}
            aria-disabled={!!a.blocked}
            aria-pressed={a.active}
            onClick={() => {
              if (a.blocked) { toast(a.blocked, 'bad'); audio.sfx('error'); return; }
              a.run();
            }}
          >
            <span className="up-act__icon"><Icon name={a.icon} size={22} /></span>
            <span className="up-act__label">{a.label}</span>
          </button>
        ))}
      </div>
      {confirm && (
        <ConfirmDialog
          title="Remove this unit?"
          body={`Your ${name} will be gone for good.`}
          icon="disband"
          danger
          confirmLabel="Remove"
          onCancel={() => setConfirm(false)}
          onConfirm={() => {
            setConfirm(false);
            if (act({ type: 'disband', unitId: unit.id }, 'sell').ok) deselect();
          }}
        />
      )}
    </div>
  );
}

function fmtMoves(m: number): string {
  return Number.isInteger(m) ? String(m) : m.toFixed(1);
}

function Stat({ icon, label, value, sub, dim }: { icon: string; label: string; value: string | number; sub?: string; dim?: boolean }) {
  return (
    <span className={`up-stat ${dim ? 'is-dim' : ''}`}>
      <span className="up-stat__label">{label}</span>
      <span className="up-stat__value"><Icon name={icon} size={15} /><b className="num">{value}</b>{sub && <small>{sub}</small>}</span>
    </span>
  );
}
