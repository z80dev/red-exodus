// Martian sky dome: butterscotch haze at the horizon deepening to a dusty zenith, and the planet's signature
// blue halo hugging the sun (forward-scattering fine dust) that blooms toward the horizon at low sun. Follows
// the camera; drawn first, never fogged, never writes depth. Colors come from the era light (terraform arc).
import { BackSide, Mesh, ShaderMaterial, SphereGeometry } from 'three';
import { U } from './shaders';

const VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * viewMatrix * wp;
  gl_Position.z = gl_Position.w * 0.99999;
}`;

const FRAG = /* glsl */ `
varying vec3 vDir;
uniform vec3 uHaze;
uniform vec3 uSkyTop;
uniform vec3 uSunset;
uniform vec3 uSunDir;
void main() {
  vec3 d = normalize(vDir);
  float up = clamp(d.y, -0.2, 1.0);
  vec3 col = mix(uHaze, uSkyTop, smoothstep(-0.02, 0.55, up));
  float sd = max(dot(d, normalize(uSunDir)), 0.0);
  float low = 1.0 - smoothstep(0.15, 0.9, uSunDir.y);
  col = mix(col, uSunset, pow(sd, 6.0) * (0.55 + 0.35 * low));
  col += uSunset * pow(sd, 40.0) * 0.6 + vec3(1.0, 0.96, 0.9) * pow(sd, 900.0) * 2.0;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function createSky(): Mesh {
  const mat = new ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: U as unknown as Record<string, { value: unknown }>,
    side: BackSide,
    depthWrite: false,
    fog: false,
  });
  const m = new Mesh(new SphereGeometry(300, 32, 16), mat);
  m.name = 'sky';
  m.renderOrder = -10;
  m.frustumCulled = false;
  return m;
}
