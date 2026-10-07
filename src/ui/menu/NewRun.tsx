import { useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { ASCENSIONS, BUILDINGS, DOCTRINES, LEADERS, UNITS } from '../../content';
import { audio } from '../../audio';
import { useGame } from '../../game/store';
import { isLeaderUnlocked, lockedContent, maxAscension, unlockHint } from '../../meta/profile';
import type { MapSize } from '../../sim/types';
import { START_CRYO } from '../../sim/mars';
import { LeaderPortrait } from '../art/LeaderPortrait';
import { Icon } from '../icons/Icon';
import { RichText } from '../icons/RichText';
import { Card } from '../run/Card';
import { doctrineCard } from '../run/cards';
import { CopySeed, dailyDate, isDailyLaunch, MenuFrame, useProfile } from './shared';

function randomSeed() {
  const bytes = crypto.getRandomValues(new Uint32Array(2));
  return `RED-${bytes[0].toString(36).toUpperCase()}-${bytes[1].toString(36).toUpperCase()}`;
}
export function NewRun() {
  const { profile, update } = useProfile();
  const leaders = Object.values(LEADERS);
  const [index, setIndex] = useState(0);
  const [ascension, setAscension] = useState(0);
  const [mapSize, setMapSize] = useState<MapSize>('small');
  const [rivals, setRivals] = useState(3);
  const daily = isDailyLaunch();
  const [seed, setSeed] = useState(() => daily ? dailyDate() : randomSeed());
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [browsing, setBrowsing] = useState(false);
  const [query, setQuery] = useState('');
  const touchStart = useRef<number | null>(null);
  const leader = leaders[index];
  if (!leader) return <MenuFrame eyebrow="Landfall protocol" title="Choose your Ark"><p className="ae-error">The Ark registry is unavailable.</p></MenuFrame>;
  const unlocked = isLeaderUnlocked(profile, leader.id);
  const highest = maxAscension(profile, leader.id);
  const level = Math.min(ascension, highest);
  function changeLeader(next: number) { setIndex((next + leaders.length) % leaders.length); setAscension(0); audio.sfx('select'); }
  function begin() {
    if (!unlocked || starting || !seed.trim()) return;
    const date = dailyDate();
    if (daily && (profile.dailyAttempts?.includes(date) || Object.hasOwn(profile.dailies, date))) { setError('Today’s launch window has closed. There are no second attempts in orbit.'); return; }
    setStarting(true); setError('');
    try {
      audio.init(); audio.sfx('eraFanfare');
      useGame.getState().newGame({ seed: daily ? date : seed.trim(), leaderId: leader.id, ascension: daily ? 0 : level, mapSize: daily ? 'small' : mapSize, rivals: daily ? 3 : rivals, tutorial: !profile.settings.tutorialDone, daily, locked: lockedContent(profile) });
      if (daily) update((p) => ({ ...p, dailyAttempts: [...new Set([...(p.dailyAttempts ?? []), date])] }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Your landing window was lost. Try again.'); setStarting(false); }
  }
  const unit = leader.uniqueUnit ? UNITS[leader.uniqueUnit] : null;
  const building = leader.uniqueBuilding ? BUILDINGS[leader.uniqueBuilding] : null;
  const crew = leader.startDoctrine ? DOCTRINES[leader.startDoctrine] : null;
  const arkName = leader.civName;
  return <MenuFrame eyebrow={daily ? 'Daily Landfall · One attempt' : 'A world waits below'} title="Choose your Ark" subtitle="Fifty-one nations escaped Earth. Mars has room for none of their old excuses.">
    <div className="ae-newrun-layout" style={{ '--leader-color': leader.colors.primary } as CSSProperties}>
      <section className={`ae-leader-stage ${!unlocked ? 'is-locked' : ''}`} aria-label="Choose a nation" onTouchStart={(e) => { touchStart.current = e.touches[0].clientX; }} onTouchEnd={(e) => { if (touchStart.current !== null) { const delta = e.changedTouches[0].clientX - touchStart.current; if (Math.abs(delta) > 45) changeLeader(index + (delta < 0 ? 1 : -1)); } touchStart.current = null; }}>
        <div className="ae-leader-art" key={leader.id}><LeaderPortrait leader={leader} shape="card" className="ae-leader-portrait" /><div className="ae-leader-art-shade" /><span className="ae-leader-civ ae-eyebrow">{leader.country}</span><div className="ae-leader-art-name"><span className="ae-eyebrow">{leader.title}</span><h2>{leader.name}</h2></div><div className="ae-ark-badge" aria-label={`${leader.code} Ark colors`}>{leader.flagColors.map((color, stripe) => <i key={stripe} style={{ backgroundColor: color }} />)}<b>{leader.code}</b></div>{!unlocked && <div className="ae-leader-lock"><Icon name="lock" size={36} /><span>ARK NOT CLEARED</span></div>}</div>
        <div className="ae-carousel-controls"><button className="ae-icon-button" aria-label="Previous nation" onClick={() => changeLeader(index - 1)}><Icon name="chevronLeft" /></button><button className="ae-nation-browse" aria-label="Browse all nations" aria-expanded={browsing} onClick={() => { setBrowsing(true); setQuery(''); audio.sfx('open'); }}><span>All Arks</span><small>{index + 1} / {leaders.length}</small></button><button className="ae-icon-button" aria-label="Next nation" onClick={() => changeLeader(index + 1)}><Icon name="chevronRight" /></button></div>
      </section>
      {browsing && <div className="ae-nation-sheet" role="dialog" aria-label="All nations" onClick={(e) => { if (e.target === e.currentTarget) setBrowsing(false); }}>
        <div className="ae-nation-sheet-panel">
          <div className="ae-nation-sheet-head"><h3>Choose an Ark</h3><input aria-label="Search nations" placeholder="Search nations…" value={query} autoFocus onChange={(e) => setQuery(e.target.value)} /><button className="ae-icon-button" aria-label="Close" onClick={() => setBrowsing(false)}><Icon name="close" /></button></div>
          <div className="ae-nation-grid">{leaders.map((entry, i) => ({ entry, i })).filter(({ entry }) => !query.trim() || `${entry.country} ${entry.code} ${entry.civName} ${entry.name}`.toLowerCase().includes(query.trim().toLowerCase())).sort((a, b) => a.entry.country.localeCompare(b.entry.country)).map(({ entry, i }) => <button key={entry.id} aria-label={`Choose ${entry.country}`} aria-pressed={i === index} className={`${i === index ? 'active' : ''}${isLeaderUnlocked(profile, entry.id) ? '' : ' is-locked'}`} style={{ '--nation-color': entry.colors.primary } as CSSProperties} onClick={() => { changeLeader(i); setBrowsing(false); }}><span className="ae-nation-stripes">{entry.flagColors.map((color, stripe) => <i key={stripe} style={{ backgroundColor: color }} />)}</span><b>{entry.code}</b><span className="ae-nation-name">{entry.country}</span>{!isLeaderUnlocked(profile, entry.id) && <Icon name="lock" size={12} />}</button>)}</div>
        </div>
      </div>}
      <section className="ae-leader-details">
        <div className="ae-nation-heading"><span className="ae-eyebrow">{leader.country} · {leader.code}</span><h2>{arkName}</h2><p className="ae-leader-description">Commander {leader.name}. {leader.description}</p></div>
        <div className="ae-ability"><span className="ae-eyebrow"><Icon name="bolt" size={16} />Rule-breaker</span><RichText text={leader.bonus} /></div>
        {!unlocked && <p className="ae-unlock-hint"><Icon name="lock" size={18} />{unlockHint('leader', leader.id) ?? leader.unlock?.text ?? 'Complete a prior landing to unlock this Ark.'}</p>}
        <div className="ae-starting-kit">
          {crew && <div className="ae-starting-card"><Card card={doctrineCard(crew.id)} width="100%" /><span className="ae-eyebrow">Starting Crew</span></div>}
          <div className="ae-unique-list">
            {unit && <article><Icon name={unit.icon} size={26} /><span className="ae-eyebrow">Unique unit</span><h3>{unit.name}</h3><p><RichText text={unit.description} /></p></article>}
            {building && <article><Icon name={building.icon} size={26} /><span className="ae-eyebrow">Unique building</span><h3>{building.name}</h3><p><RichText text={building.description} /></p></article>}
            <article className="ae-cryo-start"><Icon name="cryo" size={26} /><span className="ae-eyebrow">Cryo pods at landfall</span><h3>{leader.cryo ?? START_CRYO} pods</h3><p>Orbital Drop for a new colony, or Thaw two colonists at home.</p></article>
          </div>
        </div>
      </section>
      <section className="ae-run-options">
        <div className="ae-hazard-launch">
          <div className="ae-option-heading"><Icon name="storm" size={22} /><h3>Hazard</h3><span>{level === 0 ? 'Clear skies… for now' : `${level} / 8`}</span></div>
          <div className="ae-ascensions" aria-label="Hazard level">{Array.from({ length: 9 }, (_, n) => <button key={n} disabled={daily ? n !== 0 : n > highest} className={level === n ? 'active' : ''} aria-pressed={level === n} aria-label={`Hazard ${n}${n > highest ? ', locked' : ''}`} onClick={() => setAscension(n)}>{n > highest ? <Icon name="lock" size={14} /> : n}</button>)}</div>
          <div className="ae-ascension-text"><strong>{level === 0 ? 'Standard Mars' : ASCENSIONS.find((a) => a.level === level)?.name}</strong><p><RichText text={level === 0 ? 'The baseline threat. Dust storms still do not care about your plans.' : ASCENSIONS.find((a) => a.level === level)?.description ?? ''} /></p>{level > 1 && <small>All earlier Hazard conditions also apply.</small>}</div>
          <button className="ae-button ae-button-gold ae-begin" disabled={!unlocked || starting || !seed.trim()} onClick={begin}><Icon name={unlocked ? 'drop' : 'lock'} />{starting ? 'Descent in progress…' : unlocked ? 'Begin Landfall' : 'Ark locked'}<Icon name="chevronRight" size={18} /></button>
        </div>
        <div className="ae-run-config">
        <details className="ae-advanced"><summary>World settings <span>{daily ? 'Daily rules' : 'Advanced'}</span></summary><div className="ae-fields"><label>Map size<select disabled={daily} value={mapSize} onChange={(e) => setMapSize(e.target.value as MapSize)}><option value="small">Small · 22 × 16</option><option value="standard">Standard · 28 × 20</option><option value="large">Large · 34 × 24</option></select></label><label>Rival Arks<select disabled={daily} value={rivals} onChange={(e) => setRivals(Number(e.target.value))}>{[1, 2, 3].map((n) => <option key={n} value={n}>{n} {n === 1 ? 'rival' : 'rivals'}</option>)}</select></label></div></details>
        <label className="ae-seed-label">LANDING SEED<div className="ae-seed-field"><input aria-label="Landing seed" value={seed} readOnly={daily} maxLength={100} onChange={(e) => setSeed(e.target.value)} />{!daily && <button className="ae-icon-button" aria-label="Randomize seed" onClick={() => setSeed(randomSeed())}><Icon name="reroll" size={18} /></button>}<CopySeed seed={seed} /></div></label>
        <p className="ae-small-print">{daily ? 'Shared seed · Small map · Hazard 0' : profile.settings.tutorialDone ? 'Your colony autosaves after every Sol.' : 'A flight recorder will guide your first Sols.'}</p>
        {error && <p role="alert" className="ae-error">{error}</p>}
        </div>
      </section>
    </div>
  </MenuFrame>;
}
