// Card-art motif illustrations B (100×100 grid): horse flame eye key hourglass skull compass gear bolt feather
// hand book temple pyramid mask chalice serpent owl lion eagle. Format: ui/art/motifs/index.ts.
// The serpent, lion and eagle are built from small path generators (tube along a centerline, flame-lock ring,
// feather fan) so their repeated anatomy stays regular; everything else is hand-authored path data.
import { circle, ellipse, f, fe, g, gear, s, star, tf, type Glyph, type Layer } from '../../icons/glyph';

type Pt = [number, number];

/** mirror a left-side layer onto the right half of the 100-grid */
const MIRROR = 'matrix(-1 0 0 1 100 0)';
function pair(l: Layer): Layer[] {
  return [l, tf(l.t ? `${MIRROR} ${l.t}` : MIRROR, l)];
}

const rd = (n: number) => Math.round(n * 10) / 10;
const pt = (p: Pt) => `${rd(p[0])} ${rd(p[1])}`;
const polar = (c: Pt, r: number, deg: number): Pt => [c[0] + r * Math.cos((deg * Math.PI) / 180), c[1] + r * Math.sin((deg * Math.PI) / 180)];

/** n+1 samples of a cubic bezier */
function bezier(p0: Pt, p1: Pt, p2: Pt, p3: Pt, n: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
    out.push([a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]]);
  }
  return out;
}

/** points shifted along the polyline normal by k × local width */
function offset(pts: Pt[], ws: number[], k: number): Pt[] {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    return [p[0] - (dy / l) * ws[i] * k, p[1] + (dx / l) * ws[i] * k];
  });
}

/** smooth path through polyline points (quadratic midpoint spline) */
function smooth(pts: Pt[], close = false): string {
  let d = `M${pt(pts[0])}`;
  for (let i = 1; i < pts.length - 1; i++) d += `Q${pt(pts[i])} ${pt([(pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2])}`;
  return `${d}L${pt(pts[pts.length - 1])}${close ? 'Z' : ''}`;
}

/** closed strip of a tube between width fractions k1 and k2 (−0.5…0.5) */
function strip(pts: Pt[], ws: number[], k1: number, k2: number): string {
  return smooth([...offset(pts, ws, k1), ...offset(pts, ws, k2).reverse()], true);
}

/** feather from base b pointing at `deg`: rounded lanceolate vane (half-width w) */
function feather(b: Pt, deg: number, len: number, w: number, tip = 0.7): string {
  const r = (deg * Math.PI) / 180, ux = Math.cos(r), uy = Math.sin(r);
  const P = (t: number, k: number): Pt => [b[0] + ux * len * t - uy * w * k, b[1] + uy * len * t + ux * w * k];
  return `M${pt(P(0, 1))}C${pt(P(0.4, 1.05))} ${pt(P(0.8, tip))} ${pt(P(0.94, tip * 0.8))}C${pt(P(1.02, tip * 0.5))} ${pt(P(1.02, -tip * 0.5))} ${pt(P(0.94, -tip * 0.8))}C${pt(P(0.8, -tip))} ${pt(P(0.4, -1.05))} ${pt(P(0, -1))}Z`;
}
/** the shaded half of feather() (sign of w picks the side) */
function featherShade(b: Pt, deg: number, len: number, w: number, tip = 0.7): string {
  const r = (deg * Math.PI) / 180, ux = Math.cos(r), uy = Math.sin(r);
  const P = (t: number, k: number): Pt => [b[0] + ux * len * t - uy * w * k, b[1] + uy * len * t + ux * w * k];
  return `M${pt(P(0, 0))}L${pt(P(0.96, 0))}C${pt(P(0.94, -tip * 0.8))} ${pt(P(0.8, -tip))} ${pt(P(0.6, -1))}C${pt(P(0.4, -1.05))} ${pt(P(0.1, -1))} ${pt(P(0, -1))}Z`;
}
/** feather shaft between length fractions t0…t1 */
function quill(b: Pt, deg: number, len: number, t0: number, t1: number): string {
  return `M${pt(polar(b, len * t0, deg))}L${pt(polar(b, len * t1, deg))}`;
}

/** ring of n flame-like locks (base radius r0 → tip radius r1, tips hooked by `twist`°) + one engraving vein per lock */
function mane(c: Pt, n: number, r0: number, r1: number, twist: number, rot: number): { d: string; veins: string } {
  const step = 360 / n, D = r1 - r0;
  const P = (r: number, a: number) => pt(polar(c, r, a));
  let d = `M${P(r0, rot)}`, veins = '';
  for (let i = 0; i < n; i++) {
    const a0 = rot + i * step, am = a0 + step / 2, at = am + twist;
    d += `C${P(r0 + D * 0.55, a0 - 2)} ${P(r1 - D * 0.1, at - step * 0.55)} ${P(r1, at)}`;
    d += `C${P(r1 - D * 0.3, at + step * 0.05)} ${P(r0 + D * 0.25, a0 + step * 0.8)} ${P(r0, a0 + step)}`;
    veins += `M${P(r0 + D * 0.05, am + step * 0.05)}C${P(r0 + D * 0.45, am + twist * 0.2)} ${P(r1 - D * 0.3, at - step * 0.28)} ${P(r1 - D * 0.14, at - step * 0.12)}`;
  }
  return { d: `${d}Z`, veins };
}

