// Roguelite tunables. Balance lives here; the lead retunes with `bun scripts/sim.ts`.
import type { Edition, PillarId, Rarity } from '../types';

export const ERA_NAMES = ['Landfall', 'Foothold', 'Frontier', 'Industry', 'Terraform', 'New Earth'] as const;
export const CHAPTER_NAMES = ['Dawn', 'Dusk', 'Crisis'] as const;
/** last scripted era; passing its Crisis chapter wins the run */
export const FINAL_ERA = 5;
export const CHAPTERS_PER_ERA = 3;
export const CRISIS_CHAPTER = 2;
/** turns per chapter I / II / III (≈78-turn runs) */
export const CHAPTER_LENGTHS = [4, 4, 5] as const;

// ── run start ──
export const START_MANDATE = 5;
export const START_INFLUENCE = 4;
export const START_FOCUS: PillarId = 'prosperity';
export const START_DOCTRINE_SLOTS = 5;
export const START_EDICT_SLOTS = 2;

// ── chronicle targets ──
/** first retune for 13-turn eras (was 20): ×0.65 of the 20-turn table; final balance via `bun scripts/sim.ts` */
export const ERA_TARGETS = [500, 2600, 8500, 21000, 45000, 100000] as const;
export const CHAPTER_TARGET_MUL = [1, 1.1, 2.7] as const;
/** The terminal Crisis is a slightly gentler check than recurring Crisis chapters. */
export const FINAL_CRISIS_TARGET_MUL = 2.2;
/** each endless era multiplies the previous era's base target */
export const ENDLESS_ERA_MUL = 3;

// ── chronicle scoring ──
export const FOCUS_RENOWN_MUL = 2;
export const CITY_RENOWN_PER_POP = 4;
export const CITY_RENOWN_PER_WONDER = 10;
export const TRIUMPH_RATIO = 2;
/** Gilded: +renown = base + perEra × era */
export const GILDED_RENOWN_BASE = 50;
export const GILDED_RENOWN_PER_ERA = 50;
export const RADIANT_SPLENDOR = 4;
export const PRISMATIC_SPLENDOR_MUL = 1.5;

// ── mandate ──
export const MANDATE_LOSS_FAIL = 1;
export const MANDATE_LOSS_CRISIS_FAIL = 2;

// ── influence income ──
export const INCOME_BASE = 3;
export const INCOME_CHAPTER_BONUS = [1, 2, 3] as const;
export const INTEREST_PER = 5;
export const INTEREST_CAP = 5;
export const TRIUMPH_INFLUENCE = 3;

// ── council ──
export const SHOP_DOCTRINE_SLOTS = 2;
export const SHOP_PACK_SLOTS = 2;
export const RARITY_WEIGHTS_SHOP: Record<Rarity, number> = { common: 55, uncommon: 35, rare: 10, legendary: 0 };
export const RARITY_WEIGHTS_PACK: Record<Rarity, number> = { common: 55, uncommon: 30, rare: 10, legendary: 3 };
/** edition roll probabilities (remainder = base) */
export const EDITION_CHANCE: Record<Exclude<Edition, 'base'>, number> = { gilded: 0.04, radiant: 0.025, prismatic: 0.01, ethereal: 0.005 };
export const DOCTRINE_PRICE: Record<Rarity, number> = { common: 4, uncommon: 6, rare: 8, legendary: 12 };
export const EDITION_PRICE: Record<Edition, number> = { base: 0, gilded: 2, radiant: 3, prismatic: 5, ethereal: 5 };
/** fallback price for edicts/scrolls whose def.cost is missing */
export const EDICT_PRICE_BY_RARITY: Record<Rarity, number> = { common: 3, uncommon: 4, rare: 5, legendary: 6 };
export const SCROLL_PRICE = 3;
export const REROLL_BASE = 2;
export const REROLL_STEP = 1;
/** chance the edict/scroll shop slot holds an edict (else a scroll) */
export const EDICT_SLOT_EDICT_CHANCE = 0.5;
export const PACKS = {
  doctrine: { normal: { price: 4, options: 3, picks: 1 }, jumbo: { price: 6, options: 5, picks: 1 } },
  archive: { normal: { price: 4, options: 3, picks: 1 }, jumbo: { price: 6, options: 5, picks: 1 } },
  edict: { normal: { price: 4, options: 3, picks: 1 }, jumbo: { price: 6, options: 5, picks: 1 } },
} as const;
/** pack roll weights for the two pack slots */
export const PACK_WEIGHTS: { pack: 'doctrine' | 'archive' | 'edict'; size: 'normal' | 'jumbo'; weight: number }[] = [
  { pack: 'doctrine', size: 'normal', weight: 40 },
  { pack: 'doctrine', size: 'jumbo', weight: 12 },
  { pack: 'archive', size: 'normal', weight: 28 },
  { pack: 'edict', size: 'normal', weight: 20 },
];

// ── omens ──
export const OMEN_OFFERS = 2;
/** omens offered within the last N offers are avoided when possible */
export const OMEN_RECENT_WINDOW = 4;
