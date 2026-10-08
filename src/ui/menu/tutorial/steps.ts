import type { GameState } from '../../../sim/types';
import type { GameStore } from '../../../game/store';
import { doctrineSlotsUsed } from '../../../sim/roguelite';
import { T } from '../../terms';

export interface TutorialStep {
  id: string;
  /** ≤ 4 words */
  title: string;
  /** ≤ ~25 words, plain B2 English */
  text: string;
  /** `data-tutorial` value to spotlight */
  target?: string;
  icon: string;
  ready(state: GameState, ui: GameStore): boolean;
  complete?(state: GameState, ui: GameStore): boolean;
}
const playing = (state: GameState) => state.run.phase === 'playing';
const myCities = (state: GameState) => Object.values(state.cities).filter((c) => c.owner === 0);
const pastFirstTurn = (state: GameState) => state.run.era > 0 || state.run.chapter > 0 || state.run.chapterTurn > 0;

/** The core loop, in the order a new player meets it. */
export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'capital', title: `Your ${T.capital}`, icon: 'city', target: 'production',
    text: `Your ${T.capital} is on Mars. Tap it on the map, then pick something to build.`,
    ready: (s) => playing(s) && myCities(s).length > 0,
    complete: (s) => myCities(s).some((c) => c.queue.length > 0),
  },
  {
    id: 'land-colony', title: T.drop, icon: 'drop', target: 'drop',
    text: `Tap the ${T.cryo} button, then pick a spot on the map. ${T.drop} uses one Pod to place a new ${T.city.toLowerCase()} there.`,
    ready: (s) => playing(s) && myCities(s).length > 0,
    complete: (s) => myCities(s).length > 1,
  },
  {
    id: 'storms', title: `Watch the ${T.storm.toLowerCase()}s`, icon: 'storm',
    text: `${T.storm}s move along the dotted path. They hurt units and lower Food and Production. Move your units out of the way.`,
    ready: (s) => playing(s) && s.storms.length > 0,
  },
  {
    id: 'research', title: `Pick ${T.tech.toLowerCase()}`, icon: 'tech', target: 'research',
    text: `When asked, pick 1 of 3 ${T.tech.toLowerCase()} options. ${T.tech} unlocks new builds and units. This button shows your progress.`,
    ready: (s) => playing(s) && !!s.players.find((p) => p.isHuman)?.researchOffer?.length,
  },
  {
    id: 'end-turn', title: 'End your turn', icon: 'endturn', target: 'end-turn',
    text: 'Done for now? Tap End Turn. If something still needs a choice, the button shows you where.',
    ready: (s) => playing(s) && myCities(s).some((c) => c.queue.length > 0),
    complete: pastFirstTurn,
  },
  {
    id: 'score', title: 'Beat the target', icon: 'renown', target: 'score',
    text: `At the end of each chapter, ${T.score} = ${T.renown} × ${T.splendor}. Reach the target, or you lose one of your ${T.mandate.toLowerCase()}.`,
    ready: (s) => playing(s) && pastFirstTurn(s),
  },
  {
    id: 'shop', title: `The ${T.council}`, icon: 'doctrine', target: 'council',
    text: `Spend ${T.influence} in the ${T.council} between chapters. Buy ${T.doctrines}: they give you bonuses every chapter.`,
    ready: (s) => s.run.phase === 'council',
  },
  {
    id: 'swap-crew', title: `Swap your ${T.doctrines}`, icon: 'influence', target: 'crew-slots',
    text: `Your ${T.doctrines} ${T.doctrineSlot.toLowerCase()}s are full. Tap a weak card and choose Sell to get ${T.influence}. Then buy a better one.`,
    ready: (s) => s.run.phase === 'council' && doctrineSlotsUsed(s.run) >= s.run.doctrineSlots,
  },
];
