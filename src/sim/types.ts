// AEONS core simulation types — THE shared contract.
// Rules: pure data, JSON/structured-clone serializable (no class instances, no functions, no Maps/Sets).
// Additive edits only (new optional fields / union members). Re-read before editing: several agents share this file.

// ───────────────────────────── ids ─────────────────────────────
export type PlayerId = number; // 0 = human, 1..3 = AI rivals, BARBARIAN = barbarians
export const BARBARIAN: PlayerId = 99;
export const HUMAN: PlayerId = 0;

export type TileIdx = number; // index into map.tiles (row * width + col)
export type UnitId = number;
export type CityId = number;
export type Uid = number; // instance id for doctrines/edicts

// content ids (string keys into registries in src/content)
export type TerrainId = 'ocean' | 'coast' | 'lake' | 'grassland' | 'plains' | 'desert' | 'tundra' | 'snow';
export type ElevationId = 'flat' | 'hills' | 'mountain';
export type FeatureId = 'forest' | 'jungle' | 'marsh' | 'oasis' | 'floodplains' | 'reef' | 'ice';
export type ResourceId = string;
export type ImprovementId = string;
export type UnitTypeId = string;
export type BuildingId = string;
export type WonderId = string;
export type TechId = string;
export type PromotionId = string;
export type NaturalWonderId = string;
export type DoctrineId = string;
export type EdictId = string;
export type ScrollId = string;
export type CrisisId = string;
export type OmenId = string;
export type LeaderId = string;
export type ReformId = string;

export type YieldKey = 'food' | 'prod' | 'gold' | 'sci' | 'cul';
export const YIELD_KEYS: readonly YieldKey[] = ['food', 'prod', 'gold', 'sci', 'cul'];
export type Yields = Record<YieldKey, number>;

export type PillarId = 'arts' | 'discovery' | 'commerce' | 'conquest' | 'prosperity' | 'glory';
export const PILLARS: readonly PillarId[] = ['arts', 'discovery', 'commerce', 'conquest', 'prosperity', 'glory'];

export type CityFocus = 'balanced' | 'food' | 'prod' | 'gold' | 'sci' | 'cul';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';
export type Edition = 'base' | 'gilded' | 'radiant' | 'prismatic' | 'ethereal';

// ───────────────────────────── rng ─────────────────────────────
/** sfc32 state; advance only via src/sim/rng.ts */
export interface RngState { a: number; b: number; c: number; d: number }

// ───────────────────────────── map ─────────────────────────────
export interface Tile {
  idx: TileIdx;
  col: number;
  row: number;
  terrain: TerrainId;
  elevation: ElevationId;
  feature: FeatureId | null;
  /** bitmask of the 6 hex edges carrying a river (edge i = between this tile and neighbor dir i) */
  riverEdges: number;
  resource: ResourceId | null;
  improvement: ImprovementId | null;
  pillaged: boolean;
  road: boolean;
  naturalWonder: NaturalWonderId | null;
  owner: PlayerId | null;
  /** city whose territory contains this tile */
  cityId: CityId | null;
  /** 0..1 smooth height noise from mapgen, rendering hint only */
  height: number;
  /** barbarian camp present */
  camp: boolean;
  /** goody hut / ancient ruin present */
  ruin: boolean;
}

export interface GameMap {
  width: number;
  height: number;
  tiles: Tile[];
  /** starting tile per player id (index = player id) */
  starts: TileIdx[];
}

// ───────────────────────────── units ─────────────────────────────
export type UnitOrder =
  | { kind: 'goto'; target: TileIdx }
  | { kind: 'explore' }
  | { kind: 'fortify' }
  | { kind: 'sleep' }
  | { kind: 'heal' };

export interface Unit {
  id: UnitId;
  owner: PlayerId;
  type: UnitTypeId;
  tile: TileIdx;
  hp: number; // 0..100
  /** movement points remaining this turn (full = def.moves) */
  moves: number;
  hasAttacked: boolean;
  xp: number;
  level: number;
  promotions: PromotionId[];
  /** pending promotion choice (2 random options); unit cannot level again until chosen */
  promotionChoices: PromotionId[] | null;
  order: UnitOrder | null;
  fortifyTurns: number;
  /** turns since creation; used by AI/UX */
  age: number;
}

// ───────────────────────────── cities ─────────────────────────────
export type ProductionItem =
  | { kind: 'unit'; id: UnitTypeId }
  | { kind: 'building'; id: BuildingId }
  | { kind: 'wonder'; id: WonderId }
  | { kind: 'project'; id: 'wealth' | 'research' | 'festival' };

