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

type UnitSpec = Omit<UnitDef, 'model' | 'icon'> & { icon?: string };

function unit(spec: UnitSpec): UnitDef {
  return { ...spec, model: `u_${spec.id}`, icon: spec.icon ?? spec.class };
}

const LIST: UnitDef[] = [
  // ───────── civilian & recon ─────────
  unit({
    id: 'settler', name: 'Colony Crawler', era: 0, class: 'civilian', cost: 40, strength: 0, moves: 2, vision: 2, tech: null,
    abilities: ['foundCity'],
    description: 'Founds a new colony and uses 1 population. It cannot fight, so protect it.',
  }),
  unit({
    id: 'scout', name: 'Scout Rover', era: 0, class: 'recon', cost: 18, strength: 4, moves: 3, vision: 3, tech: null,
    abilities: ['ignoreTerrain', 'noZoc'],
    description: 'Moves fast over any ground and past enemy units. Best at finding Crash Sites and Landmarks.',
  }),

  // ───────── Era 0 · Ancient ─────────
  unit({
    id: 'warrior', name: 'Militia', era: 0, class: 'melee', cost: 20, strength: 8, moves: 2, vision: 2, tech: null,
    upgradesTo: 'swordsman',
    description: 'Cheap and tough. A good first guard for a colony.',
  }),
  unit({
    id: 'archer', name: 'Slug Thrower', era: 0, class: 'ranged', cost: 26, strength: 5, rangedStrength: 7, range: 2, moves: 2, vision: 2,
    tech: 'archery', upgradesTo: 'crossbowman', abilities: ['noMelee'],
    description: 'Shoots enemies 2 tiles away and takes no damage back. Weak up close.',
  }),
  unit({
    id: 'spearman', name: 'Shield Guard', era: 0, class: 'antiCavalry', cost: 26, strength: 11, moves: 2, vision: 2,
    tech: 'bronze_working', upgradesTo: 'pikeman', bonusVs: { ...VS_MOUNTED },
    description: 'Strong defender. **+100%** against mounted units.',
  }),
  unit({
    id: 'horseman', name: 'Dune Buggy', era: 0, class: 'mounted', cost: 32, strength: 12, moves: 4, vision: 2,
    tech: 'animal_husbandry', resource: 'horses', upgradesTo: 'knight', abilities: ['moveAfterAttack'],
    description: 'Fast raider. Can move after it attacks. Needs {icon:horses} Methane.',
  }),

  // ───────── Era 1 · Classical ─────────
  unit({
    id: 'swordsman', name: 'Security Trooper', era: 1, class: 'melee', cost: 40, strength: 14, moves: 2, vision: 2,
    tech: 'iron_working', resource: 'iron', upgradesTo: 'man_at_arms',
    description: 'Solid front-line fighter. Needs {icon:iron} Nickel-Iron.',
  }),
  unit({
    id: 'catapult', name: 'Mortar Team', era: 1, class: 'siege', cost: 42, strength: 7, rangedStrength: 16, range: 2, moves: 2, vision: 2,
    tech: 'mathematics', upgradesTo: 'trebuchet', abilities: ['noMelee'],
    description: 'Hits from 2 tiles away.',
  }),
  unit({
    id: 'chariot', name: 'Assault Rover', era: 1, class: 'mounted', cost: 38, strength: 14, moves: 4, vision: 2,
    tech: 'the_wheel', resource: 'horses', upgradesTo: 'knight', abilities: ['moveAfterAttack'],
    description: 'Fast and armored. Can move after it attacks. Needs {icon:horses} Methane.',
  }),

  // ───────── Era 2 · Medieval ─────────
  unit({
    id: 'man_at_arms', name: 'Exo-Trooper', era: 2, class: 'melee', cost: 60, strength: 21, moves: 2, vision: 2,
    tech: 'steel', resource: 'iron', upgradesTo: 'musketman',
    description: 'Heavy front-line fighter. Needs {icon:iron} Nickel-Iron.',
  }),
  unit({
    id: 'crossbowman', name: 'Coil Gunner', era: 2, class: 'ranged', cost: 55, strength: 13, rangedStrength: 18, range: 2, moves: 2, vision: 2,
    tech: 'machinery', upgradesTo: 'field_gun', abilities: ['noMelee'],
    description: 'Strong shooter. Hits from 2 tiles away.',
  }),
  unit({
    id: 'pikeman', name: 'Rocket Squad', era: 2, class: 'antiCavalry', cost: 50, strength: 16, moves: 2, vision: 2,
    tech: 'steel', upgradesTo: 'at_gun', bonusVs: { ...VS_MOUNTED },
    description: 'Strong against mounted units: **+100%**.',
  }),
  unit({
    id: 'knight', name: 'Hover Bike', era: 2, class: 'mounted', cost: 65, strength: 22, moves: 4, vision: 2,
    tech: 'chivalry', resource: 'horses', upgradesTo: 'cavalry', abilities: ['moveAfterAttack'],
    description: 'Fast flanker. Can move after it attacks. Needs {icon:horses} Methane.',
  }),
  unit({
    id: 'trebuchet', name: 'Rail Mortar', era: 2, class: 'siege', cost: 60, strength: 12, rangedStrength: 22, range: 2, moves: 2, vision: 2,
    tech: 'machinery', upgradesTo: 'cannon', abilities: ['noMelee'],
    description: 'Hits from 2 tiles away.',
  }),

  // ───────── Era 3 · Renaissance ─────────
  unit({
    id: 'musketman', name: 'Power Armor', era: 3, class: 'melee', cost: 80, strength: 30, moves: 2, vision: 2,
    tech: 'gunpowder', resource: 'niter', upgradesTo: 'rifleman',
    description: 'Very tough fighter. Needs {icon:niter} Toxic Salts.',
  }),
  unit({
    id: 'cannon', name: 'Mass Driver', era: 3, class: 'siege', cost: 85, strength: 16, rangedStrength: 33, range: 2, moves: 2, vision: 2,
    tech: 'metallurgy', resource: 'niter', upgradesTo: 'artillery', abilities: ['noMelee'],
    description: 'Big gun that hits from 2 tiles away. Needs {icon:niter} Toxic Salts.',
  }),
  unit({
    id: 'lancer', name: 'Strike Rover', era: 3, class: 'mounted', cost: 85, strength: 32, moves: 4, vision: 2,
    tech: 'metallurgy', resource: 'horses', upgradesTo: 'cavalry', abilities: ['moveAfterAttack'],
    description: 'Very fast. Can move after it attacks. Needs {icon:horses} Methane.',
  }),

  // ───────── Era 4 · Industrial ─────────
  unit({
    id: 'rifleman', name: 'Hardsuit Marine', era: 4, class: 'melee', cost: 110, strength: 45, moves: 2, vision: 2,
    tech: 'rifling', upgradesTo: 'infantry',
    description: 'Reliable front-line fighter.',
  }),
  unit({
    id: 'field_gun', name: 'Plasma Caster', era: 4, class: 'ranged', cost: 110, strength: 30, rangedStrength: 42, range: 2, moves: 2, vision: 2,
    tech: 'military_science', upgradesTo: 'machine_gun', abilities: ['noMelee'],
    description: 'Burns enemies 2 tiles away with plasma.',
  }),
  unit({
    id: 'cavalry', name: 'Hover Skimmer', era: 4, class: 'mounted', cost: 115, strength: 48, moves: 5, vision: 2,
    tech: 'military_science', resource: 'horses', upgradesTo: 'tank', abilities: ['moveAfterAttack'],
    description: 'Very fast: 5 moves. Can move after it attacks. Needs {icon:horses} Methane.',
  }),
  unit({
    id: 'artillery', name: 'Arc Cannon', era: 4, class: 'siege', cost: 125, strength: 24, rangedStrength: 55, range: 3, moves: 2, vision: 2,
    tech: 'ballistics', upgradesTo: 'rocket_artillery', abilities: ['noMelee'],
    description: 'Hits from **3 tiles** away.',
  }),

  // ───────── Era 5 · Modern ─────────
  unit({
    id: 'infantry', name: 'Titan Frame', era: 5, class: 'melee', cost: 160, strength: 70, moves: 2, vision: 2,
    tech: 'replaceable_parts',
    description: 'The strongest foot fighter. A small walking machine.',
  }),
  unit({
    id: 'machine_gun', name: 'Pulse Turret', era: 5, class: 'ranged', cost: 150, strength: 50, rangedStrength: 65, range: 2, moves: 2, vision: 2,
    tech: 'replaceable_parts', abilities: ['noMelee'],
    description: 'Fires fast. Hits from 2 tiles away.',
  }),
  unit({
    id: 'at_gun', name: 'Lance Walker', era: 5, class: 'antiCavalry', cost: 140, strength: 55, moves: 2, vision: 2,
    tech: 'combined_arms', bonusVs: { mounted: 100, armor: 100 },
    description: 'Strong against mounted and armor units: **+100%**.',
  }),
  unit({
    id: 'tank', name: 'Hovertank', era: 5, class: 'armor', cost: 185, strength: 75, moves: 5, vision: 2,
    tech: 'combined_arms', resource: 'oil', abilities: ['moveAfterAttack'],
    description: 'Heavy and fast: 5 moves. Can move after it attacks. Needs {icon:oil} Heavy Ice.',
  }),
  unit({
    id: 'rocket_artillery', name: 'Swarm Launcher', era: 5, class: 'siege', cost: 190, strength: 35, rangedStrength: 83, range: 3, moves: 3, vision: 2,
    tech: 'rocketry', abilities: ['noMelee'],
    description: 'Hits from **3 tiles** away.',
  }),
];

export const UNITS: Record<string, UnitDef> = {
  ...Object.fromEntries(LIST.map((u) => [u.id, u])),
  ...UNIQUE_UNITS,
};
