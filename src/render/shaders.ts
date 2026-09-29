// Shared GLSL + uniforms: per-tile state texture lookups (fog of war, territory, highlights), hex grid,
// and material patchers for the terrain and all model materials.
import { Color, DataTexture, type MeshStandardMaterial, Vector2, Vector3, Vector4 } from 'three';
import type { WebGLProgramParametersWithUniforms } from 'three';
import { GLSL_NOISE } from './noise';

export const MAX_OWNERS = 8;

/** highlight codes written into the highlight texture (R channel) */
export const HI = { none: 0, city: 1, move: 2, improve: 3, target: 4, attack: 5, selected: 6 } as const;

export interface SharedUniforms {
  uTime: { value: number };
  uTileState: { value: DataTexture | null };
  uTileHi: { value: DataTexture | null };
  uMapSize: { value: Vector2 };
  uOwnerColors: { value: Vector3[] };
  uHiColors: { value: Vector3[] };
  uGrid: { value: number };
  uFogVoid: { value: Color };
  uSunDir: { value: Vector3 };
  uSky: { value: Color };
  uShallow: { value: Color };
  uDeep: { value: Color };
  uCloud: { value: Color };
  uCloudShadow: { value: Color };
  uHeightTex: { value: DataTexture | null };
  /** scene haze color + (near, far) distances, for custom shaders outside three's fog */
  uHaze: { value: Color };
  uHazeRange: { value: Vector2 };
  /** heightfield texture mapping: xz origin + size in world units */
  uHeightRect: { value: Vector4 };
}

export const U: SharedUniforms = {
  uTime: { value: 0 },
  uTileState: { value: null },
  uTileHi: { value: null },
  uMapSize: { value: new Vector2(1, 1) },
  uOwnerColors: { value: Array.from({ length: MAX_OWNERS }, () => new Vector3(1, 1, 1)) },
  uHiColors: {
    value: [
      new Vector3(0, 0, 0),
      new Vector3(1.0, 0.86, 0.45), // city
      new Vector3(0.22, 0.6, 1.0), // move
      new Vector3(0.55, 0.95, 0.45), // improve
      new Vector3(0.78, 0.5, 1.0), // target
      new Vector3(1.0, 0.24, 0.2), // attack
      new Vector3(1.0, 0.95, 0.75), // selected
      new Vector3(1, 1, 1),
    ],
  },
  uGrid: { value: 0.16 },
  uFogVoid: { value: new Color('#3b3a42') },
  uSunDir: { value: new Vector3(0.4, 0.8, 0.4).normalize() },
  uSky: { value: new Color('#dfe8f0') },
  uShallow: { value: new Color('#4fd0c4') },
  uDeep: { value: new Color('#1f5f8c') },
  uCloud: { value: new Color('#ffffff') },
  uCloudShadow: { value: new Color('#a0a8b4') },
  uHeightTex: { value: null },
  uHaze: { value: new Color('#dddddd') },
  uHazeRange: { value: new Vector2(20, 60) },
  uHeightRect: { value: new Vector4(0, 0, 1, 1) },
};

