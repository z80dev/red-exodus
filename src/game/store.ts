// Global app store (zustand). GameState is mutated in place by the sim; `version` bumps after every
// successful dispatch so React re-renders. Read sim data in components via useSim(selector).
import { create } from 'zustand';
import { applyAction, createGame } from '../sim/engine';
import type { Action, ActionResult, GameConfig, GameState, TileIdx } from '../sim/types';
import { bus } from './bus';
import { clearRun, loadRun, saveRun } from './save';

export type Screen = 'boot' | 'menu' | 'newRun' | 'game' | 'codex' | 'settings' | 'summary';
export type Selection = { kind: 'unit'; id: number } | { kind: 'city'; id: number } | { kind: 'tile'; idx: TileIdx } | null;
/** full-screen or sheet panels over the map (owned by UI agents) */
export type Panel = 'none' | 'city' | 'tech' | 'doctrines' | 'journal' | 'empire' | 'pause' | 'production' | 'improve';

export interface GameStore {
  screen: Screen;
  state: GameState | null;
  version: number;
  selection: Selection;
  panel: Panel;
  /** animations/AI in progress: input should be blocked */
  busy: boolean;
  /** interaction sub-mode on the map */
  mode: { kind: 'normal' } | { kind: 'edictTarget'; uid: number } | { kind: 'improve'; cityId: number | null };
  setScreen(s: Screen): void;
  select(sel: Selection): void;
  setPanel(p: Panel): void;
  setMode(m: GameStore['mode']): void;
  setBusy(b: boolean): void;
  newGame(config: GameConfig): void;
  continueGame(): Promise<boolean>;
  abandonRun(): Promise<void>;
  dispatch(action: Action): ActionResult;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleSave(state: GameState) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void saveRun(state), 250);
}

export const useGame = create<GameStore>((set, get) => ({
  screen: 'boot',
  state: null,
  version: 0,
  selection: null,
  panel: 'none',
  busy: false,
  mode: { kind: 'normal' },
  setScreen: (screen) => set({ screen }),
  select: (selection) => set({ selection }),
  setPanel: (panel) => set({ panel }),
  setMode: (mode) => set({ mode }),
  setBusy: (busy) => set({ busy }),
  newGame(config) {
    const { state, events } = createGame(config);
    set({ state, version: get().version + 1, selection: null, panel: 'none', mode: { kind: 'normal' }, screen: 'game' });
    void saveRun(state);
    bus.publish(events);
  },
  async continueGame() {
    const state = await loadRun();
    if (!state) return false;
    set({ state, version: get().version + 1, selection: null, panel: 'none', mode: { kind: 'normal' }, screen: 'game' });
    return true;
  },
  async abandonRun() {
    await clearRun();
    set({ state: null, selection: null, panel: 'none', screen: 'menu' });
  },
  dispatch(action) {
    const state = get().state;
    if (!state) return { ok: false, error: 'No game', events: [] };
    const res = applyAction(state, action);
    if (res.ok) {
      set({ version: get().version + 1 });
      if (state.gameOver) void clearRun();
      else scheduleSave(state);
      bus.publish(res.events);
    }
    return res;
  },
}));

/** Subscribe a component to sim changes and derive a value. Re-evaluates on every dispatch. */
export function useSim<T>(fn: (s: GameState) => T): T | null {
  useGame((g) => g.version);
  const s = useGame.getState().state;
  return s ? fn(s) : null;
}
