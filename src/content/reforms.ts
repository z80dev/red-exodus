// OWNER: ContentRogue. Reforms — the Balatro voucher set. Permanent run upgrades bought at the Council, one per
// era; each tier-2 reform requires its tier-1 predecessor. Hooks run for the human only (see effects.ts).
import type { HookCtx, ReformDef } from '../sim/defs';
import type { CouncilState } from '../sim/types';
import { PILLARS } from '../sim/types';
import { pushDoctrineCard, repriceCouncil } from './doctrines';
import { changeMandate } from '../sim/roguelite';
import { INTEREST_CAP, INTEREST_PER } from '../sim/roguelite/constants';

/** interest earned beyond the base cap: +1 per INTEREST_PER banked, for the `band`-th block of 5 above the cap */
function extraInterest(ctx: HookCtx, band: number): number {
  const raw = Math.floor(Math.max(0, ctx.state.run.influence) / INTEREST_PER) - INTEREST_CAP - 5 * band;
  return Math.max(0, Math.min(5, raw));
}

function loseMaxMandate(ctx: HookCtx): void {
  const run = ctx.state.run;
  run.maxMandate = Math.max(1, run.maxMandate - 1);
  if (run.mandate <= run.maxMandate) return;
  const delta = run.maxMandate - run.mandate;
  run.mandate = run.maxMandate;
  ctx.emit({ type: 'mandateChanged', value: run.mandate, delta });
}

function councilOpen(ctx: HookCtx): CouncilState | null {
  const run = ctx.state.run;
  return run.phase === 'council' && run.council ? run.council : null;
}

