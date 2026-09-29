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
const playing = (state: GameState) => state.run.phase === 'playing';
export const TUTORIAL_STEPS: TutorialStep[] = [
  { id: 'landfall', title: 'Landfall', text: 'Your Ark Hab is already down. The Militia keeps the doors shut; the Scout Rover looks for useful trouble. Select your Ark Hab to set the colony’s first job.', icon: 'city', target: 'production', ready: (s) => playing(s) && Object.values(s.cities).some((c) => c.owner === 0), complete: (s) => Object.values(s.cities).some((c) => c.owner === 0 && c.queue.length > 0) },
  { id: 'orbital-drop', title: 'An entire colony, from orbit', text: 'Orbital Drop spends a Cryo pod to land a colony instantly on an explored, storm-free site within range. Your Ark Hab is not a one-city plan.', icon: 'drop', ready: (s) => playing(s) && Object.values(s.cities).some((c) => c.owner === 0) },
  { id: 'storms', title: 'Read the dust', text: 'Dust storms telegraph their next path. Cells cut Food and Industry, block drops, and hurt exposed units. Mars does not accept weather complaints.', icon: 'storm', ready: (s) => playing(s) },
  { id: 'breakthrough', title: 'A Breakthrough is a draft', text: 'Research completion offers three technologies. Choose one for your next step; reroll the offer for Credits if the future looks particularly grim.', icon: 'breakthrough', target: 'research', ready: (s) => playing(s) && !!s.players.find((p) => p.isHuman)?.researchOffer?.length },
  { id: 'sol-report', title: 'Your Sol Report', text: 'Each chapter turns your achievements into Viability: Output × Hope. Beat the target to keep your Charter. Double it for a Triumph and extra Scrip.', icon: 'journal', target: 'chronicle', ready: (s) => s.run.phase === 'chronicle' },
  { id: 'uplink', title: 'The Uplink', text: 'Spend Scrip on Crew, Salvage, Blueprints, Supply Drops and Ark Modules. Crew trigger left to right: order can turn a desperate colony into a machine.', icon: 'doctrine', target: 'council', ready: (s) => s.run.phase === 'council' },
];
