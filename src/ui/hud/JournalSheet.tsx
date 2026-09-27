// Journal: the empire's chronicle of notable events (state.log), newest first, grouped by turn.
import { audio } from '../../audio';
import { getRenderer } from '../../game/bridge';
import { useGame, useSim } from '../../game/store';
import type { LogEntry } from '../../sim/types';
import { Icon } from '../icons/Icon';
import { RichText } from '../icons/RichText';
import { Sheet, SheetHeader } from '../kit';
import { playerColor } from './format';

export function JournalSheet() {
  const log = useSim((s) => s.log);
  const turn = useSim((s) => s.turn) ?? 0;
  const state = useGame((g) => g.state);
  const close = () => { audio.sfx('close'); useGame.getState().setPanel('none'); };
  if (!log || !state) return null;

  const groups: { turn: number; items: LogEntry[] }[] = [];
  for (let i = log.length - 1; i >= 0; i--) {
    const e = log[i];
    const g = groups[groups.length - 1];
    if (g && g.turn === e.turn) g.items.push(e);
    else groups.push({ turn: e.turn, items: [e] });
  }

  return (
    <Sheet onClose={close} className="jr">
      <SheetHeader icon="journal" title="Journal" subtitle={`${log.length} entries · Turn ${turn}`} onClose={close} />
      {!groups.length && <p className="es-empty">Your story has yet to be written.</p>}
      {groups.map((g) => (
        <section key={g.turn} className="jr-turn">
          <h3 className="jr-turn__title display"><span>Turn {g.turn}</span>{g.turn === turn && <em>now</em>}</h3>
          {g.items.map((e, i) => {
            const tile = e.tile;
            const content = (
              <>
                <span className="jr-entry__icon" style={e.player != null ? { color: playerColor(state, e.player) } : undefined}>
                  <Icon name={e.icon ?? 'scroll'} size={20} />
                </span>
                <span className="jr-entry__text"><RichText text={e.text} iconSize={14} /></span>
                {tile != null && <Icon name="map" size={16} className="jr-entry__go" />}
              </>
            );
            return tile != null ? (
              <button key={i} type="button" className="jr-entry is-link" onClick={() => {
                audio.sfx('tap');
                useGame.getState().setPanel('none');
                getRenderer()?.focusTile(tile, { animate: true, zoom: 'near' });
              }}>{content}</button>
            ) : <div key={i} className="jr-entry">{content}</div>;
          })}
        </section>
      ))}
    </Sheet>
  );
}
