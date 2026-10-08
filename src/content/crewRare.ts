// OWNER: CrewReskin. Rare & Legendary Crew — merged into DOCTRINES by content/index.ts.
import type { DoctrineDef } from '../sim/defs';
import { registerCrew } from './doctrineRegistry';
import { EDICTS } from './edicts';
import { CRISES } from './crises';
import { randInt } from '../sim/rng';
import { changeMandate, CRISIS_CHAPTER } from '../sim/roguelite';
import {
isRiverTile,isWoodland,cityTileOf,isRiverCity,countOwnedTiles,countBuildings,countWonders,ownMod,ownUnit,doctrineIndex,destroyDoctrine,mul,copyChronicle,COUNCIL_REPRICER
} from './doctrines';

export const RARE: DoctrineDef[] = [
  {
    id: 'echo', name: 'The Last Astronaut on the Moon', rarity: 'rare', cost: 8,
    description: 'Copies the Chapter Report effect of the Crew member to its right.',
    flavor: 'Earth kept the Moon. He got the ticket home nobody wanted.',
    tags: ['position', 'copy'], icon: 'chevronRight', art: { hue: 190, motif: 'feather' }, nation: 'usa',
    unlock: { text: 'Reach the Terraform era.', rule: 'reachEra4' },
    effects: {
      chronicle(ctx, c) {
        const i = doctrineIndex(ctx.state, ctx.uid);
        if (i >= 0) copyChronicle(ctx, ctx.state.run.doctrines[i + 1], c);
      },
    },
  },
  {
    id: 'keystone', name: 'The Welder Who Stayed', rarity: 'rare', cost: 8,
    description: '**×1** {splendor}, plus **×0.25** for each Crew member to its left.',
    flavor: 'He fixed one more crack, then stayed for the next alarm.',
    tags: ['position', 'xsplendor'], icon: 'castle', art: { hue: 36, motif: 'key' }, nation: 'china',
    unlock: { text: 'Reach the Expansion era.', rule: 'reachEra3' },
    effects: {
      chronicle(ctx, c) { const i = doctrineIndex(ctx.state, ctx.uid); if (i > 0) mul(c, 1 + 0.25 * i); },
    },
  },
  {
    id: 'iron_oath', name: 'The Last Peacekeeper', rarity: 'rare', cost: 8,
    description: '**×3** {splendor}. Lose 1 {mandate} each time Raiders destroy a unit in your colony.',
    flavor: 'The ceasefire held until someone found the food list.',
    tags: ['conquest', 'risk', 'xsplendor'], icon: 'war', art: { hue: 0, motif: 'sword' }, nation: 'russia',
    unlock: { text: 'Defeat 40 enemy units in a single run.', rule: 'kills40' },
    effects: {
      chronicle(_ctx, c) { mul(c, 3); },
      onEvent(ctx, ev) {
        if (ev.type !== 'combat' || ev.defender.cityId == null || ev.defender.player !== ctx.player.id || !ev.defenderKilled) return;
        ctx.flash('Raiders broke in!', ev.defender.tile);
        changeMandate(ctx.state, -1, 'Raiders broke into a colony', ctx.emit);
      },
    },
  },
  {
    id: 'collectors_cabinet', name: 'The Relic Keeper', rarity: 'rare', cost: 8,
    description: '**×1.25** {splendor} for each Crew member with an edition.',
    flavor: 'She labels every relic. The empty boxes get labels too.',
    tags: ['edition', 'xsplendor'], icon: 'star', art: { hue: 55, motif: 'key' }, nation: 'france',
    unlock: { text: 'End a run owning a Legendary Crew member.', rule: 'legendary' },
    effects: {
      chronicle(ctx, c) { const n = ctx.state.run.doctrines.filter((d) => d.edition !== 'base').length; if (n) mul(c, Math.pow(1.25, n)); },
    },
  },
  {
    id: 'warlords_crown', name: 'The Camp Broker', rarity: 'rare', cost: 8,
    description: '**×1** {splendor}, plus **×0.25** for each Raider Camp you clear this chapter.',
    flavor: 'Every Raider Camp has a boss. Usually the one with the gun.',
    tags: ['conquest', 'xsplendor'], icon: 'crown', art: { hue: 356, motif: 'crown' }, nation: 'nigeria',
    unlock: { text: 'Win a run as Nigeria.', rule: 'winWith:nigeria' },
    effects: {
      chronicle(_ctx, c) { if (c.stats.campsCleared) mul(c, 1 + 0.25 * c.stats.campsCleared); },
    },
  },
  {
    id: 'codex_infinitum', name: 'The Dead Earth Listener', rarity: 'rare', cost: 8,
    description: '**+1** {splendor} for every 3 techs you know.',
    flavor: 'The static has a rhythm. It sounds almost like home.',
    tags: ['science', 'splendor', 'scaling'], icon: 'book', art: { hue: 238, motif: 'book' }, nation: 'india',
    unlock: { text: 'Learn 24 techs in a single run.', rule: 'techs24' },
    status(_counters, state) { return `+${Math.floor((state.players[0]?.techs.length ?? 0) / 3)} Multiplier`; },
    effects: {
      chronicle(ctx, c) { const n = Math.floor(ctx.player.techs.length / 3); if (n) c.addSplendor(n); },
    },
  },
  {
    id: 'momentum', name: 'The Big Win Addict', rarity: 'rare', cost: 8,
    description: '**×2** {splendor} if your last Chapter Report was a Big Win.',
    flavor: 'One good report. Now everyone expects a miracle.',
    tags: ['risk', 'xsplendor'], icon: 'arrowUp', art: { hue: 48, motif: 'eagle' }, nation: 'uae',
    unlock: { text: 'Get 5 Big Wins in a single run.', rule: 'triumphs5' },
    status(_counters, state) { return state.run.lastChronicle?.triumph ? 'Active: ×2 Multiplier' : 'Inactive'; },
    effects: {
      chronicle(ctx, c) { if (ctx.state.run.lastChronicle?.triumph) mul(c, 2); },
    },
  },
  {
    id: 'river_of_gold', name: 'The Ice Channel Mapper', rarity: 'rare', cost: 8,
    description: 'Ice Channel tiles give +1 {gold}. **×1.5** {splendor} if your Capital is on an Ice Channel.',
    flavor: 'She maps the water that still hides under the ice.',
    tags: ['river', 'gold', 'xsplendor'], icon: 'river', art: { hue: 46, motif: 'river' }, nation: 'brazil',
    effects: {
      tileYield(_ctx, a) { if (isRiverTile(a.tile)) a.yields.gold += 1; },
      chronicle(ctx, c) { const cap = c.cities.find((x) => x.isCapital); if (cap && isRiverCity(ctx.state, cap)) mul(c, 1.5); },
    },
  },
  {
    id: 'sky_citadels', name: 'The Antenna Climber', rarity: 'rare', cost: 8,
    description: 'Colonies on Hills give +20% {prod}. **+3** {splendor} for each colony on Hills.',
    flavor: 'From up there, even a dead satellite looks like a star.',
    tags: ['mountain', 'production', 'splendor'], icon: 'castle', art: { hue: 205, motif: 'tower' }, nation: 'japan',
    unlock: { text: 'Win a run as Switzerland.', rule: 'winWith:switzerland' },
    effects: {
      cityYield(ctx, a) { if (cityTileOf(ctx.state, a.city).elevation === 'hills') a.pct.prod += 20; },
      chronicle(ctx, c) { const n = c.cities.filter((x) => cityTileOf(ctx.state, x).elevation === 'hills').length; if (n) c.addSplendor(3 * n); },
    },
  },
  {
    id: 'desert_bloom', name: 'The Dunes Gardener', rarity: 'rare', cost: 8,
    description: 'Dunes tiles give +2 {food}. **+1** {splendor} for every 3 Dunes tiles you own.',
    flavor: 'The seeds were older than the planet. Somehow, they grew.',
    tags: ['desert', 'growth', 'splendor'], icon: 'food', art: { hue: 42, motif: 'sun' }, nation: 'brazil',
    unlock: { text: 'Win a run as India.', rule: 'winWith:india' },
    effects: {
      tileYield(_ctx, a) { if (a.tile.terrain === 'desert') a.yields.food += 2; },
      chronicle(ctx, c) { const n = Math.floor(countOwnedTiles(ctx.state, ctx.player.id, (t) => t.terrain === 'desert') / 3); if (n) c.addSplendor(n); },
    },
  },
  {
    id: 'elder_canopy', name: 'The Rock Spire Tender', rarity: 'rare', cost: 8,
    description: '**×1.5** {splendor} if you own 12 or more Rock Spires or Lava Tubes tiles.',
    flavor: 'The stone spires keep the wind company. She keeps them company.',
    tags: ['forest', 'xsplendor'], icon: 'tree', art: { hue: 128, motif: 'tree' }, nation: 'vatican',
    unlock: { text: 'Win a run as the Holy See.', rule: 'winWith:vatican' },
    status(_counters, state) { return `${countOwnedTiles(state, 0, isWoodland)}/12 Rock Spires and Lava Tubes tiles`; },
    effects: {
      chronicle(ctx, c) { if (countOwnedTiles(ctx.state, ctx.player.id, isWoodland) >= 12) mul(c, 1.5); },
    },
  },
  {
    id: 'alchemy', name: 'The Man Who Sold Earth', rarity: 'rare', cost: 8,
    description: '**+1** {renown} for each {gold} you earn this chapter.',
    flavor: 'He sold the deed to Earth. Nobody checked if it was real.',
    tags: ['gold', 'renown'], icon: 'flask', art: { hue: 52, motif: 'flask' }, nation: 'usa',
    effects: {
      chronicle(_ctx, c) { const n = Math.floor(c.stats.gold); if (n > 0) c.addRenown(n); },
    },
  },
  {
    id: 'imperial_mandate', name: 'The Last Shift Director', rarity: 'rare', cost: 8,
    description: '**+1** max {mandate} and restore 1 {mandate}.',
    flavor: 'One more shift. One more sunrise in the habitat window.',
    tags: ['crisis', 'mandate'], icon: 'mandate', art: { hue: 44, motif: 'sun' }, nation: 'switzerland',
    unlock: { text: 'Win a run without losing any Lives.', rule: 'noMandateLost' },
    effects: {
      onGain(ctx) {
        ctx.state.run.maxMandate += 1;
        changeMandate(ctx.state, 1, 'Shift Director gain', ctx.emit);
      },
      onLose(ctx) {
        const run = ctx.state.run;
        run.maxMandate = Math.max(1, run.maxMandate - 1);
        if (run.mandate > run.maxMandate) changeMandate(ctx.state, run.maxMandate - run.mandate, 'Shift Director lost', ctx.emit);
      },
    },
  },
  {
    id: 'marshals_baton', name: 'Mission Commander Zero', rarity: 'rare', cost: 8,
    description: 'All your units get +1 movement.',
    flavor: 'She has no medals, no orders, and one working rover.',
    tags: ['conquest', 'exploration'], icon: 'moves', art: { hue: 8, motif: 'eagle' }, nation: 'north_korea',
    effects: {
      unitMoves(_ctx, a) { a.value += 1; },
    },
  },
  {
    id: 'edifice_complex', name: 'The Dome Fan', rarity: 'rare', cost: 8,
    description: '**+1** {splendor} for every 4 Improvements you own.',
    flavor: 'If it has an airtight door, he calls it art.',
    tags: ['production', 'splendor', 'scaling'], icon: 'building', art: { hue: 32, motif: 'tower' }, nation: 'japan',
    effects: {
      chronicle(ctx, c) { const n = Math.floor(countBuildings(ctx.state, ctx.player.id) / 4); if (n) c.addSplendor(n); },
    },
  },
  {
    id: 'campfire_tales', name: 'Ghost of Ground Control', rarity: 'rare', cost: 8,
    description: 'Gains **+2** {splendor} each time another Crew member is sold or lost.',
    flavor: 'The old voices still tell stories. The new radios only hiss.',
    tags: ['scaling', 'splendor', 'shop'], icon: 'flame', art: { hue: 22, motif: 'flame' }, nation: 'vatican',
    unlock: { text: 'Play 3 runs.', rule: 'runs3' },
    status(counters) { return `+${counters.splendor ?? 0} Multiplier`; },
    effects: {
      onEvent(ctx, ev) {
        if (ev.type !== 'doctrineLost' || ev.uid === ctx.uid) return;
        ctx.counters.splendor = (ctx.counters.splendor ?? 0) + 2;
        ctx.flash(`+${ctx.counters.splendor} Multiplier`);
      },
      chronicle(ctx, c) { const n = ctx.counters.splendor ?? 0; if (n) c.addSplendor(n); },
    },
  },
  {
    id: 'harbinger', name: 'The Storm-Warning Voice', rarity: 'rare', cost: 8,
    description: 'Targets in Crisis chapters are 25% higher, but you get **×2.5** {splendor} in them.',
    flavor: 'The forecast is clear. The future is not.',
    tags: ['crisis', 'risk', 'xsplendor'], icon: 'crisis', art: { hue: 345, motif: 'skull' }, nation: 'russia',
    unlock: { text: 'Survive 6 Crisis chapters in a single run.', rule: 'crises6' },
    effects: {
      target(ctx, a) { if (ctx.state.run.chapter === CRISIS_CHAPTER) a.value *= 1.25; },
      chronicle(ctx, c) { if (ctx.state.run.crisisActive) mul(c, 2.5); },
    },
  },
  {
    id: 'glass_crown', name: 'Glass-Blower Ines', rarity: 'rare', cost: 8,
    description: '**×4** {splendor}. Breaks if you fail a Chapter Report.',
    flavor: 'She made the dome perfect. Mars did not agree.',
    tags: ['risk', 'xsplendor'], icon: 'crown', art: { hue: 180, motif: 'crown' }, nation: 'uae',
    unlock: { text: 'Win a run on Difficulty 4.', rule: 'winAsc4' },
    effects: {
      chronicle(_ctx, c) { mul(c, 4); },
      onEvent(ctx, ev) {
        if (ev.type !== 'chronicle' || ev.result.passed || ctx.uid == null) return;
        ctx.flash('Dome cracked!');
        destroyDoctrine(ctx.state, ctx.uid, ctx.emit);
      },
    },
  },
  {
    id: 'banner_of_ascendancy', name: 'Convoy Sergeant Chen', rarity: 'rare', cost: 8,
    description: 'Your units get +20% strength. **+1** {splendor} for each enemy unit you defeat this chapter.',
    flavor: 'A torn flag still helps you find the convoy in the dust.',
    tags: ['conquest', 'splendor'], icon: 'sword', art: { hue: 3, motif: 'shield' }, nation: 'china',
    effects: {
      combat(_ctx, a) { if (ownUnit(a)) ownMod(a, 'Convoy Flag', 20); },
      chronicle(_ctx, c) { if (c.stats.kills) c.addSplendor(c.stats.kills); },
    },
  },
  {
    id: 'dynasty', name: 'The Ark Family', rarity: 'rare', cost: 8,
    description: '**×1** {splendor}, plus **×0.5** more at the start of each era.',
    flavor: 'The family tree is a Pod list with half the names crossed out.',
    tags: ['scaling', 'xsplendor'], icon: 'crown', art: { hue: 40, motif: 'tree' }, nation: 'france',
    unlock: { text: 'Reach the New Earth era.', rule: 'reachEra5' },
    status(counters) { return `×${1 + 0.5 * (counters.eras ?? 0)} Multiplier`; },
    effects: {
      onEvent(ctx, ev) {
        if (ev.type !== 'eraStarted') return;
        ctx.counters.eras = (ctx.counters.eras ?? 0) + 1;
        ctx.flash(`×${1 + 0.5 * ctx.counters.eras} Multiplier`);
      },
      chronicle(ctx, c) { mul(c, 1 + 0.5 * (ctx.counters.eras ?? 0)); },
    },
  },
  {
    id: 'scholars_quill', name: 'The Research Scribe', rarity: 'rare', cost: 8,
    description: '**×1.2** {splendor} for each level of your Focus above 1.',
    flavor: 'She writes everything down. Memory needs power.',
    tags: ['focus', 'level', 'xsplendor'], icon: 'feather', art: { hue: 248, motif: 'feather' }, nation: 'india',
    unlock: { text: 'Score 100,000 in a single Chapter Report.', rule: 'score100k' },
    effects: {
      chronicle(ctx, c) { const n = Math.max(0, (ctx.state.run.pillarLevels[c.focus] ?? 1) - 1); if (n) mul(c, Math.pow(1.2, n)); },
    },
  },
  {
    id: 'silver_tongue', name: 'The Coin Haggler', rarity: 'rare', cost: 8,
    description: 'Everything in the Shop costs **1** {influence} less.',
    flavor: 'She can haggle with a vending machine. It usually wins.',
    tags: ['influence', 'shop'], icon: 'influence', art: { hue: 272, motif: 'hand' }, nation: 'nigeria',
    unlock: { text: 'Play 10 runs.', rule: 'runs10' },
    effects: {
      ...COUNCIL_REPRICER,
    },
  },
];

