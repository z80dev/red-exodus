// Event director: turns SimEvent batches into sequenced animations. Human actions play in full; rival
// turns overlap and run faster; anything the human cannot see resolves instantly. Every SimEvent type is
// either animated here or intentionally ignored (UI-only: gold, war/peace, roguelite bookkeeping).
import { Color, Vector3 } from 'three';
import { WONDERS } from '../content';
import type { GameState, PlayerId, SimEvent, TileIdx } from '../sim/types';
import { HUMAN } from '../sim/types';
import type { AeonsRenderer } from './AeonsRenderer';
import { hexDistance } from '../sim/hex';
import type { UnitView } from './units';
import { UNIT_SCALE } from './units';
import { planCities, playerById, teamColors } from './world';

interface Job {
  events: SimEvent[];
  state: GameState;
  resolve: () => void;
}

const GOLD = new Color('#ffd36b');
const WHITE = new Color('#fff6e0');
const EMBER = new Color('#ff8a3a');
const SMOKE = new Color('#5b5550');
const DUST = new Color('#c08a5e');
const SCI = new Color('#6fc3ff');
const LEAF = new Color('#9fbf4a');
const CRYO = new Color('#5fd4e8');
const FROST = new Color('#dff7ff');
const STORM_DUST = new Color('#8a4a2a');

export class Director {
  active = false;
  pendingSync: GameState | null = null;
  timeScale = 1;
  /** user preference multiplier (profile `fastAnimations`) */
  baseSpeed = 1;
  private r: AeonsRenderer;
  private queue: Job[] = [];
  private unitChains = new Map<number, Promise<void>>();
  /** animations that must finish before the batch ends but must not block the next event (storm moves) */
  private background: Promise<void>[] = [];
  /** colony tile → its drop pod's descent; the matching cityFounded waits for touchdown */
  private drops = new Map<TileIdx, Promise<void>>();
  private cancelled = false;

  constructor(r: AeonsRenderer) {
    this.r = r;
  }

  enqueue(events: SimEvent[], state: GameState): Promise<void> {
    return new Promise((resolve) => {
      this.queue.push({ events, state, resolve });
      if (!this.active) void this.run();
    });
  }

  cancel(): void {
    this.cancelled = true;
    this.r.fx.flush();
    this.background = [];
    this.drops.clear();
    for (const j of this.queue.splice(0)) j.resolve();
  }

  private async run(): Promise<void> {
    this.active = true;
    let last: GameState | null = null;
    while (this.queue.length && !this.cancelled) {
      const job = this.queue.shift()!;
      last = job.state;
      this.timeScale = this.baseSpeed * Math.min(3, 1 + this.queue.length * 0.75);
      try {
        if (this.r.state && job.state.map === this.r.state.map) await this.playBatch(job.events, job.state);
      } catch (err) {
        console.error('[render] animation failed', err);
        this.r.fx.flush();
      }
      job.resolve();
    }
    this.timeScale = this.baseSpeed;
    this.unitChains.clear();
    this.active = false;
    const s = this.pendingSync ?? last;
    this.pendingSync = null;
    if (s && !this.cancelled) this.r.applySync(s);
  }

  private vis(state: GameState, tile: TileIdx | undefined): boolean {
    if (tile === undefined || tile < 0) return false;
    return this.r.reveal || (state.players[HUMAN]?.vis[tile] ?? 0) >= 2;
  }

  private async playBatch(events: SimEvent[], state: GameState): Promise<void> {
    const pending: Promise<void>[] = [];
    for (const ev of events) {
      if (this.cancelled) return;
      const human = eventPlayer(ev) === HUMAN || eventPlayer(ev) === null;
      const p = this.handle(ev, state, human ? 1 : 0.6);
      if (!p) continue;
      pending.push(p);
      if (human) await p;
      else await Promise.race([p, this.r.fx.wait(0.16)]);
    }
    await Promise.all(pending);
    await Promise.all(this.background.splice(0));
    this.drops.clear();
  }

