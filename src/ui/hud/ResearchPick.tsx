// Research draft: pick one of (usually) three. The modal opens by itself when research is empty
// (interaction.ts drives `researchPick`); the cards are shared with the research sheet.
import { BUILDINGS, IMPROVEMENTS, RESOURCES, UNITS, WONDERS } from '../../content';
import { act, closeResearchPick, useInteraction } from '../../game/interaction';
import { useSim } from '../../game/store';
import { researchRerollCost } from '../../sim/mars';
import { empireYields, techTree } from '../../sim/selectors';
import type { TechNode } from '../../sim/selectors';
import { HUMAN } from '../../sim/types';
import { Icon } from '../icons/Icon';
import { RichText } from '../icons/RichText';
import { Button, Modal, fmt } from '../kit';
import { T, YIELD_NAMES } from '../terms';
import { eraName, turnsLabel } from './format';
import { toast } from './toast';

/** One plain line about what a research gives; null when it unlocks nothing nameable. */
export function unlockLine(n: TechNode): string | null {
  const u = n.unlocks;
  const names = [
    ...u.units.map((id) => UNITS[id]?.name ?? id),
    ...u.buildings.map((id) => BUILDINGS[id]?.name ?? id),
    ...u.wonders.map((id) => WONDERS[id]?.name ?? id),
    ...u.improvements.map((id) => IMPROVEMENTS[id]?.name ?? id),
  ];
  if (names.length) return `Unlocks: ${names.slice(0, 3).join(', ')}${names.length > 3 ? ` and ${names.length - 3} more` : ''}`;
  if (u.resources.length) return `Shows ${u.resources.map((id) => RESOURCES[id]?.name ?? id).join(', ')} on the map`;
  return null;
}

/** The current research offer as tappable cards, plus "New choices" when the player can pay for it. */
export function ResearchOffer() {
  const data = useSim((s) => {
    const p = s.players[HUMAN];
    const tree = techTree(s);
    return {
      cards: p.researchOffer.map((id) => tree.find((n) => n.id === id)).filter((n): n is TechNode => !!n),
      current: p.researching,
      rerollCost: researchRerollCost(s, HUMAN),
      credits: p.gold,
    };
  });
  if (!data || !data.cards.length) return null;
  const pick = (n: TechNode) => {
    if (n.id === data.current) return;
    if (act({ type: 'setResearch', tech: n.id }, 'research').ok) toast(`${T.tech}: ${n.name}`, 'info', n.icon || 'tech');
  };
  return (
    <div className="rp-offer">
      <div className="rp-offer__cards">
        {data.cards.map((n) => {
          const line = unlockLine(n);
          const active = n.id === data.current;
          return (
            <button key={n.id} type="button" className={`rp-card ${active ? 'is-active' : ''}`} onClick={() => pick(n)} aria-pressed={active}>
              <span className="rp-card__icon"><Icon name={n.icon || n.id} size={30} /></span>
              <span className="rp-card__body">
                <span className="rp-card__name">{n.name}</span>
                <span className="rp-card__era">{eraName(n.era)}</span>
                <span className="rp-card__unlock">{line ?? <RichText text={n.description} iconSize={13} />}</span>
              </span>
              <span className="rp-card__turns num">
                {active ? <><Icon name="check" size={14} /> Now</> : <><Icon name="sci" size={14} /> {turnsLabel(n.turns)}</>}
              </span>
            </button>
          );
        })}
      </div>
      {data.credits >= data.rerollCost && (
        <Button small className="rp-offer__reroll" onClick={() => {
          if (act({ type: 'rerollResearch' }, 'reroll').ok) toast('New research choices.', 'info', 'reroll');
        }}>
          <Icon name="reroll" size={16} /> New choices · {fmt(data.rerollCost)} {YIELD_NAMES.gold}
        </Button>
      )}
    </div>
  );
}

export function ResearchPick() {
  const open = useInteraction((u) => u.researchPick && !u.endingTurn);
  const info = useSim((s) => ({ playing: s.run.phase === 'playing' && !s.gameOver, sci: empireYields(s).sci }));
  if (!open || !info?.playing) return null;
  return (
    <Modal onClose={closeResearchPick} className="rp">
      <header className="rp__head">
        <span className="rp__icon"><Icon name="tech" size={26} /></span>
        <div className="rp__titles">
          <h2 className="k-title">Choose research</h2>
          <p className="rp__sub">Pick one. You make <b className="num">{fmt(info.sci)}</b> {YIELD_NAMES.sci} per turn.</p>
        </div>
      </header>
      <ResearchOffer />
      <Button className="rp__later" onClick={closeResearchPick}>Later</Button>
    </Modal>
  );
}