/** tile lookup library: fog / borders / highlights / grid. Needs `uTileState`, `uTileHi`, `uMapSize`. */
export const GLSL_TILES = /* glsl */ `
uniform sampler2D uTileState;
uniform sampler2D uTileHi;
uniform vec2 uMapSize;
uniform vec3 uOwnerColors[${MAX_OWNERS}];
uniform vec3 uHiColors[8];
uniform float uTime;
uniform float uGrid;
uniform vec3 uFogVoid;

const vec2 AE_DIRS[6] = vec2[6](vec2(1.0, 0.0), vec2(0.5, 0.8660254), vec2(-0.5, 0.8660254), vec2(-1.0, 0.0), vec2(-0.5, -0.8660254), vec2(0.5, -0.8660254));
const ivec2 AE_AX[6] = ivec2[6](ivec2(1, 0), ivec2(0, 1), ivec2(-1, 1), ivec2(-1, 0), ivec2(0, -1), ivec2(1, -1));

struct AeCell { ivec2 ax; vec2 local; int d1; int d2; float e1; float e2; };

ivec2 aeAxial(vec2 p) {
  float q = 0.57735027 * p.x - p.y / 3.0;
  float r = 0.66666667 * p.y;
  vec3 c = vec3(q, r, -q - r);
  vec3 rc = floor(c + 0.5);
  vec3 d = abs(rc - c);
  if (d.x > d.y && d.x > d.z) rc.x = -rc.y - rc.z;
  else if (d.y > d.z) rc.y = -rc.x - rc.z;
  return ivec2(int(rc.x), int(rc.y));
}
vec2 aeCenter(ivec2 a) { return vec2(1.7320508 * (float(a.x) + float(a.y) * 0.5), 1.5 * float(a.y)); }
vec4 aeFetch(sampler2D t, ivec2 a) {
  int row = a.y;
  int col = a.x + (row - (row & 1)) / 2;
  if (col < 0 || row < 0 || col >= int(uMapSize.x) || row >= int(uMapSize.y)) return vec4(0.0);
  return texelFetch(t, ivec2(col, row), 0);
}
AeCell aeCell(vec2 p) {
  AeCell c;
  c.ax = aeAxial(p);
  c.local = p - aeCenter(c.ax);
  float f = atan(c.local.y, c.local.x) / 1.0471976;
  float fr = floor(f + 0.5);
  c.d1 = int(mod(fr, 6.0));
  c.d2 = int(mod(f > fr ? fr + 1.0 : fr - 1.0, 6.0));
  c.e1 = 0.8660254 - dot(c.local, AE_DIRS[c.d1]);
  c.e2 = 0.8660254 - dot(c.local, AE_DIRS[c.d2]);
  return c;
}
/** blended (explored, visible) at a world xz point */
vec2 aeFogAt(vec2 p) {
  AeCell c = aeCell(p);
  vec2 s0 = aeFetch(uTileState, c.ax).rg;
  vec2 s1 = aeFetch(uTileState, c.ax + AE_AX[c.d1]).rg;
  vec2 s2 = aeFetch(uTileState, c.ax + AE_AX[c.d2]).rg;
  float w1 = 1.0 - smoothstep(0.0, 0.55, c.e1);
  float w2 = 1.0 - smoothstep(0.0, 0.55, c.e2);
  return (s0 + s1 * w1 + s2 * w2) / (1.0 + w1 + w2);
}
vec3 aeApplyFog(vec3 col, vec2 fog) {
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  vec3 remembered = mix(vec3(lum), col, 0.3) * vec3(0.66, 0.68, 0.76);
  col = mix(remembered, col, clamp(fog.y, 0.0, 1.0));
  return mix(uFogVoid, col, clamp(fog.x, 0.0, 1.0));
}
int aeOwner(vec4 s) { return int(s.b * 255.0 + 0.5); }
float aeBorderProfile(float e) {
  float fill = (1.0 - smoothstep(0.04, 0.38, e));
  return fill * fill * 0.38;
}
float aeBorderLine(float e) { return smoothstep(0.11, 0.07, e) * smoothstep(0.012, 0.04, e); }
/** territory ribbon + inner gradient: rgb color, a coverage */
vec4 aeBorder(AeCell c, vec4 s0) {
  int own = aeOwner(s0);
  if (own == 0 || s0.r < 0.02) return vec4(0.0);
  vec4 s1 = aeFetch(uTileState, c.ax + AE_AX[c.d1]);
  vec4 s2 = aeFetch(uTileState, c.ax + AE_AX[c.d2]);
  float fill = 0.0;
  float line = 0.0;
  if (aeOwner(s1) != own) { fill = max(fill, aeBorderProfile(c.e1)); line = max(line, aeBorderLine(c.e1)); }
  if (aeOwner(s2) != own) { fill = max(fill, aeBorderProfile(c.e2)); line = max(line, aeBorderLine(c.e2)); }
  vec3 oc = uOwnerColors[min(own, ${MAX_OWNERS - 1})];
  float grow = s0.a;
  float flare = sin(clamp(grow, 0.0, 1.0) * 3.14159);
  vec3 col = mix(oc, vec3(1.0), line * 0.12 + flare * 0.5) * (1.0 + line * 0.35 + flare * 1.5);
  return vec4(col, max(fill, line * 0.95) * clamp(grow * 1.4, 0.0, 1.0));
}
float aeHiCode(vec4 h) { return floor(h.r * 255.0 + 0.5); }
/** highlight overlay: rgb color, a coverage */
vec4 aeHighlight(AeCell c) {
  vec4 h0 = aeFetch(uTileHi, c.ax);
  float code = aeHiCode(h0);
  if (code < 0.5) return vec4(0.0);
  float c1 = aeHiCode(aeFetch(uTileHi, c.ax + AE_AX[c.d1]));
  float c2 = aeHiCode(aeFetch(uTileHi, c.ax + AE_AX[c.d2]));
  float edge = 0.0;
  if (c1 != code) edge = max(edge, smoothstep(0.1, 0.03, c.e1));
  if (c2 != code) edge = max(edge, smoothstep(0.1, 0.03, c.e2));
  float inner = smoothstep(0.0, 0.6, min(c.e1, c.e2));
  vec3 col = uHiColors[int(code)];
  float fill = 0.26;
  if (code > 4.5 && code < 5.5) {
    float pulse = 0.5 + 0.5 * sin(uTime * 5.5);
    fill = 0.3 + 0.25 * pulse;
    edge = max(edge, smoothstep(0.14, 0.03, min(c.e1, c.e2)) * (0.6 + 0.4 * pulse));
  } else if (code > 5.5) {
    float ring = smoothstep(0.2, 0.05, min(c.e1, c.e2));
    fill = 0.14 + 0.08 * sin(uTime * 3.0);
    edge = max(edge, ring);
  } else if (code < 1.5) {
    fill = 0.1;
  }
  float a = mix(fill * (1.0 - 0.45 * inner), 0.95, edge) * h0.g;
  return vec4(col, a);
}
float aeGridLine(AeCell c) {
  float e = min(c.e1, c.e2);
  float w = fwidth(e) * 1.2 + 0.012;
  return 1.0 - smoothstep(w * 0.5, w * 1.5, e);
}
`;

