// OWNER: ContentRogue. Ascension — the Balatro stakes. Levels are cumulative: every level ≤ the run's
// ascension applies. Hooks are collected for the human only, so buffs to rivals are applied from here.
import type { AscensionDef, CombatArgs, Scalar } from '../sim/defs';
import { BARBARIAN, HUMAN } from '../sim/types';
import { round1, sciencePerTurn } from '../sim/economy';
import { CRISIS_CHAPTER } from '../sim/roguelite/constants';
import { DARK_AGE_LABEL, DARK_AGE_TARGET_MUL } from '../sim/roguelite/darkAge';
import { enemyOwnerOf, repriceCouncil } from './doctrines';

/** push a modifier onto the side opposing the hook owner */
function enemyMod(a: CombatArgs, label: string, pct: number): void {
  (a.side === 'attack' ? a.defenseMods : a.attackMods).push({ label, pct });
}

export const ASCENSIONS: AscensionDef[] = [
  {
    level: 1, name: 'Dust in the Gears',
    description: 'Sol Report targets **+5%**.',
    effects: {
      target(_ctx, a) {
        a.value *= 1.05;
      },
    },
  },
  {
    level: 2, name: 'Rival Overclock',
    description: 'Rival colonies gain **+20%** {prod} toward units, buildings and megaprojects each turn.',
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
    level: 3, name: 'Scrip Squeeze',
    description: 'Every Uplink item costs **+1** {influence}.',
    effects: {
      council(ctx, a) {
        repriceCouncil(ctx.state, a.council);
      },
    },
  },
  {
    level: 4, name: 'Storm Season',
    description: 'Crisis chapter targets **×1.05**.',
    effects: {
      target(ctx, a) {
        const chapter = (a as Scalar & { chapter?: number }).chapter ?? ctx.state.run.chapter;
        if (chapter === CRISIS_CHAPTER) a.value *= 1.05;
      },
    },
  },
  {
    level: 5, name: 'Hostile Perimeter',
    description: 'Feral units fight at **+25%** strength and rival units at **+15%** against you.',
    effects: {
      combat(_ctx, a) {
        const enemy = enemyOwnerOf(a);
        if (enemy === BARBARIAN) enemyMod(a, 'Warlords', 25);
        else if (enemy !== HUMAN) enemyMod(a, 'Warlords', 15);
      },
    },
  },
  {
    level: 6, name: 'Thin Charter',
    description: 'Begin the run with **1 less** {mandate} Charter.',
    effects: {
      onGain(ctx) {
        const run = ctx.state.run;
        run.maxMandate = Math.max(1, run.maxMandate - 1);
        run.mandate = Math.max(1, Math.min(run.maxMandate, run.mandate - 1));
      },
    },
  },
  {
    level: 7, name: 'No Lifeline',
    description: 'Missed Sol Reports bring no Lifeline (no target relief, no relief {influence}), and rivals research **+20%** faster.',
    effects: {
      target(ctx, a) {
        if (ctx.state.run.darkAge) a.value /= DARK_AGE_TARGET_MUL;
      },
      influenceIncome(_ctx, a) {
        const relief = a.lines.find((l) => l.label === DARK_AGE_LABEL && l.amount > 0);
        if (relief) a.lines.push({ label: 'No Lifeline', amount: -relief.amount });
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
    level: 8, name: 'No Return Trajectory',
    description: 'Triumphs and Overdrives grant no {influence}, and Sol Report targets rise a further **+20%**.',
    effects: {
      target(_ctx, a) {
        a.value *= 1.2;
      },
      influenceIncome(_ctx, a) {
        const bonus = a.lines.filter((l) => (l.label === 'Triumph' || l.label.startsWith('Overdrive')) && l.amount > 0)
          .reduce((s, l) => s + l.amount, 0);
        if (bonus) a.lines.push({ label: "Aeon's End", amount: -bonus });
      },
    },
  },
];
