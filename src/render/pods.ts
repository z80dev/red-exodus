// Orbital Drop: a pod falls from the orbiting Ark as a fiery streak (re-entry glow, plasma sheath, ember and
// smoke trail), fires its retro rockets just above the ground (white-blue flare, dust kicked up), touches down
// in a dust shockwave, then dissolves while the colony unfolds on the spot. Uses the `drop_pod` model (GLB
// when the manifest has it, procedural stand-in otherwise) with team colors.
import {
  AdditiveBlending, Color, ConeGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, Quaternion,
  SphereGeometry, Vector3,
} from 'three';
import type { ModelLibrary } from './assets/models';
import type { Fx } from './fx';
import { makeModelUniforms, patchModelMaterial } from './shaders';
import type { TeamColors } from './world';

const POD_SCALE = 1.7;
const HEAT = new Color(1.0, 0.42, 0.12);
const EMBER = new Color('#ffb347');
const EMBER2 = new Color('#ff4a1a');
const SMOKE = new Color('#4a3a33');
const RETRO = new Color('#e8f8ff');
const RETRO2 = new Color('#7fd8ff');
const DUST = new Color('#b7784a');
const DUST2 = new Color('#d9a066');
const UP = new Vector3(0, 1, 0);
const IDENTITY = new Quaternion();

export class DropPods {
  readonly group = new Group();
  private lib: ModelLibrary;
  private fx: Fx;
  private sheathGeo = new SphereGeometry(1, 12, 8);
  private flareGeo = new ConeGeometry(1, 1, 12, 1, true);

  constructor(lib: ModelLibrary, fx: Fx) {
    this.lib = lib;
    this.fx = fx;
    this.group.name = 'drop-pods';
    this.flareGeo.translate(0, -0.5, 0);
  }

