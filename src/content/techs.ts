// OWNER: ContentCiv. The tech web: exactly 36 techs, 6 per era (Ancient → Modern). Era-0 roots have no
// prereqs; nobody starts with any tech. Every other tech needs 1–2 techs, all from the era directly before it
// (era 0: an era-0 root), so the newest era is always one step away. `pos` lays techs out per era:
// col 0..2 (left → right), row 0..5.
// Special rules referenced by the sim: `sailing` = embark on coast/lake, `cartography` = enter ocean.
// `cost` is the authored ranking (codex, AI heuristics); the sim charges `ERA_TECH_COST` × `TECH_PACE` (economy.ts).
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
  ['agriculture', 'Greenhouse Systems', 0, 20, [], 0, 0, 'wheat', 'Grow food in sealed greenhouses. Unlocks Greenhouse Domes, Seed Silos and Hanging Greenhouses.'],
  ['animal_husbandry', 'Bioengineering', 0, 20, [], 0, 2, 'horse', 'Grow lichen and methane. Unlocks Bio Tanks and Dune Buggies. Shows {icon:horses} Methane.'],
  ['mining', 'Ground Mining', 0, 20, [], 0, 4, 'mountain', 'Dig into rock and ground deposits. Unlocks Ground Mines, Rock Quarries and Solar Henge.'],
  ['sailing', 'Dust Skiffs', 0, 30, ['agriculture'], 1, 0, 'ship', 'Fan-driven skiffs let units **cross Shallows and Salt Lakes**. Unlocks Dust Skimmers and Beacon Towers.'],
  ['archery', 'Aiming Systems', 0, 28, ['animal_husbandry'], 1, 2, 'feather', 'Hit targets from far away. Unlocks Slug Throwers and Harvest Rigs.'],
  ['bronze_working', 'Strong Metals', 0, 30, ['mining'], 1, 4, 'flame', 'Make tough metal. Unlocks Shield Guards, Blast Walls, Armories and Dust-Brick Citadel. Shows {icon:iron} Nickel-Iron.'],

  // ───────── Era 1 · Classical ─────────
  ['writing', 'Data Backup', 1, 55, ['agriculture'], 0, 0, 'scroll', 'Keep copies of what we know. Unlocks Data Archives and the Library of Earth.'],
  ['calendar', 'Season Tracking', 1, 55, ['agriculture', 'sailing'], 0, 1, 'sun', 'Follow the seasons and the sun. Unlocks Crop Bays, Memorial Chapels and The Deep Ear.'],
  ['the_wheel', 'Rover Wheels', 1, 55, ['animal_husbandry'], 0, 3, 'gear', 'Wheels still work after the end of the world. Unlocks Assault Rovers.'],
  ['iron_working', 'Armor Making', 1, 60, ['bronze_working'], 0, 5, 'sword', 'Harder metal makes better suits. Unlocks Security Troopers and Metal Foundries.'],
  ['currency', 'Colony Exchange', 1, 65, ['sailing', 'bronze_working'], 1, 1, 'coin', 'Use one standard coin for trade. Unlocks Exchanges, Relay Stations and the Beacon Colossus.'],
  ['mathematics', 'Flight Paths', 1, 65, ['archery', 'mining'], 1, 3, 'owl', 'Work out the shot before you fire. Unlocks Mortar Teams and Holo-Theaters.'],

  // ───────── Era 2 · Medieval ─────────
  ['cartography', 'Hover Hulls', 2, 130, ['currency', 'calendar'], 0, 0, 'compass', 'Map the Dust Sea and build hover hulls: units can **cross the Dust Sea**. Unlocks Skiff Docks.'],
  ['theology', 'Memory Traditions', 2, 130, ['calendar', 'writing'], 0, 2, 'temple', 'Give grief a place to go. Unlocks Cathedrals of Earth, Dome of Remembrance and Lava Tube Temple City.'],
  ['engineering', 'Colony Engineering', 2, 135, ['mathematics', 'calendar'], 0, 3, 'tower', 'Seal pressure, recycle water and press dust into blocks. Unlocks Water Recyclers, Block Works, Wind Farms, Storm Shelters and Storm Wall.'],
  ['steel', 'Hard Metals', 2, 135, ['iron_working'], 0, 5, 'shield', 'Folded metal makes strong armor. Unlocks Exo-Troopers, Rocket Squads and Bastion Domes.'],
  ['machinery', 'Fine Machines', 2, 145, ['mathematics', 'iron_working'], 1, 4, 'key', 'Gears give way to power coils. Unlocks Coil Gunners, Rail Mortars and Workshops. Shows {icon:niter} Toxic Salts.'],
  ['chivalry', 'Rover Tactics', 2, 145, ['the_wheel', 'iron_working'], 1, 5, 'lion', 'Fast units for the frontier. Unlocks Hover Bikes and Rover Bays.'],

  // ───────── Era 3 · Renaissance ─────────
  ['banking', 'Credit Systems', 3, 260, ['cartography'], 0, 0, 'hand', 'Loans and savings help a colony grow. Unlocks Credit Vaults.'],
  ['education', 'Applied Research', 3, 260, ['theology', 'engineering'], 0, 2, 'book', 'Train experts to ask useful questions. Unlocks Research Institutes.'],
  ['gunpowder', 'Explosives', 3, 270, ['steel', 'machinery'], 0, 5, 'skull', 'Controlled blasts push Power Armor and weapons. Controlled does not mean safe. Unlocks Power Armor, Weapons Foundries and Olympus Observatory.'],
  ['astronomy', 'Deep Space Watch', 3, 280, ['cartography', 'theology'], 1, 1, 'star', 'Watch the sky and listen for a signal. Unlocks Deep Space Arrays and Tilted Spire.'],
  ['architecture', 'Dome Building', 3, 280, ['engineering', 'theology'], 1, 3, 'castle', 'Build domes that keep the thin air out. Unlocks Holo-Archives and Monument to the Lost.'],
  ['metallurgy', 'Magnetic Launchers', 3, 290, ['machinery', 'chivalry'], 1, 5, 'mask', 'Magnetic rails fire heavy shots. Unlocks Mass Drivers and Strike Rovers.'],

  // ───────── Era 4 · Industrial ─────────
  ['economics', 'Economics', 4, 480, ['banking', 'architecture'], 0, 1, 'crown', 'Plan for what is rare. Unlocks Stock Exchanges and the Mars Clocktower.'],
  ['industrialization', 'Factories', 4, 480, ['banking', 'metallurgy'], 0, 3, 'hourglass', 'Make much more than a workshop can. Unlocks Factories, Dust Scrubbers and Sky Tower. Shows {icon:coal} Thorium.'],
  ['rifling', 'Better Rifles', 4, 490, ['gunpowder'], 0, 5, 'eye', 'Spiral barrels hit targets in thin air. Unlocks Hardsuit Marines.'],
  ['electricity', 'Power Grid', 4, 520, ['astronomy', 'education'], 1, 2, 'bolt', 'Share power, not arguments. Unlocks Fusion Plants, Med Bays and the Statue of Tomorrow.'],
  ['military_science', 'Team Tactics', 4, 520, ['metallurgy'], 1, 5, 'laurel', 'Units work together on hostile ground. Unlocks Hover Skimmers, Plasma Casters and Tactical Schools.'],
  ['ballistics', 'Long-Range Fire', 4, 560, ['gunpowder', 'astronomy'], 2, 4, 'eagle', 'Aim over the horizon. Unlocks Arc Cannons.'],

  // ───────── Era 5 · Modern ─────────
  ['radio', 'Colony Broadcast', 5, 850, ['electricity', 'economics'], 0, 1, 'wave', 'A voice crosses the static. Unlocks Broadcast Towers, Arenas and the Guardian of Mars.'],
  ['combustion', 'Fuel Chemistry', 5, 850, ['industrialization', 'military_science'], 0, 3, 'flame', 'Fast-burning fuel powers drills and engines. Unlocks Deep Drills and Supply Depots. Shows {icon:oil} Heavy Ice.'],
  ['replaceable_parts', 'Standard Parts', 5, 880, ['rifling', 'industrialization'], 0, 5, 'gear', 'Same-size parts make fast repairs. Unlocks Titan Frames and Pulse Turrets.'],
  ['computers', 'Computers', 5, 950, ['electricity'], 1, 1, 'moon', 'Machines think so the crew can sleep. Unlocks Research Labs and the Biodome Opera.'],
  ['combined_arms', 'Planetary Defense', 5, 950, ['military_science', 'rifling'], 1, 4, 'shield', 'Armor, troops and guns move as one. Unlocks Hovertanks and Lance Walkers.'],
  ['rocketry', 'Orbit Systems', 5, 1000, ['ballistics', 'electricity'], 2, 2, 'star', 'Reach beyond the sky. Unlocks Swarm Launchers and the Space Elevator.'],
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
  if (id === 'sailing') rules.push('Units can cross Shallows and Salt Lakes');
  if (id === 'cartography') rules.push('Units can cross the Dust Sea');
  return {
    units: Object.values(UNITS).filter((u) => u.tech === id && !u.uniqueTo),
    buildings: Object.values(BUILDINGS).filter((b) => b.tech === id && !b.uniqueTo),
    wonders: Object.values(WONDERS).filter((w) => w.tech === id),
    improvements: Object.values(IMPROVEMENTS).filter((i) => i.tech === id),
    resources: Object.values(RESOURCES).filter((r) => r.revealTech === id),
    rules,
  };
}
