// Shared GLSL + uniforms: per-tile state texture lookups (fog of war, territory, highlights, storm cover),
// hex grid, and material patchers for the terrain and all model materials.
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
  /** sky dome zenith + blue sunset halo */
  uSkyTop: { value: Color };
  uSunset: { value: Color };
  /** dust seas: crest/shallows and trough/deep colors */
  uDustHi: { value: Color };
  uDustLo: { value: Color };
  uBrine: { value: Color };
  /** terraforming progress 0..1 (era arc) */
  uTerraform: { value: number };
  uLichenA: { value: Color };
  uLichenB: { value: Color };
  uCloud: { value: Color };
  uCloudShadow: { value: Color };
  /** dust storm puff colors, the dust tint cast on storm-covered ground, lightning flash 0..1 */
  uStormLit: { value: Color };
  uStormDark: { value: Color };
  uStormFlash: { value: number };
  /** R: height (H_MIN-based), G: brine lake weight */
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
  uSky: { value: new Color('#d49a72') },
  uSkyTop: { value: new Color('#c07e56') },
  uSunset: { value: new Color('#86a9cf') },
  uDustHi: { value: new Color('#b0602f') },
  uDustLo: { value: new Color('#5e2912') },
  uBrine: { value: new Color('#3f8f8a') },
  uTerraform: { value: 0 },
  uLichenA: { value: new Color('#c77b2c') },
  uLichenB: { value: new Color('#8a9a3b') },
  uCloud: { value: new Color('#cf9a70') },
  uCloudShadow: { value: new Color('#6b3a26') },
  uStormLit: { value: new Color('#d49a62') },
  uStormDark: { value: new Color('#4f2414') },
  uStormFlash: { value: 0 },
  uHeightTex: { value: null },
  uHaze: { value: new Color('#dddddd') },
  uHazeRange: { value: new Vector2(20, 60) },
  uHeightRect: { value: new Vector4(0, 0, 1, 1) },
};

