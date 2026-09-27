// OWNER: ContentCiv. Natural wonders: tile yields + happiness for whoever owns the tile, and a permanent
// empire-wide perk (`effects`) for EVERY player who has discovered it (see sim/effects.ts collectEffects).
import type { NaturalWonderDef } from '../sim/defs';
import type { Yields } from '../sim/types';

const y = (food = 0, prod = 0, gold = 0, sci = 0, cul = 0): Yields => ({ food, prod, gold, sci, cul });

const LIST: NaturalWonderDef[] = [
  {
    id: 'sky_arch', name: 'The Sky Arch', yields: y(0, 0, 2, 0, 3), happiness: 2, terrains: ['desert', 'plains'], impassable: false,
    model: 'nw_sky_arch',
    description: 'A colossal ribbon of red stone bridging the heavens. **Discovered:** all your units gain +1 vision.',
    effects: {
      unitVision(_ctx, a) { a.value += 1; },
    },
  },
  {
    id: 'ember_peak', name: 'Ember Peak', yields: y(0, 3, 0, 2), happiness: 1, terrains: ['plains', 'grassland', 'tundra'], impassable: true,
    model: 'nw_ember_peak',
    description: 'A smoldering volcano whose ash makes the soil sing. **Discovered:** every Mine and Quarry you own yields +1 {prod}.',
    effects: {
      tileYield(_ctx, a) {
        if (!a.tile.pillaged && (a.tile.improvement === 'mine' || a.tile.improvement === 'quarry')) a.yields.prod += 1;
      },
    },
  },
  {
    id: 'crystal_falls', name: 'Crystal Falls', yields: y(2, 0, 0, 3), happiness: 2, terrains: ['grassland', 'tundra'], impassable: true,
    model: 'nw_crystal_falls',
    description: 'Waterfalls tumbling over prisms of quartz, scattering rainbows. **Discovered:** +10% {sci} in every city.',
    effects: {
      cityYield(_ctx, a) { a.pct.sci += 10; },
    },
  },
  {
    id: 'elder_tree', name: 'The Elder Tree', yields: y(3, 0, 0, 0, 2), happiness: 3, terrains: ['grassland', 'plains'], impassable: false,
    model: 'nw_elder_tree',
    description: 'A tree older than language, its canopy a forest in itself. **Discovered:** forests and jungles in your territory yield +1 {cul}.',
    effects: {
      tileYield(_ctx, a) {
        if (a.tile.feature === 'forest' || a.tile.feature === 'jungle') a.yields.cul += 1;
      },
    },
  },
  {
    id: 'titan_bones', name: 'Bones of the Titan', yields: y(0, 0, 1, 2, 2), happiness: 1, terrains: ['desert', 'plains', 'tundra'], impassable: false,
    model: 'nw_titan_bones',
    description: 'The ribcage of some impossible giant, half-buried in the earth. **Discovered:** your units fight with +10% combat strength.',
    effects: {
      combat(_ctx, a) {
        if (a.side === 'attack') a.attackMods.push({ label: 'Titan\u2019s Courage', pct: 10 });
        else a.defenseMods.push({ label: 'Titan\u2019s Courage', pct: 10 });
      },
    },
  },
  {
    id: 'mirror_lake', name: 'Mirror Lake', yields: y(2, 0, 2, 0, 1), happiness: 2, terrains: ['grassland', 'tundra', 'plains'], impassable: true,
    model: 'nw_mirror_lake',
    description: 'A lake so still it holds a second sky. **Discovered:** +1 {influence} at the end of every chapter.',
    effects: {
      influenceIncome(_ctx, a) { a.lines.push({ label: 'Mirror Lake', amount: 1 }); },
    },
  },
];

export const NATURAL_WONDERS: Record<string, NaturalWonderDef> = Object.fromEntries(LIST.map((n) => [n.id, n]));
