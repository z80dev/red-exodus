// Sim events → toasts & floating numbers. Mounted once by GameScreen.
import { useEffect } from 'react';
import { NATURAL_WONDERS, OMENS, TECHS, WONDERS, BUILDINGS, CRISES } from '../../content';
import { bus } from '../../game/bus';
import { useGame } from '../../game/store';
import { BARBARIAN, HUMAN } from '../../sim/types';
import type { GameState, SimEvent } from '../../sim/types';
import { fmt } from '../kit';
import { floatAt } from './Floaters';
import { playerLabel, unitName } from './format';
import { toast } from './toast';

/** delay floaters so they land with the renderer's hit / arrival animation */
const HIT_DELAY = 380;

function cityName(s: GameState, id: number): string {
  return s.cities[id]?.name ?? 'A city';
}

function handle(s: GameState, ev: SimEvent): void {
  switch (ev.type) {
    case 'combat': {
      const involvesHuman = ev.attacker.player === HUMAN || ev.defender.player === HUMAN;
      const vis = s.players[HUMAN]?.vis ?? [];
      if (!involvesHuman && vis[ev.defender.tile] !== 2) return;
      if (ev.dmgToDefender > 0) floatAt(ev.defender.tile, `−${Math.round(ev.dmgToDefender)}`, ev.defender.player === HUMAN ? 'var(--bad)' : 'var(--gold-300)', { delay: HIT_DELAY, big: ev.defenderKilled });
      if (ev.dmgToAttacker > 0) floatAt(ev.attacker.tile, `−${Math.round(ev.dmgToAttacker)}`, ev.attacker.player === HUMAN ? 'var(--bad)' : 'var(--gold-300)', { delay: HIT_DELAY + 120 });
      return;
    }
    case 'unitDied':
      if (ev.player === HUMAN) toast(`Your ${unitName(ev.unitType)} has fallen${ev.killer != null ? ` to the ${playerLabel(s, ev.killer)}` : ''}.`, 'bad', 'skull');
      else if (ev.killer === HUMAN) {
        toast(`${ev.player === BARBARIAN ? 'Barbarian' : playerLabel(s, ev.player)} ${unitName(ev.unitType)} destroyed.`, 'good', 'sword');
        floatAt(ev.tile, 'Victory', 'var(--p-conquest)', { icon: 'skull', delay: HIT_DELAY + 250 });
      }
      return;
    case 'unitLevelUp':
      if (ev.player === HUMAN) {
        const u = s.units[ev.unitId];
        toast(`${u ? unitName(u.type) : 'A unit'} can be promoted!`, 'gold', 'promote');
        if (u) floatAt(u.tile, 'Level up', 'var(--influence)', { icon: 'xp', delay: HIT_DELAY + 300 });
      }
      return;
    case 'unitCreated':
      if (ev.player === HUMAN && ev.cityId != null) {
        const u = s.units[ev.unitId];
        toast(`${cityName(s, ev.cityId)} trained a ${u ? unitName(u.type) : 'unit'}.`, 'info', u ? undefined : 'sword');
      }
      return;
    case 'cityFounded':
      if (ev.player === HUMAN) {
        toast(`${cityName(s, ev.cityId)} is founded!`, 'gold', 'city');
        floatAt(ev.tile, 'New city', 'var(--gold-300)', { icon: 'found', big: true, delay: 250 });
      }
      return;
    case 'cityCaptured':
      if (ev.to === HUMAN) { toast(`You captured ${cityName(s, ev.cityId)}!`, 'gold', 'crown'); floatAt(ev.tile, 'Captured!', 'var(--p-conquest)', { big: true, delay: HIT_DELAY }); }
      else if (ev.from === HUMAN) toast(`${cityName(s, ev.cityId)} has fallen to the ${playerLabel(s, ev.to)}!`, 'bad', 'city');
      return;
    case 'cityRazed':
      toast('A city was razed to the ground.', 'bad', 'skull');
      return;
    case 'cityGrew':
      if (ev.player === HUMAN) {
        const c = s.cities[ev.cityId];
        if (c) floatAt(c.tile, '+1 pop', 'var(--y-food)', { icon: 'food' });
        toast(`${cityName(s, ev.cityId)} grew to ${ev.pop}.`, 'good', 'food', `grow:${ev.cityId}`);
      }
      return;
    case 'cityStarved':
      if (ev.player === HUMAN) {
        const c = s.cities[ev.cityId];
        if (c) floatAt(c.tile, '−1 pop', 'var(--bad)', { icon: 'food' });
        toast(`${cityName(s, ev.cityId)} is starving!`, 'bad', 'food', `grow:${ev.cityId}`);
      }
      return;
    case 'borderGrew':
      if (ev.player === HUMAN) for (const t of ev.tiles.slice(0, 3)) floatAt(t, '+tile', 'var(--y-cul)', { icon: 'cul' });
      return;
    case 'buildingBuilt':
      if (ev.player === HUMAN) toast(`${cityName(s, ev.cityId)} completed the ${BUILDINGS[ev.building]?.name ?? ev.building}.`, 'good', BUILDINGS[ev.building]?.icon ?? ev.building);
      return;
    case 'wonderBuilt':
      if (ev.player === HUMAN) toast(`Wonder complete: ${WONDERS[ev.wonder]?.name ?? ev.wonder}!`, 'gold', WONDERS[ev.wonder]?.icon ?? 'wonder');
      else toast(`The ${playerLabel(s, ev.player)} completed ${WONDERS[ev.wonder]?.name ?? ev.wonder}.`, 'info', WONDERS[ev.wonder]?.icon ?? 'wonder');
      return;
    case 'wonderLost':
      if (s.cities[ev.cityId]?.owner === HUMAN) toast(`${WONDERS[ev.wonder]?.name ?? ev.wonder} was lost to the ${playerLabel(s, ev.by)}. Production carried over.`, 'bad', 'wonder');
      return;
    case 'improvementBuilt':
      if (ev.player === HUMAN) floatAt(ev.tile, 'Built', 'var(--gold-300)', { icon: 'improve' });
      return;
    case 'improvementPillaged':
      if (s.map.tiles[ev.tile]?.owner === HUMAN && ev.by !== HUMAN) toast(`The ${playerLabel(s, ev.by)} pillaged your lands!`, 'bad', 'pillage');
      else if (ev.by === HUMAN) floatAt(ev.tile, 'Pillaged', 'var(--y-gold)', { icon: 'pillage' });
      return;
    case 'techResearched':
      if (ev.player === HUMAN) toast(`Discovered ${TECHS[ev.tech]?.name ?? ev.tech}!`, 'gold', TECHS[ev.tech]?.icon ?? 'tech');
      return;
    case 'naturalWonderFound':
      if (ev.player === HUMAN) { toast(`Natural wonder discovered: ${NATURAL_WONDERS[ev.id]?.name ?? ev.id}!`, 'gold', 'star'); floatAt(ev.tile, 'Discovered!', 'var(--p-glory)', { icon: 'star', big: true }); }
      return;
    case 'ruinExplored':
      if (ev.player === HUMAN) { toast(`Ancient ruins: ${ev.reward}`, 'gold', 'star'); floatAt(ev.tile, ev.reward, 'var(--gold-300)', { icon: 'star', delay: 300 }); }
      return;
    case 'campCleared':
      if (ev.player === HUMAN) { toast(`Barbarian camp cleared! +${ev.gold} gold`, 'good', 'skull'); floatAt(ev.tile, `+${ev.gold}`, 'var(--y-gold)', { icon: 'gold', delay: HIT_DELAY }); }
      return;
    case 'warDeclared':
      if (ev.target === HUMAN) toast(`The ${playerLabel(s, ev.by)} have declared war on you!`, 'bad', 'war');
      else if (ev.by === HUMAN) toast(`You declared war on the ${playerLabel(s, ev.target)}.`, 'bad', 'war');
      else if (s.players[HUMAN]?.relations[ev.by] !== undefined) toast(`War: ${playerLabel(s, ev.by)} vs ${playerLabel(s, ev.target)}.`, 'info', 'war');
      return;
    case 'peaceMade':
      if (ev.a === HUMAN || ev.b === HUMAN) toast(`Peace with the ${playerLabel(s, ev.a === HUMAN ? ev.b : ev.a)}.`, 'good', 'peace');
      return;
    case 'playerEliminated':
      if (ev.player !== HUMAN && ev.player !== BARBARIAN) toast(`The ${playerLabel(s, ev.player)} have been wiped from history${ev.by === HUMAN ? ' by your hand' : ''}.`, ev.by === HUMAN ? 'gold' : 'info', 'skull');
      return;
    case 'happinessChanged':
      if (ev.player === HUMAN) happinessToast(ev.value);
      return;
    case 'goldChanged':
      return;
    case 'doctrineTriggered':
      if (ev.tile != null) floatAt(ev.tile, ev.text, 'var(--gold-300)', { icon: 'doctrine' });
      return;
    case 'renownGained':
      if (ev.tile != null) floatAt(ev.tile, `+${fmt(ev.amount)} ${ev.label}`, 'var(--renown)', { icon: 'renown' });
      return;
    case 'omenCompleted':
      toast(`Omen fulfilled: ${OMENS[ev.id]?.name ?? ev.id}!`, 'gold', 'omen');
      return;
    case 'crisisBegan':
      toast(`Crisis: ${CRISES[ev.crisis]?.name ?? ev.crisis} has begun.`, 'bad', 'crisis');
      return;
    case 'crisisEnded':
      toast(`${CRISES[ev.crisis]?.name ?? 'The crisis'} has passed.`, 'good', 'crisis');
      return;
    case 'notify':
      toast(ev.text, ev.tone ?? 'info', ev.icon);
      if (ev.tile != null && ev.tone === 'good') floatAt(ev.tile, '★', 'var(--gold-300)');
      return;
    default:
      return;
  }
}

let lastHappiness: number | null = null;
function happinessToast(value: number): void {
  const prev = lastHappiness;
  lastHappiness = value;
  if (prev == null) return;
  if (prev >= 0 && value < 0) toast('Your people are unhappy — cities stop growing.', 'bad', 'unhappy');
  else if (prev > -10 && value <= -10) toast('Unrest! Yields −20% and rebels may rise.', 'bad', 'unhappy');
  else if (prev < 0 && value >= 0) toast('Your people are content again.', 'good', 'happy');
}

export function useHudEvents(): void {
  useEffect(() => {
    lastHappiness = useGame.getState().state?.players[HUMAN]?.happiness ?? null;
    return bus.on((ev) => {
      const g = useGame.getState();
      if (g.screen !== 'game' || !g.state) return;
      handle(g.state, ev);
    });
  }, []);
}
