import { describe, expect, it } from 'vitest';
import { BUILDINGS } from './buildings';
import { IMPROVEMENTS } from './improvements';
import { NATURAL_WONDERS } from './naturalWonders';
import { PROMOTIONS } from './promotions';
import { RESOURCES } from './resources';
import { TECHS, TECH_ORDER, techUnlocks } from './techs';
import { ELEVATIONS, FEATURES, TERRAINS } from './terrain';
import { UNITS } from './units';
import { WONDERS, cheapestAvailableTechs } from './wonders';

const REQUIRED_UNITS = [
  'settler', 'scout', 'warrior', 'archer', 'spearman', 'horseman', 'swordsman', 'catapult', 'chariot',
  'man_at_arms', 'crossbowman', 'pikeman', 'knight', 'trebuchet', 'musketman', 'cannon', 'lancer',
  'rifleman', 'field_gun', 'cavalry', 'artillery', 'infantry', 'machine_gun', 'at_gun', 'tank', 'rocket_artillery',
];
const WONDERS_BY_ERA = [
  ['pyramids', 'stonehenge', 'hanging_gardens'], ['colossus', 'great_library', 'oracle'],
  ['great_wall', 'hagia_sophia', 'angkor_wat'], ['taj_mahal', 'leaning_tower', 'himeji'],
  ['big_ben', 'eiffel', 'liberty'], ['opera_house', 'cristo', 'launch_pad'],
];
const RESOURCE_KINDS = {
  bonus: ['wheat', 'rice', 'cattle', 'sheep', 'deer', 'fish', 'stone', 'bananas'],
  luxury: ['gold', 'gems', 'silk', 'spices', 'wine', 'incense', 'furs', 'pearls', 'marble', 'ivory', 'dyes', 'cotton', 'sugar', 'whales'],
  strategic: ['horses', 'iron', 'niter', 'coal', 'oil'],
} as const;
const REQUIRED_IMPROVEMENTS = ['farm', 'mine', 'pasture', 'plantation', 'lumbermill', 'quarry', 'fishing_boats', 'camp', 'trading_post', 'oil_well'];
const REQUIRED_NATURAL_WONDERS = ['sky_arch', 'ember_peak', 'crystal_falls', 'elder_tree', 'titan_bones', 'mirror_lake'];
const LANDMARKS = [
  'temple', 'library', 'market', 'barracks', 'harbor', 'granary', 'workshop', 'university', 'amphitheater', 'bank',
  'factory', 'observatory', 'castle', 'aqueduct', 'cathedral', 'powerplant', 'stadium', 'lighthouse',
];
const UPGRADE_LINES = [
  ['warrior', 'swordsman', 'man_at_arms', 'musketman', 'rifleman', 'infantry'],
  ['archer', 'crossbowman', 'field_gun', 'machine_gun'],
  ['spearman', 'pikeman', 'at_gun'],
  ['horseman', 'knight', 'cavalry', 'tank'],
  ['chariot', 'knight'],
  ['lancer', 'cavalry'],
  ['catapult', 'trebuchet', 'cannon', 'artillery', 'rocket_artillery'],
];

const techEra = (id: string): number => TECHS[id].era;