  /** serialize animations per unit */
  private chain(id: number, fn: () => Promise<void>): Promise<void> {
    const prev = this.unitChains.get(id) ?? Promise.resolve();
    const next = prev.then(fn);
    this.unitChains.set(id, next);
    return next;
  }

  private pos(tile: TileIdx, lift = 0): Vector3 {
    const v = this.r.tilePos(tile);
    v.y += lift;
    return v;
  }

  private handle(ev: SimEvent, state: GameState, speed: number): Promise<void> | null {
    const r = this.r;
    const fx = r.fx;
    switch (ev.type) {
      case 'unitMoved':
        return this.move(ev.unitId, ev.player, ev.path, state, speed);
      case 'unitCreated': {
        const u = state.units[ev.unitId];
        if (!u) return null;
        const v = r.units.ensure(state, u);
        v.tile = ev.tile;
        r.units.standPos(state, ev.tile, u.id, v.root.position);
        v.visible = r.units.isVisible(state, u);
        if (!this.vis(state, ev.tile)) return null;
        const team = teamColors(playerById(state, ev.player));
        return this.chain(u.id, async () => {
          v.busy++;
          fx.burst(v.root.position.clone().setY(v.root.position.y + 0.05), { count: 14, color: DUST, additive: false, speed: 0.7, up: 0.35, life: 0.7, size: 0.18, grow: 1.5, spread: 1.2, drag: 4 });
          void fx.ring(v.root.position.clone().setY(v.root.position.y + 0.03), team.a, 0.7, 0.6);
          await fx.tween(0.45 * speed, (t) => {
            const s = UNIT_SCALE * backOut(t);
            v.body.scale.set(s, s, s);
          });
          v.busy--;
        });
      }
      case 'unitDied': {
        const v = r.units.views.get(ev.unitId);
        if (!v) return null;
        if (!this.vis(state, ev.tile) || !v.root.visible) {
          r.units.remove(ev.unitId);
          return null;
        }
        return this.chain(ev.unitId, async () => {
          v.dying = true;
          v.busy++;
          const p = v.root.position.clone();
          fx.burst(p.clone().setY(p.y + 0.15), { count: 22, color: EMBER, color2: GOLD, speed: 0.6, up: 1.1, life: 1.0, size: 0.07, star: true, gravity: -0.2 });
          fx.burst(p.clone().setY(p.y + 0.1), { count: 10, color: SMOKE, additive: false, speed: 0.3, up: 0.6, life: 1.2, size: 0.25, grow: 2 });
          const y0 = v.body.position.y;
          await fx.tween(0.9 * speed, (t) => {
            v.u.uDissolve.value = t * 1.05;
            v.body.position.y = y0 - t * 0.06;
          });
          r.units.remove(ev.unitId);
        });
      }
      case 'combat':
        return this.combat(ev, state, speed);
      case 'unitPromoted':
      case 'unitLevelUp': {
        const v = r.units.views.get(ev.unitId);
        const u = state.units[ev.unitId];
        if (!v || !u || !this.vis(state, u.tile)) return null;
        return this.chain(ev.unitId, async () => {
          const p = v.root.position.clone();
          void fx.ring(p.clone().setY(p.y + 0.04), GOLD, 0.6, 0.7);
          fx.burst(p.clone().setY(p.y + 0.1), { count: 26, color: GOLD, color2: WHITE, speed: 0.35, up: 1.3, life: 1.1, size: 0.08, star: true, radius: 0.25, drag: 1 });
          if (u.owner === HUMAN) r.overlay.pop({ kind: 'label', text: ev.type === 'unitLevelUp' ? 'Level up' : 'Promoted', icon: 'promote', color: '#ffd36b', x: p.x, y: p.y + v.height + 0.35, z: p.z, life: 1.4 });
          await fx.wait(0.55 * speed);
        });
      }
      case 'unitUpgraded': {
        const v = r.units.views.get(ev.unitId);
        const u = state.units[ev.unitId];
        if (!v || !u) return null;
        if (!this.vis(state, u.tile)) {
          r.units.refreshModel(state, v, u);
          return null;
        }
        return this.chain(ev.unitId, async () => {
          const p = v.root.position.clone();
          void fx.beam(p, '#8fe8ff', 0.3, 1.6, 1.1);
          await fx.wait(0.25 * speed);
          r.units.refreshModel(state, v, u);
          fx.burst(p.clone().setY(p.y + 0.2), { count: 24, color: '#8fe8ff', color2: WHITE, speed: 0.6, up: 0.8, life: 0.9, size: 0.07, star: true });
          await fx.wait(0.5 * speed);
        });
      }
      case 'cityFounded': {
        const drop = this.drops.get(ev.tile);
        if (drop) return drop.then(() => this.founded(ev, state, speed) ?? undefined);
        return this.founded(ev, state, speed);
      }
      case 'podLanded': {
        if (!this.vis(state, ev.tile)) return null;
        r.holdCity(state, ev.tile, true);
        const team = teamColors(playerById(state, ev.player));
        const p = (async () => {
          if (ev.player === HUMAN) {
            r.focusTile(ev.tile, { animate: true });
            await fx.wait(0.35);
          }
          await r.pods.land(this.pos(ev.tile), team, speed, (a) => r.rig.shake(ev.player === HUMAN ? a : a * 0.5));
          r.holdCity(state, ev.tile, false);
        })();
        this.drops.set(ev.tile, p);
        return p;
      }
      case 'colonistsThawed': {
        const c = state.cities[ev.cityId];
        r.refreshProps(state);
        r.refreshOverlay(state);
        if (!c || !this.vis(state, c.tile)) return null;
        const p = this.pos(c.tile);
        void fx.beam(p, CRYO, 0.5, 2.6, 1.6 * speed);
        void fx.ring(p.clone().setY(p.y + 0.05), CRYO, 1.3, 1.0);
        fx.burst(p.clone().setY(p.y + 0.08), { count: 44, color: CRYO, color2: FROST, speed: 0.22, up: 1.3, life: 1.7, size: 0.07, star: true, radius: 0.5, gravity: -0.35, drag: 0.8 });
        fx.burst(p.clone().setY(p.y + 0.05), { count: 14, color: FROST, additive: false, speed: 0.5, up: 0.25, spread: 1.6, life: 1.2, size: 0.26, grow: 1.6, drag: 2.5, radius: 0.3 });
        if (ev.player === HUMAN) r.overlay.pop({ kind: 'label', text: `+${ev.pop}`, icon: 'thaw', color: '#5fd4e8', x: p.x, y: p.y + 0.9, z: p.z, life: 1.6 });
        return fx.wait((ev.player === HUMAN ? 1.1 : 0.5) * speed);
      }
      case 'stormSpawned':
        this.background.push(r.storms.spawn(ev.storm));
        return fx.wait(0.2);
      case 'stormMoved': {
        // storms roll together: the next event starts right away, the batch waits for arrival
        this.background.push(r.storms.move(state, ev.id, ev.from, ev.to));
        return fx.wait(0.12);
      }
      case 'stormEnded':
        return r.storms.end(ev.id);
      case 'stormDamage': {
        if (!this.vis(state, ev.tile)) return null;
        const hit = async () => {
          const v = ev.unitId !== undefined ? r.units.views.get(ev.unitId) : undefined;
          const p = v ? v.root.position.clone() : this.pos(ev.tile);
          const h = v ? v.height : ev.cityId !== undefined ? 0.6 : 0.3;
          fx.burst(p.clone().setY(p.y + h * 0.5), { count: 18, color: STORM_DUST, color2: DUST, additive: false, speed: 1.4, up: 0.25, spread: 2.4, drag: 2.5, life: 0.9, size: 0.24, grow: 1.8, radius: 0.2 });
          if (v) {
            void fx.tween(0.45, (t) => {
              v.u.uFlash.value = (1 - t) * 1.4;
              v.body.position.x = Math.sin(t * 36) * 0.025 * (1 - t);
            });
          }
          r.overlay.pop({ kind: 'damage', text: `-${Math.round(ev.amount)}`, icon: 'storm', color: '#ffa05a', x: p.x, y: p.y + h + 0.3, z: p.z, life: 1.3 });
          if (ev.player === HUMAN) r.rig.shake(0.035);
          await fx.wait(0.35 * speed);
        };
        const settle = r.storms.settled();
        return ev.unitId !== undefined ? this.chain(ev.unitId, () => settle.then(hit)) : settle.then(hit);
      }
      case 'cityCaptured': {
        r.refreshProps(state);
        r.applyOwners(state, this.cityTiles(state, ev.cityId));
        r.refreshOverlay(state);
        if (!this.vis(state, ev.tile)) return null;
        const p = this.pos(ev.tile);
        const team = teamColors(playerById(state, ev.to));
        void fx.ring(p.clone().setY(p.y + 0.05), team.a, 1.8, 1.0);
        fx.burst(p.clone().setY(p.y + 0.4), { count: 36, color: team.a, color2: WHITE, speed: 1.1, up: 1.2, life: 1.2, size: 0.1, star: true, gravity: 1 });
        fx.burst(p.clone().setY(p.y + 0.2), { count: 16, color: SMOKE, additive: false, speed: 0.4, up: 0.8, life: 1.6, size: 0.35, grow: 2 });
        r.rig.shake(0.06);
        return fx.wait(1.0 * speed);
      }
      case 'cityRazed': {
        const visible = this.vis(state, ev.tile);
        const p = this.pos(ev.tile);
        r.refreshProps(state);
        r.applyOwners(state, null);
        r.refreshOverlay(state);
        if (!visible) return null;
        fx.burst(p.clone().setY(p.y + 0.2), { count: 50, color: EMBER, color2: '#ffd36b', speed: 0.9, up: 1.8, life: 1.3, size: 0.09, star: true, gravity: 0.4, radius: 0.5 });
        fx.burst(p.clone().setY(p.y + 0.3), { count: 30, color: SMOKE, additive: false, speed: 0.5, up: 1.0, life: 2.2, size: 0.45, grow: 2.5, radius: 0.5 });
        r.rig.shake(0.08);
        return fx.wait(1.2 * speed);
      }
      case 'cityGrew':
      case 'cityStarved': {
        const c = state.cities[ev.cityId];
        r.refreshProps(state);
        r.refreshOverlay(state);
        if (!c || !this.vis(state, c.tile)) return null;
        const p = this.pos(c.tile, 0.3);
        if (ev.type === 'cityGrew') fx.burst(p, { count: 18, color: LEAF, color2: WHITE, speed: 0.35, up: 1.0, life: 1.0, size: 0.08, star: true, radius: 0.4 });
        else fx.burst(p, { count: 12, color: SMOKE, additive: false, speed: 0.3, up: 0.5, life: 1.2, size: 0.3, grow: 1.5, radius: 0.4 });
        return null;
      }
      case 'borderGrew': {
        r.applyOwners(state, ev.tiles);
        const any = ev.tiles.some((t) => this.vis(state, t));
        if (!any) return null;
        for (const t of ev.tiles) {
          if (!this.vis(state, t)) continue;
          fx.burst(this.pos(t, 0.08), { count: 8, color: teamColors(playerById(state, ev.player)).a, color2: WHITE, speed: 0.2, up: 0.6, life: 0.9, size: 0.07, star: true, radius: 0.6 });
        }
        return ev.player === HUMAN ? fx.wait(0.45) : null;
      }
      case 'buildingBuilt':
      case 'wonderBuilt': {
        const c = state.cities[ev.cityId];
        r.refreshProps(state);
        r.refreshOverlay(state);
        if (!c || !this.vis(state, c.tile)) return null;
        const p = this.pos(c.tile);
        if (ev.type === 'buildingBuilt') {
          void fx.beam(p, '#ffe29a', 0.45, 2.4, 1.3 * speed);
          fx.burst(p.clone().setY(p.y + 0.3), { count: 26, color: GOLD, color2: WHITE, speed: 0.5, up: 1.2, life: 1.2, size: 0.08, star: true, radius: 0.4 });
          return fx.wait((ev.player === HUMAN ? 1.0 : 0.5) * speed);
        }
        return (async () => {
          if (ev.player === HUMAN) {
            r.focusTile(c.tile, { animate: true });
            await fx.wait(0.5);
          }
          const wp = (ev.type === 'wonderBuilt' ? this.findWonderPos(state, ev.cityId, ev.wonder) : null) ?? p;
          void fx.beam(wp, '#fff1c4', 0.8, 5, 2.4 * speed);
          void fx.beam(wp, '#ffd36b', 0.5, 7, 2.0 * speed);
          void fx.ring(wp.clone().setY(wp.y + 0.05), GOLD, 2.6, 1.4);
          void fx.ring(wp.clone().setY(wp.y + 0.05), WHITE, 1.8, 1.1);
          fx.burst(wp.clone().setY(wp.y + 0.4), { count: 90, color: GOLD, color2: WHITE, speed: 1.4, up: 2.2, life: 1.8, size: 0.1, star: true, gravity: 1.2, radius: 0.5 });
          r.rig.shake(0.07);
          await fx.wait(1.8 * speed);
        })();
      }
      case 'improvementBuilt':
      case 'improvementPillaged': {
        r.refreshProps(state);
        if (!this.vis(state, ev.tile)) return null;
        const p = this.pos(ev.tile, 0.05);
        if (ev.type === 'improvementBuilt') {
          fx.burst(p, { count: 22, color: DUST, additive: false, speed: 0.9, up: 0.5, life: 0.8, size: 0.2, grow: 1.8, spread: 1.4, drag: 3.5, radius: 0.35 });
          fx.burst(p.clone().setY(p.y + 0.15), { count: 16, color: LEAF, color2: GOLD, speed: 0.5, up: 1.1, life: 0.9, size: 0.07, star: true, radius: 0.4 });
          void fx.ring(p, GOLD, 0.9, 0.6);
          return fx.wait(0.55 * speed);
        }
        fx.burst(p, { count: 20, color: SMOKE, additive: false, speed: 0.4, up: 0.9, life: 1.6, size: 0.35, grow: 2, radius: 0.4 });
        fx.burst(p, { count: 24, color: EMBER, speed: 0.6, up: 1.2, life: 1.0, size: 0.06, star: true, radius: 0.4 });
        return fx.wait(0.6 * speed);
      }
      case 'techResearched': {
        if (ev.player !== HUMAN) return null;
        const cap = state.players[HUMAN]?.capitalId;
        const c = cap !== null && cap !== undefined ? state.cities[cap] : undefined;
        if (!c) return null;
        const p = this.pos(c.tile, 1.2);
        r.overlay.pop({ kind: 'glyph', text: '', icon: ev.tech, color: '#6fc3ff', x: p.x, y: p.y, z: p.z, life: 1.8 });
        fx.burst(p.clone().setY(p.y - 0.4), { count: 30, color: SCI, color2: WHITE, speed: 0.6, up: 1.2, life: 1.2, size: 0.08, star: true, radius: 0.3 });
        return null;
      }
      case 'tilesRevealed': {
        if (ev.player !== HUMAN || !ev.tiles.length || !r.tiles) return null;
        const map = state.map;
        // ripple outward from the closest human unit to the revealed set
        let origin = ev.tiles[0];
        let best = Infinity;
        for (const u of Object.values(state.units)) {
          if (u.owner !== HUMAN) continue;
          const d = hexDistance(map, u.tile, ev.tiles[0]);
          if (d < best) {
            best = d;
            origin = u.tile;
          }
        }
        r.tiles.reveal(ev.tiles, ev.tiles.map((t) => Math.max(0, hexDistance(map, origin, t) - 1) * 0.09));
        r.applyOwners(state, null);
        r.refreshProps(state);
        r.refreshOverlay(state);
        return null;
      }
      case 'naturalWonderFound': {
        if (ev.player !== HUMAN) return null;
        const p = this.pos(ev.tile, 0.3);
        void fx.ring(p, '#bfe8ff', 1.6, 1.2);
        fx.burst(p, { count: 50, color: '#bfe8ff', color2: GOLD, speed: 0.8, up: 1.6, life: 1.6, size: 0.1, star: true, radius: 0.5, gravity: 0.5 });
        return fx.wait(0.8);
      }
      case 'ruinExplored':
      case 'campCleared':
      case 'campSpawned': {
        r.refreshProps(state);
        if (!this.vis(state, ev.tile)) return null;
        const p = this.pos(ev.tile, 0.1);
        if (ev.type === 'ruinExplored') {
          void fx.beam(p, '#9ff3ff', 0.35, 2, 1.1);
          fx.burst(p, { count: 30, color: '#9ff3ff', color2: GOLD, speed: 0.6, up: 1.4, life: 1.2, size: 0.08, star: true });
        } else if (ev.type === 'campCleared') {
          fx.burst(p, { count: 24, color: SMOKE, additive: false, speed: 0.5, up: 0.9, life: 1.6, size: 0.35, grow: 2 });
          fx.burst(p.clone().setY(p.y + 0.2), { count: 30, color: GOLD, color2: '#fff3b0', speed: 0.8, up: 1.6, life: 1.1, size: 0.08, star: true, gravity: 2 });
        } else {
          fx.burst(p, { count: 16, color: DUST, additive: false, speed: 0.7, up: 0.4, life: 0.9, size: 0.2, grow: 1.5 });
        }
        return fx.wait(0.6 * speed);
      }
      case 'eraStarted':
        r.setEra(Math.min(5, ev.era), false);
        r.refreshProps(state);
        return null;
      case 'doctrineTriggered':
      case 'renownGained': {
        if (ev.tile === undefined || !this.vis(state, ev.tile)) return null;
        const p = this.pos(ev.tile, 0.4);
        fx.burst(p, { count: 14, color: ev.type === 'renownGained' ? '#4fb3ff' : GOLD, color2: WHITE, speed: 0.35, up: 0.9, life: 0.9, size: 0.07, star: true, radius: 0.3 });
        return null;
      }
      default:
        // turnStart/turnEnd, gold/happiness, war/peace, elimination, cryo/research offers, roguelite bookkeeping,
        // notify: UI-only
        return null;
    }
  }

