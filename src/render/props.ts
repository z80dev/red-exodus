// Instanced static props: one InstancedMesh per model key (all models share one baked-color material),
// per-instance team colors via `iTeamA` / `iTeamB` attributes.
import {
  BufferGeometry, Color, DynamicDrawUsage, Group, InstancedBufferAttribute, InstancedMesh, Matrix4,
  type MeshStandardMaterial,
} from 'three';
import type { ModelLibrary } from './assets/models';

const SWAY_KEYS = /^(tree_|bush|reeds|flowers)/;
const WHITE = new Color(1, 1, 1);
const GREY = new Color(0.35, 0.35, 0.35);

interface Batch {
  matrices: number[];
  teamA: number[];
  teamB: number[];
}

interface Slot {
  mesh: InstancedMesh;
  capacity: number;
  geoSource: BufferGeometry;
}

export class PropLayer {
  readonly group = new Group();
  private batches = new Map<string, Batch>();
  private slots = new Map<string, Slot>();
  private lib: ModelLibrary;
  private mat: MeshStandardMaterial;
  private swayMat: MeshStandardMaterial;
  castShadow = true;

  constructor(name: string, lib: ModelLibrary, mat: MeshStandardMaterial, swayMat: MeshStandardMaterial) {
    this.group.name = name;
    this.lib = lib;
    this.mat = mat;
    this.swayMat = swayMat;
  }

  begin(): void {
    this.batches.clear();
  }

  add(key: string, m: Matrix4, teamA: Color = WHITE, teamB: Color = GREY): void {
    let b = this.batches.get(key);
    if (!b) {
      b = { matrices: [], teamA: [], teamB: [] };
      this.batches.set(key, b);
    }
    for (let i = 0; i < 16; i++) b.matrices.push(m.elements[i]);
    b.teamA.push(teamA.r, teamA.g, teamA.b);
    b.teamB.push(teamB.r, teamB.g, teamB.b);
  }

  keys(): string[] {
    return [...this.batches.keys()];
  }

  commit(): void {
    for (const [key, slot] of this.slots) {
      if (!this.batches.has(key)) {
        slot.mesh.count = 0;
        slot.mesh.visible = false;
      }
    }
    for (const [key, b] of this.batches) {
      const count = b.matrices.length / 16;
      const asset = this.lib.get(key);
      let slot = this.slots.get(key);
      if (slot && (slot.capacity < count || slot.geoSource !== asset.geometry)) {
        this.group.remove(slot.mesh);
        slot.mesh.geometry.dispose();
        slot.mesh.dispose();
        slot = undefined;
      }
      if (!slot) {
        const capacity = Math.max(8, Math.ceil(count * 1.5));
        const geo = new BufferGeometry();
        for (const [name, attr] of Object.entries(asset.geometry.attributes)) geo.setAttribute(name, attr);
        geo.boundingSphere = asset.geometry.boundingSphere;
        geo.boundingBox = asset.geometry.boundingBox;
        const ta = new InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
        const tb = new InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
        ta.setUsage(DynamicDrawUsage);
        tb.setUsage(DynamicDrawUsage);
        geo.setAttribute('iTeamA', ta);
        geo.setAttribute('iTeamB', tb);
        const mesh = new InstancedMesh(geo, SWAY_KEYS.test(key) ? this.swayMat : this.mat, capacity);
        mesh.instanceMatrix.setUsage(DynamicDrawUsage);
        mesh.name = key;
        slot = { mesh, capacity, geoSource: asset.geometry };
        this.slots.set(key, slot);
        this.group.add(mesh);
      }
      const mesh = slot.mesh;
      mesh.castShadow = this.castShadow;
      mesh.receiveShadow = true;
      mesh.instanceMatrix.array.set(b.matrices);
      mesh.instanceMatrix.needsUpdate = true;
      const ta = mesh.geometry.getAttribute('iTeamA') as InstancedBufferAttribute;
      const tb = mesh.geometry.getAttribute('iTeamB') as InstancedBufferAttribute;
      (ta.array as Float32Array).set(b.teamA);
      (tb.array as Float32Array).set(b.teamB);
      ta.needsUpdate = true;
      tb.needsUpdate = true;
      mesh.count = count;
      mesh.visible = count > 0;
      mesh.computeBoundingSphere();
    }
  }

  setShadows(on: boolean): void {
    this.castShadow = on;
    for (const s of this.slots.values()) s.mesh.castShadow = on;
  }

  dispose(): void {
    for (const s of this.slots.values()) {
      s.mesh.geometry.dispose();
      s.mesh.dispose();
    }
    this.slots.clear();
    this.group.clear();
  }
}
