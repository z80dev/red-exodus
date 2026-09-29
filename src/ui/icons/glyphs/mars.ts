import { circle, f, poly, rect, s, star, type Glyph } from '../glyph';

const glyph = (body: string, accent: string, crest: string): Glyph => ({
  c: body,
  a: accent,
  l: [
    { d: 'M12 2 21 5v7c0 5.2-3.7 8.5-9 10-5.3-1.5-9-4.8-9-10V5Z', f: body },
    { d: 'M5 7h14v5c0 4.2-2.8 6.7-7 8-4.2-1.3-7-3.8-7-8Z', f: accent },
    { d: 'M5 9h14v2H5Z', f: '#f3e6c8' },
    { d: crest, f: '#233542', inner: true },
  ],
});

const shield = 'M12 6 15.5 9.5 14.8 14.4 12 17 9.2 14.4 8.5 9.5Z';
const orbital = 'M8 12a4 4 0 1 0 8 0a4 4 0 1 0-8 0Z';
const CODE_PALETTES: Record<string, [string, string, string]> = {
  usa: ['#b5473c', '#315278', star(12, 12, 3, 1.5, 5)],
  china: ['#b53630', '#e0ad49', star(12, 12, 3, 1.5, 5)],
  russia: ['#47729a', '#b84b40', shield],
  india: ['#e48a3d', '#4b9067', 'M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8Z'],
  japan: ['#f4e6d4', '#bb5547', circle(12, 12, 2.5)],
  france: ['#385f9b', '#b84c47', shield],
  brazil: ['#42905e', '#dfbc55', 'M12 8 16 12 12 16 8 12Z'],
  uae: ['#b94c40', '#45845a', shield],
  nigeria: ['#43875d', '#e9dfc1', orbital],
  switzerland: ['#ba463d', '#eee2c8', 'M10.8 8h2.4v3h3v2.4h-3v3h-2.4v-3h-3V11h3Z'],
  north_korea: ['#b9453e', '#4775a0', star(12, 12, 3, 1.5, 5)],
  vatican: ['#e4c35e', '#e4dfc6', 'M10 8h4v1.4h-1.3v2.5H15v1.4h-2.3v2.8h-1.4v-2.8H9v-1.4h2.3V9.4H10Z'],
};

