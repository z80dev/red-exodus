// Contextual map cards: tile info, path preview, combat preview, improvement picker, and the mode banner.
import type { CSSProperties, ReactNode } from 'react';
import { audio } from '../../audio';
import { EDICTS, IMPROVEMENTS, RESOURCES } from '../../content';
import {
  buyImprovement, cancelMode, cancelPreview, confirmPreview, deselect, improveTile, improveTiles, orbitalDropSiteCount, useInteraction,
} from '../../game/interaction';
import type { Preview } from '../../game/interaction';
import { useGame, useSim } from '../../game/store';
import { improvementOptions } from '../../sim/cities';
import type { CombatPreview } from '../../sim/combat';
import { tileInfo } from '../../sim/selectors';
import type { TileInfo } from '../../sim/selectors';
import { HUMAN, YIELD_KEYS } from '../../sim/types';
import type { GameState, TileIdx, Yields } from '../../sim/types';
import { Icon } from '../icons/Icon';
import { Button, IconButton, fmt } from '../kit';
import { YIELD_META, playerColor, turnsLabel, unitName } from './format';
import { stormPowerAt } from '../../sim/mars';
import { hexDistance } from '../../sim/hex';
import { T } from '../terms';

export function MapCards() {
  const preview = useInteraction((u) => u.preview);
  if (!preview) return null;
  switch (preview.kind) {
    case 'tile': return <TileCard idx={preview.idx} />;
    case 'path': return <PathCard p={preview} />;
    case 'combat':
    case 'strike': return <CombatCard p={preview} />;
    case 'improve': return <ImprovePicker idx={preview.idx} />;
  }
}

function CardShell({ className = '', children, onClose, tutorial }: { className?: string; children: ReactNode; onClose: () => void; tutorial?: string }) {
  return (
    <div className={`k-panel mc ${className}`} data-tutorial={tutorial}>
      <IconButton icon="close" label="Close" size="sm" className="mc__close" onClick={() => { audio.sfx('close'); onClose(); }} />
      {children}
    </div>
  );
}

function YieldRow({ y, dim }: { y: Partial<Yields>; dim?: boolean }) {
  const keys = YIELD_KEYS.filter((k) => (y[k] ?? 0) !== 0);
  if (!keys.length) return <span className="mc-yields mc-yields--none">No yields</span>;
  return (
    <span className={`mc-yields ${dim ? 'is-dim' : ''}`}>
      {keys.map((k) => (
        <span key={k} className="mc-yield" style={{ color: YIELD_META[k].color }}>
          <Icon name={YIELD_META[k].icon} size={15} />
          <b className="num">{(y[k] ?? 0) > 0 && dim ? '+' : ''}{fmt(y[k] ?? 0)}</b>
        </span>
      ))}
    </span>
  );
}

