// High-quality post: scene → MSAA HDR target → single fullscreen pass (tilt-shift blur toward the top
// and bottom edges + subtle warm grade), then ACES tone mapping + sRGB output via three's chunks.
import {
  type Camera, HalfFloatType, Mesh, OrthographicCamera, PlaneGeometry, type Scene, ShaderMaterial, Vector2,
  type WebGLRenderer, WebGLRenderTarget,
} from 'three';

const FRAG = /* glsl */ `
uniform sampler2D tScene;
uniform vec2 uTexel;
uniform float uBlur;
uniform float uFocus;
varying vec2 vUv;
void main() {
  float dy = abs(vUv.y - uFocus);
  float amt = smoothstep(0.24, 0.55, dy) * uBlur;
  vec3 col = texture2D(tScene, vUv).rgb;
  if (amt > 0.05) {
    vec3 acc = col;
    float wsum = 1.0;
    for (int i = 0; i < 12; i++) {
      float fi = float(i);
      float r = sqrt((fi + 0.5) / 12.0) * amt;
      float a = fi * 2.39996;
      vec2 o = vec2(cos(a), sin(a)) * r * uTexel;
      acc += texture2D(tScene, vUv + o).rgb;
      wsum += 1.0;
    }
    col = acc / wsum;
  }
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class PostPipeline {
  private rt: WebGLRenderTarget;
  private mat: ShaderMaterial;
  private quad: Mesh;
  private cam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  blur = 4.5;

  constructor() {
    this.rt = new WebGLRenderTarget(4, 4, { type: HalfFloatType, samples: 4 });
    this.mat = new ShaderMaterial({
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: FRAG,
      uniforms: {
        tScene: { value: this.rt.texture },
        uTexel: { value: new Vector2(1 / 4, 1 / 4) },
        uBlur: { value: this.blur },
        uFocus: { value: 0.46 },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new Mesh(new PlaneGeometry(2, 2), this.mat);
    this.quad.frustumCulled = false;
  }

  setSize(w: number, h: number): void {
    this.rt.setSize(w, h);
    this.mat.uniforms.uTexel.value.set(1 / w, 1 / h);
  }

  render(r: WebGLRenderer, scene: Scene, camera: Camera, blurScale: number): void {
    this.mat.uniforms.uBlur.value = this.blur * blurScale;
    r.setRenderTarget(this.rt);
    r.render(scene, camera);
    r.setRenderTarget(null);
    r.render(this.quad, this.cam);
  }

  dispose(): void {
    this.rt.dispose();
    this.mat.dispose();
    this.quad.geometry.dispose();
  }
}
