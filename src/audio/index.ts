// OWNER: Audio. STUB — replace. See docs/ARCHITECTURE.md §Audio for the API contract.
export type SfxName = string;
export type Mood = 'menu' | 'calm' | 'tension' | 'war' | 'crisis' | 'chronicle' | 'victory' | 'defeat';
export const audio = {
  init(): void {},
  sfx(name: SfxName, opts?: { pitch?: number; volume?: number }): void { void name; void opts; },
  setEra(era: number): void { void era; },
  setMood(mood: Mood): void { void mood; },
  setVolumes(v: { master?: number; music?: number; sfx?: number }): void { void v; },
};
