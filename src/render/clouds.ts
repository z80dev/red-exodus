// Fog of war clouds: stacked "shell" layers sampling one drifting 3D-ish density field. Higher shells only
// cover the thickest crowns and are lit brighter, lower shells fill the valleys in cool shadow — cheap
// cumulus volume with real parallax. Coverage is taken from the ground point along the view ray so the
// cloud edge lines up with the terrain's fog edge. Shells discard immediately over explored ground.
import { DoubleSide, Group, Mesh, PlaneGeometry, ShaderMaterial } from 'three';
import { GLSL_NOISE } from './noise';
import { GLSL_TILES, U } from './shaders';

const CLOUD_SHELLS = 5;
const BASE_Y = 0.85;
const SHELL_STEP = 0.14;

const VERT = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

function frag(k: number): string {
  const h = k / (CLOUD_SHELLS - 1);
  return /* glsl */ `
  varying vec3 vWorld;
  uniform vec3 uCloud;
  uniform vec3 uCloudShadow;
  uniform vec3 uSunDir;
  uniform vec3 uHaze;
  uniform vec2 uHazeRange;
  ${GLSL_NOISE}
  ${GLSL_TILES}
  const float H = ${h.toFixed(3)};
  void main() {
    vec3 V = normalize(vWorld - cameraPosition);
    vec2 gp = vWorld.xz + V.xz * ((0.15 - vWorld.y) / min(V.y, -0.05));
    vec2 drift = vec2(uTime * 0.05, uTime * 0.03);
    float warp = (aeNoise(gp * 1.3 + drift * 3.0) - 0.5) * 0.45;
    float cover = 1.0 - aeFogAt(gp + vec2(warp, -warp) * 0.8).x;
    if (cover < 0.03) discard;
    vec2 p = vWorld.xz * 0.21 + drift;
    float n = aeFbm(p);
    float puff = aeNoise(p * 5.5 - drift * 2.0) * 0.65 + aeNoise(p * 12.0 + drift) * 0.35;
    float D = cover * 0.62 + (n - 0.5) * 2.3 + (puff - 0.5) * 0.3 + warp * 0.25;
    float thr = 0.18 + H * 0.62;
    float a = smoothstep(thr - 0.03, thr + 0.1, D);
    ${k === 0 ? 'a = max(a, smoothstep(0.9, 1.0, cover) * 0.98);' : ''}
    if (a < 0.01) discard;
    // lighting: height in the stack + sun-facing slope of the density field
    vec2 sd = normalize(uSunDir.xz);
    float n2 = aeFbm(p + sd * 0.1);
    float lee = clamp((n - n2) * 10.0, -1.0, 1.0);
    float edge = 1.0 - smoothstep(0.0, 0.12, D - thr);
    float light = 0.12 + H * 0.8 + lee * 0.22 - edge * (0.2 - H * 0.35);
    vec3 shadowC = mix(uCloudShadow, uCloud, 0.3) * vec3(0.9, 0.93, 1.0);
    vec3 col = mix(shadowC, uCloud * 1.05, clamp(light, 0.0, 1.0));
    float haze = smoothstep(uHazeRange.x, uHazeRange.y, distance(cameraPosition, vWorld));
    col = mix(col, uHaze, haze * 0.85);
    gl_FragColor = vec4(col, a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
}

export function createClouds(cx: number, cz: number, size: number): Group {
  const g = new Group();
  g.name = 'clouds';
  for (let k = 0; k < CLOUD_SHELLS; k++) {
    const geo = new PlaneGeometry(size, size, 1, 1);
    geo.rotateX(-Math.PI / 2);
    const mat = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: frag(k),
      uniforms: U as unknown as Record<string, { value: unknown }>,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
    });
    const m = new Mesh(geo, mat);
    m.position.set(cx, BASE_Y + k * SHELL_STEP, cz);
    m.renderOrder = 10 + k;
    m.frustumCulled = false;
    g.add(m);
  }
  return g;
}

/** battery saver: keep every other shell */
export function setCloudDetail(g: Group, low: boolean): void {
  g.children.forEach((m, k) => {
    m.visible = !low || k % 2 === 0;
  });
}
