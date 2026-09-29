// Procedural Mars stand-ins used only for keys whose GLB is absent. Y-up, origin at ground center,
// front +Z; TEAM / TEAM_DARK name team-colored parts and EMIT marks emissive materials.
import {
  BoxGeometry, type BufferGeometry, ConeGeometry, CylinderGeometry, DodecahedronGeometry, Group,
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
const TEAM = () => mat('#f28c28', 'TEAM');
const TEAM_DARK = () => mat('#9b4424', 'TEAM_DARK');
function add(g: Group, geo: BufferGeometry, m: MeshStandardMaterial, x = 0, y = 0, z = 0, ry = 0): Mesh {
  const mesh = new Mesh(geo, m);
  mesh.position.set(x, y, z); mesh.rotation.y = ry; g.add(mesh); return mesh;
}
const box = (g: Group, x: number, y: number, z: number, sx: number, sy: number, sz: number, color: string, team = false) =>
  add(g, new BoxGeometry(sx, sy, sz), team ? TEAM() : mat(color), x, y, z);
const rock = (g: Group, x: number, y: number, z: number, size: number, color = '#9b4424') =>
  add(g, new DodecahedronGeometry(size, 0), mat(color), x, y, z);

const RESOURCE: Record<string, { shape: string; color: string }> = {
  wheat: { shape: 'crust', color: '#eef3f6' }, rice: { shape: 'mat', color: '#3f8f8a' }, cattle: { shape: 'clump', color: '#8a9a3b' }, sheep: { shape: 'vent', color: '#eef3f6' },
  deer: { shape: 'lens', color: '#5fd4e8' }, fish: { shape: 'disc', color: '#9b4424' }, stone: { shape: 'columns', color: '#3b2f2a' }, bananas: { shape: 'glow', color: '#5fd4e8' },
  gold: { shape: 'nugget', color: '#d9a066' }, gems: { shape: 'shard', color: '#5fd4e8' }, silk: { shape: 'spool', color: '#e7e3dc' }, spices: { shape: 'can', color: '#704c79' },
  wine: { shape: 'crate', color: '#57463d' }, incense: { shape: 'sack', color: '#57463d' }, furs: { shape: 'block', color: '#6fa8c9' }, pearls: { shape: 'spheres', color: '#1d2a44' },
  marble: { shape: 'boulder', color: '#8a9a3b' }, ivory: { shape: 'meteor', color: '#57463d' }, dyes: { shape: 'deposit', color: '#d9a066' }, cotton: { shape: 'tray', color: '#eef3f6' },
  sugar: { shape: 'dome', color: '#6fa8c9' }, whales: { shape: 'wreck', color: '#8d9097' }, horses: { shape: 'tanks', color: '#8d9097' }, iron: { shape: 'ore', color: '#9b4424' },
  niter: { shape: 'crust', color: '#eef3f6' }, coal: { shape: 'oreglow', color: '#3b2f2a' }, oil: { shape: 'drill', color: '#eef3f6' },
};
function resource(g: Group, id: string): void {
  const spec = RESOURCE[id] ?? { shape: 'nugget', color: '#c8693a' }, c = mat(spec.color);
  if (['crust', 'mat', 'disc', 'deposit', 'tray'].includes(spec.shape)) add(g, new CylinderGeometry(.13, .15, .025, 7), c, 0, .013, 0);
  if (spec.shape === 'crust') rock(g, 0, .035, 0, .1, spec.color);
  if (spec.shape === 'mat') add(g, new SphereGeometry(.1, 6, 3), c, 0, .025, 0).scale.set(1, .18, .75);
  if (spec.shape === 'clump') for (let i = 0; i < 3; i++) rock(g, (i - 1) * .08, .04, (i % 2) * .06, .055, i % 2 ? '#c77b2c' : spec.color);
  if (spec.shape === 'vent') { add(g, new CylinderGeometry(.025, .06, .08, 5), c, 0, .04, 0); add(g, new TorusGeometry(.09, .012, 4, 8), mat('#eef3f6'), 0, .02, 0); }
  if (spec.shape === 'lens') { add(g, new CylinderGeometry(.11, .13, .035, 7), mat('#57463d'), 0, .018, 0); add(g, new SphereGeometry(.075, 7, 4), c, 0, .04, 0).scale.set(1, .3, 1); }
  if (spec.shape === 'columns') for (let i = 0; i < 3; i++) add(g, new CylinderGeometry(.035, .04, .14, 5), c, (i - 1) * .07, .07, 0);
  if (spec.shape === 'glow') for (let i = 0; i < 3; i++) { add(g, new CylinderGeometry(.025, .04, .09, 5), mat('#57463d'), (i - 1) * .075, .045, 0); add(g, new SphereGeometry(.045, 5, 3), mat(spec.color, 'EMIT'), (i - 1) * .075, .1, 0); }
  if (['nugget', 'boulder', 'meteor', 'ore', 'oreglow'].includes(spec.shape)) { rock(g, 0, .06, 0, .1, spec.color); rock(g, .09, .035, .04, .06, spec.shape === 'oreglow' ? '#5fd4e8' : spec.color); if (spec.shape === 'oreglow') add(g, new SphereGeometry(.025, 5, 3), mat('#5fd4e8', 'EMIT'), 0, .1, 0); }
  if (spec.shape === 'shard') for (let i = 0; i < 3; i++) add(g, new ConeGeometry(.035, .15 + i % 2 * .04, 4), c, (i - 1) * .06, .08, 0);
  if (spec.shape === 'spool') for (let i = 0; i < 2; i++) add(g, new CylinderGeometry(.045, .045, .08, 6), c, (i - .5) * .1, .04, 0);
  if (spec.shape === 'can') for (let i = 0; i < 2; i++) add(g, new CylinderGeometry(.035, .04, .11, 6), c, (i - .5) * .1, .055, 0);
  if (['crate', 'sack', 'block'].includes(spec.shape)) for (let i = 0; i < 2; i++) box(g, (i - .5) * .09, .045, 0, .09, .09, .1, spec.color);
  if (spec.shape === 'spheres') for (let i = 0; i < 4; i++) add(g, new SphereGeometry(.035, 5, 4), c, Math.cos(i * 1.6) * .07, .035, Math.sin(i * 1.6) * .07);
  if (spec.shape === 'dome') { add(g, new SphereGeometry(.13, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), c, 0, 0, 0); for (let i = 0; i < 2; i++) add(g, new ConeGeometry(.025, .08, 4), mat('#8a9a3b'), (i - .5) * .08, .04, 0); }
  if (spec.shape === 'wreck') { box(g, 0, .04, 0, .2, .06, .12, spec.color); box(g, .15, .05, 0, .16, .015, .06, '#1d2a44'); }
  if (spec.shape === 'tanks') for (let i = 0; i < 2; i++) add(g, new CylinderGeometry(.04, .04, .14, 7), c, (i - .5) * .12, .07, 0);
  if (spec.shape === 'drill') { add(g, new CylinderGeometry(.11, .12, .04, 7), c, 0, .02, 0); add(g, new CylinderGeometry(.012, .018, .18, 5), mat('#8d9097'), 0, .11, 0); }
}
function unit(g: Group, id: string): void {
  if (id === 'boat') {
    box(g, 0, .05, 0, .18, .07, .34, '#57463d');
    for (const x of [-.12, .12]) box(g, x, .025, 0, .025, .04, .42, '#8d9097');
    add(g, new CylinderGeometry(.008, .008, .28, 4), mat('#57463d'), 0, .21, 0);
    add(g, new ConeGeometry(.12, .18, 3), TEAM(), 0, .29, .01, Math.PI / 2);
    return;
  }
  const vehicle = /horseman|chariot|knight|lancer|cavalry|tank|catapult|trebuchet|cannon|artillery|field_gun|at_gun|machine_gun|rocket_artillery|scout|settler/.test(id);
  if (vehicle) {
    box(g, 0, .11, 0, id === 'tank' ? .28 : .19, .09, .27, '#8d9097');
    for (const x of [-.12, .12]) for (const z of [-.09, .09]) add(g, new CylinderGeometry(.035, .035, .025, 7), mat('#1d2a44'), x, .055, z).rotation.z = Math.PI / 2;
    add(g, new BoxGeometry(.14, .035, .12), TEAM_DARK(), 0, .17, -.015);
    add(g, new CylinderGeometry(.018, .025, id === 'tank' ? .2 : .1, 6), mat('#3b2f2a'), 0, .19, .1).rotation.x = Math.PI / 2 - .25;
    if (id === 'scout') add(g, new CylinderGeometry(.006, .006, .18, 4), mat('#1d2a44'), .06, .27, -.05);
    if (id === 'settler') box(g, 0, .24, -.05, .12, .1, .1, '#e7e3dc');
    return;
  }
  // Spacesuited figures, all approximately 0.32 units tall.
  add(g, new CylinderGeometry(.045, .055, .12, 6), mat('#e7e3dc'), 0, .11, 0);
  add(g, new BoxGeometry(.14, .035, .07), TEAM_DARK(), 0, .055, -.005);
  for (const x of [-.07, .07]) box(g, x, .16, 0, .035, .07, .06, '', true);
  add(g, new SphereGeometry(.047, 6, 4), mat('#e7e3dc'), 0, .22, 0);
  box(g, 0, .22, .043, .05, .025, .012, '#1d2a44');
  if (/archer|rifleman|warrior|crossbowman|musketman|man_at_arms|spearman|pikeman/.test(id)) box(g, .09, .13, .04, .025, .2, .025, '#57463d');
  if (id === 'infantry') box(g, 0, .31, 0, .11, .06, .1, '#e7e3dc');
}

export function buildStandIn(key: string): Group {
  const g = new Group();
  if (key === 'tree_pine') add(g, new ConeGeometry(.2, .62, 5), mat('#3b2f2a'), 0, .31, 0);
  else if (key === 'tree_broadleaf') { add(g, new CylinderGeometry(.045, .065, .24, 5), mat('#9b4424'), 0, .12, 0); add(g, new CylinderGeometry(.19, .11, .09, 7), mat('#57463d'), 0, .27, 0); }
  else if (key === 'tree_palm') { add(g, new ConeGeometry(.13, .32, 6), mat('#57463d'), 0, .16, 0); add(g, new ConeGeometry(.12, .08, 6), mat('#eef3f6'), 0, .34, 0); for (let i = 0; i < 3; i++) add(g, new SphereGeometry(.045, 5, 4), mat('#eef3f6'), -.08 + i * .08, .43 + (i % 2) * .025, 0); }
  else if (key === 'tree_jungle') { add(g, new CylinderGeometry(.2, .21, .025, 8), mat('#3b2f2a'), 0, .012, 0); add(g, new TorusGeometry(.18, .035, 4, 8), mat('#57463d'), 0, .025, 0); }
  else if (key === 'tree_snowpine') for (let i = 0; i < 3; i++) add(g, new ConeGeometry(.075, .3, 4), mat('#eef3f6'), (i - 1) * .07, .15, (i % 2) * .04);
  else if (key === 'bush') for (let i = 0; i < 4; i++) rock(g, Math.cos(i * 1.6) * .08, .04, Math.sin(i * 1.6) * .07, .07, '#9b4424');
  else if (key === 'reeds') for (let i = 0; i < 5; i++) add(g, new ConeGeometry(.025, .16, 4), mat(i % 2 ? '#eef3f6' : '#d9a066'), Math.cos(i * 1.3) * .055, .08, Math.sin(i * 1.3) * .05);
  else if (key === 'cactus') { rock(g, 0, .12, 0, .13, '#57463d'); rock(g, .05, .19, -.03, .07, '#3b2f2a'); }
  else if (key === 'flowers') for (let i = 0; i < 6; i++) { add(g, new SphereGeometry(.06, 5, 3), mat(i % 2 ? '#c77b2c' : '#8a9a3b'), Math.cos(i) * .1, .018, Math.sin(i) * .08).scale.set(1, .2, 1); }
  else if (key.startsWith('rock_')) { rock(g, 0, .07, 0, key === 'rock_large' ? .14 : .08, key === 'rock_large' ? '#b5552b' : '#9b4424'); }
  else if (key.startsWith('mountain_')) {
    const c = key === 'mountain_snow' ? '#eef3f6' : '#3b2f2a';
    if (key === 'mountain_b') { add(g, new CylinderGeometry(.75, .82, .58, 6), mat('#9b4424'), 0, .29, 0); add(g, new CylinderGeometry(.66, .66, .06, 6), mat('#57463d'), 0, .61, 0); }
    else if (key === 'mountain_c') { add(g, new CylinderGeometry(.55, .83, .7, 8, 1, true), mat(c), 0, .35, 0); for (let i = 0; i < 7; i++) add(g, new ConeGeometry(.22, .65 + (i % 3) * .1, 5), mat(c), Math.cos(i * Math.PI / 3.5) * .55, .36, Math.sin(i * Math.PI / 3.5) * .55); }
    else { add(g, new ConeGeometry(.86, .76, 7), mat('#57463d'), 0, .38, 0); add(g, new CylinderGeometry(.28, .34, .06, 7), mat('#3b2f2a'), 0, .7, 0); }
    if (key === 'mountain_snow') add(g, new ConeGeometry(.45, .24, 7), mat('#eef3f6'), 0, .68, 0);
  }
  else if (key === 'hill_rocks') for (let i = 0; i < 3; i++) box(g, 0, .04 + i * .055, i * .02, .35 - i * .06, .06, .18, i % 2 ? '#d9a066' : '#9b4424');
  else if (key === 'ice_floe') add(g, new CylinderGeometry(.32, .36, .055, 7), mat('#e8eef2'), 0, .028, 0);
  else if (key === 'reef_coral') for (let i = 0; i < 4; i++) add(g, new ConeGeometry(.045, .13 + i % 2 * .05, 4), mat(i % 2 ? '#eef3f6' : '#3f8f8a'), Math.cos(i * 1.6) * .1, .07, Math.sin(i * 1.6) * .1);
  else if (key === 'camp_barbarian') { for (let i = 0; i < 3; i++) box(g, (i - 1) * .12, .08, 0, .12, .16, .1, i % 2 ? '#57463d' : '#8d9097'); add(g, new CylinderGeometry(.025, .035, .09, 5), mat('#f28c28', 'EMIT'), 0, .045, .1); }
  else if (key === 'ruin_ancient') { box(g, 0, .05, 0, .3, .09, .15, '#8d9097').rotation.z = -.2; add(g, new CylinderGeometry(.018, .03, .13, 5), mat('#57463d'), -.14, .07, 0).rotation.z = -.35; }
  else if (key === 'road_marker') { add(g, new CylinderGeometry(.08, .1, .06, 6), mat('#57463d'), 0, .03, 0); add(g, new CylinderGeometry(.055, .07, .05, 6), mat('#9b4424'), 0, .085, 0); add(g, new SphereGeometry(.025, 5, 4), mat('#f28c28', 'EMIT'), 0, .14, 0); }
  else if (key === 'drop_pod') { add(g, new CylinderGeometry(.12, .17, .22, 7), mat('#8d9097'), 0, .15, 0); add(g, new ConeGeometry(.12, .1, 7), mat('#57463d'), 0, .31, 0); add(g, new CylinderGeometry(.174, .18, .035, 7), mat('#3b2f2a'), 0, .04, 0); add(g, new TorusGeometry(.15, .018, 4, 8), mat('#f28c28', 'EMIT'), 0, .025, 0).rotation.x = Math.PI / 2; box(g, 0, .17, .124, .19, .035, .012, '#f28c28', true); for (let i = 0; i < 3; i++) { add(g, new ConeGeometry(.035, .08, 3), mat('#57463d'), Math.cos(i * 2.094) * .17, .06, Math.sin(i * 2.094) * .17); add(g, new CylinderGeometry(.025, .035, .05, 5), mat('#3b2f2a'), Math.cos(i * 2.094) * .1, .015, Math.sin(i * 2.094) * .1); } }
  else if (key.startsWith('res_')) resource(g, key.slice(4));
  else if (key.startsWith('imp_')) {
    const id = key.slice(4);
    if (id === 'farm') { add(g, new CylinderGeometry(.2, .2, .045, 8), mat('#e7e3dc'), 0, .022, 0); add(g, new SphereGeometry(.18, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), mat('#6fa8c9'), 0, .045, 0); }
    else if (id === 'mine') { box(g, 0, .08, 0, .22, .16, .17, '#57463d'); box(g, 0, .22, 0, .22, .025, .025, '#8d9097'); box(g, 0, .15, .085, .06, .09, .015, '#1d2a44'); }
    else if (id === 'pasture') for (let i = 0; i < 3; i++) add(g, new CylinderGeometry(.055, .06, .15, 7), mat('#eef3f6'), (i - 1) * .13, .075, 0);
    else if (id === 'plantation') { box(g, 0, .09, 0, .38, .18, .2, '#e7e3dc'); box(g, 0, .2, 0, .34, .04, .17, '#6fa8c9'); }
    else if (id === 'lumbermill') { box(g, 0, .08, 0, .28, .16, .2, '#8d9097'); add(g, new CylinderGeometry(.02, .03, .18, 5), mat('#57463d'), .13, .2, 0); }
    else if (id === 'quarry') { add(g, new CylinderGeometry(.18, .22, .09, 6), mat('#3b2f2a'), 0, .045, 0); box(g, 0, .12, 0, .26, .04, .18, '#9b4424'); }
    else if (id === 'fishing_boats') { box(g, 0, .04, 0, .14, .07, .28, '#57463d'); add(g, new ConeGeometry(.08, .1, 4), TEAM(), 0, .15, 0); }
    else if (id === 'camp') { box(g, 0, .07, 0, .2, .14, .16, '#8d9097'); add(g, new CylinderGeometry(.015, .025, .25, 5), mat('#57463d'), .12, .15, 0); }
    else if (id === 'trading_post') { box(g, 0, .06, 0, .17, .12, .17, '#e7e3dc'); add(g, new CylinderGeometry(.008, .008, .29, 4), mat('#8d9097'), 0, .26, 0); add(g, new SphereGeometry(.06, 6, 3), mat('#1d2a44'), 0, .27, .04).scale.set(1, .35, .4); }
    else { add(g, new CylinderGeometry(.025, .045, .36, 5), mat('#8d9097'), 0, .18, 0); box(g, 0, .35, 0, .17, .025, .17, '#57463d'); }
  }
  else if (key.startsWith('city_center_')) {
    const era = Number(key.slice(12)) || 0;
    if (!era) { box(g, 0, .16, 0, .3, .16, .25, '#8d9097'); for (const x of [-.14, .14]) add(g, new CylinderGeometry(.012, .012, .14, 4), mat('#57463d'), x, .07, .12).rotation.z = .35; add(g, new CylinderGeometry(.007, .007, .22, 4), mat('#1d2a44'), .12, .3, 0); }
    else if (era < 3) { for (let i = 0; i < era + 1; i++) add(g, new SphereGeometry(.14, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), mat('#e7e3dc'), (i - era / 2) * .16, .05, 0); }
    else if (era < 5) for (let i = 0; i < 3; i++) { box(g, (i - 1) * .16, .2 + (i % 2) * .06, 0, .11, .4 + (i % 2) * .12, .12, '#6fa8c9'); box(g, (i - 1) * .16, .13, .07, .045, .04, .01, '#f28c28', true); }
    else { add(g, new SphereGeometry(.3, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), mat('#6fa8c9'), 0, .04, 0); for (let i = 0; i < 3; i++) add(g, new ConeGeometry(.025, .09, 4), mat('#8a9a3b'), (i - 1) * .1, .08, 0); }
    box(g, .08, .1, .08, .09, .035, .035, '#f28c28', true);
  }
  else if (key.startsWith('house_')) { const era = Number(key.split('_')[1]) || 0, h = .12 + Math.min(era, 5) * .026; if (era < 2) box(g, 0, h / 2, 0, .15, h, .13, '#e7e3dc'); else if (era < 4) add(g, new SphereGeometry(.09, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2), mat('#6fa8c9'), 0, 0, 0); else box(g, 0, h / 2, 0, .12, h, .12, '#8d9097'); }
  else if (key.startsWith('wall_seg_')) { const lvl = Number(key.slice(9)) || 0; if (lvl === 0) box(g, 0, .08, 0, 1, .16, .12, '#9b4424'); else box(g, 0, lvl === 2 ? .23 : .2, 0, 1, lvl === 2 ? .04 : .3, .06, lvl === 2 ? '#5fd4e8' : '#8d9097'); if (lvl === 2) for (const x of [-.46, .46]) box(g, x, .16, 0, .05, .32, .08, '#5fd4e8'); }
  else if (key.startsWith('wall_tower_')) { const lvl = Number(key.slice(11)) || 0; add(g, new CylinderGeometry(.1, .13, .18 + lvl * .05, 6), mat(lvl ? '#8d9097' : '#9b4424'), 0, .09 + lvl * .025, 0); if (lvl === 2) add(g, new TorusGeometry(.12, .012, 4, 8), mat('#5fd4e8', 'EMIT'), 0, .21, 0); }
  else if (key.startsWith('bld_')) { const id = key.slice(4); box(g, 0, .11, 0, .22, .22, .2, '#e7e3dc'); if (/castle|cathedral|palace/.test(id)) add(g, new ConeGeometry(.1, .2, 5), TEAM(), 0, .31, 0); else if (/observatory|lighthouse/.test(id)) { add(g, new CylinderGeometry(.04, .07, .35, 6), mat('#8d9097'), 0, .25, 0); add(g, new SphereGeometry(.045, 5, 4), mat('#f28c28', 'EMIT'), 0, .44, 0); } else if (/harbor|aqueduct/.test(id)) box(g, 0, .24, 0, .34, .035, .12, '#8d9097'); else add(g, new SphereGeometry(.12, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), mat('#6fa8c9'), 0, .22, 0); box(g, .09, .12, .105, .05, .04, .015, '#f28c28', true); }
  else if (key.startsWith('w_')) { for (let i = 0; i < 4; i++) add(g, new BoxGeometry(.75 - i * .14, .1, .75 - i * .14), mat(i % 2 ? '#9b4424' : '#57463d'), 0, .05 + i * .1, 0); add(g, new CylinderGeometry(.012, .012, .32, 5), mat('#8d9097'), .18, .67, 0); add(g, new SphereGeometry(.06, 6, 4), mat('#f28c28', 'EMIT'), .18, .83, 0); add(g, new SphereGeometry(.04, 6, 4), mat('#1d2a44'), .18, .85, .04); }
  else if (key.startsWith('nw_')) { for (let i = 0; i < 5; i++) add(g, new ConeGeometry(.09 + i % 2 * .05, .35 + i % 3 * .14, 5), mat(i % 2 ? '#57463d' : '#9b4424'), Math.cos(i * 1.3) * .23, .2, Math.sin(i * 1.3) * .23); add(g, new SphereGeometry(.035, 5, 3), mat('#f28c28', 'EMIT'), 0, .4, 0); }
  else if (key.startsWith('u_')) unit(g, key.slice(2));
  else box(g, 0, .075, 0, .15, .15, .15, '#8d9097');
  return g;
}
