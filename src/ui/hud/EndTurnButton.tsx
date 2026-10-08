// One big button: "End Turn" when nothing blocks, otherwise "Choose research" / "Pick a build" (tap goes there).
// Idle units never block the turn; "Next unit" is an optional shortcut. Shows the AI phase while rivals move.
import { useState } from 'react';
import type { CSSProperties } from 'react';
import { audio } from '../../audio';
import { focusNext, focusNextUnit, requestEndTurn, useInteraction } from '../../game/interaction';
import { useGame, useSim } from '../../game/store';
import { attentionCount, nextAttention, nextIdleUnit } from '../../sim/selectors';
import { HUMAN } from '../../sim/types';
import { Icon } from '../icons/Icon';
import { ConfirmDialog, IconButton } from '../kit';

export function EndTurnButton() {
  const ending = useInteraction((u) => u.endingTurn);
  const busy = useGame((g) => g.busy);
  const info = useSim((s) => ({
    count: attentionCount(s),
    next: nextAttention(s)?.kind ?? null,
    idleUnit: nextIdleUnit(s) != null,
    turn: s.turn,
    phase: s.run.phase,
    rivals: s.players.filter((p) => p.id !== HUMAN && p.alive && !p.isHuman && p.ai).map((p) => p.colors.primary),
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

  const blocked = info.count > 0;
  const label = !blocked ? 'End Turn' : info.next === 'research' ? 'Choose research' : 'Pick a build';
  const sub = !blocked ? `Turn ${info.turn}` : info.count > 1 ? `${info.count} things to do` : 'Tap to go there';
  return (
    <div className="et-wrap" data-tutorial="end-turn">
      {info.idleUnit && (
        <IconButton icon="next" label="Next unit" size="md" className="et-unit"
          onClick={() => { if (busy) return; audio.sfx('click'); focusNextUnit(); }} />
      )}
      {blocked && (
        <IconButton icon="endturn" label="End turn now" size="md" className="et-skip"
          onClick={() => { if (busy) return; audio.sfx('open'); setConfirm(true); }} />
      )}
      <button type="button" className={`et ${blocked ? 'et--next' : 'et--end'}`}
        onClick={() => {
          // input is ignored (not visually disabled) while the renderer plays back a batch, to avoid flicker
          if (busy) return;
          if (blocked) { audio.sfx('click'); focusNext(); }
          else void requestEndTurn();
        }}>
        <span className="et__glow" aria-hidden />
        <span className="et__icon"><Icon name={!blocked ? 'endturn' : info.next === 'research' ? 'tech' : 'city'} size={26} /></span>
        <span className="et__label">
          <b className="display">{label}</b>
          <small>{sub}</small>
        </span>
        {blocked && <span className="et__count num">{info.count}</span>}
      </button>
      {confirm && (
        <ConfirmDialog
          title="End turn now?"
          body={info.next === 'research' ? 'You have not chosen research yet.' : 'A colony has nothing to build yet.'}
          icon="hourglass"
          confirmLabel="End Turn"
          onCancel={() => setConfirm(false)}
          onConfirm={() => { setConfirm(false); void requestEndTurn(); }}
        />
      )}
    </div>
  );
}
