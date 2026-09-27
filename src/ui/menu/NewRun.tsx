import { useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { ASCENSIONS, BUILDINGS, LEADERS, UNITS } from '../../content';
import { audio } from '../../audio';
import { useGame } from '../../game/store';
import { isLeaderUnlocked, lockedContent, maxAscension, unlockHint } from '../../meta/profile';
import type { MapSize } from '../../sim/types';
import { LeaderPortrait } from '../art/LeaderPortrait';
import { Icon } from '../icons/Icon';
import { RichText } from '../icons/RichText';
import { Card } from '../run/Card';
import { doctrineCard } from '../run/cards';
import { CopySeed, dailyDate, isDailyLaunch, MenuFrame, useProfile } from './shared';

function randomSeed() {
  const bytes = crypto.getRandomValues(new Uint32Array(2));
  return `AEONS-${bytes[0].toString(36).toUpperCase()}-${bytes[1].toString(36).toUpperCase()}`;
}
export function NewRun() {
  const { profile, update } = useProfile();
  const leaders = Object.values(LEADERS);
  const [index, setIndex] = useState(0);
  const [ascension, setAscension] = useState(0);
  const [mapSize, setMapSize] = useState<MapSize>('standard');
  const [rivals, setRivals] = useState(3);
  const daily = isDailyLaunch();
  const [seed, setSeed] = useState(() => daily ? dailyDate() : randomSeed());
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const touchStart = useRef<number | null>(null);
  const leader = leaders[index];
  if (!leader) return <MenuFrame eyebrow="A world awaits" title="Choose your sovereign"><p className="ae-error">The leader archive is unavailable.</p></MenuFrame>;
  const unlocked = isLeaderUnlocked(profile, leader.id);
  const highest = maxAscension(profile, leader.id);
  const level = Math.min(ascension, highest);
  function changeLeader(next: number) { setIndex((next + leaders.length) % leaders.length); setAscension(0); audio.sfx('select'); }
  function begin() {
    if (!unlocked || starting || !seed.trim()) return;
    const date = dailyDate();
    if (daily && (profile.dailyAttempts?.includes(date) || Object.hasOwn(profile.dailies, date))) { setError('Today’s attempt has already been used. Return tomorrow for a new world.'); return; }
    setStarting(true); setError('');
    try {
      audio.init(); audio.sfx('eraFanfare');
      useGame.getState().newGame({ seed: daily ? date : seed.trim(), leaderId: leader.id, ascension: daily ? 0 : level, mapSize: daily ? 'standard' : mapSize, rivals: daily ? 3 : rivals, tutorial: !profile.settings.tutorialDone, daily, locked: lockedContent(profile) });
      if (daily) update((p) => ({ ...p, dailyAttempts: [...new Set([...(p.dailyAttempts ?? []), date])] }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Your world could not be created. Please try again.'); setStarting(false); }
  }
  return <MenuFrame eyebrow={daily ? 'The Daily Chronicle · One attempt' : 'The first page of history'} title="Choose your sovereign" subtitle="A different leader. An entirely different empire.">
    <div className="ae-newrun-layout" style={{ '--leader-color': leader.colors.primary } as CSSProperties}>
      <section className={`ae-leader-stage ${!unlocked ? 'is-locked' : ''}`} aria-label="Leader carousel" onTouchStart={(e) => { touchStart.current = e.touches[0].clientX; }} onTouchEnd={(e) => { if (touchStart.current !== null) { const delta = e.changedTouches[0].clientX - touchStart.current; if (Math.abs(delta) > 45) changeLeader(index + (delta < 0 ? 1 : -1)); } touchStart.current = null; }}>
        <div className="ae-leader-art" key={leader.id}><LeaderPortrait leader={leader} shape="card" className="ae-leader-portrait" /><div className="ae-leader-art-shade" /><span className="ae-leader-civ ae-eyebrow">{leader.civName}</span><div className="ae-leader-art-name"><span className="ae-eyebrow">{leader.title}</span><h2>{leader.name}</h2></div>{!unlocked && <div className="ae-leader-lock"><Icon name="lock" size={36} /><span>UNDISCOVERED SOVEREIGN</span></div>}</div>
        <div className="ae-carousel-controls"><button className="ae-icon-button" aria-label="Previous leader" onClick={() => changeLeader(index - 1)}><Icon name="chevronLeft" /></button><div className="ae-leader-dots">{leaders.map((entry, i) => <button key={entry.id} aria-label={`Choose ${entry.name}`} aria-pressed={i === index} onClick={() => changeLeader(i)}><span className={i === index ? 'active' : ''} /></button>)}</div><button className="ae-icon-button" aria-label="Next leader" onClick={() => changeLeader(index + 1)}><Icon name="chevronRight" /></button></div>
      </section>
      <section className="ae-leader-details">
        <p className="ae-leader-description">{leader.description}</p>
        <div className="ae-ability"><span className="ae-eyebrow"><Icon name="crown" size={16} />Sovereign’s gift</span><RichText text={leader.bonus} /></div>
        {!unlocked && <p className="ae-unlock-hint"><Icon name="lock" size={18} />{unlockHint('leader', leader.id) ?? leader.unlock?.text}</p>}
        <div className="ae-starting-kit">
          {leader.startDoctrine && <div className="ae-starting-card"><Card card={doctrineCard(leader.startDoctrine)} width="100%" /><span className="ae-eyebrow">Starting doctrine</span></div>}
          <div className="ae-unique-list">
            {leader.uniqueUnit && UNITS[leader.uniqueUnit] && <article><Icon name={UNITS[leader.uniqueUnit].icon} size={26} /><span className="ae-eyebrow">Unique unit</span><h3>{UNITS[leader.uniqueUnit].name}</h3><p><RichText text={UNITS[leader.uniqueUnit].description} /></p></article>}
            {leader.uniqueBuilding && BUILDINGS[leader.uniqueBuilding] && <article><Icon name={BUILDINGS[leader.uniqueBuilding].icon} size={26} /><span className="ae-eyebrow">Unique building</span><h3>{BUILDINGS[leader.uniqueBuilding].name}</h3><p><RichText text={BUILDINGS[leader.uniqueBuilding].description} /></p></article>}
          </div>
        </div>
      </section>
      <section className="ae-run-options">
        <div className="ae-option-heading"><Icon name="mountain" size={22} /><h3>Ascension</h3><span>{level === 0 ? 'The beginning' : `${level} / 8`}</span></div>
        <div className="ae-ascensions" aria-label="Ascension difficulty">{Array.from({ length: 9 }, (_, n) => <button key={n} disabled={daily ? n !== 0 : n > highest} className={level === n ? 'active' : ''} aria-pressed={level === n} aria-label={`Ascension ${n}${n > highest ? ', locked' : ''}`} onClick={() => setAscension(n)}>{n > highest ? <Icon name="lock" size={14} /> : n}</button>)}</div>
        <div className="ae-ascension-text"><strong>{level === 0 ? 'Write your first legend' : ASCENSIONS.find((a) => a.level === level)?.name}</strong><p><RichText text={level === 0 ? 'The original challenge. Three Mandate. A thousand possible empires.' : ASCENSIONS.find((a) => a.level === level)?.description ?? ''} /></p>{level > 1 && <small>All earlier Ascension challenges also apply.</small>}</div>
        <details className="ae-advanced"><summary>World settings <span>{daily ? 'Daily rules' : 'Advanced'}</span></summary><div className="ae-fields"><label>World size<select disabled={daily} value={mapSize} onChange={(e) => setMapSize(e.target.value as MapSize)}><option value="small">Small · 22 × 16</option><option value="standard">Standard · 28 × 20</option><option value="large">Large · 34 × 24</option></select></label><label>Rival empires<select disabled={daily} value={rivals} onChange={(e) => setRivals(Number(e.target.value))}>{[1, 2, 3].map((n) => <option key={n} value={n}>{n} {n === 1 ? 'rival' : 'rivals'}</option>)}</select></label></div></details>
        <label className="ae-seed-label">WORLD SEED<div className="ae-seed-field"><input aria-label="World seed" value={seed} readOnly={daily} maxLength={100} onChange={(e) => setSeed(e.target.value)} />{!daily && <button className="ae-icon-button" aria-label="Randomize seed" onClick={() => setSeed(randomSeed())}><Icon name="reroll" size={18} /></button>}<CopySeed seed={seed} /></div></label>
        <button className="ae-button ae-button-gold ae-begin" disabled={!unlocked || starting || !seed.trim()} onClick={begin}><Icon name={unlocked ? 'book' : 'lock'} />{starting ? 'A world awakens…' : unlocked ? 'Begin Chronicle' : 'Leader locked'}<Icon name="chevronRight" size={18} /></button>
        <p className="ae-small-print">{daily ? 'Shared seed · Standard world · Ascension 0' : profile.settings.tutorialDone ? 'Autosaved after every decision. Return anytime.' : 'Your chronicler will guide your first steps.'}</p>
        {error && <p role="alert" className="ae-error">{error}</p>}
      </section>
    </div>
  </MenuFrame>;
}
