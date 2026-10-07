import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { audio } from '../../audio';
import { useGame } from '../../game/store';
import { loadProfile, saveProfile } from '../../meta/profile';
import type { Profile } from '../../meta/profile';
import { Icon } from '../icons/Icon';
import './menu.css';

export const ERA_NAMES = ['Landfall', 'Foothold', 'Frontier', 'Industry', 'Terraform', 'New Earth'];
export const chapterName = (chapter: number) => ['Dawn', 'Dusk', 'Crisis'][chapter] ?? String(chapter + 1);
export const dailyDate = () => new Date().toISOString().slice(0, 10);
export const number = (n: number) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
let dailyLaunch = false;
export function openNewRun(daily = false) {
  dailyLaunch = daily;
  audio.sfx('open');
  useGame.getState().setScreen('newRun');
}
export function isDailyLaunch() { return dailyLaunch; }
export function useProfile() {
  const [profile, setProfile] = useState(loadProfile);
  const update = (change: (current: Profile) => Profile) => {
    const next = change(loadProfile());
    saveProfile(next);
    setProfile(next);
    return next;
  };
  return { profile, update };
}
export function MenuFrame({ eyebrow, title, subtitle, children, actions, back }: { eyebrow: string; title: string; subtitle?: string; children: ReactNode; actions?: ReactNode; back?: () => void }) {
  useEffect(() => { audio.setMood('menu'); }, []);
  return <main className="ae-menu ae-menu-frame">
    <header className="ae-menu-header">
      <button className="ae-icon-button" aria-label="Back" onClick={back ?? (() => { audio.sfx('close'); useGame.getState().setScreen('menu'); })}><Icon name="back" /></button>
      <div><span className="ae-eyebrow">{eyebrow}</span><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
      {actions && <div className="ae-header-actions">{actions}</div>}
    </header>
    <div className="ae-menu-body">{children}</div>
  </main>;
}
export function CopySeed({ seed, share = false }: { seed: string; share?: boolean }) {
  const [status, setStatus] = useState('');
  useEffect(() => { setStatus(''); }, [seed]);
  async function copy() {
    try {
      const nativeShare = share && typeof navigator.share === 'function';
      if (nativeShare) await navigator.share({ title: 'RED EXODUS — My Landfall', text: `Fifty-one Arks. One red world. Play my RED EXODUS seed: ${seed}` });
      else await navigator.clipboard.writeText(seed);
      setStatus(nativeShare ? 'Shared' : 'Copied');
    } catch { setStatus('Select the seed to copy'); }
  }
  return <button className="ae-button ae-button-small" onClick={() => void copy()} aria-label={share ? 'Share seed' : 'Copy seed'}><Icon name={share ? 'map' : 'seed'} size={16} />{status || (share ? 'Share' : 'Copy')}</button>;
}
