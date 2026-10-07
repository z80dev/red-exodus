// AEONS content definition types + the unified Effect Hook system.
// Every source of rule-bending behavior (leaders, doctrines, crises, reforms, wonders, buildings,
// ascension, dark age) implements EffectHooks. The sim calls hooks through src/sim/effects.ts.
// Additive edits only. Re-read before editing: shared by many agents.

import type {
  ChapterStats, City, CityId, CouncilState, CrisisId, DoctrineId, EdictId, ElevationId, FeatureId,
  GameState, ImprovementId, LeaderId, NaturalWonderId, OmenId, PillarId, Player, PlayerId, ProductionItem,
  PromotionId, Rarity, ReformId, ResourceId, ScrollId, SimEvent, TechId, TerrainId, Tile, TileIdx, Uid, Unit,
  UnitId, UnitTypeId, BuildingId, WonderId, Yields, AiPersonality,
} from './types';

// ───────────────────────────── hook plumbing ─────────────────────────────
export type EffectKind = 'leader' | 'doctrine' | 'crisis' | 'reform' | 'wonder' | 'building' | 'ascension' | 'darkAge' | 'naturalWonder' | 'edict';

export interface HookCtx {
  state: GameState;
  /** the player who owns this effect */
  player: Player;
  kind: EffectKind;
  id: string;
  /** doctrine instance uid (doctrines only) */
  uid?: Uid;
  /** city that hosts the effect (buildings/wonders only) */
  cityId?: CityId;
  /** persistent mutable counters for this effect instance (serialized in state) */
  counters: Record<string, number>;
  /** emit a SimEvent (goes to UI/animation and to other hooks' onEvent) */
  emit(ev: SimEvent): void;
  /** convenience: emit doctrineTriggered for juice (no-op for non-doctrines) */
  flash(text: string, tile?: TileIdx): void;
}

export interface TileYieldArgs { tile: Tile; city: City | null; yields: Yields }
/** flats first (mutate yields), then percentages (add to pct; final = flat * (1 + pct/100)) */
export interface CityYieldArgs { city: City; yields: Yields; pct: Yields }

export interface CombatMod { label: string; pct: number }
export interface CombatArgs {
  /** which side the hook's owner is on */
  side: 'attack' | 'defense';
  attacker: Unit | null;
  attackerCity: City | null;
  attackerOwner: PlayerId;
  defender: Unit | null;
  defenderCity: City | null;
  defenderOwner: PlayerId;
  /** tile being attacked */
  tile: Tile;
  /** tile the attacker stands on */
  fromTile: Tile;
  ranged: boolean;
  /** push modifiers for the side you own; shown in the combat preview */
  attackMods: CombatMod[];
  defenseMods: CombatMod[];
}

export type CostItem = ProductionItem | { kind: 'improvement'; id: ImprovementId } | { kind: 'tech'; id: TechId } | { kind: 'upgrade'; id: UnitTypeId };
export interface CostArgs { city: City | null; item: CostItem; currency: 'prod' | 'gold' | 'sci' | 'influence'; cost: number }

export interface ChronicleCtx {
  stats: ChapterStats;
  focus: PillarId;
  era: number;
  chapter: number;
  /** player's cities in founding order */
  cities: City[];
  renown(): number;
  splendor(): number;
  addRenown(n: number, label?: string): void;
  addSplendor(n: number, label?: string): void;
  mulSplendor(x: number, label?: string): void;
}

export interface Scalar { value: number }