// ───────────────────────────── tile info ─────────────────────────────
function TileCard({ idx }: { idx: TileIdx }) {
  const info = useSim((s) => tileInfo(s, idx));
  const canImprove = useSim((s) => {
    const t = s.map.tiles[idx];
    return t.owner === HUMAN && !Object.values(s.cities).some((c) => c.tile === idx) && improvementOptions(s, HUMAN, idx).some((o) => o.placeable);
  });
  const stormInfo = useSim((s) => {
    const power = stormPowerAt(s, idx);
    if (power) return { power, forecast: false };
    const forecast = s.storms.some((storm) => storm.path.slice(storm.step + 1, storm.step + 3)
      .some((eye) => eye != null && hexDistance(s.map, eye, idx) <= storm.radius));
    return forecast ? { power: 0, forecast: true } : null;
  });
  if (!info) return null;
  if (!info.explored) return null;
  return (
    <CardShell className="mc-tile" onClose={() => { cancelPreview(); if (useGame.getState().selection?.kind === 'tile') deselect(); }}>
      <div className="mc__head">
        <span className="mc__icon"><Icon name={info.naturalWonder ? 'star' : info.water ? 'wave' : info.elevation.id === 'mountain' ? 'mountain' : info.feature ? 'tree' : 'map'} size={26} /></span>
        <div className="mc__titles">
          <div className="mc__title display">{info.naturalWonder?.name ?? info.name}</div>
          <div className="mc__sub">
            {info.owner ? <span className="mc-owner"><i style={{ background: info.owner.color }} />{info.owner.civName}{info.territoryOf ? ` · ${info.territoryOf.name}` : ''}</span> : 'Unclaimed'}
            {!info.visible && <span className="mc-fog"> · last seen</span>}
          </div>
        </div>
      </div>
      <div className="mc-tile__grid">
        <YieldRow y={info.yields} />
        {info.defensePct !== 0 && <span className={`mc-tag ${info.defensePct > 0 ? 'mc-tag--good' : 'mc-tag--bad'}`}><Icon name="shield" size={13} /> {info.defensePct > 0 ? '+' : '−'}{Math.abs(info.defensePct)}% defense</span>}
        <span className="mc-tag"><Icon name="moves" size={13} /> {info.impassable ? 'Impassable' : `${info.moveCost} move${info.moveCost === 1 ? '' : 's'}`}</span>
        {info.river && <span className="mc-tag mc-tag--river"><Icon name="river" size={13} /> River</span>}
        {info.worked && <span className="mc-tag mc-tag--good"><Icon name="check" size={13} /> Worked</span>}
        {stormInfo && <span className={`mc-tag mc-tag--storm ${stormInfo.forecast ? 'is-forecast' : ''}`}>
          <Icon name="storm" size={13} /> {T.storm}{stormInfo.forecast ? ' forecast · next two Sols' : ` · power ${stormInfo.power}`}
        </span>}
      </div>
      {info.naturalWonder && <p className="mc__desc">{info.naturalWonder.description}</p>}
      <div className="mc-tile__list">
        {info.resource && (
          <span className={`mc-chip mc-chip--${info.resource.kind}`}>
            <Icon name={RESOURCES[info.resource.id]?.icon ?? info.resource.id} size={18} />
            {info.resource.name} <small>{info.resource.kind}{info.resource.improved ? ' · connected' : ` · needs ${IMPROVEMENTS[info.resource.improvement]?.name ?? info.resource.improvement}`}</small>
          </span>
        )}
        {info.improvement && (
          <span className={`mc-chip ${info.improvement.pillaged ? 'is-bad' : ''}`}>
            <Icon name={IMPROVEMENTS[info.improvement.id]?.icon ?? info.improvement.id} size={18} /> {info.improvement.name}{info.improvement.pillaged && <small> · pillaged</small>}
          </span>
        )}
        {info.city && <span className="mc-chip"><Icon name="city" size={18} /> {info.city.name} <small>pop {info.city.pop} · {info.city.hp}/{info.city.maxHp} hp</small></span>}
        {info.camp && <span className="mc-chip is-bad"><Icon name="skull" size={18} /> Barbarian camp</span>}
        {info.ruin && <span className="mc-chip mc-chip--gold"><Icon name="star" size={18} /> Ancient ruins</span>}
        {info.units.map((u) => <UnitChip key={u.id} u={u} />)}
      </div>
      {canImprove && <Button small variant="gold" className="mc__cta" onClick={() => improveTile(idx)}><Icon name="improve" size={16} /> Improve</Button>}
    </CardShell>
  );
}

function UnitChip({ u }: { u: TileInfo['units'][number] }) {
  const color = useSim((s) => playerColor(s, u.owner));
  return (
    <span className="mc-chip mc-chip--unit" style={{ '--team': color ?? '#888' } as CSSProperties}>
      <i className="mc-chip__dot" /> {u.name} <small className="num">{u.hp} hp</small>
    </span>
  );
}

// ───────────────────────────── path preview ─────────────────────────────
function PathCard({ p }: { p: Extract<Preview, { kind: 'path' }> }) {
  const u = useSim((s) => s.units[p.unitId]);
  if (!u) return null;
  return (
    <CardShell className="mc-path" onClose={cancelPreview}>
      <div className="mc__head">
        <span className="mc__icon"><Icon name="move" size={24} /></span>
        <div className="mc__titles">
          <div className="mc__title display">Move {unitName(u.type)}</div>
          <div className="mc__sub">Arrives in <b>{turnsLabel(p.turns)}</b> · {p.path.length} {p.path.length === 1 ? 'tile' : 'tiles'}</div>
          <div className="mc__hint">Tap the tile again or press Go</div>
        </div>
        <Button small variant="gold" onClick={confirmPreview}><Icon name="check" size={16} /> Go</Button>
      </div>
    </CardShell>
  );
}

// ───────────────────────────── combat preview ─────────────────────────────
interface Side { name: string; hp: number; maxHp: number; color: string; icon: string }

function sides(s: GameState, p: Extract<Preview, { kind: 'combat' | 'strike' }>): { att: Side; def: Side } | null {
  let att: Side;
  if (p.kind === 'combat') {
    const u = s.units[p.unitId];
    if (!u) return null;
    att = { name: unitName(u.type), hp: u.hp, maxHp: 100, color: playerColor(s, HUMAN), icon: 'sword' };
  } else {
    const c = s.cities[p.cityId];
    if (!c) return null;
    att = { name: c.name, hp: c.hp, maxHp: c.maxHp, color: playerColor(s, HUMAN), icon: 'city' };
  }
  const info = tileInfo(s, p.target);
  const du = info.units.find((x) => x.owner !== HUMAN);
  const def: Side = du
    ? { name: du.name, hp: du.hp, maxHp: 100, color: playerColor(s, du.owner), icon: 'shield' }
    : info.city
      ? { name: info.city.name, hp: info.city.hp, maxHp: info.city.maxHp, color: playerColor(s, info.city.owner), icon: 'city' }
      : { name: 'Target', hp: 100, maxHp: 100, color: '#888', icon: 'shield' };
  return { att, def };
}

