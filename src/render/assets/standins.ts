// Procedural stand-ins in the art-direction palette, used only for keys whose GLB is not (yet) in the
// manifests. Same conventions as the Blender exports: Y-up, origin at ground center, front +Z,
// TEAM / TEAM_DARK material names for team-colored parts.
import {
  BoxGeometry, type BufferGeometry, ConeGeometry, CylinderGeometry, DodecahedronGeometry, Group, IcosahedronGeometry,
  Mesh, MeshStandardMaterial, SphereGeometry, TorusGeometry,
} from 'three';

const mats = new Map<string, MeshStandardMaterial>();
function mat(color: string, name = ''): MeshStandardMaterial {
  const k = `${name}|${color}`;
  let m = mats.get(k);
  if (!m) {
    m = new MeshStandardMaterial({ color, flatShading: true, name });
    if (name === 'EMIT') m.emissive.set(color);
    mats.set(k, m);
  }
  return m;
}

const TEAM = () => mat('#3b6fd4', 'TEAM');
const TEAM_DARK = () => mat('#1b2f5a', 'TEAM_DARK');

function add(g: Group, geo: BufferGeometry, m: MeshStandardMaterial, x = 0, y = 0, z = 0, ry = 0): Mesh {
  const mesh = new Mesh(geo, m);
  mesh.position.set(x, y, z);
  mesh.rotation.y = ry;
  g.add(mesh);
  return mesh;
}

const RES_COLORS: Record<string, string> = {
  wheat: '#e0b84a', rice: '#d8d49a', cattle: '#8a5a3a', sheep: '#f0ece0', deer: '#a0683a', fish: '#7ab8d8',
  stone: '#b8b0a0', bananas: '#f2d64a', gold: '#f2c94c', gems: '#5fd0f0', silk: '#e88ac8', spices: '#d8642e',
  wine: '#7a2a4a', incense: '#c8a0d0', furs: '#7a5534', pearls: '#f4f0f4', marble: '#eeeae4', ivory: '#f4ead0',
  dyes: '#8a4ad8', cotton: '#fafafa', sugar: '#c8e090', whales: '#4a5a78', horses: '#8a5a34', iron: '#6a7078',
  niter: '#e8e0c8', coal: '#2a2a2e', oil: '#1a1a1e',
};

function tree(g: Group, key: string, x = 0, z = 0): void {
  const trunk = mat('#6b4a2f');
  if (key === 'tree_palm') {
    add(g, new CylinderGeometry(0.018, 0.026, 0.34, 5), trunk, x, 0.17, z).rotation.z = 0.12;
    for (let i = 0; i < 5; i++) {
      const leaf = add(g, new ConeGeometry(0.03, 0.2, 4), mat('#6fa83a'), x + Math.cos(i * 1.25) * 0.08, 0.33, z + Math.sin(i * 1.25) * 0.08);
      leaf.rotation.set(Math.sin(i * 1.25) * 1.2, 0, -Math.cos(i * 1.25) * 1.2);
    }
    return;
  }
  add(g, new CylinderGeometry(0.022, 0.03, 0.12, 5), trunk, x, 0.06, z);
  if (key === 'tree_broadleaf' || key === 'tree_jungle') {
    const c = key === 'tree_jungle' ? '#3a7a34' : '#5b8c3a';
    add(g, new IcosahedronGeometry(0.13, 0), mat(c), x, 0.22, z);
    add(g, new IcosahedronGeometry(0.09, 0), mat('#86b04a'), x + 0.05, 0.3, z + 0.03);
    return;
  }
  const leaf = key === 'tree_snowpine' ? '#dfe8ee' : '#3f6e2a';
  add(g, new ConeGeometry(0.13, 0.2, 6), mat(leaf), x, 0.2, z);
  add(g, new ConeGeometry(0.1, 0.17, 6), mat(key === 'tree_snowpine' ? '#f2f4f7' : '#4c7d32'), x, 0.3, z);
}

