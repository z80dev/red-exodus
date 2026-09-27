// Model library: loads GLBs listed in the manifests and bakes each into ONE standardized geometry
// (position, normal, color = material base color, aTeam = 0/1/2 for TEAM/TEAM_DARK parts, aEmit = emissive)
// so every model renders with a single shared material and instances cheaply. Keys without a GLB get a
// procedural stand-in until the file exists.
import {
  BufferAttribute, type BufferGeometry, Color, Float32BufferAttribute, type Material, type Mesh,
  type MeshStandardMaterial, type Object3D,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { type ManifestEntry, loadManifests, modelUrl } from './manifest';
import { buildStandIn } from './standins';

export interface ModelAsset {
  key: string;
  geometry: BufferGeometry;
  /** local bounds */
  minY: number;
  height: number;
  radius: number;
  fromGlb: boolean;
}

function bakePart(src: BufferGeometry, mat: Material | undefined): BufferGeometry {
  const g = src.index ? src.toNonIndexed() : src.clone();
  const n = g.getAttribute('position').count;
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  const m = mat as MeshStandardMaterial | undefined;
  const base = m?.color ? m.color.clone() : new Color(0.8, 0.8, 0.8);
  const name = (m?.name ?? '').toUpperCase();
  const team = name.startsWith('TEAM_DARK') ? 2 : name.startsWith('TEAM') ? 1 : 0;
  const em = m?.emissive ? m.emissive.clone().multiplyScalar(m.emissiveIntensity ?? 1) : new Color(0, 0, 0);
  // metals render as dielectrics here (no env map): lift them so gold/bronze trims stay bright
  if (m && (m.metalness ?? 0) > 0.5) base.multiplyScalar(1.25);
  const vc = g.getAttribute('color');
  const col = new Float32Array(n * 3);
  const emit = new Float32Array(n * 3);
  const tm = new Float32Array(n).fill(team);
  for (let i = 0; i < n; i++) {
    const cr = vc ? vc.getX(i) : 1;
    const cg = vc ? vc.getY(i) : 1;
    const cb = vc ? vc.getZ(i) : 1;
    col[i * 3] = base.r * cr;
    col[i * 3 + 1] = base.g * cg;
    col[i * 3 + 2] = base.b * cb;
    emit[i * 3] = em.r;
    emit[i * 3 + 1] = em.g;
    emit[i * 3 + 2] = em.b;
  }
  const out = g;
  for (const k of Object.keys(out.attributes)) if (k !== 'position' && k !== 'normal') out.deleteAttribute(k);
  out.setAttribute('color', new Float32BufferAttribute(col, 3));
  out.setAttribute('aTeam', new BufferAttribute(tm, 1));
  out.setAttribute('aEmit', new Float32BufferAttribute(emit, 3));
  out.morphAttributes = {};
  return out;
}

export function finalizeAsset(key: string, parts: BufferGeometry[], fromGlb: boolean): ModelAsset {
  const geometry = parts.length === 1 ? parts[0] : (mergeGeometries(parts, false) ?? parts[0]);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const bb = geometry.boundingBox!;
  const radius = Math.max(Math.abs(bb.min.x), Math.abs(bb.max.x), Math.abs(bb.min.z), Math.abs(bb.max.z));
  return { key, geometry, minY: bb.min.y, height: bb.max.y - bb.min.y, radius, fromGlb };
}

/** bake an arbitrary scene graph (stand-ins or GLTF scenes) into one asset */
export function bakeObject(key: string, root: Object3D, fromGlb: boolean): ModelAsset {
  root.updateMatrixWorld(true);
  const parts: BufferGeometry[] = [];
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const geo = mesh.geometry;
    if (Array.isArray(mesh.material) && geo.groups.length) {
      for (const grp of geo.groups) {
        const sub = geo.clone();
        sub.clearGroups();
        if (sub.index) sub.setIndex(Array.from(sub.index.array).slice(grp.start, grp.start + grp.count));
        const p = bakePart(sub, mats[grp.materialIndex ?? 0]);
        p.applyMatrix4(mesh.matrixWorld);
        parts.push(p);
      }
    } else {
      const p = bakePart(geo, mats[0]);
      p.applyMatrix4(mesh.matrixWorld);
      parts.push(p);
    }
  });
  return finalizeAsset(key, parts, fromGlb);
}

export class ModelLibrary {
  private manifest = new Map<string, ManifestEntry>();
  private assets = new Map<string, ModelAsset>();
  private pending = new Map<string, Promise<ModelAsset>>();
  private loader = new GLTFLoader();
  private listeners = new Set<() => void>();
  private ready: Promise<void>;
  errors: string[] = [];

  constructor() {
    this.ready = loadManifests().then((m) => {
      this.manifest = m;
      // layers built before the manifests arrived used stand-ins: let them rebuild (which starts GLB loads)
      if (m.size) for (const fn of this.listeners) fn();
    });
  }

  whenReady(): Promise<void> {
    return this.ready;
  }

  hasGlb(key: string): boolean {
    return this.manifest.has(key);
  }

  manifestKeys(): string[] {
    return [...this.manifest.keys()];
  }

  /** notified whenever a GLB finishes loading (layers rebuild to swap stand-ins out) */
  onLoaded(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** synchronous: loaded GLB asset, else a stand-in (and kicks off the GLB load) */
  get(key: string): ModelAsset {
    const a = this.assets.get(key);
    if (a && (a.fromGlb || !this.manifest.has(key))) return a;
    if (this.manifest.has(key) && !this.pending.has(key)) void this.load(key);
    if (a) return a;
    const s = bakeObject(key, buildStandIn(key), false);
    this.assets.set(key, s);
    return s;
  }

  /** preload a set of keys (resolves when all GLBs that exist are loaded) */
  async preload(keys: Iterable<string>): Promise<void> {
    await this.ready;
    const jobs: Promise<unknown>[] = [];
    for (const k of new Set(keys)) if (this.manifest.has(k) && !this.assets.get(k)?.fromGlb) jobs.push(this.load(k));
    await Promise.all(jobs);
  }

  private load(key: string): Promise<ModelAsset> {
    const existing = this.pending.get(key);
    if (existing) return existing;
    const entry = this.manifest.get(key)!;
    const p = this.loader
      .loadAsync(modelUrl(entry.file))
      .then((gltf) => {
        const asset = bakeObject(key, gltf.scene, true);
        this.assets.get(key)?.geometry.dispose();
        this.assets.set(key, asset);
        for (const fn of this.listeners) fn();
        return asset;
      })
      .catch((err: unknown) => {
        this.errors.push(`${key}: ${String(err)}`);
        this.manifest.delete(key);
        return this.get(key);
      });
    this.pending.set(key, p);
    return p;
  }

  dispose(): void {
    for (const a of this.assets.values()) a.geometry.dispose();
    this.assets.clear();
    this.listeners.clear();
  }
}
