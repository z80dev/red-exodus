// Continuous stylized terrain: a regular vertex lattice over the map whose heights and colors are
// kernel-blended from tile data (so hex borders melt into organic coastlines and biome transitions),
// with rounded hills, raised mountain plateaus, carved river channels and beaches. Chunked meshes.
import {
  BufferAttribute, BufferGeometry, Color, DataTexture, Group, LinearFilter, Mesh, MeshStandardMaterial,
  RedFormat, UnsignedByteType,
} from 'three';
import type { GameMap, Tile } from '../sim/types';
import { WATER_TERRAIN, colX, hash01, mapBounds, rowZ } from './hexgeo';
import { fbm, snoise } from './noise';
import { GRAVEL, ROCK, ROCK_DARK, SAND, SEABED, SNOW_SHADE, WET_SAND, featureColor, terrainColor } from './palette';
import { type RiverSeg, segDist } from './rivers';
import { patchTerrainMaterial } from './shaders';

export const STEP = 0.2;
const CHUNK = 40;
const MARGIN = 3;
const OCEAN_H = -0.62;
/** height texture encodes [H_MIN, H_MIN + 1] into 0..255 */
export const H_MIN = -0.8;

export interface TerrainField {
  map: GameMap;
  x0: number;
  z0: number;
  nx: number;
  nz: number;
  heights: Float32Array;
  colors: Float32Array;
  /** per-tile base heights (surface level where props sit, before micro detail) */
  tileBase: Float32Array;
  rivers: RiverSeg[];
}

function baseHeight(t: Tile): number {
  switch (t.terrain) {
    case 'ocean': return OCEAN_H;
    case 'coast': return -0.26;
    case 'lake': return -0.22;
    default: break;
  }
  let h = 0.1 + 0.1 * t.height;
  if (t.elevation === 'hills') h += 0.1;
  if (t.elevation === 'mountain') h += 0.22;
  return h;
}

function tileColor(t: Tile, out: Color): Color {
  if (WATER_TERRAIN[t.terrain]) {
    out.copy(SEABED);
    if (t.terrain === 'ocean') out.multiplyScalar(0.55);
    return out;
  }
  out.copy(terrainColor(t.terrain));
  // snow reads as cloud if pure white: cool it down so relief shading carries
  if (t.terrain === 'snow') out.lerp(SNOW_SHADE, 0.45);
  if (t.feature && t.feature !== 'ice' && t.feature !== 'reef') out.lerp(featureColor(t.feature), 0.72);
  if (t.elevation === 'hills') out.lerp(ROCK, 0.12).multiplyScalar(0.94);
  if (t.elevation === 'mountain') out.lerp(ROCK, 0.7);
  return out;
}

/** axial round of a world point → offset (col,row), may be off-map */
function cellOf(x: number, z: number): [number, number] {
  const qf = 0.5773502691896258 * x - z / 3;
  const rf = (2 / 3) * z;
  const sf = -qf - rf;
  let q = Math.round(qf);
  let r = Math.round(rf);
  const s = Math.round(sf);
  const dq = Math.abs(q - qf);
  const dr = Math.abs(r - rf);
  const ds = Math.abs(s - sf);
  if (dq > dr && dq > ds) q = -r - s;
  else if (dr > ds) r = -q - s;
  return [q + (r - (r & 1)) / 2, r];
}

const EVEN = [[0, 0], [1, 0], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1]];
const ODD = [[0, 0], [1, 0], [1, 1], [0, 1], [-1, 0], [0, -1], [1, -1]];

