// SOL REPORT — Output × Hope resolves into Viability through a sound-synced scoring ceremony.
// Crew fire left-to-right; number bursts, Hope multipliers, and the final target slam keep the loop tactile.
// Tap the stage to speed up (1× → 2× → instant). Profile `fastAnimations` starts at 2×.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useGame, useSim } from '../../game/store';
import type { ChronicleResult, ChronicleStep, DoctrineInstance, PillarId, RunState } from '../../sim/types';
import { Button } from '../kit';
import { Icon } from '../icons/Icon';
import { Card } from './Card';
import { doctrineCard } from './cards';
import { bump, centerOf, floatAt, floatText, shake, streak, useParticles, useTweened } from './fx';
import { Hearts, Ornament } from './parts';
import { act, chapterTitle, eraName, fmt, fmtMul, fmtSplendor, haptic, pillarInfo, sfx, uiSettings } from './runUtil';
import './chronicle.css';
import { T } from '../terms';

type Tone = 'renown' | 'splendor' | 'mul' | 'bad' | 'neutral' | 'gold';
interface Row {
  key: string;
  source: string;
  label: string;
  icon: string;
  color?: string;
  renown: number;
  splendorAdd: number;
  splendorMul: number | null;
  focus: boolean;
  tone: Tone;
  chips?: { key: string; name: string; text: string }[];
}
type Stage = 'intro' | 'steps' | 'slam' | 'fill' | 'stamp' | 'tally' | 'done';

const SOURCE_ICON: Record<string, string> = {
  doctrine: 'doctrine', edition: 'star', crisis: 'crisis', darkAge: 'skull', omen: 'omen', reform: 'reform',
  leader: 'crown', bonus: 'renown', ascension: 'trophy', city: 'city',
};

export function Chronicle() {
  const result = useSim((s) => s.run.lastChronicle);
  // freeze the run snapshot we animate (the store keeps mutating once we ack)
  const [frozen] = useState(() => {
    const s = useGame.getState().state;
    return s ? { run: s.run, doctrines: s.run.doctrines.slice() } : null;
  });
  if (!result || !frozen) return null;
  return <Ceremony result={result} run={frozen.run} doctrines={frozen.doctrines} />;
}