describe('tech web', () => {
  it('has exactly 36 techs, 6 per era, with unique layout slots', () => {
    expect(Object.keys(TECHS)).toHaveLength(36);
    expect(TECH_ORDER).toHaveLength(36);
    for (let era = 0; era < 6; era++) {
      const techs = Object.values(TECHS).filter((t) => t.era === era);
      expect(techs).toHaveLength(6);
      const slots = techs.map((t) => `${t.pos.col},${t.pos.row}`);
      expect(new Set(slots).size).toBe(6);
      for (const t of techs) {
        expect(t.pos.col).toBeGreaterThanOrEqual(0);
        expect(t.pos.col).toBeLessThanOrEqual(2);
        expect(t.pos.row).toBeGreaterThanOrEqual(0);
        expect(t.pos.row).toBeLessThanOrEqual(5);
      }
    }
  });

  it('prereqs exist, point backwards (earlier era or left column), and only era-0 roots lack prereqs', () => {
    for (const t of Object.values(TECHS)) {
      if (t.prereqs.length === 0) expect(t.era).toBe(0);
      for (const p of t.prereqs) {
        const pre = TECHS[p];
        expect(pre, `${t.id} prereq ${p}`).toBeDefined();
        expect(pre.era < t.era || (pre.era === t.era && pre.pos.col < t.pos.col), `${p} → ${t.id} must point forward`).toBe(true);
      }
    }
  });

  it('every tech is reachable and costs rise with era', () => {
    const known: string[] = [];
    while (known.length < 36) {
      const next = cheapestAvailableTechs(known, 36);
      expect(next.length, `stuck after ${known.join(',')}`).toBeGreaterThan(0);
      known.push(...next);
    }
    for (const t of Object.values(TECHS)) {
      for (const p of t.prereqs) if (TECHS[p].era < t.era) expect(TECHS[p].cost).toBeLessThan(t.cost);
    }
  });

  it('places sailing in era 0 and cartography in era 2', () => {
    expect(techEra('sailing')).toBe(0);
    expect(techEra('cartography')).toBe(2);
  });

  it('every tech unlocks at least one thing', () => {
    for (const id of Object.keys(TECHS)) {
      const u = techUnlocks(id);
      const n = u.units.length + u.buildings.length + u.wonders.length + u.improvements.length + u.resources.length + u.rules.length;
      expect(n, `${id} unlocks nothing`).toBeGreaterThan(0);
    }
  });
});

describe('units', () => {
  it('has every required unit with a matching model, and every unit (incl. uniques) has a valid era tech', () => {
    for (const id of REQUIRED_UNITS) {
      expect(UNITS[id], id).toBeDefined();
      expect(UNITS[id].model).toBe(`u_${id}`);
    }
    for (const u of Object.values(UNITS)) {
      if (u.replaces) expect(UNITS[u.replaces], `${u.id} replaces ${u.replaces}`).toBeDefined();
      if (u.tech == null) continue;
      expect(TECHS[u.tech], `${u.id} tech ${u.tech}`).toBeDefined();
      expect(techEra(u.tech), `${u.id} era`).toBe(u.era);
    }
  });

  it('follows the ARCHITECTURE upgrade lines, always to a later era and stronger unit', () => {
    for (const line of UPGRADE_LINES) {
      for (let i = 0; i < line.length - 1; i++) expect(UNITS[line[i]].upgradesTo, line[i]).toBe(line[i + 1]);
    }
    for (const u of Object.values(UNITS)) {
      if (!u.upgradesTo) continue;
      const to = UNITS[u.upgradesTo];
      expect(to, `${u.id} → ${u.upgradesTo}`).toBeDefined();
      expect(to.era).toBeGreaterThan(u.era);
      expect(to.strength).toBeGreaterThan(u.strength);
    }
    for (const end of ['infantry', 'machine_gun', 'at_gun', 'tank', 'rocket_artillery']) expect(UNITS[end].upgradesTo).toBeUndefined();
  });

  it('requires only strategic resources, and each is revealed no later than the unit tech', () => {
    for (const u of Object.values(UNITS)) {
      if (!u.resource) continue;
      const r = RESOURCES[u.resource];
      expect(r?.kind, `${u.id} resource`).toBe('strategic');
      if (u.tech && r.revealTech) expect(techEra(r.revealTech)).toBeLessThanOrEqual(techEra(u.tech));
    }
    expect(UNITS.horseman.resource).toBe('horses');
    expect(UNITS.knight.resource).toBe('horses');
    expect(UNITS.swordsman.resource).toBe('iron');
    expect(UNITS.man_at_arms.resource).toBe('iron');
    expect(UNITS.musketman.resource).toBe('niter');
    expect(UNITS.cannon.resource).toBe('niter');
    expect(UNITS.tank.resource).toBe('oil');
  });

  it('ranged units carry range + ranged strength; base-roster anti-cavalry, siege and mounted get their modifiers', () => {
    for (const u of Object.values(UNITS)) {
      if (u.class === 'ranged' || u.class === 'siege') {
        expect(u.rangedStrength, u.id).toBeGreaterThan(0);
        expect(u.range, u.id).toBeGreaterThan(0);
      }
      // leader uniques may deliberately break the class rules
      if (u.uniqueTo) continue;
      if (u.class === 'siege') expect(u.bonusVs?.city, u.id).toBe(200);
      if (u.class === 'antiCavalry') expect(u.bonusVs?.mounted, u.id).toBe(100);
      if (u.class === 'mounted') expect(u.bonusVs?.city ?? 0, u.id).toBeLessThan(0);
    }
    expect(UNITS.at_gun.bonusVs?.armor).toBe(100);
    expect(UNITS.settler.abilities).toContain('foundCity');
    expect(UNITS.scout.abilities).toEqual(expect.arrayContaining(['ignoreTerrain', 'noZoc']));
  });
});