export const MARS_GLYPHS: Record<string, Glyph> = {
  cryo: { c: '#5fd4e8', a: '#e7ffff', l: [f('M12 2 19 5v7c0 4.4-3 7.7-7 10-4-2.3-7-5.6-7-10V5Z', '#376b7c'), f('M12 4.5 17 7v5c0 3.1-2.2 5.6-5 7.4-2.8-1.8-5-4.3-5-7.4V7Z', '#a9eff4'), s('M12 7v8M8.5 9l7 4M15.5 9l-7 4', '#397f91', 1.2)] },
  drop: { c: '#d78043', a: '#f4c579', l: [f('M12 2 19 8v7l-7 7-7-7V8Z', '#c76b3c'), f(poly([[12, 2], [19, 8], [12, 12]]), '#e9b566'), f(poly([[5, 8], [12, 12], [12, 22], [5, 15]]), '#96482f'), s('M8 15h8M9 18h6M12 4v6', '#f8e0ae', 1.2)] },
  thaw: { c: '#74c9bd', a: '#ffe0a3', l: [f(circle(12, 12, 9), '#497f70'), f('M12 19c-4-2.4-4.4-5.4-1.8-7.6.2 2 1.6 2.4 2.4 3.8 1.4-2.3 1.5-4.5-.1-7.2 4.1 2.5 5.2 5.2 3.5 8.3-1 1.8-2.4 2.5-4 2.7Z', '#ffc666'), s('M12 4v2M5.5 7l1.5 1.5M18.5 7 17 8.5', '#ffe7b8', 1.2)] },
  storm: { c: '#bf6545', a: '#e9b268', l: [f('M4 7c2-3 4-3 6-1 2-3 5-3 7 0 2-.5 3.5 1 3 3-1 2-3 2-5 2H6C3.5 11 2.5 9 4 7Z', '#d99b67'), s('M6 14h14M4 17h14M3 20h9', '#f0d19e', 1.4), f(star(18, 18, 2, 0.8, 4), '#f1bd65')] },
  breakthrough: { c: '#6ec9d7', a: '#f3d17c', l: [f(poly([[12, 2], [19, 7], [19, 17], [12, 22], [5, 17], [5, 7]]), '#354f59'), f(poly([[12, 3], [18, 7.5], [12, 11], [6, 7.5]]), '#9be9e2'), f(poly([[6, 8], [12, 11], [12, 21], [6, 17]]), '#438a91'), f(poly([[12, 11], [18, 8], [18, 17], [12, 21]]), '#34717f'), s('M12 2.5v18M6 7.5l12 9', '#e8ffff', 1)] },
  building: { c: '#d5cdbd', a: '#d8814b', l: [f('M3 11 12 4l9 7v9H3Z', '#b4c1bd'), f('M5 10.5 12 5.5l7 5v1H5Z', '#e0a169'), f(rect(9, 13, 6, 7, 1.4), '#354b50'), f(rect(4.5, 13, 3, 3, 0.5), '#5fd4e8'), f(rect(16.5, 13, 3, 3, 0.5), '#5fd4e8'), s('M3 20.5h18', '#c9a77d', 1.2)] },
  wonder: { c: '#e2ac5b', a: '#6fc6cb', l: [f(poly([[3, 20], [12, 4], [21, 20]]), '#a55337'), f(poly([[12, 4], [21, 20], [12, 20]]), '#743b30'), s('M5 17h14M8 12h8', '#e8c496', 1), f(circle(12, 6, 2), '#71d0d2'), s('M3 21h18', '#fff0d3', 1)] },
  resource: { c: '#927c63', a: '#69c7d0', l: [f(poly([[12, 2], [18, 10], [16, 20], [8, 20], [6, 10]]), '#877259'), f(poly([[12, 2], [12, 19], [6, 10]]), '#b5edf1'), s('M12 3v16M7 10h10', '#effffb', 1)] },
  improvement: { c: '#b16a42', a: '#d9c7a2', l: [f(poly([[4, 18], [8, 12], [12, 17], [16, 9], [21, 18]]), '#9b5b3c'), s('M3 20h18M6 16h12', '#ddbf92', 1.2), f(circle(17, 7, 2.2), '#e1ae57'), s('M17 3v2M13 7h2M19 7h2', '#f5dca2', 1)] },
  civilian: { c: '#d0d2c8', a: '#6fb7bf', l: [f(rect(3, 12, 18, 6, 1.5), '#7c6958'), f('M6 12 9 7h6l3 5Z', '#e5ddd0'), f(rect(5, 13, 14, 3, 1), '#c9613f'), f(circle(7, 19, 2), '#343e43'), f(circle(17, 19, 2), '#343e43'), s('M7 9h10', '#5fd4e8', 1.2)] },
  recon: { c: '#d7c8a2', a: '#5fd4e8', l: [f('M2 15h17l3 3H3Z', '#77776a'), f(rect(5, 11, 10, 4, 1.5), '#c46d42'), f(circle(6, 19, 2), '#303b40'), f(circle(18, 19, 2), '#303b40'), s('M13 11V6l5-2M16 7h5', '#e7e0cb', 1.4), f(circle(19, 4, 1.2), '#5fd4e8')] },
  melee: { c: '#bac3c4', a: '#c95e37', l: [f('M6 20V11c0-4 2.2-6 6-6s6 2 6 6v9Z', '#49545a'), f('M8 10a4 4 0 0 1 8 0Z', '#8ac8cf'), f(rect(8, 13, 8, 5, 1), '#d2d0c3'), s('M12 13v5M5 14h3M16 14h3', '#e77745', 1.2)] },
  antiCavalry: { c: '#c0c5bd', a: '#d28045', l: [s('M12 21V4', '#9f7047', 1.6), f(poly([[12, 2], [14, 6], [12, 9], [10, 6]]), '#d8d9ce'), s('M6 16 12 13 18 16', '#c95e37', 1.5), f(circle(12, 10, 3), '#53666a')] },
  ranged: { c: '#c7c9c0', a: '#5fd4e8', l: [f('M6 20V11c0-3.7 2.2-5.8 6-5.8s6 2.1 6 5.8v9Z', '#485157'), f('M8 10a4 4 0 0 1 8 0Z', '#a8e8ea'), s('M5 13h14M12 13v6', '#d7d1c3', 1.3), s('M14 12 21 6', '#d6a56b', 1.4)] },
  mounted: { c: '#b7c2c2', a: '#d48647', l: [f(poly([[2, 14], [7, 11], [17, 11], [22, 15], [18, 18], [4, 18]]), '#48545a'), f(poly([[7, 11], [10, 7], [16, 7], [18, 11]]), '#d98148'), f(circle(7, 19, 1.8), '#252e33'), f(circle(18, 19, 1.8), '#252e33'), s('M11 7V4M11 4l6-2', '#d8e7e6', 1.2)] },
  siege: { c: '#b7bbb7', a: '#d87d44', l: [f(rect(3, 15, 18, 4, 1), '#536068'), s('M7 15 15 7h5', '#cbb998', 2), f(circle(7, 20, 1.8), '#333c40'), f(circle(18, 20, 1.8), '#333c40'), f(circle(18, 7, 2), '#e36e45'), s('M15 13h4', '#e8e3d5', 1)] },
  naval: { c: '#bac9ca', a: '#5fd4e8', l: [f(poly([[2, 14], [22, 14], [18, 20], [6, 20]]), '#435760'), f(rect(9, 9, 7, 5, 1), '#d6cec0'), s('M12.5 4v5M5 22c3-1 5-1 7 0s4 1 7 0', '#5fd4e8', 1.3), f(poly([[13, 4], [13, 8], [19, 8]]), '#db9b5f')] },
  armor: { c: '#c6cbc4', a: '#d48346', l: [f(poly([[3, 13], [6, 8], [16, 8], [21, 12], [20, 18], [4, 18]]), '#4b5559'), f(poly([[8, 8], [10, 4], [16, 4], [18, 8]]), '#c6d2d0'), f(circle(7, 19, 2), '#242e31'), f(circle(18, 19, 2), '#242e31'), s('M5 13h14M12 9v8', '#de8249', 1.2)] },
};