function verdict(c: CombatPreview): { text: string; tone: 'great' | 'good' | 'even' | 'bad' | 'awful' } {
  if (c.captures) return { text: 'Capture!', tone: 'great' };
  if (c.defenderKillLikely && !c.attackerDeathLikely) return { text: 'Decisive Victory', tone: 'great' };
  if (c.attackerDeathLikely) return { text: c.defenderKillLikely ? 'Mutual Destruction' : 'Likely Death', tone: 'awful' };
  const r = (c.dmgToDefender + 1) / (c.dmgToAttacker + 1);
  if (c.ranged || r >= 1.6) return { text: c.ranged ? 'Bombard' : 'Major Victory', tone: 'good' };
  if (r >= 1.1) return { text: 'Minor Victory', tone: 'good' };
  if (r >= 0.8) return { text: 'Stalemate', tone: 'even' };
  return { text: 'Costly Attack', tone: 'bad' };
}

function CombatCard({ p }: { p: Extract<Preview, { kind: 'combat' | 'strike' }> }) {
  const data = useSim((s) => sides(s, p));
  if (!data) return null;
  const c = p.preview;
  const { att, def } = data;
  const total = c.attackerStrength + c.defenderStrength || 1;
  const odds = c.attackerStrength / total;
  const v = verdict(c);
  const attAfter = Math.max(0, att.hp - c.dmgToAttacker);
  const defAfter = Math.max(0, def.hp - c.dmgToDefender);
  return (
    <CardShell className={`mc-combat is-${v.tone}`} onClose={cancelPreview} tutorial="combat-preview">
      <div className={`mc-verdict display is-${v.tone}`}>{v.text}</div>
      <div className="mc-duel">
        <CombatSide side={att} strength={c.attackerStrength} after={attAfter} dmg={c.dmgToAttacker} align="left" label={c.ranged ? 'Ranged' : 'Attacker'} />
        <span className="mc-duel__vs display">VS</span>
        <CombatSide side={def} strength={c.defenderStrength} after={defAfter} dmg={c.dmgToDefender} align="right" label="Defender" />
      </div>
      <div className="mc-odds" style={{ '--odds': odds, '--ca': att.color, '--cd': def.color } as CSSProperties}>
        <span className="mc-odds__a" />
        <span className="mc-odds__d" />
        <span className="mc-odds__mark" />
      </div>
      <div className="mc-mods">
        <ModList mods={c.attackMods} />
        <ModList mods={c.defenseMods} right />
      </div>
      <div className="mc-combat__actions">
        <Button small onClick={() => { audio.sfx('close'); cancelPreview(); }}>Cancel</Button>
        <Button variant={v.tone === 'awful' ? 'danger' : 'gold'} onClick={confirmPreview}>
          <Icon name={p.kind === 'strike' || c.ranged ? 'ranged' : 'attack'} size={18} /> {p.kind === 'strike' ? 'Strike' : 'Attack'}
        </Button>
      </div>
    </CardShell>
  );
}

function CombatSide({ side, strength, after, dmg, align, label }: { side: Side; strength: number; after: number; dmg: number; align: 'left' | 'right'; label: string }) {
  const hpPct = side.hp / side.maxHp;
  const afterPct = after / side.maxHp;
  return (
    <div className={`mc-side mc-side--${align}`} style={{ '--team': side.color } as CSSProperties}>
      <div className="mc-side__label">{label}</div>
      <div className="mc-side__name">{side.name}</div>
      <div className="mc-side__str"><Icon name="strength" size={16} /><b className="num">{Math.round(strength * 10) / 10}</b></div>
      <div className="mc-hp">
        <span className="mc-hp__lost" style={{ transform: `scaleX(${hpPct})` }} />
        <span className="mc-hp__left" style={{ transform: `scaleX(${afterPct})` }} />
      </div>
      <div className="mc-side__dmg num">{dmg > 0 ? <>−{Math.round(dmg)} <small>→ {Math.round(after)}</small></> : <small>no damage</small>}</div>
    </div>
  );
}