export interface EffectHooks {
  /** per-tile yield mutation (only for tiles in the owner's territory) */
  tileYield?(ctx: HookCtx, a: TileYieldArgs): void;
  cityYield?(ctx: HookCtx, a: CityYieldArgs): void;
  combat?(ctx: HookCtx, a: CombatArgs): void;
  cost?(ctx: HookCtx, a: CostArgs): void;
  /** empire happiness adjustment */
  happiness?(ctx: HookCtx, a: Scalar): void;
  unitMoves?(ctx: HookCtx, a: { unit: Unit; value: number }): void;
  unitVision?(ctx: HookCtx, a: { unit: Unit; value: number }): void;
  unitHeal?(ctx: HookCtx, a: { unit: Unit; value: number }): void;
  /** food needed to grow */
  growthThreshold?(ctx: HookCtx, a: { city: City; value: number }): void;
  /** culture needed for next border tile */
  borderThreshold?(ctx: HookCtx, a: { city: City; value: number }): void;
  canFoundCity?(ctx: HookCtx, a: { tile: Tile; minDistance: number; allowed: boolean; reason?: string }): void;
  /** influence income lines at chapter end (push lines) */
  influenceIncome?(ctx: HookCtx, a: { lines: { label: string; amount: number }[] }): void;
  /** mutate shop right after it is generated/rerolled */
  council?(ctx: HookCtx, a: { council: CouncilState; reroll: boolean }): void;
  /** chronicle target scaling (crisis/ascension) */
  target?(ctx: HookCtx, a: Scalar): void;
  /** contribute to the chronicle (runs in effect order; doctrines left→right) */
  chronicle?(ctx: HookCtx, c: ChronicleCtx): void;
  /** react to any sim event (all events are broadcast to every player's effects; filter by ctx.player) */
  onEvent?(ctx: HookCtx, ev: SimEvent): void;
  /** owner's turn start (after upkeep) */
  turnStart?(ctx: HookCtx): void;
  onGain?(ctx: HookCtx): void;
  onLose?(ctx: HookCtx): void;
  /** crisis only: chapter III begins/ends */
  onBegin?(ctx: HookCtx): void;
  onEnd?(ctx: HookCtx): void;
  /**
   * Martian dust storm damage about to hit one of the owner's units or colonies (owner = a.victim).
   * Also runs for the owner of the territory the victim stands in (a.territoryOwner), so a nation can
   * amplify storms against intruders. Set a.damage (≥ 0).
   */
  storm?(ctx: HookCtx, a: StormDamageArgs): void;
  /** price of one Orbital Drop for the owner (default { cryo: 1, gold: 0 }) */
  dropPrice?(ctx: HookCtx, a: { cryo: number; gold: number; cryoLeft: number }): void;
  /** number of techs in the owner's Breakthrough draft (default RESEARCH_OFFER_SIZE) */
  researchOffers?(ctx: HookCtx, a: Scalar): void;
  /** Credits price of the owner's next research reroll */
  researchReroll?(ctx: HookCtx, a: Scalar): void;
  /** runs for BOTH the declarer's and the target's effects; set allowed=false to forbid */
  warDeclaration?(ctx: HookCtx, a: { by: PlayerId; target: PlayerId; allowed: boolean; reason?: string }): void;
  /** Scrip interest cap at chapter end (default INTEREST_CAP) */
  interestCap?(ctx: HookCtx, a: Scalar): void;
  /** Scrip a Crew card sells for, set when it is acquired (default half its price) */
  sellValue?(ctx: HookCtx, a: { id: DoctrineId; price: number; value: number }): void;
}

export interface StormDamageArgs {
  tile: Tile;
  unit: Unit | null;
  city: City | null;
  victim: PlayerId;
  territoryOwner: PlayerId | null;
  power: number;
  damage: number;
}

// ───────────────────────────── civ content ─────────────────────────────
export interface TerrainDef {
  id: TerrainId; name: string; yields: Yields; moveCost: number; defensePct: number;
  water: boolean; color: string; description: string;
}
export interface FeatureDef {
  id: FeatureId; name: string; yields: Yields; /** replaces terrain move cost if higher */ moveCost: number;
  defensePct: number; color: string; description: string; blocksVision?: boolean;
}
export interface ElevationDef { id: ElevationId; name: string; yields: Yields; moveCost: number; defensePct: number; impassable: boolean; blocksVision: boolean }

export type ResourceKind = 'bonus' | 'luxury' | 'strategic';
export interface ResourceDef {
  id: ResourceId; name: string; kind: ResourceKind;
  yields: Yields; // base bonus on the tile
  improvement: ImprovementId; // improvement that "connects" it
  improvedYields: Yields; // extra when improved
  terrains: TerrainId[]; features?: FeatureId[]; elevations?: ElevationId[];
  /** mapgen frequency weight */
  weight: number;
  revealTech?: TechId;
  happiness?: number; // luxuries: empire happiness when connected (not stacking per copy)
  icon: string; // icon name (src/ui/icons)
  model?: string; // model key (src/render/assets/manifest.ts)
}