describe('buildings', () => {
  it('has palace (free, no tech) and walls', () => {
    expect(BUILDINGS.palace).toMatchObject({ cost: 0, tech: null, maintenance: 0 });
    expect(BUILDINGS.walls).toBeDefined();
  });

  it('every building has a valid tech of its era, a pillar, and existing requirements', () => {
    expect(Object.values(BUILDINGS).filter((b) => !b.uniqueTo).length).toBeGreaterThanOrEqual(30);
    for (const b of Object.values(BUILDINGS)) {
      expect(b.pillar, b.id).toBeDefined();
      if (b.tech != null) {
        expect(TECHS[b.tech], `${b.id} tech`).toBeDefined();
        expect(techEra(b.tech), `${b.id} era`).toBe(b.era);
      }
      if (b.requires) {
        const req = BUILDINGS[b.requires];
        expect(req, `${b.id} requires ${b.requires}`).toBeDefined();
        expect(req.era).toBeLessThanOrEqual(b.era);
      }
      if (b.id !== 'palace') expect(b.cost, b.id).toBeGreaterThan(0);
    }
  });

  it('uses landmark models exactly for the ARCHITECTURE landmark list', () => {
    for (const id of LANDMARKS) expect(BUILDINGS[id]?.model, id).toBe(`bld_${id}`);
    for (const b of Object.values(BUILDINGS)) {
      if (b.model && !b.replaces) expect(LANDMARKS).toContain(b.model.slice(4));
    }
  });
});

describe('wonders', () => {
  it('has the 18 required wonders, 3 per era, each gated by a tech of its era', () => {
    expect(Object.keys(WONDERS)).toHaveLength(18);
    WONDERS_BY_ERA.forEach((ids, era) => {
      for (const id of ids) {
        const w = WONDERS[id];
        expect(w, id).toBeDefined();
        expect(w.era).toBe(era);
        expect(w.model).toBe(`w_${id}`);
        expect(TECHS[w.tech], `${id} tech`).toBeDefined();
        expect(techEra(w.tech)).toBe(era);
        expect(w.flavor.length).toBeGreaterThan(0);
      }
    });
  });
});

