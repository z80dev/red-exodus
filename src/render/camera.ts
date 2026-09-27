// Tabletop camera: perspective, tilted ~50° when close and flatter from above when zoomed out.
// Touch: one-finger grab-pan with inertia, pinch zoom, two-finger twist rotate. Mouse: drag pan,
// wheel zoom-to-cursor, right/middle drag rotate. Keyboard: WASD/arrows pan, Q/E rotate, +/- zoom.
// Tap vs drag threshold, 450 ms long-press, desktop hover. Attract mode orbits slowly.
import { PerspectiveCamera, Plane, Raycaster, Vector2, Vector3 } from 'three';

export interface RigCallbacks {
  pick(clientX: number, clientY: number): number;
  onTap(idx: number): void;
  onLongPress(idx: number): void;
  onHover(idx: number | null): void;
}

const LONG_PRESS_MS = 450;
const NEAR_PITCH = (50 * Math.PI) / 180;
const FAR_PITCH = (64 * Math.PI) / 180;

export const ZOOM_PRESETS = { near: 7.5, mid: 12, far: 20 } as const;

export class CameraRig {
  readonly camera: PerspectiveCamera;
  target = new Vector3(0, 0, 0);
  dist = 13;
  azimuth = 0;
  /** base zoom limits (landscape); portrait scales them by `aspectK` */
  baseMinDist = 5.5;
  baseMaxDist = 30;
  minDist = 5.5;
  maxDist = 30;
  /** >1 on portrait screens so the same zoom level shows a comparable map width */
  aspectK = 1;
  bounds = { minX: -5, maxX: 5, minZ: -5, maxZ: 5 };
  attract = false;
  inputEnabled = true;
  private wantDist = 13;
  private vel = new Vector2();
  private focusAnim: { from: Vector3; to: Vector3; fromD: number; toD: number; t: number; dur: number } | null = null;
  private shakeAmp = 0;
  private shakeT = 0;
  private el: HTMLElement | null = null;
  private cb: RigCallbacks;
  private pointers = new Map<number, { x: number; y: number; sx: number; sy: number; type: string }>();
  private gesture: {
    start: number;
    moved: boolean;
    long: boolean;
    timer: number | null;
    grab: Vector3 | null;
    pinchD: number;
    pinchA: number;
    rotating: boolean;
    lastT: number;
  } | null = null;
  private keys = new Set<string>();
  private hoverIdx: number | null = null;
  private ray = new Raycaster();
  private plane = new Plane(new Vector3(0, 1, 0), -0.12);
  private tmpV = new Vector3();
  private tmp2 = new Vector2();
  private disposers: (() => void)[] = [];

  constructor(cb: RigCallbacks) {
    this.camera = new PerspectiveCamera(34, 1, 0.3, 400);
    this.cb = cb;
  }

  pitch(): number {
    const t = Math.min(1, Math.max(0, (this.dist - this.minDist) / (this.maxDist - this.minDist)));
    return NEAR_PITCH + (FAR_PITCH - NEAR_PITCH) * t * t * (3 - 2 * t);
  }

