// OWNER: ContentRogue. Scrolls — the Balatro planets. Each raises Chronicle pillar levels permanently:
// every level adds +50% of the pillar's base renown rates and +1 Splendor when it is the Focus (content/pillars.ts).
import type { ScrollDef } from '../sim/defs';

const LIST: ScrollDef[] = [
  {
    id: 'hymnal_of_the_muses', name: 'Hymnal of the Muses', pillar: 'arts', cost: 3, icon: 'arts',
    description: 'Raise **Arts** by 1 level: **+50%** base {renown} from {cul} culture and festivals, **+1** {splendor} as Focus.',
  },
  {
    id: 'codex_of_the_stars', name: 'Codex of the Stars', pillar: 'discovery', cost: 3, icon: 'discovery',
    description: 'Raise **Discovery** by 1 level: **+50%** base {renown} from {sci} science and techs, **+1** {splendor} as Focus.',
  },
  {
    id: 'merchants_ledger', name: "The Merchant's Ledger", pillar: 'commerce', cost: 3, icon: 'commerce',
    description: 'Raise **Commerce** by 1 level: **+50%** base {renown} from {gold} gold and trade routes, **+1** {splendor} as Focus.',
  },
  {
    id: 'epic_of_heroes', name: 'Epic of Heroes', pillar: 'conquest', cost: 3, icon: 'conquest',
    description: 'Raise **Conquest** by 1 level: **+50%** base {renown} from kills, captures and camps, **+1** {splendor} as Focus.',
  },
  {
    id: 'almanac_of_harvests', name: 'Almanac of Harvests', pillar: 'prosperity', cost: 3, icon: 'prosperity',
    description: 'Raise **Prosperity** by 1 level: **+50%** base {renown} from growth, cities and improvements, **+1** {splendor} as Focus.',
  },
  {
    id: 'annals_of_kings', name: 'Annals of Kings', pillar: 'glory', cost: 3, icon: 'glory',
    description: 'Raise **Glory** by 1 level: **+50%** base {renown} from buildings and wonders, **+1** {splendor} as Focus.',
  },
  // ── rare variants (need ScrollDef.scope / levels; rolled less often via weight) ──
  {
    id: 'testament_of_the_path', name: 'Testament of the Chosen Path', pillar: 'prosperity', cost: 5, icon: 'crown',
    scope: 'focus', levels: 2, weight: 0.35,
    description: 'Raise your current **Focus** pillar by **2** levels.',
  },
  {
    id: 'grand_codex', name: 'The Grand Codex', pillar: 'glory', cost: 6, icon: 'book',
    scope: 'all', levels: 1, weight: 0.35,
    description: 'Raise **every** pillar by 1 level.',
  },
];

export const SCROLLS: Record<string, ScrollDef> = Object.fromEntries(LIST.map((s) => [s.id, s]));
