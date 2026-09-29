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
import { chapterName, dailyDate, ERA_NAMES, number, openNewRun, useProfile } from './shared';

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
    void loadRun().then((run) => { if (mounted) setSaved(run?.gameOver ? null : run); }).catch(() => { if (mounted) setError('Your saved chronicle could not be read. Please try again.'); }).finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [profile.settings]);
  async function resume() {
    audio.init(); audio.sfx('open');
    try { if (!await useGame.getState().continueGame()) { setSaved(null); setError('No saved chronicle was found. Begin a new story.'); } }
    catch { setError('Unable to restore your chronicle. Your save has not been changed.'); }
  }
  const keyArt = artFor('key', 'menu');
  return <main className="ae-menu ae-main-menu">
    {keyArt && <div className="ae-menu-keyart" style={{ backgroundImage: `url(${keyArt})` }} />}
    <div className="ae-main-vignette" />
    <div className="ae-main-top"><span className="ae-eyebrow">EARTH WENT DARK ON A TUESDAY</span><span className="ae-edition">A COLONY ROGUELIKE</span></div>
    <section className="ae-main-content">
      <div className="ae-brand"><Logo className="ae-logo" /><div className="ae-gold-rule"><span />✦<span /></div><p>{SUBTITLE}<br /><em>Earth went dark on a Tuesday. Mars sent the bill.</em></p></div>
      <nav className="ae-main-nav" aria-label="Main menu">
        {saved && <button className="ae-menu-choice ae-continue" onClick={() => void resume()}><Icon name="hourglass" size={25} /><span><strong>Continue the Exodus</strong><small>{LEADERS[saved.config.leaderId]?.country ?? saved.players[0]?.name} · {ERA_NAMES[saved.run.era] ?? 'Beyond'}<br />{chapterName(saved.run.chapter)} · Sol {saved.turn}</small></span><Icon name="chevronRight" /></button>}
        <button className={`ae-menu-choice ${!saved ? 'ae-continue' : ''}`} onClick={() => { audio.init(); openNewRun(); }}><Icon name="crown" size={26} /><span><strong>Choose your Ark</strong><small>Pick a nation. Spend the last of Earth.</small></span><Icon name="chevronRight" /></button>
        <button className="ae-menu-choice ae-daily" disabled={!!attempted} onClick={() => openNewRun(true)}><Icon name="calendar" size={25} /><span><strong>Daily Landfall <span className="ae-badge">DAILY</span></strong><small>{attempted ? `Attempt recorded · Best ${number(profile.dailies[today] ?? 0)}` : `${today} · One world. One attempt.`}</small></span><Icon name={attempted ? 'check' : 'chevronRight'} /></button>
        <div className="ae-main-links"><button onClick={() => useGame.getState().setScreen('codex')}><Icon name="book" size={20} />Codex</button><span /><button onClick={() => useGame.getState().setScreen('settings')}><Icon name="settings" size={20} />Settings</button><span /><button onClick={() => useGame.getState().setScreen('summary')}><Icon name="journal" size={20} />Sol Report</button></div>
        {loading && <p className="ae-status" role="status">Checking the Ark logs…</p>}
        {error && <p className="ae-error" role="alert">{error}</p>}
      </nav>
    </section>
    <footer className="ae-main-footer"><span>THE OLD WORLD IS GONE</span><span>{profile.stats.wins > 0 ? `${number(profile.stats.wins)} colonies survived` : 'Land. Adapt. Outlast Mars.'}</span><span>{TITLE} · {APP_VERSION}</span></footer>
  </main>;
}
