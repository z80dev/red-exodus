// OWNER: ContentRogue. Blueprints permanently raise one or more Sol Report pillars.
import type { ScrollDef } from '../sim/defs';

const LIST: ScrollDef[] = [
  { id: 'hymnal_of_the_muses', name: 'Heritage Archive', pillar: 'arts', cost: 3, icon: 'arts', description: 'Raise **Heritage** by 1 level: **+50%** base {renown} from {cul} morale records and festivals, **+1** {splendor} as Priority.' },
  { id: 'codex_of_the_stars', name: 'Deep-Space Research Log', pillar: 'discovery', cost: 3, icon: 'discovery', description: 'Raise **Science** by 1 level: **+50%** base {renown} from {sci} data and breakthroughs, **+1** {splendor} as Priority.' },
  { id: 'merchants_ledger', name: 'Cargo Manifest', pillar: 'commerce', cost: 3, icon: 'commerce', description: 'Raise **Trade** by 1 level: **+50%** base {renown} from {gold} credits and trade routes, **+1** {splendor} as Priority.' },
  { id: 'epic_of_heroes', name: 'Field Manual', pillar: 'conquest', cost: 3, icon: 'conquest', description: 'Raise **Warfare** by 1 level: **+50%** base {renown} from kills, captures and feral dens, **+1** {splendor} as Priority.' },
  { id: 'almanac_of_harvests', name: 'Closed-Loop Agriculture Plan', pillar: 'prosperity', cost: 3, icon: 'prosperity', description: 'Raise **Growth** by 1 level: **+50%** base {renown} from population, colonies and installations, **+1** {splendor} as Priority.' },
  { id: 'annals_of_kings', name: 'Memorial Register', pillar: 'glory', cost: 3, icon: 'glory', description: 'Raise **Monuments** by 1 level: **+50%** base {renown} from buildings, megaprojects and landmarks, **+1** {splendor} as Priority.' },
  { id: 'testament_of_the_path', name: 'Priority Optimization Schema', pillar: 'prosperity', cost: 5, icon: 'crown', scope: 'focus', levels: 2, weight: 0.35, description: 'Raise your current **Priority** by **2** levels.' },
  { id: 'grand_codex', name: 'Ark-Wide Operations Blueprint', pillar: 'glory', cost: 6, icon: 'book', scope: 'all', levels: 1, weight: 0.35, description: 'Raise **every** pillar by 1 level.' },
];

export const SCROLLS: Record<string, ScrollDef> = Object.fromEntries(LIST.map((s) => [s.id, s]));