  /** a colony appears: the hab unfolds in a dust ring (after its drop pod touched down, if any) */
  private founded(ev: Extract<SimEvent, { type: 'cityFounded' }>, state: GameState, speed: number): Promise<void> | null {
    const r = this.r;
    const fx = r.fx;
    const visible = this.vis(state, ev.tile);
    r.refreshProps(state);
    r.applyOwners(state, visible ? this.cityTiles(state, ev.cityId) : null);
    r.refreshOverlay(state);
    // a Hab Crawler is consumed
    for (const v of [...r.units.views.values()]) if (v.tile === ev.tile && !state.units[v.id] && !v.dying) this.consume(v);
    if (!visible) return null;
    const p = this.pos(ev.tile);
    const team = teamColors(playerById(state, ev.player));
    void fx.ring(p.clone().setY(p.y + 0.05), team.a, 1.6, 1.0, 1);
    void fx.ring(p.clone().setY(p.y + 0.05), GOLD, 1.1, 0.8, 1);
    fx.burst(p.clone().setY(p.y + 0.05), { count: 40, color: DUST, additive: false, speed: 1.3, up: 0.3, life: 1.1, size: 0.22, grow: 2, spread: 1.6, drag: 3.5, radius: 0.3 });
    fx.burst(p.clone().setY(p.y + 0.3), { count: 40, color: GOLD, color2: WHITE, speed: 1.0, up: 1.6, life: 1.4, size: 0.09, star: true, gravity: 1.2, drag: 1.2 });
    r.rig.shake(0.05);
    return fx.wait(1.1 * speed);
  }

