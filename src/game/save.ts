// Autosave of the in-progress run (IndexedDB via idb-keyval; structured clone keeps it exact).
import { del, get, set } from 'idb-keyval';
import type { GameState } from '../sim/types';

const KEY = 'aeons.run.v1';

export async function saveRun(state: GameState): Promise<void> {
  await set(KEY, state);
}

export async function loadRun(): Promise<GameState | null> {
  const s = (await get(KEY)) as GameState | undefined;
  return s && s.schema === 1 ? s : null;
}

export async function clearRun(): Promise<void> {
  await del(KEY);
}
