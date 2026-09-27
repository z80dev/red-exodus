// Shared helpers for the run-layer UI (names, number formatting, pillar meta, settings, safe audio, dispatch).
import { audio } from '../../audio';
import type { SfxName } from '../../audio';
import { useGame } from '../../game/store';
import { loadProfile } from '../../meta/profile';
import { PILLAR_DEFS } from '../../content';
import type { Action, ActionResult, PillarId } from '../../sim/types';
import { toast } from '../hud/toast';

export const ERA_NAMES = ['Ancient', 'Classical', 'Medieval', 'Renaissance', 'Industrial', 'Modern'] as const;
export const ERA_TAGLINES = [
  'Fire, stone and the first words carved in clay.',
  'Philosophers argue in the agora while legions march.',
  'Castles rise, faith and steel shape the realm.',
  'Sails unfurl toward unknown shores; genius is reborn.',
  'Steam and iron remake the world in a single lifetime.',
  'The age of wonders and of terrible power.',
];
export const CHAPTER_NAMES = ['The Rise', 'The Trial', 'The Crisis'] as const;

export function roman(n: number): string {
  const table: [number, string][] = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  let v = Math.max(1, Math.floor(n));
  for (const [k, s] of table) while (v >= k) { out += s; v -= k; }
  return out;
}

export function eraName(era: number): string {
  return era < ERA_NAMES.length ? ERA_NAMES[era] : `Endless Age ${roman(era - ERA_NAMES.length + 1)}`;
}
export function eraTitle(era: number): string {
  return era < ERA_NAMES.length ? `The ${ERA_NAMES[era]} Era` : eraName(era);
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
  arts: { name: 'Arts', icon: 'arts', color: 'var(--p-arts)', description: 'Culture generated.' },
  discovery: { name: 'Discovery', icon: 'discovery', color: 'var(--p-discovery)', description: 'Science generated and techs completed.' },
  commerce: { name: 'Commerce', icon: 'commerce', color: 'var(--p-commerce)', description: 'Gold earned and trade.' },
  conquest: { name: 'Conquest', icon: 'conquest', color: 'var(--p-conquest)', description: 'Kills, cities captured, camps cleared.' },
  prosperity: { name: 'Prosperity', icon: 'prosperity', color: 'var(--p-prosperity)', description: 'Population, cities founded, improvements.' },
  glory: { name: 'Glory', icon: 'glory', color: 'var(--p-glory)', description: 'Buildings, wonders, natural wonders.' },
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