/** Terrain: vertex colors + territory + highlights + grid + fog of war. */
export function patchTerrainMaterial(mat: MeshStandardMaterial): void {
  mat.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, U);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vAeWorld;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvAeWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vAeWorld;\n${GLSL_NOISE}\n${GLSL_TILES}`)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec2 aeP = vAeWorld.xz;
        vec2 aeWarp = aeP + (vec2(aeNoise(aeP * 1.7), aeNoise(aeP * 1.7 + 9.3)) - 0.5) * 0.28;
        AeCell aeC = aeCell(aeP);
        vec4 aeS0 = aeFetch(uTileState, aeC.ax);
        vec2 aeFog = aeFogAt(aeWarp);
        float aeGrid = aeGridLine(aeC) * uGrid * smoothstep(-0.05, 0.04, vAeWorld.y);
        // painterly ground detail: macro patches + fine speckle on land (fades with distance)
        #ifndef AE_LOW
        if (vAeWorld.y > 0.02) {
          float dfade = 1.0 - smoothstep(18.0, 40.0, length(cameraPosition - vAeWorld));
          float macro = aeFbm(aeP * 0.55) - 0.5;
          float fine = aeNoise(aeP * 9.0) * 0.6 + aeNoise(aeP * 23.0) * 0.4 - 0.5;
          diffuseColor.rgb *= 1.0 + macro * 0.22 + fine * 0.14 * dfade;
          float tuft = smoothstep(0.62, 0.8, aeNoise(aeP * 4.3 + 7.0));
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.82, 0.9, 0.72), tuft * 0.35 * dfade);
        }
        #endif
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.55 + vec3(0.06), aeGrid);
        vec4 aeB = aeBorder(aeC, aeS0);
        vec4 aeH = aeHighlight(aeC);`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        diffuseColor.rgb = mix(diffuseColor.rgb, aeB.rgb * 0.8, aeB.a * 0.55);
        totalEmissiveRadiance += aeB.rgb * aeB.a * 0.35;
        diffuseColor.rgb = mix(diffuseColor.rgb, aeH.rgb * 0.8, aeH.a * 0.5);
        totalEmissiveRadiance += aeH.rgb * aeH.a * 0.28;`,
      )
      .replace('#include <opaque_fragment>', 'outgoingLight = aeApplyFog(outgoingLight, aeFog);\n#include <opaque_fragment>');
  };
  mat.customProgramCacheKey = () => 'ae-terrain';
}

export interface ModelPatchOpts {
  /** wind sway for foliage */
  sway?: boolean;
  /** per-object uniforms (units): team colors, hit flash, dissolve */
  perObject?: boolean;
}

export interface ModelUniforms {
  uTeamA: { value: Color };
  uTeamB: { value: Color };
  uFlash: { value: number };
  uDissolve: { value: number };
}

export function makeModelUniforms(): ModelUniforms {
  return {
    uTeamA: { value: new Color(1, 1, 1) },
    uTeamB: { value: new Color(0.3, 0.3, 0.3) },
    uFlash: { value: 0 },
    uDissolve: { value: 0 },
  };
}

/**
 * Model material: baked vertex colors, team tint (attribute `aTeam`: 0 none, 1 primary, 2 dark;
 * per-instance `iTeamA`/`iTeamB` or per-object uniforms), emissive attribute `aEmit`, fog of war.
 */
export function patchModelMaterial(mat: MeshStandardMaterial, opts: ModelPatchOpts, mu?: ModelUniforms): void {
  const key = `ae-model-${opts.sway ? 's' : ''}${opts.perObject ? 'o' : ''}`;
  mat.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, U);
    if (mu) Object.assign(shader.uniforms, mu);
    const perObj = !!opts.perObject;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float aTeam;
        attribute vec3 aEmit;
        varying vec3 vAeWorld;
        varying vec3 vAeEmit;
        ${perObj ? 'uniform vec3 uTeamA; uniform vec3 uTeamB;' : '#ifdef USE_INSTANCING\nattribute vec3 iTeamA; attribute vec3 iTeamB;\n#endif'}
        uniform float uTime;`,
      )
      .replace(
        '#include <color_vertex>',
        `#include <color_vertex>
        vAeEmit = aEmit;
        {
          vec3 ta = vec3(1.0); vec3 tb = vec3(0.35);
          ${perObj ? 'ta = uTeamA; tb = uTeamB;' : '#ifdef USE_INSTANCING\nta = iTeamA; tb = iTeamB;\n#endif'}
          if (aTeam > 0.5 && aTeam < 1.5) vColor.rgb = ta;
          else if (aTeam > 1.5) vColor.rgb = tb;
        }`,
      )
      .replace(
        '#include <begin_vertex>',
        opts.sway
          ? `#include <begin_vertex>
          {
            vec3 ip = vec3(0.0);
            #ifdef USE_INSTANCING
            ip = instanceMatrix[3].xyz;
            #endif
            float ph = uTime * 1.7 + ip.x * 0.9 + ip.z * 1.3;
            float k = max(transformed.y, 0.0);
            transformed.x += sin(ph) * 0.045 * k * k * 4.0;
            transformed.z += cos(ph * 0.83) * 0.03 * k * k * 4.0;
          }`
          : '#include <begin_vertex>',
      )
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        {
          vec4 wp = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
          wp = instanceMatrix * wp;
          #endif
          vAeWorld = (modelMatrix * wp).xyz;
        }`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vAeWorld;
        varying vec3 vAeEmit;
        ${perObj ? 'uniform float uFlash; uniform float uDissolve;' : ''}
        ${GLSL_NOISE}
        ${GLSL_TILES}`,
      )
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
        ${perObj ? 'float aeDn = aeNoise(vAeWorld.xz * 22.0 + vAeWorld.y * 17.0); if (uDissolve > 0.0 && aeDn < uDissolve) discard;' : ''}`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        totalEmissiveRadiance += vAeEmit;
        ${perObj ? 'totalEmissiveRadiance += vec3(1.0, 0.95, 0.85) * uFlash; if (uDissolve > 0.0) totalEmissiveRadiance += vec3(1.0, 0.55, 0.2) * smoothstep(uDissolve + 0.12, uDissolve, aeDn) * 3.0;' : ''}`,
      )
      .replace(
        '#include <opaque_fragment>',
        `${perObj ? '' : 'outgoingLight = aeApplyFog(outgoingLight, aeFogAt(vAeWorld.xz));'}
        #include <opaque_fragment>`,
      );
  };
  mat.customProgramCacheKey = () => key;
}
