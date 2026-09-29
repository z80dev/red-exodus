// The AEONS map renderer (implements game/bridge.ts `Renderer`). Owns the Three.js scene: terrain, water,
// rivers, cloud fog, instanced props & cities, units, fx, highlights, camera rig, lighting per era,
// post-processing and the DOM overlay model. Event animation lives in director.ts.
import {
  ACESFilmicToneMapping, AmbientLight, BufferAttribute, BufferGeometry, Color, DirectionalLight, DoubleSide, Fog, Group,
  HemisphereLight, Mesh, MeshStandardMaterial, PCFShadowMap, Scene, ShaderMaterial, SRGBColorSpace,
  Vector3, WebGLRenderer,
} from 'three';
import { UNITS } from '../content';
import type { Highlights, Renderer, RendererCallbacks } from '../game/bridge';
import { productionCost, turnsToComplete } from '../sim/cities';
import { moveCost } from '../sim/pathfinding';
import type { GameMap, GameState, SimEvent, TileIdx } from '../sim/types';
import { HUMAN } from '../sim/types';
import { maxMoves } from '../sim/units';
import { ModelLibrary } from './assets/models';
import { CameraRig, ZOOM_PRESETS } from './camera';
import { createClouds, setCloudDetail } from './clouds';
import { Director } from './director';
import { Fx } from './fx';
import { worldToTile } from '../sim/hex';
import { WATER_TERRAIN, colX, mapBounds, rowZ } from './hexgeo';
import type { BannerData, FlagData } from './overlayStore';
import { OverlayStore } from './overlayStore';
import { type EraLight, eraLight } from './palette';
import { PostPipeline } from './post';
import { PropLayer } from './props';
import { buildRiverMesh, buildRiverNetwork } from './rivers';
import { HI, MAX_OWNERS, U, patchModelMaterial } from './shaders';
import {
  type TerrainField, buildHeightTexture, buildTerrainField, buildTerrainMeshes, createTerrainMaterial, groundAt,
  STEP,
} from './terrain';
import { TileState } from './tileState';
import { UnitLayer } from './units';
import { createWater } from './water';
import { composeCities, composeNature, planCities, playerById } from './world';

export type Quality = 'low' | 'high';

export interface RendererStats {
  fps: number;
  frameMs: number;
  drawCalls: number;
  triangles: number;
}

const PROJECT_ICON: Record<string, string> = { wealth: 'gold', research: 'sci', festival: 'cul' };

export class AeonsRenderer implements Renderer {
  readonly gl: WebGLRenderer;
  readonly scene = new Scene();
  readonly rig: CameraRig;
  readonly lib = new ModelLibrary();
  readonly fx = new Fx();
  readonly overlay = new OverlayStore();
  readonly units: UnitLayer;
  readonly world = new Group();
  readonly stats: RendererStats = { fps: 0, frameMs: 0, drawCalls: 0, triangles: 0 };
  state: GameState | null = null;
  field: TerrainField | null = null;
  tiles: TileState | null = null;
  reveal = false;
  quality: Quality = 'high';
  private canvas: HTMLCanvasElement;
  private cb: RendererCallbacks;
  private sun = new DirectionalLight(0xffffff, 3);
  private hemi = new HemisphereLight(0xffffff, 0x444444, 1.2);
  private ambient = new AmbientLight(0xffffff, 0.12);
  private fog = new Fog(0xdddddd, 20, 60);
  private post = new PostPipeline();
  private modelMat: MeshStandardMaterial;
  private swayMat: MeshStandardMaterial;
  private terrainMat: MeshStandardMaterial;
  private nature: PropLayer;
  private cities: PropLayer;
  private mapRef: GameMap | null = null;
  private natureSig = '';
  private citySig = '';
  private terrainGroup: Group | null = null;
  private water: Mesh | null = null;
  private clouds: Group | null = null;
  private rivers: Mesh | null = null;
  private pathMesh: Mesh | null = null;
  private pathMat: ShaderMaterial;
  private highlights: Highlights | null = null;
  private markers: { tile: TileIdx; text: string }[] = [];
  private era = 0;
  private light: EraLight = eraLight(0);
  private lightT = 1;
  private lightFrom: EraLight = eraLight(0);
  private raf = 0;
  private last = 0;
  private time = 0;
  private frames = 0;
  private fpsT = 0;
  private disposed = false;
  private width = 1;
  private height = 1;
  private readonly director: Director;
  private unsubLib: () => void;
  private libDirty = false;
  private overlayScale = 1;

