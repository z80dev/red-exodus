import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { CRISES, DOCTRINES, EDICTS, LEADERS, OMENS, PILLAR_DEFS, REFORMS, SCROLLS } from '../../content';
import { isLeaderUnlocked } from '../../meta/profile';
import { Icon } from '../icons/Icon';
import { RichText } from '../icons/RichText';
import { Card, CardZoom } from '../run/Card';
import { crisisCard, doctrineCard, edictCard, leaderCard, omenCard } from '../run/cards';
import type { CardModel } from '../run/cards';
import { MenuFrame, number, useProfile } from './shared';

const TABS = ['Crew', 'Salvage', 'Blueprints', 'Crises', 'Directives', 'Ark Modules', 'Nations', 'How to Survive'] as const;
type Tab = typeof TABS[number];
interface CodexEntry { id: string; card: CardModel; discovered: boolean; tags: string[]; wins: number | null }
export function Codex() {
  const [tab, setTab] = useState<Tab>('Crew');
  const [search, setSearch] = useState('');
  const [preview, setPreview] = useState<CardModel | null>(null);
  const { profile } = useProfile();
  const entries = useMemo((): CodexEntry[] => {
    switch (tab) {
      case 'Crew': return Object.values(DOCTRINES).map((d) => ({ id: d.id, card: doctrineCard(d.id), discovered: profile.discovered.doctrines.includes(d.id), tags: d.tags, wins: profile.stats.doctrineWins[d.id] ?? 0 }));
      case 'Salvage': return Object.values(EDICTS).map((d) => ({ id: d.id, card: edictCard(d.id), discovered: profile.discovered.edicts.includes(d.id), tags: [d.target], wins: null }));
      case 'Blueprints': return Object.values(SCROLLS).map((d) => ({ id: d.id, card: { kind: 'scroll', id: d.id, title: d.name, description: d.description, typeLabel: 'Blueprint', icon: d.icon, art: { hue: 210, motif: 'gear' }, footer: `${d.cost} Scrip` }, discovered: true, tags: [], wins: null }));
      case 'Crises': return Object.values(CRISES).map((d) => ({ id: d.id, card: crisisCard(d.id), discovered: profile.discovered.crises.includes(d.id), tags: d.eras.map((era) => `Era ${era + 1}`), wins: null }));
      case 'Directives': return Object.values(OMENS).map((d) => ({ id: d.id, card: omenCard(d.id), discovered: true, tags: [], wins: null }));
      case 'Ark Modules': return Object.values(REFORMS).map((d) => ({ id: d.id, card: { kind: 'reform', id: d.id, title: d.name, description: d.description, typeLabel: 'Ark Module', icon: d.icon, art: { hue: 38, motif: 'gear' }, footer: `${d.cost} Scrip · Tier ${d.tier}` }, discovered: true, tags: [`Tier ${d.tier}`], wins: null }));
      case 'Nations': return Object.values(LEADERS).map((d) => ({ id: d.id, card: leaderCard(d.id), discovered: isLeaderUnlocked(profile, d.id), tags: [d.country], wins: null }));
      default: return [];
    }
  }, [tab, profile]);
  const visible = entries.filter((entry) => entry.discovered && `${entry.card.title} ${entry.card.description} ${entry.tags.join(' ')}`.toLowerCase().includes(search.toLowerCase()) || !entry.discovered && !search);
  const discovered = entries.filter((entry) => entry.discovered).length;
  return <MenuFrame eyebrow="Ark archives" title="Codex" subtitle="Everything Earth left you. Most of it is still useful." actions={<span className="ae-archive-total"><Icon name="book" size={19} />{number(profile.stats.bestScore)}<small>BEST VIABILITY</small></span>}>
    <nav className="ae-codex-tabs" aria-label="Codex categories">{TABS.map((name) => <button key={name} aria-pressed={name === tab} className={name === tab ? 'active' : ''} onClick={() => { setTab(name); setSearch(''); }}>{name}</button>)}</nav>
    {tab === 'How to Survive' ? <HowToPlay /> : <>
      <div className="ae-codex-tools"><label className="ae-search"><Icon name="explore" size={18} /><input aria-label="Search codex" placeholder="Search the Ark archives…" value={search} onChange={(e) => setSearch(e.target.value)} /></label></div>
      <div className="ae-collection-progress"><span>{discovered} / {entries.length} in the archive</span><div><i style={{ width: `${entries.length ? discovered / entries.length * 100 : 0}%` }} /></div><small>{visible.length} entries</small></div>
      <div className="ae-codex-grid">{visible.map((entry) => <div key={entry.id} className="ae-codex-entry"><Card card={entry.card} width="100%" locked={!entry.discovered} zoomable={false} onTap={entry.discovered ? () => setPreview(entry.card) : undefined} />{entry.discovered && entry.wins !== null && <span className="ae-doctrine-wins"><Icon name="trophy" size={14} />{entry.wins ? `${number(entry.wins)} runs with this Crew` : 'No reports yet'}</span>}</div>)}</div>
      {visible.length === 0 && <div className="ae-empty"><Icon name="book" size={44} /><h2>No files match</h2><p>Try another search. The archive is mostly ash anyway.</p><button className="ae-button" onClick={() => setSearch('')}>Clear search</button></div>}
    </>}
    {preview && <CardZoom card={preview} onClose={() => setPreview(null)} />}
  </MenuFrame>;
}
function HowToPlay() {
  const steps = [
    { icon: 'drop', title: 'Landfall', text: 'Your Ark Hab is already down. Start with a Militia, a Scout Rover and a finite supply of Cryo pods. Mars skipped the welcome speech.' },
    { icon: 'cryo', title: 'Orbital Drop or Thaw', text: 'Spend a Cryo pod to drop a whole colony instantly within range—or thaw two colonists in an existing colony. Expansion and growth share the same life-support budget.' },
    { icon: 'storm', title: 'Read the dust', text: 'Storm forecasts show where the eye is headed. Storm cells halve Food and Industry and can batter exposed units. The forecast is not a suggestion.' },
    { icon: 'breakthrough', title: 'Draft a Breakthrough', text: 'When research completes, choose one of three offered technologies. Spend Credits to reroll when all three futures look equally bad.' },
    { icon: 'journal', title: 'File your Sol Report', text: 'Each chapter scores Viability = Output × Hope. Meet the target to keep your Charter. Survive six eras, from Landfall through New Earth.' },
  ];
  return <section className="ae-guide"><div className="ae-guide-hero"><span className="ae-eyebrow">The survival manual</span><h2>Earth ended. Your shift starts now.</h2><p>Roughly 78 Sols to prove that humanity can make it on Mars. No pressure; the planet has plenty.</p></div>
    <div className="ae-guide-loop">{steps.map((step, i) => <article key={step.title}><div className="ae-guide-icon"><Icon name={step.icon} size={46} /><span>0{i + 1}</span></div><h3>{step.title}</h3><p>{step.text}</p></article>)}</div>
    <div className="ae-score-equation"><span><Icon name="renown" size={30} /><strong>Output</strong><small>What you made</small></span><b>×</b><span><Icon name="splendor" size={30} /><strong>Hope</strong><small>Why it matters</small></span><b>=</b><span><Icon name="crown" size={30} /><strong>Viability</strong><small>Your place on Mars</small></span></div>
    <h3 className="ae-section-title">Six pillars. One report.</h3><div className="ae-guide-pillars">{Object.values(PILLAR_DEFS).map((pillar) => <article key={pillar.id} style={{ '--pillar-color': pillar.color } as CSSProperties}><Icon name={pillar.icon} size={25} /><h4>{pillar.name}</h4><p><RichText text={pillar.description} /></p></article>)}</div>
    <div className="ae-guide-tips"><article><Icon name="mandate" size={25} /><h3>Charter has an end date</h3><p>Miss a Viability target and lose Charter. The Council throws a Lifeline: relief Scrip and an easier next target. Lose all support—or your Ark Hab—and the run ends.</p></article><article><Icon name="crisis" size={25} /><h3>Crises are scheduled disasters</h3><p>Each era reveals its Crisis early. Use Dawn and Dusk to prepare for the third chapter, when Mars sends the invoice.</p></article><article><Icon name="doctrine" size={25} /><h3>Crew change the math</h3><p>Crew fire left to right. Put additions before multipliers, and build around your nation's rule-breaker.</p></article><article><Icon name="cryo" size={25} /><h3>Pods are people</h3><p>One pod means a new colony by Orbital Drop or two new people by Thaw. Every era restores one. Spend like it matters.</p></article></div>
  </section>;
}
