// OWNER: Roguelite. Run structure: eras/chapters, chronicle scoring, council, omens, edicts, crises.
// Public entry points for the engine & UI; implementation lives in the sibling modules.
import type { Action, Emit, GameState } from '../types';
import { councilBuy, councilReroll, moveDoctrine, packPick, sellDoctrine } from './council';
import { discardEdict, useEdict } from './edicts';
import { ackChronicle, ackCrisis, chooseChapterStart, continueEndless, leaveCouncil } from './run';

export { chronicleTarget, computeChronicle, eraBaseTarget, previewChronicle, projectPillars } from './chronicle';
export {
  councilBuyError, councilRerollError, doctrinePrice, doctrineSlotsUsed, edictSlotsFree, packPickError, sellValueFor,
} from './council';
export { useEdictError } from './edicts';
export type { EdictTargetArgs } from './edicts';
export { omenGoal } from './omens';
export {
  addInfluence, changeMandate, defeatRun, grantDoctrine, initRun, isEndless, mapActionsAllowed, onTurnEnd,
} from './run';
export { addExtraStat, addStat, emptyStats, trackEvent } from './stats';
export { DARK_AGE_EFFECTS, DARK_AGE_LABEL, DARK_AGE_TARGET_MUL } from './darkAge';
export * from './constants';

const RUN_ACTIONS: Record<string, true> = {
  ackCrisis: true, chooseChapterStart: true, ackChronicle: true, councilBuy: true, councilReroll: true, packPick: true,
  sellDoctrine: true, moveDoctrine: true, useEdict: true, discardEdict: true, leaveCouncil: true, continueEndless: true,
};

export function isRunAction(action: Action): boolean {
  return RUN_ACTIONS[action.type] === true;
}

/** handles roguelite actions — returns error or null */
export function handleRunAction(state: GameState, action: Action, emit: Emit): string | null {
  if (state.gameOver) return 'The run is over';
  switch (action.type) {
    case 'ackCrisis': return ackCrisis(state);
    case 'chooseChapterStart': return chooseChapterStart(state, action.focus, action.omen, emit);
    case 'ackChronicle': return ackChronicle(state, emit);
    case 'councilBuy': return councilBuy(state, action.slot, emit);
    case 'councilReroll': return councilReroll(state, emit);
    case 'packPick': return packPick(state, action.index, emit);
    case 'sellDoctrine': return sellDoctrine(state, action.uid, emit);
    case 'moveDoctrine': return moveDoctrine(state, action.uid, action.toIndex);
    case 'useEdict': return useEdict(state, action.uid, { tile: action.target, cityId: action.cityId, unitId: action.unitId }, emit);
    case 'discardEdict': return discardEdict(state, action.uid);
    case 'leaveCouncil': return leaveCouncil(state, emit);
    case 'continueEndless': return continueEndless(state, emit);
    default: return 'Not a run action';
  }
}
