// Martian dust storms. Every storm cell (state.storms: eye = path[step], radius, power, great) renders as a
// towering, slowly churning wall of camera-facing dust puffs — ONE instanced draw call for all storms (puff
// positions live in storm-local polar coordinates; moving a storm only moves its uniform center). The ground
// under a storm darkens through the TileState storm channel (exact gameplay footprint, crossfaded per tile),
// power-3 and great storms flicker with lightning, and the truthful 2-turn forecast draws as dashed footprint
// outlines plus a travel arrow (one more draw). Event animation (spawn / move / end) is driven by the director.
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Color, DoubleSide, Group, InstancedBufferAttribute,
  InstancedBufferGeometry, Mesh, MeshBasicMaterial, PlaneGeometry, ShaderMaterial, Vector3, Vector4,
} from 'three';
import type { Camera } from 'three';
import { neighbor, tilesInRadius } from '../sim/hex';
import type { GameMap, GameState, StormCell, TileIdx } from '../sim/types';
import type { Fx } from './fx';
import { CORNER_VEC, colX, hash01, rowZ } from './hexgeo';
import { GLSL_NOISE } from './noise';
import { U } from './shaders';
import { H_MIN, type TerrainField, groundAt } from './terrain';
import type { TileState } from './tileState';

export const MAX_STORMS = 12;
const SQRT3 = Math.sqrt(3);
const FORECAST_NEAR = new Color('#f28c28');
const FORECAST_FAR = new Color('#f2b36b');
const ARROW = new Color('#ffcf8a');
const BOLT_SEGS = 9;

const PUFF_VERT = /* glsl */ `
attribute vec4 iA; // angle, radius fraction, height, size
attribute vec4 iB; // storm slot, kind (0 low haze, 1 rim wall, 2 mid churn), seed, height fraction
uniform vec4 uStormA[${MAX_STORMS}]; // eye x, eye z, world radius, presence
uniform vec4 uStormB[${MAX_STORMS}]; // power, great, lightning flash, -
uniform float uTime;
uniform sampler2D uHeightTex;
uniform vec4 uHeightRect;
varying vec2 vUv;
varying vec4 vInfo;
varying vec3 vStorm;
varying vec3 vWorld;
void main() {
  int s = int(iB.x + 0.5);
  vec4 A = uStormA[s];
  vec4 B = uStormB[s];
  float spin = (0.05 + 0.03 * B.x) * (1.2 - iA.y * 0.5);
  float ang = iA.x + uTime * spin;
  vec2 c = A.xy + vec2(cos(ang), sin(ang)) * iA.y * A.z;
  vec2 huv = clamp((c - uHeightRect.xy) / uHeightRect.zw, 0.0, 1.0);
  float g = max(texture2D(uHeightTex, huv).r + ${H_MIN.toFixed(3)}, 0.0);
  float churn = sin(uTime * (0.6 + iB.z) + iB.z * 40.0);
  float tall = 1.0 + 0.22 * (B.x - 1.0) + 0.45 * B.y;
  float grow = 0.35 + 0.65 * A.w;
  vec4 wp = vec4(c.x, g + iA.z * tall * grow + churn * 0.06, c.y, 1.0);
  float size = iA.w * (1.0 + 0.3 * B.y) * grow * (1.0 + 0.07 * churn);
  vec4 mv = viewMatrix * wp;
  mv.xy += position.xy * size;
  gl_Position = projectionMatrix * mv;
  vUv = position.xy * 2.0;
  vInfo = vec4(A.w, iB.w, iB.z, iB.y);
  vStorm = B.xyz;
  vWorld = wp.xyz;
}`;