  private consume(v: UnitView): void {
    v.dying = true;
    const fx = this.r.fx;
    const p = v.root.position.clone();
    fx.burst(p.clone().setY(p.y + 0.15), { count: 16, color: WHITE, color2: GOLD, speed: 0.5, up: 1, life: 0.8, size: 0.08, star: true });
    void fx.tween(0.35, (t) => {
      const s = UNIT_SCALE * (1 - t);
      v.body.scale.set(s, s * (1 + t * 0.5), s);
    }).then(() => this.r.units.remove(v.id));
  }

  private cityTiles(state: GameState, cityId: number): TileIdx[] {
    return state.map.tiles.filter((t) => t.cityId === cityId).map((t) => t.idx);
  }

  /** where the wonder model stands (the tile planCities reserved for it), else the city center */
  private findWonderPos(state: GameState, cityId: number, wonder: string): Vector3 | null {
    const key = WONDERS[wonder]?.model ?? `w_${wonder}`;
    for (const [tile, k] of planCities(state).wonderTiles) {
      if (k === key && state.map.tiles[tile].cityId === cityId) return this.pos(tile);
    }
    return null;
  }

  private move(unitId: number, player: PlayerId, path: TileIdx[], state: GameState, speed: number): Promise<void> | null {
    const r = this.r;
    const u = state.units[unitId];
    let v = r.units.views.get(unitId);
    if (!v) {
      if (!u) return null;
      v = r.units.ensure(state, u);
    }
    const view = v;
    const steps = path.length && path[0] === view.tile ? path.slice(1) : path.slice();
    if (!steps.length) return null;
    const seen = player === HUMAN || this.r.reveal || path.some((t) => this.vis(state, t));
    if (!seen) {
      view.tile = steps[steps.length - 1];
      r.units.standPos(state, view.tile, unitId, view.root.position);
      view.visible = u ? r.units.isVisible(state, u) : false;
      return null;
    }
    return this.chain(unitId, async () => {
      view.busy++;
      const from = new Vector3();
      const to = new Vector3();
      for (const tile of steps) {
        if (this.cancelled) break;
        from.copy(view.root.position);
        r.units.standPos(state, tile, unitId, to);
        r.units.faceToward(view, to.x, to.z);
        const stepVisible = player === HUMAN || this.vis(state, tile) || this.vis(state, view.tile);
        view.visible = stepVisible;
        const dist = from.distanceTo(to);
        const dur = (0.2 + dist * 0.05) * speed;
        let swapped = false;
        await r.fx.tween(dur, (t) => {
          const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
          view.root.position.lerpVectors(from, to, e);
          view.root.position.y += Math.sin(t * Math.PI) * (0.1 + dist * 0.03);
          const sq = t > 0.85 ? 1 - (t - 0.85) * 1.2 : 1 + Math.sin(t * Math.PI) * 0.06;
          view.body.scale.set(UNIT_SCALE, UNIT_SCALE * sq, UNIT_SCALE);
          if (!swapped && t > 0.5 && u) {
            swapped = true;
            const prevTile = u.tile;
            // embark/disembark swap uses the destination tile
            u.tile = tile;
            r.units.refreshModel(state, view, u);
            u.tile = prevTile;
          }
        });
        view.tile = tile;
        view.body.scale.set(UNIT_SCALE, UNIT_SCALE, UNIT_SCALE);
        if (stepVisible && speed >= 1) r.fx.burst(to.clone().setY(to.y + 0.02), { count: 5, color: DUST, additive: false, speed: 0.35, up: 0.15, life: 0.45, size: 0.12, grow: 1.4, spread: 1.4, drag: 4 });
      }
      if (u) view.visible = r.units.isVisible(state, u);
      view.busy--;
    });
  }