function ModList({ mods, right }: { mods: { label: string; pct: number }[]; right?: boolean }) {
  return (
    <ul className={`mc-modlist ${right ? 'is-right' : ''}`}>
      {mods.map((m, i) => (
        <li key={i} className={m.pct < 0 ? 'is-neg' : ''}>
          <span>{m.label}</span><b className="num">{m.pct > 0 ? '+' : m.pct < 0 ? '−' : ''}{Math.abs(m.pct)}%</b>
        </li>
      ))}
    </ul>
  );
}

// ───────────────────────────── improvement picker ─────────────────────────────
function ImprovePicker({ idx }: { idx: TileIdx }) {
  const data = useSim((s) => {
    const t = s.map.tiles[idx];
    return {
      info: tileInfo(s, idx),
      options: improvementOptions(s, HUMAN, idx).filter((o) => o.placeable),
      resource: t.resource ? RESOURCES[t.resource] : undefined,
      gold: s.players[HUMAN].gold,
      current: t.improvement,
    };
  });
  if (!data) return null;
  return (
    <CardShell className="mc-improve" onClose={cancelPreview}>
      <div className="mc__head">
        <span className="mc__icon"><Icon name="improve" size={24} /></span>
        <div className="mc__titles">
          <div className="mc__title display">{data.info.name}</div>
          <div className="mc__sub"><YieldRow y={data.info.yields} /> <span className="mc-gold num"><Icon name="gold" size={13} /> {fmt(data.gold)}</span></div>
        </div>
      </div>
      <div className="mc-imps">
        {data.options.map((o) => {
          const d = IMPROVEMENTS[o.id];
          const bonus: Partial<Yields> = { ...d?.yields };
          if (data.resource && data.resource.improvement === o.id) for (const k of YIELD_KEYS) bonus[k] = (bonus[k] ?? 0) + (data.resource.improvedYields[k] ?? 0);
          const repair = data.current === o.id;
          return (
            <button key={o.id} type="button" className={`mc-imp ${o.error ? 'is-locked' : ''}`} disabled={!!o.error}
              onClick={() => buyImprovement(idx, o.id)}>
              <span className="mc-imp__icon"><Icon name={d?.icon ?? o.id} size={30} /></span>
              <span className="mc-imp__text">
                <span className="mc-imp__name">{repair ? `Repair ${d?.name ?? o.id}` : d?.name ?? o.id}</span>
                <YieldRow y={bonus} dim />
                {o.error && <span className="mc-imp__err">{o.error}</span>}
              </span>
              <span className="mc-imp__cost num"><Icon name="gold" size={15} />{fmt(o.cost)}</span>
            </button>
          );
        })}
        {!data.options.length && <p className="mc__desc">Nothing can be built here yet.</p>}
      </div>
    </CardShell>
  );
}

// ───────────────────────────── mode banner ─────────────────────────────
export function ModeBanner() {
  const mode = useGame((g) => g.mode);
  const strike = useInteraction((u) => u.strikeCity);
  const dropTargeting = useInteraction((u) => u.dropTargeting);
  const data = useSim((s) => {
    if (dropTargeting) {
      const sites = orbitalDropSiteCount(s);
      return { icon: 'cryo', title: T.drop, text: `Tap a highlighted clear tile to land a colony · ${sites} valid ${sites === 1 ? 'site' : 'sites'}.`, done: 'Cancel' };
    }
    if (mode.kind === 'edictTarget') {
      const inst = s.run.edicts.find((e) => e.uid === mode.uid);
      const def = inst ? EDICTS[inst.id] : undefined;
      const what = def?.target === 'city' ? 'one of your cities' : def?.target === 'unit' ? 'one of your units' : def?.target === 'ownedTile' ? 'a tile in your borders' : 'a tile';
      return { icon: def?.icon ?? 'edict', title: def?.name ?? 'Edict', text: `Choose ${what}`, done: 'Cancel' };
    }
    if (mode.kind === 'improve') {
      const n = improveTiles(s, mode.cityId).length;
      const c = mode.cityId != null ? s.cities[mode.cityId] : null;
      return { icon: 'improve', title: c ? `Improve ${c.name}` : 'Improve Tiles', text: `${n} ${n === 1 ? 'tile' : 'tiles'} can be improved · ${fmt(s.players[HUMAN].gold)} gold`, done: 'Done' };
    }
    if (strike != null) {
      const c = s.cities[strike];
      return { icon: 'ranged', title: `${c?.name ?? 'City'} Strike`, text: 'Choose a target in range', done: 'Cancel' };
    }
    return null;
  });
  if (!data) return null;
  return (
    <div className="k-panel mb" role="status">
      <span className="mb__icon"><Icon name={data.icon} size={24} /></span>
      <span className="mb__text">
        <b className="display">{data.title}</b>
        <small>{data.text}</small>
      </span>
      <Button small variant={data.done === 'Done' ? 'gold' : 'default'} onClick={cancelMode}>{data.done}</Button>
    </div>
  );
}