export interface ImprovementDef {
  id: ImprovementId; name: string; tech: TechId | null; goldCost: number;
  yields: Yields;
  /** placement rules */
  terrains?: TerrainId[]; features?: FeatureId[]; elevations?: ElevationId[];
  requiresResource?: boolean; // only on tiles with a resource whose improvement === this id
  requiresRiverOrLake?: boolean; coastal?: boolean; water?: boolean;
  removesFeature?: boolean;
  /** extra yields when adjacent to X / on river etc — use hooks in doctrines rather than data here */
  description: string; icon: string; model: string;
}

export type UnitClass = 'civilian' | 'recon' | 'melee' | 'antiCavalry' | 'ranged' | 'mounted' | 'siege' | 'naval' | 'armor';
export interface UnitDef {
  id: UnitTypeId; name: string; era: number; class: UnitClass;
  cost: number; // production
  strength: number; // melee (defense for ranged)
  rangedStrength?: number; range?: number;
  moves: number; vision: number;
  tech: TechId | null; resource?: ResourceId; // strategic requirement (1 connected source suffices)
  upgradesTo?: UnitTypeId;
  /** combat % vs classes, vs cities, etc. */
  bonusVs?: Partial<Record<UnitClass | 'city', number>>;
  abilities?: ('foundCity' | 'ignoreTerrain' | 'noZoc' | 'amphibious' | 'moveAfterAttack' | 'noMelee' | 'heal')[];
  uniqueTo?: LeaderId; replaces?: UnitTypeId;
  description: string; model: string; icon: string;
}

export interface BuildingDef {
  id: BuildingId; name: string; era: number; cost: number; tech: TechId | null;
  yields: Partial<Yields>; pct?: Partial<Yields>; perPop?: Partial<Yields>; // perPop: yield per 1 pop (e.g. 0.25)
  happiness?: number; cityHp?: number; cityStrength?: number; influence?: number; // influence per chapter
  maintenance: number; // gold per turn
  requires?: BuildingId; coastal?: boolean; river?: boolean;
  uniqueTo?: LeaderId; replaces?: BuildingId;
  effects?: EffectHooks;
  /** landmark model key (bld_<x>) shown in the city when built; omit for no landmark */
  model?: string;
  description: string; icon: string; pillar?: PillarId; // pillar it thematically feeds (UI tint)
}

export interface WonderDef {
  id: WonderId; name: string; era: number; cost: number; tech: TechId;
  yields: Partial<Yields>; happiness?: number;
  requiresCoastal?: boolean; requiresRiver?: boolean; requiresTerrain?: TerrainId[];
  effects?: EffectHooks;
  description: string; flavor: string; model: string; icon: string;
}

export interface TechDef {
  id: TechId; name: string; era: number; cost: number; prereqs: TechId[];
  /** layout in tech web: column within era (0..2), row (0..5) */
  pos: { col: number; row: number };
  description: string; icon: string;
}

export interface PromotionDef {
  id: PromotionId; name: string; description: string; icon: string;
  classes: UnitClass[]; requires?: PromotionId[]; tier: 1 | 2 | 3;
  /** combat modifier for the promoted unit; push into the side matching a.side */
  combat?(a: CombatArgs, unit: Unit): void;
  moves?: number; vision?: number; range?: number; heal?: number; // flat bonuses
  /** rewards when this unit destroys an enemy unit (applied by sim/combat.ts): gold to owner, hp healed, bonus xp */
  onKill?: { gold?: number; heal?: number; xp?: number };
}

export interface NaturalWonderDef {
  id: NaturalWonderId; name: string; yields: Yields; happiness: number; description: string;
  terrains: TerrainId[]; impassable: boolean; model: string;
  effects?: EffectHooks;
}

// ───────────────────────────── roguelite content ─────────────────────────────
export interface PillarDef {
  id: PillarId; name: string; color: string; icon: string; description: string;
  /** renown lines from chapter stats at a given pillar level */
  renown(stats: ChapterStats, level: number): { label: string; amount: number }[];
  /** base splendor when this is the focus pillar */
  splendor(level: number): number;
}