const PUFF_FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uStormLit;
uniform vec3 uStormDark;
uniform vec3 uSunDir;
uniform vec3 uHaze;
uniform vec2 uHazeRange;
varying vec2 vUv;
varying vec4 vInfo;
varying vec3 vStorm;
varying vec3 vWorld;
${GLSL_NOISE}
void main() {
  float seed = vInfo.z;
  float roll = uTime * (0.12 + 0.06 * vStorm.x);
  // wind-sheared billows: noise stretched sideways so walls read as rolling dust, not cumulus
  vec2 q = vUv * vec2(1.0, 1.9);
  float n = aeNoise(q * 1.5 + vec2(seed * 17.0 - roll * 1.6, seed * 9.0 - roll * 0.4));
  float n2 = aeNoise(q * 3.9 + vec2(seed * 5.0 - roll * 2.4, seed * 3.0));
  float d = length(vUv) + (n - 0.5) * 0.6 + (n2 - 0.5) * 0.26;
  float a = (1.0 - smoothstep(0.4, 1.0, d)) * (1.0 - smoothstep(0.78, 1.0, max(abs(vUv.x), abs(vUv.y))));
  if (a < 0.01) discard;
  // fake volume: sphere-ish normal lit by the sun; taller puffs catch more light, bases sink into rust shadow
  vec3 nrm = normalize(vec3(vUv * 0.9, 0.7));
  vec3 L = normalize((viewMatrix * vec4(uSunDir, 0.0)).xyz);
  float lit = clamp(dot(nrm, L) * 0.55 + 0.45, 0.0, 1.0);
  lit = lit * (0.35 + 0.55 * vInfo.y) + (n - 0.5) * 0.35 + (n2 - 0.5) * 0.15;
  vec3 col = mix(uStormDark, uStormLit, clamp(lit, 0.0, 1.0));
  // rust mid-tones in the churn
  col = mix(col, col * vec3(1.08, 0.82, 0.66), smoothstep(0.35, 0.7, n) * 0.5);
  col *= 1.0 - 0.3 * vStorm.y;
  // lightning lights a few puffs from inside, not the whole wall
  float glowPuff = pow(fract(seed * 13.7 + floor(uTime * 3.0) * 0.618), 6.0);
  col += vec3(0.75, 0.82, 1.0) * vStorm.z * glowPuff * (1.0 - smoothstep(0.0, 0.9, d)) * 1.3;
  float dens = vInfo.w < 0.5 ? 0.16 : (vInfo.w < 1.5 ? 0.82 : 0.28);
  dens *= 0.8 + 0.1 * vStorm.x + 0.15 * vStorm.y;
  // thin out puffs right in front of the lens so zooming into a storm keeps the ground readable
  dens *= smoothstep(2.5, 6.5, distance(cameraPosition, vWorld));
  float haze = smoothstep(uHazeRange.x, uHazeRange.y, distance(cameraPosition, vWorld));
  col = mix(col, uHaze, haze * 0.7);
  gl_FragColor = vec4(col, clamp(a * dens * vInfo.x, 0.0, 1.0));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const LINE_VERT = /* glsl */ `
attribute float aAlong;
attribute float aSide;
attribute float aKind;
attribute vec4 aColor;
varying float vA;
varying float vS;
varying float vK;
varying vec4 vC;
void main() {
  vA = aAlong; vS = aSide; vK = aKind; vC = aColor;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const LINE_FRAG = /* glsl */ `
uniform float uTime;
varying float vA;
varying float vS;
varying float vK;
varying vec4 vC;
void main() {
  float edge = 1.0 - smoothstep(0.55, 1.0, abs(vS));
  float a = 1.0;
  if (vK < 0.5) a = step(0.45, fract(vA * 3.2 - uTime * 0.5));
  else if (vK < 1.5) a = 0.55 + 0.45 * step(0.5, fract(vA * 2.2 - uTime * 1.3));
  gl_FragColor = vec4(vC.rgb * 1.3, vC.a * a * edge);
  #include <colorspace_fragment>
}`;

interface StormView {
  /** display copy of the cell (step advances with move animations) */
  cell: StormCell;
  slot: number;
  x: number;
  z: number;
  /** eye tile whose footprint darkens the ground */
  coverEye: TileIdx;
  alpha: number;
  flash: number;
  boltIn: number;
  reflash: number;
  moving: number;
  ending: boolean;
}

interface Bolt {
  mesh: Mesh;
  mat: MeshBasicMaterial;
  life: number;
}

/** world radius of a storm's dust wall */
function worldRadius(c: StormCell): number {
  return c.radius * SQRT3 + 0.8;
}

export class StormLayer {
  readonly group = new Group();
  private fx: Fx;
  private map: GameMap | null = null;
  private field: TerrainField | null = null;
  private tiles: TileState | null = null;
  private views = new Map<number, StormView>();
  private puffGeo = new InstancedBufferGeometry();
  private puffs: Mesh;
  private puffCap = 0;
  private puffSig = '';
  private stormA = Array.from({ length: MAX_STORMS }, () => new Vector4());
  private stormB = Array.from({ length: MAX_STORMS }, () => new Vector4());
  private lineMat: ShaderMaterial;
  private forecast: Mesh | null = null;
  private bolts: Bolt[] = [];
  private moves = new Set<Promise<void>>();
  private low = false;
  private cover = new Float32Array(0);
  private bolt = new Float32Array(0);

  constructor(fx: Fx) {
    this.fx = fx;
    this.group.name = 'storms';
    const quad = new PlaneGeometry(1, 1);
    this.puffGeo.setIndex(quad.getIndex());
    this.puffGeo.setAttribute('position', quad.getAttribute('position'));
    const mat = new ShaderMaterial({
      vertexShader: PUFF_VERT,
      fragmentShader: PUFF_FRAG,
      uniforms: {
        uTime: U.uTime, uHeightTex: U.uHeightTex, uHeightRect: U.uHeightRect, uSunDir: U.uSunDir, uHaze: U.uHaze,
        uHazeRange: U.uHazeRange, uStormLit: U.uStormLit, uStormDark: U.uStormDark,
        uStormA: { value: this.stormA }, uStormB: { value: this.stormB },
      },
      transparent: true,
      depthWrite: false,
    });
    this.puffs = new Mesh(this.puffGeo, mat);
    this.puffs.frustumCulled = false;
    this.puffs.renderOrder = 16;
    this.puffs.visible = false;
    this.lineMat = new ShaderMaterial({
      vertexShader: LINE_VERT,
      fragmentShader: LINE_FRAG,
      uniforms: { uTime: U.uTime },
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
    });
    this.group.add(this.puffs);
    for (let i = 0; i < 3; i++) {
      const bm = new MeshBasicMaterial({ color: '#e6eeff', transparent: true, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, fog: false });
      const geo = new BufferGeometry();
      geo.setAttribute('position', new BufferAttribute(new Float32Array(BOLT_SEGS * 2 * 3 + 6), 3));
      const idx: number[] = [];
      for (let s = 0; s < BOLT_SEGS; s++) idx.push(s * 2, s * 2 + 1, s * 2 + 2, s * 2 + 1, s * 2 + 3, s * 2 + 2);
      geo.setIndex(idx);
      const mesh = new Mesh(geo, bm);
      mesh.frustumCulled = false;
      mesh.renderOrder = 17;
      mesh.visible = false;
      this.group.add(mesh);
      this.bolts.push({ mesh, mat: bm, life: 0 });
    }
  }

  /** new map: drop every storm */
  reset(map: GameMap, field: TerrainField, tiles: TileState): void {
    this.map = map;
    this.field = field;
    this.tiles = tiles;
    this.views.clear();
    this.moves.clear();
    this.cover = new Float32Array(map.tiles.length);
    this.bolt = new Float32Array(map.tiles.length);
    this.rebuild();
  }

  setQuality(low: boolean): void {
    if (low === this.low) return;
    this.low = low;
    this.puffSig = '';
    this.rebuildPuffs();
  }

  /** reconcile with state (no animation); storms mid-move keep their animated position */
  sync(state: GameState): void {
    if (!this.map) return;
    const seen = new Set<number>();
    for (const s of state.storms ?? []) {
      seen.add(s.id);
      const v = this.views.get(s.id) ?? this.create(s, 1);
      v.cell = copyCell(s);
      if (!v.moving) {
        this.eyePos(s.path[s.step] ?? s.path[s.path.length - 1], v);
        v.coverEye = v.cell.path[v.cell.step] ?? -1;
      }
      v.ending = false;
    }
    for (const [id, v] of this.views) if (!seen.has(id) && !v.moving) this.views.delete(id);
    this.rebuild();
  }

  /** a storm rolls in from the edge: fade/grow in */
  spawn(cell: StormCell): Promise<void> {
    if (!this.map) return Promise.resolve();
    const v = this.views.get(cell.id) ?? this.create(cell, 0);
    v.cell = copyCell(cell);
    v.coverEye = v.cell.path[v.cell.step] ?? -1;
    this.rebuild();
    const p = new Vector3(v.x, this.field ? Math.max(0, groundAt(this.field, v.x, v.z)) : 0, v.z);
    this.fx.burst(p.setY(p.y + 0.2), { count: 30, color: U.uStormLit.value, color2: U.uStormDark.value, additive: false, speed: 1.6, up: 0.6, spread: 2, drag: 1.5, life: 1.6, size: 0.6, grow: 2.2, radius: worldRadius(cell) * 0.5 });
    const from = v.alpha;
    return this.fx.tween(1.3, (t) => {
      v.alpha = from + (1 - from) * t * t * (3 - 2 * t);
    });
  }

  /** the eye advances one step along its rolled path */
  move(state: GameState, id: number, from: TileIdx, to: TileIdx): Promise<void> {
    if (!this.map) return Promise.resolve();
    let v = this.views.get(id);
    if (!v) {
      const cell = state.storms.find((s) => s.id === id);
      if (!cell) return Promise.resolve();
      v = this.create(cell, 1);
    }
    const view = v;
    const next = view.cell.path.indexOf(to, view.cell.step);
    if (next >= 0) view.cell.step = next;
    const a = this.eyePos(from, { x: 0, z: 0 });
    const b = this.eyePos(to, { x: 0, z: 0 });
    view.moving++;
    this.rebuildForecast();
    let covered = false;
    const p = this.fx.tween(1.15, (t) => {
      const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      view.x = a.x + (b.x - a.x) * e;
      view.z = a.z + (b.z - a.z) * e;
      if (!covered && t >= 0.45) {
        covered = true;
        view.coverEye = to;
        this.refreshCover();
      }
    }).then(() => {
      view.moving--;
      this.moves.delete(p);
    });
    this.moves.add(p);
    return p;
  }

  /** the storm blows itself out: thin, lift and fade */
  end(id: number): Promise<void> {
    const v = this.views.get(id);
    if (!v) return Promise.resolve();
    v.ending = true;
    this.refreshCover();
    this.rebuildForecast();
    const from = v.alpha;
    return this.fx.tween(1.4, (t) => {
      v.alpha = from * (1 - t) ** 1.5;
    }).then(() => {
      if (this.views.get(id) === v && v.ending) {
        this.views.delete(id);
        this.rebuild();
      }
    });
  }

  /** resolves once every storm currently in motion has arrived */
  settled(): Promise<void> {
    return Promise.all([...this.moves]).then(() => undefined);
  }

  update(dt: number, camera: Camera): void {
    let flash = 0;
    for (let i = 0; i < MAX_STORMS; i++) this.stormA[i].w = 0;
    for (const v of this.views.values()) {
      const c = v.cell;
      if ((c.power >= 3 || c.great) && v.alpha > 0.5) {
        v.boltIn -= dt;
        if (v.reflash > 0) {
          v.reflash -= dt;
          if (v.reflash <= 0) v.flash = Math.max(v.flash, 0.7);
        }
        if (v.boltIn <= 0) {
          v.flash = 1;
          v.boltIn = (c.great ? 0.8 : 1.4) + Math.random() * 3;
          v.reflash = Math.random() < 0.5 ? 0.09 : 0;
          this.strike(v, camera);
        }
      }
      v.flash *= Math.exp(-dt * 9);
      flash = Math.max(flash, v.flash * v.alpha);
      if (v.slot < 0) continue;
      this.stormA[v.slot].set(v.x, v.z, worldRadius(c), v.alpha);
      this.stormB[v.slot].set(c.power, c.great ? 1 : 0, v.flash, 0);
    }
    U.uStormFlash.value = flash;
    for (const b of this.bolts) {
      if (b.life <= 0) continue;
      b.life -= dt;
      b.mesh.visible = b.life > 0;
      b.mat.opacity = Math.max(0, b.life / 0.22) * (0.6 + 0.4 * Math.random());
    }
  }

  dispose(): void {
    this.puffGeo.dispose();
    (this.puffs.material as ShaderMaterial).dispose();
    this.lineMat.dispose();
    this.forecast?.geometry.dispose();
    for (const b of this.bolts) {
      b.mesh.geometry.dispose();
      b.mat.dispose();
    }
    this.views.clear();
  }

  // ───────────────────────── internals ─────────────────────────

  private create(cell: StormCell, alpha: number): StormView {
    const used = new Set([...this.views.values()].map((v) => v.slot));
    let slot = -1;
    for (let i = 0; i < MAX_STORMS; i++) {
      if (!used.has(i)) {
        slot = i;
        break;
      }
    }
    const v: StormView = {
      cell: copyCell(cell), slot, x: 0, z: 0, coverEye: cell.path[cell.step] ?? -1, alpha, flash: 0,
      boltIn: 0.5 + Math.random() * 2, reflash: 0, moving: 0, ending: false,
    };
    this.eyePos(cell.path[cell.step] ?? cell.path[cell.path.length - 1], v);
    this.views.set(cell.id, v);
    return v;
  }

  private eyePos(tile: TileIdx | undefined, out: { x: number; z: number }): { x: number; z: number } {
    const t = tile !== undefined && this.map ? this.map.tiles[tile] : undefined;
    if (t) {
      out.x = colX(t.col, t.row);
      out.z = rowZ(t.row);
    }
    return out;
  }

  private rebuild(): void {
    this.rebuildPuffs();
    this.rebuildForecast();
    this.refreshCover();
  }

  private refreshCover(): void {
    const map = this.map;
    if (!map || !this.tiles) return;
    this.cover.fill(0);
    this.bolt.fill(0);
    for (const v of this.views.values()) {
      if (v.ending || v.coverEye < 0) continue;
      const c = v.cell;
      const dens = Math.min(1, 0.55 + 0.15 * c.power + (c.great ? 0.12 : 0));
      const zap = c.power >= 3 || c.great ? 1 : 0;
      for (const t of tilesInRadius(map, v.coverEye, c.radius)) {
        this.cover[t] = Math.max(this.cover[t], dens);
        this.bolt[t] = Math.max(this.bolt[t], zap);
      }
    }
    this.tiles.setStorm(this.cover, this.bolt);
  }

  /** puff instances in storm-local polar coordinates; rebuilt only when storms appear/vanish/change shape */
  private rebuildPuffs(): void {
    let sig = this.low ? 'l' : 'h';
    for (const v of this.views.values()) sig += `|${v.cell.id}:${v.slot}:${v.cell.radius}:${v.cell.power}:${v.cell.great ? 1 : 0}`;
    if (sig === this.puffSig) return;
    this.puffSig = sig;
    const a: number[] = [];
    const b: number[] = [];
    const density = this.low ? 0.55 : 1;
    // back-to-front by kind: low haze, mid churn, then the rim wall bottom → top
    const passes: ((v: StormView, R: number, rnd: (k: number) => number) => void)[] = [
      (v, R, rnd) => {
        const n = Math.round(((Math.PI * R * R) / 0.85) * density);
        for (let i = 0; i < n; i++) {
          a.push(rnd(i * 5) * Math.PI * 2, Math.sqrt(rnd(i * 5 + 1)) * 0.86, 0.12 + rnd(i * 5 + 2) * 0.35, 1.0 + rnd(i * 5 + 3) * 0.5);
          b.push(v.slot, 0, rnd(i * 5 + 4), 0.12);
        }
      },
      (v, R, rnd) => {
        const n = Math.round(((Math.PI * R * R) / 1.8) * density);
        for (let i = 0; i < n; i++) {
          a.push(rnd(i * 5 + 900) * Math.PI * 2, Math.sqrt(rnd(i * 5 + 901)) * 0.75, 0.55 + rnd(i * 5 + 902) * 0.5, 1.1 + rnd(i * 5 + 903) * 0.4);
          b.push(v.slot, 2, rnd(i * 5 + 904), 0.45);
        }
      },
      (v, R, rnd) => {
        const c = v.cell;
        const layers = 2 + Math.min(2, Math.max(0, c.power - 1)) + (c.great ? 1 : 0);
        const n = Math.ceil(((Math.PI * 2 * R) / 0.55) * density);
        for (let l = 0; l < layers; l++) {
          for (let i = 0; i < n; i++) {
            const k = 2000 + l * 1000 + i * 4;
            a.push(((i + rnd(k) * 0.6 + l * 0.37) / n) * Math.PI * 2, 0.9 + rnd(k + 1) * 0.14 - l * 0.03, 0.15 + l * 0.42 + rnd(k + 2) * 0.15, 1.15 - l * 0.08 + rnd(k + 3) * 0.35);
            b.push(v.slot, 1, rnd(k + 3), layers > 1 ? l / (layers - 1) : 0.5);
          }
        }
      },
    ];
    for (const pass of passes) {
      for (const v of this.views.values()) {
        if (v.slot < 0) continue;
        pass(v, worldRadius(v.cell), (k) => hash01(v.cell.id, k, 77));
      }
    }
    const count = a.length / 4;
    if (count > this.puffCap) {
      this.puffCap = Math.max(256, Math.ceil(count * 1.4));
      this.puffGeo.setAttribute('iA', new InstancedBufferAttribute(new Float32Array(this.puffCap * 4), 4));
      this.puffGeo.setAttribute('iB', new InstancedBufferAttribute(new Float32Array(this.puffCap * 4), 4));
    }
    const ia = this.puffGeo.getAttribute('iA') as InstancedBufferAttribute | undefined;
    const ib = this.puffGeo.getAttribute('iB') as InstancedBufferAttribute | undefined;
    if (ia && ib) {
      (ia.array as Float32Array).set(a);
      (ib.array as Float32Array).set(b);
      ia.needsUpdate = true;
      ib.needsUpdate = true;
    }
    this.puffGeo.instanceCount = count;
    this.puffs.visible = count > 0;
  }

  /** dashed footprint outlines for the next two eye positions + a travel arrow, draped on the ground */
  private rebuildForecast(): void {
    if (this.forecast) {
      this.group.remove(this.forecast);
      this.forecast.geometry.dispose();
      this.forecast = null;
    }
    const map = this.map;
    const f = this.field;
    if (!map || !f) return;
    const pos: number[] = [];
    const along: number[] = [];
    const side: number[] = [];
    const kind: number[] = [];
    const color: number[] = [];
    const idx: number[] = [];
    const drape = (x: number, z: number) => Math.max(groundAt(f, x, z), 0) + 0.055;
    const vert = (x: number, z: number, al: number, sd: number, k: number, c: Color, alpha: number) => {
      pos.push(x, drape(x, z), z);
      along.push(al);
      side.push(sd);
      kind.push(k);
      color.push(c.r, c.g, c.b, alpha);
    };
    /** flat ribbon through points (world xz), width w */
    const ribbon = (pts: { x: number; z: number }[], w: number, k: number, c: Color, alpha: number) => {
      let acc = 0;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const pa = pts[Math.max(0, i - 1)];
        const pb = pts[Math.min(pts.length - 1, i + 1)];
        const dx = pb.x - pa.x;
        const dz = pb.z - pa.z;
        const l = Math.hypot(dx, dz) || 1;
        const nx = -dz / l;
        const nz = dx / l;
        if (i > 0) acc += Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z);
        const base = pos.length / 3;
        vert(p.x + nx * w, p.z + nz * w, acc, 1, k, c, alpha);
        vert(p.x - nx * w, p.z - nz * w, acc, -1, k, c, alpha);
        if (i < pts.length - 1) idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
      }
    };
    for (const v of this.views.values()) {
      if (v.ending) continue;
      const c = v.cell;
      for (const ahead of [2, 1]) {
        const eye = c.path[c.step + ahead];
        if (eye === undefined) continue;
        const set = new Set(tilesInRadius(map, eye, c.radius));
        const inset = ahead === 1 ? 0.93 : 0.84;
        const col = ahead === 1 ? FORECAST_NEAR : FORECAST_FAR;
        const alpha = ahead === 1 ? 0.95 : 0.6;
        for (const ti of set) {
          const t = map.tiles[ti];
          const cx = colX(t.col, t.row);
          const cz = rowZ(t.row);
          for (let d = 0; d < 6; d++) {
            const nb = neighbor(map, ti, d);
            if (nb >= 0 && set.has(nb)) continue;
            const a = CORNER_VEC[(d + 5) % 6];
            const b = CORNER_VEC[d];
            const pts: { x: number; z: number }[] = [];
            for (let s = 0; s <= 4; s++) {
              const u = s / 4;
              pts.push({ x: cx + (a.x + (b.x - a.x) * u) * inset, z: cz + (a.z + (b.z - a.z) * u) * inset });
            }
            ribbon(pts, 0.035, 0, col, alpha);
          }
        }
      }
      // travel arrow: current eye → +1 → +2 (Chaikin-smoothed)
      let pts = [0, 1, 2]
        .map((k) => c.path[c.step + k])
        .filter((t): t is number => t !== undefined)
        .map((t) => this.eyePos(t, { x: 0, z: 0 }));
      if (pts.length < 2) continue;
      for (let k = 0; k < 2; k++) {
        const next = [pts[0]];
        for (let i = 0; i < pts.length - 1; i++) {
          const p = pts[i];
          const q = pts[i + 1];
          next.push({ x: p.x + (q.x - p.x) * 0.25, z: p.z + (q.z - p.z) * 0.25 }, { x: p.x + (q.x - p.x) * 0.75, z: p.z + (q.z - p.z) * 0.75 });
        }
        next.push(pts[pts.length - 1]);
        pts = next;
      }
      const end = pts[pts.length - 1];
      const prev = pts[pts.length - 2];
      const dl = Math.hypot(end.x - prev.x, end.z - prev.z) || 1;
      const dx = (end.x - prev.x) / dl;
      const dz = (end.z - prev.z) / dl;
      // stop the shaft short of the head
      pts[pts.length - 1] = { x: end.x - dx * 0.2, z: end.z - dz * 0.2 };
      ribbon(pts, 0.075, 1, ARROW, 0.9);
      const base = pos.length / 3;
      vert(end.x + dx * 0.25, end.z + dz * 0.25, 0, 0, 2, ARROW, 0.95);
      vert(end.x - dx * 0.2 - dz * 0.26, end.z - dz * 0.2 + dx * 0.26, 0, 0, 2, ARROW, 0.95);
      vert(end.x - dx * 0.2 + dz * 0.26, end.z - dz * 0.2 - dx * 0.26, 0, 0, 2, ARROW, 0.95);
      idx.push(base, base + 1, base + 2);
    }
    if (!idx.length) return;
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
    geo.setAttribute('aAlong', new BufferAttribute(new Float32Array(along), 1));
    geo.setAttribute('aSide', new BufferAttribute(new Float32Array(side), 1));
    geo.setAttribute('aKind', new BufferAttribute(new Float32Array(kind), 1));
    geo.setAttribute('aColor', new BufferAttribute(new Float32Array(color), 4));
    geo.setIndex(idx);
    geo.computeBoundingSphere();
    this.forecast = new Mesh(geo, this.lineMat);
    this.forecast.renderOrder = 15;
    this.group.add(this.forecast);
  }

  /** a jagged lightning ribbon from the storm top to the ground, facing the camera */
  private strike(v: StormView, camera: Camera): void {
    const f = this.field;
    const b = this.bolts.find((x) => x.life <= 0);
    if (!f || !b) return;
    const R = worldRadius(v.cell);
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * R * 0.7;
    const gx = v.x + Math.cos(a) * r;
    const gz = v.z + Math.sin(a) * r;
    const g = Math.max(0, groundAt(f, gx, gz));
    const top = g + 2.1 * (1 + 0.45 * (v.cell.great ? 1 : 0));
    const e = camera.matrixWorld.elements;
    const rx = e[0];
    const rz = e[2];
    const arr = b.mesh.geometry.getAttribute('position') as BufferAttribute;
    let x = gx + (Math.random() - 0.5) * 0.6;
    let z = gz + (Math.random() - 0.5) * 0.6;
    for (let s = 0; s <= BOLT_SEGS; s++) {
      const u = s / BOLT_SEGS;
      const y = top + (g - top) * u;
      if (s === BOLT_SEGS) {
        x = gx;
        z = gz;
      }
      const w = 0.035 * (1 - u * 0.6);
      arr.setXYZ(s * 2, x + rx * w, y, z + rz * w);
      arr.setXYZ(s * 2 + 1, x - rx * w, y, z - rz * w);
      x += (Math.random() - 0.5) * 0.35;
      z += (Math.random() - 0.5) * 0.35;
    }
    arr.needsUpdate = true;
    b.life = 0.22;
    b.mesh.visible = true;
    this.fx.burst(new Vector3(gx, g + 0.05, gz), { count: 10, color: '#dfe8ff', color2: '#9fc4ff', speed: 0.5, up: 0.4, life: 0.35, size: 0.1, star: true });
  }
}

function copyCell(c: StormCell): StormCell {
  return { ...c, path: c.path.slice() };
}
