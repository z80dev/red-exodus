// Juice primitives for the run layer: tweens, floating text, screen shake, card flights, particle bursts.
// Imperative DOM for short-lived effects keeps React out of the 60fps path.
import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from './runUtil';

export const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
};

/** rAF tween; returns cancel. duration ≤ 0 applies the end value synchronously. */
export function tween(from: number, to: number, duration: number, onUpdate: (v: number) => void, ease = easeOutCubic, onDone?: () => void): () => void {
  if (duration <= 0 || from === to) {
    onUpdate(to);
    onDone?.();
    return () => {};
  }
  const t0 = performance.now();
  let raf = 0;
  const frame = (now: number) => {
    // rAF timestamps can precede the performance.now() taken at start: clamp to [0, 1]
    const t = Math.max(0, Math.min(1, (now - t0) / duration));
    onUpdate(from + (to - from) * ease(t));
    if (t < 1) raf = requestAnimationFrame(frame);
    else onDone?.();
  };
  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}

/** Animated number that eases from its previous value whenever `value` changes. */
export function useTweened(value: number, duration: number, ease = easeOutCubic): number {
  const [shown, setShown] = useState(value);
  const shownRef = useRef(value);
  useEffect(() => {
    return tween(shownRef.current, value, duration, (v) => {
      shownRef.current = v;
      setShown(v);
    }, ease);
  }, [value, duration, ease]);
  return shown;
}

// ───────────── overlay layer for floaters / flights (fixed, above run overlays, below toasts) ─────────────
let fxLayer: HTMLDivElement | null = null;
export function fxRoot(): HTMLDivElement {
  if (fxLayer && fxLayer.isConnected) return fxLayer;
  fxLayer = document.createElement('div');
  fxLayer.className = 'rfx-layer';
  document.body.appendChild(fxLayer);
  return fxLayer;
}

export interface FloatOpts {
  /** css class modifier: renown | splendor | mul | gold | influence | bad | good */
  tone?: string;
  size?: number;
  /** vertical travel px (negative = up) */
  rise?: number;
  duration?: number;
  delay?: number;
}
/** Floating combat-text style label at viewport coords. */
export function floatText(x: number, y: number, html: string, opts: FloatOpts = {}): void {
  const el = document.createElement('div');
  el.className = `rfx-float rfx-float--${opts.tone ?? 'gold'}`;
  el.innerHTML = html;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  if (opts.size) el.style.fontSize = `${opts.size}px`;
  fxRoot().appendChild(el);
  const rise = opts.rise ?? -56;
  const duration = opts.duration ?? 1100;
  const anim = el.animate(
    [
      { transform: 'translate(-50%, -50%) scale(0.4)', opacity: 0 },
      { transform: 'translate(-50%, calc(-50% - 6px)) scale(1.25)', opacity: 1, offset: 0.14 },
      { transform: 'translate(-50%, calc(-50% - 10px)) scale(1)', opacity: 1, offset: 0.3 },
      { transform: `translate(-50%, calc(-50% + ${rise}px)) scale(0.95)`, opacity: 0 },
    ],
    { duration, delay: opts.delay ?? 0, easing: 'cubic-bezier(0.22,1,0.36,1)', fill: 'both' },
  );
  anim.onfinish = () => el.remove();
}

export function floatAt(el: Element | null, html: string, opts: FloatOpts & { dy?: number } = {}): void {
  if (!el) return;
  const r = el.getBoundingClientRect();
  floatText(r.left + r.width / 2, r.top + (opts.dy ?? r.height * 0.1), html, opts);
}

/** Screen shake on an element. intensity ≈ px amplitude. */
export function shake(el: HTMLElement | null, intensity = 6, duration = 380): void {
  if (!el || prefersReducedMotion()) return;
  const frames: Keyframe[] = [];
  const n = 9;
  for (let i = 0; i <= n; i++) {
    const k = 1 - i / n;
    const a = intensity * k;
    frames.push({ transform: i === n ? 'translate(0,0)' : `translate(${(Math.random() * 2 - 1) * a}px, ${(Math.random() * 2 - 1) * a}px) rotate(${(Math.random() * 2 - 1) * a * 0.08}deg)` });
  }
  el.animate(frames, { duration, easing: 'linear' });
}

/** Scale "bump" on an element. */
export function bump(el: Element | null, scale = 1.14, duration = 320): void {
  if (!el) return;
  (el as HTMLElement).animate(
    [{ transform: 'scale(1)' }, { transform: `scale(${scale})`, offset: 0.3 }, { transform: 'scale(1)' }],
    { duration, easing: 'cubic-bezier(0.34,1.56,0.64,1)' },
  );
}

