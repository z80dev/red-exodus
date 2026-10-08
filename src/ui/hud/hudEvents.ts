// Sim events → toasts & floating numbers. Mounted once by GameScreen.
import { useEffect } from 'react';
import { NATURAL_WONDERS, PROMOTIONS, TECHS, WONDERS, BUILDINGS, CRISES } from '../../content';
import { bus } from '../../game/bus';
import { useGame } from '../../game/store';
import { HUMAN } from '../../sim/types';
import type { GameState, SimEvent } from '../../sim/types';
import { fmt } from '../kit';
import { T } from '../terms';
import { floatAt } from './Floaters';
import { playerLabel, unitName } from './format';
import { toast } from './toast';

/** delay floaters so they land with the renderer's hit / arrival animation */
const HIT_DELAY = 380;

function cityName(s: GameState, id: number): string {
  return s.cities[id]?.name ?? `A ${T.city.toLowerCase()}`;
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
      if (ev.player === HUMAN) toast(`You lost your ${unitName(ev.unitType)}.`, 'bad', 'skull');
      else if (ev.killer === HUMAN) {
        toast(`You beat a ${playerLabel(s, ev.player)} ${unitName(ev.unitType)}.`, 'good', 'sword');
        floatAt(ev.tile, 'Win', 'var(--p-conquest)', { icon: 'skull', delay: HIT_DELAY + 250 });
      }
      return;
    case 'unitPromoted': {
      const u = s.units[ev.unitId];
      // the renderer already pops a "Promoted" label over the unit; the toast names the new skill
      if (u?.owner === HUMAN) toast(`${unitName(u.type)} got ${PROMOTIONS[ev.promotion]?.name ?? 'a promotion'}.`, 'gold', PROMOTIONS[ev.promotion]?.icon ?? 'star');
      return;
    }
    case 'unitUpgraded': {
      const u = s.units[ev.unitId];
      if (u?.owner === HUMAN) toast(`Your ${unitName(ev.from)} is now a ${unitName(ev.to)}.`, 'good', 'upgrade');
      return;
    }
    case 'unitCreated':
      if (ev.player === HUMAN && ev.cityId != null) {
        const u = s.units[ev.unitId];
        toast(`${cityName(s, ev.cityId)} made a ${u ? unitName(u.type) : 'unit'}.`, 'info', u ? undefined : 'sword');
      }
      return;
    case 'cityFounded':
      if (ev.player === HUMAN) {
        toast(`New ${T.city.toLowerCase()}: ${cityName(s, ev.cityId)}!`, 'gold', 'city');
        floatAt(ev.tile, `New ${T.city.toLowerCase()}`, 'var(--gold-300)', { icon: 'found', big: true, delay: 250 });
      }
      return;
    case 'cityGrew':
      if (ev.player === HUMAN) {
        const c = s.cities[ev.cityId];
        if (c) floatAt(c.tile, '+1 colonist', 'var(--y-food)', { icon: 'food' });
        toast(`${cityName(s, ev.cityId)} grew to ${ev.pop}.`, 'good', 'food', `grow:${ev.cityId}`);
      }
      return;
    case 'cityStarved':
      if (ev.player === HUMAN) {
        const c = s.cities[ev.cityId];
        if (c) floatAt(c.tile, '−1 colonist', 'var(--bad)', { icon: 'food' });
        toast(`${cityName(s, ev.cityId)} has no food!`, 'bad', 'food', `grow:${ev.cityId}`);
      }
      return;
    case 'borderGrew':
      if (ev.player === HUMAN) for (const t of ev.tiles.slice(0, 3)) floatAt(t, '+tile', 'var(--y-cul)', { icon: 'cul' });
      return;
    case 'buildingBuilt':
      if (ev.player === HUMAN) toast(`${cityName(s, ev.cityId)} built ${BUILDINGS[ev.building]?.name ?? ev.building}.`, 'good', BUILDINGS[ev.building]?.icon ?? ev.building);
      return;
    case 'wonderBuilt':
      if (ev.player === HUMAN) toast(`${T.wonder} done: ${WONDERS[ev.wonder]?.name ?? ev.wonder}!`, 'gold', WONDERS[ev.wonder]?.icon ?? 'wonder');
      else toast(`${playerLabel(s, ev.player)} built ${WONDERS[ev.wonder]?.name ?? ev.wonder}.`, 'info', WONDERS[ev.wonder]?.icon ?? 'wonder');
      return;
    case 'wonderLost':
      if (s.cities[ev.cityId]?.owner === HUMAN) toast(`${playerLabel(s, ev.by)} built ${WONDERS[ev.wonder]?.name ?? ev.wonder} first. You keep your Production.`, 'bad', 'wonder');
      return;
    case 'improvementBuilt':
      if (ev.player === HUMAN) floatAt(ev.tile, 'Built', 'var(--gold-300)', { icon: 'improve' });
      return;
    case 'techResearched':
      if (ev.player === HUMAN) toast(`${T.tech} done: ${TECHS[ev.tech]?.name ?? ev.tech}!`, 'gold', TECHS[ev.tech]?.icon ?? 'tech');
      return;
    case 'naturalWonderFound':
      if (ev.player === HUMAN) { toast(`You found a ${T.naturalWonder}: ${NATURAL_WONDERS[ev.id]?.name ?? ev.id}!`, 'gold', 'star'); floatAt(ev.tile, 'Found!', 'var(--p-glory)', { icon: 'star', big: true }); }
      return;
    case 'ruinExplored':
      if (ev.player === HUMAN) { toast(`${T.ruin}: ${ev.reward}`, 'gold', 'star'); floatAt(ev.tile, ev.reward, 'var(--gold-300)', { icon: 'star', delay: 300 }); }
      return;
    case 'campCleared':
      if (ev.player === HUMAN) { toast(`${T.camp} cleared! +${ev.gold} Credits`, 'good', 'skull'); floatAt(ev.tile, `+${ev.gold}`, 'var(--y-gold)', { icon: 'gold', delay: HIT_DELAY }); }
      return;
    case 'happinessChanged':
      if (ev.player === HUMAN) happinessToast(ev.value);
      return;
    case 'doctrineTriggered':
      if (ev.tile != null) floatAt(ev.tile, ev.text, 'var(--gold-300)', { icon: 'doctrine' });
      return;
    case 'renownGained':
      if (ev.tile != null) floatAt(ev.tile, `+${fmt(ev.amount)} ${ev.label}`, 'var(--renown)', { icon: 'renown' });
      return;
    case 'crisisBegan':
      toast(`${T.crisis}: ${CRISES[ev.crisis]?.name ?? ev.crisis} has started.`, 'bad', 'crisis');
      return;
    case 'crisisEnded':
      toast(`${CRISES[ev.crisis]?.name ?? `The ${T.crisis.toLowerCase()}`} is over.`, 'good', 'crisis');
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
  if (prev >= 0 && value < 0) toast(`Your people are unhappy. ${T.cities} stop growing.`, 'bad', 'unhappy');
  else if (prev > -10 && value <= -10) toast('Your people are very unhappy. Rebels may appear.', 'bad', 'unhappy');
  else if (prev < 0 && value >= 0) toast('Your people are happy again.', 'good', 'happy');
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
