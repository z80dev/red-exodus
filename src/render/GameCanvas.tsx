// OWNER: Renderer. The one full-screen map canvas (behind every screen). Creates the renderer, wires it to
// the store (sync on version change), the bus (animated event batches), interaction (tap / long-press /
// hover) and runs the attract-mode demo map whenever the player is not in a game.
import { useEffect, useRef, useState } from 'react';
import { setRenderer } from '../game/bridge';
import { bus } from '../game/bus';
import { onTileHover, onTileLongPress, onTileTap } from '../game/interaction';
import { useGame } from '../game/store';
import { LEADERS } from '../content';
import { loadProfile } from '../meta/profile';
import { createGame } from '../sim/engine';
import type { GameState } from '../sim/types';
import { AeonsRenderer } from './AeonsRenderer';
import { Overlay } from './OverlayLayer';
import './overlay.css';

let demo: GameState | null = null;
/** the menu backdrop world (never saved) */
function attractState(): GameState | null {
  if (demo) return demo;
  try {
    const leaderId = Object.keys(LEADERS)[0] ?? 'default';
    demo = createGame({ seed: 'AEONS-MENU', leaderId, ascension: 0, mapSize: 'small', rivals: 3, tutorial: false, daily: false }).state;
  } catch (err) {
    console.error('[render] attract map failed', err);
    demo = null;
  }
  return demo;
}

function settings(): { quality: 'low' | 'high'; fast: boolean } {
  try {
    const s = loadProfile().settings;
    return { quality: s.quality === 'low' ? 'low' : 'high', fast: !!s.fastAnimations };
  } catch {
    return { quality: 'high', fast: false };
  }
}

export function GameCanvas() {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [renderer, setR] = useState<AeonsRenderer | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    const prefs = settings();
    const r = new AeonsRenderer(canvas, { onTileTap, onTileLongPress, onTileHover }, prefs.quality);
    r.setFastAnimations(prefs.fast);
    setRenderer(r);
    setR(r);
    const ro = new ResizeObserver(() => r.resize());
    ro.observe(host);

    let mode: 'game' | 'attract' | null = null;
    let syncQueued = false;
    const apply = () => {
      const g = useGame.getState();
      if (g.screen === 'game' && g.state) {
        if (mode !== 'game') {
          mode = 'game';
          r.setAttractMode(false);
        }
        // deferred: the dispatch publishes its event batch right after bumping the version, so the batch is
        // queued for animation before this sync lands (units must not teleport ahead of their animation)
        if (!syncQueued) {
          syncQueued = true;
          queueMicrotask(() => {
            syncQueued = false;
            const s = useGame.getState().state;
            if (s && useGame.getState().screen === 'game') r.sync(s);
          });
        }
      } else if (mode !== 'attract') {
        const s = attractState();
        if (!s) return;
        mode = 'attract';
        r.sync(s);
        r.setAttractMode(true);
      }
    };
    apply();
    const unsubStore = useGame.subscribe((g, prev) => {
      if (g.version !== prev.version || g.state !== prev.state || g.screen !== prev.screen) apply();
    });
    let playing = 0;
    const unsubBus = bus.onBatch((events) => {
      const g = useGame.getState();
      if (g.screen !== 'game' || !g.state) return;
      playing++;
      if (!g.busy) g.setBusy(true);
      r.setFastAnimations(settings().fast);
      void r.play(events, g.state).finally(() => {
        playing--;
        if (playing === 0) useGame.getState().setBusy(false);
      });
    });
    return () => {
      unsubStore();
      unsubBus();
      ro.disconnect();
      setRenderer(null);
      r.dispose();
      setR(null);
      if (playing > 0) useGame.getState().setBusy(false);
    };
  }, []);

  return (
    <div className="ae-stage" ref={hostRef}>
      <canvas ref={canvasRef} />
      <div className="ae-vignette" />
      {renderer && <Overlay store={renderer.overlay} />}
    </div>
  );
}
