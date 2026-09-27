// Tech tree: 6 era columns scrolling horizontally, SVG prerequisite connectors, tap to research.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { audio } from '../../audio';
import { BUILDINGS, IMPROVEMENTS, RESOURCES, UNITS, WONDERS } from '../../content';
import { act } from '../../game/interaction';
import { useGame, useSim } from '../../game/store';
import { empireYields, techTree } from '../../sim/selectors';
import type { TechNode } from '../../sim/selectors';
import { Icon } from '../icons/Icon';
import { Bar, Button, IconButton, fmt, signed, useEscape } from '../kit';
import { ERA_NAMES, techName, turnsLabel } from './format';
import { toast } from './toast';

interface Geo { colW: number; rowH: number; nodeW: number; nodeH: number; eraGap: number; padTop: number; padX: number }

function useGeo(): Geo {
  const [geo, setGeo] = useState<Geo>(calc);
  useEffect(() => {
    const on = () => setGeo(calc());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return geo;
}

function calc(): Geo {
  const short = window.innerHeight < 520;
  const wide = window.innerWidth >= 1100 && window.innerHeight >= 700;
  return short
    ? { colW: 150, rowH: 50, nodeW: 136, nodeH: 42, eraGap: 26, padTop: 34, padX: 16 }
    : wide
      ? { colW: 190, rowH: 86, nodeW: 172, nodeH: 70, eraGap: 36, padTop: 46, padX: 28 }
      : { colW: 162, rowH: Math.round(Math.max(76, Math.min(104, (window.innerHeight - 330) / 6))), nodeW: 146, nodeH: 62, eraGap: 28, padTop: 42, padX: 18 };
}

interface Unlock { icon: string; name: string }
function unlocksOf(n: TechNode): Unlock[] {
  const u = n.unlocks;
  return [
    ...u.units.map((id) => ({ icon: UNITS[id]?.icon ?? 'melee', name: UNITS[id]?.name ?? id })),
    ...u.buildings.map((id) => ({ icon: BUILDINGS[id]?.icon ?? id, name: BUILDINGS[id]?.name ?? id })),
    ...u.wonders.map((id) => ({ icon: WONDERS[id]?.icon ?? id, name: WONDERS[id]?.name ?? id })),
    ...u.improvements.map((id) => ({ icon: IMPROVEMENTS[id]?.icon ?? id, name: IMPROVEMENTS[id]?.name ?? id })),
    ...u.resources.map((id) => ({ icon: RESOURCES[id]?.icon ?? id, name: `Reveals ${RESOURCES[id]?.name ?? id}` })),
  ];
}

export function TechSheet() {
  const nodes = useSim((s) => techTree(s));
  const y = useSim((s) => empireYields(s));
  const era = useSim((s) => s.run.era) ?? 0;
  const geo = useGeo();
  const scroller = useRef<HTMLDivElement>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const close = () => { audio.sfx('close'); useGame.getState().setPanel('none'); };
  useEscape(close);

  const byId = useMemo(() => new Map((nodes ?? []).map((n) => [n.id, n])), [nodes]);
  const pos = (n: TechNode) => ({
    x: geo.padX + n.era * (3 * geo.colW + geo.eraGap) + n.pos.col * geo.colW,
    y: geo.padTop + n.pos.row * geo.rowH,
  });
  const width = geo.padX * 2 + 6 * 3 * geo.colW + 5 * geo.eraGap;
  const height = geo.padTop + 6 * geo.rowH + 8;

  // open scrolled to the current research (or the current era)
  useEffect(() => {
    const el = scroller.current;
    if (!el || !nodes) return;
    const cur = nodes.find((n) => n.status === 'current');
    const x = cur ? pos(cur).x : geo.padX + Math.min(era, 5) * (3 * geo.colW + geo.eraGap);
    el.scrollLeft = Math.max(0, x - el.clientWidth / 2 + geo.nodeW / 2);
  }, [!!nodes]); // only when the tree first becomes available

  if (!nodes || !y) return null;
  const selected = focus ? byId.get(focus) ?? null : nodes.find((n) => n.status === 'current') ?? null;
  const research = (n: TechNode) => {
    setFocus(n.id);
    if (n.status === 'available') {
      const res = act({ type: 'setResearch', tech: n.id }, 'research');
      if (res.ok) toast(`Researching ${n.name}`, 'info', n.icon);
    } else {
      audio.sfx('tap');
      if (n.status === 'locked') {
        const missing = n.prereqs.filter((p) => byId.get(p)?.status !== 'researched').map(techName);
        if (missing.length) toast(`Requires ${missing.join(' & ')}`, 'info', 'lock');
      }
    }
  };

  // highlight prerequisite chain of the focused/current node
  const chain = new Set<string>();
  if (selected) {
    const walk = (id: string) => {
      if (chain.has(id)) return;
      chain.add(id);
      for (const p of byId.get(id)?.prereqs ?? []) if (byId.get(p)?.status !== 'researched') walk(p);
    };
    walk(selected.id);
  }

  return (
    <div className="tt" role="dialog" aria-label="Technology" data-tutorial="tech-tree">
      <div className="tt__scrim" onPointerDown={close} />
      <div className="k-panel tt__panel">
        <header className="tt__head">
          <Icon name="tech" size={28} />
          <div className="tt__title">
            <h2 className="k-title">Technology</h2>
            <div className="tt__sub num"><Icon name="sci" size={13} /> {signed(y.sci)} science per turn</div>
          </div>
          {y.research ? (
            <div className="tt__cur">
              <span className="tt__cur-name">{y.research.name}</span>
              <Bar value={y.research.progress} max={y.research.cost} preview={y.research.progress + y.sci} color="var(--y-sci)" height={6} />
              <span className="tt__cur-meta num">{turnsLabel(y.research.turns)}</span>
            </div>
          ) : <div className="tt__cur tt__cur--none">Choose a technology to research</div>}
          <IconButton icon="close" label="Close" onClick={close} size="sm" />
        </header>
        <div className="tt__scroll" ref={scroller}>
          <div className="tt__canvas" style={{ width, height }}>
            {ERA_NAMES.map((name, e) => (
              <div key={name} className={`tt__era ${e === era ? 'is-now' : ''} ${e < era ? 'is-past' : ''}`}
                style={{ left: geo.padX + e * (3 * geo.colW + geo.eraGap) - geo.eraGap / 2, width: 3 * geo.colW + geo.eraGap }}>
                <span className="display">{name}</span>
              </div>
            ))}
            <svg className="tt__links" width={width} height={height}>
              {nodes.flatMap((n) =>
                n.prereqs.map((pid) => {
                  const p = byId.get(pid);
                  if (!p) return null;
                  const a = pos(p);
                  const b = pos(n);
                  const x1 = a.x + geo.nodeW;
                  const y1 = a.y + geo.nodeH / 2;
                  const x2 = b.x;
                  const y2 = b.y + geo.nodeH / 2;
                  const mx = (x1 + x2) / 2;
                  const cls = p.status === 'researched' && n.status === 'researched' ? 'is-done' : p.status === 'researched' ? 'is-open' : chain.has(n.id) && chain.has(pid) ? 'is-chain' : '';
                  return <path key={`${pid}>${n.id}`} className={cls} d={`M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`} />;
                }),
              )}
            </svg>
            {nodes.map((n) => {
              const p = pos(n);
              const unl = unlocksOf(n);
              return (
                <button key={n.id} type="button"
                  className={`tt-node is-${n.status} ${selected?.id === n.id ? 'is-focus' : ''} ${chain.has(n.id) && n.status === 'locked' ? 'is-chain' : ''}`}
                  style={{ left: p.x, top: p.y, width: geo.nodeW, height: geo.nodeH, '--prog': n.cost ? Math.min(1, n.progress / n.cost) : 0 } as CSSProperties}
                  onClick={() => research(n)} aria-label={`${n.name}, ${n.status}`}>
                  <span className="tt-node__icon"><Icon name={n.icon || n.id} size={geo.nodeH > 50 ? 28 : 22} /></span>
                  <span className="tt-node__body">
                    <span className="tt-node__name">{n.name}</span>
                    <span className="tt-node__meta num">
                      {n.status === 'researched' ? <><Icon name="check" size={11} /> Known</> : turnsLabel(n.turns)}
                    </span>
                    {geo.nodeH > 50 && (
                      <span className="tt-node__unlocks">
                        {unl.slice(0, 5).map((u, i) => <Icon key={i} name={u.icon} size={15} title={u.name} />)}
                        {unl.length > 5 && <small>+{unl.length - 5}</small>}
                      </span>
                    )}
                  </span>
                  {n.status === 'current' && <span className="tt-node__prog" />}
                </button>
              );
            })}
          </div>
        </div>
        {selected && <TechDetail n={selected} onResearch={() => research(selected)} />}
      </div>
    </div>
  );
}

function TechDetail({ n, onResearch }: { n: TechNode; onResearch: () => void }) {
  const unl = unlocksOf(n);
  return (
    <div className="tt-detail" key={n.id}>
      <span className="tt-detail__icon"><Icon name={n.icon || n.id} size={36} /></span>
      <div className="tt-detail__body">
        <div className="tt-detail__name display">{n.name} <small>{ERA_NAMES[n.era]}</small></div>
        <div className="tt-detail__desc">{n.description}</div>
        <div className="tt-detail__unlocks">
          {unl.map((u, i) => <span key={i} className="tt-unlock"><Icon name={u.icon} size={16} />{u.name}</span>)}
        </div>
      </div>
      <div className="tt-detail__side">
        <span className="num"><Icon name="sci" size={13} /> {fmt(n.progress)}/{fmt(n.cost)}</span>
        {n.status === 'available' && <Button small variant="gold" onClick={onResearch}>Research</Button>}
        {n.status === 'current' && <span className="tt-detail__tag">Researching</span>}
        {n.status === 'researched' && <span className="tt-detail__tag is-done">Known</span>}
        {n.status === 'locked' && <span className="tt-detail__tag is-locked"><Icon name="lock" size={12} /> Locked</span>}
      </div>
    </div>
  );
}
