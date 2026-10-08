// CardModel builders: turn content defs / run instances into the universal Card's view model.
// Missing defs (content still loading, removed ids) degrade to a readable title from the id.
import { CRISES, DOCTRINES, EDICTS, LEADERS } from '../../content';
import type { ArtKind } from '../art/artManifest';
import type { DoctrineInstance, Edition, GameState, PillarId, Rarity, ShopItem } from '../../sim/types';
import { PILLAR_HUE, PILLAR_MOTIF, pillarInfo } from './runUtil';
import { EDITION_NAMES, PACK_NAMES, T } from '../terms';
import { PACKS } from '../../sim/roguelite/constants';
import type { PackKind } from '../../sim/roguelite/constants';

export type CardKind = 'doctrine' | 'edict' | 'crisis' | 'pack' | 'pillar' | 'leader' | 'wonder' | 'unit' | 'tech';

export interface CardModel {
  kind: CardKind;
  id: string;
  title: string;
  /** rich text ({token} icons, **bold**) */
  description: string;
  flavor?: string;
  rarity?: Rarity;
  edition?: Edition;
  /** small caps line at the card foot, e.g. "Crew · Rare" */
  typeLabel: string;
  /** procedural art params; illustrated art is looked up by artKind+id */
  art?: { hue: number; motif: string };
  artKind?: ArtKind;
  icon?: string;
  /** live line for scaling Crew, e.g. "Currently ×2.5 {splendor}" */
  status?: string | null;
  price?: number;
  /** extra line under the description (reward, level change, sell value) */
  footer?: string;
  /** frame accent colour override (pillar colour, crisis red) */
  accent?: string;
}

const MOTIFS: Record<string, true> = Object.fromEntries([
  'sun', 'moon', 'star', 'river', 'wave', 'mountain', 'tree', 'wheat', 'coin', 'scroll', 'flask', 'lyre', 'laurel', 'crown', 'sword',
  'shield', 'tower', 'castle', 'anchor', 'ship', 'horse', 'flame', 'eye', 'key', 'hourglass', 'skull', 'compass', 'gear', 'bolt',
  'feather', 'hand', 'book', 'temple', 'pyramid', 'mask', 'chalice', 'serpent', 'owl', 'lion', 'eagle',
].map((m) => [m, true] as const));
export const RARITY_LABEL: Record<Rarity, string> = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', legendary: 'Legendary' };
export const EDITION_LABEL: Record<Edition, string> = EDITION_NAMES;
export const EDITION_TEXT: Record<Edition, string> = {
  base: '',
  gilded: '+50 {renown}',
  radiant: '+4 {splendor}',
  prismatic: '×1.5 {splendor}',
  ethereal: 'Uses no Slot',
};

function titleFromId(id: string): string {
  return id.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
function hashHue(id: string, base: number, range: number): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return (base + (Math.abs(h) % range) + 360) % 360;
}
function motifOr(candidate: string | undefined, fallback: string): string {
  return candidate && Object.hasOwn(MOTIFS, candidate) ? candidate : fallback;
}

export function doctrineCard(id: string, edition: Edition = 'base', inst?: DoctrineInstance, state?: GameState | null): CardModel {
  const def = DOCTRINES[id];
  let status: string | null = null;
  if (def?.status && inst && state) {
    try { status = def.status(inst.counters, state); } catch { status = null; }
  }
  const rarity = def?.rarity ?? 'common';
  const ed = EDITION_LABEL[edition];
  return {
    kind: 'doctrine',
    id,
    title: def?.name ?? titleFromId(id),
    description: def?.description ?? '',
    flavor: def?.flavor,
    rarity,
    edition,
    typeLabel: `${T.doctrine} · ${RARITY_LABEL[rarity]}`,
    art: def?.art ?? { hue: hashHue(id, 30, 300), motif: 'book' },
    artKind: 'doctrines',
    icon: def?.icon ?? 'doctrine',
    status,
    footer: edition !== 'base' ? `${ed}: ${EDITION_TEXT[edition]}` : undefined,
    price: undefined,
  };
}