/** tile lookup library: fog / borders / highlights / grid / storm cover. Needs `uTileState`, `uTileHi`, `uMapSize`. */
export const GLSL_TILES = /* glsl */ `
uniform sampler2D uTileState;
uniform sampler2D uTileHi;
uniform vec2 uMapSize;
uniform vec3 uOwnerColors[${MAX_OWNERS}];
uniform vec3 uHiColors[8];
uniform float uTime;
uniform float uGrid;
uniform vec3 uFogVoid;
uniform vec3 uStormDark;
uniform vec3 uStormLit;
uniform float uStormFlash;

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
  // remembered ground: dusted over, desaturated toward dim rust
  vec3 remembered = mix(vec3(lum), col, 0.3) * vec3(0.72, 0.62, 0.58);
  col = mix(remembered, col, clamp(fog.y, 0.0, 1.0));
  return mix(uFogVoid, col, clamp(fog.x, 0.0, 1.0));
}
/** storm cover (density, lightning) blended across hex edges */
vec2 aeStormCell(AeCell c) {
  vec2 s0 = aeFetch(uTileHi, c.ax).ba;
  vec2 s1 = aeFetch(uTileHi, c.ax + AE_AX[c.d1]).ba;
  vec2 s2 = aeFetch(uTileHi, c.ax + AE_AX[c.d2]).ba;
  float w1 = 1.0 - smoothstep(0.0, 0.75, c.e1);
  float w2 = 1.0 - smoothstep(0.0, 0.75, c.e2);
  return (s0 + s1 * w1 + s2 * w2) / (1.0 + w1 + w2);
}
/** light seen through a dust storm: dimmed, rust-tinted, swept by wind-driven dust sheets, lit by lightning */
vec3 aeStorm(vec3 col, vec2 s, vec2 p) {
  if (s.x < 0.004) return col;
  float sweep = aeNoise(p * 1.1 + vec2(uTime * 0.9, uTime * 0.3)) * 0.6 + aeNoise(p * 2.9 + vec2(uTime * 1.7, uTime * 0.6)) * 0.4;
  float k = clamp(s.x * (0.5 + 0.35 * sweep), 0.0, 0.92);
  col = mix(col, col * vec3(0.5, 0.36, 0.28) + mix(uStormDark, uStormLit, sweep) * 0.2, k);
  return col + vec3(0.7, 0.78, 1.0) * uStormFlash * s.y * (0.2 + 0.3 * sweep);
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

/**
 * Terrain: vertex colors + Mars ground detail (wind streaks, basalt grit), terraforming (lichen creeping into
 * basins via `aMars.x`, brine lakes widening via `aMars.y`), territory, highlights, grid, storm cover, fog.
 */
export function patchTerrainMaterial(mat: MeshStandardMaterial): void {
  mat.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, U);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aMars;\nvarying vec2 vAeMars;\nvarying vec3 vAeWorld;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvAeMars = aMars;\nvAeWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vAeWorld;
        varying vec2 vAeMars;
        uniform float uTerraform;
        uniform vec3 uLichenA;
        uniform vec3 uLichenB;
        uniform vec3 uBrine;
        uniform vec3 uSunDir;
        ${GLSL_NOISE}
        ${GLSL_TILES}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec2 aeP = vAeWorld.xz;
        vec2 aeWarp = aeP + (vec2(aeNoise(aeP * 1.7), aeNoise(aeP * 1.7 + 9.3)) - 0.5) * 0.28;
        AeCell aeC = aeCell(aeP);
        vec4 aeS0 = aeFetch(uTileState, aeC.ax);
        vec2 aeFog = aeFogAt(aeWarp);
        float aeGrid = aeGridLine(aeC) * uGrid * smoothstep(-0.05, 0.04, vAeWorld.y);
        float aeLand = smoothstep(0.0, 0.04, vAeWorld.y);
        // ground detail: macro mottling, fine grit, pale wind streaks of fines, dark basalt pebbles
        #ifndef AE_LOW
        if (vAeWorld.y > 0.02) {
          float dfade = 1.0 - smoothstep(18.0, 40.0, length(cameraPosition - vAeWorld));
          float macro = aeFbm(aeP * 0.55) - 0.5;
          float fine = aeNoise(aeP * 9.0) * 0.6 + aeNoise(aeP * 23.0) * 0.4 - 0.5;
          diffuseColor.rgb *= 1.0 + macro * 0.24 + fine * 0.16 * dfade;
          vec2 wq = vec2(dot(aeP, vec2(0.83, 0.55)), dot(aeP, vec2(-0.55, 0.83)));
          float streak = aeNoise(vec2(wq.x * 0.32, wq.y * 3.4)) * 0.7 + aeNoise(vec2(wq.x * 0.9, wq.y * 7.0)) * 0.3;
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.16, 1.08, 0.97), smoothstep(0.58, 0.84, streak) * 0.55);
          float peb = smoothstep(0.8, 0.92, aeNoise(aeP * 15.0 + 3.0));
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.58, peb * 0.45 * dfade);
        }
        #endif
        // terraforming: engineered lichen creeps through the clay basins (orange first, greening later)
        float aeGrow = uTerraform * vAeMars.x * aeLand;
        if (aeGrow > 0.005) {
          float patchN = aeFbm(aeP * 0.85 + 3.7) + vAeMars.x * 0.18;
          float cover = smoothstep(1.02 - aeGrow * 0.4, 1.12 - aeGrow * 0.4, patchN);
          vec3 lich = mix(uLichenA, uLichenB, clamp(uTerraform * 1.3 - 0.15 + (aeNoise(aeP * 2.3) - 0.5) * 0.8, 0.0, 1.0));
          lich *= 0.65 + 0.35 * aeNoise(aeP * 7.5);
          diffuseColor.rgb = mix(diffuseColor.rgb, lich, cover * 0.8);
        }
        // brine lakes swell as the planet warms: low shore ground turns to glassy teal
        float aeBrineEdge = mix(1.2, 0.26, uTerraform);
        float aeBrine = smoothstep(aeBrineEdge, aeBrineEdge + 0.08, vAeMars.y) * (1.0 - smoothstep(0.14, 0.3, vAeWorld.y));
        float aeSalt = smoothstep(aeBrineEdge - 0.1, aeBrineEdge, vAeMars.y) * (1.0 - aeBrine) * step(0.01, uTerraform) * (1.0 - smoothstep(0.14, 0.3, vAeWorld.y));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.84, 0.8), aeSalt * 0.55);
        diffuseColor.rgb = mix(diffuseColor.rgb, uBrine * 0.5, aeBrine);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.55 + vec3(0.06), aeGrid);
        vec4 aeB = aeBorder(aeC, aeS0);
        vec4 aeH = aeHighlight(aeC);`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          vec3 V = normalize(cameraPosition - vAeWorld);
          float fres = pow(1.0 - max(V.y, 0.0), 2.0);
          float glint = pow(max(dot(reflect(-V, vec3(0.0, 1.0, 0.0)), uSunDir), 0.0), 60.0);
          totalEmissiveRadiance += (uBrine * (0.04 + fres * 0.12) + vec3(1.0, 0.96, 0.9) * glint * 0.35) * aeBrine;
        }
        diffuseColor.rgb = mix(diffuseColor.rgb, aeB.rgb * 0.8, aeB.a * 0.55);
        totalEmissiveRadiance += aeB.rgb * aeB.a * 0.35;
        diffuseColor.rgb = mix(diffuseColor.rgb, aeH.rgb * 0.8, aeH.a * 0.5);
        totalEmissiveRadiance += aeH.rgb * aeH.a * 0.28;`,
      )
      .replace('#include <opaque_fragment>', 'outgoingLight = aeApplyFog(aeStorm(outgoingLight, aeStormCell(aeC), aeP), aeFog);\n#include <opaque_fragment>');
  };
  mat.customProgramCacheKey = () => 'ae-terrain';
}

export interface ModelPatchOpts {
  /** per-object uniforms (units, drop pods): team colors, hit flash, dissolve */
  perObject?: boolean;
}

export interface ModelUniforms {
  uTeamA: { value: Color };
  uTeamB: { value: Color };
  uFlash: { value: number };
  /** emissive color of `uFlash` (white hit flash; drop pods glow re-entry orange) */
  uFlashColor: { value: Color };
  uDissolve: { value: number };
}

export function makeModelUniforms(): ModelUniforms {
  return {
    uTeamA: { value: new Color(1, 1, 1) },
    uTeamB: { value: new Color(0.3, 0.3, 0.3) },
    uFlash: { value: 0 },
    uFlashColor: { value: new Color(1.0, 0.95, 0.85) },
    uDissolve: { value: 0 },
  };
}

/**
 * Model material: baked vertex colors, team tint (attribute `aTeam`: 0 none, 1 primary, 2 dark;
 * per-instance `iTeamA`/`iTeamB` or per-object uniforms), emissive attribute `aEmit`, storm cover, fog of war.
 */
export function patchModelMaterial(mat: MeshStandardMaterial, opts: ModelPatchOpts, mu?: ModelUniforms): void {
  const key = `ae-model-${opts.perObject ? 'o' : ''}`;
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
        ${perObj ? 'uniform vec3 uTeamA; uniform vec3 uTeamB;' : '#ifdef USE_INSTANCING\nattribute vec3 iTeamA; attribute vec3 iTeamB;\n#endif'}`,
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
        ${perObj ? 'uniform float uFlash; uniform vec3 uFlashColor; uniform float uDissolve;' : ''}
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
        ${perObj ? 'totalEmissiveRadiance += uFlashColor * uFlash; if (uDissolve > 0.0) totalEmissiveRadiance += vec3(1.0, 0.55, 0.2) * smoothstep(uDissolve + 0.12, uDissolve, aeDn) * 3.0;' : ''}`,
      )
      .replace(
        '#include <opaque_fragment>',
        `outgoingLight = aeStorm(outgoingLight, aeFetch(uTileHi, aeAxial(vAeWorld.xz)).ba, vAeWorld.xz);
        ${perObj ? '' : 'outgoingLight = aeApplyFog(outgoingLight, aeFogAt(vAeWorld.xz));'}
        #include <opaque_fragment>`,
      );
  };
  mat.customProgramCacheKey = () => key;
}