const RESOURCE_SYMBOLS: Record<string, [string, string, string]> = {
  wheat: ['#eee5d0', '#b99466', 'shard'],
  rice: ['#4b998b', '#b3d58a', 'mat'],
  cattle: ['#b98748', '#8eaa5a', 'lichen'],
  sheep: ['#8499a2', '#d8eff1', 'vent'],
  deer: ['#8ac6d8', '#effaff', 'ice'],
  fish: ['#92785d', '#d0aa6d', 'swirl'],
  stone: ['#545557', '#a9a69a', 'columns'],
  bananas: ['#5b9d5c', '#b8ea79', 'glowcap'],
  gold: ['#c99a42', '#f3d47e', 'nugget'],
  gems: ['#55b9ba', '#d0fbf0', 'crystal'],
  silk: ['#81aeb5', '#d5e4dc', 'tank'],
  spices: ['#aa5942', '#e5a957', 'canister'],
  wine: ['#6c3e4c', '#d0a86c', 'crate'],
  incense: ['#725342', '#a9794d', 'soil'],
  furs: ['#78a8b4', '#d3f1ef', 'foam'],
  pearls: ['#625a56', '#a5a5a0', 'berries'],
  marble: ['#537d68', '#b5ce9e', 'boulder'],
  ivory: ['#64636a', '#c6a27c', 'meteorite'],
  dyes: ['#9f743d', '#e5bc55', 'deposit'],
  cotton: ['#6d8c5b', '#f1eee3', 'fiber'],
  sugar: ['#527b4b', '#c6ab6f', 'shrub'],
  whales: ['#526a7c', '#c5b694', 'wreck'],
  horses: ['#526d77', '#8fc4d2', 'tank'],
  iron: ['#645b54', '#b17a57', 'ore'],
  niter: ['#ded7c3', '#d4bd75', 'salt'],
  coal: ['#303638', '#91a548', 'glowore'],
  oil: ['#4a5962', '#81b8c1', 'ice'],
};

