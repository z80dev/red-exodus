// OWNER: ContentCiv. Unit promotions: 3 tiers. On level-up the sim applies one automatically (sim/units.ts
// bestPromotion): among those the unit qualifies for (class listed in `classes`, every id in `requires` already
// owned, not yet owned, tier unlocked by level) it takes the highest tier, then the first in this list's order.
// `combat(a, unit)` is pure: it only pushes modifiers onto the promoted unit's side (a.side).
// `onKill` rewards (gold/heal/xp) are applied by sim/combat.ts when the promoted unit destroys an enemy unit.
import type { CombatArgs, PromotionDef, UnitClass } from '../sim/defs';
import type { Tile } from '../sim/types';
import { UNITS } from './units';

const LAND_MILITARY: UnitClass[] = ['melee', 'antiCavalry', 'ranged', 'mounted', 'siege', 'armor', 'recon'];
const FOOT: UnitClass[] = ['melee', 'antiCavalry', 'armor'];
const LINE: UnitClass[] = ['melee', 'antiCavalry'];
const RIDERS: UnitClass[] = ['mounted', 'armor'];
const SHOOTERS: UnitClass[] = ['ranged', 'siege'];
const SKIRMISH: UnitClass[] = ['melee', 'antiCavalry', 'recon', 'ranged'];
const STURDY: UnitClass[] = ['melee', 'antiCavalry', 'ranged', 'siege', 'armor'];

/** Push a modifier on the promoted unit's own side. */
function mod(a: CombatArgs, label: string, pct: number): void {
  (a.side === 'attack' ? a.attackMods : a.defenseMods).push({ label, pct });
}

/** The tile where this unit's fight happens: ranged attackers fight from their own tile, everyone else on the target tile. */
const battlefield = (a: CombatArgs): Tile => (a.side === 'attack' && a.ranged ? a.fromTile : a.tile);

const isOpen = (t: Tile): boolean => t.elevation === 'flat' && (t.feature == null || t.feature === 'floodplains');
const isRough = (t: Tile): boolean => t.elevation === 'hills' || t.feature === 'forest' || t.feature === 'jungle' || t.feature === 'marsh';

/** Class of the enemy unit in this fight (null when fighting a city). */
function enemyClass(a: CombatArgs): UnitClass | null {
  const enemy = a.side === 'attack' ? a.defender : a.attacker;
  return enemy ? UNITS[enemy.type]?.class ?? null : null;
}