export interface City {
  id: CityId;
  owner: PlayerId;
  originalOwner: PlayerId;
  name: string;
  tile: TileIdx;
  pop: number;
  foodStored: number;
  prodStored: number;
  queue: ProductionItem[]; // queue[0] is being built
  buildings: BuildingId[];
  wonders: WonderId[];
  focus: CityFocus;
  /** tiles currently worked (excludes city center, which is always worked) */
  worked: TileIdx[];
  cultureStored: number; // toward next border expansion
  hp: number;
  maxHp: number;
  isCapital: boolean;
  foundedTurn: number;
  hasStruck: boolean; // city ranged attack used this turn
  /** cached last computed yields (for UI); recomputed each turn & on relevant actions */
  yields: Yields;
  /** turns of starvation / unrest bookkeeping */
  starving: boolean;
  /** founding order index for the player (Chronicle scores left-to-right by this) */
  order: number;
}

// ───────────────────────────── players ─────────────────────────────
export type Relation = 'war' | 'peace';
export type AiPersonality = 'expansionist' | 'warmonger' | 'builder' | 'scientist';

export interface Player {
  id: PlayerId;
  name: string; // leader name
  civName: string;
  leaderId: LeaderId;
  colors: { primary: string; secondary: string }; // hex '#rrggbb'
  isHuman: boolean;
  alive: boolean;
  gold: number;
  techs: TechId[];
  researching: TechId | null;
  researchProgress: Record<TechId, number>;
  /** fog: 0 = unexplored, 1 = explored (remembered), 2 = currently visible */
  vis: number[];
  relations: Record<number, Relation>; // keyed by other PlayerId
  happiness: number; // cached, recomputed each turn
  ai: { personality: AiPersonality; memory: Record<string, number> } | null;
  capitalId: CityId | null;
  citiesFounded: number;
  /** turns since last war declared by / on this player, etc. free-form counters */
  counters: Record<string, number>;
  /** persistent counters for non-doctrine effects, keyed `${kind}:${id}` (doctrines use their instance counters) */
  effectCounters: Record<string, Record<string, number>>;
}

// ───────────────────────────── roguelite layer ─────────────────────────────
export interface DoctrineInstance {
  uid: Uid;
  id: DoctrineId;
  edition: Edition;
  /** per-instance mutable state for scaling doctrines ("gains +0.5 Splendor per kill") */
  counters: Record<string, number>;
  disabled: boolean; // e.g. Iconoclasm crisis
  sellValue: number;
}

export interface EdictInstance { uid: Uid; id: EdictId }

export interface ChapterStats {
  culture: number;
  science: number;
  gold: number;
  techs: number;
  kills: number;
  unitsLost: number;
  citiesCaptured: number;
  campsCleared: number;
  popGrown: number;
  citiesFounded: number;
  improvements: number;
  buildings: number;
  wonders: number;
  naturalWonders: number;
  tilesExplored: number;
  /** free-form counters doctrines/omens can use */
  extra: Record<string, number>;
}

export type ChronicleStepSource = 'pillar' | 'focus' | 'city' | 'doctrine' | 'edition' | 'crisis' | 'darkAge' | 'omen' | 'reform' | 'leader' | 'final';

/** One animated beat of the Chronicle ceremony. UI plays these in order. */
export interface ChronicleStep {
  source: ChronicleStepSource;
  label: string;
  /** id of the source (pillar id, doctrine uid as string, city id as string, ...) for highlighting */
  ref?: string;
  renownAdd?: number;
  splendorAdd?: number;
  splendorMul?: number;
  /** running totals AFTER this step */
  renown: number;
  splendor: number;
}

export interface ChronicleResult {
  era: number;
  chapter: number;
  target: number;
  steps: ChronicleStep[];
  renown: number;
  splendor: number;
  score: number;
  passed: boolean;
  triumph: boolean;
  mandateLost: number;
  influenceEarned: { label: string; amount: number }[];
}

export type ShopItem =
  | { kind: 'doctrine'; id: DoctrineId; edition: Edition; price: number }
  | { kind: 'edict'; id: EdictId; price: number }
  | { kind: 'scroll'; id: ScrollId; price: number }
  | { kind: 'pack'; pack: 'doctrine' | 'archive' | 'edict'; size: 'normal' | 'jumbo'; price: number }
  | { kind: 'reform'; id: ReformId; price: number };

export interface CouncilState {
  items: (ShopItem | null)[]; // null = sold slot
  rerollCost: number;
  rerolls: number;
  /** open pack being chosen from */
  pack: { options: ShopItem[]; picks: number } | null;
}

export type RunPhase =
  | 'crisisReveal' // era start: show upcoming crisis
  | 'chapterStart' // choose focus pillar + omen
  | 'playing'
  | 'chronicle' // lastChronicle ready to be animated
  | 'council'
  | 'victory'
  | 'defeat'
  | 'endless';