/** coiled serpent: a two-turn helix (back arc shaded) rising from the front of the upper coil into an S-neck */
function serpent(): Glyph {
  const U = 1.33, N = 100, W = 14;
  const coil: Pt[] = [], cw: number[] = [];
  for (let i = 0; i <= N; i++) {
    const u = (U * i) / N, th = ((180 - 360 * u) * Math.PI) / 180;
    coil.push([50 + (34 - 6 * u) * Math.cos(th), 84 - 12 * u + (10 - 1.8 * u) * Math.sin(th)]);
    cw.push(W - 1.2 * u);
  }
  const at = (u: number) => Math.ceil((u / U) * N);
  const tail = bezier([5, 64], [3, 74], [14, 78], [16, 84], 16);
  const tw = tail.map((_, i) => 1.2 + (W - 1.2) * Math.pow(i / 16, 0.8));
  const e = coil[N];
  const neck = [
    ...bezier(e, [e[0] + 10, e[1] - 6], [90, 52], [78, 46], 14),
    ...bezier([78, 46], [68, 41], [56, 46], [46, 42], 14).slice(1),
    ...bezier([46, 42], [36, 38], [33, 27], [40, 19], 14).slice(1),
    ...bezier([40, 19], [43, 15], [47, 13], [52, 13], 14).slice(1),
  ];
  const nw = neck.map((_, i) => cw[N] - ((cw[N] - 11) * i) / (neck.length - 1));
  const tube = (pts: Pt[], ws: number[], back: boolean): Layer[] => {
    const out = [f(strip(pts, ws, 0.5, -0.5)), f(strip(pts, ws, 0.5, 0.1), 'k')];
    if (back) {
      out.push(f(strip(pts, ws, 0.5, -0.5), 'k'));
    } else {
      // belly scutes + dorsal diamonds
      const A = offset(pts, ws, 0.46), B = offset(pts, ws, 0.12), C = offset(pts, ws, -0.14), n = offset(pts, ws.map(() => 1), 1);
      let bands = '', dia = '';
      for (let i = 3; i < pts.length - 2; i += 3) bands += `M${pt(A[i])}L${pt(B[i])}`;
      for (let i = 3; i < pts.length - 3; i += 5) {
        const tx = pts[i + 1][0] - pts[i - 1][0], ty = pts[i + 1][1] - pts[i - 1][1], l = Math.hypot(tx, ty);
        const ax = (tx / l) * 2.6, ay = (ty / l) * 2.6, nx = (n[i][0] - pts[i][0]) * ws[i] * 0.2, ny = (n[i][1] - pts[i][1]) * ws[i] * 0.2, c = C[i];
        dia += `M${pt([c[0] - ax, c[1] - ay])}L${pt([c[0] + nx, c[1] + ny])}L${pt([c[0] + ax, c[1] + ay])}L${pt([c[0] - nx, c[1] - ny])}Z`;
      }
      out.push(s(smooth(offset(pts, ws, 0.5)), 'd', 1.3), s(smooth(offset(pts, ws, -0.5)), 'd', 1.3), s(bands, 'd', 0.9), f(dia, 'k'));
    }
    out.push(s(smooth(offset(pts, ws, -0.3).slice(2, -2)), 'h', 1.5));
    return out;
  };
  const HEAD = 'translate(46 14) scale(1.2) translate(-46 -14)';
  return g('#f3d98a', undefined,
    ...tube(coil.slice(at(0.48), at(1.02) + 1), cw.slice(at(0.48), at(1.02) + 1), true),
    ...tube([...tail, ...coil.slice(1, at(0.52) + 1)], [...tw, ...cw.slice(1, at(0.52) + 1)], false),
    ...tube([...coil.slice(at(0.98)), ...neck.slice(1)], [...cw.slice(at(0.98)), ...nw.slice(1)], false),
    ...[
      s('M75 14.2Q81 14.2 85 14.2M85 14.2 89.5 11.2M85 14.2 89.5 17.4', 'a', 1.5),
      f('M43 9.5C47 5 53.5 2.8 60 3.4C66 4 72 6.4 76 9.4C78.3 11.1 78.3 13.6 76 14.8C72 16.8 66 18.8 60 20.2C54 21.6 47.5 21.4 43.5 18.4C41.5 15.5 41.5 12 43 9.5Z'),
      f('M44.5 17.4C50.5 19 58 18.6 66 17.1C70 16.3 73.5 15.5 76 14.8C72 16.8 66 18.8 60 20.2C54 21.6 47.5 21.4 43.5 18.4Z', 'k'),
      f('M58.6 10.2C60.2 7.4 64.6 6.7 67.8 8.6C65.6 11.2 61.3 11.8 58.6 10.2Z', 'd'),
      f(circle(63.2, 8.9, 0.8), 'h'),
      s('M57.5 6.9C61.3 5.1 65.8 5.3 69.6 7.6M76.6 13.8C72 14.8 67 15.6 62 16.3C60.6 16.5 59.6 17.1 59 18M73 10.2l1.4 0.5', 'd', 1.1),
      s('M47 8C51 5.6 55.5 4.8 60 4.9', 'h', 1.3),
    ].map((l) => tf(HEAD, l)),
  );
}