export function buildTerrainField(map: GameMap, rivers: RiverSeg[]): TerrainField {
  const b = mapBounds(map);
  const x0 = b.minX - MARGIN;
  const z0 = b.minZ - MARGIN;
  const nx = Math.ceil((b.maxX + MARGIN - x0) / STEP) + 1;
  const nz = Math.ceil((b.maxZ + MARGIN - z0) / STEP) + 1;
  const heights = new Float32Array(nx * nz);
  const colors = new Float32Array(nx * nz * 3);
  const n = map.tiles.length;
  const tileBase = new Float32Array(n);
  const tileCol: Color[] = [];
  const isWater = new Uint8Array(n);
  const coldShore = new Uint8Array(n);
  const tmp = new Color();
  for (let i = 0; i < n; i++) {
    const t = map.tiles[i];
    tileBase[i] = baseHeight(t);
    tileCol.push(tileColor(t, new Color()));
    isWater[i] = WATER_TERRAIN[t.terrain] ? 1 : 0;
    coldShore[i] = t.terrain === 'snow' || t.terrain === 'tundra' ? 1 : 0;
  }
  // river segments bucketed by tile for carve lookups
  const riverByTile: RiverSeg[][] = Array.from({ length: n }, () => []);
  for (const s of rivers) {
    riverByTile[s.t0].push(s);
    if (s.t1 >= 0) riverByTile[s.t1].push(s);
  }
  const oceanCol = SEABED.clone().multiplyScalar(0.55);
  const W = map.width;
  const H = map.height;
  const colAcc = new Color();
  for (let iz = 0; iz < nz; iz++) {
    const z = z0 + iz * STEP;
    for (let ix = 0; ix < nx; ix++) {
      const x = x0 + ix * STEP;
      // organic warp: heights mildly, colors strongly
      const wx = x + 0.13 * snoise(x * 0.7, z * 0.7);
      const wz = z + 0.13 * snoise(x * 0.7 + 31.7, z * 0.7 + 17.3);
      const cx = x + 0.24 * snoise(x * 0.9 + 5.1, z * 0.9 - 3.3);
      const cz = z + 0.24 * snoise(x * 0.9 - 11.9, z * 0.9 + 8.4);
      const [col, row] = cellOf(wx, wz);
      const offs = row & 1 ? ODD : EVEN;
      let hs = 0;
      let ws = 0;
      let bump = 0;
      let wet = 0;
      let wetW = 0;
      let cold = 0;
      colAcc.setRGB(0, 0, 0);
      let cws = 0;
      for (let k = 0; k < 7; k++) {
        const c = col + offs[k][0];
        const r = row + offs[k][1];
        const inside = c >= 0 && r >= 0 && c < W && r < H;
        const ti = inside ? r * W + c : -1;
        const tcx = colX(c, r);
        const tcz = rowZ(r);
        const dx = wx - tcx;
        const dz = wz - tcz;
        const d2 = dx * dx + dz * dz;
        const w = Math.exp(-3.4 * d2);
        const bh = ti >= 0 ? tileBase[ti] : OCEAN_H;
        hs += w * bh;
        ws += w;
        if (ti >= 0) {
          const t = map.tiles[ti];
          const rx = x - tcx;
          const rz = z - tcz;
          const rd2 = rx * rx + rz * rz;
          if (t.elevation === 'hills') {
            const f = Math.max(0, 1 - rd2 / 0.66);
            bump += 0.3 * f * f * (0.85 + 0.3 * hash01(ti, 3));
            // secondary knoll for variety
            const ox = tcx + (hash01(ti, 5) - 0.5) * 0.7;
            const oz = tcz + (hash01(ti, 6) - 0.5) * 0.7;
            const g = Math.max(0, 1 - ((x - ox) ** 2 + (z - oz) ** 2) / 0.22);
            bump += 0.1 * g * g;
          } else if (t.elevation === 'mountain') {
            const f = Math.max(0, 1 - rd2 / 0.75);
            bump += 0.12 * f * f;
          }
        }
        // color kernel (sharper, warped differently)
        const ex = cx - tcx;
        const ez = cz - tcz;
        const cw = Math.exp(-5.5 * (ex * ex + ez * ez));
        const tc = ti >= 0 ? tileCol[ti] : oceanCol;
        colAcc.r += tc.r * cw;
        colAcc.g += tc.g * cw;
        colAcc.b += tc.b * cw;
        cws += cw;
        const wv = ti < 0 || isWater[ti] ? 1 : 0;
        wet += wv * cw;
        wetW += cw;
        if (ti >= 0) cold += coldShore[ti] * cw;
      }
      let h = hs / ws + bump;
      const vi = iz * nx + ix;
      // land micro relief
      if (h > 0) h += 0.03 * fbm(x * 1.1, z * 1.1, 3) * Math.min(1, h * 6);
      else h += 0.04 * snoise(x * 0.8, z * 0.8);
      // river carve
      const nearT = cellOf(x, z);
      if (nearT[0] >= 0 && nearT[1] >= 0 && nearT[0] < W && nearT[1] < H) {
        const ti = nearT[1] * W + nearT[0];
        let dmin = 9;
        const toffs = nearT[1] & 1 ? ODD : EVEN;
        for (let k = 0; k < 7; k++) {
          const c = nearT[0] + toffs[k][0];
          const r = nearT[1] + toffs[k][1];
          if (c < 0 || r < 0 || c >= W || r >= H) continue;
          const list = riverByTile[k === 0 ? ti : r * W + c];
          for (const s of list) dmin = Math.min(dmin, segDist(x, z, s));
        }
        if (dmin < 0.42) {
          const f = 1 - smooth(0.1, 0.42, dmin);
          h = h - 0.09 * f;
        }
      }
      heights[vi] = h;
      // color
      colAcc.multiplyScalar(1 / cws);
      const wetF = wet / wetW;
      const coldF = cold / cws;
      if (h > -0.02 && wetF > 0.02) {
        const beach = smooth(0.12, -0.01, h) * smooth(0.0, 0.25, wetF);
        tmp.copy(SAND).lerp(GRAVEL, coldF);
        colAcc.lerp(tmp, beach);
      }
      if (h <= 0.02) {
        const depth = Math.max(0, -h);
        tmp.copy(WET_SAND).lerp(SEABED, smooth(0.0, 0.12, depth)).lerp(oceanCol, smooth(0.15, 0.55, depth));
        colAcc.lerp(tmp, smooth(0.02, -0.03, h));
      }
      const v1 = snoise(x * 2.1, z * 2.1);
      const v2 = snoise(x * 6.3 + 7, z * 6.3 - 2);
      const bright = 1 + 0.07 * v1 + 0.035 * v2;
      colors[vi * 3] = colAcc.r * bright;
      colors[vi * 3 + 1] = colAcc.g * bright * (1 + 0.03 * snoise(x * 0.45 + 40, z * 0.45));
      colors[vi * 3 + 2] = colAcc.b * bright;
    }
  }
  // slope rock + snow-dusted peaks on mountain plateaus
  for (let iz = 1; iz < nz - 1; iz++) {
    for (let ix = 1; ix < nx - 1; ix++) {
      const vi = iz * nx + ix;
      const h = heights[vi];
      if (h <= 0.02) continue;
      const gx = (heights[vi + 1] - heights[vi - 1]) / (2 * STEP);
      const gz = (heights[vi + nx] - heights[vi - nx]) / (2 * STEP);
      const slope = Math.sqrt(gx * gx + gz * gz);
      const r = smooth(0.55, 1.1, slope) * 0.75;
      if (r > 0) {
        const rc = (hash01(ix, iz) > 0.5 ? ROCK : ROCK_DARK);
        colors[vi * 3] += (rc.r - colors[vi * 3]) * r;
        colors[vi * 3 + 1] += (rc.g - colors[vi * 3 + 1]) * r;
        colors[vi * 3 + 2] += (rc.b - colors[vi * 3 + 2]) * r;
      }
    }
  }
  return { map, x0, z0, nx, nz, heights, colors, tileBase, rivers };
}