function Ceremony({ result, run, doctrines }: { result: ChronicleResult; run: RunState; doctrines: DoctrineInstance[] }) {
  const settings = uiSettings();
  const [speed, setSpeed] = useState<1 | 2 | 3>(settings.fastAnimations ? 2 : 1); // 3 = instant
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const pending = useRef(new Set<() => void>());

  const [stage, setStage] = useState<Stage>('intro');
  const [rows, setRows] = useState<Row[]>([]);
  const [renown, setRenown] = useState(0);
  const [splendor, setSplendor] = useState(0);
  const [legacy, setLegacy] = useState(0);
  const [fill, setFill] = useState(0);
  const [active, setActive] = useState<string | null>(null);
  const [shatter, setShatter] = useState(0);
  const [tallyShown, setTallyShown] = useState(0);
  const [influenceShown, setInfluenceShown] = useState(0);
  const [triumphIn, setTriumphIn] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const ledgerRef = useRef<HTMLDivElement>(null);
  const renownRef = useRef<HTMLDivElement>(null);
  const splendorRef = useRef<HTMLDivElement>(null);
  const legacyRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const heartsRef = useRef<HTMLDivElement>(null);
  const tallyTotalRef = useRef<HTMLDivElement>(null);
  const [setHost, particles] = useParticles();

  const earned = result.influenceEarned.reduce((a, l) => a + l.amount, 0);
  const influenceBefore = run.influence - earned;
  const mandateBefore = run.mandate + result.mandateLost;
  const instant = () => speedRef.current === 3;
  const dur = (ms: number) => (speed === 3 ? 0 : ms / speed);

  // ───── sequencing ─────
  useEffect(() => {
    let cancelled = false;
    const wait = (ms: number) => {
      if (cancelled) return Promise.reject(new Error('cancelled'));
      if (instant()) return Promise.resolve();
      return new Promise<void>((resolve, reject) => {
        const done = () => {
          pending.current.delete(done);
          clearTimeout(t);
          if (cancelled) reject(new Error('cancelled'));
          else resolve();
        };
        const t = window.setTimeout(done, ms / speedRef.current);
        pending.current.add(done);
      });
    };
    const juice = () => !instant();
    const rowEl = (key: string) => ledgerRef.current?.querySelector<HTMLElement>(`[data-row="${key}"]`) ?? null;
    const cardEl = (uid: string) => stageRef.current?.querySelector<HTMLElement>(`[data-chron-uid="${uid}"]`) ?? null;
    const floaterFor = (s: ChronicleStep) => {
      const parts: { html: string; tone: string }[] = [];
      if (s.renownAdd) parts.push({ html: `${s.renownAdd > 0 ? '+' : '−'}${fmt(Math.abs(s.renownAdd))} Output`, tone: 'renown' });
      if (s.splendorAdd) parts.push({ html: `${s.splendorAdd > 0 ? '+' : '−'}${fmtSplendor(Math.abs(s.splendorAdd))} Hope`, tone: 'splendor' });
      if (s.splendorMul != null && s.splendorMul !== 1) parts.push({ html: `${fmtMul(s.splendorMul)} Hope`, tone: s.splendorMul >= 1 ? 'mul' : 'bad' });
      return parts;
    };

    const applyTotals = (s: ChronicleStep, pitch: number) => {
      setRenown(s.renown);
      setSplendor(s.splendor);
      if (!juice()) return;
      if (s.renownAdd) {
        bump(renownRef.current, 1.12);
        sfx('renownAdd', { pitch });
      }
      if (s.splendorAdd) {
        bump(splendorRef.current, 1.14);
        sfx('splendorAdd', { pitch });
      }
      if (s.splendorMul != null && s.splendorMul !== 1) {
        const up = s.splendorMul > 1;
        bump(splendorRef.current, up ? 1.3 : 0.86, 460);
        sfx('splendorMul', { pitch: up ? pitch : 0.7 });
        shake(stageRef.current, up ? Math.min(16, 5 + (s.splendorMul - 1) * 10) : 5, up ? 460 : 320);
        haptic(up ? [15, 30, 25] : 30);
        const c = centerOf(splendorRef.current);
        if (up) {
          particles.current?.burst(c.x, c.y, { colors: ['#5fd4e8', '#f28c28', '#fff0c0', '#d9a066'], count: 46, speed: 9, kind: 'spark', life: 900 });
          floatText(c.x, c.y - 10, fmtMul(s.splendorMul), { tone: 'mul', size: 44, rise: -70, duration: 1200 });
        }
        splendorRef.current?.classList.remove('is-flash');
        void splendorRef.current?.offsetWidth;
        splendorRef.current?.classList.add('is-flash');
      }
    };

    const addRow = (r: Row) => setRows((rs) => [...rs, { ...r, label: reportLabel(r.label) }]);
    const patchRow = (key: string, fn: (r: Row) => Row) => setRows((rs) => rs.map((r) => (r.key === key ? fn(r) : r)));

    const playStep = async (s: ChronicleStep, i: number) => {
      const pitch = 1 + Math.min(i, 26) * 0.045;
      const src = s.source as string;
      const mul = s.splendorMul != null && s.splendorMul !== 1 ? s.splendorMul : null;
      if (juice()) sfx('chronicleTick', { pitch });

      if (src === 'pillar') {
        // the sim may emit several lines per pillar ("Discovery · science", "Discovery · techs"): one row, detail chips
        const p = pillarInfo((s.ref ?? 'arts') as PillarId);
        const key = `pillar:${s.ref ?? i}`;
        const cut = s.label.indexOf(' · ');
        const detail = cut >= 0 ? s.label.slice(cut + 3) : '';
        const chip = detail ? [{ key: `p${i}`, name: detail, text: '' }] : [];
        setRows((rs) => {
          if (!rs.some((r) => r.key === key)) {
            return [...rs, {
              key, source: src, label: p.name, icon: p.icon, color: p.color, renown: 0,
              splendorAdd: s.splendorAdd ?? 0, splendorMul: mul, focus: false, tone: 'renown', chips: chip,
            }];
          }
          return rs.map((r) => (r.key === key ? { ...r, chips: [...(r.chips ?? []), ...chip] } : r));
        });
        await wait(110);
        patchRow(key, (r) => ({ ...r, renown: r.renown + (s.renownAdd ?? 0) }));
        if (juice()) streak(rowEl(key), renownRef.current, '#f28c28', 7);
        await wait(210);
        applyTotals(s, pitch);
        await wait(280);
        return;
      }
      if (src === 'focus') {
        const key = `pillar:${s.ref}`;
        const exists = ledgerRef.current?.querySelector(`[data-row="${key}"]`);
        const doubling = (s.renownAdd ?? 0) !== 0;
        if (exists) {
          patchRow(key, (r) => ({ ...r, focus: r.focus || doubling, renown: r.renown + (s.renownAdd ?? 0), splendorAdd: r.splendorAdd + (s.splendorAdd ?? 0) }));
        } else {
          const p = pillarInfo((s.ref ?? 'arts') as PillarId);
          addRow({ key, source: src, label: s.label, icon: p.icon, color: p.color, renown: s.renownAdd ?? 0, splendorAdd: s.splendorAdd ?? 0, splendorMul: mul, focus: doubling, tone: 'gold' });
        }
        await wait(80);
        if (juice()) {
          const el = rowEl(key);
          if (doubling) {
            el?.classList.remove('is-focus-flash');
            void el?.offsetWidth;
            el?.classList.add('is-focus-flash');
            floatAt(el, 'PRIORITY ×2', { tone: 'gold', size: 26, rise: -30, duration: 1000 });
            sfx('levelUp', { pitch: 1.1 });
            haptic(18);
            streak(el, renownRef.current, '#f28c28', 10);
          } else if (s.splendorAdd) {
            floatAt(el, `+${fmtSplendor(s.splendorAdd)} Hope`, { tone: 'splendor', size: 20 });
          }
        }
        await wait(doubling ? 260 : 180);
        applyTotals(s, pitch);
        if (s.splendorAdd && juice()) streak(rowEl(key), splendorRef.current, '#5fd4e8', 6);
        await wait(doubling ? 440 : 360);
        return;
      }
      if (src === 'city') {
        const key = 'cities';
        const chip = { key: `c${i}`, name: s.label, text: floaterFor(s).map((f) => f.html.replace(' Hope', '').replace(' Output', '')).join(' ') };
        setRows((rs) => {
          const has = rs.some((r) => r.key === key);
          if (!has) return [...rs, { key, source: src, label: 'Colonies', icon: 'city', renown: 0, splendorAdd: 0, splendorMul: null, focus: false, tone: 'splendor', chips: [chip] }];
          return rs.map((r) => (r.key === key ? { ...r, chips: [...(r.chips ?? []), chip] } : r));
        });
        await wait(90);
        if (juice()) {
          const el = ledgerRef.current?.querySelector(`[data-chip="${chip.key}"]`) ?? null;
          streak(el, s.renownAdd ? renownRef.current : splendorRef.current, s.renownAdd ? '#f28c28' : '#5fd4e8', 4);
        }
        patchRow(key, (r) => ({ ...r, renown: r.renown + (s.renownAdd ?? 0), splendorAdd: r.splendorAdd + (s.splendorAdd ?? 0) }));
        await wait(150);
        applyTotals(s, pitch);
        await wait(mul ? 520 : 200);
        return;
      }
      if (src === 'doctrine' || src === 'edition') {
        const uid = s.ref ?? '';
        setActive(uid);
        const card = cardEl(uid);
        const key = `${src}:${uid}:${i}`;
        addRow({
          key, source: src, label: s.label, icon: SOURCE_ICON[src], renown: s.renownAdd ?? 0, splendorAdd: s.splendorAdd ?? 0,
          splendorMul: mul, focus: false, tone: mul ? 'mul' : s.splendorAdd ? 'splendor' : 'renown',
        });
        await wait(140);
        if (juice()) {
          floaterFor(s).forEach((f, k) => floatAt(card ?? rowEl(key), f.html, { tone: f.tone, size: f.tone === 'mul' ? 30 : 20, delay: k * 120, rise: -60, dy: -8 }));
          if (card) {
            bump(card, mul ? 1.22 : 1.14, mul ? 480 : 360);
            streak(card, mul || s.splendorAdd ? splendorRef.current : renownRef.current, mul || s.splendorAdd ? '#5fd4e8' : '#f28c28', mul ? 12 : 7);
          }
        }
        await wait(mul ? 260 : 200);
        applyTotals(s, pitch);
        await wait(mul ? 560 : 340);
        setActive(null);
        return;
      }
      // crisis / darkAge / omen / reform / leader / bonus / ascension / anything new
      const bad = src === 'crisis' || src === 'darkAge' || (mul != null && mul < 1) || (s.renownAdd ?? 0) < 0 || (s.splendorAdd ?? 0) < 0;
      const key = `${src}:${i}`;
      addRow({
        key, source: src, label: s.label, icon: SOURCE_ICON[src] ?? 'star', renown: s.renownAdd ?? 0, splendorAdd: s.splendorAdd ?? 0,
        splendorMul: mul, focus: false, tone: bad ? 'bad' : mul ? 'mul' : s.splendorAdd ? 'splendor' : s.renownAdd ? 'renown' : 'neutral',
      });
      await wait(140);
      if (juice()) {
        const el = rowEl(key);
        if (bad) sfx('targetFail', { volume: 0.4, pitch: 1.3 });
        floaterFor(s).forEach((f, k) => floatAt(el, f.html, { tone: bad ? 'bad' : f.tone, size: 20, delay: k * 120 }));
        if (s.renownAdd) streak(el, renownRef.current, bad ? '#ff6060' : '#f28c28', 5);
        if (s.splendorAdd || mul) streak(el, splendorRef.current, bad ? '#ff6060' : '#5fd4e8', 5);
      }
      await wait(200);
      applyTotals(s, pitch);
      await wait(mul ? 520 : 320);
    };

    const countMs = instant() ? 0 : 1300 / speedRef.current;
    const finale = async () => {
      const finalStep = result.steps[result.steps.length - 1];
      setRenown(finalStep?.source === 'final' ? finalStep.renown : result.renown);
      setSplendor(finalStep?.source === 'final' ? finalStep.splendor : result.splendor);
      setActive(null);
      await wait(380);
      // slam
      setStage('slam');
      await wait(420);
      if (juice()) {
        sfx('scoreSlam');
        haptic([20, 40, 30]);
        shake(stageRef.current, 14, 520);
        const c = centerOf(legacyRef.current);
        particles.current?.burst(c.x, c.y, { colors: ['#fff0c0', '#f6dd8f', '#5fd4e8', '#f28c28'], count: 70, speed: 11, kind: 'spark', life: 1100 });
      }
      // Count Viability up with rising ticks
      if (countMs > 0) {
        const t0 = performance.now();
        let lastTick = 0;
        await new Promise<void>((resolve) => {
          const frame = (now: number) => {
            if (cancelled) return resolve();
            const t = Math.max(0, Math.min(1, (now - t0) / countMs));
            const e = 1 - (1 - t) ** 3;
            setLegacy(result.score * e);
            if (now - lastTick > 75 && t < 1) {
              lastTick = now;
              sfx('chronicleTick', { pitch: 1 + e * 1.1, volume: 0.6 });
            }
            if (t < 1 && !instant()) requestAnimationFrame(frame);
            else resolve();
          };
          requestAnimationFrame(frame);
        });
      }
      setLegacy(result.score);
      await wait(300);
      // fill the target bar
      setStage('fill');
      const ratio = result.target > 0 ? Math.min(1, result.score / (result.target * 2)) : 1;
      setFill(ratio);
      if (juice()) sfx('chronicleTick', { pitch: 2.2 });
      await wait(1150);
      // stamp
      setStage('stamp');
      if (juice()) {
        sfx(result.passed ? 'targetPass' : 'targetFail');
        haptic(result.passed ? [20, 30, 40] : [60, 40, 60]);
        shake(stageRef.current, result.passed ? 8 : 12, 420);
        if (result.passed) {
          const c = centerOf(barRef.current);
          particles.current?.burst(c.x, c.y, { colors: ['#7fd67a', '#f6dd8f', '#ffffff'], count: 40, speed: 8, kind: 'spark' });
        }
      }
      await wait(650);
      if (result.mandateLost > 0) {
        setShatter(result.mandateLost);
        if (juice()) {
          sfx('mandateLoss');
          haptic([80, 50, 80]);
          shake(stageRef.current, 10, 500);
          const c = centerOf(heartsRef.current);
          particles.current?.burst(c.x, c.y, { colors: ['#ff6b8a', '#c9304f', '#ffd0da'], count: 34, speed: 7, kind: 'shard', life: 1100 });
        }
        await wait(1100);
      }
      if (result.triumph) {
        setTriumphIn(true);
        if (juice()) {
          sfx('triumph');
          haptic([20, 20, 20, 20, 60]);
          const w = window.innerWidth;
          particles.current?.burst(w * 0.2, window.innerHeight * 0.35, { kind: 'confetti', count: 70, speed: 12, angle: -Math.PI / 3, spread: 1.2, colors: ['#f6dd8f', '#f28c28', '#5fd4e8', '#8a9a3b', '#d9a066'], life: 2200 });
          particles.current?.burst(w * 0.8, window.innerHeight * 0.35, { kind: 'confetti', count: 70, speed: 12, angle: (-2 * Math.PI) / 3, spread: 1.2, colors: ['#f6dd8f', '#f28c28', '#5fd4e8', '#8a9a3b', '#d9a066'], life: 2200 });
        }
        await wait(1000);
      }
      // influence tally
      setStage('tally');
      let running = influenceBefore;
      setInfluenceShown(running);
      await wait(260);
      for (let k = 0; k < result.influenceEarned.length; k++) {
        const line = result.influenceEarned[k];
        setTallyShown(k + 1);
        await wait(120);
        running += line.amount;
        setInfluenceShown(running);
        if (juice()) {
          sfx('buy', { pitch: 1 + k * 0.08, volume: 0.8 });
          const el = stageRef.current?.querySelector(`[data-tally="${k}"]`) ?? null;
          const c = centerOf(el);
          particles.current?.burst(c.x + 60, c.y, { kind: 'coin', count: Math.min(12, 3 + line.amount), speed: 4, colors: ['#eac766', '#f6dd8f'], life: 700, gravity: 0.35 });
          streak(el, tallyTotalRef.current, '#b28dff', Math.min(8, 2 + line.amount));
          bump(tallyTotalRef.current, 1.15);
        }
        await wait(300);
      }
      setTallyShown(result.influenceEarned.length);
      setInfluenceShown(influenceBefore + earned);
      setStage('done');
    };

    (async () => {
      setRows([]);
      setRenown(0);
      setSplendor(0);
      setStage('intro');
      try {
        if (!instant()) sfx('open');
        await wait(650);
        setStage('steps');
        await wait(200);
        let i = 0;
        for (const s of result.steps) {
          if (s.source === 'final') break;
          await playStep(s, i++);
        }
        await finale();
      } catch {
        /* cancelled (unmount / StrictMode re-run) */
      }
    })();
    const flush = pending.current;
    return () => {
      cancelled = true;
      for (const f of [...flush]) f();
    };
    // the ceremony runs exactly once per result
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  // keep the newest ledger line in view
  useLayoutEffect(() => {
    const el = ledgerRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: speed === 3 ? 'auto' : 'smooth' });
  }, [rows.length, speed]);

  const speedUp = () => {
    if (stage === 'done') return;
    const next = (speed === 1 ? 2 : 3) as 2 | 3;
    setSpeed(next);
    speedRef.current = next;
    sfx('tap', { pitch: next === 3 ? 1.4 : 1.2 });
    if (next === 3) for (const f of [...pending.current]) f();
  };

  const renownShown = useTweened(renown, dur(420));
  const splendorShown = useTweened(splendor, dur(420));
  const legacyShown = legacy;
  const merged = stage === 'slam' || stage === 'fill' || stage === 'stamp' || stage === 'tally' || stage === 'done';
  const stamped = stage === 'stamp' || stage === 'tally' || stage === 'done';
  const finaleUi = stage === 'tally' || stage === 'done';
  const doomed = run.mandate <= 0;
  const lastEra = result.era === 5 && result.chapter === 2;
  const cta = doomed ? 'Face the Reckoning' : result.passed && lastEra ? 'Secure New Earth' : `To ${T.council}`;

  return (
    <div data-tutorial="chronicle" className={`ro-overlay rch rch--${stage} ${result.passed ? 'is-pass' : 'is-fail'}`} onPointerDown={speedUp}>
      <div className="rch-backdrop" />
      <div className="ro-particles" ref={setHost} />
      <div className="rch-stage" ref={stageRef}>
        <header className="rch-head">
          <div className="rch-title display">{T.report}</div>
          <div className="rch-sub">{eraName(result.era)} · {chapterTitle(result.chapter)}</div>
          <div className="rch-hearts" ref={heartsRef}>
            <Hearts total={run.maxMandate} filled={mandateBefore} shatter={shatter} size={18} />
          </div>
        </header>

        <section className="rch-score">
          <div className="rch-bar" ref={barRef} style={{ '--fill': fill, '--fill-dur': `${dur(1100)}ms` } as CSSProperties}>
            <div className="rch-bar-track">
              <div className="rch-bar-fill" />
              <div className="rch-bar-notch" />
            </div>
            <div className="rch-bar-labels num">
              <span>0</span>
              <span className="rch-bar-target"><Icon name="trophy" size={12} /> Target {fmt(result.target)}</span>
              <span className="rch-bar-triumph">Triumph {fmt(result.target * 2)}</span>
            </div>
          </div>

          <div className={`rch-plates ${merged ? 'is-merged' : ''}`}>
            <div className="rch-plate rch-plate--renown" ref={renownRef}>
              <div className="rch-plate-label"><Icon name="renown" size={14} /> {T.renown}</div>
              <div className="rch-plate-num num">{fmt(renownShown)}</div>
            </div>
            <div className="rch-times display">×</div>
            <div className="rch-plate rch-plate--splendor" ref={splendorRef}>
              <div className="rch-plate-label"><Icon name="splendor" size={14} /> {T.splendor}</div>
              <div className="rch-plate-num num">{fmtSplendor(splendorShown)}</div>
            </div>
          </div>

          <div className={`rch-legacy ${merged ? 'is-in' : ''}`} ref={legacyRef}>
            <div className="rch-legacy-label display">= {T.score}</div>
            <div className="rch-legacy-num num display">{fmt(legacyShown)}</div>
          </div>
        </section>

        <section className="rch-scroll">
          <div className="rch-scroll-rod rch-scroll-rod--top" />
          <div className="rch-ledger" ref={ledgerRef}>
            {rows.map((r) => (
              <LedgerRow key={r.key} row={r} tweenMs={dur(420)} />
            ))}
            {rows.length === 0 && <div className="rch-ledger-empty display">Let the scribes record your deeds…</div>}
          </div>
          <div className="rch-scroll-rod rch-scroll-rod--bottom" />
          {stamped && (
            <div className={`rch-stamp display ${result.passed ? 'is-pass' : 'is-fail'}`}>
              <span>{result.passed ? 'Passed' : 'Failed'}</span>
              <small>{result.passed ? `${(result.score / Math.max(1, result.target)).toFixed(1)}× target` : result.mandateLost ? `−${result.mandateLost} Charter` : 'Short of target'}</small>
            </div>
          )}
          {triumphIn && (
            <div className="rch-triumph display">
              <svg viewBox="0 0 300 60" preserveAspectRatio="none" aria-hidden>
                <path d="M0 14 L22 30 L0 46 L40 46 L40 14 Z M300 14 L278 30 L300 46 L260 46 L260 14 Z" fill="#7d5c1b" />
                <path d="M30 6 H270 V54 H30 Z" fill="url(#rchTri)" stroke="#fff0b8" strokeWidth="1.5" />
                <defs>
                  <linearGradient id="rchTri" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#f6dd8f" />
                    <stop offset="1" stopColor="#b3862a" />
                  </linearGradient>
                </defs>
              </svg>
              <span>Triumph!</span>
            </div>
          )}
        </section>

        <section className={`rch-bottom ${finaleUi ? 'is-tally' : ''}`}>
          {!finaleUi ? (
            <div className="rch-doctrines">
              {doctrines.length === 0 && <div className="rch-nodoc">No Crew yet — The Uplink awaits.</div>}
              {doctrines.map((d) => (
                <div key={d.uid} className={`rch-doc ${active === String(d.uid) ? 'is-active' : ''} ${d.disabled ? 'is-off' : ''}`} data-chron-uid={d.uid}>
                  <Card card={doctrineCard(d.id, d.edition)} width="var(--rch-doc-w)" tilt={false} zoomable={false} disabled={d.disabled} />
                </div>
              ))}
            </div>
          ) : (
            <div className="rch-tally" onPointerDown={(e) => e.stopPropagation()}>
              <div className="rch-tally-head">
                <span className="display">Ark Scrip</span>
                <div className="rch-tally-total num" ref={tallyTotalRef}>
                  <Icon name="influence" size={18} /> {fmt(influenceShown)}
                </div>
              </div>
              <div className="rch-tally-lines">
                {result.influenceEarned.slice(0, tallyShown).map((l, k) => (
                  <div key={k} className="rch-tally-line" data-tally={k}>
                    <span>{reportLabel(l.label)}</span>
                    <span className="num">+{l.amount} <Icon name="influence" size={13} /></span>
                  </div>
                ))}
              </div>
              <Button
                variant="gold"
                className={`rch-go ${stage === 'done' ? 'is-ready' : ''}`}
                disabled={stage !== 'done'}
                onClick={() => {
                  sfx('click');
                  act({ type: 'ackChronicle' });
                }}
              >
                {cta} <Icon name="chevronRight" size={16} />
              </Button>
            </div>
          )}
        </section>
      </div>
      {stage !== 'done' && stage !== 'tally' && (
        <div className="ro-hint rch-speed">{speed === 1 ? 'Tap to speed up' : speed === 2 ? '2× · tap to skip' : 'Skipping…'}</div>
      )}
      <Ornament className="rch-orn" />
    </div>
  );
}

