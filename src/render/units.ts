// Unit visuals: one mesh per unit (baked model geometry + per-unit material for team colors, hit flash,
// dissolve), idle bob/breathing, smooth facing, hop movement, lunges, deaths, spawn pops.
import { Color, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { UNITS } from '../content';
import type { GameState, TileIdx, Unit } from '../sim/types';
import { HUMAN } from '../sim/types';
import type { ModelLibrary } from './assets/models';
import { WATER_TERRAIN, colX, rowZ } from './hexgeo';
import { type ModelUniforms, makeModelUniforms, patchModelMaterial } from './shaders';
import { type TerrainField, groundAt } from './terrain';
import { playerById, teamColors } from './world';

export const UNIT_SCALE = 1.45;

export interface UnitView {
  id: number;
  owner: number;
  type: string;
  key: string;
  tile: TileIdx;
  root: Group;
  body: Group;
  mesh: Mesh;
  mat: MeshStandardMaterial;
  u: ModelUniforms;
  facing: number;
  wantFacing: number;
  phase: number;
  /** animation lock: position driven by a tween */
  busy: number;
  visible: boolean;
  fade: number;
  dying: boolean;
  height: number;
}

export class UnitLayer {
  readonly group = new Group();
  readonly views = new Map<number, UnitView>();
  private lib: ModelLibrary;
  field: TerrainField | null = null;
  reveal = false;
  castShadow = true;

  constructor(lib: ModelLibrary) {
    this.lib = lib;
    this.group.name = 'units';
  }

  modelKey(state: GameState, u: Unit): string {
    const t = state.map.tiles[u.tile];
    const def = UNITS[u.type];
    if (t && WATER_TERRAIN[t.terrain] && def?.class !== 'naval') return 'u_boat';
    return def?.model ?? `u_${u.type}`;
  }

  /** world position a unit stands at on a tile (offset off city centers, stacked civilians) */
  standPos(state: GameState, tile: TileIdx, unitId: number, out: Vector3): Vector3 {
    const t = state.map.tiles[tile];
    let x = colX(t.col, t.row);
    let z = rowZ(t.row);
    const onCity = Object.values(state.cities).some((c) => c.tile === tile);
    if (onCity) z += 0.42;
    // two units sharing a tile (civilian + escort): spread them
    let rank = 0;
    let count = 0;
    for (const u of Object.values(state.units)) {
      if (u.tile !== tile) continue;
      if (u.id < unitId) rank++;
      count++;
    }
    if (count > 1) x += (rank - (count - 1) / 2) * 0.36;
    const y = this.field ? groundAt(this.field, x, z) : 0;
    const water = WATER_TERRAIN[t.terrain];
    return out.set(x, water ? Math.max(0, y) : y, z);
  }

  isVisible(state: GameState, u: Unit): boolean {
    if (this.reveal || u.owner === HUMAN) return true;
    return (state.players[HUMAN]?.vis[u.tile] ?? 0) >= 2;
  }

  private build(state: GameState, u: Unit): UnitView {
    const key = this.modelKey(state, u);
    const asset = this.lib.get(key);
    const mu = makeModelUniforms();
    const team = teamColors(playerById(state, u.owner));
    mu.uTeamA.value.copy(team.a);
    mu.uTeamB.value.copy(team.b);
    const mat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0 });
    patchModelMaterial(mat, { perObject: true }, mu);
    const mesh = new Mesh(asset.geometry, mat);
    mesh.castShadow = this.castShadow;
    mesh.receiveShadow = true;
    const body = new Group();
    body.add(mesh);
    body.scale.setScalar(UNIT_SCALE);
    const root = new Group();
    root.add(body);
    root.name = `unit-${u.id}`;
    this.group.add(root);
    const v: UnitView = {
      id: u.id, owner: u.owner, type: u.type, key, tile: u.tile, root, body, mesh, mat, u: mu,
      facing: 0, wantFacing: 0, phase: (u.id * 1.7) % (Math.PI * 2), busy: 0, visible: true, fade: 1, dying: false,
      height: asset.height * UNIT_SCALE,
    };
    // face roughly toward the camera-south at spawn, with a little per-unit variation
    v.facing = v.wantFacing = ((u.id % 5) - 2) * 0.25;
    this.standPos(state, u.tile, u.id, root.position);
    this.views.set(u.id, v);
    return v;
  }

  ensure(state: GameState, u: Unit): UnitView {
    return this.views.get(u.id) ?? this.build(state, u);
  }

  /** swap the model if type/embark changed */
  refreshModel(state: GameState, v: UnitView, u: Unit): void {
    const key = this.modelKey(state, u);
    v.type = u.type;
    const team = teamColors(playerById(state, u.owner));
    v.u.uTeamA.value.copy(team.a);
    v.u.uTeamB.value.copy(team.b);
    v.owner = u.owner;
    const asset = this.lib.get(key);
    if (key !== v.key || v.mesh.geometry !== asset.geometry) {
      v.key = key;
      v.mesh.geometry = asset.geometry;
      v.height = asset.height * UNIT_SCALE;
    }
  }

  remove(id: number): void {
    const v = this.views.get(id);
    if (!v) return;
    this.group.remove(v.root);
    v.mat.dispose();
    this.views.delete(id);
  }

  /** reconcile with state (no animation); views locked by tweens keep their positions */
  sync(state: GameState): void {
    const seen = new Set<number>();
    const pos = new Vector3();
    for (const u of Object.values(state.units)) {
      seen.add(u.id);
      const v = this.ensure(state, u);
      if (v.dying) continue;
      this.refreshModel(state, v, u);
      v.visible = this.isVisible(state, u);
      if (!v.busy) {
        v.tile = u.tile;
        this.standPos(state, u.tile, u.id, pos);
        v.root.position.copy(pos);
      }
    }
    for (const id of [...this.views.keys()]) if (!seen.has(id) && !this.views.get(id)!.dying) this.remove(id);
  }

  setShadows(on: boolean): void {
    this.castShadow = on;
    for (const v of this.views.values()) v.mesh.castShadow = on;
  }

  faceToward(v: UnitView, x: number, z: number): void {
    const dx = x - v.root.position.x;
    const dz = z - v.root.position.z;
    if (dx * dx + dz * dz < 1e-6) return;
    v.wantFacing = Math.atan2(dx, dz);
  }

  update(dt: number, time: number, state: GameState | null): void {
    for (const v of this.views.values()) {
      // fade in/out on visibility change (scale pop keeps it cheap)
      const target = v.visible ? 1 : 0;
      v.fade += (target - v.fade) * Math.min(1, dt * 10);
      if (Math.abs(target - v.fade) < 0.01) v.fade = target;
      v.root.visible = v.fade > 0.02;
      if (!v.root.visible) continue;
      let d = v.wantFacing - v.facing;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      v.facing += d * Math.min(1, dt * 12);
      v.body.rotation.y = v.facing;
      const unit = state?.units[v.id];
      const idle = !v.busy && !v.dying;
      const bob = idle ? Math.sin(time * 2.2 + v.phase) : 0;
      const boat = v.key === 'u_boat';
      v.body.position.y = idle ? (boat ? 0.012 * Math.sin(time * 1.6 + v.phase) : Math.max(0, bob) * 0.012) : v.body.position.y;
      if (boat && idle) v.body.rotation.z = Math.sin(time * 1.3 + v.phase) * 0.05;
      const breathe = idle ? 1 + Math.sin(time * 2.2 + v.phase + 1.2) * 0.018 : 1;
      const s = UNIT_SCALE * (0.6 + 0.4 * v.fade);
      if (!v.dying) v.body.scale.set(s, s * breathe, s);
      // fortified units sit lower and still
      if (unit?.order?.kind === 'fortify' && idle) v.body.position.y = -0.005;
    }
  }

  dispose(): void {
    for (const id of [...this.views.keys()]) this.remove(id);
  }
}

export const DAMAGE_COLOR = new Color('#ff5a4f');