  constructor(canvas: HTMLCanvasElement, cb: RendererCallbacks, quality: Quality = 'high') {
    this.canvas = canvas;
    this.cb = cb;
    this.gl = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: false });
    this.gl.outputColorSpace = SRGBColorSpace;
    this.gl.toneMapping = ACESFilmicToneMapping;
    this.gl.toneMappingExposure = 1;
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = PCFShadowMap;
    this.gl.info.autoReset = false;
    this.rig = new CameraRig({
      pick: (x, y) => this.pick(x, y),
      onTap: (i) => this.cb.onTileTap(i),
      onLongPress: (i) => this.cb.onTileLongPress(i),
      onHover: (i) => this.cb.onTileHover?.(i),
    });
    this.rig.attach(canvas);
    this.overlay.onTap = (tile) => this.cb.onTileTap(tile);
    this.modelMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0 });
    patchModelMaterial(this.modelMat, {});
    this.swayMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 });
    patchModelMaterial(this.swayMat, { sway: true });
    this.terrainMat = createTerrainMaterial();
    this.nature = new PropLayer('nature', this.lib, this.modelMat, this.swayMat);
    this.cities = new PropLayer('cities', this.lib, this.modelMat, this.swayMat);
    this.units = new UnitLayer(this.lib);
    this.pathMat = new ShaderMaterial({
      vertexShader: 'attribute float aAlong; varying float vA; varying float vS; attribute float aSide; void main(){ vA = aAlong; vS = aSide; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform float uTime; varying float vA; varying float vS;
        void main(){
          float dash = step(0.45, fract(vA * 2.6 - uTime * 1.4));
          float edge = 1.0 - smoothstep(0.55, 1.0, abs(vS));
          vec3 c = mix(vec3(1.0, 0.92, 0.6), vec3(1.0), 0.3);
          gl_FragColor = vec4(c * 1.4, (0.35 + 0.65 * dash) * edge);
          #include <colorspace_fragment>
        }`,
      uniforms: { uTime: U.uTime },
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
    });
    this.scene.add(this.world, this.units.group, this.fx.group);
    this.scene.add(this.sun, this.sun.target, this.hemi, this.ambient);
    this.scene.fog = this.fog;
    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.02;
    this.sun.shadow.radius = 2.5;
    this.world.add(this.nature.group, this.cities.group);
    this.director = new Director(this);
    this.unsubLib = this.lib.onLoaded(() => {
      this.libDirty = true;
    });
    this.setQuality(quality);
    this.applyLight(eraLight(0));
    this.resize();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  // ───────────────────────── Renderer interface ─────────────────────────

  sync(state: GameState): void {
    if (this.director.active) {
      this.director.pendingSync = state;
      return;
    }
    this.applySync(state);
  }

  play(events: SimEvent[], state: GameState): Promise<void> {
    return this.director.enqueue(events, state);
  }

  setHighlights(h: Highlights): void {
    this.highlights = h;
    this.applyHighlights();
  }

  focusTile(idx: TileIdx, opts?: { animate?: boolean; zoom?: 'near' | 'mid' | 'far' }): void {
    const map = this.state?.map;
    if (!map || idx < 0 || idx >= map.tiles.length) return;
    const t = map.tiles[idx];
    // aim slightly "above" the tile so the HUD bottom sheet does not cover it on portrait
    const zOff = this.height > this.width ? 0.6 : 0.2;
    this.rig.focus(colX(t.col, t.row), rowZ(t.row) + zOff, opts?.zoom ? ZOOM_PRESETS[opts.zoom] * this.rig.aspectK : null, opts?.animate ?? true);
  }

  screenPos(idx: TileIdx): { x: number; y: number } | null {
    const map = this.state?.map;
    if (!map || !this.field || idx < 0 || idx >= map.tiles.length) return null;
    const t = map.tiles[idx];
    const x = colX(t.col, t.row);
    const z = rowZ(t.row);
    return this.project(new Vector3(x, Math.max(groundAt(this.field, x, z), 0) + 0.3, z));
  }

  setQuality(q: Quality): void {
    this.quality = q;
    const dpr = Math.min(window.devicePixelRatio || 1, q === 'high' ? 2 : 1.5);
    this.gl.setPixelRatio(dpr);
    const shadows = q === 'high';
    this.gl.shadowMap.enabled = shadows;
    this.sun.castShadow = shadows;
    const size = 2048;
    if (this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    this.nature.setShadows(shadows);
    this.cities.setShadows(shadows);
    this.units.setShadows(shadows);
    this.applyQualityDefines();
    this.resize();
  }

  /** shader simplifications for battery saver; materials recompile when shadow/quality defines flip */
  private applyQualityDefines(): void {
    const low = this.quality === 'low';
    const mats: MeshStandardMaterial[] = [this.modelMat, this.swayMat, this.terrainMat];
    if (this.water) mats.push(this.water.material as MeshStandardMaterial);
    for (const m of mats) {
      const d = { ...(m.defines ?? {}) };
      if (low) d.AE_LOW = '';
      else delete d.AE_LOW;
      m.defines = d;
      m.needsUpdate = true;
    }
    if (this.clouds) setCloudDetail(this.clouds, low);
  }

  /** profile `fastAnimations` */
  setFastAnimations(fast: boolean): void {
    this.director.baseSpeed = fast ? 1.8 : 1;
    if (!this.director.active) this.director.timeScale = this.director.baseSpeed;
  }

  setAttractMode(on: boolean): void {
    this.rig.attract = on;
    this.reveal = on;
    this.units.reveal = on;
    this.canvas.parentElement?.classList.toggle('ae-stage--attract', on);
    if (on && this.state) {
      const b = mapBounds(this.state.map);
      this.rig.focus((b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2 + 1.5, Math.min(this.rig.maxDist * 0.7, 18 * this.rig.aspectK), false);
      this.natureSig = '';
      this.citySig = '';
      this.applySync(this.state);
    } else if (this.state) {
      this.natureSig = '';
      this.citySig = '';
      this.applySync(this.state);
    }
  }

  resize(): void {
    const parent = this.canvas.parentElement;
    const w = Math.max(1, parent?.clientWidth ?? window.innerWidth);
    const h = Math.max(1, parent?.clientHeight ?? window.innerHeight);
    this.width = w;
    this.height = h;
    this.gl.setSize(w, h, false);
    this.rig.resize(w, h);
    const dpr = this.gl.getPixelRatio();
    this.post.setSize(Math.floor(w * dpr), Math.floor(h * dpr));
    this.fx.setPixelScale((h * dpr) / (2 * Math.tan((this.rig.camera.fov * Math.PI) / 360)));
    this.overlayScale = Math.min(1.15, Math.max(0.8, Math.min(w, h) / 420));
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.director.cancel();
    this.rig.detach();
    this.unsubLib();
    this.clearWorld();
    this.nature.dispose();
    this.cities.dispose();
    this.units.dispose();
    this.fx.clear();
    this.post.dispose();
    this.lib.dispose();
    this.tiles?.dispose();
    this.overlay.clear();
    this.gl.dispose();
  }

  // ───────────────────────── world building ─────────────────────────

  private clearWorld(): void {
    const disposeTree = (o: { traverse(fn: (x: unknown) => void): void } | null) => {
      o?.traverse((x) => {
        const m = x as Mesh;
        if (m.isMesh) {
          m.geometry.dispose();
          if (m.material !== this.terrainMat) (Array.isArray(m.material) ? m.material : [m.material]).forEach((mm) => mm.dispose());
        }
      });
    };
    for (const o of [this.terrainGroup, this.water, this.clouds, this.rivers, this.pathMesh]) {
      if (o) {
        this.world.remove(o);
        disposeTree(o);
      }
    }
    this.terrainGroup = this.water = this.clouds = this.rivers = this.pathMesh = null;
    U.uHeightTex.value?.dispose();
    U.uHeightTex.value = null;
  }

  private buildWorld(state: GameState): void {
    this.clearWorld();
    const map = state.map;
    this.mapRef = map;
    const rivers = buildRiverNetwork(map);
    const f = buildTerrainField(map, rivers);
    this.field = f;
    this.units.field = f;
    this.terrainGroup = buildTerrainMeshes(f, this.terrainMat);
    this.world.add(this.terrainGroup);
    U.uHeightTex.value = buildHeightTexture(f);
    U.uHeightRect.value.set(f.x0, f.z0, (f.nx - 1) * STEP, (f.nz - 1) * STEP);
    const b = mapBounds(map);
    const cx = (b.minX + b.maxX) / 2;
    const cz = (b.minZ + b.maxZ) / 2;
    const size = Math.max(b.maxX - b.minX, b.maxZ - b.minZ) + 160;
    this.water = createWater(cx, cz, size);
    this.world.add(this.water);
    this.rivers = buildRiverMesh(rivers, (x, z) => groundAt(f, x, z));
    if (this.rivers) this.world.add(this.rivers);
    this.clouds = createClouds(cx, cz, size);
    this.world.add(this.clouds);
    this.applyQualityDefines();
    this.tiles?.dispose();
    this.tiles = new TileState(map.width, map.height);
    U.uTileState.value = this.tiles.tex;
    U.uTileHi.value = this.tiles.hiTex;
    U.uMapSize.value.set(map.width, map.height);
    this.rig.bounds = { minX: b.minX + 1.5, maxX: b.maxX - 1.5, minZ: b.minZ + 0.5, maxZ: b.maxZ - 2 };
    this.rig.setZoomLimits(5.5, Math.min(34, Math.max(20, (b.maxX - b.minX) * 0.75)));
    this.natureSig = '';
    this.citySig = '';
    this.units.dispose();
    this.fx.clear();
    const start = map.starts?.[HUMAN] ?? Math.floor(map.tiles.length / 2);
    const st = map.tiles[start];
    if (st && !this.rig.attract) this.rig.focus(colX(st.col, st.row), rowZ(st.row) + 0.5, ZOOM_PRESETS.mid * this.rig.aspectK, false);
    // preload every model this map may need soon
    void this.lib.preload(this.lib.manifestKeys());
  }

  /** full reconcile (no animation) */
  applySync(state: GameState): void {
    const first = this.state === null || state.map !== this.mapRef;
    this.state = state;
    if (first) this.buildWorld(state);
    const tiles = this.tiles!;
    const human = state.players[HUMAN];
    const n = state.map.tiles.length;
    const vis = this.reveal || !human ? new Uint8Array(n).fill(2) : human.vis;
    tiles.setVis(vis, first);
    this.applyOwners(state, null);
    this.refreshProps(state);
    this.units.sync(state);
    this.refreshOverlay(state);
    const era = Math.min(5, Math.max(0, state.run?.era ?? 0));
    if (era !== this.era || first) this.setEra(era, first);
    this.applyHighlights();
  }

  applyOwners(state: GameState, grown: Iterable<number> | null): void {
    if (!this.tiles) return;
    const human = state.players[HUMAN];
    const slots = new Uint8Array(state.map.tiles.length);
    const colors = U.uOwnerColors.value;
    state.players.forEach((p, i) => {
      if (i + 1 < MAX_OWNERS) {
        const c = new Color(p.colors.primary);
        colors[i + 1].set(c.r, c.g, c.b);
      }
    });
    for (const t of state.map.tiles) {
      if (t.owner === null) continue;
      if (!this.reveal && human && human.vis[t.idx] === 0) continue;
      const i = state.players.findIndex((p) => p.id === t.owner);
      slots[t.idx] = i >= 0 && i + 1 < MAX_OWNERS ? i + 1 : 0;
    }
    this.tiles.setOwners(slots, grown ?? undefined);
  }

  refreshProps(state: GameState, force = false): void {
    if (!this.field) return;
    const human = state.players[HUMAN];
    let nsig = `${this.reveal ? 1 : 0}|${human?.techs.length ?? 0}|`;
    for (const t of state.map.tiles) {
      const e = this.reveal || (human?.vis[t.idx] ?? 0) > 0 ? 1 : 0;
      nsig += `${e}${t.feature ?? ''}${t.improvement ?? ''}${t.pillaged ? 'p' : ''}${t.resource ?? ''}${t.camp ? 'c' : ''}${t.ruin ? 'r' : ''}${t.owner ?? ''},`;
    }
    let csig = '';
    for (const c of Object.values(state.cities)) csig += `${c.id}:${c.owner}:${c.pop}:${c.buildings.join('.')}:${c.wonders.join('.')}:${c.tile}|`;
    for (const p of state.players) csig += `${p.techs.length},`;
    csig += state.run?.era ?? 0;
    const plan = planCities(state);
    const planSig = [...plan.reserved].join(',');
    nsig += planSig;
    if (force || nsig !== this.natureSig) {
      this.natureSig = nsig;
      composeNature(state, this.field, this.nature, plan, this.reveal);
    }
    if (force || csig + nsig !== this.citySig) {
      this.citySig = csig + nsig;
      composeCities(state, this.field, this.cities, plan, this.reveal);
    }
  }

  refreshOverlay(state: GameState): void {
    const human = state.players[HUMAN];
    const banners: BannerData[] = [];
    for (const c of Object.values(state.cities)) {
      const v = this.reveal ? 2 : (human?.vis[c.tile] ?? 0);
      if (v === 0) continue;
      const owner = playerById(state, c.owner);
      const item = c.queue[0];
      let progress = 0;
      let turns: number | null = null;
      let prodIcon: string | null = null;
      if (item) {
        prodIcon = item.kind === 'unit' ? (UNITS[item.id]?.class ?? 'melee') : item.kind === 'project' ? (PROJECT_ICON[item.id] ?? 'prod') : item.id;
        if (c.owner === HUMAN && item.kind !== 'project') {
          try {
            const cost = productionCost(state, c, item);
            progress = cost > 0 ? c.prodStored / cost : 0;
            turns = turnsToComplete(state, c, item);
            if (!Number.isFinite(turns) || turns > 99) turns = null;
          } catch {
            progress = 0;
          }
        }
      }
      banners.push({
        id: c.id, tile: c.tile, name: c.name, pop: c.pop, capital: c.isCapital,
        primary: owner?.colors.primary ?? '#7a1414', secondary: owner?.colors.secondary ?? '#e8d9a8',
        human: c.owner === HUMAN, prodIcon, progress, turns, hp: c.hp, maxHp: c.maxHp, ghost: v < 2,
      });
    }
    const flags: FlagData[] = [];
    for (const u of Object.values(state.units)) {
      if (!this.units.isVisible(state, u)) continue;
      const owner = playerById(state, u.owner);
      flags.push({
        id: u.id, tile: u.tile, icon: UNITS[u.type]?.class ?? 'melee', hp: u.hp,
        primary: owner?.colors.primary ?? '#7a1414', secondary: owner?.colors.secondary ?? '#e8d9a8',
        human: u.owner === HUMAN, promo: !!u.promotionChoices?.length && u.owner === HUMAN,
        fortified: u.order?.kind === 'fortify', level: u.level,
      });
    }
    this.overlay.setBannersFlags(banners, flags);
  }

  // ───────────────────────── highlights ─────────────────────────

  private applyHighlights(): void {
    const state = this.state;
    const tiles = this.tiles;
    if (!state || !tiles) return;
    const n = state.map.tiles.length;
    const codes = new Uint8Array(n);
    const h = this.highlights;
    if (h) {
      const put = (list: TileIdx[], code: number) => {
        for (const t of list) if (t >= 0 && t < n && codes[t] < code) codes[t] = code;
      };
      put(h.cityTiles, HI.city);
      put(h.move, HI.move);
      put(h.improve, HI.improve);
      put(h.target, HI.target);
      put(h.attack, HI.attack);
      if (h.selected !== null) put([h.selected], HI.selected);
    }
    tiles.setHighlights(codes);
    U.uGrid.value = h && h.selected !== null ? 0.32 : 0.16;
    this.buildPath(state, h);
  }

  private buildPath(state: GameState, h: Highlights | null): void {
    if (this.pathMesh) {
      this.world.remove(this.pathMesh);
      this.pathMesh.geometry.dispose();
      this.pathMesh = null;
    }
    this.markers = [];
    this.overlay.setMarkers([]);
    const f = this.field;
    if (!f || !h || h.path.length < 1 || (h.path.length < 2 && h.selected === null)) return;
    const map = state.map;
    // draw from the selected unit, whether or not the planned path includes its own tile
    const route = h.selected !== null && h.path[0] !== h.selected ? [h.selected, ...h.path] : h.path;
    if (route.length < 2) return;
    const pts = route.map((t) => {
      const tile = map.tiles[t];
      return new Vector3(colX(tile.col, tile.row), 0, rowZ(tile.row));
    });
    // smooth (Chaikin) and drape
    let curve = pts;
    for (let k = 0; k < 2; k++) {
      const next: Vector3[] = [curve[0]];
      for (let i = 0; i < curve.length - 1; i++) {
        next.push(curve[i].clone().lerp(curve[i + 1], 0.25), curve[i].clone().lerp(curve[i + 1], 0.75));
      }
      next.push(curve[curve.length - 1]);
      curve = next;
    }
    const dense: Vector3[] = [];
    for (let i = 0; i < curve.length - 1; i++) {
      const seg = Math.max(1, Math.ceil(curve[i].distanceTo(curve[i + 1]) / 0.12));
      for (let s = 0; s < seg; s++) dense.push(curve[i].clone().lerp(curve[i + 1], s / seg));
    }
    dense.push(curve[curve.length - 1]);
    const width = 0.085;
    const pos = new Float32Array(dense.length * 6);
    const along = new Float32Array(dense.length * 2);
    const side = new Float32Array(dense.length * 2);
    const idx: number[] = [];
    let acc = 0;
    for (let i = 0; i < dense.length; i++) {
      const p = dense[i];
      const a = dense[Math.max(0, i - 1)];
      const b = dense[Math.min(dense.length - 1, i + 1)];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const l = Math.hypot(dx, dz) || 1;
      const nx = -dz / l;
      const nz = dx / l;
      if (i > 0) acc += p.distanceTo(dense[i - 1]);
      const y = Math.max(groundAt(f, p.x, p.z), 0) + 0.07;
      pos.set([p.x + nx * width, y, p.z + nz * width, p.x - nx * width, y, p.z - nz * width], i * 6);
      along[i * 2] = along[i * 2 + 1] = acc;
      side[i * 2] = 1;
      side[i * 2 + 1] = -1;
      if (i < dense.length - 1) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    geo.setAttribute('aAlong', new BufferAttribute(along, 1));
    geo.setAttribute('aSide', new BufferAttribute(side, 1));
    geo.setIndex(idx);
    this.pathMesh = new Mesh(geo, this.pathMat);
    this.pathMesh.renderOrder = 15;
    this.world.add(this.pathMesh);
    // turn markers
    const unitTile = h.selected ?? h.path[0];
    const unit = Object.values(state.units).find((u) => u.tile === unitTile && u.owner === HUMAN);
    if (!unit) return;
    let full = 2;
    try {
      full = maxMoves(state, unit);
    } catch {
      full = UNITS[unit.type]?.moves ?? 2;
    }
    let left = unit.moves;
    let turn = 1;
    const path = h.path[0] === unit.tile ? h.path : [unit.tile, ...h.path];
    for (let i = 1; i < path.length; i++) {
      if (left <= 0) {
        this.markers.push({ tile: path[i - 1], text: String(turn) });
        turn++;
        left = full;
      }
      let cost = 1;
      try {
        cost = moveCost(state, unit, path[i - 1], path[i]);
      } catch {
        cost = 1;
      }
      left -= Number.isFinite(cost) ? cost : full;
    }
    if (turn > 1) this.markers.push({ tile: path[path.length - 1], text: String(turn) });
    this.overlay.setMarkers(this.markers.map((m, i) => ({ id: i, text: m.text })));
  }

  // ───────────────────────── lighting ─────────────────────────

  setEra(era: number, instant: boolean): void {
    this.era = era;
    this.lightFrom = { ...this.light };
    this.light = eraLight(era);
    this.lightT = instant ? 1 : 0;
    if (instant) this.applyLight(this.light);
  }

  private applyLight(l: EraLight): void {
    this.sun.color.set(l.sun);
    this.sun.intensity = l.sunIntensity;
    this.hemi.color.set(l.sky);
    this.hemi.groundColor.set(l.ground);
    this.hemi.intensity = l.hemiIntensity;
    this.ambient.intensity = 0.1;
    this.fog.color.set(l.haze);
    U.uHaze.value.set(l.haze);
    this.scene.background = this.fog.color;
    this.gl.toneMappingExposure = l.exposure;
    U.uSky.value.set(l.sky);
    U.uShallow.value.set(l.shallow);
    U.uDeep.value.set(l.deep);
    U.uCloud.value.set(l.cloud);
    U.uCloudShadow.value.set(l.cloudShadow);
    U.uFogVoid.value.set(l.cloudShadow).multiplyScalar(0.55);
    const el = (l.elevation * Math.PI) / 180;
    const az = (l.azimuth * Math.PI) / 180;
    U.uSunDir.value.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).normalize();
  }

  private blendLight(dt: number): void {
    if (this.lightT >= 1) return;
    this.lightT = Math.min(1, this.lightT + dt / 3);
    const t = this.lightT;
    const a = this.lightFrom;
    const b = this.light;
    const mixC = (x: string, y: string) => `#${new Color(x).lerp(new Color(y), t).getHexString()}`;
    const mixN = (x: number, y: number) => x + (y - x) * t;
    this.applyLight({
      sun: mixC(a.sun, b.sun), sunIntensity: mixN(a.sunIntensity, b.sunIntensity), elevation: mixN(a.elevation, b.elevation),
      azimuth: mixN(a.azimuth, b.azimuth), sky: mixC(a.sky, b.sky), ground: mixC(a.ground, b.ground),
      hemiIntensity: mixN(a.hemiIntensity, b.hemiIntensity), haze: mixC(a.haze, b.haze), exposure: mixN(a.exposure, b.exposure),
      shallow: mixC(a.shallow, b.shallow), deep: mixC(a.deep, b.deep), cloud: mixC(a.cloud, b.cloud), cloudShadow: mixC(a.cloudShadow, b.cloudShadow),
    });
  }

  // ───────────────────────── picking / projection ─────────────────────────

  pick(clientX: number, clientY: number): TileIdx {
    const state = this.state;
    const f = this.field;
    if (!state || !f) return -1;
    const r = this.canvas.getBoundingClientRect();
    const ndc = new Vector3(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1, 0.5);
    const cam = this.rig.camera;
    ndc.unproject(cam);
    const dir = ndc.sub(cam.position).normalize();
    if (dir.y >= -0.01) return -1;
    // march from y = 1.6 down to the terrain surface
    let t = (1.6 - cam.position.y) / dir.y;
    const p = new Vector3();
    let prevT = t;
    for (let i = 0; i < 400; i++) {
      p.copy(cam.position).addScaledVector(dir, t);
      const g = Math.max(groundAt(f, p.x, p.z), 0);
      if (p.y <= g) {
        // refine
        let lo = prevT;
        let hi = t;
        for (let k = 0; k < 8; k++) {
          const mid = (lo + hi) / 2;
          p.copy(cam.position).addScaledVector(dir, mid);
          if (p.y <= Math.max(groundAt(f, p.x, p.z), 0)) hi = mid;
          else lo = mid;
        }
        return worldToTile(state.map, p.x, p.z);
      }
      prevT = t;
      t += 0.06;
      if (p.y < -1) break;
    }
    return -1;
  }

  project(v: Vector3): { x: number; y: number } | null {
    const p = v.clone().project(this.rig.camera);
    if (p.z > 1 || p.x < -1.2 || p.x > 1.2 || p.y < -1.2 || p.y > 1.2) return null;
    return { x: ((p.x + 1) / 2) * this.width, y: ((1 - p.y) / 2) * this.height };
  }

  // ───────────────────────── frame loop ─────────────────────────

  private frame = (now: number): void => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.time += dt;
    U.uTime.value = this.time;
    const t0 = performance.now();
    if (this.libDirty && this.state) {
      this.libDirty = false;
      this.refreshProps(this.state, true);
      for (const v of this.units.views.values()) {
        const u = this.state.units[v.id];
        if (u) this.units.refreshModel(this.state, v, u);
      }
    }
    this.tiles?.update(dt);
    this.rig.update(dt);
    this.fx.update(dt * this.director.timeScale);
    this.units.update(dt, this.time, this.state);
    this.blendLight(dt);
    this.updateShadowCamera();
    this.updateFog();
    this.positionOverlay();
    this.gl.info.reset();
    if (this.state) {
      if (this.quality === 'high') this.post.render(this.gl, this.scene, this.rig.camera, (this.rig.attract ? 1.4 : 1) * (this.height > this.width ? 0.6 : 1));
      else this.gl.render(this.scene, this.rig.camera);
    }
    this.stats.drawCalls = this.gl.info.render.calls;
    this.stats.triangles = this.gl.info.render.triangles;
    this.frames++;
    this.fpsT += dt;
    this.stats.frameMs = this.stats.frameMs * 0.9 + (performance.now() - t0) * 0.1;
    if (this.fpsT >= 1) {
      this.stats.fps = Math.round(this.frames / this.fpsT);
      this.frames = 0;
      this.fpsT = 0;
    }
  };

  private updateShadowCamera(): void {
    if (!this.sun.castShadow) return;
    const tgt = this.rig.target;
    const sd = U.uSunDir.value;
    const half = Math.min(30, this.rig.dist * (this.height > this.width ? 0.75 : 0.95));
    this.sun.position.set(tgt.x + sd.x * 30, sd.y * 30, tgt.z + sd.z * 30);
    this.sun.target.position.set(tgt.x, 0, tgt.z);
    this.sun.target.updateMatrixWorld();
    const c = this.sun.shadow.camera;
    if (c.right !== half) {
      c.left = -half;
      c.right = half;
      c.top = half;
      c.bottom = -half;
      c.near = 1;
      c.far = 70;
      c.updateProjectionMatrix();
    }
  }

  private updateFog(): void {
    const d = this.rig.dist;
    this.fog.near = d * 1.35;
    this.fog.far = d * 4.2 + 12;
    U.uHazeRange.value.set(this.fog.near, this.fog.far);
  }

  private positionOverlay(): void {
    const state = this.state;
    const f = this.field;
    if (!state || !f) return;
    const els = this.overlay.elements;
    const cam = this.rig.camera;
    const v = new Vector3();
    const zoomScale = Math.min(1.1, Math.max(0.55, (13 * this.rig.aspectK) / this.rig.dist)) * this.overlayScale;
    const showFlags = this.rig.dist < 24 * this.rig.aspectK && !this.rig.attract;
    const place = (key: string, el: HTMLElement, visible: boolean, scale: number) => {
      if (!visible) {
        if (el.style.visibility !== 'hidden') el.style.visibility = 'hidden';
        return;
      }
      v.project(cam);
      if (v.z > 1 || v.x < -1.3 || v.x > 1.3 || v.y < -1.3 || v.y > 1.3) {
        if (el.style.visibility !== 'hidden') el.style.visibility = 'hidden';
        return;
      }
      const x = ((v.x + 1) / 2) * this.width;
      const y = ((1 - v.y) / 2) * this.height;
      const tr = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${scale.toFixed(3)})`;
      if (el.style.transform !== tr) el.style.transform = tr;
      if (el.style.visibility !== 'visible') el.style.visibility = 'visible';
      const z = String(Math.round(y) + (key.startsWith('c') ? 2000 : key.startsWith('p') ? 4000 : 0));
      if (el.style.zIndex !== z) el.style.zIndex = z;
    };
    for (const [key, el] of els) {
      const kind = key[0];
      const id = Number(key.slice(1));
      if (kind === 'c') {
        const c = state.cities[id];
        if (!c) {
          place(key, el, false, 1);
          continue;
        }
        const t = state.map.tiles[c.tile];
        const x = colX(t.col, t.row);
        const z = rowZ(t.row);
        v.set(x, groundAt(f, x, z) + 0.95, z);
        place(key, el, !this.rig.attract, zoomScale);
      } else if (kind === 'u') {
        const view = this.units.views.get(id);
        if (!view || view.dying || view.fade < 0.6) {
          place(key, el, false, 1);
          continue;
        }
        v.copy(view.root.position);
        v.y += view.height + 0.16;
        place(key, el, showFlags, zoomScale * 0.95);
      } else if (kind === 'p') {
        const p = this.overlay.getSnapshot().pops.find((x) => x.id === id);
        if (!p) continue;
        v.set(p.x, p.y, p.z);
        place(key, el, true, Math.max(0.8, zoomScale));
      } else if (kind === 'm') {
        const m = this.markers[id];
        if (!m) {
          place(key, el, false, 1);
          continue;
        }
        const t = state.map.tiles[m.tile];
        const x = colX(t.col, t.row);
        const z = rowZ(t.row);
        v.set(x, Math.max(groundAt(f, x, z), 0) + 0.12, z);
        place(key, el, true, zoomScale);
      }
    }
  }

  /** world position of a tile's surface (water tiles at sea level) */
  tilePos(idx: TileIdx, out = new Vector3()): Vector3 {
    const map = this.state!.map;
    const t = map.tiles[idx];
    const x = colX(t.col, t.row);
    const z = rowZ(t.row);
    const g = this.field ? groundAt(this.field, x, z) : 0;
    return out.set(x, WATER_TERRAIN[t.terrain] ? Math.max(0, g) : g, z);
  }
}
