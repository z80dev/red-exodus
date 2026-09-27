// Stylized water: depth tint from the terrain height raster (turquoise shallows → deep blue), animated
// normal waves, shoreline foam + incoming foam lines, fresnel sky reflection, sun glitter, and the same
// territory / highlight / fog overlays as the terrain.
import { Mesh, MeshStandardMaterial, PlaneGeometry } from 'three';
import type { WebGLProgramParametersWithUniforms } from 'three';
import { GLSL_NOISE } from './noise';
import { GLSL_TILES, U } from './shaders';
import { H_MIN } from './terrain';

export function createWater(cx: number, cz: number, size: number): Mesh {
  const geo = new PlaneGeometry(size, size, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const mat = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.16, metalness: 0 });
  mat.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, U);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vAeWorld;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvAeWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vAeWorld;
        uniform sampler2D uHeightTex;
        uniform vec4 uHeightRect;
        uniform vec3 uShallow;
        uniform vec3 uDeep;
        uniform vec3 uSky;
        uniform vec3 uSunDir;
        ${GLSL_NOISE}
        ${GLSL_TILES}
        float aeGround(vec2 p) {
          vec2 uv = (p - uHeightRect.xy) / uHeightRect.zw;
          if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return -0.62;
          return texture2D(uHeightTex, uv).r + ${H_MIN.toFixed(3)};
        }
        vec2 aeWaveGrad(vec2 p, float t) {
          vec2 e = vec2(0.06, 0.0);
          vec2 q1 = p * 1.3 + vec2(t * 0.07, t * 0.05);
          vec2 q2 = p * 2.9 - vec2(t * 0.09, -t * 0.06);
          float n = aeNoise(q1) + 0.5 * aeNoise(q2);
          float nx = aeNoise(q1 + e.xy) + 0.5 * aeNoise(q2 + e.xy);
          float nz = aeNoise(q1 + e.yx) + 0.5 * aeNoise(q2 + e.yx);
          return vec2(nx - n, nz - n) / 0.06;
        }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec2 aeP = vAeWorld.xz;
        float aeG = aeGround(aeP);
        float depth = max(0.0, -aeG);
        vec3 wc = mix(uShallow * 1.08, uDeep, smoothstep(0.03, 0.55, depth));
        wc = mix(wc, uDeep * 0.7, smoothstep(0.55, 0.9, depth) * 0.6);
        // shimmering caustic-like mottling in shallows
        #ifndef AE_LOW
        float caust = aeNoise(aeP * 3.2 + vec2(uTime * 0.15, -uTime * 0.11)) * aeNoise(aeP * 2.1 - vec2(uTime * 0.12, uTime * 0.1));
        wc += vec3(0.12, 0.18, 0.16) * smoothstep(0.2, 0.45, caust) * (1.0 - smoothstep(0.05, 0.35, depth));
        #endif
        // foam: solid lip at the shore + lines rolling toward it
        float nf = aeNoise(aeP * 5.0 + uTime * 0.2);
        float lip = 1.0 - smoothstep(0.012, 0.05 + nf * 0.03, depth);
        float lines = smoothstep(0.82, 0.97, sin(depth * 70.0 - uTime * 2.3 + nf * 3.0)) * (1.0 - smoothstep(0.05, 0.16, depth)) * step(0.004, depth);
        float foam = clamp(lip + lines * 0.7, 0.0, 1.0) * smoothstep(0.35, 0.6, aeNoise(aeP * 9.0 - uTime * 0.3) * 0.4 + 0.6);
        diffuseColor.rgb = mix(wc, vec3(0.97, 0.99, 1.0), foam * 0.9);
        AeCell aeC = aeCell(aeP);
        vec4 aeS0 = aeFetch(uTileState, aeC.ax);
        vec2 aeWarp = aeP + (vec2(aeNoise(aeP * 1.7), aeNoise(aeP * 1.7 + 9.3)) - 0.5) * 0.28;
        vec2 aeFog = aeFogAt(aeWarp);
        float aeGrid = aeGridLine(aeC) * uGrid * 0.5;
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.7 + vec3(0.08), aeGrid);
        vec4 aeB = aeBorder(aeC, aeS0);
        vec4 aeH = aeHighlight(aeC);`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        #ifdef AE_LOW
        vec2 wg = aeWaveGrad(aeP, uTime) * 0.1;
        #else
        vec2 wg = aeWaveGrad(aeP, uTime) * 0.09 + aeWaveGrad(aeP * 2.3 + 11.0, uTime * 1.3) * 0.04;
        #endif
        vec3 wn = normalize(vec3(-wg.x, 1.0, -wg.y));
        normal = normalize((viewMatrix * vec4(wn, 0.0)).xyz);`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          vec3 V = normalize(cameraPosition - vAeWorld);
          float fres = pow(1.0 - max(dot(wn, V), 0.0), 3.0);
          totalEmissiveRadiance += uSky * fres * 0.55 * (1.0 - foam);
          vec3 R = reflect(-V, wn);
          float sunDot = max(dot(R, normalize(uSunDir)), 0.0);
          float glitter = smoothstep(0.93, 0.99, aeNoise(aeP * 18.0 + vec2(uTime * 0.8, -uTime * 0.6))) * pow(sunDot, 24.0);
          totalEmissiveRadiance += vec3(1.0, 0.97, 0.9) * (glitter * 0.35 + pow(sunDot, 180.0) * 0.6) * (1.0 - foam);
          diffuseColor.rgb = mix(diffuseColor.rgb, aeB.rgb * 0.8, aeB.a * 0.5);
          totalEmissiveRadiance += aeB.rgb * aeB.a * 0.35;
          diffuseColor.rgb = mix(diffuseColor.rgb, aeH.rgb, aeH.a * 0.6);
          totalEmissiveRadiance += aeH.rgb * aeH.a * 0.5;
        }`,
      )
      .replace('#include <opaque_fragment>', 'outgoingLight = aeApplyFog(outgoingLight, aeFog);\n#include <opaque_fragment>');
  };
  mat.customProgramCacheKey = () => 'ae-water';
  const mesh = new Mesh(geo, mat);
  mesh.position.set(cx, 0, cz);
  mesh.receiveShadow = true;
  mesh.renderOrder = 1;
  mesh.name = 'water';
  return mesh;
}
