// Next / End Turn: cycles units & cities that need orders; turns gold when nothing is left. Shows the AI phase.
import { useState } from 'react';
import type { CSSProperties } from 'react';
import { audio } from '../../audio';
import { focusNext, requestEndTurn, useInteraction } from '../../game/interaction';
import { useGame, useSim } from '../../game/store';
import { attentionCount } from '../../sim/selectors';
import { HUMAN } from '../../sim/types';
import { Icon } from '../icons/Icon';
import { ConfirmDialog, IconButton } from '../kit';

export function EndTurnButton() {
  const ending = useInteraction((u) => u.endingTurn);
  const busy = useGame((g) => g.busy);
  const info = useSim((s) => ({
    count: attentionCount(s),
    turn: s.turn,
    phase: s.run.phase,
    rivals: s.players.filter((p) => p.id !== HUMAN && p.alive && !p.isHuman && p.ai).map((p) => p.colors.primary),
    noResearch: !s.players[HUMAN].researching,
  }));
  const [confirm, setConfirm] = useState(false);
  if (!info || info.phase !== 'playing') return null;

  if (ending) {
    return (
      <div className="et et--busy" role="status" aria-live="polite">
        <span className="et__spinner">
          {info.rivals.map((c, i) => <i key={i} style={{ '--c': c, '--i': i, '--n': info.rivals.length } as CSSProperties} />)}
        </span>
        <span className="et__label">
          <b className="display">Rivals are moving</b>
          <small>Turn {info.turn}</small>
        </span>
      </div>
    );
  }

  const next = info.count > 0;
  return (
    <div className="et-wrap" data-tutorial="end-turn">
      {next && (
        <IconButton icon="endturn" label="End turn now" size="md" className="et-skip" disabled={busy}
          onClick={() => { audio.sfx('open'); setConfirm(true); }} />
      )}
      <button type="button" className={`et ${next ? 'et--next' : 'et--end'}`} disabled={busy}
        onClick={() => {
          if (next) { audio.sfx('click'); focusNext(); }
          else void requestEndTurn();
        }}>
        <span className="et__glow" aria-hidden />
        <span className="et__icon"><Icon name={next ? 'next' : 'endturn'} size={26} /></span>
        <span className="et__label">
          <b className="display">{next ? 'Next' : 'End Turn'}</b>
          <small>{next ? `${info.count} awaiting orders` : `Turn ${info.turn}`}</small>
        </span>
        {next && <span className="et__count num">{info.count}</span>}
      </button>
      {confirm && (
        <ConfirmDialog
          title="End turn now?"
          body={info.noResearch ? 'No research is selected and some units or cities still await orders.' : `${info.count} ${info.count === 1 ? 'thing still awaits' : 'things still await'} your orders.`}
          icon="hourglass"
          confirmLabel="End Turn"
          onCancel={() => setConfirm(false)}
          onConfirm={() => { setConfirm(false); void requestEndTurn(); }}
        />
      )}
    </div>
  );
}
