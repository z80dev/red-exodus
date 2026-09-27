// OWNER: ContentCiv. The tech web: exactly 36 techs, 6 per era (Ancient → Modern). Era-0 roots have no
// prereqs; nobody starts with any tech. `pos` lays techs out per era: col 0..2 (left → right), row 0..5.
// Special rules referenced by the sim: `sailing` = embark on coast/lake, `cartography` = enter ocean.
// Cost curve ≈ ×2.2 per era, tuned so a healthy empire finishes an era's techs in ~20 turns (one era).
import type { BuildingDef, ImprovementDef, ResourceDef, TechDef, UnitDef, WonderDef } from '../sim/defs';
import type { TechId } from '../sim/types';
import { BUILDINGS } from './buildings';
import { IMPROVEMENTS } from './improvements';
import { RESOURCES } from './resources';
import { UNITS } from './units';
import { WONDERS } from './wonders';

type T = [id: TechId, name: string, era: number, cost: number, prereqs: TechId[], col: number, row: number, icon: string, description: string];

const RAW: T[] = [
  // ───────── Era 0 · Ancient ─────────
  ['agriculture', 'Agriculture', 0, 20, [], 0, 0, 'wheat', 'Seeds in furrows, the first promise of plenty. Farms, Granaries and the Hanging Gardens.'],
  ['animal_husbandry', 'Animal Husbandry', 0, 20, [], 0, 2, 'horse', 'Tame the herds. Pastures, Horsemen, and reveals {icon:horses} Horses.'],
  ['mining', 'Mining', 0, 20, [], 0, 4, 'mountain', 'Break the stone. Mines, Quarries and Stonehenge.'],
  ['sailing', 'Sailing', 0, 30, ['agriculture'], 1, 0, 'ship', 'Hulls and sails. Units may **embark** on coast and lakes. Fishing Boats and the Lighthouse.'],
  ['archery', 'Archery', 0, 28, ['animal_husbandry'], 1, 2, 'feather', 'Strike from afar. Archers and hunting Camps.'],
  ['bronze_working', 'Bronze Working', 0, 30, ['mining'], 1, 4, 'flame', 'Copper and tin make a blade. Spearmen, Walls, Barracks, the Pyramids; reveals {icon:iron} Iron.'],

  // ───────── Era 1 · Classical ─────────
  ['writing', 'Writing', 1, 55, ['agriculture'], 0, 0, 'scroll', 'Memory made permanent. Libraries and the Great Library.'],
  ['calendar', 'Calendar', 1, 55, ['agriculture', 'sailing'], 0, 1, 'sun', 'Read the seasons and the stars. Plantations, Temples and the Oracle.'],
  ['the_wheel', 'The Wheel', 1, 55, ['animal_husbandry'], 0, 3, 'gear', 'The simplest machine changes everything. Chariots.'],
  ['iron_working', 'Iron Working', 1, 60, ['bronze_working'], 0, 5, 'sword', 'Harder metal, sharper wars. Swordsmen and the Forge.'],
  ['currency', 'Currency', 1, 65, ['writing', 'bronze_working'], 1, 1, 'coin', 'Coin replaces barter. Markets, Trading Posts and the Colossus.'],
  ['mathematics', 'Mathematics', 1, 65, ['the_wheel', 'archery'], 1, 3, 'owl', 'Numbers bend the world. Catapults and the Amphitheater.'],

  // ───────── Era 2 · Medieval ─────────
  ['cartography', 'Cartography', 2, 130, ['sailing', 'currency'], 0, 0, 'compass', 'Chart the unknown. Units may **enter the ocean**. Harbors.'],
  ['theology', 'Theology', 2, 130, ['calendar', 'writing'], 0, 2, 'temple', 'Faith becomes institution. Cathedrals, Hagia Sophia and Angkor Wat.'],
  ['engineering', 'Engineering', 2, 135, ['mathematics', 'calendar'], 0, 3, 'tower', 'Arches and aqueducts. Aqueducts, Lumber Mills and the Great Wall.'],
  ['steel', 'Steel', 2, 135, ['iron_working'], 0, 5, 'shield', 'Folded, tempered, deadly. Men-at-Arms, Pikemen and Castles.'],
  ['machinery', 'Machinery', 2, 145, ['engineering', 'iron_working'], 1, 4, 'key', 'Gears and cranks. Crossbowmen, Trebuchets, Workshops; reveals {icon:niter} Niter.'],
  ['chivalry', 'Chivalry', 2, 145, ['the_wheel', 'steel'], 1, 5, 'lion', 'Codes of honor on horseback. Knights and Stables.'],

  // ───────── Era 3 · Renaissance ─────────
  ['banking', 'Banking', 3, 260, ['currency', 'cartography'], 0, 0, 'hand', 'Credit and interest. Banks.'],
  ['education', 'Education', 3, 260, ['theology', 'mathematics'], 0, 2, 'book', 'Learning for its own sake. Universities.'],
  ['gunpowder', 'Gunpowder', 3, 270, ['steel', 'machinery'], 0, 5, 'skull', 'Thunder in a barrel. Musketmen, Armories and Himeji Castle.'],
  ['astronomy', 'Astronomy', 3, 280, ['education', 'cartography'], 1, 1, 'star', 'The heavens, measured. Observatories and the Leaning Tower.'],
  ['architecture', 'Architecture', 3, 280, ['engineering', 'theology'], 1, 3, 'castle', 'Domes and perspective. Museums and the Taj Mahal.'],
  ['metallurgy', 'Metallurgy', 3, 290, ['gunpowder', 'chivalry'], 1, 5, 'mask', 'Cast bronze and forged steel. Cannons and Lancers.'],

  // ───────── Era 4 · Industrial ─────────
  ['economics', 'Economics', 4, 480, ['banking', 'architecture'], 0, 1, 'crown', 'Markets as a science. Stock Exchanges and Big Ben.'],
  ['industrialization', 'Industrialization', 4, 480, ['banking', 'metallurgy'], 0, 3, 'hourglass', 'Smoke and steam. Factories and the Eiffel Tower; reveals {icon:coal} Coal.'],
  ['rifling', 'Rifling', 4, 490, ['gunpowder', 'metallurgy'], 0, 5, 'eye', 'Spiral grooves, deadly accuracy. Riflemen.'],
  ['electricity', 'Electricity', 4, 520, ['industrialization', 'astronomy'], 1, 2, 'bolt', 'Lightning tamed. Power Plants, Hospitals and the Statue of Liberty.'],
  ['military_science', 'Military Science', 4, 520, ['rifling', 'metallurgy'], 1, 5, 'laurel', 'War becomes a discipline. Cavalry, Field Guns and Military Academies.'],
  ['ballistics', 'Ballistics', 4, 560, ['military_science', 'industrialization'], 2, 4, 'eagle', 'Trajectories computed. Artillery.'],

  // ───────── Era 5 · Modern ─────────
  ['radio', 'Radio', 5, 850, ['electricity', 'economics'], 0, 1, 'wave', 'Voices through the air. Broadcast Towers, Stadiums and Cristo Redentor.'],
  ['combustion', 'Combustion', 5, 850, ['industrialization', 'military_science'], 0, 3, 'flame', 'The engine age. Oil Wells, Supermarkets; reveals {icon:oil} Oil.'],
  ['replaceable_parts', 'Replaceable Parts', 5, 880, ['rifling', 'industrialization'], 0, 5, 'gear', 'Mass production of everything. Infantry and Machine Guns.'],
  ['computers', 'Computers', 5, 950, ['radio', 'electricity'], 1, 1, 'moon', 'Thinking machines. Research Labs and the Opera House.'],
  ['combined_arms', 'Combined Arms', 5, 950, ['combustion', 'replaceable_parts'], 1, 4, 'shield', 'Armor, infantry and guns as one. Tanks and Anti-Tank Guns.'],
  ['rocketry', 'Rocketry', 5, 1000, ['computers', 'ballistics'], 2, 2, 'star', 'Beyond the sky. Rocket Artillery and the Launch Pad.'],
];

