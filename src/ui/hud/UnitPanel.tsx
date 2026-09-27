// Bottom unit card: portrait, stats, action buttons, promotion choice.
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { audio } from '../../audio';
import { PROMOTIONS, UNITS } from '../../content';
import { act, deselect, focusNext } from '../../game/interaction';
import { useGame, useSim } from '../../game/store';
import { canFoundCity } from '../../sim/cities';
import { XP_LEVELS, isCivilian, maxMoves, upgradeInfo } from '../../sim/units';
import { BARBARIAN, HUMAN } from '../../sim/types';
import type { Action, GameState, Unit, UnitOrder } from '../../sim/types';
import { Icon } from '../icons/Icon';
import { Bar, ConfirmDialog, IconButton, Modal, Ornament } from '../kit';
import { toast } from './toast';
import { playerColor, unitName } from './format';

const CLASS_LABEL: Record<string, string> = {
  civilian: 'Civilian', recon: 'Recon', melee: 'Melee', antiCavalry: 'Anti-Cavalry', ranged: 'Ranged', mounted: 'Mounted',
  siege: 'Siege', naval: 'Naval', armor: 'Armor',
};

const ORDER_LABEL: Record<UnitOrder['kind'], string> = { goto: 'Travelling', explore: 'Exploring', fortify: 'Fortified', sleep: 'Sleeping', heal: 'Healing' };

interface UnitActionDef {
  id: string;
  icon: string;
  label: string;
  /** null = available; string = why not (shown as toast on tap) */
  blocked: string | null;
  run: () => void;
  active?: boolean;
  tone?: 'gold' | 'danger';
  tutorial?: string;
}

function buildActions(s: GameState, u: Unit, confirmDisband: () => void, openPromo: () => void): UnitActionDef[] {
  const def = UNITS[u.type];
  const civ = isCivilian(u.type);
  const tile = s.map.tiles[u.tile];
  const out: UnitActionDef[] = [];
  const order = (o: UnitOrder | null, sfx: string) => () => {
    const res = act({ type: 'unitOrder', unitId: u.id, order: o }, sfx);
    if (res.ok && o) focusNext();
  };
  const noMoves = u.moves <= 0 ? 'No movement left this turn.' : null;

  if (u.promotionChoices?.length) out.push({ id: 'promote', icon: 'promote', label: 'Promote', blocked: null, run: openPromo, tone: 'gold' });
  if (def?.abilities?.includes('foundCity')) {
    const err = canFoundCity(s, HUMAN, u.tile);
    out.push({
      id: 'found', icon: 'found', label: 'Found City', tone: 'gold', tutorial: 'found-city',
      blocked: err ?? noMoves,
      run: () => { act({ type: 'foundCity', unitId: u.id }, 'found'); },
    });
  }
  if (u.order && u.order.kind !== 'goto') {
    out.push({ id: 'wake', icon: 'arrowUp', label: 'Wake', blocked: null, run: order(null, 'click'), active: true });
  }
  if (u.order?.kind === 'goto') out.push({ id: 'cancel', icon: 'close', label: 'Cancel Move', blocked: null, run: order(null, 'click') });
  if (!civ && u.order?.kind !== 'fortify') out.push({ id: 'fortify', icon: 'fortify', label: 'Fortify', blocked: null, run: order({ kind: 'fortify' }, 'click') });
  if (u.hp < 100 && u.order?.kind !== 'heal') out.push({ id: 'heal', icon: 'heal', label: 'Heal', blocked: null, run: order({ kind: 'heal' }, 'click') });
  if (u.order?.kind !== 'explore' && def?.class !== 'civilian') out.push({ id: 'explore', icon: 'explore', label: 'Explore', blocked: null, run: order({ kind: 'explore' }, 'click') });
  if (u.order?.kind !== 'sleep') out.push({ id: 'sleep', icon: 'sleep', label: 'Sleep', blocked: null, run: order({ kind: 'sleep' }, 'click') });
  out.push({
    id: 'skip', icon: 'skip', label: 'Skip Turn', blocked: noMoves,
    run: () => { const r = act({ type: 'skipUnit', unitId: u.id }, 'click'); if (r.ok && !focusNext()) deselect(); },
  });
  if (!civ && tile.improvement && !tile.pillaged && tile.owner !== HUMAN && tile.owner != null) {
    const atWar = tile.owner === BARBARIAN || s.players[HUMAN]?.relations[tile.owner] === 'war';
    out.push({
      id: 'pillage', icon: 'pillage', label: 'Pillage', blocked: atWar ? noMoves : 'You are not at war with this tile\'s owner.',
      run: () => { act({ type: 'pillage', unitId: u.id }, 'attack'); },
    });
  }
  const up = upgradeInfo(s, u);
  if (up) {
    out.push({
      id: 'upgrade', icon: 'upgrade', label: `Upgrade · ${up.cost}g`, blocked: up.error,
      run: () => { const r = act({ type: 'upgradeUnit', unitId: u.id }, 'levelUp'); if (r.ok) toast(`Upgraded to ${unitName(up.to)}.`, 'good', 'upgrade'); },
    });
  }
  out.push({ id: 'disband', icon: 'disband', label: 'Disband', blocked: null, run: confirmDisband, tone: 'danger' });
  return out;
}

