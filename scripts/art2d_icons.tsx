// Renders the RED EXODUS emblem to the PWA / home-screen icons and the SVG favicon.
// Run: bun scripts/art2d_icons.tsx
//   public/favicon.svg                      emblem, transparent
//   public/icons/icon-{192,512}.png         "any": emblem on a rounded ink tile
//   public/icons/icon-maskable-{192,512}.png "maskable": full-bleed ink, emblem inside the 80% safe circle
//   public/icons/apple-touch-icon.png       180×180 full-bleed (iOS rounds the corners)
import { Resvg } from '@resvg/resvg-js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { EmblemArt } from '../src/ui/art/Emblem';

const OUT = 'public/icons';
mkdirSync(OUT, { recursive: true });

/** emblem markup (rendered inside an <svg> so React keeps SVG element casing, then unwrapped) */
function emblem(uid: string): string {
  return renderToStaticMarkup(
    <svg>
      <EmblemArt uid={uid} />
    </svg>,
  ).replace(/^<svg>|<\/svg>$/g, '');
}

/** Rust-dusk tile background: dusty red gradients, orbital rays and mineral specks. */
function tile(rounded: boolean): string {
  const rays = Array.from({ length: 24 }, (_, i) => {
    const a = (i * Math.PI * 2) / 24;
    const w = Math.PI / 48;
    const R = 80;
    const p = (t: number) => `${(50 + R * Math.cos(t)).toFixed(2)} ${(50 + R * Math.sin(t)).toFixed(2)}`;
    return `M50 50L${p(a - w)}L${p(a + w)}Z`;
  }).join('');
  const specks = [
    [14, 18, 0.5], [82, 14, 0.6], [88, 70, 0.45], [12, 78, 0.55], [24, 90, 0.4], [70, 90, 0.5], [92, 40, 0.35], [8, 44, 0.4],
  ]
    .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff4d0" opacity="0.7"/>`)
    .join('');
  const shape = rounded ? '<rect x="2" y="2" width="96" height="96" rx="22"/>' : '<rect width="100" height="100"/>';
  return `
    <defs>
      <radialGradient id="bg" cx="0.5" cy="0.42" r="0.75">
        <stop offset="0" stop-color="#914b38"/><stop offset="0.55" stop-color="#482b29"/><stop offset="1" stop-color="#171819"/>
      </radialGradient>
      <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stop-color="#ffac68" stop-opacity="0.42"/><stop offset="1" stop-color="#ffac68" stop-opacity="0"/>
      </radialGradient>
      <clipPath id="tile">${shape}</clipPath>
    </defs>
    <g clip-path="url(#tile)">
      <rect width="100" height="100" fill="url(#bg)"/>
      <path d="${rays}" fill="#ef9a62" opacity="0.08"/>
      <circle cx="50" cy="50" r="46" fill="url(#glow)"/>
      ${specks}
    </g>
    ${rounded ? '<rect x="2.6" y="2.6" width="94.8" height="94.8" rx="21.4" fill="none" stroke="#e0b84a" stroke-opacity="0.55" stroke-width="0.9"/>' : ''}`;
}

function svg(size: number, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">${body}</svg>`;
}

function png(name: string, size: number, body: string) {
  const r = new Resvg(svg(size, body), { fitTo: { mode: 'width', value: size }, shapeRendering: 2, imageRendering: 0 });
  writeFileSync(`${OUT}/${name}`, r.render().asPng());
  console.log(`${OUT}/${name}`);
}

/** emblem scaled to `frac` of the canvas, centered */
function placed(frac: number, uid: string): string {
  const s = frac;
  const o = (100 - 100 * s) / 2;
  return `<g transform="translate(${o} ${o}) scale(${s})">${emblem(uid)}</g>`;
}

for (const size of [192, 512]) {
  png(`icon-${size}.png`, size, tile(true) + placed(0.74, `a${size}`));
  png(`icon-maskable-${size}.png`, size, tile(false) + placed(0.62, `m${size}`));
}
png('apple-touch-icon.png', 180, tile(false) + placed(0.72, 'apple'));

writeFileSync('public/favicon.svg', `${svg(64, emblem('f'))}\n`);
console.log('public/favicon.svg');
