// Research sheet: what you are researching now, the current choices, and what you already know.
import { TECHS } from '../../content';
import { useGame, useSim } from '../../game/store';
import { empireYields } from '../../sim/selectors';
import { HUMAN } from '../../sim/types';
import { audio } from '../../audio';
import { Icon } from '../icons/Icon';
import { Bar, Sheet, SheetHeader, fmt } from '../kit';
import { T, YIELD_NAMES } from '../terms';
import { turnsLabel } from './format';
import { ResearchOffer } from './ResearchPick';

export function TechSheet() {
  const data = useSim((s) => {
    const p = s.players[HUMAN];
    return { y: empireYields(s), hasOffer: p.researchOffer.length > 0, known: [...p.techs].reverse() };
  });
  const close = () => { audio.sfx('close'); useGame.getState().setPanel('none'); };
  if (!data) return null;
  const { y } = data;
  return (
    <Sheet onClose={close} className="tt">
      <div data-tutorial="tech-tree">
        <SheetHeader icon="tech" title={T.tech} subtitle={<>{fmt(y.sci)} {YIELD_NAMES.sci} per turn</>} onClose={close} />
        <section className="tt-now" aria-label="Now researching">
          {y.research ? (
            <>
              <div className="tt-now__row">
                <span className="tt-now__name">{y.research.name}</span>
                <span className="tt-now__turns num">{turnsLabel(y.research.turns)}</span>
              </div>
              <Bar value={y.research.progress} max={y.research.cost} preview={y.research.progress + y.sci} color="var(--y-sci)" height={8} />
              <span className="tt-now__meta num">{fmt(y.research.progress)} / {fmt(y.research.cost)} {YIELD_NAMES.sci}</span>
            </>
          ) : <p className="tt-now__none">Nothing yet. Pick one below.</p>}
        </section>
        {data.hasOffer && (
          <section className="tt-sec">
            <h3 className="tt-sec__title">{y.research ? 'Switch to (progress is kept)' : 'Choose research'}</h3>
            <ResearchOffer />
          </section>
        )}
        <section className="tt-sec">
          <h3 className="tt-sec__title">Done <span className="num">{data.known.length}</span></h3>
          {data.known.length ? (
            <ul className="tt-known">
              {data.known.map((id) => (
                <li key={id}><Icon name={TECHS[id]?.icon || id} size={16} /> {TECHS[id]?.name ?? id}</li>
              ))}
            </ul>
          ) : <p className="tt-empty">No research finished yet.</p>}
        </section>
      </div>
    </Sheet>
  );
}
