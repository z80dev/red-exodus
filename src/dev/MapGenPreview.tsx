import { useMemo, useState } from 'react';
import { generateMap } from '../sim/mapgen';
import { hexToWorld } from '../sim/hex';
import { RESOURCES } from '../content';
import type { MapSize, TerrainId } from '../sim/types';

const palette: Record<TerrainId, string> = {
  ocean: '#6e3219', coast: '#a4552c', lake: '#3f8f8a', grassland: '#8f5a44', plains: '#c8693a',
  desert: '#d9a066', tundra: '#b89a8c', snow: '#eef3f6',
};
const TERRAIN_NAMES: Record<TerrainId, string> = {
  ocean: 'Dust Sea', coast: 'Dust Shallows', lake: 'Brine Lake', grassland: 'Clay Basin',
  plains: 'Regolith Plain', desert: 'Dune Sea', tundra: 'Frost Flats', snow: 'Polar Ice',
};
const teams = ['#f2a64a', '#5fd4e8', '#8a9a3b', '#eef3f6'];
const corners = Array.from({ length: 6 }, (_, i) => {
  const a = (i * 60 - 90) * Math.PI / 180;
  return [Math.cos(a), Math.sin(a)];
});
const outline = corners.map(c => c.join(',')).join(' ');

export default function MapGenPreview() {
  const [input, setInput] = useState('AEONS'), [seed, setSeed] = useState('AEONS');
  const [size, setSize] = useState<MapSize>('standard');
  const [resources, setResources] = useState(true);
  const { map, ms } = useMemo(() => { const start = performance.now(); const map = generateMap(seed, size, 4); return { map, ms: performance.now() - start }; }, [seed, size]);
  const land = map.tiles.filter(t => !['ocean', 'coast', 'lake'].includes(t.terrain)).length;
  return <main className="atlas">
    <style>{`
      .atlas { min-height:100dvh; background:#211510; color:#ece7cf; padding:24px; box-sizing:border-box; font:13px Inter,sans-serif; }
      .atlas header { max-width:1280px; margin:auto; display:flex; justify-content:space-between; gap:20px; align-items:end; flex-wrap:wrap; }
      .atlas .eyebrow { color:#f28c28; text-transform:uppercase; letter-spacing:.25em; font-size:10px; margin:0 0 7px; }
      .atlas h1 { font:600 30px Cinzel,serif; letter-spacing:.08em; margin:0; }
      .atlas .subtitle { color:#d9a066; margin:7px 0 0; }
      .atlas form { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
      .atlas input,.atlas select,.atlas button { min-height:44px; border:1px solid #76503b; border-radius:7px; background:#38251c; color:#eee5c9; padding:0 13px; font:inherit; }
      .atlas input { width:150px; } .atlas button { cursor:pointer; } .atlas .generate { background:#f28c28;color:#211510;font-weight:800; }
      .atlas .chart { max-width:1280px; margin:22px auto 0; border:1px solid #76503b; border-radius:13px; overflow:hidden; background:#6e3219; box-shadow:0 16px 70px #0008; }
      .atlas svg { display:block; width:100%; max-height:calc(100dvh - 220px); min-height:260px; }
      .atlas footer { max-width:1280px; margin:17px auto 0; display:flex; flex-wrap:wrap; gap:14px; align-items:center; color:#c9a98e; line-height:1.6; }
      .atlas .legend { display:flex; gap:12px; flex-wrap:wrap; margin-left:auto; } .atlas .key { display:flex;align-items:center;gap:5px; }
      .atlas .swatch { width:9px;height:9px;border-radius:50%;display:inline-block; }
      @media(max-width:600px) { .atlas { padding:18px 12px; } .atlas h1 { font-size:25px; } .atlas form { width:100%; } .atlas input { flex:1;min-width:80px;width:90px; } .atlas select { width:100px;padding:0 8px; } .atlas .chart { margin-top:18px; } .atlas svg { min-height:350px; } .atlas .legend { margin-left:0; } }
      @media(max-height:500px) and (min-width:600px) { .atlas { padding:12px 18px; } .atlas h1 { font-size:20px; } .atlas .subtitle,.atlas .eyebrow { display:none; } .atlas .chart { margin-top:12px; } .atlas svg { min-height:220px;max-height:calc(100dvh - 115px); } .atlas footer { margin-top:8px;font-size:11px; } }
    `}</style>
    <header><div><p className="eyebrow">RED EXODUS / Survey laboratory</p><h1>Orbital Survey</h1><p className="subtitle">Fifty Arks. One planet. Zero refunds.</p></div>
      <form onSubmit={e => { e.preventDefault(); setSeed(input); }}>
        <input aria-label="Survey seed" value={input} onChange={e => setInput(e.target.value)} />
        <select aria-label="Survey map size" value={size} onChange={e => setSize(e.target.value as MapSize)}><option value="small">Small</option><option value="standard">Standard</option><option value="large">Large</option></select>
        <button className="generate" type="submit">Resurvey</button>
        <button type="button" onClick={() => setResources(v => !v)} aria-pressed={resources}>Resources</button>
      </form></header>
    <section className="chart" aria-label={`Mars survey map for seed ${seed}`}>
      <svg viewBox={`-2 -2 ${Math.sqrt(3) * (map.width + 1.5)} ${1.5 * map.height + 2.5}`} role="img" aria-label="Hex atlas of Mars terrain, ancient channels, resources and four Ark landing sites">
        <defs><pattern id="sea-lines" width="4" height="2" patternUnits="userSpaceOnUse"><path d="M.3 1h.8m.6 0h.3" stroke="#d9a066" strokeWidth=".035" opacity=".18"/></pattern></defs>
        <rect x="-2" y="-2" width="100" height="100" fill="url(#sea-lines)" />
        {map.tiles.map(t => {
          const { x, z } = hexToWorld(t.col, t.row);
          const start = map.starts.indexOf(t.idx);
          const res = t.resource ? RESOURCES[t.resource] : null;
          return <g key={t.idx} transform={`translate(${x},${z})`}>
            <title>{`${t.col},${t.row} · ${TERRAIN_NAMES[t.terrain]} ${t.elevation}${t.feature ? ` · ${t.feature}` : ''}${res ? ` · ${res.name}` : ''}${start >= 0 ? ` · Ark ${start + 1}` : ''}`}</title>
            <polygon points={outline} fill={palette[t.terrain]} stroke="#21151028" strokeWidth=".045" />
            {t.elevation === 'hills' && <path d="M-.65.35Q-.26-.46.05.25Q.33-.38.7.3" fill="none" stroke="#57463d" strokeWidth=".1" opacity=".75" />}
            {t.elevation === 'mountain' && <><path d="M-.8.5L-.12-.72.55.5Z" fill="#3b2f2a"/><path d="M-.12-.72L.55.5H-.03Z" fill="#57463d"/><path d="M-.35-.3L-.12-.72.12-.29-.08-.38Z" fill="#eef3f6"/></>}
            {t.feature === 'forest' && <g fill="#57463d" opacity=".9"><path d="M-.65.2l.24-.62.25.62ZM-.1.38l.3-.8.3.8Z"/></g>}
            {t.feature === 'jungle' && <><circle r=".3" fill="#3b2f2a"/><circle r=".38" fill="none" stroke="#9b4424" strokeWidth=".1"/></>}
            {t.feature === 'ice' && <path d="M-.6.1l.2-.38.7.13.17.35-.54.3Z" fill="#e8eef2" opacity=".85"/>}
            {t.feature === 'reef' && <path d="M-.4.3V-.2m0 .25l-.2-.2M.1.3v-.7m0 .3l.22-.12" fill="none" stroke="#eef3f6" strokeWidth=".13"/>}
            {t.feature === 'oasis' && <><ellipse rx=".28" ry=".17" fill="#3f8f8a" /><path d="M0-.05v-.4" stroke="#eef3f6" strokeWidth=".07"/></>}
            {t.feature === 'marsh' && <path d="M-.5.2h1M-.35.05v-.3M0 .08v-.42M.3.05v-.23" stroke="#d9a066" strokeWidth=".08"/>}
            {t.feature === 'floodplains' && <path d="M-.55.25Q0-.25.55.25M-.35.3Q0-.08.35.3" stroke="#3f8f8a" strokeWidth=".12" fill="none"/>}
            {Array.from({ length: 6 }, (_, d) => (t.riverEdges & (1 << d)) !== 0 && <g key={d}><line x1={corners[(d + 1) % 6][0]} y1={corners[(d + 1) % 6][1]} x2={corners[(d + 2) % 6][0]} y2={corners[(d + 2) % 6][1]} stroke="#6e3219" strokeWidth=".12" strokeLinecap="round" /><line x1={corners[(d + 1) % 6][0]} y1={corners[(d + 1) % 6][1]} x2={corners[(d + 2) % 6][0]} y2={corners[(d + 2) % 6][1]} stroke="#eef3f6" strokeWidth=".035" strokeDasharray=".08 .13" /></g>)}
            {resources && res && <g transform="translate(.37,.42)"><circle r=".23" fill={res.kind === 'luxury' ? '#f28c28' : res.kind === 'strategic' ? '#5fd4e8' : '#e7e3dc'} stroke="#38251c" strokeWidth=".035"/><text textAnchor="middle" y=".085" fontSize=".25" fill="#211510" fontWeight="800">{res.id.slice(0, 1).toUpperCase()}</text></g>}
            {t.ruin && <path d="M-.2.3V-.2h.4v.5M-.3-.2h.6" stroke="#eef3f6" fill="none" strokeWidth=".12"/>}
            {t.camp && <path d="M-.4.3L0-.35.4.3Z" fill="#8d9097" stroke="#3b2f2a" strokeWidth=".08"/>}
            {t.naturalWonder && <path d="M0-.6l.17.38.43.04-.33.28.1.42L0 .3l-.37.22.1-.42-.33-.28.43-.04Z" fill="#f28c28" stroke="#57463d" strokeWidth=".06"/>}
            {start >= 0 && <><circle r=".72" fill="#211510" stroke={teams[start]} strokeWidth=".12"/><text textAnchor="middle" y=".25" fill={teams[start]} fontSize=".5" fontWeight="800">ARK {start + 1}</text></>}
          </g>;
        })}
      </svg>
    </section>
    <footer><span><strong style={{ color: '#f28c28' }}>{seed}</strong> · {map.width} × {map.height} · {Math.round(land / map.tiles.length * 100)}% land · {ms.toFixed(1)} ms</span>
      <div className="legend">{(['ocean', 'coast', 'lake', 'grassland', 'plains', 'desert', 'tundra', 'snow'] as TerrainId[]).map(t => <span className="key" key={t}><i className="swatch" style={{ background: palette[t] }}/>{TERRAIN_NAMES[t]}</span>)}<span className="key"><i className="swatch" style={{ background: '#f28c28' }}/>resources</span></div>
    </footer>
  </main>;
}
