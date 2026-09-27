// Contract between the game layer / UI and the 3D renderer (src/render). The renderer reads GameState
// directly (read-only) and animates SimEvent batches from the bus.
import type { GameState, SimEvent, TileIdx } from '../sim/types';

export interface Highlights {
  selected: TileIdx | null;
  /** tiles the selected unit can move to this turn */
  move: TileIdx[];
  /** tiles with attackable targets */
  attack: TileIdx[];
  /** planned path (multi-turn), rendered as a dotted line with turn markers */
  path: TileIdx[];
  /** city work radius / territory emphasis */
  cityTiles: TileIdx[];
  /** tiles where an improvement can be bought (improve mode) */
  improve: TileIdx[];
  /** edict targeting candidates */
  target: TileIdx[];
}

export const EMPTY_HIGHLIGHTS: Highlights = { selected: null, move: [], attack: [], path: [], cityTiles: [], improve: [], target: [] };

export interface RendererCallbacks {
  onTileTap(idx: TileIdx): void;
  onTileLongPress(idx: TileIdx): void;
  /** hovering (desktop) for path previews */
  onTileHover?(idx: TileIdx | null): void;
}

export interface Renderer {
  /** full resync from state (new game / load / after big changes); cheap enough to call after each dispatch */
  sync(state: GameState): void;
  /** animate a batch of events (moves, combat, founding, reveals). Resolves when visual playback completes. */
  play(events: SimEvent[], state: GameState): Promise<void>;
  setHighlights(h: Highlights): void;
  focusTile(idx: TileIdx, opts?: { animate?: boolean; zoom?: 'near' | 'mid' | 'far' }): void;
  /** screen-space CSS pixel position of a tile center (for DOM overlays like floating numbers), null if off-screen */
  screenPos(idx: TileIdx): { x: number; y: number } | null;
  setQuality(q: 'low' | 'high'): void;
  /** attract-mode camera for the main menu backdrop */
  setAttractMode(on: boolean): void;
  resize(): void;
  dispose(): void;
}

let current: Renderer | null = null;
export function setRenderer(r: Renderer | null): void {
  current = r;
}
export function getRenderer(): Renderer | null {
  return current;
}