export const TECHS: Record<string, TechDef> = Object.fromEntries(
  RAW.map(([id, name, era, cost, prereqs, col, row, icon, description]) => [
    id,
    { id, name, era, cost, prereqs, pos: { col, row }, description, icon } satisfies TechDef,
  ]),
);

/** Techs in display order (era, then column, then row). */
export const TECH_ORDER: TechId[] = RAW.map((r) => r[0]).sort((a, b) => {
  const ta = TECHS[a], tb = TECHS[b];
  return ta.era - tb.era || ta.pos.col - tb.pos.col || ta.pos.row - tb.pos.row;
});

export interface TechUnlocks {
  units: UnitDef[];
  buildings: BuildingDef[];
  wonders: WonderDef[];
  improvements: ImprovementDef[];
  /** strategic resources revealed by this tech */
  resources: ResourceDef[];
  /** special rules granted (embarking etc.) — short rich-text lines */
  rules: string[];
}

/** Everything a tech unlocks (for tech tree cards, research toasts, codex). Leader-unique content is excluded. */
export function techUnlocks(id: TechId): TechUnlocks {
  const rules: string[] = [];
  if (id === 'sailing') rules.push('Units can embark on coast and lakes');
  if (id === 'cartography') rules.push('Units can cross the ocean');
  return {
    units: Object.values(UNITS).filter((u) => u.tech === id && !u.uniqueTo),
    buildings: Object.values(BUILDINGS).filter((b) => b.tech === id && !b.uniqueTo),
    wonders: Object.values(WONDERS).filter((w) => w.tech === id),
    improvements: Object.values(IMPROVEMENTS).filter((i) => i.tech === id),
    resources: Object.values(RESOURCES).filter((r) => r.revealTech === id),
    rules,
  };
}
