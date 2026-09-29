// OWNER: Nations. Starting Crew of the twelve nations (noShop), registered in the shared Doctrine registry.
import type { DoctrineDef } from '../sim/defs';
import { registerCrew } from './doctrineRegistry';
import { addGold } from '../sim/economy';
import { grantXp } from '../sim/units';
export const NATION_CREW: DoctrineDef[] = [
  {
    id: 'astronaut', name: 'The Astronaut', rarity: 'uncommon', cost: 6, noShop: true, nation: 'usa',
    description: 'The first EVA specialist to plant a flag on Mars. Each chapter in which you found a Colony, gain **2** {splendor}.',
    flavor: '“One small step for a person. One enormous liability waiver for the mission.”', tags: ['nation', 'colonies', 'splendor'], icon: 'star', art: { hue: 212, motif: 'star' },
    effects: { chronicle(_ctx, c) { if (c.stats.citiesFounded) c.addSplendor(2); } },
  },
  {
    id: 'foreman', name: 'The Foreman', rarity: 'uncommon', cost: 6, noShop: true, nation: 'china',
    description: 'A schedule with a schedule. Every city with a Fabricator makes **+2** {prod}.',
    flavor: 'The five-year plan is on schedule. The schedule is also on fire.', tags: ['nation', 'industry', 'buildings'], icon: 'gear', art: { hue: 4, motif: 'gear' },
    effects: { cityYield(_ctx, a) { if (a.city.buildings.includes('workshop') || a.city.buildings.includes('rbmk_reactor') || a.city.buildings.includes('robotics_lab')) a.yields.prod += 2; } },
  },
  {
    id: 'veteran_cosmonaut', name: 'The Veteran Cosmonaut', rarity: 'uncommon', cost: 6, noShop: true, nation: 'russia',
    description: 'Has already survived two failed landings and one committee. Your units gain **+20%** defense.',
    flavor: '“This is not the worst thing that has happened in orbit.”', tags: ['nation', 'combat', 'survival'], icon: 'shield', art: { hue: 195, motif: 'moon' },
    effects: { combat(ctx, a) { const unit = a.side === 'attack' ? a.attacker : a.defender; if (unit?.owner === ctx.player.id && a.side === 'defense') a.defenseMods.push({ label: 'Veteran Cosmonaut', pct: 20 }); } },
  },
  {
    id: 'jugaad_mechanic', name: 'The Jugaad Mechanic', rarity: 'uncommon', cost: 6, noShop: true, nation: 'india',
    description: 'If it rattles, it is a prototype. Every city gains **+1** {sci} for each working installation in its territory.',
    flavor: 'The replacement part is a spoon. The spoon is load-bearing.', tags: ['nation', 'science', 'installations'], icon: 'flask', art: { hue: 28, motif: 'flask' },
    effects: { cityYield(ctx, a) { let count = 0; for (const idx of a.city.worked) { const tile = ctx.state.map.tiles[idx]; if (tile?.improvement && !tile.pillaged) count++; } a.yields.sci += count; } },
  },
  {
    id: 'roboticist', name: 'The Roboticist', rarity: 'uncommon', cost: 6, noShop: true, nation: 'japan',
    description: 'Every newly built unit starts with enough field experience to choose a free promotion.',
    flavor: 'The manual is 900 pages. The robot has read all of them and is disappointed in you.', tags: ['nation', 'units', 'combat'], icon: 'gear', art: { hue: 350, motif: 'gear' },
    effects: {
      onGain(ctx) { for (const unit of Object.values(ctx.state.units)) if (unit.owner === ctx.player.id && !unit.promotionChoices) grantXp(ctx.state, unit, 100, ctx.emit); },
      onEvent(ctx, ev) { if (ev.type !== 'unitCreated' || ev.player !== ctx.player.id) return; const unit = ctx.state.units[ev.unitId]; if (!unit || unit.promotionChoices) return; grantXp(ctx.state, unit, 100, ctx.emit); },
    },
  },
  {
    id: 'la_joconde', name: 'La Joconde', rarity: 'legendary', cost: 20, noShop: true, nation: 'france',
    description: 'The Mona Lisa made the crossing. At the end of every chapter, her smile permanently adds **+1** {splendor}.',
    flavor: 'The frame is pressure-sealed. The expression remains difficult to interpret.', tags: ['nation', 'legendary', 'scaling', 'splendor'], icon: 'mask', art: { hue: 42, motif: 'mask' },
    effects: { chronicle(_ctx, c) { c.addSplendor(1); } },
  },
  {
    id: 'botanist', name: 'The Botanist', rarity: 'uncommon', cost: 6, noShop: true, nation: 'brazil',
    description: 'Keeps the last seed bank alive. Clay Basin and Ancient Delta tiles worked by your colonies yield **+1** {food}.',
    flavor: '“It is not a weed if it is the only green thing for 80 million kilometers.”', tags: ['nation', 'food', 'growth'], icon: 'tree', art: { hue: 104, motif: 'tree' },
    effects: { tileYield(ctx, a) { if (a.city?.owner === ctx.player.id && (a.tile.terrain === 'grassland' || a.tile.feature === 'floodplains')) a.yields.food += 1; } },
  },
  {
    id: 'wealth_manager', name: 'The Wealth Manager', rarity: 'uncommon', cost: 6, noShop: true, nation: 'uae',
    description: 'Makes the credits compound, even when gravity does not. Your Sol Report gains **+1** {splendor} per 100 Credits held.',
    flavor: 'Diversified portfolio: oxygen futures, regolith options, one very nervous banker.', tags: ['nation', 'credits', 'economy'], icon: 'coin', art: { hue: 38, motif: 'coin' },
    effects: { chronicle(ctx, c) { const n = Math.floor(ctx.player.gold / 100); if (n) c.addSplendor(n); } },
  },
  {
    id: 'nollywood_star', name: 'The Nollywood Star', rarity: 'uncommon', cost: 6, noShop: true, nation: 'nigeria',
    description: 'Turns every Feral Den into a production set. Clearing one pays **+10** {gold}.',
    flavor: 'The camera crew is safe. The monster is union talent.', tags: ['nation', 'ferals', 'credits'], icon: 'flame', art: { hue: 330, motif: 'flame' },
    effects: { onEvent(ctx, ev) { if (ev.type === 'campCleared' && ev.player === ctx.player.id) addGold(ctx.state, ctx.player.id, 10, 'Nollywood box office', ctx.emit); } },
  },
  {
    id: 'private_banker', name: 'The Private Banker', rarity: 'uncommon', cost: 6, noShop: true, nation: 'switzerland',
    description: 'Keeps the books balanced and the shutters closed. Each chapter, gain **+1** {splendor} per 10 Scrip in reserve.',
    flavor: 'The vault is neutral. The vault is also not answering questions.', tags: ['nation', 'scrip', 'economy'], icon: 'shield', art: { hue: 208, motif: 'key' },
    effects: { chronicle(ctx, c) { const n = Math.floor(ctx.state.run.influence / 10); if (n) c.addSplendor(n); } },
  },
  {
    id: 'eternal_leader', name: 'Eternal Leader', rarity: 'legendary', cost: 20, noShop: true, noSell: true, nation: 'north_korea',
    description: 'The portrait is mandatory. **×2** {splendor}; cannot be sold.',
    flavor: 'The frame has a frame. Both have portraits.', tags: ['nation', 'legendary', 'splendor'], icon: 'crown', art: { hue: 0, motif: 'crown' },
    effects: { chronicle(_ctx, c) { c.mulSplendor(2, 'Eternal Leader'); } },
  },
  {
    id: 'cardinal', name: 'The Cardinal', rarity: 'uncommon', cost: 6, noShop: true, nation: 'vatican',
    description: 'Keeps faith with the colony, even when the colony is mostly duct tape. Each Sol Report gains **+2** {splendor}.',
    flavor: '“The red planet was always in the prophecy. The paperwork was not.”', tags: ['nation', 'faith', 'splendor'], icon: 'chalice', art: { hue: 8, motif: 'chalice' },
    effects: { chronicle(_ctx, c) { c.addSplendor(2); } },
  },
];

registerCrew(NATION_CREW);
