// DOM overlay model: city banners, unit flags and transient world-anchored pops (damage numbers,
// glyphs). React renders the content (Overlay.tsx); the renderer positions registered elements every
// frame with transforms (no React re-render per frame).

export interface BannerData {
  id: number;
  tile: number;
  name: string;
  pop: number;
  capital: boolean;
  primary: string;
  secondary: string;
  human: boolean;
  /** icon name of the item in production, null when idle */
  prodIcon: string | null;
  /** 0..1 */
  progress: number;
  turns: number | null;
  hp: number;
  maxHp: number;
  /** remembered (explored but not visible) */
  ghost: boolean;
}

export interface FlagData {
  id: number;
  tile: number;
  icon: string;
  hp: number;
  primary: string;
  secondary: string;
  human: boolean;
  promo: boolean;
  fortified: boolean;
  level: number;
}

export type PopKind = 'damage' | 'heal' | 'glyph' | 'label';
export interface PopData {
  id: number;
  kind: PopKind;
  text: string;
  icon?: string;
  color: string;
  x: number;
  y: number;
  z: number;
  /** seconds */
  life: number;
}

export interface MarkerData {
  id: number;
  text: string;
}

export interface OverlaySnapshot {
  banners: BannerData[];
  flags: FlagData[];
  pops: PopData[];
  /** path turn markers */
  markers: MarkerData[];
}

export class OverlayStore {
  private snap: OverlaySnapshot = { banners: [], flags: [], pops: [], markers: [] };
  private subs = new Set<() => void>();
  readonly elements = new Map<string, HTMLElement>();
  private popId = 1;
  onTap: ((tile: number) => void) | null = null;

  subscribe = (fn: () => void): (() => void) => {
    this.subs.add(fn);
    return () => this.subs.delete(fn);
  };

  getSnapshot = (): OverlaySnapshot => this.snap;

  private emit(): void {
    for (const fn of this.subs) fn();
  }

  setBannersFlags(banners: BannerData[], flags: FlagData[]): void {
    const same = JSON.stringify(banners) === JSON.stringify(this.snap.banners) && JSON.stringify(flags) === JSON.stringify(this.snap.flags);
    if (same) return;
    this.snap = { ...this.snap, banners, flags };
    this.emit();
  }

  setMarkers(markers: MarkerData[]): void {
    if (!markers.length && !this.snap.markers.length) return;
    this.snap = { ...this.snap, markers };
    this.emit();
  }

  pop(p: Omit<PopData, 'id'>): void {
    const id = this.popId++;
    this.snap = { ...this.snap, pops: [...this.snap.pops, { ...p, id }] };
    this.emit();
    window.setTimeout(() => {
      this.snap = { ...this.snap, pops: this.snap.pops.filter((x) => x.id !== id) };
      this.emit();
    }, p.life * 1000);
  }

  register = (key: string, el: HTMLElement | null): void => {
    if (el) this.elements.set(key, el);
    else this.elements.delete(key);
  };

  clear(): void {
    this.snap = { banners: [], flags: [], pops: [], markers: [] };
    this.emit();
  }
}