export interface RunState {
  phase: RunPhase;
  era: number; // 0..5 (6+ endless)
  chapter: number; // 0..2
  chapterTurn: number; // turns elapsed in chapter
  chapterLength: number;
  mandate: number;
  maxMandate: number;
  influence: number;
  focus: PillarId;
  pillarLevels: Record<PillarId, number>; // start at 1
  doctrines: DoctrineInstance[];
  doctrineSlots: number;
  edicts: EdictInstance[];
  edictSlots: number;
  reforms: ReformId[];
  crisis: CrisisId | null; // crisis for this era's chapter III
  crisisActive: boolean;
  darkAge: boolean; // failed last chapter
  omenOffer: OmenId[];
  omen: { id: OmenId; progress: number; done: boolean } | null;
  stats: ChapterStats; // current chapter
  totals: ChapterStats; // whole run
  council: CouncilState | null;
  lastChronicle: ChronicleResult | null;
  history: { era: number; chapter: number; score: number; target: number; passed: boolean }[];
  ascension: number;
  nextUid: number;
  /** pools already seen/owned — used to avoid duplicates */
  seen: string[];
  bestScore: number;
  defeatReason: string | null;
}

// ───────────────────────────── game ─────────────────────────────
export type MapSize = 'small' | 'standard' | 'large';

export interface GameConfig {
  seed: string;
  leaderId: LeaderId;
  ascension: number;
  mapSize: MapSize;
  rivals: number; // 1..3
  tutorial: boolean;
  daily: boolean;
}

export interface GameState {
  schema: 1;
  config: GameConfig;
  rng: RngState;
  turn: number;
  map: GameMap;
  players: Player[]; // index === id for 0..n; barbarians stored at the end with id BARBARIAN
  cities: Record<number, City>;
  units: Record<number, Unit>;
  nextId: number;
  run: RunState;
  /** wonder id -> city id that built it */
  wonderOwners: Record<WonderId, CityId>;
  /** discovered natural wonders per player */
  naturalWondersSeen: Record<number, NaturalWonderId[]>;
  /** recent notable log lines for the UI journal */
  log: LogEntry[];
  gameOver: boolean;
}

export interface LogEntry { turn: number; text: string; icon?: string; tile?: TileIdx; player?: PlayerId }

// ───────────────────────────── actions ─────────────────────────────
export type Action =
  // units
  | { type: 'moveUnit'; unitId: UnitId; to: TileIdx } // sets goto order & moves as far as possible now
  | { type: 'attack'; unitId: UnitId; target: TileIdx } // melee or ranged, auto by unit type
  | { type: 'foundCity'; unitId: UnitId }
  | { type: 'unitOrder'; unitId: UnitId; order: UnitOrder | null } // fortify/sleep/explore/heal/clear
  | { type: 'skipUnit'; unitId: UnitId } // done for this turn
  | { type: 'disband'; unitId: UnitId }
  | { type: 'pillage'; unitId: UnitId }
  | { type: 'upgradeUnit'; unitId: UnitId }
  | { type: 'promote'; unitId: UnitId; promotion: PromotionId }
  // cities
  | { type: 'setProduction'; cityId: CityId; item: ProductionItem } // replaces queue[0]
  | { type: 'enqueue'; cityId: CityId; item: ProductionItem }
  | { type: 'dequeue'; cityId: CityId; index: number }
  | { type: 'buyItem'; cityId: CityId; item: ProductionItem } // gold purchase, completes now
  | { type: 'buildImprovement'; tile: TileIdx; improvement: ImprovementId } // gold, instant
  | { type: 'setFocus'; cityId: CityId; focus: CityFocus }
  | { type: 'cityStrike'; cityId: CityId; target: TileIdx }
  // empire
  | { type: 'setResearch'; tech: TechId }
  | { type: 'declareWar'; target: PlayerId }
  | { type: 'offerPeace'; target: PlayerId }
  | { type: 'endTurn' }
  // roguelite
  | { type: 'ackCrisis' }
  | { type: 'chooseChapterStart'; focus: PillarId; omen: OmenId | null }
  | { type: 'ackChronicle' } // chronicle animation finished → council (or defeat/victory)
  | { type: 'councilBuy'; slot: number }
  | { type: 'councilReroll' }
  | { type: 'packPick'; index: number | null } // null = skip remaining picks
  | { type: 'sellDoctrine'; uid: Uid }
  | { type: 'moveDoctrine'; uid: Uid; toIndex: number }
  | { type: 'useEdict'; uid: Uid; target?: TileIdx; cityId?: CityId; unitId?: UnitId }
  | { type: 'discardEdict'; uid: Uid }
  | { type: 'leaveCouncil' }
  | { type: 'continueEndless' };

