import { useEffect, useState } from 'react';
import { audio } from '../../audio';
import { getRenderer } from '../../game/bridge';
import { useGame } from '../../game/store';
import { loadProfile, resetProgress } from '../../meta/profile';
import type { Profile } from '../../meta/profile';
import { Icon } from '../icons/Icon';
import { T } from '../terms';
import { MenuFrame, useProfile } from './shared';

export function Settings() {
  const { profile, update } = useProfile();
  const [confirmation, setConfirmation] = useState(0);
  const [resetText, setResetText] = useState('');
  const [message, setMessage] = useState('');
  const settings = profile.settings;
  useEffect(() => {
    if (!confirmation) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('.ae-confirm');
    dialog?.querySelector<HTMLElement>('input,button')?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setConfirmation(0); setResetText(''); }
      if (event.key !== 'Tab' || !dialog) return;
      const controls = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)')];
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); previous?.focus(); };
  }, [confirmation]);
  function change<K extends keyof Profile['settings']>(key: K, value: Profile['settings'][K]) {
    update((p) => ({ ...p, settings: { ...p.settings, [key]: value } }));
    if (key === 'master' || key === 'music' || key === 'sfx') { audio.init(); audio.setVolumes({ [key]: value }); }
    if (key === 'quality') getRenderer()?.setQuality(value as 'low' | 'high');
    if (key === 'haptics' && value && navigator.vibrate) navigator.vibrate(18);
  }
  function replay() {
    update((p) => ({ ...p, tutorialProgress: [], settings: { ...p.settings, tutorialDone: false } }));
    const state = useGame.getState().state;
    setMessage(state && !state.gameOver ? 'Done. The guide comes back when you go back to your run.' : 'Done. The guide will help you in your next run.');
  }
  async function reset() {
    if (resetText !== 'RESET') return;
    try {
      await useGame.getState().abandonRun();
      resetProgress(loadProfile());
      useGame.getState().setScreen('menu');
    } catch { setMessage('Progress could not be reset. Please try again.'); setConfirmation(0); }
  }
  const back = () => useGame.getState().setScreen(useGame.getState().state && !useGame.getState().state?.gameOver ? 'game' : 'menu');
  return <MenuFrame eyebrow="Options" title="Settings" back={back}>
    <div className="ae-settings-layout"><section className="ae-settings-panel"><h2><Icon name="settings" size={23} />Sound</h2>{(['master', 'music', 'sfx'] as const).map((key) => <label className="ae-volume" key={key}><span>{key === 'master' ? 'Main volume' : key === 'music' ? 'Music' : 'Sound effects'}<output>{Math.round(settings[key] * 100)}%</output></span><input aria-label={`${key === 'master' ? 'Main' : key === 'music' ? 'Music' : 'Sound effects'} volume`} type="range" min="0" max="1" step="0.01" value={settings[key]} onChange={(e) => change(key, Number(e.target.value))} onPointerUp={() => { if (key !== 'music') audio.sfx('click'); }} /></label>)}<p className="ae-setting-note">The music changes as your run goes on.</p></section>
      <section className="ae-settings-panel"><h2><Icon name="map" size={23} />Display</h2><div className="ae-setting-row"><div><strong>Graphics</strong><p>High looks better. Battery saver uses less power.</p></div><select aria-label="Graphics" value={settings.quality} onChange={(e) => change('quality', e.target.value as 'low' | 'high')}><option value="high">High</option><option value="low">Battery saver</option></select></div>{([{ key: 'haptics', title: 'Vibration', detail: 'Short vibrations on phones that support it.' }, { key: 'fastAnimations', title: 'Fast animations', detail: 'Shorter animations between chapters.' }] as const).map(({ key, title, detail }) => <div className="ae-setting-row" key={key}><div><strong>{title}</strong><p>{detail}</p></div><button role="switch" aria-checked={settings[key]} aria-label={title} className={`ae-switch ${settings[key] ? 'on' : ''}`} onClick={() => change(key, !settings[key])}><span /></button></div>)}</section>
      <section className="ae-settings-panel"><h2><Icon name="book" size={23} />Guide</h2><div className="ae-setting-row"><div><strong>Show the guide again</strong><p>Short tips that teach you the game. You can skip them.</p></div><button className="ae-button ae-button-small" onClick={replay}>Show again</button></div><p className="ae-setting-note">The game saves after every move. You can leave at any time.</p>{message && <p role="status" className="ae-status">{message}</p>}</section>
      <section className="ae-settings-panel ae-danger-panel"><h2><Icon name="hourglass" size={23} />Progress</h2><div className="ae-setting-row"><div><strong>Reset all progress</strong><p>Delete unlocks, records and your current run. Sound and display settings stay.</p></div><button className="ae-button ae-button-danger" onClick={() => setConfirmation(1)}>Reset</button></div></section></div>
    {confirmation > 0 && <div className="ae-confirm-backdrop"><section role="alertdialog" aria-modal="true" aria-labelledby="reset-title" className="ae-confirm"><Icon name="skull" size={40} /><h2 id="reset-title">{confirmation === 1 ? 'Delete all progress?' : 'You cannot undo this'}</h2><p>{confirmation === 1 ? `You will lose all unlocked nations, records, best ${T.score} and your current run.` : 'Type RESET to delete your RED EXODUS progress on this device.'}</p>{confirmation === 2 && <input aria-label="Type RESET to confirm" autoFocus autoComplete="off" value={resetText} onChange={(e) => setResetText(e.target.value)} placeholder="RESET" />}<div className="ae-confirm-actions"><button className="ae-button" autoFocus={confirmation === 1} onClick={() => { setConfirmation(0); setResetText(''); }}>Keep my progress</button><button className="ae-button ae-button-danger" disabled={confirmation === 2 && resetText !== 'RESET'} onClick={() => confirmation === 1 ? setConfirmation(2) : void reset()}>{confirmation === 1 ? 'Continue' : 'Delete'}</button></div></section></div>}
  </MenuFrame>;
}
