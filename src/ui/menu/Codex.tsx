import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { CRISES, DOCTRINES, EDICTS, LEADERS, PILLAR_DEFS } from '../../content';
import { isLeaderUnlocked } from '../../meta/profile';
import { CHAPTER_LENGTHS, CHAPTER_NAMES, FINAL_ERA } from '../../sim/roguelite/constants';
import { THAW_POP } from '../../sim/mars';
import { Icon } from '../icons/Icon';
import { RichText } from '../icons/RichText';
import { Card, CardZoom } from '../run/Card';
import { crisisCard, doctrineCard, edictCard, leaderCard } from '../run/cards';
import type { CardModel } from '../run/cards';
import { T } from '../terms';
import { MenuFrame, number, useProfile } from './shared';

const TABS = [T.doctrines, T.edicts, 'Crises', T.leaders, 'How to play'] as const;
type Tab = typeof TABS[number];
interface CodexEntry { id: string; card: CardModel; discovered: boolean; tags: string[]; wins: number | null }
export function Codex() {
  const [tab, setTab] = useState<Tab>(T.doctrines);
  const [search, setSearch] = useState('');
  const [preview, setPreview] = useState<CardModel | null>(null);
  const { profile } = useProfile();
  const entries = useMemo((): CodexEntry[] => {
    switch (tab) {
      case T.doctrines: return Object.values(DOCTRINES).map((d) => ({ id: d.id, card: doctrineCard(d.id), discovered: profile.discovered.doctrines.includes(d.id), tags: d.tags, wins: profile.stats.doctrineWins[d.id] ?? 0 }));
      case T.edicts: return Object.values(EDICTS).map((d) => ({ id: d.id, card: edictCard(d.id), discovered: profile.discovered.edicts.includes(d.id), tags: [d.target], wins: null }));
      case 'Crises': return Object.values(CRISES).map((d) => ({ id: d.id, card: crisisCard(d.id), discovered: profile.discovered.crises.includes(d.id), tags: d.eras.map((era) => `Era ${era + 1}`), wins: null }));
      case T.leaders: return Object.values(LEADERS).map((d) => ({ id: d.id, card: leaderCard(d.id), discovered: isLeaderUnlocked(profile, d.id), tags: [d.country], wins: null }));
      default: return [];
    }
  }, [tab, profile]);
  const visible = entries.filter((entry) => entry.discovered && `${entry.card.title} ${entry.card.description} ${entry.tags.join(' ')}`.toLowerCase().includes(search.toLowerCase()) || !entry.discovered && !search);
  const discovered = entries.filter((entry) => entry.discovered).length;
  return <MenuFrame eyebrow="Game guide" title="Codex" subtitle="Everything you can find in a run." actions={<span className="ae-archive-total"><Icon name="book" size={19} />{number(profile.stats.bestScore)}<small>BEST {T.score.toUpperCase()}</small></span>}>
    <nav className="ae-codex-tabs" aria-label="Codex categories">{TABS.map((name) => <button key={name} aria-pressed={name === tab} className={name === tab ? 'active' : ''} onClick={() => { setTab(name); setSearch(''); }}>{name}</button>)}</nav>
    {tab === 'How to play' ? <HowToPlay /> : <>
      <div className="ae-codex-tools"><label className="ae-search"><Icon name="explore" size={18} /><input aria-label="Search the Codex" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} /></label></div>
      <div className="ae-collection-progress"><span>{discovered} / {entries.length} found</span><div><i style={{ width: `${entries.length ? discovered / entries.length * 100 : 0}%` }} /></div><small>{visible.length} shown</small></div>
      <div className="ae-codex-grid">{visible.map((entry) => <div key={entry.id} className="ae-codex-entry"><Card card={entry.card} width="100%" locked={!entry.discovered} zoomable={false} onTap={entry.discovered ? () => setPreview(entry.card) : undefined} />{entry.discovered && entry.wins !== null && <span className="ae-doctrine-wins"><Icon name="trophy" size={14} />{entry.wins ? `${number(entry.wins)} ${entry.wins === 1 ? 'win' : 'wins'}` : 'No wins yet'}</span>}</div>)}</div>
      {visible.length === 0 && <div className="ae-empty"><Icon name="book" size={44} /><h2>Nothing found</h2><p>Try another word.</p><button className="ae-button" onClick={() => setSearch('')}>Clear search</button></div>}
    </>}
    {preview && <CardZoom card={preview} onClose={() => setPreview(null)} />}
  </MenuFrame>;
}
function HowToPlay() {
  const turns = CHAPTER_LENGTHS.reduce((a, b) => a + b, 0) * (FINAL_ERA + 1);
  const steps = [
    { icon: 'city', title: 'Land', text: `Your ${T.capital} is already on Mars. You start with a few units and some ${T.cryo}.` },
    { icon: 'cryo', title: `Use your ${T.cryo}`, text: `One Pod can ${T.drop.toLowerCase()} (a new ${T.city.toLowerCase()}) or ${T.thaw.toLowerCase()} (+${THAW_POP} colonists in a ${T.city.toLowerCase()}).` },
    { icon: 'storm', title: `${T.storm}s`, text: `${T.storm}s move along a dotted path. They lower Food and Production and hurt units. Stay out of their way.` },
    { icon: 'tech', title: T.tech, text: `When ${T.tech.toLowerCase()} is done, pick 1 of 3 new options. ${T.tech} unlocks new builds and units.` },
    { icon: 'journal', title: T.report, text: `Each chapter ends with a ${T.report}. Your ${T.score} must reach the target. Survive six eras to win.` },
  ];
  return <section className="ae-guide"><div className="ae-guide-hero"><span className="ae-eyebrow">How to play</span><h2>Land. Grow. Survive.</h2><p>About {turns} turns over six eras. Each era has two chapters: {CHAPTER_NAMES.join(' and ')}.</p></div>
    <div className="ae-guide-loop">{steps.map((step, i) => <article key={step.title}><div className="ae-guide-icon"><Icon name={step.icon} size={46} /><span>0{i + 1}</span></div><h3>{step.title}</h3><p>{step.text}</p></article>)}</div>
    <div className="ae-score-equation"><span><Icon name="renown" size={30} /><strong>{T.renown}</strong><small>What you make</small></span><b>×</b><span><Icon name="splendor" size={30} /><strong>{T.splendor}</strong><small>How well you do it</small></span><b>=</b><span><Icon name="crown" size={30} /><strong>{T.score}</strong><small>Must reach the target</small></span></div>
    <h3 className="ae-section-title">Pick a {T.focus} each chapter</h3><div className="ae-guide-pillars">{Object.values(PILLAR_DEFS).map((pillar) => <article key={pillar.id} style={{ '--pillar-color': pillar.color } as CSSProperties}><Icon name={pillar.icon} size={25} /><h4>{pillar.name}</h4><p><RichText text={pillar.description} /></p></article>)}</div>
    <div className="ae-guide-tips">
      <article><Icon name="mandate" size={25} /><h3>{T.mandate}</h3><p>Miss a target and you lose a life. Then you get a {T.darkAge}: some {T.influence} and an easier next target. Lose all lives, or your {T.capital}, and the run ends.</p></article>
      <article><Icon name="crisis" size={25} /><h3>{T.crisis}</h3><p>Each era has a {T.crisis}. You see it at the start of the era. Use the {CHAPTER_NAMES[0]} chapter to get ready.</p></article>
      <article><Icon name="doctrine" size={25} /><h3>{T.doctrines}</h3><p>Buy {T.doctrines} in the {T.council}. They give bonuses every chapter. They work from left to right, so order matters.</p></article>
      <article><Icon name="cryo" size={25} /><h3>{T.cryo}</h3><p>Each Pod is a new {T.city.toLowerCase()} or {THAW_POP} new colonists. You get one more Pod each era.</p></article>
    </div>
  </section>;
}