  attach(el: HTMLElement): void {
    this.el = el;
    const on = <K extends keyof HTMLElementEventMap>(type: K, fn: (e: HTMLElementEventMap[K]) => void, opts?: AddEventListenerOptions) => {
      el.addEventListener(type, fn as EventListener, opts);
      this.disposers.push(() => el.removeEventListener(type, fn as EventListener, opts));
    };
    on('pointerdown', (e) => this.down(e));
    on('pointermove', (e) => this.move(e));
    on('pointerup', (e) => this.up(e));
    on('pointercancel', (e) => this.up(e, true));
    on('pointerleave', (e) => {
      if (e.pointerType === 'mouse' && !this.pointers.size) this.hover(null);
    });
    on('wheel', (e) => this.wheel(e), { passive: false });
    on('contextmenu', (e) => e.preventDefault());
    const kd = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      this.keys.add(e.key.toLowerCase());
    };
    const ku = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());
    const blur = () => this.keys.clear();
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    window.addEventListener('blur', blur);
    this.disposers.push(() => {
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      window.removeEventListener('blur', blur);
    });
  }

  detach(): void {
    for (const d of this.disposers) d();
    this.disposers = [];
    this.el = null;
  }

  /** ground point (approx plane) under a client coordinate */
  groundAt(clientX: number, clientY: number, out: Vector3): Vector3 | null {
    if (!this.el) return null;
    const r = this.el.getBoundingClientRect();
    this.tmp2.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.tmp2, this.camera);
    return this.ray.ray.intersectPlane(this.plane, out);
  }

  private down(e: PointerEvent): void {
    if (!this.inputEnabled || this.attract) return;
    this.el?.setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, type: e.pointerType });
    this.vel.set(0, 0);
    this.focusAnim = null;
    if (this.pointers.size === 1) {
      const rotating = e.pointerType === 'mouse' && (e.button === 1 || e.button === 2);
      this.gesture = {
        start: performance.now(),
        moved: false,
        long: false,
        timer: null,
        grab: rotating ? null : this.groundAt(e.clientX, e.clientY, new Vector3()),
        pinchD: 0,
        pinchA: 0,
        rotating,
        lastT: performance.now(),
      };
      if (!rotating) {
        const g = this.gesture;
        g.timer = window.setTimeout(() => {
          if (!g.moved && this.pointers.size === 1) {
            g.long = true;
            const idx = this.cb.pick(e.clientX, e.clientY);
            if (idx >= 0) this.cb.onLongPress(idx);
          }
        }, LONG_PRESS_MS);
      }
    } else if (this.pointers.size === 2 && this.gesture) {
      this.cancelLong();
      this.gesture.moved = true;
      this.startPinch();
    }
  }

  private startPinch(): void {
    const [a, b] = [...this.pointers.values()];
    const g = this.gesture!;
    g.pinchD = Math.hypot(a.x - b.x, a.y - b.y);
    g.pinchA = Math.atan2(b.y - a.y, b.x - a.x);
    g.grab = this.groundAt((a.x + b.x) / 2, (a.y + b.y) / 2, new Vector3());
  }

  private cancelLong(): void {
    if (this.gesture?.timer) window.clearTimeout(this.gesture.timer);
    if (this.gesture) this.gesture.timer = null;
  }

  private move(e: PointerEvent): void {
    const p = this.pointers.get(e.pointerId);
    if (!p) {
      if (e.pointerType === 'mouse' && this.inputEnabled && !this.attract) {
        const idx = this.cb.pick(e.clientX, e.clientY);
        this.hover(idx >= 0 ? idx : null);
      }
      return;
    }
    const g = this.gesture;
    if (!g) return;
    const px = p.x;
    const py = p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    const threshold = p.type === 'mouse' ? 4 : 9;
    if (!g.moved && Math.hypot(p.x - p.sx, p.y - p.sy) > threshold) {
      g.moved = true;
      this.cancelLong();
    }
    if (!g.moved) return;
    const now = performance.now();
    const dt = Math.max(1, now - g.lastT) / 1000;
    g.lastT = now;
    if (this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      if (g.pinchD > 0) {
        this.dist = this.wantDist = clamp((this.dist * g.pinchD) / Math.max(20, d), this.minDist, this.maxDist);
        let da = ang - g.pinchA;
        if (da > Math.PI) da -= Math.PI * 2;
        if (da < -Math.PI) da += Math.PI * 2;
        this.azimuth -= da;
      }
      g.pinchD = d;
      g.pinchA = ang;
      this.applyCamera();
      if (g.grab) this.dragTo(g.grab, (a.x + b.x) / 2, (a.y + b.y) / 2, 0);
      return;
    }
    if (g.rotating) {
      this.azimuth -= (p.x - px) * 0.006;
      this.dist = this.wantDist = clamp(this.dist * (1 + (p.y - py) * 0.004), this.minDist, this.maxDist);
      return;
    }
    if (g.grab) this.dragTo(g.grab, p.x, p.y, dt);
  }

  /** move target so the grabbed ground point sits under the pointer again */
  private dragTo(grab: Vector3, cx: number, cy: number, dt: number): void {
    this.applyCamera();
    const cur = this.groundAt(cx, cy, this.tmpV);
    if (!cur) return;
    const dx = grab.x - cur.x;
    const dz = grab.z - cur.z;
    this.target.x += dx;
    this.target.z += dz;
    this.clampTarget();
    if (dt > 0) {
      const k = 0.35;
      this.vel.x = this.vel.x * (1 - k) + (dx / dt) * k;
      this.vel.y = this.vel.y * (1 - k) + (dz / dt) * k;
    }
  }

  private up(e: PointerEvent, cancel = false): void {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    this.pointers.delete(e.pointerId);
    const g = this.gesture;
    if (!g) return;
    if (this.pointers.size === 1) {
      // continue as one-finger pan from the remaining pointer
      const [rest] = [...this.pointers.values()];
      g.grab = this.groundAt(rest.x, rest.y, new Vector3());
      g.pinchD = 0;
      this.vel.set(0, 0);
      return;
    }
    if (this.pointers.size > 0) return;
    this.cancelLong();
    const elapsed = performance.now() - g.start;
    if (!cancel && !g.moved && !g.long && !g.rotating && elapsed < LONG_PRESS_MS + 50) {
      const idx = this.cb.pick(e.clientX, e.clientY);
      if (idx >= 0) this.cb.onTap(idx);
    }
    // inertia only when the finger was still moving at release
    if (performance.now() - g.lastT > 90) this.vel.set(0, 0);
    const maxV = 60;
    if (this.vel.length() > maxV) this.vel.setLength(maxV);
    this.gesture = null;
  }

  private wheel(e: WheelEvent): void {
    if (!this.inputEnabled || this.attract) return;
    e.preventDefault();
    this.focusAnim = null;
    const before = this.groundAt(e.clientX, e.clientY, new Vector3());
    const scale = Math.exp(e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0016));
    this.dist = this.wantDist = clamp(this.dist * scale, this.minDist, this.maxDist);
    this.applyCamera();
    if (before) {
      const after = this.groundAt(e.clientX, e.clientY, this.tmpV);
      if (after) {
        this.target.x += before.x - after.x;
        this.target.z += before.z - after.z;
        this.clampTarget();
      }
    }
  }

  private hover(idx: number | null): void {
    if (idx === this.hoverIdx) return;
    this.hoverIdx = idx;
    this.cb.onHover(idx);
  }

  focus(x: number, z: number, dist: number | null, animate: boolean): void {
    const to = new Vector3(x, 0, z);
    const toD = dist ?? this.dist;
    this.vel.set(0, 0);
    if (!animate) {
      this.target.copy(to);
      this.dist = this.wantDist = toD;
      this.clampTarget();
      this.focusAnim = null;
      return;
    }
    const d = this.target.distanceTo(to);
    this.focusAnim = { from: this.target.clone(), to, fromD: this.dist, toD, t: 0, dur: clamp(0.35 + d * 0.025, 0.4, 1.1) };
  }

  shake(amount: number): void {
    this.shakeAmp = Math.max(this.shakeAmp, amount);
  }

  private clampTarget(): void {
    const b = this.bounds;
    this.target.x = clamp(this.target.x, b.minX, b.maxX);
    this.target.z = clamp(this.target.z, b.minZ, b.maxZ);
  }

  update(dt: number): void {
    if (this.attract) {
      this.azimuth += dt * 0.045;
      this.wantDist = this.dist;
    } else if (this.focusAnim) {
      const f = this.focusAnim;
      f.t += dt;
      const t = Math.min(1, f.t / f.dur);
      const e = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
      this.target.lerpVectors(f.from, f.to, e);
      this.dist = this.wantDist = f.fromD + (f.toD - f.fromD) * e;
      this.clampTarget();
      if (t >= 1) this.focusAnim = null;
    } else if (!this.pointers.size) {
      if (this.vel.lengthSq() > 1e-4) {
        this.target.x += this.vel.x * dt;
        this.target.z += this.vel.y * dt;
        this.vel.multiplyScalar(Math.exp(-4.2 * dt));
        this.clampTarget();
      }
      // keyboard
      if (this.inputEnabled && this.keys.size) {
        const k = this.keys;
        const sp = this.dist * 0.9 * dt;
        let fx = 0;
        let fz = 0;
        if (k.has('w') || k.has('arrowup')) fz -= 1;
        if (k.has('s') || k.has('arrowdown')) fz += 1;
        if (k.has('a') || k.has('arrowleft')) fx -= 1;
        if (k.has('d') || k.has('arrowright')) fx += 1;
        const c = Math.cos(this.azimuth);
        const s = Math.sin(this.azimuth);
        this.target.x += (fx * c + fz * s) * sp;
        this.target.z += (-fx * s + fz * c) * sp;
        if (k.has('q')) this.azimuth += dt * 1.4;
        if (k.has('e')) this.azimuth -= dt * 1.4;
        if (k.has('=') || k.has('+')) this.wantDist = clamp(this.wantDist * (1 - dt * 1.5), this.minDist, this.maxDist);
        if (k.has('-')) this.wantDist = clamp(this.wantDist * (1 + dt * 1.5), this.minDist, this.maxDist);
        this.clampTarget();
      }
      this.dist += (this.wantDist - this.dist) * Math.min(1, dt * 10);
    }
    if (this.shakeAmp > 0.001) {
      this.shakeT += dt;
      this.shakeAmp *= Math.exp(-dt * 9);
    } else this.shakeAmp = 0;
    this.applyCamera();
  }

  applyCamera(): void {
    const pitch = this.pitch();
    const h = Math.sin(pitch) * this.dist;
    const back = Math.cos(pitch) * this.dist;
    const c = this.camera;
    c.position.set(this.target.x + Math.sin(this.azimuth) * back, this.target.y + h, this.target.z + Math.cos(this.azimuth) * back);
    if (this.shakeAmp > 0) {
      const t = this.shakeT * 40;
      c.position.x += Math.sin(t * 1.3) * this.shakeAmp;
      c.position.y += Math.sin(t * 1.9 + 1) * this.shakeAmp * 0.6;
      c.position.z += Math.cos(t * 1.1) * this.shakeAmp;
    }
    c.lookAt(this.target.x, this.target.y, this.target.z);
    c.updateMatrixWorld();
  }

  resize(w: number, h: number): void {
    const aspect = w / Math.max(1, h);
    this.camera.aspect = aspect;
    // keep a usable horizontal field of view on portrait (vertical fov grows, camera backs off)
    const hfov = (30 * Math.PI) / 180;
    const vfovPortrait = (2 * Math.atan(Math.tan(hfov / 2) / aspect) * 180) / Math.PI;
    this.camera.fov = aspect >= 1.2 ? 34 : Math.min(62, Math.max(34, vfovPortrait));
    this.camera.updateProjectionMatrix();
    const k = aspect >= 1.2 ? 1 : 1 + 0.3 * Math.min(1, (1.2 - aspect) / 0.7);
    const ratio = this.dist / this.minDist;
    this.aspectK = k;
    this.setZoomLimits(this.baseMinDist, this.baseMaxDist);
    this.dist = this.wantDist = clamp(this.minDist * ratio, this.minDist, this.maxDist);
  }

  setZoomLimits(min: number, max: number): void {
    this.baseMinDist = min;
    this.baseMaxDist = max;
    this.minDist = min * this.aspectK;
    this.maxDist = max * this.aspectK;
  }
}

function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}