export interface DoctrineDef {
  id: DoctrineId; name: string; rarity: Rarity; cost: number;
  /** rich text: {food} {prod} {gold} {sci} {cul} {renown} {splendor} {influence} {happy} tokens render as icons */
  description: string;
  flavor?: string;
  /** live state line, e.g. "Currently ×2.5 Splendor" */
  status?(counters: Record<string, number>, state: GameState): string | null;
  tags: string[]; // synergy tags for UI filtering & weighted shop rolls
  icon: string; // icon name or emoji-free glyph key
  art: { hue: number; motif: string }; // procedural card art params
  /** meta-unlock requirement; absent = unlocked from the start */
  /** `rule` = key of UNLOCK_RULES in src/meta/profile.ts (missing/unknown → 'win') */
  unlock?: { text: string; rule?: string };
  /** exclude from shops (e.g. leader starting doctrines) */
  noShop?: boolean;
  /** cannot be sold at the Uplink (sellDoctrine rejects) */
  noSell?: boolean;
  /** nationality of the crew member (a LeaderId / nation id); shown as a badge, used by synergies */
  nation?: LeaderId;
  effects: EffectHooks;
}

export type EdictTarget = 'none' | 'city' | 'ownedTile' | 'tile' | 'unit';
export interface EdictDef {
  id: EdictId; name: string; rarity: Rarity; cost: number; description: string; icon: string;
  art: { hue: number; motif: string };
  target: EdictTarget;
  /** return error string if not usable */
  canUse?(ctx: HookCtx, t: { tile?: TileIdx; cityId?: CityId; unitId?: UnitId }): string | null;
  use(ctx: HookCtx, t: { tile?: TileIdx; cityId?: CityId; unitId?: UnitId }): void;
  unlock?: { text: string; rule?: string };
}

export interface ScrollDef {
  id: ScrollId; name: string; pillar: PillarId; cost: number; description: string; icon: string;
  /** pillar levels granted to each targeted pillar (default 1) */
  levels?: number;
  /** which pillars are raised: `pillar` (default) = `pillar`; `focus` = run.focus at use time; `all` = every pillar */
  scope?: 'pillar' | 'focus' | 'all';
  /** relative roll weight in shops/Archive packs (default 1; rare variants < 1) */
  weight?: number;
}

export interface CrisisDef {
  id: CrisisId; name: string; eras: number[]; description: string; flavor: string; icon: string;
  art: { hue: number; motif: string };
  /** multiplier on this chapter's target (default 1) */
  targetMul?: number;
  /** relative roll weight among eligible crises (default 1) */
  weight?: number;
  /** extra influence for surviving */
  reward: number;
  /** active only during the crisis chapter, applied to the HUMAN player (and to AIs if affectsAll) */
  affectsAll?: boolean;
  effects: EffectHooks;
}

export interface OmenDef {
  id: OmenId; name: string; description: string; icon: string; eras?: number[];
  goal: number | ((state: GameState) => number);
  /** return progress increment for this event (0 = none) */
  progress(ev: SimEvent, state: GameState, player: PlayerId): number;
  reward: { kind: 'influence'; amount: number } | { kind: 'doctrine'; rarity: Rarity } | { kind: 'scroll' } | { kind: 'edict' } | { kind: 'gold'; amount: number } | { kind: 'mandate' };
  rewardText: string;
}

export type CommanderGender = 'f' | 'm';

export interface LeaderDef {
  id: LeaderId; name: string; title: string; civName: string; adjective: string;
  colors: { primary: string; secondary: string };
  /** real-world country this Ark launched from, e.g. 'United States' */
  country: string;
  /** 2–3 letter badge code, e.g. 'USA' */
  code: string;
  /** 2–4 flag-inspired colors (UI badge stripes; never a literal flag render) */
  flagColors: string[];
  /** starting Cryo pods (default START_CRYO) */
  cryo?: number;
  description: string; // one-line identity
  bonus: string; // rich text of the ability
  startDoctrine?: DoctrineId;
  uniqueUnit?: UnitTypeId; uniqueBuilding?: BuildingId;
  aiPersonality: AiPersonality;
  cityNames: string[];
  portrait: { hue: number; motif: string; crest: string };
  /** gender of the default commander (name/title/description above) */
  gender: CommanderGender;
  /** the opposite-gender commander the player may lead instead: same Ark, same rules, own portrait (`<id>_alt` art) */
  alt: { name: string; title: string; gender: CommanderGender; description: string };
  unlock?: { text: string; rule?: string };
  effects: EffectHooks;
}

export interface ReformDef {
  id: ReformId; name: string; description: string; cost: number; tier: 1 | 2; requires?: ReformId; icon: string;
  effects: EffectHooks;
}

export interface AscensionDef { level: number; name: string; description: string; effects: EffectHooks }
