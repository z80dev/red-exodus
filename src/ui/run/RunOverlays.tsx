// Run-phase switcher: mounts the full-screen overlay for the current RunPhase (z 60, above HUD & sheets).
import { useSim } from '../../game/store';
import { ChapterStart } from './ChapterStart';
import { Chronicle } from './Chronicle';
import { Council } from './Council';
import { CrisisReveal } from './CrisisReveal';
import { RunEnd } from './RunEnd';
import './card.css';
import './run.css';

export function RunOverlays() {
  const phase = useSim((s) => s.run.phase);
  // keyed by era/chapter so a new era or chapter always replays its entrance
  const stamp = useSim((s) => `${s.run.era}:${s.run.chapter}`);
  switch (phase) {
    case 'crisisReveal':
      return <CrisisReveal key={`crisis:${stamp}`} />;
    case 'chapterStart':
      return <ChapterStart key={`chapter:${stamp}`} />;
    case 'chronicle':
      return <Chronicle key={`chronicle:${stamp}`} />;
    case 'council':
      return <Council key={`council:${stamp}`} />;
    case 'victory':
    case 'defeat':
      return <RunEnd key={phase} />;
    default:
      return null;
  }
}
