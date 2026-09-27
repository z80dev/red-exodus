// Juice: pooled GPU particles (additive sparkles + soft dust/smoke), shockwave rings, light beams and
// projectile arcs. Everything is driven by `update(dt)` from the render loop.
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Color, CylinderGeometry, DoubleSide, Group, Mesh,
  MeshBasicMaterial, NormalBlending, Points, RingGeometry, ShaderMaterial, SphereGeometry, Vector3,
} from 'three';

const PVERT = /* glsl */ `
attribute vec4 aColor;
attribute float aSize;
attribute float aShape;
varying vec4 vColor;
varying float vShape;
uniform float uPx;
void main() {
  vColor = aColor;
  vShape = aShape;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uPx / max(0.1, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const PFRAG = /* glsl */ `
varying vec4 vColor;
varying float vShape;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float a;
  if (vShape > 0.5) {
    float star = max(1.0 - abs(c.x) * 9.0, 0.0) * max(1.0 - abs(c.y) * 2.2, 0.0) + max(1.0 - abs(c.y) * 9.0, 0.0) * max(1.0 - abs(c.x) * 2.2, 0.0);
    a = clamp(star + smoothstep(0.22, 0.0, d), 0.0, 1.0);
  } else {
    a = smoothstep(0.5, 0.1, d);
  }
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor.rgb, vColor.a * a);
}`;

export interface BurstOpts {
  count: number;
  color: Color | string;
  color2?: Color | string;
  speed?: number;
  up?: number;
  spread?: number;
  gravity?: number;
  drag?: number;
  life?: number;
  size?: number;
  additive?: boolean;
  star?: boolean;
  radius?: number;
  grow?: number;
}

class ParticlePool {
  readonly points: Points;
  private max: number;
  private n = 0;
  private pos: Float32Array;
  private col: Float32Array;
  private size: Float32Array;
  private shape: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private maxLife: Float32Array;
  private baseSize: Float32Array;
  private grow: Float32Array;
  private gravity: Float32Array;
  private drag: Float32Array;
  private baseAlpha: Float32Array;
  private geo: BufferGeometry;
  readonly mat: ShaderMaterial;

  constructor(max: number, additive: boolean) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    this.size = new Float32Array(max);
    this.shape = new Float32Array(max);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.baseSize = new Float32Array(max);
    this.grow = new Float32Array(max);
    this.gravity = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.baseAlpha = new Float32Array(max);
    this.geo = new BufferGeometry();
    this.geo.setAttribute('position', new BufferAttribute(this.pos, 3));
    this.geo.setAttribute('aColor', new BufferAttribute(this.col, 4));
    this.geo.setAttribute('aSize', new BufferAttribute(this.size, 1));
    this.geo.setAttribute('aShape', new BufferAttribute(this.shape, 1));
    this.geo.setDrawRange(0, 0);
    this.mat = new ShaderMaterial({
      vertexShader: PVERT,
      fragmentShader: PFRAG,
      uniforms: { uPx: { value: 400 } },
      transparent: true,
      depthWrite: false,
      blending: additive ? AdditiveBlending : NormalBlending,
    });
    this.points = new Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 21 : 20;
  }

  spawn(p: Vector3, o: BurstOpts, tint: Color, tint2: Color): void {
    const speed = o.speed ?? 1;
    const spread = o.spread ?? 1;
    for (let k = 0; k < o.count; k++) {
      if (this.n >= this.max) this.recycle();
      const i = this.n++;
      const a = Math.random() * Math.PI * 2;
      const r = (o.radius ?? 0) * Math.sqrt(Math.random());
      this.pos[i * 3] = p.x + Math.cos(a) * r;
      this.pos[i * 3 + 1] = p.y;
      this.pos[i * 3 + 2] = p.z + Math.sin(a) * r;
      const s = speed * (0.4 + Math.random() * 0.8);
      const h = spread * s;
      this.vel[i * 3] = Math.cos(a) * h;
      this.vel[i * 3 + 1] = (o.up ?? 1) * (0.5 + Math.random()) * speed;
      this.vel[i * 3 + 2] = Math.sin(a) * h;
      const lf = (o.life ?? 1) * (0.7 + Math.random() * 0.6);
      this.life[i] = lf;
      this.maxLife[i] = lf;
      this.baseSize[i] = (o.size ?? 0.12) * (0.7 + Math.random() * 0.6);
      this.grow[i] = o.grow ?? 0;
      this.gravity[i] = o.gravity ?? 0;
      this.drag[i] = o.drag ?? 1.5;
      this.shape[i] = o.star ? 1 : 0;
      const m = Math.random();
      this.col[i * 4] = tint.r + (tint2.r - tint.r) * m;
      this.col[i * 4 + 1] = tint.g + (tint2.g - tint.g) * m;
      this.col[i * 4 + 2] = tint.b + (tint2.b - tint.b) * m;
      this.baseAlpha[i] = 1;
    }
  }

  private recycle(): void {
    // drop the oldest (index 0) by swapping in the last
    this.kill(0);
  }

  private kill(i: number): void {
    const last = --this.n;
    if (i === last) return;
    this.pos.copyWithin(i * 3, last * 3, last * 3 + 3);
    this.vel.copyWithin(i * 3, last * 3, last * 3 + 3);
    this.col.copyWithin(i * 4, last * 4, last * 4 + 4);
    this.life[i] = this.life[last];
    this.maxLife[i] = this.maxLife[last];
    this.baseSize[i] = this.baseSize[last];
    this.grow[i] = this.grow[last];
    this.gravity[i] = this.gravity[last];
    this.drag[i] = this.drag[last];
    this.shape[i] = this.shape[last];
    this.baseAlpha[i] = this.baseAlpha[last];
  }

  update(dt: number): void {
    for (let i = 0; i < this.n; i++) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.kill(i);
        i--;
        continue;
      }
      const damp = Math.exp(-this.drag[i] * dt);
      this.vel[i * 3] *= damp;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * damp - this.gravity[i] * dt;
      this.vel[i * 3 + 2] *= damp;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const t = 1 - this.life[i] / this.maxLife[i];
      this.size[i] = this.baseSize[i] * (1 + this.grow[i] * t) * Math.min(1, t * 8);
      this.col[i * 4 + 3] = this.baseAlpha[i] * (1 - t) * (1 - t * 0.3);
    }
    this.geo.setDrawRange(0, this.n);
    for (const k of ['position', 'aColor', 'aSize', 'aShape']) (this.geo.getAttribute(k) as BufferAttribute).needsUpdate = true;
  }

  clear(): void {
    this.n = 0;
    this.geo.setDrawRange(0, 0);
  }
}

interface Anim {
  t: number;
  dur: number;
  step(t: number): void;
  done(): void;
}

const BEAM_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const BEAM_FRAG = /* glsl */ `
varying vec2 vUv;
uniform vec3 uColor;
uniform float uAlpha;
uniform float uTime;
void main() {
  float edge = sin(vUv.x * 3.14159 * 2.0 * 3.0 + uTime * 6.0) * 0.15 + 0.85;
  float fade = pow(1.0 - vUv.y, 1.6);
  gl_FragColor = vec4(uColor * (1.2 + edge * 0.6), uAlpha * fade * edge);
}`;

export class Fx {
  readonly group = new Group();
  private add: ParticlePool;
  private soft: ParticlePool;
  private anims: Anim[] = [];
  private ringGeo = new RingGeometry(0.86, 1, 48, 1);
  private beamGeo = new CylinderGeometry(1, 1, 1, 24, 1, true);
  private projGeo = new SphereGeometry(0.045, 10, 8);
  private time = 0;

  constructor() {
    this.group.name = 'fx';
    this.ringGeo.rotateX(-Math.PI / 2);
    this.beamGeo.translate(0, 0.5, 0);
    this.add = new ParticlePool(1800, true);
    this.soft = new ParticlePool(1200, false);
    this.group.add(this.soft.points, this.add.points);
  }

  /** pixel scale for point sizes: viewport height / (2 * tan(fov/2)) */
  setPixelScale(px: number): void {
    this.add.mat.uniforms.uPx.value = px;
    this.soft.mat.uniforms.uPx.value = px;
  }

  burst(p: Vector3, o: BurstOpts): void {
    const c1 = o.color instanceof Color ? o.color : new Color(o.color);
    const c2 = o.color2 ? (o.color2 instanceof Color ? o.color2 : new Color(o.color2)) : c1;
    (o.additive === false ? this.soft : this.add).spawn(p, o, c1, c2);
  }

  /** generic tween tracked by the fx clock */
  tween(dur: number, step: (t: number) => void): Promise<void> {
    return new Promise((resolve) => {
      this.anims.push({ t: 0, dur: Math.max(0.001, dur), step, done: resolve });
    });
  }

  wait(dur: number): Promise<void> {
    return this.tween(dur, () => {});
  }

  ring(p: Vector3, color: Color | string, radius: number, dur = 0.8, width = 1): Promise<void> {
    const mat = new MeshBasicMaterial({ color, transparent: true, blending: AdditiveBlending, depthWrite: false, side: DoubleSide });
    const m = new Mesh(this.ringGeo, mat);
    m.position.copy(p);
    m.renderOrder = 22;
    this.group.add(m);
    return this.tween(dur, (t) => {
      const e = 1 - (1 - t) ** 3;
      m.scale.set(0.1 + radius * e, 1, 0.1 + radius * e);
      m.scale.x *= width;
      mat.opacity = (1 - t) * 0.9;
    }).then(() => {
      this.group.remove(m);
      mat.dispose();
    });
  }

  beam(p: Vector3, color: Color | string, radius = 0.35, height = 3, dur = 1.6): Promise<void> {
    const mat = new ShaderMaterial({
      vertexShader: BEAM_VERT,
      fragmentShader: BEAM_FRAG,
      uniforms: { uColor: { value: new Color(color) }, uAlpha: { value: 0 }, uTime: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
    });
    const m = new Mesh(this.beamGeo, mat);
    m.position.copy(p);
    m.renderOrder = 23;
    this.group.add(m);
    return this.tween(dur, (t) => {
      const inT = Math.min(1, t * 5);
      const r = radius * (1 - (1 - inT) ** 3) * (1 - t * 0.6);
      m.scale.set(r, height * (0.3 + 0.7 * inT), r);
      mat.uniforms.uAlpha.value = Math.min(1, t * 6) * (1 - t) ** 1.5;
      mat.uniforms.uTime.value = this.time;
    }).then(() => {
      this.group.remove(m);
      mat.dispose();
    });
  }

  /** arcing projectile; resolves on impact */
  projectile(from: Vector3, to: Vector3, color: Color | string, dur = 0.45, arc = 0.9): Promise<void> {
    const mat = new MeshBasicMaterial({ color, transparent: true, blending: AdditiveBlending, depthWrite: false });
    const m = new Mesh(this.projGeo, mat);
    m.renderOrder = 24;
    this.group.add(m);
    const tint = new Color(color);
    const cur = new Vector3();
    const height = arc * Math.max(0.4, from.distanceTo(to) * 0.35);
    return this.tween(dur, (t) => {
      cur.lerpVectors(from, to, t);
      cur.y += Math.sin(t * Math.PI) * height;
      m.position.copy(cur);
      this.add.spawn(cur, { count: 1, color: tint, speed: 0.05, up: 0.05, life: 0.35, size: 0.09 }, tint, tint);
    }).then(() => {
      this.group.remove(m);
      mat.dispose();
    });
  }

  update(dt: number): void {
    this.time += dt;
    const list = this.anims;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      a.t += dt;
      const t = Math.min(1, a.t / a.dur);
      a.step(t);
      if (t >= 1) {
        list.splice(i, 1);
        i--;
        a.done();
      }
    }
    this.add.update(dt);
    this.soft.update(dt);
  }

  /** finish every running tween immediately (used when skipping animations) */
  flush(): void {
    const list = this.anims.splice(0);
    for (const a of list) {
      a.step(1);
      a.done();
    }
  }

  clear(): void {
    this.flush();
    this.add.clear();
    this.soft.clear();
  }
}