export function UnitPanel() {
  const sel = useGame((g) => g.selection);
  const unit = useSim((s) => (sel?.kind === 'unit' ? s.units[sel.id] ?? null : null));
  const s = useGame((g) => g.state);
  const [confirm, setConfirm] = useState(false);
  const [promo, setPromo] = useState<number | null>(null);
  const autoOpened = useRef<number | null>(null);

  // pop the promotion chooser once when a unit with a pending promotion is selected
  useEffect(() => {
    if (unit?.owner === HUMAN && unit.promotionChoices?.length && autoOpened.current !== unit.id) {
      autoOpened.current = unit.id;
      setPromo(unit.id);
    }
  }, [unit]);

  if (!s || !unit || unit.owner !== HUMAN) return null;
  const def = UNITS[unit.type];
  const mm = maxMoves(s, unit);
  const nextXp = XP_LEVELS[unit.level] as number | undefined;
  const prevXp = unit.level > 0 ? XP_LEVELS[unit.level - 1] : 0;
  const actions = buildActions(s, unit, () => setConfirm(true), () => setPromo(unit.id));
  const hpColor = unit.hp > 60 ? 'var(--good)' : unit.hp > 30 ? 'var(--gold-400)' : 'var(--bad)';
  const color = playerColor(s, HUMAN);

  return (
    <div className="k-panel up" data-tutorial="unit-panel" key={unit.id}>
      <div className="up__head">
        <div className="up__portrait" style={{ '--team': color } as CSSProperties}>
          <Icon name={def?.icon ?? def?.class ?? 'melee'} size={34} />
          {unit.level > 0 && <span className="up__level num">{unit.level}</span>}
        </div>
        <div className="up__info">
          <div className="up__name display">{def?.name ?? unit.type}</div>
          <div className="up__class">
            <Icon name={def?.class ?? 'melee'} size={13} />
            {CLASS_LABEL[def?.class ?? ''] ?? def?.class}
            {unit.order && <span className="up__order">· {ORDER_LABEL[unit.order.kind]}</span>}
            {unit.promotions.length > 0 && (
              <span className="up__promos">
                {unit.promotions.map((p) => <Icon key={p} name={PROMOTIONS[p]?.icon ?? 'promote'} size={14} title={PROMOTIONS[p]?.name} />)}
              </span>
            )}
          </div>
          <div className="up__stats">
            {def && def.strength > 0 && <Stat icon="strength" value={def.strength} label="Strength" />}
            {def?.rangedStrength ? <Stat icon="ranged" value={`${def.rangedStrength}`} sub={def.range ? `r${def.range}` : undefined} label="Ranged strength" /> : null}
            <Stat icon="moves" value={`${fmtMoves(unit.moves)}/${mm}`} label="Moves" dim={unit.moves <= 0} />
          </div>
        </div>
        <IconButton icon="close" label="Deselect" size="sm" onClick={() => { audio.sfx('close'); deselect(); }} className="up__close" />
      </div>
      <div className="up__bars">
        <div className="up__bar">
          <Icon name="hp" size={13} />
          <Bar value={unit.hp} max={100} color={hpColor} height={6} />
          <span className="num">{unit.hp}</span>
        </div>
        {!isCivilian(unit.type) && (
          <div className="up__bar">
            <Icon name="xp" size={13} />
            <Bar value={nextXp != null ? unit.xp - prevXp : 1} max={nextXp != null ? nextXp - prevXp : 1} color="var(--influence)" height={6} glow={!!unit.promotionChoices?.length} />
            <span className="num">{nextXp != null ? `${unit.xp}/${nextXp}` : 'MAX'}</span>
          </div>
        )}
      </div>
      <div className="up__actions">
        {actions.map((a) => (
          <button
            key={a.id}
            type="button"
            className={`up-act ${a.tone ? `up-act--${a.tone}` : ''} ${a.blocked ? 'is-blocked' : ''} ${a.active ? 'is-active' : ''}`}
            data-tutorial={a.tutorial}
            aria-disabled={!!a.blocked}
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
          title={`Disband ${def?.name ?? 'unit'}?`}
          body="The unit will be permanently removed. This cannot be undone."
          icon="disband"
          danger
          confirmLabel="Disband"
          onCancel={() => setConfirm(false)}
          onConfirm={() => {
            setConfirm(false);
            const r = act({ type: 'disband', unitId: unit.id } satisfies Action, 'sell');
            if (r.ok) deselect();
          }}
        />
      )}
      {promo === unit.id && unit.promotionChoices?.length ? <PromotionModal unit={unit} onClose={() => setPromo(null)} /> : null}
    </div>
  );
}

function fmtMoves(m: number): string {
  return Number.isInteger(m) ? String(m) : m.toFixed(1);
}

function Stat({ icon, value, sub, label, dim }: { icon: string; value: string | number; sub?: string; label: string; dim?: boolean }) {
  return (
    <span className={`up-stat ${dim ? 'is-dim' : ''}`} aria-label={`${label} ${value}`}>
      <Icon name={icon} size={15} />
      <b className="num">{value}</b>
      {sub && <small>{sub}</small>}
    </span>
  );
}

export function PromotionModal({ unit, onClose }: { unit: Unit; onClose: () => void }) {
  const [picked, setPicked] = useState<string | null>(null);
  const choices = unit.promotionChoices ?? [];
  const pick = (id: string) => {
    if (picked) return;
    setPicked(id);
    audio.sfx('cardFlip');
    setTimeout(() => {
      const res = act({ type: 'promote', unitId: unit.id, promotion: id }, 'levelUp');
      if (res.ok) toast(`${unitName(unit.type)} learned ${PROMOTIONS[id]?.name ?? id}.`, 'gold', 'promote');
      onClose();
    }, 420);
  };
  return (
    <Modal onClose={onClose} className="promo">
      <div className="promo__eyebrow">Level {unit.level}</div>
      <h2 className="k-title promo__title">{unitName(unit.type)} earns a promotion</h2>
      <Ornament />
      <div className="promo__cards">
        {choices.map((id, i) => {
          const p = PROMOTIONS[id];
          return (
            <button key={id} type="button" className={`promo-card ${picked === id ? 'is-picked' : picked ? 'is-dropped' : ''}`}
              style={{ animationDelay: `${i * 90}ms` }} onClick={() => pick(id)}>
              <span className="promo-card__tier">{'◆'.repeat(p?.tier ?? 1)}</span>
              <span className="promo-card__icon"><Icon name={p?.icon ?? 'promote'} size={46} /></span>
              <span className="promo-card__name display">{p?.name ?? id}</span>
              <span className="promo-card__desc">{p?.description}</span>
            </button>
          );
        })}
      </div>
      <button type="button" className="promo__later" onClick={onClose}>Decide later</button>
    </Modal>
  );
}