export function edictCard(id: string): CardModel {
  const def = EDICTS[id];
  const rarity = def?.rarity ?? 'common';
  const targetText: Record<string, string> = {
    none: 'Use at once', city: 'Target: a Colony', ownedTile: 'Target: your tile', tile: 'Target: any tile', unit: 'Target: a unit',
  };
  return {
    kind: 'edict',
    id,
    title: def?.name ?? titleFromId(id),
    description: def?.description ?? '',
    rarity,
    typeLabel: `${T.edict} · ${RARITY_LABEL[rarity]}`,
    art: def?.art ?? { hue: hashHue(id, 180, 120), motif: 'scroll' },
    artKind: 'edicts',
    icon: def?.icon ?? 'edict',
    footer: def ? targetText[def.target] : undefined,
  };
}

export function crisisCard(id: string): CardModel {
  const def = CRISES[id];
  return {
    kind: 'crisis',
    id,
    title: def?.name ?? titleFromId(id),
    description: def?.description ?? '',
    flavor: def?.flavor,
    typeLabel: T.crisis,
    art: def?.art ?? { hue: 355, motif: 'skull' },
    artKind: 'crises',
    icon: def?.icon ?? 'crisis',
    accent: 'var(--splendor)',
    footer: def
      ? [def.targetMul && def.targetMul !== 1 ? `Target ×${def.targetMul}` : '', def.reward ? `Survive: +${def.reward} ${T.influence}` : ''].filter(Boolean).join(' · ') || undefined
      : undefined,
  };
}

const PACK_META: Record<PackKind, { title: string; noun: string; motif: string; hue: number; icon: string }> = {
  doctrine: { title: PACK_NAMES.doctrine, noun: 'Crew cards', motif: 'crown', hue: 40, icon: 'doctrine' },
  edict: { title: PACK_NAMES.edict, noun: T.edicts, motif: 'key', hue: 290, icon: 'edict' },
};
export function packCard(pack: PackKind, size: 'normal' | 'jumbo'): CardModel {
  const m = PACK_META[pack];
  const n = PACKS[pack][size].options;
  return {
    kind: 'pack',
    id: `${pack}-${size}`,
    title: `${size === 'jumbo' ? 'Big ' : ''}${m.title}`,
    description: `Open it, see **${n} ${m.noun}** and keep **1**.`,
    rarity: size === 'jumbo' ? 'rare' : 'uncommon',
    typeLabel: T.pack,
    art: { hue: m.hue, motif: m.motif },
    icon: m.icon,
    accent: size === 'jumbo' ? 'var(--r-legendary)' : 'var(--gold-500)',
  };
}

export interface PillarCardOpts { focused?: boolean; projected?: number; splendor?: number }
export function pillarCard(pillar: PillarId, level: number, opts: PillarCardOpts = {}): CardModel {
  const p = pillarInfo(pillar);
  return {
    kind: 'pillar',
    id: pillar,
    title: p.name,
    description: p.description,
    typeLabel: `${T.focus} pillar · Level ${level}`,
    art: { hue: PILLAR_HUE[pillar], motif: PILLAR_MOTIF[pillar] },
    icon: p.icon,
    accent: p.color,
    status: opts.projected != null ? `≈ ${Math.round(opts.projected * (opts.focused ? 2 : 1)).toLocaleString('en-US')} {renown}` : null,
    footer: opts.splendor != null ? `As ${T.focus}: ${opts.splendor} {splendor} · {renown} ×2` : undefined,
  };
}

export function leaderCard(id: string): CardModel {
  const def = LEADERS[id];
  return {
    kind: 'leader',
    id,
    title: def?.name ?? titleFromId(id),
    description: def?.bonus ?? '',
    flavor: def?.description,
    typeLabel: def ? `${def.title} · ${def.civName}` : T.leader,
    art: def ? { hue: def.portrait.hue, motif: motifOr(def.portrait.motif, 'crown') } : { hue: 40, motif: 'crown' },
    artKind: 'leaders',
    icon: 'crown',
    accent: def?.colors.primary,
    rarity: 'legendary',
  };
}

export function shopItemCard(item: ShopItem): CardModel {
  const card = item.kind === 'doctrine' ? doctrineCard(item.id, item.edition)
    : item.kind === 'edict' ? edictCard(item.id) : packCard(item.pack, item.size);
  return { ...card, price: item.price };
}

/** stable identity for a shop item (used as React key + FLIP key) */
export function shopItemKey(item: ShopItem): string {
  return item.kind === 'pack' ? `pack:${item.pack}:${item.size}` : `${item.kind}:${item.id}`;
}
