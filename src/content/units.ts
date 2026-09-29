// OWNER: ContentCiv. Unit roster. Strength curve ≈ Civ V (8 → 14 → 21 → 30 → 45 → 70) compressed for a
// ~120-turn run. `strength` is melee strength (and defense for ranged/siege). Leader uniques (content/uniques.ts,
// ContentRogue) are appended at the end of UNITS and reuse the replaced unit's model.
//
// Upgrade lines:
//   warrior → swordsman → man_at_arms → musketman → rifleman → infantry
//   archer → crossbowman → field_gun → machine_gun
//   spearman → pikeman → at_gun
//   horseman → knight → cavalry → tank   (chariot → knight, lancer → cavalry)
//   catapult → trebuchet → cannon → artillery → rocket_artillery
import type { UnitDef } from '../sim/defs';
import { UNIQUE_UNITS } from './uniques';

/** Anti-cavalry bonus (spearman line): +100% vs mounted. */
const VS_MOUNTED = { mounted: 100 } as const;
/** Siege: +200% vs cities. */
const VS_CITY_SIEGE = { city: 200 } as const;
/** Cavalry is poor at assaulting fortified cities. */
const MOUNTED_VS_CITY = { city: -33 } as const;

type UnitSpec = Omit<UnitDef, 'model' | 'icon'> & { icon?: string };

function unit(spec: UnitSpec): UnitDef {
  return { ...spec, model: `u_${spec.id}`, icon: spec.icon ?? spec.class };
}

