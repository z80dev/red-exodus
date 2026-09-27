import type { GameState } from '../../../sim/types';
import type { GameStore } from '../../../game/store';

export interface TutorialStep {
  id: string;
  title: string;
  text: string;
  target?: string;
  icon: string;
  ready(state: GameState, ui: GameStore): boolean;
  complete?(state: GameState, ui: GameStore): boolean;
}
export const TUTORIAL_STEPS: TutorialStep[] = [
  { id: 'crisis', title: 'The storm on the horizon', text: 'This Crisis arrives in chapter III. Read its rules now: you have two chapters to prepare. Nothing strikes without warning.', icon: 'crisis', target: 'crisis-reveal', ready: (s) => s.run.phase === 'crisisReveal' },
  { id: 'chapter', title: 'Give this chapter a purpose', text: 'Your Focus doubles one Pillar’s Renown. Choose what your empire does best. An Omen is an optional goal with an extra reward.', icon: 'omen', target: 'chapter-start', ready: (s) => s.run.phase === 'chapterStart' },
  { id: 'select-settler', title: 'A civilization begins with you', text: 'Tap your Settler on the map. A good home has food for growth and hills for production. Rivers make fertile beginnings.', icon: 'civilian', ready: (s) => s.run.phase === 'playing' && !Object.values(s.cities).some((c) => c.owner === 0), complete: (s, ui) => ui.selection?.kind === 'unit' && s.units[ui.selection.id]?.type === 'settler' || Object.values(s.cities).some((c) => c.owner === 0) },
  { id: 'found-city', title: 'Lay the first stone', text: 'Use Found City to establish your capital. This is the heart of your empire: protect it. Every new city also earns Prosperity Renown.', icon: 'found', target: 'found-city', ready: (s, ui) => s.run.phase === 'playing' && ui.selection?.kind === 'unit' && s.units[ui.selection.id]?.type === 'settler', complete: (s) => Object.values(s.cities).some((c) => c.owner === 0) },
  { id: 'production', title: 'Put your people to work', text: 'Tap your city and choose its next production. A Scout discovers opportunities; a Warrior keeps your borders safe. Buildings strengthen your engine.', icon: 'prod', target: 'production', ready: (s) => s.run.phase === 'playing' && Object.values(s.cities).some((c) => c.owner === 0), complete: (s) => Object.values(s.cities).some((c) => c.owner === 0 && c.queue.length > 0) },
  { id: 'research', title: 'The future starts with a question', text: 'Open research and choose a technology. Science unlocks units, buildings and improvements, and earns Discovery Renown along the way.', icon: 'sci', target: 'research', ready: (s) => s.run.phase === 'playing' && Object.values(s.cities).some((c) => c.owner === 0), complete: (s) => !!s.players.find((p) => p.isHuman)?.researching || (s.players.find((p) => p.isHuman)?.techs.length ?? 0) > 0 },
  { id: 'end-turn', title: 'Let history move forward', text: 'Next cycles through units and cities that need orders. Once you are ready, End Turn gathers yields and advances your rivals. No rush: time waits for you.', icon: 'endturn', target: 'end-turn', ready: (s) => s.run.phase === 'playing' && Object.values(s.cities).some((c) => c.owner === 0), complete: (s) => s.turn > 1 },
  { id: 'legacy', title: 'Build an empire worth remembering', text: 'Renown × Splendor = Legacy. Your achievements provide Renown; cities and Doctrines build the multiplier. Reach the target before the chapter closes.', icon: 'renown', target: 'legacy', ready: (s) => s.run.phase === 'playing' && s.turn > 1 },
  { id: 'chronicle', title: 'Your deeds become legend', text: 'Watch the six Pillars, your cities and your Doctrines score in order. Beat the target to preserve Mandate. Double it for a Triumph and extra Influence.', icon: 'book', target: 'chronicle', ready: (s) => s.run.phase === 'chronicle' },
  { id: 'council', title: 'An empire is an engine of ideas', text: 'Spend Influence on lasting Doctrines, instant Edicts and Pillar-upgrading Scrolls. Doctrines trigger left to right: additions before multipliers can change everything.', icon: 'doctrine', target: 'council', ready: (s) => s.run.phase === 'council' },
  { id: 'combat', title: 'Choose your battles', text: 'The preview estimates damage on both sides. Terrain, health and allies matter. A strong defense can preserve your army—and your entire chronicle.', icon: 'sword', target: 'combat-preview', ready: (s) => s.run.phase === 'playing' && !!document.querySelector('[data-tutorial="combat-preview"]') },
];