export interface FlySnapshot { node: HTMLElement; rect: DOMRect }
/** Capture an element for a later flight (the source may unmount after a dispatch). */
export function snapshotEl(el: HTMLElement): FlySnapshot {
  return { node: el.cloneNode(true) as HTMLElement, rect: el.getBoundingClientRect() };
}

/**
 * Fly a visual clone of `src` to `dst`. The clone is a snapshot (deep clone) positioned fixed; it lands
 * with the destination's size. Resolves when landed.
 */
export function flyClone(src: HTMLElement | FlySnapshot, dst: Element | DOMRect, opts: { duration?: number; arc?: number; spin?: number } = {}): Promise<void> {
  const snap = src instanceof HTMLElement ? snapshotEl(src) : src;
  const from = snap.rect;
  const to = dst instanceof DOMRect ? dst : dst.getBoundingClientRect();
  const clone = snap.node;
  clone.classList.add('rfx-flyer');
  Object.assign(clone.style, {
    position: 'fixed', left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px`,
    margin: '0', transformOrigin: '0 0', pointerEvents: 'none', transform: 'none',
  });
  fxRoot().appendChild(clone);
  const dx = to.left - from.left;
  const dy = to.top - from.top;
  const sx = to.width / Math.max(1, from.width);
  const sy = to.height / Math.max(1, from.height);
  const arc = opts.arc ?? -80;
  const spin = opts.spin ?? 8;
  const duration = prefersReducedMotion() ? 1 : opts.duration ?? 620;
  // tsconfig lib is ES2023 (no Promise.withResolvers), so the executor form is required here.
  let resolve: () => void = () => {};
  const promise = new Promise<void>((r) => { resolve = r; });
  const anim = clone.animate(
    [
      { transform: 'translate(0,0) scale(1) rotate(0deg)', filter: 'brightness(1)' },
      { transform: `translate(${dx * 0.45}px, ${dy * 0.45 + arc}px) scale(${(1 + sx) / 2 * 1.08}, ${(1 + sy) / 2 * 1.08}) rotate(${spin}deg)`, filter: 'brightness(1.35)', offset: 0.45 },
      { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy}) rotate(0deg)`, filter: 'brightness(1)' },
    ],
    { duration, easing: 'cubic-bezier(0.45,0,0.2,1)', fill: 'forwards' },
  );
  anim.onfinish = () => {
    clone.remove();
    resolve();
  };
  return promise;
}

/** Particle streak (a few glowing dots) from one element to another — "value flows into the counter". */
export function streak(from: Element | null, to: Element | null, color: string, count = 6): void {
  if (!from || !to || prefersReducedMotion()) return;
  const a = from.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  const ax = a.left + a.width / 2;
  const ay = a.top + a.height / 2;
  const bx = b.left + b.width / 2;
  const by = b.top + b.height / 2;
  const root = fxRoot();
  for (let i = 0; i < count; i++) {
    const dot = document.createElement('div');
    dot.className = 'rfx-dot';
    dot.style.background = color;
    dot.style.boxShadow = `0 0 10px 2px ${color}`;
    dot.style.left = `${ax}px`;
    dot.style.top = `${ay}px`;
    root.appendChild(dot);
    const jx = (Math.random() - 0.5) * 60;
    const jy = (Math.random() - 0.5) * 60 - 30;
    const anim = dot.animate(
      [
        { transform: 'translate(-50%,-50%) scale(0.6)', opacity: 0 },
        { transform: `translate(calc(-50% + ${jx}px), calc(-50% + ${jy}px)) scale(1.1)`, opacity: 1, offset: 0.3 },
        { transform: `translate(calc(-50% + ${bx - ax}px), calc(-50% + ${by - ay}px)) scale(0.4)`, opacity: 0.9 },
      ],
      { duration: 480 + i * 40, delay: i * 25, easing: 'cubic-bezier(0.5,0,0.2,1)', fill: 'both' },
    );
    anim.onfinish = () => dot.remove();
  }
}

// ───────────── particles (canvas) ─────────────
export type ParticleKind = 'spark' | 'confetti' | 'coin' | 'shard' | 'dust' | 'ash' | 'ember';
interface P {
  x: number; y: number; vx: number; vy: number; life: number; max: number; size: number;
  color: string; kind: ParticleKind; rot: number; vr: number; g: number; drag: number;
}
export interface BurstOpts { count?: number; colors?: string[]; speed?: number; kind?: ParticleKind; spread?: number; angle?: number; gravity?: number; size?: number; life?: number }

