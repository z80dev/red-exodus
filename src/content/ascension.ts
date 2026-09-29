// OWNER: ContentRogue. Ascension — the Balatro stakes. Levels are cumulative: every level ≤ the run's
// ascension applies. Hooks are collected for the human only, so buffs to rivals are applied from here.
import type { AscensionDef, CombatArgs, Scalar } from '../sim/defs';
import { BARBARIAN, HUMAN, YIELD_KEYS } from '../sim/types';
import { round1, sciencePerTurn } from '../sim/economy';
import { CRISIS_CHAPTER } from '../sim/roguelite/constants';
import { enemyOwnerOf, repriceCouncil } from './doctrines';

/** push a modifier onto the side opposing the hook owner */
function enemyMod(a: CombatArgs, label: string, pct: number): void {
  (a.side === 'attack' ? a.defenseMods : a.attackMods).push({ label, pct });
}

export const ASCENSIONS: AscensionDef[] = [
  {
    level: 1, name: 'Ambition',
    description: 'Chronicle targets **+5%**.',
    effects: {
      target(_ctx, a) {
        a.value *= 1.05;
      },
    },
  },
  {
    level: 2, name: 'Ambitious Rivals',
    description: 'Rival cities gain **+20%** {prod} toward units, buildings and wonders each turn.',
    effects: {
      turnStart(ctx) {
        for (const c of Object.values(ctx.state.cities)) {
          if (c.owner === HUMAN || c.owner === BARBARIAN || !c.queue.length || c.queue[0].kind === 'project') continue;
          const bonus = Math.round(Math.max(0, c.yields?.prod ?? 0) * 0.2);
          if (bonus > 0) c.prodStored += bonus;
        }
      },
    },
  },
  {
    level: 3, name: 'Thin Coffers',
    description: 'Every Council item costs **+1** {influence}.',
    effects: {
      council(ctx, a) {
        repriceCouncil(ctx.state, a.council);
      },
    },
  },
  {
    level: 4, name: 'Gathering Storm',
    description: 'Crisis chapter targets **×1.05**.',
    effects: {
      target(ctx, a) {
        const chapter = (a as Scalar & { chapter?: number }).chapter ?? ctx.state.run.chapter;
        if (chapter === CRISIS_CHAPTER) a.value *= 1.05;
      },
    },
  },
  {
    level: 5, name: 'Warlords',
    description: 'Barbarians fight at **+25%** strength and rivals at **+15%** against you.',
    effects: {
      combat(_ctx, a) {
        const enemy = enemyOwnerOf(a);
        if (enemy === BARBARIAN) enemyMod(a, 'Warlords', 25);
        else if (enemy !== HUMAN) enemyMod(a, 'Warlords', 15);
      },
    },
  },
  {
    level: 6, name: 'Fragile Mandate',
    description: 'Begin the run with **1 less** {mandate} Mandate.',
    effects: {
      onGain(ctx) {
        const run = ctx.state.run;
        run.maxMandate = Math.max(1, run.maxMandate - 1);
        run.mandate = Math.max(1, Math.min(run.maxMandate, run.mandate - 1));
      },
    },
  },
  {
    level: 7, name: 'The Long Night',
    description: 'Dark Ages cost a further **−10%** of every yield, and rivals research **+20%** faster.',
    effects: {
      cityYield(ctx, a) {
        if (!ctx.state.run.darkAge) return;
        for (const k of YIELD_KEYS) a.pct[k] -= 10;
      },
      turnStart(ctx) {
        for (const p of ctx.state.players) {
          if (!p.alive || p.id === HUMAN || p.id === BARBARIAN || !p.researching) continue;
          const bonus = round1(sciencePerTurn(ctx.state, p.id) * 0.2);
          if (bonus > 0) p.researchProgress[p.researching] = round1((p.researchProgress[p.researching] ?? 0) + bonus);
        }
      },
    },
  },
  {
    level: 8, name: "Aeon's End",
    description: 'Triumphs grant no {influence}, and Chronicle targets rise a further **+20%**.',
    effects: {
      target(_ctx, a) {
        a.value *= 1.2;
      },
      influenceIncome(_ctx, a) {
        const triumph = a.lines.find((l) => l.label === 'Triumph' && l.amount > 0);
        if (triumph) a.lines.push({ label: "Aeon's End", amount: -triumph.amount });
      },
    },
  },
];
