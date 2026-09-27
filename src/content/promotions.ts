// OWNER: ContentCiv. Unit promotions: 3 tiers. On level-up a unit is offered 2 random promotions it qualifies for
// (class listed in `classes`, every id in `requires` already owned, not yet owned).
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

const vsCity = (a: CombatArgs): boolean => a.side === 'attack' && a.defenderCity != null;

const LIST: PromotionDef[] = [
  // ───────── Tier 1 ─────────
  {
    id: 'drill_1', name: 'Drill I', tier: 1, classes: FOOT, icon: 'sword',
    description: '+15% combat strength in open terrain.',
    combat(a) { if (isOpen(battlefield(a))) mod(a, 'Drill I', 15); },
  },
  {
    id: 'woodsman', name: 'Woodsman', tier: 1, classes: SKIRMISH, icon: 'tree',
    description: '+20% combat strength in rough terrain (hills, forest, jungle, marsh).',
    combat(a) { if (isRough(battlefield(a))) mod(a, 'Woodsman', 20); },
  },
  {
    id: 'shield_wall', name: 'Shield Wall', tier: 1, classes: LINE, icon: 'shield',
    description: '+25% defense against ranged attacks.',
    combat(a) { if (a.side === 'defense' && a.ranged) mod(a, 'Shield Wall', 25); },
  },
  {
    id: 'volley', name: 'Volley', tier: 1, classes: SHOOTERS, icon: 'feather',
    description: '+15% ranged attack strength.',
    combat(a) { if (a.side === 'attack' && a.ranged) mod(a, 'Volley', 15); },
  },
  {
    id: 'sappers', name: 'Sappers', tier: 1, classes: ['melee', 'siege'], icon: 'castle',
    description: '+25% when attacking cities.',
    combat(a) { if (vsCity(a)) mod(a, 'Sappers', 25); },
  },
  {
    id: 'charge', name: 'Charge', tier: 1, classes: RIDERS, icon: 'horse',
    description: '+25% when attacking wounded units.',
    combat(a) { if (a.side === 'attack' && a.defender && a.defender.hp < 100) mod(a, 'Charge', 25); },
  },
  {
    id: 'sentry', name: 'Sentry', tier: 1, classes: LAND_MILITARY, icon: 'eye', vision: 1,
    description: '+1 vision.',
  },
  {
    id: 'field_medic', name: 'Field Medic', tier: 1, classes: LAND_MILITARY, icon: 'hand', heal: 10,
    description: 'Heals +10 HP per turn.',
  },
  {
    id: 'pathfinder', name: 'Pathfinder', tier: 1, classes: ['recon'], icon: 'compass', moves: 1,
    description: '+1 movement.',
  },
  {
    id: 'ambusher', name: 'Ambusher', tier: 1, classes: ['antiCavalry', 'recon'], icon: 'serpent',
    description: '+25% vs mounted and armor units.',
    combat(a) { const c = enemyClass(a); if (c === 'mounted' || c === 'armor') mod(a, 'Ambusher', 25); },
  },
  {
    id: 'berserker', name: 'Berserker', tier: 1, classes: ['melee', 'mounted', 'armor'], icon: 'skull',
    description: 'Reckless fury: **+25% attack**, but −10% defense.',
    combat(a) { mod(a, 'Berserker', a.side === 'attack' ? 25 : -10); },
  },
  {
    id: 'iron_hide', name: 'Iron Hide', tier: 1, classes: STURDY, icon: 'shield',
    description: '+15% defense everywhere.',
    combat(a) { if (a.side === 'defense') mod(a, 'Iron Hide', 15); },
  },

  // ───────── Tier 2 ─────────
  {
    id: 'drill_2', name: 'Drill II', tier: 2, classes: FOOT, requires: ['drill_1'], icon: 'sword',
    description: 'Another +20% combat strength in open terrain.',
    combat(a) { if (isOpen(battlefield(a))) mod(a, 'Drill II', 20); },
  },
  {
    id: 'ranger', name: 'Ranger', tier: 2, classes: SKIRMISH, requires: ['woodsman'], icon: 'tree', vision: 1,
    description: 'Another +20% in rough terrain, and +1 vision.',
    combat(a) { if (isRough(battlefield(a))) mod(a, 'Ranger', 20); },
  },
  {
    id: 'testudo', name: 'Testudo', tier: 2, classes: LINE, requires: ['shield_wall'], icon: 'shield',
    description: 'Another +25% defense against ranged attacks, and +10% defense in melee.',
    combat(a) { if (a.side === 'defense') mod(a, 'Testudo', a.ranged ? 25 : 10); },
  },
  {
    id: 'barrage', name: 'Barrage', tier: 2, classes: SHOOTERS, requires: ['volley'], icon: 'flame',
    description: 'Another +20% ranged attack strength.',
    combat(a) { if (a.side === 'attack' && a.ranged) mod(a, 'Barrage', 20); },
  },
  {
    id: 'deadeye', name: 'Deadeye', tier: 2, classes: ['ranged'], requires: ['volley'], icon: 'eye',
    description: 'All-in marksmanship: **+30% ranged attack**, but −20% defense.',
    combat(a) {
      if (a.side === 'attack' && a.ranged) mod(a, 'Deadeye', 30);
      else if (a.side === 'defense') mod(a, 'Deadeye', -20);
    },
  },
  {
    id: 'breach', name: 'Breach', tier: 2, classes: ['melee', 'siege'], requires: ['sappers'], icon: 'castle',
    description: 'Another +35% when attacking cities.',
    combat(a) { if (vsCity(a)) mod(a, 'Breach', 35); },
  },
  {
    id: 'flanker', name: 'Flanker', tier: 2, classes: RIDERS, requires: ['charge'], icon: 'horse',
    description: '+15% attack against units (not cities).',
    combat(a) { if (a.side === 'attack' && a.defender && !a.defenderCity) mod(a, 'Flanker', 15); },
  },
  {
    id: 'plunderer', name: 'Plunderer', tier: 2, classes: ['melee', 'mounted', 'armor'], requires: ['berserker'], icon: 'coin',
    onKill: { gold: 20 },
    description: '+10% attack. **Each kill loots +20 {gold}.**',
    combat(a) { if (a.side === 'attack') mod(a, 'Plunderer', 10); },
  },
  {
    id: 'triage', name: 'Triage', tier: 2, classes: LAND_MILITARY, requires: ['field_medic'], icon: 'hand', heal: 15,
    description: 'Heals another +15 HP per turn; +15% defense while wounded.',
    combat(a, unit) { if (a.side === 'defense' && unit.hp < 100) mod(a, 'Triage', 15); },
  },
  {
    id: 'bulwark', name: 'Bulwark', tier: 2, classes: STURDY, requires: ['iron_hide'], icon: 'tower',
    description: '+15% defense; another +20% while fortified.',
    combat(a, unit) { if (a.side === 'defense') mod(a, 'Bulwark', unit.fortifyTurns > 0 ? 35 : 15); },
  },
  {
    id: 'trailblazer', name: 'Trailblazer', tier: 2, classes: ['recon'], requires: ['pathfinder'], icon: 'compass', moves: 1, vision: 1,
    description: '+1 movement and +1 vision.',
  },

  // ───────── Tier 3 ─────────
  {
    id: 'blitz', name: 'Blitz', tier: 3, classes: RIDERS, requires: ['flanker'], icon: 'bolt', moves: 1,
    description: '+1 movement. Strike deeper, retreat faster.',
  },
  {
    id: 'juggernaut', name: 'Juggernaut', tier: 3, classes: ['melee', 'siege'], requires: ['breach'], icon: 'skull',
    description: '+50% when attacking cities. Walls are merely a suggestion.',
    combat(a) { if (vsCity(a)) mod(a, 'Juggernaut', 50); },
  },
  {
    id: 'longshot', name: 'Longshot', tier: 3, classes: SHOOTERS, requires: ['barrage'], icon: 'star', range: 1,
    description: '+1 range.',
  },
  {
    id: 'warlord', name: 'Warlord', tier: 3, classes: FOOT, requires: ['drill_2'], icon: 'crown',
    onKill: { heal: 25 },
    description: '+15% combat strength everywhere. **Each kill heals 25 HP.**',
    combat(a) { mod(a, 'Warlord', 15); },
  },
  {
    id: 'last_stand', name: 'Last Stand', tier: 3, classes: STURDY, requires: ['bulwark'], icon: 'laurel',
    description: '+50% defense below 50 HP. Legends are born with their backs to the wall.',
    combat(a, unit) { if (a.side === 'defense' && unit.hp < 50) mod(a, 'Last Stand', 50); },
  },
  {
    id: 'phantom', name: 'Phantom', tier: 3, classes: SKIRMISH, requires: ['ranger'], icon: 'moon', moves: 1,
    onKill: { xp: 5 },
    description: '+1 movement; +15% attack from rough terrain. Kills grant +5 bonus XP.',
    combat(a) { if (a.side === 'attack' && isRough(a.fromTile)) mod(a, 'Phantom', 15); },
  },
];

export const PROMOTIONS: Record<string, PromotionDef> = Object.fromEntries(LIST.map((p) => [p.id, p]));