export const LEGENDARY: DoctrineDef[] = [
  {
    id: 'mirror_court', name: 'The Ghost Astronaut of Phobos', rarity: 'legendary', cost: 12,
    description: 'Copies the Chapter Report effect of your leftmost Crew member, then **×1.5** {splendor}.',
    flavor: 'A thousand reflections in a visor. Nobody looks back.',
    tags: ['position', 'copy', 'xsplendor'], icon: 'eye', art: { hue: 200, motif: 'eye' },
    unlock: { text: 'Win a run on Difficulty 2.', rule: 'winAsc2' },
    effects: {
      chronicle(ctx, c) {
        const first = ctx.state.run.doctrines[0];
        if (first && first.uid !== ctx.uid) copyChronicle(ctx, first, c);
        mul(c, 1.5);
      },
    },
  },
  {
    id: 'eternal_emperor', name: 'The Unlisted Passenger', rarity: 'legendary', cost: 12,
    description: 'Gains **+×0.5** {splendor} each time you clear a Raider Camp (starts at ×1).',
    flavor: 'The list says he died on Earth. He says it was a mistake.',
    tags: ['conquest', 'scaling', 'xsplendor'], icon: 'crown', art: { hue: 350, motif: 'crown' },
    unlock: { text: 'Clear 10 Raider Camps in a single run.', rule: 'camps10' },
    status(counters) { return `×${1 + 0.5 * (counters.camps ?? 0)}`; },
    effects: {
      onEvent(ctx, ev) {
        if (ev.type !== 'campCleared' || ev.player !== ctx.player.id) return;
        ctx.counters.camps = (ctx.counters.camps ?? 0) + 1;
        ctx.flash(`×${1 + 0.5 * ctx.counters.camps}`, ev.tile);
      },
      chronicle(ctx, c) { mul(c, 1 + 0.5 * (ctx.counters.camps ?? 0)); },
    },
  },
  {
    id: 'golden_sovereign', name: 'The Last Ark Treasurer', rarity: 'legendary', cost: 12,
    description: '**×1.25** {splendor} for each colony with 12 or more pop.',
    flavor: 'Her money book is the only thing that survived.',
    tags: ['tall', 'growth', 'xsplendor'], icon: 'crown', art: { hue: 46, motif: 'sun' },
    unlock: { text: 'Own 8 colonies at the end of a run.', rule: 'cities8' },
    effects: {
      chronicle(_ctx, c) { const n = c.cities.filter((x) => x.pop >= 12).length; if (n) mul(c, Math.pow(1.25, n)); },
    },
  },
  {
    id: 'undying_architect', name: 'The Mars Architect', rarity: 'legendary', cost: 12,
    description: 'Gains **+×0.5** {splendor} for every 8 Improvements you build (starts at ×1).',
    flavor: 'He builds for people who are still asleep in their Pods.',
    tags: ['production', 'scaling', 'xsplendor'], icon: 'building', art: { hue: 30, motif: 'tower' },
    unlock: { text: 'Build 4 Wonders in a single run.', rule: 'wonders4' },
    status(counters) { const n = counters.built ?? 0; return `×${1 + 0.5 * Math.floor(n / 8)} Multiplier (${n % 8}/8)`; },
    effects: {
      onEvent(ctx, ev) {
        if (ev.type !== 'buildingBuilt' || ev.player !== ctx.player.id || ev.building === 'palace') return;
        ctx.counters.built = (ctx.counters.built ?? 0) + 1;
        if (ctx.counters.built % 8 === 0) ctx.flash(`×${1 + 0.5 * (ctx.counters.built / 8)} Multiplier`);
      },
      chronicle(ctx, c) { mul(c, 1 + 0.5 * Math.floor((ctx.counters.built ?? 0) / 8)); },
    },
  },
  {
    id: 'the_unbowed', name: 'The Stormproof Keeper', rarity: 'legendary', cost: 12,
    description: 'Ignores Crisis target increases. **×3** {splendor} during Crisis chapters.',
    flavor: 'Let the sky turn red. The seals are holding.',
    tags: ['crisis', 'xsplendor'], icon: 'shield', art: { hue: 340, motif: 'shield' },
    unlock: { text: 'Survive 6 Crisis chapters in a single run.', rule: 'crises6' },
    effects: {
      target(ctx, a) {
        const run = ctx.state.run;
        if (run.chapter !== CRISIS_CHAPTER || !run.crisis) return;
        const m = CRISES[run.crisis]?.targetMul ?? 1;
        if (m > 0) a.value /= m;
      },
      chronicle(ctx, c) { if (ctx.state.run.crisisActive) mul(c, 3); },
    },
  },
  {
    id: 'the_archivist', name: 'The Last Data Keeper', rarity: 'legendary', cost: 12,
    description: 'At the start of each chapter, copy a random Boost you hold (up to 2 over your slot limit).',
    flavor: 'Nothing is lost. Everything is saved twice.',
    tags: ['edict', 'scaling'], icon: 'scroll', art: { hue: 288, motif: 'scroll' },
    unlock: { text: 'Raise a Focus pillar to level 5 in a single run.', rule: 'focusLevel5' },
    effects: {
      onEvent(ctx, ev) {
        if (ev.type !== 'chapterStarted' || !ctx.player.isHuman) return;
        const run = ctx.state.run;
        if (!run.edicts.length || run.edicts.length >= run.edictSlots + 2) return;
        const src = run.edicts[randInt(ctx.state.rng, run.edicts.length)];
        run.edicts.push({ uid: run.nextUid++, id: src.id });
        ctx.flash(`Copied ${EDICTS[src.id]?.name ?? 'Boost'}`);
      },
    },
  },
  {
    id: 'architect_of_ages', name: 'The Wonder Foreman', rarity: 'legendary', cost: 12,
    description: 'Wonders cost 30% less {prod}. **×1.5** {splendor} for each Wonder you own.',
    flavor: 'Stone lasts longer than people. Red dust lasts longer than stone.',
    tags: ['wonders', 'production', 'xsplendor'], icon: 'wonder', art: { hue: 38, motif: 'pyramid' },
    unlock: { text: 'Build 8 Wonders in a single run.', rule: 'wonders8' },
    effects: {
      cost(_ctx, a) { if (a.currency === 'prod' && a.item.kind === 'wonder') a.cost *= 0.7; },
      chronicle(ctx, c) { const n = countWonders(ctx.state, ctx.player.id); if (n) mul(c, Math.pow(1.5, n)); },
    },
  },
  {
    id: 'apotheosis', name: 'The Last Report', rarity: 'legendary', cost: 12,
    description: 'Repeats the Chapter Report effect of every Crew member to its left.',
    flavor: 'History, sent one last time, becomes a warning.',
    tags: ['position', 'copy'], icon: 'sun', art: { hue: 50, motif: 'sun' },
    unlock: { text: 'Win a run.', rule: 'win' },
    effects: {
      chronicle(ctx, c) {
        const list = ctx.state.run.doctrines;
        const i = doctrineIndex(ctx.state, ctx.uid);
        for (let k = 0; k < i; k++) copyChronicle(ctx, list[k], c);
      },
    },
  },
];

registerCrew(RARE);
registerCrew(LEGENDARY);
