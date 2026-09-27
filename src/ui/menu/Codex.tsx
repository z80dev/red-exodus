import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { CRISES, DOCTRINES, EDICTS, LEADERS, PILLAR_DEFS, TECHS, UNITS, WONDERS } from '../../content';
import { isLeaderUnlocked } from '../../meta/profile';
import { Icon } from '../icons/Icon';
import { RichText } from '../icons/RichText';
import { Card, CardZoom } from '../run/Card';
import { crisisCard, doctrineCard, edictCard, leaderCard } from '../run/cards';
import type { CardModel } from '../run/cards';
import { MenuFrame, number, useProfile } from './shared';

const TABS = ['Doctrines', 'Edicts', 'Crises', 'Leaders', 'Wonders', 'Units', 'Techs', 'How to Play'] as const;
type Tab = typeof TABS[number];
interface CodexEntry { id: string; card: CardModel; discovered: boolean; tags: string[]; wins: number | null }
export function Codex() {
  const [tab, setTab] = useState<Tab>('Doctrines');
  const [search, setSearch] = useState('');
  const [rarity, setRarity] = useState('all');
  const [tag, setTag] = useState('all');
  const [discovery, setDiscovery] = useState('all');
  const [preview, setPreview] = useState<CardModel | null>(null);
  const { profile } = useProfile();
  const entries = useMemo((): CodexEntry[] => {
    switch (tab) {
      case 'Doctrines': return Object.values(DOCTRINES).map((d) => ({ id: d.id, card: doctrineCard(d.id), discovered: profile.discovered.doctrines.includes(d.id), tags: d.tags, wins: profile.stats.doctrineWins[d.id] ?? 0 }));
      case 'Edicts': return Object.values(EDICTS).map((d) => ({ id: d.id, card: edictCard(d.id), discovered: profile.discovered.edicts.includes(d.id), tags: [d.target], wins: null }));
      case 'Crises': return Object.values(CRISES).map((d) => ({ id: d.id, card: crisisCard(d.id), discovered: profile.discovered.crises.includes(d.id), tags: d.eras.map((era) => `Era ${era + 1}`), wins: null }));
      case 'Leaders': return Object.values(LEADERS).map((d) => ({ id: d.id, card: leaderCard(d.id), discovered: isLeaderUnlocked(profile, d.id), tags: [], wins: null }));
      case 'Wonders': return Object.values(WONDERS).map((d) => ({ id: d.id, card: { kind: 'wonder', id: d.id, title: d.name, description: d.description, flavor: d.flavor, typeLabel: 'World wonder', icon: d.icon, art: { hue: 42, motif: 'temple' }, footer: `${d.cost} Production · Era ${d.era + 1}` }, discovered: profile.discovered.wonders.includes(d.id), tags: [`Era ${d.era + 1}`], wins: null }));
      case 'Units': return Object.values(UNITS).map((d) => ({ id: d.id, card: { kind: 'unit', id: d.id, title: d.name, description: d.description, typeLabel: d.class, icon: d.icon, art: { hue: 12, motif: 'sword' }, footer: `${d.strength} Strength · ${d.moves} Movement` }, discovered: !d.uniqueTo || !LEADERS[d.uniqueTo]?.unlock || profile.unlocked.leaders.includes(d.uniqueTo), tags: [d.class, `Era ${d.era + 1}`], wins: null }));
      case 'Techs': return Object.values(TECHS).map((d) => ({ id: d.id, card: { kind: 'tech', id: d.id, title: d.name, description: d.description, typeLabel: 'Technology', icon: d.icon, art: { hue: 210, motif: 'flask' }, footer: `${d.cost} Science · Era ${d.era + 1}` }, discovered: true, tags: [`Era ${d.era + 1}`], wins: null }));
      default: return [];
    }
  }, [tab, profile]);
  const tags = [...new Set(entries.flatMap((entry) => entry.tags))].sort();
  const visible = entries.filter((entry) => {
    if (discovery === 'discovered' && !entry.discovered || discovery === 'unseen' && entry.discovered) return false;
    if (!entry.discovered) return !search && rarity === 'all' && tag === 'all';
    const cardRarity = 'rarity' in entry.card ? entry.card.rarity : undefined;
    return (rarity === 'all' || cardRarity === rarity) && (tag === 'all' || entry.tags.includes(tag)) && `${entry.card.title} ${entry.card.description}`.toLowerCase().includes(search.toLowerCase());
  });
  const discovered = entries.filter((e) => e.discovered).length;
  return <MenuFrame eyebrow="The imperial archives" title="Codex" subtitle="Knowledge outlives every empire." actions={<span className="ae-archive-total"><Icon name="book" size={19} />{number(profile.stats.bestScore)}<small>BEST LEGACY</small></span>}>
    <nav className="ae-codex-tabs" aria-label="Codex categories">{TABS.map((name) => <button key={name} aria-pressed={name === tab} className={name === tab ? 'active' : ''} onClick={() => { setTab(name); setTag('all'); setRarity('all'); setSearch(''); }}>{name}</button>)}</nav>
    {tab === 'How to Play' ? <HowToPlay /> : <>
      <div className="ae-codex-tools"><label className="ae-search"><Icon name="explore" size={18} /><input aria-label="Search codex" placeholder="Search the archives…" value={search} onChange={(e) => setSearch(e.target.value)} /></label>{(tab === 'Doctrines' || tab === 'Edicts') && <select aria-label="Filter rarity" value={rarity} onChange={(e) => setRarity(e.target.value)}><option value="all">All rarities</option>{['common', 'uncommon', 'rare', 'legendary'].map((r) => <option key={r} value={r}>{r[0].toUpperCase() + r.slice(1)}</option>)}</select>}{tags.length > 0 && <select aria-label="Filter tag" value={tag} onChange={(e) => setTag(e.target.value)}><option value="all">All themes</option>{tags.map((t) => <option key={t} value={t}>{t}</option>)}</select>}<select aria-label="Filter discovery" value={discovery} onChange={(e) => setDiscovery(e.target.value)}><option value="all">All entries</option><option value="discovered">Discovered</option><option value="unseen">Undiscovered</option></select></div>
      <div className="ae-collection-progress"><span>{discovered} / {entries.length} discovered</span><div><i style={{ width: `${entries.length ? discovered / entries.length * 100 : 0}%` }} /></div><small>{visible.length} entries</small></div>
      <div className="ae-codex-grid">{visible.map((entry) => <div key={entry.id} className="ae-codex-entry"><Card card={entry.card} width="100%" locked={!entry.discovered} zoomable={false} onTap={entry.discovered ? () => setPreview(entry.card) : undefined} />{entry.discovered && entry.wins !== null && <span className="ae-doctrine-wins"><Icon name="trophy" size={14} />{entry.wins ? `${number(entry.wins)} ${entry.wins === 1 ? 'victory' : 'victories'}` : 'No victories yet'}</span>}</div>)}</div>
      {visible.length === 0 && <div className="ae-empty"><Icon name="book" size={44} /><h2>No pages found</h2><p>Try another search or clear your filters.</p><button className="ae-button" onClick={() => { setSearch(''); setRarity('all'); setTag('all'); setDiscovery('all'); }}>Clear filters</button></div>}
    </>}
    {preview && <CardZoom card={preview} onClose={() => setPreview(null)} />}
  </MenuFrame>;
}
function HowToPlay() {
  return <section className="ae-guide"><div className="ae-guide-hero"><span className="ae-eyebrow">The art of becoming eternal</span><h2>You do not need to conquer the world.<br /><em>You need to make it remember you.</em></h2><p>Build an empire on the map. Turn its achievements into Legacy. Reinvent your strategy after every chapter.</p></div>
    <div className="ae-guide-loop">{[{ icon: 'city', title: 'Build your empire', text: 'Found cities, grow your people, discover technologies and defend your borders. Every achievement feeds one of six Pillars.' }, { icon: 'book', title: 'Write the Chronicle', text: 'After 6–8 turns, your achievements become Renown. Your cities and Doctrines add Splendor. Beat the chapter’s Legacy target.' }, { icon: 'doctrine', title: 'Gather the Council', text: 'Spend Influence on Doctrines, Edicts and Scrolls. Build a scoring engine, then return to the map with a new plan.' }].map((step, i) => <article key={step.title}><div className="ae-guide-icon"><Icon name={step.icon} size={46} /><span>0{i + 1}</span></div><h3>{step.title}</h3><p>{step.text}</p></article>)}</div>
    <div className="ae-score-equation"><span><Icon name="renown" size={30} /><strong>Renown</strong><small>Your achievements</small></span><b>×</b><span><Icon name="splendor" size={30} /><strong>Splendor</strong><small>Your multiplier</small></span><b>=</b><span><Icon name="crown" size={30} /><strong>Legacy</strong><small>Your place in history</small></span></div>
    <h3 className="ae-section-title">Six paths to greatness</h3><div className="ae-guide-pillars">{Object.values(PILLAR_DEFS).map((pillar) => <article key={pillar.id} style={{ '--pillar-color': pillar.color } as CSSProperties}><Icon name={pillar.icon} size={25} /><h4>{pillar.name}</h4><p><RichText text={pillar.description} /></p></article>)}</div>
    <div className="ae-guide-tips"><article><Icon name="mandate" size={25} /><h3>Your Mandate is not infinite</h3><p>Miss a target and lose 1 Mandate; a Crisis costs 2. A failure brings a Dark Age with −15% yields. Lose all Mandate or your capital, and your empire falls.</p></article><article><Icon name="crisis" size={25} /><h3>Read the coming storm</h3><p>Each era reveals its Crisis in advance. Prepare during Rise and Trial before facing it in chapter III. Complete six eras to become eternal.</p></article><article><Icon name="doctrine" size={25} /><h3>Order is an art</h3><p>Doctrines resolve from left to right. Put additions before multipliers. Focus doubles a Pillar’s Renown; Scrolls raise its power for the entire run.</p></article><article><Icon name="map" size={25} /><h3>A world at your fingertips</h3><p>Tap a unit, then a tile to move. Tap an enemy for a combat preview. Drag to pan, pinch to zoom, and hold a tile to inspect it. Your chronicle autosaves.</p></article></div>
  </section>;
}