function LedgerRow({ row, tweenMs }: { row: Row; tweenMs: number }) {
  const renown = useTweened(row.renown, tweenMs);
  const style = row.color ? ({ '--row-c': row.color } as CSSProperties) : undefined;
  return (
    <div className={`rch-row rch-row--${row.tone} rch-row--${row.source} ${row.focus ? 'is-focus' : ''}`} data-row={row.key} style={style}>
      <span className="rch-row-icon"><Icon name={row.icon} size={18} /></span>
      <span className="rch-row-label">
        {row.label}
        {row.chips && (
          <span className="rch-chips">
            {row.chips.map((c) => (
              <span key={c.key} className="rch-chip" data-chip={c.key}>
                {c.name}{c.text ? <b>{c.text}</b> : null}
              </span>
            ))}
          </span>
        )}
      </span>
      <span className="rch-row-vals num">
        {row.focus && <span className="rch-row-focus display">×2</span>}
        {row.renown !== 0 && <span className="rch-v rch-v--r">{row.renown > 0 ? '+' : '−'}{fmt(Math.abs(renown))}</span>}
        {row.splendorAdd !== 0 && <span className="rch-v rch-v--s">{row.splendorAdd > 0 ? '+' : '−'}{fmtSplendor(Math.abs(row.splendorAdd))}</span>}
        {row.splendorMul != null && <span className={`rch-v rch-v--m ${row.splendorMul < 1 ? 'is-down' : ''}`}>{fmtMul(row.splendorMul)}</span>}
      </span>
    </div>
  );
}
function reportLabel(label: string): string {
  return label
    .replace(/\bLegacy\b/gi, T.score)
    .replace(/\bRenown\b/gi, T.renown)
    .replace(/\bSplendor\b/gi, T.splendor)
    .replace(/\bDoctrine(s)?\b/gi, T.doctrines)
    .replace(/\bEdict(s)?\b/gi, T.edicts)
    .replace(/\bScroll(s)?\b/gi, T.scrolls)
    .replace(/\bInfluence\b/gi, T.influence)
    .replace(/\bMandate\b/gi, T.mandate)
    .replace(/\bOmen(s)?\b/gi, T.omens)
    .replace(/\bDark Age\b/gi, T.darkAge)
    .replace(/\bFocus\b/gi, T.focus);
}
