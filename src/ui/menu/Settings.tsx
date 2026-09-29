import { useEffect, useState } from 'react';
import { audio } from '../../audio';
import { getRenderer } from '../../game/bridge';
import { useGame } from '../../game/store';
import { loadProfile, resetProgress } from '../../meta/profile';
import type { Profile } from '../../meta/profile';
import { Icon } from '../icons/Icon';
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
    setMessage(state && !state.gameOver ? 'Guidance has been reset. It will return when you resume your run.' : 'Your flight recorder will guide your next landing.');
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
  return <MenuFrame eyebrow="Systems check" title="Settings" subtitle="Tune the Ark before the next Sol." back={back}>
    <div className="ae-settings-layout"><section className="ae-settings-panel"><h2><Icon name="settings" size={23} />Sound & atmosphere</h2>{(['master', 'music', 'sfx'] as const).map((key) => <label className="ae-volume" key={key}><span>{key === 'master' ? 'Master volume' : key === 'music' ? 'Music' : 'Sound effects'}<output>{Math.round(settings[key] * 100)}%</output></span><input aria-label={`${key} volume`} type="range" min="0" max="1" step="0.01" value={settings[key]} onChange={(e) => change(key, Number(e.target.value))} onPointerUp={() => { if (key !== 'music') audio.sfx('click'); }} /></label>)}<p className="ae-setting-note">An evolving score follows the rise and fall of your civilization.</p></section>
      <section className="ae-settings-panel"><h2><Icon name="map" size={23} />Presentation</h2><div className="ae-setting-row"><div><strong>Graphics quality</strong><p>High adds richer light and shadows.</p></div><select aria-label="Graphics quality" value={settings.quality} onChange={(e) => change('quality', e.target.value as 'low' | 'high')}><option value="high">High</option><option value="low">Battery saver</option></select></div>{([{ key: 'haptics', title: 'Haptic feedback', detail: 'Feel each decision on supported devices.' }, { key: 'fastAnimations', title: 'Fast animations', detail: 'Quicker ceremonies, the same grandeur.' }] as const).map(({ key, title, detail }) => <div className="ae-setting-row" key={key}><div><strong>{title}</strong><p>{detail}</p></div><button role="switch" aria-checked={settings[key]} aria-label={title} className={`ae-switch ${settings[key] ? 'on' : ''}`} onClick={() => change(key, !settings[key])}><span /></button></div>)}</section>
      <section className="ae-settings-panel"><h2><Icon name="book" size={23} />Flight recorder</h2><div className="ae-setting-row"><div><strong>Replay the tutorial</strong><p>Bring back contextual, skippable Mars-survival guidance.</p></div><button className="ae-button ae-button-small" onClick={replay}>Replay</button></div><p className="ae-setting-note">Your colony autosaves after every decision. Leave the surface whenever you need.</p>{message && <p role="status" className="ae-status">{message}</p>}</section>
      <section className="ae-settings-panel ae-danger-panel"><h2><Icon name="hourglass" size={23} />The archives</h2><div className="ae-setting-row"><div><strong>Reset all progress</strong><p>Erase discoveries, unlocks, records and the current run. Sound and display preferences are kept.</p></div><button className="ae-button ae-button-danger" onClick={() => setConfirmation(1)}>Reset</button></div></section></div>
    {confirmation > 0 && <div className="ae-confirm-backdrop"><section role="alertdialog" aria-modal="true" aria-labelledby="reset-title" className="ae-confirm"><Icon name="skull" size={40} /><h2 id="reset-title">{confirmation === 1 ? 'Erase your history?' : 'This cannot be undone'}</h2><p>{confirmation === 1 ? 'All nation unlocks, discoveries, best Viability scores and the current run will be lost.' : 'Type RESET to permanently erase your RED EXODUS progress on this device.'}</p>{confirmation === 2 && <input aria-label="Type RESET to confirm" autoFocus autoComplete="off" value={resetText} onChange={(e) => setResetText(e.target.value)} placeholder="RESET" />}<div className="ae-confirm-actions"><button className="ae-button" autoFocus={confirmation === 1} onClick={() => { setConfirmation(0); setResetText(''); }}>Keep my history</button><button className="ae-button ae-button-danger" disabled={confirmation === 2 && resetText !== 'RESET'} onClick={() => confirmation === 1 ? setConfirmation(2) : void reset()}>{confirmation === 1 ? 'Continue' : 'Erase permanently'}</button></div></section></div>}
  </MenuFrame>;
}
