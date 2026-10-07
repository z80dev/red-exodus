// Shared helpers for the run-layer UI (names, number formatting, pillar meta, settings, safe audio, dispatch).
import { audio } from '../../audio';
import type { SfxName } from '../../audio';
import { useGame } from '../../game/store';
import { loadProfile } from '../../meta/profile';
import { PILLAR_DEFS } from '../../content';
import type { Action, ActionResult, PillarId } from '../../sim/types';
import { toast } from '../hud/toast';
import { PILLAR_NAMES } from '../terms';

export const ERA_NAMES = ['Landfall', 'Foothold', 'Frontier', 'Industry', 'Terraform', 'New Earth'] as const;
export const ERA_TAGLINES = [
  'One red world. Fifty Arks. No plan survives touchdown.',
  'The first domes hold. The first arguments start.',
  'Mars is no longer empty. It has noticed you.',
  'The machines work. The machines also have opinions.',
  'We are teaching a dead planet to breathe. It is taking notes.',
  'Earth is gone. Home is a verb now.',
];
export const CHAPTER_NAMES = ['Dawn', 'Dusk', 'Crisis'] as const;

export function roman(n: number): string {
  const table: [number, string][] = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  let v = Math.max(1, Math.floor(n));
  for (const [k, s] of table) while (v >= k) { out += s; v -= k; }
  return out;
}

export function eraName(era: number): string {
  return era < ERA_NAMES.length ? ERA_NAMES[era] : `Beyond ${roman(era - ERA_NAMES.length + 1)}`;
}
export function eraTitle(era: number): string {
  return eraName(era);
}
export function eraTagline(era: number): string {
  return ERA_TAGLINES[Math.min(era, ERA_TAGLINES.length - 1)] ?? '';
}
export function chapterName(chapter: number): string {
  return CHAPTER_NAMES[Math.max(0, Math.min(2, chapter))];
}
export function chapterTitle(chapter: number): string {
  return `Chapter ${roman(chapter + 1)} · ${chapterName(chapter)}`;
}
/** chapter that follows (era, chapter) */
export function nextChapter(era: number, chapter: number): { era: number; chapter: number } {
  return chapter >= 2 ? { era: era + 1, chapter: 0 } : { era, chapter: chapter + 1 };
}

// ───────────── numbers ─────────────
const intFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const decFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
/** thousands-separated integer; compacts from 10M (endless scores get huge) */
export function fmt(n: number): string {
  if (!Number.isFinite(n)) return '∞';
  const a = Math.abs(n);
  if (a >= 1e13) return n.toExponential(2).replace('e+', 'e');
  if (a >= 1e10) return `${decFmt.format(n / 1e9)}B`;
  if (a >= 1e7) return `${decFmt.format(n / 1e6)}M`;
  return intFmt.format(Math.round(n));
}
/** splendor may be fractional after ×1.5 multipliers */
export function fmtSplendor(n: number): string {
  if (Math.abs(n) >= 1000) return fmt(n);
  return Math.abs(n - Math.round(n)) < 0.05 ? intFmt.format(Math.round(n)) : decFmt.format(n);
}
export function fmtMul(x: number): string {
  const s = Math.abs(x - Math.round(x)) < 0.005 ? String(Math.round(x)) : String(Math.round(x * 100) / 100);
  return `×${s}`;
}
export function signed(n: number, f: (n: number) => string = fmt): string {
  return `${n >= 0 ? '+' : '−'}${f(Math.abs(n))}`;
}

// ───────────── pillars ─────────────
export interface PillarInfo { id: PillarId; name: string; icon: string; color: string; description: string }
const PILLAR_FALLBACK: Record<PillarId, Omit<PillarInfo, 'id'>> = {
  arts: { name: PILLAR_NAMES.arts, icon: 'arts', color: 'var(--p-arts)', description: 'Heritage Output from Morale and memory.' },
  discovery: { name: PILLAR_NAMES.discovery, icon: 'discovery', color: 'var(--p-discovery)', description: 'Research Data and Breakthroughs.' },
  commerce: { name: PILLAR_NAMES.commerce, icon: 'commerce', color: 'var(--p-commerce)', description: 'Credits earned and trade.' },
  conquest: { name: PILLAR_NAMES.conquest, icon: 'conquest', color: 'var(--p-conquest)', description: 'Feral dens cleared, rivals challenged.' },
  prosperity: { name: PILLAR_NAMES.prosperity, icon: 'prosperity', color: 'var(--p-prosperity)', description: 'Colony population, founding, installations.' },
  glory: { name: PILLAR_NAMES.glory, icon: 'glory', color: 'var(--p-glory)', description: 'Buildings, megaprojects and landmarks.' },
};
export const PILLAR_MOTIF: Record<PillarId, string> = {
  arts: 'lyre', discovery: 'flask', commerce: 'coin', conquest: 'sword', prosperity: 'wheat', glory: 'laurel',
};
export const PILLAR_HUE: Record<PillarId, number> = {
  arts: 280, discovery: 205, commerce: 45, conquest: 5, prosperity: 100, glory: 32,
};
export function pillarInfo(id: PillarId): PillarInfo {
  const def = PILLAR_DEFS[id];
  const fb = PILLAR_FALLBACK[id] ?? { name: id, icon: id, color: 'var(--gold-400)', description: '' };
  return {
    id,
    name: def?.name ?? fb.name,
    icon: def?.icon ?? fb.icon,
    // theme tokens win so every surface uses the same pillar palette
    color: PILLAR_FALLBACK[id] ? fb.color : def?.color ?? fb.color,
    description: def?.description ?? fb.description,
  };
}

// ───────────── settings / audio / haptics ─────────────
export interface UiSettings { fastAnimations: boolean; haptics: boolean }
export function uiSettings(): UiSettings {
  try {
    const p = loadProfile();
    return { fastAnimations: !!p.settings.fastAnimations, haptics: p.settings.haptics !== false };
  } catch {
    return { fastAnimations: false, haptics: true };
  }
}
export function sfx(name: SfxName, opts?: { pitch?: number; volume?: number }): void {
  try { audio.sfx(name, opts); } catch { /* audio not ready — silent */ }
}
export function haptic(pattern: number | number[]): void {
  // browsers reject (and log) vibrate before the first user gesture
  if (!uiSettings().haptics || !navigator.userActivation?.hasBeenActive) return;
  try { navigator.vibrate?.(pattern); } catch { /* unsupported */ }
}
export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** dispatch with error toast + error sfx */
export function act(action: Action): ActionResult {
  const res = useGame.getState().dispatch(action);
  if (!res.ok) {
    sfx('error');
    haptic(30);
    toast(res.error ?? 'Not possible right now', 'bad');
  }
  return res;
}

export function isPortrait(): boolean {
  return typeof window !== 'undefined' && window.innerHeight >= window.innerWidth;
}
