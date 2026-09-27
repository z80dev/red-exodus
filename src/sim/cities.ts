// OWNER: SimCore. STUB.
import type { ActiveEffect } from './effects';
import type { City, CityId, Emit, GameState, ImprovementId, PlayerId, ProductionItem, TileIdx, Yields } from './types';

export function canFoundCity(state: GameState, pid: PlayerId, tile: TileIdx): string | null { void state; void pid; void tile; throw new Error('not implemented'); }
export function foundCity(state: GameState, pid: PlayerId, tile: TileIdx, emit: Emit): City { void state; void pid; void tile; void emit; throw new Error('not implemented'); }
/** yields of one tile for its owner (terrain+feature+elevation+resource+improvement+river + tileYield hooks) */
export function tileYields(state: GameState, tile: TileIdx, pid: PlayerId, fx?: ActiveEffect[]): Yields { void state; void tile; void pid; void fx; throw new Error('not implemented'); }
/** reassign worked tiles by focus, compute & cache city.yields (after buildings, pct, hooks, happiness, crisis) */
export function refreshCity(state: GameState, city: City, fx?: ActiveEffect[]): Yields { void state; void city; void fx; throw new Error('not implemented'); }
export function refreshAllCities(state: GameState, pid: PlayerId): void { void state; void pid; throw new Error('not implemented'); }
export function cityTerritory(state: GameState, city: City): TileIdx[] { void state; void city; throw new Error('not implemented'); }
export function growthThreshold(state: GameState, city: City): number { void state; void city; throw new Error('not implemented'); }
export function productionCost(state: GameState, city: City, item: ProductionItem): number { void state; void city; void item; throw new Error('not implemented'); }
/** null if item can't be bought */
export function buyCost(state: GameState, city: City, item: ProductionItem): number | null { void state; void city; void item; throw new Error('not implemented'); }
/** items this city can currently produce (tech, resources, uniqueness, wonder availability) */
export function availableProduction(state: GameState, city: City): ProductionItem[] { void state; void city; throw new Error('not implemented'); }
export function canProduce(state: GameState, city: City, item: ProductionItem): string | null { void state; void city; void item; throw new Error('not implemented'); }
export function turnsToComplete(state: GameState, city: City, item: ProductionItem): number { void state; void city; void item; throw new Error('not implemented'); }
export function improvementOptions(state: GameState, pid: PlayerId, tile: TileIdx): { id: ImprovementId; cost: number; error: string | null }[] { void state; void pid; void tile; throw new Error('not implemented'); }
export function buildImprovement(state: GameState, pid: PlayerId, tile: TileIdx, id: ImprovementId, emit: Emit): string | null { void state; void pid; void tile; void id; void emit; throw new Error('not implemented'); }
export function captureCity(state: GameState, city: City, newOwner: PlayerId, emit: Emit): void { void state; void city; void newOwner; void emit; throw new Error('not implemented'); }
/** end-of-turn processing for one city: food/growth, production, culture/borders, heal */
export function processCity(state: GameState, city: City, emit: Emit): void { void state; void city; void emit; throw new Error('not implemented'); }
export function cityAt(state: GameState, tile: TileIdx): City | null { void state; void tile; throw new Error('not implemented'); }
export function citiesOf(state: GameState, pid: PlayerId): City[] { void state; void pid; throw new Error('not implemented'); } // founding order
export function getCity(state: GameState, id: CityId): City | null { void state; void id; throw new Error('not implemented'); }
/** change a city's pop (edicts/crises/doctrines); emits cityGrew/cityStarved as appropriate */
export function changePop(state: GameState, city: City, delta: number, emit: Emit): void { void state; void city; void delta; void emit; throw new Error('not implemented'); }
/** instantly complete an item (edicts, buys) */
export function completeItem(state: GameState, city: City, item: ProductionItem, emit: Emit): void { void state; void city; void item; void emit; throw new Error('not implemented'); }
