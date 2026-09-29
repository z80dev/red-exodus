// The planet's "liquid" layer at y = 0. Dust Seas / Dust Shallows: basins of ultrafine dust that roll in soft,
// wind-driven dune swells (darker troughs, lighter crests, pale drifting sheets of fines, a soft dust lip rolling
// onto shore) and are matte — no specular, no foam. Brine Lakes (height texture G channel): glassy teal with a
// fresnel sheen, sun glint and a white salt rim. Same territory / highlight / storm / fog overlays as the terrain.
import { Mesh, MeshStandardMaterial, PlaneGeometry } from 'three';
import type { WebGLProgramParametersWithUniforms } from 'three';
import { GLSL_NOISE } from './noise';
import { GLSL_TILES, U } from './shaders';
import { H_MIN } from './terrain';

export function createWater(cx: number, cz: number, size: number): Mesh {
  const geo = new PlaneGeometry(size, size, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const mat = new MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 });
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
        uniform vec3 uDustHi;
        uniform vec3 uDustLo;
        uniform vec3 uBrine;
        uniform vec3 uSky;
        uniform vec3 uSunDir;
        uniform float uTerraform;
        ${GLSL_NOISE}
        ${GLSL_TILES}
        vec2 aeGroundLake(vec2 p) {
          vec2 uv = (p - uHeightRect.xy) / uHeightRect.zw;
          if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return vec2(-0.62, 0.0);
          vec2 s = texture2D(uHeightTex, uv).rg;
          return vec2(s.r + ${H_MIN.toFixed(3)}, s.g);
        }
        // wind-aligned dune swells: long soft crests with a steeper lee face, drifting slowly downwind
        const vec2 AE_WIND = vec2(0.83, 0.55);
        float aeSwell(vec2 p, float t) {
          vec2 q = vec2(dot(p, AE_WIND), dot(p, vec2(-AE_WIND.y, AE_WIND.x)));
          float bend = aeNoise(q * vec2(0.18, 0.35) + 4.0) * 2.4;
          float ph = q.x * 1.25 + bend - t * 0.22;
          float crest = fract(ph);
          float dune = smoothstep(0.0, 0.72, crest) * (1.0 - smoothstep(0.72, 1.0, crest));
          float swirl = aeNoise(p * 0.45 + vec2(-t * 0.03, t * 0.02));
          return dune * (0.55 + 0.45 * swirl) + (aeNoise(p * 1.7 + vec2(t * 0.05, 0.0)) - 0.5) * 0.25;
        }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec2 aeP = vAeWorld.xz;
        vec2 aeGL = aeGroundLake(aeP);
        float depth = max(0.0, -aeGL.x);
        float aeLake = smoothstep(0.35, 0.6, aeGL.y);
        float t = uTime;
        // ── dust sea ──
        float sw = aeSwell(aeP, t);
        vec3 dust = mix(uDustLo, uDustHi, 0.3 + 0.7 * smoothstep(-0.2, 1.1, sw));
        // shallows are lighter, finer and paler; the deep basin sinks to dark troughs
        float shallow = 1.0 - smoothstep(0.02, 0.45, depth);
        dust = mix(dust, mix(uDustHi, vec3(0.85, 0.55, 0.32), 0.35) * (0.92 + 0.12 * sw), shallow * 0.75);
        dust *= mix(0.78, 1.0, smoothstep(0.7, 0.3, depth));
        #ifndef AE_LOW
        // drifting sheets of fines skimming the surface
        vec2 wq = vec2(dot(aeP, AE_WIND), dot(aeP, vec2(-AE_WIND.y, AE_WIND.x)));
        float sheet = aeNoise(vec2(wq.x * 0.5 - t * 0.35, wq.y * 2.6)) * aeNoise(vec2(wq.x * 0.23 - t * 0.2, wq.y * 1.1 + 5.0));
        dust = mix(dust, uDustHi * 1.25, smoothstep(0.3, 0.62, sheet) * 0.28);
        dust *= 0.94 + 0.12 * aeNoise(aeP * 11.0 + vec2(t * 0.3, 0.0));
        #endif
        // soft dust lip rolling onto the shore (no foam: slow pale surges that fade in and out)
        float nf = aeNoise(aeP * 4.0 + t * 0.15);
        float lip = 1.0 - smoothstep(0.012, 0.06 + nf * 0.04, depth);
        float surge = smoothstep(0.55, 0.95, sin(depth * 38.0 - t * 1.1 + nf * 3.0)) * (1.0 - smoothstep(0.04, 0.18, depth)) * step(0.004, depth);
        dust = mix(dust, uDustHi * 1.35, clamp(lip * 0.8 + surge * 0.3, 0.0, 1.0));
        // ── brine lake ──
        vec3 brine = mix(uBrine * 1.15, uBrine * 0.55, smoothstep(0.02, 0.3, depth));
        float salt = (1.0 - smoothstep(0.008, 0.04 + nf * 0.02, depth));
        brine = mix(brine, vec3(0.9, 0.88, 0.84), salt * 0.85);
        diffuseColor.rgb = mix(dust, brine, aeLake);
        AeCell aeC = aeCell(aeP);
        vec4 aeS0 = aeFetch(uTileState, aeC.ax);
        vec2 aeWarp = aeP + (vec2(aeNoise(aeP * 1.7), aeNoise(aeP * 1.7 + 9.3)) - 0.5) * 0.28;
        vec2 aeFog = aeFogAt(aeWarp);
        float aeGrid = aeGridLine(aeC) * uGrid * 0.5;
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.7 + vec3(0.06), aeGrid);
        vec4 aeB = aeBorder(aeC, aeS0);
        vec4 aeH = aeHighlight(aeC);`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        vec3 wn;
        {
          // dust: broad swell normals; brine: faint ripples
          vec2 e = vec2(0.08, 0.0);
          float s0 = aeSwell(aeP, t);
          vec2 g = vec2(aeSwell(aeP + e.xy, t) - s0, aeSwell(aeP + e.yx, t) - s0) / 0.08;
          g *= 0.09 * (1.0 - aeLake) * mix(0.35, 1.0, smoothstep(0.03, 0.3, depth));
          float r0 = aeNoise(aeP * 3.0 + vec2(t * 0.1, -t * 0.08));
          vec2 rg = vec2(aeNoise(aeP * 3.0 + vec2(t * 0.1 + 0.05, -t * 0.08)) - r0, aeNoise(aeP * 3.0 + vec2(t * 0.1, -t * 0.08 + 0.05)) - r0) / 0.05;
          g += rg * 0.02 * aeLake;
          wn = normalize(vec3(-g.x, 1.0, -g.y));
          normal = normalize((viewMatrix * vec4(wn, 0.0)).xyz);
        }`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        if (aeLake > 0.01) {
          vec3 V = normalize(cameraPosition - vAeWorld);
          float fres = pow(1.0 - max(dot(wn, V), 0.0), 3.0);
          vec3 R = reflect(-V, wn);
          float sunDot = max(dot(R, normalize(uSunDir)), 0.0);
          vec3 sheen = mix(uSky, uBrine * 1.4, 0.6) * fres * 0.18 + vec3(1.0, 0.97, 0.9) * pow(sunDot, 90.0) * 0.8;
          totalEmissiveRadiance += (sheen + uBrine * (0.03 + 0.06 * uTerraform)) * aeLake * (1.0 - salt);
        }
        diffuseColor.rgb = mix(diffuseColor.rgb, aeB.rgb * 0.8, aeB.a * 0.5);
        totalEmissiveRadiance += aeB.rgb * aeB.a * 0.35;
        diffuseColor.rgb = mix(diffuseColor.rgb, aeH.rgb, aeH.a * 0.6);
        totalEmissiveRadiance += aeH.rgb * aeH.a * 0.5;`,
      )
      .replace('#include <opaque_fragment>', 'outgoingLight = aeApplyFog(aeStorm(outgoingLight, aeStormCell(aeC), aeP), aeFog);\n#include <opaque_fragment>');
  };
  mat.customProgramCacheKey = () => 'ae-dustsea';
  const mesh = new Mesh(geo, mat);
  mesh.position.set(cx, 0, cz);
  mesh.receiveShadow = true;
  mesh.renderOrder = 1;
  mesh.name = 'dust-sea';
  return mesh;
}
