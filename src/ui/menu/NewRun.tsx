import { useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { ASCENSIONS, BUILDINGS, commanderOf, DOCTRINES, LEADERS, UNITS } from '../../content';
import type { CommanderGender } from '../../sim/defs';
import { audio } from '../../audio';
import { useGame } from '../../game/store';
import { isLeaderUnlocked, lockedContent, maxAscension, unlockHint } from '../../meta/profile';
import type { MapSize } from '../../sim/types';
import { START_CRYO, THAW_POP } from '../../sim/mars';
import { T } from '../terms';
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
  /** preferred commander gender; carries over as you browse nations (null = each nation's default) */
  const [preferred, setPreferred] = useState<CommanderGender | null>(null);
  const touchStart = useRef<number | null>(null);
  const leader = leaders[index];
  if (!leader) return <MenuFrame eyebrow="New run" title="Choose your nation"><p className="ae-error">No nations found.</p></MenuFrame>;
  const unlocked = isLeaderUnlocked(profile, leader.id);
  const highest = maxAscension(profile, leader.id);
  const level = Math.min(ascension, highest);
  const onlyNormal = daily || highest === 0;
  const alt = preferred !== null && leader.gender !== preferred;
  const cmd = commanderOf(leader, alt);
  const commanders = [commanderOf(leader, false), commanderOf(leader, true)].sort((a, b) => a.gender.localeCompare(b.gender));
  function changeLeader(next: number) { setIndex((next + leaders.length) % leaders.length); setAscension(0); audio.sfx('select'); }
  function begin() {
    if (!unlocked || starting || !seed.trim()) return;
    const date = dailyDate();
    if (daily && (profile.dailyAttempts?.includes(date) || Object.hasOwn(profile.dailies, date))) { setError('You already played today’s run. Come back tomorrow.'); return; }
    setStarting(true); setError('');
    try {
      audio.init(); audio.sfx('eraFanfare');
      useGame.getState().newGame({ seed: daily ? date : seed.trim(), leaderId: leader.id, ascension: daily ? 0 : level, mapSize: daily ? 'small' : mapSize, rivals: daily ? 3 : rivals, tutorial: !profile.settings.tutorialDone, daily, locked: lockedContent(profile), altCommander: alt });
      if (daily) update((p) => ({ ...p, dailyAttempts: [...new Set([...(p.dailyAttempts ?? []), date])] }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The run could not start. Please try again.'); setStarting(false); }
  }
  const unit = leader.uniqueUnit ? UNITS[leader.uniqueUnit] : null;
  const building = leader.uniqueBuilding ? BUILDINGS[leader.uniqueBuilding] : null;
  const crew = leader.startDoctrine ? DOCTRINES[leader.startDoctrine] : null;
  const arkName = leader.civName;
  return <MenuFrame eyebrow={daily ? 'Daily run · One try' : 'New run'} title="Choose your nation" subtitle="Each nation has its own bonus. Swipe to see more.">
    <div className="ae-newrun-layout" style={{ '--leader-color': leader.colors.primary } as CSSProperties}>
      <section className={`ae-leader-stage ${!unlocked ? 'is-locked' : ''}`} aria-label="Choose a nation" onTouchStart={(e) => { touchStart.current = e.touches[0].clientX; }} onTouchEnd={(e) => { if (touchStart.current !== null) { const delta = e.changedTouches[0].clientX - touchStart.current; if (Math.abs(delta) > 45) changeLeader(index + (delta < 0 ? 1 : -1)); } touchStart.current = null; }}>
        <div className="ae-leader-art" key={`${leader.id}:${cmd.artId}`}><LeaderPortrait leader={leader} alt={alt} shape="card" className="ae-leader-portrait" /><div className="ae-leader-art-shade" /><span className="ae-leader-civ ae-eyebrow">{leader.country}</span><div className="ae-leader-art-name"><span className="ae-eyebrow">{cmd.title}</span><h2>{cmd.name}</h2></div><div className="ae-ark-badge" aria-label={`${leader.code} flag colors`}>{leader.flagColors.map((color, stripe) => <i key={stripe} style={{ backgroundColor: color }} />)}<b>{leader.code}</b></div>{!unlocked && <div className="ae-leader-lock"><Icon name="lock" size={36} /><span>LOCKED</span></div>}</div>
        <div className="ae-carousel-controls"><button className="ae-icon-button" aria-label="Previous nation" onClick={() => changeLeader(index - 1)}><Icon name="chevronLeft" /></button><button className="ae-nation-browse" aria-label="Show all nations" aria-expanded={browsing} onClick={() => { setBrowsing(true); setQuery(''); audio.sfx('open'); }}><span>All</span><small>{index + 1} / {leaders.length}</small></button><button className="ae-icon-button" aria-label="Next nation" onClick={() => changeLeader(index + 1)}><Icon name="chevronRight" /></button></div>
      </section>
      {browsing && <div className="ae-nation-sheet" role="dialog" aria-label="All nations" onClick={(e) => { if (e.target === e.currentTarget) setBrowsing(false); }}>
        <div className="ae-nation-sheet-panel">
          <div className="ae-nation-sheet-head"><h3>Choose a nation</h3><input aria-label="Search nations" placeholder="Search nations…" value={query} autoFocus onChange={(e) => setQuery(e.target.value)} /><button className="ae-icon-button" aria-label="Close" onClick={() => setBrowsing(false)}><Icon name="close" /></button></div>
          <div className="ae-nation-grid">{leaders.map((entry, i) => ({ entry, i })).filter(({ entry }) => !query.trim() || `${entry.country} ${entry.code} ${entry.civName} ${entry.name} ${entry.alt.name}`.toLowerCase().includes(query.trim().toLowerCase())).sort((a, b) => a.entry.country.localeCompare(b.entry.country)).map(({ entry, i }) => <button key={entry.id} aria-label={`Choose ${entry.country}`} aria-pressed={i === index} className={`${i === index ? 'active' : ''}${isLeaderUnlocked(profile, entry.id) ? '' : ' is-locked'}`} style={{ '--nation-color': entry.colors.primary } as CSSProperties} onClick={() => { changeLeader(i); setBrowsing(false); }}><span className="ae-nation-stripes">{entry.flagColors.map((color, stripe) => <i key={stripe} style={{ backgroundColor: color }} />)}</span><b>{entry.code}</b><span className="ae-nation-name">{entry.country}</span>{!isLeaderUnlocked(profile, entry.id) && <Icon name="lock" size={12} />}</button>)}</div>
        </div>
      </div>}
      <section className="ae-leader-details">
        <div className="ae-nation-heading"><span className="ae-eyebrow">{leader.country} · {leader.code}</span><h2>{arkName}</h2><div className="ae-ability ae-ability--top"><span className="ae-eyebrow"><Icon name="bolt" size={16} />{T.leader} bonus</span><RichText text={leader.bonus} /></div><p className="ae-leader-description">Commander {cmd.name}. {cmd.description}</p><div className="ae-commander-pick" role="radiogroup" aria-label="Commander">{commanders.map((c) => <button key={c.artId} role="radio" aria-checked={c.alt === alt} className={c.alt === alt ? 'active' : ''} onClick={() => { setPreferred(c.gender); audio.sfx('select'); }}><small>{c.gender === 'f' ? 'Female' : 'Male'} commander</small><span>{c.name}</span></button>)}</div></div>
        {!unlocked && <p className="ae-unlock-hint"><Icon name="lock" size={18} />{unlockHint('leader', leader.id) ?? leader.unlock?.text ?? 'Finish a run to unlock this nation.'}</p>}
        <div className="ae-starting-kit">
          {crew && <div className="ae-starting-card"><Card card={doctrineCard(crew.id)} width="100%" /><span className="ae-eyebrow">Starting Crew</span></div>}
          <div className="ae-unique-list">
            {unit && <article><Icon name={unit.icon} size={26} /><span className="ae-eyebrow">Unique unit</span><h3>{unit.name}</h3><p><RichText text={unit.description} /></p></article>}
            {building && <article><Icon name={building.icon} size={26} /><span className="ae-eyebrow">Unique building</span><h3>{building.name}</h3><p><RichText text={building.description} /></p></article>}
            <article className="ae-cryo-start"><Icon name="cryo" size={26} /><span className="ae-eyebrow">{T.cryo} at the start</span><h3>{leader.cryo ?? START_CRYO} {T.cryo}</h3><p>One Pod places a new {T.city.toLowerCase()} ({T.drop}) or adds {THAW_POP} colonists to a {T.city.toLowerCase()} ({T.thaw}).</p></article>
          </div>
        </div>
      </section>
      <section className="ae-run-options">
        <div className="ae-hazard-launch">
          <div className="ae-option-heading"><Icon name="storm" size={22} /><h3>{onlyNormal ? `${T.ascension}: Normal` : T.ascension}</h3><span>{level > 0 && `${level} / 8`}</span></div>
          {!onlyNormal && <div className="ae-ascensions" aria-label={`${T.ascension} level`}>{Array.from({ length: 9 }, (_, n) => <button key={n} disabled={daily ? n !== 0 : n > highest} className={level === n ? 'active' : ''} aria-pressed={level === n} aria-label={`${T.ascension} ${n}${n > highest ? ', locked' : ''}`} onClick={() => setAscension(n)}>{n > highest ? <Icon name="lock" size={14} /> : n}</button>)}</div>}
          {onlyNormal && !daily && <p className="ae-difficulty-hint">Win a run to unlock harder levels.</p>}
          {!onlyNormal && <div className="ae-ascension-text"><strong>{level === 0 ? 'Normal' : ASCENSIONS.find((a) => a.level === level)?.name}</strong><p><RichText text={level === 0 ? 'The normal game. Good for your first run. Win to unlock the next level.' : ASCENSIONS.find((a) => a.level === level)?.description ?? ''} /></p>{level > 1 && <small>All lower levels also apply.</small>}</div>}
          <button className="ae-button ae-button-gold ae-begin" disabled={!unlocked || starting || !seed.trim()} onClick={begin}><Icon name={unlocked ? 'drop' : 'lock'} />{starting ? 'Starting…' : unlocked ? 'Start run' : 'Locked'}<Icon name="chevronRight" size={18} /></button>
        </div>
        <div className="ae-run-config">
        <details className="ae-advanced"><summary>Map settings <span>{daily ? 'Daily rules' : 'Optional'}</span></summary><div className="ae-fields"><label>Map size<select disabled={daily} value={mapSize} onChange={(e) => setMapSize(e.target.value as MapSize)}><option value="small">Small · 22 × 16</option><option value="standard">Standard · 28 × 20</option><option value="large">Large · 34 × 24</option></select></label><label>Other nations<select disabled={daily} value={rivals} onChange={(e) => setRivals(Number(e.target.value))}>{[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}</select></label></div></details>
        <label className="ae-seed-label">MAP SEED<div className="ae-seed-field"><input aria-label="Map seed" value={seed} readOnly={daily} maxLength={100} onChange={(e) => setSeed(e.target.value)} />{!daily && <button className="ae-icon-button" aria-label="New random seed" onClick={() => setSeed(randomSeed())}><Icon name="reroll" size={18} /></button>}<CopySeed seed={seed} /></div></label>
        <p className="ae-small-print">{daily ? `Same seed for everyone · Small map · ${T.ascension} 0` : profile.settings.tutorialDone ? 'The game saves after every turn.' : 'A short guide will help you in your first turns.'}</p>
        {error && <p role="alert" className="ae-error">{error}</p>}
        </div>
      </section>
    </div>
  </MenuFrame>;
}