const LIST: UnitDef[] = [
  // ───────── civilian & recon ─────────
  unit({
    id: 'settler', name: 'Hab Crawler', era: 0, class: 'civilian', cost: 40, strength: 0, moves: 2, vision: 2, tech: null,
    abilities: ['foundCity'],
    description: 'A tracked carrier for a folded hab module. **Founds a colony** and costs 1 {food} population. Defenseless; do not send it alone.',
  }),
  unit({
    id: 'scout', name: 'Scout Rover', era: 0, class: 'recon', cost: 18, strength: 4, moves: 3, vision: 3, tech: null,
    abilities: ['ignoreTerrain', 'noZoc'],
    description: 'A quick rover with a comically large antenna. Ignores terrain costs and zones of control; first to Crash Sites, Landmarks and rivals.',
  }),

  // ───────── Era 0 · Ancient ─────────
  unit({
    id: 'warrior', name: 'Militia', era: 0, class: 'melee', cost: 20, strength: 8, moves: 2, vision: 2, tech: null,
    upgradesTo: 'swordsman',
    description: 'Survivors in patched EVA suits, armed with whatever the cargo manifest missed. Cheap and sturdy.',
  }),
  unit({
    id: 'archer', name: 'Slug Thrower', era: 0, class: 'ranged', cost: 26, strength: 5, rangedStrength: 7, range: 2, moves: 2, vision: 2,
    tech: 'archery', upgradesTo: 'crossbowman', abilities: ['noMelee'],
    description: 'Fires scoped rifle rounds at targets 2 tiles away without return damage. Fragile at close range.',
  }),
  unit({
    id: 'spearman', name: 'Breacher', era: 0, class: 'antiCavalry', cost: 26, strength: 11, moves: 2, vision: 2,
    tech: 'bronze_working', upgradesTo: 'pikeman', bonusVs: { ...VS_MOUNTED },
    description: 'A riot shield and stun lance stop a rush cold. **+100%** vs mounted units.',
  }),
  unit({
    id: 'horseman', name: 'Dune Buggy', era: 0, class: 'mounted', cost: 32, strength: 12, moves: 4, vision: 2,
    tech: 'animal_husbandry', resource: 'horses', upgradesTo: 'knight', bonusVs: { ...MOUNTED_VS_CITY }, abilities: ['moveAfterAttack'],
    description: 'An open-frame rover that strikes and wheels away. Requires {icon:horses} Methane. −33% vs colonies.',
  }),

  // ───────── Era 1 · Classical ─────────
  unit({
    id: 'swordsman', name: 'Security Trooper', era: 1, class: 'melee', cost: 40, strength: 14, moves: 2, vision: 2,
    tech: 'iron_working', resource: 'iron', upgradesTo: 'man_at_arms',
    description: 'Armored suits and carbines hold the colony perimeter. Requires {icon:iron} Nickel-Iron.',
  }),
  unit({
    id: 'catapult', name: 'Mortar Team', era: 1, class: 'siege', cost: 42, strength: 7, rangedStrength: 14, range: 2, moves: 2, vision: 2,
    tech: 'mathematics', upgradesTo: 'trebuchet', bonusVs: { ...VS_CITY_SIEGE }, abilities: ['noMelee'],
    description: 'A bipod mortar team lobs shells over blast walls. **+200%** vs colonies.',
  }),
  unit({
    id: 'chariot', name: 'Assault Rover', era: 1, class: 'mounted', cost: 38, strength: 14, moves: 4, vision: 2,
    tech: 'the_wheel', resource: 'horses', upgradesTo: 'knight', bonusVs: { ...MOUNTED_VS_CITY }, abilities: ['moveAfterAttack'],
    description: 'Six wheels, armor and a turret make for a very persuasive arrival. Requires {icon:horses} Methane. −33% vs colonies.',
  }),

  // ───────── Era 2 · Medieval ─────────
  unit({
    id: 'man_at_arms', name: 'Exo-Trooper', era: 2, class: 'melee', cost: 60, strength: 21, moves: 2, vision: 2,
    tech: 'steel', resource: 'iron', upgradesTo: 'musketman',
    description: 'Heavy guns mounted on powered exoskeletons. Requires {icon:iron} Nickel-Iron.',
  }),
  unit({
    id: 'crossbowman', name: 'Coilgunner', era: 2, class: 'ranged', cost: 55, strength: 13, rangedStrength: 18, range: 2, moves: 2, vision: 2,
    tech: 'machinery', upgradesTo: 'field_gun', abilities: ['noMelee'],
    description: 'A coil rifle punches through hardsuit plating at 2 tiles.',
  }),
  unit({
    id: 'pikeman', name: 'Lancer Squad', era: 2, class: 'antiCavalry', cost: 50, strength: 16, moves: 2, vision: 2,
    tech: 'steel', upgradesTo: 'at_gun', bonusVs: { ...VS_MOUNTED },
    description: 'Shoulder-launched anti-vehicle tubes make a rush a brief memory. **+100%** vs mounted units.',
  }),
  unit({
    id: 'knight', name: 'Hover Bike', era: 2, class: 'mounted', cost: 65, strength: 22, moves: 4, vision: 2,
    tech: 'chivalry', resource: 'horses', upgradesTo: 'cavalry', bonusVs: { ...MOUNTED_VS_CITY }, abilities: ['moveAfterAttack'],
    description: 'A sleek hover bike flanks slower armor. Requires {icon:horses} Methane. −33% vs colonies.',
  }),
  unit({
    id: 'trebuchet', name: 'Rail Mortar', era: 2, class: 'siege', cost: 60, strength: 12, rangedStrength: 20, range: 2, moves: 2, vision: 2,
    tech: 'machinery', upgradesTo: 'cannon', bonusVs: { ...VS_CITY_SIEGE }, abilities: ['noMelee'],
    description: 'A tracked electromagnetic rail hurls projectiles through blast walls. **+200%** vs colonies.',
  }),

  // ───────── Era 3 · Renaissance ─────────
  unit({
    id: 'musketman', name: 'Power Armor', era: 3, class: 'melee', cost: 80, strength: 30, moves: 2, vision: 2,
    tech: 'gunpowder', resource: 'niter', upgradesTo: 'rifleman',
    description: 'Bulky powered armor brings its own life support and a very clear opinion. Requires {icon:niter} Perchlorates.',
  }),
  unit({
    id: 'cannon', name: 'Mass Driver', era: 3, class: 'siege', cost: 85, strength: 16, rangedStrength: 30, range: 2, moves: 2, vision: 2,
    tech: 'metallurgy', resource: 'niter', upgradesTo: 'artillery', bonusVs: { ...VS_CITY_SIEGE }, abilities: ['noMelee'],
    description: 'An electromagnetic cannon turns ammunition into high-speed regret. **+200%** vs colonies. Requires {icon:niter} Perchlorates.',
  }),
  unit({
    id: 'lancer', name: 'Strike Rover', era: 3, class: 'mounted', cost: 85, strength: 32, moves: 4, vision: 2,
    tech: 'metallurgy', resource: 'horses', upgradesTo: 'cavalry', bonusVs: { ...MOUNTED_VS_CITY }, abilities: ['moveAfterAttack'],
    description: 'Fast wedge-shaped rover hunts artillery. Requires {icon:horses} Methane. −33% vs colonies.',
  }),

  // ───────── Era 4 · Industrial ─────────
  unit({
    id: 'rifleman', name: 'Hardsuit Marine', era: 4, class: 'melee', cost: 110, strength: 45, moves: 2, vision: 2,
    tech: 'rifling', upgradesTo: 'infantry',
    description: 'Sleek hardsuits and accurate rifles anchor the modern line.',
  }),
  unit({
    id: 'field_gun', name: 'Plasma Caster', era: 4, class: 'ranged', cost: 110, strength: 30, rangedStrength: 42, range: 2, moves: 2, vision: 2,
    tech: 'military_science', upgradesTo: 'machine_gun', abilities: ['noMelee'],
    description: 'A tripod weapon spits superheated plasma at targets 2 tiles away.',
  }),
  unit({
    id: 'cavalry', name: 'Hover Skimmer', era: 4, class: 'mounted', cost: 115, strength: 48, moves: 5, vision: 2,
    tech: 'military_science', resource: 'horses', upgradesTo: 'tank', bonusVs: { ...MOUNTED_VS_CITY }, abilities: ['moveAfterAttack'],
    description: 'A fast open hover platform carries its gunner straight through a bad idea. Requires {icon:horses} Methane. −33% vs colonies.',
  }),
  unit({
    id: 'artillery', name: 'Arc Howitzer', era: 4, class: 'siege', cost: 125, strength: 24, rangedStrength: 50, range: 3, moves: 2, vision: 2,
    tech: 'ballistics', upgradesTo: 'rocket_artillery', bonusVs: { ...VS_CITY_SIEGE }, abilities: ['noMelee'],
    description: 'Capacitor coils drive indirect fire at **3 tiles**. **+200%** vs colonies.',
  }),

  // ───────── Era 5 · Modern ─────────
  unit({
    id: 'infantry', name: 'Titan Frame', era: 5, class: 'melee', cost: 160, strength: 70, moves: 2, vision: 2,
    tech: 'replaceable_parts',
    description: 'A compact bipedal mech, piloted by someone who is definitely not compensating.',
  }),
  unit({
    id: 'machine_gun', name: 'Pulse Turret', era: 5, class: 'ranged', cost: 150, strength: 50, rangedStrength: 65, range: 2, moves: 2, vision: 2,
    tech: 'replaceable_parts', abilities: ['noMelee'],
    description: 'A walking rotary pulse gun turns exposed ground into a bad place to be.',
  }),
  unit({
    id: 'at_gun', name: 'Lance Walker', era: 5, class: 'antiCavalry', cost: 140, strength: 55, moves: 2, vision: 2,
    tech: 'combined_arms', bonusVs: { mounted: 100, armor: 100 },
    description: 'A spider walker carries a long lance cannon. **+100%** vs mounted and armor.',
  }),
  unit({
    id: 'tank', name: 'Hovertank', era: 5, class: 'armor', cost: 185, strength: 75, moves: 5, vision: 2,
    tech: 'combined_arms', resource: 'oil', bonusVs: { city: -20 }, abilities: ['moveAfterAttack'],
    description: 'A heavy tank floats over broken terrain: 5 moves. Requires {icon:oil} Deuterium. −20% vs colonies.',
  }),
  unit({
    id: 'rocket_artillery', name: 'Swarm Launcher', era: 5, class: 'siege', cost: 190, strength: 35, rangedStrength: 75, range: 3, moves: 3, vision: 2,
    tech: 'rocketry', bonusVs: { ...VS_CITY_SIEGE }, abilities: ['noMelee'],
    description: 'Tracked missile boxes blanket targets at **3 tiles**. **+200%** vs colonies.',
  }),
];

export const UNITS: Record<string, UnitDef> = {
  ...Object.fromEntries(LIST.map((u) => [u.id, u])),
  ...UNIQUE_UNITS,
};