function smooth(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** bilinear ground height at a world point */
export function groundAt(f: TerrainField, x: number, z: number): number {
  const fx = Math.min(f.nx - 1.001, Math.max(0, (x - f.x0) / STEP));
  const fz = Math.min(f.nz - 1.001, Math.max(0, (z - f.z0) / STEP));
  const ix = Math.floor(fx);
  const iz = Math.floor(fz);
  const tx = fx - ix;
  const tz = fz - iz;
  const i = iz * f.nx + ix;
  const h = f.heights;
  return (h[i] * (1 - tx) + h[i + 1] * tx) * (1 - tz) + (h[i + f.nx] * (1 - tx) + h[i + f.nx + 1] * tx) * tz;
}

export function createTerrainMaterial(): MeshStandardMaterial {
  const mat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
  patchTerrainMaterial(mat);
  return mat;
}

export function buildTerrainMeshes(f: TerrainField, mat: MeshStandardMaterial): Group {
  const g = new Group();
  g.name = 'terrain';
  const { nx, nz, heights, colors } = f;
  // normals from central differences over the whole field (seamless across chunks)
  const normals = new Float32Array(nx * nz * 3);
  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++) {
      const i = iz * nx + ix;
      const hl = heights[iz * nx + Math.max(0, ix - 1)];
      const hr = heights[iz * nx + Math.min(nx - 1, ix + 1)];
      const hd = heights[Math.max(0, iz - 1) * nx + ix];
      const hu = heights[Math.min(nz - 1, iz + 1) * nx + ix];
      let ax = -(hr - hl) / (2 * STEP);
      let az = -(hu - hd) / (2 * STEP);
      const len = Math.sqrt(ax * ax + 1 + az * az);
      ax /= len;
      az /= len;
      normals[i * 3] = ax;
      normals[i * 3 + 1] = 1 / len;
      normals[i * 3 + 2] = az;
    }
  }
  for (let cz = 0; cz < nz - 1; cz += CHUNK) {
    for (let cx = 0; cx < nx - 1; cx += CHUNK) {
      const w = Math.min(CHUNK, nx - 1 - cx) + 1;
      const d = Math.min(CHUNK, nz - 1 - cz) + 1;
      const pos = new Float32Array(w * d * 3);
      const nor = new Float32Array(w * d * 3);
      const col = new Float32Array(w * d * 3);
      let skip = true;
      for (let j = 0; j < d; j++) {
        for (let i = 0; i < w; i++) {
          const src = (cz + j) * nx + cx + i;
          const dst = j * w + i;
          pos[dst * 3] = f.x0 + (cx + i) * STEP;
          pos[dst * 3 + 1] = heights[src];
          pos[dst * 3 + 2] = f.z0 + (cz + j) * STEP;
          if (heights[src] > -0.5) skip = false;
          nor.set(normals.subarray(src * 3, src * 3 + 3), dst * 3);
          col.set(colors.subarray(src * 3, src * 3 + 3), dst * 3);
        }
      }
      // chunks that are entirely deep sea floor are invisible under opaque water
      if (skip) continue;
      const idx = new Uint32Array((w - 1) * (d - 1) * 6);
      let k = 0;
      for (let j = 0; j < d - 1; j++) {
        for (let i = 0; i < w - 1; i++) {
          const a = j * w + i;
          const b2 = a + 1;
          const c = a + w;
          const e = c + 1;
          // alternate diagonals for a less directional lattice
          if ((i + j) & 1) {
            idx[k++] = a; idx[k++] = c; idx[k++] = b2;
            idx[k++] = b2; idx[k++] = c; idx[k++] = e;
          } else {
            idx[k++] = a; idx[k++] = c; idx[k++] = e;
            idx[k++] = a; idx[k++] = e; idx[k++] = b2;
          }
        }
      }
      const geo = new BufferGeometry();
      geo.setAttribute('position', new BufferAttribute(pos, 3));
      geo.setAttribute('normal', new BufferAttribute(nor, 3));
      geo.setAttribute('color', new BufferAttribute(col, 3));
      geo.setIndex(new BufferAttribute(idx, 1));
      geo.computeBoundingSphere();
      geo.computeBoundingBox();
      const m = new Mesh(geo, mat);
      m.receiveShadow = true;
      m.castShadow = true;
      g.add(m);
    }
  }
  return g;
}

/** 8-bit height raster for the water shader (depth tint, shore foam) */
export function buildHeightTexture(f: TerrainField): DataTexture {
  const data = new Uint8Array(f.nx * f.nz);
  for (let i = 0; i < data.length; i++) data[i] = Math.max(0, Math.min(255, Math.round((f.heights[i] - H_MIN) * 255)));
  const tex = new DataTexture(data, f.nx, f.nz, RedFormat, UnsignedByteType);
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearFilter;
  tex.needsUpdate = true;
  return tex;
}