function resourceGlyph(body: string, accent: string, shape: string): Glyph {
  const outline = f(poly([[4, 19], [5, 12], [8, 7], [12, 5], [17, 7], [20, 13], [20, 19]]), body);
  const details = shape === 'tank'
    ? [f('M8 7h8v10H8ZM10 4h4v3h-4Z', accent), s('M10 10v5M14 10v5', '#f3e8cd', 1)]
    : shape === 'ice' || shape === 'crystal' || shape === 'shard'
      ? [f(poly([[12, 3], [18, 11], [15, 20], [9, 20], [6, 11]]), accent), f(poly([[12, 3], [12, 18], [6, 11]]), '#e7ffff'), s('M12 4v14', body, 1)]
      : shape === 'columns' || shape === 'ore' || shape === 'glowore'
        ? [f(poly([[5, 19], [6, 8], [9, 5], [11, 19]]), accent), f(poly([[12, 19], [13, 3], [16, 6], [19, 19]]), body), s('M7 10h3M14 8h2', '#eee1c4', 1)]
        : shape === 'vent' || shape === 'soil' || shape === 'wreck'
          ? [f('M5 17h14l-2 4H7ZM7 17l5-10 5 10Z', accent), s('M10 12c-2-2 2-3 0-5M14 11c2-2-1-3 1-5', '#e6e3d7', 1)]
          : shape === 'glowcap' || shape === 'lichen' || shape === 'shrub' || shape === 'fiber'
            ? [s('M12 19V9', body, 1.8), f('M12 11C7 11 6 8 7 5c3 0 5 1 5 4 1-4 3-5 6-4 0 3-1 6-6 6Z', accent), f(circle(12, 6, 1.4), '#eff3ad')]
            : shape === 'crate' || shape === 'foam' || shape === 'canister'
              ? [f(rect(5, 6, 14, 13, 1.2), accent), s('M5 11h14M9 6v13M15 6v13', '#f1e6cb', 1)]
              : shape === 'berries' || shape === 'nugget'
                ? [f(poly([[4, 15], [7, 8], [12, 6], [17, 9], [20, 16], [14, 20], [7, 19]]), accent), f(circle(9, 13, 1.5), '#f7e2a4'), f(circle(15, 15, 1.4), '#fff0c4')]
                : shape === 'mat' || shape === 'swirl' || shape === 'deposit'
                  ? [f('M4 11c2-5 7-6 10-3 3-3 6 0 6 3-2 1-3 3-6 2-3 3-8 2-10-2Z', accent), s('M5 16c4-2 10-2 14 0M7 18h10', '#e7d8b8', 1)]
                  : [f(poly([[5, 16], [8, 9], [12, 6], [16, 9], [19, 16], [15, 19], [8, 19]]), accent), s('M8 15l3-4 4 3', '#fff1ce', 1)];
  return { c: body, a: accent, l: [outline, ...details] };
}

for (const [id, [body, accent, shape]] of Object.entries(RESOURCE_SYMBOLS)) {
  const glyph = resourceGlyph(body, accent, shape);
  MARS_GLYPHS[`res_${id}`] = glyph;
  if (id !== 'gold') MARS_GLYPHS[id] = glyph;
}

for (const [id, [body, accent, crest]] of Object.entries(CODE_PALETTES)) {
  MARS_GLYPHS[`nation_${id}`] = glyph(body, accent, crest);
}
const INSTALLATIONS: Record<string, [string, string, string]> = {
  farm: ['#b0a177', '#9cc36c', 'mat'],
  mine: ['#575653', '#c17b4b', 'ore'],
  pasture: ['#627d49', '#d89955', 'lichen'],
  plantation: ['#4f8956', '#95c577', 'shrub'],
  lumbermill: ['#6a5550', '#c3a475', 'crate'],
  quarry: ['#62605c', '#b8b1a1', 'columns'],
  fishing_boats: ['#477f89', '#87cbd0', 'wreck'],
  camp: ['#6e5442', '#d8a15f', 'vent'],
  trading_post: ['#987143', '#e2bb62', 'crate'],
  oil_well: ['#43494b', '#d2a75f', 'tank'],
};

for (const [id, [body, accent, shape]] of Object.entries(INSTALLATIONS)) {
  const glyph = resourceGlyph(body, accent, shape);
  MARS_GLYPHS[id] = glyph;
  MARS_GLYPHS[`imp_${id}`] = glyph;
}