  private combat(ev: Extract<SimEvent, { type: 'combat' }>, state: GameState, speed: number): Promise<void> | null {
    const r = this.r;
    const fx = r.fx;
    const a = ev.attacker;
    const d = ev.defender;
    if (!this.vis(state, a.tile) && !this.vis(state, d.tile)) return null;
    const av = a.unitId !== undefined ? r.units.views.get(a.unitId) : undefined;
    const dv = d.unitId !== undefined ? r.units.views.get(d.unitId) : undefined;
    const aPos = av ? av.root.position.clone() : this.pos(a.tile);
    const dPos = dv ? dv.root.position.clone() : this.pos(d.tile);
    const involvesHuman = a.player === HUMAN || d.player === HUMAN;
    const siege = /catapult|trebuchet|cannon|artillery|field_gun|rocket/.test(av?.type ?? '');
    const impact = () => {
      const hit = dPos.clone();
      hit.y += dv ? dv.height * 0.5 : 0.35;
      fx.burst(hit, { count: siege ? 34 : 22, color: '#ffe1a0', color2: EMBER, speed: siege ? 1.4 : 1.0, up: 0.7, life: 0.55, size: 0.08, star: true, drag: 3 });
      fx.burst(dPos.clone().setY(dPos.y + 0.05), { count: siege ? 16 : 8, color: d.cityId !== undefined ? SMOKE : DUST, additive: false, speed: 0.7, up: 0.35, life: 0.8, size: 0.22, grow: 1.6, drag: 3 });
      r.rig.shake((involvesHuman ? 0.07 : 0.035) * (siege ? 1.4 : 1));
      if (dv) {
        void fx.tween(0.35, (t) => {
          dv.u.uFlash.value = (1 - t) * 1.6;
          dv.body.position.x = Math.sin(t * 40) * 0.02 * (1 - t);
        });
      }
      if (ev.dmgToDefender > 0) r.overlay.pop({ kind: 'damage', text: `-${Math.round(ev.dmgToDefender)}`, color: '#ff6a5a', x: dPos.x, y: dPos.y + 0.6, z: dPos.z, life: 1.2 });
      if (ev.dmgToAttacker > 0) r.overlay.pop({ kind: 'damage', text: `-${Math.round(ev.dmgToAttacker)}`, color: '#ffb06a', x: aPos.x, y: aPos.y + 0.6, z: aPos.z, life: 1.2 });
    };
    const run = async () => {
      if (av) {
        av.busy++;
        r.units.faceToward(av, dPos.x, dPos.z);
      }
      if (dv) r.units.faceToward(dv, aPos.x, aPos.z);
      await fx.wait(0.12 * speed);
      if (ev.ranged) {
        if (av) {
          await fx.tween(0.12 * speed, (t) => {
            av.body.position.z = -Math.sin(t * Math.PI) * 0.03;
          });
        }
        const from = aPos.clone().setY(aPos.y + (a.cityId !== undefined ? 0.7 : 0.35));
        const to = dPos.clone().setY(dPos.y + 0.25);
        await fx.projectile(from, to, siege ? '#ffb347' : a.cityId !== undefined ? '#ffe7a0' : '#fff4d0', (siege ? 0.6 : 0.42) * speed, siege ? 1.3 : 0.8);
        impact();
        await fx.wait(0.3 * speed);
      } else if (av) {
        const base = av.root.position.clone();
        let hit = false;
        await fx.tween(0.38 * speed, (t) => {
          const k = t < 0.45 ? easeIn(t / 0.45) : 1 - easeOut((t - 0.45) / 0.55);
          av.root.position.lerpVectors(base, dPos, k * 0.46);
          av.root.position.y = base.y + Math.sin(Math.min(1, t / 0.45) * Math.PI) * 0.05;
          if (!hit && t >= 0.45) {
            hit = true;
            impact();
          }
        });
        av.root.position.copy(base);
        await fx.wait(0.15 * speed);
      } else {
        impact();
        await fx.wait(0.3 * speed);
      }
      if (av) av.busy--;
    };
    // both combatants' queued animations (moves) must finish first
    const ids = [a.unitId, d.unitId].filter((x): x is number => x !== undefined);
    const prior = Promise.all(ids.map((id) => this.unitChains.get(id) ?? Promise.resolve()));
    const p = prior.then(run);
    for (const id of ids) this.unitChains.set(id, p);
    return p;
  }
}

function eventPlayer(ev: SimEvent): PlayerId | null {
  if ('player' in ev && typeof ev.player === 'number') return ev.player;
  if (ev.type === 'combat') return ev.attacker.player === HUMAN || ev.defender.player === HUMAN ? HUMAN : ev.attacker.player;
  if (ev.type === 'cityCaptured') return ev.to;
  return null;
}

function backOut(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}
function easeIn(t: number): number {
  return t * t * t;
}
function easeOut(t: number): number {
  return 1 - (1 - t) ** 3;
}
