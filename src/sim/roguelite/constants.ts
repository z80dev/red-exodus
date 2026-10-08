// Roguelite tunables. Balance lives here; the lead retunes with `bun scripts/sim.ts`.
import type { Edition, PillarId, Rarity } from '../types';

export const ERA_NAMES = ['Landfall', 'Foothold', 'Frontier', 'Expansion', 'Terraform', 'New Earth'] as const;
export const CHAPTER_NAMES = ['Dawn', 'Crisis'] as const;
/** last scripted era; passing its Crisis chapter wins the run */
export const FINAL_ERA = 5;
export const CHAPTERS_PER_ERA = 2;
export const CRISIS_CHAPTER = 1;
/** turns per chapter: Dawn / Crisis (≈54-turn runs) */
export const CHAPTER_LENGTHS = [4, 5] as const;

// ── run start ──
export const START_MANDATE = 5;
export const START_INFLUENCE = 4;
/** Science: the even choice at landfall (Growth amplified Land Colony too much for a first chapter) */
export const START_FOCUS: PillarId = 'discovery';
export const START_DOCTRINE_SLOTS = 5;
export const START_EDICT_SLOTS = 2;

// ── chronicle targets ──
/**
 * Dawn targets per era; the Crisis chapter multiplies them. Tuned for 54-turn runs with `bun scripts/sim.ts --runs 40
 * --size small` and its policies: `--policy guided` (the in-game guide: fill queues, research, Land Colony, buy Crew)
 * passes Landfall Dawn at ≈2× and usually falls in eras 3–4; `--policy passive` (never lands a colony) passes
 * Landfall Dawn about half the time; the bot wins ≈45% with every chapter's median between 1.1× and 2.5×.
 */
export const ERA_TARGETS = [450, 3600, 14700, 33600, 85000, 235000] as const;
/** Dawn is the warm-up (bot median ≈1.6–2.4×); the Crisis chapter is the real check (bot median ≈1.2–1.5×) */
export const CHAPTER_TARGET_MUL = [1, 2.2] as const;
/** Landfall's Crisis: the colony economy takes off after the first 4 turns, so its step is steeper */
export const FIRST_CRISIS_TARGET_MUL = 3.5;
/** The terminal Crisis: the run's boss (bot passes ≈50%). */
export const FINAL_CRISIS_TARGET_MUL = 2.3;
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
/** bonus Coins after a missed Chapter Report (the Second Chance also cuts the next target) */
export const LIFELINE_INFLUENCE = 3;

// ── influence income ──
export const INCOME_BASE = 2;
export const INCOME_CHAPTER_BONUS = [1, 3] as const;
export const INTEREST_PER = 5;
export const INTEREST_CAP = 2;
export const TRIUMPH_INFLUENCE = 3;
/** bonus Coins: +1 Coin for every full target beyond the Big Win ratio, capped */
export const OVERDRIVE_INFLUENCE_CAP = 2;
/** income line labels that hooks match on (Difficulty 8 cancels them) */
export const BIG_WIN_LABEL = 'Big Win';
export const BONUS_COINS_LABEL = 'Bonus Coins';

// ── council ──
export const SHOP_DOCTRINE_SLOTS = 2;
export const SHOP_PACK_SLOTS = 2;
export const RARITY_WEIGHTS_SHOP: Record<Rarity, number> = { common: 55, uncommon: 35, rare: 10, legendary: 0 };
export const RARITY_WEIGHTS_PACK: Record<Rarity, number> = { common: 55, uncommon: 30, rare: 10, legendary: 3 };
/** edition roll probabilities (remainder = base) */
export const EDITION_CHANCE: Record<Exclude<Edition, 'base'>, number> = { gilded: 0.04, radiant: 0.025, prismatic: 0.01, ethereal: 0.005 };
export const DOCTRINE_PRICE: Record<Rarity, number> = { common: 4, uncommon: 6, rare: 8, legendary: 12 };
export const EDITION_PRICE: Record<Edition, number> = { base: 0, gilded: 2, radiant: 3, prismatic: 5, ethereal: 5 };
/** fallback price for edicts whose def.cost is missing */
export const EDICT_PRICE_BY_RARITY: Record<Rarity, number> = { common: 3, uncommon: 4, rare: 5, legendary: 6 };
export const REROLL_BASE = 2;
export const REROLL_STEP = 1;
export const PACKS = {
  doctrine: { normal: { price: 4, options: 3, picks: 1 }, jumbo: { price: 6, options: 5, picks: 1 } },
  edict: { normal: { price: 4, options: 3, picks: 1 }, jumbo: { price: 6, options: 5, picks: 1 } },
} as const;
export type PackKind = keyof typeof PACKS;
/** pack roll weights for the two pack slots */
export const PACK_WEIGHTS: { pack: PackKind; size: 'normal' | 'jumbo'; weight: number }[] = [
  { pack: 'doctrine', size: 'normal', weight: 40 },
  { pack: 'doctrine', size: 'jumbo', weight: 12 },
  { pack: 'edict', size: 'normal', weight: 20 },
];