// ───────────────────────────── events ─────────────────────────────
/** Emitted by the sim for animation, audio, notifications, and effect hooks. Order = causal order. */
export type SimEvent =
  | { type: 'turnStart'; turn: number; player: PlayerId }
  | { type: 'turnEnd'; turn: number; player: PlayerId }
  | { type: 'unitMoved'; unitId: UnitId; player: PlayerId; path: TileIdx[] }
  | { type: 'unitCreated'; unitId: UnitId; player: PlayerId; tile: TileIdx; cityId?: CityId }
  | { type: 'unitDied'; unitId: UnitId; player: PlayerId; tile: TileIdx; unitType: UnitTypeId; killer?: PlayerId }
  | { type: 'unitPromoted'; unitId: UnitId; promotion: PromotionId }
  | { type: 'unitLevelUp'; unitId: UnitId; player: PlayerId }
  | { type: 'unitUpgraded'; unitId: UnitId; from: UnitTypeId; to: UnitTypeId }
  | {
      type: 'combat';
      attacker: { player: PlayerId; unitId?: UnitId; cityId?: CityId; tile: TileIdx };
      defender: { player: PlayerId; unitId?: UnitId; cityId?: CityId; tile: TileIdx };
      ranged: boolean;
      dmgToAttacker: number;
      dmgToDefender: number;
      attackerKilled: boolean;
      defenderKilled: boolean;
    }
  | { type: 'cityFounded'; cityId: CityId; player: PlayerId; tile: TileIdx }
  | { type: 'cityCaptured'; cityId: CityId; from: PlayerId; to: PlayerId; tile: TileIdx }
  | { type: 'cityRazed'; cityId: CityId; tile: TileIdx }
  | { type: 'cityGrew'; cityId: CityId; player: PlayerId; pop: number }
  | { type: 'cityStarved'; cityId: CityId; player: PlayerId; pop: number }
  | { type: 'borderGrew'; cityId: CityId; player: PlayerId; tiles: TileIdx[] }
  | { type: 'buildingBuilt'; cityId: CityId; player: PlayerId; building: BuildingId }
  | { type: 'wonderBuilt'; cityId: CityId; player: PlayerId; wonder: WonderId }
  | { type: 'wonderLost'; cityId: CityId; wonder: WonderId; by: PlayerId } // someone else finished it first
  | { type: 'improvementBuilt'; tile: TileIdx; player: PlayerId; improvement: ImprovementId }
  | { type: 'improvementPillaged'; tile: TileIdx; by: PlayerId }
  | { type: 'techResearched'; player: PlayerId; tech: TechId }
  | { type: 'goldChanged'; player: PlayerId; delta: number; reason: string }
  | { type: 'tilesRevealed'; player: PlayerId; tiles: TileIdx[] }
  | { type: 'naturalWonderFound'; player: PlayerId; tile: TileIdx; id: NaturalWonderId }
  | { type: 'ruinExplored'; player: PlayerId; tile: TileIdx; reward: string }
  | { type: 'campCleared'; player: PlayerId; tile: TileIdx; gold: number }
  | { type: 'campSpawned'; tile: TileIdx }
  | { type: 'warDeclared'; by: PlayerId; target: PlayerId }
  | { type: 'peaceMade'; a: PlayerId; b: PlayerId }
  | { type: 'playerEliminated'; player: PlayerId; by?: PlayerId }
  | { type: 'happinessChanged'; player: PlayerId; value: number }
  // roguelite
  | { type: 'crisisRevealed'; era: number; crisis: CrisisId }
  | { type: 'crisisBegan'; crisis: CrisisId }
  | { type: 'crisisEnded'; crisis: CrisisId }
  | { type: 'chapterStarted'; era: number; chapter: number; target: number }
  | { type: 'chronicle'; result: ChronicleResult }
  | { type: 'eraStarted'; era: number }
  | { type: 'doctrineTriggered'; uid: Uid; text: string; tile?: TileIdx }
  | { type: 'doctrineGained'; uid: Uid; id: DoctrineId }
  | { type: 'doctrineLost'; uid: Uid; id: DoctrineId }
  | { type: 'edictUsed'; uid: Uid; id: EdictId }
  | { type: 'omenProgress'; id: OmenId; progress: number; goal: number }
  | { type: 'omenCompleted'; id: OmenId }
  | { type: 'mandateChanged'; value: number; delta: number }
  | { type: 'influenceChanged'; value: number; delta: number }
  | { type: 'renownGained'; amount: number; label: string; tile?: TileIdx } // live renown pops on the map (e.g. festival)
  | { type: 'runWon' }
  | { type: 'runLost'; reason: string }
  | { type: 'notify'; text: string; icon?: string; tile?: TileIdx; tone?: 'good' | 'bad' | 'info' };

export interface ActionResult {
  ok: boolean;
  error?: string;
  events: SimEvent[];
}

export type Emit = (ev: SimEvent) => void;