describe('map content', () => {
  it('has every terrain, feature and elevation', () => {
    expect(Object.keys(TERRAINS).sort()).toEqual(['coast', 'desert', 'grassland', 'lake', 'ocean', 'plains', 'snow', 'tundra']);
    expect(Object.keys(FEATURES).sort()).toEqual(['floodplains', 'forest', 'ice', 'jungle', 'marsh', 'oasis', 'reef']);
    expect(Object.keys(ELEVATIONS).sort()).toEqual(['flat', 'hills', 'mountain']);
    expect(ELEVATIONS.mountain.impassable).toBe(true);
  });

  it('resources have the right kinds, existing improvements/techs and valid placement', () => {
    for (const [kind, ids] of Object.entries(RESOURCE_KINDS)) for (const id of ids) expect(RESOURCES[id]?.kind, id).toBe(kind);
    expect(Object.keys(RESOURCES)).toHaveLength(27);
    for (const r of Object.values(RESOURCES)) {
      expect(IMPROVEMENTS[r.improvement], `${r.id} improvement`).toBeDefined();
      expect(r.model).toBe(`res_${r.id}`);
      expect(r.weight).toBeGreaterThan(0);
      for (const t of r.terrains) expect(TERRAINS[t], `${r.id} terrain ${t}`).toBeDefined();
      for (const f of r.features ?? []) expect(FEATURES[f], `${r.id} feature ${f}`).toBeDefined();
      const waterSpots = r.terrains.map((t) => TERRAINS[t].water);
      expect(new Set(waterSpots).size, `${r.id} mixes land and water`).toBe(1);
      expect(IMPROVEMENTS[r.improvement].water ?? false, `${r.id} improvement medium`).toBe(waterSpots[0]);
      if (r.kind === 'luxury') expect(r.happiness).toBe(4);
      if (r.kind === 'strategic') expect(TECHS[r.revealTech!], `${r.id} revealTech`).toBeDefined();
    }
    expect(techEra(RESOURCES.horses.revealTech!)).toBe(0);
    expect(techEra(RESOURCES.iron.revealTech!)).toBe(0);
    expect([2, 3]).toContain(techEra(RESOURCES.niter.revealTech!));
    expect(techEra(RESOURCES.coal.revealTech!)).toBe(4);
    expect(techEra(RESOURCES.oil.revealTech!)).toBe(5);
  });

  it('improvements exist with valid techs; resource-only improvements are all used', () => {
    expect(Object.keys(IMPROVEMENTS).sort()).toEqual([...REQUIRED_IMPROVEMENTS].sort());
    for (const i of Object.values(IMPROVEMENTS)) {
      if (i.tech != null) expect(TECHS[i.tech], `${i.id} tech`).toBeDefined();
      expect(i.model).toBe(`imp_${i.id}`);
      if (i.requiresResource) expect(Object.values(RESOURCES).some((r) => r.improvement === i.id), i.id).toBe(true);
    }
  });

  it('has the 6 natural wonders on real terrain', () => {
    expect(Object.keys(NATURAL_WONDERS).sort()).toEqual([...REQUIRED_NATURAL_WONDERS].sort());
    for (const n of Object.values(NATURAL_WONDERS)) {
      expect(n.model).toBe(`nw_${n.id}`);
      expect(n.effects, n.id).toBeDefined();
      for (const t of n.terrains) expect(TERRAINS[t]?.water, `${n.id} ${t}`).toBe(false);
    }
  });
});

describe('promotions', () => {
  it('spans 3 tiers with requirements from a lower tier sharing a class', () => {
    const promos = Object.values(PROMOTIONS);
    expect(promos.length).toBeGreaterThanOrEqual(28);
    for (const tier of [1, 2, 3]) expect(promos.some((p) => p.tier === tier)).toBe(true);
    for (const p of promos) {
      if (p.tier === 1) expect(p.requires ?? []).toHaveLength(0);
      for (const r of p.requires ?? []) {
        const req = PROMOTIONS[r];
        expect(req, `${p.id} requires ${r}`).toBeDefined();
        expect(req.tier).toBeLessThan(p.tier);
        expect(p.classes.every((c) => req.classes.includes(c)), `${p.id} classes ⊆ ${r}`).toBe(true);
      }
    }
  });

  it('every combat unit class can earn a tier-1 promotion', () => {
    for (const cls of ['melee', 'antiCavalry', 'ranged', 'mounted', 'siege', 'armor', 'recon'] as const) {
      expect(Object.values(PROMOTIONS).some((p) => p.tier === 1 && p.classes.includes(cls)), cls).toBe(true);
    }
  });
});

describe('great library helper', () => {
  it('offers the cheapest researchable techs, never ones with missing prereqs', () => {
    expect(cheapestAvailableTechs([], 3).sort()).toEqual(['agriculture', 'animal_husbandry', 'mining']);
    const picks = cheapestAvailableTechs(['agriculture'], 2);
    expect(picks).toEqual(['animal_husbandry', 'mining']);
    expect(cheapestAvailableTechs(['agriculture', 'animal_husbandry', 'mining'], 1)).toEqual(['archery']);
  });
});
