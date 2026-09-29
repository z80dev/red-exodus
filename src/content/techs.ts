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
  ['agriculture', 'Greenhouse Systems', 0, 20, [], 0, 0, 'wheat', 'Controlled-environment farming turns nitrate salts and recycled water into food. Unlocks Greenhouse Domes, Seed Silos and Hanging Greenhouses.'],
  ['animal_husbandry', 'Bioengineering', 0, 20, [], 0, 2, 'horse', 'Engineer lichen and methane cultures. Unlocks Bioreactors, Dune Buggies and reveals {icon:horses} Methane.'],
  ['mining', 'Regolith Extraction', 0, 20, [], 0, 4, 'mountain', 'Cut into basalt and buried deposits. Unlocks Regolith Mines, Basalt Quarries and Solar Henge.'],
  ['sailing', 'Dust Skiffs', 0, 30, ['agriculture'], 1, 0, 'ship', 'Fan-driven sand-yachts let units **embark on and cross Dust Shallows and the Brine Lake**. Unlocks Dust Skimmers and Beacon Towers.'],
  ['archery', 'Ballistic Targeting', 0, 28, ['animal_husbandry'], 1, 2, 'feather', 'Put projectiles where the hostile movement will be. Unlocks Slug Throwers and Extraction Rigs.'],
  ['bronze_working', 'Alloy Fabrication', 0, 30, ['mining'], 1, 4, 'flame', 'Forge resilient alloys for Breachers, Blast Walls and Armories; reveals {icon:iron} Nickel-Iron.'],

  // ───────── Era 1 · Classical ─────────
  ['writing', 'Data Preservation', 1, 55, ['agriculture'], 0, 0, 'scroll', 'Back up knowledge before the next disaster. Unlocks Data Archives and the Library of Earth.'],
  ['calendar', 'Sol Tracking', 1, 55, ['agriculture', 'sailing'], 0, 1, 'sun', 'Measure seasons and solar cycles. Unlocks Hydroponics Bays, Memorial Chapels and The Deep Ear.'],
  ['the_wheel', 'Mobility Systems', 1, 55, ['animal_husbandry'], 0, 3, 'gear', 'Wheels still work, even when the world has ended. Unlocks Assault Rovers.'],
  ['iron_working', 'Nickel-Iron Metallurgy', 1, 60, ['bronze_working'], 0, 5, 'sword', 'Harder alloys, tougher suits. Unlocks Security Troopers and Fabricators.'],
  ['currency', 'Colony Exchange', 1, 65, ['writing', 'bronze_working'], 1, 1, 'coin', 'Standardize the trade tokens. Unlocks Exchanges, Relay Stations and the Beacon Colossus.'],
  ['mathematics', 'Trajectory Models', 1, 65, ['the_wheel', 'archery'], 1, 3, 'owl', 'Calculate the arc before firing. Unlocks Mortar Teams and Holo-Theaters.'],

  // ───────── Era 2 · Medieval ─────────
  ['cartography', 'Hover Hulls', 2, 130, ['sailing', 'currency'], 0, 0, 'compass', 'Map the Dust Sea and build hover hulls: units may **enter and cross the Dust Sea**. Unlocks Skiff Docks.'],
  ['theology', 'Memory Traditions', 2, 130, ['calendar', 'writing'], 0, 2, 'temple', 'Give grief a place to go. Unlocks Cathedrals of Earth, Dome of Remembrance and Lava Tube Temple City.'],
  ['engineering', 'Hab Engineering', 2, 135, ['mathematics', 'calendar'], 0, 3, 'tower', 'Seal pressure, reclaim water and sinter regolith. Unlocks Water Reclaimers, Sinter Works and Storm Wall.'],
  ['steel', 'Hardened Alloys', 2, 135, ['iron_working'], 0, 5, 'shield', 'Folded alloys make armor survivable. Unlocks Exo-Troopers, Lancer Squads and Bastion Domes.'],
  ['machinery', 'Precision Machinery', 2, 145, ['engineering', 'iron_working'], 1, 4, 'key', 'Gears give way to powered coils. Unlocks Coilgunners, Rail Mortars and Fabricators; reveals {icon:niter} Perchlorates.'],
  ['chivalry', 'Rover Doctrine', 2, 145, ['the_wheel', 'steel'], 1, 5, 'lion', 'Mobility doctrine for the frontier. Unlocks Hover Bikes and their maintenance bays.'],

  // ───────── Era 3 · Renaissance ─────────
  ['banking', 'Credit Systems', 3, 260, ['currency', 'cartography'], 0, 0, 'hand', 'Credit and interest finance a colony that cannot afford cash under the mattress. Unlocks Credit Vaults.'],
  ['education', 'Applied Research', 3, 260, ['theology', 'mathematics'], 0, 2, 'book', 'Train specialists to ask useful questions. Unlocks Research Institutes.'],
  ['gunpowder', 'Energetics', 3, 270, ['steel', 'machinery'], 0, 5, 'skull', 'Controlled energetic chemistry propels Power Armor and arms; do not confuse controlled with safe.'],
  ['astronomy', 'Deep-Space Observation', 3, 280, ['education', 'cartography'], 1, 1, 'star', 'Read the sky and listen for a signal. Unlocks Deep Space Arrays and Olympus Observatory.'],
  ['architecture', 'Pressure Architecture', 3, 280, ['engineering', 'theology'], 1, 3, 'castle', 'Build domes that keep a thin atmosphere outside. Unlocks museums and Monument to the Lost.'],
  ['metallurgy', 'Electromagnetic Propulsion', 3, 290, ['gunpowder', 'chivalry'], 1, 5, 'mask', 'Conductive rails launch heavy rounds. Unlocks Mass Drivers and Strike Rovers.'],

  // ───────── Era 4 · Industrial ─────────
  ['economics', 'Resource Economics', 4, 480, ['banking', 'architecture'], 0, 1, 'crown', 'Treat scarcity as a discipline. Unlocks stock exchanges and the Clocktower of Sols.'],
  ['industrialization', 'Industrial Fabrication', 4, 480, ['banking', 'metallurgy'], 0, 3, 'hourglass', 'Scale production beyond the workshop. Unlocks Foundries and Skyhook Pylons; reveals {icon:coal} Thorium.'],
  ['rifling', 'Precision Rifles', 4, 490, ['gunpowder', 'metallurgy'], 0, 5, 'eye', 'Rifling buys accuracy in thin air. Unlocks Hardsuit Marines.'],
  ['electricity', 'Grid Power', 4, 520, ['industrialization', 'astronomy'], 1, 2, 'bolt', 'Distribute power rather than arguments. Unlocks Fusion Plants, hospitals and the Statue of Tomorrow.'],
  ['military_science', 'Combined Tactics', 4, 520, ['rifling', 'metallurgy'], 1, 5, 'laurel', 'Train units to coordinate across a hostile landscape. Unlocks Hover Skimmers, Plasma Casters and academies.'],
  ['ballistics', 'Long-Range Ballistics', 4, 560, ['military_science', 'industrialization'], 2, 4, 'eagle', 'Compute trajectories across the horizon. Unlocks Arc Howitzers.'],

  // ───────── Era 5 · Modern ─────────
  ['radio', 'Colony Broadcast', 5, 850, ['electricity', 'economics'], 0, 1, 'wave', 'A voice crosses the static. Unlocks broadcast towers, arenas and the Guardian of Mars.'],
  ['combustion', 'Propulsion Chemistry', 5, 850, ['industrialization', 'military_science'], 0, 3, 'flame', 'Power drills and engines with volatile chemistry. Unlocks Deep Drills; reveals {icon:oil} Deuterium.'],
  ['replaceable_parts', 'Modular Production', 5, 880, ['rifling', 'industrialization'], 0, 5, 'gear', 'Standardize components for quick repair. Unlocks Titan Frames and Pulse Turrets.'],
  ['computers', 'Autonomous Computation', 5, 950, ['radio', 'electricity'], 1, 1, 'moon', 'Machines that think so the crew can sleep. Unlocks research labs and the Biodome Opera.'],
  ['combined_arms', 'Planetary Defense', 5, 950, ['combustion', 'replaceable_parts'], 1, 4, 'shield', 'Armor, infantry and weapons move as one. Unlocks Hovertanks and Lance Walkers.'],
  ['rocketry', 'Orbital Infrastructure', 5, 1000, ['computers', 'ballistics'], 2, 2, 'star', 'Reach beyond the atmosphere. Unlocks Swarm Launchers and the Space Elevator.'],
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
