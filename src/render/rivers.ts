// Rivers run along hex edges (tile.riverEdges). We build an oriented edge network flowing toward the
// nearest water (BFS over hex corners), carve it into the terrain, and render animated ribbons.
import {
  BufferAttribute, BufferGeometry, Color, Mesh, MeshStandardMaterial,
} from 'three';
import type { WebGLProgramParametersWithUniforms } from 'three';
import type { GameMap } from '../sim/types';
import { CORNER_VEC, WATER_TERRAIN, colX, neighborOf, rowZ } from './hexgeo';
import { GLSL_NOISE } from './noise';
import { GLSL_TILES, U } from './shaders';

export interface RiverSeg {
  ax: number; az: number; bx: number; bz: number;
  /** flow distance (in edges) to the sink at a and b; flow goes a → b */
  ua: number; ub: number;
  /** tiles on either side (for carve lookup) */
  t0: number; t1: number;
}

export function buildRiverNetwork(map: GameMap): RiverSeg[] {
  // corner key → id
  const nodeId = new Map<string, number>();
  const nodePos: { x: number; z: number; sink: boolean; h: number }[] = [];
  const keyOf = (x: number, z: number) => `${Math.round(x * 1000)},${Math.round(z * 1000)}`;
  const nodeAt = (x: number, z: number): number => {
    const k = keyOf(x, z);
    let id = nodeId.get(k);
    if (id === undefined) {
      id = nodePos.length;
      nodeId.set(k, id);
      nodePos.push({ x, z, sink: false, h: 0 });
    }
    return id;
  };
  const edges: { a: number; b: number; t0: number; t1: number }[] = [];
  const seen = new Set<string>();
  for (const t of map.tiles) {
    if (!t.riverEdges) continue;
    const cx = colX(t.col, t.row);
    const cz = rowZ(t.row);
    for (let d = 0; d < 6; d++) {
      if (!(t.riverEdges & (1 << d))) continue;
      const n = neighborOf(map, t.idx, d);
      const key = n < 0 ? `${t.idx}:${d}` : `${Math.min(t.idx, n)}-${Math.max(t.idx, n)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const c0 = CORNER_VEC[(d + 5) % 6];
      const c1 = CORNER_VEC[d];
      const a = nodeAt(cx + c0.x, cz + c0.z);
      const b = nodeAt(cx + c1.x, cz + c1.z);
      edges.push({ a, b, t0: t.idx, t1: n });
    }
  }
  if (!edges.length) return [];
  // mark sinks: corners touching water tiles; node height = mean of adjacent land heights
  for (const t of map.tiles) {
    const cx = colX(t.col, t.row);
    const cz = rowZ(t.row);
    const water = WATER_TERRAIN[t.terrain] === true;
    for (let k = 0; k < 6; k++) {
      const id = nodeId.get(keyOf(cx + CORNER_VEC[k].x, cz + CORNER_VEC[k].z));
      if (id === undefined) continue;
      if (water) nodePos[id].sink = true;
      nodePos[id].h += t.height + (t.elevation === 'hills' ? 0.5 : t.elevation === 'mountain' ? 1 : 0);
    }
  }
  const adj: number[][] = nodePos.map(() => []);
  edges.forEach((e, i) => {
    adj[e.a].push(i);
    adj[e.b].push(i);
  });
  const dist = new Float64Array(nodePos.length).fill(Infinity);
  const queue: number[] = [];
  nodePos.forEach((n, i) => {
    if (n.sink) {
      dist[i] = 0;
      queue.push(i);
    }
  });
  for (let qi = 0; qi < queue.length; qi++) {
    const u = queue[qi];
    for (const ei of adj[u]) {
      const e = edges[ei];
      const v = e.a === u ? e.b : e.a;
      if (dist[v] > dist[u] + 1) {
        dist[v] = dist[u] + 1;
        queue.push(v);
      }
    }
  }
  // unreachable components: flow downhill from the highest node
  for (let i = 0; i < nodePos.length; i++) if (!Number.isFinite(dist[i])) dist[i] = 100 + nodePos[i].h * 10;
  return edges.map((e) => {
    const A = nodePos[e.a];
    const B = nodePos[e.b];
    const forward = dist[e.a] >= dist[e.b];
    const [p, q, up, uq] = forward ? [A, B, dist[e.a], dist[e.b]] : [B, A, dist[e.b], dist[e.a]];
    return { ax: p.x, az: p.z, bx: q.x, bz: q.z, ua: up, ub: uq === up ? up - 1 : uq, t0: e.t0, t1: e.t1 };
  });
}

/** distance from a point to a segment */
export function segDist(px: number, pz: number, s: RiverSeg): number {
  const dx = s.bx - s.ax;
  const dz = s.bz - s.az;
  const l2 = dx * dx + dz * dz;
  let t = ((px - s.ax) * dx + (pz - s.az) * dz) / l2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const ex = s.ax + dx * t - px;
  const ez = s.az + dz * t - pz;
  return Math.sqrt(ex * ex + ez * ez);
}

const STEPS = 8;

export function buildRiverMesh(segs: RiverSeg[], ground: (x: number, z: number) => number): Mesh | null {
  if (!segs.length) return null;
  const vcount = segs.length * (STEPS + 1) * 2;
  const pos = new Float32Array(vcount * 3);
  const uv = new Float32Array(vcount * 2);
  const nor = new Float32Array(vcount * 3);
  const idx: number[] = [];
  let v = 0;
  for (const s of segs) {
    const dx = s.bx - s.ax;
    const dz = s.bz - s.az;
    const len = Math.hypot(dx, dz);
    const fx = dx / len;
    const fz = dz / len;
    const nx = -fz;
    const nz = fx;
    const ext = 0.08;
    const base = v;
    for (let i = 0; i <= STEPS; i++) {
      const t = i / STEPS;
      const along = -ext + (len + 2 * ext) * t;
      const cx = s.ax + fx * along;
      const cz = s.az + fz * along;
      const width = 0.1 + 0.05 * (1 - Math.min(s.ua, 8) / 8);
      const u = s.ua - (s.ua - s.ub) * (along / len);
      for (let side = 0; side < 2; side++) {
        const sg = side ? 1 : -1;
        const x = cx + nx * width * sg;
        const z = cz + nz * width * sg;
        const y = Math.max(ground(cx, cz) + 0.035, -0.03);
        pos[v * 3] = x;
        pos[v * 3 + 1] = y;
        pos[v * 3 + 2] = z;
        nor[v * 3 + 1] = 1;
        uv[v * 2] = -u;
        uv[v * 2 + 1] = side;
        v++;
      }
      if (i < STEPS) {
        const a = base + i * 2;
        idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setAttribute('normal', new BufferAttribute(nor, 3));
  geo.setAttribute('uv', new BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  const mat = new MeshStandardMaterial({ color: new Color('#4fc3d4'), roughness: 0.18, metalness: 0 });
  mat.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, U);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vRUv;\nvarying vec3 vAeWorld;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvRUv = uv;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvAeWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec2 vRUv;
        varying vec3 vAeWorld;
        uniform vec3 uShallow;
        uniform vec3 uDeep;
        ${GLSL_NOISE}
        ${GLSL_TILES}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float across = abs(vRUv.y - 0.5) * 2.0;
        float flow = vRUv.x * 1.6 - uTime * 0.55;
        float streak = aeNoise(vec2(flow * 3.0, vRUv.y * 4.0)) * 0.6 + aeNoise(vec2(flow * 7.0, vRUv.y * 9.0 + 3.0)) * 0.4;
        vec3 rc = mix(uShallow * 1.05, mix(uShallow, uDeep, 0.45), 1.0 - across);
        diffuseColor.rgb = rc + vec3(0.12) * smoothstep(0.62, 0.85, streak);
        float bank = smoothstep(0.65, 1.0, across);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.97, 1.0), bank * 0.55);`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        {
          float n1 = aeNoise(vec2(flow * 4.0, vRUv.y * 3.0));
          float n2 = aeNoise(vec2(flow * 4.0 + 0.2, vRUv.y * 3.0));
          vec3 wn = normalize(vec3((n1 - n2) * 1.5, 1.0, (aeNoise(vec2(flow * 4.0, vRUv.y * 3.0 + 0.2)) - n1) * 1.5));
          normal = normalize((viewMatrix * vec4(wn, 0.0)).xyz);
        }`,
      )
      .replace('#include <opaque_fragment>', 'outgoingLight = aeApplyFog(outgoingLight, aeFogAt(vAeWorld.xz));\n#include <opaque_fragment>');
  };
  mat.customProgramCacheKey = () => 'ae-river';
  const mesh = new Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.renderOrder = 2;
  return mesh;
}
