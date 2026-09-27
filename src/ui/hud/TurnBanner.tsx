// Brief ceremonial banner after each end turn ("Turn 14"), grander when a new era begins.
import { useEffect } from 'react';
import { useInteraction } from '../../game/interaction';
import { useGame } from '../../game/store';
import { Ornament } from '../kit';
import { eraName } from './format';

const SHOW_MS = 1500;
const ERA_SHOW_MS = 2600;

export function TurnBanner() {
  const banner = useInteraction((u) => u.turnBanner);
  const phase = useGame((g) => g.state?.run.phase);
  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => {
      if (useInteraction.getState().turnBanner?.key === banner.key) useInteraction.setState({ turnBanner: null });
    }, banner.era != null ? ERA_SHOW_MS : SHOW_MS);
    return () => clearTimeout(t);
  }, [banner]);
  if (!banner || phase !== 'playing') return null;
  const era = banner.era;
  return (
    <div className={`tbn ${era != null ? 'tbn--era' : ''}`} key={banner.key} aria-live="polite">
      {era != null && <div className="tbn__eyebrow">A new age dawns</div>}
      <div className="tbn__title display">{era != null ? `The ${eraName(era)} Era` : `Turn ${banner.turn}`}</div>
      <Ornament className="tbn__orn" />
    </div>
  );
}
