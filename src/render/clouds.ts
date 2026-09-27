// Fog of war clouds: two drifting fbm layers over unexplored tiles (and beyond the map edge). Coverage is
// sampled at the ground point along the view ray so the cloud edge lines up with the terrain's fog edge,
// while the layer heights give parallax. Self-shading from the sun direction fakes volume.
import { DoubleSide, Group, Mesh, PlaneGeometry, ShaderMaterial } from 'three';
import { GLSL_NOISE } from './noise';
import { GLSL_TILES, U } from './shaders';

const VERT = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

function frag(layer: number): string {
  const scale = layer === 0 ? 0.2 : 0.12;
  const speed = layer === 0 ? 0.045 : 0.07;
  const opacity = layer === 0 ? 1.0 : 0.55;
  return /* glsl */ `
  varying vec3 vWorld;
  uniform vec3 uCloud;
  uniform vec3 uCloudShadow;
  uniform vec3 uSunDir;
  ${GLSL_NOISE}
  ${GLSL_TILES}
  void main() {
    vec3 V = normalize(vWorld - cameraPosition);
    float groundY = 0.15;
    vec2 gp = vWorld.xz + V.xz * ((groundY - vWorld.y) / min(V.y, -0.05));
    vec2 drift = vec2(uTime * ${speed.toFixed(3)}, uTime * ${(speed * 0.6).toFixed(3)});
    float warp = (aeNoise(gp * 1.3 + drift * 3.0) - 0.5) * 0.45;
    float explored = aeFogAt(gp + vec2(warp, -warp) * 0.8).x;
    float cover = 1.0 - explored;
    // explored ground: no cloud work at all (most of the screen mid-game)
    if (cover < 0.03) discard;
    vec2 p = vWorld.xz * ${scale.toFixed(3)} + drift;
    float n = aeFbm(p);
    vec2 sd = normalize(uSunDir.xz);
    float n2 = aeFbm(p + sd * 0.09);
    float puff = aeNoise(p * 6.0 - drift * 2.0) * 0.6 + aeNoise(p * 13.0 + 3.1) * 0.4;
    float body = n + (puff - 0.5) * 0.12;
    float a = smoothstep(0.42, 0.54, cover + (body - 0.5) * 0.8 + warp * 0.4);
    ${layer === 0 ? 'a = max(a, smoothstep(0.93, 1.0, cover) * 0.98);' : 'a *= smoothstep(0.5, 0.62, body + cover * 0.15);'}
    // soft volume: thick crowns bright, valleys & lee flanks cool; a crisp-ish terminator for the stylized look
    float thick = smoothstep(0.3, 0.72, body);
    float lee = clamp((body - n2) * 9.0, -1.0, 1.0);
    float light = clamp(0.42 + thick * 0.45 + lee * 0.35, 0.0, 1.0);
    light = mix(light, smoothstep(0.35, 0.6, light), 0.5);
    vec3 shadowC = mix(uCloudShadow, uCloud, 0.3);
    vec3 col = mix(shadowC, uCloud * 1.04, light);
    float rim = smoothstep(0.1, 0.5, a) * (1.0 - smoothstep(0.5, 0.95, a));
    col = mix(col, uCloud * 1.1, rim * 0.3);
    gl_FragColor = vec4(col, a * ${opacity.toFixed(2)});
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
}

export function createClouds(cx: number, cz: number, size: number): Group {
  const g = new Group();
  g.name = 'clouds';
  for (let layer = 0; layer < 2; layer++) {
    const geo = new PlaneGeometry(size, size, 1, 1);
    geo.rotateX(-Math.PI / 2);
    const mat = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: frag(layer),
      uniforms: U as unknown as Record<string, { value: unknown }>,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
    });
    const m = new Mesh(geo, mat);
    m.position.set(cx, layer === 0 ? 1.0 : 1.45, cz);
    m.renderOrder = 10 + layer;
    m.frustumCulled = false;
    g.add(m);
  }
  return g;
}
