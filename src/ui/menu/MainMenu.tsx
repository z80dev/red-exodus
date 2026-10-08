import { useEffect, useState } from 'react';
import packageMetadata from '../../../package.json?raw';
import { LEADERS } from '../../content';
import { audio } from '../../audio';
import { loadRun } from '../../game/save';
import { useGame } from '../../game/store';
import type { GameState } from '../../sim/types';
import { TITLE, SUBTITLE } from '../terms';
import { Logo } from '../art/Logo';
import { artFor } from '../art/artManifest';
import { Icon } from '../icons/Icon';
import { chapterLabel } from '../hud/format';
import { dailyDate, number, openNewRun, useProfile } from './shared';

const APP_VERSION: string = JSON.parse(packageMetadata).version;

export function MainMenu() {
  const [saved, setSaved] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { profile } = useProfile();
  const today = dailyDate();
  const attempted = profile.dailyAttempts?.includes(today) || Object.hasOwn(profile.dailies, today);
  useEffect(() => {
    audio.setMood('menu');
    audio.setVolumes(profile.settings);
    let mounted = true;
    void loadRun().then((run) => { if (mounted) setSaved(run?.gameOver ? null : run); }).catch(() => { if (mounted) setError('Your saved game could not be read. Please try again.'); }).finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [profile.settings]);
  async function resume() {
    audio.init(); audio.sfx('open');
    try { if (!await useGame.getState().continueGame()) { setSaved(null); setError('No saved game found. Start a new run.'); } }
    catch { setError('Could not load your saved game. Your save is safe.'); }
  }
  const keyArt = artFor('key', 'menu');
  return <main className="ae-menu ae-main-menu">
    {keyArt && <div className="ae-menu-keyart" style={{ backgroundImage: `url(${keyArt})` }} />}
    <div className="ae-main-vignette" />
    <div className="ae-main-top"><span className="ae-eyebrow">EARTH WENT DARK</span><span className="ae-edition">A MARS COLONY GAME</span></div>
    <section className="ae-main-content">
      <div className="ae-brand"><Logo className="ae-logo" /><div className="ae-gold-rule"><span />✦<span /></div><p>{SUBTITLE}<br /><em>Build colonies. Beat the target. Survive Mars.</em></p></div>
      <nav className="ae-main-nav" aria-label="Main menu">
        {saved && <button className="ae-menu-choice ae-continue" onClick={() => void resume()}><Icon name="hourglass" size={25} /><span><strong>Continue</strong><small>{LEADERS[saved.config.leaderId]?.country ?? saved.players[0]?.name} · {chapterLabel(saved.run.era, saved.run.chapter)} · Turn {saved.turn}</small></span><Icon name="chevronRight" /></button>}
        <button className={`ae-menu-choice ${!saved ? 'ae-continue' : ''}`} onClick={() => { audio.init(); openNewRun(); }}><Icon name="crown" size={26} /><span><strong>New run</strong><small>Pick a nation and land on Mars.</small></span><Icon name="chevronRight" /></button>
        <button className="ae-menu-choice ae-daily" disabled={!!attempted} onClick={() => openNewRun(true)}><Icon name="calendar" size={25} /><span><strong>Today’s run <span className="ae-badge">DAILY</span></strong><small>{attempted ? `Played today · Best ${number(profile.dailies[today] ?? 0)}` : `${today} · Same map for everyone. One try.`}</small></span><Icon name={attempted ? 'check' : 'chevronRight'} /></button>
        <div className="ae-main-links"><button onClick={() => useGame.getState().setScreen('codex')}><Icon name="book" size={20} />Codex</button><span /><button onClick={() => useGame.getState().setScreen('settings')}><Icon name="settings" size={20} />Settings</button><span /><button onClick={() => useGame.getState().setScreen('summary')}><Icon name="journal" size={20} />Results</button></div>
        {loading && <p className="ae-status" role="status">Looking for a saved game…</p>}
        {error && <p className="ae-error" role="alert">{error}</p>}
      </nav>
    </section>
    <footer className="ae-main-footer"><span>THE OLD WORLD IS GONE</span><span>{profile.stats.wins > 0 ? `${number(profile.stats.wins)} ${profile.stats.wins === 1 ? 'run' : 'runs'} won` : 'Land. Grow. Survive.'}</span><span>{TITLE} · {APP_VERSION}</span></footer>
  </main>;
}