/** heraldic lion's face: two rings of flame locks behind a broad-muzzled front face */
function lion(): Glyph {
  const outer = mane([50, 50], 15, 33, 49, 9, -78);
  const inner = mane([50, 51], 13, 25, 39.5, 8, -90);
  const face = 'M50 26C56 25.5 64 27 68 32C72 36 73.5 42 73.5 48C73.5 56 71 62 66 67C62 71 56 75 50 76C44 75 38 71 34 67C29 62 26.5 56 26.5 48C26.5 42 28 36 32 32C36 27 44 25.5 50 26Z';
  return g('#f3d98a', undefined,
    f(outer.d), f(outer.d, 'k'), s(outer.veins, 'd', 1.2),
    f(inner.d), s(inner.veins, 'd', 1.2),
    ...pair(f(ellipse(31, 31, 6.5, 6))), ...pair(f(ellipse(31.5, 32, 3.5, 3.2), 'k')),
    tf('translate(50 52) scale(1.07 1.08) translate(-50 -50)', f(face, 'k')),
    f(face),
    f('M66 32C71 37 73.5 42 73.5 48C73.5 56 71 62 66 67C62 71 56 75 50 76C58 72 64 66 67 58C69.5 50 69 40 66 32Z', 'k'),
    f('M30.5 41.5C35.5 35 43 35 48 39L50 41.5L52 39C57 35 64.5 35 69.5 41.5C63.5 39.2 57.5 40 53 43.5L50 47L47 43.5C42.5 40 36.5 39.2 30.5 41.5Z', 'k'),
    f('M43.5 45.5C44.5 50 44 53 42.5 56.5L50 55L57.5 56.5C56 53 55.5 50 56.5 45.5L50 48Z', 'k'),
    ...pair(f('M32.5 45.5C35 42 41 41.2 45 44.3C41.5 47.8 36 48.3 32.5 45.5Z', 'd')),
    ...pair(f(circle(39.3, 45, 2.1), 'a')), ...pair(f(circle(39.9, 44.4, 0.7), 'h')),
    ...pair(s('M44.5 45.5C45.5 49 45 52 43.5 55', 'd', 1.1)),
    ...pair(f(ellipse(42, 66.5, 8.5, 6.2))),
    f('M34 68.5C37 73 45 73.5 50 69C55 73.5 63 73 66 68.5C63.5 74 56.5 76.5 50 73C43.5 76.5 36.5 74 34 68.5Z', 'k'),
    f('M45.5 70.5C47.5 75.5 52.5 75.5 54.5 70.5C52.5 72 47.5 72 45.5 70.5Z', 'a'),
    f('M41 56.5C43.5 54.2 56.5 54.2 59 56.5C59 60 54.5 63.5 50 64C45.5 63.5 41 60 41 56.5Z', 'd'),
    s('M50 64V67.5M50 67.5C48 70.2 44.5 71 40.5 70.2M50 67.5C52 70.2 55.5 71 59.5 70.2', 'd', 1.5),
    ...pair(s('M37 65h0.1M40.5 63h0.1M44 65h0.1', 'd', 1.6)),
    s('M50 31.5V41M44.5 56.2C46 55.7 47.5 55.6 49 55.9', 'h', 1.8), s('M36 31.5C40 28.8 45 27.8 50 27.8', 'h', 1.8),
  );
}

