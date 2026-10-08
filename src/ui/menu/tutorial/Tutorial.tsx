import { useEffect, useState } from 'react';
import { getRenderer } from '../../../game/bridge';
import { useGame } from '../../../game/store';
import { Icon } from '../../icons/Icon';
import { useProfile } from '../shared';
import { TUTORIAL_STEPS } from './steps';

interface Spotlight { x: number; y: number; width: number; height: number }
export function Tutorial() {
  const ui = useGame();
  const { profile, update } = useProfile();
  const [spotlight, setSpotlight] = useState<Spotlight | null>(null);
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [domRevision, setDomRevision] = useState(0);
  const state = ui.state;
  const completed = profile.tutorialProgress ?? [];
  const enabled = !!state && !profile.settings.tutorialDone && !state.gameOver;
  const step = enabled ? TUTORIAL_STEPS.find((candidate) => !completed.includes(candidate.id) && candidate.ready(state, ui) && !candidate.complete?.(state, ui)) : undefined;
  void domRevision;
  function acknowledge(skip = false) {
    update((p) => {
      const progress = skip ? TUTORIAL_STEPS.map((s) => s.id) : [...new Set([...(p.tutorialProgress ?? []), ...(step ? [step.id] : [])])];
      return { ...p, tutorialProgress: progress, settings: { ...p.settings, tutorialDone: skip || progress.length >= TUTORIAL_STEPS.length } };
    });
  }
  useEffect(() => {
    if (!enabled || !state) return;
    const autoCompleted = TUTORIAL_STEPS.filter((s) => !completed.includes(s.id) && s.complete?.(state, ui)).map((s) => s.id);
    if (autoCompleted.length) update((p) => { const progress = [...new Set([...(p.tutorialProgress ?? []), ...autoCompleted])]; return { ...p, tutorialProgress: progress, settings: { ...p.settings, tutorialDone: progress.length >= TUTORIAL_STEPS.length } }; });
  });
  useEffect(() => {
    if (!enabled) return;
    const observer = new MutationObserver((mutations) => { if (mutations.some((m) => m.type === 'childList' && (m.addedNodes.length || m.removedNodes.length))) setDomRevision((n) => n + 1); });
    const root = document.querySelector('#root');
    if (root) observer.observe(root, { subtree: true, childList: true });
    return () => observer.disconnect();
  }, [enabled]);
  useEffect(() => {
    if (!step || !state) return;
    function measure() {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
      const element = step?.target ? document.querySelector(`[data-tutorial="${step.target}"]`) : null;
      const rect = element?.getBoundingClientRect();
      if (rect && rect.width > 0 && rect.height > 0) { setSpotlight({ x: Math.max(8, rect.x - 6), y: Math.max(8, rect.y - 6), width: Math.min(rect.width + 12, window.innerWidth - 16), height: Math.min(rect.height + 12, window.innerHeight - 16) }); return; }
      if (step?.id === 'capital' && state) {
        const capital = Object.values(state.cities).find((c) => c.owner === 0 && c.isCapital);
        const pos = capital ? getRenderer()?.screenPos(capital.tile) : null;
        if (pos) { setSpotlight({ x: pos.x - 34, y: pos.y - 34, width: 68, height: 68 }); return; }
      }
      setSpotlight(null);
    }
    measure();
    const interval = window.setInterval(measure, 500);
    window.addEventListener('resize', measure);
    return () => { window.clearInterval(interval); window.removeEventListener('resize', measure); };
  }, [step, state]);
  // a sheet (colony, research, log …) fills the phone screen; the card would cover its buttons, so wait until it closes
  if (!step || ui.panel !== 'none') return null;
  const width = Math.min(330, viewport.width - 28);
  const height = viewport.height < 500 ? 160 : 210;
  const left = Math.max(14, Math.min(viewport.width - width - 14, spotlight ? spotlight.x + spotlight.width / 2 - width / 2 : (viewport.width - width) / 2));
  const below = spotlight && spotlight.y + spotlight.height + height + 26 < viewport.height;
  const top = spotlight ? Math.max(12, Math.min(viewport.height - height - 12, below ? spotlight.y + spotlight.height + 15 : spotlight.y - height - 15)) : viewport.height < 500 ? 90 : viewport.height - height - 110;
  return <aside className="ae-tutorial" aria-label="Guide">
    {spotlight && <svg className="ae-tutorial-spotlight" width="100%" height="100%" aria-hidden="true"><defs><mask id="ae-tutorial-cutout"><rect width="100%" height="100%" fill="white" /><rect x={spotlight.x} y={spotlight.y} width={spotlight.width} height={spotlight.height} rx="12" fill="black" /></mask></defs><rect width="100%" height="100%" fill="var(--ink-950)" opacity="0.4" mask="url(#ae-tutorial-cutout)" /><rect x={spotlight.x} y={spotlight.y} width={spotlight.width} height={spotlight.height} rx="12" fill="none" stroke="var(--gold-400)" strokeWidth="1.5" /></svg>}
    <section className="ae-coachmark" key={step.id} style={{ width, left, top }} role="status">
      {spotlight && <span className={`ae-coach-arrow ${below ? 'up' : 'down'}`} style={{ left: Math.max(20, Math.min(width - 30, spotlight.x + spotlight.width / 2 - left)) }} />}
      <span className="ae-eyebrow"><Icon name={step.icon} size={16} />Guide <span>{completed.length + 1} / {TUTORIAL_STEPS.length}</span></span><h3>{step.title}</h3><p>{step.text}</p><div><button onClick={() => acknowledge(true)}>Skip guide</button><button onClick={() => acknowledge()}>Got it <Icon name="chevronRight" size={15} /></button></div>
    </section>
  </aside>;
}