  /**
   * Plays the full descent onto `ground` (tile surface). Resolves at touchdown + a beat, when the colony should
   * appear; the pod keeps dissolving afterwards on its own.
   */
  async land(ground: Vector3, team: TeamColors, speed: number, shake: (amount: number) => void): Promise<void> {
    const fx = this.fx;
    const asset = this.lib.get('drop_pod');
    const mu = makeModelUniforms();
    mu.uTeamA.value.copy(team.a);
    mu.uTeamB.value.copy(team.b);
    mu.uFlashColor.value.copy(HEAT);
    const mat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0 });
    patchModelMaterial(mat, { perObject: true }, mu);
    const pod = new Mesh(asset.geometry, mat);
    pod.scale.setScalar(POD_SCALE);
    pod.castShadow = true;
    const root = new Group();
    root.add(pod);
    const sheathMat = new MeshBasicMaterial({ color: '#ff9a3c', transparent: true, blending: AdditiveBlending, depthWrite: false, fog: false });
    const sheath = new Mesh(this.sheathGeo, sheathMat);
    root.add(sheath);
    const flareMat = new MeshBasicMaterial({ color: RETRO2, transparent: true, blending: AdditiveBlending, depthWrite: false, fog: false, opacity: 0 });
    const flare = new Mesh(this.flareGeo, flareMat);
    flare.visible = false;
    root.add(flare);
    this.group.add(root);
    const podH = asset.height * POD_SCALE;
    const start = ground.clone().add(new Vector3(-3.6, 8.5, -4.8));
    const hover = ground.clone().add(new Vector3(-0.22, 1.05, -0.3));
    const dir = hover.clone().sub(start).normalize();
    const tilt = new Quaternion().setFromUnitVectors(UP, dir.clone().negate());
    const cur = new Vector3();
    const prev = start.clone();
    const q = new Quaternion();
    // 1) re-entry streak: accelerating, heat-shield first, glowing, shedding embers and smoke.
    // Pod-local +Y points back up the trail: the elongated sheath wraps the pod and streams behind it.
    root.quaternion.copy(tilt);
    sheath.position.set(0, podH * 0.5, 0);
    await fx.tween(1.05 * speed, (t) => {
      root.position.lerpVectors(start, hover, t * t);
      mu.uFlash.value = 0.9 * (1 - t * 0.3);
      sheath.scale.set(0.16, 0.2 + 0.5 * (1 - t * 0.5), 0.16);
      sheathMat.opacity = 0.75 * (0.8 + 0.2 * Math.sin(t * 60));
      // fill the gap since last frame so the streak stays continuous as the pod accelerates
      for (let k = 1; k <= 4; k++) {
        cur.lerpVectors(prev, root.position, k / 4);
        fx.burst(cur, { count: 2, color: EMBER, color2: EMBER2, speed: 0.12, up: 0.08, life: 0.6, size: 0.2, drag: 2 });
        if (t > 0.1 && k % 2 === 0) fx.burst(cur, { count: 1, color: SMOKE, additive: false, speed: 0.08, up: 0.1, life: 1.5, size: 0.32, grow: 2.2, drag: 1 });
      }
      prev.copy(root.position);
    });
    sheath.visible = false;
    // 2) retro burn: decelerate, swing upright, blue-white flare, dust starts to lift
    flare.visible = true;
    await fx.tween(0.6 * speed, (t) => {
      root.position.lerpVectors(hover, ground, 1 - (1 - t) ** 3);
      q.copy(tilt).slerp(IDENTITY, Math.min(1, t * 2.2));
      root.quaternion.copy(q);
      mu.uFlash.value = 0.6 * (1 - t);
      const flick = 0.8 + 0.2 * Math.sin(t * 90);
      flare.scale.set(0.11 * flick, 0.3 + 0.35 * (1 - t) * flick, 0.11 * flick);
      flareMat.opacity = 0.9 * (1 - t * 0.4);
      cur.copy(root.position);
      fx.burst(cur, { count: 3, color: RETRO, color2: RETRO2, speed: 0.4, up: -1.2, spread: 0.6, life: 0.3, size: 0.09, star: true, drag: 3 });
      if (root.position.y - ground.y < 0.7) fx.burst(ground.clone().setY(ground.y + 0.04), { count: 2, color: DUST, color2: DUST2, additive: false, speed: 1.4, up: 0.15, spread: 2.2, life: 0.9, size: 0.22, grow: 1.8, drag: 3, radius: 0.15 });
    });
    root.position.copy(ground);
    root.quaternion.identity();
    flare.visible = false;
    // 3) touchdown: dust shockwave
    shake(0.12);
    void fx.ring(ground.clone().setY(ground.y + 0.04), DUST2, 2.8, 1.0, 1.4);
    void fx.ring(ground.clone().setY(ground.y + 0.04), RETRO2, 1.3, 0.5);
    fx.burst(ground.clone().setY(ground.y + 0.05), { count: 70, color: DUST, color2: DUST2, additive: false, speed: 2.4, up: 0.28, spread: 2.2, drag: 3, life: 1.4, size: 0.3, grow: 2.2, radius: 0.2 });
    fx.burst(ground.clone().setY(ground.y + podH * 0.3), { count: 26, color: EMBER, color2: '#fff1c4', speed: 0.9, up: 1.1, life: 0.7, size: 0.07, star: true, gravity: 1.2, drag: 1.5 });
    await fx.tween(0.25 * speed, (t) => {
      const k = Math.sin(t * Math.PI);
      const s = POD_SCALE * (1 + k * 0.06);
      pod.scale.set(s * (1 + k * 0.05), s * (1 - k * 0.08), s);
    });
    // 4) the hab unfolds (cityFounded) while the spent pod dissolves in cinders
    void fx.tween(0.9, (t) => {
      mu.uDissolve.value = t * 1.05;
    }).then(() => {
      this.group.remove(root);
      mat.dispose();
      sheathMat.dispose();
      flareMat.dispose();
    });
  }

  clear(): void {
    for (const c of [...this.group.children]) this.group.remove(c);
  }

  dispose(): void {
    this.clear();
    this.sheathGeo.dispose();
    this.flareGeo.dispose();
  }
}
