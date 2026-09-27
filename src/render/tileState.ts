// Per-tile GPU state (W×H nearest textures) with smooth CPU-side animation:
//   state: R explored, G visible, B owner slot (0 none), A border grow (0→1 animates flare)
//   hi:    R highlight code (see HI), G highlight fade
import { DataTexture, NearestFilter, RGBAFormat, UnsignedByteType } from 'three';

export class TileState {
  readonly w: number;
  readonly h: number;
  readonly tex: DataTexture;
  readonly hiTex: DataTexture;
  private data: Uint8Array;
  private hiData: Uint8Array;
  private explored: Float32Array;
  private exploredT: Float32Array;
  private exploredDelay: Float32Array;
  private visible: Float32Array;
  private visibleT: Float32Array;
  private grow: Float32Array;
  private hiA: Float32Array;
  private hiCode: Uint8Array;
  private hiCodeT: Uint8Array;
  private animating = true;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    const n = w * h;
    this.data = new Uint8Array(n * 4);
    this.hiData = new Uint8Array(n * 4);
    this.tex = new DataTexture(this.data, w, h, RGBAFormat, UnsignedByteType);
    this.hiTex = new DataTexture(this.hiData, w, h, RGBAFormat, UnsignedByteType);
    for (const t of [this.tex, this.hiTex]) {
      t.magFilter = NearestFilter;
      t.minFilter = NearestFilter;
      t.generateMipmaps = false;
      t.needsUpdate = true;
    }
    this.explored = new Float32Array(n);
    this.exploredT = new Float32Array(n);
    this.exploredDelay = new Float32Array(n);
    this.visible = new Float32Array(n);
    this.visibleT = new Float32Array(n);
    this.grow = new Float32Array(n).fill(1);
    this.hiA = new Float32Array(n);
    this.hiCode = new Uint8Array(n);
    this.hiCodeT = new Uint8Array(n);
  }

  /** set fog targets from a vis array (0 unexplored, 1 explored, 2 visible). `instant` skips animation. */
  setVis(vis: ArrayLike<number>, instant: boolean): void {
    for (let i = 0; i < vis.length && i < this.explored.length; i++) {
      const e = vis[i] >= 1 ? 1 : 0;
      const v = vis[i] >= 2 ? 1 : 0;
      this.exploredT[i] = e;
      this.visibleT[i] = v;
      if (instant) {
        this.explored[i] = e;
        this.visible[i] = v;
      }
    }
    this.animating = true;
  }

  /** stagger reveal of specific tiles (ripples outward from `order` index) */
  reveal(tiles: number[], delays: number[]): void {
    tiles.forEach((t, i) => {
      if (t < 0 || t >= this.explored.length) return;
      this.exploredT[t] = 1;
      this.visibleT[t] = 1;
      this.exploredDelay[t] = delays[i] ?? 0;
    });
    this.animating = true;
  }

  /** owner slot per tile (0 none); tiles in `grown` animate a border flare */
  setOwners(slots: ArrayLike<number>, grown?: Iterable<number>): void {
    for (let i = 0; i < slots.length; i++) this.data[i * 4 + 2] = slots[i];
    if (grown) for (const t of grown) this.grow[t] = 0;
    this.animating = true;
  }

  setHighlights(codes: Uint8Array): void {
    for (let i = 0; i < codes.length; i++) this.hiCodeT[i] = codes[i];
    this.animating = true;
  }

  isRevealed(idx: number): boolean {
    return this.explored[idx] > 0.5;
  }

  update(dt: number): void {
    if (!this.animating) return;
    let busy = false;
    const n = this.explored.length;
    const d = this.data;
    for (let i = 0; i < n; i++) {
      if (this.exploredDelay[i] > 0) {
        this.exploredDelay[i] -= dt;
        busy = true;
      } else {
        const e = approach(this.explored[i], this.exploredT[i], dt * 1.1);
        this.explored[i] = e;
        if (e !== this.exploredT[i]) busy = true;
        const v = approach(this.visible[i], this.visibleT[i], dt * 2.2);
        this.visible[i] = v;
        if (v !== this.visibleT[i]) busy = true;
      }
      if (this.grow[i] < 1) {
        this.grow[i] = Math.min(1, this.grow[i] + dt * 0.8);
        busy = true;
      }
      d[i * 4] = Math.round(this.explored[i] * 255);
      d[i * 4 + 1] = Math.round(this.visible[i] * 255);
      d[i * 4 + 3] = Math.round(this.grow[i] * 255);
      // highlights: fade out old code, swap, fade in
      const hd = this.hiData;
      if (this.hiCode[i] !== this.hiCodeT[i]) {
        if (this.hiCode[i] === 0 || this.hiCodeT[i] !== 0) {
          this.hiCode[i] = this.hiCodeT[i];
          if (this.hiA[i] > 0.6) this.hiA[i] = 0.6;
        } else {
          this.hiA[i] = Math.max(0, this.hiA[i] - dt * 8);
          if (this.hiA[i] === 0) this.hiCode[i] = 0;
        }
        busy = true;
      } else if (this.hiCode[i] !== 0 && this.hiA[i] < 1) {
        this.hiA[i] = Math.min(1, this.hiA[i] + dt * 7);
        busy = true;
      }
      hd[i * 4] = this.hiCode[i];
      hd[i * 4 + 1] = Math.round(this.hiA[i] * 255);
    }
    this.tex.needsUpdate = true;
    this.hiTex.needsUpdate = true;
    this.animating = busy;
  }

  dispose(): void {
    this.tex.dispose();
    this.hiTex.dispose();
  }
}

function approach(v: number, t: number, step: number): number {
  if (v < t) return Math.min(t, v + step);
  if (v > t) return Math.max(t, v - step);
  return v;
}