const LIST: ReformDef[] = [
  // ── doctrine slots ──
  {
    id: 'expanded_council', name: 'Expanded Council', tier: 1, cost: 10, icon: 'doctrine',
    description: '**+1** Doctrine slot.',
    effects: {
      onGain(ctx) { ctx.state.run.doctrineSlots += 1; },
      onLose(ctx) { ctx.state.run.doctrineSlots = Math.max(0, ctx.state.run.doctrineSlots - 1); },
    },
  },
  {
    id: 'grand_council', name: 'Grand Council', tier: 2, requires: 'expanded_council', cost: 14, icon: 'crown',
    description: '**+1** more Doctrine slot.',
    effects: {
      onGain(ctx) { ctx.state.run.doctrineSlots += 1; },
      onLose(ctx) { ctx.state.run.doctrineSlots = Math.max(0, ctx.state.run.doctrineSlots - 1); },
    },
  },

  // ── edict slots ──
  {
    id: 'royal_archives', name: 'Royal Archives', tier: 1, cost: 10, icon: 'edict',
    description: '**+1** Edict slot.',
    effects: {
      onGain(ctx) { ctx.state.run.edictSlots += 1; },
      onLose(ctx) { ctx.state.run.edictSlots = Math.max(0, ctx.state.run.edictSlots - 1); },
    },
  },
  {
    id: 'imperial_archives', name: 'Imperial Archives', tier: 2, requires: 'royal_archives', cost: 12, icon: 'book',
    description: '**+1** more Edict slot.',
    effects: {
      onGain(ctx) { ctx.state.run.edictSlots += 1; },
      onLose(ctx) { ctx.state.run.edictSlots = Math.max(0, ctx.state.run.edictSlots - 1); },
    },
  },

  // ── council stock ──
  {
    id: 'open_markets', name: 'Open Markets', tier: 1, cost: 10, icon: 'pack',
    description: '**+1** Doctrine card in every Council, restocked when you reroll.',
    effects: {
      onGain(ctx) {
        const council = councilOpen(ctx);
        if (council) pushDoctrineCard(ctx.state, council);
      },
      council(ctx, a) { pushDoctrineCard(ctx.state, a.council); },
    },
  },
  {
    id: 'grand_bazaar', name: 'Grand Bazaar', tier: 2, requires: 'open_markets', cost: 12, icon: 'coin',
    description: '**+1** more Doctrine card in every Council, and Packs cost **1** {influence} less.',
    effects: {
      onGain(ctx) {
        const council = councilOpen(ctx);
        if (!council) return;
        pushDoctrineCard(ctx.state, council);
        repriceCouncil(ctx.state, council);
      },
      council(ctx, a) {
        pushDoctrineCard(ctx.state, a.council);
        repriceCouncil(ctx.state, a.council);
      },
    },
  },

  // ── rerolls ──
  {
    id: 'swift_couriers', name: 'Swift Couriers', tier: 1, cost: 10, icon: 'reroll',
    description: 'Council rerolls cost **1** {influence} less.',
    effects: {
      onGain(ctx) {
        const council = councilOpen(ctx);
        if (council) council.rerollCost = Math.max(0, council.rerollCost - 1);
      },
      council(_ctx, a) {
        if (!a.reroll) a.council.rerollCost = Math.max(0, a.council.rerollCost - 1);
      },
    },
  },
  {
    id: 'imperial_post', name: 'Imperial Post', tier: 2, requires: 'swift_couriers', cost: 12, icon: 'horse',
    description: 'Council rerolls cost a further **1** {influence} less (never below 0).',
    effects: {
      onGain(ctx) {
        const council = councilOpen(ctx);
        if (council) council.rerollCost = Math.max(0, council.rerollCost - 1);
      },
      council(_ctx, a) {
        if (!a.reroll) a.council.rerollCost = Math.max(0, a.council.rerollCost - 1);
      },
    },
  },

  // ── interest ──
  {
    id: 'royal_treasury', name: 'Royal Treasury', tier: 1, cost: 10, icon: 'influence',
    description: `Interest cap **+5**: keep earning **+1** {influence} per ${INTEREST_PER} banked, up to **+${INTEREST_CAP + 5}** per chapter.`,
    effects: {
      influenceIncome(ctx, a) {
        const n = extraInterest(ctx, 0);
        if (n > 0) a.lines.push({ label: 'Treasury interest', amount: n });
      },
    },
  },
  {
    id: 'sovereign_wealth', name: 'Sovereign Wealth', tier: 2, requires: 'royal_treasury', cost: 14, icon: 'gold',
    description: `Interest cap **+5** more: up to **+${INTEREST_CAP + 10}** {influence} interest per chapter.`,
    effects: {
      influenceIncome(ctx, a) {
        const n = extraInterest(ctx, 1);
        if (n > 0) a.lines.push({ label: 'Sovereign interest', amount: n });
      },
    },
  },

  // ── mandate ──
  {
    id: 'heavenly_mandate', name: 'Heavenly Mandate', tier: 1, cost: 10, icon: 'mandate',
    description: '**+1** maximum {mandate} and **+1** {mandate}.',
    effects: {
      onGain(ctx) {
        ctx.state.run.maxMandate += 1;
        changeMandate(ctx.state, 1, 'Heavenly Mandate', ctx.emit);
      },
      onLose: loseMaxMandate,
    },
  },
  {
    id: 'eternal_mandate', name: 'Eternal Mandate', tier: 2, requires: 'heavenly_mandate', cost: 14, icon: 'sun',
    description: '**+1** maximum {mandate}, then your {mandate} is fully restored.',
    effects: {
      onGain(ctx) {
        const run = ctx.state.run;
        run.maxMandate += 1;
        changeMandate(ctx.state, run.maxMandate - run.mandate, 'Eternal Mandate', ctx.emit);
      },
      onLose: loseMaxMandate,
    },
  },

  // ── pillars ──
  {
    id: 'scholarly_canon', name: 'Scholarly Canon', tier: 1, cost: 10, icon: 'scroll',
    description: 'Your current Focus Pillar gains **+1** level.',
    effects: {
      onGain(ctx) {
        const run = ctx.state.run;
        run.pillarLevels[run.focus] = (run.pillarLevels[run.focus] ?? 1) + 1;
        ctx.counters.pillar = PILLARS.indexOf(run.focus);
      },
      onLose(ctx) {
        const pillar = PILLARS[ctx.counters.pillar ?? -1];
        if (!pillar) return;
        const levels = ctx.state.run.pillarLevels;
        levels[pillar] = Math.max(1, (levels[pillar] ?? 1) - 1);
      },
    },
  },
  {
    id: 'codified_canon', name: 'Codified Canon', tier: 2, requires: 'scholarly_canon', cost: 14, icon: 'book',
    description: 'Every Pillar gains **+1** level.',
    effects: {
      onGain(ctx) {
        const levels = ctx.state.run.pillarLevels;
        for (const p of PILLARS) levels[p] = (levels[p] ?? 1) + 1;
      },
      onLose(ctx) {
        const levels = ctx.state.run.pillarLevels;
        for (const p of PILLARS) levels[p] = Math.max(1, (levels[p] ?? 1) - 1);
      },
    },
  },
];

export const REFORMS: Record<string, ReformDef> = Object.fromEntries(LIST.map((r) => [r.id, r]));