function unit(g: Group, key: string): void {
  const skin = mat('#e0a87a');
  const id = key.slice(2);
  if (id === 'boat') {
    const hull = add(g, new BoxGeometry(0.2, 0.08, 0.42), mat('#7a5534'), 0, 0.04, 0);
    hull.scale.set(1, 1, 1);
    add(g, new ConeGeometry(0.1, 0.1, 4), mat('#7a5534'), 0, 0.04, 0.24).rotation.x = Math.PI / 2;
    add(g, new CylinderGeometry(0.01, 0.01, 0.34, 4), mat('#6b4a2f'), 0, 0.24, 0);
    add(g, new BoxGeometry(0.2, 0.16, 0.01), TEAM(), 0, 0.26, 0.01);
    return;
  }
  const mounted = /horse|knight|cavalry|lancer|chariot/.test(id);
  const machine = /tank|cannon|artillery|catapult|trebuchet|field_gun|at_gun|machine_gun/.test(id);
  if (machine) {
    add(g, new BoxGeometry(0.24, 0.1, 0.3), id === 'tank' ? TEAM_DARK() : mat('#7a5534'), 0, 0.08, 0);
    add(g, new CylinderGeometry(0.03, 0.035, 0.28, 6), mat('#3a3e44'), 0, 0.16, 0.12).rotation.x = Math.PI / 2 - 0.3;
    add(g, new BoxGeometry(0.16, 0.06, 0.16), TEAM(), 0, 0.16, -0.04);
    for (const s of [-1, 1]) add(g, new CylinderGeometry(0.06, 0.06, 0.03, 8), mat('#4a3a2a'), s * 0.13, 0.06, 0).rotation.z = Math.PI / 2;
    return;
  }
  let y = 0;
  if (mounted) {
    add(g, new BoxGeometry(0.1, 0.1, 0.28), mat('#8a5a34'), 0, 0.14, 0);
    add(g, new BoxGeometry(0.07, 0.12, 0.08), mat('#8a5a34'), 0, 0.22, 0.14);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(g, new BoxGeometry(0.03, 0.1, 0.03), mat('#6a4424'), sx * 0.035, 0.05, sz * 0.1);
    y = 0.14;
  }
  add(g, new CylinderGeometry(0.06, 0.08, 0.16, 7), TEAM(), 0, y + 0.1, 0);
  add(g, new CylinderGeometry(0.081, 0.081, 0.03, 7), TEAM_DARK(), 0, y + 0.05, 0);
  add(g, new SphereGeometry(0.06, 8, 6), skin, 0, y + 0.23, 0);
  if (id === 'settler') {
    add(g, new BoxGeometry(0.1, 0.1, 0.08), mat('#c9a86a'), 0, y + 0.12, -0.08);
  } else if (id !== 'scout') {
    add(g, new BoxGeometry(0.02, 0.26, 0.02), mat('#9aa0a8'), 0.09, y + 0.14, 0.05);
    add(g, new CylinderGeometry(0.06, 0.06, 0.015, 8), TEAM_DARK(), -0.08, y + 0.12, 0.03).rotation.z = Math.PI / 2;
  }
  add(g, new ConeGeometry(0.065, 0.06, 7), TEAM_DARK(), 0, y + 0.3, 0);
}

