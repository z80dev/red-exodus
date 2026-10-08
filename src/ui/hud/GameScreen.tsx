// In-game HUD root: top bar, doctrine bar, side rail, bottom dock (edicts, next/end turn, unit panel, map cards),
// sheets (city, tech, empire, journal), pause menu, floaters, toasts, run overlays and tutorial.
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { audio } from '../../audio';
import { bindInteraction, cancelMode, deselect, focusNext, requestEndTurn, useInteraction } from '../../game/interaction';
import { useGame, useSim } from '../../game/store';
import { attentionCount, empireYields } from '../../sim/selectors';
import type { Panel } from '../../game/store';
import { DoctrineBar } from '../run/DoctrineBar';
import { EdictTray } from '../run/EdictTray';
import { RunOverlays } from '../run/RunOverlays';
import { Tutorial } from '../menu/tutorial/Tutorial';
import { IconButton, hasEscapeLayer } from '../kit';
import { CitySheet } from './CitySheet';
import { EmpireSheet } from './EmpireSheet';
import { EndTurnButton } from './EndTurnButton';
import { Floaters } from './Floaters';
import { useHudEvents } from './hudEvents';
import { JournalSheet, useJournalSeen } from './JournalSheet';
import { MapCards, ModeBanner } from './MapCards';
import { PauseMenu } from './PauseMenu';
import { ResearchPick } from './ResearchPick';
import { TechSheet } from './TechSheet';
import { Toasts } from './Toasts';
import { TopBar } from './TopBar';
import { TurnBanner } from './TurnBanner';
import { UnitPanel } from './UnitPanel';
import './hud.css';
import { T } from '../terms';

export function GameScreen() {
  const panel = useGame((g) => g.panel);
  const phase = useSim((s) => s.run.phase);
  useEffect(() => bindInteraction(), []);
  useHudEvents();
  useHotkeys();
  const rootRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  // publish the top cluster's height so the rail / banners sit just below it in every layout
  useEffect(() => {
    const top = topRef.current;
    const root = rootRef.current;
    if (!top || !root) return;
    const ro = new ResizeObserver(() => root.style.setProperty('--hud-top-h', `${top.offsetHeight}px`));
    ro.observe(top);
    return () => ro.disconnect();
  }, []);
  const playing = phase === 'playing';
  // portrait phones keep the top cluster short: the Crew strip opens from the rail and floats over the map
  const [crewOpen, setCrewOpen] = useState(false);

  return (
    <div className={`hud ${playing ? '' : 'is-ceremony'}`} ref={rootRef}>
      <div className="hud__top" ref={topRef}>
        <TopBar />
        <div className={`hud__doctrines ${crewOpen ? 'is-open' : ''}`}><DoctrineBar compact /></div>
      </div>
      <SideRail crewOpen={crewOpen} onCrew={() => { audio.sfx(crewOpen ? 'close' : 'open'); setCrewOpen(!crewOpen); }} />
      <div className="hud__center"><ModeBanner /></div>
      <TurnBanner />
      <div className="hud__dock">
        <div className="hud__dock-row">
          <div className="hud__edicts"><EdictTray compact /></div>
          <EndTurnButton />
        </div>
        <div className="hud__cards">
          <MapCards />
          <UnitPanel />
        </div>
      </div>

      {(panel === 'city' || panel === 'production') && <CitySheet />}
      {panel === 'tech' && <TechSheet />}
      {panel === 'empire' && <EmpireSheet />}
      {panel === 'journal' && <JournalSheet />}
      {panel === 'pause' && <PauseMenu />}
      <ResearchPick />

      <Floaters />
      <RunOverlays />
      <Toasts />
      <Tutorial />
    </div>
  );
}

function SideRail({ crewOpen, onCrew }: { crewOpen: boolean; onCrew: () => void }) {
  const panel = useGame((g) => g.panel);
  const info = useSim((s) => {
    const r = empireYields(s)?.research;
    return { research: r ? { pct: r.cost > 0 ? Math.min(1, r.progress / r.cost) : 0, turns: r.turns } : null, logLen: s.log.length };
  });
  const seenLog = useJournalSeen();
  if (!info) return null;
  const toggle = (p: Panel) => () => {
    audio.sfx(panel === p ? 'close' : 'open');
    useGame.getState().setPanel(panel === p ? 'none' : p);
  };
  const unread = panel === 'journal' ? 0 : Math.max(0, info.logLen - seenLog);
  const r = info.research;
  return (
    <nav className="hud__rail" aria-label={T.leader}>
      <div className="rail-research" data-tutorial="research" style={{ '--ring': r?.pct ?? 0 } as CSSProperties}>
        <IconButton icon="tech" label={r ? T.tech : `${T.tech}: pick one`} onClick={toggle('tech')} active={panel === 'tech'} badge={r ? undefined : '!'} />
        {r && (
          <svg className="rail-research__ring" viewBox="0 0 36 36" aria-hidden>
            <circle cx="18" cy="18" r="16.5" className="rail-research__track" />
            <circle cx="18" cy="18" r="16.5" className="rail-research__fill" pathLength={1} />
          </svg>
        )}
        {r?.turns != null && <span className="rail-research__turns num">{r.turns}t</span>}
      </div>
      <IconButton icon="doctrine" label={T.doctrines} className="rail-crew" onClick={onCrew} active={crewOpen} />
      <IconButton icon="crown" label={T.leader} onClick={toggle('empire')} active={panel === 'empire'} />
      <IconButton icon="journal" label="Log" onClick={toggle('journal')} active={panel === 'journal'} badge={unread > 0 ? (unread > 9 ? '9+' : unread) : undefined} />
    </nav>
  );
}

/** desktop shortcuts: Enter/Space next/end turn · T tech · E empire · J journal · Esc back out */
function useHotkeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) return;
      const g = useGame.getState();
      const s = g.state;
      if (!s || s.run.phase !== 'playing') return;
      const set = (p: Panel) => { audio.sfx(g.panel === p ? 'close' : 'open'); g.setPanel(g.panel === p ? 'none' : p); };
      switch (e.key) {
        case 'Enter':
        case ' ':
          if (g.panel !== 'none') return;
          e.preventDefault();
          if (attentionCount(s) > 0) focusNext();
          else void requestEndTurn();
          return;
        case 't': case 'T': set('tech'); return;
        case 'e': case 'E': set('empire'); return;
        case 'j': case 'J': set('journal'); return;
        case 'Escape': {
          // sheets/modals/popovers own Escape while open
          if (g.panel !== 'none' || hasEscapeLayer()) return;
          const ui = useInteraction.getState();
          if (g.mode.kind !== 'normal' || ui.strikeCity != null || ui.dropTargeting) cancelMode();
          else if (g.selection || ui.preview) deselect();
          else { audio.sfx('open'); g.setPanel('pause'); }
          return;
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