const LIST: PromotionDef[] = [
  // ───────── Tier 1 ─────────
  {
    id: 'drill_1', name: 'Dust Drill', tier: 1, classes: FOOT, icon: 'sword',
    description: '+15% combat strength on open ground.',
    combat(a) { if (isOpen(battlefield(a))) mod(a, 'Dust Drill', 15); },
  },
  {
    id: 'woodsman', name: 'Rock Ambush', tier: 1, classes: SKIRMISH, icon: 'tree',
    description: '+20% combat strength on rough ground (Hills, Rock Spires, Lava Tubes, Toxic Bogs).',
    combat(a) { if (isRough(battlefield(a))) mod(a, 'Rock Ambush', 20); },
  },
  {
    id: 'shield_wall', name: 'Blast Shield', tier: 1, classes: LINE, icon: 'shield',
    description: '+25% defense against ranged attacks.',
    combat(a) { if (a.side === 'defense' && a.ranged) mod(a, 'Blast Shield', 25); },
  },
  {
    id: 'volley', name: 'Long Rifle', tier: 1, classes: SHOOTERS, icon: 'feather',
    description: '+15% ranged attack.',
    combat(a) { if (a.side === 'attack' && a.ranged) mod(a, 'Long Rifle', 15); },
  },
  {
    id: 'charge', name: 'Rover Charge', tier: 1, classes: RIDERS, icon: 'horse',
    description: '+25% when attacking wounded units.',
    combat(a) { if (a.side === 'attack' && a.defender && a.defender.hp < 100) mod(a, 'Rover Charge', 25); },
  },
  {
    id: 'sentry', name: 'Far Sight', tier: 1, classes: LAND_MILITARY, icon: 'eye', vision: 1,
    description: '+1 vision.',
  },
  {
    id: 'field_medic', name: 'Suit Medic', tier: 1, classes: LAND_MILITARY, icon: 'hand', heal: 10,
    description: 'Heals +10 HP each turn.',
  },
  {
    id: 'pathfinder', name: 'Dust Navigator', tier: 1, classes: ['recon'], icon: 'compass', moves: 1,
    description: '+1 move.',
  },
  {
    id: 'ambusher', name: 'Intercept', tier: 1, classes: ['antiCavalry', 'recon'], icon: 'serpent',
    description: '+25% against mounted and armor units.',
    combat(a) { const c = enemyClass(a); if (c === 'mounted' || c === 'armor') mod(a, 'Intercept', 25); },
  },
  {
    id: 'berserker', name: 'Reckless Assault', tier: 1, classes: ['melee', 'mounted', 'armor'], icon: 'skull',
    description: '**+25% attack**, but −10% defense.',
    combat(a) { mod(a, 'Reckless Assault', a.side === 'attack' ? 25 : -10); },
  },
  {
    id: 'iron_hide', name: 'Metal Plating', tier: 1, classes: STURDY, icon: 'shield',
    description: '+15% defense.',
    combat(a) { if (a.side === 'defense') mod(a, 'Metal Plating', 15); },
  },

  // ───────── Tier 2 ─────────
  {
    id: 'drill_2', name: 'Dust Drill II', tier: 2, classes: FOOT, requires: ['drill_1'], icon: 'sword',
    description: 'Another +20% combat strength on open ground.',
    combat(a) { if (isOpen(battlefield(a))) mod(a, 'Dust Drill II', 20); },
  },
  {
    id: 'ranger', name: 'Rock Ranger', tier: 2, classes: SKIRMISH, requires: ['woodsman'], icon: 'tree', vision: 1,
    description: 'Another +20% on rough ground, and +1 vision.',
    combat(a) { if (isRough(battlefield(a))) mod(a, 'Rock Ranger', 20); },
  },
  {
    id: 'testudo', name: 'Pressure Shell', tier: 2, classes: LINE, requires: ['shield_wall'], icon: 'shield',
    description: 'Another +25% defense against ranged attacks, and +10% defense against melee.',
    combat(a) { if (a.side === 'defense') mod(a, 'Pressure Shell', a.ranged ? 25 : 10); },
  },
  {
    id: 'barrage', name: 'Power Barrage', tier: 2, classes: SHOOTERS, requires: ['volley'], icon: 'flame',
    description: 'Another +20% ranged attack.',
    combat(a) { if (a.side === 'attack' && a.ranged) mod(a, 'Power Barrage', 20); },
  },
  {
    id: 'deadeye', name: 'Target Lock', tier: 2, classes: ['ranged'], requires: ['volley'], icon: 'eye',
    description: '**+30% ranged attack**, but −20% defense.',
    combat(a) {
      if (a.side === 'attack' && a.ranged) mod(a, 'Target Lock', 30);
      else if (a.side === 'defense') mod(a, 'Target Lock', -20);
    },
  },
  {
    id: 'flanker', name: 'Dust Flanker', tier: 2, classes: RIDERS, requires: ['charge'], icon: 'horse',
    description: '+15% attack against units (not colonies).',
    combat(a) { if (a.side === 'attack' && a.defender && !a.defenderCity) mod(a, 'Dust Flanker', 15); },
  },
  {
    id: 'plunderer', name: 'Scavenger', tier: 2, classes: ['melee', 'mounted', 'armor'], requires: ['berserker'], icon: 'coin',
    onKill: { gold: 20 },
    description: '+10% attack. **Each kill gives +20 {gold}.**',
    combat(a) { if (a.side === 'attack') mod(a, 'Scavenger', 10); },
  },
  {
    id: 'triage', name: 'Field Repairs', tier: 2, classes: LAND_MILITARY, requires: ['field_medic'], icon: 'hand', heal: 15,
    description: 'Heals another +15 HP each turn. +15% defense while hurt.',
    combat(a, unit) { if (a.side === 'defense' && unit.hp < 100) mod(a, 'Field Repairs', 15); },
  },
  {
    id: 'bulwark', name: 'Ground Bastion', tier: 2, classes: STURDY, requires: ['iron_hide'], icon: 'tower',
    description: '+15% defense, and another +20% while fortified.',
    combat(a, unit) { if (a.side === 'defense') mod(a, 'Ground Bastion', unit.fortifyTurns > 0 ? 35 : 15); },
  },
  {
    id: 'trailblazer', name: 'Horizon Runner', tier: 2, classes: ['recon'], requires: ['pathfinder'], icon: 'compass', moves: 1, vision: 1,
    description: '+1 move and +1 vision.',
  },

  // ───────── Tier 3 ─────────
  {
    id: 'blitz', name: 'Dust Sprint', tier: 3, classes: RIDERS, requires: ['flanker'], icon: 'bolt', moves: 1,
    description: '+1 move. Strike deeper, retreat faster.',
  },
  {
    id: 'longshot', name: 'Long Coil', tier: 3, classes: SHOOTERS, requires: ['barrage'], icon: 'star', range: 1,
    description: '+1 range.',
  },
  {
    id: 'warlord', name: 'Command Frame', tier: 3, classes: FOOT, requires: ['drill_2'], icon: 'crown',
    onKill: { heal: 25 },
    description: '+15% combat strength. **Each kill heals 25 HP.**',
    combat(a) { mod(a, 'Command Frame', 15); },
  },
  {
    id: 'last_stand', name: 'Final Airlock', tier: 3, classes: STURDY, requires: ['bulwark'], icon: 'laurel',
    description: '+50% defense below 50 HP. Nobody gets past this door.',
    combat(a, unit) { if (a.side === 'defense' && unit.hp < 50) mod(a, 'Final Airlock', 50); },
  },
  {
    id: 'phantom', name: 'Storm Ghost', tier: 3, classes: SKIRMISH, requires: ['ranger'], icon: 'moon', moves: 1,
    onKill: { xp: 5 },
    description: '+1 move. +15% attack from rough ground. Each kill gives +5 XP.',
    combat(a) { if (a.side === 'attack' && isRough(a.fromTile)) mod(a, 'Storm Ghost', 15); },
  },
];

export const PROMOTIONS: Record<string, PromotionDef> = Object.fromEntries(LIST.map((p) => [p.id, p]));
