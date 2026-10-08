// Display helpers shared by HUD components: names, yield metadata, era/chapter labels.
import { BUILDINGS, PILLAR_DEFS, TECHS, UNITS, WONDERS } from '../../content';
import { CHAPTER_NAMES, CRISIS_CHAPTER, ERA_NAMES } from '../../sim/roguelite/constants';
import type { CityFocus, GameState, PillarId, PlayerId, ProductionItem, YieldKey } from '../../sim/types';
import { BARBARIAN } from '../../sim/types';
import { T, YIELD_NAMES } from '../terms';

export { CHAPTER_NAMES, CRISIS_CHAPTER, ERA_NAMES };
export const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

export function eraName(era: number): string {
  return ERA_NAMES[era] ?? `Endless ${ROMAN[era - ERA_NAMES.length] ?? era - ERA_NAMES.length + 1}`;
}

/** "Landfall · Dawn" */
export function chapterLabel(era: number, chapter: number): string {
  return `${eraName(era)} · ${CHAPTER_NAMES[chapter] ?? CHAPTER_NAMES[CRISIS_CHAPTER]}`;
}

export interface YieldMeta { key: YieldKey; icon: string; label: string; color: string }
export const YIELD_META: Record<YieldKey, YieldMeta> = {
  food: { key: 'food', icon: 'food', label: YIELD_NAMES.food, color: 'var(--y-food)' },
  prod: { key: 'prod', icon: 'prod', label: YIELD_NAMES.prod, color: 'var(--y-prod)' },
  gold: { key: 'gold', icon: 'gold', label: YIELD_NAMES.gold, color: 'var(--y-gold)' },
  sci: { key: 'sci', icon: 'sci', label: YIELD_NAMES.sci, color: 'var(--y-sci)' },
  cul: { key: 'cul', icon: 'cul', label: YIELD_NAMES.cul, color: 'var(--y-cul)' },
};

export const FOCUS_META: Record<CityFocus, { label: string; icon: string; color: string; hint: string }> = {
  balanced: { label: 'Balanced', icon: 'star', color: 'var(--gold-400)', hint: 'A good mix of everything' },
  food: { label: YIELD_NAMES.food, icon: 'food', color: 'var(--y-food)', hint: 'Grow faster' },
  prod: { label: YIELD_NAMES.prod, icon: 'prod', color: 'var(--y-prod)', hint: 'Build faster' },
  gold: { label: YIELD_NAMES.gold, icon: 'gold', color: 'var(--y-gold)', hint: 'Earn more Credits' },
  sci: { label: YIELD_NAMES.sci, icon: 'sci', color: 'var(--y-sci)', hint: 'Research faster' },
  cul: { label: YIELD_NAMES.cul, icon: 'cul', color: 'var(--y-cul)', hint: 'Grow your borders faster' },
};
export const FOCUS_ORDER: CityFocus[] = ['balanced', 'food', 'prod', 'gold', 'sci', 'cul'];

export const PROJECT_META: Record<'wealth' | 'research' | 'festival', { name: string; icon: string; text: string }> = {
  wealth: { name: YIELD_NAMES.gold, icon: 'gold', text: `Turn ${YIELD_NAMES.prod} into ${YIELD_NAMES.gold}.` },
  research: { name: T.tech, icon: 'sci', text: `Turn ${YIELD_NAMES.prod} into ${YIELD_NAMES.sci}.` },
  festival: { name: 'Festival', icon: 'renown', text: `Turn ${YIELD_NAMES.prod} into ${T.renown}.` },
};

export function itemName(item: ProductionItem): string {
  switch (item.kind) {
    case 'unit': return UNITS[item.id]?.name ?? item.id;
    case 'building': return BUILDINGS[item.id]?.name ?? item.id;
    case 'wonder': return WONDERS[item.id]?.name ?? item.id;
    case 'project': return PROJECT_META[item.id].name;
  }
}

export function itemIcon(item: ProductionItem): string {
  switch (item.kind) {
    case 'unit': return UNITS[item.id]?.icon ?? UNITS[item.id]?.class ?? 'melee';
    case 'building': return BUILDINGS[item.id]?.icon ?? item.id;
    case 'wonder': return WONDERS[item.id]?.icon ?? item.id;
    case 'project': return PROJECT_META[item.id].icon;
  }
}

export function sameItem(a: ProductionItem | null | undefined, b: ProductionItem | null | undefined): boolean {
  return !!a && !!b && a.kind === b.kind && a.id === b.id;
}

export function unitName(type: string): string {
  return UNITS[type]?.name ?? type;
}

export function techName(id: string): string {
  return TECHS[id]?.name ?? id;
}

export function pillarColor(p: PillarId): string {
  return PILLAR_DEFS[p]?.color ?? `var(--p-${p})`;
}

export function playerLabel(s: GameState, pid: PlayerId): string {
  if (pid === BARBARIAN) return T.barbarians;
  const p = s.players.find((pl) => pl.id === pid);
  return p ? p.civName : 'Unknown';
}

export function playerColor(s: GameState, pid: PlayerId): string {
  if (pid === BARBARIAN) return '#8b1e1e';
  return s.players.find((pl) => pl.id === pid)?.colors.primary ?? '#888';
}

/** "3 turns" / "1 turn" / "—" */
export function turnsLabel(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${n} ${n === 1 ? 'turn' : 'turns'}`;
}