/** heraldic eagle displayed: fanned tail, raised wings of nine feathers hung from a covert arm, profile head */
function eagle(): Glyph {
  const N = 9, A: Pt = [42, 42], B: Pt = [16, 8];
  const wing = Array.from({ length: N }, (_, i) => {
    const t = i / (N - 1), bow = Math.sin(Math.PI * t);
    const b: Pt = [A[0] + (B[0] - A[0]) * t - 5.4 * bow, A[1] + (B[1] - A[1]) * t - 9 * bow];
    return { b, deg: 100 + 132 * t, len: 14 + 22 * Math.sin(Math.PI * 0.6 * t) };
  });
  // covert rows: scalloped edges across the feather bases (greater row reaches further down the vanes)
  const coverts = (reach: (i: number) => number, bulge: number, close: string) => {
    const pts = wing.map(({ b, deg }, i) => polar(b, reach(i), deg));
    const last = wing[N - 1].b;
    let d = `M${pt([A[0] + 6, A[1] - 8])}C${pt([A[0] - 2, A[1] - 22])} ${pt([last[0] + 12, last[1] - 4])} ${pt([last[0] + 2, last[1] - 6])}`;
    d += `C${pt([last[0] - 4, last[1] - 6.5])} ${pt([pts[N - 1][0] + 0.5, pts[N - 1][1] - 3.5])} ${pt(pts[N - 1])}`;
    for (let i = N - 2; i >= 0; i--) {
      const m: Pt = [(pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2];
      const bm: Pt = [(wing[i].b[0] + wing[i + 1].b[0]) / 2, (wing[i].b[1] + wing[i + 1].b[1]) / 2];
      d += `Q${pt([m[0] + (m[0] - bm[0]) * bulge, m[1] + (m[1] - bm[1]) * bulge])} ${pt(pts[i])}`;
    }
    return { d: d + close, edge: `M${pt(pts[N - 1])}${d.slice(d.indexOf('Q', d.indexOf(pt(pts[N - 1]))))}` };
  };
  const greater = coverts((i) => 12 * (0.8 + (0.3 * i) / (N - 1)), 0.35, `C${pt([A[0] + 2, A[1] + 12])} ${pt([A[0] + 6, A[1] + 6])} ${pt([A[0] + 7, A[1]])}Z`);
  const lesser = coverts(() => 4.2, 0.8, `C${pt([A[0] + 2, A[1] + 4])} ${pt([A[0] + 6, A[1] + 2])} ${pt([A[0] + 7, A[1] - 2])}Z`);
  const tail = [70, 110, 80, 100, 90];
  const HEAD = 'translate(50 36) scale(0.95) translate(-50 -36)';
  const EAGLE_HEAD = 'M57 33C58 27 57 20 54 16C51 12 46 11 42 12.5C39 13 36 14.5 34 16C31 16.5 28.5 19 28 22.5C27.8 25 28.5 27 30 28.5C30.5 26.5 32 25.5 34 25.5L40 25.5C41 28 43 30 46 31C48 32 47 34 46 36Z';
  return g('#f3d98a', undefined,
    ...tail.flatMap((a) => [f(feather([50, 63], a, 33, 4.4)), f(featherShade([50, 63], a, 33, 4.4), 'k'), s(quill([50, 63], a, 33, 0.55, 0.88), 'd', 1.1)]),
    ...wing.flatMap(({ b, deg, len }) => [
      ...pair(f(feather(b, deg, len, 4.6, 0.62))),
      ...pair(f(featherShade(b, deg, len, 4.6, 0.62), 'k')),
      ...pair(s(quill(b, deg, len, 0.55, 0.86), 'd', 1)),
    ]),
    ...pair(f(greater.d)), ...pair(s(greater.edge, 'd', 1.1)), ...pair(f(lesser.d)), ...pair(s(lesser.edge, 'd', 1.1)),
    ...pair(s('M44 33C38 25 30 16 21 9', 'h', 1.6)),
    // feathered thighs with talons splayed outward, clear of the tail fan
    ...pair(f('M42 55C39 58 37 62 37 66L34 68C31 68.5 29.5 70.5 30 72.5L33 72L31.5 75.5C31 77.5 33 78.5 34 77L36 74L37 77.5C37.5 79.5 40 79 40 77L39.5 73.5L42 75C43 75.5 44 74 43 73L41 70C44 67 46 63 46.5 58Z')),
    ...pair(s('M30.2 72.6l-1.8 1.4M31.6 75.7l-1 2.1M37.6 78l.4 2.2', 'd', 1.5)),
    ...pair(s('M40.5 59C40 62 40 64.5 40.5 67M36 68.5C37.5 68.2 38.8 68.8 39.6 70', 'd', 1)),
    f('M50 29C58 29 62 37 62 47C62 57 57 65 50 71C43 65 38 57 38 47C38 37 42 29 50 29Z'),
    f('M56 33C60 37 61 44 60 51C59 58 55 64 50 69C54 62 57 55 57 47C57 41 57 37 56 33Z', 'k'),
    s('M44 44Q47 47 50 44Q53 47 56 44M42 51Q46 55 50 51Q54 55 58 51M44 58Q47 61 50 58Q53 61 56 58M47 64.5Q50 67.5 53 64.5', 'd', 1.2),
    ...[
      tf('translate(1.6 1.8)', f(EAGLE_HEAD, 'k')),
      f(EAGLE_HEAD),
      f('M34 16C31 16.5 28.5 19 28 22.5C27.8 25 28.5 27 30 28.5C30.5 26.5 32 25.5 34 25.5L40 25.5C38 24 36.5 21.5 36.5 18.5Z', 'a'),
      f('M34 25.5C33 25.2 31.5 25.8 30.6 27.2C30 25 30.5 22.5 32 21.5C33 23 34 24.5 36 25Z', 'k'),
      s(EAGLE_HEAD, 'd', 1.1),
      f('M42 19C43 16.8 46.5 16.2 48.5 18C47 20 44 20.5 42 19Z', 'd'), f(circle(45.4, 18.2, 1.3), 'a'), f(circle(45, 17.8, 0.45), 'h'),
      s('M40.5 16.2C43.5 14.8 47.5 14.8 50.5 16.5M36.5 18.5C36.5 21.5 38 24 40 25.5M34.5 18.8h.1M50 25C52 28 54 29.5 57 30M52 20.5C54 23 56 24 58 24.5', 'd', 1.1),
      s('M43 13.5C46.5 12.3 50 12.8 53 15', 'h', 1.4),
    ].map((l) => tf(l.t ? `${HEAD} ${l.t}` : HEAD, l)),
  );
}

export const MOTIFS_B = {
  horse: g('#f3d98a', undefined,
    // flowing tail, far legs (shaded), body with head and neck, near legs, mane
    f('M84 49C91 44 98 47 98 55C98 62 93 66 94 74C95 81 99 85 98 93C95 90 93 87 92 84C92 89 93 92 91 96C87 90 86 84 87 77C88 69 92 63 90 57C89 54 87 53 85 54Z'),
    f('M92 58C94 62 91 67 91 73C91 79 94 83 95 88C91 84 89 79 89 73C89 67 92 63 92 58Z', 'k'),
    f('M65 69C67 74 69 78 68 83L63 91C62 93 60 95 57 97L65 97L67 94C69 91 72 89 74 86C76 82 76 78 76 72Z'),
    f('M65 69C67 74 69 78 68 83L63 91C62 93 60 95 57 97L65 97L67 94C69 91 72 89 74 86C76 82 76 78 76 72Z', 'k'),
    f('M42 45C37 42 32 39 27 39C24 39 22 41 22 44L21 51C21 53 22 55 24 55L29 58L31 54L27 51L27 46C32 47 37 51 43 53Z'),
    f('M42 45C37 42 32 39 27 39C24 39 22 41 22 44L21 51C21 53 22 55 24 55L29 58L31 54L27 51L27 46C32 47 37 51 43 53Z', 'k'),
    f('M9 32C13 26 19 18 23 13C24 9 25 5 27 1C30 4 32 8 32 11C41 6 53 12 58 28C62 35 70 41 77 44C84 46 89 53 88 62C88 67 86 71 83 73C78 76 72 76 68 70C60 69 52 65 45 61C40 59 37 55 37 50C37 44 36 38 33 34C32 36 29 38 26 37C23 38 20 40 17 40C15 41 13 40 13 38C11 39 8 38 8 36C7 35 8 33 9 32Z'),
    f('M38 50C40 56 46 60 54 63C60 66 66 68 70 69C64 70 56 67 49 64C43 62 39 58 38 50Z', 'k'),
    f('M26 37C29 35 31 31 30 26C31 30 32 33 33 34C32 36 29 38 26 37Z', 'k'),
    f('M33 34C36 38 37 44 37 50C38 55 41 58 45 60C42.5 55 41.5 50 41 45C40.5 40 37.5 36 33 34Z', 'k'),
    f('M71 68C75 73 77 78 78 83C78 86 77 89 76 92C75 94 73 96 71 97L80 97L80 93C81 90 81 88 82 87C84 86 86 84 85 81C84 77 84 74 86 70C88 66 88 63 87 60Z'),
    f('M45 51C40 50 34 49 30 49C27 49 26 52 27 55L28 63C28 65 29 67 31 67L36 70L37 66L33 63L32 57C36 57 42 60 49 62Z'),
    f('M28 11C30 5 35 0 42 -1C39 2 39 5 41 8C45 3 51 2 56 4C52 7 51 10 53 13C58 10 64 12 67 16C63 17 62 20 63 23C68 23 72 27 73 33C69 31 66 33 65 36C61 35 58 31 56 27C52 21 47 19 42 17C37 16 33 15 30 14Z'),
    f('M44 18C50 21 55 26 58 31C61 35 64 36 65 36C61 35 58 31 56 27C52 22 48 20 44 18Z', 'k'),
    f('M26 9C23 9 20 11 18 15C21 14 23 15 25 16Z'),
    f('M27 4C28 6 29 8 29 11L27 10Z', 'k'),
    f('M57 97H65L66 93H59ZM71 97H80V93H73ZM31 67 36 70 37 66 33 63ZM24 55 29 58 31 54 27 51Z', 'k'),
    s('M33 10C35 6 38 3 41 1M44 10C46 7 50 5 54 4M54 15C58 13 62 14 65 16M62 25C66 25 69 28 71 31M89 52C94 51 96 56 94 61M91 76C92 82 94 86 96 90', 'd', 1.3),
    s('M45 59C44 52 47 45 53 41M70 69C73 62 79 58 86 60M81 86C79 88 79 90 79 93M29 60 29 57M35 38C38 42 39.5 47 40 52M45 51.2C40 50.2 35 49.6 31 49.6', 'd', 1.5),
    s('M28 15C25 22 21 29 18 35M13 25C16 29 20 34 23 37', 'a', 1.8),
    f(circle(17.5, 36, 2), 'a'), f(circle(17.5, 36, 0.8), 'd'),
    f('M19 20C21 18 24 18 26 20C24 22 21 22 19 20Z', 'd'), f(circle(12, 33, 1.3), 'd'), s('M8 36.5 13 37.5', 'd', 1),
    s('M12 28C15 23 18 18 22 14M63 34C68 39 73 43 78 45M82 49C86 52 87 56 87 60M32 50C37 50 41 51 44 51', 'h', 1.8),
    f(circle(21.5, 19.5, 0.7), 'h'),
  ),
  flame: g('#f3d98a', undefined,
    f('M27 56Q25 43 36 34Q34 46 42 46Q40 31 55 13Q55 30 65 36Q72 26 71 21Q83 40 76 56Q73 66 67 70H35Q29 65 27 56Z','a'),
    f('M37 58Q34 49 44 41Q43 52 51 53Q50 39 62 31Q60 44 69 49Q74 60 65 68H42Q37 65 37 58Z'),
    f('M47 59Q47 52 54 47Q53 56 60 60Q63 65 58 68H49Q45 65 47 59Z','a'),
    f('M22 67Q50 72 78 67L73 80Q50 87 27 80Z'), f('M27 81H73L78 90H22Z','k'),
    s('M31 72Q50 76 69 72M29 82H71','d',1.5), f(star(50,86,3,1.6,4),'a'),
    s('M40 31Q43 23 49 18M66 41Q71 37 72 32','h',2.3),
  ),
  eye: g('#f3d98a', undefined,
    f(star(50,50,46,39,16,-90),'m'), f(ellipse(50,51,36,19)),
    f('M15 51Q50 13 85 51Q50 89 15 51Z','m'),
    f('M20 51Q50 22 80 51Q50 80 20 51Z','k'),
    f(ellipse(50,50,13,16),'a'), f(circle(50,50,7),'d'), f(circle(47,46,3),'h'),
    s('M19 50Q50 19 81 50','h',2.5), s('M50 13v-8M31 20l-5-8M69 20l5-8M17 35 8 30M83 35l9-5M13 51H5M87 51h8','a',2),
    s('M23 43Q50 23 77 43','d',1.5),
  ),
  // authored upright (bow on top), turned to the diagonal
  key: g('#f3d98a', undefined,
    ...[
      fe(`${circle(50, 22, 15)}${circle(50, 22, 8)}`),
      ...[-135, -45, 45, 135].map((a) => f(circle(50 + 16.5 * Math.cos((a * Math.PI) / 180), 22 + 16.5 * Math.sin((a * Math.PI) / 180), 3.2))),
      f(circle(50, 4.5, 4.2)), f(star(50, 4.5, 3.2, 1.3, 4), 'a'),
      s('M60.8 18.1A11.5 11.5 0 0 1 46.1 32.8', 'k', 6.5),
      s(circle(50, 22, 11.5), 'd', 0.9),
      f('M46.5 36H53.5V87Q53.5 91.5 50 91.5Q46.5 91.5 46.5 87Z'),
      f('M53 68H63V72.5H68V77H63V81.5H68V86H53Z'),
      f('M50 36H53.5V87Q53.5 91.5 50 91.5ZM53.5 77H63V81.5H53.5Z', 'k'),
      f('M42 36.5H58L60 40.5L58 44.5H42L40 40.5Z'), f('M50 37.4 53 40.5 50 43.6 47 40.5Z', 'a'),
      f('M44.8 53H55.2V57H44.8ZM44.8 60H55.2V64H44.8Z'),
      s('M40.5 40.5H47M53 40.5H59.5M53.5 72.5H63M53.5 81.5H63M63 72.5V77M63 81.5V86', 'd', 1),
      s('M38.5 15.5A12.5 12.5 0 0 1 45.5 9.6M48.2 46V51M48.2 66V86', 'h', 1.8),
    ].map((l) => tf('rotate(-45 50 50)', l)),
  ),
  hourglass: g('#f3d98a', undefined,
    f('M28 12H72V21Q72 34 56 46Q50 50 56 54Q72 66 72 79V88H28V79Q28 66 44 54Q50 50 44 46Q28 34 28 21Z'),
    f('M34 19H66Q65 31 50 43Q35 31 34 19Z','k'),
    f('M35 81Q36 68 50 57Q64 68 65 81Z','k'),
    f('M38 76Q43 70 50 63Q57 70 62 76Z','a'), f('M39 26Q47 33 50 37Q54 32 61 26Z','a'),
    f('M25 9H75V16H25Z'),f('M25 84H75V91H25Z'),
    s('M34 13H66M34 87H66M38 23Q41 30 47 35M53 58Q59 64 62 72','h',2),
    s('M34 19Q35 34 48 45M52 55Q66 67 66 81','d',1.5),
  ),
  skull: g('#f3d98a', undefined,
    f('M34 73C32.5 79 33.5 84.5 37.5 88.5C41.5 92.3 45.5 93.5 50 93.5C54.5 93.5 58.5 92.3 62.5 88.5C66.5 84.5 67.5 79 66 73Z'),
    f('M57 90.5C60 89.5 62 88 63.5 86C66 82.5 67 78 66 73H62C62.5 80 60.5 86 57 90.5Z', 'k'),
    f('M50 6C66 6 80 17 81 34C81.5 42 80 48 77 52C79.5 55 79 59 76 61C73 63 70 65 68 69L66 77H34L32 69C30 65 27 63 24 61C21 59 20.5 55 23 52C20 48 18.5 42 19 34C20 17 34 6 50 6Z'),
    f('M66 9C76 15 81 25 81 34C81.5 42 80 48 77 52C79.5 55 79 59 76 61C73 63 70 65 68 69L66 77H61C65 70 68 63 70.5 55C74 43 73 24 66 9Z', 'k'),
    f('M24 61C27 63 30 65 32 69L34 77H38.5C37.5 71 35 65.5 29.5 62.5ZM76 61C73 63 70 65 68 69L66 77H61.5C62.5 71 65 65.5 70.5 62.5Z', 'k'),
    ...pair(f('M26.5 47C26.5 40.5 32.5 38 39 39C45.5 40 47.5 44.5 46.5 49.5C45.5 55.5 41.5 58.5 35.5 57.5C30 56.5 26.5 52.5 26.5 47Z', 'd')),
    ...pair(f(circle(37.5, 48.5, 2.6), 'a')), ...pair(f(circle(36.7, 47.6, 0.9), 'h')),
    f('M50 57C48 60.5 45 64.5 46 67.5C47 69 49 68.5 50 66.8C51 68.5 53 69 54 67.5C55 64.5 52 60.5 50 57Z', 'd'),
    f('M36 70.5H64V77.2Q50 79.4 36 77.2Z'), f('M37.5 79.3Q50 81.3 62.5 79.3V85Q50 87 37.5 85Z'),
    s('M40.5 71v6.8M45.2 71v7.5M50 71v7.8M54.8 71v7.5M59.5 71v6.8M42.5 80v5.4M46.3 80.5v5.4M50 80.6v5.5M53.7 80.5v5.4M57.5 80v5.4M35.5 78.3Q50 80.6 64.5 78.3', 'd', 1.1),
    s('M50 6.5V13.5L47 17 50.5 20.5 48 24M50 13.5C55 13 59.5 11.5 63 9M50 13.5C45 13 40.5 11.5 37 9', 'd', 1.1),
    s('M27 24C31 16 38 11 46 9.6M24.5 32C25 29.5 26 27.5 27 26', 'h', 2.2),
  ),
  compass: g('#f3d98a', undefined,
    f(circle(50,50,42)), f(circle(50,50,35),'k'),
    f(star(50,50,34,10,8,-90),'a'), f(star(50,50,25,8,8,-67.5)),
    f('M50 13 55 45 50 50 45 45Z','h'), f('M87 50 55 55 50 50 55 45Z','k'),
    f('M50 87 45 55 50 50 55 55Z','k'), f('M13 50 45 45 50 50 45 55Z','h'),
    f(circle(50,50,7)), f(circle(50,50,3),'a'),
    s(circle(50,50,38),'h',2), s('M50 6v8M94 50h-8M50 94v-8M6 50h8','d',1.6),
    s('M50 17v11M83 50H72M50 83V72M17 50h11','d',1.4),
  ),
  gear: g('#f3d98a', undefined,
    f(gear(38,50,29,23,12,-90)), f(gear(66,50,24,18,10,-90),'a'),
    f(circle(38,50,15),'k'), f(circle(66,50,11),'k'),
    f(circle(38,50,8)), f(circle(66,50,6)),
    f(circle(38,50,3),'a'), f(circle(66,50,2.5),'m'),
    s(circle(38,50,18),'h',2), s(circle(66,50,14),'h',1.8),
    s('M37 26v8M62 30v7M37 66v8M65 63v8','d',1.5),
  ),
  bolt: g('#f3d98a', undefined,
    f('M57 5 23 54H44L37 95 78 42H56Z'),
    f('M57 12 33 49H50L44 77 69 47H52Z','a'),
    s('M58 12 49 34','h',2.5),
    f(star(18,27,6,2.5,4),'a'),f(star(81,22,5,2,4),'m'),f(star(82,72,7,3,4),'a'),f(star(20,77,4,1.7,4),'m'),
    s('M14 48l8-4M78 10l-3 7M90 53l-7 2M31 16l3 6','a',2),
    f(circle(18,27,1.5),'h'),f(circle(82,72,1.5),'h'),
  ),
  // quill authored upright (tip on top), tilted; split vanes, herringbone barbs, inked nib
  feather: g('#f3d98a', undefined,
    ...[
      f('M51 78C57 76 62 72 64 66C66 60 66 55 65 51L58 48.5C62 46 66 43 67 38C68 32 67 27 65 24L58 23.5C61 20 62 15 60 11C58 7 55 4 51 2C47 5 44 8 42.5 13C41 18 40.5 23 41 28L47 30.5C43 33 39.5 38 38.5 44C37.5 51 38 57 40 62L47 62.5C44 65 42.5 69 44 73C45.5 76 47.5 77.5 49 78Z'),
      f('M51 2C47 5 44 8 42.5 13C41 18 40.5 23 41 28L47 30.5C43 33 39.5 38 38.5 44C37.5 51 38 57 40 62L47 62.5C44 65 42.5 69 44 73C45.5 76 47.5 77.5 49 78H50.4C50.3 60 50.5 30 51 2Z', 'k'),
      s('M51.2 72 61.5 64.5M51.3 64 64 55M51.4 44 64.5 35.5M51.5 36 64 28.5M51.6 18 59 11.5M50.2 72 43.5 67.5M50.2 55 40 47.5M50.3 47 40.5 39.5M50.5 24 43 18M50.6 16 44.5 11', 'd', 1),
      s('M49.5 80C47 78.5 44.5 79.5 42.5 82M51.5 80C54 78.5 56.5 79.5 58.5 82', 'm', 1.6),
      f('M48.8 95C49.2 72 49.9 40 50.6 4L51.6 4.5C51.3 40 51.4 72 51.4 95Q50.1 98.5 48.8 95Z'),
      f('M48.9 90.5H51.4V95Q50.1 98.5 48.8 95Z', 'a'),
      s('M44 16C45 11 47.5 7 50 4.5M60.5 58C61.5 62 61 66 59 69', 'h', 1.6),
    ].map((l) => tf('rotate(35 50 50)', l)),
  ),
  hand: g('#f3d98a', undefined,
    f('M29 87Q24 83 27 75L31 61 30 36Q30 29 35 29Q40 29 40 36V53L42 20Q42 13 47 13Q52 13 52 20V51L55 17Q56 11 61 12Q66 13 65 19L63 52 68 25Q70 19 75 22Q80 24 78 31L73 60Q82 50 86 57Q89 62 83 70L70 88Q62 94 48 92Z'),
    f('M35 58 35 37Q35 33 37 34L38 60M47 51 47 20Q47 17 49 19L50 53M60 52 61 19Q61 16 62 19L61 54M71 54 74 28Q76 26 74 34L69 62Z','k'),
    f('M49 69Q50 62 57 62Q64 62 65 69Q65 76 57 79Q49 76 49 69Z','a'),
    f(circle(57,70,3),'d'),f(circle(55,67,1.5),'h'),
    s('M31 73Q38 78 44 75M39 31v13M49 17v22M62 16v20','h',2.2),
    s('M47 83Q56 87 66 82','d',1.5),
  ),
  book: g('#f3d98a', undefined,
    f('M8 22Q27 14 49 27V84Q28 72 8 80Z'), f('M92 22Q73 14 51 27V84Q72 72 92 80Z','a'),
    f('M49 27Q50 24 51 27V85Q50 82 49 85Z','k'),
    s('M14 30Q30 26 43 34M14 40Q29 36 43 44M14 50Q29 46 43 54M14 60Q29 56 43 64M86 30Q70 26 57 34M86 40Q71 36 57 44M86 50Q71 46 57 54M86 60Q71 56 57 64','d',1.4),
    s('M11 24Q29 18 46 29M89 24Q71 18 54 29','h',2.2),
    f('M51 76Q57 87 50 96Q43 87 49 76Z','a'),
    f(star(50,19,5,2,4),'m'),
  ),
  temple: g('#f3d98a', undefined,
    f('M10 38 50 12 90 38Z'), f('M18 38H82V45H18Z','a'),
    f('M22 47H31V78H22ZM39 47H48V78H39ZM52 47H61V78H52ZM69 47H78V78H69Z'),
    f('M15 78H85V84H15Z'), f('M10 84H90V91H10Z','k'),
    f('M30 34 50 21 70 34Z','k'), f(circle(50,32,4),'a'),
    s('M16 38 50 16 84 38M25 49v25M42 49v25M56 49v25M73 49v25','h',2),
    s('M19 44H81M14 87H86','d',1.6),
  ),
  pyramid: g('#f3d98a', undefined,
    f('M50 9 91 84H9Z'), f('M50 9 50 84H9Z','k'),
    f('M50 9 61 29 50 34 39 29Z','a'), f('M50 9 61 29 50 25Z','h'),
    s('M50 9 9 84H91Z','h',2.5), s('M50 34V84M50 34 9 84M50 34 91 84','d',1.7),
    f('M9 84H91V91H9Z','a'), s('M18 81H82','h',2),
    f(star(50,21,3,1.4,4),'m'),
  ),
  mask: g('#f3d98a', undefined,
    f('M14 18Q35 11 53 22V54Q51 75 33 83Q15 77 12 58Z'),
    f('M48 22Q66 11 86 18L88 58Q85 77 67 83Q50 75 48 54Z','a'),
    f('M16 24Q33 18 47 26V50Q37 45 28 52L17 47Z','k'),
    f('M53 26Q67 18 84 24L83 47 72 52Q63 45 53 50Z','k'),
    f('M20 43Q29 35 39 43Q31 50 20 47Z','d'), f('M60 43Q70 35 80 43Q69 50 60 47Z','d'),
    s('M22 62Q34 53 45 63Q37 76 26 69M57 63Q69 53 79 62Q76 74 64 72','d',2),
    s('M19 25Q31 18 43 24M57 24Q70 18 81 25','h',2.4),
    f(star(32,31,3,1.3,4),'a'), f(circle(68,31,2.5),'h'),
  ),
  chalice: g('#f3d98a', undefined,
    f('M29 16H71L67 42Q64 54 55 58V73H69V82H31V73H45V58Q36 54 33 42Z'),
    f('M35 22H65L62 41Q59 51 50 53Q41 51 38 41Z','a'),
    f('M38 25H62L59 39Q57 45 52 47Q56 37 50 34Q44 41 41 39Z','k'),
    f(circle(50,32,5),'m'), f(star(50,32,3.6,1.5,4),'a'),
    f('M26 14H74V21H26Z','k'),f('M27 82H73V89H27Z'),
    s('M34 19H66M39 25Q42 38 47 42M38 76H62','h',2.4),
    s('M45 59v12M55 59v12','d',1.5),
  ),
  serpent: serpent(),
  owl: g('#f3d98a', undefined,
    // tail, branch with a leafed twig, body with ear tufts, facial disc, eyes, folded wings, talons
    f('M43 84L44.5 97.5 48 95 50 98 52 95 55.5 97.5 57 84Z'), s('M48 88v6M52 88v6', 'd', 1),
    f('M3 87C18 84 38 85 58 84C72 83.5 84 81 94 77C96 76 98 78 97 80C95 83 90 85 86 86.5C74 90 60 91.5 44 92C28 92.5 14 94 5 94.5C2 94.5 1 88 3 87Z'),
    f('M5 94.5C14 94 28 92.5 44 92C60 91.5 74 90 86 86.5C90 85 95 83 97 80C96 84 90 87 84 89C72 92.5 58 93.5 44 94C28 94.5 14 95.5 5 96.5Z', 'k'),
    s('M8 90C16 89 22 89 28 88.5M64 88C70 87.5 76 86 80 84.5', 'd', 1.1),
    f('M84 80C86 74 90 70 95 69C95 74 91 78 86 80Z', 'a'), f('M88 82C92 80 97 81 99 84C95 86 91 85 88 82Z', 'a'),
    s('M86 80C88 77 91 74 94 71M88 82C92 82 95 83 97 84', 'd', 0.9),
    f('M50 18C55 15.5 61 14.5 66 15C69 10 73 5 77 0C78 4 78 7 77 11C79 9 81.5 7.5 85.5 6C83.5 12 80.5 17 77 21C81 28 82 36 80 44C84 56 82 71 72 81C66 86 58 88 50 88C42 88 34 86 28 81C18 71 16 56 20 44C18 36 19 28 23 21C19.5 17 16.5 12 14.5 6C18.5 7.5 21 9 23 11C22 7 22 4 23 0C27 5 31 10 34 15C39 14.5 45 15.5 50 18Z'),
    f('M72 22C78 30 80 38 78 46C82 58 79 71 70 80C64 85 57 87 50 87C60 83 68 75 72 64C75 54 76 40 72 22Z', 'k'),
    ...pair(s('M23.5 4C24.5 9 26.5 13 29 16.5M17.5 9C20 12 22.5 15 25 18', 'd', 1.1)),
    s('M40 64q2.5 2.5 5 0q2.5 2.5 5 0q2.5 2.5 5 0q2.5 2.5 5 0M37.5 70.5q2.5 2.5 5 0q2.5 2.5 5 0q2.5 2.5 5 0q2.5 2.5 5 0q2.5 2.5 5 0M40 77q2.5 2.5 5 0q2.5 2.5 5 0q2.5 2.5 5 0q2.5 2.5 5 0', 'd', 1.1),
    tf('translate(50 40) scale(1.1) translate(-50 -40)', f('M50 27C44 20.5 31 20.5 26.5 30C22.5 39.5 26 51 36 55.5C42 58 47 56 50 60C53 56 58 58 64 55.5C74 51 77.5 39.5 73.5 30C69 20.5 56 20.5 50 27Z', 'k')),
    f('M50 27C44 20.5 31 20.5 26.5 30C22.5 39.5 26 51 36 55.5C42 58 47 56 50 60C53 56 58 58 64 55.5C74 51 77.5 39.5 73.5 30C69 20.5 56 20.5 50 27Z', 'p'),
    s('M50 27C44 20.5 31 20.5 26.5 30C22.5 39.5 26 51 36 55.5C42 58 47 56 50 60C53 56 58 58 64 55.5C74 51 77.5 39.5 73.5 30C69 20.5 56 20.5 50 27Z', 'd', 1.2),
    ...pair(s('M29 42C31 44 32 46 32.5 49M31 33C33 34 34 35 35 36.5', 'k', 1.1)),
    ...pair(f(circle(39, 39.5, 8.2), 'd')), ...pair(f(circle(39, 39.5, 6.4), 'a')), ...pair(f(circle(39.5, 40, 3.2), 'd')), ...pair(f(circle(37.5, 37.5, 1.3), 'h')),
    ...pair(s('M26.5 28.5C34 27 42 29.5 48.5 36', 'd', 1.8)),
    f('M46.5 44C46.5 41.5 53.5 41.5 53.5 44C53.5 48.5 51.5 53 50 55.5C48.5 53 46.5 48.5 46.5 44Z', 'd'), s('M48.5 44C48.5 46 49 48 50 50', 'h', 1),
    ...pair(f('M23.5 43C17 53 16 67 20.5 78L27 91.5C29.5 85 32 77 33.5 68C35 58 32 49 23.5 43Z')),
    tf(MIRROR, f('M23.5 43C17 53 16 67 20.5 78L27 91.5C29.5 85 32 77 33.5 68C35 58 32 49 23.5 43Z', 'k')),
    ...pair(s('M22.5 52q2.5 3 5.5 1.5M21 59q3 3 6.5 1.5M21 66q3 2.5 7 1M21.5 73C23 78 25 83 27 89M25 72C26 77 27.5 82 28.5 86M28.5 70C29 74 29.5 78 30 82', 'd', 1.1)),
    ...pair(s('M23 47C20 53 19 60 19.5 66', 'h', 1.4)),
    ...pair(f('M38 81C37 84 36 86 35 88.5C35 90 36.5 90.5 37.5 89.5L39 87.5 40 90C40.5 91.5 42.5 91.5 42.5 90L42.5 87.5 44 89.5C45 90.5 46.5 90 46 88.5C45 86 44 83.5 43 81Z')),
    ...pair(s('M35.3 89.5l-.6 2.2M40.3 90.8l0 2.2M45.8 89.3l.8 2', 'd', 1.3)),
    s('M30 22C36 18.5 44 18.5 49 21', 'h', 1.5),
  ),
  lion: lion(),
  eagle: eagle(),
} satisfies Record<string, Glyph>;
