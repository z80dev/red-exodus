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
    id: 'settler', name: 'Settler', era: 0, class: 'civilian', cost: 40, strength: 0, moves: 2, vision: 2, tech: null,
    abilities: ['foundCity'],
    description: 'Pioneers who **found a new city**. Costs 1 {food} population from the city that trains them. Defenseless — escort them.',
  }),
  unit({
    id: 'scout', name: 'Scout', era: 0, class: 'recon', cost: 18, strength: 4, moves: 3, vision: 3, tech: null,
    abilities: ['ignoreTerrain', 'noZoc'],
    description: 'Fast explorer that ignores terrain costs and zones of control. First to ruins, natural wonders and rivals.',
  }),

  // ───────── Era 0 · Ancient ─────────
  unit({
    id: 'warrior', name: 'Warrior', era: 0, class: 'melee', cost: 20, strength: 8, moves: 2, vision: 2, tech: null,
    upgradesTo: 'swordsman',
    description: 'Club-wielding guardians of the first villages. Cheap, sturdy, and the root of the infantry line.',
  }),
  unit({
    id: 'archer', name: 'Archer', era: 0, class: 'ranged', cost: 26, strength: 5, rangedStrength: 7, range: 2, moves: 2, vision: 2,
    tech: 'archery', upgradesTo: 'crossbowman', abilities: ['noMelee'],
    description: 'Looses arrows at targets 2 tiles away without taking return damage. Weak in close combat.',
  }),
  unit({
    id: 'spearman', name: 'Spearman', era: 0, class: 'antiCavalry', cost: 26, strength: 11, moves: 2, vision: 2,
    tech: 'bronze_working', upgradesTo: 'pikeman', bonusVs: { ...VS_MOUNTED },
    description: 'A wall of bronze points. **+100%** vs mounted units.',
  }),
  unit({
    id: 'horseman', name: 'Horseman', era: 0, class: 'mounted', cost: 32, strength: 12, moves: 4, vision: 2,
    tech: 'animal_husbandry', resource: 'horses', upgradesTo: 'knight', bonusVs: { ...MOUNTED_VS_CITY }, abilities: ['moveAfterAttack'],
    description: 'Swift raiders that can move after attacking. Requires {icon:horses} Horses. −33% vs cities.',
  }),

  // ───────── Era 1 · Classical ─────────
  unit({
    id: 'swordsman', name: 'Swordsman', era: 1, class: 'melee', cost: 40, strength: 14, moves: 2, vision: 2,
    tech: 'iron_working', resource: 'iron', upgradesTo: 'man_at_arms',
    description: 'Disciplined iron-armed infantry, the hammer of classical armies. Requires {icon:iron} Iron.',
  }),
  unit({
    id: 'catapult', name: 'Catapult', era: 1, class: 'siege', cost: 42, strength: 7, rangedStrength: 14, range: 2, moves: 2, vision: 2,
    tech: 'mathematics', upgradesTo: 'trebuchet', bonusVs: { ...VS_CITY_SIEGE }, abilities: ['noMelee'],
    description: 'Hurls boulders over walls. **+200%** vs cities. Fragile when caught in the open.',
  }),
  unit({
    id: 'chariot', name: 'Chariot', era: 1, class: 'mounted', cost: 38, strength: 14, moves: 4, vision: 2,
    tech: 'the_wheel', resource: 'horses', upgradesTo: 'knight', bonusVs: { ...MOUNTED_VS_CITY }, abilities: ['moveAfterAttack'],
    description: 'Thundering war-carts that strike and wheel away. Requires {icon:horses} Horses. −33% vs cities.',
  }),

  // ───────── Era 2 · Medieval ─────────
  unit({
    id: 'man_at_arms', name: 'Man-at-Arms', era: 2, class: 'melee', cost: 60, strength: 21, moves: 2, vision: 2,
    tech: 'steel', resource: 'iron', upgradesTo: 'musketman',
    description: 'Plate-clad professional soldiers who hold any line. Requires {icon:iron} Iron.',
  }),
  unit({
    id: 'crossbowman', name: 'Crossbowman', era: 2, class: 'ranged', cost: 55, strength: 13, rangedStrength: 18, range: 2, moves: 2, vision: 2,
    tech: 'machinery', upgradesTo: 'field_gun', abilities: ['noMelee'],
    description: 'Mechanical bows that punch through mail at 2 tiles.',
  }),
  unit({
    id: 'pikeman', name: 'Pikeman', era: 2, class: 'antiCavalry', cost: 50, strength: 16, moves: 2, vision: 2,
    tech: 'steel', upgradesTo: 'at_gun', bonusVs: { ...VS_MOUNTED },
    description: 'Hedgehog formations of long pikes. **+100%** vs mounted units.',
  }),
  unit({
    id: 'knight', name: 'Knight', era: 2, class: 'mounted', cost: 65, strength: 22, moves: 4, vision: 2,
    tech: 'chivalry', resource: 'horses', upgradesTo: 'cavalry', bonusVs: { ...MOUNTED_VS_CITY }, abilities: ['moveAfterAttack'],
    description: 'Armored lances that shatter armies in the field. Requires {icon:horses} Horses. −33% vs cities.',
  }),
  unit({
    id: 'trebuchet', name: 'Trebuchet', era: 2, class: 'siege', cost: 60, strength: 12, rangedStrength: 20, range: 2, moves: 2, vision: 2,
    tech: 'machinery', upgradesTo: 'cannon', bonusVs: { ...VS_CITY_SIEGE }, abilities: ['noMelee'],
    description: 'Counterweight engines that crack castle walls. **+200%** vs cities.',
  }),

  // ───────── Era 3 · Renaissance ─────────
  unit({
    id: 'musketman', name: 'Musketman', era: 3, class: 'melee', cost: 80, strength: 30, moves: 2, vision: 2,
    tech: 'gunpowder', resource: 'niter', upgradesTo: 'rifleman',
    description: 'Gunpowder infantry that makes armor obsolete. Requires {icon:niter} Niter.',
  }),
  unit({
    id: 'cannon', name: 'Cannon', era: 3, class: 'siege', cost: 85, strength: 16, rangedStrength: 30, range: 2, moves: 2, vision: 2,
    tech: 'metallurgy', resource: 'niter', upgradesTo: 'artillery', bonusVs: { ...VS_CITY_SIEGE }, abilities: ['noMelee'],
    description: 'Bronze-barreled siege guns. **+200%** vs cities. Requires {icon:niter} Niter.',
  }),
  unit({
    id: 'lancer', name: 'Lancer', era: 3, class: 'mounted', cost: 85, strength: 32, moves: 4, vision: 2,
    tech: 'metallurgy', resource: 'horses', upgradesTo: 'cavalry', bonusVs: { ...MOUNTED_VS_CITY }, abilities: ['moveAfterAttack'],
    description: 'Light shock cavalry that rides down gunners. Requires {icon:horses} Horses. −33% vs cities.',
  }),

  // ───────── Era 4 · Industrial ─────────
  unit({
    id: 'rifleman', name: 'Rifleman', era: 4, class: 'melee', cost: 110, strength: 45, moves: 2, vision: 2,
    tech: 'rifling', upgradesTo: 'infantry',
    description: 'Accurate rifled muskets and drilled lines. The backbone of industrial armies.',
  }),
  unit({
    id: 'field_gun', name: 'Field Gun', era: 4, class: 'ranged', cost: 110, strength: 30, rangedStrength: 42, range: 2, moves: 2, vision: 2,
    tech: 'military_science', upgradesTo: 'machine_gun', abilities: ['noMelee'],
    description: 'Mobile guns that shred massed troops at 2 tiles.',
  }),
  unit({
    id: 'cavalry', name: 'Cavalry', era: 4, class: 'mounted', cost: 115, strength: 48, moves: 5, vision: 2,
    tech: 'military_science', resource: 'horses', upgradesTo: 'tank', bonusVs: { ...MOUNTED_VS_CITY }, abilities: ['moveAfterAttack'],
    description: 'Sabres and carbines at the gallop: 5 moves. Requires {icon:horses} Horses. −33% vs cities.',
  }),
  unit({
    id: 'artillery', name: 'Artillery', era: 4, class: 'siege', cost: 125, strength: 24, rangedStrength: 50, range: 3, moves: 2, vision: 2,
    tech: 'ballistics', upgradesTo: 'rocket_artillery', bonusVs: { ...VS_CITY_SIEGE }, abilities: ['noMelee'],
    description: 'Indirect fire at **3 tiles**. **+200%** vs cities.',
  }),

  // ───────── Era 5 · Modern ─────────
  unit({
    id: 'infantry', name: 'Infantry', era: 5, class: 'melee', cost: 160, strength: 70, moves: 2, vision: 2,
    tech: 'replaceable_parts',
    description: 'Modern riflemen with helmets, radios and grit. The line that does not break.',
  }),
  unit({
    id: 'machine_gun', name: 'Machine Gun', era: 5, class: 'ranged', cost: 150, strength: 50, rangedStrength: 65, range: 2, moves: 2, vision: 2,
    tech: 'replaceable_parts', abilities: ['noMelee'],
    description: 'A storm of lead that makes open ground a graveyard.',
  }),
  unit({
    id: 'at_gun', name: 'Anti-Tank Gun', era: 5, class: 'antiCavalry', cost: 140, strength: 55, moves: 2, vision: 2,
    tech: 'combined_arms', bonusVs: { mounted: 100, armor: 100 },
    description: 'High-velocity guns built to kill steel. **+100%** vs mounted and armor.',
  }),
  unit({
    id: 'tank', name: 'Tank', era: 5, class: 'armor', cost: 185, strength: 75, moves: 5, vision: 2,
    tech: 'combined_arms', resource: 'oil', bonusVs: { city: -20 }, abilities: ['moveAfterAttack'],
    description: 'Armored fists that break through and keep rolling: 5 moves. Requires {icon:oil} Oil. −20% vs cities.',
  }),
  unit({
    id: 'rocket_artillery', name: 'Rocket Artillery', era: 5, class: 'siege', cost: 190, strength: 35, rangedStrength: 75, range: 3, moves: 3, vision: 2,
    tech: 'rocketry', bonusVs: { ...VS_CITY_SIEGE }, abilities: ['noMelee'],
    description: 'Truck-mounted salvos at **3 tiles** that level fortresses. **+200%** vs cities.',
  }),
];

export const UNITS: Record<string, UnitDef> = {
  ...Object.fromEntries(LIST.map((u) => [u.id, u])),
  ...UNIQUE_UNITS,
};