/** Fixed full-screen particle canvas (pointer-events none). One per overlay that needs it. */
export class ParticleField {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private ps: P[] = [];
  private raf = 0;
  private dpr = 1;
  private emitters: { kind: ParticleKind; colors: string[]; rate: number; acc: number }[] = [];
  private last = 0;
  private onResize = () => this.resize();

  constructor(parent: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'rfx-canvas';
    parent.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
    this.resize();
    window.addEventListener('resize', this.onResize);
  }
  private resize() {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(1, Math.round(r.width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(r.height * this.dpr));
  }
  /** burst at viewport coords */
  burst(x: number, y: number, o: BurstOpts = {}): void {
    if (prefersReducedMotion()) return;
    const r = this.canvas.getBoundingClientRect();
    const kind = o.kind ?? 'spark';
    const colors = o.colors ?? ['#f6dd8f', '#eac766', '#fff4c9'];
    const count = o.count ?? 28;
    const speed = o.speed ?? 6;
    const spread = o.spread ?? Math.PI * 2;
    const angle = o.angle ?? -Math.PI / 2;
    for (let i = 0; i < count; i++) {
      const a = angle + (Math.random() - 0.5) * spread;
      const s = speed * (0.35 + Math.random() * 0.9);
      this.ps.push({
        x: x - r.left, y: y - r.top, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 0, max: (o.life ?? 900) * (0.6 + Math.random() * 0.6), size: (o.size ?? 4) * (0.6 + Math.random() * 0.8),
        color: colors[i % colors.length], kind, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.4,
        g: o.gravity ?? (kind === 'confetti' ? 0.12 : kind === 'coin' || kind === 'shard' ? 0.3 : 0.05),
        drag: kind === 'confetti' ? 0.975 : 0.985,
      });
    }
    this.start();
  }
  /** continuous ambient emitter: 'dust' rises (victory gold), 'ash' falls (defeat), 'ember' drifts up */
  emit(kind: ParticleKind, colors: string[], perSecond: number): void {
    if (prefersReducedMotion()) return;
    this.emitters.push({ kind, colors, rate: perSecond, acc: 0 });
    this.start();
  }
  private spawnAmbient(kind: ParticleKind, color: string) {
    const w = this.canvas.width / this.dpr;
    const h = this.canvas.height / this.dpr;
    const falling = kind === 'ash' || kind === 'confetti';
    this.ps.push({
      x: Math.random() * w, y: falling ? -10 : h + 10,
      vx: (Math.random() - 0.5) * 0.6, vy: falling ? 0.6 + Math.random() * 0.9 : -(0.5 + Math.random() * 1.3),
      life: 0, max: 5000 + Math.random() * 4000, size: kind === 'ash' ? 1.5 + Math.random() * 2.5 : 1 + Math.random() * 2.6,
      color, kind, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.05, g: 0, drag: 1,
    });
  }
  private start() {
    if (this.raf) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }
  private frame = (now: number) => {
    const dt = Math.max(0, Math.min(48, now - this.last));
    this.last = now;
    const k = dt / 16.67;
    for (const e of this.emitters) {
      e.acc += (e.rate * dt) / 1000;
      while (e.acc >= 1) {
        e.acc -= 1;
        this.spawnAmbient(e.kind, e.colors[Math.floor(Math.random() * e.colors.length)]);
      }
    }
    const { ctx } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const alive: P[] = [];
    for (const p of this.ps) {
      p.life += dt;
      if (p.life >= p.max) continue;
      p.vx *= p.drag ** k;
      p.vy = p.vy * p.drag ** k + p.g * k;
      p.x += p.vx * k;
      p.y += p.vy * k;
      p.rot += p.vr * k;
      const t = p.life / p.max;
      const fade = p.kind === 'dust' || p.kind === 'ash' || p.kind === 'ember' ? Math.sin(Math.PI * t) : 1 - t * t;
      ctx.globalAlpha = Math.max(0, fade);
      this.draw(p);
      alive.push(p);
    }
    ctx.globalAlpha = 1;
    this.ps = alive;
    if (this.ps.length || this.emitters.length) this.raf = requestAnimationFrame(this.frame);
    else this.raf = 0;
  };
  private draw(p: P) {
    const { ctx } = this;
    switch (p.kind) {
      case 'confetti': {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(1, Math.cos(p.rot * 2.3));
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size, -p.size * 0.45, p.size * 2, p.size * 0.9);
        ctx.restore();
        break;
      }
      case 'coin': {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(Math.cos(p.rot * 3), 1);
        const g = ctx.createRadialGradient(-p.size * 0.3, -p.size * 0.3, 0, 0, 0, p.size * 1.4);
        g.addColorStop(0, '#fff4c9');
        g.addColorStop(0.5, p.color);
        g.addColorStop(1, '#7d5c1b');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, p.size * 1.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        break;
      }
      case 'shard': {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(0, -p.size * 1.6);
        ctx.lineTo(p.size, p.size);
        ctx.lineTo(-p.size * 0.8, p.size * 0.6);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        break;
      }
      default: {
        const glow = p.kind === 'spark' || p.kind === 'dust' || p.kind === 'ember';
        if (glow) {
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3);
          g.addColorStop(0, p.color);
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = p.kind === 'spark' ? '#fffaf0' : p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.kind === 'spark' ? p.size * 0.55 : p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  dispose(): void {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    this.canvas.remove();
    this.ps = [];
    this.emitters = [];
  }
}

/** Mount a ParticleField into a host element for the component's lifetime. */
export function useParticles(): [(el: HTMLDivElement | null) => void, React.RefObject<ParticleField | null>] {
  const field = useRef<ParticleField | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const setHost = useRef((el: HTMLDivElement | null) => {
    if (el === hostRef.current) return;
    field.current?.dispose();
    field.current = null;
    hostRef.current = el;
    if (el) field.current = new ParticleField(el);
  }).current;
  useEffect(() => () => {
    field.current?.dispose();
    field.current = null;
    hostRef.current = null;
  }, []);
  return [setHost, field];
}

/** center of an element in viewport coords */
export function centerOf(el: Element | null): { x: number; y: number } {
  if (!el) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/**
 * FLIP: animate children (matched by `data-flip` key) from their previous layout position to the new one.
 * Call `snapshot()` right before a state change that reorders, then `play()` in a layout effect.
 */
export function flipSnapshot(container: HTMLElement | null): Map<string, DOMRect> {
  const m = new Map<string, DOMRect>();
  if (!container) return m;
  container.querySelectorAll<HTMLElement>('[data-flip]').forEach((el) => m.set(el.dataset.flip!, el.getBoundingClientRect()));
  return m;
}
export function flipPlay(container: HTMLElement | null, before: Map<string, DOMRect>, skip?: string, duration = 320): void {
  if (!container || before.size === 0 || prefersReducedMotion()) return;
  container.querySelectorAll<HTMLElement>('[data-flip]').forEach((el) => {
    const key = el.dataset.flip!;
    if (key === skip) return;
    const prev = before.get(key);
    if (!prev) {
      el.animate([{ transform: 'scale(0.6)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 300, easing: 'cubic-bezier(0.34,1.56,0.64,1)' });
      return;
    }
    const now = el.getBoundingClientRect();
    const dx = prev.left - now.left;
    const dy = prev.top - now.top;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
    el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0,0)' }], { duration, easing: 'cubic-bezier(0.22,1,0.36,1)' });
  });
}

/** DOM-only radial spark burst + ring at an element's centre (no canvas needed; HUD-safe). */
export function sparkBurst(el: Element | null, color = 'var(--gold-300)', count = 12): void {
  if (prefersReducedMotion()) return;
  const { x, y } = centerOf(el);
  const root = fxRoot();
  const ring = document.createElement('div');
  ring.className = 'rfx-ring';
  ring.style.left = `${x}px`;
  ring.style.top = `${y}px`;
  ring.style.borderColor = color;
  root.appendChild(ring);
  ring.animate(
    [{ transform: 'translate(-50%,-50%) scale(0.2)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(1.6)', opacity: 0 }],
    { duration: 520, easing: 'cubic-bezier(0.22,1,0.36,1)' },
  ).onfinish = () => ring.remove();
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + Math.random() * 0.3;
    const d = 40 + Math.random() * 40;
    const dot = document.createElement('div');
    dot.className = 'rfx-dot';
    dot.style.left = `${x}px`;
    dot.style.top = `${y}px`;
    dot.style.background = color;
    dot.style.boxShadow = `0 0 8px 2px ${color}`;
    root.appendChild(dot);
    dot.animate(
      [
        { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
        { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) scale(0.2)`, opacity: 0 },
      ],
      { duration: 480 + Math.random() * 200, easing: 'cubic-bezier(0.22,1,0.36,1)' },
    ).onfinish = () => dot.remove();
  }
}