export function buildStandIn(key: string): Group {
  const g = new Group();
  if (key.startsWith('tree_')) tree(g, key);
  else if (key === 'bush') {
    add(g, new IcosahedronGeometry(0.07, 0), mat('#5b8c3a'), 0, 0.05, 0);
    add(g, new IcosahedronGeometry(0.05, 0), mat('#86b04a'), 0.06, 0.04, 0.02);
  } else if (key === 'flowers') {
    for (let i = 0; i < 5; i++) add(g, new SphereGeometry(0.018, 5, 4), mat(['#f2c94c', '#e86a8a', '#f4f0f4'][i % 3]), Math.cos(i * 2.4) * 0.06, 0.03, Math.sin(i * 2.4) * 0.06);
  } else if (key === 'reeds') {
    for (let i = 0; i < 6; i++) add(g, new CylinderGeometry(0.004, 0.008, 0.16, 3), mat('#8aa050'), Math.cos(i * 1.9) * 0.05, 0.08, Math.sin(i * 1.9) * 0.05);
  } else if (key === 'cactus') {
    add(g, new CylinderGeometry(0.03, 0.035, 0.22, 6), mat('#5f9a4a'), 0, 0.11, 0);
    add(g, new CylinderGeometry(0.02, 0.02, 0.08, 6), mat('#5f9a4a'), 0.05, 0.14, 0).rotation.z = -0.6;
  } else if (key.startsWith('rock') || key === 'hill_rocks') {
    const s = key === 'rock_large' ? 0.13 : 0.07;
    add(g, new DodecahedronGeometry(s, 0), mat('#8a8177'), 0, s * 0.6, 0);
    if (key === 'hill_rocks') add(g, new DodecahedronGeometry(0.06, 0), mat('#6e665e'), 0.12, 0.04, 0.05);
  } else if (key.startsWith('mountain')) {
    const snow = key === 'mountain_snow';
    add(g, new ConeGeometry(0.8, 0.85, 7), mat('#8a8177'), 0, 0.42, 0);
    add(g, new ConeGeometry(0.5, 0.55, 6), mat('#6e665e'), 0.35, 0.27, 0.2);
    add(g, new ConeGeometry(0.3, 0.3, 7), mat(snow ? '#f2f4f7' : '#a39a8a'), 0, 0.7, 0);
  } else if (key === 'ice_floe') {
    add(g, new CylinderGeometry(0.3, 0.34, 0.06, 7), mat('#e6f1f7'), 0, 0.02, 0);
  } else if (key === 'reef_coral') {
    for (let i = 0; i < 4; i++) add(g, new IcosahedronGeometry(0.05, 0), mat(['#f07a6a', '#f2b24a', '#d86ad0'][i % 3]), Math.cos(i * 1.6) * 0.12, 0.0, Math.sin(i * 1.6) * 0.12);
  } else if (key === 'camp_barbarian') {
    for (let i = 0; i < 3; i++) add(g, new ConeGeometry(0.1, 0.18, 6), mat('#8e5a3a'), Math.cos(i * 2.1) * 0.16, 0.09, Math.sin(i * 2.1) * 0.16);
    add(g, new CylinderGeometry(0.01, 0.01, 0.34, 4), mat('#4a3020'), 0, 0.17, 0);
    add(g, new BoxGeometry(0.12, 0.08, 0.01), mat('#8e2b24'), 0.06, 0.3, 0);
    add(g, new ConeGeometry(0.04, 0.08, 5), mat('#ff8a2a', 'EMIT'), 0, 0.04, 0.02);
  } else if (key === 'ruin_ancient') {
    for (let i = 0; i < 4; i++) add(g, new CylinderGeometry(0.03, 0.03, 0.12 + (i % 2) * 0.1, 6), mat('#c9bfae'), Math.cos(i * 1.57) * 0.15, 0.08, Math.sin(i * 1.57) * 0.15);
    add(g, new BoxGeometry(0.3, 0.03, 0.08), mat('#b8ae9c'), 0, 0.02, 0.05).rotation.y = 0.4;
  } else if (key === 'road_marker') {
    add(g, new BoxGeometry(0.04, 0.08, 0.04), mat('#c9bfae'), 0, 0.04, 0);
  } else if (key.startsWith('res_')) {
    const c = RES_COLORS[key.slice(4)] ?? '#e0b84a';
    add(g, new CylinderGeometry(0.09, 0.1, 0.03, 8), mat('#6b4a2f'), 0, 0.015, 0);
    add(g, new IcosahedronGeometry(0.06, 0), mat(c), 0, 0.08, 0);
    add(g, new IcosahedronGeometry(0.04, 0), mat(c), 0.07, 0.05, 0.03);
  } else if (key.startsWith('imp_')) {
    const id = key.slice(4);
    if (id === 'farm' || id === 'plantation') {
      for (let i = 0; i < 3; i++) add(g, new BoxGeometry(0.16, 0.025, 0.42), mat(i % 2 ? '#d8b84a' : '#9ab84a'), (i - 1) * 0.17, 0.012, 0);
    } else if (id === 'mine' || id === 'quarry') {
      add(g, new BoxGeometry(0.2, 0.12, 0.14), mat('#6e665e'), 0, 0.06, 0);
      add(g, new BoxGeometry(0.08, 0.08, 0.02), mat('#1a1a1e'), 0, 0.04, 0.07);
    } else if (id === 'fishing_boats') {
      add(g, new BoxGeometry(0.08, 0.04, 0.18), mat('#7a5534'), 0, 0.02, 0);
      add(g, new BoxGeometry(0.08, 0.04, 0.18), mat('#7a5534'), 0.18, 0.02, 0.1);
    } else if (id === 'oil_well') {
      add(g, new CylinderGeometry(0.02, 0.06, 0.3, 4), mat('#3a3e44'), 0, 0.15, 0);
    } else {
      add(g, new BoxGeometry(0.16, 0.1, 0.14), mat('#b5523b'), 0, 0.05, 0);
      add(g, new BoxGeometry(0.34, 0.02, 0.02), mat('#7a5534'), 0, 0.05, 0.12);
    }
  } else if (key.startsWith('city_center_')) {
    add(g, new BoxGeometry(0.26, 0.2, 0.26), mat('#c9bfae'), 0, 0.1, 0);
    add(g, new CylinderGeometry(0.07, 0.08, 0.36, 8), mat('#c9bfae'), 0.08, 0.18, 0.08);
    add(g, new ConeGeometry(0.1, 0.14, 8), TEAM(), 0.08, 0.43, 0.08);
    add(g, new ConeGeometry(0.2, 0.12, 4), TEAM_DARK(), 0, 0.26, 0).rotation.y = Math.PI / 4;
  } else if (key.startsWith('house_')) {
    const era = Number(key.split('_')[1]) || 0;
    const h = 0.08 + era * 0.02;
    add(g, new BoxGeometry(0.1, h, 0.12), mat(era >= 4 ? '#b8bcc2' : '#e8dcc0'), 0, h / 2, 0);
    const roof = add(g, new CylinderGeometry(0.0, 0.085, 0.07, 4, 1), mat(key.endsWith('_b') ? '#8a5a3a' : '#b5523b'), 0, h + 0.035, 0);
    roof.rotation.y = Math.PI / 4;
  } else if (key.startsWith('wall_seg_')) {
    const lvl = Number(key.slice(9)) || 0;
    add(g, new BoxGeometry(1.0, 0.09 + lvl * 0.03, 0.05), mat(lvl === 0 ? '#7a5534' : '#c9bfae'), 0, (0.09 + lvl * 0.03) / 2, 0);
  } else if (key.startsWith('wall_tower_')) {
    const lvl = Number(key.slice(11)) || 0;
    add(g, new CylinderGeometry(0.05, 0.06, 0.16 + lvl * 0.03, 7), mat(lvl === 0 ? '#7a5534' : '#c9bfae'), 0, 0.08, 0);
    add(g, new ConeGeometry(0.07, 0.07, 7), TEAM(), 0, 0.2 + lvl * 0.03, 0);
  } else if (key.startsWith('bld_')) {
    add(g, new BoxGeometry(0.18, 0.12, 0.14), mat('#e8dcc0'), 0, 0.06, 0);
    add(g, new SphereGeometry(0.07, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), mat('#e0b84a'), 0, 0.12, 0);
  } else if (key.startsWith('w_')) {
    for (let i = 0; i < 4; i++) add(g, new BoxGeometry(0.7 - i * 0.16, 0.12, 0.7 - i * 0.16), mat(i === 3 ? '#e0b84a' : '#d8c8a0'), 0, 0.06 + i * 0.12, 0);
    add(g, new TorusGeometry(0.08, 0.02, 5, 10), mat('#e0b84a', 'EMIT'), 0, 0.62, 0);
  } else if (key.startsWith('nw_')) {
    for (let i = 0; i < 5; i++) add(g, new ConeGeometry(0.08 + (i % 2) * 0.05, 0.4 + (i % 3) * 0.2, 5), mat(['#8ad0f0', '#c8a0f0', '#f0f4ff'][i % 3], i === 0 ? 'EMIT' : ''), Math.cos(i * 1.3) * 0.22 * (i ? 1 : 0), 0.25, Math.sin(i * 1.3) * 0.22 * (i ? 1 : 0));
  } else if (key.startsWith('u_')) {
    unit(g, key);
  } else {
    add(g, new BoxGeometry(0.15, 0.15, 0.15), mat('#c9bfae'), 0, 0.075, 0);
  }
  return g;
}
