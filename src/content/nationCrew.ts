// OWNER: Nations. Starting Crew of the original twelve nations (the rest live in content/nations/*) (noShop), registered in the shared Doctrine registry.
import type { DoctrineDef } from '../sim/defs';
import { registerCrew } from './doctrineRegistry';
import { addGold } from '../sim/economy';
import { grantXp, xpToNextLevel } from '../sim/units';
export const NATION_CREW: DoctrineDef[] = [
  {
    id: 'astronaut', name: 'The Astronaut', rarity: 'uncommon', cost: 6, noShop: true, nation: 'usa',
    description: 'The first person to plant a flag on Mars. At the end of each chapter, gain **+20** {renown} for each Colony you founded that chapter.',
    flavor: '“One small step for a person. One huge form to sign for the mission.”', tags: ['nation', 'colonies', 'renown'], icon: 'star', art: { hue: 212, motif: 'star' },
    effects: { chronicle(_ctx, c) { if (c.stats.citiesFounded) c.addRenown(20 * c.stats.citiesFounded); } },
  },
  {
    id: 'foreman', name: 'The Foreman', rarity: 'uncommon', cost: 6, noShop: true, nation: 'china',
    description: 'Every colony with a Workshop makes **+2** {prod}.',
    flavor: 'The plan is on time. The clock is also on fire.', tags: ['nation', 'industry', 'buildings'], icon: 'gear', art: { hue: 4, motif: 'gear' },
    effects: { cityYield(_ctx, a) { if (a.city.buildings.includes('workshop') || a.city.buildings.includes('rbmk_reactor') || a.city.buildings.includes('robotics_lab')) a.yields.prod += 2; } },
  },
  {
    id: 'veteran_cosmonaut', name: 'The Veteran Cosmonaut', rarity: 'uncommon', cost: 6, noShop: true, nation: 'russia',
    description: 'Survived two bad landings and one long meeting. Your units get **+20%** defense.',
    flavor: '“This is not the worst thing that has happened in orbit.”', tags: ['nation', 'combat', 'survival'], icon: 'shield', art: { hue: 195, motif: 'moon' },
    effects: { combat(ctx, a) { const unit = a.side === 'attack' ? a.attacker : a.defender; if (unit?.owner === ctx.player.id && a.side === 'defense') a.defenseMods.push({ label: 'Veteran Cosmonaut', pct: 20 }); } },
  },
  {
    id: 'jugaad_mechanic', name: 'The Jugaad Mechanic', rarity: 'uncommon', cost: 6, noShop: true, nation: 'india',
    description: 'Fixes anything with anything. Each colony gets **+1** {sci} for each worked tile with an Improvement.',
    flavor: 'The new part is a spoon. The spoon holds the roof up.', tags: ['nation', 'science', 'installations'], icon: 'flask', art: { hue: 28, motif: 'flask' },
    effects: { cityYield(ctx, a) { let count = 0; for (const idx of a.city.worked) { const tile = ctx.state.map.tiles[idx]; if (tile?.improvement) count++; } a.yields.sci += count; } },
  },
  {
    id: 'roboticist', name: 'The Roboticist', rarity: 'uncommon', cost: 6, noShop: true, nation: 'japan',
    description: 'Every new unit gets a free promotion. Your current units get one when you hire this Crew.',
    flavor: 'The manual has 900 pages. The robot read them all and is not impressed.', tags: ['nation', 'units', 'combat'], icon: 'gear', art: { hue: 350, motif: 'gear' },
    effects: {
      onGain(ctx) { for (const unit of Object.values(ctx.state.units)) if (unit.owner === ctx.player.id) grantXp(unit, xpToNextLevel(unit), ctx.emit); },
      onEvent(ctx, ev) { if (ev.type !== 'unitCreated' || ev.player !== ctx.player.id) return; const unit = ctx.state.units[ev.unitId]; if (unit) grantXp(unit, xpToNextLevel(unit), ctx.emit); },
    },
  },
  {
    id: 'la_joconde', name: 'La Joconde', rarity: 'legendary', cost: 20, noShop: true, nation: 'france',
    description: 'The Mona Lisa made the trip. At the end of each chapter, gain **+1** {splendor} for the rest of the run.',
    flavor: 'The frame is sealed tight. Her smile is still a mystery.', tags: ['nation', 'legendary', 'scaling', 'splendor'], icon: 'mask', art: { hue: 42, motif: 'mask' },
    effects: { chronicle(_ctx, c) { c.addSplendor(1); } },
  },
  {
    id: 'botanist', name: 'The Botanist', rarity: 'uncommon', cost: 6, noShop: true, nation: 'brazil',
    description: 'Keeps the last seed bank alive. Your colonies get **+1** {food} on worked Clay Basin and Old Delta tiles.',
    flavor: '“It is not a weed if it is the only green thing for 80 million kilometers.”', tags: ['nation', 'food', 'growth'], icon: 'tree', art: { hue: 104, motif: 'tree' },
    effects: { tileYield(ctx, a) { if (a.city?.owner === ctx.player.id && (a.tile.terrain === 'grassland' || a.tile.feature === 'floodplains')) a.yields.food += 1; } },
  },
  {
    id: 'wealth_manager', name: 'The Wealth Manager', rarity: 'uncommon', cost: 6, noShop: true, nation: 'uae',
    description: 'Makes money grow, even in low gravity. At the end of each chapter, gain **+1** {splendor} for every 100 {gold} you hold.',
    flavor: 'Oxygen, water, dust: he sells them all. Only the banker is nervous.', tags: ['nation', 'credits', 'economy'], icon: 'coin', art: { hue: 38, motif: 'coin' },
    effects: { chronicle(ctx, c) { const n = Math.floor(ctx.player.gold / 100); if (n) c.addSplendor(n); } },
  },
  {
    id: 'nollywood_star', name: 'The Nollywood Star', rarity: 'uncommon', cost: 6, noShop: true, nation: 'nigeria',
    description: 'Turns every Raider Camp into a film set. When you clear one, gain **+10** {gold}.',
    flavor: 'The film crew is safe. The monster is a trained actor.', tags: ['nation', 'ferals', 'credits'], icon: 'flame', art: { hue: 330, motif: 'flame' },
    effects: { onEvent(ctx, ev) { if (ev.type === 'campCleared' && ev.player === ctx.player.id) addGold(ctx.state, ctx.player.id, 10, 'Nollywood box office', ctx.emit); } },
  },
  {
    id: 'private_banker', name: 'The Private Banker', rarity: 'uncommon', cost: 6, noShop: true, nation: 'switzerland',
    description: 'Keeps the books tidy and the doors shut. At the end of each chapter, gain **+1** {splendor} for every 10 {influence} you hold.',
    flavor: 'The vault is neutral. The vault also does not answer questions.', tags: ['nation', 'scrip', 'economy'], icon: 'shield', art: { hue: 208, motif: 'key' },
    effects: { chronicle(ctx, c) { const n = Math.floor(ctx.state.run.influence / 10); if (n) c.addSplendor(n); } },
  },
  {
    id: 'eternal_leader', name: 'Eternal Leader', rarity: 'legendary', cost: 20, noShop: true, noSell: true, nation: 'north_korea',
    description: 'The portrait is a must. **×2** {splendor}. You cannot sell this Crew.',
    flavor: 'The frame has a frame. Both have portraits.', tags: ['nation', 'legendary', 'splendor'], icon: 'crown', art: { hue: 0, motif: 'crown' },
    effects: { chronicle(_ctx, c) { c.mulSplendor(2, 'Eternal Leader'); } },
  },
  {
    id: 'cardinal', name: 'The Cardinal', rarity: 'uncommon', cost: 6, noShop: true, nation: 'vatican',
    description: 'Keeps the faith, even when the colony is held together with tape. At the end of each chapter, gain **+2** {splendor}.',
    flavor: '“Mars was always in the plan. The paperwork was not.”', tags: ['nation', 'faith', 'splendor'], icon: 'chalice', art: { hue: 8, motif: 'chalice' },
    effects: { chronicle(_ctx, c) { c.addSplendor(2); } },
  },
];

registerCrew(NATION_CREW);
